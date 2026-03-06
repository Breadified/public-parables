/**
 * Auto-Suggest Overlay Component
 * Displays smart completion suggestions in italic/lighter style as user types
 * Pattern-based only - does NOT validate against book names
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { getSmartCompletion } from '@/modules/bible/searchSuggestions';

interface AutoSuggestOverlayProps {
  inputText: string;
  filteredBooksCount?: number;
  textColor?: string;
  fontSize?: number;
  fontFamily?: string;
  paddingHorizontal?: number;
  suggestRange?: boolean; // If true, suggest verse ranges (1:1-5) instead of single verses
}

export const AutoSuggestOverlay = React.memo(({
  inputText,
  filteredBooksCount,
  textColor = '#9CA3AF',
  fontSize = 16,
  fontFamily = 'System',
  paddingHorizontal = 16,
  suggestRange = false,
}: AutoSuggestOverlayProps) => {
  // Get the completion suggestion based on current input and filtered books
  const completion = useMemo(() => {
    if (!inputText || inputText.trim().length === 0) return '';
    return getSmartCompletion(inputText, filteredBooksCount, suggestRange);
  }, [inputText, filteredBooksCount, suggestRange]);

  // Don't render if no completion
  if (!completion) return null;

  return (
    <View
      style={[
        styles.container,
        { paddingHorizontal },
      ]}
      pointerEvents="none"
    >
      <View style={styles.textContainer}>
        {/* Invisible spacer matching the input text to position completion correctly */}
        <Text
          style={[
            styles.inputSpacer,
            {
              fontSize,
              fontFamily,
            },
          ]}
        >
          {inputText}
        </Text>
        {/* Completion in lighter italic style */}
        <Text
          style={[
            styles.completion,
            {
              color: textColor,
              fontSize,
              fontFamily,
            },
          ]}
        >
          {completion}
        </Text>
      </View>
    </View>
  );
});

AutoSuggestOverlay.displayName = 'AutoSuggestOverlay';

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 44,
    justifyContent: 'center',
    zIndex: 1,
  },
  textContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputSpacer: {
    opacity: 0, // Invisible but takes up space
  },
  completion: {
    fontStyle: 'italic',
    fontWeight: '300',
    opacity: 0.6,
  },
});
