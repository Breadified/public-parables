/**
 * GroupedSemanticResultsList - Display grouped semantic search results
 *
 * Uses FlashList for performance with PassageResultItem components.
 * Shows passages (e.g., "John 3:16-18") with expandable verse display.
 */

import React, { useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { FlashList } from '@shopify/flash-list';

import { useTheme } from '@/contexts/ThemeContext';
import type { Theme } from '@/config/theme';
import type { PassageSearchResult } from '@/modules/search/vectorSearch';
import { PassageResultItem } from './PassageResultItem';
import { useFlashListConfig, FlashListPresets } from '@/hooks/useFlashListConfig';

interface GroupedSemanticResultsListProps {
  results: PassageSearchResult[];
  isLoading: boolean;
  progressMessage?: string;
  query: string;
  hasSearched?: boolean; // Whether a search has ever completed
  onNavigate: (bookId: number, chapter: number, verse: number) => void;
}

export function GroupedSemanticResultsList({
  results,
  isLoading,
  progressMessage = '',
  query,
  hasSearched = false,
  onNavigate,
}: GroupedSemanticResultsListProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  // Memoize keyExtractor to prevent FlashList re-renders
  const keyExtractor = useCallback(
    (item: PassageSearchResult) =>
      `${item.bookId}-${item.chapter}-${item.startVerse}-${item.endVerse}`,
    [],
  );

  // FlashList config for search results
  const flashListConfig = useFlashListConfig({
    ...FlashListPresets.searchResults,
    keyExtractor,
  });

  // Render a single passage item
  const renderItem = useCallback(
    ({ item }: { item: PassageSearchResult }) => (
      <PassageResultItem passage={item} onNavigate={onNavigate} />
    ),
    [onNavigate],
  );

  // Loading state (active search in progress)
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.text.primary} />
        <Text style={styles.loadingText}>
          {progressMessage || 'Searching scripture...'}
        </Text>
      </View>
    );
  }

  // Empty state - only show if a search has actually completed
  if (results.length === 0 && query && hasSearched) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>No results found</Text>
        <Text style={styles.emptySubtitle}>
          Try rephrasing your question or using different keywords
        </Text>
      </View>
    );
  }

  // Initial state - search hasn't completed yet
  if (results.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.text.primary} />
        <Text style={styles.loadingText}>Searching scripture...</Text>
      </View>
    );
  }

  // Count total verses across all passages
  const totalVerses = results.reduce((sum, p) => sum + p.verseCount, 0);

  // Results header
  const ListHeader = () => (
    <View style={styles.headerContainer}>
      <Text style={styles.headerText}>
        Found {results.length} {results.length === 1 ? 'passage' : 'passages'} ({totalVerses} verses)
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
