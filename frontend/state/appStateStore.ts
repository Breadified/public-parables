/**
 * App State Store - Application loading and sync state
 * Handles: loading indicators, sync status, data loading, app settings
 */

import { observable } from "@legendapp/state";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const appStateStore$ = observable({
  // App state
  is_loading: true,
  is_background_loading: false, // Track background loading state
  prevent_navigation_updates: false,
  last_sync_timestamp: null as string | null,

  // Data loading status - tracks actual startup tasks (blocking)
  // NOTE: embeddings load in BACKGROUND, not blocking startup
  data_loading_status: {
    auth: false,
    tabs: false,
    notes: false,
    versions: false,
    settings: false,
  },

  // Embeddings ready state (loads in background, non-blocking)
  embeddings_ready: false,

  // Embeddings loading progress (0-100)
  embeddings_progress: {
    percent: 0,
    message: '',
  },

  // Windowed loading state
  loading_window_start: 0,
  loading_window_end: 49,
  total_chapters_available: 1189,
  is_expanding_window: false,

  // Bible Peek settings (global configuration)
  biblePeekSettings: {
    visibleLines: 12, // Number of lines visible in Bible Peek scrollview
    contextChapters: 2, // Number of chapters to show before and after reference
  },

  // Methods for Bible Peek settings persistence
  saveBiblePeekSettings: async () => {
    try {
      const settings = appStateStore$.biblePeekSettings.get();
      await AsyncStorage.setItem(
        "bible_peek_settings",
        JSON.stringify(settings)
      );
    } catch (error) {
      console.error("Failed to save Bible Peek settings:", error);
    }
  },

  loadBiblePeekSettings: async () => {
    try {
      const stored = await AsyncStorage.getItem("bible_peek_settings");
      if (stored) {
        const settings = JSON.parse(stored);
        appStateStore$.biblePeekSettings.set({
          visibleLines: settings.visibleLines ?? 8,
          contextChapters: settings.contextChapters ?? 2,
        });
      }
    } catch (error) {
      console.error("Failed to load Bible Peek settings:", error);
    }
  },

  updateBiblePeekSettings: async (settings: {
    visibleLines?: number;
    contextChapters?: number;
  }) => {
    const current = appStateStore$.biblePeekSettings.get();
    appStateStore$.biblePeekSettings.set({
      ...current,
      ...settings,
    });
    await appStateStore$.saveBiblePeekSettings();
  },
});
