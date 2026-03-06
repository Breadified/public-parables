/**
 * Card - Unified comment card for both Devotion and Plan Sessions
 * Uses CommentContext for actions instead of direct store access
 * Feature flags control which features are enabled
 */

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Alert,
} from "react-native";
import { observer } from "@legendapp/state/react";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  withDelay,
} from "react-native-reanimated";

import { useTheme } from "@/contexts/ThemeContext";
import { useToast } from "@/contexts/ToastContext";
import { useComments } from "@/contexts/CommentContext";
import { useDisplayName } from "@/hooks/useDisplayName";
import { isAiAgent, getAiDisclaimer } from "@/constants/aiAgents";
import type { UnifiedComment } from "@/types/comments";
import AvatarWithLevel from "@/components/AvatarWithLevel";
import RichText from "./RichText";

// Avatar size - increased for better level badge visibility
const AVATAR_SIZE = 28;

// Default max height for collapsed comments (approximately 5 lines of text)
const DEFAULT_MAX_HEIGHT = 100;

interface CardProps {
  comment: UnifiedComment;
  isReply?: boolean;
  isThreadParent?: boolean; // When showing as parent in thread view
  onReply?: (commentId: string) => void;
  maxHeight?: number; // Max height before truncation (default: 100)
  isHighlighted?: boolean; // For deep-link navigation highlight animation
}

const Card = observer(function Card({
  comment,
  isReply = false,
  isThreadParent = false,
  onReply,
  maxHeight = DEFAULT_MAX_HEIGHT,
  isHighlighted = false,
}: CardProps) {
  const { theme } = useTheme();
  const { showDeleteCommentToast } = useToast();

  // Get actions and state from context
  const {
    features,
    onLike,
    onEdit,
    onDelete,
    onOpenThread,
    isCommentLiked,
    getCurrentUserId,
    isCurrentUser,
    getDisplayName,
    clearTargetHighlight,
  } = useComments();

  const [isExpanded, setIsExpanded] = useState(isThreadParent); // Thread parent starts expanded
  const [isTruncated, setIsTruncated] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);

  // Highlight animation for deep-link navigation
  const highlightOpacity = useSharedValue(0);

  useEffect(() => {
    if (isHighlighted) {
      // Pulse animation: fade in, hold, fade out
      highlightOpacity.value = withSequence(
        withTiming(1, { duration: 300 }),
        withDelay(1500, withTiming(0, { duration: 500 }))
      );

      // Clear highlight state after animation
      const timer = setTimeout(() => {
        clearTargetHighlight();
      }, 2300);

      return () => clearTimeout(timer);
    }
  }, [isHighlighted]);

  const highlightStyle = useAnimatedStyle(() => ({
    backgroundColor: `rgba(255, 200, 50, ${highlightOpacity.value * 0.25})`,
  }));

  // Check if current user is author
  const currentUserId = getCurrentUserId();
  const isAuthor = isCurrentUser(comment.user_id);

  // Check if this is an AI-generated comment (only if feature enabled)
  const isAiComment = features.showAiIndicator &&
    (isAiAgent(comment.user_id) || comment.is_ai_generated);
  const aiDisclaimer = isAiComment ? getAiDisclaimer(comment.user_id) : null;

  // Get formatted display name
  const userName = useDisplayName(comment.user_id);

  // Display name logic: show "Anonymous" for anonymous comments (only if feature enabled)
  const displayName = features.showAnonymous && comment.is_anonymous
    ? isAuthor
      ? "Anonymous (by you)"
      : "Anonymous"
    : userName;

  const isLiked = isCommentLiked(comment.id);

  const handleLike = () => {
    onLike(comment.id);
  };

  const handleMenuPress = () => {
    setShowMenu(!showMenu);
  };

  const handleEdit = () => {
    setShowMenu(false);
    setEditContent(comment.content);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditContent(comment.content);
  };

  const handleSaveEdit = async () => {
    if (!editContent.trim()) return;

    const success = await onEdit(comment.id, editContent.trim());
    if (success) {
      setIsEditing(false);
    } else {
      Alert.alert("Error", "Failed to update comment. Please try again.");
    }
  };

  const handleDelete = () => {
    setShowMenu(false);
    // Delete immediately with undo toast (no confirmation dialog)
    showDeleteCommentToast(comment.id);
  };

  const handleReplyPress = () => {
    if (onReply) {
      onReply(comment.id);
    } else if (onOpenThread) {
      // No specific reply handler, open thread and trigger reply mode
      onOpenThread(comment.id);
    }
  };

  const handleRepliesPress = () => {
    if (onOpenThread) {
      onOpenThread(comment.id);
    }
  };

  const handleTruncationChange = (truncated: boolean) => {
    setIsTruncated(truncated);
  };

  const handleReadMore = () => {
    setIsExpanded(true);
  };

  const handleShowLess = () => {
    setIsExpanded(false);
  };

  // Format timestamp - shows relative time or date
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    // For older comments, show full date
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  };

  const replyCount = comment.reply_count || 0;

  // Check if edit is allowed (feature flag + is author)
  const canEdit = features.allowEdit && isAuthor;

  return (
    <Animated.View
      style={[
        styles.container,
        isReply && styles.replyContainer,
        { borderBottomColor: theme.colors.border },
        highlightStyle,
      ]}
    >
      {/* Content */}
      <View style={styles.content}>
        {/* Header: Avatar + Name + Time + Menu */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {/* User Avatar with Level Badge */}
            <AvatarWithLevel
              userId={comment.user_id}
              displayName={displayName}
              size={AVATAR_SIZE}
              isAnonymous={features.showAnonymous ? comment.is_anonymous : false}
              borderColor={isAiComment ? theme.colors.accent : undefined}
            />
            <Text
              style={[styles.userName, { color: theme.colors.text.primary }]}
            >
              {displayName}
            </Text>
            <Text
              style={[styles.timestamp, { color: theme.colors.text.muted }]}
            >
              {formatTime(comment.created_at)}
            </Text>
          </View>

          {/* More options menu (only for author when edit is allowed) */}
          {canEdit && !isEditing && (
            <Pressable onPress={handleMenuPress} style={styles.menuButton}>
              <Ionicons
                name="ellipsis-horizontal"
                size={16}
                color={theme.colors.text.muted}
              />
            </Pressable>
          )}
        </View>

        {/* Dropdown Menu */}
        {showMenu && (
          <View
            style={[
              styles.menu,
              {
                backgroundColor: theme.colors.background.elevated,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <Pressable onPress={handleEdit} style={styles.menuItem}>
              <Ionicons
                name="pencil-outline"
                size={16}
                color={theme.colors.text.secondary}
              />
              <Text
                style={[
                  styles.menuItemText,
                  { color: theme.colors.text.secondary },
                ]}
              >
                Edit
              </Text>
            </Pressable>
            <Pressable onPress={handleDelete} style={styles.menuItem}>
              <Ionicons name="trash-outline" size={16} color="#EF4444" />
              <Text style={[styles.menuItemText, { color: "#EF4444" }]}>
                Delete
              </Text>
            </Pressable>
          </View>
        )}

        {/* Edit Mode */}
        {isEditing ? (
          <View style={styles.editContainer}>
            <TextInput
              style={[
                styles.editInput,
                {
                  color: theme.colors.text.primary,
                  backgroundColor: theme.colors.background.secondary,
                  borderColor: theme.colors.border,
                },
              ]}
              value={editContent}
              onChangeText={setEditContent}
              multiline
              autoFocus
            />
            <View style={styles.editActions}>
              <Pressable onPress={handleCancelEdit} style={styles.editButton}>
                <Text
                  style={[
                    styles.editButtonText,
                    { color: theme.colors.text.muted },
                  ]}
                >
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                onPress={handleSaveEdit}
                style={[
                  styles.editButton,
                  styles.saveButton,
                  { backgroundColor: theme.colors.accent },
                ]}
              >
                <Text style={[styles.editButtonText, { color: "#FFFFFF" }]}>
                  Save
                </Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <>
            {/* Comment Text with truncation */}
            {/* Rich text rendering based on feature flag */}
            <Pressable
              onPress={isTruncated && !isExpanded ? handleReadMore : undefined}
              disabled={!isTruncated || isExpanded}
            >
              {features.enableRichText ? (
                <RichText
                  content={comment.content}
                  textStyle={[
                    styles.commentText,
                    { color: theme.colors.text.secondary },
                  ]}
                  maxHeight={isThreadParent ? undefined : maxHeight}
                  onTruncationChange={handleTruncationChange}
                  isExpanded={isExpanded}
                />
              ) : (
                <Text
                  style={[
                    styles.commentText,
                    { color: theme.colors.text.secondary },
                  ]}
                  numberOfLines={isExpanded ? undefined : 5}
                >
                  {comment.content}
                </Text>
              )}
            </Pressable>

            {/* Read More button - shown below the faded content */}
            {isTruncated && !isExpanded && (
              <Pressable
                onPress={handleReadMore}
                style={styles.readMoreButton}
              >
                <Text
                  style={[styles.readMore, { color: theme.colors.accent }]}
                >
                  Read more...
                </Text>
              </Pressable>
            )}

            {/* Show Less button - shown when expanded */}
            {isTruncated && isExpanded && (
              <Pressable
                onPress={handleShowLess}
                style={styles.readMoreButton}
              >
                <Text
                  style={[styles.readMore, { color: theme.colors.accent }]}
                >
                  Show less
                </Text>
              </Pressable>
            )}
          </>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          {/* Like Button */}
          <Pressable onPress={handleLike} style={styles.actionButton}>
            <Ionicons
              name={isLiked ? "heart" : "heart-outline"}
              size={16}
              color={isLiked ? "#EF4444" : theme.colors.text.muted}
            />
            {(comment.like_count || 0) > 0 && (
              <Text
                style={[
                  styles.actionText,
                  { color: isLiked ? "#EF4444" : theme.colors.text.muted },
                ]}
              >
                {comment.like_count}
              </Text>
            )}
          </Pressable>

          {/* Reply Button (not shown for replies in thread view - already in reply mode) */}
          {!isReply && (
            <Pressable onPress={handleReplyPress} style={styles.actionButton}>
              <Ionicons
                name="chatbubble-outline"
                size={16}
                color={theme.colors.text.muted}
              />
              <Text
                style={[styles.actionText, { color: theme.colors.text.muted }]}
              >
                Reply
              </Text>
            </Pressable>
          )}

          {/* Reply Count Badge (only for top-level with replies, not in thread view) */}
          {!isReply && !isThreadParent && replyCount > 0 && (
            <Pressable
              onPress={handleRepliesPress}
              style={styles.actionButton}
            >
              <Text
                style={[styles.replyCount, { color: theme.colors.accent }]}
              >
                {replyCount} {replyCount === 1 ? "reply" : "replies"}
              </Text>
              <Ionicons
                name="chevron-forward"
                size={14}
                color={theme.colors.accent}
              />
            </Pressable>
          )}

          {/* Reply icon for top-level with no replies (tap to go to thread + reply mode) */}
          {!isReply && !isThreadParent && replyCount === 0 && (
            <Pressable
              onPress={handleReplyPress}
              style={styles.actionButton}
            >
              <Ionicons
                name="arrow-redo-outline"
                size={16}
                color={theme.colors.text.muted}
              />
            </Pressable>
          )}
        </View>

        {/* AI Disclaimer Footer (only if feature enabled) */}
        {isAiComment && aiDisclaimer && (
          <View style={styles.aiDisclaimer}>
            <Text
              style={[
                styles.aiDisclaimerText,
                { color: theme.colors.text.muted },
              ]}
            >
              {aiDisclaimer}
            </Text>
          </View>
        )}

        {/* Humans Only Footnote - shown when comment is marked as humans only */}
        {comment.is_humans_only && (
          <Text
            style={[
              styles.humansOnlyFootnote,
              { color: theme.colors.text.muted },
            ]}
          >
            {comment.parent_comment_id
              ? "AI will not reply back to this comment"
              : "AI will not reply in this thread"}
          </Text>
        )}
      </View>
    </Animated.View>
  );
});

export default Card;

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  replyContainer: {
    paddingLeft: 32,
    paddingVertical: 10,
    borderBottomWidth: 0,
  },
  content: {
    gap: 4,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  userName: {
    fontSize: 14,
    fontWeight: "600",
  },
  timestamp: {
    fontSize: 12,
  },
  menuButton: {
    padding: 4,
  },
  menu: {
    position: "absolute",
    top: 24,
    right: 0,
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: 4,
    zIndex: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  menuItemText: {
    fontSize: 14,
  },
  editContainer: {
    gap: 8,
  },
  editInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    lineHeight: 20,
    minHeight: 60,
    textAlignVertical: "top",
  },
  editActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  editButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  saveButton: {
    minWidth: 60,
    alignItems: "center",
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: "500",
  },
  commentText: {
    fontSize: 14,
    lineHeight: 20,
  },
  readMoreButton: {
    paddingTop: 4,
  },
  readMore: {
    fontSize: 13,
    fontWeight: "500",
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginTop: 6,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
  },
  actionText: {
    fontSize: 12,
    fontWeight: "500",
  },
  replyCount: {
    fontSize: 12,
    fontWeight: "600",
  },
  aiDisclaimer: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(128, 128, 128, 0.2)",
  },
  aiDisclaimerText: {
    fontSize: 11,
    fontStyle: "italic",
  },
  humansOnlyFootnote: {
    fontSize: 11,
    fontStyle: "italic",
    marginTop: 6,
  },
});
