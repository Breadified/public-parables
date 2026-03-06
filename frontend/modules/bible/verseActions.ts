/**
 * Verse Actions - Copy, Share, Note, Bookmark operations for selected verses
 */

import { Share } from "react-native";
import * as Clipboard from "expo-clipboard";
import { notesStore$ } from "@/state/notesStore";
import { studyModeStore$ } from "@/state/studyModeStore";
import { planStudyModeStore$ } from "@/state";
import type { HighlightColorName } from "@/config/theme";
import { getLocalizedBookName } from "@/modules/bible/bibleBookMappings";

/**
 * Minimal verse line interface for text selection actions
 * Compatible with both sqlite VerseLine and chapterDataTransform VerseLine
 */
export interface VerseLine {
  verse_id: number;
  verse_number?: number | null;
  text: string | null;
  indent_level?: number | null;
}

/**
 * Format verses for copying/sharing with proper verse numbering and indentation
 *
 * Example output for prose:
 * John 3:16-17 (ESV)
 * [16] For God so loved the world, that he gave his only Son, that whoever believes in him should not perish but have eternal life.
 * [17] For God did not send his Son into the world to condemn the world, but in order that the world might be saved through him.
 *
 * Example output for poetry:
 * Psalm 23:1-2 (ESV)
 * [1] The LORD is my shepherd; I shall not want.
 * [2]   He makes me lie down in green pastures.
 *       He leads me beside still waters.
 */
export function formatVersesForDisplay(
  verseLines: VerseLine[],
  bookId: number,
  chapterNum: number,
  versionId: string = "ESV",
  language: string = "en"
): string {
  const bookName = getLocalizedBookName(bookId, language);
  if (verseLines.length === 0) return "";

  // Get verse range for reference header
  const verseNumbers = verseLines
    .filter((line) => line.verse_number != null)
    .map((line) => line.verse_number as number);

  if (verseNumbers.length === 0) return "";

  const minVerse = Math.min(...verseNumbers);
  const maxVerse = Math.max(...verseNumbers);

  // Build reference string
  const reference =
    minVerse === maxVerse
      ? `${bookName} ${chapterNum}:${minVerse}`
      : `${bookName} ${chapterNum}:${minVerse}-${maxVerse}`;

  // Group lines by verse_id to handle multi-line verses (poetry)
  const verseGroups = new Map<number, VerseLine[]>();
  verseLines.forEach((line) => {
    const existing = verseGroups.get(line.verse_id) || [];
    existing.push(line);
    verseGroups.set(line.verse_id, existing);
  });

  // Sort verse IDs to maintain order
  const sortedVerseIds = Array.from(verseGroups.keys()).sort((a, b) => a - b);

  // Format each verse with [verseNumber] prefix
  const formattedVerses: string[] = [];

  sortedVerseIds.forEach((verseId) => {
    const lines = verseGroups.get(verseId) || [];
    const verseNum = verseId % 1000;

    lines.forEach((line, idx) => {
      const text = line.text?.trim() || "";
      if (!text) return;

      // Poetry indentation: 2 spaces per indent level
      const poetryIndent = "  ".repeat(line.indent_level || 0);

      if (idx === 0) {
        // First line of verse: show [verseNumber] prefix
        formattedVerses.push(`[${verseNum}] ${poetryIndent}${text}`);
      } else {
        // Continuation lines: indent to align with verse text
        // "[1] " is 4 characters, so we use 4 spaces for continuation
        formattedVerses.push(`    ${poetryIndent}${text}`);
      }
    });
  });

  return `${reference} (${versionId.toUpperCase()})\n${formattedVerses.join("\n")}`;
}

/**
 * Build verse reference string from verse lines
 */
function buildVerseReference(
  verseLines: VerseLine[],
  bookId: number,
  chapterNum: number,
  language: string = "en"
): string {
  const bookName = getLocalizedBookName(bookId, language);
  const verseNumbers = verseLines
    .filter((line) => line.verse_number != null)
    .map((line) => line.verse_number as number);

  if (verseNumbers.length === 0) return "";

  const minVerse = Math.min(...verseNumbers);
  const maxVerse = Math.max(...verseNumbers);

  return minVerse === maxVerse
    ? `${bookName} ${chapterNum}:${minVerse}`
    : `${bookName} ${chapterNum}:${minVerse}-${maxVerse}`;
}

/**
 * Copy verses to clipboard
 */
export async function copyVerses(
  verseLines: VerseLine[],
  bookId: number,
  chapterNum: number,
  versionId: string = "ESV",
  language: string = "en"
): Promise<{ success: boolean; message: string }> {
  try {
    const formattedText = formatVersesForDisplay(
      verseLines,
      bookId,
      chapterNum,
      versionId,
      language
    );

    if (!formattedText) {
      return { success: false, message: "No verse text to copy" };
    }

    await Clipboard.setStringAsync(formattedText);

    // Build reference for toast message
    const reference = buildVerseReference(verseLines, bookId, chapterNum, language);

    return {
      success: true,
      message: reference ? `${reference} Copied` : "Copied",
    };
  } catch (error) {
    console.error("[verseActions] Failed to copy verses:", error);
    return { success: false, message: "Failed to copy" };
  }
}

/**
 * Share verses via system share sheet
 */
export async function shareVerses(
  verseLines: VerseLine[],
  bookId: number,
  chapterNum: number,
  versionId: string = "ESV",
  language: string = "en"
): Promise<{ success: boolean; message: string }> {
  try {
    const formattedText = formatVersesForDisplay(
      verseLines,
      bookId,
      chapterNum,
      versionId,
      language
    );

    if (!formattedText) {
      return { success: false, message: "No verse text to share" };
    }

    const result = await Share.share({
      message: formattedText,
    });

    // Build reference for toast message
    const reference = buildVerseReference(verseLines, bookId, chapterNum, language);

    if (result.action === Share.sharedAction) {
      return { success: true, message: reference ? `${reference} Shared` : "Shared" };
    } else if (result.action === Share.dismissedAction) {
      return { success: false, message: "Share cancelled" };
    }

    return { success: true, message: reference ? `${reference} Shared` : "Shared" };
  } catch (error) {
    console.error("[verseActions] Failed to share verses:", error);
    return { success: false, message: "Failed to share" };
  }
}

/**
 * Add highlight to verse range
 */
export function highlightVerses(
  startVerseId: number,
  endVerseId: number,
  color: HighlightColorName
): { success: boolean; message: string } {
  try {
    notesStore$.addHighlightsToRange(startVerseId, endVerseId, color);

    const count = Math.abs(endVerseId - startVerseId) + 1;
    return {
      success: true,
      message: count === 1 ? "Highlighted" : `${count} verses highlighted`,
    };
  } catch (error) {
    console.error("[verseActions] Failed to highlight verses:", error);
    return { success: false, message: "Failed to highlight" };
  }
}

/**
 * Remove highlight from verse range
 */
export function removeHighlightFromVerses(
  startVerseId: number,
  endVerseId: number
): { success: boolean; message: string } {
  try {
    const minId = Math.min(startVerseId, endVerseId);
    const maxId = Math.max(startVerseId, endVerseId);

    // For verse ranges within same chapter, iterate through verse numbers
    const bookChapter = Math.floor(minId / 1000) * 1000;
    const startVerse = minId % 1000;
    const endVerse = maxId % 1000;

    for (let v = startVerse; v <= endVerse; v++) {
      const verseId = bookChapter + v;
      notesStore$.removeHighlight(verseId);
    }

    const count = endVerse - startVerse + 1;
    return {
      success: true,
      message: count === 1 ? "Highlight removed" : `${count} highlights removed`,
    };
  } catch (error) {
    console.error("[verseActions] Failed to remove highlights:", error);
    return { success: false, message: "Failed to remove highlight" };
  }
}

/**
 * Create bookmark for verse range
 * Returns parameters needed to navigate to bookmark creation
 */
export function prepareBookmark(
  startVerseId: number,
  endVerseId: number,
  bookId: number,
  chapterNum: number,
  language: string = "en"
): {
  verseId: number;
  reference: string;
} {
  const bookName = getLocalizedBookName(bookId, language);
  const minId = Math.min(startVerseId, endVerseId);
  const maxId = Math.max(startVerseId, endVerseId);

  const startVerse = minId % 1000;
  const endVerse = maxId % 1000;

  const reference =
    startVerse === endVerse
      ? `${bookName} ${chapterNum}:${startVerse}`
      : `${bookName} ${chapterNum}:${startVerse}-${endVerse}`;

  return {
    verseId: minId, // Use start verse as anchor
    reference,
  };
}

/**
 * Get verse lines for a verse ID range from a chapter's data
 */
export function getVerseLinesInRange(
  allVerseLines: VerseLine[],
  startVerseId: number,
  endVerseId: number
): VerseLine[] {
  const minId = Math.min(startVerseId, endVerseId);
  const maxId = Math.max(startVerseId, endVerseId);

  return allVerseLines.filter(
    (line) => line.verse_id >= minId && line.verse_id <= maxId
  );
}

/**
 * Options for creating a note from selection
 */
export interface CreateNoteOptions {
  /** Use planStudyModeStore$ instead of studyModeStore$ (for plan sessions) */
  usePlanStudyMode?: boolean;
}

/**
 * Create a new note linked to a verse range from selection
 * The note is created empty and ready for user input
 *
 * @returns The created note ID for focus handling
 */
export function createNoteFromSelection(
  startVerseId: number,
  endVerseId: number,
  bookId: number,
  chapterId: number,
  options?: CreateNoteOptions
): string {
  const { v4: uuidv4 } = require("uuid");

  const minId = Math.min(startVerseId, endVerseId);
  const maxId = Math.max(startVerseId, endVerseId);

  const newNote = {
    id: uuidv4(),
    user_id: "", // Will be set by store if authenticated
    book_id: bookId,
    chapter_id: chapterId,
    verse_id: minId, // Backward compat: use start verse
    verse_line_id: null,
    verse_start_id: minId,
    verse_end_id: maxId,
    content: "",
    tags: [],
    is_private: true,
    status: "active" as const,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    edit_history: [],
    formatting_type: "prose" as const,
  };

  // Add to store and expand for editing
  notesStore$.notes.push(newNote);
  notesStore$.setNoteExpanded(newNote.id, true);

  // Mark for auto-focus when BibleNotesAlignedView renders
  notesStore$.setPendingFocusNote(newNote.id);

  // Switch to Notes study mode to show the new note
  // Use plan study mode store for plan sessions, regular store otherwise
  if (options?.usePlanStudyMode) {
    planStudyModeStore$.enterStudyMode("NOTES");
  } else {
    studyModeStore$.enterNotesMode();
  }

  return newNote.id;
}

/**
 * Create a bookmark for a verse (or verse range anchor)
 * Bookmarks are stored with verse_line_id for precise location
 */
export function createBookmark(
  verseId: number,
  title?: string,
  color: string = "default"
): { success: boolean; message: string } {
  try {
    const { v4: uuidv4 } = require("uuid");

    // Create verse_line_id from verseId (format: verseId_0)
    const verseLineId = `${verseId}_0`;

    const newBookmark = {
      id: uuidv4(),
      user_id: "", // Will be set by store if authenticated
      verse_line_id: verseLineId,
      title: title || null,
      color,
      tags: [],
      status: "active" as const,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Add to store and persist
    notesStore$.bookmarks.push(newBookmark);
    notesStore$.saveBookmarksToStorage();

    return { success: true, message: "Bookmark added" };
  } catch (error) {
    console.error("[verseActions] Failed to create bookmark:", error);
    return { success: false, message: "Failed to create bookmark" };
  }
}
