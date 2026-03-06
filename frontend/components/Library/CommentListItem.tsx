/**
 * CommentListItem - Comment card for Library display
 * Shows question context, comment content, and metadata
 */

import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { observer } from "@legendapp/state/react";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/contexts/ThemeContext";
import type { CommentWithQuestion } from "@/state";

interface CommentListItemProps {
  comment: CommentWithQuestion;
  onPress: () => void;
}

const CommentListItem = observer(function CommentListItem({
  comment,
  onPress,
}: CommentListItemProps) {
  const { theme } = useTheme();

  // Format timestamp
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffDays < 1) {
      const diffHours = Math.floor(diffMs / 3600000);
      if (diffHours < 1) {
        const diffMins = Math.floor(diffMs / 60000);
        return diffMins < 1 ? "Just now" : `${diffMins}m ago`;
      }
      return `${diffHours}h ago`;
    }
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  };

  // Truncate text with ellipsis
  const truncate = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength).trim() + "...";
  };

  const isReply = !!comment.parent_comment_id;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        {
          backgroundColor: pressed
            ? theme.colors.background.secondary
            : theme.colors.background.primary,
          borderBottomColor: theme.colors.border,
        },
      ]}
    >
      {/* Question context */}
      <View style={styles.questionContext}>
        <Ionicons
          name="help-circle-outline"
          size={14}
          color={theme.colors.text.muted}
        />
        <Text
          style={[styles.questionText, { color: theme.colors.text.muted }]}
          numberOfLines={2}
        >
          {truncate(comment.questionText, 100)}
        </Text>
      </View>

      {/* Comment content */}
      <View style={styles.commentContent}>
        {isReply && (
          <View style={styles.replyBadge}>
            <Ionicons
              name="return-down-forward"
              size={12}
              color={theme.colors.text.muted}
            />
            <Text style={[styles.replyLabel, { color: theme.colors.text.muted }]}>
              Reply
            </Text>
          </View>
        )}
        <Text
          style={[styles.contentText, { color: theme.colors.text.primary }]}
          numberOfLines={3}
        >
          {comment.content}
        </Text>
      </View>

      {/* Metadata row */}
      <View style={styles.metaRow}>
        <View style={styles.statsRow}>
          {/* Like count */}
          <View style={styles.stat}>
            <Ionicons
              name="heart"
              size={12}
              color={theme.colors.text.muted}
            />
            <Text style={[styles.statText, { color: theme.colors.text.muted }]}>
              {comment.like_count || 0}
            </Text>
          </View>

          {/* Reply count (only for top-level) */}
          {!isReply && (comment.reply_count || 0) > 0 && (
            <View style={styles.stat}>
              <Ionicons
                name="chatbubble-outline"
                size={12}
                color={theme.colors.text.muted}
              />
              <Text style={[styles.statText, { color: theme.colors.text.muted }]}>
                {comment.reply_count}
              </Text>
            </View>
          )}

          {/* Timestamp */}
          <Text style={[styles.timestamp, { color: theme.colors.text.muted }]}>
            {formatTime(comment.created_at)}
          </Text>
        </View>

        {/* Navigation indicator */}
        <View style={styles.navIndicator}>
          <Text style={[styles.navText, { color: theme.colors.accent }]}>
            View
          </Text>
          <Ionicons
            name="chevron-forward"
            size={14}
            color={theme.colors.accent}
          />
        </View>
      </View>
    </Pressable>
  );
});

export default CommentListItem;

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  questionContext: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    marginBottom: 8,
  },
  questionText: {
    flex: 1,
    fontSize: 12,
    fontStyle: "italic",
    lineHeight: 16,
  },
  commentContent: {
    marginBottom: 8,
  },
  replyBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 4,
  },
  replyLabel: {
    fontSize: 11,
    fontWeight: "500",
  },
  contentText: {
    fontSize: 14,
    lineHeight: 20,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  stat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statText: {
    fontSize: 12,
  },
  timestamp: {
    fontSize: 12,
  },
  navIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  navText: {
    fontSize: 12,
    fontWeight: "500",
  },
});
