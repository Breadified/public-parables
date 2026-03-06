/**
 * useVerseAlignedNavigation - Specialized navigation for verse-aligned split view
 *
 * Handles complex two-stage scrolling with precise verse positioning using viewOffset.
 * Unlike useBibleNavigation, this hook manages:
 * - Verse position measurements from child components
 * - Two-stage scrolling (chapter first, then verse with offset)
 * - Precise viewOffset calculations for verse alignment
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { Dimensions } from 'react-native';
import { findVerseInChapters, findChapterInChapters } from '../../modules/bible/autoScroll';
import { bibleStore$ } from '@/state/bibleStore';
import { useNavigationBase } from './useNavigationBase';

interface VerseAlignedNavigationConfig {
  flashListRef: React.RefObject<any>;
  chaptersData: any[];
  isLoading: boolean;
  isActive: boolean;
  selectedVerseId: number | null;
  selectedChapterId: number | null;
  /** Initial chapter (used for chapter reporting, not scrolling - FlashList handles initial scroll) */
  initialChapterId: number;
  onChapterChange?: (chapterId: number, bookName: string, chapterNumber: number) => void;
  onNavigationComplete?: () => void;
  leftPaneId: string;
  rightPaneId: string;
  updateBibleReaderChapter: (paneId: string, chapterId: number, bookName: string, chapterNumber: number) => void;
}

interface PendingScroll {
  type: 'chapter' | 'verse';
  data: {
    index: number;
    chapterId: number;
    bookName: string;
    chapterNumber: number;
    verseId?: number;
  };
}

export function useVerseAlignedNavigation({
  flashListRef,
  chaptersData,
  isLoading,
  isActive,
  selectedVerseId,
  selectedChapterId,
  initialChapterId,
  onChapterChange,
  onNavigationComplete,
  leftPaneId,
  rightPaneId,
  updateBibleReaderChapter,
}: VerseAlignedNavigationConfig) {
  // ===========================
  // Base Navigation Layer
  // ===========================
  const base = useNavigationBase({
    isActive,
    onChapterChange,
    onNavigationComplete,
    initialTargetChapter: undefined, // Two-stage scroll doesn't use initial target chapter
  });

  // Destructure for cleaner code
  const {
    hasEverInitialized: hasInitialized,
    lastNavigatedVerseId,
    lastNavigatedChapterId,
    lastReportedChapterRef,
    markInitialized,
    callNavigationComplete,
  } = base;

  // ===========================
  // Two-Stage Scroll State
  // ===========================
  const [isCalculatingAlignment, setIsCalculatingAlignment] = useState(false);
  const [pendingScroll, setPendingScroll] = useState<PendingScroll | null>(null);

  // Track if we're in the initial mount phase (before first scroll completes)
  // This is state (not derived from ref) to trigger re-renders when initialization completes
  const [isInitializing, setIsInitializing] = useState(true);

  // SCROLL LOOP FIX: Track if we're actively scrolling (waiting for momentum to end)
  // This is set when programmatic scroll starts, cleared when onMomentumScrollEnd fires
  const [isScrolling, setIsScrolling] = useState(false);

  // SYNC FIX: Ref for SYNCHRONOUS navigation tracking
  // State updates are async, but onViewableItemsChanged fires synchronously during scroll
  // This ref is set BEFORE scrollToIndex and checked by chapter tracking immediately
  const isNavigatingRef = useRef(false);

  // Verse position tracking for precise scrolling
  const versePositionRef = useRef<{ chapterId: number; verseId: number; yOffset: number } | null>(null);

  // ===========================
  // Stable Data Reference
  // ===========================
  // Store chaptersData in ref to avoid effect re-runs on array reference changes
  const chaptersDataRef = useRef(chaptersData);
  chaptersDataRef.current = chaptersData;

  /**
   * Callback when verse position is calculated by chapter component
   */
  const handleVersePositionReady = useCallback((chapterId: number, verseId: number, yOffset: number) => {
    versePositionRef.current = { chapterId, verseId, yOffset };
  }, []);

  /**
   * SCROLL LOOP FIX: Callback for onMomentumScrollEnd
   * This signals that scroll has truly settled and tracking can resume
   */
  const handleMomentumScrollEnd = useCallback(() => {
    setIsScrolling(false);
    // SYNC FIX: Also clear navigating ref when momentum ends
    isNavigatingRef.current = false;
  }, []);

  /**
   * SYNC FIX: Callback for onScrollBeginDrag
   * When user starts manual scroll, clear the navigating ref to allow tracking
   * This is crucial for non-animated scrolls where onMomentumScrollEnd won't fire
   */
  const handleScrollBeginDrag = useCallback(() => {
    isNavigatingRef.current = false;
  }, []);

  // Note: Tab activity management is now handled by useNavigationBase

  /**
   * Handle verse and chapter navigation (user interactions)
   * Initial scroll is handled by FlashList's initialScrollIndex prop
   *
   * NOTE: flashListRef is intentionally NOT in dependencies to avoid excessive re-renders
   */
  useEffect(() => {
    // Use ref for stable access to chaptersData (avoids re-runs on array reference changes)
    const currentChaptersData = chaptersDataRef.current;

    // Wait for data to be ready
    if (isLoading || currentChaptersData.length === 0 || !flashListRef.current) {
      return;
    }

    // Mark as initialized on first data load
    // FIX: Don't report chapter here - parent component (VerseAlignedSplitView) handles
    // initial chapter reporting when hasTargetChapterRendered becomes true.
    // This prevents reporting wrong chapter (e.g., Ezra 9 at index 0 when Ezra 10 is target)
    if (!hasInitialized.current && isActive) {
      markInitialized();
      setIsInitializing(false);
      callNavigationComplete();
    }

    const hasNewVerseSelection =
      selectedVerseId &&
      selectedVerseId !== lastNavigatedVerseId.current;

    const hasNewChapterSelection =
      selectedChapterId &&
      !selectedVerseId &&
      selectedChapterId !== lastNavigatedChapterId.current;

    if (!hasNewVerseSelection && !hasNewChapterSelection) {
      return;
    }

    // PRIORITY 1: Verse navigation
    if (selectedVerseId) {
      lastNavigatedVerseId.current = selectedVerseId;

      const result = findVerseInChapters(currentChaptersData, selectedVerseId);

      if (result.index >= 0) {
        const chapter = currentChaptersData[result.index];

        setIsCalculatingAlignment(true);
        setPendingScroll({
          type: 'verse',
          data: {
            index: result.index,
            chapterId: chapter.chapterId,
            bookName: chapter.bookName,
            chapterNumber: chapter.chapterNumber,
            verseId: selectedVerseId,
          },
        });
      }
      return;
    }

    // PRIORITY 2: Chapter navigation
    if (selectedChapterId) {
      lastNavigatedChapterId.current = selectedChapterId;

      const result = findChapterInChapters(currentChaptersData, selectedChapterId);

      if (result.index >= 0) {
        const chapter = currentChaptersData[result.index];

        setPendingScroll({
          type: 'chapter',
          data: {
            index: result.index,
            chapterId: chapter.chapterId,
            bookName: chapter.bookName,
            chapterNumber: chapter.chapterNumber,
          },
        });
      }
    }
    // NOTE: onNavigationComplete intentionally NOT in dependencies - it's a callback we call, not a value we read
    // Use chaptersData.length (not array reference) to prevent re-runs when array reference changes
    // Access chaptersData via chaptersDataRef.current inside effect
    // flashListRef removed - accessed via ref pattern
    // initialChapterId removed - with startFromTarget=true, target is always at index 0
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, chaptersData.length, selectedVerseId, selectedChapterId, isActive]);

  /**
   * Execute pending scroll after alignment calculation
   * Uses requestAnimationFrame to ensure FlashList is mounted and ready
   */
  useEffect(() => {
    if (!pendingScroll) {
      return;
    }

    let alignmentDelay: ReturnType<typeof setTimeout> | null = null;
    let isCancelled = false;

    // Use requestAnimationFrame to ensure FlashList is mounted
    // This fixes race condition where pendingScroll is set before ref is ready
    const frameId = requestAnimationFrame(() => {
      if (isCancelled) return;

      if (!flashListRef.current) {
        // Ref still not ready - schedule another attempt
        if (__DEV__) console.warn('[useVerseAlignedNavigation] FlashList ref not ready, retrying...');
        requestAnimationFrame(() => {
          if (isCancelled || !flashListRef.current) {
            if (__DEV__) console.warn('[useVerseAlignedNavigation] FlashList ref still not ready after retry');
            setPendingScroll(null);
            return;
          }
          executeScroll();
        });
        return;
      }

      executeScroll();
    });

    function executeScroll() {
      if (isCancelled || !pendingScroll || !flashListRef.current) return;

      // Handle different scroll types
      if (pendingScroll.type === 'chapter') {
        // CHAPTER NAVIGATION: Use scrollToIndex (FlashList has layout data after initial render)
        if (__DEV__) console.log('[useVerseAlignedNavigation] Executing chapter scroll to index:', pendingScroll.data.index);
        // SYNC FIX: Set ref BEFORE scroll
        isNavigatingRef.current = true;
        try {
          setIsScrolling(true); // SCROLL LOOP FIX: Mark as scrolling until momentum ends
          flashListRef.current.scrollToIndex({
            index: pendingScroll.data.index,
            animated: true,
            viewPosition: 0, // Align to top
          });

          // Update store and notify parent immediately
          const { chapterId, bookName, chapterNumber } = pendingScroll.data;

          // Only update if different from last reported chapter
          if (chapterId !== lastReportedChapterRef.current) {
            lastReportedChapterRef.current = chapterId;
            updateBibleReaderChapter(leftPaneId, chapterId, bookName, chapterNumber);
            updateBibleReaderChapter(rightPaneId, chapterId, bookName, chapterNumber);

            if (onChapterChange) {
              onChapterChange(chapterId, bookName, chapterNumber);
            }
          }

          // Mark as initialized after first chapter navigation
          if (!hasInitialized.current) {
            markInitialized();
            setIsInitializing(false);
          }

          setPendingScroll(null);

          // Notify when navigation completes
          setTimeout(() => {
            onNavigationComplete?.();
            // SYNC FIX: Do NOT clear isNavigatingRef here!
            // It will be cleared by onMomentumScrollEnd or onScrollBeginDrag
          }, 300); // Animated scroll delay
        } catch (error) {
          if (__DEV__) console.warn('[useVerseAlignedNavigation] Failed to scroll to chapter:', error);
          isNavigatingRef.current = false;
          setPendingScroll(null);
        }
        return;
      }

      // VERSE NAVIGATION: Wait for verse position callback
      const verseId = pendingScroll.data.verseId!;
      const targetChapterId = pendingScroll.data.chapterId;

      // SYNC FIX: Set ref BEFORE scroll
      isNavigatingRef.current = true;

      // First scroll to chapter non-animated to ensure it's rendered
      try {
        flashListRef.current.scrollToIndex({
          index: pendingScroll.data.index,
          animated: false,
          viewPosition: 0,
        });
      } catch {
        // Scroll to chapter failed, will use fallback
      }

      // Wait for verse position callback (reduced delay for speed)
      alignmentDelay = setTimeout(() => {
        if (isCancelled) return;

        const versePos = versePositionRef.current;

        if (
          versePos &&
          versePos.verseId === verseId &&
          versePos.chapterId === targetChapterId
        ) {
          try {
            const screenHeight = Dimensions.get('window').height;
            const desiredTopOffset = screenHeight / 3;

            // Chapter was already scrolled to at line 317, now position to verse with viewOffset
            // Use requestAnimationFrame for smooth transition after chapter render
            requestAnimationFrame(() => {
              if (isCancelled || !flashListRef.current) return;

              const verseOffsetInChapter = versePos.yOffset;
              const offsetFromChapterTop = verseOffsetInChapter - desiredTopOffset;

              setIsScrolling(true); // SCROLL LOOP FIX: Mark as scrolling until momentum ends
              // Use scrollToIndex with viewOffset to position verse at desired screen location
              flashListRef.current?.scrollToIndex({
                index: pendingScroll.data.index,
                animated: true,
                viewOffset: -offsetFromChapterTop, // Negative to scroll verse up from chapter top
              });

              // Clear state immediately after scroll triggers
              const { chapterId, bookName, chapterNumber } = pendingScroll.data;

              // Only update if different from last reported chapter
              if (chapterId !== lastReportedChapterRef.current) {
                lastReportedChapterRef.current = chapterId;
                updateBibleReaderChapter(leftPaneId, chapterId, bookName, chapterNumber);
                updateBibleReaderChapter(rightPaneId, chapterId, bookName, chapterNumber);

                if (onChapterChange) {
                  onChapterChange(chapterId, bookName, chapterNumber);
                }
              }

              setIsCalculatingAlignment(false);
              setPendingScroll(null);
              versePositionRef.current = null;

              // Notify when verse navigation completes
              setTimeout(() => {
                onNavigationComplete?.();
                // SYNC FIX: Do NOT clear isNavigatingRef here!
                // It will be cleared by onMomentumScrollEnd or onScrollBeginDrag
              }, 300); // Animated scroll delay
            });
          } catch {
            setIsCalculatingAlignment(false);
            setPendingScroll(null);
            isNavigatingRef.current = false;
          }
        } else {
          // Verse position not available, fallback to chapter scroll
          try {
            setIsScrolling(true); // SCROLL LOOP FIX: Mark as scrolling until momentum ends
            flashListRef.current?.scrollToIndex({
              index: pendingScroll.data.index,
              animated: true,
              viewPosition: 0,
            });

            // Report chapter change for fallback immediately
            const { chapterId, bookName, chapterNumber } = pendingScroll.data;

            // Only update if different from last reported chapter
            if (chapterId !== lastReportedChapterRef.current) {
              lastReportedChapterRef.current = chapterId;
              updateBibleReaderChapter(leftPaneId, chapterId, bookName, chapterNumber);
              updateBibleReaderChapter(rightPaneId, chapterId, bookName, chapterNumber);

              if (onChapterChange) {
                onChapterChange(chapterId, bookName, chapterNumber);
              }
            }

            setIsCalculatingAlignment(false);
            setPendingScroll(null);
            versePositionRef.current = null;

            // Notify when fallback navigation completes
            setTimeout(() => {
              onNavigationComplete?.();
              // SYNC FIX: Do NOT clear isNavigatingRef here!
              // It will be cleared by onMomentumScrollEnd or onScrollBeginDrag
            }, 300); // Animated scroll delay
          } catch {
            // Fallback scroll failed
            setIsCalculatingAlignment(false);
            setPendingScroll(null);
            isNavigatingRef.current = false;
          }
        }
      }, 300); // ✅ Reduced from 800ms to 300ms
    }

    return () => {
      isCancelled = true;
      cancelAnimationFrame(frameId);
      if (alignmentDelay) {
        clearTimeout(alignmentDelay);
      }
    };
  }, [pendingScroll, leftPaneId, rightPaneId, onChapterChange, hasInitialized, markInitialized]);

  return {
    isCalculatingAlignment,
    isInitializing,
    isScrolling, // SCROLL LOOP FIX: True while programmatic scroll is in progress
    isNavigatingRef, // SYNC FIX: Ref for synchronous navigation check (bypasses async state)
    handleVersePositionReady,
    handleMomentumScrollEnd, // SCROLL LOOP FIX: Call this from FlashList onMomentumScrollEnd
    handleScrollBeginDrag, // SYNC FIX: Clear navigating ref when user starts manual scroll
  };
}
