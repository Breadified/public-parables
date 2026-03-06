/**
 * PlanCommentProvider - Wires CommentContext to planStore$ and planService
 * Provides all comment actions and state for Plan Sessions context
 */

import React, { useMemo, useCallback } from "react";
import { useSelector } from "@legendapp/state/react";

import { CommentContext, type CommentProviderProps } from "@/contexts/CommentContext";
import type { CommentContextValue, UnifiedComment } from "@/types/comments";
import { PLAN_SESSION_FEATURES } from "@/types/comments";
import {
  planStore$,
  activeSessionComments$,
  authStore$,
} from "@/state";
import { userProfileCache$ } from "@/state/userProfileCache";
import { sessionCommentToUnified } from "@/utils/commentTypeConverters";
import {
  createSessionComment,
  fetchSessionCommentReplies,
  loadMoreSessionComments,
  updateSessionComment,
} from "@/services/planService";
import type { SessionCommentWithUser } from "@/state/planStore";

interface PlanCommentProviderProps extends CommentProviderProps {
  sharedSessionId: string;
  dayNumber: number;
}

const PlanCommentProvider = ({
  children,
  sharedSessionId,
  dayNumber,
}: PlanCommentProviderProps) => {
  // Subscribe to store state
  const commentsRaw = useSelector(activeSessionComments$);
  const isLoading = useSelector(planStore$.commentsLoading);
  const isInitialized = useSelector(planStore$.commentsInitialized);
  const hasMore = useSelector(planStore$.commentsHasMore);
  const user = useSelector(authStore$.user);

  // Subscribe to liked comment IDs for reactivity
  const userLikedIds = useSelector(planStore$.userLikedCommentIds);

  // Thread state from store
  const activeThreadCommentId = useSelector(planStore$.activeThreadCommentId);

  // Profile cache for display name lookups
  const profiles = useSelector(userProfileCache$.profiles);

  // Convert comments to unified type
  const comments: UnifiedComment[] = useMemo(() => {
    return commentsRaw.map((comment: SessionCommentWithUser) =>
      sessionCommentToUnified(comment, sharedSessionId)
    );
  }, [commentsRaw, sharedSessionId]);

  // Total count includes top-level comments + all replies (YouTube-style)
  const totalCount = useMemo(() => {
    return comments.reduce((sum, c) => sum + 1 + (c.reply_count || 0), 0);
  }, [comments]);

  // Get thread parent comment (if in thread mode) - matches DevotionCommentProvider pattern
  const threadParentComment: UnifiedComment | null = useMemo(() => {
    if (!activeThreadCommentId) return null;
    const parent = commentsRaw.find((c: SessionCommentWithUser) => c.id === activeThreadCommentId);
    return parent ? sessionCommentToUnified(parent, sharedSessionId) : null;
  }, [activeThreadCommentId, commentsRaw, sharedSessionId]);

  // Get thread replies (filtered active only) - matches DevotionCommentProvider pattern
  const threadReplies: UnifiedComment[] = useMemo(() => {
    if (!threadParentComment || !threadParentComment.replies) return [];
    return threadParentComment.replies.filter((r) => r.status === "active");
  }, [threadParentComment]);

  // Action callbacks bound to store/service
  const onLike = useCallback(
    (commentId: string) => {
      planStore$.toggleLike(commentId, user?.id);
    },
    [user?.id]
  );

  const onEdit = useCallback(
    async (commentId: string, newContent: string): Promise<boolean> => {
      const success = await updateSessionComment(commentId, newContent);
      if (success) {
        // Update local store
        planStore$.updateComment({
          id: commentId,
          content: newContent,
          updated_at: new Date().toISOString(),
        });
      }
      return success;
    },
    []
  );

  const onDelete = useCallback((commentId: string) => {
    planStore$.softDeleteComment(commentId);
  }, []);

  const onSubmitComment = useCallback(
    async (
      content: string,
      parentCommentId?: string,
      isAnonymous?: boolean,
      isHumansOnly?: boolean
    ): Promise<boolean> => {
      if (!user?.id) return false;

      const result = await createSessionComment(
        sharedSessionId,
        dayNumber,
        content,
        user.id,
        parentCommentId,
        isAnonymous,
        isHumansOnly
      );

      if (result) {
        planStore$.addComment(result);
      }

      return !!result;
    },
    [sharedSessionId, dayNumber, user?.id]
  );

  // Thread operations - use store methods (matches Devotion pattern)
  const onOpenThread = useCallback((commentId: string) => {
    planStore$.openThread(commentId);
  }, []);

  const onCloseThread = useCallback(() => {
    planStore$.closeThread();
  }, []);

  const onFetchReplies = useCallback(async (commentId: string): Promise<void> => {
    const replies = await fetchSessionCommentReplies(commentId);
    if (replies) {
      // Store the replies on the parent comment (dayNumber is used by the store method)
      planStore$.setRepliesForComment(commentId, replies, dayNumber);
    }
  }, [dayNumber]);

  const setRepliesForComment = useCallback(
    (commentId: string, replies: UnifiedComment[]) => {
      // Convert back to SessionCommentWithUser type for store
      const storeReplies = replies.map((r) => ({
        id: r.id,
        user_id: r.user_id,
        parent_comment_id: r.parent_comment_id,
        content: r.content,
        like_count: r.like_count,
        reply_count: r.reply_count,
        status: r.status,
        created_at: r.created_at,
        updated_at: r.updated_at,
        plan_session_id: sharedSessionId,
        day_number: r.day_number || dayNumber,
      })) as SessionCommentWithUser[];

      // Use the store's setRepliesForComment method with day number
      planStore$.setRepliesForComment(commentId, storeReplies, dayNumber);
    },
    [sharedSessionId, dayNumber]
  );

  // No deep-link support for plans yet
  const clearTargetHighlight = useCallback(() => {}, []);

  // State accessors
  const isCommentLiked = useCallback(
    (commentId: string): boolean => {
      return userLikedIds.includes(commentId);
    },
    [userLikedIds]
  );

  const getCurrentUserId = useCallback((): string | undefined => {
    return user?.id;
  }, [user?.id]);

  const isCurrentUser = useCallback(
    (userId: string): boolean => {
      return user?.id === userId;
    },
    [user?.id]
  );

  const getDisplayName = useCallback(
    (userId: string): string => {
      const profile = profiles[userId];
      if (!profile || !profile.display_name) {
        return "Anonymous";
      }
      // Check for conflicts (same display_name, different user_id)
      const hasConflict = Object.values(profiles).some(
        (p) => p.user_id !== userId && p.display_name === profile.display_name
      );
      if (hasConflict && profile.discriminator !== null) {
        return `${profile.display_name}#${profile.discriminator.toString().padStart(4, "0")}`;
      }
      return profile.display_name;
    },
    [profiles]
  );

  const loadMore = useCallback(() => {
    loadMoreSessionComments(sharedSessionId, dayNumber);
  }, [sharedSessionId, dayNumber]);

  // Build context value
  const contextValue: CommentContextValue = useMemo(
    () => ({
      features: PLAN_SESSION_FEATURES,

      // Actions
      onLike,
      onEdit,
      onDelete,
      onSubmitComment,
      onOpenThread,
      onCloseThread,
      onFetchReplies,
      setRepliesForComment,
      clearTargetHighlight,

      // State accessors
      isCommentLiked,
      getCurrentUserId,
      isCurrentUser,
      getDisplayName,

      // Comment data
      comments,
      totalCount,
      isLoading,
      isInitialized,
      hasMore,
      loadMore,
      isLoadingMore: false, // Plans don't track this separately

      // Thread state (not used for plans)
      activeThreadCommentId,
      threadParentComment,
      threadReplies,

      // Deep-link state (not used for plans)
      targetCommentId: null,
      targetCommentHighlight: false,
    }),
    [
      onLike,
      onEdit,
      onDelete,
      onSubmitComment,
      onOpenThread,
      onCloseThread,
      onFetchReplies,
      setRepliesForComment,
      clearTargetHighlight,
      isCommentLiked,
      getCurrentUserId,
      isCurrentUser,
      getDisplayName,
      comments,
      totalCount,
      isLoading,
      isInitialized,
      hasMore,
      loadMore,
      activeThreadCommentId,
      threadParentComment,
      threadReplies,
    ]
  );

  return (
    <CommentContext.Provider value={contextValue}>
      {children}
    </CommentContext.Provider>
  );
};

export default PlanCommentProvider;
