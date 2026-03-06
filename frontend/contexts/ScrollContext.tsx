/**
 * ScrollContext - Provides scroll state management for hiding/showing UI elements
 */

import React, { createContext, useContext, ReactNode } from "react";
import {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  SharedValue,
} from "react-native-reanimated";

interface ScrollContextType {
  scrollY: SharedValue<number>;
  headerOpacity: SharedValue<number>;
  headerTranslateY: SharedValue<number>;
  tabBarTranslateY: SharedValue<number>;
  isUIVisible: SharedValue<boolean>;
  isTouching: SharedValue<boolean>;
  updateScrollPosition: (scrollY: number) => void;
  resetScrollState: () => void;
  toggleUI: () => void;
  setTouching: (touching: boolean) => void;
}

const ScrollContext = createContext<ScrollContextType | null>(null);

interface ScrollProviderProps {
  children: ReactNode;
  headerHeight?: number;
  tabBarHeight?: number;
}

export const ScrollProvider: React.FC<ScrollProviderProps> = ({
  children,
  headerHeight = 100,
  tabBarHeight = 100, // Increased to fully hide tab bar
}) => {
  const scrollY = useSharedValue(0);
  const headerOpacity = useSharedValue(1);
  const headerTranslateY = useSharedValue(0);
  const tabBarTranslateY = useSharedValue(0);
  const isUIVisible = useSharedValue(true); // Track UI visibility state
  const isTouching = useSharedValue(false); // Track touch state for FAB logic

  const lastScrollY = useSharedValue(0);
  const scrollThreshold = 5; // Minimum scroll distance to trigger animation
  const animationDuration = 250; // Quick and snappy animation

  const updateScrollPosition = (currentScrollY: number) => {
    "worklet";

    const scrollDiff = currentScrollY - lastScrollY.value;
    const isScrollingDown = scrollDiff > scrollThreshold;
    const isScrollingUp = scrollDiff < -scrollThreshold;

    // Hide UI when scrolling in either direction (down or up)
    if ((isScrollingDown || isScrollingUp) && currentScrollY > 50) {
      scrollY.value = currentScrollY;

      // Hide header and tab bar when scrolling
      headerOpacity.value = withTiming(0, { duration: animationDuration });
      headerTranslateY.value = withTiming(-headerHeight, {
        duration: animationDuration,
      });
      tabBarTranslateY.value = withTiming(tabBarHeight + 60, {
        duration: animationDuration,
      });
      isUIVisible.value = false;

      lastScrollY.value = currentScrollY;
    } else if (currentScrollY <= 50) {
      // Always show UI when near top
      scrollY.value = currentScrollY;
      headerOpacity.value = withTiming(1, { duration: animationDuration });
      headerTranslateY.value = withTiming(0, { duration: animationDuration });
      tabBarTranslateY.value = withTiming(0, { duration: animationDuration });
      isUIVisible.value = true;
      lastScrollY.value = currentScrollY;
    }
  };

  const resetScrollState = () => {
    "worklet";
    // Show header/tab bar when switching tabs
    // CRITICAL: Reset BOTH scrollY and lastScrollY to 0
    // This prevents false scroll diff detection when switching between tabs at different scroll positions
    scrollY.value = 0;
    lastScrollY.value = 0;
    headerOpacity.value = withTiming(1, { duration: animationDuration });
    headerTranslateY.value = withTiming(0, { duration: animationDuration });
    tabBarTranslateY.value = withTiming(0, { duration: animationDuration });
    isUIVisible.value = true;
  };

  const toggleUI = () => {
    "worklet";
    // Toggle header and tab bar visibility (for tap-to-toggle functionality)
    const willBeVisible = !isUIVisible.value;

    if (willBeVisible) {
      headerOpacity.value = withTiming(1, { duration: animationDuration });
      headerTranslateY.value = withTiming(0, { duration: animationDuration });
      tabBarTranslateY.value = withTiming(0, { duration: animationDuration });
    } else {
      headerOpacity.value = withTiming(0, { duration: animationDuration });
      headerTranslateY.value = withTiming(-headerHeight, {
        duration: animationDuration,
      });
      tabBarTranslateY.value = withTiming(tabBarHeight + 60, {
        duration: animationDuration,
      });
    }

    isUIVisible.value = willBeVisible;
  };

  const setTouching = (touching: boolean) => {
    "worklet";
    isTouching.value = touching;
  };

  // IMPORTANT: Do NOT store animated styles in context
  // They contain refs that cause serialization warnings
  // Components should create their own animated styles using the SharedValues

  const contextValue: ScrollContextType = {
    scrollY,
    headerOpacity,
    headerTranslateY,
    tabBarTranslateY,
    isUIVisible,
    isTouching,
    updateScrollPosition,
    resetScrollState,
    toggleUI,
    setTouching,
  };

  return (
    <ScrollContext.Provider value={contextValue}>
      {children}
    </ScrollContext.Provider>
  );
};

export const useScrollContext = (): ScrollContextType | null => {
  const context = useContext(ScrollContext);
  return context; // Return null if context is not available instead of throwing
};
