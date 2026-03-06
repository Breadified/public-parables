-- =============================================================================
-- Server-Side XP Rewards
-- Moves XP point values to server-side lookup to prevent client manipulation
-- =============================================================================

-- 1. Create reward points configuration table
-- This is the single source of truth for XP values
CREATE TABLE IF NOT EXISTS reward_points_config (
  reward_type TEXT PRIMARY KEY,
  points INTEGER NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert all reward point values (x100 scale for meaningful progression)
INSERT INTO reward_points_config (reward_type, points, description) VALUES
  -- Daily activities
  ('login', 1000, 'Daily login bonus'),
  ('chapter_read', 5000, 'Read a chapter'),
  ('daily_note', 3000, 'Add a note'),
  ('day_complete', 1000, 'Complete a plan day'),
  ('day_comment', 500, 'Add a comment'),
  -- Login streaks
  ('login_streak_7', 2500, '7-day login streak'),
  ('login_streak_30', 10000, '30-day login streak'),
  -- Reading streaks
  ('read_streak_7', 2500, '7-day reading streak'),
  ('read_streak_30', 10000, '30-day reading streak'),
  -- Notes streaks
  ('note_streak_7', 2500, '7-day notes streak'),
  ('note_streak_30', 10000, '30-day notes streak'),
  -- Plan streaks
  ('streak_3', 1500, '3-day plan streak'),
  ('streak_7', 5000, '7-day plan streak'),
  ('streak_14', 10000, '14-day plan streak'),
  ('streak_30', 25000, '30-day plan streak'),
  ('streak_60', 50000, '60-day plan streak'),
  ('streak_90', 75000, '90-day plan streak'),
  ('plan_complete', 500, 'Plan completion base per day')
ON CONFLICT (reward_type) DO UPDATE SET
  points = EXCLUDED.points,
  description = EXCLUDED.description;

-- RLS for reward_points_config (read-only for all authenticated users)
ALTER TABLE reward_points_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read reward config" ON reward_points_config
  FOR SELECT USING (TRUE);

-- 2. Helper function to get reward points server-side
CREATE OR REPLACE FUNCTION get_reward_points(p_reward_type TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_points INTEGER;
BEGIN
  SELECT points INTO v_points
  FROM reward_points_config
  WHERE reward_type = p_reward_type;

  IF v_points IS NULL THEN
    RAISE EXCEPTION 'Unknown reward type: %', p_reward_type;
  END IF;

  RETURN v_points;
END;
$$;

-- 3. Function to award activity reward (server-side XP lookup)
-- This is the main entry point for awarding XP - client only sends reward_type
CREATE OR REPLACE FUNCTION award_activity_reward(
  p_user_id UUID,
  p_reward_type TEXT,
  p_reference_id TEXT DEFAULT NULL
)
RETURNS TABLE(
  points_awarded INTEGER,
  new_total_xp INTEGER,
  new_level INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_points INTEGER;
  v_current_xp INTEGER;
  v_new_xp INTEGER;
  v_new_level INTEGER;
  v_today DATE := CURRENT_DATE;
BEGIN
  -- Get points from server-side config (NOT from client)
  v_points := get_reward_points(p_reward_type);

  -- Check for duplicate daily rewards (login, chapter_read, daily_note)
  IF p_reward_type IN ('login', 'chapter_read', 'daily_note') THEN
    -- Check if already awarded today for this type
    IF EXISTS (
      SELECT 1 FROM user_rewards
      WHERE user_id = p_user_id
      AND reward_type = p_reward_type
      AND DATE(created_at) = v_today
      AND (p_reference_id IS NULL OR reference_id = p_reference_id)
    ) THEN
      -- Already awarded, return current stats without awarding again
      SELECT total_xp, level INTO v_current_xp, v_new_level
      FROM user_global_stats
      WHERE user_id = p_user_id;

      RETURN QUERY SELECT 0, COALESCE(v_current_xp, 0), COALESCE(v_new_level, 1);
      RETURN;
    END IF;
  END IF;

  -- Insert reward record with server-determined points
  INSERT INTO user_rewards (user_id, reward_type, points, reference_id, created_at)
  VALUES (p_user_id, p_reward_type, v_points, p_reference_id, NOW())
  ON CONFLICT DO NOTHING;

  -- Get current XP
  SELECT COALESCE(total_xp, 0) INTO v_current_xp
  FROM user_global_stats
  WHERE user_id = p_user_id;

  IF v_current_xp IS NULL THEN
    v_current_xp := 0;
  END IF;

  -- Calculate new totals
  v_new_xp := v_current_xp + v_points;
  v_new_level := calculate_level_from_xp(v_new_xp);

  -- Update global stats
  INSERT INTO user_global_stats (user_id, total_xp, level, updated_at)
  VALUES (p_user_id, v_new_xp, v_new_level, NOW())
  ON CONFLICT (user_id) DO UPDATE SET
    total_xp = v_new_xp,
    level = v_new_level,
    updated_at = NOW();

  RETURN QUERY SELECT v_points, v_new_xp, v_new_level;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION award_activity_reward TO authenticated;
GRANT EXECUTE ON FUNCTION get_reward_points TO authenticated;

-- 4. Update the activity streak function to also award XP
-- This handles streak milestones server-side
CREATE OR REPLACE FUNCTION record_activity_with_streak(
  p_user_id UUID,
  p_activity_type TEXT,  -- 'login', 'reading', 'notes'
  p_reference_id TEXT DEFAULT NULL
)
RETURNS TABLE(
  daily_xp INTEGER,
  new_streak INTEGER,
  streak_milestone_type TEXT,  -- NULL, '7-day', or '30-day'
  streak_milestone_xp INTEGER,
  total_xp INTEGER,
  level INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_daily_reward_type TEXT;
  v_streak_7_reward_type TEXT;
  v_streak_30_reward_type TEXT;
  v_daily_xp INTEGER := 0;
  v_current_streak INTEGER;
  v_last_date DATE;
  v_new_streak INTEGER;
  v_streak_milestone_type TEXT := NULL;
  v_streak_milestone_xp INTEGER := 0;
  v_today DATE := CURRENT_DATE;
  v_current_xp INTEGER;
  v_new_xp INTEGER;
  v_new_level INTEGER;
BEGIN
  -- Map activity type to reward types
  CASE p_activity_type
    WHEN 'login' THEN
      v_daily_reward_type := 'login';
      v_streak_7_reward_type := 'login_streak_7';
      v_streak_30_reward_type := 'login_streak_30';
    WHEN 'reading' THEN
      v_daily_reward_type := 'chapter_read';
      v_streak_7_reward_type := 'read_streak_7';
      v_streak_30_reward_type := 'read_streak_30';
    WHEN 'notes' THEN
      v_daily_reward_type := 'daily_note';
      v_streak_7_reward_type := 'note_streak_7';
      v_streak_30_reward_type := 'note_streak_30';
    ELSE
      RAISE EXCEPTION 'Unknown activity type: %', p_activity_type;
  END CASE;

  -- Get current streak state
  SELECT current_streak, last_activity_date
  INTO v_current_streak, v_last_date
  FROM user_activity_streaks
  WHERE user_id = p_user_id AND activity_type = p_activity_type;

  IF NOT FOUND THEN
    v_current_streak := 0;
    v_last_date := NULL;
  END IF;

  -- Check if already recorded today
  IF v_last_date = v_today THEN
    -- Already done today, return current stats
    SELECT COALESCE(total_xp, 0), COALESCE(level, 1)
    INTO v_current_xp, v_new_level
    FROM user_global_stats
    WHERE user_id = p_user_id;

    RETURN QUERY SELECT
      0::INTEGER,
      v_current_streak,
      NULL::TEXT,
      0::INTEGER,
      COALESCE(v_current_xp, 0),
      COALESCE(v_new_level, 1);
    RETURN;
  END IF;

  -- Calculate new streak
  IF v_last_date = v_today - 1 THEN
    v_new_streak := v_current_streak + 1;
  ELSE
    v_new_streak := 1;  -- Reset streak
  END IF;

  -- Get daily XP from server config
  v_daily_xp := get_reward_points(v_daily_reward_type);

  -- Insert daily reward (with duplicate prevention)
  INSERT INTO user_rewards (user_id, reward_type, points, reference_id, created_at)
  VALUES (p_user_id, v_daily_reward_type, v_daily_xp, p_reference_id, NOW())
  ON CONFLICT DO NOTHING;

  -- Check for streak milestones (repeatable at every multiple)
  -- 30-day takes priority over 7-day
  IF v_new_streak > 0 AND v_new_streak % 30 = 0 THEN
    v_streak_milestone_type := '30-day';
    v_streak_milestone_xp := get_reward_points(v_streak_30_reward_type);

    -- Insert streak milestone reward
    INSERT INTO user_rewards (user_id, reward_type, points, reference_id, created_at)
    VALUES (p_user_id, v_streak_30_reward_type, v_streak_milestone_xp,
            p_activity_type || '_streak_' || v_new_streak, NOW());

  ELSIF v_new_streak > 0 AND v_new_streak % 7 = 0 THEN
    v_streak_milestone_type := '7-day';
    v_streak_milestone_xp := get_reward_points(v_streak_7_reward_type);

    -- Insert streak milestone reward
    INSERT INTO user_rewards (user_id, reward_type, points, reference_id, created_at)
    VALUES (p_user_id, v_streak_7_reward_type, v_streak_milestone_xp,
            p_activity_type || '_streak_' || v_new_streak, NOW());
  END IF;

  -- Update streak record
  INSERT INTO user_activity_streaks (user_id, activity_type, current_streak, last_activity_date, updated_at)
  VALUES (p_user_id, p_activity_type, v_new_streak, v_today, NOW())
  ON CONFLICT (user_id, activity_type) DO UPDATE SET
    current_streak = v_new_streak,
    last_activity_date = v_today,
    streak_7_completed = user_activity_streaks.streak_7_completed OR (v_new_streak >= 7),
    streak_30_completed = user_activity_streaks.streak_30_completed OR (v_new_streak >= 30),
    updated_at = NOW();

  -- Get current XP
  SELECT COALESCE(total_xp, 0) INTO v_current_xp
  FROM user_global_stats
  WHERE user_id = p_user_id;

  IF v_current_xp IS NULL THEN
    v_current_xp := 0;
  END IF;

  -- Calculate new totals
  v_new_xp := v_current_xp + v_daily_xp + COALESCE(v_streak_milestone_xp, 0);
  v_new_level := calculate_level_from_xp(v_new_xp);

  -- Update global stats
  INSERT INTO user_global_stats (user_id, total_xp, level, updated_at)
  VALUES (p_user_id, v_new_xp, v_new_level, NOW())
  ON CONFLICT (user_id) DO UPDATE SET
    total_xp = v_new_xp,
    level = v_new_level,
    updated_at = NOW();

  RETURN QUERY SELECT
    v_daily_xp,
    v_new_streak,
    v_streak_milestone_type,
    COALESCE(v_streak_milestone_xp, 0),
    v_new_xp,
    v_new_level;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION record_activity_with_streak TO authenticated;

-- 5. Remove direct INSERT permission on user_rewards for points column
-- Users can still insert rewards but only through the functions above
-- This prevents client from specifying arbitrary points

-- Create a trigger that enforces server-side points lookup on direct inserts
CREATE OR REPLACE FUNCTION enforce_server_side_points()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_server_points INTEGER;
BEGIN
  -- Look up correct points from config
  SELECT points INTO v_server_points
  FROM reward_points_config
  WHERE reward_type = NEW.reward_type;

  IF v_server_points IS NULL THEN
    -- Unknown reward type, reject
    RAISE EXCEPTION 'Unknown reward type: %', NEW.reward_type;
  END IF;

  -- Override client-provided points with server value
  NEW.points := v_server_points;

  RETURN NEW;
END;
$$;

-- Apply trigger to user_rewards table
DROP TRIGGER IF EXISTS trigger_enforce_server_side_points ON user_rewards;
CREATE TRIGGER trigger_enforce_server_side_points
  BEFORE INSERT OR UPDATE ON user_rewards
  FOR EACH ROW
  EXECUTE FUNCTION enforce_server_side_points();

-- Note: session_user_rewards was renamed to user_rewards in migration 20260122000000
-- The trigger on user_rewards above already covers all rewards (plan and non-plan)
