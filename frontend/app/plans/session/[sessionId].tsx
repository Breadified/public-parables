/**
 * Session View Screen - Bible Reading Plan Session
 * Layout matches Devotion page:
 * - Reading mode: Full Bible content + collapsed comments preview at bottom
 * - Comments mode: Compact reading summary (1/3) + comments panel (2/3)
 */

import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  BackHandler,
} from "react-native";
import ReAnimated from "react-native-reanimated";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { observer, useSelector } from "@legendapp/state/react";
import { FlashList } from "@shopify/flash-list";
import { LinearGradient } from "expo-linear-gradient";
import { KeyboardStickyView } from "react-native-keyboard-controller";

import { useTheme } from "@/contexts/ThemeContext";
import { toTransparent } from "@/utils/themeHelpers";
import { useUnifiedAuth } from "@/hooks/useUnifiedAuth";
import { useReadingUIToggle } from "@/hooks/useReadingUIToggle";
import {
  planStore$,
  currentSession$,
  planStudyModeStore$,
  planReminderPreferences$,
  activeSessionComments$,
} from "@/state";
import { bibleVersionStore$ } from "@/state/bibleVersionStore";
import { checkNotificationPermissions } from "@/services/notificationService";
import {
  updatePlanSessionProgress,
  updateParticipantProgress,
  initializeSharedSession,
  cleanupPlanSubscription,
  loadCommentsForDay,
  resubscribeForDay,
} from "@/services/planService";
import {
  SessionCommentInput,
  SessionParticipantsList,
  PlanDayNavigator,
  PlanReadingContent,
  SessionCollapsedPreview,
  PlanFAB,
  PlanStudyModeView,
  PlanCommentProvider,
  ProgressMap,
  BottomGlowOverlay,
  CommentTrophy,
  ReminderConfigBanner,
  PushPermissionWarningBanner,
} from "@/components/Plans";
import { awardXPLocally } from "@/state/gamificationStore";
import { REWARD_TYPES } from "@/types/database";
import Card from "@/components/Comment/Card";
import ThreadView from "@/components/Comment/ThreadView";
import { sessionCommentToUnified } from "@/utils/commentTypeConverters";
import SessionSettingsModal from "@/components/Plans/SessionSettingsModal";
import CalendarPickerModal from "@/components/Devotion/CalendarPickerModal";
import { StudyModeSetupModal } from "@/components/StudyMode/StudyModeSetupModal";
import { useFlashListConfig } from "@/hooks/useFlashListConfig";
import { AuthGate } from "@/components/Auth/AuthGate";
import type {
  BiblePlanWithDays,
  PlanSession,
  DayRewardsSummary,
} from "@/types/database";
import type {
  SessionUIMode,
  SessionCommentWithUser,
  ParticipantWithProfile,
  DayProgressState,
} from "@/state/planStore";
import type { PlanReadingContentHandle } from "@/components/Plans/PlanReadingContent";
import { calculatePlanDay } from "@/utils/dateFormatters";

// Only load expo-device in dev mode for emulator detection
const isEmulator = __DEV__ ? !require("expo-device").isDevice : false;

const SCREEN_WIDTH = Dimensions.get("window").width;
const SCREEN_HEIGHT = Dimensions.get("window").height;
const PANEL_HEIGHT = SCREEN_HEIGHT * 0.67; // Comments panel visible height (2/3 of screen)
const PANEL_HIDE_DISTANCE = SCREEN_HEIGHT * 0.8; // Distance to translate panel off screen (must be > 75% since panel is 75% of screen)
const HEADER_HEIGHT = 68; // 44px button + 24px padding
const DAY_NAV_HEIGHT = 52; // Day navigator approximate height
const HEADER_SECTION_HEIGHT = HEADER_HEIGHT + DAY_NAV_HEIGHT;
const INPUT_HEIGHT = 64; // CommentInput height (48) + margins (16)
const ANIMATION_DURATION = 250;

export default observer(function SessionViewScreen() {
  const { sessionId, gotoDay } = useLocalSearchParams<{
    sessionId: string;
    gotoDay?: string;
  }>();
  const router = useRouter();
  const { theme } = useTheme();
  const { user, isAuthenticated, isOnline } = useUnifiedAuth();
  const insets = useSafeAreaInsets();

  // Heights for UI elements
  const COLLAPSED_PREVIEW_HEIGHT = 80;
  const FAB_HEIGHT = 56;
  const GAP = 16;

  // Content padding when UI is visible (needs to clear all overlays including safe areas)
  const contentPaddingTopValue = HEADER_SECTION_HEIGHT + insets.top;
  const contentPaddingBottomValue =
    COLLAPSED_PREVIEW_HEIGHT + GAP + FAB_HEIGHT + insets.bottom;

  // Hide translation distances (need extra to fully push elements off screen)
  const headerHideDistance = HEADER_SECTION_HEIGHT + insets.top + 50; // Extra buffer
  const bottomHideDistance =
    COLLAPSED_PREVIEW_HEIGHT + GAP + FAB_HEIGHT + insets.bottom + 150; // Large buffer to ensure fully hidden

  // Auto-hide UI on scroll (header, day nav, FAB, collapsed preview)
  const {
    headerAnimatedStyle,
    bottomAnimatedStyle: bottomElementsAnimatedStyle,
    scrollViewProps: readingScrollProps,
  } = useReadingUIToggle({
    headerHeight: headerHideDistance,
    bottomHeight: bottomHideDistance,
  });

  // Plan study mode state for multipane rendering
  const planStudyModeType = useSelector(planStudyModeStore$.studyModeType);
  const isPlanStudyModeActive = useSelector(planStudyModeStore$.isActive);

  // Bible version state for study mode
  const primaryVersion = useSelector(bibleVersionStore$.primaryVersion);
  const availableVersions = useSelector(bibleVersionStore$.availableVersions);

  // FlashList config
  const flashListConfig = useFlashListConfig({
    estimatedItemSize: 120,
    loadMoreThreshold: 0.5,
  });

  // Animation for comments panel
  const slideAnim = useRef(new Animated.Value(PANEL_HIDE_DISTANCE)).current;

  // Track day switch version to prevent stale async responses
  const daySwitchVersionRef = useRef(0);

  // Ref for PlanReadingContent to control scrolling
  const readingContentRef = useRef<PlanReadingContentHandle>(null);

  const currentSession = useSelector(currentSession$);
  const uiMode = useSelector(() =>
    planStore$.sessionUIMode.get(),
  ) as SessionUIMode;
  const comments = useSelector(
    activeSessionComments$,
  ) as SessionCommentWithUser[];
  const commentsLoading = useSelector(() =>
    planStore$.commentsLoading.get(),
  ) as boolean;
  const commentsInitialized = useSelector(() =>
    planStore$.commentsInitialized.get(),
  ) as boolean;
  const participants = useSelector(() =>
    planStore$.participants.get(),
  ) as ParticipantWithProfile[];

  // Day progress state for gamification
  const dayProgress = useSelector(() =>
    planStore$.dayProgress.get(),
  ) as DayProgressState;
  const showCommentTrophy = useSelector(() =>
    planStore$.showCommentTrophy.get(),
  ) as boolean;
  const dayRewardsSummary = useSelector(() =>
    planStore$.dayRewardsSummary.get(),
  ) as DayRewardsSummary[];

  // For shared sessions, get the current user's participant record
  const currentUserParticipant = participants.find(
    (p: ParticipantWithProfile) =>
      p.user_id === user?.id && p.status === "active",
  );

  const [plan, setPlan] = useState<BiblePlanWithDays | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showStudyModeModal, setShowStudyModeModal] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [existingSharedSession, setExistingSharedSession] =
    useState<PlanSession | null>(null);
  const [showCompletionWave, setShowCompletionWave] = useState(false);
  const [hasNotificationPermission, setHasNotificationPermission] =
    useState(true);

  // Plan reminder preferences
  const reminderPrefs = useSelector(planReminderPreferences$);

  // Check notification permission on mount and when prefs change
  useEffect(() => {
    const checkPermission = async () => {
      const hasPermission = await checkNotificationPermissions();
      setHasNotificationPermission(hasPermission);
    };
    checkPermission();
  }, [reminderPrefs.reminderEnabled]);

  useEffect(() => {
    if (sessionId) {
      planStore$.setActiveSession(sessionId);
      loadSessionData();
    }

    return () => {
      cleanupPlanSubscription();
      planStore$.setSessionUIMode("reading");
    };
  }, [sessionId]);

  // Handle gotoDay URL parameter (from Activity Tracker "Today's bible plan" navigation)
  // This jumps to the specified day after the session has loaded
  const gotoDayHandledRef = useRef(false);
  useEffect(() => {
    if (gotoDay && currentSession && !loading && !gotoDayHandledRef.current) {
      const targetDay = parseInt(gotoDay, 10);
      if (!isNaN(targetDay) && targetDay >= 1) {
        gotoDayHandledRef.current = true;

        // Update store immediately for responsive UI
        if (currentSession.is_shared && user?.id) {
          planStore$.updateParticipantProgress(user.id, targetDay);
        } else {
          planStore$.updateSessionProgress(currentSession.id, targetDay);
        }

        // Persist to server
        const persistDay = async () => {
          try {
            if (currentSession.is_shared && user?.id) {
              await updateParticipantProgress(
                currentSession.id,
                user.id,
                targetDay,
              );
            }
            // Always update session progress for owner
            if (currentSession.user_id === user?.id) {
              await updatePlanSessionProgress(currentSession.id, targetDay);
            }
          } catch (error) {
            console.error("[SessionView] Failed to persist gotoDay:", error);
          }
        };
        persistDay();
      }
    }
  }, [gotoDay, currentSession, loading, user?.id]);

  // Use stored current_day from participant (for shared) or session (for personal)
  // This preserves the user's progress and allows starting from any day
  const effectiveCurrentDay =
    existingSharedSession && currentUserParticipant
      ? (currentUserParticipant.current_day ?? 1)
      : (currentSession?.current_day ?? 1);

  // Reload comments when day changes (for shared sessions)
  // Uses version tracking to prevent stale async responses from overwriting
  useEffect(() => {
    if (existingSharedSession && user?.id && effectiveCurrentDay) {
      // Set selected day and get version - this increments the version counter
      const version = planStore$.setSelectedDay(effectiveCurrentDay);
      daySwitchVersionRef.current = version;

      // Load comments for the new day
      loadCommentsForDay(
        existingSharedSession.id,
        effectiveCurrentDay,
        user.id,
      ).then(() => {
        // Discard if a newer day switch happened while loading
        if (
          daySwitchVersionRef.current !== planStore$.daySwitchVersion.peek()
        ) {
          console.log(
            "[SessionView] Discarding stale comments load for day:",
            effectiveCurrentDay,
          );
          return;
        }
      });

      // Resubscribe with the new day context for proper real-time filtering
      resubscribeForDay(existingSharedSession.id, effectiveCurrentDay);
    }
  }, [effectiveCurrentDay, existingSharedSession?.id, user?.id]);

  // Reset day progress when day changes
  useEffect(() => {
    planStore$.resetDayProgress();
  }, [effectiveCurrentDay]);

  // Check if day is complete from persisted state
  const isDayComplete = sessionId
    ? planStore$.isDayComplete(sessionId, effectiveCurrentDay)
    : false;

  // Calculate if current day is in the future (for locked completion button)
  const { isFutureDay, daysUntilUnlock } = React.useMemo(() => {
    if (!currentSession) return { isFutureDay: false, daysUntilUnlock: 0 };

    // Parse the start date at local midnight
    const start = new Date(currentSession.started_at);
    const startLocal = new Date(
      start.getFullYear(),
      start.getMonth(),
      start.getDate(),
    );

    // Calculate the date for the current plan day
    const dayDate = new Date(startLocal);
    dayDate.setDate(startLocal.getDate() + (effectiveCurrentDay - 1));

    // Get today at midnight
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Compare dates
    const diffTime = dayDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return {
      isFutureDay: diffDays > 0,
      daysUntilUnlock: diffDays > 0 ? diffDays : 0,
    };
  }, [currentSession?.started_at, effectiveCurrentDay]);

  // Get today's data based on current day (moved before early returns for hooks order)
  const todayData = plan?.days.find(
    (d) => d.day_number === effectiveCurrentDay,
  );

  // Extract readings from content array for components that need them
  // Must be called before any early returns (React hooks rules)
  const todayReadings = React.useMemo(() => {
    if (!todayData?.content) return [];
    return todayData.content
      .filter((item) => item.type === "reading")
      .map((item, index) => ({
        reference: item.reference!,
        verse_id_start: item.verse_id_start!,
        verse_id_end: item.verse_id_end!,
        sort_order: index,
      }));
  }, [todayData?.content]);

  const loadSessionData = async () => {
    setLoading(true);
    try {
      // First check mySessions (personal sessions)
      const mySessions = planStore$.mySessions.get();
      let session = mySessions.find((s: PlanSession) => s.id === sessionId);

      // If not found, check sharedSessions (sessions user joined)
      if (!session) {
        const sharedSessions = planStore$.sharedSessions.get();
        session = sharedSessions.find((s: PlanSession) => s.id === sessionId);
      }

      if (session) {
        const planData = await planStore$.loadPlanDetails(session.plan_id);
        setPlan(planData);

        // Check if this session is shared (using is_shared flag on the session itself)
        if (session.is_shared) {
          setExistingSharedSession(session);
          if (user?.id) {
            await initializeSharedSession(
              session.id,
              user.id,
              session.current_day,
            );
          }
        }

        // Load rewards data for this session
        if (user?.id && sessionId) {
          planStore$.loadRewardsForSession(sessionId, user.id);
        }
      }
    } catch (error) {
      console.error("Failed to load session:", error);
    } finally {
      setLoading(false);
    }
  };

  // Animate comments panel (includes thread mode)
  useEffect(() => {
    const showPanel =
      uiMode === "comments" || uiMode === "participants" || uiMode === "thread";
    Animated.timing(slideAnim, {
      toValue: showPanel ? 0 : PANEL_HIDE_DISTANCE,
      duration: ANIMATION_DURATION,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [uiMode, slideAnim]);

  // Handle back button
  const handleBackPress = useCallback(() => {
    if (uiMode !== "reading") {
      planStore$.setSessionUIMode("reading");
      return true;
    }
    return false;
  }, [uiMode]);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      handleBackPress,
    );
    return () => backHandler.remove();
  }, [handleBackPress]);

  const handleBack = () => {
    router.back();
  };

  // Day navigation - persists to store/server
  const isOwner = currentSession?.user_id === user?.id;

  const handlePreviousDay = useCallback(async () => {
    if (!currentSession || effectiveCurrentDay <= 1) return;
    const newDay = effectiveCurrentDay - 1;

    // Update store immediately for responsive UI
    if (existingSharedSession && user?.id) {
      planStore$.updateParticipantProgress(user.id, newDay);
    } else {
      planStore$.updateSessionProgress(currentSession.id, newDay);
    }

    // Persist to server
    try {
      if (existingSharedSession && user?.id) {
        await updateParticipantProgress(
          existingSharedSession.id,
          user.id,
          newDay,
        );
      }
      if (isOwner) {
        await updatePlanSessionProgress(currentSession.id, newDay);
      }
    } catch (error) {
      console.error("Failed to save day progress:", error);
    }
  }, [
    effectiveCurrentDay,
    existingSharedSession,
    user?.id,
    isOwner,
    currentSession,
  ]);

  const handleNextDay = useCallback(async () => {
    if (!currentSession || !plan || effectiveCurrentDay >= plan.duration_days)
      return;
    const newDay = effectiveCurrentDay + 1;

    // Update store immediately for responsive UI
    if (existingSharedSession && user?.id) {
      planStore$.updateParticipantProgress(user.id, newDay);
    } else {
      planStore$.updateSessionProgress(currentSession.id, newDay);
    }

    // Persist to server
    try {
      if (existingSharedSession && user?.id) {
        await updateParticipantProgress(
          existingSharedSession.id,
          user.id,
          newDay,
        );
      }
      if (isOwner) {
        await updatePlanSessionProgress(currentSession.id, newDay);
      }
    } catch (error) {
      console.error("Failed to save day progress:", error);
    }
  }, [
    plan,
    effectiveCurrentDay,
    existingSharedSession,
    user?.id,
    isOwner,
    currentSession,
  ]);

  // Jump to a specific day from date picker
  const handleSelectDay = useCallback(
    async (day: number) => {
      if (!currentSession) return;
      setShowDatePicker(false);

      // Update store immediately for responsive UI
      if (existingSharedSession && user?.id) {
        planStore$.updateParticipantProgress(user.id, day);
      } else {
        planStore$.updateSessionProgress(currentSession.id, day);
      }

      // Persist to server
      try {
        if (existingSharedSession && user?.id) {
          await updateParticipantProgress(
            existingSharedSession.id,
            user.id,
            day,
          );
        }
        if (isOwner) {
          await updatePlanSessionProgress(currentSession.id, day);
        }
      } catch (error) {
        console.error("Failed to save day progress:", error);
      }
    },
    [existingSharedSession, user?.id, isOwner, currentSession],
  );

  const handleExpandComments = () => {
    planStore$.setSessionUIMode("comments");
  };

  const handleCollapseToReading = () => {
    planStore$.setSessionUIMode("reading");
  };

  const handleOpenSettings = () => {
    setShowSettingsModal(true);
  };

  // Study mode handlers
  const handleEnterStudyMode = () => {
    setShowStudyModeModal(true);
  };

  const handleExitStudyMode = () => {
    planStudyModeStore$.exitStudyMode();
  };

  const handleSelectCompare = (version: any) => {
    planStudyModeStore$.enterStudyMode("COMPARE", version.id);
    setShowStudyModeModal(false);
  };

  const handleSelectNotes = () => {
    planStudyModeStore$.enterStudyMode("NOTES");
    setShowStudyModeModal(false);
  };

  // Handle closing thread view (uses store method)
  const handleCloseThread = useCallback(() => {
    planStore$.closeThread();
  }, []);

  // Handle day completion with animation
  const handleDayComplete = useCallback(async () => {
    if (!sessionId || isDayComplete || !user?.id) return;

    // Trigger color wave animation
    setShowCompletionWave(true);

    // Mark day as complete in store (syncs with Supabase)
    const result = await planStore$.markDayComplete(
      sessionId,
      effectiveCurrentDay,
      user.id,
    );

    // Cancel today's plan reminder notification if completion succeeded
    if (result.success) {
      import("@/services/planReminderService").then(
        ({ cancelTodayPlanReminder }) => {
          cancelTodayPlanReminder();
        },
      );
    }

    // Show XP notification if XP was awarded (on-time completion)
    if (result.success && result.xpAwarded && result.pointsAwarded > 0) {
      // Update local XP state
      awardXPLocally(
        REWARD_TYPES.DAY_COMPLETE,
        result.pointsAwarded,
      );
      // Progress bar updates reactively via completedActivitiesCount$
    }
  }, [
    sessionId,
    effectiveCurrentDay,
    isDayComplete,
    user?.id,
  ]);

  // Hide color wave after animation
  const handleCompletionWaveComplete = useCallback(() => {
    setShowCompletionWave(false);
  }, []);

  // Hide comment trophy animation
  const handleCommentTrophyComplete = useCallback(() => {
    planStore$.hideCommentTrophy();
  }, []);

  // Handle progress node press - scroll to that reading section
  const handleProgressNodePress = useCallback((index: number) => {
    readingContentRef.current?.scrollToSection(index);
  }, []);

  // Render comment using unified Card component
  const renderComment = useCallback(
    ({ item }: { item: SessionCommentWithUser }) => {
      // Convert to unified type for Card component
      const unifiedComment = sessionCommentToUnified(
        item,
        existingSharedSession?.id || "",
      );
      return <Card comment={unifiedComment} />;
    },
    [existingSharedSession?.id],
  );

  if (loading) {
    return (
      <SafeAreaView
        style={[
          styles.container,
          { backgroundColor: theme.colors.background.primary },
        ]}
      >
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.text.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!currentSession || !plan) {
    return (
      <SafeAreaView
        style={[
          styles.container,
          { backgroundColor: theme.colors.background.primary },
        ]}
      >
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: theme.colors.text.muted }]}>
            Session not found
          </Text>
          <Pressable onPress={handleBack} style={styles.backButton}>
            <Text
              style={[
                styles.backButtonText,
                { color: theme.colors.text.primary },
              ]}
            >
              Go Back
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // For shared sessions: require sign-in when online
  const requiresAuth = existingSharedSession && !isAuthenticated && isOnline;

  const currentDay = effectiveCurrentDay;
  // Note: todayData is calculated earlier (before early returns) for React hooks rules
  const isCompleted = currentSession?.status === "completed";
  const showExpandedPanel =
    uiMode === "comments" || uiMode === "participants" || uiMode === "thread";
  const isInThreadMode = uiMode === "thread";

  // Comments list header
  const CommentsListHeader = () => (
    <Pressable
      onPress={handleCollapseToReading}
      style={[
        styles.listHeader,
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
          {comments.length} {comments.length === 1 ? "comment" : "comments"}
        </Text>
      </View>
      <Ionicons name="chevron-down" size={18} color={theme.colors.text.muted} />
    </Pressable>
  );

  // Empty state for comments
  const CommentsEmptyComponent = () => {
    if (!commentsInitialized || commentsLoading) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="small" color={theme.colors.accent} />
          <Text style={[styles.emptyText, { color: theme.colors.text.muted }]}>
            Loading comments...
          </Text>
        </View>
      );
    }

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

  // Wrap with AuthGate if shared session requires auth (online + not authenticated)
  const content = (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.colors.background.primary },
      ]}
    >
      {/* Header Section - Header + Day Navigator with auto-hide animation */}
      <ReAnimated.View
        style={[
          styles.headerSection,
          {
            backgroundColor: theme.colors.background.primary,
            paddingTop: insets.top, // Safe area padding
          },
          headerAnimatedStyle,
        ]}
      >
        <View style={styles.header}>
          <Pressable onPress={handleBack} style={styles.headerButton}>
            <Ionicons
              name="arrow-back"
              size={24}
              color={theme.colors.text.primary}
            />
          </Pressable>
          <Text
            style={[styles.headerTitle, { color: theme.colors.text.primary }]}
            numberOfLines={1}
          >
            {plan.name}
          </Text>
          <Pressable onPress={handleOpenSettings} style={styles.headerButton}>
            <Ionicons
              name="settings-outline"
              size={22}
              color={theme.colors.text.primary}
            />
          </Pressable>
        </View>

        {/* Day Navigator - Hidden when in comments mode */}
        {!showExpandedPanel && (
          <PlanDayNavigator
            currentDay={currentDay}
            totalDays={plan.duration_days}
            startedAt={currentSession.started_at}
            onPreviousDay={handlePreviousDay}
            onNextDay={handleNextDay}
            onDayPress={() => setShowDatePicker(true)}
            isComplete={isDayComplete}
            dayRewardsSummary={dayRewardsSummary}
          />
        )}
      </ReAnimated.View>

      {/* Main Content Area */}
      <View style={styles.contentArea}>
        {/* Reading Mode: Full Bible content with sidebar progress */}
        {!showExpandedPanel && (
          <>
            <View style={styles.fullReadingSection}>
              {/* Horizontal row: Progress sidebar + Reading content */}
              <View style={styles.readingWithProgressRow}>
                {/* Vertical Progress Map - Left Sidebar */}
                {todayData && (
                  <View
                    style={[
                      styles.progressSidebar,
                      {
                        paddingTop: contentPaddingTopValue,
                        paddingBottom: contentPaddingBottomValue,
                      },
                    ]}
                  >
                    <ProgressMap
                      totalReadings={todayReadings.length}
                      readingScrollPositions={
                        dayProgress.readingScrollPositions
                      }
                      readingStartPositions={dayProgress.readingStartPositions}
                      readingIds={todayReadings.map((r) => r.reference)}
                      isDayComplete={isDayComplete}
                      overallProgress={dayProgress.scrollProgress}
                      onNodePress={handleProgressNodePress}
                    />
                  </View>
                )}

                {/* Reading Content */}
                <View style={styles.readingContent}>
                  {isCompleted ? (
                    <View style={styles.completedSection}>
                      <Ionicons
                        name="checkmark-circle"
                        size={64}
                        color={theme.colors.text.primary}
                      />
                      <Text
                        style={[
                          styles.completedTitle,
                          { color: theme.colors.text.primary },
                        ]}
                      >
                        Plan Completed!
                      </Text>
                      <Text
                        style={[
                          styles.completedSubtitle,
                          { color: theme.colors.text.muted },
                        ]}
                      >
                        Congratulations on finishing this reading plan.
                      </Text>
                    </View>
                  ) : todayData ? (
                    // Conditionally render study mode view or regular reading content
                    isPlanStudyModeActive && planStudyModeType !== "SIMPLE" ? (
                      <PlanStudyModeView
                        readings={todayReadings}
                        contentPaddingTop={contentPaddingTopValue}
                        contentPaddingBottom={contentPaddingBottomValue}
                        scrollProps={readingScrollProps}
                      />
                    ) : (
                      <PlanReadingContent
                        ref={readingContentRef}
                        content={todayData.content}
                        dayNumber={currentDay}
                        isDayComplete={isDayComplete}
                        onDayComplete={handleDayComplete}
                        isFutureDay={isFutureDay}
                        daysUntilUnlock={daysUntilUnlock}
                        sessionId={sessionId}
                        scrollProps={readingScrollProps}
                        contentPaddingTop={contentPaddingTopValue}
                        contentPaddingBottom={contentPaddingBottomValue}
                        headerContent={
                          <>
                            {!reminderPrefs.reminderEnabled &&
                              !reminderPrefs.reminderDismissed && (
                                <ReminderConfigBanner />
                              )}
                            {reminderPrefs.reminderEnabled &&
                              !hasNotificationPermission && (
                                <PushPermissionWarningBanner />
                              )}
                          </>
                        }
                      />
                    )
                  ) : (
                    <View style={styles.emptyContainer}>
                      <Text
                        style={[
                          styles.emptyText,
                          { color: theme.colors.text.muted },
                        ]}
                      >
                        No readings for this day
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </View>

            {/* Collapsed Comments Preview - positioned at bottom with safe area + auto-hide animation */}
            <ReAnimated.View
              style={[
                styles.collapsedPreviewContainer,
                { bottom: insets.bottom },
                bottomElementsAnimatedStyle,
              ]}
            >
              <SessionCollapsedPreview
                onPress={
                  existingSharedSession
                    ? handleExpandComments
                    : handleOpenSettings
                }
                isShared={!!existingSharedSession}
              />
            </ReAnimated.View>

            {/* Plan FAB - floats above comment preview, auto-hides on scroll */}
            <PlanFAB
              onEnterStudyMode={handleEnterStudyMode}
              onExitStudyMode={handleExitStudyMode}
              animatedStyle={bottomElementsAnimatedStyle}
            />
          </>
        )}

        {/* Compact Reading - fixed at top in comments mode, still scrollable */}
        {showExpandedPanel && todayData && (
          <View style={styles.reducedReadingFixed}>
            <PlanReadingContent
              content={todayData.content}
              dayNumber={currentDay}
              variant="compact"
            />
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
          pointerEvents={showExpandedPanel ? "auto" : "none"}
        >
          {existingSharedSession ? (
            <PlanCommentProvider
              sharedSessionId={existingSharedSession.id}
              dayNumber={currentDay}
            >
              {/* Thread View (when viewing replies) */}
              {isInThreadMode ? (
                <ThreadView onClose={handleCloseThread} />
              ) : (
                <>
                  {/* Sticky Header */}
                  <CommentsListHeader />

                  {/* Content list */}
                  <View
                    style={[
                      styles.commentsListWrapper,
                      { marginBottom: insets.bottom + INPUT_HEIGHT },
                    ]}
                  >
                    {uiMode === "participants" ? (
                      <SessionParticipantsList maxDays={plan.duration_days} />
                    ) : (
                      <FlashList
                        data={comments}
                        renderItem={renderComment}
                        keyExtractor={(item) => item.id}
                        ListEmptyComponent={CommentsEmptyComponent}
                        contentContainerStyle={{
                          ...styles.listContent,
                          paddingBottom: insets.bottom + 80,
                        }}
                        showsVerticalScrollIndicator={true}
                        {...flashListConfig.props}
                      />
                    )}

                    {/* Gradient fade overlay */}
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
                </>
              )}
            </PlanCommentProvider>
          ) : (
            <>
              {/* Sticky Header */}
              <CommentsListHeader />
              {/* Content list (no provider for non-shared sessions) */}
              <View
                style={[
                  styles.commentsListWrapper,
                  { marginBottom: insets.bottom + INPUT_HEIGHT },
                ]}
              >
                {uiMode === "participants" ? (
                  <SessionParticipantsList maxDays={plan.duration_days} />
                ) : (
                  <View style={styles.emptyContainer}>
                    <Text
                      style={[
                        styles.emptyText,
                        { color: theme.colors.text.muted },
                      ]}
                    >
                      Share this session to enable comments
                    </Text>
                  </View>
                )}
              </View>
            </>
          )}
        </Animated.View>
      </View>

      {/* Input - outside contentArea, stays above keyboard (like DevotionContent) */}
      {showExpandedPanel && uiMode === "comments" && existingSharedSession && (
        <KeyboardStickyView
          style={[styles.stickyInputContainer, { bottom: 0 }]}
          offset={{
            closed: -insets.bottom,
            opened: isEmulator ? -insets.bottom : 0,
          }}
        >
          <View style={styles.inputContainer}>
            <SessionCommentInput
              sharedSessionId={existingSharedSession.id}
              dayNumber={currentDay}
            />
          </View>
        </KeyboardStickyView>
      )}

      {/* Settings Modal */}
      <SessionSettingsModal
        visible={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        session={currentSession}
        planName={plan?.name || "Bible Plan"}
      />

      {/* Study Mode Setup Modal */}
      <StudyModeSetupModal
        visible={showStudyModeModal}
        onClose={() => setShowStudyModeModal(false)}
        onSelectCompare={handleSelectCompare}
        onSelectNotes={handleSelectNotes}
        availableVersions={availableVersions}
        currentVersion={primaryVersion}
      />

      {/* Day Picker Modal */}
      <CalendarPickerModal
        visible={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        selectedDate={(() => {
          // Calculate the date string for the currently viewed day
          // Normalize to local midnight to handle timezone correctly
          const start = new Date(currentSession.started_at);
          const startLocal = new Date(
            start.getFullYear(),
            start.getMonth(),
            start.getDate(),
          );
          const targetDate = new Date(startLocal);
          targetDate.setDate(startLocal.getDate() + (currentDay - 1));
          // Return local date string (YYYY-MM-DD) without UTC conversion
          const year = targetDate.getFullYear();
          const month = String(targetDate.getMonth() + 1).padStart(2, "0");
          const day = String(targetDate.getDate()).padStart(2, "0");
          return `${year}-${month}-${day}`;
        })()}
        onSelectDate={() => {}} // Not used in plan mode
        planMode={{
          startedAt: currentSession.started_at,
          totalDays: plan.duration_days,
          currentDay: currentDay,
          onSelectDay: handleSelectDay,
        }}
      />

      {/* Ambient glow for completed days (base layer) */}
      {isDayComplete && (
        <BottomGlowOverlay visible={true} continuous />
      )}

      {/* Burst effect when completing (top layer, fades to reveal continuous underneath) */}
      <BottomGlowOverlay
        visible={showCompletionWave}
        onComplete={handleCompletionWaveComplete}
      />

      {/* Comment Trophy Animation */}
      <CommentTrophy
        visible={showCommentTrophy}
        onComplete={handleCommentTrophyComplete}
      />
    </View>
  );

  // If auth required for shared session, wrap with AuthGate
  if (requiresAuth) {
    return (
      <AuthGate
        feature="shared Bible plan"
        promptMessage="Sign in to track your progress, view comments, and participate with others in this shared Bible plan."
        blockOfflineAccess
      >
        {content}
      </AuthGate>
    );
  }

  return content;
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  errorText: {
    fontSize: 16,
  },
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  headerSection: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 0, // Minimal gap before day navigator
  },
  headerButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "600",
    flex: 1,
    textAlign: "center",
  },
  contentArea: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  fullReadingSection: {
    flex: 1,
  },
  readingWithProgressRow: {
    flex: 1,
    flexDirection: "row",
  },
  progressSidebar: {
    width: 28,
    alignItems: "center",
    paddingLeft: 0,
  },
  readingContent: {
    flex: 1,
  },
  collapsedPreviewContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    // bottom set dynamically to include safe area inset
    zIndex: 10,
  },
  reducedReadingFixed: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "25%",
    zIndex: 2,
    overflow: "hidden",
  },
  commentsPanel: {
    position: "absolute",
    top: "25%",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "column",
  },
  commentsListWrapper: {
    flex: 1,
    overflow: "hidden",
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
    zIndex: 1,
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
  completedSection: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    gap: 16,
  },
  completedTitle: {
    fontSize: 24,
    fontWeight: "700",
  },
  completedSubtitle: {
    fontSize: 15,
    textAlign: "center",
  },
  stickyInputContainer: {
    position: "absolute",
    left: 0,
    right: 0,
  },
  inputContainer: {
    backgroundColor: "transparent",
  },
});
