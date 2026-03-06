-- =============================================================================
-- Remove "reading" (chapter_read) from daily activities
--
-- Changes:
-- 1. All-complete bonus now requires 4 activities (login, notes, devotion, plan)
--    instead of 5 (previously included reading)
-- 2. Update reward_points_config description
-- 3. Recreate record_activity_with_streak() with updated check
-- =============================================================================

-- 1. Update config description
UPDATE reward_points_config
SET description = 'Complete all 4 daily activities'
WHERE reward_type = 'daily_all_complete';

-- 2. Recreate record_activity_with_streak with 4-activity all-complete check
DROP FUNCTION IF EXISTS record_activity_with_streak(UUID, TEXT, TEXT, DATE);

CREATE OR REPLACE FUNCTION record_activity_with_streak(
  p_user_id UUID,
  p_activity_type TEXT,  -- 'login', 'reading', 'notes', 'devotion', 'plan'
  p_reference_id TEXT DEFAULT NULL,
  p_client_date DATE DEFAULT NULL  -- Client's local date (YYYY-MM-DD)
)
RETURNS TABLE(
  daily_xp INTEGER,
  new_streak INTEGER,
  streak_milestone_type TEXT,  -- NULL, '7-day', '30-day', or '365-day'
  streak_milestone_xp INTEGER,
  total_xp INTEGER,
  level INTEGER,
  all_complete_bonus_xp INTEGER  -- bonus for completing all 4 daily activities
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
  v_all_complete_bonus INTEGER := 0;
  v_activities_completed INTEGER;
BEGIN
  -- Get server's current date (UTC)
  v_server_date := CURRENT_DATE;

  -- Validate client date is within ±1 day of server date
  IF p_client_date IS NOT NULL THEN
    IF p_client_date < v_server_date - 1 OR p_client_date > v_server_date + 1 THEN
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

  -- Check if already recorded today
  IF v_last_date = v_today THEN
    -- Already done today, return current stats
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
      COALESCE(v_new_level, 1),
      0::INTEGER;  -- No all-complete bonus
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

  -- Insert daily reward
  INSERT INTO user_rewards (user_id, reward_type, points, reference_id, created_at)
  VALUES (p_user_id, v_daily_reward_type, v_daily_xp, p_reference_id, NOW())
  ON CONFLICT DO NOTHING;

  -- Check for streak milestones (repeatable at every multiple)
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

  -- Update streak record
  INSERT INTO user_activity_streaks (user_id, activity_type, current_streak, last_activity_date, updated_at)
  VALUES (p_user_id, p_activity_type, v_new_streak, v_today, NOW())
  ON CONFLICT (user_id, activity_type) DO UPDATE SET
    current_streak = v_new_streak,
    last_activity_date = v_today,
    streak_7_completed = user_activity_streaks.streak_7_completed OR (v_new_streak >= 7),
    streak_30_completed = user_activity_streaks.streak_30_completed OR (v_new_streak >= 30),
    updated_at = NOW();

  -- Check for ALL COMPLETE bonus (all 4 daily activities done today)
  -- Reading/chapter_read is no longer a daily activity
  SELECT COUNT(*) INTO v_activities_completed
  FROM user_activity_streaks
  WHERE user_id = p_user_id
    AND activity_type IN ('login', 'notes', 'devotion', 'plan')
    AND last_activity_date = v_today;

  IF v_activities_completed = 4 THEN
    -- Check if bonus already awarded today
    IF NOT EXISTS (
      SELECT 1 FROM user_rewards
      WHERE user_id = p_user_id
        AND reward_type = 'daily_all_complete'
        AND DATE(created_at) = v_today
    ) THEN
      -- Award the all-complete bonus
      v_all_complete_bonus := get_reward_points('daily_all_complete');
      INSERT INTO user_rewards (user_id, reward_type, points, reference_id, created_at)
      VALUES (p_user_id, 'daily_all_complete', v_all_complete_bonus, v_today::TEXT, NOW());
    END IF;
  END IF;

  -- Get current XP
  SELECT COALESCE(ugs.total_xp, 0) INTO v_current_xp
  FROM user_global_stats ugs
  WHERE ugs.user_id = p_user_id;

  IF v_current_xp IS NULL THEN
    v_current_xp := 0;
  END IF;

  -- Calculate new totals (include all-complete bonus)
  v_new_xp := v_current_xp + v_daily_xp + COALESCE(v_streak_milestone_xp, 0) + v_all_complete_bonus;
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
    v_new_level,
    v_all_complete_bonus;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION record_activity_with_streak TO authenticated;
