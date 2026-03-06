/**
 * Verse Selection Module
 * Handles verse highlighting when navigating from search
 * Centralizes verse highlighting and paragraph splitting logic (DRY)
 */

import { bibleStore$ } from '@/state/bibleStore';
import { type VerseLine } from '@/services/sqlite';

export interface SplitParagraph {
  before: VerseLine[];
  selected: VerseLine[];
  after: VerseLine[];
}

/**
 * Select a specific verse for highlighting in the active tab
 * @param verseId - The verse ID to select (e.g., 43003016 for John 3:16)
 */
export const selectVerse = (verseId: number): void => {
  bibleStore$.setActiveTabSelectedVerse(verseId);

  if (__DEV__) {
    console.log(`✨ Verse selected for highlighting in active tab: ${verseId}`);
  }
};

/**
 * Clear the current verse selection in the active tab
 */
export const clearVerseSelection = (): void => {
  bibleStore$.setActiveTabSelectedVerse(null);

  if (__DEV__) {
    console.log('🔄 Verse selection cleared in active tab');
  }
};

/**
 * Check if a verse is currently selected in the active tab
 * @param verseId - The verse ID to check
 * @returns true if this verse is selected
 */
export const isVerseSelected = (verseId: number): boolean => {
  const selectedVerseId = bibleStore$.activeTabSelectedVerse.get();
  return selectedVerseId === verseId;
};

/**
 * Get the currently selected verse ID from the active tab
 * @returns The selected verse ID or null
 */
export const getSelectedVerseId = (): number | null => {
  return bibleStore$.activeTabSelectedVerse.get();
};

/**
 * Splits a paragraph at the selected verse
 * Handles verses that span multiple verse lines (captures all lines with same verse_id)
 *
 * This is the DRY approach used by:
 * - BibleViewerSimplified (prose paragraphs)
 * - BibleContentRenderer (prose paragraphs in diff viewer)
 *
 * @param verseLines - All verse lines in the paragraph
 * @param selectedVerseId - The verse ID to highlight
 * @returns Split paragraph with before, selected, and after sections, or null if no selection
 */
export function splitParagraphAtSelectedVerse(
  verseLines: VerseLine[],
  selectedVerseId: number | null
): SplitParagraph | null {
  if (!selectedVerseId) return null;

  const hasSelectedVerse = verseLines.some(
    (line) => line.verse_id === selectedVerseId
  );

  if (!hasSelectedVerse) return null;

  const beforeLines: VerseLine[] = [];
  const selectedLines: VerseLine[] = [];
  const afterLines: VerseLine[] = [];

  let foundSelected = false;
  let selectedVerseId_local: number | null = null;

  verseLines.forEach((line) => {
    const isSelected = line.verse_id === selectedVerseId;

    if (isSelected) {
      foundSelected = true;
      selectedVerseId_local = line.verse_id;
      selectedLines.push(line);
    } else if (!foundSelected) {
      beforeLines.push(line);
    } else {
      // After selected verse, but check if it's part of same verse_id (multi-line verse)
      if (selectedVerseId_local && line.verse_id === selectedVerseId_local) {
        selectedLines.push(line);
      } else {
        afterLines.push(line);
      }
    }
  });

  return {
    before: beforeLines,
    selected: selectedLines,
    after: afterLines,
  };
}

/**
 * Splits a paragraph at a verse range (for BiblePeek highlighting)
 * Similar to splitParagraphAtSelectedVerse but supports start/end range
 *
 * @param verseLines - All verse lines in the paragraph
 * @param verseIdStart - Start of verse range to highlight
 * @param verseIdEnd - End of verse range to highlight (defaults to start if not provided)
 * @returns Split paragraph with before, selected, and after sections, or null if no selection
 */
export function splitParagraphAtVerseRange(
  verseLines: VerseLine[],
  verseIdStart: number | null,
  verseIdEnd?: number | null
): SplitParagraph | null {
  if (!verseIdStart) return null;

  const effectiveEnd = verseIdEnd ?? verseIdStart;

  // Check if any verse in range exists in this paragraph
  const hasSelectedVerse = verseLines.some(
    (line) => line.verse_id >= verseIdStart && line.verse_id <= effectiveEnd
  );

  if (!hasSelectedVerse) return null;

  const beforeLines: VerseLine[] = [];
  const selectedLines: VerseLine[] = [];
  const afterLines: VerseLine[] = [];

  verseLines.forEach((line) => {
    const isInRange = line.verse_id >= verseIdStart && line.verse_id <= effectiveEnd;

    if (isInRange) {
      selectedLines.push(line);
    } else if (selectedLines.length === 0) {
      // Haven't found any selected yet - this is before
      beforeLines.push(line);
    } else {
      // Already found selected - this is after
      afterLines.push(line);
    }
  });

  return {
    before: beforeLines,
    selected: selectedLines,
    after: afterLines,
  };
}
