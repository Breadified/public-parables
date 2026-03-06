/**
 * Intent Detector for Search Input
 *
 * Determines whether user input should trigger:
 * - Book navigation (existing behavior): "john", "gen 3", "matthew 5:3"
 * - Semantic search (new): "what does the bible say about forgiveness"
 */

import {
  findBookByPrefix,
  findBookByPartialName,
  type BibleBook,
} from '../bible/bibleBookMappings';
import { containsChinese } from '../bible/bookNameTranslations';

// =============================================================================
// TYPES
// =============================================================================

export type SearchIntent =
  | {
      type: 'book';
      book: BibleBook;
      chapter?: number;
      verse?: number;
      verseEnd?: number; // For ranges like "John 3:16-17"
    }
  | {
      type: 'semantic';
      query: string;
    }
  | {
      type: 'keyword';
      query: string;
    }
  | {
      type: 'empty';
    };

// =============================================================================
// PATTERNS
// =============================================================================

/**
 * Regex patterns for Bible reference detection
 * Matches: "john", "john 3", "john 3:16", "john 3:16-17", "1 cor", "2peter 1:3"
 */

// Book only: "john", "genesis", "1 corinthians", "2peter"
const BOOK_ONLY_PATTERN = /^(\d?\s*[a-zA-Z]+)$/;

// Book + chapter: "john 3", "genesis 1", "1 cor 13"
const BOOK_CHAPTER_PATTERN = /^(\d?\s*[a-zA-Z]+)\s+(\d+)$/;

// Book + chapter:verse: "john 3:16", "genesis 1:1"
const BOOK_CHAPTER_VERSE_PATTERN = /^(\d?\s*[a-zA-Z]+)\s+(\d+)[:\s](\d+)$/;

// Book + chapter:verse-verse: "john 3:16-17"
const BOOK_CHAPTER_VERSE_RANGE_PATTERN =
  /^(\d?\s*[a-zA-Z]+)\s+(\d+)[:\s](\d+)\s*[-–]\s*(\d+)$/;

/**
 * Chinese Bible reference patterns
 * Matches: "约翰福音", "约翰福音 3", "约翰福音 3:16", "约3:16", "太5:3-12"
 */

// Chinese book only: "约翰福音", "创世记", "约"
const CHINESE_BOOK_ONLY_PATTERN = /^([\u4e00-\u9fff]+)$/;

// Chinese book + chapter: "约翰福音 3", "创世记 1", "约3"
const CHINESE_BOOK_CHAPTER_PATTERN = /^([\u4e00-\u9fff]+)\s*(\d+)$/;

// Chinese book + chapter:verse: "约翰福音 3:16", "约3:16"
const CHINESE_BOOK_CHAPTER_VERSE_PATTERN = /^([\u4e00-\u9fff]+)\s*(\d+)[:\s](\d+)$/;

// Chinese book + chapter:verse-verse: "约翰福音 3:16-17"
const CHINESE_BOOK_CHAPTER_VERSE_RANGE_PATTERN =
  /^([\u4e00-\u9fff]+)\s*(\d+)[:\s](\d+)\s*[-–]\s*(\d+)$/;

/**
 * Semantic search indicators - if input contains these, likely a question
 */
const SEMANTIC_INDICATORS = [
  'what',
  'why',
  'how',
  'when',
  'where',
  'who',
  'does',
  'is',
  'are',
  'can',
  'should',
  'about',
  'meaning',
  'explain',
  'tell me',
  'help me',
  'find',
  'search',
  'verses on',
  'passages about',
  'scripture on',
  'bible say',
];

/**
 * Words that could be book names but also appear in questions
 * e.g., "job" could be the book Job or "job" in "how to find a job"
 */
const AMBIGUOUS_BOOK_NAMES = ['job', 'mark', 'acts', 'james', 'jude', 'ruth'];

// =============================================================================
// DETECTION FUNCTIONS
// =============================================================================

/**
 * Check if input looks like a semantic query (question or topic search)
 */
function looksLikeSemantic(input: string): boolean {
  const lower = input.toLowerCase();

  // Contains question words or semantic indicators
  for (const indicator of SEMANTIC_INDICATORS) {
    if (lower.includes(indicator)) {
      return true;
    }
  }

  // Contains question mark
  if (input.includes('?')) {
    return true;
  }

  // More than 3 words is likely a question/phrase, not a reference
  const wordCount = input.trim().split(/\s+/).length;
  if (wordCount > 4) {
    return true;
  }

  return false;
}

/**
 * Check if input matches book navigation pattern
 * Supports both English and Chinese book names
 */
function matchBookPattern(
  input: string
): { book: BibleBook; chapter?: number; verse?: number; verseEnd?: number } | null {
  const trimmed = input.trim();

  // Check if input contains Chinese - use Chinese patterns
  if (containsChinese(trimmed)) {
    return matchChineseBookPattern(trimmed);
  }

  // English patterns (existing logic)
  // Try book + chapter:verse-verse range first
  const rangeMatch = trimmed.match(BOOK_CHAPTER_VERSE_RANGE_PATTERN);
  if (rangeMatch) {
    const book = findBookByPartialName(rangeMatch[1]);
    if (book) {
      return {
        book,
        chapter: parseInt(rangeMatch[2], 10),
        verse: parseInt(rangeMatch[3], 10),
        verseEnd: parseInt(rangeMatch[4], 10),
      };
    }
  }

  // Try book + chapter:verse
  const verseMatch = trimmed.match(BOOK_CHAPTER_VERSE_PATTERN);
  if (verseMatch) {
    const book = findBookByPartialName(verseMatch[1]);
    if (book) {
      return {
        book,
        chapter: parseInt(verseMatch[2], 10),
        verse: parseInt(verseMatch[3], 10),
      };
    }
  }

  // Try book + chapter
  const chapterMatch = trimmed.match(BOOK_CHAPTER_PATTERN);
  if (chapterMatch) {
    const book = findBookByPartialName(chapterMatch[1]);
    if (book) {
      return {
        book,
        chapter: parseInt(chapterMatch[2], 10),
      };
    }
  }

  // Try book only
  const bookOnlyMatch = trimmed.match(BOOK_ONLY_PATTERN);
  if (bookOnlyMatch) {
    // Use prefix matching for autocomplete-style detection
    const book = findBookByPrefix(bookOnlyMatch[1]);
    if (book) {
      return { book };
    }
  }

  return null;
}

/**
 * Match Chinese book patterns
 */
function matchChineseBookPattern(
  input: string
): { book: BibleBook; chapter?: number; verse?: number; verseEnd?: number } | null {
  // Try Chinese book + chapter:verse-verse range first
  const rangeMatch = input.match(CHINESE_BOOK_CHAPTER_VERSE_RANGE_PATTERN);
  if (rangeMatch) {
    const book = findBookByPartialName(rangeMatch[1]);
    if (book) {
      return {
        book,
        chapter: parseInt(rangeMatch[2], 10),
        verse: parseInt(rangeMatch[3], 10),
        verseEnd: parseInt(rangeMatch[4], 10),
      };
    }
  }

  // Try Chinese book + chapter:verse
  const verseMatch = input.match(CHINESE_BOOK_CHAPTER_VERSE_PATTERN);
  if (verseMatch) {
    const book = findBookByPartialName(verseMatch[1]);
    if (book) {
      return {
        book,
        chapter: parseInt(verseMatch[2], 10),
        verse: parseInt(verseMatch[3], 10),
      };
    }
  }

  // Try Chinese book + chapter
  const chapterMatch = input.match(CHINESE_BOOK_CHAPTER_PATTERN);
  if (chapterMatch) {
    const book = findBookByPartialName(chapterMatch[1]);
    if (book) {
      return {
        book,
        chapter: parseInt(chapterMatch[2], 10),
      };
    }
  }

  // Try Chinese book only
  const bookOnlyMatch = input.match(CHINESE_BOOK_ONLY_PATTERN);
  if (bookOnlyMatch) {
    const book = findBookByPartialName(bookOnlyMatch[1]);
    if (book) {
      return { book };
    }
  }

  return null;
}

/**
 * Handle ambiguous cases where input could be either book name or semantic
 * e.g., "job" could be Book of Job or "job search"
 */
function isAmbiguousBookName(input: string, book: BibleBook): boolean {
  const lower = input.toLowerCase().trim();

  // Check if it's an ambiguous book name AND appears to be part of a phrase
  if (AMBIGUOUS_BOOK_NAMES.includes(book.name.toLowerCase())) {
    // If the input is EXACTLY the book name (or close match), it's a book reference
    if (
      lower === book.name.toLowerCase() ||
      lower === book.abbrev.toLowerCase() ||
      book.aliases.includes(lower)
    ) {
      return false; // Not ambiguous - clearly a book reference
    }
    // Otherwise, might be part of a phrase
    return true;
  }

  return false;
}

// =============================================================================
// MAIN DETECTION FUNCTION
// =============================================================================

/**
 * Detect the intent of the user's search input
 *
 * @param input - Raw user input from search field
 * @returns SearchIntent indicating whether to use book navigation or semantic search
 */
export function detectIntent(input: string): SearchIntent {
  const trimmed = input.trim();

  // Empty input
  if (!trimmed) {
    return { type: 'empty' };
  }

  // For Chinese input, prioritize book matching
  if (containsChinese(trimmed)) {
    const bookMatch = matchBookPattern(trimmed);
    if (bookMatch) {
      return {
        type: 'book',
        book: bookMatch.book,
        chapter: bookMatch.chapter,
        verse: bookMatch.verse,
        verseEnd: bookMatch.verseEnd,
      };
    }
    // Chinese input that doesn't match a book - could be semantic search
    // But short Chinese inputs should show empty (might be typing a book name)
    if (trimmed.length <= 2) {
      return { type: 'empty' };
    }
    return { type: 'semantic', query: trimmed };
  }

  // If input clearly looks like a semantic query, use semantic search
  if (looksLikeSemantic(trimmed)) {
    return { type: 'semantic', query: trimmed };
  }

  // Try to match book navigation patterns
  const bookMatch = matchBookPattern(trimmed);
  if (bookMatch) {
    // Check for ambiguous cases
    if (isAmbiguousBookName(trimmed, bookMatch.book)) {
      // If just the ambiguous word alone, treat as book
      // If part of a longer phrase, treat as semantic
      const wordCount = trimmed.split(/\s+/).length;
      if (wordCount > 1) {
        return { type: 'semantic', query: trimmed };
      }
    }

    return {
      type: 'book',
      book: bookMatch.book,
      chapter: bookMatch.chapter,
      verse: bookMatch.verse,
      verseEnd: bookMatch.verseEnd,
    };
  }

  // Short inputs that look like partial book names should show book list, not semantic
  // e.g., "e", "ex", "joh" - these are clearly trying to type a book name
  // Only trigger semantic for longer inputs or those with spaces/punctuation
  const looksLikePartialBookName = /^[a-zA-Z0-9]+$/.test(trimmed) && trimmed.length < 4;
  if (looksLikePartialBookName) {
    return { type: 'empty' };
  }

  // Default to semantic search for any text query
  // This allows single words like "hope", "love", "faith" to trigger scripture search
  return { type: 'semantic', query: trimmed };
}

/**
 * Get a bibleRef format string from a book intent
 * e.g., "John3:16" or "Genesis1"
 */
export function intentToBibleRef(intent: SearchIntent): string | null {
  if (intent.type !== 'book') {
    return null;
  }

  let ref = intent.book.name;

  if (intent.chapter) {
    ref += intent.chapter;

    if (intent.verse) {
      ref += `:${intent.verse}`;

      if (intent.verseEnd) {
        ref += `-${intent.verseEnd}`;
      }
    }
  }

  return ref;
}

/**
 * Check if user is actively typing a book reference
 * Used for showing book suggestions during typing
 * Supports both English and Chinese book names
 */
export function isTypingBookReference(input: string): boolean {
  const trimmed = input.trim();
  if (!trimmed) return false;

  // For Chinese input, check if it matches a Chinese book pattern
  if (containsChinese(trimmed)) {
    // Extract Chinese characters from the beginning
    const chineseMatch = trimmed.match(/^([\u4e00-\u9fff]+)/);
    if (chineseMatch) {
      const book = findBookByPartialName(chineseMatch[1]);
      return book !== undefined;
    }
    return false;
  }

  // Check if it's just letters/numbers that could be a book name start
  // and doesn't contain semantic indicators
  if (looksLikeSemantic(trimmed)) {
    return false;
  }

  // Check if it matches any book pattern or is a partial book name
  const book = findBookByPrefix(trimmed.split(/\s+/)[0]);
  return book !== undefined;
}
