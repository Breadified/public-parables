/**
 * Plan Store - Bible reading plans state management
 * Handles: plan sessions, shared sessions, participants, comments
 * Uses status field for soft delete (active/inactive)
 */

import { observable, computed } from "@legendapp/state";
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  PlanSession,
  SessionParticipant,
  SessionComment,
  BiblePlan,
  BiblePlanWithDays,
  DayRewardsSummary,
  SessionUserStats,
  RewardType,
} from "../types/database";

// Extended shared session with display details
// Note: After consolidation, SharedSession = PlanSession with is_shared=true
export interface SharedSessionWithDetails extends PlanSession {
  participant_count?: number;
  owner_display_name?: string;
  owner_avatar_url?: string | null;
}

// Extended types with user profile info
export interface ParticipantWithProfile extends SessionParticipant {
  displayName?: string;
  avatarUrl?: string | null;
}

export interface SessionCommentWithUser extends SessionComment {
  replies?: SessionCommentWithUser[];
}

// UI Mode for plan views
export type PlansSegment = 'my-plans' | 'discover' | 'shared';
export type SessionUIMode = 'reading' | 'comments' | 'participants' | 'thread';

const STORAGE_KEYS = {
  PLAN_SESSIONS: 'bible_plan_sessions',
  SHARED_SESSIONS: 'bible_shared_sessions',
  ACTIVE_SESSION: 'bible_active_session_id',
  LIKED_COMMENTS: 'bible_plan_liked_comments',
  ACTIVE_SHARED_SESSION: 'bible_active_shared_session_id',
  SESSION_COMMENTS_PREFIX: 'bible_plan_session_comments_', // + sessionId_dayNumber
  COMPLETED_DAYS: 'bible_plan_completed_days', // sessionId -> day numbers (local cache)
  COMMENT_TROPHIES: 'bible_plan_comment_trophies', // sessionId_day -> trophy count
  DAY_REWARDS_PREFIX: 'bible_plan_day_rewards_', // + sessionId (cache for day rewards summary)
  USER_STATS_PREFIX: 'bible_plan_user_stats_', // + sessionId (cache for user stats)
  PLAN_REMINDER_PREFERENCES: 'bible_plan_reminder_preferences',
};

// Type for cached session comments
interface SessionCommentsCache {
  comments: SessionCommentWithUser[];
  likedIds: string[];
  lastFetched: number;
  repliesMap?: Record<string, SessionCommentWithUser[]>; // NEW: parentId -> replies for offline support
}

// Day progress tracking state
export interface DayProgressState {
  scrollProgress: number;        // 0-1 current scroll position
  maxScrollProgress: number;     // Highest scroll reached (doesn't retract)
  readingScrollPositions: Record<string, number>;  // readingId -> scroll progress within that reading
  readingStartPositions: Record<string, number>;   // readingId -> position as % of total scroll (0-1)
  dayMarkedComplete: boolean;    // User pressed complete button
}

// Plan reminder preferences
export interface PlanReminderPreferences {
  reminderEnabled: boolean;
  reminderHour: number;        // 0-23 LOCAL time
  reminderMinute: number;      // 0-59
  reminderDismissed: boolean;  // User dismissed banner without setting
}

export const planStore$: any = observable({
  // ============================================================================
  // AVAILABLE PLANS (from SQLite)
  // ============================================================================

  availablePlans: [] as BiblePlan[],
  selectedPlan: null as BiblePlanWithDays | null,
  plansLoading: false,

  // ============================================================================
  // MY PLAN SESSIONS (personal progress)
  // ============================================================================

  mySessions: [] as PlanSession[],
  activeSessionId: null as string | null,
  sessionsLoading: false,

  // ============================================================================
  // SHARED SESSIONS (group studies)
  // ============================================================================

  sharedSessions: [] as SharedSessionWithDetails[],
  activeSharedSessionId: null as string | null,

  // Participants for active shared session
  participants: [] as ParticipantWithProfile[],
  participantsLoading: false,

  // ============================================================================
  // SESSION COMMENTS (per-day, with threading)
  // Stored by day number to prevent race conditions when switching days
  // ============================================================================

  commentsByDay: {} as Record<number, SessionCommentWithUser[]>,
  commentsLoading: false,
  commentsInitialized: false,
  commentsPage: 0,
  commentsHasMore: true,
  selectedDayNumber: 1,

  // Likes state (for optimistic updates)
  userLikedCommentIds: [] as string[],

  // ============================================================================
  // DAY PROGRESS STATE (Gamification)
  // ============================================================================

  dayProgress: {
    scrollProgress: 0,
    maxScrollProgress: 0,
    readingScrollPositions: {} as Record<string, number>,
    readingStartPositions: {} as Record<string, number>,
    dayMarkedComplete: false,
  } as DayProgressState,

  // Persisted across sessions (local cache, synced with Supabase)
  completedDays: {} as Record<string, number[]>,  // sessionId -> completed day numbers
  commentTrophies: {} as Record<string, number>,  // sessionId_day -> trophy count

  // Show comment trophy animation
  showCommentTrophy: false,

  // ============================================================================
  // REWARDS STATE (Gamification - synced with Supabase)
  // ============================================================================

  // Day rewards summary for current session (for displaying indicators)
  dayRewardsSummary: [] as DayRewardsSummary[],
  dayRewardsLoading: false,

  // User stats for current session
  userStats: null as SessionUserStats | null,
  userStatsLoading: false,

  // Track pending reward sync operations
  pendingRewardSync: false,

  // ============================================================================
  // UI STATE
  // ============================================================================

  activeSegment: 'my-plans' as PlansSegment,
  sessionUIMode: 'reading' as SessionUIMode,
  sessionModeStack: ['reading'] as SessionUIMode[],
  searchQuery: '',

  // Thread state (matches devotionStore$ pattern)
  activeThreadCommentId: null as string | null,

  // Pending invite code from deep link (before auth)
  pendingInviteCode: null as string | null,

  // Real-time subscription reference (for cleanup)
  realtimeChannel: null as any,

  // ============================================================================
  // PLAN REMINDER PREFERENCES
  // ============================================================================

  planReminderPreferences: {
    reminderEnabled: false,
    reminderHour: 8,
    reminderMinute: 0,
    reminderDismissed: false,
  } as PlanReminderPreferences,

  // ============================================================================
  // PLANS DISCOVERY ACTIONS
  // ============================================================================

  setActiveSegment: (segment: PlansSegment) => {
    planStore$.activeSegment.set(segment);
  },

  setSearchQuery: (query: string) => {
    planStore$.searchQuery.set(query);
  },

  setSelectedPlan: (plan: BiblePlanWithDays | null) => {
    planStore$.selectedPlan.set(plan);
  },

  setAvailablePlans: (plans: BiblePlan[]) => {
    planStore$.availablePlans.set(plans);
  },

  loadPlansFromSQLite: async () => {
    if (planStore$.plansLoading.get()) return;

    planStore$.plansLoading.set(true);
    try {
      // Dynamic import to avoid circular dependencies
      const { bibleSQLite } = await import('../services/sqlite');
      const plans = await bibleSQLite.getAllPlans();

      // Convert to BiblePlan type
      const biblePlans: BiblePlan[] = plans.map(p => ({
        id: p.id,
        name: p.name,
        description: p.description,
        duration_days: p.duration_days,
        group_id: p.group_id,
        group_name: p.group_name,
        sort_order: p.sort_order ?? 0,
        source: p.source,
        created_at: null, // Not stored in SQLite
      }));

      planStore$.availablePlans.set(biblePlans);
      console.log(`[PlanStore] Loaded ${biblePlans.length} plans from SQLite`);
    } catch (error) {
      console.error('[PlanStore] Failed to load plans:', error);
    } finally {
      planStore$.plansLoading.set(false);
    }
  },

  loadPlanDetails: async (planId: string) => {
    try {
      const { bibleSQLite } = await import('../services/sqlite');
      const planWithDays = await bibleSQLite.getPlanById(planId);

      if (planWithDays) {
        // Convert to BiblePlanWithDays type with unified content structure
        const plan: BiblePlanWithDays = {
          id: planWithDays.id,
          name: planWithDays.name,
          description: planWithDays.description,
          duration_days: planWithDays.duration_days,
          group_id: planWithDays.group_id,
          group_name: planWithDays.group_name,
          sort_order: planWithDays.sort_order ?? 0,
          source: planWithDays.source,
          created_at: null,
          days: planWithDays.days.map(d => ({
            day_number: d.day_number,
            // Map content items from SQLite to our type structure
            content: d.content.map(c => ({
              order: c.order,
              type: c.type,
              reference: c.reference,
              verse_id_start: c.verse_id_start,
              verse_id_end: c.verse_id_end,
              text: c.text,
            })),
          })),
        };
        planStore$.selectedPlan.set(plan);
        return plan;
      }
      return null;
    } catch (error) {
      console.error('[PlanStore] Failed to load plan details:', error);
      return null;
    }
  },

  // ============================================================================
  // SESSION MANAGEMENT ACTIONS
  // ============================================================================

  setActiveSession: (sessionId: string | null) => {
    planStore$.activeSessionId.set(sessionId);
    planStore$.saveActiveSessionToStorage();
  },

  setActiveSharedSession: (sharedSessionId: string | null) => {
    planStore$.activeSharedSessionId.set(sharedSessionId);
    planStore$.saveActiveSharedSessionToStorage();
    // Reset all day comments when switching sessions
    planStore$.commentsByDay.set({});
    planStore$.commentsInitialized.set(false);
    planStore$.selectedDayNumber.set(1);
  },

  addSession: (session: PlanSession) => {
    const sessions = planStore$.mySessions.get();
    if (!sessions.find((s: PlanSession) => s.id === session.id)) {
      planStore$.mySessions.set([session, ...sessions]);
      planStore$.saveSessionsToStorage();
    }
  },

  updateSession: (updatedSession: Partial<PlanSession> & { id: string }) => {
    const sessions = planStore$.mySessions.get();
    const updated = sessions.map((s: PlanSession) =>
      s.id === updatedSession.id
        ? { ...s, ...updatedSession, updated_at: new Date().toISOString() }
        : s
    );
    planStore$.mySessions.set(updated);
    planStore$.saveSessionsToStorage();
  },

  updateSessionProgress: (sessionId: string, currentDay: number) => {
    planStore$.updateSession({ id: sessionId, current_day: currentDay });
  },

  completeSession: (sessionId: string) => {
    planStore$.updateSession({
      id: sessionId,
      status: 'completed',
      completed_at: new Date().toISOString(),
    });
  },

  pauseSession: (sessionId: string) => {
    planStore$.updateSession({ id: sessionId, status: 'paused' });
  },

  resumeSession: (sessionId: string) => {
    planStore$.updateSession({ id: sessionId, status: 'active' });
  },

  softDeleteSession: (sessionId: string) => {
    planStore$.updateSession({ id: sessionId, status: 'inactive' });
  },

  // ============================================================================
  // SHARED SESSION ACTIONS
  // ============================================================================

  addSharedSession: (session: SharedSessionWithDetails) => {
    const sessions = planStore$.sharedSessions.get();
    if (!sessions.find((s: SharedSessionWithDetails) => s.id === session.id)) {
      planStore$.sharedSessions.set([session, ...sessions]);
      planStore$.saveSharedSessionsToStorage();
    }
  },

  updateSharedSession: (updatedSession: Partial<SharedSessionWithDetails> & { id: string }) => {
    const sessions = planStore$.sharedSessions.get();
    const updated = sessions.map((s: SharedSessionWithDetails) =>
      s.id === updatedSession.id ? { ...s, ...updatedSession } : s
    );
    planStore$.sharedSessions.set(updated);
    planStore$.saveSharedSessionsToStorage();
  },

  removeSharedSession: (sharedSessionId: string) => {
    const sessions = planStore$.sharedSessions.get();
    planStore$.sharedSessions.set(
      sessions.filter((s: SharedSessionWithDetails) => s.id !== sharedSessionId)
    );
    planStore$.saveSharedSessionsToStorage();
  },

  isSessionOwner: (sharedSessionId: string, userId: string): boolean => {
    const session = planStore$.sharedSessions.get()
      .find((s: SharedSessionWithDetails) => s.id === sharedSessionId);
    return session?.owner_user_id === userId;
  },

  // ============================================================================
  // PARTICIPANTS ACTIONS
  // ============================================================================

  setParticipants: (participants: ParticipantWithProfile[]) => {
    planStore$.participants.set(participants);
  },

  addParticipant: (participant: ParticipantWithProfile) => {
    const current = planStore$.participants.get();
    if (!current.find((p: ParticipantWithProfile) => p.id === participant.id)) {
      planStore$.participants.set([...current, participant]);
    }
  },

  removeParticipant: (participantId: string) => {
    const current = planStore$.participants.get();
    planStore$.participants.set(
      current.filter((p: ParticipantWithProfile) => p.id !== participantId)
    );
  },

  updateParticipantProgress: (userId: string, currentDay: number) => {
    const current = planStore$.participants.get();
    const updated = current.map((p: ParticipantWithProfile) =>
      p.user_id === userId
        ? { ...p, current_day: currentDay, last_active_at: new Date().toISOString() }
        : p
    );
    planStore$.participants.set(updated);
  },

  // ============================================================================
  // DAY PROGRESS ACTIONS (Gamification)
  // ============================================================================

  /**
   * Update overall scroll progress (0-1)
   * Max progress only increases (doesn't retract on scroll up)
   */
  updateScrollProgress: (progress: number) => {
    const current = planStore$.dayProgress.get();
    const newMaxProgress = Math.max(current.maxScrollProgress, progress);
    planStore$.dayProgress.set({
      ...current,
      scrollProgress: progress,
      maxScrollProgress: newMaxProgress,
    });
  },

  /**
   * Update scroll position for a specific reading section
   * Used for per-node tracking in ProgressMap
   */
  updateReadingScrollPosition: (readingId: string, progress: number) => {
    const current = planStore$.dayProgress.get();
    const existingProgress = current.readingScrollPositions[readingId] || 0;
    const newProgress = Math.max(existingProgress, progress);
    planStore$.dayProgress.set({
      ...current,
      readingScrollPositions: {
        ...current.readingScrollPositions,
        [readingId]: newProgress,
      },
    });
  },

  /**
   * Update reading start positions (where each reading begins as % of total scroll)
   * Used to position nodes in ProgressMap at actual content locations
   */
  updateReadingStartPositions: (positions: Record<string, number>) => {
    const current = planStore$.dayProgress.get();
    planStore$.dayProgress.set({
      ...current,
      readingStartPositions: positions,
    });
  },

  /**
   * Mark the current day as complete
   * Syncs with Supabase and updates local cache
   *
   * XP Rules:
   * - Today's day: Awards full XP
   * - Past day: Completes but NO XP
   * - Future day: Blocked (returns early)
   *
   * @returns { success: boolean, xpAwarded: boolean }
   */
  markDayComplete: async (sessionId: string, dayNumber: number, userId: string): Promise<{
    success: boolean;
    xpAwarded: boolean;
    pointsAwarded: number;
    newStreak?: number;
    streakMilestone?: { type: '7-day' | '30-day' | '365-day'; xp: number; rewardType: RewardType };
    allCompleteBonusXP?: number;
  }> => {
    // Find session to get started_at for day calculation
    const mySessions = planStore$.mySessions.get();
    const sharedSessions = planStore$.sharedSessions.get();
    const session = mySessions.find((s: PlanSession) => s.id === sessionId) ||
                    sharedSessions.find((s: PlanSession) => s.id === sessionId);

    if (!session) {
      console.error('[PlanStore] Session not found:', sessionId);
      return { success: false, xpAwarded: false, pointsAwarded: 0 };
    }

    // Get plan duration for day calculation
    let planMaxDays: number | undefined;
    try {
      const { bibleSQLite } = await import('../services/sqlite');
      const planInfo = await bibleSQLite.getPlanById(session.plan_id);
      planMaxDays = planInfo?.duration_days;
    } catch (error) {
      console.warn('[PlanStore] Could not get plan duration:', error);
    }

    // Update day progress state immediately (optimistic)
    const current = planStore$.dayProgress.get();
    planStore$.dayProgress.set({
      ...current,
      dayMarkedComplete: true,
    });

    // Update local cache immediately (optimistic)
    const completedDays = planStore$.completedDays.get();
    const sessionDays = completedDays[sessionId] || [];
    if (!sessionDays.includes(dayNumber)) {
      planStore$.completedDays.set({
        ...completedDays,
        [sessionId]: [...sessionDays, dayNumber],
      });
      await planStore$.saveCompletedDaysToStorage();
    }

    // Update dayRewardsSummary immediately (optimistic)
    const dayRewards = planStore$.dayRewardsSummary.get();
    const existingDay = dayRewards.find((d: DayRewardsSummary) => d.dayNumber === dayNumber);
    if (existingDay) {
      planStore$.dayRewardsSummary.set(
        dayRewards.map((d: DayRewardsSummary) =>
          d.dayNumber === dayNumber ? { ...d, isComplete: true } : d
        )
      );
    } else {
      planStore$.dayRewardsSummary.set([
        ...dayRewards,
        { dayNumber, isComplete: true, hasComment: false },
      ]);
    }

    // Sync with Supabase
    planStore$.pendingRewardSync.set(true);
    try {
      const { markDayComplete, checkAndAwardStreakRewards } = await import('../services/planService');

      // Pass session start date and plan max days for XP validation
      const result = await markDayComplete(
        sessionId,
        userId,
        dayNumber,
        session.started_at,
        planMaxDays
      );

      if (!result.success) {
        // Rollback optimistic update (future day blocked)
        const rollbackDays = planStore$.completedDays.get();
        const rollbackSessionDays = rollbackDays[sessionId] || [];
        planStore$.completedDays.set({
          ...rollbackDays,
          [sessionId]: rollbackSessionDays.filter((d: number) => d !== dayNumber),
        });
        planStore$.dayProgress.set({
          ...planStore$.dayProgress.get(),
          dayMarkedComplete: false,
        });
        return { success: false, xpAwarded: false, pointsAwarded: 0 };
      }

      // Only check for streak rewards if XP was awarded (today's day)
      let streakResult: { newStreak?: number; streakMilestone?: { type: '7-day' | '30-day' | '365-day'; xp: number; rewardType: RewardType } } = {};
      if (result.xpAwarded) {
        streakResult = await checkAndAwardStreakRewards(sessionId, userId);
      }

      // Refresh stats after completion
      await planStore$.loadUserStats(sessionId, userId);

      return {
        ...result,
        newStreak: streakResult.newStreak,
        streakMilestone: streakResult.streakMilestone,
      };
    } catch (error) {
      console.error('[PlanStore] Failed to sync day completion:', error);
      // Rollback optimistic update on error
      const rollbackDays = planStore$.completedDays.get();
      const rollbackSessionDays = rollbackDays[sessionId] || [];
      planStore$.completedDays.set({
        ...rollbackDays,
        [sessionId]: rollbackSessionDays.filter((d: number) => d !== dayNumber),
      });
      planStore$.dayProgress.set({
        ...planStore$.dayProgress.get(),
        dayMarkedComplete: false,
      });
      return { success: false, xpAwarded: false, pointsAwarded: 0 };
    } finally {
      planStore$.pendingRewardSync.set(false);
    }
  },

  /**
   * Unmark a day as complete (undo)
   */
  unmarkDayComplete: async (sessionId: string, dayNumber: number, userId: string) => {
    // Update local cache immediately (optimistic)
    const completedDays = planStore$.completedDays.get();
    const sessionDays = completedDays[sessionId] || [];
    planStore$.completedDays.set({
      ...completedDays,
      [sessionId]: sessionDays.filter((d: number) => d !== dayNumber),
    });
    await planStore$.saveCompletedDaysToStorage();

    // Update day progress if it's the current day
    const current = planStore$.dayProgress.get();
    if (current.dayMarkedComplete) {
      planStore$.dayProgress.set({
        ...current,
        dayMarkedComplete: false,
      });
    }

    // Update dayRewardsSummary
    const dayRewards = planStore$.dayRewardsSummary.get();
    planStore$.dayRewardsSummary.set(
      dayRewards.map((d: DayRewardsSummary) =>
        d.dayNumber === dayNumber ? { ...d, isComplete: false } : d
      )
    );

    // Sync with Supabase
    try {
      const { unmarkDayComplete } = await import('../services/planService');
      await unmarkDayComplete(sessionId, userId, dayNumber);
    } catch (error) {
      console.error('[PlanStore] Failed to sync day uncompletion:', error);
    }
  },

  /**
   * Check if a specific day is completed for a session (from local cache)
   */
  isDayComplete: (sessionId: string, dayNumber: number): boolean => {
    const completedDays = planStore$.completedDays.get();
    const sessionDays = completedDays[sessionId] || [];
    return sessionDays.includes(dayNumber);
  },

  /**
   * Check if a day has a comment reward (from dayRewardsSummary)
   */
  dayHasComment: (dayNumber: number): boolean => {
    const dayRewards = planStore$.dayRewardsSummary.get();
    const day = dayRewards.find((d: DayRewardsSummary) => d.dayNumber === dayNumber);
    return day?.hasComment ?? false;
  },

  /**
   * Reset day progress for a new day
   */
  resetDayProgress: () => {
    planStore$.dayProgress.set({
      scrollProgress: 0,
      maxScrollProgress: 0,
      readingScrollPositions: {},
      readingStartPositions: {},
      dayMarkedComplete: false,
    });
  },

  /**
   * Trigger comment trophy animation and award comment reward
   */
  triggerCommentTrophy: async (sessionId: string, dayNumber: number, userId: string, commentId: string) => {
    // Show trophy animation
    planStore$.showCommentTrophy.set(true);

    // Increment trophy count (local)
    const trophyKey = `${sessionId}_${dayNumber}`;
    const trophies = planStore$.commentTrophies.get();
    planStore$.commentTrophies.set({
      ...trophies,
      [trophyKey]: (trophies[trophyKey] || 0) + 1,
    });
    await planStore$.saveCommentTrophiesToStorage();

    // Update dayRewardsSummary optimistically
    const dayRewards = planStore$.dayRewardsSummary.get();
    const existingDay = dayRewards.find((d: DayRewardsSummary) => d.dayNumber === dayNumber);
    if (existingDay) {
      planStore$.dayRewardsSummary.set(
        dayRewards.map((d: DayRewardsSummary) =>
          d.dayNumber === dayNumber ? { ...d, hasComment: true } : d
        )
      );
    } else {
      planStore$.dayRewardsSummary.set([
        ...dayRewards,
        { dayNumber, isComplete: false, hasComment: true },
      ]);
    }

    // Award comment reward via Supabase (first comment on this day only)
    try {
      const { awardCommentReward } = await import('../services/planService');
      await awardCommentReward(sessionId, userId, dayNumber, commentId);
    } catch (error) {
      console.error('[PlanStore] Failed to award comment reward:', error);
    }
  },

  /**
   * Hide comment trophy animation
   */
  hideCommentTrophy: () => {
    planStore$.showCommentTrophy.set(false);
  },

  // ============================================================================
  // REWARDS LOADING ACTIONS
  // ============================================================================

  /**
   * Load day rewards summary from Supabase
   * Updates both local cache and dayRewardsSummary state
   */
  loadDayRewardsSummary: async (sessionId: string, userId: string) => {
    planStore$.dayRewardsLoading.set(true);
    try {
      const { fetchDayRewardsSummary } = await import('../services/planService');
      const summary = await fetchDayRewardsSummary(sessionId, userId);

      planStore$.dayRewardsSummary.set(summary);

      // Update local completedDays cache from summary
      const completedDayNumbers = summary
        .filter((d: DayRewardsSummary) => d.isComplete)
        .map((d: DayRewardsSummary) => d.dayNumber);

      const completedDays = planStore$.completedDays.get();
      planStore$.completedDays.set({
        ...completedDays,
        [sessionId]: completedDayNumbers,
      });
      await planStore$.saveCompletedDaysToStorage();

      // Cache to local storage
      await planStore$.saveDayRewardsSummaryToStorage(sessionId);

      console.log(`[PlanStore] Loaded ${summary.length} day rewards`);
    } catch (error) {
      console.error('[PlanStore] Failed to load day rewards summary:', error);
    } finally {
      planStore$.dayRewardsLoading.set(false);
    }
  },

  /**
   * Load user stats from Supabase
   */
  loadUserStats: async (sessionId: string, userId: string) => {
    planStore$.userStatsLoading.set(true);
    try {
      const { fetchUserStats } = await import('../services/planService');
      const stats = await fetchUserStats(sessionId, userId);

      planStore$.userStats.set(stats);

      // Cache to local storage
      if (stats) {
        await planStore$.saveUserStatsToStorage(sessionId);
      }

      console.log('[PlanStore] Loaded user stats:', stats?.total_points ?? 0, 'points');
    } catch (error) {
      console.error('[PlanStore] Failed to load user stats:', error);
    } finally {
      planStore$.userStatsLoading.set(false);
    }
  },

  /**
   * Load all rewards data for a session (summary + stats)
   */
  loadRewardsForSession: async (sessionId: string, userId: string) => {
    // First try to load from cache
    await Promise.all([
      planStore$.loadDayRewardsSummaryFromStorage(sessionId),
      planStore$.loadUserStatsFromStorage(sessionId),
    ]);

    // Then refresh from Supabase
    await Promise.all([
      planStore$.loadDayRewardsSummary(sessionId, userId),
      planStore$.loadUserStats(sessionId, userId),
    ]);
  },

  /**
   * Clear rewards state when leaving session
   */
  clearRewardsState: () => {
    planStore$.dayRewardsSummary.set([]);
    planStore$.userStats.set(null);
    planStore$.dayRewardsLoading.set(false);
    planStore$.userStatsLoading.set(false);
  },

  // ============================================================================
  // COMMENTS ACTIONS (follows devotionStore$ patterns)
  // ============================================================================

  /**
   * Set the selected day number
   * Comments are stored by day in commentsByDay, so no clearing is needed
   */
  setSelectedDay: (dayNumber: number): void => {
    planStore$.selectedDayNumber.set(dayNumber);
    // Reset pagination for new day (comments stay in their day bucket)
    planStore$.commentsPage.set(0);
    planStore$.commentsHasMore.set(true);
    // Check if we already have comments for this day
    const dayComments = planStore$.commentsByDay.peek()[dayNumber];
    planStore$.commentsInitialized.set(dayComments && dayComments.length > 0);
  },

  addComment: (comment: SessionCommentWithUser) => {
    // Comments are stored by day_number
    const dayNumber = comment.day_number ?? planStore$.selectedDayNumber.peek();
    const commentsByDay = planStore$.commentsByDay.get();
    const dayComments = commentsByDay[dayNumber] || [];

    // Check for duplicates in top-level comments
    if (dayComments.find((c: SessionCommentWithUser) => c.id === comment.id)) return;

    // Check for duplicates in replies (if it's a reply)
    if (comment.parent_comment_id) {
      const parent = dayComments.find((c: SessionCommentWithUser) => c.id === comment.parent_comment_id);
      if (parent?.replies?.find((r: SessionCommentWithUser) => r.id === comment.id)) return;

      // It's a reply - add to parent's replies with optimistic reply_count update
      const updated = dayComments.map((c: SessionCommentWithUser) => {
        if (c.id === comment.parent_comment_id) {
          return {
            ...c,
            replies: [...(c.replies || []), comment],
            reply_count: (c.reply_count || 0) + 1,
          };
        }
        return c;
      });
      planStore$.commentsByDay.set({ ...commentsByDay, [dayNumber]: updated });
    } else {
      // Top-level comment
      planStore$.commentsByDay.set({ ...commentsByDay, [dayNumber]: [comment, ...dayComments] });
    }
  },

  updateComment: (updatedComment: SessionComment) => {
    const dayNumber = updatedComment.day_number ?? planStore$.selectedDayNumber.peek();
    const commentsByDay = planStore$.commentsByDay.get();
    const dayComments = commentsByDay[dayNumber] || [];

    const updated = dayComments.map((c: SessionCommentWithUser) => {
      if (c.id === updatedComment.id) {
        return { ...c, ...updatedComment };
      }
      if (c.replies) {
        const updatedReplies = c.replies.map((r: SessionCommentWithUser) =>
          r.id === updatedComment.id ? { ...r, ...updatedComment } : r
        );
        return { ...c, replies: updatedReplies };
      }
      return c;
    });
    planStore$.commentsByDay.set({ ...commentsByDay, [dayNumber]: updated });
  },

  removeComment: (commentId: string, dayNumber?: number) => {
    const targetDay = dayNumber ?? planStore$.selectedDayNumber.peek();
    const commentsByDay = planStore$.commentsByDay.get();
    const dayComments = commentsByDay[targetDay] || [];

    const isTopLevel = dayComments.find((c: SessionCommentWithUser) => c.id === commentId);

    if (isTopLevel) {
      planStore$.commentsByDay.set({
        ...commentsByDay,
        [targetDay]: dayComments.filter((c: SessionCommentWithUser) => c.id !== commentId),
      });
    } else {
      const updated = dayComments.map((c: SessionCommentWithUser) => {
        if (c.replies) {
          return { ...c, replies: c.replies.filter((r: SessionCommentWithUser) => r.id !== commentId) };
        }
        return c;
      });
      planStore$.commentsByDay.set({ ...commentsByDay, [targetDay]: updated });
    }
  },

  softDeleteComment: (commentId: string, dayNumber?: number) => {
    const targetDay = dayNumber ?? planStore$.selectedDayNumber.peek();
    const commentsByDay = planStore$.commentsByDay.get();
    const dayComments = commentsByDay[targetDay] || [];

    const updated = dayComments.map((c: SessionCommentWithUser) => {
      if (c.id === commentId) {
        return { ...c, status: 'inactive' as const };
      }
      if (c.replies) {
        const updatedReplies = c.replies.map((r: SessionCommentWithUser) =>
          r.id === commentId ? { ...r, status: 'inactive' as const } : r
        );
        return { ...c, replies: updatedReplies };
      }
      return c;
    });
    planStore$.commentsByDay.set({ ...commentsByDay, [targetDay]: updated });
  },

  restoreComment: (commentId: string, dayNumber?: number) => {
    const targetDay = dayNumber ?? planStore$.selectedDayNumber.peek();
    const commentsByDay = planStore$.commentsByDay.get();
    const dayComments = commentsByDay[targetDay] || [];

    const updated = dayComments.map((c: SessionCommentWithUser) => {
      if (c.id === commentId) {
        return { ...c, status: 'active' as const };
      }
      if (c.replies) {
        const updatedReplies = c.replies.map((r: SessionCommentWithUser) =>
          r.id === commentId ? { ...r, status: 'active' as const } : r
        );
        return { ...c, replies: updatedReplies };
      }
      return c;
    });
    planStore$.commentsByDay.set({ ...commentsByDay, [targetDay]: updated });
  },

  // ============================================================================
  // LIKES MANAGEMENT
  // ============================================================================

  pendingLikeOperations: new Set<string>(),

  toggleLike: async (commentId: string, userId?: string) => {
    const pendingOps = planStore$.pendingLikeOperations;
    if (pendingOps.has(commentId)) return;

    const likedIds = planStore$.userLikedCommentIds.get();
    const isCurrentlyLiked = likedIds.includes(commentId);

    // Optimistic update
    if (isCurrentlyLiked) {
      planStore$.userLikedCommentIds.set(likedIds.filter((id: string) => id !== commentId));
      planStore$.updateCommentLikeCount(commentId, -1);
    } else {
      planStore$.userLikedCommentIds.set([...likedIds, commentId]);
      planStore$.updateCommentLikeCount(commentId, 1);
    }

    planStore$.saveLikedCommentsToStorage();

    if (!userId) return;

    // Sync with Supabase
    pendingOps.add(commentId);
    try {
      const { toggleSessionCommentLike } = await import('../services/planService');
      const success = await toggleSessionCommentLike(commentId, userId, isCurrentlyLiked);

      if (!success) {
        // Rollback
        if (isCurrentlyLiked) {
          planStore$.userLikedCommentIds.set([...planStore$.userLikedCommentIds.get(), commentId]);
          planStore$.updateCommentLikeCount(commentId, 1);
        } else {
          planStore$.userLikedCommentIds.set(
            planStore$.userLikedCommentIds.get().filter((id: string) => id !== commentId)
          );
          planStore$.updateCommentLikeCount(commentId, -1);
        }
        planStore$.saveLikedCommentsToStorage();
      }
    } catch (error) {
      console.error('[PlanStore] Error syncing like:', error);
      // Rollback on error
      if (isCurrentlyLiked) {
        planStore$.userLikedCommentIds.set([...planStore$.userLikedCommentIds.get(), commentId]);
        planStore$.updateCommentLikeCount(commentId, 1);
      } else {
        planStore$.userLikedCommentIds.set(
          planStore$.userLikedCommentIds.get().filter((id: string) => id !== commentId)
        );
        planStore$.updateCommentLikeCount(commentId, -1);
      }
      planStore$.saveLikedCommentsToStorage();
    } finally {
      pendingOps.delete(commentId);
    }
  },

  updateCommentLikeCount: (commentId: string, delta: number, dayNumber?: number) => {
    const commentsByDay = planStore$.commentsByDay.get();

    // If dayNumber is provided, update only that day's comments
    // Otherwise, update the selected day (most common case for UI interactions)
    const targetDay = dayNumber ?? planStore$.selectedDayNumber.peek();
    const dayComments = commentsByDay[targetDay] || [];

    const updated = dayComments.map((c: SessionCommentWithUser) => {
      if (c.id === commentId) {
        return { ...c, like_count: Math.max(0, (c.like_count || 0) + delta) };
      }
      if (c.replies) {
        return {
          ...c,
          replies: c.replies.map((r: SessionCommentWithUser) =>
            r.id === commentId
              ? { ...r, like_count: Math.max(0, (r.like_count || 0) + delta) }
              : r
          ),
        };
      }
      return c;
    });
    planStore$.commentsByDay.set({ ...commentsByDay, [targetDay]: updated });
  },

  isCommentLiked: (commentId: string): boolean => {
    return planStore$.userLikedCommentIds.get().includes(commentId);
  },

  // ============================================================================
  // UI STATE ACTIONS
  // ============================================================================

  setSessionUIMode: (mode: SessionUIMode) => {
    const currentMode = planStore$.sessionUIMode.get();
    const stack = planStore$.sessionModeStack.get();

    // Only update if different from current mode
    if (mode !== currentMode) {
      // If going back to reading, reset stack
      if (mode === 'reading') {
        planStore$.sessionModeStack.set(['reading']);
      } else {
        // Push new mode onto stack
        planStore$.sessionModeStack.set([...stack, mode]);
      }
      planStore$.sessionUIMode.set(mode);
    }
  },

  /**
   * Open thread view for a comment (matches devotionStore$ pattern)
   */
  openThread: (commentId: string) => {
    const currentMode = planStore$.sessionUIMode.get();
    const stack = planStore$.sessionModeStack.get();

    // Push 'thread' onto navigation stack if not already in thread mode
    if (currentMode !== 'thread') {
      planStore$.sessionModeStack.set([...stack, 'thread']);
    }

    planStore$.activeThreadCommentId.set(commentId);
    planStore$.sessionUIMode.set('thread');
  },

  /**
   * Close thread view, return to previous mode
   */
  closeThread: () => {
    planStore$.activeThreadCommentId.set(null);
    planStore$.goBack();
  },

  /**
   * Navigate back in the mode stack (like browser back)
   * Returns true if handled, false if at root
   */
  goBack: (): boolean => {
    const stack = planStore$.sessionModeStack.get();

    // If only one mode in stack (root), can't go back
    if (stack.length <= 1) {
      return false;
    }

    // Pop current mode and go to previous
    const newStack = stack.slice(0, -1);
    const previousMode = newStack[newStack.length - 1];

    planStore$.sessionModeStack.set(newStack);
    planStore$.sessionUIMode.set(previousMode);

    // Clear thread state if leaving thread mode
    if (previousMode !== 'thread') {
      planStore$.activeThreadCommentId.set(null);
    }

    return true;
  },

  /**
   * Set replies for a specific comment (used by thread view)
   */
  setRepliesForComment: (commentId: string, replies: SessionCommentWithUser[], dayNumber?: number) => {
    const targetDay = dayNumber ?? planStore$.selectedDayNumber.peek();
    const commentsByDay = planStore$.commentsByDay.get();
    const dayComments = commentsByDay[targetDay] || [];

    const updated = dayComments.map((c: SessionCommentWithUser) =>
      c.id === commentId ? { ...c, replies } : c
    );
    planStore$.commentsByDay.set({ ...commentsByDay, [targetDay]: updated });
  },

  setPendingInviteCode: (code: string | null) => {
    planStore$.pendingInviteCode.set(code);
  },

  // ============================================================================
  // PLAN REMINDER ACTIONS
  // ============================================================================

  setReminderEnabled: (enabled: boolean) => {
    planStore$.planReminderPreferences.reminderEnabled.set(enabled);
    planStore$.savePlanReminderPreferencesToStorage();
  },

  setReminderTime: (hour: number, minute: number) => {
    const prefs = planStore$.planReminderPreferences.get();
    planStore$.planReminderPreferences.set({
      ...prefs,
      reminderHour: hour,
      reminderMinute: minute,
    });
    planStore$.savePlanReminderPreferencesToStorage();
  },

  dismissReminderBanner: () => {
    planStore$.planReminderPreferences.reminderDismissed.set(true);
    planStore$.savePlanReminderPreferencesToStorage();
  },

  resetReminderDismissed: () => {
    planStore$.planReminderPreferences.reminderDismissed.set(false);
    planStore$.savePlanReminderPreferencesToStorage();
  },

  // ============================================================================
  // PERSISTENCE
  // ============================================================================

  saveSessionsToStorage: async () => {
    try {
      const sessions = planStore$.mySessions.get();
      await AsyncStorage.setItem(STORAGE_KEYS.PLAN_SESSIONS, JSON.stringify(sessions));
    } catch (error) {
      console.error('[PlanStore] Failed to save sessions:', error);
    }
  },

  loadSessionsFromStorage: async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.PLAN_SESSIONS);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Validate it's an array before setting
        if (Array.isArray(parsed)) {
          // Filter out inactive (deleted) sessions
          const activeSessions = parsed.filter(
            (s: PlanSession) => s.status !== 'inactive'
          );
          planStore$.mySessions.set(activeSessions);
        } else {
          console.warn('[PlanStore] Invalid sessions data, clearing...');
          await AsyncStorage.removeItem(STORAGE_KEYS.PLAN_SESSIONS);
        }
      }
    } catch (error) {
      console.error('[PlanStore] Failed to load sessions, clearing corrupted data:', error);
      await AsyncStorage.removeItem(STORAGE_KEYS.PLAN_SESSIONS);
    }
  },

  saveActiveSessionToStorage: async () => {
    try {
      const activeId = planStore$.activeSessionId.get();
      if (activeId) {
        await AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_SESSION, activeId);
      } else {
        await AsyncStorage.removeItem(STORAGE_KEYS.ACTIVE_SESSION);
      }
    } catch (error) {
      console.error('[PlanStore] Failed to save active session:', error);
    }
  },

  loadActiveSessionFromStorage: async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.ACTIVE_SESSION);
      if (stored) {
        planStore$.activeSessionId.set(stored);
      }
    } catch (error) {
      console.error('[PlanStore] Failed to load active session:', error);
    }
  },

  saveLikedCommentsToStorage: async () => {
    try {
      const likedIds = planStore$.userLikedCommentIds.get();
      await AsyncStorage.setItem(STORAGE_KEYS.LIKED_COMMENTS, JSON.stringify(likedIds));
    } catch (error) {
      console.error('[PlanStore] Failed to save liked comments:', error);
    }
  },

  loadLikedCommentsFromStorage: async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.LIKED_COMMENTS);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          planStore$.userLikedCommentIds.set(parsed);
        } else {
          await AsyncStorage.removeItem(STORAGE_KEYS.LIKED_COMMENTS);
        }
      }
    } catch (error) {
      console.error('[PlanStore] Failed to load liked comments, clearing:', error);
      await AsyncStorage.removeItem(STORAGE_KEYS.LIKED_COMMENTS);
    }
  },

  // ============================================================================
  // SHARED SESSIONS PERSISTENCE
  // ============================================================================

  saveSharedSessionsToStorage: async () => {
    try {
      const sessions = planStore$.sharedSessions.get();
      await AsyncStorage.setItem(STORAGE_KEYS.SHARED_SESSIONS, JSON.stringify(sessions));
    } catch (error) {
      console.error('[PlanStore] Failed to save shared sessions:', error);
    }
  },

  loadSharedSessionsFromStorage: async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.SHARED_SESSIONS);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          // Filter out inactive (deleted) sessions
          const activeSessions = parsed.filter(
            (s: SharedSessionWithDetails) => s.status !== 'inactive'
          );
          planStore$.sharedSessions.set(activeSessions);
        } else {
          await AsyncStorage.removeItem(STORAGE_KEYS.SHARED_SESSIONS);
        }
      }
    } catch (error) {
      console.error('[PlanStore] Failed to load shared sessions, clearing:', error);
      await AsyncStorage.removeItem(STORAGE_KEYS.SHARED_SESSIONS);
    }
  },

  saveActiveSharedSessionToStorage: async () => {
    try {
      const activeId = planStore$.activeSharedSessionId.get();
      if (activeId) {
        await AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_SHARED_SESSION, activeId);
      } else {
        await AsyncStorage.removeItem(STORAGE_KEYS.ACTIVE_SHARED_SESSION);
      }
    } catch (error) {
      console.error('[PlanStore] Failed to save active shared session:', error);
    }
  },

  loadActiveSharedSessionFromStorage: async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.ACTIVE_SHARED_SESSION);
      if (stored) {
        planStore$.activeSharedSessionId.set(stored);
      }
    } catch (error) {
      console.error('[PlanStore] Failed to load active shared session:', error);
    }
  },

  // Session comments caching (keyed by session + day)
  saveSessionCommentsToStorage: async (sessionId: string, dayNumber: number) => {
    try {
      const commentsByDay = planStore$.commentsByDay.get();
      const dayComments = commentsByDay[dayNumber] || [];

      // Build replies map from comments that have loaded replies
      const repliesMap: Record<string, SessionCommentWithUser[]> = {};
      dayComments.forEach((c: SessionCommentWithUser) => {
        if (c.replies && c.replies.length > 0) {
          repliesMap[c.id] = c.replies.slice(0, 20); // Cache up to 20 replies per comment
        }
      });

      const cache: SessionCommentsCache = {
        comments: dayComments.slice(0, 40), // Cache first 40
        likedIds: planStore$.userLikedCommentIds.get(),
        lastFetched: Date.now(),
        repliesMap, // NEW: Store replies for offline access
      };
      const key = `${STORAGE_KEYS.SESSION_COMMENTS_PREFIX}${sessionId}_${dayNumber}`;
      await AsyncStorage.setItem(key, JSON.stringify(cache));
      console.log(`[PlanStore] Saved ${cache.comments.length} comments + ${Object.keys(repliesMap).length} reply threads for day ${dayNumber}`);
    } catch (error) {
      console.error('[PlanStore] Failed to save session comments cache:', error);
    }
  },

  loadSessionCommentsFromStorage: async (sessionId: string, dayNumber: number): Promise<SessionCommentsCache | null> => {
    try {
      const key = `${STORAGE_KEYS.SESSION_COMMENTS_PREFIX}${sessionId}_${dayNumber}`;
      const stored = await AsyncStorage.getItem(key);
      if (stored) {
        const cache = JSON.parse(stored) as SessionCommentsCache;

        // Restore replies from repliesMap to comments
        if (cache.repliesMap) {
          cache.comments = cache.comments.map((c: SessionCommentWithUser) => ({
            ...c,
            replies: cache.repliesMap?.[c.id] || c.replies || [],
          }));
        }

        return cache;
      }
    } catch (error) {
      console.error('[PlanStore] Failed to load session comments cache:', error);
    }
    return null;
  },

  setSharedSessions: (sessions: SharedSessionWithDetails[]) => {
    planStore$.sharedSessions.set(sessions);
    planStore$.saveSharedSessionsToStorage();
  },

  // ============================================================================
  // GAMIFICATION PERSISTENCE
  // ============================================================================

  saveCompletedDaysToStorage: async () => {
    try {
      const completedDays = planStore$.completedDays.get();
      await AsyncStorage.setItem(STORAGE_KEYS.COMPLETED_DAYS, JSON.stringify(completedDays));
    } catch (error) {
      console.error('[PlanStore] Failed to save completed days:', error);
    }
  },

  loadCompletedDaysFromStorage: async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.COMPLETED_DAYS);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (typeof parsed === 'object' && parsed !== null) {
          planStore$.completedDays.set(parsed);
        } else {
          await AsyncStorage.removeItem(STORAGE_KEYS.COMPLETED_DAYS);
        }
      }
    } catch (error) {
      console.error('[PlanStore] Failed to load completed days, clearing:', error);
      await AsyncStorage.removeItem(STORAGE_KEYS.COMPLETED_DAYS);
    }
  },

  saveCommentTrophiesToStorage: async () => {
    try {
      const trophies = planStore$.commentTrophies.get();
      await AsyncStorage.setItem(STORAGE_KEYS.COMMENT_TROPHIES, JSON.stringify(trophies));
    } catch (error) {
      console.error('[PlanStore] Failed to save comment trophies:', error);
    }
  },

  loadCommentTrophiesFromStorage: async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.COMMENT_TROPHIES);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (typeof parsed === 'object' && parsed !== null) {
          planStore$.commentTrophies.set(parsed);
        } else {
          await AsyncStorage.removeItem(STORAGE_KEYS.COMMENT_TROPHIES);
        }
      }
    } catch (error) {
      console.error('[PlanStore] Failed to load comment trophies, clearing:', error);
      await AsyncStorage.removeItem(STORAGE_KEYS.COMMENT_TROPHIES);
    }
  },

  // Day rewards summary persistence
  saveDayRewardsSummaryToStorage: async (sessionId: string) => {
    try {
      const summary = planStore$.dayRewardsSummary.get();
      const key = `${STORAGE_KEYS.DAY_REWARDS_PREFIX}${sessionId}`;
      await AsyncStorage.setItem(key, JSON.stringify(summary));
    } catch (error) {
      console.error('[PlanStore] Failed to save day rewards summary:', error);
    }
  },

  loadDayRewardsSummaryFromStorage: async (sessionId: string) => {
    try {
      const key = `${STORAGE_KEYS.DAY_REWARDS_PREFIX}${sessionId}`;
      const stored = await AsyncStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          planStore$.dayRewardsSummary.set(parsed);
        }
      }
    } catch (error) {
      console.error('[PlanStore] Failed to load day rewards summary:', error);
    }
  },

  // User stats persistence
  saveUserStatsToStorage: async (sessionId: string) => {
    try {
      const stats = planStore$.userStats.get();
      if (stats) {
        const key = `${STORAGE_KEYS.USER_STATS_PREFIX}${sessionId}`;
        await AsyncStorage.setItem(key, JSON.stringify(stats));
      }
    } catch (error) {
      console.error('[PlanStore] Failed to save user stats:', error);
    }
  },

  loadUserStatsFromStorage: async (sessionId: string) => {
    try {
      const key = `${STORAGE_KEYS.USER_STATS_PREFIX}${sessionId}`;
      const stored = await AsyncStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === 'object') {
          planStore$.userStats.set(parsed);
        }
      }
    } catch (error) {
      console.error('[PlanStore] Failed to load user stats:', error);
    }
  },

  // Plan reminder preferences persistence
  savePlanReminderPreferencesToStorage: async () => {
    try {
      const prefs = planStore$.planReminderPreferences.get();
      await AsyncStorage.setItem(STORAGE_KEYS.PLAN_REMINDER_PREFERENCES, JSON.stringify(prefs));
    } catch (error) {
      console.error('[PlanStore] Failed to save plan reminder preferences:', error);
    }
  },

  loadPlanReminderPreferencesFromStorage: async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.PLAN_REMINDER_PREFERENCES);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === 'object') {
          planStore$.planReminderPreferences.set({
            reminderEnabled: parsed.reminderEnabled ?? false,
            reminderHour: parsed.reminderHour ?? 8,
            reminderMinute: parsed.reminderMinute ?? 0,
            reminderDismissed: parsed.reminderDismissed ?? false,
          });
        }
      }
    } catch (error) {
      console.error('[PlanStore] Failed to load plan reminder preferences:', error);
    }
  },

  // Full initialization
  initialize: async () => {
    await Promise.all([
      planStore$.loadSessionsFromStorage(),
      planStore$.loadActiveSessionFromStorage(),
      planStore$.loadLikedCommentsFromStorage(),
      planStore$.loadSharedSessionsFromStorage(),
      planStore$.loadActiveSharedSessionFromStorage(),
      planStore$.loadCompletedDaysFromStorage(),
      planStore$.loadCommentTrophiesFromStorage(),
      planStore$.loadPlanReminderPreferencesFromStorage(),
    ]);
  },

  /**
   * Sync sessions from server
   * Fetches user's plan sessions from Supabase and reconciles with local state.
   * Server is authoritative - inactive sessions on server are removed locally.
   */
  syncSessionsFromServer: async (userId: string) => {
    if (!userId) return;

    try {
      const { fetchUserPlanSessions, fetchUserSharedSessionsWithDetails } = await import('../services/planService');

      // Fetch personal and shared sessions in parallel
      const [personalSessions, sharedSessions] = await Promise.all([
        fetchUserPlanSessions(userId),
        fetchUserSharedSessionsWithDetails(userId),
      ]);

      // Update mySessions with server data (server is authoritative)
      planStore$.mySessions.set(personalSessions);
      await planStore$.saveSessionsToStorage();

      // Update sharedSessions with server data (with enriched details)
      planStore$.sharedSessions.set(sharedSessions);
      await planStore$.saveSharedSessionsToStorage();

      console.log(`[PlanStore] Synced ${personalSessions.length} personal + ${sharedSessions.length} shared sessions from server`);
    } catch (error) {
      console.error('[PlanStore] Failed to sync sessions from server:', error);
    }
  },
});

// ============================================================================
// COMPUTED OBSERVABLES
// ============================================================================

/**
 * Active sessions only (status = 'active' or 'paused')
 */
export const activeSessions$ = computed(() =>
  planStore$.mySessions.get().filter(
    (s: PlanSession) => s.status === 'active' || s.status === 'paused'
  )
);

/**
 * Completed sessions
 */
export const completedSessions$ = computed(() =>
  planStore$.mySessions.get().filter((s: PlanSession) => s.status === 'completed')
);

/**
 * Active shared sessions
 */
export const activeSharedSessions$ = computed(() =>
  planStore$.sharedSessions.get().filter((s: SharedSessionWithDetails) => s.status === 'active')
);

/**
 * Active comments for the currently selected day
 * Reads from commentsByDay[selectedDayNumber]
 */
export const activeSessionComments$ = computed(() => {
  const dayNumber = planStore$.selectedDayNumber.get();
  const commentsByDay = planStore$.commentsByDay.get();
  const dayComments = commentsByDay[dayNumber] || [];
  return dayComments.filter((c: SessionCommentWithUser) => c.status === 'active');
});

/**
 * Current active session details
 * Checks both mySessions (personal) and sharedSessions (joined)
 */
export const currentSession$ = computed(() => {
  const activeId = planStore$.activeSessionId.get();
  if (!activeId) return null;

  // First check mySessions (personal sessions) - only active/paused sessions
  const mySession = planStore$.mySessions.get().find(
    (s: PlanSession) => s.id === activeId && (s.status === 'active' || s.status === 'paused')
  );
  if (mySession) return mySession;

  // Then check sharedSessions (sessions user joined) - only active sessions
  return planStore$.sharedSessions.get().find(
    (s: PlanSession) => s.id === activeId && s.status === 'active'
  ) || null;
});

/**
 * Active participants count
 */
export const activeParticipantsCount$ = computed(() =>
  planStore$.participants.get().filter((p: ParticipantWithProfile) => p.status === 'active').length
);

/**
 * Filtered plans based on search query
 */
export const filteredPlans$ = computed(() => {
  const query = planStore$.searchQuery.get().toLowerCase();
  const plans = planStore$.availablePlans.get();

  if (!query) return plans;

  return plans.filter((p: BiblePlan) =>
    p.name.toLowerCase().includes(query) ||
    (p.description && p.description.toLowerCase().includes(query))
  );
});

/**
 * Thread parent comment (for thread view)
 */
export const threadParentComment$ = computed(() => {
  const activeId = planStore$.activeThreadCommentId.get();
  if (!activeId) return null;

  const dayNumber = planStore$.selectedDayNumber.get();
  const commentsByDay = planStore$.commentsByDay.get();
  const dayComments = commentsByDay[dayNumber] || [];

  return dayComments.find(
    (c: SessionCommentWithUser) => c.id === activeId
  ) || null;
});

/**
 * Thread replies (active replies for thread parent)
 */
export const threadReplies$ = computed(() => {
  const parent = threadParentComment$.get();
  if (!parent || !parent.replies) return [];

  return parent.replies.filter(
    (r: SessionCommentWithUser) => r.status === 'active'
  );
});

/**
 * Get the furthest progress session (highest current_day among active sessions)
 * Used for plan reminder notifications to show the most relevant reading
 */
export const furthestProgressSession$ = computed(() => {
  const mySessions = planStore$.mySessions.get();
  const sharedSessions = planStore$.sharedSessions.get();

  // Combine all active sessions
  const allActiveSessions = [
    ...mySessions.filter((s: PlanSession) => s.status === 'active'),
    ...sharedSessions.filter((s: SharedSessionWithDetails) => s.status === 'active'),
  ];

  if (allActiveSessions.length === 0) return null;

  // Find the session with the highest current_day
  return allActiveSessions.reduce(
    (furthest: PlanSession | null, current: PlanSession) => {
      if (!furthest) return current;
      return (current.current_day || 1) > (furthest.current_day || 1) ? current : furthest;
    },
    null
  );
});

/**
 * Plan reminder preferences observable
 */
export const planReminderPreferences$ = computed(() =>
  planStore$.planReminderPreferences.get()
);
