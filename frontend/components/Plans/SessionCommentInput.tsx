/**
 * SessionCommentInput - Wrapper that provides CommentContext for plan session comments
 * Uses the unified Comment/Input component for consistent UX
 */

import React from "react";
import { useSelector } from "@legendapp/state/react";

import { CommentContext } from "@/contexts/CommentContext";
import { PLAN_SESSION_FEATURES, type CommentContextValue } from "@/types/comments";
import { authStore$, planStore$ } from "@/state";
import { createSessionComment } from "@/services/planService";
import Input from "@/components/Comment/Input";

interface SessionCommentInputProps {
  sharedSessionId: string;
  dayNumber: number;
  parentCommentId?: string;
  placeholder?: string;
  onSubmit?: () => void;
  autoFocus?: boolean;
  onHeightChange?: (height: number) => void;
}

export default function SessionCommentInput({
  sharedSessionId,
  dayNumber,
  parentCommentId,
  placeholder = "Share your thoughts...",
  onSubmit,
  autoFocus = false,
  onHeightChange,
}: SessionCommentInputProps) {
  const user = useSelector(authStore$.user);

  // Create minimal context value for Input component
  const contextValue: CommentContextValue = {
    features: PLAN_SESSION_FEATURES,

    // Submit handler for plan sessions
    onSubmitComment: async (
      content: string,
      parentId?: string,
      isAnonymous?: boolean,
      isHumansOnly?: boolean
    ): Promise<boolean> => {
      if (!user?.id) return false;

      const result = await createSessionComment(
        sharedSessionId,
        dayNumber,
        content,
        user.id,
        parentId || parentCommentId,
        isAnonymous,
        isHumansOnly
      );

      if (result) {
        planStore$.addComment(result);
        return true;
      }
      return false;
    },

    getCurrentUserId: () => user?.id,

    // Stub functions not needed for input
    onLike: () => {},
    onEdit: async () => false,
    onDelete: () => {},
    onOpenThread: () => {},
    onCloseThread: () => {},
    onFetchReplies: async () => {},
    setRepliesForComment: () => {},
    clearTargetHighlight: () => {},
    isCommentLiked: () => false,
    isCurrentUser: (userId: string) => user?.id === userId,
    getDisplayName: () => "User",
    loadMore: () => {},

    // State not needed for input
    comments: [],
    totalCount: 0,
    isLoading: false,
    isInitialized: true,
    hasMore: false,
    isLoadingMore: false,
    activeThreadCommentId: null,
    threadParentComment: null,
    threadReplies: [],
    targetCommentId: null,
    targetCommentHighlight: false,
  };

  return (
    <CommentContext.Provider value={contextValue}>
      <Input
        parentCommentId={parentCommentId}
        placeholder={placeholder}
        onSubmit={onSubmit}
        autoFocus={autoFocus}
        onHeightChange={onHeightChange}
      />
    </CommentContext.Provider>
  );
}
