/**
 * Tutorial Store
 * Tracks user's progress through various app tutorials and first-time experiences
 * Centralized feature discovery tracking
 */

import { observable } from "@legendapp/state";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TUTORIAL_VERSION, TUTORIAL_VERSION_KEY } from '@/config/tutorialVersion';

// Tutorial State Interface
export interface TutorialState {
  // Version tracking
  version: number;

  // Feature-specific first-time flags
  hasUsedStudyMode: boolean;
  hasUsedSearch: boolean;
  hasUsedBookmarks: boolean;
  hasUsedNotes: boolean;
  hasUsedHighlights: boolean;

  // Tutorial completion flags
  completedSearchTutorial: boolean;
  completedSearchModeTutorial: boolean;  // Dual-mode search (book + semantic)
  completedSwipeTutorial: boolean;
  completedCommentsTutorial: boolean;
  completedAnonymousTutorial: boolean;   // Anonymous comment feature
  completedHumansOnlyTutorial: boolean;  // "Humans Only" comment feature
  completedNotesTutorial: boolean;

  // Onboarding
  completedAppOnboarding: boolean;

  // User Preferences (comment defaults)
  defaultHumansOnly: boolean;  // Default state for "Humans Only" toggle
}

// Tutorial Store
export const tutorialStore$: any = observable({
  // Core state
  version: TUTORIAL_VERSION.current,

  hasUsedStudyMode: false,
  hasUsedSearch: false,
  hasUsedBookmarks: false,
  hasUsedNotes: false,
  hasUsedHighlights: false,

  completedSearchTutorial: false,
  completedSearchModeTutorial: false,
  completedSwipeTutorial: false,
  completedCommentsTutorial: false,
  completedAnonymousTutorial: false,
  completedHumansOnlyTutorial: false,
  completedNotesTutorial: false,

  completedAppOnboarding: false,

  // User Preferences
  defaultHumansOnly: false,

  // Methods for marking features as used
  markStudyModeUsed: () => {
    tutorialStore$.hasUsedStudyMode.set(true);
    tutorialStore$.saveState();
  },

  markSearchUsed: () => {
    tutorialStore$.hasUsedSearch.set(true);
    tutorialStore$.saveState();
  },

  markBookmarksUsed: () => {
    tutorialStore$.hasUsedBookmarks.set(true);
    tutorialStore$.saveState();
  },

  markNotesUsed: () => {
    tutorialStore$.hasUsedNotes.set(true);
    tutorialStore$.saveState();
  },

  markHighlightsUsed: () => {
    tutorialStore$.hasUsedHighlights.set(true);
    tutorialStore$.saveState();
  },

  // Methods for marking tutorials as complete
  completeSearchTutorial: () => {
    tutorialStore$.completedSearchTutorial.set(true);
    tutorialStore$.saveState();
  },

  completeSearchModeTutorial: () => {
    tutorialStore$.completedSearchModeTutorial.set(true);
    tutorialStore$.saveState();
  },

  completeSwipeTutorial: () => {
    tutorialStore$.completedSwipeTutorial.set(true);
    tutorialStore$.saveState();
  },

  completeCommentsTutorial: () => {
    tutorialStore$.completedCommentsTutorial.set(true);
    tutorialStore$.saveState();
  },

  completeAnonymousTutorial: () => {
    tutorialStore$.completedAnonymousTutorial.set(true);
    tutorialStore$.saveState();
  },

  completeHumansOnlyTutorial: () => {
    tutorialStore$.completedHumansOnlyTutorial.set(true);
    tutorialStore$.saveState();
  },

  completeNotesTutorial: () => {
    tutorialStore$.completedNotesTutorial.set(true);
    tutorialStore$.saveState();
  },

  completeAppOnboarding: () => {
    tutorialStore$.completedAppOnboarding.set(true);
    tutorialStore$.saveState();
  },

  // Check if user should see a feature's first-time experience
  shouldShowSearchTutorial: (): boolean => {
    return !tutorialStore$.hasUsedSearch.get() && !tutorialStore$.completedSearchTutorial.get();
  },

  shouldShowSearchModeTutorial: (): boolean => {
    return !tutorialStore$.completedSearchModeTutorial.get();
  },

  shouldShowSwipeTutorial: (): boolean => {
    return !tutorialStore$.completedSwipeTutorial.get();
  },

  shouldShowCommentsTutorial: (): boolean => {
    return !tutorialStore$.completedCommentsTutorial.get();
  },

  shouldShowAnonymousTutorial: (): boolean => {
    return !tutorialStore$.completedAnonymousTutorial.get();
  },

  shouldShowHumansOnlyTutorial: (): boolean => {
    return !tutorialStore$.completedHumansOnlyTutorial.get();
  },

  shouldShowNotesTutorial: (): boolean => {
    return !tutorialStore$.completedNotesTutorial.get();
  },

  shouldShowAppOnboarding: (): boolean => {
    return !tutorialStore$.completedAppOnboarding.get();
  },

  // User Preference methods
  setDefaultHumansOnly: (value: boolean) => {
    tutorialStore$.defaultHumansOnly.set(value);
    tutorialStore$.saveState();
  },

  getDefaultHumansOnly: (): boolean => {
    return tutorialStore$.defaultHumansOnly.get();
  },

  // Persistence methods
  saveState: async () => {
    try {
      const state = {
        version: tutorialStore$.version.get(),
        hasUsedStudyMode: tutorialStore$.hasUsedStudyMode.get(),
        hasUsedSearch: tutorialStore$.hasUsedSearch.get(),
        hasUsedBookmarks: tutorialStore$.hasUsedBookmarks.get(),
        hasUsedNotes: tutorialStore$.hasUsedNotes.get(),
        hasUsedHighlights: tutorialStore$.hasUsedHighlights.get(),
        completedSearchTutorial: tutorialStore$.completedSearchTutorial.get(),
        completedSearchModeTutorial: tutorialStore$.completedSearchModeTutorial.get(),
        completedSwipeTutorial: tutorialStore$.completedSwipeTutorial.get(),
        completedCommentsTutorial: tutorialStore$.completedCommentsTutorial.get(),
        completedAnonymousTutorial: tutorialStore$.completedAnonymousTutorial.get(),
        completedHumansOnlyTutorial: tutorialStore$.completedHumansOnlyTutorial.get(),
        completedNotesTutorial: tutorialStore$.completedNotesTutorial.get(),
        completedAppOnboarding: tutorialStore$.completedAppOnboarding.get(),
        defaultHumansOnly: tutorialStore$.defaultHumansOnly.get(),
      };

      await AsyncStorage.setItem('tutorial_state', JSON.stringify(state));
      await AsyncStorage.setItem(TUTORIAL_VERSION_KEY, TUTORIAL_VERSION.current.toString());
      console.log('[TutorialStore] State saved');
    } catch (error) {
      console.error('[TutorialStore] Failed to save state:', error);
    }
  },

  loadState: async () => {
    try {
      // Check stored tutorial version
      const storedVersionStr = await AsyncStorage.getItem(TUTORIAL_VERSION_KEY);
      const storedVersion = storedVersionStr ? parseInt(storedVersionStr, 10) : 0;

      console.log(`[TutorialStore] Stored version: ${storedVersion}, Current version: ${TUTORIAL_VERSION.current}`);

      // If version has changed, reset tutorials AND clear Bible tabs
      if (storedVersion < TUTORIAL_VERSION.current) {
        console.log('[TutorialStore] Tutorial version updated - resetting all tutorials and clearing Bible tabs');
        await tutorialStore$.resetAll();
        tutorialStore$.version.set(TUTORIAL_VERSION.current);

        // Clear Bible tabs by resetting to single default tab
        await tutorialStore$.clearBibleTabs();

        await tutorialStore$.saveState();
        return;
      }

      // Load existing state if version matches
      const stored = await AsyncStorage.getItem('tutorial_state');
      if (stored) {
        const state = JSON.parse(stored);

        // Restore tutorial state
        tutorialStore$.version.set(state.version ?? TUTORIAL_VERSION.current);
        tutorialStore$.hasUsedStudyMode.set(state.hasUsedStudyMode ?? false);
        tutorialStore$.hasUsedSearch.set(state.hasUsedSearch ?? false);
        tutorialStore$.hasUsedBookmarks.set(state.hasUsedBookmarks ?? false);
        tutorialStore$.hasUsedNotes.set(state.hasUsedNotes ?? false);
        tutorialStore$.hasUsedHighlights.set(state.hasUsedHighlights ?? false);
        tutorialStore$.completedSearchTutorial.set(state.completedSearchTutorial ?? false);
        tutorialStore$.completedSearchModeTutorial.set(state.completedSearchModeTutorial ?? false);
        tutorialStore$.completedSwipeTutorial.set(state.completedSwipeTutorial ?? false);
        tutorialStore$.completedCommentsTutorial.set(state.completedCommentsTutorial ?? false);
        tutorialStore$.completedAnonymousTutorial.set(state.completedAnonymousTutorial ?? false);
        tutorialStore$.completedHumansOnlyTutorial.set(state.completedHumansOnlyTutorial ?? false);
        tutorialStore$.completedNotesTutorial.set(state.completedNotesTutorial ?? false);
        tutorialStore$.completedAppOnboarding.set(state.completedAppOnboarding ?? false);
        tutorialStore$.defaultHumansOnly.set(state.defaultHumansOnly ?? false);

        console.log('[TutorialStore] State loaded');
      }
    } catch (error) {
      console.error('[TutorialStore] Failed to load state:', error);
    }
  },

  // Initialize the store (called on app start)
  initialize: async () => {
    await tutorialStore$.loadState();
  },

  // Reset all tutorials (useful for testing or version updates)
  resetAll: async () => {
    tutorialStore$.version.set(TUTORIAL_VERSION.current);
    tutorialStore$.hasUsedStudyMode.set(false);
    tutorialStore$.hasUsedSearch.set(false);
    tutorialStore$.hasUsedBookmarks.set(false);
    tutorialStore$.hasUsedNotes.set(false);
    tutorialStore$.hasUsedHighlights.set(false);
    tutorialStore$.completedSearchTutorial.set(false);
    tutorialStore$.completedSearchModeTutorial.set(false);
    tutorialStore$.completedSwipeTutorial.set(false);
    tutorialStore$.completedCommentsTutorial.set(false);
    tutorialStore$.completedAnonymousTutorial.set(false);
    tutorialStore$.completedHumansOnlyTutorial.set(false);
    tutorialStore$.completedNotesTutorial.set(false);
    tutorialStore$.completedAppOnboarding.set(false);
    await tutorialStore$.saveState();
    console.log('[TutorialStore] All tutorials reset');
  },

  // Clear all Bible tabs (reset to single default tab)
  clearBibleTabs: async () => {
    try {
      // Reset Bible tabs to single default tab
      const defaultTab = {
        id: 'tab-1',
        tab_id: 'tab-1',
        current_chapter_id: 1001000,  // Genesis 1
        scroll_position: 0,
        title: 'Genesis 1',
        tab_order: 0,
        is_active: true,
        current_book_name: 'Genesis',
        current_chapter_number: 1
      };

      // Import bibleStore$ dynamically to avoid circular dependency
      const { bibleStore$ } = await import('@/state/bibleStore');

      // Reset tabs to single default tab
      bibleStore$.tabs.set([defaultTab]);
      bibleStore$.active_tab_index.set(0);

      // Save the cleared state
      await bibleStore$.saveTabsToStorage();

      console.log('[TutorialStore] Bible tabs cleared - reset to Genesis 1');
    } catch (error) {
      console.error('[TutorialStore] Failed to clear Bible tabs:', error);
    }
  },

  // Get current tutorial version
  getCurrentVersion: (): number => {
    return TUTORIAL_VERSION.current;
  },

  // Get stored tutorial version
  getStoredVersion: (): number => {
    return tutorialStore$.version.get();
  }
});
