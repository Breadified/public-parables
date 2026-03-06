/**
 * Shared type definitions for Legend State stores
 * Extracted from bibleStore.ts for better organization
 */

// JSON input types (camelCase from the JSON file)
export interface VerseLineJSON {
  id: string;
  text: string;
  isIsolated: boolean;
  indentLevel: number;
  paragraphId: number;
  verseId: number;
  verseNumber: number;
}

export interface ParagraphJSON {
  id: number;
  sectionId: number;
  verseLines: VerseLineJSON[];
}

export interface SectionJSON {
  id: number;
  chapterId: number;
  title: string;
  paragraphs: ParagraphJSON[];
}

export interface ChapterJSON {
  id: number;
  chapterNumber: number;
  bookId: number;
  version: string;
  sections: SectionJSON[];
}

export interface BookJSON {
  id: number;
  name: string;
  testament: string;
  chapters: ChapterJSON[];
}

export interface BibleDataJSON {
  books: BookJSON[];
}

// Frontend data types with proper database alignment
export interface VerseLineData {
  id: string;
  text: string;
  is_isolated: boolean;
  indent_level: number;
  paragraph_id: number;
  verse_id: number;
  verse_number: number;
  created_at?: string;
  updated_at?: string;
}

export interface ParagraphData {
  id: number;
  section_id: number;
  paragraph_order: number;
  verse_lines: VerseLineData[];
  created_at?: string;
  updated_at?: string;
}

export interface SectionData {
  id: number;
  chapter_id: number;
  title: string;
  section_order: number;
  paragraphs: ParagraphData[];
  created_at?: string;
  updated_at?: string;
}

export interface ChapterData {
  id: number;
  chapter_number: number;
  book_id: number;
  version: string;
  sections: SectionData[];
  created_at?: string;
  updated_at?: string;
  _isPlaceholder?: boolean; // Flag to identify placeholder chapters during loading
}

export interface BookData {
  id: number;
  name: string;
  testament: 'Old' | 'New';
  book_order: number;
  abbreviation?: string | null;
  chapters: ChapterData[];
  created_at?: string;
  updated_at?: string;
}

export interface BibleData {
  books: BookData[];
}

// Tab state interface aligned with database
export interface TabState {
  id: string;
  user_id?: string;
  tab_id: string;
  current_chapter_id: number;  // Primary way to track tab position (e.g., 59004000 for James 4)
  scroll_position: number;
  title: string;
  tab_order: number;
  is_active: boolean;
  current_book_name: string;
  current_chapter_number: number;
  selected_verse_id: number | null; // Per-tab verse selection for highlighting
  selected_chapter_id: number | null; // Per-tab chapter selection for navigation (without verse highlighting)
  created_at?: string;
  updated_at?: string;
}

// Navigation location for history
export interface NavigationLocation {
  chapterId: number;
  bookName: string;
  chapterNumber: number;
  timestamp: number;
}

// Unified auth states as per CLAUDE.md
export interface UnifiedAuthState {
  network: 'offline' | 'online';
  auth: 'none' | 'anon' | 'authenticated';
  storage: 'empty' | 'device_id' | 'token';
  experience: 'landing' | 'local_app' | 'app_sync';
  shouldSync: boolean;
  user: any | null;
  deviceId: string | null;
  token: string | null;
  // Device sign-in tracking
  hasSignedInOnDevice: boolean;  // Ever authenticated on this device
  // Auth flow tracking
  isInAuthFlow: boolean; // Track when user is actively in auth screens
  // Return URL for post-auth navigation
  returnUrl: string | null; // Route to navigate to after auth completes
}
