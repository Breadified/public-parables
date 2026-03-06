/**
 * useHighlightActions - Shared hook for highlight color picker state and handlers
 *
 * Extracted from VerseAlignedSplitView and BibleNotesAlignedView to eliminate duplication.
 * Manages highlight picker visibility, pending highlight context, and color/remove actions.
 */

import { useState, useCallback } from "react";
import type { HighlightColorName } from "../config/theme";
import {
  highlightVerses,
  removeHighlightFromVerses,
} from "../modules/bible/verseActions";
import { useToast } from "../contexts/ToastContext";

interface HighlightContext {
  bookName: string;
  chapterNumber: number;
}

interface UseHighlightActionsResult {
  // State
  highlightPickerVisible: boolean;
  pendingHighlightVerses: number[];
  pendingHighlightContext: HighlightContext | null;

  // Actions to trigger highlight flow
  startHighlight: (verseIds: number[], context: HighlightContext) => void;

  // Picker handlers (pass to HighlightColorPicker)
  handleHighlightColorPick: (color: HighlightColorName) => void;
  handleRemoveHighlight: () => void;
  handleCloseHighlightPicker: () => void;
}

/**
 * Hook for managing highlight color picker state and actions
 *
 * Usage:
 * ```tsx
 * const highlightActions = useHighlightActions();
 *
 * // When user selects "highlight" action on verses:
 * highlightActions.startHighlight(verseIds, { bookName, chapterNumber });
 *
 * // In render:
 * <HighlightColorPicker
 *   visible={highlightActions.highlightPickerVisible}
 *   onClose={highlightActions.handleCloseHighlightPicker}
 *   onColorSelect={highlightActions.handleHighlightColorPick}
 *   onRemoveHighlight={highlightActions.handleRemoveHighlight}
 * />
 * ```
 */
export function useHighlightActions(): UseHighlightActionsResult {
  const { showToast } = useToast();

  // Highlight picker state
  const [highlightPickerVisible, setHighlightPickerVisible] = useState(false);
  const [pendingHighlightVerses, setPendingHighlightVerses] = useState<number[]>([]);
  const [pendingHighlightContext, setPendingHighlightContext] = useState<HighlightContext | null>(null);

  /**
   * Start the highlight flow - opens picker with pending verses
   */
  const startHighlight = useCallback((verseIds: number[], context: HighlightContext) => {
    setPendingHighlightVerses(verseIds);
    setPendingHighlightContext(context);
    setHighlightPickerVisible(true);
  }, []);

  /**
   * Handle highlight color selection from picker
   */
  const handleHighlightColorPick = useCallback(
    (color: HighlightColorName) => {
      if (pendingHighlightVerses.length > 0 && pendingHighlightContext) {
        const startVerseId = Math.min(...pendingHighlightVerses);
        const endVerseId = Math.max(...pendingHighlightVerses);
        const { success } = highlightVerses(startVerseId, endVerseId, color);

        // Create Bible reference message like "Genesis 1:1-2 highlighted"
        const startVerse = startVerseId % 1000;
        const endVerse = endVerseId % 1000;
        const { bookName, chapterNumber } = pendingHighlightContext;
        const reference =
          startVerse === endVerse
            ? `${bookName} ${chapterNumber}:${startVerse}`
            : `${bookName} ${chapterNumber}:${startVerse}-${endVerse}`;
        const message = `${reference} highlighted`;

        showToast({ message, type: success ? "success" : "warning", duration: 2000 });
      }
      setHighlightPickerVisible(false);
      setPendingHighlightVerses([]);
      setPendingHighlightContext(null);
    },
    [pendingHighlightVerses, pendingHighlightContext, showToast]
  );

  /**
   * Handle highlight removal from picker
   */
  const handleRemoveHighlight = useCallback(() => {
    if (pendingHighlightVerses.length > 0 && pendingHighlightContext) {
      const startVerseId = Math.min(...pendingHighlightVerses);
      const endVerseId = Math.max(...pendingHighlightVerses);
      const { success } = removeHighlightFromVerses(startVerseId, endVerseId);

      // Create Bible reference message like "Genesis 1:1-2 highlight removed"
      const startVerse = startVerseId % 1000;
      const endVerse = endVerseId % 1000;
      const { bookName, chapterNumber } = pendingHighlightContext;
      const reference =
        startVerse === endVerse
          ? `${bookName} ${chapterNumber}:${startVerse}`
          : `${bookName} ${chapterNumber}:${startVerse}-${endVerse}`;
      const message = `${reference} highlight removed`;

      showToast({ message, type: success ? "success" : "warning", duration: 2000 });
    }
    setHighlightPickerVisible(false);
    setPendingHighlightVerses([]);
    setPendingHighlightContext(null);
  }, [pendingHighlightVerses, pendingHighlightContext, showToast]);

  /**
   * Close highlight picker without action
   */
  const handleCloseHighlightPicker = useCallback(() => {
    setHighlightPickerVisible(false);
    setPendingHighlightVerses([]);
    setPendingHighlightContext(null);
  }, []);

  return {
    // State
    highlightPickerVisible,
    pendingHighlightVerses,
    pendingHighlightContext,

    // Actions
    startHighlight,
    handleHighlightColorPick,
    handleRemoveHighlight,
    handleCloseHighlightPicker,
  };
}
