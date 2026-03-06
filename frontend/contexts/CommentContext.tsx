/**
 * Comment Context
 * Provides unified comment functionality to components without store dependencies
 * Providers (DevotionCommentProvider, PlanCommentProvider) wire up the actual store/service calls
 */

import React, { createContext, useContext } from 'react';
import type { CommentContextValue, CommentFeatures } from '@/types/comments';

/**
 * Default empty context value
 * Components will throw if used without a provider
 */
const defaultContextValue: CommentContextValue = {
  features: {
    showAiIndicator: false,
    showAnonymous: false,
    allowEdit: false,
    enableRichText: false,
    enableVerseDetection: false,
    enableAnonymousToggle: false,
    enableHumansOnlyToggle: false,
  },

  // Actions (no-op defaults)
  onLike: () => {},
  onEdit: async () => false,
  onDelete: () => {},
  onSubmitComment: async () => false,
  onOpenThread: () => {},
  onCloseThread: () => {},
  onFetchReplies: async () => {},
  setRepliesForComment: () => {},
  clearTargetHighlight: () => {},

  // State accessors
  isCommentLiked: () => false,
  getCurrentUserId: () => undefined,
  isCurrentUser: () => false,
  getDisplayName: () => 'Anonymous',

  // Comment data
  comments: [],
  totalCount: 0,
  isLoading: false,
  isInitialized: false,
  hasMore: false,
  loadMore: () => {},
  isLoadingMore: false,

  // Thread state
  activeThreadCommentId: null,
  threadParentComment: null,
  threadReplies: [],

  // Deep-link state
  targetCommentId: null,
  targetCommentHighlight: false,
};

/**
 * Comment Context
 */
export const CommentContext = createContext<CommentContextValue>(defaultContextValue);

/**
 * Hook to access comment context
 * Throws if used outside a CommentProvider
 */
export function useComments(): CommentContextValue {
  const context = useContext(CommentContext);

  // In development, warn if context appears to be the default (no provider)
  if (__DEV__ && context === defaultContextValue) {
    console.warn(
      '[useComments] Using default context. Make sure to wrap your component tree with DevotionCommentProvider or PlanCommentProvider.'
    );
  }

  return context;
}

/**
 * Hook to access just the features configuration
 */
export function useCommentFeatures(): CommentFeatures {
  const { features } = useComments();
  return features;
}

/**
 * Hook to check if current user is the author of a comment
 */
export function useIsCommentAuthor(userId: string): boolean {
  const { isCurrentUser } = useComments();
  return isCurrentUser(userId);
}

/**
 * Hook to check if a comment is liked by current user
 */
export function useIsCommentLiked(commentId: string): boolean {
  const { isCommentLiked } = useComments();
  return isCommentLiked(commentId);
}

/**
 * Provider props interface for concrete providers
 */
export interface CommentProviderProps {
  children: React.ReactNode;
}
