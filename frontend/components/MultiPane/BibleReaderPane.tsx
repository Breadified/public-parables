/**
 * BibleReaderPane - Bible reader for independent/reference-linked panes
 *
 * Wraps ChapterLevelBibleView for multi-pane mode
 * Each instance gets its own FlashList (not aligned)
 */

import React, { useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { observer } from '@legendapp/state/react';
import { BibleReaderPaneState } from '../../types/multiPane';
import { updateBibleReaderChapter } from '../../state/multiPaneStore';
import { ChapterLevelBibleView } from '../ChapterLevelBibleView';

interface BibleReaderPaneProps {
  pane: BibleReaderPaneState;
  isActive?: boolean;
  isTabActive?: boolean;
  onChapterChange?: (chapterId: number, bookName: string, chapterNumber: number) => void;
}

/**
 * Bible Reader Pane Component
 * Independent FlashList for multi-pane mode
 */
export const BibleReaderPane = observer(({
  pane,
  isActive = true,
  isTabActive = true,
  onChapterChange,
}: BibleReaderPaneProps) => {
  console.log('[BibleReaderPane] Render:', {
    paneId: pane.id,
    versionId: pane.versionId,
    chapterId: pane.currentChapterId,
    isActive,
  });

  // Handle chapter changes from viewer
  const handleChapterChange = useCallback(
    (chapterId: number, bookName: string, chapterNumber: number) => {
      // Update pane state in store
      updateBibleReaderChapter(pane.id, chapterId, bookName, chapterNumber);

      // Notify parent if provided
      if (onChapterChange) {
        onChapterChange(chapterId, bookName, chapterNumber);
      }
    },
    [pane.id, onChapterChange]
  );

  return (
    <View style={styles.container}>
      <ChapterLevelBibleView
        chapterId={pane.currentChapterId}
        versionId={pane.versionId}
        isActive={isActive && isTabActive}
        onChapterChange={handleChapterChange}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
