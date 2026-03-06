/**
 * Devotion Store - Daily Apologetics Challenge state management
 * Handles: questions, comments, likes, preferences, caching
 * Uses status field for soft delete (active/inactive)
 */

import { observable, computed } from "@legendapp/state";
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Comment, CommentLike, RewardType } from "../types/database";

// Types for bundled apologetics questions
export interface VerseReference {
  reference: string;      // e.g., "Romans 1:20"
  bookNumber: number;     // 1-66
  chapter: number;
  verseStart: number;
  verseEnd: number | null;
  type?: 'context' | 'response'; // Optional: for grouping passages in UI
}

export interface ApologeticsQuestion {
  id: string;             // GUID for comment references
  orderIndex: number;     // 0-104 for calendar cycling
  categoryId: string;
  categoryName: string;
  questionText: string;
  verseReferences: VerseReference[];
}

export interface ApologeticsCategory {
  id: string;
  name: string;
  questionCount: number;
}

// Holiday types for special override questions
export type HolidayType = 'christmas-eve' | 'christmas-day' | 'good-friday' | 'easter-saturday' | 'easter-sunday' | 'easter-monday';

// Holiday question has same structure as regular question but without orderIndex
export interface HolidayQuestion {
  id: string;
  categoryId: string;
  categoryName: string;
  questionText: string;
  verseReferences: VerseReference[];
}

export interface ApologeticsData {
  metadata: {
    version: string;
    generatedAt: string;
    totalQuestions: number;
    totalCategories: number;
    cycleStartDate: string;
    description: string;
  };
  categories: ApologeticsCategory[];
  questions: ApologeticsQuestion[];
  holidayOverrides?: Record<HolidayType, HolidayQuestion>;
}

// Comment type for UI (user profiles are looked up from userProfileCache$ separately)
export interface CommentWithUser extends Comment {
  replies?: CommentWithUser[];
}

// Keep alias for backwards compatibility during migration
export type ApologeticsCommentWithUser = CommentWithUser;

// Notification preferences
export interface DevotionPreferences {
  notificationEnabled: boolean;
  notificationHour: number;        // 0-23, default 8
  notificationMinute: number;      // 0-59, default 0
  notificationOpenHistory: string[]; // Times user opened from notification (for adaptive timing)
}

// Cache structure for offline support
export interface DevotionCache {
  questionId: string;             // Primary validation key (GUID)
  questionDate: string;           // YYYY-MM-DD
  comments: ApologeticsCommentWithUser[];
  userLikedCommentIds: string[];
  lastFetched: number;            // Timestamp
}

const STORAGE_KEYS = {
  PREFERENCES: 'devotion_preferences',
  CACHE: 'devotion_cache',
  LIKED_COMMENTS: 'devotion_liked_comments',
};

const DEFAULT_PREFERENCES: DevotionPreferences = {
  notificationEnabled: true,
  notificationHour: 8,
  notificationMinute: 0,
  notificationOpenHistory: [],
};

// Use Dec 1, 2025 as cycle start for testing
const CYCLE_START_DATE = '2025-12-01';
const TOTAL_QUESTIONS = 105;

/**
 * Get local date string in YYYY-MM-DD format (avoiding UTC conversion issues)
 */
function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parse a YYYY-MM-DD string into a local Date object at midnight
 */
function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

/**
 * Calculate days difference between two local date strings
 */
function daysDifference(dateStr1: string, dateStr2: string): number {
  const date1 = parseLocalDate(dateStr1);
  const date2 = parseLocalDate(dateStr2);
  const diffMs = date1.getTime() - date2.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

export const devotionStore$: any = observable({
  // Current question state
  selectedDate: getLocalDateString(), // YYYY-MM-DD format (local time)
  todaysQuestion: null as ApologeticsQuestion | null,
  questionsData: null as ApologeticsData | null,

  // UI state
  isQuestionExpanded: true,
  isCommentsLoading: false,
  isLoadingMore: false,
  commentsInitialized: false, // True after first load attempt completes

  // UI Mode: 'apologetics' (default) | 'comments' | 'thread'
  // - apologetics: Full question view + collapsed comments preview
  // - comments: Reduced question + full comments list
  // - thread: Reduced question + thread view with parent comment and replies
  // Note: Write mode removed - CommentInput handles its own focus/expansion internally
  uiMode: 'apologetics' as 'apologetics' | 'comments' | 'thread',
  activeThreadCommentId: null as string | null, // Parent comment in thread view

  // Navigation stack for back gesture support
  // Tracks mode history: e.g., ['apologetics', 'comments', 'thread']
  modeStack: ['apologetics'] as Array<'apologetics' | 'comments' | 'thread'>,

  // Comments state
  comments: [] as ApologeticsCommentWithUser[],
  commentsPage: 0,
  commentsHasMore: true,
  newCommentsCount: 0,  // For "X new comments" indicator when scrolled away
  serverCommentCount: 0, // Total count from backend (top-level comments only)

  // Likes state (for optimistic updates and offline)
  userLikedCommentIds: [] as string[],

  // Deep-link navigation state (for Library -> Devotion comment navigation)
  targetCommentId: null as string | null,      // Comment to scroll to
  targetCommentHighlight: false as boolean,    // Whether to show highlight animation

  // Preferences
  preferences: { ...DEFAULT_PREFERENCES } as DevotionPreferences,

  // Real-time subscription state
  realtimeChannel: null as any,

  // Completed devotion dates (Record of YYYY-MM-DD -> true for checkmark display)
  // Using Record instead of Set because Legend State doesn't handle Set properly
  completedDevotionDates: {} as Record<string, boolean>,

  // ==================== Question Logic ====================

  /**
   * Get question for a specific date using calendar-based cycling
   * @param dateStr - YYYY-MM-DD format (local time)
   */
  getQuestionForDate: (dateStr: string): ApologeticsQuestion | null => {
    const questions = devotionStore$.questionsData.get()?.questions;
    if (!questions || questions.length === 0) return null;

    // Calculate days since cycle start using local dates
    const daysDiff = daysDifference(dateStr, CYCLE_START_DATE);

    // Handle negative days (dates before cycle start) with proper modulo
    const orderIndex = ((daysDiff % TOTAL_QUESTIONS) + TOTAL_QUESTIONS) % TOTAL_QUESTIONS;

    return questions.find((q: ApologeticsQuestion) => q.orderIndex === orderIndex) || null;
  },

  /**
   * Get holiday type for a given date (if any)
   * Uses Anonymous Gregorian algorithm for Easter calculation
   * @param date - Date object to check
   * @returns Holiday type or null if not a holiday
   */
  getHolidayType: (date: Date): HolidayType | null => {
    const month = date.getMonth(); // 0-indexed
    const day = date.getDate();
    const year = date.getFullYear();

    // Christmas Eve (December 24)
    if (month === 11 && day === 24) return 'christmas-eve';
    // Christmas Day (December 25)
    if (month === 11 && day === 25) return 'christmas-day';

    // Calculate Easter Sunday using Anonymous Gregorian algorithm
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const easterMonth = Math.floor((h + l - 7 * m + 114) / 31) - 1; // 0-indexed
    const easterDay = ((h + l - 7 * m + 114) % 31) + 1;

    const easterSunday = new Date(year, easterMonth, easterDay);
    const easterTime = easterSunday.getTime();
    const dayInMs = 24 * 60 * 60 * 1000;

    // Good Friday (2 days before Easter)
    const goodFriday = new Date(easterTime - 2 * dayInMs);
    if (month === goodFriday.getMonth() && day === goodFriday.getDate()) return 'good-friday';

    // Easter Saturday/Holy Saturday (1 day before Easter)
    const easterSaturday = new Date(easterTime - 1 * dayInMs);
    if (month === easterSaturday.getMonth() && day === easterSaturday.getDate()) return 'easter-saturday';

    // Easter Sunday
    if (month === easterMonth && day === easterDay) return 'easter-sunday';

    // Easter Monday (1 day after Easter)
    const easterMonday = new Date(easterTime + 1 * dayInMs);
    if (month === easterMonday.getMonth() && day === easterMonday.getDate()) return 'easter-monday';

    return null;
  },

  /**
   * Get holiday override question for a date (if any)
   * @param date - Date object to check
   * @returns Holiday question or null if not a holiday
   */
  getHolidayQuestion: (date: Date): HolidayQuestion | null => {
    const holidayType = devotionStore$.getHolidayType(date);
    if (!holidayType) return null;

    const holidayOverrides = devotionStore$.questionsData.get()?.holidayOverrides;
    if (!holidayOverrides) return null;

    return holidayOverrides[holidayType] || null;
  },

  /**
   * Get the appropriate question for a date, checking holiday overrides first
   * This is the main method that should be used to get the question for display
   * @param dateStr - YYYY-MM-DD format (local time)
   * @returns ApologeticsQuestion (holiday questions get a dummy orderIndex of -1)
   */
  getDisplayQuestionForDate: (dateStr: string): ApologeticsQuestion | null => {
    const date = parseLocalDate(dateStr);

    // Check for holiday override first
    const holidayQuestion = devotionStore$.getHolidayQuestion(date);
    if (holidayQuestion) {
      // Convert HolidayQuestion to ApologeticsQuestion format with dummy orderIndex
      return {
        ...holidayQuestion,
        orderIndex: -1, // Holiday questions don't cycle, use -1 as marker
      };
    }

    // Fall back to regular apologetics question
    return devotionStore$.getQuestionForDate(dateStr);
  },

  /**
   * Update selected date and load corresponding question
   * Checks for holiday overrides first, then falls back to regular questions
   */
  setSelectedDate: (dateStr: string) => {
    devotionStore$.selectedDate.set(dateStr);
    // Use getDisplayQuestionForDate which checks holiday overrides first
    const question = devotionStore$.getDisplayQuestionForDate(dateStr);
    devotionStore$.todaysQuestion.set(question);
    // Note: Comments are NOT cleared here - initializeCommentsForQuestion()
    // handles clearing when online and restoring from cache when offline
  },

  /**
   * Navigate to previous day
   */
  goToPreviousDay: () => {
    const currentDateStr = devotionStore$.selectedDate.get();
    const currentDate = parseLocalDate(currentDateStr);
    currentDate.setDate(currentDate.getDate() - 1);
    devotionStore$.setSelectedDate(getLocalDateString(currentDate));
  },

  /**
   * Navigate to next day (cannot go beyond today)
   */
  goToNextDay: () => {
    const currentDateStr = devotionStore$.selectedDate.get();
    const todayStr = getLocalDateString();

    const currentDate = parseLocalDate(currentDateStr);
    currentDate.setDate(currentDate.getDate() + 1);
    const nextDateStr = getLocalDateString(currentDate);

    // Can only go forward if next day is <= today
    if (nextDateStr <= todayStr) {
      devotionStore$.setSelectedDate(nextDateStr);
    }
  },

  /**
   * Check if we can navigate to next day
   */
  canGoToNextDay: (): boolean => {
    const currentDateStr = devotionStore$.selectedDate.get();
    const todayStr = getLocalDateString();

    const currentDate = parseLocalDate(currentDateStr);
    currentDate.setDate(currentDate.getDate() + 1);
    const nextDateStr = getLocalDateString(currentDate);

    // Can go forward if next day is <= today
    return nextDateStr <= todayStr;
  },

  // ==================== Comments Management ====================

  /**
   * Add new comment to list (for real-time updates)
   */
  addComment: (comment: ApologeticsCommentWithUser) => {
    const comments = devotionStore$.comments.get();

    // Check for duplicates in top-level comments
    if (comments.find((c: ApologeticsCommentWithUser) => c.id === comment.id)) {
      return;
    }

    // Check for duplicates in replies (if it's a reply)
    if (comment.parent_comment_id) {
      const parent = comments.find((c: ApologeticsCommentWithUser) => c.id === comment.parent_comment_id);
      if (parent?.replies?.find((r: ApologeticsCommentWithUser) => r.id === comment.id)) return;

      // Find parent and add to its replies with optimistic reply_count update
      const updatedComments = comments.map((c: ApologeticsCommentWithUser) => {
        if (c.id === comment.parent_comment_id) {
          return {
            ...c,
            replies: [...(c.replies || []), comment],
            reply_count: (c.reply_count || 0) + 1,
          };
        }
        return c;
      });
      devotionStore$.comments.set(updatedComments);
    } else {
      // Top-level comment - add to beginning
      devotionStore$.comments.set([comment, ...comments]);
    }
  },

  /**
   * Update comment in place (for real-time like count updates, etc.)
   */
  updateComment: (updatedComment: Comment) => {
    const comments = devotionStore$.comments.get();

    const updatedComments = comments.map((c: ApologeticsCommentWithUser) => {
      if (c.id === updatedComment.id) {
        return { ...c, ...updatedComment };
      }
      // Check replies
      if (c.replies) {
        const updatedReplies = c.replies.map((r: ApologeticsCommentWithUser) =>
          r.id === updatedComment.id ? { ...r, ...updatedComment } : r
        );
        return { ...c, replies: updatedReplies };
      }
      return c;
    });

    devotionStore$.comments.set(updatedComments);
  },

  /**
   * Remove comment (for real-time deletions)
   */
  removeComment: (commentId: string) => {
    const comments = devotionStore$.comments.get();

    // Check if it's a top-level comment
    const isTopLevel = comments.find((c: ApologeticsCommentWithUser) => c.id === commentId);

    if (isTopLevel) {
      devotionStore$.comments.set(
        comments.filter((c: ApologeticsCommentWithUser) => c.id !== commentId)
      );
    } else {
      // It's a reply - remove from parent's replies array
      // Note: reply_count is updated by database trigger and comes via real-time update
      const updatedComments = comments.map((c: ApologeticsCommentWithUser) => {
        if (c.replies) {
          const filteredReplies = c.replies.filter((r: ApologeticsCommentWithUser) => r.id !== commentId);
          // Only update if this comment actually had the reply
          if (filteredReplies.length !== c.replies.length) {
            return {
              ...c,
              replies: filteredReplies,
            };
          }
        }
        return c;
      });
      devotionStore$.comments.set(updatedComments);
    }
  },

  /**
   * Soft delete a comment (set status to inactive, optimistic update)
   * Used for delete with undo functionality
   */
  softDeleteComment: (commentId: string) => {
    const comments = devotionStore$.comments.get();

    const updatedComments = comments.map((c: ApologeticsCommentWithUser) => {
      if (c.id === commentId) {
        return { ...c, status: 'inactive' as const };
      }
      // Check replies
      if (c.replies) {
        const updatedReplies = c.replies.map((r: ApologeticsCommentWithUser) =>
          r.id === commentId ? { ...r, status: 'inactive' as const } : r
        );
        // Update reply count if we're soft deleting a reply
        const hasDeletedReply = c.replies.some((r: ApologeticsCommentWithUser) => r.id === commentId);
        return {
          ...c,
          replies: updatedReplies,
          reply_count: hasDeletedReply ? Math.max(0, (c.reply_count || 0) - 1) : c.reply_count,
        };
      }
      return c;
    });

    devotionStore$.comments.set(updatedComments);
  },

  /**
   * Restore a soft-deleted comment (set status back to active)
   * Used for undo functionality
   */
  restoreComment: (commentId: string) => {
    const comments = devotionStore$.comments.get();

    const updatedComments = comments.map((c: ApologeticsCommentWithUser) => {
      if (c.id === commentId) {
        return { ...c, status: 'active' as const };
      }
      // Check replies
      if (c.replies) {
        const updatedReplies = c.replies.map((r: ApologeticsCommentWithUser) =>
          r.id === commentId ? { ...r, status: 'active' as const } : r
        );
        // Update reply count if we're restoring a reply
        const hasRestoredReply = c.replies.some((r: ApologeticsCommentWithUser) => r.id === commentId);
        return {
          ...c,
          replies: updatedReplies,
          reply_count: hasRestoredReply ? (c.reply_count || 0) + 1 : c.reply_count,
        };
      }
      return c;
    });

    devotionStore$.comments.set(updatedComments);
  },

  /**
   * Finalize comment deletion (sync soft delete to Supabase)
   * Called after undo timeout expires - just sets status to 'inactive' on server
   */
  finalizeDeleteComment: async (commentId: string) => {
    try {
      const { deleteComment } = await import('../services/apologeticsService');
      const success = await deleteComment(commentId);

      if (success) {
        // Remove from local state (server confirmed soft delete)
        devotionStore$.removeComment(commentId);
        console.log('[DevotionStore] Comment soft deleted on server:', commentId);
      } else {
        // Failed to sync - restore locally so user can try again
        console.error('[DevotionStore] Failed to sync comment deletion, restoring locally');
        devotionStore$.restoreComment(commentId);
      }
    } catch (error) {
      console.error('[DevotionStore] Error syncing comment deletion:', error);
      // Restore on error so user can try again
      devotionStore$.restoreComment(commentId);
    }
  },

  // ==================== Likes Management ====================

  /**
   * Pending like operations (for preventing duplicate requests)
   */
  pendingLikeOperations: new Set<string>(),

  /**
   * Toggle like on a comment (optimistic update + Supabase sync)
   * @param commentId - The comment to toggle like on
   * @param userId - The current user's ID (required for Supabase)
   */
  toggleLike: async (commentId: string, userId?: string) => {
    // Prevent duplicate operations on the same comment
    const pendingOps = devotionStore$.pendingLikeOperations;
    if (pendingOps.has(commentId)) {
      console.log('[DevotionStore] Like operation already in progress for:', commentId);
      return;
    }

    const likedIds = devotionStore$.userLikedCommentIds.get();
    const isCurrentlyLiked = likedIds.includes(commentId);

    // Optimistic update
    if (isCurrentlyLiked) {
      // Remove like optimistically
      devotionStore$.userLikedCommentIds.set(
        likedIds.filter((id: string) => id !== commentId)
      );
      devotionStore$.updateCommentLikeCount(commentId, -1);
    } else {
      // Add like optimistically
      devotionStore$.userLikedCommentIds.set([...likedIds, commentId]);
      devotionStore$.updateCommentLikeCount(commentId, 1);
    }

    // Persist to AsyncStorage immediately for offline support
    devotionStore$.saveLikedCommentsToStorage();

    // If no userId, we're offline - just keep local state
    if (!userId) {
      console.log('[DevotionStore] No userId, operating in offline mode');
      return;
    }

    // Sync with Supabase
    pendingOps.add(commentId);
    try {
      const { toggleLike: toggleLikeService } = await import('../services/apologeticsService');
      const success = await toggleLikeService(commentId, userId, isCurrentlyLiked);

      if (!success) {
        // Rollback on failure
        console.log('[DevotionStore] Like sync failed, rolling back');
        if (isCurrentlyLiked) {
          // Restore the like
          devotionStore$.userLikedCommentIds.set([...devotionStore$.userLikedCommentIds.get(), commentId]);
          devotionStore$.updateCommentLikeCount(commentId, 1);
        } else {
          // Remove the like
          devotionStore$.userLikedCommentIds.set(
            devotionStore$.userLikedCommentIds.get().filter((id: string) => id !== commentId)
          );
          devotionStore$.updateCommentLikeCount(commentId, -1);
        }
        devotionStore$.saveLikedCommentsToStorage();
      }
    } catch (error) {
      console.error('[DevotionStore] Error syncing like:', error);
      // Rollback on error
      if (isCurrentlyLiked) {
        devotionStore$.userLikedCommentIds.set([...devotionStore$.userLikedCommentIds.get(), commentId]);
        devotionStore$.updateCommentLikeCount(commentId, 1);
      } else {
        devotionStore$.userLikedCommentIds.set(
          devotionStore$.userLikedCommentIds.get().filter((id: string) => id !== commentId)
        );
        devotionStore$.updateCommentLikeCount(commentId, -1);
      }
      devotionStore$.saveLikedCommentsToStorage();
    } finally {
      pendingOps.delete(commentId);
    }
  },

  /**
   * Helper to update like count on a comment (used by toggleLike and real-time updates)
   */
  updateCommentLikeCount: (commentId: string, delta: number) => {
    const comments = devotionStore$.comments.get();
    const updatedComments = comments.map((c: ApologeticsCommentWithUser) => {
      if (c.id === commentId) {
        return { ...c, like_count: Math.max(0, (c.like_count || 0) + delta) };
      }
      if (c.replies) {
        return {
          ...c,
          replies: c.replies.map((r: ApologeticsCommentWithUser) =>
            r.id === commentId
              ? { ...r, like_count: Math.max(0, (r.like_count || 0) + delta) }
              : r
          ),
        };
      }
      return c;
    });
    devotionStore$.comments.set(updatedComments);
  },

  /**
   * Set the exact like count for a comment (used by real-time sync)
   */
  setCommentLikeCount: (commentId: string, likeCount: number) => {
    const comments = devotionStore$.comments.get();
    const updatedComments = comments.map((c: ApologeticsCommentWithUser) => {
      if (c.id === commentId) {
        return { ...c, like_count: likeCount };
      }
      if (c.replies) {
        return {
          ...c,
          replies: c.replies.map((r: ApologeticsCommentWithUser) =>
            r.id === commentId
              ? { ...r, like_count: likeCount }
              : r
          ),
        };
      }
      return c;
    });
    devotionStore$.comments.set(updatedComments);
  },

  /**
   * Handle real-time like event from another user
   * Updates the like count without changing current user's liked state
   */
  handleRemoteLikeChange: (commentId: string, isLikeAdded: boolean, likerUserId: string, currentUserId?: string) => {
    // Don't process our own like events (already handled optimistically)
    if (currentUserId && likerUserId === currentUserId) {
      return;
    }

    // Update like count based on the action
    devotionStore$.updateCommentLikeCount(commentId, isLikeAdded ? 1 : -1);
  },

  /**
   * Check if current user has liked a comment
   */
  isCommentLiked: (commentId: string): boolean => {
    return devotionStore$.userLikedCommentIds.get().includes(commentId);
  },

  // ==================== UI State ====================

  /**
   * Toggle question expansion (for sticky header)
   */
  toggleQuestionExpanded: () => {
    devotionStore$.isQuestionExpanded.set(!devotionStore$.isQuestionExpanded.get());
  },

  /**
   * Set question expanded state
   */
  setQuestionExpanded: (expanded: boolean) => {
    devotionStore$.isQuestionExpanded.set(expanded);
  },

  // ==================== UI Mode Management ====================

  /**
   * Set UI mode (apologetics, comments, thread)
   * Pushes new mode onto navigation stack for back gesture support
   * Note: Write mode removed - CommentInput handles its own focus/expansion internally
   */
  setUIMode: (mode: 'apologetics' | 'comments' | 'thread') => {
    const currentMode = devotionStore$.uiMode.get();
    const stack = devotionStore$.modeStack.get();

    // Only push if different from current mode
    if (mode !== currentMode) {
      // If going back to apologetics, reset stack
      if (mode === 'apologetics') {
        devotionStore$.modeStack.set(['apologetics']);
      } else {
        // Push new mode onto stack
        devotionStore$.modeStack.set([...stack, mode]);
      }
      devotionStore$.uiMode.set(mode);
    }

    // Clear thread state when leaving thread mode
    if (mode !== 'thread') {
      devotionStore$.activeThreadCommentId.set(null);
    }
  },

  /**
   * Open thread view for a specific comment
   * Pushes 'thread' onto navigation stack
   */
  openThread: (commentId: string) => {
    const stack = devotionStore$.modeStack.get();
    const currentMode = devotionStore$.uiMode.get();

    // Push thread mode onto stack if not already in thread mode
    if (currentMode !== 'thread') {
      devotionStore$.modeStack.set([...stack, 'thread']);
    }

    devotionStore$.activeThreadCommentId.set(commentId);
    devotionStore$.uiMode.set('thread');
  },

  /**
   * Close thread view and return to previous mode in stack
   */
  closeThread: () => {
    devotionStore$.activeThreadCommentId.set(null);
    // Use goBack to pop from stack instead of hardcoding 'comments'
    devotionStore$.goBack();
  },

  /**
   * Go back to previous mode in navigation stack
   * Returns true if navigation happened, false if already at root (apologetics)
   * Used by BackHandler for hardware back button support
   */
  goBack: (): boolean => {
    const stack = devotionStore$.modeStack.get();

    // Can't go back from apologetics (root)
    if (stack.length <= 1) {
      return false;
    }

    // Pop current mode from stack
    const newStack = stack.slice(0, -1);
    const previousMode = newStack[newStack.length - 1];

    devotionStore$.modeStack.set(newStack);
    devotionStore$.uiMode.set(previousMode);

    // Clear thread state when leaving thread mode
    if (previousMode !== 'thread') {
      devotionStore$.activeThreadCommentId.set(null);
    }

    return true;
  },

  /**
   * Set target comment for deep-link navigation from Library
   * @param commentId - The comment ID to scroll to and highlight
   */
  setTargetComment: (commentId: string | null) => {
    devotionStore$.targetCommentId.set(commentId);
    devotionStore$.targetCommentHighlight.set(commentId !== null);
  },

  /**
   * Clear target comment highlight after animation completes
   * Called after the highlight animation finishes
   */
  clearTargetCommentHighlight: () => {
    devotionStore$.targetCommentHighlight.set(false);
    // Clear target after a delay to allow animation to complete
    setTimeout(() => {
      devotionStore$.targetCommentId.set(null);
    }, 500);
  },

  /**
   * Check if we can go back (not at root apologetics mode)
   */
  canGoBack: (): boolean => {
    return devotionStore$.modeStack.get().length > 1;
  },

  /**
   * Reset navigation stack to apologetics (used when leaving devotion tab)
   */
  resetNavigation: () => {
    devotionStore$.modeStack.set(['apologetics']);
    devotionStore$.uiMode.set('apologetics');
    devotionStore$.activeThreadCommentId.set(null);
  },

  /**
   * Set replies for a specific comment
   */
  setRepliesForComment: (commentId: string, replies: ApologeticsCommentWithUser[]) => {
    const comments = devotionStore$.comments.get();
    const updatedComments = comments.map((c: ApologeticsCommentWithUser) => {
      if (c.id === commentId) {
        return { ...c, replies };
      }
      return c;
    });
    devotionStore$.comments.set(updatedComments);
  },

  /**
   * Get the active thread's parent comment
   */
  getActiveThreadComment: (): ApologeticsCommentWithUser | null => {
    const commentId = devotionStore$.activeThreadCommentId.get();
    if (!commentId) return null;

    const comments = devotionStore$.comments.get();
    return comments.find((c: ApologeticsCommentWithUser) => c.id === commentId) || null;
  },

  // ==================== Notification Preferences ====================

  /**
   * Record when user opens app from notification (for adaptive timing)
   */
  recordNotificationOpen: () => {
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    const history = devotionStore$.preferences.notificationOpenHistory.get();
    const updatedHistory = [...history, timeStr].slice(-7); // Keep last 7

    devotionStore$.preferences.notificationOpenHistory.set(updatedHistory);
    devotionStore$.savePreferencesToStorage();

    // Check if we should adapt notification time
    devotionStore$.adaptNotificationTime();
  },

  /**
   * Calculate adaptive notification time based on user behavior
   */
  adaptNotificationTime: () => {
    const history = devotionStore$.preferences.notificationOpenHistory.get();

    if (history.length < 7) return; // Need at least 7 data points

    // Parse times and calculate median hour
    const hours = history.map((t: string) => parseInt(t.split(':')[0], 10));
    hours.sort((a: number, b: number) => a - b);
    const medianHour = hours[Math.floor(hours.length / 2)];

    const currentHour = devotionStore$.preferences.notificationHour.get();

    // If median differs by 30+ minutes from current, adapt
    if (Math.abs(medianHour - currentHour) >= 1) {
      devotionStore$.preferences.notificationHour.set(medianHour);
      devotionStore$.savePreferencesToStorage();
      console.log(`[DevotionStore] Adapted notification time to ${medianHour}:00`);
    }
  },

  /**
   * Set notification preference
   */
  setNotificationEnabled: (enabled: boolean) => {
    devotionStore$.preferences.notificationEnabled.set(enabled);
    devotionStore$.savePreferencesToStorage();
  },

  /**
   * Set notification time
   */
  setNotificationTime: (hour: number, minute: number = 0) => {
    devotionStore$.preferences.notificationHour.set(hour);
    devotionStore$.preferences.notificationMinute.set(minute);
    devotionStore$.savePreferencesToStorage();
  },

  // ==================== Persistence ====================

  /**
   * Save preferences to AsyncStorage
   */
  savePreferencesToStorage: async () => {
    try {
      const preferences = devotionStore$.preferences.get();
      await AsyncStorage.setItem(STORAGE_KEYS.PREFERENCES, JSON.stringify(preferences));
    } catch (error) {
      console.error('[DevotionStore] Failed to save preferences:', error);
    }
  },

  /**
   * Load preferences from AsyncStorage
   */
  loadPreferencesFromStorage: async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.PREFERENCES);
      if (stored) {
        const preferences = JSON.parse(stored);
        devotionStore$.preferences.set({ ...DEFAULT_PREFERENCES, ...preferences });
      }
    } catch (error) {
      console.error('[DevotionStore] Failed to load preferences:', error);
    }
  },

  /**
   * Save liked comments to AsyncStorage
   */
  saveLikedCommentsToStorage: async () => {
    try {
      const likedIds = devotionStore$.userLikedCommentIds.get();
      await AsyncStorage.setItem(STORAGE_KEYS.LIKED_COMMENTS, JSON.stringify(likedIds));
    } catch (error) {
      console.error('[DevotionStore] Failed to save liked comments:', error);
    }
  },

  /**
   * Load liked comments from AsyncStorage
   */
  loadLikedCommentsFromStorage: async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.LIKED_COMMENTS);
      if (stored) {
        const likedIds = JSON.parse(stored);
        devotionStore$.userLikedCommentIds.set(likedIds);
      }
    } catch (error) {
      console.error('[DevotionStore] Failed to load liked comments:', error);
    }
  },

  /**
   * Save cache for offline support
   * @param questionId - The question ID to cache (required for validation on load)
   */
  saveCacheToStorage: async (questionId?: string) => {
    try {
      // Use provided questionId or try to get from current question
      const qId = questionId || devotionStore$.todaysQuestion.get()?.id;
      if (!qId) {
        console.warn('[DevotionStore] Cannot save cache without questionId');
        return;
      }

      const cache: DevotionCache = {
        questionId: qId,
        questionDate: devotionStore$.selectedDate.get(),
        comments: devotionStore$.comments.get().slice(0, 40), // Cache first 40
        userLikedCommentIds: devotionStore$.userLikedCommentIds.get(),
        lastFetched: Date.now(),
      };
      await AsyncStorage.setItem(STORAGE_KEYS.CACHE, JSON.stringify(cache));
    } catch (error) {
      console.error('[DevotionStore] Failed to save cache:', error);
    }
  },

  /**
   * Load cache from AsyncStorage
   */
  loadCacheFromStorage: async (): Promise<DevotionCache | null> => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.CACHE);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('[DevotionStore] Failed to load cache:', error);
    }
    return null;
  },

  /**
   * Initialize store with bundled questions data
   * Smart date caching: only reset to today if date is stale (midnight passed)
   * Checks for holiday overrides first, then falls back to regular questions
   */
  initializeWithData: (data: ApologeticsData) => {
    devotionStore$.questionsData.set(data);

    const today = getLocalDateString();
    const currentSelectedDate = devotionStore$.selectedDate.get();

    // Only reset to today if:
    // 1. No question loaded yet (todaysQuestion is null), OR
    // 2. Selected date is in the past (new day - midnight reset)
    if (!devotionStore$.todaysQuestion.get() || currentSelectedDate < today) {
      devotionStore$.selectedDate.set(today);
      // Use getDisplayQuestionForDate which checks holiday overrides first
      const question = devotionStore$.getDisplayQuestionForDate(today);
      devotionStore$.todaysQuestion.set(question);
    }
  },

  /**
   * Full initialization - load all persisted data including comments cache
   * Called at app startup in _layout.tsx for instant offline support
   */
  initialize: async () => {
    await Promise.all([
      devotionStore$.loadPreferencesFromStorage(),
      devotionStore$.loadLikedCommentsFromStorage(),
      // Load comments cache for offline support
      devotionStore$.loadCacheFromStorage().then((cache: DevotionCache | null) => {
        if (cache && cache.comments && cache.comments.length > 0) {
          console.log('[DevotionStore] Loaded', cache.comments.length, 'cached comments at startup');
          devotionStore$.comments.set(cache.comments);
          // Also restore liked IDs from cache if not already loaded
          if (cache.userLikedCommentIds && cache.userLikedCommentIds.length > 0) {
            devotionStore$.userLikedCommentIds.set(cache.userLikedCommentIds);
          }
        }
      }),
    ]);
  },

  /**
   * Fetch and cache completed devotion dates from server
   * Call this on app load / after auth to populate checkmarks
   */
  loadCompletedDevotionDates: async (userId: string) => {
    try {
      const { fetchDevotionCompletions } = await import('../services/apologeticsService');
      const datesRecord = await fetchDevotionCompletions(userId);
      devotionStore$.completedDevotionDates.set(datesRecord);
      const count = Object.keys(datesRecord).length;
      console.log('[DevotionStore] Loaded', count, 'completed devotion dates');
    } catch (error) {
      console.error('[DevotionStore] Error loading completed devotion dates:', error);
    }
  },

  /**
   * Add a date to the completed devotion dates (optimistic update)
   * Call after successfully marking a devotion complete
   */
  addCompletedDevotionDate: (dateStr: string) => {
    devotionStore$.completedDevotionDates[dateStr].set(true);
  },

  /**
   * Check if a devotion date is completed
   */
  isDevotionDateCompleted: (dateStr: string): boolean => {
    return devotionStore$.completedDevotionDates[dateStr].peek() === true;
  },
});

// ==================== Computed Observables ====================

/**
 * Computed: Active comments only (status = 'active')
 */
export const activeComments$ = computed(() =>
  devotionStore$.comments.get().filter(
    (c: ApologeticsCommentWithUser) => c.status === 'active'
  )
);

/**
 * Computed: Total comment count from server (top-level comments only)
 * Uses backend count for accuracy instead of counting local comments
 */
export const totalCommentCount$ = computed(() => {
  return devotionStore$.serverCommentCount.get();
});

/**
 * Computed: Whether current date is today
 */
export const isToday$ = computed(() => {
  const selected = devotionStore$.selectedDate.get();
  const today = getLocalDateString();
  return selected === today;
});

/**
 * Computed: Whether the selected date's devotion is complete
 * Checks the completedDevotionDates record for the currently selected date
 * This computed properly tracks reactivity for dynamic key access
 */
export const isSelectedDateComplete$ = computed(() => {
  const selectedDate = devotionStore$.selectedDate.get();
  const completedDates = devotionStore$.completedDevotionDates.get();
  return completedDates[selectedDate] === true;
});

/**
 * Computed: Formatted date string for display
 */
export const formattedDate$ = computed(() => {
  const dateStr = devotionStore$.selectedDate.get();
  const date = parseLocalDate(dateStr);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
});

// ==================== Gamification ====================

/**
 * Check if a devotion completion is on-time (not catching up on missed days)
 * On-time: Completing today's devotion (devotionDate === today)
 * Catch-up: Completing a past devotion (devotionDate < today)
 *
 * @param devotionDate - The devotion date in YYYY-MM-DD format
 * @returns true if on-time, false if catch-up
 */
function isDevotionOnTime(devotionDate: string): boolean {
  const today = getLocalDateString();
  return devotionDate === today;
}

/**
 * Mark a devotion as complete and award XP
 * Returns XP info for toast display
 *
 * On-time completions (today's devotion): Awards XP and updates streak
 * Catch-up completions (past devotions): Marks complete but awards 0 XP, no streak update
 *
 * @param userId - The current user's ID
 * @param devotionDate - The devotion date in YYYY-MM-DD format (optional, defaults to selected date)
 * @returns Object with success status and XP awarded
 */
export async function markDevotionComplete(userId: string, devotionDate?: string): Promise<{
  success: boolean;
  xpAwarded: boolean;
  pointsAwarded: number;
  newStreak?: number;
  streakMilestone?: { type: '7-day' | '30-day' | '365-day'; xp: number; rewardType: RewardType };
  alreadyCompleted: boolean;
  allCompleteBonusXP?: number;
  isCatchUp?: boolean;
}> {
  try {
    // Import dynamically to avoid circular dependencies
    const { recordActivity, hasActivityToday } = await import('@/state/gamificationStore');
    const { authStore$ } = await import('@/state/bibleStore');

    // Get the devotion date (defaults to selected date in store)
    const dateToComplete = devotionDate || devotionStore$.selectedDate.get();

    // Check if this specific devotion date is already completed
    if (devotionStore$.isDevotionDateCompleted(dateToComplete)) {
      return {
        success: true,
        xpAwarded: false,
        pointsAwarded: 0,
        alreadyCompleted: true,
      };
    }

    // Check if this is an on-time completion or catch-up
    const isOnTime = isDevotionOnTime(dateToComplete);

    const shouldSync = authStore$.shouldSync.peek();

    if (!isOnTime) {
      // CATCH-UP: Past devotion - mark complete but no XP/streak
      console.log('[DevotionStore] Catch-up completion: 0 XP');

      if (shouldSync && userId) {
        // Online: Record catch-up on server (0 XP, no streak update)
        const { recordDevotionCompletion } = await import('@/services/gamificationService');
        await recordDevotionCompletion(userId, dateToComplete, false);
        devotionStore$.addCompletedDevotionDate(dateToComplete);
      } else {
        // Offline: Just track locally
        devotionStore$.addCompletedDevotionDate(dateToComplete);
      }

      return {
        success: true,
        xpAwarded: false,
        pointsAwarded: 0,
        alreadyCompleted: false,
        isCatchUp: true,
      };
    }

    // ON-TIME: Today's devotion - award XP and update streak
    // Check if already completed today's devotion activity
    if (hasActivityToday('devotion')) {
      return {
        success: true,
        xpAwarded: false,
        pointsAwarded: 0,
        alreadyCompleted: true,
      };
    }

    if (shouldSync && userId) {
      // Online: Record completion and get XP/streak
      // Use the same direct insert approach as catch-up, but with is_on_time=true
      const { recordDevotionCompletion } = await import('@/services/gamificationService');
      const result = await recordDevotionCompletion(userId, dateToComplete, true);

      // Always add to completed dates cache for checkmark display
      devotionStore$.addCompletedDevotionDate(dateToComplete);

      return {
        success: true,
        xpAwarded: result.xpAwarded,
        pointsAwarded: result.pointsAwarded,
        newStreak: result.newStreak,
        streakMilestone: result.streakMilestone,
        alreadyCompleted: result.alreadyCompleted,
        allCompleteBonusXP: result.allCompleteBonusXP,
        isCatchUp: false,
      };
    }

    // Offline: Use local tracking
    const result = recordActivity('devotion');

    // Add to completed dates cache (optimistic update for checkmark display)
    if (!result.alreadyRecordedToday) {
      devotionStore$.addCompletedDevotionDate(dateToComplete);
    }

    return {
      success: true,
      xpAwarded: result.dailyXP > 0,
      pointsAwarded: result.dailyXP,
      newStreak: result.newStreak,
      streakMilestone: result.streakMilestone
        ? { type: result.streakMilestone.type, xp: result.streakMilestone.xp, rewardType: result.streakMilestone.rewardType }
        : undefined,
      alreadyCompleted: result.alreadyRecordedToday,
      isCatchUp: false,
    };
  } catch (error) {
    console.error('[DevotionStore] Error marking devotion complete:', error);
    return {
      success: false,
      xpAwarded: false,
      pointsAwarded: 0,
      alreadyCompleted: false,
    };
  }
}
