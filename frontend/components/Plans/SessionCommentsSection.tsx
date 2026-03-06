/**
 * SessionCommentsSection - Container for comments in a shared plan session
 */

import React, { useEffect, useCallback, useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { observer, useSelector } from "@legendapp/state/react";
import { FlashList, ListRenderItemInfo } from "@shopify/flash-list";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@/contexts/ThemeContext";
import { planStore$, activeSessionComments$ } from "@/state";
import {
  loadCommentsForDay,
  loadMoreSessionComments,
} from "@/services/planService";
import { useUnifiedAuth } from "@/hooks/useUnifiedAuth";
import { useFlashListConfig } from "@/hooks/useFlashListConfig";
import Card from "@/components/Comment/Card";
import SessionCommentInput from "./SessionCommentInput";
import PlanCommentProvider from "./PlanCommentProvider";
import { sessionCommentToUnified } from "@/utils/commentTypeConverters";
import type { SessionCommentWithUser } from "@/state/planStore";

interface SessionCommentsSectionProps {
  sharedSessionId: string;
  dayNumber: number;
}

const SessionCommentsSection = observer(function SessionCommentsSection({
  sharedSessionId,
  dayNumber,
}: SessionCommentsSectionProps) {
  const { theme } = useTheme();
  const { user } = useUnifiedAuth();

  const comments = useSelector(activeSessionComments$);
  const loading = useSelector(() => planStore$.commentsLoading.get());
  const hasMore = useSelector(() => planStore$.commentsHasMore.get());
  const initialized = useSelector(() => planStore$.commentsInitialized.get());

  const [replyingTo, setReplyingTo] = useState<string | null>(null);

  // Total count includes top-level comments + all replies (YouTube-style)
  const totalCount = useMemo(() => {
    return comments.reduce((sum: number, c: SessionCommentWithUser) => sum + 1 + (c.reply_count || 0), 0);
  }, [comments]);

  const flashListConfig = useFlashListConfig({
    estimatedItemSize: 120,
  });

  // Load comments when day changes
  useEffect(() => {
    if (user?.id && sharedSessionId) {
      loadCommentsForDay(sharedSessionId, dayNumber, user.id);
    }
  }, [sharedSessionId, dayNumber, user?.id]);

  const handleLoadMore = useCallback(() => {
    if (hasMore && !loading) {
      loadMoreSessionComments(sharedSessionId, dayNumber);
    }
  }, [hasMore, loading, sharedSessionId, dayNumber]);

  const handleReplySubmit = useCallback(() => {
    setReplyingTo(null);
  }, []);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<SessionCommentWithUser>) => {
      const unifiedComment = sessionCommentToUnified(item, sharedSessionId);
      return <Card comment={unifiedComment} />;
    },
    [sharedSessionId]
  );

  const renderFooter = () => {
    if (!hasMore) return null;
    return (
      <View style={styles.loadMoreContainer}>
        {loading ? (
          <ActivityIndicator size="small" color={theme.colors.text.muted} />
        ) : (
          <Pressable onPress={handleLoadMore} style={styles.loadMoreButton}>
            <Text style={[styles.loadMoreText, { color: theme.colors.accent }]}>
              Load more comments
            </Text>
          </Pressable>
        )}
      </View>
    );
  };

  const renderEmpty = () => {
    if (loading && !initialized) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={theme.colors.text.muted} />
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <Ionicons
          name="chatbubbles-outline"
          size={40}
          color={theme.colors.text.muted}
        />
        <Text style={[styles.emptyTitle, { color: theme.colors.text.primary }]}>
          No Comments Yet
        </Text>
        <Text style={[styles.emptySubtitle, { color: theme.colors.text.muted }]}>
          {"Start the conversation about today's reading"}
        </Text>
      </View>
    );
  };

  // Get the parent comment if replying
  const replyParent = replyingTo
    ? comments.find((c: SessionCommentWithUser) => c.id === replyingTo)
    : null;

  return (
    <PlanCommentProvider sharedSessionId={sharedSessionId} dayNumber={dayNumber}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: theme.colors.text.primary }]}>
            Day {dayNumber} Discussion
          </Text>
          <View
            style={[
              styles.countBadge,
              { backgroundColor: theme.colors.background.secondary },
            ]}
          >
            <Text style={[styles.countText, { color: theme.colors.text.secondary }]}>
              {totalCount}
            </Text>
          </View>
        </View>

        {/* Reply indicator */}
        {replyParent && (
          <View
            style={[
              styles.replyIndicator,
              { backgroundColor: theme.colors.background.secondary },
            ]}
          >
            <Text style={[styles.replyLabel, { color: theme.colors.text.muted }]}>
              Replying to:
            </Text>
            <Text
              style={[styles.replyPreview, { color: theme.colors.text.secondary }]}
              numberOfLines={1}
            >
              {replyParent.content}
            </Text>
            <Pressable onPress={() => setReplyingTo(null)}>
              <Ionicons name="close" size={18} color={theme.colors.text.muted} />
            </Pressable>
          </View>
        )}

        {/* Input */}
        <SessionCommentInput
          sharedSessionId={sharedSessionId}
          dayNumber={dayNumber}
          parentCommentId={replyingTo || undefined}
          placeholder={replyingTo ? "Write a reply..." : "Share your thoughts..."}
          onSubmit={handleReplySubmit}
        />

        {/* Comments List */}
        {comments.length === 0 ? (
          renderEmpty()
        ) : (
          <FlashList<SessionCommentWithUser>
            data={comments}
            {...flashListConfig.props}
            renderItem={renderItem}
            ListFooterComponent={renderFooter}
            keyExtractor={(item) => item.id}
          />
        )}
      </View>
    </PlanCommentProvider>
  );
});

export default SessionCommentsSection;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  countBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  countText: {
    fontSize: 13,
    fontWeight: "600",
  },
  replyIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  replyLabel: {
    fontSize: 12,
    fontWeight: "500",
  },
  replyPreview: {
    flex: 1,
    fontSize: 13,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: "center",
  },
  loadMoreContainer: {
    paddingVertical: 16,
    alignItems: "center",
  },
  loadMoreButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  loadMoreText: {
    fontSize: 14,
    fontWeight: "500",
  },
});
