/**
 * Bible Reference Parser
 * Handles all Bible reference formats with fuzzy matching
 * Powers the smart navigation system
 *
 * Uses the unified BIBLE_BOOKS from bibleBookMappings.ts
 */

import {
  BIBLE_BOOKS,
  BOOK_BY_ID,
  type BibleBook,
  findBookByPartialName,
  getBookByName,
} from './bibleBookMappings';

export interface ParsedReference {
  book: string;
  bookNumber: number;
  chapter?: number;
  verseStart?: number;
  verseEnd?: number;
  isValid: boolean;
  originalInput: string;
  normalizedReference: string;
}

// Re-export BibleBook as BookInfo for backward compatibility
export type BookInfo = BibleBook & {
  number: number;
  shortName: string;
  alternateNames: string[];
  chapterCount: number;
};

/**
 * Convert BibleBook to legacy BookInfo format
 */
function toBookInfo(book: BibleBook): BookInfo {
  return {
    ...book,
    number: book.id,
    shortName: book.abbrev,
    alternateNames: book.aliases,
    chapterCount: book.chapters,
  };
}

/**
 * Find book by partial name using fuzzy matching
 */
export function findBookByName(input: string): BookInfo | null {
  const book = findBookByPartialName(input);
  return book ? toBookInfo(book) : null;
}

/**
 * Parse a Bible reference string into structured data
 * Handles formats like: "John 3:16", "Genesis 1", "Psalm 23:4-6", "1 Cor 13"
 */
export function parseReference(input: string): ParsedReference {
  const originalInput = input.trim();

  if (!originalInput) {
    return {
      book: '',
      bookNumber: 0,
      isValid: false,
      originalInput,
      normalizedReference: '',
    };
  }

  // Common reference patterns (order matters - more specific patterns first)
  const patterns = [
    // "John 3:16-17" or "John 3:16" (space-separated with verse range)
    /^(.+?)\s+(\d+):(\d+)(?:-(\d+))?$/,
    // "2Peter1:16" or "mat10:5" (compact - no space, handles numbered books like 1John, 2Peter)
    /^(\d*[a-zA-Z]+)(\d+):(\d+)(?:-(\d+))?$/,
    // "John 3" (just chapter with space)
    /^(.+?)\s+(\d+)$/,
    // "2Peter1" or "mat10" (compact chapter only - no space, handles numbered books)
    /^(\d*[a-zA-Z]+)(\d+)$/,
    // Just book name
    /^(.+?)$/,
  ];

  for (const pattern of patterns) {
    const match = originalInput.match(pattern);
    if (!match) continue;

    const bookName = match[1]?.trim();
    if (!bookName) continue;

    const book = findBookByPartialName(bookName);
    if (!book) continue;

    const chapter = match[2] ? parseInt(match[2], 10) : undefined;
    const verseStart = match[3] ? parseInt(match[3], 10) : undefined;
    const verseEnd = match[4] ? parseInt(match[4], 10) : undefined;

    // Validate chapter number
    if (chapter !== undefined && (chapter < 1 || chapter > book.chapters)) {
      continue;
    }

    // Build normalized reference
    let normalized = book.name;
    if (chapter !== undefined) {
      normalized += ` ${chapter}`;
      if (verseStart !== undefined) {
        normalized += `:${verseStart}`;
        if (verseEnd !== undefined && verseEnd !== verseStart) {
          normalized += `-${verseEnd}`;
        }
      }
    }

    return {
      book: book.name,
      bookNumber: book.id,
      chapter,
      verseStart,
      verseEnd,
      isValid: true,
      originalInput,
      normalizedReference: normalized,
    };
  }

  // No valid pattern matched
  return {
    book: originalInput,
    bookNumber: 0,
    isValid: false,
    originalInput,
    normalizedReference: originalInput,
  };
}

/**
 * Get suggestions for partial input
 */
export function getReferenceSuggestions(input: string, limit: number = 5): ParsedReference[] {
  const normalized = input.toLowerCase().trim();
  if (!normalized) return [];

  const suggestions: ParsedReference[] = [];

  // Find matching books
  const matchingBooks = BIBLE_BOOKS.filter(book =>
    book.name.toLowerCase().includes(normalized) ||
    book.abbrev.toLowerCase().includes(normalized) ||
    book.aliases.some(alt => alt.includes(normalized))
  );

  // Sort by relevance (exact match, starts with, contains)
  matchingBooks.sort((a, b) => {
    const aExact = a.name.toLowerCase() === normalized || a.abbrev.toLowerCase() === normalized;
    const bExact = b.name.toLowerCase() === normalized || b.abbrev.toLowerCase() === normalized;
    if (aExact && !bExact) return -1;
    if (!aExact && bExact) return 1;

    const aStarts = a.name.toLowerCase().startsWith(normalized) || a.abbrev.toLowerCase().startsWith(normalized);
    const bStarts = b.name.toLowerCase().startsWith(normalized) || b.abbrev.toLowerCase().startsWith(normalized);
    if (aStarts && !bStarts) return -1;
    if (!aStarts && bStarts) return 1;

    return a.name.localeCompare(b.name);
  });

  // Add book suggestions with popular chapters
  matchingBooks.slice(0, limit).forEach(book => {
    suggestions.push({
      book: book.name,
      bookNumber: book.id,
      isValid: true,
      originalInput: input,
      normalizedReference: book.name,
    });

    // Add popular chapter suggestions for well-known books
    const popularChapters = getPopularChapters(book.name);
    popularChapters.forEach(chapter => {
      if (suggestions.length < limit) {
        suggestions.push({
          book: book.name,
          bookNumber: book.id,
          chapter,
          isValid: true,
          originalInput: input,
          normalizedReference: `${book.name} ${chapter}`,
        });
      }
    });
  });

  return suggestions.slice(0, limit);
}

/**
 * Get popular chapters for well-known books
 */
function getPopularChapters(bookName: string): number[] {
  const popularChapters: Record<string, number[]> = {
    'Genesis': [1, 3, 22],
    'Exodus': [20, 14],
    'Psalms': [23, 1, 91, 139],
    'Proverbs': [31, 3],
    'Isaiah': [53, 40, 55],
    'Matthew': [5, 6, 7, 28],
    'Mark': [16],
    'Luke': [2, 15],
    'John': [3, 14, 1],
    'Romans': [8, 12, 1],
    '1 Corinthians': [13, 15],
    'Ephesians': [2, 6],
    'Philippians': [4],
    'Colossians': [3],
    'Hebrews': [11],
    'James': [1],
    'Revelation': [21, 22],
  };

  return popularChapters[bookName] || [];
}

/**
 * Validate if a reference exists in our data
 */
export function isValidReference(reference: ParsedReference): boolean {
  if (!reference.isValid) return false;

  const book = BOOK_BY_ID.get(reference.bookNumber);
  if (!book) return false;

  if (reference.chapter !== undefined) {
    if (reference.chapter < 1 || reference.chapter > book.chapters) {
      return false;
    }
  }

  return true;
}

/**
 * Format reference for display
 */
export function formatReference(reference: ParsedReference): string {
  if (!reference.isValid) return reference.originalInput;
  return reference.normalizedReference;
}

/**
 * Get book info by number
 */
export function getBookByNumber(bookNumber: number): BookInfo | null {
  const book = BOOK_BY_ID.get(bookNumber);
  return book ? toBookInfo(book) : null;
}

/**
 * Get all books for book selector
 */
export function getAllBooks(): BookInfo[] {
  return BIBLE_BOOKS.map(toBookInfo);
}

/**
 * Get books by testament
 */
export function getBooksByTestament(testament: 'old' | 'new'): BookInfo[] {
  return BIBLE_BOOKS.filter(book => book.testament === testament).map(toBookInfo);
}
