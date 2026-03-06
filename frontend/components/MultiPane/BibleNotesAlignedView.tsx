/**
 * Bible Notes Aligned View - Single FlatList for Bible + Notes mode
 *
 * Renders Bible and Notes side-by-side in a unified FlatList
 * Natural scrolling with synchronized alignment
 * Uses gesture-handler FlatList for TextInput scroll coordination
 * For CONTENT_ALIGNED Bible + Notes panes
 */

import React, {
  useCallback,
  useRef,
  useMemo,
  useState,
  useEffect,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Keyboard,
  ScrollViewProps,
  Share,
} from "react-native";
import * as Clipboard from 'expo-clipboard';
import { useSharedValue } from "react-native-reanimated";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { FlashList } from "@shopify/flash-list";
import { observer, useSelector } from "@legendapp/state/react";
import {
  BibleReaderPaneState,
  StudyNotesPaneState,
} from "../../types/multiPane";
import type { Note } from "../../types/database";
import { useSimplifiedBibleLoader } from "../../hooks/useSimplifiedBibleLoader";
import { useTheme } from "../../contexts/ThemeContext";
import { useDimensions } from "../../contexts/DimensionsContext";
import { bibleStore$ } from "../../state/bibleStore";
import { notesStore$ } from "../../state/notesStore";
import { createBibleStyles } from "../Bible/BibleStyles";
import { BibleNotesAlignedItem } from "./BibleNotesAlignedItem";
import { useToast } from "../../contexts/ToastContext";
import { useBibleScrollHandlers } from "../../hooks/useBibleScrollHandlers";
import { useBibleNavigation } from "../../hooks/useBibleNavigation";
import { useScrollNavigation } from "../../hooks/navigation/useScrollNavigation";
import { useFlashListConfig } from "../../hooks/useFlashListConfig";
import { findChapterInChapters } from "../../modules/bible/autoScroll";
import { PaneSearch } from "../Search/PaneSearch";
import { navigateToVerse as navigateToVerseTab, navigateToChapter as navigateToChapterTab } from "../../modules/bible/tabManager";
import { getBookName } from "../../modules/bible/bibleBookMappings";
import { tutorialStore$ } from "../../state/tutorialStore";
import { NotesTutorialModal } from "../Tutorial";
import { type ChapterSelectionEvent } from "../../modules/expo-selectable-text";
import { mapSelectionToVerses, extractVerseLinesForIds, type VerseBoundary } from "../../modules/bible/chapterDataTransform";
import { HighlightColorPicker } from "../Bible/HighlightColorPicker";
import { useTextActionHandler } from "../../hooks/useTextActionHandler";

/**
 * FlashList-compatible KeyboardAwareScrollView wrapper
 * Required for proper ref forwarding with FlashList
 */
const RenderScrollComponent = React.forwardRef<React.ComponentRef<typeof KeyboardAwareScrollView>, ScrollViewProps>(
  (props, ref) => (
    <KeyboardAwareScrollView
      {...props}
      ref={ref}
      bottomOffset={60}
      enabled={true}
    />
  )
);
RenderScrollComponent.displayName = "RenderScrollComponent";

/**
 * Global cache for tab data to enable instant tab switching
 */
const tabDataCache = new Map<string, any[]>();
const MAX_TAB_CACHE_SIZE = 100;

interface BibleNotesAlignedViewProps {
  biblePane: BibleReaderPaneState;
  notesPane: StudyNotesPaneState;
  isActive?: boolean;
  onChapterChange?: (
    chapterId: number,
    bookName: string,
    chapterNumber: number
  ) => void;
  onNavigationComplete?: () => void;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeProgress?: (deltaX: number) => void;
  onSwipeCancel?: () => void;
  onDeleteNote?: (noteId: string) => void;
}

/**
 * Bible Notes Aligned View Component
 */
export const BibleNotesAlignedView = observer(
  ({
    biblePane,
    notesPane,
    isActive = true,
    onChapterChange,
    onNavigationComplete,
    onSwipeLeft,
    onSwipeRight,
    onSwipeProgress,
    onSwipeCancel,
    onDeleteNote,
  }: BibleNotesAlignedViewProps) => {
    const { theme } = useTheme();
    const flashListRef = useRef<any>(null);
    const { showToast } = useToast();

    // FOLDABLE FIX: Get dimensions from context (reactive to fold/unfold)
    const dimensions = useDimensions();

    // Track selected verse and chapter from active tab
    const globalSelectedVerseId = useSelector(
      bibleStore$.activeTabSelectedVerse
    );
    const globalSelectedChapterId = useSelector(
      bibleStore$.activeTabSelectedChapter
    );
    const selectedVerseId = isActive ? globalSelectedVerseId : null;

    // ✅ CRITICAL FIX: Convert verse selection to chapter selection for Notes view
    // Notes view doesn't show individual verses, so when a verse is selected from search,
    // we need to navigate to the chapter containing that verse
    const selectedChapterId = useMemo(() => {
      if (!isActive) return null;

      // If verse is selected, convert it to chapter ID
      if (globalSelectedVerseId) {
        const bookId = Math.floor(globalSelectedVerseId / 1000000);
        const chapterNum = Math.floor((globalSelectedVerseId % 1000000) / 1000);
        return bookId * 1000000 + chapterNum * 1000;
      }

      // Otherwise use the selected chapter directly
      return globalSelectedChapterId;
    }, [isActive, globalSelectedVerseId, globalSelectedChapterId]);

    // Use shared scroll handlers hook
    const scrollHandlers = useBibleScrollHandlers(isActive);

    // Notes tutorial state
    const [showNotesTutorial, setShowNotesTutorial] = useState(false);
    const hasShownNotesTutorialRef = useRef(false);

    // Extract versionId to primitive for hook dependencies
    const versionId = biblePane.versionId;

    // Unified text action handler (copy, share, highlight, note, bookmark)
    const { handleAction: handleUnifiedAction, highlightActions } = useTextActionHandler({
      versionId,
    });

    // ✅ Keep target frozen even after navigation completes
    // Used to verify scroll landed at correct position before enabling tracking
    const frozenTargetChapterRef = useRef<number | null>(null);

    // ✅ Freeze chapterIdToLoad on first render to prevent recalculation
    // This prevents the ricocheting issue where changing this value
    // would trigger navigation effect to re-run
    const chapterIdToLoad = useMemo(() => {
      // Priority 1: Verse navigation
      if (selectedVerseId) {
        const bookId = Math.floor(selectedVerseId / 1000000);
        const chapterNum = Math.floor((selectedVerseId % 1000000) / 1000);
        const targetChapterId = bookId * 1000000 + chapterNum * 1000;
        console.log(
          "[BibleNotesAlignedView] Initial load with verse - Loading chapters starting from:",
          targetChapterId
        );
        return targetChapterId;
      }

      // Priority 2: Chapter navigation
      if (selectedChapterId) {
        console.log(
          "[BibleNotesAlignedView] Initial load with chapter - Loading chapters starting from:",
          selectedChapterId
        );
        return selectedChapterId;
      }

      // Priority 3: Initial tab load with chapterId prop
      if (
        biblePane.currentChapterId &&
        biblePane.currentChapterId !== 1001000
      ) {
        console.log(
          "[BibleNotesAlignedView] Initial tab load - Loading chapters starting from:",
          biblePane.currentChapterId
        );
        return biblePane.currentChapterId;
      }

      return biblePane.currentChapterId;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Empty deps = only calculate once on mount

    // Load chapters for Bible version
    // PERFORMANCE: Pass isActive to skip loading when tab is inactive
    // PERFORMANCE: loadSize: 10 to prevent loading too many chapters
    const {
      chapters: chaptersDict,
      isLoading,
      loadMoreChapters,
    } = useSimplifiedBibleLoader({
      initialChapterId: chapterIdToLoad,
      versionId: biblePane.versionId,
      isActive, // Skip loading when tab is inactive
      loadSize: 10, // Only load 10 chapters at a time (not default 30)
    });

    // Convert chapters dictionary to array and stabilize for tab switching
    // Returns { chaptersData, isUsingCache } to avoid side effects in useMemo
    const { chaptersData, isUsingCache } = useMemo(() => {
      const tabCacheKey = `${biblePane.id}-${notesPane.id}-${biblePane.versionId}`;

      console.log("[BibleNotesAlignedView] 🗄️ Calculating chaptersData:", {
        biblePaneId: biblePane.id,
        notesPaneId: notesPane.id,
        tabCacheKey,
        hasCache: tabDataCache.has(tabCacheKey),
        chaptersInDict: Object.keys(chaptersDict).length,
        cacheSize: tabDataCache.size,
      });

      // Check cache first
      if (tabDataCache.has(tabCacheKey)) {
        const cachedData = tabDataCache.get(tabCacheKey)!;
        if (cachedData.length > 0 && Object.keys(chaptersDict).length === 0) {
          console.log(
            `[TabCache] ✅ Using cached data for tab ${tabCacheKey} (${cachedData.length} chapters)`
          );
          return { chaptersData: cachedData, isUsingCache: true };
        }
      }

      // Convert dictionary to array
      if (Object.keys(chaptersDict).length === 0) {
        return { chaptersData: [], isUsingCache: false };
      }

      const sortedChapterIds = Object.keys(chaptersDict)
        .map(Number)
        .sort((a, b) => a - b);

      const chaptersArray = sortedChapterIds.map((chapterId) => {
        const chapter = chaptersDict[chapterId];
        return {
          chapterId,
          bookName: chapter.chapter.book_name,
          chapterNumber: chapter.chapter.chapter_number,
          sections: chapter.sections.map((section: any) => ({
            title: section.section.title,
            subtitle: section.section.subtitle,
            paragraphs: section.paragraphs.map((para: any) => ({
              verseLines: para.verseLines,
              isPoetry: para.paragraph?.is_poetry || false,
              paragraph: para.paragraph, // Preserve for other uses
            })),
          })),
        };
      });

      // Update cache
      if (chaptersArray.length > 0) {
        if (tabDataCache.size >= MAX_TAB_CACHE_SIZE) {
          const firstKey = tabDataCache.keys().next().value;
          if (firstKey) {
            tabDataCache.delete(firstKey);
            console.log(
              `[TabCache] 🗑️ Evicted oldest cache entry: ${firstKey}`
            );
          }
        }
        tabDataCache.set(tabCacheKey, chaptersArray);
        console.log(
          `[TabCache] 💾 Cached new data for tab ${tabCacheKey} (${chaptersArray.length} chapters)`
        );
      }

      return { chaptersData: chaptersArray, isUsingCache: false };
    }, [chaptersDict, biblePane.id, notesPane.id, biblePane.versionId]);

    const effectiveIsLoading = isLoading && !isUsingCache;

    // ✅ ROOT CAUSE FIX: Don't use initialScrollIndex - it doesn't work reliably with variable heights
    // FlashList estimates position using estimatedItemSize, which is wrong for long chapters
    // Instead, use programmatic scrollToIndex which actually scrolls to the correct position

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

    // ✅ PERFORMANCE FIX: Removed console.log from render path

    /**
     * ✅ COPIED FROM BibleViewerSimplified: Use composition hooks for navigation and chapter tracking
     */

    // ✅ FIXED: Only use chapterIdToLoad for INITIAL calculation, then freeze it
    // This prevents infinite navigation loops where updating tab state → changes chapterIdToLoad → triggers navigation
    const initialChapterIdRef = useRef<number | null>(null);
    if (initialChapterIdRef.current === null) {
      initialChapterIdRef.current = chapterIdToLoad;
    }

    const targetChapterForInitialLoad = useMemo(() => {
      if (selectedVerseId) {
        const bookId = Math.floor(selectedVerseId / 1000000);
        const chapterNum = Math.floor((selectedVerseId % 1000000) / 1000);
        return bookId * 1000000 + chapterNum * 1000;
      }
      if (selectedChapterId) {
        return selectedChapterId;
      }
      // ✅ CRITICAL FIX: Use frozen initial value, NOT live chapterIdToLoad
      // This prevents loop: manual scroll → updateTabState → chapterIdToLoad changes → navigation triggers
      return initialChapterIdRef.current;
    }, [selectedVerseId, selectedChapterId]); // ✅ REMOVED chapterIdToLoad from deps!

    // ✅ Set frozen target on mount for position verification
    useEffect(() => {
      if (targetChapterForInitialLoad && frozenTargetChapterRef.current === null) {
        frozenTargetChapterRef.current = targetChapterForInitialLoad;
        console.log('[BibleNotesAlignedView] 🎯 Frozen target set:', targetChapterForInitialLoad);
      }
    }, [targetChapterForInitialLoad]);

    /**
     * Find verse within chapter items
     * Returns the chapter index and estimated pixel offset to the verse
     */
    const findVerseInItems = useCallback((items: any[], verseId: number) => {
      const targetChapterId = Math.floor(verseId / 1000) * 1000;

      // Find the chapter containing this verse
      const chapterIndex = items.findIndex(
        (item: any) => item.chapterId === targetChapterId
      );

      if (chapterIndex === -1) {
        return { index: -1 };
      }

      const chapter = items[chapterIndex];

      // Calculate estimated offset to the verse
      // Start with chapter header height
      let estimatedOffset = 80; // Approximate chapter header height

      // Add heights for all sections/paragraphs/verses before the target verse
      for (const section of chapter.sections) {
        // Add section header height if present
        if (section.title || section.subtitle) {
          estimatedOffset += section.title ? 30 : 0;
          estimatedOffset += section.subtitle ? 25 : 0;
        }

        for (const paragraph of section.paragraphs) {
          for (const verseLine of paragraph.verseLines) {
            // Stop when we reach the target verse
            if (verseLine.verse_id >= verseId) {
              return {
                index: chapterIndex,
                offset: Math.max(0, estimatedOffset - 100), // Subtract 100px to show context above
              };
            }

            // Estimate verse line height based on poetry/prose and text length
            const baseHeight = paragraph.isPoetry ? 35 : 30;
            const textLength = verseLine.text?.length || 0;
            const lines = Math.ceil(textLength / 40); // Rough estimate: 40 chars per line
            estimatedOffset += baseHeight * Math.max(1, lines);
          }

          // Add paragraph spacing
          estimatedOffset += 12;
        }
      }

      // Verse not found in chapter, return chapter start with offset
      return { index: chapterIndex, offset: 0 };
    }, []);

    // ✅ Navigation complete callback - just call parent
    // Stabilization is handled by the programmatic scroll effect above
    const handleNavigationComplete = useCallback(() => {
      onNavigationComplete?.();
    }, [onNavigationComplete]);

    const navigation = useScrollNavigation({
      flashListRef,
      items: chaptersData,
      findVerseInItems, // ✅ Now properly finds verses and calculates offsets
      findChapterInItems: findChapterInChapters,
      onChapterChange,
      onNavigationComplete: handleNavigationComplete,
      isLoading: effectiveIsLoading,
      isActive,
      // ✅ CRITICAL FIX: Pass selectedVerseId so navigation uses verse positioning, not just chapter
      selectedVerseId: isActive ? globalSelectedVerseId : null,
      selectedChapterId,
      getBookName: (bookId) => {
        const chapter = chaptersData.find(
          (ch) => Math.floor(ch.chapterId / 1000000) === bookId
        );
        return chapter?.bookName || `Book ${bookId}`;
      },
      mode: "chapter",
      initialTargetChapter: targetChapterForInitialLoad,
      viewPosition: 0, // ✅ Position verse 1/3 from top for better context
      viewOffset: 0, // ✅ Offset is now calculated by findVerseInItems
    });

    // ✅ Navigation handled by useBibleNavigation - waits for items to load, then scrolls

    // ✅ COPIED FROM BibleViewerSimplified: Use FlashList config hook (after navigation)
    // FOLDABLE FIX: Use responsive estimatedItemSize from dimensions
    const flashListConfig = useFlashListConfig({
      estimatedItemSize: dimensions.estimatedItemSize * 2.5, // Chapter items are large, scale from base
      loadMoreThreshold: 1.5,
    });

    // ✅ Track current chapter for deferred updates
    const currentChapterRef = useRef<{
      id: number;
      name: string;
      num: number;
    } | null>(null);
    const lastPreloadChapterRef = useRef<number | null>(null);

    // ✅ PERFORMANCE FIX: Stabilize swipe callbacks to prevent renderChapter from recreating
    // These callbacks are passed down to every list item, so they must be stable
    const stableOnSwipeLeft = useCallback(() => {
      if (onSwipeLeft) onSwipeLeft();
    }, [onSwipeLeft]);

    const stableOnSwipeRight = useCallback(() => {
      if (onSwipeRight) onSwipeRight();
    }, [onSwipeRight]);

    const stableOnSwipeProgress = useCallback(
      (deltaX: number) => {
        if (onSwipeProgress) onSwipeProgress(deltaX);
      },
      [onSwipeProgress]
    );

    const stableOnSwipeCancel = useCallback(() => {
      if (onSwipeCancel) onSwipeCancel();
    }, [onSwipeCancel]);

    // Track scroll position
    const scrollY = useSharedValue(0);

    // Handle empty placeholder focus - auto-scroll to placeholder title
    const handleFocusEmptyPlaceholder = useCallback((chapterId: number) => {
      const placeholderTitleRef = emptyPlaceholderTitleRefsMap.current.get(chapterId);
      if (!placeholderTitleRef?.current || !flashListRef.current) return;

      // Measure the empty placeholder title position and scroll to it
      placeholderTitleRef.current.measureInWindow((x: number, y: number, width: number, height: number) => {
        // Calculate scroll offset: current scroll + title position - desired position (100px from top)
        const DESIRED_POSITION = 100;
        const currentScroll = scrollY.value;
        const scrollToOffset = currentScroll + y - DESIRED_POSITION;

        console.log(`[BibleNotesAlignedView] Focusing empty placeholder for chapter ${chapterId}, scrolling to offset ${scrollToOffset} (current: ${currentScroll}, title y: ${y})`);

        // Scroll to the placeholder title position
        flashListRef.current?.scrollToOffset({
          offset: Math.max(0, scrollToOffset),
          animated: true,
        });
      });
      // Note: scrollY is a SharedValue - intentionally excluded from deps
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Note: Keyboard handling is now done by react-native-keyboard-controller's KeyboardAwareScrollView
    // These callbacks are simplified - just for logging/debugging
    const handleNoteBodyTapAtY = useCallback((noteId: string, tapY: number) => {
      console.log(`[BibleNotesAlignedView] Note body tapped at Y: ${tapY} for ${noteId}`);
    }, []);

    const handleNoteBodyFocus = useCallback((noteId: string) => {
      console.log(`[BibleNotesAlignedView] Note body focused: ${noteId}`);
      // Show notes tutorial on first focus
      const hasShownAlready = hasShownNotesTutorialRef.current;
      const shouldShow = tutorialStore$.shouldShowNotesTutorial();
      console.log(`[BibleNotesAlignedView] Tutorial check: hasShownAlready=${hasShownAlready}, shouldShow=${shouldShow}`);
      if (!hasShownAlready && shouldShow) {
        console.log(`[BibleNotesAlignedView] 🎓 Showing notes tutorial!`);
        setShowNotesTutorial(true);
        hasShownNotesTutorialRef.current = true;
      }
    }, []);

    const handleNoteBodyBlur = useCallback((noteId: string) => {
      console.log(`[BibleNotesAlignedView] Note body blurred: ${noteId}`);
    }, []);

    // Handle scroll to verse - auto-scroll to the verse referenced by the note
    const handleScrollToVerse = useCallback((noteId: string) => {
      const note = notesStore$.notes.get().find((n: Note) => n.id === noteId);
      if (!note || !note.verse_id) {
        console.log(`[BibleNotesAlignedView] Cannot scroll - note has no verse reference`);
        return;
      }

      console.log(`[BibleNotesAlignedView] Scrolling to verse ${note.verse_id} for note ${noteId}`);

      // Use the navigation hook to navigate to the verse
      navigation.navigateToVerse(note.verse_id);
    }, [navigation]);

    // Handle copy text - copy note content to clipboard
    const handleCopyText = useCallback(async (noteId: string, content: string) => {
      try {
        await Clipboard.setStringAsync(content);
        console.log(`[BibleNotesAlignedView] Copied note ${noteId} to clipboard`);
        showToast({
          message: 'Note copied to clipboard',
          type: 'success',
          duration: 2000,
        });
      } catch (error) {
        console.error('[BibleNotesAlignedView] Failed to copy to clipboard:', error);
        showToast({
          message: 'Failed to copy to clipboard',
          type: 'warning',
          duration: 2500,
        });
      }
    }, [showToast]);

    // Handle share note - open native share sheet
    const handleShareNote = useCallback(async (noteId: string, content: string) => {
      try {
        const note = notesStore$.notes.get().find((n: Note) => n.id === noteId);
        if (!note || !note.chapter_id) return;

        // Format note with reference
        const bookId = Math.floor(note.chapter_id / 1000000);
        const chapterNum = Math.floor((note.chapter_id % 1000000) / 1000);
        const chapter = chaptersData.find((ch) => ch.chapterId === note.chapter_id);
        const bookName = chapter?.bookName || `Book ${bookId}`;

        let shareText = `${bookName} ${chapterNum}`;
        if (note.verse_id) {
          const verseNum = note.verse_id % 1000;
          shareText += `:${verseNum}`;
        }
        shareText += `\n\n${content}`;

        await Share.share({
          message: shareText,
        });
      } catch (error) {
        console.error('[BibleNotesAlignedView] Share failed:', error);
      }
    }, [chaptersData]);

    // Handle Bible text selection actions from ChapterSelectableText
    // Uses unified action handler for consistent behavior across all Bible views
    const handleBibleAction = useCallback(
      async (
        event: { nativeEvent: ChapterSelectionEvent },
        chapterId: number,
        verseBoundaries: VerseBoundary[]
      ) => {
        console.log('[BibleNotesAlignedView] Bible action:', event.nativeEvent.action, {
          selectedText: event.nativeEvent.selectedText.substring(0, 50),
          chapterId,
        });

        // Map selection to verse IDs
        const verseIds = mapSelectionToVerses(
          event.nativeEvent.selectionStart,
          event.nativeEvent.selectionEnd,
          verseBoundaries
        );

        if (verseIds.length === 0) {
          // Fallback to raw text for copy only
          if (event.nativeEvent.action === 'copy') {
            await Clipboard.setStringAsync(event.nativeEvent.selectedText);
            showToast({
              message: 'Copied to clipboard',
              type: 'success',
              duration: 2000,
            });
          } else {
            showToast({
              message: 'No verses selected',
              type: 'warning',
              duration: 2000,
            });
          }
          return;
        }

        // Find the chapter in chaptersData
        const chapter = chaptersData.find(ch => ch.chapterId === chapterId);
        if (!chapter) {
          showToast({
            message: 'Chapter not found',
            type: 'warning',
            duration: 2000,
          });
          return;
        }

        const verseLines = extractVerseLinesForIds(chapter.sections, verseIds);

        // Use unified action handler (handles validation, toasts, etc.)
        await handleUnifiedAction(
          event.nativeEvent.action as 'copy' | 'share' | 'note' | 'highlight' | 'bookmark',
          verseIds,
          verseLines,
          {
            bookName: chapter.bookName,
            chapterNumber: chapter.chapterNumber,
            chapterId,
          }
        );
      },
      [chaptersData, showToast, handleUnifiedAction]
    );


    // Map of noteId -> title ref for measurement (string keys for temp note IDs)
    const titleRefsMap = useRef<Map<string, React.RefObject<View | null>>>(
      new Map()
    );

    // Map of noteId -> body wrapper ref for keyboard avoidance measurement
    const bodyWrapperRefsMap = useRef<Map<string, React.RefObject<View | null>>>(
      new Map()
    );

    // Map of chapterId -> add button ref for measurement
    const addButtonRefsMap = useRef<Map<number, React.RefObject<View | null>>>(
      new Map()
    );

    // Map of chapterId -> empty placeholder title ref for scrolling when focusing
    const emptyPlaceholderTitleRefsMap = useRef<Map<number, React.RefObject<View | null>>>(
      new Map()
    );

    // Pane search state for relocate note functionality
    const [paneSearchConfig, setPaneSearchConfig] = useState<{
      visible: boolean;
      position: 'left' | 'right';
      mode: 'navigate' | 'relocate';
      noteId?: string;
      onSelect: (params: {
        bookId: number;
        chapterId: number;
        verseId: number | null;
        bookName: string;
        chapter: number;
        verse?: number;
      }) => void;
    } | null>(null);

    // Map to store add note handlers for each chapter
    const addNoteHandlersRef = useRef<Map<number, () => void>>(new Map());

    // Pane search handlers
    const closePaneSearch = useCallback(() => {
      setPaneSearchConfig(null);
    }, []);

    const handleNoteRelocate = useCallback((noteId: string, currentBookId: number, currentChapterId: number) => {
      console.log('[BibleNotesAlignedView] Opening pane search for note relocation:', { noteId, currentBookId, currentChapterId });

      // Open pane search in right pane (Bible is on left, Notes on right)
      setPaneSearchConfig({
        visible: true,
        position: 'left', // Search opens in left pane (Bible pane)
        mode: 'relocate',
        noteId,
        onSelect: (params) => {
          console.log('[BibleNotesAlignedView] Location selected for note relocation:', params);

          // Update note location using notesStore
          const note = notesStore$.notes.peek().find((n: Note) => n.id === noteId);
          if (note) {
            // Update the note's location
            notesStore$.notes.set((notes: Note[]) =>
              notes.map((n: Note) => n.id === noteId ? {
                ...n,
                book_id: params.bookId,
                chapter_id: params.chapterId,
                verse_id: params.verseId,
                updated_at: new Date().toISOString(),
              } : n)
            );

            showToast({
              message: 'Note relocated successfully',
              type: 'success',
            });
            console.log('[BibleNotesAlignedView] Note relocated:', { noteId, newLocation: params });
          }

          // Navigate to the new location (create new tab like search modal does)
          const bookName = getBookName(params.bookId);
          const chapterNumber = Math.floor((params.chapterId % 1000000) / 1000);

          if (params.verseId) {
            navigateToVerseTab(params.chapterId, bookName, chapterNumber, params.verseId);
          } else {
            navigateToChapterTab(params.chapterId, bookName, chapterNumber);
          }

          // Close search
          closePaneSearch();
        },
      });
    }, [showToast, closePaneSearch]);

    // ✅ PERFORMANCE FIX: Memoize extractChapterInfo to prevent callback recreation
    // Inline functions in hook params cause the hook's callbacks to recreate every render
    const extractChapterInfo = useCallback((item: any) => ({
      chapterId: item.chapterId,
      bookName: item.bookName,
      chapterNumber: item.chapterNumber,
    }), []);

    // ✅ UNIFIED NAVIGATION: Wait for items to load, THEN scroll
    // This is the key fix - useBibleNavigation handles scroll timing and verification
    // ✅ FIX: Use reactive targetChapterForInitialLoad instead of frozen chapterIdToLoad
    // chapterIdToLoad is frozen with empty deps, but targetChapterForInitialLoad updates
    // when selectedChapterId/selectedVerseId changes (for tab reuse scenarios)
    const bibleNavigation = useBibleNavigation({
      targetChapterId: targetChapterForInitialLoad ?? chapterIdToLoad,
      items: chaptersData,
      flashListRef,
      extractChapterInfo,
      onNavigationComplete: () => {
        console.log('[BibleNotesAlignedView] ✅ Navigation complete');
        onNavigationComplete?.();
      },
      onChapterChange: (chapterId, bookName, chapterNum) => {
        // Guard against navigation in progress
        const navTarget = navigation.navigationTargetChapterRef.current;
        if (navTarget !== null && chapterId !== navTarget) {
          console.log('[BibleNotesAlignedView] ❌ Ignoring chapter change during verse navigation');
          return;
        }

        // ✅ Simple preloading like BibleViewerSimplified
        const loadedIds = new Set<number>();
        chaptersData.forEach((item) => {
          loadedIds.add(item.chapterId);
        });

        const sortedLoaded = Array.from(loadedIds).sort((a, b) => a - b);
        const currentIndex = sortedLoaded.indexOf(chapterId);

        // Load more if near edges (only if not redundant)
        if (
          (currentIndex <= 2 || currentIndex >= sortedLoaded.length - 3) &&
          chapterId &&
          lastPreloadChapterRef.current !== chapterId
        ) {
          console.log('[BibleNotesAlignedView] ✅ Preloading chapters around:', chapterId);
          lastPreloadChapterRef.current = chapterId;
          loadMoreChapters(chapterId);
        }

        // Store current chapter for later update (used on tab inactive/unmount)
        currentChapterRef.current = {
          id: chapterId,
          name: bookName,
          num: chapterNum,
        };

        // Notify parent of chapter change
        onChapterChange?.(chapterId, bookName, chapterNum);
      },
      isActive,
      minItemsForStability: 3,
      debounceDelay: 300,
    });

    // ✅ Update tab title when tab becomes inactive or on unmount
    const wasActiveRef = useRef(isActive);
    useEffect(() => {
      console.log("[BibleNotesAlignedView] 🎬 Component mounted/updated:", {
        biblePaneId: biblePane.id,
        notesPaneId: notesPane.id,
        isActive,
        chapterId: biblePane.currentChapterId,
      });

      // When tab becomes inactive, update the tab title
      if (
        wasActiveRef.current &&
        !isActive &&
        currentChapterRef.current &&
        onChapterChange
      ) {
        console.log(
          "[BibleNotesAlignedView] 🏁 Tab became inactive - final title update:",
          currentChapterRef.current.id
        );
        onChapterChange(
          currentChapterRef.current.id,
          currentChapterRef.current.name,
          currentChapterRef.current.num
        );
      }
      wasActiveRef.current = isActive;

      // On unmount, update the tab title
      return () => {
        console.log("[BibleNotesAlignedView] 💀 Component unmounting:", {
          biblePaneId: biblePane.id,
          notesPaneId: notesPane.id,
        });

        if (currentChapterRef.current && onChapterChange) {
          console.log(
            "[BibleNotesAlignedView] 🏁 Tab unmounting - final title update:",
            currentChapterRef.current.id
          );
          onChapterChange(
            currentChapterRef.current.id,
            currentChapterRef.current.name,
            currentChapterRef.current.num
          );
        }
      };
      // NOTE: onChapterChange intentionally omitted - it changes every render, we only care about isActive
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isActive, biblePane.id, notesPane.id]);

    // ✅ Handle pending note scroll from Library navigation
    const pendingNoteScroll = useSelector(notesStore$.pendingNoteScroll);

    useEffect(() => {
      if (!pendingNoteScroll || !isActive) return;

      const { noteId, chapterId } = pendingNoteScroll;

      console.log('[BibleNotesAlignedView] 📍 Handling pending note scroll:', {
        noteId,
        chapterId,
        chaptersLoaded: chaptersData.length,
      });

      // Find chapter index in loaded chapters
      const chapterIndex = chaptersData.findIndex((ch) => ch.chapterId === chapterId);
      if (chapterIndex < 0) {
        console.log('[BibleNotesAlignedView] ⏳ Chapter not loaded yet, waiting...');
        return; // Chapter not loaded yet, effect will re-run when chaptersData updates
      }

      // Scroll to chapter
      flashListRef.current?.scrollToIndex({
        index: chapterIndex,
        animated: true,
        viewPosition: 0.3, // Position 30% from top
      });

      // Set highlight after a delay to let scroll complete
      setTimeout(() => {
        notesStore$.setHighlightedNote(noteId);
      }, 400);

      // Clear pending scroll
      notesStore$.clearPendingNoteScroll();
    }, [pendingNoteScroll, isActive, chaptersData]);

    // Keyboard handling now done by react-native-keyboard-controller's KeyboardAwareScrollView
    // via the RenderScrollComponent passed to FlashList

    // PERF FIX: Memoized style and getItemType to prevent recreation on every render
    const chapterMarginStyle = useMemo(() => ({ marginTop: 40 }), []);
    const getItemType = useCallback(() => 'chapter', []);

    // ✅ PERFORMANCE FIX: Render chapter using aligned item
    // Using stable callbacks and minimal dependencies to prevent unnecessary re-renders
    const renderChapter = useCallback(
      ({ item, index }: any) => (
        // Add 40px gap between chapters (not before the first one)
        <View style={index > 0 ? chapterMarginStyle : undefined}>
          <BibleNotesAlignedItem
            chapter={item}
            selectedVerseId={selectedVerseId}
            versionId={versionId}
            titleRefs={titleRefsMap}
            bodyWrapperRefs={bodyWrapperRefsMap}
            addButtonRefs={addButtonRefsMap}
            emptyPlaceholderTitleRefs={emptyPlaceholderTitleRefsMap}
            addNoteHandlers={addNoteHandlersRef}
            onFocusEmptyPlaceholder={handleFocusEmptyPlaceholder}
            onBodyFocus={handleNoteBodyFocus}
            onBodyBlur={handleNoteBodyBlur}
            onBodyTapAtY={handleNoteBodyTapAtY}
            onScrollToVerse={handleScrollToVerse}
            onCopyText={handleCopyText}
            onShareNote={handleShareNote}
            onDeleteNote={onDeleteNote}
            onNoteRelocate={handleNoteRelocate}
            onSwipeLeft={stableOnSwipeLeft}
            onSwipeRight={stableOnSwipeRight}
            onSwipeProgress={stableOnSwipeProgress}
            onSwipeCancel={stableOnSwipeCancel}
            onBibleAction={handleBibleAction}
          />
        </View>
      ),
      [
        selectedVerseId,
        versionId,
        handleFocusEmptyPlaceholder,
        handleNoteBodyFocus,
        handleNoteBodyBlur,
        handleNoteBodyTapAtY,
        handleScrollToVerse,
        handleCopyText,
        handleShareNote,
        onDeleteNote,
        handleNoteRelocate,
        stableOnSwipeLeft,
        stableOnSwipeRight,
        stableOnSwipeProgress,
        stableOnSwipeCancel,
        handleBibleAction,
        chapterMarginStyle,
      ]
    );

    // ✅ Scroll handler - track scroll position and call scroll handlers
    const handleScroll = useCallback(
      (event: any) => {
        const currentScrollY = event.nativeEvent.contentOffset.y;
        scrollY.value = currentScrollY;
        scrollHandlers.handleScroll(event);
      },
      // Note: scrollY is a SharedValue - intentionally excluded from deps
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [scrollHandlers]
    );

    // ✅ Simple scroll handlers
    const handleScrollBeginDrag = useCallback(() => {
      Keyboard.dismiss();
      scrollHandlers.handleScrollBeginDrag();
    }, [scrollHandlers]);

    const handleScrollEndDrag = useCallback(() => {
      scrollHandlers.handleScrollEndDrag();
    }, [scrollHandlers]);

    // Handle notes tutorial dismissal
    const handleNotesTutorialDismiss = useCallback(() => {
      setShowNotesTutorial(false);
      tutorialStore$.completeNotesTutorial();
    }, []);

    // Show loading or empty state
    if (effectiveIsLoading && chaptersData.length === 0) {
      return (
        <View style={[bibleStyles.container, styles.centerContent]}>
          <ActivityIndicator size="large" color={theme.colors.text.primary} />
          <Text style={bibleStyles.loadingText}>Loading Scripture...</Text>
        </View>
      );
    }

    if (!effectiveIsLoading && chaptersData.length === 0) {
      return (
        <View style={[bibleStyles.container, styles.centerContent]}>
          <Text style={styles.errorText}>No chapters available</Text>
          <Text style={styles.errorText}>Version: {biblePane.versionId}</Text>
          <Text style={styles.errorText}>
            Chapter: {biblePane.currentChapterId}
          </Text>
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
          renderScrollComponent={RenderScrollComponent}
          getItemType={getItemType}
          onScrollBeginDrag={handleScrollBeginDrag}
          onScrollEndDrag={handleScrollEndDrag}
          {...flashListConfig.props}
          onViewableItemsChanged={bibleNavigation.onViewableItemsChanged}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          viewabilityConfig={bibleNavigation.viewabilityConfig}
        />

        {/* Simple overlay condition: loading OR navigation not complete */}
        {(!bibleNavigation.isNavigationComplete || navigation.isPendingScroll) && (
          <View style={styles.loadingMask}>
            <ActivityIndicator size="large" color={theme.colors.text.primary} />
            <Text style={[bibleStyles.loadingText, { marginTop: 16 }]}>
              Loading...
            </Text>
          </View>
        )}

        {/* Pane search overlay for note relocation */}
        {paneSearchConfig && (
          <PaneSearch
            position={paneSearchConfig.position}
            mode={paneSearchConfig.mode}
            onSelect={paneSearchConfig.onSelect}
            onClose={closePaneSearch}
            title="Relocate Note"
            showOverlay={true}
          />
        )}

        {/* Notes Tutorial - shown on first time focusing a note */}
        <NotesTutorialModal
          visible={showNotesTutorial}
          onDismiss={handleNotesTutorialDismiss}
        />

        <HighlightColorPicker
          visible={highlightActions.highlightPickerVisible}
          onClose={highlightActions.handleCloseHighlightPicker}
          onColorSelect={highlightActions.handleHighlightColorPick}
          onRemoveHighlight={highlightActions.handleRemoveHighlight}
        />
      </View>
    );
  }
);

const styles = StyleSheet.create({
  centerContent: {
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorText: {
    color: "#ff6b6b",
    fontSize: 14,
    marginVertical: 4,
    textAlign: "center",
  },
  loadingMask: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.3)",
  },
});
