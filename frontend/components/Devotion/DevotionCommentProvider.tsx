/**
 * DevotionCommentProvider - Wires CommentContext to devotionStore$ and apologeticsService
 * Provides all comment actions and state for Devotion (Apologetics) context
 */

import React, { useMemo, useCallback } from "react";
import { useSelector } from "@legendapp/state/react";

import { CommentContext, type CommentProviderProps } from "@/contexts/CommentContext";
import type { CommentContextValue, UnifiedComment } from "@/types/comments";
import { DEVOTION_FEATURES } from "@/types/comments";
import {
  devotionStore$,
  activeComments$,
  totalCommentCount$,
  authStore$,
} from "@/state";
import { userProfileCache$ } from "@/state/userProfileCache";
import { devotionCommentToUnified } from "@/utils/commentTypeConverters";
import { updateComment, fetchReplies, createComment } from "@/services/apologeticsService";
import type { CommentWithUser } from "@/state/devotionStore";

interface DevotionCommentProviderProps extends CommentProviderProps {
  questionId: string;
}

const DevotionCommentProvider = ({
  children,
  questionId,
}: DevotionCommentProviderProps) => {
  // Subscribe to store state
  const commentsRaw = useSelector(activeComments$);
  const totalCount = useSelector(totalCommentCount$);
  const isLoading = useSelector(devotionStore$.isCommentsLoading);
  const isInitialized = useSelector(devotionStore$.commentsInitialized);
  const hasMore = useSelector(devotionStore$.commentsHasMore);
  const isLoadingMore = useSelector(devotionStore$.isLoadingMore);
  const activeThreadCommentId = useSelector(devotionStore$.activeThreadCommentId);
  const targetCommentId = useSelector(devotionStore$.targetCommentId);
  const targetCommentHighlight = useSelector(devotionStore$.targetCommentHighlight);
  const user = useSelector(authStore$.user);

  // Profile cache for display name lookups
  const profiles = useSelector(userProfileCache$.profiles);

  // Convert comments to unified type
  const comments: UnifiedComment[] = useMemo(() => {
    return commentsRaw.map((comment: CommentWithUser) =>
      devotionCommentToUnified(comment, questionId)
    );
  }, [commentsRaw, questionId]);

  // Get thread parent comment (if in thread mode)
  const threadParentComment: UnifiedComment | null = useMemo(() => {
    if (!activeThreadCommentId) return null;
    const parent = commentsRaw.find((c: CommentWithUser) => c.id === activeThreadCommentId);
    return parent ? devotionCommentToUnified(parent, questionId) : null;
  }, [activeThreadCommentId, commentsRaw, questionId]);

  // Get thread replies (filtered active only)
  const threadReplies: UnifiedComment[] = useMemo(() => {
    if (!threadParentComment || !threadParentComment.replies) return [];
    return threadParentComment.replies.filter((r) => r.status === "active");
  }, [threadParentComment]);

  // Action callbacks bound to store/service
  const onLike = useCallback(
    (commentId: string) => {
      devotionStore$.toggleLike(commentId, user?.id);
    },
    [user?.id]
  );

  const onEdit = useCallback(
    async (commentId: string, newContent: string): Promise<boolean> => {
      const success = await updateComment(commentId, newContent);
      if (success) {
        // Find the original comment to get full data for update
        const allComments = devotionStore$.comments.get();
        const originalComment = allComments.find((c: CommentWithUser) => c.id === commentId);
        if (originalComment) {
          devotionStore$.updateComment({ ...originalComment, content: newContent.trim() });
        }
      }
      return success;
    },
    []
  );

  const onDelete = useCallback((commentId: string) => {
    devotionStore$.softDeleteComment(commentId);
  }, []);

  const onSubmitComment = useCallback(
    async (
      content: string,
      parentCommentId?: string,
      isAnonymous?: boolean,
      isHumansOnly?: boolean
    ): Promise<boolean> => {
      if (!user?.id) return false;

      const result = await createComment(
        questionId,
        content,
        user.id,
        parentCommentId,
        isAnonymous,
        isHumansOnly
      );

      if (result) {
        devotionStore$.addComment(result);
      }

      return !!result;
    },
    [questionId, user?.id]
  );

  const onOpenThread = useCallback((commentId: string) => {
    devotionStore$.openThread(commentId);
  }, []);

  const onCloseThread = useCallback(() => {
    devotionStore$.closeThread();
  }, []);

  const onFetchReplies = useCallback(async (commentId: string): Promise<void> => {
    const replies = await fetchReplies(commentId);
    if (replies) {
      devotionStore$.setRepliesForComment(commentId, replies);
    }
  }, []);

  const setRepliesForComment = useCallback(
    (commentId: string, replies: UnifiedComment[]) => {
      // Convert back to CommentWithUser type for store
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
        is_anonymous: r.is_anonymous,
        is_humans_only: r.is_humans_only,
        is_ai_generated: r.is_ai_generated,
        ai_review_status: r.ai_review_status,
        question_id: questionId,
        replies: r.replies?.map((reply) => ({
          id: reply.id,
          user_id: reply.user_id,
          parent_comment_id: reply.parent_comment_id,
          content: reply.content,
          like_count: reply.like_count,
          reply_count: reply.reply_count,
          status: reply.status,
          created_at: reply.created_at,
          updated_at: reply.updated_at,
          is_anonymous: reply.is_anonymous,
          is_humans_only: reply.is_humans_only,
          is_ai_generated: reply.is_ai_generated,
          ai_review_status: reply.ai_review_status,
          question_id: questionId,
        })),
      }));
      devotionStore$.setRepliesForComment(commentId, storeReplies as CommentWithUser[]);
    },
    [questionId]
  );

  const clearTargetHighlight = useCallback(() => {
    devotionStore$.clearTargetCommentHighlight();
  }, []);

  // State accessors
  const isCommentLiked = useCallback(
    (commentId: string): boolean => {
      return devotionStore$.isCommentLiked(commentId);
    },
    []
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
    // This would trigger loading more comments
    // The actual implementation depends on how apologeticsService works
    import("@/services/apologeticsService").then(({ loadMoreComments }) => {
      loadMoreComments(questionId);
    });
  }, [questionId]);

  // Build context value
  const contextValue: CommentContextValue = useMemo(
    () => ({
      features: DEVOTION_FEATURES,

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
      isLoadingMore,

      // Thread state
      activeThreadCommentId,
      threadParentComment,
      threadReplies,

      // Deep-link state
      targetCommentId,
      targetCommentHighlight,
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
      isLoadingMore,
      activeThreadCommentId,
      threadParentComment,
      threadReplies,
      targetCommentId,
      targetCommentHighlight,
    ]
  );

  return (
    <CommentContext.Provider value={contextValue}>
      {children}
    </CommentContext.Provider>
  );
};

export default DevotionCommentProvider;
