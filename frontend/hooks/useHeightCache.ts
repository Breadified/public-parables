/**
 * Height Cache Hook for FlashList Variable-Height Items
 *
 * Provides debounced height caching with stabilization tracking.
 * Used by Bible rendering components that need accurate height
 * measurements from native views before FlashList can layout correctly.
 *
 * Two-stage rendering pattern:
 * 1. Native view renders and measures its content
 * 2. Height is reported back to JS via onMeasuredHeight callback
 * 3. FlashList uses cached height in overrideItemLayout
 * 4. After enough measurements, isStabilized becomes true
 */

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';

export interface UseHeightCacheOptions {
  /**
   * Debounce delay in ms for batching height updates
   * @default 50
   */
  debounceMs?: number;

  /**
   * Minimum number of measurements before isStabilized becomes true
   * @default 3
   */
  minMeasurementsForStability?: number;

  /**
   * Maximum total items (used to determine if we have "enough" measurements)
   * If provided, stabilization triggers when measurementCount >= min(maxItems, minMeasurementsForStability)
   */
  maxItems?: number;

  /**
   * External condition that must be true before stabilization can occur
   * Useful for waiting until initial scroll completes
   * @default true
   */
  canStabilize?: boolean;

  /**
   * Threshold in pixels for considering height "changed"
   * Heights within this threshold won't trigger re-render
   * @default 5
   */
  changeThreshold?: number;

  /**
   * Callback when height stabilization occurs
   */
  onStabilized?: () => void;
}

export interface UseHeightCacheResult {
  /**
   * Get cached height for a key
   */
  getHeight: (key: string) => number | undefined;

  /**
   * Set height for a key (called internally by createHeightCallback)
   */
  setHeight: (key: string, height: number) => void;

  /**
   * Whether enough heights have been measured for stable layout
   */
  isStabilized: boolean;

  /**
   * Version number that increments when cache changes
   * Pass to FlashList's extraData to trigger re-render
   */
  cacheVersion: number;

  /**
   * Total number of measurements received
   */
  measurementCount: number;

  /**
   * Create a callback for a specific key to pass to onMeasuredHeight
   */
  createHeightCallback: (key: string) => (height: number) => void;

  /**
   * Reset the cache (useful when data changes completely)
   */
  reset: () => void;
}

export function useHeightCache(options: UseHeightCacheOptions = {}): UseHeightCacheResult {
  const {
    debounceMs = 50,
    minMeasurementsForStability = 3,
    maxItems,
    canStabilize = true,
    changeThreshold = 5,
    onStabilized,
  } = options;

  // Height cache
  const heightCacheRef = useRef<Map<string, number>>(new Map());
  const [cacheVersion, setCacheVersion] = useState(0);

  // Debouncing
  const pendingHeightUpdates = useRef<Map<string, number>>(new Map());
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Stabilization tracking
  const [isStabilized, setIsStabilized] = useState(false);
  const measurementCountRef = useRef(0);

  // Compute the target measurement count for stabilization
  const stabilizationTarget = maxItems !== undefined
    ? Math.min(maxItems, minMeasurementsForStability)
    : minMeasurementsForStability;

  // Track stabilization in ref for callback access
  const isStabilizedRef = useRef(false);

  // Flush pending height updates (batched to avoid excessive re-renders)
  const flushPendingHeights = useCallback(() => {
    const pending = pendingHeightUpdates.current;
    if (pending.size === 0) return;

    let hasChanges = false;
    pending.forEach((height, key) => {
      const current = heightCacheRef.current.get(key);
      // Only update if height changed significantly
      if (current === undefined || Math.abs(current - height) > changeThreshold) {
        heightCacheRef.current.set(key, height);
        hasChanges = true;
      }
    });
    pending.clear();

    // SCROLL JUMP FIX: After stabilization, don't update cacheVersion
    // This prevents FlashList from re-rendering/re-laying out when user interacts
    // The overrideItemLayout callback reads directly from heightCacheRef, so heights
    // are still used correctly - we just don't trigger FlashList extraData changes
    if (hasChanges && !isStabilizedRef.current) {
      setCacheVersion(v => v + 1);
    }
  }, [changeThreshold]);

  // Set height for a key
  const setHeight = useCallback((key: string, height: number) => {
    pendingHeightUpdates.current.set(key, height);
    measurementCountRef.current += 1;

    // Check for stabilization
    if (!isStabilized && canStabilize && measurementCountRef.current >= stabilizationTarget) {
      setIsStabilized(true);
      isStabilizedRef.current = true; // SCROLL JUMP FIX: Update ref for flushPendingHeights
      onStabilized?.();
    }

    // Debounce the flush
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(flushPendingHeights, debounceMs);
  }, [flushPendingHeights, debounceMs, isStabilized, canStabilize, stabilizationTarget, onStabilized]);

  // Get height for a key
  const getHeight = useCallback((key: string): number | undefined => {
    return heightCacheRef.current.get(key);
  }, []);

  // Create a callback for a specific key
  const createHeightCallback = useCallback((key: string) => {
    return (height: number) => setHeight(key, height);
  }, [setHeight]);

  // Reset the cache
  const reset = useCallback(() => {
    heightCacheRef.current.clear();
    pendingHeightUpdates.current.clear();
    measurementCountRef.current = 0;
    setIsStabilized(false);
    isStabilizedRef.current = false; // SCROLL JUMP FIX: Reset ref
    setCacheVersion(0);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  }, []);

  // Handle canStabilize changing to true when we already have enough measurements
  useEffect(() => {
    if (!isStabilized && canStabilize && measurementCountRef.current >= stabilizationTarget) {
      setIsStabilized(true);
      isStabilizedRef.current = true; // SCROLL JUMP FIX: Update ref
      onStabilized?.();
    }
  }, [canStabilize, isStabilized, stabilizationTarget, onStabilized]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return {
    getHeight,
    setHeight,
    isStabilized,
    cacheVersion,
    measurementCount: measurementCountRef.current,
    createHeightCallback,
    reset,
  };
}
