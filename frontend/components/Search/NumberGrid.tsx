/**
 * NumberGrid - Reusable grid for displaying chapters OR verses
 * Implements UX research: spatial replacement with crossfade (250ms total)
 * - Chapters: 72px buttons, 4-8 columns
 * - Verses: 56px buttons, 5-6 columns (visually smaller, subordinate)
 */

import React, { useMemo, useState, useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { NumberButton } from './NumberButton';
import type { DisplayMode, CategoryColors } from './types';

interface NumberGridProps {
  numbers: number[];
  mode: DisplayMode;
  categoryColors: CategoryColors;
  onSelect: (num: number) => void;
  isExpanded: boolean;
  isFiltering: boolean;
  isAnimating: boolean;
  prepareAnimations: boolean;
  layoutTransition: any;
  theme: any;
  containerWidth?: number;
  scaleFactor?: number;
}

export const NumberGrid = React.memo(function NumberGrid({
  numbers,
  mode,
  categoryColors,
  onSelect,
  isExpanded,
  isFiltering,
  isAnimating,
  prepareAnimations,
  layoutTransition,
  theme,
  containerWidth,
  scaleFactor = 1.0,
}: NumberGridProps) {
  const [shouldRender, setShouldRender] = useState(false);

  // Get grid configuration based on mode
  const { columns, buttonWidth, gridWidth, leftMargin, gap, buttonHeight } = useMemo(() => {
    const screenWidth = containerWidth ?? Dimensions.get('window').width;
    return getGridConfig(screenWidth, mode, scaleFactor);
  }, [mode, containerWidth, scaleFactor]);

  const containerPadding = 16;

  // Calculate height based on number count
  const rows = Math.ceil(numbers.length / columns);
  const calculatedHeight = (rows * buttonHeight) + ((rows - 1) * gap) + (containerPadding * 2);

  // Crossfade animation: fade out (100ms) → gap (50ms) → fade in (100ms) = 250ms total
  const animatedStyle = useAnimatedStyle(() => {
    if (!isExpanded) {
      return {
        height: withTiming(0, {
          duration: 400,
          easing: Easing.inOut(Easing.ease)
        }),
        opacity: withTiming(0, {
          duration: 400,
          easing: Easing.inOut(Easing.ease)
        }),
      };
    }

    return {
      height: withTiming(calculatedHeight, {
        duration: 400,
        easing: Easing.inOut(Easing.ease)
      }),
      opacity: withTiming(1, {
        duration: 400,
        easing: Easing.inOut(Easing.ease)
      }),
    };
  }, [isExpanded, calculatedHeight]);

  // Control rendering
  useEffect(() => {
    if (isExpanded) {
      setShouldRender(true);
    } else {
      const timer = setTimeout(() => setShouldRender(false), 400);
      return () => clearTimeout(timer);
    }
  }, [isExpanded]);

  if (!isExpanded && !shouldRender) {
    return null;
  }

  // Color adjustments for verses (slightly dimmed as per UX research)
  const bgColor = mode === 'verses'
    ? theme.colors.background.primary // Slightly more transparent for verses
    : theme.colors.background.primary;

  const textColor = mode === 'verses'
    ? theme.colors.text.primary // Slightly dimmed for verses
    : theme.colors.text.primary;

  const borderColor = mode === 'verses'
    ? theme.colors.border // Softer border for verses
    : theme.colors.border;

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor: categoryColors.bg },
        animatedStyle
      ]}
    >
      {shouldRender && (
        <View style={[styles.centeredGridContainer, { marginLeft: leftMargin }]}>
          <View style={[styles.grid, { gap, width: gridWidth }]}>
            {numbers.map(number => (
              <NumberButton
                key={number}
                number={number}
                onPress={() => onSelect(number)}
                width={buttonWidth}
                height={buttonHeight}
                mode={mode}
                isFiltering={isFiltering}
                isAnimating={isAnimating}
                prepareAnimations={prepareAnimations}
                layoutTransition={layoutTransition}
                textColor={textColor}
                backgroundColor={bgColor}
                borderColor={borderColor}
              />
            ))}
          </View>
        </View>
      )}
    </Animated.View>
  );
});

// Calculate responsive grid config based on mode
function getGridConfig(screenWidth: number, mode: DisplayMode, scaleFactor: number = 1.0) {
  // Chapters: 72px buttons, 4-8 columns (existing)
  // Verses: 56px buttons, 5-6 columns (smaller, fit more per UX research)
  const baseButtonWidth = mode === 'verses' ? 56 : 56; // Both 56px now for consistency
  const baseGap = mode === 'verses' ? 10 : 8; // Slightly tighter for verses

  // Apply scale factor to button size and gap
  const minButtonWidth = Math.round(baseButtonWidth * scaleFactor);
  const gap = Math.round(baseGap * scaleFactor);

  const availableWidth = screenWidth - 16;

  // Calculate columns
  let columns = Math.floor(availableWidth / (minButtonWidth + gap));

  if (mode === 'verses') {
    columns = Math.max(5, Math.min(6, columns)); // 5-6 columns for verses
  } else {
    columns = Math.max(4, Math.min(8, columns)); // 4-8 columns for chapters
  }

  const totalGapWidth = gap * (columns - 1);
  const gridWidth = (minButtonWidth * columns) + totalGapWidth;
  const leftMargin = Math.max(0, (availableWidth - gridWidth) / 2);

  return {
    columns,
    buttonWidth: minButtonWidth,
    buttonHeight: minButtonWidth, // Square buttons
    gridWidth,
    leftMargin,
    gap
  };
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 16,
    overflow: 'hidden',
  },
  centeredGridContainer: {
    alignItems: 'flex-start',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
  },
});
