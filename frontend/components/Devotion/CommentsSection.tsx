/**
 * CommentsSection - FlashList of comments with infinite scroll
 * Features: Pagination, real-time updates, empty state
 */

import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import { observer, useSelector } from "@legendapp/state/react";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@/contexts/ThemeContext";
import { devotionStore$, activeComments$, totalCommentCount$ } from "@/state";
import { useFlashListConfig } from "@/hooks/useFlashListConfig";
import type { CommentWithUser } from "@/state";

import CommentCard from "./CommentCard";
import CommentInput from "./CommentInput";

interface CommentsSectionProps {
  questionId: string;
}

const CommentsSection = observer(function CommentsSection({
  questionId,
}: CommentsSectionProps) {
  const { theme } = useTheme();

  // FlashList config for high-performance virtualization (100k+ comments)
  const flashListConfig = useFlashListConfig({
    estimatedItemSize: 120,
    loadMoreThreshold: 0.5,
  });

  const comments = useSelector(activeComments$);
  const totalCount = useSelector(totalCommentCount$);
  const isLoading = useSelector(devotionStore$.isCommentsLoading);
  const isLoadingMore = useSelector(devotionStore$.isLoadingMore);
  const hasMore = useSelector(devotionStore$.commentsHasMore);
  const newCommentsCount = useSelector(devotionStore$.newCommentsCount);
  const commentsInitialized = useSelector(devotionStore$.commentsInitialized);

  const handleLoadMore = () => {
    if (!isLoadingMore && hasMore) {
      // TODO: Implement load more via apologetics service
      console.log("[CommentsSection] Load more comments");
    }
  };

  const renderComment = ({ item }: { item: CommentWithUser }) => (
    <CommentCard comment={item} />
  );

  const keyExtractor = (item: CommentWithUser) => item.id;

  const ListHeaderComponent = () => (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <Ionicons
          name="chatbubbles-outline"
          size={18}
          color={theme.colors.text.primary}
        />
        <Text style={[styles.headerTitle, { color: theme.colors.text.primary }]}>
          Comments {totalCount > 0 && `(${totalCount})`}
        </Text>
      </View>

      {/* New comments indicator */}
      {newCommentsCount > 0 && (
        <Pressable
          style={[
            styles.newCommentsButton,
            { backgroundColor: theme.colors.accent },
          ]}
          onPress={() => {
            // Scroll to top and clear indicator
            devotionStore$.newCommentsCount.set(0);
          }}
        >
          <Text style={styles.newCommentsText}>
            {newCommentsCount} new {newCommentsCount === 1 ? "comment" : "comments"}
          </Text>
        </Pressable>
      )}
    </View>
  );

  const ListEmptyComponent = () => {
    // Show loading until comments have been initialized (first load complete)
    if (!commentsInitialized || isLoading) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="small" color={theme.colors.accent} />
          <Text style={[styles.emptyText, { color: theme.colors.text.muted }]}>
            Loading comments...
          </Text>
        </View>
      );
    }

    // Only show "No comments" after we've confirmed there are none
    return (
      <View style={styles.emptyContainer}>
        <Ionicons
          name="chatbubble-outline"
          size={48}
          color={theme.colors.text.muted}
        />
        <Text style={[styles.emptyTitle, { color: theme.colors.text.secondary }]}>
          No comments yet
        </Text>
        <Text style={[styles.emptySubtitle, { color: theme.colors.text.muted }]}>
          Be the first to share your thoughts on this question
        </Text>
      </View>
    );
  };

  const ListFooterComponent = () => {
    if (!hasMore) return null;

    if (isLoadingMore) {
      return (
        <View style={styles.footer}>
          <ActivityIndicator size="small" color={theme.colors.accent} />
        </View>
      );
    }

    return null;
  };

  return (
    <View style={styles.container}>
      {/* Comment Input at top */}
      <CommentInput questionId={questionId} />

      {/* Comments List - FlashList for virtualization with 100k+ comments */}
      <FlashList
        data={comments}
        renderItem={renderComment}
        keyExtractor={keyExtractor}
        ListHeaderComponent={ListHeaderComponent}
        ListEmptyComponent={ListEmptyComponent}
        ListFooterComponent={ListFooterComponent}
        onEndReached={handleLoadMore}
        contentContainerStyle={styles.listContent}
        {...flashListConfig.props}
      />
    </View>
  );
});

export default CommentsSection;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  newCommentsButton: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  newCommentsText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "500",
  },
  listContent: {
    paddingBottom: 100, // Space for tab bar
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    paddingHorizontal: 32,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: "center",
  },
  emptyText: {
    fontSize: 14,
    marginTop: 8,
  },
  footer: {
    paddingVertical: 16,
    alignItems: "center",
  },
});
