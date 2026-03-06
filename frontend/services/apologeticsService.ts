/**
 * Apologetics Service - Supabase operations for community comments
 *
 * Handles:
 * - Comment CRUD operations
 * - Real-time subscriptions
 * - Like/unlike operations
 * - User profile caching (lazy-load on demand)
 */

import { supabase } from '../lib/supabase';
import { devotionStore$ } from '../state';
import { userProfileCache$ } from '../state/userProfileCache';
import type { CommentWithUser } from '../state/devotionStore';
import type { CommentInsert, CommentLikeInsert } from '../types/database';
import type { RealtimeChannel } from '@supabase/supabase-js';
import NetInfo from '@react-native-community/netinfo';

const PAGE_SIZE = 20;

let realtimeChannel: RealtimeChannel | null = null;

/**
 * Fetch comments for a specific question
 * User profiles are loaded into cache separately (no N+1 queries)
 */
export async function fetchComments(
  questionId: string,
  page: number = 0
): Promise<{ comments: CommentWithUser[]; hasMore: boolean; totalCount: number }> {
  try {
    const offset = page * PAGE_SIZE;

    // Fetch top-level comments (parent_comment_id is null)
    // Order by likes (most liked first), then by newest for equal likes
    // Note: topLevelCount is used for pagination, totalCount includes all comments (like YouTube)
    const [commentsResult, totalCountResult] = await Promise.all([
      supabase
        .from('comments')
        .select('*', { count: 'exact' })
        .eq('question_id', questionId)
        .is('parent_comment_id', null)
        .eq('status', 'active')
        .order('like_count', { ascending: false })
        .order('created_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1),
      // Count ALL comments (including replies) for YouTube-style total
      supabase
        .from('comments')
        .select('*', { count: 'exact', head: true })
        .eq('question_id', questionId)
        .eq('status', 'active'),
    ]);

    if (commentsResult.error) {
      console.error('[CommentsService] Error fetching comments:', commentsResult.error);
      throw commentsResult.error;
    }

    const comments = commentsResult.data || [];
    const topLevelCount = commentsResult.count || 0;
    const totalCount = totalCountResult.count || 0;

    // Batch ensure all user profiles are cached (single query for missing profiles)
    if (comments.length > 0) {
      const userIds = [...new Set(comments.map((c: CommentWithUser) => c.user_id))];
      await userProfileCache$.ensureProfiles(userIds);
    }

    const hasMore = topLevelCount ? offset + PAGE_SIZE < topLevelCount : false;

    return { comments: comments as CommentWithUser[], hasMore, totalCount };
  } catch (error) {
    console.error('[CommentsService] fetchComments error:', error);
    return { comments: [], hasMore: false, totalCount: 0 };
  }
}

/**
 * Fetch replies for a specific comment
 * User profiles are loaded into cache separately
 */
export async function fetchReplies(parentCommentId: string): Promise<CommentWithUser[]> {
  try {
    const { data, error } = await supabase
      .from('comments')
      .select('*')
      .eq('parent_comment_id', parentCommentId)
      .eq('status', 'active')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[CommentsService] Error fetching replies:', error);
      throw error;
    }

    const replies = data || [];

    // Batch ensure all user profiles are cached
    if (replies.length > 0) {
      const userIds = [...new Set(replies.map((r: CommentWithUser) => r.user_id))];
      await userProfileCache$.ensureProfiles(userIds);
    }

    return replies as CommentWithUser[];
  } catch (error) {
    console.error('[CommentsService] fetchReplies error:', error);
    return [];
  }
}

/**
 * Create a new comment or reply
 */
export async function createComment(
  questionId: string,
  content: string,
  userId: string,
  parentCommentId?: string | null,
  isAnonymous?: boolean,
  isHumansOnly?: boolean
): Promise<CommentWithUser | null> {
  try {
    const insertData: CommentInsert = {
      context_type: 'devotion',
      question_id: questionId,
      user_id: userId,
      content: content.trim(),
      parent_comment_id: parentCommentId || null,
      status: 'active',
      is_anonymous: isAnonymous ?? false,
      is_humans_only: isHumansOnly ?? false,
    };

    console.log('[CommentsService] Creating comment:', insertData);

    const { data, error } = await supabase
      .from('comments')
      .insert(insertData)
      .select('*')
      .single();

    if (error) {
      console.error('[CommentsService] Error creating comment:', error);
      throw error;
    }

    console.log('[CommentsService] Comment created:', data);

    // Ensure user profile is in cache
    await userProfileCache$.ensureProfiles([userId]);

    return data as CommentWithUser;
  } catch (error) {
    console.error('[CommentsService] createComment error:', error);
    return null;
  }
}

/**
 * Update a comment's content
 */
export async function updateComment(
  commentId: string,
  content: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('comments')
      .update({ content: content.trim() })
      .eq('id', commentId);

    if (error) {
      console.error('[CommentsService] Error updating comment:', error);
      throw error;
    }

    return true;
  } catch (error) {
    console.error('[CommentsService] updateComment error:', error);
    return false;
  }
}

/**
 * Soft delete a comment (set status to inactive)
 * RLS policy requires the user to be the comment author
 */
export async function deleteComment(commentId: string): Promise<boolean> {
  try {
    // Get current user for RLS policy
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error('[CommentsService] No authenticated user for delete');
      return false;
    }

    const { error } = await supabase
      .from('comments')
      .update({ status: 'inactive' })
      .eq('id', commentId)
      .eq('user_id', user.id); // RLS requires user to be author

    if (error) {
      console.error('[CommentsService] Error deleting comment:', error);
      throw error;
    }

    return true;
  } catch (error) {
    console.error('[CommentsService] deleteComment error:', error);
    return false;
  }
}

/**
 * Toggle like on a comment
 */
export async function toggleLike(
  commentId: string,
  userId: string,
  isCurrentlyLiked: boolean
): Promise<boolean> {
  try {
    if (isCurrentlyLiked) {
      // Remove like
      const { error } = await supabase
        .from('comment_likes')
        .delete()
        .eq('comment_id', commentId)
        .eq('user_id', userId);

      if (error) throw error;
    } else {
      // Add like
      const insertData: CommentLikeInsert = {
        comment_id: commentId,
        user_id: userId,
      };

      const { error } = await supabase
        .from('comment_likes')
        .insert(insertData);

      if (error) throw error;
    }

    return true;
  } catch (error) {
    console.error('[CommentsService] toggleLike error:', error);
    return false;
  }
}

/**
 * Fetch user's liked comment IDs for a question
 */
export async function fetchUserLikes(
  userId: string,
  questionId: string
): Promise<string[]> {
  try {
    // Get all comments for this question first
    const { data: comments, error: commentsError } = await supabase
      .from('comments')
      .select('id')
      .eq('question_id', questionId);

    if (commentsError) throw commentsError;

    if (!comments || comments.length === 0) return [];

    const commentIds = comments.map(c => c.id);

    // Then get user's likes for these comments
    const { data: likes, error: likesError } = await supabase
      .from('comment_likes')
      .select('comment_id')
      .eq('user_id', userId)
      .in('comment_id', commentIds);

    if (likesError) throw likesError;

    return (likes || []).map(l => l.comment_id);
  } catch (error) {
    console.error('[CommentsService] fetchUserLikes error:', error);
    return [];
  }
}

// Track the current user ID for filtering own like events
let currentUserId: string | null = null;

/**
 * Set the current user ID for real-time like filtering
 */
export function setCurrentUserId(userId: string | null): void {
  currentUserId = userId;
}

/**
 * Subscribe to real-time comment updates for a question
 * Includes both comments and comment_likes tables
 */
export function subscribeToComments(questionId: string): () => void {
  // Cleanup existing subscription
  if (realtimeChannel) {
    supabase.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }

  console.log('[CommentsService] Subscribing to comments for question:', questionId);

  realtimeChannel = supabase
    .channel(`comments-${questionId}`)
    // Comment INSERT events
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'comments',
        filter: `question_id=eq.${questionId}`,
      },
      async (payload) => {
        console.log('[CommentsService] New comment received:', payload);

        // Fetch the full comment
        const { data, error } = await supabase
          .from('comments')
          .select('*')
          .eq('id', payload.new.id)
          .single();

        if (!error && data) {
          // Ensure user profile is in cache
          await userProfileCache$.ensureProfiles([data.user_id]);

          devotionStore$.addComment(data as CommentWithUser);
        }
      }
    )
    // Comment UPDATE events
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'comments',
        filter: `question_id=eq.${questionId}`,
      },
      (payload) => {
        console.log('[CommentsService] Comment updated:', payload);

        if (payload.new.status === 'inactive') {
          // Soft delete - remove from list
          devotionStore$.removeComment(payload.new.id);
        } else {
          // Content or like_count update
          devotionStore$.updateComment(payload.new);
        }
      }
    )
    // Comment DELETE events
    .on(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: 'comments',
        filter: `question_id=eq.${questionId}`,
      },
      (payload) => {
        console.log('[CommentsService] Comment deleted:', payload);
        devotionStore$.removeComment(payload.old.id);
      }
    )
    // Like INSERT events (new like added)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'comment_likes',
      },
      (payload) => {
        const likeData = payload.new as { comment_id: string; user_id: string };
        console.log('[CommentsService] New like received:', likeData);

        // Handle remote like change (filters out own likes)
        devotionStore$.handleRemoteLikeChange(
          likeData.comment_id,
          true, // isLikeAdded
          likeData.user_id,
          currentUserId || undefined
        );
      }
    )
    // Like DELETE events (like removed)
    .on(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: 'comment_likes',
      },
      (payload) => {
        const likeData = payload.old as { comment_id: string; user_id: string };
        console.log('[CommentsService] Like removed:', likeData);

        // Handle remote like change (filters out own likes)
        devotionStore$.handleRemoteLikeChange(
          likeData.comment_id,
          false, // isLikeAdded
          likeData.user_id,
          currentUserId || undefined
        );
      }
    )
    .subscribe((status) => {
      console.log('[CommentsService] Subscription status:', status);
    });

  // Return cleanup function
  return () => {
    if (realtimeChannel) {
      console.log('[CommentsService] Unsubscribing from comments');
      supabase.removeChannel(realtimeChannel);
      realtimeChannel = null;
    }
  };
}

/**
 * Load comments for the current question and set up real-time subscription
 * Cache is pre-loaded at app startup (devotionStore$.initialize() in _layout.tsx)
 * This function handles network check and fetches fresh data if online
 */
export async function initializeCommentsForQuestion(
  questionId: string,
  userId?: string | null
): Promise<void> {
  console.log('[ApologeticsService] Initializing comments for question:', questionId);

  // Set current user ID for real-time like filtering
  setCurrentUserId(userId || null);

  // Show loading state
  devotionStore$.isCommentsLoading.set(true);
  devotionStore$.commentsInitialized.set(false);

  try {
    // Check network status
    const netState = await NetInfo.fetch();
    const isOnline = netState.isConnected ?? false;

    if (!isOnline) {
      // Offline: Try to restore from cache for this question
      console.log('[ApologeticsService] Offline - attempting to restore from cache');
      const cached = await devotionStore$.loadCacheFromStorage();

      // Only use cache if it matches the current question ID (not just date)
      // This prevents showing wrong comments when switching between questions
      if (cached && cached.questionId === questionId && cached.comments && cached.comments.length > 0) {
        console.log('[ApologeticsService] Restored', cached.comments.length, 'cached comments for question', questionId);
        devotionStore$.comments.set(cached.comments);
        if (cached.userLikedCommentIds && cached.userLikedCommentIds.length > 0) {
          devotionStore$.userLikedCommentIds.set(cached.userLikedCommentIds);
        }
      } else {
        // No matching cache - show empty state
        console.log('[ApologeticsService] No cached comments for question', questionId);
        devotionStore$.comments.set([]);
      }
      devotionStore$.commentsPage.set(0);
      devotionStore$.commentsHasMore.set(false); // Can't load more offline
      devotionStore$.isCommentsLoading.set(false);
      devotionStore$.commentsInitialized.set(true);
      return;
    }

    // Online: Clear old comments and fetch fresh data
    devotionStore$.comments.set([]);
    devotionStore$.commentsPage.set(0);

    const { comments, hasMore, totalCount } = await fetchComments(questionId, 0);

    devotionStore$.comments.set(comments);
    devotionStore$.commentsHasMore.set(hasMore);
    devotionStore$.serverCommentCount.set(totalCount);

    // Load user's likes if authenticated
    if (userId) {
      const likedIds = await fetchUserLikes(userId, questionId);
      devotionStore$.userLikedCommentIds.set(likedIds);
    }

    // Set up real-time subscription
    subscribeToComments(questionId);

    // Cache for next offline session (pass questionId for validation on load)
    devotionStore$.saveCacheToStorage(questionId);
  } catch (error) {
    console.error('[ApologeticsService] initializeCommentsForQuestion error:', error);
    // On error, keep any existing data
  } finally {
    devotionStore$.isCommentsLoading.set(false);
    devotionStore$.commentsInitialized.set(true);
  }
}

/**
 * Load more comments (pagination)
 * Only works when online
 */
export async function loadMoreComments(questionId: string): Promise<void> {
  const currentPage = devotionStore$.commentsPage.get();
  const hasMore = devotionStore$.commentsHasMore.get();
  const isLoadingMore = devotionStore$.isLoadingMore.get();

  if (!hasMore || isLoadingMore) return;

  // Check network before fetching more
  const netState = await NetInfo.fetch();
  if (!netState.isConnected) {
    console.log('[ApologeticsService] Offline - cannot load more comments');
    return;
  }

  devotionStore$.isLoadingMore.set(true);

  try {
    const nextPage = currentPage + 1;
    const { comments, hasMore: moreAvailable } = await fetchComments(questionId, nextPage);

    const existingComments = devotionStore$.comments.get();
    devotionStore$.comments.set([...existingComments, ...comments]);
    devotionStore$.commentsPage.set(nextPage);
    devotionStore$.commentsHasMore.set(moreAvailable);
  } catch (error) {
    console.error('[ApologeticsService] loadMoreComments error:', error);
  } finally {
    devotionStore$.isLoadingMore.set(false);
  }
}

/**
 * Cleanup - call when leaving devotion tab or changing questions
 */
export function cleanupCommentsSubscription(): void {
  if (realtimeChannel) {
    console.log('[ApologeticsService] Cleaning up comments subscription');
    supabase.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }
}

/**
 * Fetch all comments authored by a specific user (for Library "My Comments")
 * Returns comments sorted by newest first
 */
export async function fetchUserComments(
  userId: string,
  page: number = 0
): Promise<{ comments: CommentWithUser[]; hasMore: boolean }> {
  try {
    const offset = page * PAGE_SIZE;

    const { data, error, count } = await supabase
      .from('comments')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      console.error('[CommentsService] Error fetching user comments:', error);
      throw error;
    }

    const comments = data || [];

    // Batch ensure all user profiles are cached (includes the author)
    if (comments.length > 0) {
      const userIds = [...new Set(comments.map((c: CommentWithUser) => c.user_id))];
      await userProfileCache$.ensureProfiles(userIds);
    }

    const hasMore = count ? offset + PAGE_SIZE < count : false;

    return { comments: comments as CommentWithUser[], hasMore };
  } catch (error) {
    console.error('[CommentsService] fetchUserComments error:', error);
    return { comments: [], hasMore: false };
  }
}

/**
 * Fetch all comments liked by a specific user (for Library "Liked Comments")
 * Returns comments sorted by when they were liked (newest likes first)
 */
export async function fetchUserLikedComments(
  userId: string,
  page: number = 0
): Promise<{ comments: CommentWithUser[]; hasMore: boolean }> {
  try {
    const offset = page * PAGE_SIZE;

    // First, get the liked comment IDs with pagination
    const { data: likesData, error: likesError, count } = await supabase
      .from('comment_likes')
      .select('comment_id, created_at', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (likesError) {
      console.error('[CommentsService] Error fetching user likes:', likesError);
      throw likesError;
    }

    if (!likesData || likesData.length === 0) {
      return { comments: [], hasMore: false };
    }

    // Get the comment IDs in order
    const commentIds = likesData.map(like => like.comment_id);

    // Fetch the actual comments
    const { data: commentsData, error: commentsError } = await supabase
      .from('comments')
      .select('*')
      .in('id', commentIds)
      .eq('status', 'active');

    if (commentsError) {
      console.error('[CommentsService] Error fetching liked comments:', commentsError);
      throw commentsError;
    }

    // Sort comments to match the order of likes (newest likes first)
    const commentsMap = new Map((commentsData || []).map(c => [c.id, c]));
    const orderedComments = commentIds
      .map(id => commentsMap.get(id))
      .filter((c): c is CommentWithUser => c !== undefined);

    // Batch ensure all user profiles are cached
    if (orderedComments.length > 0) {
      const userIds = [...new Set(orderedComments.map((c: CommentWithUser) => c.user_id))];
      await userProfileCache$.ensureProfiles(userIds);
    }

    const hasMore = count ? offset + PAGE_SIZE < count : false;

    return { comments: orderedComments, hasMore };
  } catch (error) {
    console.error('[CommentsService] fetchUserLikedComments error:', error);
    return { comments: [], hasMore: false };
  }
}

/**
 * Sync devotion comments if needed - called on app resume or network reconnect
 * Re-initializes subscription and refreshes comments if subscription was lost
 */
export async function syncDevotionCommentsIfNeeded(
  questionId: string,
  userId?: string | null
): Promise<void> {
  try {
    const netState = await NetInfo.fetch();
    if (!netState.isConnected) {
      console.log('[ApologeticsService] syncDevotionCommentsIfNeeded - offline, skipping');
      return;
    }

    // Re-initialize if subscription lost or refresh needed
    if (!realtimeChannel) {
      console.log('[ApologeticsService] syncDevotionCommentsIfNeeded - subscription lost, reinitializing');
      await initializeCommentsForQuestion(questionId, userId);
    } else {
      // Subscription exists, just refresh the comments
      console.log('[ApologeticsService] syncDevotionCommentsIfNeeded - refreshing comments');
      const { comments, hasMore, totalCount } = await fetchComments(questionId, 0);
      devotionStore$.comments.set(comments);
      devotionStore$.commentsHasMore.set(hasMore);
      devotionStore$.serverCommentCount.set(totalCount);
      devotionStore$.commentsPage.set(0);

      // Refresh likes if user is authenticated
      if (userId) {
        const likedIds = await fetchUserLikes(userId, questionId);
        devotionStore$.userLikedCommentIds.set(likedIds);
      }

      // Update cache
      devotionStore$.saveCacheToStorage(questionId);
    }
  } catch (error) {
    console.error('[ApologeticsService] syncDevotionCommentsIfNeeded error:', error);
  }
}

/**
 * Check if real-time subscription is active
 */
export function isSubscriptionActive(): boolean {
  return realtimeChannel !== null;
}

/**
 * Fetch completed devotion dates for a user
 * Queries user_rewards where reference_id starts with 'devotion_'
 * @param userId - User ID
 * @returns Record of completed devotion dates (YYYY-MM-DD -> true)
 */
export async function fetchDevotionCompletions(userId: string): Promise<Record<string, boolean>> {
  try {
    const { data, error } = await supabase
      .from('user_rewards')
      .select('reference_id')
      .eq('user_id', userId)
      .eq('reward_type', 'daily_devotion')
      .like('reference_id', 'devotion_%');

    if (error) {
      console.error('[ApologeticsService] Error fetching devotion completions:', error);
      return {};
    }

    // Parse dates from reference_ids (format: "devotion_YYYY-MM-DD")
    const dates: Record<string, boolean> = {};
    for (const row of data || []) {
      if (row.reference_id) {
        const date = row.reference_id.replace('devotion_', '');
        if (date) dates[date] = true;
      }
    }

    console.log('[ApologeticsService] Fetched', Object.keys(dates).length, 'completed devotion dates');
    return dates;
  } catch (error) {
    console.error('[ApologeticsService] fetchDevotionCompletions error:', error);
    return {};
  }
}
