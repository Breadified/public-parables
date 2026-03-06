-- Migration: Fix RLS infinite recursion
-- The policies for plan_sessions and session_participants were referencing each other

-- ============================================================================
-- 1. DROP PROBLEMATIC POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Participants can view shared plan sessions" ON public.plan_sessions;
DROP POLICY IF EXISTS "Participants can view other participants" ON public.session_participants;
DROP POLICY IF EXISTS "Session owners can manage participants" ON public.session_participants;

-- ============================================================================
-- 2. CREATE SECURITY DEFINER FUNCTION TO CHECK PARTICIPATION
-- ============================================================================

-- This function bypasses RLS to check if a user is a participant
CREATE OR REPLACE FUNCTION is_session_participant(session_id UUID, check_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM session_participants
        WHERE plan_session_id = session_id
        AND user_id = check_user_id
        AND status = 'active'
    );
$$;

-- Function to check if user owns the session
CREATE OR REPLACE FUNCTION is_session_owner(session_id UUID, check_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM plan_sessions
        WHERE id = session_id
        AND user_id = check_user_id
    );
$$;

-- ============================================================================
-- 3. RECREATE POLICIES WITHOUT RECURSION
-- ============================================================================

-- Plan sessions: participants can view shared sessions (uses security definer function)
CREATE POLICY "Participants can view shared plan sessions" ON public.plan_sessions
    FOR SELECT USING (
        is_shared = TRUE
        AND is_session_participant(id, auth.uid())
    );

-- Session participants: can view if you're a participant (uses security definer function)
CREATE POLICY "Participants can view other participants" ON public.session_participants
    FOR SELECT USING (
        is_session_participant(plan_session_id, auth.uid())
    );

-- Session participants: owners can manage (uses security definer function)
CREATE POLICY "Session owners can manage participants" ON public.session_participants
    FOR ALL USING (
        is_session_owner(plan_session_id, auth.uid())
    );
