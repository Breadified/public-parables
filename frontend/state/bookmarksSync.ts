/**
 * Bookmarks Sync - Using Generic Entity Sync
 *
 * Configured to automatically sync bookmarks to Supabase using the reusable
 * createEntitySync factory. Just 3 lines of config!
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createEntitySync } from '../services/sync/createEntitySync';
import { bibleStore$, authStore$ } from './bibleStore';
import type { Bookmark } from '../types/database';

// Create bookmarks sync using generic factory
export const bookmarksSync = createEntitySync<Bookmark>({
  tableName: 'bookmarks',
  storeObservable: bibleStore$.bookmarks,
  getUserId: () => authStore$.user.peek()?.id || null,
  mergeStrategy: 'server-wins',
  saveToStorage: async () => {
    const bookmarks = bibleStore$.bookmarks.peek();
    await AsyncStorage.setItem('bible_bookmarks', JSON.stringify(bookmarks));
  },
  debounceMs: 500, // Quick sync for bookmarks
});

// Export initialize function for use in useUnifiedData
export const initializeBookmarksSync = bookmarksSync.initialize;
