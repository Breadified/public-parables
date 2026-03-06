/**
 * Utility functions for formatting verse references from note data
 */

import { getBookName } from '@/modules/bible/bibleBookMappings';
import type { Note } from '@/types/database';

/**
 * Extracts verse number from a verse ID
 * Format: X00Y00Z where Z is the verse number
 *
 * @param verseId - The verse ID (e.g., 1001001 for Genesis 1:1)
 * @returns The verse number
 */
export function getVerseNumber(verseId: number): number {
  return verseId % 1000;
}

/**
 * Extracts chapter number from a verse ID or chapter ID
 * Format: X00Y000 or X00Y00Z where Y is the chapter number
 *
 * @param id - The verse ID or chapter ID
 * @returns The chapter number
 */
export function getChapterNumberFromId(id: number): number {
  return Math.floor((id % 1000000) / 1000);
}

/**
 * Extracts book ID from a verse ID or chapter ID
 * Format: X000000 where X is the book ID (1-66)
 *
 * @param id - The verse ID or chapter ID
 * @returns The book ID
 */
export function getBookIdFromId(id: number): number {
  return Math.floor(id / 1000000);
}

/**
 * Formats a verse reference for display in the note header
 * Supports verse ranges (e.g., "Psalm 23:1-4") when verse_start_id and verse_end_id are set
 *
 * @param note - The note object
 * @returns Formatted reference (e.g., "Psalm 23:1-4", "Psalm 23:1", "Psalm 23", or "Psalms")
 */
export function formatVerseReference(note: Note): string {
  // Priority 1: Verse range (for multi-verse notes from selection)
  if (note.verse_start_id && note.verse_end_id) {
    const bookId = getBookIdFromId(note.verse_start_id);
    const chapterNum = getChapterNumberFromId(note.verse_start_id);
    const startVerse = getVerseNumber(note.verse_start_id);
    const endVerse = getVerseNumber(note.verse_end_id);
    const bookName = getBookName(bookId);

    // Show range if different verses, otherwise single verse
    if (startVerse === endVerse) {
      return `${bookName} ${chapterNum}:${startVerse}`;
    }
    return `${bookName} ${chapterNum}:${startVerse}-${endVerse}`;
  }

  // Priority 2: Single verse (backward compatibility)
  if (note.verse_id) {
    const bookId = getBookIdFromId(note.verse_id);
    const chapterNum = getChapterNumberFromId(note.verse_id);
    const verseNum = getVerseNumber(note.verse_id);
    const bookName = getBookName(bookId);

    return `${bookName} ${chapterNum}:${verseNum}`;
  }

  // Priority 3: Chapter reference
  if (note.chapter_id) {
    const bookId = getBookIdFromId(note.chapter_id);
    const chapterNum = getChapterNumberFromId(note.chapter_id);
    const bookName = getBookName(bookId);

    return `${bookName} ${chapterNum}`;
  }

  // Priority 4: Book reference
  if (note.book_id) {
    const bookName = getBookName(note.book_id);
    return bookName;
  }

  // Fallback for notes without reference
  return 'Unattached Note';
}

/**
 * Formats a short verse reference (abbreviated book names for compact display)
 *
 * @param note - The note object
 * @returns Short formatted reference (e.g., "Ps 23:1")
 */
export function formatShortVerseReference(note: Note): string {
  const fullRef = formatVerseReference(note);

  // Abbreviation map for common books
  const abbreviations: Record<string, string> = {
    'Genesis': 'Gen',
    'Exodus': 'Ex',
    'Leviticus': 'Lev',
    'Numbers': 'Num',
    'Deuteronomy': 'Deut',
    'Psalms': 'Ps',
    'Proverbs': 'Prov',
    'Isaiah': 'Is',
    'Jeremiah': 'Jer',
    'Ezekiel': 'Ez',
    'Daniel': 'Dan',
    'Matthew': 'Matt',
    'John': 'Jn',
    'Romans': 'Rom',
    'Corinthians': 'Cor',
    'Galatians': 'Gal',
    'Ephesians': 'Eph',
    'Philippians': 'Phil',
    'Colossians': 'Col',
    'Thessalonians': 'Thess',
    'Timothy': 'Tim',
    'Hebrews': 'Heb',
    'Revelation': 'Rev',
  };

  // Replace book name with abbreviation if available
  for (const [full, abbrev] of Object.entries(abbreviations)) {
    if (fullRef.startsWith(full)) {
      return fullRef.replace(full, abbrev);
    }
  }

  return fullRef;
}

/**
 * Creates a new chapter ID from book and chapter numbers
 *
 * @param bookId - The book ID (1-66)
 * @param chapterNumber - The chapter number
 * @returns The chapter ID in X00Y000 format
 */
export function createChapterId(bookId: number, chapterNumber: number): number {
  return bookId * 1000000 + chapterNumber * 1000;
}

/**
 * Creates a new verse ID from book, chapter, and verse numbers
 *
 * @param bookId - The book ID (1-66)
 * @param chapterNumber - The chapter number
 * @param verseNumber - The verse number
 * @returns The verse ID in X00Y00Z format
 */
export function createVerseId(bookId: number, chapterNumber: number, verseNumber: number): number {
  return bookId * 1000000 + chapterNumber * 1000 + verseNumber;
}
