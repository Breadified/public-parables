/**
 * PaneContainer - Wrapper for individual panes
 *
 * Responsibilities:
 * - Renders appropriate pane component based on type
 * - Handles reference linking for REFERENCE_LINKED panes
 * - Each pane gets its own FlashList in multi-pane mode
 */

import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { observer, useSelector } from '@legendapp/state/react';
import { useTheme } from '../../contexts/ThemeContext';
import { multiPaneStore$ } from '../../state/multiPaneStore';
import {
  PaneState,
  PaneType,
  PaneLinkMode,
  BibleReaderPaneState,
  StudyNotesPaneState,
} from '../../types/multiPane';
import { BibleReaderPane } from './BibleReaderPane';
import { StudyNotesPane } from './StudyNotesPane';
// Import other pane types as they're implemented
// import { AICommentaryPane } from './AICommentaryPane';

interface PaneContainerProps {
  pane: PaneState;
  isActive?: boolean;
  isTabActive?: boolean;
  onChapterChange?: (chapterId: number, bookName: string, chapterNumber: number) => void;
}

/**
 * PaneContainer Component
 * Wraps individual panes and handles reference linking
 */
export const PaneContainer = observer(({
  pane,
  isActive = true,
  isTabActive = true,
  onChapterChange,
}: PaneContainerProps) => {
  const { theme } = useTheme();

  // For REFERENCE_LINKED panes, watch the linked pane for updates
  const linkedPane = pane.linkedPaneId
    ? useSelector(() => multiPaneStore$.panes[pane.linkedPaneId!].get())
    : null;

  console.log('[PaneContainer] Render:', {
    paneId: pane.id,
    type: pane.type,
    linkMode: pane.linkMode,
    linkedPaneId: pane.linkedPaneId,
    isActive,
  });

  // Handle reference linking
  useEffect(() => {
    if (pane.linkMode !== PaneLinkMode.REFERENCE_LINKED || !linkedPane) {
      return;
    }

    // If linked pane is a Bible reader, sync to its chapter/verse
    if (linkedPane.type === PaneType.BIBLE_READER) {
      const biblePane = linkedPane as BibleReaderPaneState;

      console.log('[PaneContainer] Reference-linked update:', {
        targetPaneId: pane.id,
        sourcePaneId: linkedPane.id,
        chapterId: biblePane.currentChapterId,
        verseId: biblePane.selectedVerseId,
      });

      // Update this pane's reference (implementation depends on pane type)
      // For now, just log - specific pane components will handle their own updates
    }
  }, [
    pane.linkMode,
    pane.id,
    linkedPane?.type,
    (linkedPane as BibleReaderPaneState)?.currentChapterId,
    (linkedPane as BibleReaderPaneState)?.selectedVerseId,
  ]);

  // Render appropriate pane component based on type
  switch (pane.type) {
    case PaneType.BIBLE_READER:
      return (
        <BibleReaderPane
          pane={pane as BibleReaderPaneState}
          isActive={isActive}
          isTabActive={isTabActive}
          onChapterChange={onChapterChange}
        />
      );

    case PaneType.STUDY_NOTES:
      return (
        <StudyNotesPane
          pane={pane as StudyNotesPaneState}
          isActive={isActive}
          isTabActive={isTabActive}
        />
      );

    case PaneType.AI_COMMENTARY:
      // TODO: Implement AICommentaryPane
      return (
        <View style={[styles.placeholder, { backgroundColor: theme.colors.background.primary }]}>
          {/* <AICommentaryPane pane={pane} isActive={isActive} /> */}
        </View>
      );

    case PaneType.CROSS_REFERENCES:
      // TODO: Implement CrossReferencesPane
      return (
        <View style={[styles.placeholder, { backgroundColor: theme.colors.background.primary }]}>
          {/* <CrossReferencesPane pane={pane} isActive={isActive} /> */}
        </View>
      );

    default:
      return <View style={[styles.placeholder, { backgroundColor: theme.colors.background.primary }]} />;
  }
});

const styles = StyleSheet.create({
  placeholder: {
    flex: 1,
  },
});
