/**
 * Shared Bible Chapter Header Component
 * Used by SinglePaneBibleView and ChapterLevelBibleView for consistent chapter headers
 */

import React from 'react';
import { View, Text } from 'react-native';
import { type BibleStyles } from './BibleStyles';
import { getChapterPadding } from '@/utils/chapterPadding';

interface BibleChapterHeaderProps {
  chapterId: number;
  title: string; // "Genesis 1", "Psalm 23", etc.
  styles: BibleStyles;
}

/**
 * Renders a styled chapter header with special padding for first/last chapters
 */
export const BibleChapterHeader: React.FC<BibleChapterHeaderProps> = ({
  chapterId,
  title,
  styles,
}) => {
  const { paddingTop, paddingBottom } = getChapterPadding(chapterId);

  return (
    <View style={[styles.chapterHeader, { paddingTop, paddingBottom }]}>
      <Text style={styles.chapterTitle}>{title}</Text>
    </View>
  );
};
