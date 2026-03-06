/**
 * Bible search parsing utilities
 * Extracted from SearchModal for reusability across the app
 */

export interface ParsedReference {
  bookQuery: string;
  chapter: number;
  verse?: number;
}

export interface SearchResult {
  book: string;
  chapter: number;
  verse?: number;
}

export interface BookInfo {
  name: string;
  chapters: number;
}

/**
 * Parses a search input string into book, chapter, and optionally verse components
 *
 * Supports multiple formats:
 * - "gen3:16", "gen3;16" (compact with separator)
 * - "gen 3:16", "gen 3;16" (spaced with separator)
 * - "gen 3 16" (space-separated)
 * - "gen3", "gen 20" (chapter only)
 * - "gen 3 " (trailing space, waiting for verse)
 * - "1co13:4", "1 cor 13 4" (numbered books)
 *
 * @param input - The search string
 * @returns Parsed reference or null if invalid
 */
export function parseBookChapterVerse(input: string): ParsedReference | null {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return null;

  // Check for verse separator (colon, semicolon, or space after chapter number)
  const hasSeparator = trimmed.includes(':') || trimmed.includes(';');

  if (hasSeparator) {
    // Try to parse complete verse reference: "gen3:16", "gen3;16", "gen 3:16", "gen 3;16"
    const completeMatch = trimmed.match(/^([a-z0-9\s]*?)(\d+)[:;](\d+)$/i);
    if (completeMatch) {
      const [, bookPart, chapterPart, versePart] = completeMatch;
      const bookQuery = bookPart.replace(/\s+/g, '').toLowerCase().trim();
      const chapter = parseInt(chapterPart, 10);
      const verse = parseInt(versePart, 10);
      return { bookQuery, chapter, verse };
    }

    // Handle partial input: "gen3:", "gen 3;", etc. (separator but no verse number yet)
    const partialMatch = trimmed.match(/^([a-z0-9\s]*?)(\d+)[:;]\s*$/i);
    if (partialMatch) {
      const [, bookPart, chapterPart] = partialMatch;
      const bookQuery = bookPart.replace(/\s+/g, '').toLowerCase().trim();
      const chapter = parseInt(chapterPart, 10);
      // Return chapter only, will trigger verse mode but with empty verse filter
      return { bookQuery, chapter, verse: 0 }; // verse: 0 indicates "waiting for verse input"
    }

    // Invalid pattern with separator
    return null;
  } else {
    // Try to parse space-separated verse patterns:
    // - "gen 3 16" (book, chapter, verse with spaces)
    // - "ge1 1" (compact book+chapter, then verse)
    // - "1 cor 13 4" (numbered book)

    // First try the most general pattern: anything followed by two space-separated numbers
    const verseMatch = trimmed.match(/^([a-z0-9\s]*?)(\d+)\s+(\d+)$/i);
    if (verseMatch) {
      const [, bookPart, chapterPart, versePart] = verseMatch;
      const bookQuery = bookPart.replace(/\s+/g, '').toLowerCase().trim();
      const chapter = parseInt(chapterPart, 10);
      const verse = parseInt(versePart, 10);
      return { bookQuery, chapter, verse };
    }

    // Check for partial space-separated input: "gen 3 " or "gen2 " (trailing space, waiting for verse)
    const hasTrailingSpace = input !== input.trimEnd();
    if (hasTrailingSpace) {
      // Check if trimmed has book+chapter pattern (matches any input ending with chapter number)
      const match = trimmed.match(/^([a-z0-9\s]*?)(\d+)$/i);
      if (match) {
        const [, bookPart, chapterPart] = match;
        const bookQuery = bookPart.replace(/\s+/g, '').toLowerCase().trim();
        const chapter = parseInt(chapterPart, 10);
        return { bookQuery, chapter, verse: 0 }; // verse: 0 indicates "waiting for verse input"
      }
    }

    // Chapter mode only: "gen3" or "gen 20"
    const match = trimmed.match(/^([a-z0-9\s]*?)(\d+)$/i);
    if (!match) return null;

    const [, bookPart, chapterPart] = match;
    const bookQuery = bookPart.replace(/\s+/g, '').toLowerCase().trim();

    // If there's no book identifier, don't treat it as a chapter pattern
    // Just "1" should filter by book name starting with "1", not chapter 1
    if (!bookQuery) return null;

    const chapter = parseInt(chapterPart, 10);

    return { bookQuery, chapter };
  }
}

/**
 * Finds a book by query string, supporting various abbreviation patterns
 *
 * @param bookQuery - The search query (e.g., "gen", "1co", "matt")
 * @param allBooks - Array of all available books
 * @returns The matching book or null
 */
export function findBookByQuery(bookQuery: string, allBooks: BookInfo[]): BookInfo | null {
  const queryLower = bookQuery.toLowerCase();

  return allBooks.find(book => {
    const bookLower = book.name.toLowerCase();

    // Direct prefix match
    if (bookLower.startsWith(queryLower)) return true;

    // Handle numbered books: "1co" matches "1 Corinthians"
    const nameWords = bookLower.split(' ');
    if (nameWords.length > 1 && queryLower.length >= 2) {
      const firstChar = nameWords[0];
      const secondStart = nameWords[1].substring(0, queryLower.length - 1);
      if (queryLower === firstChar + secondStart) return true;
    }

    return false;
  }) || null;
}

/**
 * Parses search input and validates against available books
 *
 * @param input - The search string
 * @param allBooks - Array of all available books
 * @returns Search result with book name, chapter, and optionally verse, or null if invalid
 */
export function parseSearch(input: string, allBooks: BookInfo[]): SearchResult | null {
  const parsed = parseBookChapterVerse(input);
  if (!parsed) return null;

  const { bookQuery, chapter, verse } = parsed;

  const foundBook = findBookByQuery(bookQuery, allBooks);

  if (foundBook && chapter > 0 && chapter <= foundBook.chapters) {
    return { book: foundBook.name, chapter, verse };
  }

  return null;
}

/**
 * Checks if a string matches a filter (case-insensitive prefix match)
 *
 * @param text - The text to check
 * @param filter - The filter string
 * @returns true if text starts with filter (case-insensitive)
 */
export function matchesFilter(text: string, filter: string): boolean {
  if (!filter) return true;
  const textLower = text.toLowerCase();
  const filterLower = filter.toLowerCase();
  return textLower.startsWith(filterLower);
}

/**
 * Extracts book filter from search text
 * Returns the book portion of the search string without chapter/verse
 *
 * @param searchText - The full search string
 * @returns Just the book portion
 */
export function extractBookFilter(searchText: string): string {
  const parsed = parseBookChapterVerse(searchText);
  if (parsed) {
    return parsed.bookQuery;
  }
  return searchText.trim().toLowerCase();
}

/**
 * Extracts chapter filter from search text
 *
 * @param searchText - The full search string
 * @returns Chapter number or null
 */
export function extractChapterFilter(searchText: string): number | null {
  const parsed = parseBookChapterVerse(searchText);
  return parsed ? parsed.chapter : null;
}

/**
 * Extracts verse filter from search text
 *
 * @param searchText - The full search string
 * @returns Verse number or null
 */
export function extractVerseFilter(searchText: string): number | null {
  const parsed = parseBookChapterVerse(searchText);
  return (parsed && parsed.verse && parsed.verse > 0) ? parsed.verse : null;
}
