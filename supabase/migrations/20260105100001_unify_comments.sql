-- Migration: Unify comments tables
-- Consolidates session_comments into comments table with context_type
-- This eliminates redundancy and provides a single comments system

-- ============================================================================
-- 1. ADD POLYMORPHIC COLUMNS TO COMMENTS TABLE
-- ============================================================================

-- Add new columns for polymorphic references
ALTER TABLE public.comments
ADD COLUMN IF NOT EXISTS context_type TEXT DEFAULT 'devotion',
ADD COLUMN IF NOT EXISTS plan_session_id UUID REFERENCES public.plan_sessions(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS day_number INTEGER;

-- Make question_id nullable (it was required before, now only for devotion context)
ALTER TABLE public.comments
ALTER COLUMN question_id DROP NOT NULL;

-- Add constraint to ensure valid context
ALTER TABLE public.comments
DROP CONSTRAINT IF EXISTS valid_comment_context;

ALTER TABLE public.comments
ADD CONSTRAINT valid_comment_context CHECK (
    (context_type = 'devotion' AND question_id IS NOT NULL) OR
    (context_type = 'plan_session' AND plan_session_id IS NOT NULL)
);

-- Create indexes for plan session comments
CREATE INDEX IF NOT EXISTS idx_comments_context_type ON public.comments(context_type);
CREATE INDEX IF NOT EXISTS idx_comments_plan_session ON public.comments(plan_session_id) WHERE plan_session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_comments_plan_session_day ON public.comments(plan_session_id, day_number) WHERE plan_session_id IS NOT NULL;


-- ============================================================================
-- 2. MIGRATE SESSION_COMMENTS DATA TO COMMENTS
-- ============================================================================

-- Insert session_comments into comments table
INSERT INTO public.comments (
    id,
    user_id,
    parent_comment_id,
    content,
    like_count,
    reply_count,
    status,
    created_at,
    updated_at,
    context_type,
    plan_session_id,
    day_number,
    is_anonymous,
    is_ai_generated
)
SELECT
    id,
    user_id,
    parent_comment_id,
    content,
    like_count,
    reply_count,
    status,
    created_at,
    updated_at,
    'plan_session',
    plan_session_id,
    day_number,
    FALSE,  -- is_anonymous default
    FALSE   -- is_ai_generated default
FROM public.session_comments
ON CONFLICT (id) DO NOTHING;


-- ============================================================================
-- 3. MIGRATE SESSION_COMMENT_LIKES TO COMMENT_LIKES
-- ============================================================================

-- Insert session_comment_likes into comment_likes table
INSERT INTO public.comment_likes (id, comment_id, user_id, created_at)
SELECT id, comment_id, user_id, created_at
FROM public.session_comment_likes
ON CONFLICT (id) DO NOTHING;


-- ============================================================================
-- 4. UPDATE RLS POLICIES FOR UNIFIED COMMENTS
-- ============================================================================

-- Drop existing policies on comments
DROP POLICY IF EXISTS "Anyone can read active comments" ON public.comments;
DROP POLICY IF EXISTS "Authenticated users can create comments" ON public.comments;
DROP POLICY IF EXISTS "Users can update own comments" ON public.comments;
DROP POLICY IF EXISTS "Users can delete own comments" ON public.comments;

-- Create unified policies that handle both context types
CREATE POLICY "Users can read comments" ON public.comments
    FOR SELECT USING (
        status = 'active'
        AND (
            -- Devotion comments: anyone can read
            context_type = 'devotion'
            OR
            -- Plan session comments: only participants
            (context_type = 'plan_session' AND EXISTS (
                SELECT 1 FROM public.session_participants sp
                WHERE sp.plan_session_id = comments.plan_session_id
                AND sp.user_id = auth.uid()
                AND sp.status = 'active'
            ))
        )
    );

CREATE POLICY "Users can create comments" ON public.comments
    FOR INSERT WITH CHECK (
        auth.uid() = user_id
        AND (
            -- Devotion comments: any authenticated user
            context_type = 'devotion'
            OR
            -- Plan session comments: only participants
            (context_type = 'plan_session' AND EXISTS (
                SELECT 1 FROM public.session_participants sp
                WHERE sp.plan_session_id = comments.plan_session_id
                AND sp.user_id = auth.uid()
                AND sp.status = 'active'
            ))
        )
    );

CREATE POLICY "Users can update own comments" ON public.comments
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments" ON public.comments
    FOR DELETE USING (auth.uid() = user_id);


-- ============================================================================
-- 5. UPDATE RLS POLICIES FOR UNIFIED COMMENT_LIKES
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Anyone can read likes" ON public.comment_likes;
DROP POLICY IF EXISTS "Users can like comments" ON public.comment_likes;
DROP POLICY IF EXISTS "Users can unlike own likes" ON public.comment_likes;

-- Create unified policies
CREATE POLICY "Users can read likes" ON public.comment_likes
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.comments c
            WHERE c.id = comment_likes.comment_id
            AND c.status = 'active'
            AND (
                c.context_type = 'devotion'
                OR (c.context_type = 'plan_session' AND EXISTS (
                    SELECT 1 FROM public.session_participants sp
                    WHERE sp.plan_session_id = c.plan_session_id
                    AND sp.user_id = auth.uid()
                    AND sp.status = 'active'
                ))
            )
        )
    );

CREATE POLICY "Users can like comments" ON public.comment_likes
    FOR INSERT WITH CHECK (
        auth.uid() = user_id
        AND EXISTS (
            SELECT 1 FROM public.comments c
            WHERE c.id = comment_likes.comment_id
            AND c.status = 'active'
        )
    );

CREATE POLICY "Users can unlike own likes" ON public.comment_likes
    FOR DELETE USING (auth.uid() = user_id);


-- ============================================================================
-- 6. DROP SESSION_COMMENTS AND SESSION_COMMENT_LIKES TABLES
-- ============================================================================

-- Drop RLS policies first
DROP POLICY IF EXISTS "Participants can read session comments" ON public.session_comments;
DROP POLICY IF EXISTS "Participants can insert comments" ON public.session_comments;
DROP POLICY IF EXISTS "Users can update own comments" ON public.session_comments;
DROP POLICY IF EXISTS "Users can delete own comments" ON public.session_comments;
DROP POLICY IF EXISTS "Participants can see likes" ON public.session_comment_likes;
DROP POLICY IF EXISTS "Users can like session comments" ON public.session_comment_likes;
DROP POLICY IF EXISTS "Users can unlike own likes" ON public.session_comment_likes;

-- Drop indexes
DROP INDEX IF EXISTS idx_session_comments_plan_session;
DROP INDEX IF EXISTS idx_session_comments_plan_session_day;

-- Remove from realtime (ignore if not in publication)
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.session_comments;
EXCEPTION
    WHEN undefined_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.session_comment_likes;
EXCEPTION
    WHEN undefined_object THEN NULL;
END $$;

-- Drop the tables
DROP TABLE IF EXISTS public.session_comment_likes CASCADE;
DROP TABLE IF EXISTS public.session_comments CASCADE;
