/**
 * Plan Sync - Using Generic Entity Sync
 *
 * Configured to automatically sync plan sessions to Supabase using the reusable
 * createEntitySync factory.
 *
 * Note: Syncs ALL plan sessions (both active and inactive status) for cross-device
 * soft delete support. Components filter to activeSessions for display.
 */

import { createEntitySync } from '../services/sync/createEntitySync';
import { planStore$ } from './planStore';
import { authStore$ } from './bibleStore';
import { fetchUserSharedSessionsWithDetails } from '../services/planService';
import type { SharedSessionWithDetails } from '../services/planService';
import type { PlanSession } from '../types/database';
import NetInfo from '@react-native-community/netinfo';

// Create plan sessions sync using generic factory
// Syncs all sessions (active + inactive) for multi-device soft delete support
export const planSessionsSync = createEntitySync<PlanSession>({
  tableName: 'plan_sessions',
  storeObservable: planStore$.mySessions,
  getUserId: () => authStore$.user.peek()?.id || null,
  mergeStrategy: 'newest-wins', // Use newest since users might update progress on multiple devices
  saveToStorage: () => planStore$.saveSessionsToStorage(),
  debounceMs: 1000, // Wait 1 second after changes before syncing
});

// Export initialize function for use in useUnifiedData
export const initializePlanSessionsSync = planSessionsSync.initialize;

// ============================================================================
// SHARED SESSIONS SYNC
// ============================================================================
// Shared sessions use a join table (session_participants) so we can't use
// the standard createEntitySync. Instead, we fetch and merge manually.

/**
 * Load shared sessions from Supabase and merge with local data
 */
async function loadSharedSessionsFromSupabase(): Promise<void> {
  try {
    const userId = authStore$.user.peek()?.id;
    if (!userId) {
      console.log('[SharedSessionsSync] No user ID, skipping load');
      return;
    }

    console.log('[SharedSessionsSync] 📥 Loading shared sessions from Supabase...');

    const remoteSessions = await fetchUserSharedSessionsWithDetails(userId);
    const localSessions = planStore$.sharedSessions.peek() as SharedSessionWithDetails[];

    console.log('[SharedSessionsSync] 📊 Merge data:', {
      remoteCount: remoteSessions.length,
      localCount: localSessions.length,
    });

    // Merge: keep remote sessions (with fresh details), add local-only sessions
    const remoteIds = new Set(remoteSessions.map(s => s.id));
    const localOnly = localSessions.filter(s => !remoteIds.has(s.id));
    const mergedSessions = [...remoteSessions, ...localOnly];

    planStore$.setSharedSessions(mergedSessions);

    console.log(`[SharedSessionsSync] ✅ Loaded ${remoteSessions.length} shared sessions from Supabase`);
  } catch (error) {
    console.error('[SharedSessionsSync] ❌ Error loading shared sessions:', error);
  }
}

/**
 * Initialize shared sessions sync
 * Cache-first: Load from AsyncStorage first, then fetch from Supabase if online
 */
export function initializeSharedSessionsSync(): () => void {
  console.log('[SharedSessionsSync] 🔄 Initializing shared sessions sync...');

  // Run async initialization in background (non-blocking)
  (async () => {
    // 1. CACHE-FIRST: Load from local storage immediately
    await planStore$.loadSharedSessionsFromStorage();
    const cachedCount = planStore$.sharedSessions.peek().length;
    if (cachedCount > 0) {
      console.log(`[SharedSessionsSync] 📦 Loaded ${cachedCount} cached shared sessions`);
    }

    // 2. Check network before fetching from server
    const netState = await NetInfo.fetch();
    const isOnline = netState.isConnected ?? false;

    if (!isOnline) {
      console.log('[SharedSessionsSync] 📴 Offline - using cached shared sessions only');
    } else {
      // 3. Online: Sync with server (background refresh)
      loadSharedSessionsFromSupabase();
    }

    console.log('[SharedSessionsSync] ✅ Shared sessions sync initialized');
  })();

  // Return cleanup function (nothing to cleanup for fetch-only sync)
  return () => {
    console.log('[SharedSessionsSync] 🧹 Cleaning up shared sessions sync...');
  };
}

/**
 * Manually refresh shared sessions from Supabase
 * Call this after joining/leaving a session to ensure sync
 * Only refreshes if online
 */
export async function refreshSharedSessions(): Promise<void> {
  const netState = await NetInfo.fetch();
  if (!netState.isConnected) {
    console.log('[SharedSessionsSync] 📴 Offline - skipping refresh');
    return;
  }
  await loadSharedSessionsFromSupabase();
}
