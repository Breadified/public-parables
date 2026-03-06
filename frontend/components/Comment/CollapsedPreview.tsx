/**
 * CollapsedPreview - Shows top comment with gradient fade
 * Pressable to expand into full comments mode
 * Uses CommentContext for data instead of direct store access
 */

import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@/contexts/ThemeContext";
import { useComments } from "@/contexts/CommentContext";
import { useDisplayName } from "@/hooks/useDisplayName";
import AvatarWithLevel from "@/components/AvatarWithLevel";
import RichText from "./RichText";

// Max height for collapsed preview (approximately 2 lines)
const PREVIEW_MAX_HEIGHT = 44;

interface CollapsedPreviewProps {
  onPress: () => void;
}

interface TopCommentPreviewProps {
  userId: string;
  content: string;
}

// Separate component to use hook properly (hooks can't be conditional)
const TopCommentPreview = ({ userId, content }: TopCommentPreviewProps) => {
  const { theme } = useTheme();
  const displayName = useDisplayName(userId);

  return (
    <View style={styles.commentPreview}>
      {/* Avatar with Level Badge */}
      <AvatarWithLevel userId={userId} displayName={displayName} size={28} />

      {/* Comment Content */}
      <View style={styles.commentContent}>
        <Text style={[styles.username, { color: theme.colors.text.secondary }]}>
          {displayName}
        </Text>
        <RichText
          content={content}
          textStyle={[styles.commentText, { color: theme.colors.text.primary }]}
          maxHeight={PREVIEW_MAX_HEIGHT}
          isExpanded={false}
          backgroundColor={theme.colors.background.elevated}
        />
      </View>
    </View>
  );
};

const CollapsedPreview = ({ onPress }: CollapsedPreviewProps) => {
  const { theme } = useTheme();

  // Get comment data from context
  const { comments, totalCount, isInitialized, isLoading } = useComments();

  const topComment = comments.length > 0 ? comments[0] : null;
  const showLoading = !isInitialized || isLoading;

  return (
    <View style={styles.outerContainer}>
      <Pressable
        onPress={onPress}
        style={[
          styles.container,
          {
            backgroundColor: theme.colors.background.elevated,
            borderColor: theme.colors.border,
          },
        ]}
      >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons
            name="chatbubble-outline"
            size={16}
            color={theme.colors.text.muted}
          />
          <Text style={[styles.headerText, { color: theme.colors.text.secondary }]}>
            {showLoading
              ? "Loading comments..."
              : totalCount === 0
              ? "No comments yet"
              : totalCount === 1
              ? "1 comment"
              : `${totalCount} comments`}
          </Text>
        </View>
        <Ionicons
          name="chevron-up"
          size={18}
          color={theme.colors.text.muted}
        />
      </View>

      {/* Loading state */}
      {showLoading && (
        <View style={styles.emptyState}>
          <ActivityIndicator size="small" color={theme.colors.accent} />
        </View>
      )}

      {/* Top Comment Preview */}
      {!showLoading && topComment && (
        <TopCommentPreview
          userId={topComment.user_id}
          content={topComment.content}
        />
      )}

      {/* Empty state - only show after loading complete */}
      {!showLoading && !topComment && (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyText, { color: theme.colors.text.muted }]}>
            Be the first to share your thoughts
          </Text>
        </View>
      )}
      </Pressable>
    </View>
  );
};

export default CollapsedPreview;

const styles = StyleSheet.create({
  outerContainer: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  container: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  headerText: {
    fontSize: 13,
    fontWeight: "500",
  },
  commentPreview: {
    flexDirection: "row",
    gap: 10,
  },
  commentContent: {
    flex: 1,
  },
  username: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 2,
  },
  commentText: {
    fontSize: 14,
    lineHeight: 20,
  },
  emptyState: {
    paddingVertical: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
  },
});
