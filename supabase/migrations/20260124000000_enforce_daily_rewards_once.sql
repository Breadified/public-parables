-- Migration: Enforce daily activity rewards once per day
--
-- Problem: Daily activities (chapter_read) were tracked per-chapter (2026-01-21_4_7)
-- but should only award XP once per day regardless of which chapter was read.
--
-- Solution:
-- 1. Update existing chapter_read reference_ids to per-day format (2026-01-21_chapter_read)
-- 2. Remove duplicates (keep first record per user per day)
-- 3. Add unique index to prevent future duplicates

-- ============================================================================
-- 1. UPDATE EXISTING REFERENCE_IDS TO PER-DAY FORMAT
-- ============================================================================

-- Convert per-chapter reference_ids (2026-01-21_4_7) to per-day (2026-01-21_chapter_read)
UPDATE public.user_rewards
SET reference_id = SUBSTRING(reference_id FROM 1 FOR 10) || '_chapter_read'
WHERE reward_type = 'chapter_read'
  AND reference_id IS NOT NULL
  AND reference_id ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}_[0-9]+_[0-9]+$';

-- ============================================================================
-- 2. REMOVE DUPLICATE DAILY REWARDS (KEEP FIRST PER DAY)
-- ============================================================================

-- Delete duplicates, keeping the earliest record for each (user, day)
DELETE FROM public.user_rewards
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY user_id, reward_type, reference_id
             ORDER BY created_at ASC
           ) as rn
    FROM public.user_rewards
    WHERE reward_type = 'chapter_read'
      AND reference_id IS NOT NULL
  ) ranked
  WHERE rn > 1
);

-- ============================================================================
-- 3. ADD UNIQUE INDEX FOR DAILY REWARDS
-- ============================================================================

-- For session-based rewards that track by reference_id (daily activities like chapter_read)
-- Ensures one reward per user per day per reward_type, regardless of session
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_rewards_daily_unique
ON public.user_rewards (user_id, reward_type, reference_id)
WHERE plan_session_id IS NOT NULL
  AND reference_id IS NOT NULL
  AND day_number IS NULL;

-- ============================================================================
-- 4. DOCUMENTATION
-- ============================================================================

COMMENT ON INDEX idx_user_rewards_daily_unique IS
'Prevents duplicate daily activity rewards (like chapter_read) per user per day.
Applies to session-based rewards that track by reference_id instead of day_number.
Reference_id format: YYYY-MM-DD_chapter_read for chapter reads.';
