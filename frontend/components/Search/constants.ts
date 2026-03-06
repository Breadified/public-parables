/**
 * Constants for Search components
 * Imports from the unified bibleBookMappings.ts
 */

import {
  BIBLE_BOOKS,
  BOOK_IDS,
  CATEGORY_COLORS,
  getBooksByCategory,
  type BookCategory,
} from '../../modules/bible/bibleBookMappings';

// Re-export BOOK_IDS for backward compatibility
export { BOOK_IDS };

/**
 * Book categories with colors and books
 * Generated from the unified BIBLE_BOOKS list
 */
export const BOOK_CATEGORIES: Record<string, {
  name: string;
  color: string;
  lightBg: string;
  books: Array<{ name: string; chapters: number }>;
}> = {
  law: {
    ...CATEGORY_COLORS.law,
    books: getBooksByCategory('law').map(b => ({ name: b.name, chapters: b.chapters })),
  },
  history: {
    ...CATEGORY_COLORS.history,
    books: getBooksByCategory('history').map(b => ({ name: b.name, chapters: b.chapters })),
  },
  poetry: {
    ...CATEGORY_COLORS.poetry,
    books: getBooksByCategory('poetry').map(b => ({ name: b.name, chapters: b.chapters })),
  },
  majorProphets: {
    ...CATEGORY_COLORS.majorProphets,
    books: getBooksByCategory('majorProphets').map(b => ({ name: b.name, chapters: b.chapters })),
  },
  minorProphets: {
    ...CATEGORY_COLORS.minorProphets,
    books: getBooksByCategory('minorProphets').map(b => ({ name: b.name, chapters: b.chapters })),
  },
  gospels: {
    ...CATEGORY_COLORS.gospels,
    books: getBooksByCategory('gospels').map(b => ({ name: b.name, chapters: b.chapters })),
  },
  acts: {
    ...CATEGORY_COLORS.acts,
    books: getBooksByCategory('acts').map(b => ({ name: b.name, chapters: b.chapters })),
  },
  paulLetters: {
    ...CATEGORY_COLORS.paulLetters,
    books: getBooksByCategory('paulLetters').map(b => ({ name: b.name, chapters: b.chapters })),
  },
  generalLetters: {
    ...CATEGORY_COLORS.generalLetters,
    books: getBooksByCategory('generalLetters').map(b => ({ name: b.name, chapters: b.chapters })),
  },
  prophecy: {
    ...CATEGORY_COLORS.prophecy,
    books: getBooksByCategory('prophecy').map(b => ({ name: b.name, chapters: b.chapters })),
  },
};
