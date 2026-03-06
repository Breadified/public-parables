/**
 * MultiPaneContainer - Main orchestrator for multi-pane viewing
 *
 * Responsibilities:
 * - Detects pane link modes and renders accordingly
 * - CONTENT_ALIGNED panes → Single unified FlashList
 * - INDEPENDENT/REFERENCE_LINKED panes → Multiple separate FlashLists
 */

import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { observer, useSelector } from '@legendapp/state/react';
import { useTheme } from '../../contexts/ThemeContext';
import {
  multiPaneStore$,
  getCurrentLayout,
  getActivePanes,
  getContentAlignedGroups,
} from '../../state/multiPaneStore';
import {
  LayoutType,
  PaneState,
  PaneLinkMode,
  PaneType,
  BibleReaderPaneState,
} from '../../types/multiPane';
import { PaneContainer } from './PaneContainer';
import { VerseAlignedSplitView } from './VerseAlignedSplitView';

interface MultiPaneContainerProps {
  isActive?: boolean;
  onChapterChange?: (chapterId: number, bookName: string, chapterNumber: number) => void;
}

/**
 * MultiPaneContainer Component
 * Orchestrates rendering of panes based on their link modes
 */
export const MultiPaneContainer = observer(({
  isActive = true,
  onChapterChange,
}: MultiPaneContainerProps) => {
  const { theme } = useTheme();

  // Reactive store selectors
  const currentLayoutId = useSelector(multiPaneStore$.currentLayoutId);
  const activePaneId = useSelector(multiPaneStore$.activePaneId);

  // Get current layout and active panes
  const layout = getCurrentLayout();
  const panes = getActivePanes();

  console.log('[MultiPaneContainer] Render:', {
    hasLayout: !!layout,
    layoutType: layout?.type,
    paneCount: panes.length,
    paneIds: panes.map(p => p.id),
    currentLayoutId,
  });

  // Detect content-aligned groups (for unified rendering)
  const alignedGroups = useMemo(() => getContentAlignedGroups(), [panes]);

  // Check if ALL panes are content-aligned Bible readers (study mode)
  const isStudyMode = useMemo(() => {
    if (panes.length !== 2) return false;

    const allAligned = panes.every(p => p.linkMode === PaneLinkMode.CONTENT_ALIGNED);
    const allBibleReaders = panes.every(p => p.type === PaneType.BIBLE_READER);

    return allAligned && allBibleReaders;
  }, [panes]);

  // Fallback for no layout
  if (!layout || panes.length === 0) {
    return (
      <View style={[styles.fallbackContainer, { backgroundColor: theme.colors.background.primary }]}>
        <View style={styles.fallbackMessage}>
          {/* Empty state or single pane fallback */}
        </View>
      </View>
    );
  }

  // STUDY MODE: All panes are content-aligned Bible readers
  // Use single unified FlashList
  if (isStudyMode && alignedGroups.length > 0) {
    const bibleReaderPanes = panes as BibleReaderPaneState[];

    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background.primary }]}>
        <VerseAlignedSplitView
          leftPane={bibleReaderPanes[0]}
          rightPane={bibleReaderPanes[1]}
          isActive={isActive}
          onChapterChange={onChapterChange}
        />
      </View>
    );
  }

  // MULTI-PANE MODE: Panes are independent or reference-linked
  // Each pane gets its own FlashList
  const layoutContainerStyle = getLayoutStyle(layout.type);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background.primary }]}>
      <View style={[styles.layoutContainer, layoutContainerStyle]}>
        {panes.map((pane, index) => {
          const dimensions = getPaneDimensions(layout, pane.id);
          const isPaneActive = activePaneId === pane.id;
          const isNotLast = index < panes.length - 1;

          return (
            <View
              key={pane.id}
              style={[
                dimensions,
                styles.paneWrapper,
                isNotLast && { borderRightColor: theme.colors.border, borderBottomColor: theme.colors.border },
                isNotLast && styles.paneWithSeparator,
              ]}
            >
              <PaneContainer
                pane={pane}
                isActive={isPaneActive}
                isTabActive={isActive}
                onChapterChange={onChapterChange}
              />
            </View>
          );
        })}
      </View>
    </View>
  );
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get layout style based on layout type
 */
function getLayoutStyle(type: LayoutType) {
  switch (type) {
    case LayoutType.SINGLE:
      return styles.singlePane;
    case LayoutType.SPLIT_HORIZONTAL:
      return styles.splitHorizontal;
    case LayoutType.SPLIT_VERTICAL:
      return styles.splitVertical;
    case LayoutType.TRIPLE_HORIZONTAL:
      return styles.tripleHorizontal;
    case LayoutType.QUAD:
      return styles.quad;
    default:
      return styles.singlePane;
  }
}

/**
 * Get pane dimensions from layout
 */
function getPaneDimensions(layout: any, paneId: string) {
  const paneDim = layout.dimensions.find((d: any) => d.paneId === paneId);
  if (!paneDim) return { flex: 1 };

  const style: any = {};

  if (paneDim.flex !== undefined) {
    style.flex = paneDim.flex;
  }

  if (paneDim.width !== undefined) {
    style.width = paneDim.width;
  }

  if (paneDim.height !== undefined) {
    style.height = paneDim.height;
  }

  if (paneDim.minWidth !== undefined) {
    style.minWidth = paneDim.minWidth;
  }

  if (paneDim.minHeight !== undefined) {
    style.minHeight = paneDim.minHeight;
  }

  return style;
}

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  layoutContainer: {
    flex: 1,
  },
  paneWrapper: {
    overflow: 'hidden',
  },
  paneWithSeparator: {
    borderRightWidth: 1,
    borderBottomWidth: 1,
  },
  fallbackContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fallbackMessage: {
    padding: 20,
  },

  // Layout-specific styles
  singlePane: {
    flexDirection: 'column',
  },
  splitHorizontal: {
    flexDirection: 'row',
  },
  splitVertical: {
    flexDirection: 'column',
  },
  tripleHorizontal: {
    flexDirection: 'row',
  },
  quad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});
