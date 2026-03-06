-- Migration: Fix session_participants RLS to allow self-check
-- Users need to see their own participation record to check if they've already joined

-- Drop the problematic policy
DROP POLICY IF EXISTS "Participants can view other participants" ON public.session_participants;

-- Recreate with self-check allowed
-- Users can view participants if:
-- 1. They ARE that participant (checking own record), OR
-- 2. They are a member of the same session
CREATE POLICY "Users can view own participation and co-participants" ON public.session_participants
    FOR SELECT USING (
        -- Can always see own record
        user_id = auth.uid()
        OR
        -- Can see others if you're a participant in the same session
        public.is_session_participant(shared_session_id)
    );
