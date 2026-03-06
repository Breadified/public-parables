/**
 * Bible Store - Legacy unified store (backward compatibility layer)
 *
 * This file maintains backward compatibility by re-exporting from the new feature-based stores.
 * New code should import directly from the specific stores:
 * - import { tabStore$ } from './state/tabStore'
 * - import { notesStore$ } from './state/notesStore'
 * - import { bibleDataStore$ } from './state/bibleDataStore'
 * - import { navigationStore$ } from './state/navigationStore'
 * - import { appStateStore$ } from './state/appStateStore'
 */

import { observable } from "@legendapp/state";
import { tabStore$ } from './tabStore';
import { notesStore$, activeNotes$ } from './notesStore';
import { bibleDataStore$ } from './bibleDataStore';
import { navigationStore$ } from './navigationStore';
import { appStateStore$ } from './appStateStore';
import type { UnifiedAuthState } from "../types/stores";

// Re-export types for backward compatibility
export type {
  VerseLineJSON,
  ParagraphJSON,
  SectionJSON,
  ChapterJSON,
  BookJSON,
  BibleDataJSON,
  VerseLineData,
  ParagraphData,
  SectionData,
  ChapterData,
  BookData,
  BibleData,
  TabState,
  NavigationLocation,
  UnifiedAuthState
} from "../types/stores";

export type {
  BookmarkData,
  NoteData,
  AIContextData,
  CrossReferenceData,
  UserProfileData,
  ReadingSessionData,
  SearchHistoryData
} from './notesStore';

/**
 * Unified Bible Store - Backward Compatibility Proxy
 *
 * This re-exports all store properties to maintain backward compatibility.
 * Directly references the observable properties from feature stores.
 */
export const bibleStore$: any = {
  // ========================================
  // BIBLE DATA (from bibleDataStore$)
  // ========================================
  books: bibleDataStore$.books,
  chapters: bibleDataStore$.chapters,
  sections: bibleDataStore$.sections,
  paragraphs: bibleDataStore$.paragraphs,
  verse_lines: bibleDataStore$.verse_lines,
  current_verse_line_id: bibleDataStore$.current_verse_line_id,
  current_verse_id: bibleDataStore$.current_verse_id,
  currentPosition: bibleDataStore$.currentPosition,

  // ========================================
  // TABS (from tabStore$)
  // ========================================
  tabs: tabStore$.tabs,
  active_tab_index: tabStore$.active_tab_index,
  tabHistory: tabStore$.tabHistory,
  activeTabSelectedVerse: tabStore$.activeTabSelectedVerse,
  activeTabSelectedChapter: tabStore$.activeTabSelectedChapter,
  addTab: (...args: Parameters<typeof tabStore$.addTab>) => tabStore$.addTab(...args),
  removeTab: (index: number) => tabStore$.removeTab(index),
  switchTab: (index: number) => {
    tabStore$.switchTab(index, () => appStateStore$.prevent_navigation_updates.get());
  },
  updateActiveTabTitle: (title: string) => tabStore$.updateActiveTabTitle(title),
  setActiveTabSelectedVerse: (verseId: number | null) => tabStore$.setActiveTabSelectedVerse(verseId),
  clearActiveTabSelections: () => tabStore$.clearActiveTabSelections(),
  clearAllTabs: () => tabStore$.clearAllTabs(),
  saveTabsToStorage: () => tabStore$.saveTabsToStorage(),
  loadTabsFromStorage: () => tabStore$.loadTabsFromStorage(),
  clearAllVerseSelections: () => tabStore$.clearAllVerseSelections(),
  goBackTab: () => tabStore$.goBackTab(),
  canGoBackTab: () => tabStore$.canGoBackTab(),
  clearTabHistory: () => tabStore$.clearTabHistory(),

  // ========================================
  // NOTES (from notesStore$)
  // ========================================
  notes: notesStore$.notes, // All notes (active + inactive)
  activeNotes: activeNotes$, // Computed: only active notes (separate export)
  expandedNotes: notesStore$.expandedNotes,
  bookmarks: notesStore$.bookmarks,
  crossReferences: notesStore$.crossReferences,
  userProfile: notesStore$.userProfile,
  readingSessions: notesStore$.readingSessions,
  searchHistory: notesStore$.searchHistory,
  aiContext: notesStore$.aiContext,
  toggleNoteExpansion: (noteId: string) => notesStore$.toggleNoteExpansion(noteId),
  setNoteExpanded: (noteId: string, isExpanded: boolean) => notesStore$.setNoteExpanded(noteId, isExpanded),
  isNoteExpanded: (noteId: string) => notesStore$.isNoteExpanded(noteId),
  softDeleteNote: (noteId: string) => notesStore$.softDeleteNote(noteId),
  restoreNote: (noteId: string) => notesStore$.restoreNote(noteId),
  permanentlyDeleteNote: (noteId: string) => notesStore$.permanentlyDeleteNote(noteId),
  saveNotesToStorage: () => notesStore$.saveNotesToStorage(),
  loadNotesFromStorage: () => notesStore$.loadNotesFromStorage(),
  saveExpandedNotesToStorage: () => notesStore$.saveExpandedNotesToStorage(),
  loadExpandedNotesFromStorage: () => notesStore$.loadExpandedNotesFromStorage(),

  // ========================================
  // NAVIGATION (from navigationStore$)
  // ========================================
  recentLocations: navigationStore$.recentLocations,
  addRecentLocation: (chapterId: number, bookName: string, chapterNumber: number) =>
    navigationStore$.addRecentLocation(chapterId, bookName, chapterNumber),

  // ========================================
  // APP STATE (from appStateStore$)
  // ========================================
  is_loading: appStateStore$.is_loading,
  is_background_loading: appStateStore$.is_background_loading,
  prevent_navigation_updates: appStateStore$.prevent_navigation_updates,
  last_sync_timestamp: appStateStore$.last_sync_timestamp,
  data_loading_status: appStateStore$.data_loading_status,
  loading_window_start: appStateStore$.loading_window_start,
  loading_window_end: appStateStore$.loading_window_end,
  total_chapters_available: appStateStore$.total_chapters_available,
  is_expanding_window: appStateStore$.is_expanding_window,
};

// Unified auth store (kept in this file for now)
export const authStore$ = observable<UnifiedAuthState>({
  network: 'offline',
  auth: 'none',
  storage: 'empty',
  experience: 'landing',
  shouldSync: false,
  user: null,
  deviceId: null,
  token: null,
  hasSignedInOnDevice: false,
  isInAuthFlow: false,
  returnUrl: null,
});
