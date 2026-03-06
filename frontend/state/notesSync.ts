/**
 * Notes Sync - Using Generic Entity Sync
 *
 * Configured to automatically sync notes to Supabase using the reusable
 * createEntitySync factory. Just 3 lines of config!
 *
 * Note: Syncs ALL notes (both active and inactive status) for cross-device
 * soft delete support. Components filter to activeNotes for display.
 */

import { createEntitySync } from '../services/sync/createEntitySync';
import { bibleStore$, authStore$ } from './bibleStore';
import type { Note } from '../types/database';

// Create notes sync using generic factory
// Syncs all notes (active + inactive) for multi-device soft delete support
export const notesSync = createEntitySync<Note>({
  tableName: 'notes',
  storeObservable: bibleStore$.notes, // Includes both active and inactive notes
  getUserId: () => authStore$.user.peek()?.id || null,
  mergeStrategy: 'server-wins',
  saveToStorage: () => bibleStore$.saveNotesToStorage(),
  debounceMs: 1000, // Wait 1 second after typing before syncing
});

// Export initialize function for use in useUnifiedData
export const initializeNotesSync = notesSync.initialize;
