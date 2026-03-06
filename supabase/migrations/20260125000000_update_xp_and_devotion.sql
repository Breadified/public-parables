-- ============================================================================
-- Update XP values and add devotion activity tracking
-- ============================================================================

-- First, ensure unique constraint exists on user_rewards for ON CONFLICT
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_rewards_user_id_reference_id_key'
  ) THEN
    ALTER TABLE user_rewards ADD CONSTRAINT user_rewards_user_id_reference_id_key
      UNIQUE (user_id, reference_id);
  END IF;
END $$;

-- Update existing daily reward points
UPDATE reward_points_config SET points = 1000 WHERE reward_type = 'login';
UPDATE reward_points_config SET points = 10000 WHERE reward_type = 'day_complete';
UPDATE reward_points_config SET points = 2000 WHERE reward_type = 'chapter_read';
UPDATE reward_points_config SET points = 3000 WHERE reward_type = 'daily_note';

-- Update weekly streaks (x5 multiplier)
UPDATE reward_points_config SET points = 5000 WHERE reward_type = 'login_streak_7';
UPDATE reward_points_config SET points = 50000 WHERE reward_type = 'streak_7';
UPDATE reward_points_config SET points = 10000 WHERE reward_type = 'read_streak_7';
UPDATE reward_points_config SET points = 15000 WHERE reward_type = 'note_streak_7';

-- Update monthly streaks (x20 multiplier)
UPDATE reward_points_config SET points = 20000 WHERE reward_type = 'login_streak_30';
UPDATE reward_points_config SET points = 200000 WHERE reward_type = 'streak_30';
UPDATE reward_points_config SET points = 40000 WHERE reward_type = 'read_streak_30';
UPDATE reward_points_config SET points = 60000 WHERE reward_type = 'note_streak_30';

-- Update other plan streaks
UPDATE reward_points_config SET points = 100000 WHERE reward_type = 'streak_14';
UPDATE reward_points_config SET points = 400000 WHERE reward_type = 'streak_60';
UPDATE reward_points_config SET points = 600000 WHERE reward_type = 'streak_90';

-- Add devotion reward types
INSERT INTO reward_points_config (reward_type, points, description) VALUES
  ('daily_devotion', 5000, 'Complete daily devotion'),
  ('devotion_streak_7', 25000, '7-day devotion streak'),
  ('devotion_streak_30', 100000, '30-day devotion streak'),
  ('devotion_streak_365', 2500000, '365-day devotion streak')
ON CONFLICT (reward_type) DO UPDATE SET points = EXCLUDED.points;

-- Add yearly streaks (x500 multiplier)
INSERT INTO reward_points_config (reward_type, points, description) VALUES
  ('login_streak_365', 500000, '365-day login streak'),
  ('read_streak_365', 1000000, '365-day reading streak'),
  ('note_streak_365', 1500000, '365-day notes streak'),
  ('streak_365', 5000000, '365-day plan streak')
ON CONFLICT (reward_type) DO UPDATE SET points = EXCLUDED.points;

-- ============================================================================
-- Update the record_activity_with_streak function to handle devotion and 365-day milestones
-- ============================================================================

-- Drop existing function first (required when changing return type)
DROP FUNCTION IF EXISTS record_activity_with_streak(uuid, text, text);

CREATE OR REPLACE FUNCTION record_activity_with_streak(
  p_user_id uuid,
  p_activity_type text,
  p_reference_id text DEFAULT NULL
)
RETURNS TABLE(
  daily_xp integer,
  new_streak integer,
  streak_milestone_type text,
  streak_milestone_xp integer,
  total_xp bigint,
  level integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := CURRENT_DATE;
  v_yesterday date := CURRENT_DATE - INTERVAL '1 day';
  v_current_streak integer;
  v_last_activity_date date;
  v_new_streak integer;
  v_daily_xp integer := 0;
  v_milestone_type text := NULL;
  v_milestone_xp integer := 0;
  v_daily_reward_type text;
  v_streak_7_reward_type text;
  v_streak_30_reward_type text;
  v_streak_365_reward_type text;
  v_total_xp bigint;
  v_level integer;
  v_reward_reference_id text;
BEGIN
  -- Map activity type to reward types
  CASE p_activity_type
    WHEN 'login' THEN
      v_daily_reward_type := 'login';
      v_streak_7_reward_type := 'login_streak_7';
      v_streak_30_reward_type := 'login_streak_30';
      v_streak_365_reward_type := 'login_streak_365';
    WHEN 'reading' THEN
      v_daily_reward_type := 'chapter_read';
      v_streak_7_reward_type := 'read_streak_7';
      v_streak_30_reward_type := 'read_streak_30';
      v_streak_365_reward_type := 'read_streak_365';
    WHEN 'notes' THEN
      v_daily_reward_type := 'daily_note';
      v_streak_7_reward_type := 'note_streak_7';
      v_streak_30_reward_type := 'note_streak_30';
      v_streak_365_reward_type := 'note_streak_365';
    WHEN 'plan' THEN
      v_daily_reward_type := 'day_complete';
      v_streak_7_reward_type := 'streak_7';
      v_streak_30_reward_type := 'streak_30';
      v_streak_365_reward_type := 'streak_365';
    WHEN 'devotion' THEN
      v_daily_reward_type := 'daily_devotion';
      v_streak_7_reward_type := 'devotion_streak_7';
      v_streak_30_reward_type := 'devotion_streak_30';
      v_streak_365_reward_type := 'devotion_streak_365';
    ELSE
      RAISE EXCEPTION 'Unknown activity type: %', p_activity_type;
  END CASE;

  -- Get current streak state
  SELECT current_streak, last_activity_date
  INTO v_current_streak, v_last_activity_date
  FROM user_activity_streaks
  WHERE user_id = p_user_id AND activity_type = p_activity_type;

  -- Initialize if no record exists
  IF NOT FOUND THEN
    v_current_streak := 0;
    v_last_activity_date := NULL;
  END IF;

  -- Check if already recorded today
  IF v_last_activity_date = v_today THEN
    -- Return current state, no XP awarded
    SELECT ugs.total_xp, ugs.level
    INTO v_total_xp, v_level
    FROM user_global_stats ugs
    WHERE ugs.user_id = p_user_id;

    IF NOT FOUND THEN
      v_total_xp := 0;
      v_level := 1;
    END IF;

    RETURN QUERY SELECT 0::integer, v_current_streak, NULL::text, 0::integer, v_total_xp, v_level;
    RETURN;
  END IF;

  -- Calculate new streak
  IF v_last_activity_date = v_yesterday THEN
    v_new_streak := v_current_streak + 1;
  ELSE
    v_new_streak := 1;
  END IF;

  -- Get daily XP from config
  SELECT rpc.points INTO v_daily_xp
  FROM reward_points_config rpc
  WHERE rpc.reward_type = v_daily_reward_type;

  IF v_daily_xp IS NULL THEN
    v_daily_xp := 0;
  END IF;

  -- Build reference ID for duplicate prevention
  v_reward_reference_id := v_today::text || '_' || COALESCE(p_reference_id, p_activity_type);

  -- Insert daily reward (with duplicate prevention)
  INSERT INTO user_rewards (
    user_id,
    plan_session_id,
    reward_type,
    reference_id,
    points,
    created_at
  ) VALUES (
    p_user_id,
    '00000000-0000-0000-0000-000000000000'::uuid,
    v_daily_reward_type,
    v_reward_reference_id,
    v_daily_xp,
    NOW()
  )
  ON CONFLICT (user_id, reference_id) DO NOTHING;

  -- Check streak milestones (365-day takes priority, then 30-day, then 7-day)
  IF v_new_streak > 0 AND v_new_streak % 365 = 0 THEN
    -- 365-day milestone
    v_milestone_type := '365-day';
    SELECT rpc.points INTO v_milestone_xp
    FROM reward_points_config rpc
    WHERE rpc.reward_type = v_streak_365_reward_type;

    IF v_milestone_xp IS NOT NULL AND v_milestone_xp > 0 THEN
      INSERT INTO user_rewards (
        user_id,
        plan_session_id,
        reward_type,
        reference_id,
        points,
        created_at
      ) VALUES (
        p_user_id,
        '00000000-0000-0000-0000-000000000000'::uuid,
        v_streak_365_reward_type,
        v_today::text || '_' || v_streak_365_reward_type || '_' || v_new_streak::text,
        v_milestone_xp,
        NOW()
      )
      ON CONFLICT (user_id, reference_id) DO NOTHING;
    END IF;
  ELSIF v_new_streak > 0 AND v_new_streak % 30 = 0 THEN
    -- 30-day milestone
    v_milestone_type := '30-day';
    SELECT rpc.points INTO v_milestone_xp
    FROM reward_points_config rpc
    WHERE rpc.reward_type = v_streak_30_reward_type;

    IF v_milestone_xp IS NOT NULL AND v_milestone_xp > 0 THEN
      INSERT INTO user_rewards (
        user_id,
        plan_session_id,
        reward_type,
        reference_id,
        points,
        created_at
      ) VALUES (
        p_user_id,
        '00000000-0000-0000-0000-000000000000'::uuid,
        v_streak_30_reward_type,
        v_today::text || '_' || v_streak_30_reward_type || '_' || v_new_streak::text,
        v_milestone_xp,
        NOW()
      )
      ON CONFLICT (user_id, reference_id) DO NOTHING;
    END IF;
  ELSIF v_new_streak > 0 AND v_new_streak % 7 = 0 THEN
    -- 7-day milestone
    v_milestone_type := '7-day';
    SELECT rpc.points INTO v_milestone_xp
    FROM reward_points_config rpc
    WHERE rpc.reward_type = v_streak_7_reward_type;

    IF v_milestone_xp IS NOT NULL AND v_milestone_xp > 0 THEN
      INSERT INTO user_rewards (
        user_id,
        plan_session_id,
        reward_type,
        reference_id,
        points,
        created_at
      ) VALUES (
        p_user_id,
        '00000000-0000-0000-0000-000000000000'::uuid,
        v_streak_7_reward_type,
        v_today::text || '_' || v_streak_7_reward_type || '_' || v_new_streak::text,
        v_milestone_xp,
        NOW()
      )
      ON CONFLICT (user_id, reference_id) DO NOTHING;
    END IF;
  END IF;

  -- Update streak record
  INSERT INTO user_activity_streaks (
    user_id,
    activity_type,
    current_streak,
    last_activity_date,
    streak_7_completed,
    streak_30_completed,
    updated_at
  ) VALUES (
    p_user_id,
    p_activity_type,
    v_new_streak,
    v_today,
    v_new_streak >= 7,
    v_new_streak >= 30,
    NOW()
  )
  ON CONFLICT (user_id, activity_type) DO UPDATE SET
    current_streak = v_new_streak,
    last_activity_date = v_today,
    streak_7_completed = user_activity_streaks.streak_7_completed OR (v_new_streak >= 7),
    streak_30_completed = user_activity_streaks.streak_30_completed OR (v_new_streak >= 30),
    updated_at = NOW();

  -- Get updated total XP and level
  SELECT ugs.total_xp, ugs.level
  INTO v_total_xp, v_level
  FROM user_global_stats ugs
  WHERE ugs.user_id = p_user_id;

  IF NOT FOUND THEN
    v_total_xp := v_daily_xp + COALESCE(v_milestone_xp, 0);
    v_level := 1;
  END IF;

  RETURN QUERY SELECT v_daily_xp, v_new_streak, v_milestone_type, COALESCE(v_milestone_xp, 0)::integer, v_total_xp, v_level;
END;
$$;
