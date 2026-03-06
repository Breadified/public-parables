/**
 * Multi-Pane Store
 * Manages pane states, layouts, and pane relationships
 */

import { observable } from '@legendapp/state';
import {
  MultiPaneStoreState,
  PaneState,
  Layout,
  LayoutType,
  PaneType,
  PaneLinkMode,
  CreatePaneOptions,
  CreateLayoutOptions,
  BibleReaderPaneState,
  StudyNotesPaneState,
} from '../types/multiPane';

/**
 * Initialize empty multi-pane store
 */
export const multiPaneStore$ = observable<MultiPaneStoreState>({
  panes: {},
  paneOrder: [],
  layouts: {},
  currentLayoutId: null,
  activePaneId: null,
  showPaneControls: false,
});

// ============================================================================
// Pane Management
// ============================================================================

/**
 * Create a new pane
 */
export function createPane(options: CreatePaneOptions): PaneState {
  const id = generatePaneId();
  const now = Date.now();

  let pane: PaneState;

  switch (options.type) {
    case PaneType.BIBLE_READER:
      pane = {
        id,
        type: PaneType.BIBLE_READER,
        title: options.title || `${options.versionId || 'Bible'}`,
        linkMode: options.linkMode || PaneLinkMode.INDEPENDENT,
        linkedPaneId: options.linkedPaneId,
        createdAt: now,
        isPinned: options.isPinned || false,
        versionId: options.versionId || 'ESV',
        currentChapterId: options.chapterId || 1001000, // Genesis 1
        scrollPosition: 0,
        selectedVerseId: null,
        bookName: 'Genesis',
        chapterNumber: 1,
      } as BibleReaderPaneState;
      break;

    case PaneType.STUDY_NOTES:
      pane = {
        id,
        type: PaneType.STUDY_NOTES,
        title: options.title || 'Study Notes',
        linkMode: options.linkMode || PaneLinkMode.CONTENT_ALIGNED,
        linkedPaneId: options.linkedPaneId,
        createdAt: now,
        isPinned: options.isPinned || false,
        currentChapterId: options.chapterId,
        sortBy: options.sortBy || 'date',
      } as StudyNotesPaneState;
      break;

    default:
      throw new Error(`Unsupported pane type: ${options.type}`);
  }

  // Add to store
  multiPaneStore$.panes[id].set(pane);
  multiPaneStore$.paneOrder.push(id);

  return pane;
}

/**
 * Remove a pane
 */
export function removePane(paneId: string): void {
  // Remove from panes map (use set(undefined) for Legend State)
  const panes = multiPaneStore$.panes.get();
  const { [paneId]: removed, ...remainingPanes } = panes;
  multiPaneStore$.panes.set(remainingPanes);

  // Remove from order array
  const order = multiPaneStore$.paneOrder.get();
  multiPaneStore$.paneOrder.set(order.filter(id => id !== paneId));

  // If this was active pane, clear active
  if (multiPaneStore$.activePaneId.get() === paneId) {
    multiPaneStore$.activePaneId.set(null);
  }

  // Update layouts that reference this pane
  const layouts = multiPaneStore$.layouts.get();
  Object.values(layouts).forEach(layout => {
    if (layout.paneIds.includes(paneId)) {
      const updatedPaneIds = layout.paneIds.filter(id => id !== paneId);
      multiPaneStore$.layouts[layout.id].paneIds.set(updatedPaneIds);
    }
  });
}

/**
 * Update pane's link mode and target
 */
export function updatePaneLink(
  paneId: string,
  linkMode: PaneLinkMode,
  linkedPaneId?: string
): void {
  const pane = multiPaneStore$.panes[paneId].get();
  if (!pane) return;

  multiPaneStore$.panes[paneId].linkMode.set(linkMode);
  multiPaneStore$.panes[paneId].linkedPaneId.set(linkedPaneId);
}

/**
 * Update Bible reader pane chapter
 */
export function updateBibleReaderChapter(
  paneId: string,
  chapterId: number,
  bookName: string,
  chapterNumber: number
): void {
  const pane = multiPaneStore$.panes[paneId].get();
  if (!pane || pane.type !== PaneType.BIBLE_READER) return;

  multiPaneStore$.panes[paneId].set({
    ...pane,
    currentChapterId: chapterId,
    bookName,
    chapterNumber,
  } as BibleReaderPaneState);
}

/**
 * Update Bible reader pane selected verse
 */
export function updateBibleReaderVerse(
  paneId: string,
  verseId: number | null
): void {
  const pane = multiPaneStore$.panes[paneId].get();
  if (!pane || pane.type !== PaneType.BIBLE_READER) return;

  (multiPaneStore$.panes[paneId] as any).selectedVerseId.set(verseId);
}

/**
 * Set active pane
 */
export function setActivePane(paneId: string | null): void {
  multiPaneStore$.activePaneId.set(paneId);
}

// ============================================================================
// Layout Management
// ============================================================================

/**
 * Create a new layout
 */
export function createLayout(options: CreateLayoutOptions): Layout {
  const id = generateLayoutId();

  const layout: Layout = {
    id,
    name: options.name || getDefaultLayoutName(options.type),
    type: options.type,
    paneIds: options.paneIds || [],
    dimensions: (options.paneIds || []).map(paneId => ({
      paneId,
      flex: 1, // Default: equal split
    })),
    orientation: options.orientation || 'both',
  };

  multiPaneStore$.layouts[id].set(layout);

  return layout;
}

/**
 * Set current layout
 */
export function setLayout(layoutId: string): void {
  multiPaneStore$.currentLayoutId.set(layoutId);
}

/**
 * Get current layout
 */
export function getCurrentLayout(): Layout | null {
  const layoutId = multiPaneStore$.currentLayoutId.get();
  return layoutId ? multiPaneStore$.layouts[layoutId].get() : null;
}

/**
 * Get active panes (panes in current layout)
 */
export function getActivePanes(): PaneState[] {
  const layout = getCurrentLayout();
  if (!layout) return [];

  return layout.paneIds
    .map(id => multiPaneStore$.panes[id].get())
    .filter((pane): pane is PaneState => pane !== undefined);
}

/**
 * Get panes by link mode
 */
export function getPanesByLinkMode(linkMode: PaneLinkMode): PaneState[] {
  const panes = getActivePanes();
  return panes.filter(pane => pane.linkMode === linkMode);
}

/**
 * Get content-aligned pane groups
 * Returns groups of 2+ panes that should render in unified FlashList
 */
export function getContentAlignedGroups(): PaneState[][] {
  const alignedPanes = getPanesByLinkMode(PaneLinkMode.CONTENT_ALIGNED);

  // For now, simple logic: if 2+ aligned panes exist, return them as one group
  // Future: support multiple aligned groups
  if (alignedPanes.length >= 2) {
    return [alignedPanes];
  }

  return [];
}

// ============================================================================
// Preset Layouts
// ============================================================================

/**
 * Initialize study mode layout (ESV + NIV verse-aligned)
 */
export function initializeStudyMode(
  leftVersionId: string = 'ESV',
  rightVersionId: string = 'WEB',
  chapterId: number = 1001000
): void {
  // Create two Bible reader panes in CONTENT_ALIGNED mode
  const leftPane = createPane({
    type: PaneType.BIBLE_READER,
    title: leftVersionId,
    versionId: leftVersionId,
    chapterId,
    linkMode: PaneLinkMode.CONTENT_ALIGNED,
  });

  const rightPane = createPane({
    type: PaneType.BIBLE_READER,
    title: rightVersionId,
    versionId: rightVersionId,
    chapterId,
    linkMode: PaneLinkMode.CONTENT_ALIGNED,
  });

  // Create horizontal split layout
  const layout = createLayout({
    type: LayoutType.SPLIT_HORIZONTAL,
    paneIds: [leftPane.id, rightPane.id],
    name: 'Study Mode',
    orientation: 'both',
  });

  // Set as current layout
  setLayout(layout.id);

  // Set first pane as active
  setActivePane(leftPane.id);
}

/**
 * Initialize multi-pane mode (Bible + Notes)
 */
export function initializeMultiPaneMode(
  versionId: string = 'ESV',
  chapterId: number = 1001000
): void {
  // Create Bible reader pane
  const biblePane = createPane({
    type: PaneType.BIBLE_READER,
    title: versionId,
    versionId,
    chapterId,
    linkMode: PaneLinkMode.INDEPENDENT,
  });

  // Create notes pane in CONTENT_ALIGNED mode with chapter reference
  const notesPane = createPane({
    type: PaneType.STUDY_NOTES,
    title: 'Notes',
    chapterId,
    linkMode: PaneLinkMode.CONTENT_ALIGNED,
  });

  // Create horizontal split layout
  const layout = createLayout({
    type: LayoutType.SPLIT_HORIZONTAL,
    paneIds: [biblePane.id, notesPane.id],
    name: 'Bible + Notes',
    orientation: 'both',
  });

  // Set as current layout
  setLayout(layout.id);

  // Set Bible pane as active
  setActivePane(biblePane.id);
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Generate unique pane ID
 */
function generatePaneId(): string {
  return `pane-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate unique layout ID
 */
function generateLayoutId(): string {
  return `layout-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get default layout name
 */
function getDefaultLayoutName(type: LayoutType): string {
  switch (type) {
    case LayoutType.SINGLE:
      return 'Single Pane';
    case LayoutType.SPLIT_HORIZONTAL:
      return 'Split Horizontal';
    case LayoutType.SPLIT_VERTICAL:
      return 'Split Vertical';
    case LayoutType.TRIPLE_HORIZONTAL:
      return 'Triple Horizontal';
    case LayoutType.QUAD:
      return 'Quad';
    default:
      return 'Custom Layout';
  }
}

/**
 * Clear all panes and layouts (for testing/reset)
 */
export function resetMultiPaneStore(): void {
  multiPaneStore$.set({
    panes: {},
    paneOrder: [],
    layouts: {},
    currentLayoutId: null,
    activePaneId: null,
    showPaneControls: false,
  });
}
