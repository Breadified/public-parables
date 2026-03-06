-- Migration: Fix infinite recursion in shared_sessions RLS policies
-- The issue: session_participants INSERT policy checks shared_sessions,
-- and shared_sessions "Participants can view" policy checks session_participants.
-- When add_owner_as_participant trigger fires, this causes infinite recursion.

-- ============================================================================
-- 1. DROP THE PROBLEMATIC POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Participants can view shared sessions" ON public.shared_sessions;
DROP POLICY IF EXISTS "Anyone can view session by invite code for joining" ON public.shared_sessions;
DROP POLICY IF EXISTS "Users can join shared sessions" ON public.session_participants;
DROP POLICY IF EXISTS "Session owners can manage participants" ON public.session_participants;

-- ============================================================================
-- 2. CREATE HELPER FUNCTION TO CHECK PARTICIPATION (SECURITY DEFINER)
-- This bypasses RLS and avoids circular dependency
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_session_participant(session_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.session_participants
        WHERE shared_session_id = session_id
        AND user_id = auth.uid()
        AND status = 'active'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_session_owner(session_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.shared_sessions
        WHERE id = session_id
        AND owner_user_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

CREATE OR REPLACE FUNCTION public.session_exists_and_active(session_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.shared_sessions
        WHERE id = session_id
        AND status = 'active'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- ============================================================================
-- 3. RECREATE shared_sessions POLICIES (using helper functions)
-- ============================================================================

-- Participants can view sessions they're in (uses SECURITY DEFINER function)
CREATE POLICY "Participants can view shared sessions" ON public.shared_sessions
    FOR SELECT USING (
        public.is_session_participant(id)
    );

-- Anyone can view active sessions by invite code (for join flow)
CREATE POLICY "Anyone can view session by invite code" ON public.shared_sessions
    FOR SELECT USING (
        invite_code IS NOT NULL
        AND status = 'active'
    );

-- ============================================================================
-- 4. RECREATE session_participants POLICIES (using helper functions)
-- ============================================================================

-- Users can join active shared sessions
CREATE POLICY "Users can join shared sessions" ON public.session_participants
    FOR INSERT WITH CHECK (
        auth.uid() = user_id
        AND public.session_exists_and_active(shared_session_id)
    );

-- Session owners can manage all participants
CREATE POLICY "Session owners can manage participants" ON public.session_participants
    FOR ALL USING (
        public.is_session_owner(shared_session_id)
    );

-- ============================================================================
-- 5. GRANT EXECUTE ON HELPER FUNCTIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.is_session_participant(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_session_owner(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.session_exists_and_active(UUID) TO authenticated;
