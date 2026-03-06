/**
 * DevotionContent - Main container for daily apologetics challenge
 * Mode-based layout:
 * - Apologetics: Full question + verses (2/3) + collapsed comments preview (1/3)
 * - Comments/Write/Thread: Reduced scrollable question (1/3) + content list (2/3)
 *
 * DRY principle: Comments, Write, and Thread modes share the same layout structure
 */

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  Animated,
  Dimensions,
  Easing,
  BackHandler,
} from "react-native";
import ReAnimated from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { KeyboardStickyView } from "react-native-keyboard-controller";

// Only load expo-device in dev mode for emulator detection
const isEmulator = __DEV__ ? !require("expo-device").isDevice : false;
import { FlashList } from "@shopify/flash-list";
import { observer, useSelector } from "@legendapp/state/react";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/contexts/ThemeContext";
import { useScrollContext } from "@/contexts/ScrollContext";
import { toTransparent } from "@/utils/themeHelpers";
import { useReadingUIToggle } from "@/hooks/useReadingUIToggle";
import { devotionStore$, activeComments$, totalCommentCount$ } from "@/state";
import { markDevotionComplete, isSelectedDateComplete$ } from "@/state/devotionStore";
import { tutorialStore$ } from "@/state/tutorialStore";
import { fetchReplies } from "@/services/apologeticsService";
import { userProfileCache$ } from "@/state/userProfileCache";
import { useFlashListConfig } from "@/hooks/useFlashListConfig";
import { CommentsTutorialModal } from "@/components/Tutorial";
import { useUnifiedAuth } from "@/hooks/useUnifiedAuth";
import { BottomGlowOverlay } from "@/components/Plans/Progress";
import { InlineCompletionButton } from "@/components/Shared";
import type { CommentWithUser } from "@/state";

import QuestionCard from "./QuestionCard";
import DayNavigator from "./DayNavigator";
import CollapsedCommentsPreview from "./CollapsedCommentsPreview";
import CommentCard from "./CommentCard";
import CommentInput from "./CommentInput";
import DevotionProgressMap from "./DevotionProgressMap";

const SCREEN_HEIGHT = Dimensions.get("window").height;
const PANEL_HEIGHT = SCREEN_HEIGHT * 0.67; // Comments panel visible height (2/3 of screen)
const PANEL_HIDE_DISTANCE = SCREEN_HEIGHT * 0.80; // Distance to translate panel off screen (must be > 75% since panel is 75% of screen)
const INPUT_HEIGHT = 64; // CommentInput height (48) + margins (16)
const ANIMATION_DURATION = 250; // Fast animation

const DevotionContent = observer(function DevotionContent() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const scrollContext = useScrollContext();
  const { user, isAuthenticated } = useUnifiedAuth();

  // Tab bar height: insets.bottom + paddingTop(6) + paddingBottom(8) + content(~44)
  const tabBarHeight = insets.bottom + 58;

  // Heights for UI elements
  const DAY_NAV_HEIGHT = 56;
  const COLLAPSED_PREVIEW_HEIGHT = 80;

  // Content padding when UI is visible (needs to clear all overlays)
  // Include insets.top for edge-to-edge rendering into status bar area
  const contentPaddingTopValue = insets.top + DAY_NAV_HEIGHT + 16; // Status bar + nav + extra padding
  const contentPaddingBottomValue = COLLAPSED_PREVIEW_HEIGHT + tabBarHeight + 16;

  // Hide translation distances (need extra to fully push elements off screen)
  const headerHideDistance = insets.top + DAY_NAV_HEIGHT + 50; // Status bar + nav + buffer
  const bottomHideDistance = COLLAPSED_PREVIEW_HEIGHT + tabBarHeight + 150; // Large buffer to ensure fully hidden

  // Auto-hide UI on scroll (day navigator, collapsed preview, and tab bar)
  const {
    headerAnimatedStyle,
    bottomAnimatedStyle: bottomElementsAnimatedStyle,
    scrollViewProps: questionScrollProps,
  } = useReadingUIToggle({
    headerHeight: headerHideDistance,
    bottomHeight: bottomHideDistance,
    // Also control tab bar visibility through ScrollContext
    tabBarTranslateY: scrollContext?.tabBarTranslateY,
    tabBarHideDistance: tabBarHeight + 60, // Match ScrollContext behavior
  });

  // FlashList config for high-performance comment lists (supports 100k+ items)
  const flashListConfig = useFlashListConfig({
    estimatedItemSize: 120, // Average comment card height
    loadMoreThreshold: 0.5,
  });

  // Animation for comments panel sliding up/down
  const slideAnim = useRef(new Animated.Value(PANEL_HIDE_DISTANCE)).current;

  const todaysQuestion = useSelector(devotionStore$.todaysQuestion);
  const uiMode = useSelector(devotionStore$.uiMode);
  const comments = useSelector(activeComments$);
  const totalCount = useSelector(totalCommentCount$);
  const isLoading = useSelector(devotionStore$.isCommentsLoading);
  const isLoadingMore = useSelector(devotionStore$.isLoadingMore);
  const hasMore = useSelector(devotionStore$.commentsHasMore);
  const commentsInitialized = useSelector(devotionStore$.commentsInitialized);
  const activeThreadCommentId = useSelector(
    devotionStore$.activeThreadCommentId
  );

  // Deep-link navigation state
  const targetCommentId = useSelector(devotionStore$.targetCommentId);
  const targetCommentHighlight = useSelector(
    devotionStore$.targetCommentHighlight
  );

  // FlashList refs for scroll-to-comment
  const commentsListRef = useRef<any>(null);
  const threadListRef = useRef<any>(null);

  // Get parent comment for thread mode
  const parentComment = activeThreadCommentId
    ? comments.find((c: CommentWithUser) => c.id === activeThreadCommentId)
    : null;

  // Get replies for thread mode
  const threadReplies =
    parentComment?.replies?.filter(
      (r: CommentWithUser) => r.status === "active"
    ) || [];

  // Comments tutorial state
  const [showCommentsTutorial, setShowCommentsTutorial] = useState(false);
  const hasShownTutorialRef = useRef(false);

  // Devotion completion state
  const [showCompletionWave, setShowCompletionWave] = useState(false);
  const selectedDate = useSelector(devotionStore$.selectedDate);
  const isSelectedDateCompleted = useSelector(isSelectedDateComplete$);
  // Check if the SELECTED date's devotion is complete
  // Use server-synced completedDevotionDates as the single source of truth
  const isDevotionComplete = isSelectedDateCompleted;

  // Scroll progress tracking for progress map
  const [scrollProgress, setScrollProgress] = useState(0);

  // Section positions for progress map (measured from QuestionCard)
  const [sectionPositions, setSectionPositions] = useState<number[]>([]);
  const [contentHeight, setContentHeight] = useState(0);

  // Calculate normalized section positions (0-1) for progress map
  const normalizedSectionPositions = React.useMemo(() => {
    if (sectionPositions.length === 0 || contentHeight === 0) return undefined;

    // Normalize positions relative to content height
    return sectionPositions.map((pos) => Math.min(1, Math.max(0, pos / contentHeight)));
  }, [sectionPositions, contentHeight]);

  // Handle section positions from QuestionCard
  const handleSectionPositions = useCallback((positions: number[]) => {
    setSectionPositions(positions);
  }, []);

  // Handle content layout from QuestionCard
  const handleContentLayout = useCallback((height: number) => {
    setContentHeight(height);
  }, []);

  // Generate section IDs from verse references for progress map
  const progressSections = React.useMemo(() => {
    if (!todaysQuestion?.verseReferences) return [];
    // Group by type (context/response) or use raw references
    type VerseRef = (typeof todaysQuestion.verseReferences)[number];
    const contextVerses = todaysQuestion.verseReferences.filter((v: VerseRef) => v.type === "context");
    const responseVerses = todaysQuestion.verseReferences.filter((v: VerseRef) => v.type === "response");
    const untypedVerses = todaysQuestion.verseReferences.filter((v: VerseRef) => !v.type);

    const sections: string[] = [];

    // If typed verses exist, create sections for each type group
    if (contextVerses.length > 0 || responseVerses.length > 0) {
      if (contextVerses.length > 0) sections.push("context");
      if (responseVerses.length > 0) sections.push("response");
    } else {
      // Otherwise, one section per verse reference
      untypedVerses.forEach((_v: VerseRef, i: number) => sections.push(`verse-${i}`));
    }

    return sections;
  }, [todaysQuestion?.verseReferences]);

  // Custom scroll handler that combines UI auto-hide with progress tracking
  const handleScrollWithProgress = useCallback(
    (event: any) => {
      // Call the original scroll handler for UI auto-hide
      questionScrollProps.onScroll?.(event);

      // Track scroll progress for progress map
      const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
      const maxScroll = contentSize.height - layoutMeasurement.height;
      if (maxScroll > 0) {
        const progress = Math.min(1, Math.max(0, contentOffset.y / maxScroll));
        setScrollProgress(progress);
      }
    },
    [questionScrollProps]
  );

  // Merge scroll props with progress tracking
  const enhancedScrollProps = React.useMemo(
    () => ({
      ...questionScrollProps,
      onScroll: handleScrollWithProgress,
    }),
    [questionScrollProps, handleScrollWithProgress]
  );

  // Handle input focus - show tutorial on first focus
  const handleCommentInputFocus = () => {
    if (
      !hasShownTutorialRef.current &&
      tutorialStore$.shouldShowCommentsTutorial()
    ) {
      setShowCommentsTutorial(true);
      hasShownTutorialRef.current = true;
    }
  };

  // Handle tutorial dismissal
  const handleCommentsTutorialDismiss = () => {
    setShowCommentsTutorial(false);
    tutorialStore$.completeCommentsTutorial();
  };

  // Handle devotion completion
  const handleDevotionComplete = useCallback(async () => {
    if (!user?.id || !isAuthenticated) return;

    // Show celebration wave animation
    setShowCompletionWave(true);

    // Mark devotion complete and award XP (pass selectedDate for tracking)
    const result = await markDevotionComplete(user.id, selectedDate);

    // Cancel today's devotion notification if completion succeeded
    if (result.success) {
      import('@/services/notificationService').then(({ cancelTodayDevotionNotification }) => {
        cancelTodayDevotionNotification();
      });
    }

    // Progress bar updates reactively via completedActivitiesCount$
  }, [user?.id, isAuthenticated, selectedDate]);

  // Handle completion wave animation end
  const handleWaveComplete = useCallback(() => {
    setShowCompletionWave(false);
  }, []);

  // Animate comments panel based on mode
  useEffect(() => {
    const showComments = uiMode === "comments" || uiMode === "thread";
    Animated.timing(slideAnim, {
      toValue: showComments ? 0 : PANEL_HIDE_DISTANCE,
      duration: ANIMATION_DURATION,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [uiMode, slideAnim]);

  // Handle hardware back button/gesture for stack navigation
  const handleBackPress = useCallback(() => {
    // Try to go back in the internal navigation stack
    const handled = devotionStore$.goBack();
    // Return true if we handled it (don't let system handle it)
    // Return false if at root (let system handle it - exit tab/app)
    return handled;
  }, []);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      handleBackPress
    );

    return () => backHandler.remove();
  }, [handleBackPress]);

  // Scroll to target comment when deep-linking from Library
  useEffect(() => {
    if (!targetCommentId || !commentsInitialized || comments.length === 0)
      return;

    // Find the target comment in the comments list
    const commentIndex = comments.findIndex(
      (c: CommentWithUser) => c.id === targetCommentId
    );

    if (commentIndex >= 0) {
      // Comment is a top-level comment, scroll in comments mode
      console.log(
        "[DevotionContent] Scrolling to comment at index:",
        commentIndex
      );
      setTimeout(() => {
        commentsListRef.current?.scrollToIndex({
          index: commentIndex,
          animated: true,
          viewPosition: 0.3, // Position at ~1/3 from top
        });
      }, 400); // Delay for panel animation
    } else {
      // Comment might be a reply - check in replies
      const parentWithReply = comments.find((c: CommentWithUser) =>
        c.replies?.some((r: CommentWithUser) => r.id === targetCommentId)
      );

      if (parentWithReply) {
        // Open thread view for the parent, then scroll to reply
        console.log(
          "[DevotionContent] Target is reply, opening thread for parent:",
          parentWithReply.id
        );
        handleOpenThread(parentWithReply.id);
      }
    }
  }, [targetCommentId, commentsInitialized, comments]);

  // Scroll to reply in thread mode
  useEffect(() => {
    if (!targetCommentId || uiMode !== "thread" || threadReplies.length === 0)
      return;

    const replyIndex = threadReplies.findIndex(
      (r: CommentWithUser) => r.id === targetCommentId
    );

    if (replyIndex >= 0) {
      console.log("[DevotionContent] Scrolling to reply at index:", replyIndex);
      setTimeout(() => {
        threadListRef.current?.scrollToIndex({
          index: replyIndex,
          animated: true,
          viewPosition: 0.3,
        });
      }, 400);
    }
  }, [targetCommentId, uiMode, threadReplies]);

  const handleExpandComments = () => {
    devotionStore$.setUIMode("comments");
  };

  const handleCollapseToApologetics = () => {
    devotionStore$.setUIMode("apologetics");
  };

  const handleBackFromThread = () => {
    devotionStore$.closeThread();
  };

  const handleOpenThread = async (commentId: string) => {
    devotionStore$.openThread(commentId);

    // Fetch replies for this comment
    const replies = await fetchReplies(commentId);

    // Ensure user profiles are cached for reply authors
    if (replies.length > 0) {
      const userIds = [...new Set(replies.map((r) => r.user_id))];
      await userProfileCache$.ensureProfiles(userIds);
    }

    // Set replies on the parent comment
    devotionStore$.setRepliesForComment(commentId, replies);
  };

  const handleLoadMore = () => {
    if (!isLoadingMore && hasMore) {
      console.log("[DevotionContent] Load more comments");
    }
  };

  // If no question loaded yet, show loading
  if (!todaysQuestion) {
    return (
      <View
        style={[
          styles.loadingContainer,
          { backgroundColor: theme.colors.background.primary },
        ]}
      >
        <ActivityIndicator size="large" color={theme.colors.accent} />
        <Text style={[styles.loadingText, { color: theme.colors.text.muted }]}>
          Loading today&apos;s question...
        </Text>
      </View>
    );
  }

  // Render a single comment
  const renderComment = ({ item }: { item: CommentWithUser }) => {
    const isHighlighted = targetCommentHighlight && item.id === targetCommentId;
    return (
      <CommentCard
        comment={item}
        onOpenThread={handleOpenThread}
        isHighlighted={isHighlighted}
      />
    );
  };

  // Render a reply in thread mode
  const renderReply = ({ item }: { item: CommentWithUser }) => {
    const isHighlighted = targetCommentHighlight && item.id === targetCommentId;
    return <CommentCard comment={item} isReply isHighlighted={isHighlighted} />;
  };

  // Comments list header with count - STICKY (rendered outside FlashList)
  const CommentsListHeader = () => (
    <Pressable
      onPress={handleCollapseToApologetics}
      style={[
        styles.listHeader,
        styles.stickyHeader,
        {
          borderBottomColor: theme.colors.border,
          backgroundColor: theme.colors.interactive.modal.header,
        },
      ]}
    >
      <View style={styles.listHeaderLeft}>
        <Ionicons
          name="arrow-back"
          size={20}
          color={theme.colors.text.primary}
        />
        <Text
          style={[
            styles.listHeaderText,
            { color: theme.colors.text.secondary },
          ]}
        >
          {totalCount} {totalCount === 1 ? "comment" : "comments"}
        </Text>
      </View>
      <Ionicons name="chevron-down" size={18} color={theme.colors.text.muted} />
    </Pressable>
  );

  // Thread sticky header - STICKY (rendered outside FlashList)
  const ThreadStickyHeader = () => (
    <Pressable
      onPress={handleCollapseToApologetics}
      style={[
        styles.listHeader,
        styles.stickyHeader,
        {
          borderBottomColor: theme.colors.border,
          backgroundColor: theme.colors.interactive.modal.header,
        },
      ]}
    >
      <View style={styles.listHeaderLeft}>
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            handleBackFromThread();
          }}
          style={styles.backButton}
        >
          <Ionicons
            name="arrow-back"
            size={20}
            color={theme.colors.text.primary}
          />
        </Pressable>
        <Text
          style={[styles.listHeaderText, { color: theme.colors.text.primary }]}
        >
          Replies
        </Text>
      </View>
      <Ionicons name="chevron-down" size={18} color={theme.colors.text.muted} />
    </Pressable>
  );

  // Thread content header - scrolls with content (parent comment + replies count)
  const ThreadContentHeader = () => (
    <View style={styles.threadHeaderContainer}>
      {/* Parent comment */}
      {parentComment && <CommentCard comment={parentComment} isThreadParent />}

      {/* Replies count */}
      {threadReplies.length > 0 && (
        <View
          style={[
            styles.repliesCountHeader,
            { borderTopColor: theme.colors.border },
          ]}
        >
          <Text
            style={[
              styles.repliesCountText,
              { color: theme.colors.text.muted },
            ]}
          >
            {threadReplies.length}{" "}
            {threadReplies.length === 1 ? "reply" : "replies"}
          </Text>
        </View>
      )}
    </View>
  );

  // Empty state for comments
  const CommentsEmptyComponent = () => {
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
          size={40}
          color={theme.colors.text.muted}
        />
        <Text
          style={[styles.emptyTitle, { color: theme.colors.text.secondary }]}
        >
          No comments yet
        </Text>
        <Text
          style={[styles.emptySubtitle, { color: theme.colors.text.muted }]}
        >
          Be the first to share your thoughts
        </Text>
      </View>
    );
  };

  // Empty state for replies
  const RepliesEmptyComponent = () => (
    <View style={styles.emptyContainer}>
      <Text style={[styles.emptyText, { color: theme.colors.text.muted }]}>
        No replies yet. Be the first to respond!
      </Text>
    </View>
  );

  // Footer for loading more
  const CommentsFooterComponent = () => {
    if (!hasMore || !isLoadingMore) return null;

    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={theme.colors.accent} />
      </View>
    );
  };

  // Determine which layout to show based on current mode
  const showReducedLayout = uiMode === "comments" || uiMode === "thread";
  const isThreadMode = uiMode === "thread";

  // Determine input props based on mode
  const inputPlaceholder = isThreadMode
    ? "Add a reply..."
    : "Share your thoughts...";
  const inputParentCommentId = isThreadMode ? activeThreadCommentId : undefined;

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.colors.background.primary },
      ]}
    >
      {/* Day Navigator - Hidden when in comments/thread mode, auto-hides on scroll */}
      {!showReducedLayout && (
        <ReAnimated.View
          style={[
            styles.headerContainer,
            {
              backgroundColor: theme.colors.background.primary,
              paddingTop: insets.top,
            },
            headerAnimatedStyle,
          ]}
        >
          <DayNavigator />
        </ReAnimated.View>
      )}

      {/* Main Content Area */}
      <View style={styles.contentArea}>
        {/* Apologetics Mode: Progress map sidebar + full question + collapsed comments preview */}
        {!showReducedLayout && (
          <>
            <View style={styles.fullApologeticsSection}>
              {/* Progress Map Sidebar */}
              {progressSections.length > 0 && (
                <View
                  style={[
                    styles.progressMapContainer,
                    { paddingTop: contentPaddingTopValue - 8 },
                  ]}
                >
                  <DevotionProgressMap
                    totalSections={progressSections.length}
                    sectionIds={progressSections}
                    sectionPositions={normalizedSectionPositions}
                    isComplete={isDevotionComplete}
                    overallProgress={scrollProgress}
                  />
                </View>
              )}

              {/* Question Card (takes remaining space) */}
              <View style={styles.questionContainer}>
                <QuestionCard
                  question={todaysQuestion}
                  scrollProps={enhancedScrollProps}
                  contentPaddingTop={contentPaddingTopValue}
                  contentPaddingBottom={contentPaddingBottomValue}
                  onSectionPositions={handleSectionPositions}
                  onContentLayout={handleContentLayout}
                  footer={
                    isAuthenticated ? (
                      <View style={styles.completionFooter}>
                        {/* Inline Completion Button */}
                        <InlineCompletionButton
                          isComplete={isDevotionComplete}
                          isEnabled={!isDevotionComplete}
                          onPress={handleDevotionComplete}
                          label={isDevotionComplete ? "Completed!" : "Mark Complete"}
                        />
                      </View>
                    ) : undefined
                  }
                />
              </View>
            </View>
            <ReAnimated.View
              style={[
                styles.collapsedPreviewContainer,
                { bottom: tabBarHeight },
                bottomElementsAnimatedStyle,
              ]}
            >
              <CollapsedCommentsPreview onPress={handleExpandComments} />
            </ReAnimated.View>
          </>
        )}

        {/* Compact question card - fixed at top, only in comments/thread mode */}
        {showReducedLayout && (
          <View style={styles.reducedApologeticsFixed}>
            <QuestionCard question={todaysQuestion} variant="compact" />
          </View>
        )}

        {/* Comments Panel - Slides up from bottom */}
        <Animated.View
          style={[
            styles.commentsPanel,
            {
              backgroundColor: theme.colors.background.primary,
              transform: [{ translateY: slideAnim }],
            },
          ]}
          pointerEvents={showReducedLayout ? "auto" : "none"}
        >
          {/* STICKY HEADER - Rendered outside FlashList */}
          {isThreadMode ? <ThreadStickyHeader /> : <CommentsListHeader />}

          {/* Content list - fills the panel, clipped at bottom to hide content behind input */}
          <View
            style={[
              styles.commentsListWrapper,
              { marginBottom: tabBarHeight + INPUT_HEIGHT },
            ]}
          >
            {isThreadMode ? (
              // Thread mode: Show parent comment + replies
              <FlashList
                ref={threadListRef}
                data={threadReplies}
                renderItem={renderReply}
                keyExtractor={(item) => item.id}
                ListHeaderComponent={ThreadContentHeader}
                ListEmptyComponent={RepliesEmptyComponent}
                contentContainerStyle={{
                  ...styles.listContent,
                  paddingBottom: tabBarHeight + 80, // Space for tab bar + input
                }}
                showsVerticalScrollIndicator={true}
                {...flashListConfig.props}
              />
            ) : (
              // Comments mode: Show all comments (FlashList for 100k+ items)
              <FlashList
                ref={commentsListRef}
                data={comments}
                renderItem={renderComment}
                keyExtractor={(item) => item.id}
                ListEmptyComponent={CommentsEmptyComponent}
                ListFooterComponent={CommentsFooterComponent}
                onEndReached={handleLoadMore}
                contentContainerStyle={{
                  ...styles.listContent,
                  paddingBottom: tabBarHeight + 80, // Space for tab bar + input
                }}
                showsVerticalScrollIndicator={true}
                {...flashListConfig.props}
              />
            )}

            {/* Gradient fade overlay - at bottom of clipped container */}
            <LinearGradient
              colors={[
                toTransparent(theme.colors.background.primary),
                theme.colors.background.primary,
              ]}
              style={styles.bottomFadeGradient}
              pointerEvents="none"
              dither
            />
          </View>
        </Animated.View>
      </View>

      {/* Input wrapped with KeyboardStickyView - stays above keyboard */}
      {showReducedLayout && (
        <KeyboardStickyView
          style={[styles.stickyInputContainer, { bottom: 0 }]}
          offset={{
            closed: -tabBarHeight,
            // In dev on emulator, keyboard doesn't push view up - keep above tab bar
            opened: isEmulator ? -tabBarHeight : 0,
          }}
        >
          <View style={styles.inputContainer}>
            <CommentInput
              questionId={todaysQuestion.id}
              parentCommentId={inputParentCommentId || undefined}
              placeholder={inputPlaceholder}
              onInputFocus={handleCommentInputFocus}
            />
          </View>
        </KeyboardStickyView>
      )}

      {/* Comments Tutorial - shown on first time entering comments mode */}
      <CommentsTutorialModal
        visible={showCommentsTutorial}
        onDismiss={handleCommentsTutorialDismiss}
      />

      {/* Ambient glow for completed devotions (base layer) */}
      {isDevotionComplete && (
        <BottomGlowOverlay visible={true} continuous />
      )}

      {/* Burst effect when completing (top layer, fades to reveal continuous underneath) */}
      <BottomGlowOverlay
        visible={showCompletionWave}
        onComplete={handleWaveComplete}
      />
    </View>
  );
});

export default DevotionContent;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  loadingText: {
    fontSize: 14,
  },
  contentArea: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  fullApologeticsSection: {
    flex: 1,
    flexDirection: "row",
  },
  progressMapContainer: {
    width: 32,
    paddingLeft: 4,
    paddingBottom: 200, // Space for collapsed preview + tab bar
  },
  questionContainer: {
    flex: 1,
  },
  collapsedPreviewContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    // bottom set dynamically to sit above tab bar
    zIndex: 10,
  },
  // Reduced apologetics - fixed at top 1/3, NOT animated
  reducedApologeticsFixed: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "25%",
    zIndex: 2,
  },
  // Comments panel - bottom 2/3, slides up from bottom
  commentsPanel: {
    position: "absolute",
    top: "25%",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "column",
  },
  commentsListWrapper: {
    flex: 1, // Takes remaining space above input
    overflow: "hidden", // Clip content at container boundary
  },
  bottomFadeGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 10,
    zIndex: 10,
  },
  listHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  stickyHeader: {
    zIndex: 1, // Ensure sticky header appears above scrolling content
  },
  listHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  listHeaderText: {
    fontSize: 14,
    fontWeight: "500",
  },
  headerButton: {
    padding: 4,
  },
  backButton: {
    padding: 4,
    marginLeft: -4,
  },
  threadHeaderContainer: {
    // Container for thread header elements
  },
  repliesCountHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  repliesCountText: {
    fontSize: 13,
    fontWeight: "500",
  },
  listContent: {
    flexGrow: 1,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 32,
    paddingHorizontal: 24,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "600",
    marginTop: 4,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: "center",
  },
  emptyText: {
    fontSize: 14,
    marginTop: 8,
  },
  footerLoader: {
    paddingVertical: 16,
    alignItems: "center",
  },
  stickyInputContainer: {
    position: "absolute",
    left: 0,
    right: 0,
  },
  inputContainer: {
    backgroundColor: "transparent",
  },
  completionFooter: {
    alignItems: "center",
    paddingTop: 24,
    paddingBottom: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(128, 128, 128, 0.2)",
    marginTop: 24,
  },
});
