/**
 * MyCommentsList - List of user's own comments
 * Fetches from Supabase and displays with question context
 */

import React, { useEffect, useCallback } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { observer, useSelector } from "@legendapp/state/react";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

import { useTheme } from "@/contexts/ThemeContext";
import { useUnifiedAuth } from "@/hooks/useUnifiedAuth";
import { libraryStore$ } from "@/state";
import type { CommentWithQuestion } from "@/state";
import { fetchUserComments } from "@/services/apologeticsService";
import { getQuestionById, getDateForQuestionIndex } from "@/modules/devotion/questionUtils";
import { useFlashListConfig } from "@/hooks/useFlashListConfig";
import CommentListItem from "./CommentListItem";

const MyCommentsList = observer(function MyCommentsList() {
  const { theme } = useTheme();
  const { user } = useUnifiedAuth();

  // FlashList config
  const flashListConfig = useFlashListConfig({
    estimatedItemSize: 120,
    loadMoreThreshold: 0.5,
  });

  // Use .get() for comments to avoid circular reference TypeScript error with replies
  const comments = libraryStore$.myComments.get();
  const isLoading = useSelector(libraryStore$.myCommentsLoading);
  const hasMore = useSelector(libraryStore$.myCommentsHasMore);
  const initialized = useSelector(libraryStore$.myCommentsInitialized);

  // Load initial comments
  useEffect(() => {
    if (!user?.id || initialized) return;

    const loadComments = async () => {
      libraryStore$.setMyCommentsLoading(true);
      try {
        const { comments: fetchedComments, hasMore: more } = await fetchUserComments(
          user.id,
          0
        );

        // Filter to devotion comments only (where question_id exists) and enrich with question context
        const enrichedComments: CommentWithQuestion[] = fetchedComments
          .filter((comment) => comment.question_id !== null)
          .map((comment) => {
            const questionId = comment.question_id!;
            const question = getQuestionById(questionId);
            return {
              ...comment,
              questionText: question?.questionText || "Unknown question",
              questionId,
              questionOrderIndex: question?.orderIndex || 0,
            };
          });

        libraryStore$.setMyComments(enrichedComments);
        libraryStore$.setMyCommentsHasMore(more);
        libraryStore$.myCommentsInitialized.set(true);
      } catch (error) {
        console.error("[MyCommentsList] Error loading comments:", error);
      } finally {
        libraryStore$.setMyCommentsLoading(false);
      }
    };

    loadComments();
  }, [user?.id, initialized]);

  // Handle load more
  const handleLoadMore = useCallback(async () => {
    if (!user?.id || isLoading || !hasMore) return;

    libraryStore$.setMyCommentsLoading(true);
    try {
      const nextPage = libraryStore$.myCommentsPage.get() + 1;
      const { comments: moreComments, hasMore: more } = await fetchUserComments(
        user.id,
        nextPage
      );

      // Filter to devotion comments only and enrich with question context
      const enrichedComments: CommentWithQuestion[] = moreComments
        .filter((comment) => comment.question_id !== null)
        .map((comment) => {
          const questionId = comment.question_id!;
          const question = getQuestionById(questionId);
          return {
            ...comment,
            questionText: question?.questionText || "Unknown question",
            questionId,
            questionOrderIndex: question?.orderIndex || 0,
          };
        });

      libraryStore$.appendMyComments(enrichedComments);
      libraryStore$.incrementMyCommentsPage();
      libraryStore$.setMyCommentsHasMore(more);
    } catch (error) {
      console.error("[MyCommentsList] Error loading more:", error);
    } finally {
      libraryStore$.setMyCommentsLoading(false);
    }
  }, [user?.id, isLoading, hasMore]);

  // Handle comment press - navigate to devotion with deep-link
  const handleCommentPress = useCallback((comment: CommentWithQuestion) => {
    const date = getDateForQuestionIndex(comment.questionOrderIndex);

    router.replace({
      pathname: "/(tabs)/devotion",
      params: {
        date,
        targetCommentId: comment.id,
        targetQuestionId: comment.questionId,
      },
    });
  }, []);

  // Render comment item
  const renderComment = useCallback(
    ({ item }: { item: CommentWithQuestion }) => (
      <CommentListItem comment={item} onPress={() => handleCommentPress(item)} />
    ),
    [handleCommentPress]
  );

  // Loading footer
  const renderFooter = useCallback(() => {
    if (!isLoading || comments.length === 0) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={theme.colors.accent} />
      </View>
    );
  }, [isLoading, comments.length, theme.colors.accent]);

  // Not authenticated
  if (!user) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons
          name="person-outline"
          size={48}
          color={theme.colors.text.muted}
        />
        <Text style={[styles.emptyTitle, { color: theme.colors.text.secondary }]}>
          Sign in to see your comments
        </Text>
        <Text style={[styles.emptySubtitle, { color: theme.colors.text.muted }]}>
          Your comments will appear here after signing in
        </Text>
      </View>
    );
  }

  // Initial loading
  if (isLoading && comments.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
        <Text style={[styles.loadingText, { color: theme.colors.text.muted }]}>
          Loading your comments...
        </Text>
      </View>
    );
  }

  // Empty state
  if (comments.length === 0) {
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
          Share your thoughts on daily questions to see them here
        </Text>
      </View>
    );
  }

  return (
    <FlashList
      data={comments as CommentWithQuestion[]}
      renderItem={renderComment}
      keyExtractor={(item) => item.id}
      onEndReached={handleLoadMore}
      ListFooterComponent={renderFooter}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={true}
      {...flashListConfig.props}
    />
  );
});

export default MyCommentsList;

const styles = StyleSheet.create({
  listContent: {
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  footerLoader: {
    padding: 16,
    alignItems: "center",
  },
});
