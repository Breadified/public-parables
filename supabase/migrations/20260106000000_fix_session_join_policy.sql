-- Migration: Fix session_participants INSERT policy for joining shared sessions
-- The "Users can join shared sessions" policy may have been dropped or misconfigured
-- during previous migrations. This ensures users can join shared sessions.

-- ============================================================================
-- 1. DROP AND RECREATE THE JOIN POLICY
-- ============================================================================

-- Drop existing policy if it exists (might be broken or using old column names)
DROP POLICY IF EXISTS "Users can join shared sessions" ON public.session_participants;

-- Recreate the INSERT policy
-- Users can join a shared session if:
-- 1. The user_id matches their authenticated user ID
-- 2. The plan_session exists, is shared, and is active
CREATE POLICY "Users can join shared sessions" ON public.session_participants
    FOR INSERT WITH CHECK (
        auth.uid() = user_id
        AND EXISTS (
            SELECT 1 FROM public.plan_sessions
            WHERE id = plan_session_id
            AND is_shared = TRUE
            AND status = 'active'
        )
    );

-- ============================================================================
-- 2. ENSURE UPDATE POLICY EXISTS
-- ============================================================================

-- Drop and recreate the update policy for users to update their own participation
DROP POLICY IF EXISTS "Users can update own participation" ON public.session_participants;

CREATE POLICY "Users can update own participation" ON public.session_participants
    FOR UPDATE USING (auth.uid() = user_id);

-- ============================================================================
-- 3. FIX THE "Session owners can manage participants" POLICY
-- ============================================================================

-- The FOR ALL policy with only USING clause has issues for INSERT operations.
-- We need to add WITH CHECK for INSERT to work correctly.
DROP POLICY IF EXISTS "Session owners can manage participants" ON public.session_participants;

-- Recreate with both USING (for SELECT/UPDATE/DELETE) and WITH CHECK (for INSERT)
CREATE POLICY "Session owners can manage participants" ON public.session_participants
    FOR ALL
    USING (
        is_session_owner(plan_session_id, auth.uid())
    )
    WITH CHECK (
        is_session_owner(plan_session_id, auth.uid())
    );
