/**
 * Bible Book Mappings - Single Source of Truth
 * All book data, abbreviations, and mappings in one place
 *
 * Bible IDs follow a numerical pattern:
 * - Book ID: X000000 (e.g., Genesis = 1000000)
 * - Chapter ID: X00Y000 (e.g., Genesis 1 = 1001000)
 * - Verse ID: X00Y00Z (e.g., Genesis 1:1 = 1001001)
 *
 * Abbreviations based on Logos standard: https://www.logos.com/bible-book-abbreviations
 */

import { BOOK_NAMES_ZH, findBookIdByChineseName, containsChinese } from './bookNameTranslations';

export type Testament = 'old' | 'new';

export type BookCategory =
  | 'law' | 'history' | 'poetry' | 'majorProphets' | 'minorProphets'
  | 'gospels' | 'acts' | 'paulLetters' | 'generalLetters' | 'prophecy';

export interface BibleBook {
  id: number;
  name: string;
  abbrev: string;           // Standard abbreviation (Logos)
  aliases: string[];        // Alternative abbreviations for fuzzy matching
  chapters: number;
  testament: Testament;
  category: BookCategory;
}

/**
 * Master list of all 66 Bible books
 * Single source of truth for the entire application
 */
export const BIBLE_BOOKS: BibleBook[] = [
  // Old Testament - Law (Torah/Pentateuch)
  { id: 1, name: 'Genesis', abbrev: 'Gen', aliases: ['ge', 'gn'], chapters: 50, testament: 'old', category: 'law' },
  { id: 2, name: 'Exodus', abbrev: 'Ex', aliases: ['exo', 'exod'], chapters: 40, testament: 'old', category: 'law' },
  { id: 3, name: 'Leviticus', abbrev: 'Lev', aliases: ['le', 'lv'], chapters: 27, testament: 'old', category: 'law' },
  { id: 4, name: 'Numbers', abbrev: 'Num', aliases: ['nu', 'nm'], chapters: 36, testament: 'old', category: 'law' },
  { id: 5, name: 'Deuteronomy', abbrev: 'Deut', aliases: ['dt', 'de'], chapters: 34, testament: 'old', category: 'law' },

  // Old Testament - History
  { id: 6, name: 'Joshua', abbrev: 'Josh', aliases: ['jos', 'jsh'], chapters: 24, testament: 'old', category: 'history' },
  { id: 7, name: 'Judges', abbrev: 'Judg', aliases: ['jdg', 'jg'], chapters: 21, testament: 'old', category: 'history' },
  { id: 8, name: 'Ruth', abbrev: 'Ruth', aliases: ['ru', 'rut'], chapters: 4, testament: 'old', category: 'history' },
  { id: 9, name: '1 Samuel', abbrev: '1Sam', aliases: ['1sa', '1s'], chapters: 31, testament: 'old', category: 'history' },
  { id: 10, name: '2 Samuel', abbrev: '2Sam', aliases: ['2sa', '2s'], chapters: 24, testament: 'old', category: 'history' },
  { id: 11, name: '1 Kings', abbrev: '1Kings', aliases: ['1ki', '1kgs', '1k'], chapters: 22, testament: 'old', category: 'history' },
  { id: 12, name: '2 Kings', abbrev: '2Kings', aliases: ['2ki', '2kgs', '2k'], chapters: 25, testament: 'old', category: 'history' },
  { id: 13, name: '1 Chronicles', abbrev: '1Chron', aliases: ['1ch', '1chr'], chapters: 29, testament: 'old', category: 'history' },
  { id: 14, name: '2 Chronicles', abbrev: '2Chron', aliases: ['2ch', '2chr'], chapters: 36, testament: 'old', category: 'history' },
  { id: 15, name: 'Ezra', abbrev: 'Ezra', aliases: ['ezr', 'ez'], chapters: 10, testament: 'old', category: 'history' },
  { id: 16, name: 'Nehemiah', abbrev: 'Neh', aliases: ['ne'], chapters: 13, testament: 'old', category: 'history' },
  { id: 17, name: 'Esther', abbrev: 'Est', aliases: ['es', 'esth'], chapters: 10, testament: 'old', category: 'history' },

  // Old Testament - Poetry/Wisdom
  { id: 18, name: 'Job', abbrev: 'Job', aliases: ['jb'], chapters: 42, testament: 'old', category: 'poetry' },
  { id: 19, name: 'Psalms', abbrev: 'Ps', aliases: ['psa', 'psalm', 'pss'], chapters: 150, testament: 'old', category: 'poetry' },
  { id: 20, name: 'Proverbs', abbrev: 'Prov', aliases: ['pr', 'pro'], chapters: 31, testament: 'old', category: 'poetry' },
  { id: 21, name: 'Ecclesiastes', abbrev: 'Eccles', aliases: ['ec', 'ecc', 'eccl'], chapters: 12, testament: 'old', category: 'poetry' },
  { id: 22, name: 'Song of Solomon', abbrev: 'Song', aliases: ['ss', 'sos', 'sg'], chapters: 8, testament: 'old', category: 'poetry' },

  // Old Testament - Major Prophets
  { id: 23, name: 'Isaiah', abbrev: 'Isa', aliases: ['is'], chapters: 66, testament: 'old', category: 'majorProphets' },
  { id: 24, name: 'Jeremiah', abbrev: 'Jer', aliases: ['je'], chapters: 52, testament: 'old', category: 'majorProphets' },
  { id: 25, name: 'Lamentations', abbrev: 'Lam', aliases: ['la'], chapters: 5, testament: 'old', category: 'majorProphets' },
  { id: 26, name: 'Ezekiel', abbrev: 'Ezek', aliases: ['eze', 'ezk'], chapters: 48, testament: 'old', category: 'majorProphets' },
  { id: 27, name: 'Daniel', abbrev: 'Dan', aliases: ['da', 'dn'], chapters: 12, testament: 'old', category: 'majorProphets' },

  // Old Testament - Minor Prophets
  { id: 28, name: 'Hosea', abbrev: 'Hos', aliases: ['ho'], chapters: 14, testament: 'old', category: 'minorProphets' },
  { id: 29, name: 'Joel', abbrev: 'Joel', aliases: ['jl', 'joe'], chapters: 3, testament: 'old', category: 'minorProphets' },
  { id: 30, name: 'Amos', abbrev: 'Amos', aliases: ['am'], chapters: 9, testament: 'old', category: 'minorProphets' },
  { id: 31, name: 'Obadiah', abbrev: 'Obad', aliases: ['ob', 'oba'], chapters: 1, testament: 'old', category: 'minorProphets' },
  { id: 32, name: 'Jonah', abbrev: 'Jonah', aliases: ['jon', 'jnh'], chapters: 4, testament: 'old', category: 'minorProphets' },
  { id: 33, name: 'Micah', abbrev: 'Mic', aliases: ['mi'], chapters: 7, testament: 'old', category: 'minorProphets' },
  { id: 34, name: 'Nahum', abbrev: 'Nah', aliases: ['na'], chapters: 3, testament: 'old', category: 'minorProphets' },
  { id: 35, name: 'Habakkuk', abbrev: 'Hab', aliases: ['hb'], chapters: 3, testament: 'old', category: 'minorProphets' },
  { id: 36, name: 'Zephaniah', abbrev: 'Zeph', aliases: ['zep', 'zp'], chapters: 3, testament: 'old', category: 'minorProphets' },
  { id: 37, name: 'Haggai', abbrev: 'Hag', aliases: ['hg'], chapters: 2, testament: 'old', category: 'minorProphets' },
  { id: 38, name: 'Zechariah', abbrev: 'Zech', aliases: ['zec', 'zc'], chapters: 14, testament: 'old', category: 'minorProphets' },
  { id: 39, name: 'Malachi', abbrev: 'Mal', aliases: ['ml'], chapters: 4, testament: 'old', category: 'minorProphets' },

  // New Testament - Gospels
  { id: 40, name: 'Matthew', abbrev: 'Matt', aliases: ['mt', 'mat'], chapters: 28, testament: 'new', category: 'gospels' },
  { id: 41, name: 'Mark', abbrev: 'Mark', aliases: ['mk', 'mar'], chapters: 16, testament: 'new', category: 'gospels' },
  { id: 42, name: 'Luke', abbrev: 'Luke', aliases: ['lk', 'luk'], chapters: 24, testament: 'new', category: 'gospels' },
  { id: 43, name: 'John', abbrev: 'John', aliases: ['jn', 'joh'], chapters: 21, testament: 'new', category: 'gospels' },

  // New Testament - Acts
  { id: 44, name: 'Acts', abbrev: 'Acts', aliases: ['ac', 'act'], chapters: 28, testament: 'new', category: 'acts' },

  // New Testament - Paul's Letters
  { id: 45, name: 'Romans', abbrev: 'Rom', aliases: ['ro'], chapters: 16, testament: 'new', category: 'paulLetters' },
  { id: 46, name: '1 Corinthians', abbrev: '1Cor', aliases: ['1co'], chapters: 16, testament: 'new', category: 'paulLetters' },
  { id: 47, name: '2 Corinthians', abbrev: '2Cor', aliases: ['2co'], chapters: 13, testament: 'new', category: 'paulLetters' },
  { id: 48, name: 'Galatians', abbrev: 'Gal', aliases: ['ga'], chapters: 6, testament: 'new', category: 'paulLetters' },
  { id: 49, name: 'Ephesians', abbrev: 'Eph', aliases: ['ep'], chapters: 6, testament: 'new', category: 'paulLetters' },
  { id: 50, name: 'Philippians', abbrev: 'Phil', aliases: ['php', 'pp'], chapters: 4, testament: 'new', category: 'paulLetters' },
  { id: 51, name: 'Colossians', abbrev: 'Col', aliases: ['cl'], chapters: 4, testament: 'new', category: 'paulLetters' },
  { id: 52, name: '1 Thessalonians', abbrev: '1Thess', aliases: ['1th'], chapters: 5, testament: 'new', category: 'paulLetters' },
  { id: 53, name: '2 Thessalonians', abbrev: '2Thess', aliases: ['2th'], chapters: 3, testament: 'new', category: 'paulLetters' },
  { id: 54, name: '1 Timothy', abbrev: '1Tim', aliases: ['1ti', '1tm'], chapters: 6, testament: 'new', category: 'paulLetters' },
  { id: 55, name: '2 Timothy', abbrev: '2Tim', aliases: ['2ti', '2tm'], chapters: 4, testament: 'new', category: 'paulLetters' },
  { id: 56, name: 'Titus', abbrev: 'Titus', aliases: ['tit', 'tt'], chapters: 3, testament: 'new', category: 'paulLetters' },
  { id: 57, name: 'Philemon', abbrev: 'Philem', aliases: ['phm', 'pm'], chapters: 1, testament: 'new', category: 'paulLetters' },

  // New Testament - General Letters
  { id: 58, name: 'Hebrews', abbrev: 'Heb', aliases: ['he'], chapters: 13, testament: 'new', category: 'generalLetters' },
  { id: 59, name: 'James', abbrev: 'James', aliases: ['jam', 'jm', 'jas'], chapters: 5, testament: 'new', category: 'generalLetters' },
  { id: 60, name: '1 Peter', abbrev: '1Pet', aliases: ['1pe', '1pt'], chapters: 5, testament: 'new', category: 'generalLetters' },
  { id: 61, name: '2 Peter', abbrev: '2Pet', aliases: ['2pe', '2pt'], chapters: 3, testament: 'new', category: 'generalLetters' },
  { id: 62, name: '1 John', abbrev: '1John', aliases: ['1jn', '1jo'], chapters: 5, testament: 'new', category: 'generalLetters' },
  { id: 63, name: '2 John', abbrev: '2John', aliases: ['2jn', '2jo'], chapters: 1, testament: 'new', category: 'generalLetters' },
  { id: 64, name: '3 John', abbrev: '3John', aliases: ['3jn', '3jo'], chapters: 1, testament: 'new', category: 'generalLetters' },
  { id: 65, name: 'Jude', abbrev: 'Jude', aliases: ['jd'], chapters: 1, testament: 'new', category: 'generalLetters' },

  // New Testament - Prophecy
  { id: 66, name: 'Revelation', abbrev: 'Rev', aliases: ['re', 'rv'], chapters: 22, testament: 'new', category: 'prophecy' },
];

// ============================================================================
// DERIVED LOOKUP MAPS (computed once at load time for O(1) access)
// ============================================================================

/** Map of book ID -> book info */
export const BOOK_BY_ID = new Map<number, BibleBook>(
  BIBLE_BOOKS.map(book => [book.id, book])
);

/** Map of lowercase name/abbrev/alias -> book info */
export const BOOK_BY_NAME = new Map<string, BibleBook>();
BIBLE_BOOKS.forEach(book => {
  BOOK_BY_NAME.set(book.name.toLowerCase(), book);
  BOOK_BY_NAME.set(book.abbrev.toLowerCase(), book);
  book.aliases.forEach(alias => BOOK_BY_NAME.set(alias.toLowerCase(), book));
});

/** Legacy format: book ID -> name */
export const BIBLE_BOOK_NAMES: Record<number, string> = Object.fromEntries(
  BIBLE_BOOKS.map(book => [book.id, book.name])
);

/** Legacy format: book ID -> chapter count */
export const BIBLE_BOOK_CHAPTER_COUNTS: Record<number, number> = Object.fromEntries(
  BIBLE_BOOKS.map(book => [book.id, book.chapters])
);

/** Legacy format: name -> book ID */
export const BOOK_IDS: Record<string, number> = Object.fromEntries(
  BIBLE_BOOKS.map(book => [book.name, book.id])
);

/** Chapter offsets for global index calculation */
export const BIBLE_BOOK_CHAPTER_OFFSETS: Record<number, number> = {};
let offset = 0;
BIBLE_BOOKS.forEach(book => {
  BIBLE_BOOK_CHAPTER_OFFSETS[book.id] = offset;
  offset += book.chapters;
});

// ============================================================================
// BOOK LOOKUP FUNCTIONS
// ============================================================================

/**
 * Get book by ID (1-66)
 */
export function getBookById(bookId: number): BibleBook | undefined {
  return BOOK_BY_ID.get(bookId);
}

/**
 * Get book by name, abbreviation, or alias (case-insensitive)
 */
export function getBookByName(name: string): BibleBook | undefined {
  return BOOK_BY_NAME.get(name.toLowerCase().trim());
}

/**
 * Find book by partial name (fuzzy matching)
 * Supports both English and Chinese book names
 */
export function findBookByPartialName(input: string): BibleBook | undefined {
  const trimmed = input.trim();
  if (!trimmed) return undefined;

  // Check if input contains Chinese characters
  if (containsChinese(trimmed)) {
    const bookId = findBookIdByChineseName(trimmed);
    if (bookId !== undefined) {
      return BOOK_BY_ID.get(bookId);
    }
    return undefined;
  }

  // English matching (existing logic)
  const normalized = trimmed.toLowerCase();

  // Normalize numbered books: "2peter" -> "2 peter", "1john" -> "1 john"
  // This handles compact references like [[bibleRef:2Peter1:16]]
  const withSpace = normalized.replace(/^(\d)([a-z])/, '$1 $2');

  // Exact match first (try both with and without space normalization)
  const exact = BOOK_BY_NAME.get(normalized) || BOOK_BY_NAME.get(withSpace);
  if (exact) return exact;

  // Starts-with match (check both normalized forms)
  const startsWith = BIBLE_BOOKS.find(book => {
    const bookNameLower = book.name.toLowerCase();
    const abbrevLower = book.abbrev.toLowerCase();
    return (
      bookNameLower.startsWith(normalized) ||
      bookNameLower.startsWith(withSpace) ||
      abbrevLower.startsWith(normalized) ||
      abbrevLower.startsWith(withSpace) ||
      book.aliases.some(a => a.startsWith(normalized) || a.startsWith(withSpace))
    );
  });
  if (startsWith) return startsWith;

  // Contains match
  return BIBLE_BOOKS.find(book =>
    book.name.toLowerCase().includes(normalized) ||
    book.name.toLowerCase().includes(withSpace) ||
    book.aliases.some(a => a.includes(normalized) || a.includes(withSpace))
  );
}

/**
 * Find book by prefix only (strict matching - no "contains" fallback)
 * Used for autocomplete suggestions where we don't want "tes" to match "Ecclesiastes"
 * Supports both English and Chinese book names
 */
export function findBookByPrefix(input: string): BibleBook | undefined {
  const trimmed = input.trim();
  if (!trimmed) return undefined;

  // Check if input contains Chinese characters
  if (containsChinese(trimmed)) {
    // For Chinese, use the same lookup (it already does prefix matching)
    const bookId = findBookIdByChineseName(trimmed);
    if (bookId !== undefined) {
      return BOOK_BY_ID.get(bookId);
    }
    return undefined;
  }

  // English matching (existing logic)
  const normalized = trimmed.toLowerCase();
  if (normalized.length < 2) return undefined;

  // Exact match first
  const exact = BOOK_BY_NAME.get(normalized);
  if (exact) return exact;

  // Starts-with match only (no "contains" fallback)
  return BIBLE_BOOKS.find(book =>
    book.name.toLowerCase().startsWith(normalized) ||
    book.abbrev.toLowerCase().startsWith(normalized) ||
    book.aliases.some(a => a.startsWith(normalized))
  );
}

/**
 * Get book name from book ID (legacy compatibility)
 */
export function getBookName(bookId: number): string {
  return BOOK_BY_ID.get(bookId)?.name || 'Unknown';
}

/**
 * Get book abbreviation from book ID
 */
export function getBookAbbrev(bookId: number): string {
  return BOOK_BY_ID.get(bookId)?.abbrev || '';
}

/**
 * Get all books by testament
 */
export function getBooksByTestament(testament: Testament): BibleBook[] {
  return BIBLE_BOOKS.filter(book => book.testament === testament);
}

/**
 * Get all books by category
 */
export function getBooksByCategory(category: BookCategory): BibleBook[] {
  return BIBLE_BOOKS.filter(book => book.category === category);
}

// ============================================================================
// CHAPTER/VERSE ID FUNCTIONS
// ============================================================================

/**
 * Get chapter number from chapter ID using X00Y000 structure
 */
export function getChapterNumber(chapterId: number): number {
  return Math.floor((chapterId % 1000000) / 1000);
}

/**
 * Get display name for chapter (e.g., "Genesis 1", "Matthew 28")
 */
export function getChapterDisplayName(chapterId: number): string {
  const bookNumber = Math.floor(chapterId / 1000000);
  const chapterNumber = getChapterNumber(chapterId);
  const bookName = getBookName(bookNumber);

  if (bookName === 'Unknown') {
    console.warn(`Unknown book number: ${bookNumber} from chapter ID ${chapterId}`);
    return `Chapter ${chapterNumber}`;
  }

  return `${bookName} ${chapterNumber}`;
}

/**
 * Get localized book name based on language code
 * Falls back to English if translation unavailable
 */
export function getLocalizedBookName(bookId: number, language: string = 'en'): string {
  if (language === 'zh') {
    return BOOK_NAMES_ZH[bookId] || getBookName(bookId);
  }
  return getBookName(bookId); // English is default
}

/**
 * Get localized chapter display name (e.g., "约翰福音 3" or "John 3")
 */
export function getLocalizedChapterDisplayName(chapterId: number, language: string = 'en'): string {
  const bookId = Math.floor(chapterId / 1000000);
  const chapterNum = Math.floor((chapterId % 1000000) / 1000);
  return `${getLocalizedBookName(bookId, language)} ${chapterNum}`;
}

/**
 * Calculate global chapter index from chapter ID
 */
export function getGlobalChapterIndexFromId(chapterId: number): number {
  const bookNumber = Math.floor(chapterId / 1000000);
  const chapterNumber = Math.floor((chapterId % 1000000) / 1000);

  const bookOffset = BIBLE_BOOK_CHAPTER_OFFSETS[bookNumber];
  if (bookOffset === undefined) {
    console.warn(`Unknown book number: ${bookNumber} from chapter ID ${chapterId}`);
    return 0;
  }

  return bookOffset + (chapterNumber - 1);
}

/**
 * Calculate global chapter index from verse ID
 */
export function getGlobalChapterIndexFromVerseId(verseId: number): number {
  const bookNumber = Math.floor(verseId / 1000000);
  const chapterNumber = Math.floor((verseId % 1000000) / 1000);

  const bookOffset = BIBLE_BOOK_CHAPTER_OFFSETS[bookNumber];
  if (bookOffset === undefined) {
    console.warn(`Unknown book number: ${bookNumber} from verse ID ${verseId}`);
    return 0;
  }

  return bookOffset + (chapterNumber - 1);
}

/**
 * Validate if a chapter ID is valid
 */
export function isValidChapterId(chapterId: number): boolean {
  if (!chapterId || typeof chapterId !== 'number' || isNaN(chapterId)) {
    return false;
  }

  if (chapterId % 1000 !== 0) {
    return false;
  }

  const bookId = Math.floor(chapterId / 1000000);
  const chapterNum = Math.floor((chapterId % 1000000) / 1000);

  const book = BOOK_BY_ID.get(bookId);
  if (!book) return false;

  return chapterNum >= 1 && chapterNum <= book.chapters;
}

/**
 * Legacy function - kept for compatibility
 */
export function getGlobalChapterIndex(bookCode: string, chapterNumber: number): number {
  console.warn('Using legacy getGlobalChapterIndex - should migrate to numerical IDs');
  return chapterNumber - 1;
}

// ============================================================================
// CATEGORY COLORS (for UI)
// ============================================================================

export const CATEGORY_COLORS: Record<BookCategory, { color: string; lightBg: string; name: string }> = {
  law: { name: 'Law', color: '#6EE7B7', lightBg: '#F0FDF9' },
  history: { name: 'History', color: '#FDE68A', lightBg: '#FFFBEB' },
  poetry: { name: 'Poetry', color: '#C4B5FD', lightBg: '#F5F3FF' },
  majorProphets: { name: 'Major Prophets', color: '#FCA5A5', lightBg: '#FEF2F2' },
  minorProphets: { name: 'Minor Prophets', color: '#93C5FD', lightBg: '#EFF6FF' },
  gospels: { name: 'Gospels', color: '#6EE7B7', lightBg: '#ECFDF5' },
  acts: { name: 'Acts', color: '#F9A8D4', lightBg: '#FDF2F8' },
  paulLetters: { name: "Paul's Letters", color: '#C4B5FD', lightBg: '#FAF5FF' },
  generalLetters: { name: 'General Letters', color: '#FCD34D', lightBg: '#FEF3C7' },
  prophecy: { name: 'Prophecy', color: '#FCA5A5', lightBg: '#FEF2F2' },
};
