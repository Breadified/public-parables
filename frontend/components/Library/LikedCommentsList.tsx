/**
 * LikedCommentsList - List of comments the user has liked
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
import { fetchUserLikedComments } from "@/services/apologeticsService";
import { getQuestionById, getDateForQuestionIndex } from "@/modules/devotion/questionUtils";
import { useFlashListConfig } from "@/hooks/useFlashListConfig";
import CommentListItem from "./CommentListItem";

const LikedCommentsList = observer(function LikedCommentsList() {
  const { theme } = useTheme();
  const { user } = useUnifiedAuth();

  // FlashList config
  const flashListConfig = useFlashListConfig({
    estimatedItemSize: 120,
    loadMoreThreshold: 0.5,
  });

  // Use .get() for comments to avoid circular reference TypeScript error with replies
  const comments = libraryStore$.likedComments.get();
  const isLoading = useSelector(libraryStore$.likedCommentsLoading);
  const hasMore = useSelector(libraryStore$.likedCommentsHasMore);
  const initialized = useSelector(libraryStore$.likedCommentsInitialized);

  // Load initial liked comments
  useEffect(() => {
    if (!user?.id || initialized) return;

    const loadComments = async () => {
      libraryStore$.setLikedCommentsLoading(true);
      try {
        const { comments: fetchedComments, hasMore: more } = await fetchUserLikedComments(
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

        libraryStore$.setLikedComments(enrichedComments);
        libraryStore$.setLikedCommentsHasMore(more);
        libraryStore$.likedCommentsInitialized.set(true);
      } catch (error) {
        console.error("[LikedCommentsList] Error loading comments:", error);
      } finally {
        libraryStore$.setLikedCommentsLoading(false);
      }
    };

    loadComments();
  }, [user?.id, initialized]);

  // Handle load more
  const handleLoadMore = useCallback(async () => {
    if (!user?.id || isLoading || !hasMore) return;

    libraryStore$.setLikedCommentsLoading(true);
    try {
      const nextPage = libraryStore$.likedCommentsPage.get() + 1;
      const { comments: moreComments, hasMore: more } = await fetchUserLikedComments(
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

      libraryStore$.appendLikedComments(enrichedComments);
      libraryStore$.incrementLikedCommentsPage();
      libraryStore$.setLikedCommentsHasMore(more);
    } catch (error) {
      console.error("[LikedCommentsList] Error loading more:", error);
    } finally {
      libraryStore$.setLikedCommentsLoading(false);
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
          Sign in to see liked comments
        </Text>
        <Text style={[styles.emptySubtitle, { color: theme.colors.text.muted }]}>
          Your liked comments will appear here after signing in
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
          Loading liked comments...
        </Text>
      </View>
    );
  }

  // Empty state
  if (comments.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons
          name="heart-outline"
          size={48}
          color={theme.colors.text.muted}
        />
        <Text style={[styles.emptyTitle, { color: theme.colors.text.secondary }]}>
          No liked comments yet
        </Text>
        <Text style={[styles.emptySubtitle, { color: theme.colors.text.muted }]}>
          Like comments on daily questions to see them here
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

export default LikedCommentsList;

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
