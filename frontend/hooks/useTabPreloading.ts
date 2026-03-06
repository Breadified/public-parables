/**
 * useTabPreloading Hook
 *
 * Provides tab pre-rendering logic for swipeable tab containers.
 * Handles:
 * - Calculating which tabs to pre-render
 * - Radius-based rendering (current ± N)
 * - Tab positioning
 * - Memory management
 *
 * Removes ~30 lines from BibleSwipeableViewer and enables reuse across the app.
 *
 * @example
 * ```typescript
 * const { tabsToRender, isTabVisible } = useTabPreloading({
 *   tabs: allTabs,
 *   activeIndex: currentTabIndex,
 *   renderRadius: 2,
 * });
 *
 * {tabsToRender.map(({ tab, index, shouldRender }) =>
 *   shouldRender ? <TabContent key={index} tab={tab} /> : null
 * )}
 * ```
 */

import { useMemo } from 'react';

/**
 * Tab rendering info
 */
export interface TabRenderInfo<T = any> {
  /** The tab data */
  tab: T;

  /** Index in the tabs array */
  index: number;

  /** Absolute position for layout calculations */
  absolutePosition: number;

  /** Whether this tab should be rendered */
  shouldRender: boolean;

  /** Relative position to active tab (-2, -1, 0, 1, 2, etc.) */
  relativePosition: number;

  /** Whether this is the active tab */
  isActive: boolean;
}

/**
 * Parameters for useTabPreloading hook
 */
export interface UseTabPreloadingParams<T = any> {
  /** Array of all tabs */
  tabs: T[];

  /** Current active tab index */
  activeIndex: number;

  /** How many tabs to render on each side of active tab (default: 2) */
  renderRadius?: number;

  /** Whether to enable preloading (default: true) */
  enabled?: boolean;

  /** Custom function to determine if a tab should render based on distance */
  customRenderCheck?: (distance: number, renderRadius: number) => boolean;
}

/**
 * Return type for useTabPreloading hook
 */
export interface UseTabPreloadingReturn<T = any> {
  /** Array of tabs to render with rendering info */
  tabsToRender: TabRenderInfo<T>[];

  /** Check if a specific tab index is visible */
  isTabVisible: (index: number) => boolean;

  /** Get rendering info for a specific tab index */
  getTabInfo: (index: number) => TabRenderInfo<T> | null;

  /** Total number of tabs */
  totalTabs: number;

  /** Number of tabs currently being rendered */
  renderedCount: number;

  /** Indices of all rendered tabs */
  renderedIndices: number[];
}

/**
 * Default render check function
 */
const defaultRenderCheck = (distance: number, renderRadius: number): boolean => {
  return Math.abs(distance) <= renderRadius;
};

/**
 * useTabPreloading Hook
 *
 * Provides tab pre-rendering logic for swipeable tab containers.
 */
export function useTabPreloading<T = any>({
  tabs,
  activeIndex,
  renderRadius = 2,
  enabled = true,
  customRenderCheck = defaultRenderCheck,
}: UseTabPreloadingParams<T>): UseTabPreloadingReturn<T> {

  /**
   * Calculate which tabs to render
   */
  const tabsToRender = useMemo<TabRenderInfo<T>[]>(() => {
    if (!enabled || tabs.length === 0) {
      // If disabled, only render active tab
      if (tabs.length === 0) return [];

      return [{
        tab: tabs[activeIndex],
        index: activeIndex,
        absolutePosition: activeIndex,
        shouldRender: true,
        relativePosition: 0,
        isActive: true,
      }];
    }

    const result: TabRenderInfo<T>[] = [];

    // Build array of tabs to render
    for (let i = 0; i < tabs.length; i++) {
      const relativePosition = i - activeIndex;
      const distance = Math.abs(relativePosition);
      const shouldRender = customRenderCheck(distance, renderRadius);

      result.push({
        tab: tabs[i],
        index: i,
        // Use ABSOLUTE index for positioning, not relative position
        // This ensures tabs don't jump when activeIndex changes
        absolutePosition: i,
        shouldRender,
        relativePosition,
        isActive: i === activeIndex,
      });
    }

    return result;
  }, [tabs, activeIndex, renderRadius, enabled, customRenderCheck]);

  /**
   * Get indices of all rendered tabs
   */
  const renderedIndices = useMemo(
    () => tabsToRender.filter((t) => t.shouldRender).map((t) => t.index),
    [tabsToRender]
  );

  /**
   * Check if a specific tab index is visible
   */
  const isTabVisible = useMemo(
    () => (index: number): boolean => {
      if (!enabled) return index === activeIndex;

      const distance = Math.abs(index - activeIndex);
      return customRenderCheck(distance, renderRadius);
    },
    [enabled, activeIndex, renderRadius, customRenderCheck]
  );

  /**
   * Get rendering info for a specific tab index
   */
  const getTabInfo = useMemo(
    () => (index: number): TabRenderInfo<T> | null => {
      return tabsToRender[index] ?? null;
    },
    [tabsToRender]
  );

  return {
    tabsToRender,
    isTabVisible,
    getTabInfo,
    totalTabs: tabs.length,
    renderedCount: renderedIndices.length,
    renderedIndices,
  };
}

/**
 * Preset configurations for common use cases
 */
export const TabPreloadingPresets = {
  /**
   * Conservative preloading (current + 1 on each side)
   * Good for heavy tabs or low-memory devices
   */
  conservative: {
    renderRadius: 1,
  },

  /**
   * Balanced preloading (current + 2 on each side)
   * Good default for most use cases
   */
  balanced: {
    renderRadius: 2,
  },

  /**
   * Aggressive preloading (current + 3 on each side)
   * Good for light tabs on high-memory devices
   */
  aggressive: {
    renderRadius: 3,
  },

  /**
   * No preloading (only current tab)
   * Good for very heavy tabs (e.g., video players)
   */
  minimal: {
    renderRadius: 0,
  },
} as const;
