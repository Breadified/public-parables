/**
 * Search Suggestions Engine
 * Generates example Bible verse shortcuts for animated placeholder
 *
 * Uses the unified BIBLE_BOOKS from bibleBookMappings.ts
 */

import {
  BIBLE_BOOKS,
  BOOK_BY_NAME,
  getBookAbbrev,
  findBookByPartialName,
  type BibleBook,
} from './bibleBookMappings';

/**
 * Popular verses for placeholder suggestions
 */
const POPULAR_VERSES: Array<{ bookId: number; chapter: number; verse: number }> = [
  { bookId: 43, chapter: 3, verse: 16 },   // John 3:16
  { bookId: 1, chapter: 1, verse: 1 },     // Genesis 1:1
  { bookId: 19, chapter: 23, verse: 1 },   // Psalms 23:1
  { bookId: 20, chapter: 3, verse: 5 },    // Proverbs 3:5
  { bookId: 45, chapter: 8, verse: 28 },   // Romans 8:28
  { bookId: 50, chapter: 4, verse: 13 },   // Philippians 4:13
  { bookId: 24, chapter: 29, verse: 11 },  // Jeremiah 29:11
  { bookId: 40, chapter: 28, verse: 19 },  // Matthew 28:19
  { bookId: 23, chapter: 41, verse: 10 },  // Isaiah 41:10
  { bookId: 19, chapter: 46, verse: 1 },   // Psalms 46:1
  { bookId: 46, chapter: 13, verse: 4 },   // 1 Corinthians 13:4
  { bookId: 55, chapter: 3, verse: 16 },   // 2 Timothy 3:16
  { bookId: 58, chapter: 11, verse: 1 },   // Hebrews 11:1
  { bookId: 59, chapter: 1, verse: 2 },    // James 1:2
  { bookId: 66, chapter: 21, verse: 4 },   // Revelation 21:4
  { bookId: 60, chapter: 5, verse: 7 },    // 1 Peter 5:7
  { bookId: 49, chapter: 2, verse: 8 },    // Ephesians 2:8
  { bookId: 48, chapter: 5, verse: 22 },   // Galatians 5:22
  { bookId: 43, chapter: 14, verse: 6 },   // John 14:6
  { bookId: 45, chapter: 12, verse: 2 },   // Romans 12:2
  { bookId: 19, chapter: 119, verse: 105 },// Psalms 119:105
  { bookId: 23, chapter: 40, verse: 31 },  // Isaiah 40:31
  { bookId: 40, chapter: 6, verse: 33 },   // Matthew 6:33
  { bookId: 20, chapter: 16, verse: 3 },   // Proverbs 16:3
  { bookId: 19, chapter: 91, verse: 1 },   // Psalms 91:1
  { bookId: 52, chapter: 5, verse: 16 },   // 1 Thessalonians 5:16
  { bookId: 51, chapter: 3, verse: 23 },   // Colossians 3:23
  { bookId: 45, chapter: 5, verse: 8 },    // Romans 5:8
  { bookId: 43, chapter: 1, verse: 1 },    // John 1:1
  { bookId: 1, chapter: 50, verse: 20 },   // Genesis 50:20
];

/**
 * Get a random Bible verse shortcut for placeholder animation
 * Returns format like "Gen1:1", "John3:16", "1Cor13:4"
 */
export function getRandomVerseSuggestion(): string {
  const randomIndex = Math.floor(Math.random() * POPULAR_VERSES.length);
  const verse = POPULAR_VERSES[randomIndex];
  const abbrev = getBookAbbrev(verse.bookId);

  return `${abbrev}${verse.chapter}:${verse.verse}`;
}

/**
 * Get the canonical abbreviation for a book name
 */
export function getBookAbbreviation(bookName: string): string {
  const book = BOOK_BY_NAME.get(bookName.toLowerCase());
  return book?.abbrev || bookName.substring(0, 4);
}

/**
 * Check if input matches a book (by name, abbrev, or alias)
 */
export function matchBook(input: string): BibleBook | null {
  return findBookByPartialName(input) || null;
}

/**
 * Suggestions for popular book+chapter combinations
 */
const CHAPTER_VERSE_SUGGESTIONS: Record<string, number> = {
  // Format: "bookId-chapter" -> suggested verse
  '43-3': 16,   // John 3 -> 16
  '1-1': 1,     // Genesis 1 -> 1
  '19-23': 1,   // Psalms 23 -> 1
  '19-119': 105,// Psalms 119 -> 105
  '19-91': 1,   // Psalms 91 -> 1
  '19-46': 1,   // Psalms 46 -> 1
  '45-8': 28,   // Romans 8 -> 28
  '45-12': 2,   // Romans 12 -> 2
  '45-5': 8,    // Romans 5 -> 8
  '40-5': 3,    // Matthew 5 -> 3
  '40-6': 33,   // Matthew 6 -> 33
  '40-28': 19,  // Matthew 28 -> 19
  '23-40': 31,  // Isaiah 40 -> 31
  '23-41': 10,  // Isaiah 41 -> 10
  '50-4': 13,   // Philippians 4 -> 13
  '24-29': 11,  // Jeremiah 29 -> 11
  '46-13': 4,   // 1 Corinthians 13 -> 4
  '55-3': 16,   // 2 Timothy 3 -> 16
  '60-5': 7,    // 1 Peter 5 -> 7
  '52-5': 16,   // 1 Thessalonians 5 -> 16
  '58-11': 1,   // Hebrews 11 -> 1
  '59-1': 2,    // James 1 -> 2
  '48-5': 22,   // Galatians 5 -> 22
  '49-2': 8,    // Ephesians 2 -> 8
  '51-3': 23,   // Colossians 3 -> 23
  '66-21': 4,   // Revelation 21 -> 4
  '20-3': 5,    // Proverbs 3 -> 5
  '20-16': 3,   // Proverbs 16 -> 3
  '43-14': 6,   // John 14 -> 6
  '43-1': 1,    // John 1 -> 1
  '1-50': 20,   // Genesis 50 -> 20
};

/**
 * Get smart completion suggestion based on user input
 * Returns only the completion part (what comes after what they typed)
 */
export function getSmartCompletion(
  input: string,
  filteredBooksCount?: number,
  suggestRange?: boolean
): string {
  if (!input || input.trim().length === 0) return '';

  const trimmed = input.trim().toLowerCase();

  // PRIORITY: If exactly 1 book remains filtered, suggest chapter:verse immediately
  if (filteredBooksCount === 1) {
    const hasChapter = /\d/.test(trimmed);
    const hasVerseSeparator = /[:;]/.test(trimmed);
    const hasSpaceSeparatedVerse = /\d+\s+\d+/.test(trimmed);

    const verseSuffix = suggestRange ? '1-5' : '1';
    const chapterVerseSuffix = suggestRange ? '1:1-5' : '1:1';

    if (!hasChapter) return chapterVerseSuffix;

    if (hasChapter && !hasVerseSeparator && !hasSpaceSeparatedVerse) {
      if (/^[a-z0-9]*\d+$/i.test(trimmed)) return suggestRange ? ':1-5' : ':1';
      if (/\d+$/.test(trimmed)) return ' ' + verseSuffix;
    }

    if (hasVerseSeparator && !/[:;]\d+/.test(trimmed)) return verseSuffix;

    if (hasChapter && !hasSpaceSeparatedVerse && input !== input.trimEnd()) {
      return verseSuffix;
    }
  }

  // Already has verse number -> no suggestion needed
  if (/[:;]\d+/.test(trimmed)) return '';

  // Try to match a book
  const book = findBookByPartialName(trimmed.replace(/\d+.*$/, '').trim());

  if (book) {
    // Extract chapter if present
    const chapterMatch = trimmed.match(/(\d+)$/);
    const chapter = chapterMatch ? parseInt(chapterMatch[1], 10) : undefined;

    // Has chapter, suggest verse
    if (chapter !== undefined) {
      // Check if ends with separator (needs verse suggestion)
      if (/[:;]\s*$/.test(input)) {
        const key = `${book.id}-${chapter}`;
        const suggestedVerse = CHAPTER_VERSE_SUGGESTIONS[key] || 1;
        return suggestRange ? `${suggestedVerse}-${suggestedVerse + 5}` : String(suggestedVerse);
      }

      // Needs separator + verse
      const key = `${book.id}-${chapter}`;
      const suggestedVerse = CHAPTER_VERSE_SUGGESTIONS[key] || 1;
      if (suggestRange) {
        return `:${suggestedVerse}-${suggestedVerse + 5}`;
      }
      return `:${suggestedVerse}`;
    }

    // Just book, no chapter -> suggest chapter:verse
    const popularVerse = POPULAR_VERSES.find(v => v.bookId === book.id);
    if (popularVerse) {
      if (suggestRange) {
        return `${popularVerse.chapter}:${popularVerse.verse}-${popularVerse.verse + 5}`;
      }
      return `${popularVerse.chapter}:${popularVerse.verse}`;
    }
    return suggestRange ? '1:1-5' : '1:1';
  }

  // Partial book name matching
  const partialBook = findBookByPartialName(trimmed);
  if (partialBook) {
    const abbrevLower = partialBook.abbrev.toLowerCase();
    if (abbrevLower.startsWith(trimmed) && abbrevLower !== trimmed) {
      const remainder = abbrevLower.slice(trimmed.length);

      const popularVerse = POPULAR_VERSES.find(v => v.bookId === partialBook.id);
      if (popularVerse) {
        if (suggestRange) {
          return `${remainder}${popularVerse.chapter}:${popularVerse.verse}-${popularVerse.verse + 5}`;
        }
        return `${remainder}${popularVerse.chapter}:${popularVerse.verse}`;
      }
      return `${remainder}1:1`;
    }
  }

  return '';
}

// Re-export for backward compatibility
export { BIBLE_BOOKS, BOOK_BY_NAME, getBookAbbrev } from './bibleBookMappings';
