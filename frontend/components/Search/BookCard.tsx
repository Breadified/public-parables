/**
 * BookCard - Individual book with expandable chapter/verse grid
 * Handles both chapter mode and verse mode with crossfade transition
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeOut, Easing } from 'react-native-reanimated';
import { NumberGrid } from './NumberGrid';
import type { Book, CategoryColors, DisplayMode } from './types';

interface BookCardProps {
  book: Book;
  categoryColors: CategoryColors;
  isExpanded: boolean;
  isVisible: boolean;
  isFiltering: boolean;
  isAnimating: boolean;
  prepareAnimations: boolean;
  displayMode: DisplayMode;
  numbers: number[]; // Either chapters or verses
  onToggle: (bookName: string) => void;
  onNumberSelect: (bookName: string, number: number) => void;
  layoutTransition: any;
  chapterLayoutTransition: any;
  theme: any;
  headerText: string; // "Genesis" or "Genesis 3" for verse mode
  selectedChapter?: number | null; // Chapter number when in verse mode
  onBackToChapters?: () => void; // Callback to return to chapter mode
  containerWidth?: number;
  scaleFactor?: number;
}

export const BookCard = React.memo(function BookCard({
  book,
  categoryColors,
  isExpanded,
  isVisible,
  isFiltering,
  isAnimating,
  prepareAnimations,
  displayMode,
  numbers,
  onToggle,
  onNumberSelect,
  layoutTransition,
  chapterLayoutTransition,
  theme,
  headerText,
  selectedChapter,
  onBackToChapters,
  containerWidth,
  scaleFactor,
}: BookCardProps) {
  if (!isVisible) {
    return null;
  }

  const shouldAttachLayout = prepareAnimations || isFiltering;
  const layoutProps = shouldAttachLayout ? {
    layout: layoutTransition,
    entering: FadeIn.duration(300).easing(Easing.out(Easing.ease)),
    exiting: FadeOut.duration(200).easing(Easing.in(Easing.ease)),
  } : {};

  const isVerseMode = displayMode === 'verses';

  return (
    <Animated.View {...layoutProps}>
      <View style={styles.card}>
        {/* Header with breadcrumb navigation */}
        <TouchableOpacity
          style={[
            styles.header,
            { backgroundColor: categoryColors.color },
            isExpanded && styles.headerExpanded
          ]}
          onPress={() => onToggle(book.name)}
          activeOpacity={0.7}
        >
          <View style={styles.breadcrumbContainer}>
            {isVerseMode && selectedChapter ? (
              // Verse mode: "Genesis › Chapter 3 - Select Verse"
              <View style={styles.breadcrumb}>
                <TouchableOpacity
                  onPress={onBackToChapters}
                  activeOpacity={0.7}
                  style={styles.breadcrumbSegment}
                >
                  <Text style={[styles.breadcrumbText, { color: theme.mode === 'dark' ? '#E5E7EB' : '#4B5563' }]}>
                    {book.name}
                  </Text>
                </TouchableOpacity>
                <Text style={[styles.breadcrumbSeparator, { color: theme.mode === 'dark' ? '#9CA3AF' : '#6B7280' }]}>
                  {' › '}
                </Text>
                <TouchableOpacity
                  onPress={() => onToggle(book.name)}
                  activeOpacity={0.7}
                  style={[styles.breadcrumbSegment, styles.breadcrumbActive]}
                >
                  <Text style={[styles.headerText, { color: theme.mode === 'dark' ? '#FFFFFF' : '#1F2937' }]}>
                    Chapter {selectedChapter}
                  </Text>
                </TouchableOpacity>
                <Text style={[styles.breadcrumbSeparator, { color: theme.mode === 'dark' ? '#9CA3AF' : '#6B7280' }]}>
                  {' - '}
                </Text>
                <Text style={[styles.headerText, { color: theme.mode === 'dark' ? '#FFFFFF' : '#1F2937' }]}>
                  Select Verse
                </Text>
              </View>
            ) : (
              // Chapter mode: "Genesis" or "Genesis - Select Chapter" (when expanded)
              <View style={styles.breadcrumb}>
                <TouchableOpacity
                  onPress={() => onToggle(book.name)}
                  activeOpacity={0.7}
                  style={styles.breadcrumbSegment}
                >
                  <Text style={[styles.headerText, { color: theme.mode === 'dark' ? '#FFFFFF' : '#1F2937' }]}>
                    {book.name}
                  </Text>
                </TouchableOpacity>
                {isExpanded && (
                  <>
                    <Text style={[styles.breadcrumbSeparator, { color: theme.mode === 'dark' ? '#9CA3AF' : '#6B7280' }]}>
                      {' - '}
                    </Text>
                    <Text style={[styles.modeLabel, { color: theme.mode === 'dark' ? '#D1D5DB' : '#6B7280' }]}>
                      Select Chapter
                    </Text>
                  </>
                )}
              </View>
            )}
          </View>
          <Text style={[styles.toggle, { color: theme.mode === 'dark' ? '#FFFFFF' : '#374151' }]}>
            {isExpanded ? '−' : '+'}
          </Text>
        </TouchableOpacity>

        {/* Grid */}
        {isExpanded && (
          <View style={[styles.gridContainer, { backgroundColor: categoryColors.bg }]}>
            <NumberGrid
              numbers={numbers}
              mode={displayMode}
              categoryColors={categoryColors}
              onSelect={(num) => onNumberSelect(book.name, num)}
              isExpanded={isExpanded}
              isFiltering={isFiltering}
              isAnimating={isAnimating}
              prepareAnimations={prepareAnimations}
              layoutTransition={chapterLayoutTransition}
              theme={theme}
              containerWidth={containerWidth}
              scaleFactor={scaleFactor}
            />
          </View>
        )}
      </View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    minHeight: 56,
    borderRadius: 12,
  },
  headerExpanded: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  breadcrumbContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  breadcrumb: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  breadcrumbSegment: {
    paddingVertical: 4,
  },
  breadcrumbActive: {
    // Active segment (current level)
  },
  breadcrumbText: {
    fontSize: 14,
    fontWeight: '500',
  },
  breadcrumbSeparator: {
    fontSize: 16,
    fontWeight: '400',
    marginHorizontal: 4,
  },
  headerText: {
    fontSize: 16,
    fontWeight: '600',
  },
  toggle: {
    fontSize: 18,
    fontWeight: '700',
    width: 24,
    textAlign: 'center',
  },
  gridContainer: {
    paddingTop: 0,
  },
  modeLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
});
