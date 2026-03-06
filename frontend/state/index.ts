/**
 * State Store Index - Re-export all stores
 * Organized by feature for better maintainability
 */

// Feature-based stores
export { tabStore$ } from './tabStore';
export { notesStore$, activeNotes$, activeBookmarks$, activeHighlights$ } from './notesStore';
export { bibleDataStore$ } from './bibleDataStore';
export { navigationStore$ } from './navigationStore';
export { appStateStore$ } from './appStateStore';
export {
  devotionStore$,
  activeComments$,
  totalCommentCount$,
  isToday$,
  formattedDate$,
  markDevotionComplete,
} from './devotionStore';
export { libraryStore$ } from './libraryStore';
export type { CommentWithQuestion, LibrarySegment } from './libraryStore';

// Bible Plans feature
export {
  planStore$,
  activeSessions$,
  completedSessions$,
  activeSharedSessions$,
  activeSessionComments$,
  currentSession$,
  activeParticipantsCount$,
  filteredPlans$,
  threadParentComment$,
  threadReplies$,
  furthestProgressSession$,
  planReminderPreferences$,
} from './planStore';
export type {
  ParticipantWithProfile,
  SessionCommentWithUser,
  PlansSegment,
  SessionUIMode,
} from './planStore';

// User profile cache for comment authors
export { userProfileCache$ } from './userProfileCache';
export type { CachedProfile } from './userProfileCache';

// Plan Study Mode (separate from main studyModeStore)
export { planStudyModeStore$ } from './planStudyModeStore';
export type { PlanStudyModeType, PlanStudyModeState } from './planStudyModeStore';

// Gamification (local-first XP/rewards with realtime sync)
export {
  gamificationStore$,
  // Computed values (local-first source of truth)
  totalXP$,
  currentLevel$,
  hasPendingRewards$,
  dailyActivityStatus$,
  completedActivitiesCount$,
  TOTAL_DAILY_ACTIVITIES,
  allStreaks$,
  getStreak$,
  // Initialization and sync
  initializeGamificationStore,
  performBatchSync,
  clearAllCaches as clearGamificationCaches,
  // Activity recording
  awardXPLocally,
  queueRewardSync,
  recordActivity,
  hasActivityToday,
  getStreakInfo,
  resetTodayIfNewDay,
  // Plan completion tracking
  trackPlanDayCompletion,
  hasPlanDayCompletedToday,
  getPlanDaysCompletedToday,
  trackPlanCompletion,
  hasPlanCompletedToday,
  getPlansCompletedToday,
  // Test functions (DEV only)
  testResetAllActivities,
  testSetActivities,
  testResetStreaks,
  testSetStreak,
} from './gamificationStore';
export type {
  LocalReward,
  PendingActivity,
  TodayActivity,
  GamificationState,
  StreakActivityType,
  ActivityStreak,
} from './gamificationStore';

// Legacy unified store (for backwards compatibility during migration)
export { bibleStore$, authStore$ } from './bibleStore';

// Types
export type {
  TabState,
  NavigationLocation,
  UnifiedAuthState,
  BookData,
  ChapterData,
  SectionData,
  ParagraphData,
  VerseLineData,
  VerseLineJSON,
  ParagraphJSON,
  SectionJSON,
  ChapterJSON,
  BookJSON,
  BibleDataJSON,
  BibleData
} from '../types/stores';

export type {
  BookmarkData,
  NoteData,
  AIContextData,
  CrossReferenceData,
  UserProfileData,
  ReadingSessionData,
  SearchHistoryData
} from './notesStore';

export type {
  ApologeticsQuestion,
  ApologeticsCategory,
  ApologeticsData,
  CommentWithUser,
  ApologeticsCommentWithUser, // Backwards compat alias
  VerseReference,
  DevotionPreferences,
  DevotionCache,
} from './devotionStore';

/**
 * Generic helper to filter entities by status='active'
 * Works with any entity type that has an optional status field
 */
export const filterActive = <T extends { status?: string }>(items: T[]): T[] =>
  items.filter(item => !item.status || item.status === 'active');
