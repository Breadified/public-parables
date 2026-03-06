-- Migration: Add is_on_time column to user_rewards
-- Tracks whether a day completion was on-time (current day <= completed day)
-- or catch-up (completing a past day). On-time completions earn XP, catch-ups don't.

-- ============================================================================
-- 1. ADD COLUMN
-- ============================================================================

-- Add is_on_time column (nullable for backwards compatibility and non-day rewards)
ALTER TABLE public.user_rewards
ADD COLUMN IF NOT EXISTS is_on_time BOOLEAN DEFAULT NULL;

-- ============================================================================
-- 2. ADD INDEX FOR QUERIES
-- ============================================================================

-- Index for querying on-time day completions (for plan completion bonus calculation)
CREATE INDEX IF NOT EXISTS idx_user_rewards_on_time
ON public.user_rewards (plan_session_id, user_id, reward_type, is_on_time)
WHERE reward_type = 'day_complete' AND is_on_time = true;

-- ============================================================================
-- 3. ADD COMMENT
-- ============================================================================

COMMENT ON COLUMN public.user_rewards.is_on_time IS
'For day_complete rewards: TRUE if completed on-time (current plan day <= completed day),
FALSE if catch-up (completing a past day). NULL for other reward types.
On-time completions earn full XP with diminishing returns, catch-ups earn 0 XP.';
