/**
 * useReadingUIToggle - Auto-hide UI on scroll for reading screens (Plan, Devotion)
 *
 * Similar to ScrollContext but self-contained with configurable heights.
 * Provides the same behavior: scroll hides UI, tap toggles UI, near-top shows UI.
 *
 * Usage:
 * const { headerAnimatedStyle, bottomAnimatedStyle, scrollViewProps } = useReadingUIToggle({
 *   headerHeight: 120,
 *   bottomHeight: 96,
 * });
 *
 * To also hide the tab bar, pass tabBarTranslateY from ScrollContext:
 * const scrollContext = useScrollContext();
 * const { ... } = useReadingUIToggle({
 *   ...options,
 *   tabBarTranslateY: scrollContext?.tabBarTranslateY,
 *   tabBarHideDistance: 100,
 * });
 */

import { useRef, useCallback, useMemo } from "react";
import {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  SharedValue,
} from "react-native-reanimated";
import type { NativeSyntheticEvent, NativeScrollEvent } from "react-native";

interface UseReadingUIToggleOptions {
  /** Total height of header elements to hide (header + day nav) */
  headerHeight: number;
  /** Total height of bottom elements to hide (collapsed preview + FAB area) */
  bottomHeight: number;
  /** Animation duration in ms (default: 250) */
  animationDuration?: number;
  /** Scroll threshold to trigger hide (default: 5) */
  scrollThreshold?: number;
  /** Y position below which UI always shows (default: 50) */
  alwaysShowThreshold?: number;
  /** Optional: SharedValue from ScrollContext to also animate tab bar */
  tabBarTranslateY?: SharedValue<number>;
  /** Distance to translate tab bar when hiding (default: 100) */
  tabBarHideDistance?: number;
}

interface UseReadingUIToggleResult {
  /** Animated style for header elements (translateY) */
  headerAnimatedStyle: { transform: { translateY: number }[] };
  /** Animated style for bottom elements (translateY) */
  bottomAnimatedStyle: { transform: { translateY: number }[] };
  /** Whether UI is currently visible */
  isUIVisible: { value: boolean };
  /** Props to spread on ScrollView */
  scrollViewProps: {
    onTouchStart: (event: any) => void;
    onTouchEnd: (event: any) => void;
    onTouchCancel: () => void;
    onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
    onScrollBeginDrag: () => void;
    onScrollEndDrag: () => void;
    scrollEventThrottle: number;
  };
  /** Manually show UI */
  showUI: () => void;
  /** Manually hide UI */
  hideUI: () => void;
  /** Toggle UI visibility */
  toggleUI: () => void;
}

export function useReadingUIToggle({
  headerHeight,
  bottomHeight,
  animationDuration = 250,
  scrollThreshold = 5,
  alwaysShowThreshold = 50,
  tabBarTranslateY,
  tabBarHideDistance = 100,
}: UseReadingUIToggleOptions): UseReadingUIToggleResult {
  // Animation shared values
  const headerTranslateY = useSharedValue(0);
  const bottomTranslateY = useSharedValue(0);
  const isUIVisible = useSharedValue(true);
  const isTouching = useSharedValue(false);
  const lastScrollY = useSharedValue(0);

  // Touch tracking ref
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

  // Show UI
  const showUI = useCallback(() => {
    "worklet";
    headerTranslateY.value = withTiming(0, { duration: animationDuration });
    bottomTranslateY.value = withTiming(0, { duration: animationDuration });
    // Also show tab bar if we have reference to it
    if (tabBarTranslateY) {
      tabBarTranslateY.value = withTiming(0, { duration: animationDuration });
    }
    isUIVisible.value = true;
  }, [headerTranslateY, bottomTranslateY, isUIVisible, animationDuration, tabBarTranslateY]);

  // Hide UI
  const hideUI = useCallback(() => {
    "worklet";
    headerTranslateY.value = withTiming(-headerHeight, { duration: animationDuration });
    bottomTranslateY.value = withTiming(bottomHeight, { duration: animationDuration });
    // Also hide tab bar if we have reference to it
    if (tabBarTranslateY) {
      tabBarTranslateY.value = withTiming(tabBarHideDistance, { duration: animationDuration });
    }
    isUIVisible.value = false;
  }, [headerTranslateY, bottomTranslateY, isUIVisible, headerHeight, bottomHeight, animationDuration, tabBarTranslateY, tabBarHideDistance]);

  // Toggle UI
  const toggleUI = useCallback(() => {
    "worklet";
    if (isUIVisible.value) {
      headerTranslateY.value = withTiming(-headerHeight, { duration: animationDuration });
      bottomTranslateY.value = withTiming(bottomHeight, { duration: animationDuration });
      // Also hide tab bar if we have reference to it
      if (tabBarTranslateY) {
        tabBarTranslateY.value = withTiming(tabBarHideDistance, { duration: animationDuration });
      }
      isUIVisible.value = false;
    } else {
      headerTranslateY.value = withTiming(0, { duration: animationDuration });
      bottomTranslateY.value = withTiming(0, { duration: animationDuration });
      // Also show tab bar if we have reference to it
      if (tabBarTranslateY) {
        tabBarTranslateY.value = withTiming(0, { duration: animationDuration });
      }
      isUIVisible.value = true;
    }
  }, [headerTranslateY, bottomTranslateY, isUIVisible, headerHeight, bottomHeight, animationDuration, tabBarTranslateY, tabBarHideDistance]);

  // Handle touch start
  const handleTouchStart = useCallback((event: any) => {
    const touch = event.nativeEvent.touches[0];
    touchStartRef.current = {
      x: touch.pageX,
      y: touch.pageY,
      time: Date.now(),
    };
    isTouching.value = true;
  }, [isTouching]);

  // Handle touch end - detect taps
  const handleTouchEnd = useCallback((event: any) => {
    isTouching.value = false;

    if (!touchStartRef.current) {
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
      toggleUI();
    }

    touchStartRef.current = null;
  }, [isTouching, toggleUI]);

  // Handle touch cancel
  const handleTouchCancel = useCallback(() => {
    isTouching.value = false;
    touchStartRef.current = null;
  }, [isTouching]);

  // Handle scroll begin drag
  const handleScrollBeginDrag = useCallback(() => {
    isTouching.value = true;
  }, [isTouching]);

  // Handle scroll end drag
  const handleScrollEndDrag = useCallback(() => {
    isTouching.value = false;
  }, [isTouching]);

  // Handle scroll
  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, layoutMeasurement, contentSize } = event.nativeEvent;
    const currentScrollY = contentOffset.y;

    // Check if at top or bottom of content - always show UI at edges (even during momentum scroll)
    const isNearTop = currentScrollY <= alwaysShowThreshold;
    const isNearBottom = currentScrollY + layoutMeasurement.height >= contentSize.height - alwaysShowThreshold;

    // Show UI when at either end of content
    if (isNearTop || isNearBottom) {
      showUI();
      lastScrollY.value = currentScrollY;
      return;
    }

    // Only hide UI when user is actively scrolling (not momentum)
    if (!isTouching.value) {
      lastScrollY.value = currentScrollY;
      return;
    }

    const scrollDiff = currentScrollY - lastScrollY.value;
    const isScrollingDown = scrollDiff > scrollThreshold;
    const isScrollingUp = scrollDiff < -scrollThreshold;

    // Hide UI when scrolling in either direction (if not near edges)
    if (isScrollingDown || isScrollingUp) {
      hideUI();
      lastScrollY.value = currentScrollY;
    }
  }, [isTouching, lastScrollY, scrollThreshold, alwaysShowThreshold, hideUI, showUI]);

  // Animated styles
  const headerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: headerTranslateY.value }],
  }));

  const bottomAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: bottomTranslateY.value }],
  }));

  // ScrollView props to spread
  const scrollViewProps = useMemo(() => ({
    onTouchStart: handleTouchStart,
    onTouchEnd: handleTouchEnd,
    onTouchCancel: handleTouchCancel,
    onScroll: handleScroll,
    onScrollBeginDrag: handleScrollBeginDrag,
    onScrollEndDrag: handleScrollEndDrag,
    scrollEventThrottle: 16,
  }), [
    handleTouchStart,
    handleTouchEnd,
    handleTouchCancel,
    handleScroll,
    handleScrollBeginDrag,
    handleScrollEndDrag,
  ]);

  return {
    headerAnimatedStyle,
    bottomAnimatedStyle,
    isUIVisible,
    scrollViewProps,
    showUI,
    hideUI,
    toggleUI,
  };
}
