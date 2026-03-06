-- Migration: Fix comments UPDATE policy to include participation check
-- The current UPDATE policy only checks auth.uid() = user_id, but for plan_session
-- context, we should also verify the user is still an active participant.
-- This prevents users from editing comments after leaving a session.

-- Drop existing UPDATE policy
DROP POLICY IF EXISTS "Users can update own comments" ON public.comments;

-- Recreate with participation check for plan_session context
CREATE POLICY "Users can update own comments" ON public.comments
    FOR UPDATE
    USING (
        auth.uid() = user_id
        AND (
            -- Devotion comments: user just needs to own it
            context_type = 'devotion'
            OR
            -- Plan session comments: user must still be a participant
            (context_type = 'plan_session' AND is_session_participant(plan_session_id, auth.uid()))
        )
    )
    WITH CHECK (
        auth.uid() = user_id
        AND (
            context_type = 'devotion'
            OR
            (context_type = 'plan_session' AND is_session_participant(plan_session_id, auth.uid()))
        )
    );
