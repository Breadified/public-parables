-- Migration: Fix user_global_stats RLS for direct updates
-- Allows users to update their own global stats (for login bonuses, etc.)
-- These rewards don't go through the plan-based reward flow

-- ============================================================================
-- ADD INSERT/UPDATE POLICIES FOR user_global_stats
-- ============================================================================

-- Users can insert their own global stats row
CREATE POLICY "Users can insert own global stats" ON public.user_global_stats
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own global stats
CREATE POLICY "Users can update own global stats" ON public.user_global_stats
    FOR UPDATE USING (auth.uid() = user_id);
