/**
 * Multi-Pane System Types
 * Clean separation between independent and aligned pane modes
 */

/**
 * Supported pane types
 */
export enum PaneType {
  BIBLE_READER = 'BIBLE_READER',
  STUDY_NOTES = 'STUDY_NOTES',
  AI_COMMENTARY = 'AI_COMMENTARY',
  CROSS_REFERENCES = 'CROSS_REFERENCES',
}

/**
 * Pane linking modes
 * Determines how panes coordinate with each other
 */
export enum PaneLinkMode {
  INDEPENDENT = 'INDEPENDENT',         // Own FlashList, scrolls freely
  REFERENCE_LINKED = 'REFERENCE_LINKED', // Own FlashList, follows another pane's reference
  CONTENT_ALIGNED = 'CONTENT_ALIGNED',   // Shared FlashList, renders side-by-side
}

/**
 * Base pane configuration shared by all pane types
 */
export interface BasePaneState {
  id: string; // Unique pane identifier (UUID)
  type: PaneType;
  title: string; // Display title in pane header
  linkMode: PaneLinkMode;
  linkedPaneId?: string; // For REFERENCE_LINKED mode - which pane to follow
  createdAt: number; // Timestamp
  isPinned?: boolean; // Prevent accidental closure
}

/**
 * Bible reader pane state
 */
export interface BibleReaderPaneState extends BasePaneState {
  type: PaneType.BIBLE_READER;
  versionId: string; // e.g., 'ESV', 'WEB', 'NIV', 'KJV'
  currentChapterId: number; // e.g., 43003000 (John 3)
  scrollPosition: number; // FlashList Y offset
  selectedVerseId: number | null; // For highlighting
  bookName: string; // e.g., 'John'
  chapterNumber: number; // e.g., 3
}

/**
 * Study notes pane state
 */
export interface StudyNotesPaneState extends BasePaneState {
  type: PaneType.STUDY_NOTES;
  currentChapterId?: number; // For CONTENT_ALIGNED mode - chapter reference
  currentVerseId?: number; // Context verse for filtering/creating notes
  currentBookId?: number; // Book context
  filterTags?: string[]; // Filter notes by tags
  sortBy: 'date' | 'verse' | 'modified'; // Sort order
  isEditing: boolean; // Whether currently editing a note
  activeNoteId?: string; // Currently focused note
  formattingType: 'prose' | 'poetry' | 'custom'; // Formatting style for notes
}

/**
 * AI commentary pane state
 */
export interface AICommentaryPaneState extends BasePaneState {
  type: PaneType.AI_COMMENTARY;
  currentChapterId?: number; // For CONTENT_ALIGNED mode
  currentVerseId?: number; // Verse to generate commentary for
  commentaryType: 'explanation' | 'application' | 'cross_reference' | 'historical';
  isGenerating?: boolean; // Loading state
}

/**
 * Cross-references pane state
 */
export interface CrossReferencesPaneState extends BasePaneState {
  type: PaneType.CROSS_REFERENCES;
  currentChapterId?: number; // For CONTENT_ALIGNED mode
  currentVerseId?: number; // Source verse
  referenceType: 'direct' | 'thematic' | 'parallel';
  displayMode: 'list' | 'compact';
}

/**
 * Union type for all pane states
 */
export type PaneState =
  | BibleReaderPaneState
  | StudyNotesPaneState
  | AICommentaryPaneState
  | CrossReferencesPaneState;

/**
 * Layout configurations
 */
export enum LayoutType {
  SINGLE = 'SINGLE', // 1 pane fullscreen
  SPLIT_HORIZONTAL = 'SPLIT_HORIZONTAL', // 2 panes side-by-side
  SPLIT_VERTICAL = 'SPLIT_VERTICAL', // 2 panes top-bottom
  TRIPLE_HORIZONTAL = 'TRIPLE_HORIZONTAL', // 3 panes horizontal
  QUAD = 'QUAD', // 4 panes
}

/**
 * Pane dimension configuration
 */
export interface PaneDimensions {
  paneId: string;
  flex?: number; // Flex weight (for flexible layouts)
  width?: number; // Fixed width (pixels or percentage)
  height?: number; // Fixed height (pixels or percentage)
  minWidth?: number; // Minimum width constraint
  minHeight?: number; // Minimum height constraint
}

/**
 * Layout definition
 */
export interface Layout {
  id: string; // Unique layout identifier
  name: string; // Display name
  type: LayoutType;
  paneIds: string[]; // Ordered list of panes in this layout
  dimensions: PaneDimensions[]; // Dimension config for each pane
  orientation?: 'portrait' | 'landscape' | 'both'; // Device orientation support
}

/**
 * Multi-pane store state
 */
export interface MultiPaneStoreState {
  // Pane registry
  panes: Record<string, PaneState>; // Map of paneId → pane state
  paneOrder: string[]; // Ordered list of pane IDs (render order)

  // Layout management
  layouts: Record<string, Layout>; // Map of layoutId → layout
  currentLayoutId: string | null; // Active layout ID

  // Focus and interaction
  activePaneId: string | null; // Currently focused pane

  // UI state
  showPaneControls: boolean; // Show/hide pane control UI
}

/**
 * Pane creation options
 */
export interface CreatePaneOptions {
  type: PaneType;
  title?: string; // Override default title
  isPinned?: boolean;
  linkMode?: PaneLinkMode; // Default: INDEPENDENT
  linkedPaneId?: string; // For REFERENCE_LINKED mode
  // Type-specific options
  versionId?: string; // For BIBLE_READER
  chapterId?: number; // For BIBLE_READER or CONTENT_ALIGNED panes
  commentaryType?: AICommentaryPaneState['commentaryType'];
  sortBy?: StudyNotesPaneState['sortBy'];
  referenceType?: CrossReferencesPaneState['referenceType'];
}

/**
 * Layout creation options
 */
export interface CreateLayoutOptions {
  type: LayoutType;
  paneIds?: string[]; // Use existing panes
  name?: string; // Custom name
  orientation?: Layout['orientation'];
}
