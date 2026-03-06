/**
 * useSwipeGesture Hook
 *
 * Provides reusable swipe gesture logic for horizontal tab/page navigation.
 * Handles:
 * - Pan gesture setup
 * - Velocity calculations
 * - Boundary resistance
 * - Tab switching animations
 * - Reset logic
 *
 * Removes ~150 lines from BibleSwipeableViewer and enables reuse across the app.
 *
 * @example
 * ```typescript
 * const { panGesture, translateX, animatedStyle } = useSwipeGesture({
 *   itemCount: tabs.length,
 *   currentIndex: activeTabIndex,
 *   onSwipe: (newIndex) => setActiveTab(newIndex),
 *   isVerticalScrollActive: isStudyModeActive,
 * });
 * ```
 */

import { useCallback, useEffect, useMemo } from 'react';
import { Dimensions } from 'react-native';
import {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture } from 'react-native-gesture-handler';
import { Easing } from 'react-native-reanimated';

/**
 * Parameters for useSwipeGesture hook
 */
export interface UseSwipeGestureParams {
  /** Total number of items (tabs/pages) */
  itemCount: number;

  /** Current active index */
  currentIndex: number;

  /** Callback when swipe completes */
  onSwipe: (newIndex: number) => void;

  /** Whether vertical scrolling is active (affects gesture thresholds) */
  isVerticalScrollActive?: boolean;

  /** Custom screen width (default: Dimensions.get('window').width) */
  screenWidth?: number;

  /** Custom horizontal threshold for gesture activation (default: 20, or 40 in vertical scroll mode) */
  horizontalThreshold?: number;

  /** Custom vertical fail threshold (default: 40, or 30 in vertical scroll mode) */
  verticalFailThreshold?: number;

  /** Custom boundary resistance factor (0-1, default: 0.3) */
  boundaryResistance?: number;

  /** Custom swipe threshold as percentage of screen width (0-1, default: 0.15) */
  swipeThreshold?: number;

  /** Custom velocity threshold for quick swipes (default: 250) */
  velocityThreshold?: number;

  /** Custom animation duration in ms (default: 200) */
  animationDuration?: number;

  /** Custom easing function (default: Easing.out(Easing.cubic)) */
  easingFunction?: any;

  /** Whether to enable gestures (default: true) */
  enabled?: boolean;
}

/**
 * Return type for useSwipeGesture hook
 */
export interface UseSwipeGestureReturn {
  /** Pan gesture for swiping */
  panGesture: any;

  /** Shared value for translation */
  translateX: any;

  /** Shared value for active index (updated in worklet for instant updates) */
  activeIndexShared: any;

  /** Animated style for container */
  animatedStyle: any;

  /** Reset translation to zero */
  reset: () => void;

  /** Current gesture state (idle, active, animating) */
  gestureState: 'idle' | 'active' | 'animating';
}

/**
 * useSwipeGesture Hook
 *
 * Provides reusable swipe gesture logic for horizontal navigation.
 */
export function useSwipeGesture({
  itemCount,
  currentIndex,
  onSwipe,
  isVerticalScrollActive = false,
  screenWidth: customScreenWidth,
  horizontalThreshold: customHorizontalThreshold,
  verticalFailThreshold: customVerticalFailThreshold,
  boundaryResistance = 0.3,
  swipeThreshold = 0.15,
  velocityThreshold = 250,
  animationDuration = 200,
  easingFunction = Easing.out(Easing.cubic),
  enabled = true,
}: UseSwipeGestureParams): UseSwipeGestureReturn {

  // Get screen dimensions
  const screenWidth = customScreenWidth ?? Dimensions.get('window').width;

  // Animation values
  const translateX = useSharedValue(0);
  const gestureTranslateX = useSharedValue(0);
  const screenWidthShared = useSharedValue(screenWidth);
  const activeIndexShared = useSharedValue(currentIndex);
  const gestureStateShared = useSharedValue<'idle' | 'active' | 'animating'>('idle');

  // Calculate gesture thresholds based on mode
  const horizontalThreshold = customHorizontalThreshold ??
    (isVerticalScrollActive ? 40 : 20);
  const verticalFailThreshold = customVerticalFailThreshold ??
    (isVerticalScrollActive ? 30 : 40);

  // Update shared values when props change
  useEffect(() => {
    screenWidthShared.value = screenWidth;
    activeIndexShared.value = currentIndex;

    // Reset translation when index changes
    gestureTranslateX.value = 0;
    translateX.value = 0;
  }, [screenWidth, currentIndex]);

  /**
   * Reset translation to zero
   */
  const reset = useCallback(() => {
    'worklet';
    translateX.value = withTiming(0, {
      duration: animationDuration,
      easing: easingFunction,
    });
    gestureTranslateX.value = 0;
    gestureStateShared.value = 'idle';
  }, [animationDuration, easingFunction]);

  /**
   * Create pan gesture for swiping
   */
  const panGesture = useMemo(() => {
    if (!enabled) {
      return Gesture.Pan().enabled(false);
    }

    return Gesture.Pan()
      .activeOffsetX([-horizontalThreshold, horizontalThreshold])
      .failOffsetY([-verticalFailThreshold, verticalFailThreshold])
      .onStart(() => {
        'worklet';
        gestureTranslateX.value = translateX.value;
        gestureStateShared.value = 'active';
      })
      .onUpdate((event) => {
        'worklet';
        // Calculate the translation with bounds
        let newTranslateX = gestureTranslateX.value + event.translationX;

        // Apply resistance at boundaries
        const maxTranslate = screenWidthShared.value;
        if (currentIndex === 0 && newTranslateX > 0) {
          // At first item, swiping right - apply resistance
          newTranslateX = newTranslateX * boundaryResistance;
        } else if (currentIndex === itemCount - 1 && newTranslateX < 0) {
          // At last item, swiping left - apply resistance
          newTranslateX = newTranslateX * boundaryResistance;
        }

        // Limit the translation
        translateX.value = Math.max(
          -maxTranslate,
          Math.min(maxTranslate, newTranslateX)
        );
      })
      .onEnd((event) => {
        'worklet';
        gestureStateShared.value = 'animating';

        const threshold = screenWidthShared.value * swipeThreshold;
        const velocity = event.velocityX;
        const screenW = screenWidthShared.value;

        // Determine if we should switch items based on position and velocity
        if (
          translateX.value > threshold ||
          (translateX.value > 25 && velocity > velocityThreshold)
        ) {
          // Swipe right - go to previous item
          if (currentIndex > 0) {
            // Continue the swipe animation to fully reveal the previous item
            translateX.value = withTiming(
              screenW,
              {
                duration: animationDuration,
                easing: easingFunction,
              },
              (finished) => {
                if (finished) {
                  // Update active index in worklet
                  activeIndexShared.value = currentIndex - 1;
                  // Switch item in JS
                  runOnJS(onSwipe)(currentIndex - 1);
                  // Reset translateX
                  translateX.value = 0;
                  gestureStateShared.value = 'idle';
                }
              }
            );
          } else {
            // At boundary - snap back quickly
            translateX.value = withTiming(0, {
              duration: 150,
              easing: easingFunction,
            });
            gestureStateShared.value = 'idle';
          }
        } else if (
          translateX.value < -threshold ||
          (translateX.value < -30 && velocity < -velocityThreshold)
        ) {
          // Swipe left - go to next item
          if (currentIndex < itemCount - 1) {
            // Continue the swipe animation to fully reveal the next item
            translateX.value = withTiming(
              -screenW,
              {
                duration: animationDuration,
                easing: easingFunction,
              },
              (finished) => {
                if (finished) {
                  // Update active index in worklet
                  activeIndexShared.value = currentIndex + 1;
                  // Switch item in JS
                  runOnJS(onSwipe)(currentIndex + 1);
                  // Reset translateX
                  translateX.value = 0;
                  gestureStateShared.value = 'idle';
                }
              }
            );
          } else {
            // At boundary - snap back quickly
            translateX.value = withTiming(0, {
              duration: 150,
              easing: easingFunction,
            });
            gestureStateShared.value = 'idle';
          }
        } else {
          // Did not reach threshold - snap back
          translateX.value = withTiming(0, {
            duration: 150,
            easing: easingFunction,
          });
          gestureStateShared.value = 'idle';
        }
      });
  }, [
    enabled,
    horizontalThreshold,
    verticalFailThreshold,
    boundaryResistance,
    swipeThreshold,
    velocityThreshold,
    animationDuration,
    easingFunction,
    currentIndex,
    itemCount,
    onSwipe,
  ]);

  /**
   * Animated style for container
   */
  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: translateX.value }],
    };
  });

  return {
    panGesture,
    translateX,
    activeIndexShared,
    animatedStyle,
    reset,
    gestureState: 'idle', // Note: This is a simplified return, actual state is in shared value
  };
}
