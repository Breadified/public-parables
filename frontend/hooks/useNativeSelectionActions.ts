/**
 * useNativeSelectionActions - Simple hook for handling native text selection events
 *
 * Replaces the complex coordinate-based selection system with native text selection.
 * The native module (SelectableTextView) handles all selection UI:
 * - Native blue text highlight with drag handles
 * - Custom context menu: Copy, Share, Note, Highlight, Bookmark
 *
 * This hook just receives the action events and dispatches them to the appropriate handlers.
 */

import { useCallback } from 'react';
import { useToast } from '@/contexts/ToastContext';
import type { VerseLine } from '@/services/sqlite';
import type { TextActionEvent } from '@/components/Bible/BibleContentRenderer';
import {
  copyVerses,
  shareVerses,
  highlightVerses,
  createNoteFromSelection,
  createBookmark,
} from '@/modules/bible/verseActions';
import { bibleVersionStore$ } from '@/state/bibleVersionStore';
import type { HighlightColorName } from '@/config/theme';

interface UseNativeSelectionActionsParams {
  /** Current Bible version ID (e.g., "ESV", "NIV") */
  versionId: string;
  /** Optional callback when navigating to notes (for MultiPane views) */
  onNavigateToNotes?: (noteId: string) => void;
  /** Default highlight color to use (default: 'yellow') */
  defaultHighlightColor?: HighlightColorName;
}

/**
 * Hook that handles native text selection action events
 *
 * Usage:
 * ```tsx
 * const handleNativeAction = useNativeSelectionActions({
 *   versionId: 'ESV',
 *   onNavigateToNotes: (noteId) => navigation.push('notes', { noteId }),
 * });
 *
 * <BibleContentRenderer
 *   onTextAction={handleNativeAction}
 *   // ... other props
 * />
 * ```
 */
export function useNativeSelectionActions({
  versionId,
  onNavigateToNotes,
  defaultHighlightColor = 'yellow',
}: UseNativeSelectionActionsParams) {
  const { showToast } = useToast();

  const handleAction = useCallback(
    async (event: TextActionEvent) => {
      const { action, selectedText, verseId, verseLines } = event;

      // Must have valid verse ID and selected text
      if (!verseId || !selectedText) {
        console.warn('[useNativeSelectionActions] Missing verseId or selectedText:', { verseId, selectedText });
        return;
      }

      // Extract context from verseId
      const bookId = Math.floor(verseId / 1000000);
      const chapterNum = Math.floor((verseId % 1000000) / 1000);
      const chapterId = bookId * 1000000 + chapterNum * 1000;

      // Get language from version for localized book names
      const versionData = bibleVersionStore$.getVersionData(versionId);
      const language = versionData?.language || 'en';

      switch (action) {
        case 'copy': {
          const result = await copyVerses(verseLines, bookId, chapterNum, versionId, language);
          showToast({
            message: result.message,
            type: result.success ? 'success' : 'warning',
          });
          break;
        }

        case 'share': {
          await shareVerses(verseLines, bookId, chapterNum, versionId, language);
          // Share dialog handles its own feedback
          break;
        }

        case 'note': {
          const noteId = createNoteFromSelection(verseId, verseId, bookId, chapterId);
          showToast({
            message: 'Note created',
            type: 'success',
          });
          onNavigateToNotes?.(noteId);
          break;
        }

        case 'highlight': {
          const result = highlightVerses(verseId, verseId, defaultHighlightColor);
          showToast({
            message: result.message,
            type: result.success ? 'success' : 'warning',
          });
          break;
        }

        case 'bookmark': {
          const result = createBookmark(verseId);
          showToast({
            message: result.message,
            type: result.success ? 'success' : 'warning',
          });
          break;
        }

        default:
          console.warn('[useNativeSelectionActions] Unknown action:', action);
      }
    },
    [versionId, showToast, onNavigateToNotes, defaultHighlightColor]
  );

  return handleAction;
}
