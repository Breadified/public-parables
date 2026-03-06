/**
 * useSyncRegistration - Centralizes all sync handler registrations
 *
 * This hook registers all data sync handlers in one place:
 * - Devotion comments
 * - Plan session comments
 * - Notes/bookmarks (via entity sync)
 * - User profile cache
 *
 * Usage in _layout.tsx:
 * ```tsx
 * const { user, isOnline } = useUnifiedAuth();
 * useSyncRegistration(user?.id);
 * ```
 */

import { useSyncHandler } from './useSyncHandler';
import { devotionStore$ } from '@/state/devotionStore';
import { planStore$ } from '@/state/planStore';
import { userProfileCache$ } from '@/state/userProfileCache';
import {
  syncDevotionCommentsIfNeeded,
  isSubscriptionActive as isDevotionSubscriptionActive,
} from '@/services/apologeticsService';
import {
  syncPlanCommentsIfNeeded,
  isPlanSubscriptionActive,
} from '@/services/planService';
import { notesSync } from '@/state/notesSync';
import { bookmarksSync } from '@/state/bookmarksSync';

interface UseSyncRegistrationOptions {
  /** User ID for authenticated syncing (null if not authenticated) */
  userId?: string | null;
}

/**
 * Register all sync handlers for the app
 *
 * Priority levels:
 * - 10: Critical user-facing data (comments)
 * - 20: Important background data (notes, bookmarks)
 * - 30: Nice-to-have data (user profiles)
 */
export function useSyncRegistration(options: UseSyncRegistrationOptions = {}) {
  const { userId } = options;

  // ============================================================================
  // DEVOTION COMMENTS SYNC (Priority: 10)
  // ============================================================================
  useSyncHandler(
    'devotion-comments',
    async () => {
      const questionId = devotionStore$.todaysQuestion.get()?.id;
      if (questionId) {
        console.log('[SyncRegistration] Syncing devotion comments for question:', questionId);
        await syncDevotionCommentsIfNeeded(questionId, userId);
      }
    },
    {
      priority: 10,
      isActive: () => {
        // Only active if we have a question and subscription may be lost
        const hasQuestion = !!devotionStore$.todaysQuestion.get()?.id;
        const subscriptionLost = !isDevotionSubscriptionActive();
        return hasQuestion && subscriptionLost;
      },
      deps: [userId],
    }
  );

  // ============================================================================
  // PLAN SESSION COMMENTS SYNC (Priority: 10)
  // ============================================================================
  useSyncHandler(
    'plan-comments',
    async () => {
      const sessionId = planStore$.activeSharedSessionId.get();
      const dayNumber = planStore$.selectedDayNumber.get();
      if (sessionId && dayNumber && userId) {
        console.log('[SyncRegistration] Syncing plan comments for session:', sessionId, 'day:', dayNumber);
        await syncPlanCommentsIfNeeded(sessionId, dayNumber, userId);
      }
    },
    {
      priority: 10,
      isActive: () => {
        // Only active if we have an active session and subscription may be lost
        const hasSession = !!planStore$.activeSharedSessionId.get();
        const hasUser = !!userId;
        const subscriptionLost = !isPlanSubscriptionActive();
        return hasSession && hasUser && subscriptionLost;
      },
      deps: [userId],
    }
  );

  // ============================================================================
  // NOTES SYNC (Priority: 20)
  // ============================================================================
  useSyncHandler(
    'notes',
    async () => {
      console.log('[SyncRegistration] Reconnecting notes sync');
      await notesSync.reconnectIfNeeded();
    },
    {
      priority: 20,
      isActive: () => !!userId && !notesSync.isSubscriptionActive(),
      deps: [userId],
    }
  );

  // ============================================================================
  // BOOKMARKS SYNC (Priority: 20)
  // ============================================================================
  useSyncHandler(
    'bookmarks',
    async () => {
      console.log('[SyncRegistration] Reconnecting bookmarks sync');
      await bookmarksSync.reconnectIfNeeded();
    },
    {
      priority: 20,
      isActive: () => !!userId && !bookmarksSync.isSubscriptionActive(),
      deps: [userId],
    }
  );

  // ============================================================================
  // USER PROFILES SYNC (Priority: 30)
  // ============================================================================
  useSyncHandler(
    'user-profiles',
    async () => {
      console.log('[SyncRegistration] Refreshing user profiles');
      await userProfileCache$.refreshProfilesIfNeeded();
    },
    {
      priority: 30,
      // Always active - profile refresh is low-cost
      deps: [],
    }
  );
}

export default useSyncRegistration;
