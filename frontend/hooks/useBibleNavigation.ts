/**
 * useBibleNavigation Hook
 *
 * Unified navigation hook for all Bible views.
 * Solves the "wrong chapter" bug by waiting for height measurements BEFORE scrolling.
 *
 * The Problem:
 * - FlashList's scrollToIndex uses estimated heights (e.g., 800px per chapter)
 * - Native text measurement returns real heights (e.g., 8000px for long chapters)
 * - Scrolling with estimated heights lands in the wrong position
 *
 * The Solution:
 * - Wait for heightCache.isStabilized BEFORE scrolling
 * - Scroll once with accurate heights
 * - Verify position via onViewableItemsChanged
 *
 * Callback Chain (no arbitrary timeouts):
 * Items load → FlashList renders → Native measures → Heights stabilize →
 * scrollToIndex (accurate) → onViewableItemsChanged → Target verified → Overlay hides
 */

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import type { UseHeightCacheResult } from './useHeightCache';

/**
 * Chapter information extracted from viewable item
 */
export interface ChapterInfo {
  chapterId: number;
  bookName: string;
  chapterNumber: number;
}

/**
 * Options for useBibleNavigation hook
 */
export interface UseBibleNavigationOptions {
  /** Target chapter ID to navigate to */
  targetChapterId: number;

  /** Loaded items array (from useSimplifiedBibleLoader) */
  items: { chapterId: number; key: string }[];

  /** Ref to FlashList for scrollToIndex */
  flashListRef: React.RefObject<any>;

  /** Height cache for accurate scroll positioning (optional - for chapter-level views) */
  heightCache?: UseHeightCacheResult;

  /** Extract chapter info from item (for viewability tracking) */
  extractChapterInfo: (item: any) => ChapterInfo | null;

  /** Called when navigation is complete (target verified visible) */
  onNavigationComplete?: () => void;

  /** Called when chapter changes during manual scrolling */
  onChapterChange?: (chapterId: number, bookName: string, chapterNumber: number) => void;

  /** Whether this view is active */
  isActive?: boolean;

  /** Minimum measurements before considering heights stable (for views without useHeightCache) */
  minItemsForStability?: number;

  /** Debounce delay for chapter changes in ms (default: 300) */
  debounceDelay?: number;

  /** Whether to log debug information */
  verbose?: boolean;
}

/**
 * Result from useBibleNavigation hook
 */
export interface UseBibleNavigationResult {
  /** Whether navigation is complete (safe to hide overlay) */
  isNavigationComplete: boolean;

  /** Pass to FlashList's onViewableItemsChanged */
  onViewableItemsChanged: (info: any) => void;

  /** Pass to FlashList's viewabilityConfig */
  viewabilityConfig: { viewAreaCoveragePercentThreshold: number; minimumViewTime: number };

  /** Current visible chapter ID */
  currentChapterId: number | null;

  /** Reset navigation state (call when target changes) */
  reset: () => void;

  /** Force navigation complete (fallback for edge cases) */
  forceNavigationComplete: () => void;
}

/**
 * Unified navigation hook for all Bible views
 *
 * Key fix: Wait for heights to stabilize BEFORE scrolling, not after.
 * This ensures scrollToIndex uses accurate heights for positioning.
 */
export function useBibleNavigation({
  targetChapterId,
  items,
  flashListRef,
  heightCache,
  extractChapterInfo,
  onNavigationComplete,
  onChapterChange,
  isActive = true,
  minItemsForStability = 3,
  debounceDelay = 300,
  verbose = false,
}: UseBibleNavigationOptions): UseBibleNavigationResult {
  // Navigation state
  const [isNavigationComplete, setIsNavigationComplete] = useState(false);
  const [currentChapterId, setCurrentChapterId] = useState<number | null>(null);

  // Refs for tracking navigation progress
  const hasScrolledRef = useRef(false);
  const targetVerifiedRef = useRef(false);
  const lastReportedChapterRef = useRef<number | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef(0); // Track scroll retry attempts

  // Freeze target on mount to prevent ricocheting
  const frozenTargetRef = useRef(targetChapterId);

  // ✅ FIX: Update frozen target when prop changes significantly (tab reuse scenario)
  // This handles the case where the component is reused for a different chapter
  useEffect(() => {
    if (targetChapterId !== frozenTargetRef.current) {
      console.log('[useBibleNavigation] 🔄 Target changed from', frozenTargetRef.current, 'to', targetChapterId, '- resetting navigation state');
      frozenTargetRef.current = targetChapterId;
      hasScrolledRef.current = false;
      targetVerifiedRef.current = false;
      lastReportedChapterRef.current = null;
      retryCountRef.current = 0; // Reset retry count
      setIsNavigationComplete(false);
      setCurrentChapterId(null);
      setHasRealMeasurement(!heightCache); // Reset measurement state
    }
  }, [targetChapterId, heightCache]);

  // Check for real measurements using polling because:
  // 1. heightCache.getHeight() reads from a ref (doesn't trigger re-renders)
  // 2. cacheVersion stops updating after isStabilized (SCROLL JUMP FIX)
  // So we poll until we detect a real native measurement
  const [hasRealMeasurement, setHasRealMeasurement] = useState(!heightCache); // true if no cache

  useEffect(() => {
    if (!heightCache || hasRealMeasurement) return;

    const MIN_REAL_HEIGHT = 500;

    const checkForRealMeasurements = () => {
      for (const item of items) {
        const height = heightCache.getHeight(item.key);
        if (height !== undefined && height > MIN_REAL_HEIGHT) {
          console.log('[useBibleNavigation] Real measurement detected:', item.key, height);
          setHasRealMeasurement(true);
          return true;
        }
      }
      return false;
    };

    // Check immediately
    if (checkForRealMeasurements()) return;

    // Poll every 50ms until we find real measurements (max 2 seconds)
    let attempts = 0;
    const maxAttempts = 40; // 40 * 50ms = 2 seconds
    const interval = setInterval(() => {
      attempts++;
      if (checkForRealMeasurements() || attempts >= maxAttempts) {
        clearInterval(interval);
        if (attempts >= maxAttempts) {
          console.log('[useBibleNavigation] ⚠️ Timeout waiting for real measurements, proceeding anyway');
          setHasRealMeasurement(true); // Proceed anyway after timeout
        }
      }
    }, 50);

    return () => clearInterval(interval);
  }, [heightCache, items, hasRealMeasurement]);

  const isHeightsStable = heightCache
    ? heightCache.isStabilized && hasRealMeasurement
    : items.length >= minItemsForStability;

  // STEP 1: Wait for heights to stabilize, THEN scroll
  // This is the key fix - don't scroll until heights are accurate
  useEffect(() => {
    // Guard: Need items loaded
    if (items.length === 0) return;

    // Guard: Wait for heights to stabilize (includes real native measurement check)
    if (!isHeightsStable) {
      return;
    }

    // Guard: Only scroll once
    if (hasScrolledRef.current) return;

    // Find target in items
    const targetIndex = items.findIndex(item => item.chapterId === frozenTargetRef.current);
    if (targetIndex < 0) {
      if (verbose) {
        console.log('[useBibleNavigation] Target not found in items:', frozenTargetRef.current);
      }
      return;
    }

    // NOW we can scroll with accurate heights
    console.log('[useBibleNavigation] Heights stabilized (real measurements received), scrolling to:', frozenTargetRef.current, 'at index:', targetIndex);

    hasScrolledRef.current = true;

    // FIX: When scrolling to index 0, FlashList doesn't fire onViewableItemsChanged
    // because the item is already in view. Immediately verify in this case.
    if (targetIndex === 0) {
      console.log('[useBibleNavigation] ✅ Target at index 0, verifying immediately (already visible)');
      targetVerifiedRef.current = true;
      setIsNavigationComplete(true);
      onNavigationComplete?.();
      return;
    }

    flashListRef.current?.scrollToIndex({
      index: targetIndex,
      animated: false,
      viewPosition: 0,
    });
  }, [items, isHeightsStable, flashListRef, onNavigationComplete, verbose]);

  // STEP 2: Viewability callback verifies position and tracks chapter changes
  const onViewableItemsChanged = useCallback(({ viewableItems }: any) => {
    if (viewableItems.length === 0) return;

    // Target verification - runs BEFORE chapter tracking
    if (!targetVerifiedRef.current && hasScrolledRef.current) {
      const targetVisible = viewableItems.some((item: any) => {
        const info = extractChapterInfo(item.item);
        return info?.chapterId === frozenTargetRef.current;
      });

      if (targetVisible) {
        console.log('[useBibleNavigation] ✅ Target verified visible:', frozenTargetRef.current);
        targetVerifiedRef.current = true;
        setIsNavigationComplete(true);
        onNavigationComplete?.();
      } else if (verbose) {
        const viewableChapterIds = viewableItems.map((item: any) => {
          const info = extractChapterInfo(item.item);
          return info?.chapterId;
        });
        console.log('[useBibleNavigation] Target not visible yet. Viewable:', viewableChapterIds);
      }
    }

    // Chapter tracking - only after navigation complete and for active views
    if (targetVerifiedRef.current && onChapterChange && isActive) {
      const firstItem = viewableItems[0]?.item;
      const info = extractChapterInfo(firstItem);

      if (info && info.chapterId !== lastReportedChapterRef.current) {
        setCurrentChapterId(info.chapterId);

        // Debounce chapter change reports
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }

        debounceTimerRef.current = setTimeout(() => {
          if (info.chapterId !== lastReportedChapterRef.current) {
            lastReportedChapterRef.current = info.chapterId;
            onChapterChange(info.chapterId, info.bookName, info.chapterNumber);
          }
        }, debounceDelay);
      }
    }
  }, [extractChapterInfo, onNavigationComplete, onChapterChange, isActive, debounceDelay, verbose]);

  // Viewability config - low minimumViewTime for fast initial verification
  const viewabilityConfig = useMemo(() => ({
    viewAreaCoveragePercentThreshold: 50,
    minimumViewTime: 100, // Low for fast initial verification
  }), []);

  // Reset function - call when component remounts or target changes
  const reset = useCallback(() => {
    hasScrolledRef.current = false;
    targetVerifiedRef.current = false;
    lastReportedChapterRef.current = null;
    retryCountRef.current = 0;
    setIsNavigationComplete(false);
    setCurrentChapterId(null);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  }, []);

  // Force navigation complete - fallback for edge cases
  const forceNavigationComplete = useCallback(() => {
    if (!targetVerifiedRef.current) {
      console.log('[useBibleNavigation] ⚠️ Force navigation complete');
      targetVerifiedRef.current = true;
      setIsNavigationComplete(true);
      onNavigationComplete?.();
    }
  }, [onNavigationComplete]);

  const MAX_RETRIES = 3;

  // Fallback: If viewability callback doesn't fire after scroll, RETRY the scroll
  // This handles FlashList's inaccurate estimated heights - retrying after layout updates
  useEffect(() => {
    // Only run if we've scrolled but haven't verified
    if (!hasScrolledRef.current || targetVerifiedRef.current) return;
    // Skip if no items
    if (items.length === 0) return;

    // Check if target exists in data
    const targetExists = items.some(item => item.chapterId === frozenTargetRef.current);
    if (!targetExists) return;

    const fallbackTimer = setTimeout(() => {
      if (!targetVerifiedRef.current) {
        if (retryCountRef.current < MAX_RETRIES) {
          // RETRY: FlashList likely had wrong estimated heights, try again
          retryCountRef.current++;
          console.log(`[useBibleNavigation] 🔄 Retry ${retryCountRef.current}/${MAX_RETRIES}: target not visible, re-scrolling...`);

          const targetIndex = items.findIndex(item => item.chapterId === frozenTargetRef.current);
          if (targetIndex >= 0 && flashListRef.current) {
            // Re-scroll - by now FlashList should have better layout data
            flashListRef.current.scrollToIndex({
              index: targetIndex,
              animated: false,
              viewPosition: 0,
            });
          }
        } else {
          console.log('[useBibleNavigation] ⚠️ Max retries reached, forcing navigation complete');
          forceNavigationComplete();
        }
      }
    }, 500); // 500ms between attempts

    return () => clearTimeout(fallbackTimer);
  }, [items, forceNavigationComplete, flashListRef]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return {
    isNavigationComplete,
    onViewableItemsChanged,
    viewabilityConfig,
    currentChapterId,
    reset,
    forceNavigationComplete,
  };
}
