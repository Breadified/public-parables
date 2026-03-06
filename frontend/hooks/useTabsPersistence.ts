/**
 * Tabs Persistence Hook
 * Clears persisted verse selections on app start
 *
 * NOTE: Tabs are loaded in _layout.tsx during initial data loading.
 * This hook only handles cleanup that should happen after tabs are loaded.
 */

import { useEffect } from 'react';
import { bibleStore$ } from '../state/bibleStore';

export const useTabsPersistence = () => {
  useEffect(() => {
    // Clear any verse selections that may have persisted from old sessions
    // Tabs are already loaded in _layout.tsx, so we just need to clean up
    bibleStore$.clearAllVerseSelections();
  }, []);
};