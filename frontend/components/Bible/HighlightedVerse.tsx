/**
 * Highlighted Verse Component
 * Renders a selected verse with bold indicator and full-width background
 * Handles verses that span multiple verse lines
 */

import React from 'react';
import { View, Text } from 'react-native';
import { type VerseLine } from '@/services/sqlite';
import { type BibleStyles } from './BibleStyles';

interface HighlightedVerseProps {
  verseLines: VerseLine[]; // All lines belonging to the same verse_id
  showVerseNumbers?: boolean;
  styles: BibleStyles;
}

export const HighlightedVerse: React.FC<HighlightedVerseProps> = ({
  verseLines,
  showVerseNumbers = true,
  styles,
}) => {
  if (verseLines.length === 0) return null;

  // Get verse number from first line
  const firstLine = verseLines[0];
  const verseNum = firstLine.verse_number ? String(firstLine.verse_number) : null;
  const shouldShowNumber = firstLine.show_verse_number && verseNum;

  // Combine all verse line texts
  const verseText = verseLines.map((line) => String(line.text || '')).join(' ');

  return (
    <View style={styles.paragraphContainer}>
      <View style={styles.selectedVerseContainer}>
        <View style={styles.selectedVerseIndicator} />
        <View style={styles.selectedVerseTextContainer}>
          <Text style={styles.paragraphText}>
            {showVerseNumbers && shouldShowNumber ? (
              <>
                <Text style={styles.verseNumberInline}>{verseNum}</Text>
                {'\u00A0'}
              </>
            ) : null}
            {verseText}
          </Text>
        </View>
      </View>
    </View>
  );
};
