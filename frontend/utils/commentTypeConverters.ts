/**
 * Comment Type Converters
 * Utilities to convert between store-specific comment types and UnifiedComment
 */

import type { UnifiedComment } from '@/types/comments';
import type { CommentWithUser } from '@/state/devotionStore';
import type { SessionCommentWithUser } from '@/state/planStore';

/**
 * Convert a Devotion comment (from apologetics) to UnifiedComment
 */
export function devotionCommentToUnified(
  comment: CommentWithUser,
  questionId: string
): UnifiedComment {
  return {
    id: comment.id,
    contextId: questionId,
    user_id: comment.user_id,
    parent_comment_id: comment.parent_comment_id,
    content: comment.content,
    like_count: comment.like_count,
    reply_count: comment.reply_count,
    status: comment.status,
    created_at: comment.created_at,
    updated_at: comment.updated_at,

    // Devotion-specific fields
    is_anonymous: comment.is_anonymous,
    is_humans_only: comment.is_humans_only,
    is_ai_generated: comment.is_ai_generated,
    ai_review_status: comment.ai_review_status,

    // Convert nested replies recursively
    replies: comment.replies?.map((reply) =>
      devotionCommentToUnified(reply, questionId)
    ),
  };
}

/**
 * Convert a Plan Session comment to UnifiedComment
 */
export function sessionCommentToUnified(
  comment: SessionCommentWithUser,
  sharedSessionId: string
): UnifiedComment {
  return {
    id: comment.id,
    contextId: sharedSessionId,
    user_id: comment.user_id,
    parent_comment_id: comment.parent_comment_id,
    content: comment.content,
    like_count: comment.like_count,
    reply_count: comment.reply_count,
    status: comment.status,
    created_at: comment.created_at,
    updated_at: comment.updated_at,

    // Plan-specific fields (convert null to undefined)
    day_number: comment.day_number ?? undefined,

    // Devotion-specific fields are undefined for session comments
    is_anonymous: undefined,
    is_humans_only: undefined,
    is_ai_generated: undefined,
    ai_review_status: undefined,

    // Convert nested replies recursively
    replies: comment.replies?.map((reply) =>
      sessionCommentToUnified(reply, sharedSessionId)
    ),
  };
}

/**
 * Convert an array of Devotion comments to UnifiedComment[]
 */
export function devotionCommentsToUnified(
  comments: CommentWithUser[],
  questionId: string
): UnifiedComment[] {
  return comments.map((comment) => devotionCommentToUnified(comment, questionId));
}

/**
 * Convert an array of Session comments to UnifiedComment[]
 */
export function sessionCommentsToUnified(
  comments: SessionCommentWithUser[],
  sharedSessionId: string
): UnifiedComment[] {
  return comments.map((comment) => sessionCommentToUnified(comment, sharedSessionId));
}

/**
 * Filter active comments only
 */
export function filterActiveComments(comments: UnifiedComment[]): UnifiedComment[] {
  return comments.filter((comment) => comment.status === 'active');
}

/**
 * Filter active replies on a comment
 */
export function filterActiveReplies(comment: UnifiedComment): UnifiedComment[] {
  return comment.replies?.filter((reply) => reply.status === 'active') || [];
}
