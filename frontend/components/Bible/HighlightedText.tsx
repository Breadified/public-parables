/**
 * HighlightedText Component
 * Generic component for highlighting content with indigo bar + background
 * Used for verse selection, VerseReference, and BiblePeek highlighting
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

interface HighlightedTextProps {
  children: React.ReactNode;
}

/**
 * Wraps any content with the standard verse highlighting style:
 * - Bold colored indicator bar on the left (8px)
 * - Semi-transparent background
 * - Theme-aware colors (dark/sepia/light modes)
 */
export const HighlightedText: React.FC<HighlightedTextProps> = ({ children }) => {
  const { theme } = useTheme();

  // Get theme-aware colors for the indicator and background
  const indicatorColor =
    theme.mode === 'dark'
      ? 'rgba(129, 140, 248, 0.8)' // primary[400] - bold and visible
      : theme.mode === 'sepia'
      ? 'rgba(93, 64, 55, 0.8)' // brown[700] - bold warm
      : 'rgba(79, 70, 229, 0.8)'; // primary[600] - bold highlight

  const backgroundColor =
    theme.mode === 'dark'
      ? 'rgba(129, 140, 248, 0.12)' // primary[400] - subtle light
      : theme.mode === 'sepia'
      ? 'rgba(93, 64, 55, 0.10)' // brown[700] - subtle warm
      : 'rgba(79, 70, 229, 0.10)'; // primary[600] - subtle light

  return (
    <View style={styles.container}>
      <View style={[styles.indicator, { backgroundColor: indicatorColor }]} />
      <View style={[styles.content, { backgroundColor }]}>
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginVertical: 2, // spacing.xs / 2
    borderRadius: 4,
    overflow: 'hidden',
  },
  indicator: {
    width: 8, // Bold 8px indicator
  },
  content: {
    flex: 1, // Take remaining width
    paddingHorizontal: 8, // spacing.sm
    paddingVertical: 4, // spacing.xs
  },
});
