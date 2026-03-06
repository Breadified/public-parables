/**
 * Swipe Gesture Module
 * Handles all swipe gesture calculations and logic
 * Separates gesture business logic from UI components
 */

export interface SwipeConfig {
  screenWidth: number;
  currentTabIndex: number;
  totalTabs: number;
  thresholdPercentage?: number;
  velocityThreshold?: number;
  animationDuration?: number;
}

export interface SwipeResult {
  shouldSwitch: boolean;
  direction: 'left' | 'right' | null;
  targetIndex: number | null;
  animationTarget: number;
  animationDuration: number;
}

/**
 * Calculate if a swipe should trigger tab switch
 */
export const calculateSwipeResult = (
  translateX: number,
  velocity: number,
  config: SwipeConfig
): SwipeResult => {
  const {
    screenWidth,
    currentTabIndex,
    totalTabs,
    thresholdPercentage = 0.2,
    velocityThreshold = 300,
    animationDuration = 200,
  } = config;

  const threshold = screenWidth * thresholdPercentage;

  // Default result for snap-back
  const defaultResult: SwipeResult = {
    shouldSwitch: false,
    direction: null,
    targetIndex: null,
    animationTarget: 0,
    animationDuration: 150,
  };

  // Swipe right - go to previous tab
  if (translateX > threshold || (translateX > 30 && velocity > velocityThreshold)) {
    if (currentTabIndex > 0) {
      return {
        shouldSwitch: true,
        direction: 'right',
        targetIndex: currentTabIndex - 1,
        animationTarget: screenWidth,
        animationDuration,
      };
    }
    return defaultResult;
  }

  // Swipe left - go to next tab
  if (translateX < -threshold || (translateX < -30 && velocity < -velocityThreshold)) {
    if (currentTabIndex < totalTabs - 1) {
      return {
        shouldSwitch: true,
        direction: 'left',
        targetIndex: currentTabIndex + 1,
        animationTarget: -screenWidth,
        animationDuration,
      };
    }
    return defaultResult;
  }

  return defaultResult;
};

/**
 * Calculate resistance for edge swipes
 */
export const calculateResistance = (
  translateX: number,
  currentTabIndex: number,
  totalTabs: number,
  resistanceFactor: number = 0.3
): number => {
  // At first tab, swiping right - apply resistance
  if (currentTabIndex === 0 && translateX > 0) {
    return translateX * resistanceFactor;
  }

  // At last tab, swiping left - apply resistance
  if (currentTabIndex === totalTabs - 1 && translateX < 0) {
    return translateX * resistanceFactor;
  }

  return translateX;
};

/**
 * Calculate which tabs should be rendered based on current position
 */
export const calculateRenderRange = (
  currentIndex: number,
  totalTabs: number,
  renderRadius: number = 2
): number[] => {
  const indices: number[] = [];

  for (let i = Math.max(0, currentIndex - renderRadius);
       i <= Math.min(totalTabs - 1, currentIndex + renderRadius);
       i++) {
    indices.push(i);
  }

  return indices;
};

/**
 * Determine if a tab should be kept in memory
 */
export const shouldKeepTabMounted = (
  tabIndex: number,
  currentIndex: number,
  mountRadius: number = 2
): boolean => {
  return Math.abs(tabIndex - currentIndex) <= mountRadius;
};