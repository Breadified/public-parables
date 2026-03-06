/**
 * Lightweight sync initialization hook
 *
 * PERF FIX: This hook ONLY subscribes to auth state, not to tabs/notes/etc.
 * Use this in layout components that need sync but shouldn't re-render on data changes.
 *
 * For components that need to READ data, use useUnifiedData instead.
 */

import { useSelector } from "@legendapp/state/react";
import { useEffect } from "react";
import { authStore$ } from "../state/bibleStore";
import { initializeNotesSync } from "../state/notesSync";
import { initializeBookmarksSync } from "../state/bookmarksSync";
import { initializePlanSessionsSync, initializeSharedSessionsSync } from "../state/planSync";

/**
 * Initialize data sync without subscribing to data state
 *
 * This is a PERF-optimized version of useUnifiedData for layout components.
 * It only re-renders when auth state changes, not when tabs/notes change.
 */
export function useSyncInitialization(): void {
  // Only subscribe to auth state - NOT to tabs, notes, etc.
  const shouldSync = useSelector(authStore$.shouldSync);
  const isAuthenticated = useSelector(() => authStore$.auth.get() === "authenticated");

  // Initialize reactive sync when authenticated
  useEffect(() => {
    if (isAuthenticated && shouldSync) {
      console.log('[useSyncInitialization] 🚀 Setting up reactive sync...');

      const cleanupFunctions = [
        initializeNotesSync(),
        initializeBookmarksSync(),
        initializePlanSessionsSync(),
        initializeSharedSessionsSync(),
      ];

      return () => {
        console.log('[useSyncInitialization] 🧹 Cleaning up syncs...');
        cleanupFunctions.forEach(cleanup => cleanup());
      };
    }
  }, [isAuthenticated, shouldSync]);
}
