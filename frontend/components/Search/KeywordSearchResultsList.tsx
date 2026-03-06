/**
 * KeywordSearchResultsList - Display keyword/text search results
 *
 * Shows verses matching the search query with highlighted text.
 */

import React, { useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { FlashList } from '@shopify/flash-list';

import { useTheme } from '@/contexts/ThemeContext';
import type { Theme } from '@/config/theme';
import type { SearchResult } from '@/modules/bible/searchEngine';
import { useFlashListConfig, FlashListPresets } from '@/hooks/useFlashListConfig';
import { BOOK_IDS } from './constants';

interface KeywordSearchResultsListProps {
  results: SearchResult[];
  isLoading: boolean;
  query: string;
  onNavigate: (bookId: number, chapter: number, verse: number) => void;
}

export function KeywordSearchResultsList({
  results,
  isLoading,
  query,
  onNavigate,
}: KeywordSearchResultsListProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  // Memoize keyExtractor to prevent FlashList re-renders
  const keyExtractor = useCallback(
    (item: SearchResult, index: number) =>
      `${item.reference}-${index}`,
    [],
  );

  // FlashList config
  const flashListConfig = useFlashListConfig({
    ...FlashListPresets.searchResults,
    keyExtractor,
  });

  // Render a single verse result item
  const renderItem = useCallback(
    ({ item }: { item: SearchResult }) => (
      <KeywordResultItem result={item} onNavigate={onNavigate} theme={theme} />
    ),
    [onNavigate, theme],
  );

  // Empty state
  if (!isLoading && results.length === 0 && query) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>No verses found</Text>
        <Text style={styles.emptySubtitle}>
          Try different keywords or check your spelling
        </Text>
      </View>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.text.primary} />
        <Text style={styles.loadingText}>Searching verses...</Text>
      </View>
    );
  }

  // Results header
  const ListHeader = () => (
    <View style={styles.headerContainer}>
      <Text style={styles.headerText}>
        Found {results.length} {results.length === 1 ? 'verse' : 'verses'}
      </Text>
    </View>
  );

  return (
    <FlashList
      data={results}
      renderItem={renderItem}
      {...flashListConfig.props}
      ListHeaderComponent={ListHeader}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
    />
  );
}

// Individual result item component
interface KeywordResultItemProps {
  result: SearchResult;
  onNavigate: (bookId: number, chapter: number, verse: number) => void;
  theme: Theme;
}

function KeywordResultItem({ result, onNavigate, theme }: KeywordResultItemProps) {
  const styles = useMemo(() => createItemStyles(theme), [theme]);

  const handlePress = useCallback(() => {
    // Get book ID from book name
    const bookId = BOOK_IDS[result.book];
    if (bookId) {
      onNavigate(bookId, result.chapter, result.verse.verse_number);
    }
  }, [result.book, result.chapter, result.verse.verse_number, onNavigate]);

  // Render highlighted text (convert **text** to bold spans)
  const renderHighlightedText = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        // Remove ** markers and render as highlighted
        const highlightedWord = part.slice(2, -2);
        return (
          <Text key={index} style={styles.highlightedWord}>
            {highlightedWord}
          </Text>
        );
      }
      return <Text key={index}>{part}</Text>;
    });
  };

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <Text style={styles.reference}>{result.reference}</Text>
      <Text style={styles.verseText} numberOfLines={3}>
        {renderHighlightedText(result.highlightedText)}
      </Text>
    </TouchableOpacity>
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

function createItemStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      paddingVertical: 12,
      paddingHorizontal: 4,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    reference: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.text.primary,
      marginBottom: 4,
    },
    verseText: {
      fontSize: 14,
      color: theme.colors.text.secondary,
      lineHeight: 20,
    },
    highlightedWord: {
      backgroundColor: theme.colors.highlightColors.yellow.bg,
      color: theme.colors.text.primary,
      fontWeight: '500',
    },
  });
}
