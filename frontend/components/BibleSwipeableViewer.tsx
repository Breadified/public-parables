/**
 * BibleSwipeableViewer - Smooth horizontal swipe navigation between Bible tabs
 * Pre-renders adjacent tabs for seamless swiping experience
 *
 * REFACTORED: Now using composition hooks for cleaner swipe and tab management
 * - useSwipeGesture: Reusable swipe gesture logic with resistance and animations
 * - useTabPreloading: Tab pre-rendering optimization for smooth transitions
 */

import React, { useCallback, useRef, useMemo, useEffect, useState } from "react";
import {
  StyleSheet,
  View,
} from "react-native";
import { observer, useSelector } from "@legendapp/state/react";
import { bibleStore$ } from "@/state/bibleStore";
import { bibleVersionStore$ } from "@/state/bibleVersionStore";
import { studyModeStore$ } from "@/state/studyModeStore";
import { switchToTab as switchTab, updateTabState, saveTabsDebounced, saveTabsImmediate } from "@/modules/bible/tabManager";
import { useSwipeGesture } from "../hooks/useSwipeGesture";
import { useTabPreloading } from "../hooks/useTabPreloading";
import { ChapterLevelBibleView } from "./ChapterLevelBibleView";
import { VerseAlignedSplitView } from "./MultiPane/VerseAlignedSplitView";
import { BibleNotesAlignedView } from "./MultiPane/BibleNotesAlignedView";
import { LoadingScripture } from "./LoadingScripture";
import { BibleReaderPaneState, StudyNotesPaneState, PaneType, PaneLinkMode } from "@/types/multiPane";
import { StudyModeType } from "@/config/studyModeConfig";
import { useScrollContext } from "../contexts/ScrollContext";
import { useDimensions } from "../contexts/DimensionsContext";
import { useTheme } from "../contexts/ThemeContext";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolate,
  Easing,
} from "react-native-reanimated";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";

// Screen width will be obtained from dimensions context

interface BibleSwipeableViewerProps {
  fontSize?: number;
  showVerseNumbers?: boolean;
  onDeleteNote?: (noteId: string) => void;
}

/**
 * Main swipeable viewer component
 */
const BibleSwipeableViewerComponent: React.FC<BibleSwipeableViewerProps> = ({
  fontSize = 16,
  showVerseNumbers = true,
  onDeleteNote,
}) => {
  // Get dimensions from global context
  const dimensions = useDimensions();
  const screenWidth = dimensions.width;
  
  // Get theme from global context
  const { theme } = useTheme();
  
  // PERF FIX: Only subscribe to tabs.length, not full tabs array
  // Title/chapter changes shouldn't re-render the viewer - individual tab views handle that
  const tabsLength = useSelector(() => bibleStore$.tabs.length);
  const activeTabIndex = useSelector(bibleStore$.active_tab_index);

  // Non-reactive read of tabs for rendering (won't trigger re-renders)
  const tabs = bibleStore$.tabs.peek();

  // Get current version from bibleVersionStore
  const primaryVersion = useSelector(bibleVersionStore$.primaryVersion);

  // Study mode state - watch for changes
  const isStudyModeActive = useSelector(studyModeStore$.isActive);
  const studyModeType = useSelector(studyModeStore$.studyModeType);
  const comparisonVersion = useSelector(studyModeStore$.comparisonVersion);

  // Get version names for study mode
  const primaryVersionData = useSelector(bibleVersionStore$.primaryVersionData);
  const comparisonVersionData = useSelector(() =>
    comparisonVersion ? bibleVersionStore$.getVersionData(comparisonVersion) : null
  );

  // Get scroll context to reset UI when switching tabs
  const scrollContext = useScrollContext();

  // Debounce timer for saving tab state
  const saveDebounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ✅ Track which tabs have completed initial navigation
  const [tabsInitialized, setTabsInitialized] = useState<Set<number>>(new Set());

  // Mark tab as initialized when navigation completes (callback-based, no timers!)
  const markTabInitialized = useCallback((tabIndex: number) => {
    setTabsInitialized(prev => {
      if (prev.has(tabIndex)) return prev;
      const next = new Set(prev);
      next.add(tabIndex);
      console.log('[BibleSwipeableViewer] Tab', tabIndex, 'initialized (navigation completed)');
      return next;
    });
  }, []);

  // ========== SHARED CALLBACKS (eliminates duplication) ==========

  /**
   * Handle chapter change - ONLY updates active tab to prevent stored titles from being overwritten
   * Pre-rendered inactive tabs should retain their stored titles
   */
  const handleChapterChange = useCallback((
    tabIndex: number,
    chapterId: number,
    bookName: string,
    chapterNumber: number
  ) => {
    // Only update the active tab - inactive tabs retain their stored state
    if (tabIndex === activeTabIndex) {
      updateTabState(tabIndex, chapterId, bookName, chapterNumber);
      // PERF: Longer debounce (3s) to avoid frequent storage writes during scroll
      saveTabsDebounced(3000);
    }
  }, [activeTabIndex]);

  /**
   * Handle navigation complete - marks tab as initialized
   */
  const handleNavigationComplete = useCallback((tabIndex: number) => {
    markTabInitialized(tabIndex);
  }, [markTabInitialized]);

  /**
   * Extract chapter info from tab - eliminates duplicate calculations
   */
  const extractChapterInfo = useCallback((tab: typeof tabs[0]) => {
    const chapterId = tab.current_chapter_id || 1001000;
    const chapterNum = Math.floor((chapterId % 1000000) / 1000);
    const bookId = Math.floor(chapterId / 1000000);
    return { chapterId, chapterNum, bookId };
  }, []);

  /**
   * Create BibleReaderPaneState - eliminates duplicate pane creation
   */
  const createBibleReaderPane = useCallback((
    idPrefix: string,
    tabId: string,
    versionId: string,
    versionName: string,
    chapterId: number,
    chapterNum: number
  ): BibleReaderPaneState => ({
    id: `${idPrefix}-${tabId}`,
    type: PaneType.BIBLE_READER,
    title: versionName,
    linkMode: PaneLinkMode.CONTENT_ALIGNED,
    createdAt: Date.now(),
    versionId,
    currentChapterId: chapterId,
    scrollPosition: 0,
    selectedVerseId: null,
    bookName: 'Loading',
    chapterNumber: chapterNum,
  }), []);

  // Handle tab switch - integrates with swipe gesture hook
  // NOTE: Defined before useSwipeGesture to avoid circular reference
  const switchToTab = useCallback((newIndex: number) => {
    switchTab(newIndex);
    // Reset scroll state to show header and tabs when switching
    const ctx = scrollContext;
    if (ctx?.resetScrollState) {
      ctx.resetScrollState();
    }
  }, [scrollContext]);

  // Animated tab switch for TextInput swipes - must be defined AFTER useSwipeGesture
  // Will be assigned in useEffect after swipe gesture hook initializes
  const animatedSwitchToTabRef = useRef<((newIndex: number) => void) | null>(null);

  // Tab pre-rendering hook - replaces manual tabsToRender calculation
  const { tabsToRender } = useTabPreloading({
    tabs,
    activeIndex: activeTabIndex,
    renderRadius: 2, // Render 2 tabs on each side of active
  });


  // Swipe gesture hook - replaces manual pan gesture and animation logic
  // CRITICAL: Get activeIndexShared from hook to prevent tab flashing
  const { panGesture, translateX, activeIndexShared, reset: resetGesture } = useSwipeGesture({
    itemCount: tabsLength,
    currentIndex: activeTabIndex,
    onSwipe: switchToTab,
    isVerticalScrollActive: isStudyModeActive && !!comparisonVersion,
    screenWidth,
  });

  // Create animated tab switch function for TextInput swipes
  const animatedSwitchToTab = useCallback((newIndex: number) => {
    const direction = newIndex > activeTabIndex ? -1 : 1;
    const distance = screenWidth * direction;

    console.log('[BibleSwipeableViewer] Animated switch to tab:', {
      from: activeTabIndex,
      to: newIndex,
      direction,
      distance,
    });

    // Animate translateX to reveal the new tab
    // This matches the pattern in useSwipeGesture.ts
    translateX.value = withTiming(
      distance,
      { duration: 200, easing: Easing.out(Easing.cubic) },
      (finished) => {
        'worklet';
        if (finished) {
          // ✅ Update activeIndexShared AFTER animation completes (prevents double offset)
          activeIndexShared.value = newIndex;
          // Call switchToTab on JS thread to update React state
          runOnJS(switchToTab)(newIndex);
          // Reset translateX
          translateX.value = 0;
        }
      }
    );
  }, [activeTabIndex, screenWidth, translateX, activeIndexShared, switchToTab]);

  // Store ref for use in render
  useEffect(() => {
    animatedSwitchToTabRef.current = animatedSwitchToTab;
  }, [animatedSwitchToTab]);

  // ========== SWIPE HANDLERS (eliminates duplication in NOTES mode) ==========

  /**
   * Handle swipe cancel - snap back to original position
   */
  const handleSwipeCancel = useCallback(() => {
    translateX.value = withTiming(0, {
      duration: 150,
      easing: Easing.out(Easing.cubic),
    });
  }, [translateX]);

  /**
   * Handle swipe left - navigate to next tab (if exists)
   */
  const handleSwipeLeft = useCallback(() => {
    if (activeTabIndex < tabsLength - 1) {
      const newIndex = activeTabIndex + 1;
      if (animatedSwitchToTabRef.current) {
        animatedSwitchToTabRef.current(newIndex);
      } else {
        switchToTab(newIndex);
      }
    } else {
      // At last tab - snap back
      handleSwipeCancel();
    }
  }, [activeTabIndex, tabsLength, switchToTab, handleSwipeCancel]);

  /**
   * Handle swipe right - navigate to previous tab (if exists)
   */
  const handleSwipeRight = useCallback(() => {
    if (activeTabIndex > 0) {
      const newIndex = activeTabIndex - 1;
      if (animatedSwitchToTabRef.current) {
        animatedSwitchToTabRef.current(newIndex);
      } else {
        switchToTab(newIndex);
      }
    } else {
      // At first tab - snap back
      handleSwipeCancel();
    }
  }, [activeTabIndex, switchToTab, handleSwipeCancel]);

  /**
   * Handle swipe progress - real-time feedback during swipe
   */
  const handleSwipeProgress = useCallback((deltaX: number) => {
    translateX.value = deltaX;
  }, [translateX]);


  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveDebounceTimer.current) {
        clearTimeout(saveDebounceTimer.current);
        // Save immediately on unmount
        saveTabsImmediate();
      }
    };
  }, []);

  // Shared value for screen width (activeIndexShared comes from hook)
  const screenWidthShared = useSharedValue(screenWidth);

  // Update shared values when props change
  useEffect(() => {
    screenWidthShared.value = screenWidth;
  }, [screenWidth]);

  // Animated style for the container
  // Offset the entire container based on active tab position + gesture translateX from hook
  const animatedContainerStyle = useAnimatedStyle(() => {
    // Base offset: move container left by (activeTabIndex * screenWidth) to center active tab
    const baseOffset = -activeIndexShared.value * screenWidthShared.value;
    return {
      transform: [{ translateX: baseOffset + translateX.value }],
    };
  });

  // Animated styles for swipe indicators
  const leftIndicatorStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [0, 100],
      [0, 0.5],
      Extrapolate.CLAMP
    ),
  }));

  const rightIndicatorStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [0, -100],
      [0, 0.5],
      Extrapolate.CLAMP
    ),
  }));

  // Memoize styles with screen width and tab count
  const styles = useMemo(() => getStyles(theme.colors, screenWidth, tabs.length), [theme.colors, screenWidth, tabs.length]);

  return (
    <GestureHandlerRootView style={styles.container}>
      {/* Swipeable Content Area */}
      <GestureDetector gesture={panGesture}>
        <View style={styles.contentContainer}>
          <Animated.View style={[styles.tabsContainer, animatedContainerStyle]}>
            {tabsToRender.map((item) => (
              <View
                key={item.tab.id}
                style={[
                  styles.tabContent,
                  { left: screenWidth * item.absolutePosition },
                ]}
              >
                {/* Render based on study mode state */}
                {isStudyModeActive && studyModeType === StudyModeType.COMPARE && comparisonVersion ? (
                  // COMPARE mode - render verse-aligned split view
                  (() => {
                    const { chapterId, chapterNum } = extractChapterInfo(item.tab);
                    const leftPane = createBibleReaderPane(
                      'temp-left', item.tab.id, primaryVersion,
                      primaryVersionData?.name || primaryVersion, chapterId, chapterNum
                    );
                    const rightPane = createBibleReaderPane(
                      'temp-right', item.tab.id, comparisonVersion,
                      comparisonVersionData?.name || comparisonVersion, chapterId, chapterNum
                    );

                    return (
                      <VerseAlignedSplitView
                        key={`study-${item.tab.id}-${primaryVersion}-${comparisonVersion}`}
                        leftPane={leftPane}
                        rightPane={rightPane}
                        isActive={item.index === activeTabIndex}
                        onChapterChange={(cId, bName, cNum) => handleChapterChange(item.index, cId, bName, cNum)}
                        onNavigationComplete={() => handleNavigationComplete(item.index)}
                      />
                    );
                  })()
                ) : isStudyModeActive && studyModeType === StudyModeType.NOTES ? (
                  // NOTES mode - render verse-aligned Bible + Notes
                  (() => {
                    const { chapterId, chapterNum, bookId } = extractChapterInfo(item.tab);
                    const biblePane = createBibleReaderPane(
                      'bible', item.tab.id, primaryVersion,
                      primaryVersionData?.name || primaryVersion, chapterId, chapterNum
                    );
                    const notesPane: StudyNotesPaneState = {
                      id: `notes-${item.tab.id}`,
                      type: PaneType.STUDY_NOTES,
                      title: 'Notes',
                      linkMode: PaneLinkMode.CONTENT_ALIGNED,
                      createdAt: Date.now(),
                      currentChapterId: chapterId,
                      currentBookId: bookId,
                      sortBy: 'verse',
                      isEditing: false,
                      formattingType: 'prose',
                    };

                    return (
                      <BibleNotesAlignedView
                        key={`notes-${item.tab.id}-${primaryVersion}`}
                        biblePane={biblePane}
                        notesPane={notesPane}
                        isActive={item.index === activeTabIndex}
                        onChapterChange={(cId, bName, cNum) => handleChapterChange(item.index, cId, bName, cNum)}
                        onNavigationComplete={() => handleNavigationComplete(item.index)}
                        onSwipeProgress={handleSwipeProgress}
                        onSwipeCancel={handleSwipeCancel}
                        onSwipeLeft={handleSwipeLeft}
                        onSwipeRight={handleSwipeRight}
                        onDeleteNote={onDeleteNote}
                      />
                    );
                  })()
                ) : (
                  // Normal mode - render single version with chapter-level selection
                  <ChapterLevelBibleView
                    key={`viewer-${item.tab.id}-${primaryVersion}`}
                    chapterId={item.tab.current_chapter_id || 1001000}
                    isActive={item.index === activeTabIndex}
                    versionId={primaryVersion}
                    onChapterChange={(cId, bName, cNum) => handleChapterChange(item.index, cId, bName, cNum)}
                    onNavigationComplete={() => handleNavigationComplete(item.index)}
                  />
                )}

                {/* ✅ NEW: Show loading overlay until tab is initialized */}
                {item.index === activeTabIndex && !tabsInitialized.has(item.index) && (
                  <LoadingScripture visible={true} />
                )}
              </View>
            ))}
          </Animated.View>

          {/* Visual indicators for swipe hints */}
          {activeTabIndex > 0 && (
            <Animated.View
              style={[
                styles.swipeIndicator,
                styles.swipeIndicatorLeft,
                leftIndicatorStyle,
              ]}
            />
          )}

          {activeTabIndex < tabs.length - 1 && (
            <Animated.View
              style={[
                styles.swipeIndicator,
                styles.swipeIndicatorRight,
                rightIndicatorStyle,
              ]}
            />
          )}
        </View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
};

// Export wrapped with observer
export const BibleSwipeableViewer = observer(BibleSwipeableViewerComponent);

/**
 * Styles factory with responsive design
 * Uses theme colors directly from ThemeContext
 */
const getStyles = (themeColors: any, screenWidth: number, tabCount: number) => {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: themeColors.background.primary,
    },
    contentContainer: {
      flex: 1,
      overflow: "hidden",
    },
    tabsContainer: {
      flex: 1,
      flexDirection: "row",
      // CRITICAL: Container must be wide enough to hold all absolutely-positioned tabs
      // Otherwise tabs positioned beyond screenWidth cannot receive touch events
      width: screenWidth * tabCount,
    },
    tabContent: {
      position: "absolute",
      width: screenWidth,
      height: "100%",
    },
    swipeIndicator: {
      position: "absolute",
      top: 0,
      bottom: 0,
      width: 20,
      backgroundColor: `${themeColors.accent}4D`, // 30% opacity
    },
    swipeIndicatorLeft: {
      left: 0,
    },
    swipeIndicatorRight: {
      right: 0,
    },
  });
};
