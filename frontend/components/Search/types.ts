/**
 * Shared types for Search components
 */

export interface Book {
  name: string;
  chapters: number;
  category: string;
}

export interface CategoryColors {
  color: string;
  bg: string;
}

export type DisplayMode = 'chapters' | 'verses';

export interface ParsedSearch {
  book: string;
  chapter: number;
  verse?: number;
}

export interface SearchState {
  searchText: string;
  filterText: string;
  chapterFilter: string;
  verseFilter: string;
  expandedBook: string | null;
  displayMode: DisplayMode;
  selectedChapter: number | null;
  verseNumbers: number[];
}
