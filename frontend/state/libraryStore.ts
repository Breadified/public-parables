/**
 * Library Store - My Content state management
 * Handles: user's comments, liked comments, segment switching
 */

import { observable } from "@legendapp/state";
import type { CommentWithUser } from "./devotionStore";

// Comment with question context for display in library
export interface CommentWithQuestion extends CommentWithUser {
  questionText: string;
  questionId: string;
  questionOrderIndex: number;
}

export type LibrarySegment = 'notes' | 'bookmarks' | 'comments' | 'liked';

export const libraryStore$ = observable({
  // Active segment
  activeSegment: 'notes' as LibrarySegment,

  // My Comments state
  myComments: [] as CommentWithQuestion[],
  myCommentsPage: 0,
  myCommentsHasMore: true,
  myCommentsLoading: false,
  myCommentsInitialized: false,

  // Liked Comments state
  likedComments: [] as CommentWithQuestion[],
  likedCommentsPage: 0,
  likedCommentsHasMore: true,
  likedCommentsLoading: false,
  likedCommentsInitialized: false,

  // Actions
  setActiveSegment: (segment: LibrarySegment) => {
    libraryStore$.activeSegment.set(segment);
  },

  // My Comments actions
  setMyComments: (comments: CommentWithQuestion[]) => {
    libraryStore$.myComments.set(comments);
  },

  appendMyComments: (comments: CommentWithQuestion[]) => {
    const current = libraryStore$.myComments.get();
    libraryStore$.myComments.set([...current, ...comments]);
  },

  setMyCommentsLoading: (loading: boolean) => {
    libraryStore$.myCommentsLoading.set(loading);
  },

  setMyCommentsHasMore: (hasMore: boolean) => {
    libraryStore$.myCommentsHasMore.set(hasMore);
  },

  incrementMyCommentsPage: () => {
    libraryStore$.myCommentsPage.set(libraryStore$.myCommentsPage.get() + 1);
  },

  resetMyComments: () => {
    libraryStore$.myComments.set([]);
    libraryStore$.myCommentsPage.set(0);
    libraryStore$.myCommentsHasMore.set(true);
    libraryStore$.myCommentsInitialized.set(false);
  },

  // Liked Comments actions
  setLikedComments: (comments: CommentWithQuestion[]) => {
    libraryStore$.likedComments.set(comments);
  },

  appendLikedComments: (comments: CommentWithQuestion[]) => {
    const current = libraryStore$.likedComments.get();
    libraryStore$.likedComments.set([...current, ...comments]);
  },

  setLikedCommentsLoading: (loading: boolean) => {
    libraryStore$.likedCommentsLoading.set(loading);
  },

  setLikedCommentsHasMore: (hasMore: boolean) => {
    libraryStore$.likedCommentsHasMore.set(hasMore);
  },

  incrementLikedCommentsPage: () => {
    libraryStore$.likedCommentsPage.set(libraryStore$.likedCommentsPage.get() + 1);
  },

  resetLikedComments: () => {
    libraryStore$.likedComments.set([]);
    libraryStore$.likedCommentsPage.set(0);
    libraryStore$.likedCommentsHasMore.set(true);
    libraryStore$.likedCommentsInitialized.set(false);
  },

  // Reset all library state
  resetAll: () => {
    libraryStore$.resetMyComments();
    libraryStore$.resetLikedComments();
    libraryStore$.activeSegment.set('notes');
  },
});
