-- Migration: Fix comments UPDATE RLS policy
-- The update policy needs WITH CHECK to allow status changes
-- Also need to allow users to read their own inactive comments

-- Drop and recreate the SELECT policy to allow users to see their own inactive comments
DROP POLICY IF EXISTS "Comments are publicly readable" ON public.comments;

-- Public can read active comments, users can always read their own
CREATE POLICY "Comments are readable" ON public.comments
    FOR SELECT USING (
        status = 'active'
        OR auth.uid() = user_id
    );

-- Drop and recreate the UPDATE policy with proper WITH CHECK
DROP POLICY IF EXISTS "Users can update own comments" ON public.comments;

-- Users can update their own comments (including setting status to inactive)
CREATE POLICY "Users can update own comments" ON public.comments
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
