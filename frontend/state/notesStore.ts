/**
 * Notes Store - Notes and expansion state management
 * Handles: notes CRUD, highlights CRUD, expansion state, persistence
 * Uses status field for soft delete (active/inactive)
 */

import { observable, computed } from "@legendapp/state";
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  Bookmark, Note, AIContext, CrossReference,
  UserProfile, ReadingSession, SearchHistory
} from "../types/database";
import type { HighlightColorName } from "../config/theme";

// Batched persistence for notes (reduces I/O during rapid typing)
let pendingNotesSaveTimeout: ReturnType<typeof setTimeout> | null = null;
const BATCH_SAVE_DELAY = 2000; // 2 seconds

// Database-aligned types for user content
export type BookmarkData = Bookmark;
export type NoteData = Note;
export type AIContextData = AIContext;
export type CrossReferenceData = CrossReference;
export type UserProfileData = UserProfile;
export type ReadingSessionData = ReadingSession;
export type SearchHistoryData = SearchHistory;

// Verse highlight type
export interface VerseHighlight {
  id: string;
  verse_id: number;
  color: HighlightColorName;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

export const notesStore$: any = observable({
  // Notes array (includes both active and inactive)
  notes: [] as NoteData[],

  // Note expansion state - track expanded state per note ID (allows multiple expanded notes)
  expandedNotes: {} as Record<string, boolean>,

  // Navigation state - for scrolling to and highlighting a specific note after navigation
  pendingNoteScroll: null as {
    noteId: string;
    chapterId: number;
  } | null,

  // Highlighted note ID - for gradient highlight animation
  highlightedNoteId: null as string | null,

  // Pending focus note ID - for auto-focusing newly created notes
  pendingFocusNoteId: null as string | null,

  // User content - other types for future use
  bookmarks: [] as BookmarkData[],
  crossReferences: [] as CrossReferenceData[],
  userProfile: null as UserProfileData | null,
  readingSessions: [] as ReadingSessionData[],
  searchHistory: [] as SearchHistoryData[],
  aiContext: [] as AIContextData[],

  // Verse highlights array (includes both active and inactive)
  highlights: [] as VerseHighlight[],

  // Toggle note expansion for a specific note (does NOT collapse others)
  toggleNoteExpansion: (noteId: string) => {
    // Get current expansion state for this note
    const currentState = notesStore$.expandedNotes[noteId]?.get() ?? false;

    // Toggle the state
    notesStore$.expandedNotes[noteId].set(!currentState);

    // Persist to storage
    notesStore$.saveExpandedNotesToStorage();
  },

  // Set expansion state for a specific note
  setNoteExpanded: (noteId: string, isExpanded: boolean) => {
    notesStore$.expandedNotes[noteId].set(isExpanded);
    notesStore$.saveExpandedNotesToStorage();
  },

  // Get expanded state for a note (defaults to false if not set)
  isNoteExpanded: (noteId: string): boolean => {
    return notesStore$.expandedNotes[noteId]?.get() ?? false;
  },

  // Set pending note scroll target (for navigation from Library)
  setPendingNoteScroll: (params: { noteId: string; chapterId: number } | null) => {
    notesStore$.pendingNoteScroll.set(params);
  },

  // Clear pending note scroll
  clearPendingNoteScroll: () => {
    notesStore$.pendingNoteScroll.set(null);
  },

  // Set highlighted note (for gradient animation)
  setHighlightedNote: (noteId: string | null) => {
    notesStore$.highlightedNoteId.set(noteId);
  },

  // Set pending focus note (for auto-focusing newly created notes)
  setPendingFocusNote: (noteId: string) => {
    notesStore$.pendingFocusNoteId.set(noteId);
  },

  // Clear pending focus note
  clearPendingFocusNote: () => {
    notesStore$.pendingFocusNoteId.set(null);
  },

  // Soft delete a note (set status to inactive)
  softDeleteNote: (noteId: string) => {
    // Validate noteId parameter
    if (!noteId) {
      console.error('[NotesStore] ❌ Cannot soft delete note: noteId is null/undefined');
      return;
    }

    const allNotes = notesStore$.notes.get();
    const noteToDelete = allNotes.find((n: Note) => n.id === noteId);

    if (!noteToDelete) {
      console.error('[NotesStore] ❌ Note not found for soft delete:', noteId);
      console.error('[NotesStore] Available notes:', allNotes.map((n: Note) => n.id));
      return;
    }

    // Soft delete - set status to inactive

    // Set status to inactive
    const updatedNotes = allNotes.map((n: Note) =>
      n.id === noteId ? { ...n, status: 'inactive' as const } : n
    );
    notesStore$.notes.set(updatedNotes);

    // Save to storage immediately (critical operation)
    notesStore$.saveNotesToStorageImmediate();
  },

  // Restore a soft deleted note (set status back to active)
  restoreNote: (noteId: string) => {
    // Validate noteId parameter
    if (!noteId) {
      console.error('[NotesStore] ❌ Cannot restore note: noteId is null/undefined');
      return;
    }

    const allNotes = notesStore$.notes.get();
    const noteToRestore = allNotes.find((n: Note) => n.id === noteId);

    if (!noteToRestore) {
      console.error('[NotesStore] ❌ Note not found for restore:', noteId);
      console.error('[NotesStore] Available notes:', allNotes.map((n: Note) => n.id));
      return;
    }

    // Restore - set status back to active

    // Set status back to active
    const updatedNotes = allNotes.map((n: Note) =>
      n.id === noteId ? { ...n, status: 'active' as const } : n
    );
    notesStore$.notes.set(updatedNotes);

    // Save to storage immediately (critical operation)
    notesStore$.saveNotesToStorageImmediate();
  },

  // Permanently delete a note (completely remove from array)
  permanentlyDeleteNote: (noteId: string) => {
    // Validate noteId parameter
    if (!noteId) {
      console.error('[NotesStore] ❌ Cannot permanently delete note: noteId is null/undefined');
      return;
    }

    const allNotes = notesStore$.notes.get();
    const noteExists = allNotes.find((n: Note) => n.id === noteId);

    if (!noteExists) {
      console.error('[NotesStore] ❌ Note not found for permanent deletion:', noteId);
      console.error('[NotesStore] Available notes:', allNotes.map((n: Note) => n.id));
      return;
    }

    // Permanent delete - remove from array completely

    // Remove from notes array completely
    const updatedNotes = allNotes.filter((n: Note) => n.id !== noteId);
    notesStore$.notes.set(updatedNotes);

    // Remove from expansion state
    const expandedNotes = notesStore$.expandedNotes.get();
    delete expandedNotes[noteId];
    notesStore$.expandedNotes.set(expandedNotes);

    // Save immediately (critical operation)
    notesStore$.saveNotesToStorageImmediate();
    notesStore$.saveExpandedNotesToStorage();
  },

  // ============================================================================
  // HIGHLIGHT METHODS
  // ============================================================================

  // Add a highlight to a verse (or update color if already exists)
  addHighlight: (verseId: number, color: HighlightColorName) => {
    const allHighlights = notesStore$.highlights.get() as VerseHighlight[];
    const existing = allHighlights.find(
      (h: VerseHighlight) => h.verse_id === verseId && h.status === 'active'
    );

    if (existing) {
      // Update existing highlight color
      const updated = allHighlights.map((h: VerseHighlight) =>
        h.id === existing.id
          ? { ...h, color, updated_at: new Date().toISOString() }
          : h
      );
      notesStore$.highlights.set(updated);
    } else {
      // Create new highlight
      const newHighlight: VerseHighlight = {
        id: `highlight_${verseId}_${Date.now()}`,
        verse_id: verseId,
        color,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      notesStore$.highlights.set([...allHighlights, newHighlight]);
    }

    notesStore$.saveHighlightsToStorage();
  },

  // Add highlights to multiple verses at once
  addHighlightsToRange: (startVerseId: number, endVerseId: number, color: HighlightColorName) => {
    const minId = Math.min(startVerseId, endVerseId);
    const maxId = Math.max(startVerseId, endVerseId);

    // For verse ranges within same chapter, iterate through verse numbers
    // Verse ID format: BBCCCVVV (book * 1000000 + chapter * 1000 + verse)
    const bookChapter = Math.floor(minId / 1000) * 1000;
    const startVerse = minId % 1000;
    const endVerse = maxId % 1000;

    for (let v = startVerse; v <= endVerse; v++) {
      const verseId = bookChapter + v;
      notesStore$.addHighlight(verseId, color);
    }
  },

  // Remove highlight from a verse (soft delete)
  removeHighlight: (verseId: number) => {
    const allHighlights = notesStore$.highlights.get() as VerseHighlight[];
    const updated = allHighlights.map((h: VerseHighlight) =>
      h.verse_id === verseId && h.status === 'active'
        ? { ...h, status: 'inactive' as const, updated_at: new Date().toISOString() }
        : h
    );
    notesStore$.highlights.set(updated);
    notesStore$.saveHighlightsToStorage();
  },

  // Get active highlight for a verse (returns null if none)
  getHighlightForVerse: (verseId: number): VerseHighlight | null => {
    const allHighlights = notesStore$.highlights.get() as VerseHighlight[];
    return allHighlights.find(
      (h: VerseHighlight) => h.verse_id === verseId && h.status === 'active'
    ) || null;
  },

  // Get all active highlights for a chapter
  getHighlightsForChapter: (chapterId: number): VerseHighlight[] => {
    const allHighlights = notesStore$.highlights.get() as VerseHighlight[];
    // Chapter ID format: BBCCC (book * 1000 + chapter)
    // Verse ID format: BBCCCVVV
    const chapterPrefix = chapterId * 1000;
    const chapterEnd = chapterPrefix + 999;

    return allHighlights.filter(
      (h: VerseHighlight) =>
        h.status === 'active' &&
        h.verse_id >= chapterPrefix &&
        h.verse_id <= chapterEnd
    );
  },

  // Save highlights to AsyncStorage
  saveHighlightsToStorage: async () => {
    try {
      const highlights = notesStore$.highlights.get();
      await AsyncStorage.setItem('bible_highlights', JSON.stringify(highlights));
    } catch (error) {
      console.error('[NotesStore] Failed to save highlights to storage:', error);
    }
  },

  // Load highlights from AsyncStorage
  loadHighlightsFromStorage: async () => {
    try {
      const stored = await AsyncStorage.getItem('bible_highlights');
      if (stored) {
        const highlights = JSON.parse(stored);
        notesStore$.highlights.set(highlights);
      }
    } catch (error) {
      console.error('[NotesStore] Failed to load highlights from storage:', error);
    }
  },

  // ============================================================================
  // NOTES STORAGE METHODS
  // ============================================================================

  // Save notes to AsyncStorage (debounced for performance during typing)
  saveNotesToStorage: () => {
    if (pendingNotesSaveTimeout) {
      clearTimeout(pendingNotesSaveTimeout);
    }
    pendingNotesSaveTimeout = setTimeout(async () => {
      pendingNotesSaveTimeout = null;
      try {
        const notes = notesStore$.notes.get();
        await AsyncStorage.setItem('bible_notes', JSON.stringify(notes));
      } catch (error) {
        console.error('[NotesStore] Failed to save notes to storage:', error);
      }
    }, BATCH_SAVE_DELAY);
  },

  // Immediate save for critical operations (soft delete, restore, etc.)
  saveNotesToStorageImmediate: async () => {
    if (pendingNotesSaveTimeout) {
      clearTimeout(pendingNotesSaveTimeout);
      pendingNotesSaveTimeout = null;
    }
    try {
      const notes = notesStore$.notes.get();
      await AsyncStorage.setItem('bible_notes', JSON.stringify(notes));
    } catch (error) {
      console.error('[NotesStore] Failed to save notes to storage:', error);
    }
  },

  // Load notes from AsyncStorage
  loadNotesFromStorage: async () => {
    try {
      const stored = await AsyncStorage.getItem('bible_notes');
      if (stored) {
        const notes = JSON.parse(stored);
        notesStore$.notes.set(notes);
      }
    } catch (error) {
      console.error('[NotesStore] Failed to load notes from storage:', error);
    }
  },

  // Save expanded notes state to AsyncStorage
  saveExpandedNotesToStorage: async () => {
    try {
      const expandedNotes = notesStore$.expandedNotes.get();
      await AsyncStorage.setItem('bible_expanded_notes', JSON.stringify(expandedNotes));
    } catch (error) {
      console.error('[NotesStore] Failed to save expanded notes to storage:', error);
    }
  },

  // Load expanded notes state from AsyncStorage
  loadExpandedNotesFromStorage: async () => {
    try {
      const stored = await AsyncStorage.getItem('bible_expanded_notes');
      if (stored) {
        const expandedNotes = JSON.parse(stored);
        notesStore$.expandedNotes.set(expandedNotes);
      }
    } catch (error) {
      console.error('[NotesStore] Failed to load expanded notes from storage:', error);
    }
  },

  // Save bookmarks to AsyncStorage
  saveBookmarksToStorage: async () => {
    try {
      const bookmarks = notesStore$.bookmarks.get();
      await AsyncStorage.setItem('bible_bookmarks', JSON.stringify(bookmarks));
    } catch (error) {
      console.error('[NotesStore] Failed to save bookmarks to storage:', error);
    }
  },

  // Load bookmarks from AsyncStorage
  loadBookmarksFromStorage: async () => {
    try {
      const stored = await AsyncStorage.getItem('bible_bookmarks');
      if (stored) {
        const bookmarks = JSON.parse(stored);
        notesStore$.bookmarks.set(bookmarks);
        console.log('[NotesStore] Loaded', bookmarks.length, 'bookmarks from storage');
      }
    } catch (error) {
      console.error('[NotesStore] Failed to load bookmarks from storage:', error);
    }
  },
});

// Computed observable for active notes (exported separately to avoid circular reference)
export const activeNotes$ = computed(() =>
  notesStore$.notes.get().filter((n: NoteData) => n.status === 'active')
);

// Computed index for O(1) note lookup by ID
export const notesIndex$ = computed(() => {
  const notes = notesStore$.notes.get() as NoteData[];
  const index = new Map<string, number>();
  notes.forEach((note, idx) => index.set(note.id, idx));
  return index;
});

// Helper to get note index by ID (O(1) lookup)
export function getNoteIndex(noteId: string): number {
  return notesIndex$.get().get(noteId) ?? -1;
}

// Computed observable for active highlights
export const activeHighlights$ = computed(() =>
  notesStore$.highlights.get().filter((h: VerseHighlight) => h.status === 'active')
);

// Computed observable for active bookmarks
export const activeBookmarks$ = computed(() =>
  notesStore$.bookmarks.get().filter((b: BookmarkData) => b.status === 'active')
);
