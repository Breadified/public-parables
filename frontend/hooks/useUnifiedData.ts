/**
 * Unified Data Hook
 *
 * Provides access to Bible data and user data.
 * NOTE: Sync initialization is handled by useSyncInitialization hook in _layout.tsx
 */

import { useSelector } from "@legendapp/state/react";
import { useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import { bibleStore$, authStore$ } from "../state/bibleStore";
import { notesStore$ } from "../state/notesStore";
import type { NoteData } from "../state/bibleStore";

export const useUnifiedData = () => {
  // IMPORTANT: Don't subscribe to entire store - it causes excessive re-renders
  // Only subscribe to specific fields needed
  const books = useSelector(bibleStore$.books);
  const chapters = useSelector(bibleStore$.chapters);
  const sections = useSelector(bibleStore$.sections);
  const paragraphs = useSelector(bibleStore$.paragraphs);
  const verseLines = useSelector(bibleStore$.verse_lines);
  const bookmarks = useSelector(bibleStore$.bookmarks);
  const notes = useSelector(bibleStore$.notes);
  const tabs = useSelector(bibleStore$.tabs);
  const activeTabIndex = useSelector(bibleStore$.active_tab_index);
  const currentVerseLineId = useSelector(bibleStore$.current_verse_line_id);
  const isLoading = useSelector(bibleStore$.is_loading);
  const dataLoadingStatus = useSelector(bibleStore$.data_loading_status);

  // Get auth state for operations that need it
  const shouldSync = useSelector(authStore$.shouldSync);

  /**
   * Create a new bookmark
   * Requires authentication to prevent orphaned data
   */
  const createBookmark = useCallback(
    async (bookmarkData: any) => {
      // Require authentication
      const userId = authStore$.user.peek()?.id;
      if (!userId) {
        throw new Error("Must be logged in to create bookmarks");
      }

      // Optimistic update - works offline and online
      const newBookmark = {
        id: `bookmark_${Date.now()}`,
        user_id: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...bookmarkData,
      };

      bibleStore$.bookmarks.push(newBookmark);
      await notesStore$.saveBookmarksToStorage();

      // Sync to Supabase if authenticated
      if (shouldSync) {
        // TODO: Implement bookmark sync service
        console.log("Bookmark sync not yet implemented");
      }

      return newBookmark;
    },
    [shouldSync]
  );

  /**
   * Create a new note
   * Automatically syncs to Supabase via Legend State onChange listener!
   */
  const createNote = useCallback(
    async (noteData: Partial<NoteData>) => {
      // Require authentication
      const userId = authStore$.user.peek()?.id;
      if (!userId) {
        throw new Error("Must be logged in to create notes");
      }

      // Create note with proper UUID
      const verseId = noteData.verse_id || null;
      const newNote: NoteData = {
        id: uuidv4(),
        user_id: userId,
        book_id: noteData.book_id || null,
        chapter_id: noteData.chapter_id || null,
        verse_id: verseId,
        verse_line_id: noteData.verse_line_id || null,
        verse_start_id: noteData.verse_start_id ?? verseId, // Use provided or default to single verse
        verse_end_id: noteData.verse_end_id ?? verseId,
        content: noteData.content || "",
        tags: noteData.tags || [],
        is_private: noteData.is_private ?? true,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        edit_history: [],
        formatting_type: noteData.formatting_type || "prose",
      };

      // Add to Legend State - this automatically triggers sync!
      bibleStore$.notes.push(newNote);
      await bibleStore$.saveNotesToStorage();

      return newNote;
    },
    []
  );

  /**
   * Update an existing note
   * Automatically syncs to Supabase via Legend State onChange listener!
   */
  const updateNote = useCallback(
    async (noteId: string, updates: Partial<NoteData>) => {
      const noteIndex = bibleStore$.notes.peek().findIndex((n: NoteData) => n.id === noteId);
      if (noteIndex === -1) {
        throw new Error(`Note ${noteId} not found`);
      }

      // Update note with new timestamp
      const updatedNote = {
        ...bibleStore$.notes[noteIndex].peek(),
        ...updates,
        updated_at: new Date().toISOString(),
      };

      // Update in Legend State - this automatically triggers sync!
      bibleStore$.notes[noteIndex].set(updatedNote);
      await bibleStore$.saveNotesToStorage();

      return updatedNote;
    },
    []
  );

  /**
   * Delete a bookmark
   */
  const deleteBookmark = useCallback(
    async (bookmarkId: string) => {
      const index = bookmarks.findIndex((b: any) => b.id === bookmarkId);
      if (index !== -1) {
        bibleStore$.bookmarks.splice(index, 1);
        await notesStore$.saveBookmarksToStorage();

        // Sync to Supabase if authenticated
        if (shouldSync) {
          // TODO: Implement bookmark sync service
          console.log("Bookmark sync not yet implemented");
        }
      }
    },
    [bookmarks, shouldSync]
  );

  /**
   * Delete a note
   * Automatically syncs to Supabase via Legend State onChange listener!
   */
  const deleteNote = useCallback(
    async (noteId: string) => {
      const index = notes.findIndex((n: any) => n.id === noteId);
      if (index !== -1) {
        // Remove from Legend State - this automatically triggers sync!
        bibleStore$.notes.splice(index, 1);
        await bibleStore$.saveNotesToStorage();
      }
    },
    [notes]
  );

  return {
    // Data access
    books,
    chapters,
    sections,
    paragraphs,
    verseLines, // Map to camelCase for frontend compatibility
    bookmarks,
    notes,
    tabs,
    activeTabIndex, // Map to camelCase
    currentVerseLineId, // Map to camelCase

    // Operations
    createBookmark,
    createNote,
    updateNote,
    deleteBookmark,
    deleteNote,

    // Loading state
    isLoading, // Map to camelCase
    dataLoadingStatus, // Map to camelCase
  };
};