-- =============================================================================
-- Mark Obsolete Tables
-- These tables are no longer used by the app but kept for data preservation.
-- They can be safely deleted after all users have updated.
-- =============================================================================

-- user_login_history: OBSOLETE
-- Previously tracked daily logins for streak calculation.
-- Now replaced by:
--   - user_activity_streaks (tracks all activity streaks: login, reading, notes)
--   - user_rewards (tracks XP rewards for activities)
--
-- The record_activity_with_streak() function handles both streak and reward tracking.

COMMENT ON TABLE user_login_history IS
'OBSOLETE: No longer used as of v3.0.59. Login tracking moved to user_activity_streaks and user_rewards tables. Safe to delete after 2026-03-01 when all users have updated.';

-- Add index on created_at for efficient cleanup queries later
CREATE INDEX IF NOT EXISTS idx_user_login_history_created_at
ON user_login_history(created_at);

-- =============================================================================

-- session_user_stats: OBSOLETE
-- Previously tracked per-session stats for leaderboard features.
-- The leaderboard UI was never implemented.
-- Stats are now tracked in:
--   - user_global_stats (aggregated XP and level)
--   - user_rewards (individual reward records)
--
-- Note: Triggers still write to this table from user_rewards changes,
-- but no code reads from it.

COMMENT ON TABLE session_user_stats IS
'OBSOLETE: No longer used as of v3.0.59. Leaderboard feature was never implemented. Per-session stats not displayed in UI. Safe to delete after 2026-03-01 when all users have updated.';

-- Add index on created_at for efficient cleanup queries later
CREATE INDEX IF NOT EXISTS idx_session_user_stats_updated_at
ON session_user_stats(updated_at);
