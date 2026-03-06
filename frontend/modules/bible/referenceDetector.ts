/**
 * Reference Detector - Bible Peek Feature
 * Detects Bible references and v[N] patterns as user types in notes
 */

import { BIBLE_BOOKS, type BibleBook } from './bibleBookMappings';
import { findBookByName, parseReference, type BookInfo } from './referenceParser';

export interface DetectedReference {
  type: 'bible' | 'verse-shorthand';
  text: string;
  startIndex: number;
  endIndex: number;
  bookMatch?: BookInfo;
  isComplete: boolean;
  suggestedReference?: string;
  verseNumber?: number; // For verse-shorthand type
}

/**
 * Regex patterns for detecting references
 */
const PATTERNS = {
  // Matches: v1, v 1, v.1, v. 1, verse1, verse 1
  // Group 1: prefix (v, v., v , v. , verse, verse )
  // Group 2: verse number
  verseShorthand: /\b(v\.?\s*|verse\s*)(\d+)\b/gi,

  // Matches potential Bible book names (3+ chars followed by optional numbers/colons)
  // Examples: "mat", "john 3", "john 3:", "gen3:16", "1 cor 13:4-7"
  potentialReference: /\b([1-3]?\s?[a-z]{3,})\s*(\d+)?[:\s;]?(\d+)?(?:-(\d+))?\b/gi,

  // Word boundary for detecting when user types
  wordBoundary: /\b/g,
};

/**
 * Detect v[number] shorthand in text
 * Matches: v1, v 1, v.1, v. 1, verse1, verse 1
 * Returns all matches found
 */
export function detectVerseShorthand(text: string): DetectedReference[] {
  const matches: DetectedReference[] = [];
  const regex = new RegExp(PATTERNS.verseShorthand);

  let match;
  while ((match = regex.exec(text)) !== null) {
    const verseNum = parseInt(match[2], 10); // Group 2 is the number
    matches.push({
      type: 'verse-shorthand',
      text: match[0],              // Full match (e.g., "v. 15" or "verse 1")
      startIndex: match.index,
      endIndex: match.index + match[0].length,
      isComplete: true,
      suggestedReference: `v${verseNum}`,
      verseNumber: verseNum,
    });
  }

  return matches;
}

/**
 * Detect potential Bible references in text
 * Checks if text matches any Bible book names (fuzzy matching)
 */
export function detectPotentialReferences(text: string): DetectedReference[] {
  const matches: DetectedReference[] = [];
  const regex = new RegExp(PATTERNS.potentialReference);

  let match;
  while ((match = regex.exec(text)) !== null) {
    const fullMatch = match[0];
    const bookPart = match[1]?.trim();
    const chapter = match[2];
    const verseStart = match[3];
    const verseEnd = match[4];

    if (!bookPart || bookPart.length < 3) continue;

    // Try to find a matching book
    const bookMatch = findBookByName(bookPart);

    if (bookMatch) {
      // Build suggested reference
      let suggested = bookMatch.name;
      if (chapter) {
        suggested += ` ${chapter}`;
        if (verseStart) {
          suggested += `:${verseStart}`;
          if (verseEnd) {
            suggested += `-${verseEnd}`;
          }
        }
      }

      matches.push({
        type: 'bible',
        text: fullMatch,
        startIndex: match.index,
        endIndex: match.index + fullMatch.length,
        bookMatch,
        isComplete: !!(chapter && verseStart), // Complete if has book, chapter, and verse
        suggestedReference: suggested,
      });
    }
  }

  return matches;
}

/**
 * Get current word/phrase being typed at cursor position
 * Used to trigger auto-suggest as user types
 */
export function getCurrentTypingContext(
  text: string,
  cursorPosition: number
): {
  word: string;
  startIndex: number;
  endIndex: number;
  isStartOfLine: boolean;
} | null {
  if (!text || cursorPosition < 0 || cursorPosition > text.length) {
    return null;
  }

  // Find word boundaries before and after cursor
  let startIndex = cursorPosition;
  let endIndex = cursorPosition;

  // Move back to find start of word/phrase
  while (startIndex > 0 && !/[\s\n]/.test(text[startIndex - 1])) {
    startIndex--;
  }

  // Move forward to find end of word/phrase
  while (endIndex < text.length && !/[\s\n]/.test(text[endIndex])) {
    endIndex++;
  }

  const word = text.slice(startIndex, endIndex);

  // Check if at start of line
  const beforeCursor = text.slice(0, startIndex).trim();
  const isStartOfLine = beforeCursor === '' || beforeCursor.endsWith('\n');

  return {
    word,
    startIndex,
    endIndex,
    isStartOfLine,
  };
}

/**
 * Check if current typing matches a Bible book (3+ characters)
 * Returns matching books sorted by relevance
 */
export function getBookMatchesForTyping(
  input: string,
  minChars: number = 3
): BookInfo[] {
  const normalized = input.toLowerCase().trim();

  if (normalized.length < minChars) return [];

  // Find all matching books from the unified list
  const matches = BIBLE_BOOKS.filter((book: BibleBook) =>
    book.name.toLowerCase().includes(normalized) ||
    book.abbrev.toLowerCase().includes(normalized) ||
    book.aliases.some((alt: string) => alt.includes(normalized))
  );

  // Sort by relevance
  matches.sort((a: BibleBook, b: BibleBook) => {
    // Exact match first
    const aExact =
      a.name.toLowerCase() === normalized ||
      a.abbrev.toLowerCase() === normalized ||
      a.aliases.some((alt: string) => alt === normalized);
    const bExact =
      b.name.toLowerCase() === normalized ||
      b.abbrev.toLowerCase() === normalized ||
      b.aliases.some((alt: string) => alt === normalized);

    if (aExact && !bExact) return -1;
    if (!aExact && bExact) return 1;

    // Starts with
    const aStarts =
      a.name.toLowerCase().startsWith(normalized) ||
      a.abbrev.toLowerCase().startsWith(normalized) ||
      a.aliases.some((alt: string) => alt.startsWith(normalized));
    const bStarts =
      b.name.toLowerCase().startsWith(normalized) ||
      b.abbrev.toLowerCase().startsWith(normalized) ||
      b.aliases.some((alt: string) => alt.startsWith(normalized));

    if (aStarts && !bStarts) return -1;
    if (!aStarts && bStarts) return 1;

    // Alphabetical
    return a.name.localeCompare(b.name);
  });

  // Convert BibleBook to BookInfo for backward compatibility
  return matches.map((book: BibleBook): BookInfo => ({
    ...book,
    number: book.id,
    shortName: book.abbrev,
    alternateNames: book.aliases,
    chapterCount: book.chapters,
  }));
}

/**
 * Check if a detected reference should be isolated on its own line
 * According to spec: must be at start of line (after linebreak or position 0)
 */
export function shouldIsolateReference(
  text: string,
  referenceStartIndex: number
): {
  shouldIsolate: boolean;
  isAtLineStart: boolean;
} {
  if (referenceStartIndex === 0) {
    return { shouldIsolate: false, isAtLineStart: true };
  }

  // Check if there's a linebreak immediately before the reference
  const charBefore = text[referenceStartIndex - 1];
  const isAtLineStart = charBefore === '\n';

  // Check if there's any non-whitespace content before on the same line
  const lineStart = text.lastIndexOf('\n', referenceStartIndex - 1);
  const contentBeforeOnLine = text
    .slice(lineStart + 1, referenceStartIndex)
    .trim();

  const shouldIsolate = contentBeforeOnLine.length > 0;

  return {
    shouldIsolate,
    isAtLineStart,
  };
}

/**
 * Parse book, chapter, verse from partial input (like SearchInterface does)
 * Supports: "gen3:16", "gen 3:16", "gen3;16", "gen 3 16"
 */
export function parsePartialInput(input: string): {
  bookQuery: string;
  chapter: string | null;
  verse: string | null;
  hasChapterSeparator: boolean;
  hasVerseSeparator: boolean;
} {
  const trimmed = input.trim();

  // Match patterns like "gen3:16", "gen 3:16", "gen3;16", "gen 3 16"
  const withColon = /^([a-z0-9\s]+?)\s*[:;]\s*(\d+)?$/i;
  const withSpace = /^([a-z\s]+?)\s+(\d+)\s*[:;\s]\s*(\d+)?$/i;
  const chapterOnly = /^([a-z\s]+?)\s+(\d+)\s*$/i;

  let match = trimmed.match(withColon);
  if (match) {
    return {
      bookQuery: match[1].trim(),
      chapter: null,
      verse: match[2] || null,
      hasChapterSeparator: false,
      hasVerseSeparator: true,
    };
  }

  match = trimmed.match(withSpace);
  if (match) {
    return {
      bookQuery: match[1].trim(),
      chapter: match[2],
      verse: match[3] || null,
      hasChapterSeparator: true,
      hasVerseSeparator: !!match[3],
    };
  }

  match = trimmed.match(chapterOnly);
  if (match) {
    return {
      bookQuery: match[1].trim(),
      chapter: match[2],
      verse: null,
      hasChapterSeparator: true,
      hasVerseSeparator: false,
    };
  }

  // Just book name
  return {
    bookQuery: trimmed,
    chapter: null,
    verse: null,
    hasChapterSeparator: false,
    hasVerseSeparator: false,
  };
}

/**
 * Generate range suggestions for auto-suggest
 * E.g., for "mat" suggest "Matthew 1:1-5"
 */
export function generateRangeSuggestions(
  bookMatch: BookInfo,
  chapter?: number
): string[] {
  const suggestions: string[] = [];

  // Default chapter suggestions with verse ranges
  const defaultChapter = chapter || 1;
  const rangePatterns = [
    { start: 1, end: 5 },
    { start: 1, end: 10 },
    { start: 1, end: 15 },
  ];

  rangePatterns.forEach(({ start, end }) => {
    suggestions.push(`${bookMatch.name} ${defaultChapter}:${start}-${end}`);
  });

  return suggestions;
}

/**
 * Detected complete Bible reference with full verse info
 * Used by both CommentInput and NoteContentParser
 */
export interface DetectedVerseReference {
  reference: string;      // Normalized reference (e.g., "John 3:16")
  bookNumber: number;     // 1-66
  chapter: number;
  verseStart: number;
  verseEnd: number;
  // Position info for marker insertion
  text: string;           // Original matched text
  startIndex: number;
  endIndex: number;
}

/**
 * Detect complete Bible references in text
 * Shared function used by CommentInput and NoteContentParser
 *
 * Uses detectPotentialReferences() for detection with fuzzy book matching,
 * then validates with parseReference() for complete references only.
 *
 * @param text - The text to scan for references
 * @returns Array of complete, validated Bible references
 */
export function detectCompleteBibleReferences(text: string): DetectedVerseReference[] {
  if (!text.trim()) return [];

  const refs = detectPotentialReferences(text);
  const verses: DetectedVerseReference[] = [];

  for (const ref of refs) {
    // Only process complete references (with chapter and verse)
    if (!ref.isComplete) continue;

    const parsed = parseReference(ref.suggestedReference || ref.text);
    if (!parsed.isValid || !parsed.chapter || !parsed.verseStart) continue;

    verses.push({
      reference: parsed.normalizedReference,
      bookNumber: parsed.bookNumber,
      chapter: parsed.chapter,
      verseStart: parsed.verseStart,
      verseEnd: parsed.verseEnd || parsed.verseStart,
      text: ref.text,
      startIndex: ref.startIndex,
      endIndex: ref.endIndex,
    });
  }

  return verses;
}

/**
 * Detect complete Bible reference at the end of a line
 * Used by NoteContentParser for triggering on space/newline
 *
 * @param lineText - The current line text (before trigger character)
 * @returns The last complete reference if it ends at the line end, null otherwise
 */
export function detectReferenceAtLineEnd(lineText: string): DetectedVerseReference | null {
  const refs = detectCompleteBibleReferences(lineText);

  if (refs.length === 0) return null;

  // Get the last reference
  const lastRef = refs[refs.length - 1];

  // Only return if it ends at the end of the line
  if (lastRef.endIndex === lineText.length) {
    return lastRef;
  }

  return null;
}
