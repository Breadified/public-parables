/**
 * Chapter Level Bible View - Full Chapter Rendering with FlashList
 *
 * Uses FlashList for virtualized chapter rendering.
 * ChapterSelectableText manages its own height via onContentSizeChange,
 * which tells React Native the component's actual size.
 *
 * Enables:
 * - Cross-paragraph text selection
 * - Virtualized scrolling for performance
 * - Accurate native view measurement
 */

import React, {
  useCallback,
  useRef,
  useMemo,
} from "react";
import { View, StyleSheet, NativeSyntheticEvent, NativeScrollEvent } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { observer, useSelector } from "@legendapp/state/react";
import { ChapterSelectableText, type ChapterSelectionEvent } from "../modules/expo-selectable-text";
import { useBibleStyleSpec } from "../contexts/BibleRenderingContext";
import { useSimplifiedBibleLoader } from "../hooks/useSimplifiedBibleLoader";
import { useFlashListConfig } from "../hooks/useFlashListConfig";
import { useBibleScrollHandlers } from "../hooks/useBibleScrollHandlers";
import { useHeightCache } from "../hooks/useHeightCache";
import { useBibleNavigation } from "../hooks/useBibleNavigation";
import { useTextActionHandler } from "../hooks/useTextActionHandler";
import { useTheme } from "../contexts/ThemeContext";
import { LoadingScriptureOverlay } from "./LoadingScriptureOverlay";
import { HighlightColorPicker } from "./Bible/HighlightColorPicker";
import {
  transformChaptersForList,
  findVersesInChapterSelection,
  extractVerseLinesForIds,
  type ChapterRenderItem,
} from "../modules/bible/chapterDataTransform";
import { getChapterPadding } from "../utils/chapterPadding";
import { activeHighlights$, type VerseHighlight } from "../state/notesStore";
import { bibleVersionStore$ } from "../state/bibleVersionStore";

/**
 * Extended selection event with verse IDs from JS-side mapping
 */
export interface ChapterSelectionEventWithVerses extends ChapterSelectionEvent {
  verseIds: number[];
}

interface ChapterLevelBibleViewProps {
  chapterId: number;
  versionId?: string;
  isActive?: boolean;
  onChapterChange?: (
    chapterId: number,
    bookName: string,
    chapterNumber: number
  ) => void;
  onAction?: (event: ChapterSelectionEventWithVerses, chapterId: number) => void;
  onNavigationComplete?: () => void;
  /** Called when user scrolls to the end of a chapter (for XP rewards) */
  onChapterEndReached?: (bookId: number, chapter: number) => void;
}

/**
 * Chapter Level Bible View Component
 * Uses FlashList + native ChapterSelectableText for full chapter rendering
 */
const ChapterLevelBibleViewComponent: React.FC<ChapterLevelBibleViewProps> = ({
  chapterId,
  versionId,
  isActive = true,
  onChapterChange,
  onAction,
  onNavigationComplete,
  onChapterEndReached,
}) => {
  const flashListRef = useRef<any>(null);

  // ✅ CRITICAL: Freeze target chapter on mount to prevent ricocheting
  // When chapter tracking updates the tab, chapterId prop changes,
  // but we should NOT re-navigate. Keep ORIGINAL target until user scrolls manually.
  const frozenChapterIdRef = useRef<number>(chapterId);

  const { theme } = useTheme();

  // Get styleSpec with width-based font size (full width)
  // fontSize prop can override the default calculation
  const { styleSpec } = useBibleStyleSpec();

  // Subscribe to active highlights for reactive updates
  const allActiveHighlights = useSelector(activeHighlights$);

  // Get primary version's language for localized chapter titles
  const primaryVersion = useSelector(bibleVersionStore$.primaryVersion);
  const versionLanguage = useMemo(() => {
    const versionData = bibleVersionStore$.getVersionData(primaryVersion);
    return versionData?.language || 'en';
  }, [primaryVersion]);

  // Convert highlight color name to hex color for native rendering
  const getHighlightHexColor = useCallback((colorName: VerseHighlight['color']): string => {
    const colorConfig = theme.colors.highlightColors[colorName];
    return colorConfig?.bg || '#FFEB3B80'; // Fallback to yellow with alpha
  }, [theme.colors.highlightColors]);

  // Get highlights for a specific chapter in native format
  const getHighlightsForChapter = useCallback((chapterId: number): { verseId: number; color: string }[] => {
    // Filter highlights that belong to this chapter
    // Verse ID format: BBCCCVVV - chapter portion is BBCCC000
    const chapterBase = Math.floor(chapterId / 1000) * 1000;
    const chapterEnd = chapterBase + 999;

    return allActiveHighlights
      .filter((h: VerseHighlight) => h.verse_id >= chapterBase && h.verse_id <= chapterEnd)
      .map((h: VerseHighlight) => ({
        verseId: h.verse_id,
        color: getHighlightHexColor(h.color),
      }));
  }, [allActiveHighlights, getHighlightHexColor]);

  // Track current visible chapter for onChapterChange callback
  const currentVisibleChapterRef = useRef<number | null>(null);

  // Height caching with stabilization (extracted to hook)
  // canStabilize defaults to true - stabilize as soon as measurements arrive
  const heightCache = useHeightCache({
    minMeasurementsForStability: 3,
  });

  // SCROLL JUMP FIX: Store height cache functions in refs to avoid callbacks recreating
  // This prevents FlashList from re-rendering all items when heights are reported
  const setHeightRef = useRef(heightCache.setHeight);
  setHeightRef.current = heightCache.setHeight;
  const getHeightRef = useRef(heightCache.getHeight);
  getHeightRef.current = heightCache.getHeight;

  // Text action handling (copy, share, highlight, note, bookmark)
  const { handleAction: handleTextAction, highlightActions } = useTextActionHandler({
    versionId: versionId || 'ESV',
  });

  // FlashList configuration (provides estimatedItemSize and scroll config)
  const flashListConfig = useFlashListConfig({
    estimatedItemSize: 800,
    loadMoreThreshold: 1.5,
    overrideItemLayout: false, // We provide our own overrideItemLayout
  });

  // Scroll handlers for UI hide/show on scroll and tap-to-toggle
  const scrollHandlers = useBibleScrollHandlers(isActive);

  // Load chapters from SQLite - use FROZEN chapter ID to prevent ricocheting
  // PERFORMANCE: Pass isActive to skip loading when tab is inactive
  const { chapters, isLoading, loadMoreChapters } = useSimplifiedBibleLoader({
    initialChapterId: frozenChapterIdRef.current,
    versionId,
    loadSize: 5, // Load 5 chapters at a time for ScrollView
    isActive, // Skip loading when tab is inactive
  });

  // Get sorted chapter IDs
  const sortedChapterIds = useMemo(() => {
    return Object.keys(chapters)
      .map(Number)
      .sort((a, b) => a - b);
  }, [chapters]);

  // Transform chapters to render items (with localized chapter titles)
  const items = useMemo(() => {
    return transformChaptersForList(chapters, sortedChapterIds, versionLanguage);
  }, [chapters, sortedChapterIds, versionLanguage]);

  // ✅ ROOT CAUSE FIX: Don't use initialScrollIndex - it doesn't work reliably with variable heights
  // Navigation is now handled by useBibleNavigation hook which waits for height stabilization


  // ✅ REMOVED: Reset effect on chapterId - this caused infinite loop
  // When chapter tracking updates tab → chapterId prop changes →
  // reset effect runs → isHeightStabilized=false → overlay shows → loop
  // The frozenChapterIdRef pattern makes this reset unnecessary.

  // Handle text selection actions - map selection to verse IDs in JS
  const handleAction = useCallback(
    async (event: { nativeEvent: ChapterSelectionEvent }, item: ChapterRenderItem) => {
      const verseIds = findVersesInChapterSelection(
        item,
        event.nativeEvent.selectionStart,
        event.nativeEvent.selectionEnd
      );

      console.log("[ChapterLevelBibleView] Action:", event.nativeEvent.action, {
        selectedText: event.nativeEvent.selectedText.substring(0, 50),
        verseIds,
      });

      // Extract full verse lines for the selected verse IDs
      const verseLines = extractVerseLinesForIds(item.sections, verseIds);

      // Use unified action handler (handles validation, toasts, etc.)
      await handleTextAction(
        event.nativeEvent.action as 'copy' | 'share' | 'note' | 'highlight' | 'bookmark',
        verseIds,
        verseLines,
        {
          bookName: item.bookName,
          chapterNumber: item.chapterNumber,
          chapterId: item.chapterId,
        }
      );

      // Notify parent if provided
      if (onAction) {
        onAction(
          { ...event.nativeEvent, verseIds },
          item.chapterId
        );
      }
    },
    [onAction, handleTextAction]
  );

  // ✅ UNIFIED NAVIGATION: Wait for heights to stabilize, THEN scroll
  // This is the key fix - don't scroll until heights are accurate
  const navigation = useBibleNavigation({
    targetChapterId: frozenChapterIdRef.current,
    items,
    flashListRef,
    heightCache,
    extractChapterInfo: (item: ChapterRenderItem) => ({
      chapterId: item.chapterId,
      bookName: item.bookName,
      chapterNumber: item.chapterNumber,
    }),
    onNavigationComplete: () => {
      console.log('[ChapterLevelBibleView] ✅ Navigation complete');
      onNavigationComplete?.();
    },
    onChapterChange: (detectedChapterId, bookName, chapterNum) => {
      // Update current visible chapter ref
      currentVisibleChapterRef.current = detectedChapterId;

      // Load more chapters when near edges
      loadMoreChapters(detectedChapterId);

      // Notify parent of chapter change
      onChapterChange?.(detectedChapterId, bookName, chapterNum);
    },
    isActive,
    debounceDelay: 300,
  });

  // Handle scroll for loading more chapters and UI toggle
  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    // Always call scroll handlers for UI hide/show behavior
    scrollHandlers.handleScroll(event);

    if (!isActive) return;

    const scrollY = event.nativeEvent.contentOffset.y;
    const viewportHeight = event.nativeEvent.layoutMeasurement.height;
    const contentHeight = event.nativeEvent.contentSize.height;

    // Load more chapters when near edges
    const nearTop = scrollY < 500;
    const nearBottom = scrollY + viewportHeight > contentHeight - 500;

    if ((nearTop || nearBottom) && sortedChapterIds.length > 0) {
      const currentChapter = currentVisibleChapterRef.current ?? sortedChapterIds[0];
      loadMoreChapters(currentChapter);
    }
  }, [isActive, sortedChapterIds, loadMoreChapters, scrollHandlers]);

  // Custom overrideItemLayout using cached heights from native measurement
  // SCROLL JUMP FIX: Use getHeightRef instead of heightCache to keep callback stable
  // Uses 'any' type because FlashList's TS types don't include 'size' but it's used at runtime
  const overrideItemLayout = useCallback(
    (layout: any, item: ChapterRenderItem, index: number) => {
      // Get chapter-specific padding
      const { paddingTop, paddingBottom } = getChapterPadding(item.chapterId);
      // Gap between chapters (not before first one)
      const marginTop = index > 0 ? 40 : 0;
      const extraPadding = paddingTop + paddingBottom + marginTop;

      const cachedHeight = getHeightRef.current(item.key);
      if (cachedHeight !== undefined) {
        layout.size = cachedHeight + extraPadding;
      } else {
        layout.size = (item.estimatedHeight || 800) + extraPadding;
      }
    },
    [] // No dependencies - uses refs for stability
  );

  // Render each chapter item with proper padding
  // SCROLL JUMP FIX: Don't depend on heightCache - use setHeightRef instead
  // This prevents renderItem from recreating when height measurements come in
  const renderItem = useCallback(
    ({ item, index }: { item: ChapterRenderItem; index: number }) => {
      // Get special padding for first/last chapters of the Bible
      const { paddingTop, paddingBottom } = getChapterPadding(item.chapterId);
      // Add gap between chapters (not before the first one)
      const marginTop = index > 0 ? 40 : 0;

      // Get highlights for this specific chapter
      const chapterHighlights = getHighlightsForChapter(item.chapterId);

      return (
        <View style={[styles.chapterContainer, { paddingTop, paddingBottom, marginTop }]}>
          <ChapterSelectableText
            sections={item.styledSections}
            styleSpec={styleSpec}
            highlights={chapterHighlights}
            onAction={(event) => handleAction(event, item)}
            chapterKey={item.key}
            onMeasuredHeight={(key, height) => setHeightRef.current(key, height)}
          />
        </View>
      );
    },
    [styleSpec, handleAction, getHighlightsForChapter]
  );

  // Key extractor
  const keyExtractor = useCallback((item: ChapterRenderItem) => item.key, []);

  // Dynamic container style with theme background
  const containerStyle = useMemo(() => ({
    flex: 1,
    backgroundColor: theme.colors.background.primary,
  }), [theme.colors.background.primary]);

  return (
    <View
      style={containerStyle}
      onTouchStart={scrollHandlers.handleTouchStart}
      onTouchEnd={scrollHandlers.handleTouchEnd}
      onTouchCancel={scrollHandlers.handleTouchCancel}
    >
      <FlashList
        ref={flashListRef}
        data={items}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        // ✅ Navigation handled by useBibleNavigation - waits for heights, then scrolls
        {...flashListConfig.props}
        extraData={heightCache.cacheVersion}
        overrideItemLayout={overrideItemLayout}
        onScroll={handleScroll}
        onScrollBeginDrag={scrollHandlers.handleScrollBeginDrag}
        onScrollEndDrag={scrollHandlers.handleScrollEndDrag}
        onViewableItemsChanged={navigation.onViewableItemsChanged}
        viewabilityConfig={navigation.viewabilityConfig}
        showsVerticalScrollIndicator={true}
      />

      {/* Simple overlay condition: loading OR navigation not complete */}
      <LoadingScriptureOverlay visible={isLoading || !navigation.isNavigationComplete} />

      <HighlightColorPicker
        visible={highlightActions.highlightPickerVisible}
        onClose={highlightActions.handleCloseHighlightPicker}
        onColorSelect={highlightActions.handleHighlightColorPick}
        onRemoveHighlight={highlightActions.handleRemoveHighlight}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  chapterContainer: {
    paddingHorizontal: 16,
    // NO height constraints - ChapterSelectableText manages its own height
  },
});

export const ChapterLevelBibleView = observer(ChapterLevelBibleViewComponent);
