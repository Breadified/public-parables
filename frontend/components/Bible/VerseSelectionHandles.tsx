/**
 * VerseSelectionHandles - Visual handles at start/end of verse selection
 * Shows teardrop-shaped handles during active selection
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';

interface VerseSelectionHandlesProps {
  visible: boolean; // Show when state === "selecting"
  startY: number | null; // Y position of selection start
  endY: number | null; // Y position of selection end (current touch)
}

export const VerseSelectionHandles: React.FC<VerseSelectionHandlesProps> = ({
  visible,
  startY,
  endY,
}) => {
  const { theme } = useTheme();

  if (!visible || startY === null) {
    return null;
  }

  const handleColor = theme.colors.primary;

  return (
    <View style={styles.container} pointerEvents="none">
      {/* Start handle - teardrop pointing up (at top of selection) */}
      <View style={[styles.handleWrapper, { top: startY - 24 }]}>
        <View style={[styles.handleStem, { backgroundColor: handleColor }]} />
        <View style={[styles.handleBall, { backgroundColor: handleColor }]} />
      </View>

      {/* End handle - teardrop pointing down (at bottom of selection) */}
      {endY !== null && endY !== startY && (
        <View style={[styles.handleWrapper, { top: endY }]}>
          <View style={[styles.handleBall, { backgroundColor: handleColor }]} />
          <View style={[styles.handleStem, { backgroundColor: handleColor }]} />
        </View>
      )}
    </View>
  );
};

const HANDLE_BALL_SIZE = 12;
const HANDLE_STEM_HEIGHT = 16;
const HANDLE_STEM_WIDTH = 2;

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
  },
  handleWrapper: {
    position: 'absolute',
    left: 8, // Position on the left edge
    alignItems: 'center',
    width: HANDLE_BALL_SIZE,
  },
  handleBall: {
    width: HANDLE_BALL_SIZE,
    height: HANDLE_BALL_SIZE,
    borderRadius: HANDLE_BALL_SIZE / 2,
  },
  handleStem: {
    width: HANDLE_STEM_WIDTH,
    height: HANDLE_STEM_HEIGHT,
  },
});
