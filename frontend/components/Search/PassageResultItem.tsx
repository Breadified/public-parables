/**
 * PassageResultItem - Expandable search result for grouped passages
 *
 * Collapsed: Shows bibleRef header + snippet preview
 * Expanded: Shows full verses using BibleContentRenderer
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/contexts/ThemeContext';
import type { Theme } from '@/config/theme';
import type { PassageSearchResult } from '@/modules/search/vectorSearch';
import { bibleSQLite, type VerseLine } from '@/services/sqlite';
import { BibleContentRenderer } from '@/components/Bible/BibleContentRenderer';
import { HighlightedText } from '@/components/Bible/HighlightedText';
import { createBibleStyles } from '@/components/Bible/BibleStyles';

interface PassageResultItemProps {
  passage: PassageSearchResult;
  onNavigate: (bookId: number, chapter: number, verse: number) => void;
}

export function PassageResultItem({ passage, onNavigate }: PassageResultItemProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [isExpanded, setIsExpanded] = useState(false);
  const [verseLines, setVerseLines] = useState<VerseLine[]>([]);
  const [isPoetry, setIsPoetry] = useState(false);
  const [loading, setLoading] = useState(false);

  // Bible styles for expanded view
  const bibleStyles = useMemo(
    () =>
      createBibleStyles({
        theme,
        fontSize: 14,
        contentPadding: 8,
        responsiveFontSizes: {
          small: 12.25,
          base: 14,
          large: 15.75,
          title: 17.5,
        },
        isSmallScreen: true,
        splitScreen: true,
      }),
    [theme],
  );

  // Format score as percentage
  const scorePercent = Math.round(passage.averageScore * 100);

  // Get snippet from first verse
  const snippet = useMemo(() => {
    const firstVerseText = passage.verses[0]?.verseText || '';
    const maxLength = 120;
    return firstVerseText.length > maxLength
      ? firstVerseText.substring(0, maxLength).trim() + '...'
      : firstVerseText;
  }, [passage.verses]);

  // Load full verse lines when expanded
  useEffect(() => {
    if (!isExpanded || verseLines.length > 0) return;

    const loadVerses = async () => {
      try {
        setLoading(true);

        // Ensure SQLite is initialized
        await bibleSQLite.initialize();

        // Build chapter ID: bookId * 1000000 + chapter * 1000
        const chapterId = passage.bookId * 1000000 + passage.chapter * 1000;

        console.log('[PassageResultItem] Loading verses:', {
          bookId: passage.bookId,
          chapter: passage.chapter,
          chapterId,
          startVerse: passage.startVerse,
          endVerse: passage.endVerse,
        });

        // Fetch verse lines for the range using the current Bible version
        let lines = await bibleSQLite.getVerseLineRange(
          chapterId,
          passage.startVerse,
          passage.endVerse,
        );

        // If no lines found, try ESV (since embeddings are based on ESV)
        if (lines.length === 0) {
          console.log('[PassageResultItem] No verses found with current version, trying ESV');
          const currentVersion = bibleSQLite.getCurrentVersion();
          if (currentVersion !== 'ESV') {
            await bibleSQLite.setCurrentVersion('ESV');
            lines = await bibleSQLite.getVerseLineRange(
              chapterId,
              passage.startVerse,
              passage.endVerse,
            );
            // Restore original version
            await bibleSQLite.setCurrentVersion(currentVersion);
          }
        }

        console.log('[PassageResultItem] Loaded', lines.length, 'verse lines');

        // Determine if poetry by checking indent_level
        const hasIndent = lines.some((line) => (line.indent_level || 0) > 0);
        setIsPoetry(hasIndent);
        setVerseLines(lines);
      } catch (err) {
        console.error('[PassageResultItem] Error loading verses:', err);
      } finally {
        setLoading(false);
      }
    };

    loadVerses();
  }, [isExpanded, passage.bookId, passage.chapter, passage.startVerse, passage.endVerse, verseLines.length]);

  // Toggle expand/collapse
  const handleToggle = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  // Navigate to passage
  const handleNavigate = useCallback(() => {
    onNavigate(passage.bookId, passage.chapter, passage.startVerse);
  }, [onNavigate, passage.bookId, passage.chapter, passage.startVerse]);

  return (
    <View style={styles.container}>
      {/* Header - always visible, tap to expand/collapse */}
      <TouchableOpacity
        style={styles.header}
        onPress={handleToggle}
        activeOpacity={0.7}
      >
        <View style={styles.headerLeft}>
          <Ionicons
            name={isExpanded ? 'chevron-down' : 'chevron-forward'}
            size={18}
            color={theme.colors.text.secondary}
            style={styles.chevron}
          />
          <Text style={styles.bibleRef}>{passage.bibleRef}</Text>
          {passage.verseCount > 1 && (
            <Text style={styles.verseCount}>({passage.verseCount} verses)</Text>
          )}
        </View>
        <View style={styles.scoreBadge}>
          <Text style={styles.scoreText}>{scorePercent}%</Text>
        </View>
      </TouchableOpacity>

      {/* Collapsed: Show snippet */}
      {!isExpanded && (
        <TouchableOpacity onPress={handleToggle} activeOpacity={0.7}>
          <Text style={styles.snippet} numberOfLines={2}>
            {snippet}
          </Text>
        </TouchableOpacity>
      )}

      {/* Expanded: Show full verses */}
      {isExpanded && (
        <View style={styles.expandedContent}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={theme.colors.text.muted} />
            </View>
          ) : verseLines.length > 0 ? (
            <>
              <HighlightedText>
                <BibleContentRenderer
                  verseLines={verseLines}
                  isPoetry={isPoetry}
                  showVerseNumbers={true}
                  styles={bibleStyles}
                  compact={true}
                />
              </HighlightedText>
              <Pressable
                onPress={handleNavigate}
                style={styles.goToButton}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons
                  name="book-outline"
                  size={16}
                  color={theme.colors.accent}
                  style={styles.goToIcon}
                />
                <Text style={styles.goToText}>Go to passage</Text>
              </Pressable>
            </>
          ) : (
            <Text style={styles.errorText}>Could not load verses</Text>
          )}
        </View>
      )}
    </View>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      backgroundColor: theme.colors.background.elevated,
      borderRadius: 12,
      padding: 14,
      marginVertical: 6,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    chevron: {
      marginRight: 6,
    },
    bibleRef: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.primary,
    },
    verseCount: {
      fontSize: 12,
      color: theme.colors.text.secondary,
      marginLeft: 8,
    },
    scoreBadge: {
      backgroundColor: theme.colors.primary + '20',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
    },
    scoreText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.primary,
    },
    snippet: {
      fontSize: 14,
      lineHeight: 20,
      color: theme.colors.text.primary,
      marginTop: 8,
    },
    expandedContent: {
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.border,
    },
    loadingContainer: {
      paddingVertical: 16,
      alignItems: 'center',
    },
    goToButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 12,
      paddingVertical: 10,
      backgroundColor: theme.colors.accent + '15',
      borderRadius: 8,
    },
    goToIcon: {
      marginRight: 6,
    },
    goToText: {
      fontSize: 14,
      fontWeight: '500',
      color: theme.colors.accent,
    },
    errorText: {
      fontSize: 13,
      fontStyle: 'italic',
      color: theme.colors.text.muted,
      textAlign: 'center',
      paddingVertical: 16,
    },
  });
}
