/**
 * useChapterTracking Hook
 *
 * @deprecated Use `useBibleNavigation` instead, which unifies navigation
 * and chapter tracking. This hook is kept for backward compatibility.
 *
 * Provides chapter visibility tracking for Bible viewers.
 * Handles:
 * - onViewableItemsChanged callback
 * - Debounced chapter change reporting
 * - Tab switching state management
 * - Duplicate change prevention
 *
 * Removes ~80 lines of duplicated code from SinglePaneBibleView and VerseAlignedSplitView.
 *
 * @example
 * ```typescript
 * const { onViewableItemsChanged, viewabilityConfig, currentChapterId } = useChapterTracking({
 *   onChapterChange: (id, name, num) => updateTab(id, name, num),
 *   isActive: isTabActive,
 *   extractChapterInfo: (item) => ({ chapterId: item.chapterId, ... }),
 * });
 *
 * <FlashList
 *   onViewableItemsChanged={onViewableItemsChanged}
 *   viewabilityConfig={viewabilityConfig}
 * />
 * ```
 */

import { useCallback, useRef, useMemo, useState } from 'react';
import { useScrollStateOptional } from '@/contexts/ScrollStateContext';

/**
 * Chapter information extracted from viewable item
 */
export interface ChapterInfo {
  /** Chapter ID */
  chapterId: number;

  /** Book name */
  bookName: string;

  /** Chapter number */
  chapterNumber: number;

  /** Optional: verse ID for more precise tracking */
  verseId?: number;
}

/**
 * Parameters for useChapterTracking hook
 */
export interface UseChapterTrackingParams {
  /** Callback when visible chapter changes */
  onChapterChange?: (chapterId: number, bookName: string, chapterNum: number) => void;

  /** Whether this viewer is currently active/visible */
  isActive?: boolean;

  /**
   * Function to extract chapter info from viewable item
   * Should return null if item doesn't represent a chapter
   */
  extractChapterInfo: (item: any) => ChapterInfo | null;

  /** Custom viewability threshold (0-100, default: 50) */
  viewAreaCoveragePercentThreshold?: number;

  /** Custom minimum view time in ms (default: 500) */
  minimumViewTime?: number;

  /** Debounce delay for chapter changes in ms (default: 300) */
  debounceDelay?: number;

  /** Whether to log chapter changes (default: false) */
  verbose?: boolean;

  /** Disable tracking during navigation (default: false) */
  disableDuringNavigation?: boolean;

  /** SYNC FIX: Ref-based navigation check (bypasses async state updates) */
  disableDuringNavigationRef?: React.RefObject<boolean>;

  /** Target chapter ID for initial navigation verification */
  targetChapterId?: number | null;

  /** Callback when target chapter becomes visible (fires BEFORE scroll state blocking) */
  onTargetVisible?: () => void;
}

/**
 * Return type for useChapterTracking hook
 */
export interface UseChapterTrackingReturn {
  /** Callback for FlashList onViewableItemsChanged */
  onViewableItemsChanged: (info: any) => void;

  /** Viewability config for FlashList */
  viewabilityConfig: {
    viewAreaCoveragePercentThreshold: number;
    minimumViewTime: number;
  };

  /** Current visible chapter ID */
  currentChapterId: number | null;

  /** Last reported chapter ID */
  lastReportedChapterId: number | null;

  /** Reset tracking state */
  reset: () => void;

  /** Whether target chapter has been verified as visible */
  isTargetVisible: boolean;

  /**
   * Force target visible - fallback for when viewability callback
   * doesn't fire due to minimumViewTime threshold not being met.
   * Call this from a timeout as a safety net.
   */
  forceTargetVisible: () => void;
}

/**
 * useChapterTracking Hook
 *
 * Provides chapter visibility tracking for Bible viewers.
 */
export function useChapterTracking({
  onChapterChange,
  isActive = true,
  extractChapterInfo,
  viewAreaCoveragePercentThreshold = 50,
  minimumViewTime = 500,
  debounceDelay = 300,
  verbose = false,
  disableDuringNavigation = false,
  disableDuringNavigationRef,
  targetChapterId,
  onTargetVisible,
}: UseChapterTrackingParams): UseChapterTrackingReturn {

  // ✅ NEW: Use ScrollStateContext for coordination (optional for gradual migration)
  const scrollState = useScrollStateOptional();

  // ✅ PERFORMANCE FIX: Store scrollState in ref to avoid dependency array recreation
  // Context objects are created fresh each render - using ref prevents callback recreation
  const scrollStateRef = useRef(scrollState);
  scrollStateRef.current = scrollState;

  // Track current and last reported chapter
  const [currentChapterId, setCurrentChapterId] = useState<number | null>(null);
  const lastReportedChapterRef = useRef<number | null>(null);

  // Target visibility tracking
  const [isTargetVisible, setIsTargetVisible] = useState(false);
  const hasCalledTargetVisibleRef = useRef(false);

  // Debounce timer
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Viewability config for FlashList
   */
  const viewabilityConfig = useMemo(
    () => ({
      viewAreaCoveragePercentThreshold,
      minimumViewTime,
    }),
    [viewAreaCoveragePercentThreshold, minimumViewTime]
  );

  /**
   * Reset tracking state
   */
  const reset = useCallback(() => {
    setCurrentChapterId(null);
    lastReportedChapterRef.current = null;
    setIsTargetVisible(false);
    hasCalledTargetVisibleRef.current = false;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  }, []);

  /**
   * Force target visible - fallback for when viewability callback
   * doesn't fire due to minimumViewTime threshold not being met.
   * This is a safety net that consumers can call from a timeout.
   */
  const forceTargetVisible = useCallback(() => {
    if (!hasCalledTargetVisibleRef.current) {
      console.log('[useChapterTracking] ⚠️ forceTargetVisible called - bypassing viewability check');
      hasCalledTargetVisibleRef.current = true;
      setIsTargetVisible(true);
      onTargetVisible?.();
    }
  }, [onTargetVisible]);

  /**
   * Report chapter change with debouncing
   */
  const reportChapterChange = useCallback(
    (chapterId: number, bookName: string, chapterNum: number) => {
      // Clear any existing debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Debounce the chapter change report
      debounceTimerRef.current = setTimeout(() => {
        // ✅ FIXED: Removed isActive check - inactive tabs need to report position too
        // Skip only if already reported
        if (chapterId === lastReportedChapterRef.current) {
          return;
        }

        if (verbose) {
          console.log('[useChapterTracking] Reporting chapter change:', {
            chapterId,
            bookName,
            chapterNum,
          });
        }

        lastReportedChapterRef.current = chapterId;

        if (onChapterChange) {
          onChapterChange(chapterId, bookName, chapterNum);
        }

        debounceTimerRef.current = null;
      }, debounceDelay);
    },
    [onChapterChange, debounceDelay, verbose]
  );

  /**
   * Handle viewable items changed
   */
  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: any) => {
      // ==========================================
      // TARGET VERIFICATION - RUNS FIRST (SYNCHRONOUS)
      // Bypasses scroll state blocking for initial load
      // ==========================================
      if (targetChapterId != null && !hasCalledTargetVisibleRef.current && viewableItems.length > 0) {
        // Debug: Log what we're checking
        const viewableChapterIds = viewableItems.map((item: any) => {
          const info = extractChapterInfo(item.item);
          return info?.chapterId;
        });
        console.log('[useChapterTracking] 🔍 Target verification:', {
          targetChapterId,
          viewableChapterIds,
          hasCalledTargetVisible: hasCalledTargetVisibleRef.current,
        });

        const isVisible = viewableItems.some((item: any) => {
          const info = extractChapterInfo(item.item);
          return info?.chapterId === targetChapterId;
        });

        if (isVisible) {
          console.log('[useChapterTracking] ✅ Target chapter visible:', targetChapterId);
          hasCalledTargetVisibleRef.current = true;
          setIsTargetVisible(true);
          onTargetVisible?.();
        } else {
          console.log('[useChapterTracking] ❌ Target NOT in viewable items');
        }
      }

      // ==========================================
      // EXISTING LOGIC - scroll state blocking for normal tracking
      // ==========================================
      // SYNC FIX: Check ref FIRST - this is synchronous and immediate
      // State-based checks (disableDuringNavigation) are async and may not have updated yet
      if (disableDuringNavigationRef?.current) {
        return;
      }

      // ✅ NEW: Use ScrollStateContext for coordination when available
      // Falls back to disableDuringNavigation prop for backward compatibility
      // ✅ PERFORMANCE FIX: Access scrollState via ref to avoid callback recreation
      const currentScrollState = scrollStateRef.current;
      const shouldSkipTracking = currentScrollState
        ? !currentScrollState.isIdle  // New: check scroll state machine
        : disableDuringNavigation;  // Fallback: use prop

      // ✅ Skip tracking during navigation to prevent conflicts
      // ✅ FIXED: Removed isActive check to allow inactive tabs to track positions
      if (viewableItems.length === 0 || shouldSkipTracking) {
        return;
      }

      // Get the first viewable item
      const firstItem = viewableItems[0].item;

      // Extract chapter info from item
      const chapterInfo = extractChapterInfo(firstItem);

      if (!chapterInfo) {
        // Item doesn't represent a chapter
        return;
      }

      const { chapterId, bookName, chapterNumber } = chapterInfo;

      // Update current chapter state
      setCurrentChapterId(chapterId);

      // Skip if this is the same chapter we already reported
      if (chapterId === lastReportedChapterRef.current) {
        return;
      }

      if (verbose) {
        console.log('[useChapterTracking] Visible chapter changed:', {
          chapterId,
          bookName,
          chapterNumber,
        });
      }

      // Report chapter change (with debouncing)
      reportChapterChange(chapterId, bookName, chapterNumber);
    },
    [extractChapterInfo, reportChapterChange, verbose, disableDuringNavigation, targetChapterId, onTargetVisible] // ✅ PERFORMANCE FIX: Removed scrollState
  );

  // PERF FIX: Memoize return object to prevent recreation on every render
  return useMemo(() => ({
    onViewableItemsChanged,
    viewabilityConfig,
    currentChapterId,
    lastReportedChapterId: lastReportedChapterRef.current,
    reset,
    isTargetVisible,
    forceTargetVisible,
  }), [onViewableItemsChanged, viewabilityConfig, currentChapterId, reset, isTargetVisible, forceTargetVisible]);
}
