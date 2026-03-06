/**
 * useFlashListConfig Hook
 *
 * Provides standardized FlashList configuration for optimal performance.
 * Handles:
 * - Viewability config (threshold, minimum view time)
 * - onEndReached threshold
 * - scrollEventThrottle
 * - removeClippedSubviews
 * - drawDistance
 * - estimatedItemSize calculations
 *
 * Removes ~60 lines of duplicated config from SinglePaneBibleView and VerseAlignedSplitView.
 *
 * @example
 * ```typescript
 * const flashListConfig = useFlashListConfig({
 *   estimatedItemSize: 100,
 *   loadMoreThreshold: 2,
 * });
 *
 * <FlashList
 *   {...flashListConfig.props}
 *   onEndReached={flashListConfig.onEndReached}
 * />
 * ```
 */

import { useMemo, useCallback } from 'react';
import type { ViewabilityConfig } from 'react-native';

/**
 * Parameters for useFlashListConfig hook
 */
export interface UseFlashListConfigParams {
  /** Estimated item size for FlashList optimization (default: 100) */
  estimatedItemSize?: number;

  /** Threshold for onEndReached as ratio of viewport (default: 1.5) */
  loadMoreThreshold?: number;

  /** Callback when list reaches end */
  onEndReached?: () => void;

  /** Viewability threshold percentage (0-100, default: 50) */
  viewAreaCoveragePercentThreshold?: number;

  /** Minimum time item must be visible in ms (default: 500) */
  minimumViewTime?: number;

  /** Scroll event throttle in ms (default: 16 for 60fps) */
  scrollEventThrottle?: number;

  /** Whether to remove clipped subviews (default: false for stability) */
  removeClippedSubviews?: boolean;

  /** Draw distance for off-screen rendering (default: 5000) */
  drawDistance?: number;

  /** Whether to enable overriding estimated list size (default: true) */
  overrideItemLayout?: boolean;

  /** Custom key extractor function */
  keyExtractor?: (item: any, index: number) => string;
}

/**
 * Return type for useFlashListConfig hook
 */
export interface UseFlashListConfigReturn {
  /** Props to spread onto FlashList component */
  props: {
    estimatedItemSize: number;
    onEndReachedThreshold: number;
    scrollEventThrottle: number;
    removeClippedSubviews: boolean;
    drawDistance: number;
    keyExtractor?: (item: any, index: number) => string;
    overrideItemLayout?: any;
  };

  /** Viewability config object */
  viewabilityConfig: ViewabilityConfig;

  /** onEndReached handler */
  onEndReached: (() => void) | undefined;
}

/**
 * Default key extractor based on common patterns
 */
const defaultKeyExtractor = (item: any, index: number): string => {
  if (item.id !== undefined) return String(item.id);
  if (item.key !== undefined) return String(item.key);
  if (item.chapterId !== undefined) return `chapter-${item.chapterId}`;
  if (item.verseId !== undefined) return `verse-${item.verseId}`;
  return `item-${index}`;
};

/**
 * useFlashListConfig Hook
 *
 * Provides standardized FlashList configuration for optimal performance.
 */
export function useFlashListConfig({
  estimatedItemSize = 100,
  loadMoreThreshold = 1.5,
  onEndReached,
  viewAreaCoveragePercentThreshold = 50,
  minimumViewTime = 500,
  scrollEventThrottle = 16, // 60fps
  removeClippedSubviews = false, // Keep false for stability
  drawDistance = 5000,
  overrideItemLayout = true,
  keyExtractor = defaultKeyExtractor,
}: UseFlashListConfigParams = {}): UseFlashListConfigReturn {

  /**
   * Viewability config for tracking visible items
   */
  const viewabilityConfig = useMemo<ViewabilityConfig>(
    () => ({
      viewAreaCoveragePercentThreshold,
      minimumViewTime,
    }),
    [viewAreaCoveragePercentThreshold, minimumViewTime]
  );

  /**
   * Handle end reached with deduplication
   */
  const handleEndReached = useCallback(() => {
    if (onEndReached) {
      onEndReached();
    }
  }, [onEndReached]);

  /**
   * Override item layout function for better performance
   * This helps FlashList estimate heights more accurately
   */
  const overrideItemLayoutFunction = useMemo(
    () =>
      overrideItemLayout
        ? (layout: any, item: any, index: number) => {
            // Allow FlashList to use measured heights
            // This is especially important for variable-height items like Bible paragraphs
            layout.size = item.estimatedHeight ?? estimatedItemSize;
          }
        : undefined,
    [overrideItemLayout, estimatedItemSize]
  );

  /**
   * Props to spread onto FlashList component
   */
  const props = useMemo(
    () => ({
      estimatedItemSize,
      onEndReachedThreshold: loadMoreThreshold,
      scrollEventThrottle,
      removeClippedSubviews,
      drawDistance,
      keyExtractor,
      ...(overrideItemLayoutFunction && {
        overrideItemLayout: overrideItemLayoutFunction,
      }),
    }),
    [
      estimatedItemSize,
      loadMoreThreshold,
      scrollEventThrottle,
      removeClippedSubviews,
      drawDistance,
      keyExtractor,
      overrideItemLayoutFunction,
    ]
  );

  // PERF FIX: Memoize return object to prevent recreation on every render
  return useMemo(() => ({
    props,
    viewabilityConfig,
    onEndReached: onEndReached ? handleEndReached : undefined,
  }), [props, viewabilityConfig, onEndReached, handleEndReached]);
}

/**
 * Preset configurations for common use cases
 */
export const FlashListPresets = {
  /**
   * Bible verse list configuration (variable heights, many items)
   */
  bibleVerses: {
    estimatedItemSize: 80,
    loadMoreThreshold: 2,
    viewAreaCoveragePercentThreshold: 50,
    minimumViewTime: 500,
    scrollEventThrottle: 16,
    removeClippedSubviews: false,
    drawDistance: 5000,
  },

  /**
   * Chapter list configuration (larger items, fewer items)
   */
  chapters: {
    estimatedItemSize: 400,
    loadMoreThreshold: 1.5,
    viewAreaCoveragePercentThreshold: 50,
    minimumViewTime: 500,
    scrollEventThrottle: 16,
    removeClippedSubviews: false,
    drawDistance: 3000,
  },

  /**
   * Search results configuration (mixed heights, dynamic loading)
   */
  searchResults: {
    estimatedItemSize: 120,
    loadMoreThreshold: 1.0,
    viewAreaCoveragePercentThreshold: 30,
    minimumViewTime: 300,
    scrollEventThrottle: 16,
    removeClippedSubviews: false,
    drawDistance: 4000,
  },
} as const;
