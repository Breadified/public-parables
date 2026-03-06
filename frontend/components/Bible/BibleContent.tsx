/**
 * BibleContent - Universal Bible rendering component
 *
 * A single component that handles all Bible content rendering modes:
 * - chapter: Full chapter rendering with ChapterSelectableText
 * - paragraph: Single paragraph with SelectableTextView
 * - verses: Auto-grouped verse lines with BibleVersesRenderer
 *
 * Uses BibleRenderingContext for styles and BibleActionsContext for actions.
 *
 * @example
 * ```tsx
 * // Chapter mode (full chapter)
 * <BibleContent
 *   mode="chapter"
 *   data={{ sections: styledSections, chapterKey: 'ch-1001001' }}
 *   highlights={chapterHighlights}
 *   onMeasuredHeight={(key, height) => cache.setHeight(key, height)}
 * />
 *
 * // Verses mode (verse lines - auto-groups by paragraph)
 * <BibleContent
 *   mode="verses"
 *   data={{ verseLines }}
 *   showVerseNumbers={true}
 * />
 *
 * // Paragraph mode (single paragraph)
 * <BibleContent
 *   mode="paragraph"
 *   data={{ verseLines, isPoetry: false }}
 * />
 * ```
 */

import React, { useCallback } from 'react';
import { ChapterSelectableText, type ChapterSelectionEvent, type StyledSection } from '../../modules/expo-selectable-text';
import { BibleContentRenderer, type TextActionEvent } from './BibleContentRenderer';
import { BibleVersesRenderer } from './BibleVersesRenderer';
import { useBibleRendering } from '../../contexts/BibleRenderingContext';
import { useBibleActionsOptional } from '../../contexts/BibleActionsContext';
import { extractVerseLinesForIds } from '../../modules/bible/chapterDataTransform';
import type { VerseLine } from '../../services/sqlite';
import type { VerseHighlight } from '../../state/notesStore';

// ============================================================================
// Types
// ============================================================================

/**
 * Rendering modes for BibleContent
 */
export type BibleContentMode = 'chapter' | 'paragraph' | 'verses';

/**
 * Chapter mode data - full chapter with styled sections
 */
export interface ChapterModeData {
  /**
   * Pre-styled sections from chapterDataTransform
   */
  sections: StyledSection[];
  /**
   * Unique key for the chapter (for height caching)
   */
  chapterKey: string;
  /**
   * Original sections for verse extraction (optional, for action handling)
   */
  originalSections?: any[];
  /**
   * Book name for action context
   */
  bookName?: string;
  /**
   * Chapter number for action context
   */
  chapterNumber?: number;
  /**
   * Chapter ID for action context
   */
  chapterId?: number;
}

/**
 * Paragraph mode data - single paragraph
 */
export interface ParagraphModeData {
  /**
   * Verse lines in the paragraph
   */
  verseLines: VerseLine[];
  /**
   * Whether this paragraph is poetry
   */
  isPoetry: boolean;
  /**
   * Unique key for measurement (optional)
   */
  paragraphKey?: string;
}

/**
 * Verses mode data - multiple verse lines (auto-grouped)
 */
export interface VersesModeData {
  /**
   * Verse lines to render
   */
  verseLines: VerseLine[];
}

/**
 * Highlight data for chapter mode
 */
export interface ChapterHighlight {
  verseId: number;
  color: string;
}

// ============================================================================
// Props
// ============================================================================

interface BibleContentBaseProps {
  /**
   * Show verse numbers (default: true)
   */
  showVerseNumbers?: boolean;

  /**
   * Compact mode - reduced spacing for inline/popup views
   */
  compact?: boolean;

  /**
   * Selected verse ID for highlighting (search results)
   */
  selectedVerseId?: number | null;

  /**
   * Verse range to highlight (for BiblePeek)
   */
  highlightRange?: { start: number; end: number } | null;

  /**
   * Persisted verse highlights
   */
  persistedHighlights?: VerseHighlight[];

  /**
   * Callback when height is measured (for FlashList)
   */
  onMeasuredHeight?: (key: string, height: number) => void;

  /**
   * Direct height callback (for alignment)
   */
  onHeight?: (height: number) => void;
}

interface ChapterModeProps extends BibleContentBaseProps {
  mode: 'chapter';
  data: ChapterModeData;
  /**
   * Pre-computed highlights for the chapter (verseId + hex color)
   */
  highlights?: ChapterHighlight[];
  /**
   * Custom action handler (bypasses context)
   */
  onAction?: (event: { nativeEvent: ChapterSelectionEvent }) => void;
}

interface ParagraphModeProps extends BibleContentBaseProps {
  mode: 'paragraph';
  data: ParagraphModeData;
  /**
   * Custom action handler (bypasses context)
   */
  onAction?: (event: TextActionEvent) => void;
}

interface VersesModeProps extends BibleContentBaseProps {
  mode: 'verses';
  data: VersesModeData;
  /**
   * Gap between paragraphs (default: 16)
   */
  paragraphGap?: number;
  /**
   * Custom action handler (bypasses context)
   */
  onAction?: (event: TextActionEvent) => void;
}

export type BibleContentProps = ChapterModeProps | ParagraphModeProps | VersesModeProps;

// ============================================================================
// Component
// ============================================================================

export const BibleContent: React.FC<BibleContentProps> = (props) => {
  const {
    mode,
    data,
    showVerseNumbers = true,
    compact = false,
    selectedVerseId = null,
    highlightRange = null,
    persistedHighlights = [],
    onMeasuredHeight,
    onHeight,
  } = props;

  // Get rendering configuration from context
  const { bibleStyles, styleSpec, colors } = useBibleRendering();

  // Try to get action handling from context (optional)
  const bibleActions = useBibleActionsOptional();

  // Cast props for type safety (used in callbacks)
  const chapterProps = props as ChapterModeProps;
  const paragraphProps = props as ParagraphModeProps;
  const versesProps = props as VersesModeProps;

  // Extract data fields (with fallbacks for type safety)
  const chapterData = mode === 'chapter' ? (data as ChapterModeData) : null;
  const paragraphData = mode === 'paragraph' ? (data as ParagraphModeData) : null;
  const versesData = mode === 'verses' ? (data as VersesModeData) : null;

  // ============================================================================
  // Callbacks (must be defined before conditionals)
  // ============================================================================

  // Handle action from ChapterSelectableText
  const handleChapterAction = useCallback(
    async (event: { nativeEvent: ChapterSelectionEvent }) => {
      // If custom handler provided, use it
      if (chapterProps.onAction) {
        chapterProps.onAction(event);
        return;
      }

      // Otherwise use context if available
      if (bibleActions && chapterData) {
        const { sections, originalSections, bookName, chapterNumber, chapterId } = chapterData;
        if (originalSections && bookName && chapterNumber !== undefined && chapterId !== undefined) {
          // Map selection to verse IDs using section boundaries
          const verseIds: number[] = [];
          let currentPos = 0;
          for (const section of sections) {
            const sectionEnd = currentPos + section.text.length;
            // Check if selection overlaps with this section
            if (currentPos < event.nativeEvent.selectionEnd && sectionEnd > event.nativeEvent.selectionStart) {
              // Add all verses in this section's range
              if (section.verseStart !== undefined) {
                const verseEnd = section.verseEnd ?? section.verseStart;
                for (let v = section.verseStart; v <= verseEnd; v++) {
                  if (!verseIds.includes(v)) {
                    verseIds.push(v);
                  }
                }
              }
            }
            currentPos = sectionEnd;
          }

          // Extract verse lines for the selected verse IDs
          const verseLines = extractVerseLinesForIds(originalSections, verseIds);

          await bibleActions.handleTextAction(
            event.nativeEvent.action as 'copy' | 'share' | 'note' | 'highlight' | 'bookmark',
            verseIds,
            verseLines,
            { bookName, chapterNumber, chapterId }
          );
        }
      }
    },
    [chapterProps.onAction, bibleActions, chapterData]
  );

  // Handle action from BibleContentRenderer (paragraph mode)
  const handleParagraphAction = useCallback(
    async (event: TextActionEvent) => {
      // If custom handler provided, use it
      if (paragraphProps.onAction) {
        paragraphProps.onAction(event);
        return;
      }

      // Otherwise use context if available
      if (bibleActions && event.verseLines.length > 0) {
        const verseIds = event.verseLines
          .map(line => line.verse_id)
          .filter((id): id is number => id !== undefined);

        if (verseIds.length > 0) {
          const firstVerseId = verseIds[0];
          const chapterId = Math.floor(firstVerseId / 1000) * 1000;
          const chapterNum = Math.floor((firstVerseId % 1000000) / 1000);

          await bibleActions.handleTextAction(
            event.action as 'copy' | 'share' | 'note' | 'highlight' | 'bookmark',
            verseIds,
            event.verseLines,
            { bookName: '', chapterNumber: chapterNum, chapterId }
          );
        }
      }
    },
    [paragraphProps.onAction, bibleActions]
  );

  // Handle action from BibleVersesRenderer (verses mode)
  const handleVersesAction = useCallback(
    async (event: TextActionEvent) => {
      // If custom handler provided, use it
      if (versesProps.onAction) {
        versesProps.onAction(event);
        return;
      }

      // Otherwise use context if available
      if (bibleActions && event.verseLines.length > 0) {
        const verseIds = event.verseLines
          .map(line => line.verse_id)
          .filter((id): id is number => id !== undefined);

        if (verseIds.length > 0) {
          const firstVerseId = verseIds[0];
          const chapterId = Math.floor(firstVerseId / 1000) * 1000;
          const chapterNum = Math.floor((firstVerseId % 1000000) / 1000);

          await bibleActions.handleTextAction(
            event.action as 'copy' | 'share' | 'note' | 'highlight' | 'bookmark',
            verseIds,
            event.verseLines,
            { bookName: '', chapterNumber: chapterNum, chapterId }
          );
        }
      }
    },
    [versesProps.onAction, bibleActions]
  );

  // ============================================================================
  // Render based on mode
  // ============================================================================

  if (mode === 'chapter' && chapterData) {
    const { sections, chapterKey } = chapterData;

    return (
      <ChapterSelectableText
        sections={sections}
        styleSpec={styleSpec}
        highlights={chapterProps.highlights}
        onAction={handleChapterAction}
        chapterKey={chapterKey}
        onMeasuredHeight={onMeasuredHeight}
      />
    );
  }

  if (mode === 'paragraph' && paragraphData) {
    const { verseLines, isPoetry, paragraphKey } = paragraphData;

    return (
      <BibleContentRenderer
        verseLines={verseLines}
        isPoetry={isPoetry}
        showVerseNumbers={showVerseNumbers}
        styles={bibleStyles}
        compact={compact}
        selectedVerseId={selectedVerseId}
        highlightVerseStart={highlightRange?.start}
        highlightVerseEnd={highlightRange?.end}
        persistedHighlights={persistedHighlights}
        highlightColors={colors.highlightColors}
        textColor={colors.textPrimary}
        verseNumberColor={colors.verseNumber}
        onTextAction={handleParagraphAction}
        paragraphKey={paragraphKey}
        onMeasuredHeight={onMeasuredHeight}
        onParagraphHeight={onHeight}
      />
    );
  }

  if (mode === 'verses' && versesData) {
    const { verseLines } = versesData;

    return (
      <BibleVersesRenderer
        verseLines={verseLines}
        showVerseNumbers={showVerseNumbers}
        styles={bibleStyles}
        textColor={colors.textPrimary}
        verseNumberColor={colors.verseNumber}
        onTextAction={handleVersesAction}
        persistedHighlights={persistedHighlights}
        highlightColors={colors.highlightColors}
        paragraphGap={versesProps.paragraphGap}
      />
    );
  }

  // Should never reach here
  return null;
};

// ============================================================================
// Convenience Components
// ============================================================================

/**
 * Convenience component for chapter mode
 */
export const ChapterContent: React.FC<Omit<ChapterModeProps, 'mode'>> = (props) => (
  <BibleContent mode="chapter" {...props} />
);

/**
 * Convenience component for paragraph mode
 */
export const ParagraphContent: React.FC<Omit<ParagraphModeProps, 'mode'>> = (props) => (
  <BibleContent mode="paragraph" {...props} />
);

/**
 * Convenience component for verses mode
 */
export const VersesContent: React.FC<Omit<VersesModeProps, 'mode'>> = (props) => (
  <BibleContent mode="verses" {...props} />
);
