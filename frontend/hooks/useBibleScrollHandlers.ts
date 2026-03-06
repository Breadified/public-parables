/**
 * useBibleScrollHandlers - Unified scroll handling for all Bible viewers
 *
 * SIMPLE RULE: UI hides ONLY on manual scroll, shows on tap or tab activation
 *
 * This hook provides all the handlers needed for Bible viewers to:
 * 1. Track manual vs programmatic scrolls (via isTouching state)
 * 2. Hide UI only when user manually scrolls
 * 3. Show UI on tab activation
 * 4. Toggle UI on tap
 *
 * Note: Verse selection is handled natively by SelectableTextView which provides
 * native text selection (blue highlight + drag handles) and custom context menu.
 *
 * Used by: SinglePaneBibleView, VerseAlignedSplitView, and any future viewers
 */

import { useCallback, useRef, useEffect, useMemo } from 'react';
import { useScrollContext } from '../contexts/ScrollContext';

interface BibleScrollHandlers {
  handleTouchStart: (event: any) => void;
  handleTouchEnd: (event: any) => void;
  handleTouchCancel: () => void;
  handleScrollBeginDrag: () => void;
  handleScrollEndDrag: () => void;
  handleScroll: (event: any) => void;
  touchStartRef: React.MutableRefObject<{ x: number; y: number; time: number } | null>;
}

/**
 * Custom hook for Bible scroll handling with UI toggle behavior
 *
 * @param isActive - Whether this viewer is the active tab
 * @param externalOnScroll - Optional external scroll handler
 * @returns Object containing all scroll event handlers
 */
export function useBibleScrollHandlers(
  isActive: boolean,
  externalOnScroll?: (event: any) => void
): BibleScrollHandlers {
  const scrollContext = useScrollContext();
  const wasActiveRef = useRef(isActive);
  const hasInitialized = useRef(false);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

  // ✅ PERFORMANCE FIX: Store context in ref to avoid dependency array recreation
  // Context objects are created fresh each render - using ref prevents callback recreation
  const scrollContextRef = useRef(scrollContext);
  scrollContextRef.current = scrollContext;

  /**
   * Effect to show UI when tab becomes active or on initial load
   * SIMPLE RULE: Always show UI on tab activation
   */
  useEffect(() => {
    // Check if tab just became active OR initial mount
    if (isActive && (!wasActiveRef.current || !hasInitialized.current)) {
      // Show UI when tab becomes active
      if (scrollContextRef.current?.resetScrollState) {
        scrollContextRef.current.resetScrollState();
      }

      hasInitialized.current = true;
    }
    wasActiveRef.current = isActive;
  }, [isActive]); // ✅ PERFORMANCE FIX: Removed scrollContext - accessed via ref

  /**
   * Handle touch start - Mark as touching
   */
  const handleTouchStart = useCallback((event: any) => {
    const touch = event.nativeEvent.touches[0];
    touchStartRef.current = {
      x: touch.pageX,
      y: touch.pageY,
      time: Date.now(),
    };

    // Mark as touching - this prevents programmatic scrolls from hiding UI
    if (scrollContextRef.current?.setTouching) {
      scrollContextRef.current.setTouching(true);
    }
  }, []); // ✅ PERFORMANCE FIX: Removed scrollContext - accessed via ref

  /**
   * Handle touch end - Detect taps and toggle UI if needed
   */
  const handleTouchEnd = useCallback((event: any) => {
    // Clear touching state
    if (scrollContextRef.current?.setTouching) {
      scrollContextRef.current.setTouching(false);
    }

    if (!touchStartRef.current || !scrollContextRef.current) {
      touchStartRef.current = null;
      return;
    }

    const touch = event.nativeEvent.changedTouches[0];
    const touchEnd = {
      x: touch.pageX,
      y: touch.pageY,
      time: Date.now(),
    };

    const deltaX = Math.abs(touchEnd.x - touchStartRef.current.x);
    const deltaY = Math.abs(touchEnd.y - touchStartRef.current.y);
    const duration = touchEnd.time - touchStartRef.current.time;

    // Detect tap: small movement and quick duration
    const isTap = deltaX < 10 && deltaY < 10 && duration < 300;

    if (isTap) {
      scrollContextRef.current.toggleUI();
    }

    touchStartRef.current = null;
  }, []); // ✅ PERFORMANCE FIX: Removed scrollContext - accessed via ref

  /**
   * Handle touch cancel - Clear touching state
   */
  const handleTouchCancel = useCallback(() => {
    if (scrollContextRef.current?.setTouching) {
      scrollContextRef.current.setTouching(false);
    }
    touchStartRef.current = null;
  }, []); // ✅ PERFORMANCE FIX: Removed scrollContext - accessed via ref

  /**
   * Handle scroll begin drag - User started manual scroll
   */
  const handleScrollBeginDrag = useCallback(() => {
    // User started manual scroll - ensure touching is true
    if (scrollContextRef.current?.setTouching) {
      scrollContextRef.current.setTouching(true);
    }
  }, []); // ✅ PERFORMANCE FIX: Removed scrollContext - accessed via ref

  /**
   * Handle scroll end drag - User finished manual scroll
   */
  const handleScrollEndDrag = useCallback(() => {
    // User finished manual scroll - clear touching
    if (scrollContextRef.current?.setTouching) {
      scrollContextRef.current.setTouching(false);
    }
  }, []); // ✅ PERFORMANCE FIX: Removed scrollContext - accessed via ref

  /**
   * Handle scroll events
   * SIMPLE RULE: Only update scroll context when user is touching the screen
   * This automatically filters out all programmatic scrolls (navigation, tab switching, initial load)
   */
  const handleScroll = useCallback(
    (event: any) => {
      // SIMPLE RULE: Only update UI when user is manually scrolling
      const ctx = scrollContextRef.current;
      if (ctx && ctx.isTouching.value) {
        ctx.updateScrollPosition(event.nativeEvent.contentOffset.y);
      }

      // Call external scroll handler for synchronization
      if (externalOnScroll) {
        externalOnScroll(event);
      }
    },
    [externalOnScroll] // ✅ PERFORMANCE FIX: Removed scrollContext - accessed via ref
  );

  // PERF FIX: Memoize return object to prevent recreation on every render
  return useMemo(() => ({
    handleTouchStart,
    handleTouchEnd,
    handleTouchCancel,
    handleScrollBeginDrag,
    handleScrollEndDrag,
    handleScroll,
    touchStartRef,
  }), [
    handleTouchStart,
    handleTouchEnd,
    handleTouchCancel,
    handleScrollBeginDrag,
    handleScrollEndDrag,
    handleScroll,
  ]);
}
