-- Migration: Add Session Rewards & Gamification System
-- Tracks user achievements, points, and progress in plan sessions
--
-- PROGRESSION TARGETS (super user):
-- - Level 30 (Diamond): ~1 year
-- - Level 50: ~3 years
--
-- XP CURVE: base=180, multiplier=1.05
-- - Level 5 (Silver): ~780 XP
-- - Level 10 (Gold): ~2,000 XP
-- - Level 20 (Platinum): ~5,600 XP
-- - Level 30 (Diamond): ~11,200 XP
-- - Level 50: ~35,700 XP

-- ============================================================================
-- 1. CREATE TABLES
-- ============================================================================

-- User Login History - Tracks daily logins for login bonuses/streaks
CREATE TABLE IF NOT EXISTS public.user_login_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    login_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, login_date)
);

-- Session User Rewards - Tracks individual reward-earning actions
CREATE TABLE IF NOT EXISTS public.session_user_rewards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_session_id UUID NOT NULL REFERENCES public.plan_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    reward_type TEXT NOT NULL,          -- 'day_complete', 'day_comment', 'streak_3', 'streak_7', etc.
    day_number INTEGER,                 -- Which day this relates to (null for session-wide rewards)
    reference_id TEXT,                  -- e.g., comment_id for comment rewards
    points INTEGER DEFAULT 0,           -- XP value for this reward
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(plan_session_id, user_id, reward_type, day_number)
);

-- Session User Stats - Quick lookup for user totals per session
CREATE TABLE IF NOT EXISTS public.session_user_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_session_id UUID NOT NULL REFERENCES public.plan_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    total_points INTEGER DEFAULT 0,
    days_completed INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    current_streak INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(plan_session_id, user_id)
);

-- User Global Stats - Aggregated XP/level across ALL sessions for profile display
CREATE TABLE IF NOT EXISTS public.user_global_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE UNIQUE,
    total_xp INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    total_days_completed INTEGER DEFAULT 0,
    total_comments INTEGER DEFAULT 0,
    plans_completed INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 2. CREATE INDEXES
-- ============================================================================

-- Rewards indexes
CREATE INDEX idx_session_user_rewards_session ON public.session_user_rewards(plan_session_id);
CREATE INDEX idx_session_user_rewards_user ON public.session_user_rewards(user_id);
CREATE INDEX idx_session_user_rewards_session_user ON public.session_user_rewards(plan_session_id, user_id);
CREATE INDEX idx_session_user_rewards_type ON public.session_user_rewards(reward_type);
CREATE INDEX idx_session_user_rewards_day ON public.session_user_rewards(plan_session_id, user_id, day_number);

-- Stats indexes
CREATE INDEX idx_session_user_stats_session ON public.session_user_stats(plan_session_id);
CREATE INDEX idx_session_user_stats_user ON public.session_user_stats(user_id);
CREATE INDEX idx_session_user_stats_session_user ON public.session_user_stats(plan_session_id, user_id);

-- Global stats index
CREATE INDEX idx_user_global_stats_user ON public.user_global_stats(user_id);

-- Login history indexes
CREATE INDEX idx_user_login_history_user ON public.user_login_history(user_id);
CREATE INDEX idx_user_login_history_user_date ON public.user_login_history(user_id, login_date DESC);

-- ============================================================================
-- 3. ENABLE RLS
-- ============================================================================

ALTER TABLE public.session_user_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_user_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_global_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_login_history ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 4. RLS POLICIES - session_user_rewards
-- ============================================================================

-- Users can view their own rewards (any session they have rewards in)
CREATE POLICY "Users can view own rewards" ON public.session_user_rewards
    FOR SELECT USING (auth.uid() = user_id);

-- Session owners can view all rewards in their personal sessions
CREATE POLICY "Owners can view personal session rewards" ON public.session_user_rewards
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.plan_sessions ps
            WHERE ps.id = session_user_rewards.plan_session_id
            AND ps.user_id = auth.uid()
        )
    );

-- Participants can view all rewards in shared sessions they're part of
CREATE POLICY "Participants can view shared session rewards" ON public.session_user_rewards
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.plan_sessions ps
            JOIN public.session_participants sp ON sp.plan_session_id = ps.id
            WHERE ps.id = session_user_rewards.plan_session_id
            AND ps.is_shared = TRUE
            AND sp.user_id = auth.uid()
            AND sp.status = 'active'
        )
    );

-- Users can insert their own rewards for sessions they own or participate in
CREATE POLICY "Users can insert own rewards" ON public.session_user_rewards
    FOR INSERT WITH CHECK (
        auth.uid() = user_id
        AND (
            -- Own personal session (as owner)
            EXISTS (
                SELECT 1 FROM public.plan_sessions
                WHERE id = plan_session_id
                AND user_id = auth.uid()
            )
            OR
            -- Active participant in shared session
            EXISTS (
                SELECT 1 FROM public.plan_sessions ps
                JOIN public.session_participants sp ON sp.plan_session_id = ps.id
                WHERE ps.id = plan_session_id
                AND ps.is_shared = TRUE
                AND sp.user_id = auth.uid()
                AND sp.status = 'active'
            )
        )
    );

-- Users can delete their own rewards (for undo functionality)
-- Only allow deleting own rewards in sessions they still have access to
CREATE POLICY "Users can delete own rewards" ON public.session_user_rewards
    FOR DELETE USING (
        auth.uid() = user_id
        AND (
            -- Own personal session
            EXISTS (
                SELECT 1 FROM public.plan_sessions
                WHERE id = plan_session_id
                AND user_id = auth.uid()
            )
            OR
            -- Active participant in shared session
            EXISTS (
                SELECT 1 FROM public.plan_sessions ps
                JOIN public.session_participants sp ON sp.plan_session_id = ps.id
                WHERE ps.id = plan_session_id
                AND ps.is_shared = TRUE
                AND sp.user_id = auth.uid()
                AND sp.status = 'active'
            )
        )
    );

-- ============================================================================
-- 5. RLS POLICIES - session_user_stats
-- ============================================================================

-- Users can view their own stats (any session they have stats in)
CREATE POLICY "Users can view own stats" ON public.session_user_stats
    FOR SELECT USING (auth.uid() = user_id);

-- Session owners can view all stats in their personal sessions
CREATE POLICY "Owners can view personal session stats" ON public.session_user_stats
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.plan_sessions ps
            WHERE ps.id = session_user_stats.plan_session_id
            AND ps.user_id = auth.uid()
        )
    );

-- Participants can view all stats in shared sessions they're part of
CREATE POLICY "Participants can view shared session stats" ON public.session_user_stats
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.plan_sessions ps
            JOIN public.session_participants sp ON sp.plan_session_id = ps.id
            WHERE ps.id = session_user_stats.plan_session_id
            AND ps.is_shared = TRUE
            AND sp.user_id = auth.uid()
            AND sp.status = 'active'
        )
    );

-- Note: INSERT/UPDATE on session_user_stats is handled by SECURITY DEFINER trigger
-- These policies exist as fallback but primary updates come from the trigger
CREATE POLICY "Users can upsert own stats" ON public.session_user_stats
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own stats" ON public.session_user_stats
    FOR UPDATE USING (auth.uid() = user_id);

-- ============================================================================
-- 6. RLS POLICIES - user_global_stats
-- ============================================================================

-- Global stats are public (for showing level badges on other users' avatars in shared sessions)
-- This allows participants to see each other's levels
CREATE POLICY "Global stats are publicly readable" ON public.user_global_stats
    FOR SELECT USING (TRUE);

-- INSERT/UPDATE/DELETE on user_global_stats is managed exclusively by SECURITY DEFINER triggers
-- No direct user modification allowed - the trigger functions bypass RLS

-- ============================================================================
-- 7. RLS POLICIES - user_login_history
-- ============================================================================

-- Users can view their own login history
CREATE POLICY "Users can view own login history" ON public.user_login_history
    FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own login records
CREATE POLICY "Users can insert own login" ON public.user_login_history
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- No update/delete needed - login history is append-only

-- ============================================================================
-- 8. HELPER FUNCTION - Level Calculation (Server-side XP to Level)
-- ============================================================================

-- Calculate level from total XP using gentle exponential curve
-- Formula: XP per level = 18000 * (1.05 ^ (level - 2))
-- Level 1: 0 XP, Level 2: 18,000 XP, Level 5: ~78,000 XP (Silver)
-- Level 10: ~200,000 XP (Gold), Level 20: ~560,000 XP (Platinum)
-- Level 30: ~1,120,000 XP (Diamond), Level 50: ~3,570,000 XP
CREATE OR REPLACE FUNCTION calculate_level_from_xp(total_xp INTEGER)
RETURNS INTEGER AS $$
DECLARE
    current_level INTEGER := 1;
    xp_for_next INTEGER := 18000; -- Base XP for level 2
    accumulated INTEGER := 0;
BEGIN
    IF total_xp <= 0 THEN
        RETURN 1;
    END IF;

    -- Iterate through levels calculating cumulative XP thresholds
    WHILE accumulated <= total_xp LOOP
        current_level := current_level + 1;
        accumulated := accumulated + xp_for_next;
        -- Next level requires 1.05x more XP (gentle curve)
        xp_for_next := FLOOR(18000 * POWER(1.05, current_level - 1));
    END LOOP;

    RETURN current_level - 1;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- 9. HELPER FUNCTION - Plan XP Multiplier (Diminishing Returns)
-- ============================================================================

-- Calculate XP multiplier for a plan based on how many concurrent active plans user has
-- Oldest active plan gets 100%, 5th+ plan gets 10%
-- This dynamically re-ranks as plans complete
CREATE OR REPLACE FUNCTION get_plan_xp_multiplier(
    p_plan_session_id UUID,
    p_user_id UUID
) RETURNS NUMERIC AS $$
DECLARE
    plan_rank INTEGER;
    multipliers NUMERIC[] := ARRAY[1.0, 0.6, 0.35, 0.2, 0.1];
BEGIN
    -- Get rank of this plan among user's active plans
    -- Include both owned personal plans and participated shared plans
    WITH user_active_plans AS (
        -- Personal plans owned by user
        SELECT ps.id, ps.created_at as started_at
        FROM plan_sessions ps
        WHERE ps.user_id = p_user_id
        AND ps.status = 'active'
        AND ps.is_shared = FALSE

        UNION ALL

        -- Shared plans user participates in
        SELECT ps.id, sp.created_at as started_at
        FROM plan_sessions ps
        JOIN session_participants sp ON sp.plan_session_id = ps.id
        WHERE sp.user_id = p_user_id
        AND sp.status = 'active'
        AND ps.is_shared = TRUE
        AND ps.status = 'active'
    ),
    ranked_plans AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY started_at ASC) as rank
        FROM user_active_plans
    )
    SELECT rank INTO plan_rank
    FROM ranked_plans
    WHERE id = p_plan_session_id;

    -- Return multiplier (cap at 5th plan = 0.1)
    IF plan_rank IS NULL THEN
        RETURN 1.0; -- Default if plan not found
    ELSIF plan_rank <= 5 THEN
        RETURN multipliers[plan_rank];
    ELSE
        RETURN 0.1;
    END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- 10. TRIGGER FUNCTION - Update session stats when rewards change
-- ============================================================================

CREATE OR REPLACE FUNCTION update_session_user_stats()
RETURNS TRIGGER AS $$
DECLARE
    v_total_points INTEGER;
    v_days_completed INTEGER;
    v_comments_count INTEGER;
    v_session_id UUID;
    v_user_id UUID;
    v_level INTEGER;
BEGIN
    -- Get the session and user IDs
    v_session_id := COALESCE(NEW.plan_session_id, OLD.plan_session_id);
    v_user_id := COALESCE(NEW.user_id, OLD.user_id);

    -- Calculate aggregates from rewards table
    SELECT
        COALESCE(SUM(points), 0),
        COALESCE(COUNT(*) FILTER (WHERE reward_type = 'day_complete'), 0),
        COALESCE(COUNT(*) FILTER (WHERE reward_type = 'day_comment'), 0)
    INTO v_total_points, v_days_completed, v_comments_count
    FROM public.session_user_rewards
    WHERE plan_session_id = v_session_id
    AND user_id = v_user_id;

    -- Calculate level from total XP (server-side)
    v_level := calculate_level_from_xp(v_total_points);

    -- Upsert stats for the user
    INSERT INTO public.session_user_stats (
        plan_session_id,
        user_id,
        total_points,
        days_completed,
        comments_count,
        level,
        updated_at
    )
    VALUES (
        v_session_id,
        v_user_id,
        v_total_points,
        v_days_completed,
        v_comments_count,
        v_level,
        NOW()
    )
    ON CONFLICT (plan_session_id, user_id)
    DO UPDATE SET
        total_points = EXCLUDED.total_points,
        days_completed = EXCLUDED.days_completed,
        comments_count = EXCLUDED.comments_count,
        level = EXCLUDED.level,
        updated_at = NOW();

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update stats on reward changes
CREATE TRIGGER trigger_update_session_user_stats
    AFTER INSERT OR UPDATE OR DELETE ON public.session_user_rewards
    FOR EACH ROW
    EXECUTE FUNCTION update_session_user_stats();

-- ============================================================================
-- 11. TRIGGER FUNCTION - Update global stats when session stats change
-- ============================================================================

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
    SELECT COUNT(*)
    INTO v_plans_done
    FROM public.session_user_rewards sur
    WHERE sur.user_id = v_user_id
    AND sur.reward_type = 'plan_complete';

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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update global stats when session stats change
CREATE TRIGGER trigger_update_user_global_stats
    AFTER INSERT OR UPDATE OR DELETE ON public.session_user_stats
    FOR EACH ROW
    EXECUTE FUNCTION update_user_global_stats();

-- ============================================================================
-- 12. ENABLE REALTIME
-- ============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.session_user_rewards;
ALTER PUBLICATION supabase_realtime ADD TABLE public.session_user_stats;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_global_stats;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_login_history;

-- ============================================================================
-- 13. REWARD POINTS CONFIGURATION (reference only, not enforced in DB)
-- ============================================================================

-- LOGIN REWARDS (not subject to plan multiplier)
-- Reward Type        | Points | Description
-- -------------------|--------|------------------------------------------
-- login              | 10     | Daily login bonus
-- login_streak_7     | 25     | 7 consecutive days logged in
-- login_streak_30    | 100    | 30 consecutive days logged in

-- PLAN REWARDS (subject to plan multiplier for concurrent plans)
-- Reward Type        | Points | Description
-- -------------------|--------|------------------------------------------
-- day_complete       | 10     | Completing a day's reading (× multiplier)
-- day_comment        | 5      | First comment on a day (× multiplier)
-- streak_3           | 15     | 3 consecutive days in plan
-- streak_7           | 50     | 7 consecutive days in plan
-- streak_14          | 100    | 14 consecutive days in plan
-- streak_30          | 250    | 30 consecutive days in plan
-- streak_60          | 500    | 60 consecutive days in plan
-- streak_90          | 750    | 90 consecutive days in plan
-- plan_complete      | days×5 | Completing entire plan (30-day = 150 XP, 365-day = 1825 XP)

-- PLAN MULTIPLIERS (diminishing returns for concurrent plans)
-- Plan Rank  | Multiplier | Notes
-- -----------|------------|------------------------------------------
-- 1 (oldest) | 1.0 (100%) | First/oldest active plan gets full XP
-- 2          | 0.6 (60%)  | Second oldest gets 60%
-- 3          | 0.35 (35%) | Third oldest gets 35%
-- 4          | 0.2 (20%)  | Fourth oldest gets 20%
-- 5+         | 0.1 (10%)  | Fifth and beyond get minimum 10%
--
-- Note: Multipliers dynamically re-rank as plans complete
-- When oldest plan completes, the next plan becomes "first" and gets 100%
