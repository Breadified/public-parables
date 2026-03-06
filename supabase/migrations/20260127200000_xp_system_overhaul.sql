-- =============================================================================
-- XP System Overhaul Migration
-- Local-first with durable persistence, realtime sync to server
-- =============================================================================

-- Phase 1: Create user_profile_summary table
-- Consolidates user display info + level (single row per user)
-- =============================================================================

CREATE TABLE IF NOT EXISTS user_profile_summary (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  level INTEGER DEFAULT 1,
  streaks JSONB DEFAULT '{
    "login": {"current": 0, "last_date": null},
    "reading": {"current": 0, "last_date": null},
    "notes": {"current": 0, "last_date": null},
    "plan": {"current": 0, "last_date": null},
    "devotion": {"current": 0, "last_date": null}
  }'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for profile lookups by level (for leaderboards)
CREATE INDEX IF NOT EXISTS idx_profile_summary_level ON user_profile_summary(level);

-- RLS policies for user_profile_summary
ALTER TABLE user_profile_summary ENABLE ROW LEVEL SECURITY;

-- Users can read any profile summary (for viewing other users' levels)
CREATE POLICY "Anyone can view profile summaries"
  ON user_profile_summary FOR SELECT
  USING (true);

-- Users can only update their own profile summary
CREATE POLICY "Users can update own profile summary"
  ON user_profile_summary FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can insert their own profile summary
CREATE POLICY "Users can insert own profile summary"
  ON user_profile_summary FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- =============================================================================
-- Phase 2: Create user_streak_log table (append-only history)
-- For future streak restoration if needed
-- =============================================================================

CREATE TABLE IF NOT EXISTS user_streak_log (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL,
  streak_value INTEGER NOT NULL,
  event_type TEXT NOT NULL,  -- 'increment', 'reset', 'milestone_7', 'milestone_30', 'milestone_365'
  event_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_streak_log_user ON user_streak_log(user_id, activity_type, event_date DESC);

-- RLS policies for user_streak_log
ALTER TABLE user_streak_log ENABLE ROW LEVEL SECURITY;

-- Users can read their own streak log
CREATE POLICY "Users can view own streak log"
  ON user_streak_log FOR SELECT
  USING (auth.uid() = user_id);

-- Insert handled by server functions (SECURITY DEFINER)
CREATE POLICY "Users can insert own streak log"
  ON user_streak_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- =============================================================================
-- Phase 3: Update calculate_level_from_xp function (72000 base, 4x increase)
-- =============================================================================

DROP FUNCTION IF EXISTS calculate_level_from_xp(INTEGER);
CREATE OR REPLACE FUNCTION calculate_level_from_xp(p_total_xp INTEGER)
RETURNS INTEGER AS $$
DECLARE
  v_level INTEGER := 1;
  v_xp_needed NUMERIC := 0;
  v_base NUMERIC := 72000;  -- Changed from 18000 (4x increase)
  v_curve NUMERIC := 1.05;
BEGIN
  WHILE v_xp_needed <= p_total_xp LOOP
    v_level := v_level + 1;
    v_xp_needed := v_xp_needed + v_base * POWER(v_curve, v_level - 2);
  END LOOP;
  RETURN v_level - 1;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =============================================================================
-- Phase 4: Trigger to update user level on reward insert
-- Keeps user_profile_summary.level in sync for other users to read
-- =============================================================================

CREATE OR REPLACE FUNCTION update_user_level_on_reward()
RETURNS TRIGGER AS $$
DECLARE
  v_total_xp INTEGER;
  v_new_level INTEGER;
BEGIN
  -- Compute total XP from rewards
  SELECT COALESCE(SUM(points), 0) INTO v_total_xp
  FROM user_rewards WHERE user_id = NEW.user_id;

  -- Calculate level (72000 base, 1.05 curve)
  v_new_level := calculate_level_from_xp(v_total_xp);

  -- Upsert profile summary with new level
  INSERT INTO user_profile_summary (user_id, level, updated_at)
  VALUES (NEW.user_id, v_new_level, NOW())
  ON CONFLICT (user_id) DO UPDATE SET
    level = v_new_level,
    updated_at = NOW();

  -- Also update user_global_stats for backwards compatibility
  INSERT INTO user_global_stats (user_id, total_xp, level, updated_at)
  VALUES (NEW.user_id, v_total_xp, v_new_level, NOW())
  ON CONFLICT (user_id) DO UPDATE SET
    total_xp = v_total_xp,
    level = v_new_level,
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop existing trigger if exists, then create
DROP TRIGGER IF EXISTS trg_update_level_on_reward ON user_rewards;
CREATE TRIGGER trg_update_level_on_reward
AFTER INSERT ON user_rewards
FOR EACH ROW EXECUTE FUNCTION update_user_level_on_reward();

-- =============================================================================
-- Phase 5: Idempotency index for batch sync
-- Prevents duplicate rewards for same activity on same day
-- =============================================================================

-- Immutable wrapper for DATE() on TIMESTAMPTZ (required for index expressions)
-- DATE(timestamptz) depends on session timezone, so PostgreSQL won't allow it in indexes.
-- This function pins to UTC, making it truly immutable.
CREATE OR REPLACE FUNCTION immutable_date_utc(ts TIMESTAMPTZ)
RETURNS DATE AS $$
  SELECT (ts AT TIME ZONE 'UTC')::DATE;
$$ LANGUAGE SQL IMMUTABLE;

-- Deduplicate existing rewards before creating unique index
-- Keeps the earliest reward (by created_at) for each (user, type, date, ref) combo
DELETE FROM user_rewards a
USING user_rewards b
WHERE a.user_id = b.user_id
  AND a.reward_type = b.reward_type
  AND immutable_date_utc(a.created_at) = immutable_date_utc(b.created_at)
  AND COALESCE(a.reference_id, '') = COALESCE(b.reference_id, '')
  AND a.created_at > b.created_at;

-- Create unique index for idempotent inserts
-- This allows batch sync to use ON CONFLICT DO NOTHING
CREATE UNIQUE INDEX IF NOT EXISTS idx_rewards_idempotent
ON user_rewards (user_id, reward_type, immutable_date_utc(created_at), COALESCE(reference_id, ''));

-- =============================================================================
-- Phase 6: batch_record_activities RPC
-- Single endpoint for recording multiple activities with idempotent handling
-- =============================================================================

CREATE OR REPLACE FUNCTION batch_record_activities(
  p_user_id UUID,
  p_activities JSONB,  -- [{ type, timestamp, ref }, ...]
  p_client_date DATE
)
RETURNS JSONB AS $$
DECLARE
  v_activity JSONB;
  v_confirmed JSONB := '[]'::jsonb;
  v_rejected JSONB := '[]'::jsonb;
  v_milestones JSONB := '[]'::jsonb;
  v_reward_type TEXT;
  v_points INTEGER;
  v_timestamp TIMESTAMPTZ;
  v_ref TEXT;
  v_inserted BOOLEAN;
  v_total_xp INTEGER;
  v_new_level INTEGER;
  v_streaks JSONB;
  v_streak_result RECORD;
BEGIN
  -- Process each activity
  FOR v_activity IN SELECT * FROM jsonb_array_elements(p_activities)
  LOOP
    v_reward_type := v_activity->>'type';
    v_timestamp := (v_activity->>'timestamp')::TIMESTAMPTZ;
    v_ref := v_activity->>'ref';

    -- Get points from config (server-authoritative)
    SELECT points INTO v_points FROM reward_points_config WHERE reward_type = v_reward_type;
    IF v_points IS NULL THEN
      v_points := 0;
    END IF;

    -- Idempotent insert (conflict = already recorded)
    BEGIN
      INSERT INTO user_rewards (user_id, reward_type, points, reference_id, created_at)
      VALUES (
        p_user_id,
        v_reward_type,
        v_points,
        v_ref,
        v_timestamp
      );
      v_inserted := true;
    EXCEPTION WHEN unique_violation THEN
      v_inserted := false;
    END;

    IF v_inserted THEN
      v_confirmed := v_confirmed || to_jsonb(v_reward_type);

      -- Update streak for this activity type (map reward type to activity type)
      DECLARE
        v_activity_type TEXT;
        v_streak_milestone TEXT;
        v_milestone_xp INTEGER;
      BEGIN
        -- Map reward type to activity type
        v_activity_type := CASE v_reward_type
          WHEN 'login' THEN 'login'
          WHEN 'chapter_read' THEN 'reading'
          WHEN 'daily_note' THEN 'notes'
          WHEN 'daily_devotion' THEN 'devotion'
          WHEN 'day_complete' THEN 'plan'
          ELSE NULL
        END;

        -- Update streak if this is a daily activity
        IF v_activity_type IS NOT NULL THEN
          -- Get current streak from user_activity_streaks
          DECLARE
            v_current_streak INTEGER;
            v_last_date DATE;
            v_new_streak INTEGER;
            v_today DATE := COALESCE(p_client_date, CURRENT_DATE);
          BEGIN
            SELECT current_streak, last_activity_date
            INTO v_current_streak, v_last_date
            FROM user_activity_streaks
            WHERE user_id = p_user_id AND activity_type = v_activity_type;

            IF NOT FOUND THEN
              v_current_streak := 0;
              v_last_date := NULL;
            END IF;

            -- Skip if already recorded today
            IF v_last_date = v_today THEN
              CONTINUE;
            END IF;

            -- Calculate new streak
            IF v_last_date = v_today - 1 THEN
              v_new_streak := v_current_streak + 1;
            ELSE
              v_new_streak := 1;  -- Reset streak
            END IF;

            -- Update streak record
            INSERT INTO user_activity_streaks (user_id, activity_type, current_streak, last_activity_date, updated_at)
            VALUES (p_user_id, v_activity_type, v_new_streak, v_today, NOW())
            ON CONFLICT (user_id, activity_type) DO UPDATE SET
              current_streak = v_new_streak,
              last_activity_date = v_today,
              streak_7_completed = user_activity_streaks.streak_7_completed OR (v_new_streak >= 7),
              streak_30_completed = user_activity_streaks.streak_30_completed OR (v_new_streak >= 30),
              updated_at = NOW();

            -- Log streak event
            INSERT INTO user_streak_log (user_id, activity_type, streak_value, event_type, event_date)
            VALUES (p_user_id, v_activity_type, v_new_streak,
                    CASE WHEN v_new_streak = 1 AND v_current_streak > 0 THEN 'reset' ELSE 'increment' END,
                    v_today);

            -- Check for streak milestones
            IF v_new_streak > 0 AND v_new_streak % 365 = 0 THEN
              v_streak_milestone := '365-day';
              v_milestone_xp := get_reward_points(v_activity_type || '_streak_365');
            ELSIF v_new_streak > 0 AND v_new_streak % 30 = 0 THEN
              v_streak_milestone := '30-day';
              v_milestone_xp := get_reward_points(v_activity_type || '_streak_30');
            ELSIF v_new_streak > 0 AND v_new_streak % 7 = 0 THEN
              v_streak_milestone := '7-day';
              v_milestone_xp := get_reward_points(v_activity_type || '_streak_7');
            END IF;

            IF v_streak_milestone IS NOT NULL THEN
              -- Award milestone XP
              INSERT INTO user_rewards (user_id, reward_type, points, reference_id, created_at)
              VALUES (p_user_id, v_activity_type || '_streak_' ||
                      CASE v_streak_milestone
                        WHEN '7-day' THEN '7'
                        WHEN '30-day' THEN '30'
                        WHEN '365-day' THEN '365'
                      END,
                      COALESCE(v_milestone_xp, 0),
                      v_activity_type || '_streak_' || v_new_streak,
                      NOW());

              v_milestones := v_milestones || jsonb_build_object(
                'type', v_streak_milestone,
                'activity', v_activity_type,
                'xp', COALESCE(v_milestone_xp, 0)
              );

              -- Log milestone event
              INSERT INTO user_streak_log (user_id, activity_type, streak_value, event_type, event_date)
              VALUES (p_user_id, v_activity_type, v_new_streak,
                      'milestone_' || REPLACE(v_streak_milestone, '-day', ''),
                      v_today);
            END IF;
          END;
        END IF;
      END;
    ELSE
      v_rejected := v_rejected || to_jsonb(v_reward_type);
    END IF;
  END LOOP;

  -- Get final totals
  SELECT COALESCE(SUM(points), 0) INTO v_total_xp
  FROM user_rewards WHERE user_id = p_user_id;

  v_new_level := calculate_level_from_xp(v_total_xp);

  -- Get current streaks from user_activity_streaks as JSONB
  SELECT jsonb_object_agg(
    activity_type,
    jsonb_build_object('current', current_streak, 'last_date', last_activity_date)
  ) INTO v_streaks
  FROM user_activity_streaks
  WHERE user_id = p_user_id;

  -- Update profile summary
  INSERT INTO user_profile_summary (user_id, level, streaks, updated_at)
  VALUES (p_user_id, v_new_level, COALESCE(v_streaks, '{}'::jsonb), NOW())
  ON CONFLICT (user_id) DO UPDATE SET
    level = v_new_level,
    streaks = COALESCE(v_streaks, user_profile_summary.streaks),
    updated_at = NOW();

  RETURN jsonb_build_object(
    'confirmed', v_confirmed,
    'rejected', v_rejected,
    'milestones', v_milestones,
    'streaks', COALESCE(v_streaks, '{}'::jsonb),
    'new_level', v_new_level,
    'total_xp', v_total_xp
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION batch_record_activities TO authenticated;

-- =============================================================================
-- Phase 7: Helper function to get reward points by type
-- Handles activity type to reward type mapping for streaks
-- =============================================================================

CREATE OR REPLACE FUNCTION get_streak_reward_type(
  p_activity_type TEXT,
  p_milestone TEXT
)
RETURNS TEXT AS $$
BEGIN
  RETURN CASE p_activity_type
    WHEN 'login' THEN 'login_streak_' || p_milestone
    WHEN 'reading' THEN 'read_streak_' || p_milestone
    WHEN 'notes' THEN 'note_streak_' || p_milestone
    WHEN 'devotion' THEN 'devotion_streak_' || p_milestone
    WHEN 'plan' THEN 'streak_' || p_milestone
    ELSE NULL
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =============================================================================
-- Phase 8: Migrate existing data to user_profile_summary
-- Copy level data from user_global_stats and streaks from user_activity_streaks
-- =============================================================================

-- Populate user_profile_summary from existing data
INSERT INTO user_profile_summary (user_id, display_name, level, streaks, updated_at)
SELECT
  ugs.user_id,
  udn.display_name,
  ugs.level,
  COALESCE(
    (SELECT jsonb_object_agg(
      activity_type,
      jsonb_build_object('current', current_streak, 'last_date', last_activity_date)
    )
    FROM user_activity_streaks uas
    WHERE uas.user_id = ugs.user_id),
    '{}'::jsonb
  ),
  NOW()
FROM user_global_stats ugs
LEFT JOIN user_display_names udn ON udn.user_id = ugs.user_id
ON CONFLICT (user_id) DO UPDATE SET
  level = EXCLUDED.level,
  streaks = EXCLUDED.streaks,
  updated_at = NOW();

-- =============================================================================
-- Mark obsolete objects
-- These are kept for backward compatibility but should not be used for new code
-- =============================================================================

-- Table-level obsolete markers
COMMENT ON TABLE user_global_stats IS 'OBSOLETE: Use user_profile_summary instead. XP is computed client-side from SUM(user_rewards.points). Level is stored in user_profile_summary for other users to read.';

-- Column-level obsolete markers
COMMENT ON COLUMN user_global_stats.total_xp IS 'OBSOLETE: XP is now computed client-side from SUM(user_rewards.points). Never store total_xp - always compute it.';
COMMENT ON COLUMN user_global_stats.level IS 'OBSOLETE: Level is now stored in user_profile_summary.level. This column is updated by trigger for backward compatibility only.';

-- Function-level obsolete markers (wrapped in DO block since functions may not exist)
DO $$
BEGIN
  COMMENT ON FUNCTION record_daily_activity IS 'OBSOLETE: Use batch_record_activities() instead. The new function handles multiple activities in one call with idempotent inserts.';
EXCEPTION WHEN undefined_function THEN NULL;
END;
$$;
DO $$
BEGIN
  COMMENT ON FUNCTION update_user_stats_on_reward IS 'OBSOLETE: Replaced by update_user_level_on_reward() trigger. The new trigger updates user_profile_summary.level instead of user_global_stats.';
EXCEPTION WHEN undefined_function THEN NULL;
END;
$$;
DO $$
BEGIN
  COMMENT ON FUNCTION get_user_activity_status IS 'OBSOLETE: Client now computes activity status from local state (gamificationStore.dailyActivityStatus$).';
EXCEPTION WHEN undefined_function THEN NULL;
END;
$$;

-- =============================================================================
-- Done! The XP system overhaul migration is complete.
-- =============================================================================
