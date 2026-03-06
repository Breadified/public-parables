/**
 * useVerseSelectionActions - Shared hook for verse selection action handlers
 * Centralizes copy, share, note, highlight, and bookmark operations
 * Used by SinglePaneBibleView and MultiPane views
 */

import { useCallback, useMemo } from "react";
import { type VerseLine } from "@/services/sqlite";
import {
  copyVerses,
  shareVerses,
  highlightVerses,
  createNoteFromSelection,
  createBookmark,
  getVerseLinesInRange,
} from "@/modules/bible/verseActions";
import { bibleVersionStore$ } from "@/state/bibleVersionStore";
import type { HighlightColorName } from "@/config/theme";

interface ToastConfig {
  message: string;
  type?: "success" | "info" | "warning" | "celebration";
}

interface UseVerseSelectionActionsProps {
  /** Function to get the current ordered selection range */
  getOrderedRange: () => { start: number; end: number } | null;
  /** Function to get all verse lines from current chapter data */
  getAllVerseLines: () => VerseLine[];
  /** Current Bible version ID */
  versionId: string;
  /** Function to clear the selection after action */
  clearSelection: () => void;
  /** Function to show toast notifications */
  showToast: (config: ToastConfig) => void;
  /** Optional callback when navigating to notes (for MultiPane) */
  onNavigateToNotes?: (noteId: string) => void;
}

export interface UseVerseSelectionActionsReturn {
  /** Copy selected verses to clipboard */
  handleCopy: () => Promise<void>;
  /** Share selected verses via system share sheet */
  handleShare: () => Promise<void>;
  /** Create a new note linked to selected verses */
  handleNote: () => void;
  /** Highlight selected verses with a color */
  handleHighlight: (color: HighlightColorName) => void;
  /** Bookmark the selected verse */
  handleBookmark: () => void;
}

/**
 * Derive book/chapter context from a verse ID
 */
function getSelectionContext(verseId: number): { bookId: number; chapterId: number; chapterNum: number } {
  const bookId = Math.floor(verseId / 1000000);
  const chapterNum = Math.floor((verseId % 1000000) / 1000);
  const chapterId = bookId * 1000000 + chapterNum * 1000;
  return { bookId, chapterId, chapterNum };
}

/**
 * Hook that provides action handlers for verse selection
 * Designed to be shared across SinglePaneBibleView and MultiPane views
 */
export function useVerseSelectionActions({
  getOrderedRange,
  getAllVerseLines,
  versionId,
  clearSelection,
  showToast,
  onNavigateToNotes,
}: UseVerseSelectionActionsProps): UseVerseSelectionActionsReturn {
  /**
   * Copy selected verses to clipboard
   */
  const handleCopy = useCallback(async () => {
    const range = getOrderedRange();
    if (!range) return;

    const { bookId, chapterNum } = getSelectionContext(range.start);
    const allLines = getAllVerseLines();
    const selectedLines = getVerseLinesInRange(allLines, range.start, range.end);

    // Get language from version for localized book names
    const versionData = bibleVersionStore$.getVersionData(versionId);
    const language = versionData?.language || 'en';

    const result = await copyVerses(
      selectedLines,
      bookId,
      chapterNum,
      versionId,
      language
    );

    showToast({
      message: result.message,
      type: result.success ? "success" : "warning",
    });

    if (result.success) {
      clearSelection();
    }
  }, [getOrderedRange, getAllVerseLines, versionId, showToast, clearSelection]);

  /**
   * Share selected verses via system share sheet
   */
  const handleShare = useCallback(async () => {
    const range = getOrderedRange();
    if (!range) return;

    const { bookId, chapterNum } = getSelectionContext(range.start);
    const allLines = getAllVerseLines();
    const selectedLines = getVerseLinesInRange(allLines, range.start, range.end);

    // Get language from version for localized book names
    const versionData = bibleVersionStore$.getVersionData(versionId);
    const language = versionData?.language || 'en';

    const result = await shareVerses(
      selectedLines,
      bookId,
      chapterNum,
      versionId,
      language
    );

    if (result.success) {
      clearSelection();
    }
  }, [getOrderedRange, getAllVerseLines, versionId, clearSelection]);

  /**
   * Create a new note linked to the selected verse range
   */
  const handleNote = useCallback(() => {
    const range = getOrderedRange();
    if (!range) return;

    const { bookId, chapterId } = getSelectionContext(range.start);

    // Create the note and get its ID
    const noteId = createNoteFromSelection(
      range.start,
      range.end,
      bookId,
      chapterId
    );

    showToast({
      message: "Note created",
      type: "success",
    });

    // Clear selection after creating note
    clearSelection();

    // Navigate to notes if callback provided (for MultiPane)
    if (onNavigateToNotes) {
      onNavigateToNotes(noteId);
    }
  }, [getOrderedRange, showToast, clearSelection, onNavigateToNotes]);

  /**
   * Highlight selected verses with a color
   */
  const handleHighlight = useCallback(
    (color: HighlightColorName) => {
      const range = getOrderedRange();
      if (!range) return;

      const result = highlightVerses(range.start, range.end, color);

      showToast({
        message: result.message,
        type: result.success ? "success" : "warning",
      });

      if (result.success) {
        clearSelection();
      }
    },
    [getOrderedRange, showToast, clearSelection]
  );

  /**
   * Bookmark the selected verse (uses start of range as anchor)
   */
  const handleBookmark = useCallback(() => {
    const range = getOrderedRange();
    if (!range) return;

    const result = createBookmark(range.start);

    showToast({
      message: result.message,
      type: result.success ? "success" : "warning",
    });

    if (result.success) {
      clearSelection();
    }
  }, [getOrderedRange, showToast, clearSelection]);

  return {
    handleCopy,
    handleShare,
    handleNote,
    handleHighlight,
    handleBookmark,
  };
}
