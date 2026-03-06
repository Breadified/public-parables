-- Migration: Fix comments RLS policies to use SECURITY DEFINER functions
-- The current comments policies use direct SELECT from session_participants,
-- which can fail due to RLS recursion. We need to use the is_session_participant
-- SECURITY DEFINER function instead to bypass RLS when checking participation.

-- ============================================================================
-- 1. FIX COMMENTS POLICIES TO USE SECURITY DEFINER FUNCTION
-- ============================================================================

-- Drop existing comments policies
DROP POLICY IF EXISTS "Users can read comments" ON public.comments;
DROP POLICY IF EXISTS "Users can create comments" ON public.comments;

-- Recreate with SECURITY DEFINER function to avoid RLS recursion
CREATE POLICY "Users can read comments" ON public.comments
    FOR SELECT USING (
        status = 'active'
        AND (
            -- Devotion comments: anyone can read
            context_type = 'devotion'
            OR
            -- Plan session comments: only participants (using SECURITY DEFINER function)
            (context_type = 'plan_session' AND is_session_participant(plan_session_id, auth.uid()))
        )
    );

CREATE POLICY "Users can create comments" ON public.comments
    FOR INSERT WITH CHECK (
        auth.uid() = user_id
        AND (
            -- Devotion comments: any authenticated user
            context_type = 'devotion'
            OR
            -- Plan session comments: only participants (using SECURITY DEFINER function)
            (context_type = 'plan_session' AND is_session_participant(plan_session_id, auth.uid()))
        )
    );

-- ============================================================================
-- 2. FIX COMMENT_LIKES POLICIES TO USE SECURITY DEFINER FUNCTION
-- ============================================================================

DROP POLICY IF EXISTS "Users can read likes" ON public.comment_likes;

CREATE POLICY "Users can read likes" ON public.comment_likes
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.comments c
            WHERE c.id = comment_likes.comment_id
            AND c.status = 'active'
            AND (
                c.context_type = 'devotion'
                OR (c.context_type = 'plan_session' AND is_session_participant(c.plan_session_id, auth.uid()))
            )
        )
    );
