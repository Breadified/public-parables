/**
 * useScrollNavigation Hook
 *
 * Provides unified single-stage scroll navigation for Bible viewers, handling:
 * - Verse navigation with precise positioning
 * - Chapter navigation
 * - Scroll state management
 * - Chapter change callbacks
 * - First-time initialization tracking
 *
 * Single-stage approach: Scrolls directly to target verse/chapter.
 *
 * @example
 * ```typescript
 * const { navigateToVerse, navigateToChapter, isPendingScroll } = useScrollNavigation({
 *   flashListRef,
 *   items: simplifiedItems,
 *   findVerseInItems: (items, verseId) => ({ index: ... }),
 *   onChapterChange: (id, name, num) => {...},
 * });
 * ```
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { Dimensions } from 'react-native';
import { bibleStore$ } from '@/state/bibleStore';
import { useNavigationBase } from './useNavigationBase';
import { useScrollStateOptional } from '@/contexts/ScrollStateContext';

/**
 * Parameters for useScrollNavigation hook
 */
export interface UseScrollNavigationParams<T = any> {
  /** Reference to FlashList for scroll operations */
  flashListRef: React.RefObject<any>;

  /** Array of items being rendered in the list */
  items: T[];

  /** Function to find verse index in items - returns { index, offset? } */
  findVerseInItems: (items: T[], verseId: number) => { index: number; offset?: number };

  /** Function to find chapter index in items - returns { index } */
  findChapterInItems?: (items: T[], chapterId: number) => { index: number };

  /** Callback when chapter changes */
  onChapterChange?: (chapterId: number, bookName: string, chapterNum: number) => void;

  /** Callback when navigation completes (scroll finishes) */
  onNavigationComplete?: () => void;

  /** Current loading state */
  isLoading?: boolean;

  /** Whether this viewer is currently active/visible */
  isActive?: boolean;

  /** Selected verse ID from external source (e.g., search) */
  selectedVerseId?: number | null;

  /** Selected chapter ID from external source */
  selectedChapterId?: number | null;

  /** Function to extract book name from book ID */
  getBookName?: (bookId: number) => string;

  /** Custom view position for scroll (0-1, default 0.33 for 1/3 from top) */
  viewPosition?: number;

  /** Custom view offset in pixels (positive pushes down, negative pushes up) */
  viewOffset?: number;

  /** Custom delay before scrolling (ms, default 150) */
  scrollDelay?: number;

  /** Whether to use animated scrolling (default true) */
  animated?: boolean;

  /** Mode: 'simplified' for verse-based items, 'chapter' for chapter-based items */
  mode?: 'simplified' | 'chapter';

  /** ✅ NEW: Initial target chapter for protecting against premature chapter tracking */
  initialTargetChapter?: number;

  /** ✅ TWO-STAGE SCROLL: Ref to verse position measurements for precise scrolling */
  versePositionsRef?: React.RefObject<Map<number, { offsetY: number; height: number }>>;

  /** ✅ TWO-STAGE SCROLL: Callback to set navigation state (shows loading overlay) */
  setIsNavigatingToVerse?: (isNavigating: boolean) => void;
}

/**
 * Return type for useBibleNavigation hook
 */
export interface UseBibleNavigationReturn {
  /** Navigate to a specific verse ID */
  navigateToVerse: (verseId: number, options?: NavigationOptions) => void;

  /** Navigate to a specific chapter ID */
  navigateToChapter: (chapterId: number, options?: NavigationOptions) => void;

  /** Whether a scroll operation is pending */
  isPendingScroll: boolean;

  /** Current chapter ID being tracked */
  currentChapterId: number | null;

  /** Last reported chapter ID */
  lastReportedChapterId: number | null;

  /** Reset initialization state (useful for tab switching) */
  resetInitialization: () => void;

  /** ✅ NEW: Ref to target chapter from navigation (access .current for latest value) */
  navigationTargetChapterRef: React.MutableRefObject<number | null>;

  /** ✅ NEW: Mark scroll as complete (call from onMomentumScrollEnd for animated scrolls) */
  markScrollComplete: () => void;
}

/**
 * Options for navigation operations
 */
export interface NavigationOptions {
  /** Override default animated setting */
  animated?: boolean;

  /** Override default view position */
  viewPosition?: number;

  /** Override default scroll delay */
  delay?: number;

  /** Force navigation even if already at target */
  force?: boolean;
}

/**
 * Default book name extraction from verse/chapter ID
 */
const defaultGetBookName = (bookId: number): string => {
  // This is a fallback - ideally provided by caller
  return `Book ${bookId}`;
};

/**
 * Extract chapter ID from verse ID
 */
const getChapterIdFromVerseId = (verseId: number): number => {
  return Math.floor(verseId / 1000) * 1000;
};

/**
 * Extract book and chapter info from chapter ID
 */
const extractChapterInfo = (chapterId: number) => {
  const bookId = Math.floor(chapterId / 1000000);
  const chapterNum = Math.floor((chapterId % 1000000) / 1000);
  return { bookId, chapterNum };
};

/**
 * useScrollNavigation Hook
 *
 * Provides single-stage scroll navigation logic for Bible viewers.
 */
export function useScrollNavigation<T = any>({
  flashListRef,
  items,
  findVerseInItems,
  findChapterInItems,
  onChapterChange,
  onNavigationComplete,
  isLoading = false,
  isActive = true,
  selectedVerseId = null,
  selectedChapterId = null,
  getBookName = defaultGetBookName,
  viewPosition = 0.33, // 1/3 from top
  viewOffset,
  scrollDelay = 0, // ✅ No delay for instant navigation
  animated = true,
  mode = 'simplified',
  initialTargetChapter,
  versePositionsRef,
  setIsNavigatingToVerse,
}: UseScrollNavigationParams<T>): UseBibleNavigationReturn {

  // ===========================
  // Scroll State Coordination
  // ===========================
  // ✅ NEW: Use ScrollStateContext for coordination (optional for gradual migration)
  const scrollState = useScrollStateOptional();

  // ✅ PERFORMANCE FIX: Store scrollState in ref to avoid dependency array recreation
  // Context objects are created fresh each render - using ref prevents callback recreation
  const scrollStateRef = useRef(scrollState);
  scrollStateRef.current = scrollState;

  // ===========================
  // Base Navigation Layer
  // ===========================
  const base = useNavigationBase({
    isActive,
    onChapterChange,
    onNavigationComplete,
    initialTargetChapter,
  });

  // Destructure for cleaner code
  const {
    hasEverInitialized,
    isExternalNavigationRef,
    currentChapterRef,
    lastReportedChapterRef,
    lastNavigatedVerseId,
    lastNavigatedChapterId,
    navigationTargetChapterRef,
    markInitialized,
    callNavigationComplete,
  } = base;

  // ===========================
  // Scroll-Specific State
  // ===========================
  const navigationTargetClearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ✅ FIX: Track last REQUESTED chapter/verse to handle component reuse
  // This is different from lastNavigatedChapterId which tracks successful scrolls
  // This tracks what we've already tried to navigate to (prevents loops)
  const lastRequestedChapterId = useRef<number | null>(null);
  const lastRequestedVerseId = useRef<number | null>(null);

  // Pending scroll state
  const [isPendingScroll, setIsPendingScroll] = useState(false);
  const pendingScrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onScrollCompleteCallbackRef = useRef<(() => void) | null>(null);

  /**
   * Mark scroll as complete (called from FlatList scroll events or timeout)
   */
  const markScrollComplete = useCallback(() => {
    if (pendingScrollTimeoutRef.current) {
      clearTimeout(pendingScrollTimeoutRef.current);
      pendingScrollTimeoutRef.current = null;
    }

    setIsPendingScroll(false);

    // ✅ NEW: Signal scroll complete to ScrollStateContext
    // ✅ PERFORMANCE FIX: Access scrollState via ref to avoid callback recreation
    scrollStateRef.current?.markComplete();

    // Call any pending completion callback
    if (onScrollCompleteCallbackRef.current) {
      onScrollCompleteCallbackRef.current();
      onScrollCompleteCallbackRef.current = null;
    }
  }, []); // ✅ PERFORMANCE FIX: Removed scrollState - accessed via ref

  /**
   * Scroll to a specific index with error handling and fallback
   */
  const scrollToIndex = useCallback((
    index: number,
    options: {
      animated?: boolean;
      viewPosition?: number;
      viewOffset?: number;
      onComplete?: () => void;
    } = {}
  ) => {
    const {
      animated: shouldAnimate = true,
      viewPosition: vp = 0.33,
      viewOffset,
      onComplete,
    } = options;

    if (!flashListRef.current || index < 0) {
      onComplete?.();
      return;
    }

    // Clear any existing timeout
    if (pendingScrollTimeoutRef.current) {
      clearTimeout(pendingScrollTimeoutRef.current);
    }

    setIsPendingScroll(true);
    onScrollCompleteCallbackRef.current = onComplete || null;

    requestAnimationFrame(() => {
      try {
        const scrollConfig: any = {
          index,
          animated: shouldAnimate,
          viewPosition: vp,
        };

        if (viewOffset !== undefined) {
          scrollConfig.viewOffset = viewOffset;
        }

        flashListRef.current?.scrollToIndex(scrollConfig);

        // For non-animated scrolls, complete immediately after next render
        if (!shouldAnimate) {
          requestAnimationFrame(() => {
            markScrollComplete();
          });
        } else {
          // For animated scrolls, set a safety timeout but expect onMomentumScrollEnd to call markScrollComplete
          pendingScrollTimeoutRef.current = setTimeout(() => {
            console.warn('[useBibleNavigation] Scroll timeout - marking complete via fallback');
            markScrollComplete();
          }, 2000); // 2 second safety timeout for animated scrolls
        }
      } catch (error) {
        console.warn('[useBibleNavigation] Failed to scroll, trying without animation:', error);

        // Fallback: try without animation
        try {
          flashListRef.current?.scrollToIndex({
            index,
            animated: false,
            viewPosition: vp,
          });

          // Non-animated fallback completes immediately
          requestAnimationFrame(() => {
            markScrollComplete();
          });
        } catch (fallbackError) {
          console.warn('[useBibleNavigation] Fallback scroll also failed:', fallbackError);
          markScrollComplete();
        }
      }
    });
  }, [flashListRef, markScrollComplete]);

  /**
   * Navigate to a specific verse
   * Supports both single-stage (legacy) and two-stage (precise) scrolling
   */
  // Track pending verse navigation to prevent duplicate calls during scroll
  const pendingVerseRef = useRef<number | null>(null);

  const navigateToVerse = useCallback((
    verseId: number,
    options: NavigationOptions = {}
  ) => {
    if (!verseId || isLoading || !flashListRef.current || items.length === 0) {
      return;
    }

    const {
      animated: shouldAnimate = animated,
      viewPosition: vp = viewPosition,
      delay = scrollDelay,
      force = false,
    } = options;

    // ✅ DEDUPLICATION:
    // - Always skip if currently navigating (prevents loops when effect re-runs during scroll)
    // - Skip if already navigated UNLESS forced (force handles stale lastNavigatedVerseId)
    if (verseId === pendingVerseRef.current) {
      console.log('[useBibleNavigation] Skipping - already navigating to verse:', verseId);
      return;
    }
    if (!force && verseId === lastNavigatedVerseId.current) {
      console.log('[useBibleNavigation] Skipping duplicate verse navigation:', verseId);
      return;
    }

    // ✅ FIX: Set pending, not completed - will set completed after scroll succeeds
    pendingVerseRef.current = verseId;

    // ✅ NEW: Signal navigation start to ScrollStateContext
    // Extract chapter ID from verse ID for the navigation target
    // ✅ PERFORMANCE FIX: Access scrollState via ref to avoid callback recreation
    const targetChapterIdForState = getChapterIdFromVerseId(verseId);
    scrollStateRef.current?.startNavigation(targetChapterIdForState, verseId);

    // Find verse in items
    const result = findVerseInItems(items, verseId);

    if (result.index < 0) {
      console.warn('[useBibleNavigation] Verse not found:', verseId);
      return;
    }

    console.log('[useBibleNavigation] Navigating to verse:', verseId, 'at index:', result.index);

    // Extract chapter info from verse ID
    const targetChapterId = getChapterIdFromVerseId(verseId);
    const { bookId, chapterNum } = extractChapterInfo(targetChapterId);
    const bookName = getBookName(bookId);

    // Notify parent of chapter change BEFORE scrolling (uses base for deduplication)
    base.reportChapterChange(targetChapterId, bookName, chapterNum);

    // ===========================
    // TWO-STAGE SCROLL (Precise verse positioning)
    // ===========================
    if (versePositionsRef && setIsNavigatingToVerse) {
      console.log('[useBibleNavigation] 🎯 Two-stage scroll: Navigating to verse with precise positioning');

      // Stage 1: Set navigation state (shows loading overlay)
      setIsNavigatingToVerse(true);

      setTimeout(() => {
        // Stage 2: Scroll to paragraph (non-animated) to trigger measurements
        try {
          flashListRef.current?.scrollToIndex({
            index: result.index,
            animated: false,
            viewPosition: 0,
          });

          console.log('[useBibleNavigation] Stage 1 complete: Scrolled to paragraph, waiting for measurements...');

          // Stage 3: Wait for verse position measurements
          const measurementDelay = setTimeout(() => {
            const versePos = versePositionsRef.current?.get(verseId);

            if (versePos) {
              console.log('[useBibleNavigation] Verse position measured:', versePos.offsetY, '- Scrolling with viewOffset');

              try {
                const screenHeight = Dimensions.get('window').height;
                const desiredTopOffset = screenHeight / 3;

                // Calculate offset from paragraph top to position verse at 1/3 screen
                const offsetFromParagraphTop = versePos.offsetY - desiredTopOffset;

                console.log('[useBibleNavigation] Using viewOffset:', offsetFromParagraphTop, 'to position verse precisely');

                // Stage 4: Scroll with precise offset (animated)
                flashListRef.current?.scrollToIndex({
                  index: result.index,
                  animated: true,
                  viewOffset: offsetFromParagraphTop,
                });

                // Stage 5: Complete navigation after animation
                setTimeout(() => {
                  // ✅ FIX: Mark as navigated after scroll completes
                  lastNavigatedVerseId.current = verseId;
                  pendingVerseRef.current = null;
                  setIsNavigatingToVerse(false);
                  callNavigationComplete();
                }, 300); // Animated scroll delay
              } catch (error) {
                console.warn('[useBibleNavigation] Failed to scroll with viewOffset:', error);
                setIsNavigatingToVerse(false);
              }
            } else {
              console.warn('[useBibleNavigation] Verse position not measured, falling back to paragraph scroll');

              // Fallback to paragraph-level scroll
              try {
                flashListRef.current?.scrollToIndex({
                  index: result.index,
                  animated: true,
                });

                setTimeout(() => {
                  // ✅ FIX: Mark as navigated after scroll completes
                  lastNavigatedVerseId.current = verseId;
                  pendingVerseRef.current = null;
                  setIsNavigatingToVerse(false);
                  callNavigationComplete();
                }, 300);
              } catch (error) {
                console.warn('[useBibleNavigation] Fallback scroll failed:', error);
                setIsNavigatingToVerse(false);
              }
            }
          }, 300); // Wait for measurements (reduced from 800ms)

        } catch (error) {
          console.warn('[useBibleNavigation] Failed to scroll to paragraph:', error);
          setIsNavigatingToVerse(false);
        }
      }, delay);

      return;
    }

    // ===========================
    // SINGLE-STAGE SCROLL (Legacy, paragraph-level)
    // ===========================
    console.log('[useBibleNavigation] Single-stage scroll: Using paragraph-level positioning');

    // Calculate view position
    const screenHeight = Dimensions.get('window').height;
    const calculatedViewPosition = vp || (screenHeight / 3 / screenHeight);

    // Scroll to verse
    setTimeout(() => {
      scrollToIndex(result.index, {
        animated: shouldAnimate,
        viewPosition: calculatedViewPosition,
        viewOffset: result.offset,
        onComplete: () => {
          // ✅ FIX: Mark as navigated after scroll completes
          lastNavigatedVerseId.current = verseId;
          pendingVerseRef.current = null;
          callNavigationComplete();
        },
      });
    }, delay);
    // NOTE: onNavigationComplete intentionally NOT in dependencies - it's a callback we call, not a value we read
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isLoading,
    flashListRef,
    items,
    findVerseInItems,
    getBookName,
    base.reportChapterChange,
    animated,
    viewPosition,
    scrollDelay,
    scrollToIndex,
    versePositionsRef,
    setIsNavigatingToVerse,
    // ✅ PERFORMANCE FIX: Removed scrollState - accessed via ref
  ]);

  // Track pending navigation to prevent duplicate calls during scroll
  const pendingChapterRef = useRef<number | null>(null);

  /**
   * Navigate to a specific chapter
   */
  const navigateToChapter = useCallback((
    chapterId: number,
    options: NavigationOptions = {}
  ) => {
    if (!chapterId || isLoading || !flashListRef.current || items.length === 0) {
      return;
    }

    const {
      animated: shouldAnimate = animated,
      viewPosition: vp = viewPosition,
      delay = scrollDelay,
      force = false,
    } = options;

    // ✅ DEDUPLICATION:
    // - Always skip if currently navigating (prevents loops when effect re-runs during scroll)
    // - Skip if already navigated UNLESS forced (force handles stale lastNavigatedChapterId)
    if (chapterId === pendingChapterRef.current) {
      console.log('[useBibleNavigation] Skipping - already navigating to:', chapterId);
      return;
    }
    if (!force && chapterId === lastNavigatedChapterId.current) {
      console.log('[useBibleNavigation] Skipping duplicate chapter navigation:', chapterId);
      return;
    }

    // ✅ FIX: Set pending, not completed - will set completed after scroll succeeds
    pendingChapterRef.current = chapterId;

    // ✅ NEW: Signal navigation start to ScrollStateContext
    // This replaces the old navigationTargetChapterRef + timeout pattern
    // ✅ PERFORMANCE FIX: Access scrollState via ref to avoid callback recreation
    scrollStateRef.current?.startNavigation(chapterId);

    // ✅ LEGACY: Set navigation target to prevent chapter tracking override
    // TODO: Remove once all views use ScrollStateContext
    navigationTargetChapterRef.current = chapterId;

    // Clear any existing target clear timer
    if (navigationTargetClearTimer.current) {
      clearTimeout(navigationTargetClearTimer.current);
    }

    // Clear navigation target after scroll completes
    // Match the isPendingScroll timeout (800ms for animated, 100ms for instant)
    navigationTargetClearTimer.current = setTimeout(() => {
      navigationTargetChapterRef.current = null;
      navigationTargetClearTimer.current = null;
    }, 1000); // 1 second to be safe, covering both animated (800ms) and non-animated (100ms)

    // Find chapter in items
    let targetIndex = -1;

    if (findChapterInItems) {
      const result = findChapterInItems(items, chapterId);
      targetIndex = result.index;
    } else {
      // Fallback: search for chapter-header type
      targetIndex = items.findIndex((item: any) =>
        item.type === 'chapter-header' && item.chapterId === chapterId
      );
    }

    if (targetIndex < 0) {
      console.warn('[useBibleNavigation] Chapter not found:', chapterId);
      return;
    }

    console.log('[useBibleNavigation] Navigating to chapter:', chapterId, 'at index:', targetIndex);

    // Extract chapter info
    const { bookId, chapterNum } = extractChapterInfo(chapterId);
    const bookName = getBookName(bookId);

    // Notify parent of chapter change BEFORE scrolling (uses base for deduplication)
    base.reportChapterChange(chapterId, bookName, chapterNum);

    // Scroll to chapter
    setTimeout(() => {
      scrollToIndex(targetIndex, {
        animated: shouldAnimate,
        viewPosition: vp,
        viewOffset: viewOffset,
        onComplete: () => {
          // ✅ FIX: Only mark as "navigated" after scroll completes
          // This prevents skipping navigation if previous scroll failed
          lastNavigatedChapterId.current = chapterId;
          pendingChapterRef.current = null;
          callNavigationComplete();
        },
      });
    }, delay);
    // NOTE: onNavigationComplete intentionally NOT in dependencies - it's a callback we call, not a value we read
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isLoading,
    flashListRef,
    items,
    findChapterInItems,
    getBookName,
    base.reportChapterChange,
    animated,
    viewPosition,
    viewOffset,
    scrollDelay,
    scrollToIndex,
    // ✅ PERFORMANCE FIX: Removed scrollState - accessed via ref
  ]);

  /**
   * Reset initialization state (useful for tab switching)
   */
  const resetInitialization = useCallback(() => {
    hasEverInitialized.current = false;
    isExternalNavigationRef.current = false;
    lastNavigatedVerseId.current = null;
    lastNavigatedChapterId.current = null;
    lastRequestedChapterId.current = null;
    lastRequestedVerseId.current = null;
  }, []);

  // ✅ Reset request tracking when tab becomes inactive
  // This allows navigation to retry when the tab becomes active again
  useEffect(() => {
    if (!isActive) {
      lastRequestedChapterId.current = null;
      lastRequestedVerseId.current = null;
    }
  }, [isActive]);

  /**
   * ✅ NEW: Set navigation target on initial mount to protect against premature chapter tracking
   * This prevents chapter tracking from overriding the intended chapter during initial load
   */
  useEffect(() => {
    // On first initialization with items loaded
    if (!hasEverInitialized.current && items.length > 0 && !isLoading && initialTargetChapter) {
      console.log('[useBibleNavigation] Setting initial navigation target on mount:', initialTargetChapter);
      navigationTargetChapterRef.current = initialTargetChapter;

      // Clear after a delay to allow initial render and scroll to settle
      setTimeout(() => {
        if (navigationTargetChapterRef.current === initialTargetChapter) {
          navigationTargetChapterRef.current = null;
          console.log('[useBibleNavigation] Cleared initial navigation target');
        }
      }, 2000);
    }
  }, [items.length, isLoading, initialTargetChapter]);

  /**
   * Handle external navigation (from selectedVerseId/selectedChapterId props)
   * AND initial navigation on mount (for tab restoration)
   */
  useEffect(() => {
    console.log('[useBibleNavigation] 🔄 Navigation effect triggered:', {
      isLoading,
      itemsLength: items.length,
      isActive,
      selectedVerseId,
      selectedChapterId,
      initialTargetChapter,
      hasEverInitialized: hasEverInitialized.current,
      lastNavigatedChapterId: lastNavigatedChapterId.current,
      lastNavigatedVerseId: lastNavigatedVerseId.current,
    });

    // Wait for data to load
    if (isLoading || items.length === 0 || !isActive || !flashListRef.current) {
      console.log('[useBibleNavigation] ⏸️ Skipping - waiting for conditions:', {
        isLoading,
        hasItems: items.length > 0,
        isActive,
        hasRef: !!flashListRef.current,
      });
      return;
    }

    // Mark as external navigation
    isExternalNavigationRef.current = true;

    // Priority 1: Navigate to verse (if selected)
    if (selectedVerseId) {
      // ✅ FIX: Track the last REQUESTED verse to handle component reuse
      if (selectedVerseId !== lastRequestedVerseId.current) {
        console.log('[useBibleNavigation] 🎯 Navigating to VERSE:', selectedVerseId,
          '(lastRequested:', lastRequestedVerseId.current, ')');
        lastRequestedVerseId.current = selectedVerseId;
        navigateToVerse(selectedVerseId, {
          force: true, // ✅ Force to bypass stale lastNavigatedVerseId
          animated: false, // ✅ Instant navigation on load
          delay: 0,
        });
        markInitialized();
      } else {
        console.log('[useBibleNavigation] ⏭️ Skipping - already requested verse:', selectedVerseId);
      }
      // NOTE: Don't clear selection here - verse needs to stay selected for highlighting
      // Selection will be cleared when user performs next action or search
      return;
    }

    // Priority 2: Navigate to chapter (if selected from search)
    if (selectedChapterId) {
      // ✅ FIX: Track the last REQUESTED chapter to handle component reuse
      // lastNavigatedChapterId tracks successful scrolls, but can be stale
      // lastRequestedChapterId tracks what we've already tried to navigate to
      if (selectedChapterId !== lastRequestedChapterId.current) {
        console.log('[useBibleNavigation] 🎯 Navigating to CHAPTER:', selectedChapterId,
          '(lastRequested:', lastRequestedChapterId.current, ')');
        lastRequestedChapterId.current = selectedChapterId;
        navigateToChapter(selectedChapterId, {
          animated: false, // ✅ Instant navigation on load
          delay: 0,
          force: true, // ✅ Force to bypass stale lastNavigatedChapterId
        });
        markInitialized();
      } else {
        console.log('[useBibleNavigation] ⏭️ Skipping - already requested chapter:', selectedChapterId);
      }

      // NOTE: Selection will be cleared naturally on next search/navigation
      return;
    }

    // ✅ PRIORITY 3: Navigate to intended chapter on initial mount (tab restoration)
    // This handles the case where we load a tab with a specific chapter but no search
    if (!hasEverInitialized.current && initialTargetChapter) {
      console.log('[useBibleNavigation] 🎯 Initial mount - navigating to intended chapter:', initialTargetChapter);
      navigateToChapter(initialTargetChapter, {
        animated: false,
        delay: 0,
        force: true,
      });
      markInitialized();
      return;
    }

    // ✅ PRIORITY 4: Initial mount without navigation - mark as initialized
    if (!hasEverInitialized.current && isActive) {
      console.log('[useBibleNavigation] ✅ Initial mount - no navigation needed, marking complete');
      markInitialized();
      callNavigationComplete();
    } else {
      console.log('[useBibleNavigation] ⏭️ No action needed - already initialized');
    }
    // NOTE: onNavigationComplete intentionally NOT in dependencies - it's a callback we call, not a value we read
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isLoading,
    items,
    isActive,
    selectedVerseId,
    selectedChapterId,
    initialTargetChapter,
    navigateToVerse,
    navigateToChapter,
  ]);

  return {
    navigateToVerse,
    navigateToChapter,
    isPendingScroll,
    currentChapterId: currentChapterRef.current,
    lastReportedChapterId: lastReportedChapterRef.current,
    resetInitialization,
    navigationTargetChapterRef, // ✅ NEW: Expose ref so callbacks can access latest value
    markScrollComplete, // ✅ NEW: Allow components to signal scroll completion
  };
}
