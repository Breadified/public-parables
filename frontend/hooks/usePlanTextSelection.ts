/**
 * usePlanTextSelection - Shared hook for text selection handling in plan sessions
 *
 * Extracts duplicated code from PlanReadingContent and PlanStudyModeView:
 * - Highlight color conversion
 * - Highlights for verse lines
 * - Text action handlers
 */

import { useCallback } from 'react';
import { useSelector } from '@legendapp/state/react';
import { useTheme } from '@/contexts/ThemeContext';
import { useTextActionHandler } from './useTextActionHandler';
import { bibleVersionStore$ } from '@/state/bibleVersionStore';
import { activeHighlights$, type VerseHighlight } from '@/state/notesStore';
import { findVersesInSelection, type VerseBoundary } from '@/modules/bible/textUtils';
import type { ChapterSelectionEvent } from '@/modules/expo-selectable-text';
import type { VerseLine } from '@/services/sqlite';

interface UsePlanTextSelectionOptions {
  /**
   * Always set to true for plan sessions - uses planStudyModeStore$ for notes
   */
  usePlanStudyMode?: boolean;
}

interface SectionData {
  chapterId: number;
  bookName: string;
  verseBoundaries: VerseBoundary[];
  verseLines: VerseLine[];
}

/**
 * Shared hook for text selection handling in plan sessions
 *
 * Consolidates:
 * - getHighlightHexColor callback
 * - getHighlightsForVerseLines callback
 * - Text action handler setup
 *
 * @example
 * ```tsx
 * const {
 *   primaryVersion,
 *   getHighlightsForVerseLines,
 *   createTextActionHandler,
 *   highlightActions,
 * } = usePlanTextSelection({ usePlanStudyMode: true });
 *
 * // Get highlights for native rendering
 * const highlights = getHighlightsForVerseLines(section.verseLines);
 *
 * // Create handler for ChapterSelectableText
 * const handleAction = createTextActionHandler(sectionData);
 * ```
 */
export function usePlanTextSelection(options: UsePlanTextSelectionOptions = {}) {
  const { theme } = useTheme();
  const primaryVersion = useSelector(bibleVersionStore$.primaryVersion);
  const allActiveHighlights = useSelector(activeHighlights$);

  // Unified text action handler - automatically uses plan study mode
  const { handleAction, highlightActions } = useTextActionHandler({
    versionId: primaryVersion || 'ESV',
    usePlanStudyMode: options.usePlanStudyMode,
  });

  // Convert highlight color name to hex for native rendering
  const getHighlightHexColor = useCallback((colorName: VerseHighlight['color']): string => {
    const colorConfig = theme.colors.highlightColors[colorName];
    return colorConfig?.bg || '#FFEB3B80';
  }, [theme.colors.highlightColors]);

  // Get highlights for verse lines in native format
  const getHighlightsForVerseLines = useCallback((verseLines: VerseLine[]): { verseId: number; color: string }[] => {
    const verseIdSet = new Set(verseLines.map(line => line.verse_id));
    return allActiveHighlights
      .filter((h: VerseHighlight) => verseIdSet.has(h.verse_id))
      .map((h: VerseHighlight) => ({
        verseId: h.verse_id,
        color: getHighlightHexColor(h.color),
      }));
  }, [allActiveHighlights, getHighlightHexColor]);

  // Create text action handler for a section
  const createTextActionHandler = useCallback((sectionData: SectionData) => {
    return async (event: { nativeEvent: ChapterSelectionEvent }) => {
      const { action, selectionStart, selectionEnd } = event.nativeEvent;

      // Map selection to verse IDs using boundaries
      const verseIds = findVersesInSelection(
        sectionData.verseBoundaries,
        selectionStart,
        selectionEnd
      );

      // Filter verse lines to selected verses
      const verseIdSet = new Set(verseIds);
      const selectedVerseLines = sectionData.verseLines.filter(
        line => line.verse_id !== undefined && verseIdSet.has(line.verse_id)
      );

      const chapterNum = Math.floor((sectionData.chapterId % 1000000) / 1000);

      // Use unified action handler
      await handleAction(
        action as 'copy' | 'share' | 'note' | 'highlight' | 'bookmark',
        verseIds,
        selectedVerseLines.length > 0 ? selectedVerseLines : sectionData.verseLines,
        {
          bookName: sectionData.bookName,
          chapterNumber: chapterNum,
          chapterId: sectionData.chapterId,
        }
      );
    };
  }, [handleAction]);

  return {
    primaryVersion,
    getHighlightsForVerseLines,
    createTextActionHandler,
    highlightActions,
  };
}
