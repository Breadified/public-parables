/**
 * Bible Data Store - Core Bible data and position tracking
 * Handles: Bible text data, current reading position
 */

import { observable, computed } from "@legendapp/state";
import { getChapterDisplayName, getGlobalChapterIndexFromVerseId, BIBLE_BOOK_NAMES } from "../modules/bible/bibleBookMappings";
import type {
  BookData, ChapterData, SectionData, ParagraphData, VerseLineData
} from "../types/stores";

export const bibleDataStore$: any = observable({
  // Core Bible data
  books: [] as BookData[],
  chapters: [] as ChapterData[],
  sections: [] as SectionData[],
  paragraphs: [] as ParagraphData[],
  verse_lines: [] as VerseLineData[],

  // Current state
  current_verse_line_id: null as string | null,

  // Current verse tracking - using actual verse IDs for biblical references
  current_verse_id: computed((): number | null => {
    const verseLineId = bibleDataStore$.current_verse_line_id.get();
    if (!verseLineId) return null;

    // Find the verse_line to get its actual verse_id
    const verseLine = bibleDataStore$.verse_lines.get().find((vl: VerseLineData) => vl.id === verseLineId);
    return verseLine?.verse_id || null;
  }),

  // Reactive computed position tracking - INSTANT updates using actual verse ID
  currentPosition: computed((): any => {
    const verseId: number | null = bibleDataStore$.current_verse_id.get();
    if (!verseId) {
      return {
        chapterDisplayName: 'Genesis 1',
        bookName: 'Genesis',
        chapterNumber: 1,
        globalChapterIndex: 0,
        verseNumber: 1
      };
    }

    // Use actual verse ID (already numeric like 1024001)
    const numericId: number = verseId;

    // Extract components using mapping functions
    const bookNumber = Math.floor(numericId / 1000000);
    const chapterNumber = Math.floor((numericId % 1000000) / 1000);
    const verseNumber: number = numericId % 1000;
    const globalChapterIndex = getGlobalChapterIndexFromVerseId(numericId);
    const chapterDisplayName = getChapterDisplayName(numericId);
    const bookName = BIBLE_BOOK_NAMES[bookNumber] || 'Unknown';

    return {
      chapterDisplayName,
      bookName,
      chapterNumber,
      globalChapterIndex,
      verseNumber,
      verseId: numericId
    };
  }),
});
