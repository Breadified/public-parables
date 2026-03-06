/**
 * Verse-Aligned Split View - Single FlashList for study mode
 *
 * Renders two Bible versions side-by-side in a unified FlashList
 * Natural scrolling with verse-by-verse alignment
 * For CONTENT_ALIGNED Bible reader panes only
 *
 * REFACTORED: Now using composition hooks for cleaner navigation and tracking
 * - useBibleNavigation: Unified navigation (waits for items, then scrolls)
 * - useVerseAlignedNavigation: Specialized verse-level positioning
 * - useFlashListConfig: Standardized FlashList configuration
 * - useBibleScrollHandlers: Shared scroll handling logic
 */

import React, { useCallback, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, InteractionManager } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { observer, useSelector } from '@legendapp/state/react';
import { BibleReaderPaneState } from '../../types/multiPane';
import { useVerseAlignedChapters } from '../../hooks/useVerseAlignedChapters';
import { useTheme } from '../../contexts/ThemeContext';
import { useDimensions } from '../../contexts/DimensionsContext';
import { bibleStore$ } from '../../state/bibleStore';
import { activeHighlights$ } from '../../state/notesStore';
import { createBibleStyles } from '../Bible/BibleStyles';
import { updateBibleReaderChapter } from '../../state/multiPaneStore';
import { AlignedChapterItem } from './AlignedChapterItem';
import type { TextActionEvent } from '../Bible/BibleContentRenderer';
import { useBibleScrollHandlers } from '../../hooks/useBibleScrollHandlers';
import { useTextActionHandler } from '../../hooks/useTextActionHandler';
import { HighlightColorPicker } from '../Bible/HighlightColorPicker';
import { useBibleNavigation } from '../../hooks/useBibleNavigation';
import { useFlashListConfig } from '../../hooks/useFlashListConfig';
import { useVerseAlignedNavigation } from '../../hooks/navigation/useVerseAlignedNavigation';

/**
 * Global cache for tab data to enable instant tab switching
 */
const tabDataCache = new Map<string, any[]>();
const MAX_TAB_CACHE_SIZE = 100;

interface VerseAlignedSplitViewProps {
  leftPane: BibleReaderPaneState;
  rightPane: BibleReaderPaneState;
  isActive?: boolean;
  onChapterChange?: (chapterId: number, bookName: string, chapterNumber: number) => void;
  onNavigationComplete?: () => void;
}

/**
 * Verse-Aligned Split View Component
 */
export const VerseAlignedSplitView = observer(({
  leftPane,
  rightPane,
  isActive = true,
  onChapterChange,
  onNavigationComplete,
}: VerseAlignedSplitViewProps) => {
  const { theme } = useTheme();
  const flashListRef = useRef<any>(null);

  // SCROLL LOOP FIX: Capture initial chapter ID ONCE to prevent reload loops
  // When chapter tracking updates leftPane.currentChapterId, this ref stays stable
  // preventing useSimplifiedBibleLoader from re-loading on every chapter change
  const initialChapterIdRef = useRef(leftPane.currentChapterId);

  // Verse position tracking for navigation
  const versePositionsRef = useRef<Map<number, { offsetY: number; height: number }>>(new Map());

  // Extract versionIds to primitives for hook dependencies
  const leftVersionId = leftPane.versionId;

  // Unified text action handler (copy, share, highlight, note, bookmark)
  const { handleAction: handleUnifiedAction, highlightActions } = useTextActionHandler({
    versionId: leftVersionId,
  });


  // Track if we're loading previous chapters to prevent duplicate calls
  const isLoadingPreviousRef = useRef(false);

  // Track when we're prepending previous chapters (for disabling chapter tracking)
  const isPrependingRef = useRef(false);

  // Track first visible chapter ID for scroll position restoration after prepend
  const firstVisibleChapterIdRef = useRef<number | null>(null);

  // Track chapter ID to restore position to after prepending
  const restorePositionToChapterIdRef = useRef<number | null>(null);

  // FOLDABLE FIX: Get dimensions from context (reactive to fold/unfold)
  const dimensions = useDimensions();

  // PERF FIX: Only subscribe when active to prevent cascade re-renders across tabs
  // Using callback form means inactive tabs don't access .get(), so they don't subscribe
  const selectedVerseId = useSelector(() =>
    isActive ? bibleStore$.activeTabSelectedVerse.get() : null
  );
  const selectedChapterId = useSelector(() =>
    isActive ? bibleStore$.activeTabSelectedChapter.get() : null
  );

  // Subscribe to active highlights for rendering
  const allActiveHighlights = useSelector(activeHighlights$);

  // Use shared scroll handlers hook
  const scrollHandlers = useBibleScrollHandlers(isActive);

  // Load aligned chapters for both versions
  // SCROLL LOOP FIX: Use stable ref instead of reactive leftPane.currentChapterId
  // startFromTarget: true ensures target chapter is at index 0 (no scrolling needed)
  const { chaptersData: freshChaptersData, isLoading, loadMoreChapters, loadPreviousChapters } = useVerseAlignedChapters({
    initialChapterId: initialChapterIdRef.current,
    leftVersionId: leftPane.versionId,
    rightVersionId: rightPane.versionId,
  });

  // Stabilize chapters data at the tab level for instant tab switching
  // PERFORMANCE FIX: Always return cached data to prevent array reference changes triggering re-renders
  // PERF FIX: Use freshChaptersData.length instead of array reference to prevent re-runs on reference changes
  const { chaptersData, isUsingCache } = useMemo(() => {
    const tabCacheKey = `${leftPane.id}-${rightPane.id}-${leftPane.versionId}-${rightPane.versionId}`;

    // Always update cache with fresh data if it's longer (more chapters loaded)
    if (freshChaptersData.length > 0) {
      const existingCache = tabDataCache.get(tabCacheKey);
      if (!existingCache || freshChaptersData.length > existingCache.length) {
        // Manage cache size
        if (tabDataCache.size >= MAX_TAB_CACHE_SIZE) {
          const firstKey = tabDataCache.keys().next().value;
          if (firstKey) {
            tabDataCache.delete(firstKey);
          }
        }
        tabDataCache.set(tabCacheKey, freshChaptersData);
      }
    }

    // Always return cached data if available (stable reference)
    const cached = tabDataCache.get(tabCacheKey);
    if (cached && cached.length > 0) {
      return { chaptersData: cached, isUsingCache: true };
    }

    return { chaptersData: freshChaptersData, isUsingCache: false };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [freshChaptersData.length, leftPane.id, rightPane.id, leftPane.versionId, rightPane.versionId]);

  const effectiveIsLoading = isLoading && !isUsingCache;

  // Create Bible styles - FOLDABLE FIX: Use dimensions from context
  const bibleStyles = useMemo(
    () =>
      createBibleStyles({
        theme,
        fontSize: dimensions.fontSize.base,
        contentPadding: dimensions.contentPadding,
        responsiveFontSizes: dimensions.fontSize,
        isSmallScreen: dimensions.isSmallScreen,
      }),
    [theme, dimensions.fontSize, dimensions.contentPadding, dimensions.isSmallScreen]
  );

  // NOTE: initialScrollIndex removed - with startFromTarget=true, target chapter is always at index 0
  // FlashList renders from the top by default, which is exactly where we want the target

  /**
   * Use composition hooks for config and chapter tracking
   * FOLDABLE FIX: Use responsive estimatedItemSize from dimensions
   */
  const flashListConfig = useFlashListConfig({
    estimatedItemSize: dimensions.estimatedItemSize * 2.5, // Chapters are larger than paragraphs
    loadMoreThreshold: 1.5,
    viewAreaCoveragePercentThreshold: 50,
    minimumViewTime: 500,
    scrollEventThrottle: 16,
    removeClippedSubviews: false,
    drawDistance: 5000,
    keyExtractor: (item: any) => `chapter-${item.chapterId}`,
  });

  /**
   * Use the verse-aligned navigation hook for verse/chapter navigation
   * Initial scroll is now handled by FlashList's initialScrollIndex prop
   */
  const {
    isCalculatingAlignment,
    isInitializing,
    isScrolling,
    isNavigatingRef,
    handleVersePositionReady,
    handleMomentumScrollEnd,
    handleScrollBeginDrag: navHandleScrollBeginDrag,
  } = useVerseAlignedNavigation({
    flashListRef,
    chaptersData,
    isLoading: effectiveIsLoading,
    isActive,
    selectedVerseId,
    selectedChapterId,
    initialChapterId: initialChapterIdRef.current,
    onChapterChange,
    onNavigationComplete,
    leftPaneId: leftPane.id,
    rightPaneId: rightPane.id,
    updateBibleReaderChapter,
  });

  /**
   * Extract chapter info - memoized to prevent callback recreation
   */
  const extractChapterInfo = useCallback((item: any) => ({
    chapterId: item.chapterId,
    bookName: item.bookName,
    chapterNumber: item.chapterNumber,
  }), []);

  /**
   * ✅ UNIFIED NAVIGATION: Wait for items to load, THEN scroll
   * This is the key fix - useBibleNavigation handles scroll timing and verification
   */
  const bibleNavigation = useBibleNavigation({
    targetChapterId: initialChapterIdRef.current,
    items: chaptersData,
    flashListRef,
    extractChapterInfo,
    onNavigationComplete: () => {
      console.log('[VerseAlignedSplitView] ✅ Navigation complete');
      onNavigationComplete?.();
    },
    onChapterChange: (chapterId, bookName, chapterNum) => {
      // Guard: skip during verse-aligned navigation or prepending
      if (isCalculatingAlignment || isInitializing || isScrolling || isPrependingRef.current) {
        return;
      }
      if (isNavigatingRef.current) {
        return;
      }

      // Track first visible chapter for prepend position restoration
      firstVisibleChapterIdRef.current = chapterId;

      updateBibleReaderChapter(leftPane.id, chapterId, bookName, chapterNum);
      updateBibleReaderChapter(rightPane.id, chapterId, bookName, chapterNum);
      onChapterChange?.(chapterId, bookName, chapterNum);
    },
    isActive,
    minItemsForStability: 3,
    debounceDelay: 300,
  });

  // Extract rightVersionId to primitive to avoid object dependency
  const rightVersionId = rightPane.versionId;

  // PERF FIX: Create O(1) chapter lookup Map instead of O(n) .find() calls
  const chapterMap = useMemo(() => {
    const map = new Map<number, typeof chaptersData[0]>();
    chaptersData.forEach(ch => map.set(ch.chapterId, ch));
    return map;
  }, [chaptersData]);

  /**
   * Callback for verse position measurement
   * Captures verse Y offset for verse selection
   */
  const handleVerseLineLayout = useCallback((verseId: number, offsetY: number, height: number) => {
    versePositionsRef.current.set(verseId, { offsetY, height });
  }, []);

  /**
   * Handle text selection actions from native SelectableTextView
   * Uses unified action handler for consistent behavior across all Bible views
   */
  const handleTextAction = useCallback(async (event: TextActionEvent) => {
    // Get verse IDs from verseLines
    const verseIds = [...new Set(event.verseLines.map(l => l.verse_id))];

    // Get chapter context from the first verseLine
    const firstVerseId = event.verseLines[0]?.verse_id;
    const chapterNum = firstVerseId ? Math.floor((firstVerseId % 1000000) / 1000) : 0;
    const chapterId = firstVerseId ? Math.floor(firstVerseId / 1000) * 1000 : 0;
    // PERF FIX: O(1) lookup instead of O(n) .find()
    const chapter = chapterMap.get(chapterId);

    // Use unified action handler (handles validation, toasts, etc.)
    await handleUnifiedAction(
      event.action as 'copy' | 'share' | 'note' | 'highlight' | 'bookmark',
      verseIds,
      event.verseLines,
      {
        bookName: chapter?.bookName || '',
        chapterNumber: chapterNum,
        chapterId,
      }
    );
  }, [chapterMap, handleUnifiedAction]);

  // PERF FIX: Stable style object to prevent recreation on every render
  const chapterMarginStyle = useMemo(() => ({ marginTop: 40 }), []);

  /**
   * Render chapter using aligned chapter item
   * Using stable callbacks and minimal dependencies to prevent unnecessary re-renders
   */
  const renderChapter = useCallback(
    ({ item, index }: any) => (
      // Add 40px gap between chapters (not before the first one)
      <View style={index > 0 ? chapterMarginStyle : undefined}>
        <AlignedChapterItem
          chapter={item}
          selectedVerseId={selectedVerseId}
          leftVersionId={leftVersionId}
          rightVersionId={rightVersionId}
          onVersePositionReady={handleVersePositionReady}
          onVerseLineLayout={handleVerseLineLayout}
          onTextAction={handleTextAction}
          persistedHighlights={allActiveHighlights}
          highlightColors={theme.colors.highlightColors}
        />
      </View>
    ),
    [selectedVerseId, leftVersionId, rightVersionId, handleVersePositionReady, handleVerseLineLayout, handleTextAction, chapterMarginStyle, allActiveHighlights, theme.colors.highlightColors]
  );

  const getItemType = useCallback(() => 'chapter', []);

  /**
   * Combined scroll begin drag handler
   * SYNC FIX: Clear navigation ref when user starts manual scrolling
   */
  const handleScrollBeginDrag = useCallback(() => {
    scrollHandlers.handleScrollBeginDrag();
    navHandleScrollBeginDrag();
  }, [scrollHandlers, navHandleScrollBeginDrag]);

  /**
   * Handle backward scrolling - load previous chapters when near top
   * MANUAL POSITION FIX: maintainVisibleContentPosition is unreliable, so we manually
   * track the first visible chapter and scroll back to it after prepending
   */
  const handleScroll = useCallback((event: any) => {
    // Call existing scroll handler
    scrollHandlers.handleScroll(event);

    // Check if we're near the top and should load previous chapters
    // FIX: Also guard on isNavigationComplete to prevent loading previous chapters
    // during initial scroll animation (which can cause wrong chapter to be tracked)
    const { contentOffset } = event.nativeEvent;
    if (
      contentOffset.y < 300 &&
      chaptersData.length > 0 &&
      !isLoadingPreviousRef.current &&
      !isInitializing &&
      !isCalculatingAlignment &&
      bibleNavigation.isNavigationComplete  // FIX: Wait for navigation to complete
    ) {
      const firstChapterId = chaptersData[0].chapterId;

      // POSITION FIX: Capture the currently visible chapter BEFORE prepending
      // Use the tracked first visible chapter, or fall back to first data item
      const visibleChapterIdBeforePrepend = firstVisibleChapterIdRef.current || firstChapterId;
      restorePositionToChapterIdRef.current = visibleChapterIdBeforePrepend;
      console.log('[VerseAlignedSplitView] 📍 Prepending chapters. Will restore to chapter:', visibleChapterIdBeforePrepend);

      isLoadingPreviousRef.current = true;
      isPrependingRef.current = true; // PREPEND FIX: Disable chapter tracking

      // Trigger the load - position restoration happens in the effect below
      loadPreviousChapters(firstChapterId);
    }
  }, [scrollHandlers, chaptersData, loadPreviousChapters, isInitializing, isCalculatingAlignment, bibleNavigation.isNavigationComplete]);

  /**
   * POSITION RESTORATION EFFECT: After prepending, scroll to the chapter that was visible
   * This effect runs when chaptersData changes, allowing us to use the fresh data
   */
  React.useEffect(() => {
    const chapterIdToRestore = restorePositionToChapterIdRef.current;
    if (!chapterIdToRestore || !isPrependingRef.current) return;

    // Check if the chapter we need to restore to is now in the data
    const restoreIndex = chaptersData.findIndex(ch => ch.chapterId === chapterIdToRestore);
    if (restoreIndex < 0) return; // Not found yet, wait for next data update

    console.log('[VerseAlignedSplitView] 📍 Data updated. Restoring position to chapter:', chapterIdToRestore, 'at index:', restoreIndex);

    // Use InteractionManager to wait for layout to settle
    InteractionManager.runAfterInteractions(() => {
      if (flashListRef.current) {
        flashListRef.current.scrollToIndex({
          index: restoreIndex,
          animated: false,
          viewPosition: 0,
        });
      }

      // Clear the restore request and re-enable tracking
      restorePositionToChapterIdRef.current = null;
      isLoadingPreviousRef.current = false;
      isPrependingRef.current = false;
    });
  }, [chaptersData]);

  // Handle end reached - load more chapters
  // PERFORMANCE FIX: Don't load during initialization to prevent re-render loops
  const handleEndReached = useCallback(() => {
    // Guard: Don't load during initial navigation or programmatic scrolling (prevents scroll loop)
    if (isInitializing || isCalculatingAlignment || isScrolling) return;

    if (!effectiveIsLoading && isActive && chaptersData.length > 0) {
      const lastChapter = chaptersData[chaptersData.length - 1];
      loadMoreChapters(lastChapter.chapterId + 1000);
    }
  }, [effectiveIsLoading, isActive, chaptersData, loadMoreChapters, isInitializing, isCalculatingAlignment, isScrolling]);

  // ✅ Navigation handled by useBibleNavigation - waits for items to load, then scrolls

  // Show loading overlay until navigation is complete
  // This prevents interaction until FlashList has rendered at the correct position
  const showLoadingOverlay = effectiveIsLoading || isInitializing || chaptersData.length === 0 || !bibleNavigation.isNavigationComplete;

  // Show error state for empty chapters after loading
  if (!effectiveIsLoading && !isInitializing && chaptersData.length === 0) {
    return (
      <View style={[bibleStyles.container, styles.centerContent]}>
        <Text style={styles.errorText}>No chapters available</Text>
        <Text style={styles.errorText}>
          Left: {leftPane.versionId} | Right: {rightPane.versionId}
        </Text>
        <Text style={styles.errorText}>Chapter: {leftPane.currentChapterId}</Text>
      </View>
    );
  }

  return (
    <View
      style={bibleStyles.container}
      onTouchStart={scrollHandlers.handleTouchStart}
      onTouchEnd={scrollHandlers.handleTouchEnd}
      onTouchCancel={scrollHandlers.handleTouchCancel}
    >
      {/* FOLDABLE FIX: Key forces FlashList re-render on dimension change */}
      {/* ✅ ROOT CAUSE FIX: Don't use initialScrollIndex - it doesn't work with variable heights */}
      {/* Using programmatic scrollToIndex instead (see useEffect above) */}
      <FlashList
        key={dimensions.flashListKey}
        ref={flashListRef}
        data={chaptersData}
        renderItem={renderChapter}
        getItemType={getItemType}
        scrollEnabled={!isCalculatingAlignment}
        onEndReached={handleEndReached}
        {...flashListConfig.props}
        onViewableItemsChanged={bibleNavigation.onViewableItemsChanged}
        viewabilityConfig={bibleNavigation.viewabilityConfig}
        onScroll={handleScroll}
        onScrollBeginDrag={handleScrollBeginDrag}
        onScrollEndDrag={scrollHandlers.handleScrollEndDrag}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        // NOTE: FlashList's maintainVisibleContentPosition is unreliable for prepending
        // We use manual position restoration instead (see useEffect above)
        // Keeping disabled to avoid potential interference with our manual scroll
      />

      <HighlightColorPicker
        visible={highlightActions.highlightPickerVisible}
        onClose={highlightActions.handleCloseHighlightPicker}
        onColorSelect={highlightActions.handleHighlightColorPick}
        onRemoveHighlight={highlightActions.handleRemoveHighlight}
      />

      {/* Loading overlay - blocks interaction until FlashList is positioned */}
      {showLoadingOverlay && (
        <View style={[styles.loadingOverlay, { backgroundColor: theme.colors.background.primary }]}>
          <ActivityIndicator size="large" color={theme.colors.text.primary} />
          <Text style={bibleStyles.loadingText}>Loading Scripture...</Text>
        </View>
      )}
    </View>
  );
});

// Enable why-did-you-render tracking for this component
// @ts-ignore - whyDidYouRender is added by the library
VerseAlignedSplitView.whyDidYouRender = true;

const styles = StyleSheet.create({
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 14,
    marginVertical: 4,
    textAlign: 'center',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
});
