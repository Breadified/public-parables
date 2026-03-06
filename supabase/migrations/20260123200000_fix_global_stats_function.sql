-- Migration: Fix update_user_global_stats function to use renamed table
-- The function was still referencing session_user_rewards after table was renamed to user_rewards

CREATE OR REPLACE FUNCTION update_user_global_stats()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
    v_total_xp INTEGER;
    v_total_days INTEGER;
    v_total_comments INTEGER;
    v_plans_done INTEGER;
    v_longest_streak INTEGER;
    v_level INTEGER;
BEGIN
    -- Get the user ID
    v_user_id := COALESCE(NEW.user_id, OLD.user_id);

    -- Aggregate all stats for this user across all sessions
    SELECT
        COALESCE(SUM(total_points), 0),
        COALESCE(SUM(days_completed), 0),
        COALESCE(SUM(comments_count), 0),
        COALESCE(MAX(longest_streak), 0)
    INTO v_total_xp, v_total_days, v_total_comments, v_longest_streak
    FROM public.session_user_stats
    WHERE user_id = v_user_id;

    -- Count completed plans (plans where user completed all days)
    -- FIXED: Changed from session_user_rewards to user_rewards
    SELECT COUNT(*)
    INTO v_plans_done
    FROM public.user_rewards ur
    WHERE ur.user_id = v_user_id
    AND ur.reward_type = 'plan_complete';

    -- Calculate global level from total XP
    v_level := calculate_level_from_xp(v_total_xp);

    -- Upsert global stats
    INSERT INTO public.user_global_stats (
        user_id,
        total_xp,
        level,
        total_days_completed,
        total_comments,
        plans_completed,
        longest_streak,
        updated_at
    )
    VALUES (
        v_user_id,
        v_total_xp,
        v_level,
        v_total_days,
        v_total_comments,
        v_plans_done,
        v_longest_streak,
        NOW()
    )
    ON CONFLICT (user_id)
    DO UPDATE SET
        total_xp = EXCLUDED.total_xp,
        level = EXCLUDED.level,
        total_days_completed = EXCLUDED.total_days_completed,
        total_comments = EXCLUDED.total_comments,
        plans_completed = EXCLUDED.plans_completed,
        longest_streak = EXCLUDED.longest_streak,
        updated_at = NOW();

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;
