/**
 * useHorizontalSwipe Hook
 *
 * Provides native touch-based horizontal swipe detection for components
 * that need to preserve vertical scrolling (like TextInput in FlatList).
 *
 * KEY DIFFERENCE from useSwipeGesture:
 * - Uses React Native's native touch events (onTouchStart/Move/End)
 * - NO animations or Reanimated worklets
 * - Designed for inputs/small components that need swipe detection
 * - Works alongside vertical scroll gestures
 * - Automatically stops propagation for taps (prevents parent tap handlers)
 *
 * Use this when:
 * - You need swipe detection on TextInput or other inputs
 * - Component is inside a scrollable container
 * - You want callbacks only (no animations)
 * - Vertical scrolling must be preserved
 * - You want to prevent tap events from bubbling to parent (e.g., prevent UI toggle on focus)
 *
 * @example
 * ```typescript
 * const { handleTouchStart, handleTouchMove, handleTouchEnd } = useHorizontalSwipe({
 *   onSwipeLeft: () => console.log('Swiped left'),
 *   onSwipeRight: () => console.log('Swiped right'),
 *   onSwipeProgress: (deltaX) => setTranslateX(deltaX),
 *   onSwipeCancel: () => setTranslateX(0),
 *   stopPropagationOnTap: true, // Default - prevents parent tap handlers
 * });
 *
 * <View
 *   onTouchStart={handleTouchStart}
 *   onTouchMove={handleTouchMove}
 *   onTouchEnd={handleTouchEnd}
 * >
 *   <TextInput />
 * </View>
 * ```
 */

import { useRef, useCallback } from 'react';
import { Dimensions } from 'react-native';
import type { GestureResponderEvent } from 'react-native';

const { width: screenWidth } = Dimensions.get('window');

/**
 * Parameters for useHorizontalSwipe hook
 */
export interface UseHorizontalSwipeParams {
  /**
   * Callback when user swipes left (completes the swipe)
   */
  onSwipeLeft?: () => void;

  /**
   * Callback when user swipes right (completes the swipe)
   */
  onSwipeRight?: () => void;

  /**
   * Real-time feedback during horizontal swipe
   * @param deltaX - Horizontal distance from touch start (positive = right, negative = left)
   */
  onSwipeProgress?: (deltaX: number) => void;

  /**
   * Called when horizontal swipe is cancelled (finger lifted without completing swipe)
   */
  onSwipeCancel?: () => void;

  /**
   * Minimum horizontal movement to detect as swipe (default: 20)
   */
  horizontalThreshold?: number;

  /**
   * Distance threshold as percentage of screen width to complete swipe (default: 0.15)
   */
  swipeDistanceThreshold?: number;

  /**
   * Minimum velocity to complete swipe (px/ms, default: 0.5)
   */
  swipeVelocityThreshold?: number;

  /**
   * Minimum quick swipe distance (default: 25)
   */
  quickSwipeMinDistance?: number;

  /**
   * Whether to stop event propagation for taps (prevents parent tap handlers from firing)
   * Useful when component is inside another touch-sensitive component
   * Default: true
   */
  stopPropagationOnTap?: boolean;

  /**
   * Callback when user taps (small movement, quick duration)
   * Provides screen Y coordinate where user tapped
   * @param screenY - Y position relative to screen (from nativeEvent.pageY)
   */
  onTapAtY?: (screenY: number) => void;
}

/**
 * Return type for useHorizontalSwipe hook
 */
export interface UseHorizontalSwipeReturn {
  /**
   * Touch start handler - attach to View's onTouchStart
   */
  handleTouchStart: (e: GestureResponderEvent) => void;

  /**
   * Touch move handler - attach to View's onTouchMove
   */
  handleTouchMove: (e: GestureResponderEvent) => void;

  /**
   * Touch end handler - attach to View's onTouchEnd
   */
  handleTouchEnd: (e: GestureResponderEvent) => void;

  /**
   * Whether currently swiping horizontally
   */
  isSwipingHorizontal: boolean;
}

/**
 * useHorizontalSwipe Hook
 *
 * Detects horizontal swipe gestures using native touch events.
 * Provides real-time feedback and completion callbacks.
 */
export function useHorizontalSwipe({
  onSwipeLeft,
  onSwipeRight,
  onSwipeProgress,
  onSwipeCancel,
  horizontalThreshold = 20,
  swipeDistanceThreshold = 0.15,
  swipeVelocityThreshold = 0.5,
  quickSwipeMinDistance = 25,
  stopPropagationOnTap = true,
  onTapAtY,
}: UseHorizontalSwipeParams = {}): UseHorizontalSwipeReturn {
  // Track touch state
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const touchStartTime = useRef(0);
  const isSwipingHorizontal = useRef(false);

  // Handle touch start - record starting position
  const handleTouchStart = useCallback((e: GestureResponderEvent) => {
    touchStartX.current = e.nativeEvent.pageX;
    touchStartY.current = e.nativeEvent.pageY;
    touchStartTime.current = Date.now();
    isSwipingHorizontal.current = false;

    // Stop propagation if configured to prevent parent touch handlers
    if (stopPropagationOnTap && e.stopPropagation) {
      e.stopPropagation();
    }
  }, [stopPropagationOnTap]);

  // Handle touch move - detect horizontal swipe and provide real-time feedback
  const handleTouchMove = useCallback((e: GestureResponderEvent) => {
    const deltaX = e.nativeEvent.pageX - touchStartX.current;
    const deltaY = e.nativeEvent.pageY - touchStartY.current;

    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    // Detect if this is a horizontal swipe
    if (!isSwipingHorizontal.current && absX > horizontalThreshold && absX > absY) {
      isSwipingHorizontal.current = true;
    }

    // Provide real-time feedback for horizontal swipes
    if (isSwipingHorizontal.current && onSwipeProgress) {
      onSwipeProgress(deltaX);
    }
  }, [horizontalThreshold, onSwipeProgress]);

  // Handle touch end - detect swipe completion
  const handleTouchEnd = useCallback((e: GestureResponderEvent) => {
    const deltaX = e.nativeEvent.pageX - touchStartX.current;
    const deltaY = e.nativeEvent.pageY - touchStartY.current;
    const deltaTime = Date.now() - touchStartTime.current;

    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    let swipeCompleted = false;
    let isTap = false;

    // Only process if gesture was mostly horizontal
    if (absX > absY && absX > 50) {
      const velocity = absX / (deltaTime || 1);
      const threshold = screenWidth * swipeDistanceThreshold;

      // Detect right swipe
      if (deltaX > threshold || (deltaX > quickSwipeMinDistance && velocity > swipeVelocityThreshold)) {
        if (onSwipeRight) {
          onSwipeRight();
          swipeCompleted = true;
        }
      }
      // Detect left swipe
      else if (deltaX < -threshold || (deltaX < -quickSwipeMinDistance && velocity > swipeVelocityThreshold)) {
        if (onSwipeLeft) {
          onSwipeLeft();
          swipeCompleted = true;
        }
      }
    } else if (absX < 10 && absY < 10 && deltaTime < 300) {
      // This is a tap (small movement, quick duration)
      isTap = true;

      // Call onTapAtY with the screen Y coordinate where user tapped
      if (onTapAtY) {
        onTapAtY(touchStartY.current);
      }
    }

    // ✅ CRITICAL: Stop propagation for taps to prevent parent tap handlers
    // This prevents ScrollableTextInput focus taps from triggering parent UI toggles
    if (isTap && stopPropagationOnTap && e.stopPropagation) {
      e.stopPropagation();
    }

    // ✅ CRITICAL: Always call onSwipeCancel if swipe didn't complete
    // This ensures UI resets (e.g., translateX resets to 0) in all cases
    if (!swipeCompleted && isSwipingHorizontal.current && onSwipeCancel) {
      onSwipeCancel();
    }

    // Reset state
    isSwipingHorizontal.current = false;
  }, [
    swipeDistanceThreshold,
    swipeVelocityThreshold,
    quickSwipeMinDistance,
    onSwipeLeft,
    onSwipeRight,
    onSwipeCancel,
    stopPropagationOnTap,
    onTapAtY,
  ]);

  return {
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    isSwipingHorizontal: isSwipingHorizontal.current,
  };
}
