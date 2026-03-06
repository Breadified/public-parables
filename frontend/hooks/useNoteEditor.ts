/**
 * useNoteEditor - Single source of truth for note editing
 * Handles: loading, debouncing, saving, deduplication
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSelector, useObserve } from '@legendapp/state/react';
import { v4 as uuidv4 } from 'uuid';
import { bibleStore$, authStore$ } from '../state/bibleStore';
import { awardDailyNoteReward } from '../services/gamificationService';
import type { Note } from '../types/database';

interface UseNoteEditorOptions {
  chapterId: number;
  bookId: number;
  verseId?: number | null;
  debounceMs?: number;
  noteId?: string | null; // Specific note to edit (if null, creates new note)
}

interface UseNoteEditorResult {
  // Current note
  note: Note | null;

  // Local editable state
  content: string;
  setContent: (content: string) => void;

  // Actions
  handleRelocate: (bookId: number, chapterId: number, verseId?: number | null) => Promise<void>;

  // Save state
  isSaving: boolean;
  lastSaved: Date | null;
}

export function useNoteEditor({
  chapterId,
  bookId,
  verseId = null,
  debounceMs = 1000,
  noteId = null,
}: UseNoteEditorOptions): UseNoteEditorResult {
  // Find the specific note by ID using a targeted selector
  // This only re-renders when THIS specific note changes, not when any note changes
  const foundNote = useSelector(() => {
    if (!noteId) return null;
    return bibleStore$.notes.get().find((n: Note) => n.id === noteId) || null;
  });

  // Ref for the note (for cleanup and async operations)
  const note = useRef<Note | null>(null);

  // Track if we've initialized from the found note
  const hasInitializedRef = useRef(false);

  // Initialize local state from found note (only once per noteId change)
  useEffect(() => {
    // Update ref with current note
    note.current = foundNote;

    // Only initialize content if:
    // 1. We have a note and haven't initialized yet, OR
    // 2. noteId changed (new note selected)
    if (foundNote && !hasInitializedRef.current) {
      setContent(foundNote.content);
      lastSavedContentRef.current = foundNote.content;
      currentContentRef.current = foundNote.content;
      hasInitializedRef.current = true;
    } else if (!foundNote && !note.current) {
      // Empty state for new note
      setContent('');
      lastSavedContentRef.current = '';
      currentContentRef.current = '';
    }
  }, [foundNote]); // Only depend on the specific note, not the whole array

  // Reset initialization flag when noteId changes
  useEffect(() => {
    hasInitializedRef.current = false;
  }, [noteId, chapterId]);

  // Local editable state
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Refs for debouncing
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timeoutIdRef = useRef<number>(0);
  const lastSavedContentRef = useRef('');
  const isTypingRef = useRef(false);

  // Refs for current values (always up-to-date)
  const currentContentRef = useRef('');

  // Ref to track if a save is in progress
  const saveInProgressRef = useRef<Promise<void> | null>(null);

  // Save or create note
  const saveNote = useCallback(async (newContent: string) => {
    const allNotes = bibleStore$.notes.get();

    if (note.current) {
      // Update existing note
      const noteIndex = allNotes.findIndex((n: Note) => n.id === note.current!.id);

      if (noteIndex !== -1) {
        // Check if this is the first time adding content (for XP reward)
        const previousContent = note.current.content;
        const isFirstContent = !previousContent?.trim() && newContent.trim();

        const updatedNote: Note = {
          ...note.current,
          content: newContent,
          updated_at: new Date().toISOString(),
        };

        bibleStore$.notes[noteIndex].set(updatedNote);
        note.current = updatedNote;

        // 🎮 Award XP when note first gets content (created empty, now has text)
        if (isFirstContent) {
          const userId = authStore$.user.peek()?.id;
          if (userId) {
            // Use offline-aware function to update local tracking + sync to server
            // Progress bar updates reactively via completedActivitiesCount$
            awardDailyNoteReward(userId, updatedNote.id);
          }
        }
      }
    } else {
      // Create new note with proper UUID (required for Supabase)
      const newNote: Note = {
        id: uuidv4(),
        user_id: authStore$.user.peek()?.id || "",
        book_id: bookId,
        chapter_id: chapterId,
        verse_id: verseId,
        verse_line_id: null,
        verse_start_id: verseId, // For single verse, start = end
        verse_end_id: verseId,
        content: newContent,
        tags: [],
        is_private: true,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        edit_history: [],
        formatting_type: 'prose',
      };

      console.log(`[useNoteEditor] 💾 Creating new note: id=${newNote.id}, chapter_id=${newNote.chapter_id}`);

      // Add to store
      bibleStore$.notes.push(newNote);

      console.log(`[useNoteEditor] 💾 Note pushed to store. Total notes in store: ${bibleStore$.notes.get().length}`);

      // Update ref
      note.current = newNote;

      // Expand the newly created note (user is actively editing it)
      bibleStore$.setNoteExpanded(newNote.id, true);

      // 🎮 Award XP for creating a new note (with diminishing returns)
      // Use offline-aware function to update local tracking + sync to server
      const userId = authStore$.user.peek()?.id;
      if (userId) {
        // Progress bar updates reactively via completedActivitiesCount$
        awardDailyNoteReward(userId, newNote.id);
      }

      console.log(`[useNoteEditor] 💾 Note save complete`);
    }

    // Persist to AsyncStorage
    await bibleStore$.saveNotesToStorage();
  }, [chapterId, bookId, verseId]);

  // Debounced save
  const debouncedSave = useCallback((newContent: string) => {
    // Mark as typing
    isTypingRef.current = true;

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Increment timeout ID
    const currentTimeoutId = ++timeoutIdRef.current;

    // Set new timeout
    saveTimeoutRef.current = setTimeout(async () => {
      // Check if this timeout is still valid
      if (timeoutIdRef.current !== currentTimeoutId) {
        return;
      }

      // Clear timeout ref
      saveTimeoutRef.current = null;

      // Check if content actually changed
      const contentChanged = newContent !== lastSavedContentRef.current;

      if (!contentChanged) {
        // Only stop typing if this timeout is still current
        if (timeoutIdRef.current === currentTimeoutId) {
          isTypingRef.current = false;
        }
        return;
      }

      // Only save if there's actual content
      if (!newContent.trim()) {
        if (timeoutIdRef.current === currentTimeoutId) {
          isTypingRef.current = false;
        }
        return;
      }

      // Perform save and track the promise
      setIsSaving(true);
      const savePromise = (async () => {
        try {
          await saveNote(newContent);

          // Update refs
          lastSavedContentRef.current = newContent;
          setLastSaved(new Date());
        } catch (error) {
          console.error('[useNoteEditor] Save failed:', error);
        } finally {
          setIsSaving(false);
          saveInProgressRef.current = null; // Clear the in-progress flag

          // Only stop typing if this timeout is still current
          if (timeoutIdRef.current === currentTimeoutId) {
            isTypingRef.current = false;
          }
        }
      })();

      saveInProgressRef.current = savePromise;
    }, debounceMs);
  }, [saveNote, debounceMs]);

  // Handle content change
  const handleContentChange = useCallback((newContent: string) => {
    currentContentRef.current = newContent; // Update ref immediately
    setContent(newContent);
    debouncedSave(newContent);
  }, [debouncedSave]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Invalidate pending timeouts
      timeoutIdRef.current++;

      // Clear timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }

      // Async cleanup logic (runs even after unmount)
      (async () => {
        try {
          // Wait for any in-progress save to complete
          if (saveInProgressRef.current) {
            await saveInProgressRef.current;
          }

          // Check for unsaved changes using the current refs
          const finalContent = currentContentRef.current;
          const hasUnsavedChanges =
            finalContent !== lastSavedContentRef.current;

          if (hasUnsavedChanges && finalContent.trim()) {
            await saveNote(finalContent);
          }

          // Delete note if content is empty
          // BUT skip if the note was already soft-deleted (status: 'inactive')
          // to avoid race conditions with the soft delete flow
          if (note.current && !finalContent.trim()) {
            const allNotes = bibleStore$.notes.get();
            const currentNote = allNotes.find((n: Note) => n.id === note.current!.id);

            // Only delete if note exists AND is still active (not already soft-deleted)
            if (currentNote && currentNote.status === 'active') {
              console.log(`[useNoteEditor] 🗑️ Deleting empty note: ${note.current.id}`);
              // Remove from array by creating new array without this note
              const updatedNotes = allNotes.filter((n: Note) => n.id !== note.current!.id);
              bibleStore$.notes.set(updatedNotes);
              await bibleStore$.saveNotesToStorage();
              console.log(`[useNoteEditor] 🗑️ Empty note deleted from store`);
            } else if (currentNote && currentNote.status === 'inactive') {
              console.log(`[useNoteEditor] ⏭️ Skipping delete - note already soft-deleted: ${note.current.id}`);
            }
          }
        } catch (err) {
          console.error('[useNoteEditor] Cleanup save failed:', err);
        }
      })();
    };
  }, [saveNote]);

  // Handle relocate/move note to different reference
  const handleRelocate = useCallback(async (newBookId: number, newChapterId: number, newVerseId?: number | null) => {
    if (!note.current) return;

    console.log(`[useNoteEditor] 📍 Relocating note ${note.current.id} to book=${newBookId}, chapter=${newChapterId}, verse=${newVerseId || 'none'}`);

    const allNotes = bibleStore$.notes.get();
    const noteIndex = allNotes.findIndex((n: Note) => n.id === note.current!.id);

    if (noteIndex !== -1) {
      const updatedNote: Note = {
        ...note.current,
        book_id: newBookId,
        chapter_id: newChapterId,
        verse_id: newVerseId || null,
        updated_at: new Date().toISOString(),
      };

      bibleStore$.notes[noteIndex].set(updatedNote);
      note.current = updatedNote;
      await bibleStore$.saveNotesToStorage();

      console.log(`[useNoteEditor] 📍 Note relocated successfully`);
    }
  }, []);

  return {
    note: note.current,
    content,
    setContent: handleContentChange,
    handleRelocate,
    isSaving,
    lastSaved,
  };
}
