/**
 * useTextActionHandler - Unified handler for Bible text selection actions
 *
 * Consolidates the duplicated switch/case logic from:
 * - ChapterLevelBibleView
 * - VerseAlignedSplitView
 * - BibleNotesAlignedView
 * - PlanReadingContent
 *
 * Handles all 5 text selection actions:
 * - copy: Copy formatted verses to clipboard
 * - share: Share verses via system share sheet
 * - highlight: Open color picker, then apply highlight
 * - note: Create new note linked to selected verses
 * - bookmark: Create bookmark at first selected verse
 */

import { useCallback } from 'react';
import { useToast } from '../contexts/ToastContext';
import { useHighlightActions } from './useHighlightActions';
import {
  copyVerses,
  shareVerses,
  createNoteFromSelection,
  createBookmark,
  type VerseLine,
} from '../modules/bible/verseActions';
import { bibleVersionStore$ } from '../state/bibleVersionStore';

/**
 * Action types from native text selection menu
 */
export type TextSelectionAction = 'copy' | 'share' | 'note' | 'highlight' | 'bookmark';

/**
 * Context for the selected verses
 */
export interface ActionContext {
  bookName: string;
  chapterNumber: number;
  chapterId: number;
}

/**
 * Options for useTextActionHandler
 */
export interface UseTextActionHandlerOptions {
  /**
   * Bible version ID (e.g., "ESV", "NIV")
   */
  versionId: string;

  /**
   * Use planStudyModeStore$ instead of studyModeStore$ for note creation
   * Set to true when used in plan session context
   */
  usePlanStudyMode?: boolean;

  /**
   * Callback when any action completes (success or failure)
   */
  onActionComplete?: (action: TextSelectionAction, success: boolean, message: string) => void;
}

/**
 * Result from useTextActionHandler
 */
export interface UseTextActionHandlerResult {
  /**
   * Handle a text selection action
   *
   * @param action - The action type (copy, share, highlight, note, bookmark)
   * @param verseIds - Array of selected verse IDs
   * @param verseLines - VerseLine data for the selected verses (for copy/share formatting)
   * @param context - Chapter context (book name, chapter number, chapter ID)
   */
  handleAction: (
    action: TextSelectionAction,
    verseIds: number[],
    verseLines: VerseLine[],
    context: ActionContext
  ) => Promise<void>;

  /**
   * Highlight picker state and handlers (from useHighlightActions)
   * Pass these to HighlightColorPicker component
   */
  highlightActions: ReturnType<typeof useHighlightActions>;
}

/**
 * Unified hook for handling Bible text selection actions
 *
 * @example
 * ```tsx
 * const { handleAction, highlightActions } = useTextActionHandler({
 *   versionId: 'ESV',
 * });
 *
 * // In native selection handler:
 * const onTextAction = (event: TextActionEvent) => {
 *   handleAction(
 *     event.action,
 *     event.verseIds,
 *     event.verseLines,
 *     { bookName, chapterNumber, chapterId }
 *   );
 * };
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
export function useTextActionHandler(
  options: UseTextActionHandlerOptions
): UseTextActionHandlerResult {
  const { versionId, usePlanStudyMode, onActionComplete } = options;
  const { showToast } = useToast();
  const highlightActions = useHighlightActions();

  // PERF FIX: Extract stable callback reference to avoid object dependency
  // The highlightActions object changes every render, but startHighlight is stable (memoized)
  const startHighlight = highlightActions.startHighlight;

  const handleAction = useCallback(
    async (
      action: TextSelectionAction,
      verseIds: number[],
      verseLines: VerseLine[],
      context: ActionContext
    ) => {
      // Validate selection
      if (verseIds.length === 0) {
        showToast({
          message: 'No verses selected',
          type: 'warning',
          duration: 2000,
        });
        return;
      }

      const { bookName, chapterNumber, chapterId } = context;
      const bookId = Math.floor(chapterId / 1000000);

      // Get language from version for localized book names
      const versionData = bibleVersionStore$.getVersionData(versionId);
      const language = versionData?.language || 'en';

      switch (action) {
        case 'copy': {
          const { success, message } = await copyVerses(
            verseLines,
            bookId,
            chapterNumber,
            versionId,
            language
          );
          showToast({
            message,
            type: success ? 'success' : 'warning',
            duration: 2000,
          });
          onActionComplete?.(action, success, message);
          break;
        }

        case 'share': {
          const { success, message } = await shareVerses(
            verseLines,
            bookId,
            chapterNumber,
            versionId,
            language
          );
          // Only show toast for failures (share dialog handles success visually)
          if (!success && message !== 'Share cancelled') {
            showToast({
              message,
              type: 'warning',
              duration: 2000,
            });
          }
          onActionComplete?.(action, success, message);
          break;
        }

        case 'highlight': {
          // Start highlight flow - opens color picker
          startHighlight(verseIds, {
            bookName,
            chapterNumber,
          });
          // onActionComplete will be called by useHighlightActions after color selection
          break;
        }

        case 'note': {
          // Create note and switch to Notes study mode
          // Use plan study mode for plan sessions
          createNoteFromSelection(
            Math.min(...verseIds),
            Math.max(...verseIds),
            bookId,
            chapterId,
            { usePlanStudyMode }
          );
          showToast({
            message: 'Note created',
            type: 'success',
            duration: 2000,
          });
          onActionComplete?.(action, true, 'Note created');
          break;
        }

        case 'bookmark': {
          const { success, message } = createBookmark(Math.min(...verseIds));
          showToast({
            message,
            type: success ? 'success' : 'warning',
            duration: 2000,
          });
          onActionComplete?.(action, success, message);
          break;
        }
      }
    },
    [versionId, usePlanStudyMode, showToast, startHighlight, onActionComplete]
  );

  return {
    handleAction,
    highlightActions,
  };
}
