/**
 * Verse Reference Component
 * Displays a single verse or verse range from the note's current chapter
 * Used for quick verse copying with "v[number]" shorthand
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { bibleSQLite, type VerseLine } from '@/services/sqlite';
import { HighlightedText } from '@/components/Bible/HighlightedText';
import { useTheme } from '@/contexts/ThemeContext';

export interface VerseReferenceProps {
  verseNumber: number; // Just the verse number (e.g., 7)
  chapterId?: number; // From note's chapter_id
  onDelete: () => void;
  fontSize?: number; // From parent note's responsive sizing
  lineHeight?: number; // From parent note
  fontFamily?: string; // From parent note
}

export const VerseReference: React.FC<VerseReferenceProps> = ({
  verseNumber,
  chapterId,
  onDelete,
  fontSize,
  lineHeight: propLineHeight,
  fontFamily,
}) => {
  const { theme } = useTheme();

  const effectiveFontSize = fontSize || 16;
  const effectiveLineHeight = propLineHeight || effectiveFontSize * 1.5;

  const [verseLines, setVerseLines] = useState<VerseLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookName, setBookName] = useState('');
  const [chapterNumber, setChapterNumber] = useState(0);
  const [error, setError] = useState(false);

  useEffect(() => {
    loadVerse();
  }, [chapterId, verseNumber]);

  const loadVerse = async () => {
    if (!chapterId) {
      setError(true);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(false);

      // Get chapter content
      const chapterContent = await bibleSQLite.getChapterContent(chapterId);

      if (!chapterContent) {
        setError(true);
        setLoading(false);
        return;
      }

      // Extract book name and chapter number
      setBookName(chapterContent.chapter.book_name || '');
      setChapterNumber(chapterContent.chapter.chapter_number || 0);

      // Find all verse lines for the requested verse number
      const verseId = chapterId + verseNumber;
      const foundVerseLines: VerseLine[] = [];

      // Search through all sections and paragraphs
      for (const sectionData of chapterContent.sections) {
        for (const paragraphData of sectionData.paragraphs) {
          const matchingLines = paragraphData.verseLines.filter(
            (line: VerseLine) => line.verse_id === verseId
          );
          foundVerseLines.push(...matchingLines);
        }
      }

      if (foundVerseLines.length === 0) {
        setError(true);
      } else {
        setVerseLines(foundVerseLines);
      }
    } catch (err) {
      console.error('[VerseReference] Error loading verse:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const referenceText = `${bookName} ${chapterNumber}:${verseNumber}`;

  // Combine verse lines into displayable text
  const verseText = verseLines.map((line) => line.text).join(' ');

  // Loading state
  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={[styles.headerText, { color: theme.colors.text.secondary }]}>
            Loading v{verseNumber}...
          </Text>
          <TouchableOpacity onPress={onDelete} style={styles.closeButton}>
            <Ionicons name="close" size={18} color={theme.colors.text.muted} />
          </TouchableOpacity>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={theme.colors.text.muted} />
        </View>
      </View>
    );
  }

  // Error state
  if (error || verseLines.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={[styles.headerText, { color: theme.colors.text.secondary }]}>
            v{verseNumber}
          </Text>
          <TouchableOpacity onPress={onDelete} style={styles.closeButton}>
            <Ionicons name="close" size={18} color={theme.colors.text.muted} />
          </TouchableOpacity>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={[styles.errorText, { color: theme.colors.text.muted }]}>
            {!chapterId ? 'Note not attached to chapter' : 'Verse not found'}
          </Text>
        </View>
      </View>
    );
  }

  // Success state - render with HighlightedText
  return (
    <View style={styles.container}>
      {/* Header with reference and close button */}
      <View style={styles.header}>
        <Text style={[styles.headerText, { color: theme.colors.text.secondary }]}>
          {referenceText}
        </Text>
        <TouchableOpacity onPress={onDelete} style={styles.closeButton}>
          <Ionicons name="close" size={18} color={theme.colors.text.muted} />
        </TouchableOpacity>
      </View>

      {/* Highlighted verse content - simple text rendering */}
      <HighlightedText>
        <Text
          style={{
            fontSize: effectiveFontSize,
            lineHeight: effectiveLineHeight,
            color: theme.colors.text.primary,
            fontFamily: fontFamily || theme.bibleTypography?.body?.default?.fontFamily,
          }}
        >
          <Text
            style={{
              fontSize: effectiveFontSize * 0.75,
              color: theme.colors.verseNumber,
              fontWeight: '600',
            }}
          >
            {verseNumber}
          </Text>
          {'\u00A0'}
          {verseText}
        </Text>
      </HighlightedText>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  headerText: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  closeButton: {
    padding: 2,
  },
  loadingContainer: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
});
