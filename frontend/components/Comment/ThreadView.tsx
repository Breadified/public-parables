/**
 * ThreadView - Shared thread view for comments (DRY for Devotion & Plan Sessions)
 * Shows parent comment + replies in a modal-like panel
 * Uses CommentContext for all state and actions
 */

import React, { useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { FlashList, ListRenderItemInfo } from "@shopify/flash-list";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardStickyView } from "react-native-keyboard-controller";

import { useTheme } from "@/contexts/ThemeContext";
import { useComments } from "@/contexts/CommentContext";
import { useFlashListConfig } from "@/hooks/useFlashListConfig";
import type { UnifiedComment } from "@/types/comments";
import Card from "./Card";
import Input from "./Input";

// Only load expo-device in dev mode for emulator detection
const isEmulator = __DEV__ ? !require("expo-device").isDevice : false;

interface ThreadViewProps {
  /** Callback when thread is closed */
  onClose: () => void;
  /** Optional context ID for input (sharedSessionId for Plans, questionId for Devotion) */
  contextId?: string;
  /** Optional day number for Plans */
  dayNumber?: number;
}

/**
 * ThreadView renders:
 * 1. Header with back button and "Replies" title
 * 2. Parent comment (expanded, not truncated)
 * 3. List of replies
 * 4. Input for adding replies
 */
const ThreadView = ({ onClose }: ThreadViewProps) => {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const {
    threadParentComment,
    threadReplies,
    activeThreadCommentId,
    onFetchReplies,
    isLoading,
  } = useComments();

  const flashListConfig = useFlashListConfig({
    estimatedItemSize: 70,
    overrideItemLayout: false, // Disable to prevent gaps - let FlashList measure naturally
  });

  // Fetch replies when thread opens
  React.useEffect(() => {
    if (activeThreadCommentId) {
      onFetchReplies(activeThreadCommentId);
    }
  }, [activeThreadCommentId, onFetchReplies]);

  const renderReply = useCallback(
    ({ item }: ListRenderItemInfo<UnifiedComment>) => (
      <Card comment={item} isReply />
    ),
    []
  );

  const keyExtractor = useCallback((item: UnifiedComment) => item.id, []);

  // Empty state for no replies
  const renderEmpty = () => {
    if (isLoading) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="small" color={theme.colors.text.muted} />
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <Text style={[styles.emptyText, { color: theme.colors.text.muted }]}>
          No replies yet. Be the first to reply!
        </Text>
      </View>
    );
  };

  // Header for the thread list (shows parent comment + replies header)
  const renderListHeader = () => (
    <View style={styles.listHeaderContainer}>
      {/* Parent Comment */}
      {threadParentComment && (
        <Card comment={threadParentComment} isThreadParent />
      )}

      {/* Replies divider */}
      <View
        style={[
          styles.repliesDivider,
          { borderBottomColor: theme.colors.border },
        ]}
      >
        <Text
          style={[styles.repliesTitle, { color: theme.colors.text.secondary }]}
        >
          {threadReplies.length} {threadReplies.length === 1 ? "Reply" : "Replies"}
        </Text>
      </View>
    </View>
  );

  if (!threadParentComment) {
    return null;
  }

  return (
    <View style={styles.container}>
      {/* Sticky Header */}
      <Pressable
        onPress={onClose}
        style={[
          styles.header,
          {
            borderBottomColor: theme.colors.border,
            backgroundColor: theme.colors.interactive.modal.header,
          },
        ]}
      >
        <View style={styles.headerLeft}>
          <Ionicons
            name="arrow-back"
            size={20}
            color={theme.colors.text.primary}
          />
          <Text
            style={[styles.headerText, { color: theme.colors.text.secondary }]}
          >
            Replies
          </Text>
        </View>
        <Ionicons name="chevron-down" size={18} color={theme.colors.text.muted} />
      </Pressable>

      {/* Thread content */}
      <View style={[styles.content, { marginBottom: insets.bottom + 80 }]}>
        <FlashList
          data={threadReplies}
          renderItem={renderReply}
          keyExtractor={keyExtractor}
          ListHeaderComponent={renderListHeader}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={true}
          {...flashListConfig.props}
        />
      </View>

      {/* Input - sticky at bottom */}
      <KeyboardStickyView
        style={[styles.inputContainer, { bottom: 0 }]}
        offset={{
          closed: -insets.bottom,
          opened: isEmulator ? -insets.bottom : 0,
        }}
      >
        <Input
          parentCommentId={activeThreadCommentId || undefined}
          placeholder="Write a reply..."
        />
      </KeyboardStickyView>
    </View>
  );
};

export default ThreadView;

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
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerText: {
    fontSize: 14,
    fontWeight: "500",
  },
  content: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 16,
  },
  listHeaderContainer: {
    // Contains parent comment and replies divider
  },
  repliesDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  repliesTitle: {
    fontSize: 13,
    fontWeight: "600",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 32,
    paddingHorizontal: 24,
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
  },
  inputContainer: {
    position: "absolute",
    left: 0,
    right: 0,
  },
});
