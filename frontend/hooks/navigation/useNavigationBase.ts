/**
 * useNavigationBase Hook
 *
 * Core foundation for Bible navigation hooks.
 * Provides shared initialization, deduplication, and chapter tracking logic.
 *
 * This base layer is used by:
 * - useScrollNavigation (single-stage scroll for SinglePaneBibleView, BibleNotesAlignedView)
 * - useVerseAlignedNavigation (two-stage scroll for VerseAlignedSplitView)
 *
 * @example
 * ```typescript
 * const base = useNavigationBase({
 *   isActive,
 *   onChapterChange: (id, name, num) => {...},
 *   initialTargetChapter: 1001001,
 * });
 * ```
 */

import { useRef, useCallback, useEffect } from 'react';

export interface NavigationBaseParams {
  /** Whether this viewer is the active tab */
  isActive: boolean;

  /** Callback when chapter visibility changes */
  onChapterChange?: (chapterId: number, bookName: string, chapterNumber: number) => void;

  /** Optional callback when navigation completes */
  onNavigationComplete?: () => void;

  /** Initial target chapter for tab restoration (prevents premature chapter tracking) */
  initialTargetChapter?: number;
}

export interface NavigationBaseReturn {
  /** Whether this is the first navigation ever */
  hasEverInitialized: React.MutableRefObject<boolean>;

  /** Whether current navigation is triggered externally (vs user scroll) */
  isExternalNavigationRef: React.MutableRefObject<boolean>;

  /** Current chapter being displayed */
  currentChapterRef: React.MutableRefObject<number | null>;

  /** Last chapter reported via onChapterChange callback */
  lastReportedChapterRef: React.MutableRefObject<number | null>;

  /** Last verse navigated to (deduplication) */
  lastNavigatedVerseId: React.MutableRefObject<number | null>;

  /** Last chapter navigated to (deduplication) */
  lastNavigatedChapterId: React.MutableRefObject<number | null>;

  /** Target chapter for initial load (used by chapter tracking to prevent override) */
  navigationTargetChapterRef: React.MutableRefObject<number | null>;

  /** Report chapter change (with deduplication) */
  reportChapterChange: (chapterId: number, bookName: string, chapterNumber: number) => void;

  /** Mark initialization as complete */
  markInitialized: () => void;

  /** Call navigation complete callback */
  callNavigationComplete: () => void;
}

/**
 * Base navigation hook - provides core initialization, deduplication, and tracking
 */
export function useNavigationBase({
  isActive,
  onChapterChange,
  onNavigationComplete,
  initialTargetChapter,
}: NavigationBaseParams): NavigationBaseReturn {

  // ===========================
  // Initialization Tracking
  // ===========================

  /** Tracks if we've ever navigated (prevents duplicate initial navigation) */
  const hasEverInitialized = useRef(false);

  /** Whether current navigation is external (vs user-driven scroll) */
  const isExternalNavigationRef = useRef(false);

  // ===========================
  // Chapter Tracking
  // ===========================

  /** Current chapter being displayed */
  const currentChapterRef = useRef<number | null>(null);

  /** Last chapter we reported via onChapterChange */
  const lastReportedChapterRef = useRef<number | null>(null);

  /** Target chapter for initial navigation (prevents chapter tracking override) */
  const navigationTargetChapterRef = useRef<number | null>(initialTargetChapter ?? null);

  // ===========================
  // Deduplication Tracking
  // ===========================

  /** Last verse we navigated to (prevents duplicate navigation) */
  const lastNavigatedVerseId = useRef<number | null>(null);

  /** Last chapter we navigated to (prevents duplicate navigation) */
  const lastNavigatedChapterId = useRef<number | null>(null);

  // ===========================
  // Chapter Change Reporting
  // ===========================

  /**
   * Report chapter change with automatic deduplication
   */
  const reportChapterChange = useCallback((
    chapterId: number,
    bookName: string,
    chapterNumber: number
  ) => {
    // Update current chapter
    currentChapterRef.current = chapterId;

    // Only report if different from last reported
    if (chapterId !== lastReportedChapterRef.current) {
      lastReportedChapterRef.current = chapterId;
      onChapterChange?.(chapterId, bookName, chapterNumber);
    }
  }, [onChapterChange]);

  // ===========================
  // Lifecycle Helpers
  // ===========================

  /**
   * Mark navigation as initialized
   */
  const markInitialized = useCallback(() => {
    hasEverInitialized.current = true;
  }, []);

  /**
   * Call navigation complete callback
   */
  const callNavigationComplete = useCallback(() => {
    if (onNavigationComplete) {
      requestAnimationFrame(() => {
        onNavigationComplete();
      });
    }
  }, [onNavigationComplete]);

  // ===========================
  // Tab Activity Management
  // ===========================

  /**
   * Reset tracking when tab becomes inactive
   */
  useEffect(() => {
    if (!isActive) {
      lastNavigatedVerseId.current = null;
      lastNavigatedChapterId.current = null;
      isExternalNavigationRef.current = false;
    }
  }, [isActive]);

  return {
    hasEverInitialized,
    isExternalNavigationRef,
    currentChapterRef,
    lastReportedChapterRef,
    lastNavigatedVerseId,
    lastNavigatedChapterId,
    navigationTargetChapterRef,
    reportChapterChange,
    markInitialized,
    callNavigationComplete,
  };
}
