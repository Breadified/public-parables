/**
 * SemanticResultsList - Display semantic search results
 *
 * Shows ranked Bible verses from semantic search with:
 * - BibleRef format (John 3:16)
 * - Verse text snippet
 * - Relevance score indicator
 */

import React, { useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import type { Theme } from '@/config/theme';
import type { SemanticSearchResult } from '@/modules/search/vectorSearch';

interface SemanticResultsListProps {
  results: SemanticSearchResult[];
  isLoading: boolean;
  query: string;
  onSelectVerse: (result: SemanticSearchResult) => void;
}

export function SemanticResultsList({
  results,
  isLoading,
  query,
  onSelectVerse,
}: SemanticResultsListProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  // Render a single result item
  const renderResult = useCallback(
    ({ item, index }: { item: SemanticSearchResult; index: number }) => {
      // Format score as percentage
      const scorePercent = Math.round(item.score * 100);

      // Truncate verse text for display
      const maxLength = 120;
      const snippet =
        item.verseText.length > maxLength
          ? item.verseText.substring(0, maxLength).trim() + '...'
          : item.verseText;

      return (
        <TouchableOpacity
          style={styles.resultItem}
          onPress={() => onSelectVerse(item)}
          activeOpacity={0.7}
        >
          <View style={styles.resultHeader}>
            <Text style={styles.bibleRef}>{item.bibleRef}</Text>
            <View style={styles.scoreBadge}>
              <Text style={styles.scoreText}>{scorePercent}%</Text>
            </View>
          </View>
          <Text style={styles.verseText} numberOfLines={3}>
            {snippet}
          </Text>
        </TouchableOpacity>
      );
    },
    [styles, onSelectVerse],
  );

  // Key extractor
  const keyExtractor = useCallback(
    (item: SemanticSearchResult) => item.verseId.toString(),
    [],
  );

  // Empty state
  if (!isLoading && results.length === 0 && query) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>No results found</Text>
        <Text style={styles.emptySubtitle}>
          Try rephrasing your question or using different keywords
        </Text>
      </View>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.text.primary} />
        <Text style={styles.loadingText}>Searching...</Text>
      </View>
    );
  }

  // Results header
  const ListHeader = () => (
    <View style={styles.headerContainer}>
      <Text style={styles.headerText}>
        Found {results.length} relevant {results.length === 1 ? 'verse' : 'verses'}
      </Text>
    </View>
  );

  return (
    <FlatList
      data={results}
      renderItem={renderResult}
      keyExtractor={keyExtractor}
      ListHeaderComponent={ListHeader}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
      initialNumToRender={10}
      maxToRenderPerBatch={10}
      windowSize={5}
    />
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    listContent: {
      paddingHorizontal: 16,
      paddingBottom: 20,
    },
    headerContainer: {
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
      marginBottom: 8,
    },
    headerText: {
      fontSize: 14,
      color: theme.colors.text.secondary,
      fontWeight: '500',
    },
    resultItem: {
      backgroundColor: theme.colors.background.elevated,
      borderRadius: 12,
      padding: 14,
      marginVertical: 6,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    resultHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    bibleRef: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.primary,
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
    verseText: {
      fontSize: 14,
      lineHeight: 20,
      color: theme.colors.text.primary,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 40,
      paddingVertical: 60,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.colors.text.primary,
      marginBottom: 8,
      textAlign: 'center',
    },
    emptySubtitle: {
      fontSize: 14,
      color: theme.colors.text.secondary,
      textAlign: 'center',
      lineHeight: 20,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 60,
    },
    loadingText: {
      marginTop: 12,
      fontSize: 14,
      color: theme.colors.text.secondary,
    },
  });
}
