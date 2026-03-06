-- =============================================================================
-- Fix Timezone Issue for Daily Resets
-- The server uses UTC time, but daily resets should happen at midnight LOCAL time
-- Solution: Client passes its local date, server validates it's within ±1 day of UTC
-- =============================================================================

-- Drop existing function first (required when changing parameters)
DROP FUNCTION IF EXISTS record_activity_with_streak(UUID, TEXT, TEXT);

-- Recreate with optional client_date parameter
CREATE OR REPLACE FUNCTION record_activity_with_streak(
  p_user_id UUID,
  p_activity_type TEXT,  -- 'login', 'reading', 'notes', 'devotion'
  p_reference_id TEXT DEFAULT NULL,
  p_client_date DATE DEFAULT NULL  -- Client's local date (YYYY-MM-DD)
)
RETURNS TABLE(
  daily_xp INTEGER,
  new_streak INTEGER,
  streak_milestone_type TEXT,  -- NULL, '7-day', '30-day', or '365-day'
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
  v_streak_365_reward_type TEXT;
  v_daily_xp INTEGER := 0;
  v_current_streak INTEGER;
  v_last_date DATE;
  v_new_streak INTEGER;
  v_streak_milestone_type TEXT := NULL;
  v_streak_milestone_xp INTEGER := 0;
  v_today DATE;
  v_server_date DATE;
  v_current_xp INTEGER;
  v_new_xp INTEGER;
  v_new_level INTEGER;
BEGIN
  -- Get server's current date (UTC)
  v_server_date := CURRENT_DATE;

  -- Validate client date is within ±1 day of server date
  -- This allows for all valid timezones (UTC-12 to UTC+14) while preventing abuse
  IF p_client_date IS NOT NULL THEN
    IF p_client_date < v_server_date - 1 OR p_client_date > v_server_date + 1 THEN
      -- Client date is too far from server date - reject or use server date
      -- Using server date as fallback to not break the request
      v_today := v_server_date;
    ELSE
      v_today := p_client_date;
    END IF;
  ELSE
    v_today := v_server_date;
  END IF;

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
    WHEN 'devotion' THEN
      v_daily_reward_type := 'daily_devotion';
      v_streak_7_reward_type := 'devotion_streak_7';
      v_streak_30_reward_type := 'devotion_streak_30';
      v_streak_365_reward_type := 'devotion_streak_365';
    WHEN 'plan' THEN
      v_daily_reward_type := 'day_complete';
      v_streak_7_reward_type := 'streak_7';
      v_streak_30_reward_type := 'streak_30';
      v_streak_365_reward_type := 'streak_365';
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

  -- Check if already recorded today (using client's date)
  IF v_last_date = v_today THEN
    -- Already done today, return current stats
    -- Use table alias to avoid ambiguity with RETURNS TABLE columns
    SELECT COALESCE(ugs.total_xp, 0), COALESCE(ugs.level, 1)
    INTO v_current_xp, v_new_level
    FROM user_global_stats ugs
    WHERE ugs.user_id = p_user_id;

    RETURN QUERY SELECT
      0::INTEGER,
      v_current_streak,
      NULL::TEXT,
      0::INTEGER,
      COALESCE(v_current_xp, 0),
      COALESCE(v_new_level, 1);
    RETURN;
  END IF;

  -- Calculate new streak (using client's date for comparison)
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
  -- Priority: 365-day > 30-day > 7-day
  IF v_new_streak > 0 AND v_new_streak % 365 = 0 THEN
    v_streak_milestone_type := '365-day';
    v_streak_milestone_xp := get_reward_points(v_streak_365_reward_type);

    INSERT INTO user_rewards (user_id, reward_type, points, reference_id, created_at)
    VALUES (p_user_id, v_streak_365_reward_type, v_streak_milestone_xp,
            p_activity_type || '_streak_' || v_new_streak, NOW());

  ELSIF v_new_streak > 0 AND v_new_streak % 30 = 0 THEN
    v_streak_milestone_type := '30-day';
    v_streak_milestone_xp := get_reward_points(v_streak_30_reward_type);

    INSERT INTO user_rewards (user_id, reward_type, points, reference_id, created_at)
    VALUES (p_user_id, v_streak_30_reward_type, v_streak_milestone_xp,
            p_activity_type || '_streak_' || v_new_streak, NOW());

  ELSIF v_new_streak > 0 AND v_new_streak % 7 = 0 THEN
    v_streak_milestone_type := '7-day';
    v_streak_milestone_xp := get_reward_points(v_streak_7_reward_type);

    INSERT INTO user_rewards (user_id, reward_type, points, reference_id, created_at)
    VALUES (p_user_id, v_streak_7_reward_type, v_streak_milestone_xp,
            p_activity_type || '_streak_' || v_new_streak, NOW());
  END IF;

  -- Update streak record (using client's date)
  INSERT INTO user_activity_streaks (user_id, activity_type, current_streak, last_activity_date, updated_at)
  VALUES (p_user_id, p_activity_type, v_new_streak, v_today, NOW())
  ON CONFLICT (user_id, activity_type) DO UPDATE SET
    current_streak = v_new_streak,
    last_activity_date = v_today,
    streak_7_completed = user_activity_streaks.streak_7_completed OR (v_new_streak >= 7),
    streak_30_completed = user_activity_streaks.streak_30_completed OR (v_new_streak >= 30),
    updated_at = NOW();

  -- Get current XP (use table alias to avoid ambiguity with RETURNS TABLE columns)
  SELECT COALESCE(ugs.total_xp, 0) INTO v_current_xp
  FROM user_global_stats ugs
  WHERE ugs.user_id = p_user_id;

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
