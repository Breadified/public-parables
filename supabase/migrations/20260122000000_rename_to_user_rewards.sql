-- Migration: Rename session_user_rewards to user_rewards
-- Makes the rewards table reusable for activities outside of plan sessions
-- (e.g., notes added while reading Bible directly, not in a plan)

-- ============================================================================
-- 1. RENAME TABLE
-- ============================================================================

ALTER TABLE public.session_user_rewards RENAME TO user_rewards;

-- ============================================================================
-- 2. MAKE plan_session_id NULLABLE
-- ============================================================================

-- Drop the NOT NULL constraint
ALTER TABLE public.user_rewards ALTER COLUMN plan_session_id DROP NOT NULL;

-- ============================================================================
-- 3. UPDATE UNIQUE CONSTRAINT
-- ============================================================================

-- Drop old unique constraint
ALTER TABLE public.user_rewards DROP CONSTRAINT IF EXISTS session_user_rewards_plan_session_id_user_id_reward_type_day__key;

-- Create new unique constraint that handles null session IDs
-- For session-based rewards: unique per (session, user, type, day)
-- For global rewards (null session): unique per (user, type, reference_id)
CREATE UNIQUE INDEX idx_user_rewards_session_unique
ON public.user_rewards (plan_session_id, user_id, reward_type, day_number)
WHERE plan_session_id IS NOT NULL;

CREATE UNIQUE INDEX idx_user_rewards_global_unique
ON public.user_rewards (user_id, reward_type, reference_id)
WHERE plan_session_id IS NULL AND reference_id IS NOT NULL;

-- ============================================================================
-- 4. RENAME INDEXES
-- ============================================================================

ALTER INDEX IF EXISTS idx_session_user_rewards_session RENAME TO idx_user_rewards_session;
ALTER INDEX IF EXISTS idx_session_user_rewards_user RENAME TO idx_user_rewards_user;
ALTER INDEX IF EXISTS idx_session_user_rewards_session_user RENAME TO idx_user_rewards_session_user;
ALTER INDEX IF EXISTS idx_session_user_rewards_type RENAME TO idx_user_rewards_type;
ALTER INDEX IF EXISTS idx_session_user_rewards_day RENAME TO idx_user_rewards_day;

-- ============================================================================
-- 5. UPDATE RLS POLICIES
-- ============================================================================

-- Drop old policies
DROP POLICY IF EXISTS "Users can view own rewards" ON public.user_rewards;
DROP POLICY IF EXISTS "Owners can view personal session rewards" ON public.user_rewards;
DROP POLICY IF EXISTS "Participants can view shared session rewards" ON public.user_rewards;
DROP POLICY IF EXISTS "Users can insert own rewards" ON public.user_rewards;
DROP POLICY IF EXISTS "Users can delete own rewards" ON public.user_rewards;

-- Create new policies that handle nullable plan_session_id

-- Users can view their own rewards (including global rewards with null session)
CREATE POLICY "Users can view own rewards" ON public.user_rewards
    FOR SELECT USING (auth.uid() = user_id);

-- Session owners can view all rewards in their personal sessions
CREATE POLICY "Owners can view personal session rewards" ON public.user_rewards
    FOR SELECT USING (
        plan_session_id IS NOT NULL AND
        EXISTS (
            SELECT 1 FROM public.plan_sessions ps
            WHERE ps.id = user_rewards.plan_session_id
            AND ps.user_id = auth.uid()
        )
    );

-- Participants can view all rewards in shared sessions they're part of
CREATE POLICY "Participants can view shared session rewards" ON public.user_rewards
    FOR SELECT USING (
        plan_session_id IS NOT NULL AND
        EXISTS (
            SELECT 1 FROM public.plan_sessions ps
            JOIN public.session_participants sp ON sp.plan_session_id = ps.id
            WHERE ps.id = user_rewards.plan_session_id
            AND ps.is_shared = TRUE
            AND sp.user_id = auth.uid()
            AND sp.status = 'active'
        )
    );

-- Users can insert their own rewards
-- For session rewards: must own or participate in session
-- For global rewards (null session): just need to be the user
CREATE POLICY "Users can insert own rewards" ON public.user_rewards
    FOR INSERT WITH CHECK (
        auth.uid() = user_id
        AND (
            -- Global reward (no session)
            plan_session_id IS NULL
            OR
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

-- Users can delete their own rewards
CREATE POLICY "Users can delete own rewards" ON public.user_rewards
    FOR DELETE USING (
        auth.uid() = user_id
        AND (
            -- Global reward (no session)
            plan_session_id IS NULL
            OR
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
-- 6. UPDATE TRIGGER FUNCTION
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

    -- Skip session stats update for global rewards (null session_id)
    IF v_session_id IS NULL THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    -- Calculate aggregates from rewards table
    SELECT
        COALESCE(SUM(points), 0),
        COALESCE(COUNT(*) FILTER (WHERE reward_type = 'day_complete'), 0),
        COALESCE(COUNT(*) FILTER (WHERE reward_type = 'day_comment'), 0)
    INTO v_total_points, v_days_completed, v_comments_count
    FROM public.user_rewards
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

-- ============================================================================
-- 7. RECREATE TRIGGER ON RENAMED TABLE
-- ============================================================================

DROP TRIGGER IF EXISTS trigger_update_session_user_stats ON public.user_rewards;

CREATE TRIGGER trigger_update_session_user_stats
    AFTER INSERT OR UPDATE OR DELETE ON public.user_rewards
    FOR EACH ROW
    EXECUTE FUNCTION update_session_user_stats();

-- ============================================================================
-- 8. UPDATE REALTIME PUBLICATION
-- ============================================================================

-- The table was renamed, so realtime should still work
-- Just ensure the renamed table is in the publication
DO $$
BEGIN
    -- Try to add the table (will fail silently if already exists due to rename)
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.user_rewards;
    EXCEPTION WHEN duplicate_object THEN
        -- Table already in publication (renamed from session_user_rewards)
        NULL;
    END;
END $$;

-- ============================================================================
-- 9. ADD COMMENT FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE public.user_rewards IS
'Unified rewards table for tracking user achievements and XP.
plan_session_id is nullable - NULL for global rewards (notes, chapter reads outside plans),
non-NULL for session-specific rewards (day completion, plan streaks, etc.)';

COMMENT ON COLUMN public.user_rewards.plan_session_id IS
'Optional reference to plan session. NULL for global rewards (notes, reading outside plans).';
