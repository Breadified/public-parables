-- Migration: Fix session_participants SELECT policy to allow self-check
-- Users must be able to see their own participation record (even if inactive)
-- to properly handle rejoining a session they previously left.

-- The current "Participants can view other participants" policy uses
-- is_session_participant() which requires status = 'active'. This prevents
-- users from seeing their own inactive records, causing issues when rejoining.

-- ============================================================================
-- 1. DROP AND RECREATE SELECT POLICY
-- ============================================================================

DROP POLICY IF EXISTS "Participants can view other participants" ON public.session_participants;
DROP POLICY IF EXISTS "Users can view own and co-participants" ON public.session_participants;

-- New policy: Users can ALWAYS see their own participation record (for rejoining),
-- AND can see other participants if they are an active member of the same session
-- Uses is_session_participant() to avoid infinite recursion for the co-participant check
CREATE POLICY "Users can view own and co-participants" ON public.session_participants
    FOR SELECT USING (
        -- Can always see own record (needed for rejoin flow) - no recursion risk
        user_id = auth.uid()
        OR
        -- Can see others if you're an active participant (uses SECURITY DEFINER function)
        is_session_participant(plan_session_id, auth.uid())
    );
