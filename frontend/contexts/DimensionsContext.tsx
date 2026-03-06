/**
 * Global Dimensions Context - Handles all screen size changes
 * Essential for foldable phones, tablets, and responsive layouts
 */

import React, { createContext, useContext, useMemo, useState, useEffect, useCallback } from 'react';
import { useWindowDimensions as useRNWindowDimensions, Dimensions, AppState, Platform, AppStateStatus } from 'react-native';

// Device type classifications
export type DeviceType = 'phone' | 'foldable-closed' | 'foldable-open' | 'tablet' | 'desktop';
export type OrientationType = 'portrait' | 'landscape';

interface DimensionsState {
  // Raw dimensions
  width: number;
  height: number;
  
  // Device classification
  deviceType: DeviceType;
  orientation: OrientationType;
  
  // Foldable-specific
  isFoldable: boolean;
  isFolded: boolean;
  foldTransition: boolean;
  
  // Screen characteristics
  isSmallScreen: boolean;
  isMediumScreen: boolean;
  isLargeScreen: boolean;
  
  // Layout helpers
  contentWidth: number;
  contentPadding: number;
  
  // FlashList specific
  flashListKey: string; // Key to force re-render
  estimatedItemSize: number; // Dynamic based on screen
  
  // Responsive values
  fontSize: {
    small: number;
    base: number;
    large: number;
    title: number;
  };
}

interface DimensionsContextValue extends DimensionsState {}

const DimensionsContext = createContext<DimensionsContextValue | null>(null);

/**
 * Detect device type based on dimensions
 */
function detectDeviceType(width: number, height: number): {
  deviceType: DeviceType;
  isFoldable: boolean;
  isFolded: boolean;
} {
  const minDim = Math.min(width, height);
  const maxDim = Math.max(width, height);
  const aspectRatio = maxDim / minDim;
  
  // Desktop detection (web)
  if (width > 1024) {
    return { deviceType: 'desktop', isFoldable: false, isFolded: false };
  }
  
  // Tablet detection
  if (minDim >= 600) {
    return { deviceType: 'tablet', isFoldable: false, isFolded: false };
  }
  
  // Foldable detection (Samsung Z Fold series characteristics)
  // Unfolded: ~840x1960 (aspect ~2.3)
  // Folded: ~412x914 (aspect ~2.2)
  if (width >= 600 && width <= 900 && aspectRatio > 2.0) {
    // Likely unfolded foldable
    return { deviceType: 'foldable-open', isFoldable: true, isFolded: false };
  }
  
  if (width >= 380 && width <= 450 && aspectRatio > 2.0) {
    // Could be folded foldable or regular phone
    // Check for specific dimensions that match foldables
    const isFoldableDimension = 
      (width >= 410 && width <= 415) || // Z Fold folded width
      (width >= 384 && width <= 390);   // Z Flip folded width
    
    if (isFoldableDimension) {
      return { deviceType: 'foldable-closed', isFoldable: true, isFolded: true };
    }
  }
  
  // Regular phone
  return { deviceType: 'phone', isFoldable: false, isFolded: false };
}

/**
 * Calculate responsive values based on screen dimensions
 */
function calculateResponsiveValues(width: number, height: number, deviceType: DeviceType) {
  const isSmallScreen = width < 380;
  const isMediumScreen = width >= 380 && width < 768;
  const isLargeScreen = width >= 768;
  
  // Content width with responsive padding
  let contentPadding = 16;
  if (deviceType === 'tablet' || deviceType === 'desktop') {
    contentPadding = 32;
  } else if (deviceType === 'foldable-open') {
    contentPadding = 24;
  } else if (isSmallScreen) {
    contentPadding = 12;
  }
  
  const contentWidth = width - (contentPadding * 2);
  
  // Responsive font sizes
  const baseFontSize = isSmallScreen ? 14 : isMediumScreen ? 16 : 18;
  const fontSize = {
    small: baseFontSize * 0.875,
    base: baseFontSize,
    large: baseFontSize * 1.125,
    title: baseFontSize * 1.5,
  };
  
  // FlashList estimated item size (responsive)
  const estimatedItemSize = isSmallScreen ? 120 : isMediumScreen ? 150 : 180;
  
  return {
    isSmallScreen,
    isMediumScreen,
    isLargeScreen,
    contentWidth,
    contentPadding,
    fontSize,
    estimatedItemSize,
  };
}

export const DimensionsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Use React Native's hook for auto-updates
  const windowDimensions = useRNWindowDimensions();

  // FOLDABLE FIX: Track dimensions in state as backup for when useWindowDimensions doesn't update
  // This is necessary because useWindowDimensions has known issues on Android foldable devices
  const [nativeDimensions, setNativeDimensions] = useState(() => {
    const screen = Dimensions.get('window');
    return { width: screen.width, height: screen.height };
  });

  // Force refresh counter - incremented when we detect a potential dimension change
  const [refreshCounter, setRefreshCounter] = useState(0);

  // Use whichever dimensions are more "correct" - compare both sources
  // On foldables, one source may be stale while the other is updated
  const getLatestDimensions = useCallback(() => {
    const screen = Dimensions.get('window');

    // If the native Dimensions API shows different values than useWindowDimensions,
    // prefer the native API as it's more reliable on foldables
    if (Math.abs(screen.width - windowDimensions.width) > 50 ||
        Math.abs(screen.height - windowDimensions.height) > 50) {
      console.log('[DimensionsContext] Dimension mismatch detected:', {
        hook: { width: windowDimensions.width, height: windowDimensions.height },
        native: { width: screen.width, height: screen.height },
      });
      return { width: screen.width, height: screen.height };
    }

    return { width: windowDimensions.width, height: windowDimensions.height };
  }, [windowDimensions.width, windowDimensions.height]);

  // FOLDABLE FIX: Listen to native Dimensions change events
  // This catches changes that useWindowDimensions might miss on foldable devices
  useEffect(() => {
    const handleDimensionChange = ({ window }: { window: { width: number; height: number } }) => {
      console.log('[DimensionsContext] Native dimension change detected:', {
        old: nativeDimensions,
        new: { width: window.width, height: window.height },
      });

      // Check if this is a significant change (likely a fold/unfold)
      const widthChange = Math.abs(window.width - nativeDimensions.width);
      const heightChange = Math.abs(window.height - nativeDimensions.height);

      if (widthChange > 100 || heightChange > 100) {
        console.log('[DimensionsContext] Significant dimension change - likely fold/unfold event');
      }

      setNativeDimensions({ width: window.width, height: window.height });
      // Force a refresh to ensure all consumers get the new dimensions
      setRefreshCounter(c => c + 1);
    };

    const subscription = Dimensions.addEventListener('change', handleDimensionChange);

    return () => {
      subscription?.remove();
    };
  }, [nativeDimensions]);

  // FOLDABLE FIX: Listen to AppState changes
  // When app comes back from background (common during fold), force dimension refresh
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    let lastAppState = AppState.currentState;

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      // App came back to active state - could be from fold/unfold
      if (lastAppState.match(/inactive|background/) && nextAppState === 'active') {
        console.log('[DimensionsContext] App became active - checking dimensions');

        // Small delay to allow native dimension update to propagate
        setTimeout(() => {
          const screen = Dimensions.get('window');
          const currentWidth = nativeDimensions.width;
          const currentHeight = nativeDimensions.height;

          // Check if dimensions changed while in background
          if (Math.abs(screen.width - currentWidth) > 10 ||
              Math.abs(screen.height - currentHeight) > 10) {
            console.log('[DimensionsContext] Dimensions changed while in background:', {
              old: { width: currentWidth, height: currentHeight },
              new: { width: screen.width, height: screen.height },
            });
            setNativeDimensions({ width: screen.width, height: screen.height });
            setRefreshCounter(c => c + 1);
          }
        }, 100);
      }
      lastAppState = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription?.remove();
    };
  }, [nativeDimensions]);

  // Get the most accurate dimensions from both sources
  const { width, height } = getLatestDimensions();

  // Calculate current state - include refreshCounter in deps to force recalculation
  const dimensionsState = useMemo<DimensionsState>(() => {
    const { deviceType, isFoldable, isFolded } = detectDeviceType(width, height);
    const orientation: OrientationType = width > height ? 'landscape' : 'portrait';
    const responsive = calculateResponsiveValues(width, height, deviceType);

    // Include refresh counter in key to force FlashList re-render on fold events
    const widthBucket = Math.floor(width / 50) * 50;
    const heightBucket = Math.floor(height / 100) * 100;

    console.log('[DimensionsContext] Calculated state:', {
      width,
      height,
      deviceType,
      isFoldable,
      isFolded,
      refreshCounter,
    });

    return {
      width,
      height,
      deviceType,
      orientation,
      isFoldable,
      isFolded,
      foldTransition: false,
      ...responsive,
      // Include refreshCounter in key to ensure re-render on fold/unfold
      flashListKey: `${widthBucket}-${heightBucket}-${deviceType}-${refreshCounter}`,
    };
  }, [width, height, refreshCounter]);

  const contextValue = useMemo<DimensionsContextValue>(() => ({
    ...dimensionsState,
  }), [
    dimensionsState.width,
    dimensionsState.height,
    dimensionsState.deviceType,
    dimensionsState.orientation,
    dimensionsState.isFoldable,
    dimensionsState.isFolded,
    dimensionsState.foldTransition,
    dimensionsState.isSmallScreen,
    dimensionsState.isMediumScreen,
    dimensionsState.isLargeScreen,
    dimensionsState.contentWidth,
    dimensionsState.contentPadding,
    dimensionsState.flashListKey,
    dimensionsState.estimatedItemSize,
    dimensionsState.fontSize
  ]);

  return (
    <DimensionsContext.Provider value={contextValue}>
      {children}
    </DimensionsContext.Provider>
  );
};

/**
 * Hook to use dimensions context
 */
export const useDimensions = () => {
  const context = useContext(DimensionsContext);
  if (!context) {
    throw new Error('useDimensions must be used within DimensionsProvider');
  }
  return context;
};

/**
 * Hook for responsive styles
 */
export const useResponsiveStyles = () => {
  const dims = useDimensions();
  
  return useMemo(() => ({
    // Padding helpers
    paddingHorizontal: dims.contentPadding,
    paddingVertical: dims.isSmallScreen ? 8 : 12,
    
    // Margin helpers
    marginHorizontal: dims.contentPadding,
    marginVertical: dims.isSmallScreen ? 4 : 8,
    
    // Font helpers
    fontSize: dims.fontSize,
    
    // Layout helpers
    containerWidth: dims.contentWidth,
    isCompact: dims.isSmallScreen,
    isTablet: dims.deviceType === 'tablet',
    isFoldable: dims.isFoldable,
    
    // FlashList helpers
    flashListKey: dims.flashListKey,
    estimatedItemSize: dims.estimatedItemSize,
  }), [dims]);
};

/**
 * Hook for device-specific behavior
 */
export const useDeviceCapabilities = () => {
  const dims = useDimensions();
  
  return useMemo(() => ({
    // Feature flags based on device
    canShowSidebar: dims.deviceType === 'tablet' || dims.deviceType === 'desktop',
    canShowMultiColumn: dims.isLargeScreen,
    shouldUseCompactLayout: dims.isSmallScreen || dims.isFolded,
    
    // Navigation hints
    preferredNavigation: dims.isLargeScreen ? 'sidebar' : 'tabs',
    
    // Performance hints
    maxRenderItems: dims.isSmallScreen ? 20 : dims.isMediumScreen ? 30 : 50,
    preloadDistance: dims.isSmallScreen ? 500 : dims.isMediumScreen ? 1000 : 2000,
  }), [dims]);
};