/**
 * Tab Store - Tab management for Bible reading
 * Handles: tab creation, switching, persistence
 */

import { observable, computed } from "@legendapp/state";
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { TabState } from "../types/stores";

export const tabStore$ = observable({
  // Tab state - Initialize with one default tab
  tabs: [{
    id: 'tab-1',
    tab_id: 'tab-1',
    current_chapter_id: 1001000,  // Genesis 1
    scroll_position: 0,
    title: 'Genesis 1',
    tab_order: 0,
    is_active: true,
    current_book_name: 'Genesis',
    current_chapter_number: 1,
    selected_verse_id: null,
    selected_chapter_id: null
  }] as TabState[],

  active_tab_index: 0,

  // Tab navigation history for back gesture support
  // Stores indices of previously visited tabs (most recent at end)
  tabHistory: [] as number[],

  // Computed: Active tab's selected verse
  activeTabSelectedVerse: computed((): number | null => {
    const tabs = tabStore$.tabs.get();
    const activeIndex = tabStore$.active_tab_index.get();
    return tabs[activeIndex]?.selected_verse_id || null;
  }),

  // Computed: Active tab's selected chapter (for navigation without verse highlighting)
  activeTabSelectedChapter: computed((): number | null => {
    const tabs = tabStore$.tabs.get();
    const activeIndex = tabStore$.active_tab_index.get();
    return tabs[activeIndex]?.selected_chapter_id || null;
  }),

  // Methods for tab management
  addTab: (chapterId?: number, bookName?: string, chapterNumber?: number, selectedVerseId?: number | null, selectedChapterId?: number | null) => {
    const tabs = tabStore$.tabs.get();
    const activeTabIndex = tabStore$.active_tab_index.get();
    const activeTab = tabs[activeTabIndex];

    // Push current tab to history before creating new tab (for back navigation)
    const history = tabStore$.tabHistory.get();
    if (history.length === 0 || history[history.length - 1] !== activeTabIndex) {
      const newHistory = [...history, activeTabIndex].slice(-50);
      tabStore$.tabHistory.set(newHistory);
    }

    // Use provided values or copy from active tab
    const targetChapterId = chapterId || activeTab?.current_chapter_id || 1001000;
    const targetBookName = bookName || activeTab?.current_book_name || 'Genesis';
    const targetChapterNumber = chapterNumber || activeTab?.current_chapter_number || 1;

    // Create new tab with specified or current position
    const newTab: TabState = {
      id: `tab-${Date.now()}`,
      tab_id: `tab-${Date.now()}`,
      current_chapter_id: targetChapterId,
      scroll_position: 0,
      title: `${targetBookName} ${targetChapterNumber}`,
      tab_order: activeTabIndex + 1, // Insert right after current tab
      is_active: true,
      current_book_name: targetBookName,
      current_chapter_number: targetChapterNumber,
      selected_verse_id: selectedVerseId !== undefined ? selectedVerseId : null,
      selected_chapter_id: selectedChapterId !== undefined ? selectedChapterId : null
    };

    // Insert new tab to the right of current tab
    const newTabs = [...tabs];
    newTabs.splice(activeTabIndex + 1, 0, newTab);

    // Update tab orders
    newTabs.forEach((tab, index) => {
      tab.tab_order = index;
    });

    tabStore$.tabs.set(newTabs);
    tabStore$.active_tab_index.set(activeTabIndex + 1);
    tabStore$.saveTabsToStorage();
  },

  removeTab: (index: number) => {
    const tabs = tabStore$.tabs.get();
    if (tabs.length <= 1) return; // Keep at least one tab

    const activeIndex = tabStore$.active_tab_index.get();
    const removedTab = tabs[index];

    console.log('[TabStore] 🗑️ Removing tab:', {
      index,
      tabId: removedTab?.id,
      tabTitle: removedTab?.title,
      activeIndex,
      totalTabs: tabs.length,
    });

    const newTabs = tabs.filter((_: TabState, i: number) => i !== index);

    // Update tab orders
    newTabs.forEach((tab: TabState, i: number) => {
      tab.tab_order = i;
    });

    tabStore$.tabs.set(newTabs);

    // Adjust active tab index if needed
    let newActiveIndex = activeIndex;
    if (activeIndex >= index && activeIndex > 0) {
      newActiveIndex = activeIndex - 1;
    } else if (activeIndex >= newTabs.length) {
      newActiveIndex = newTabs.length - 1;
    }

    console.log('[TabStore] ✅ Tab removed. New state:', {
      newActiveIndex,
      newActiveTab: newTabs[newActiveIndex]?.title,
      remainingTabs: newTabs.length,
      tabTitles: newTabs.map((t: TabState) => t.title),
    });

    tabStore$.active_tab_index.set(newActiveIndex);
    tabStore$.saveTabsToStorage();
  },

  switchTab: (index: number, preventNavigationUpdates: () => boolean, skipHistory: boolean = false) => {
    // Block tab switching during critical transitions
    if (preventNavigationUpdates()) {
      return;
    }

    const tabs = tabStore$.tabs.get();
    const currentTabIndex = tabStore$.active_tab_index.get();

    if (index >= 0 && index < tabs.length && index !== currentTabIndex) {
      // Push current tab to history before switching (unless skipping for back navigation)
      if (!skipHistory) {
        const history = tabStore$.tabHistory.get();
        // Avoid duplicate consecutive entries
        if (history.length === 0 || history[history.length - 1] !== currentTabIndex) {
          // Limit history size to prevent memory issues (keep last 50)
          const newHistory = [...history, currentTabIndex].slice(-50);
          tabStore$.tabHistory.set(newHistory);
        }
      }

      // Clear selected verse AND chapter from the tab that's becoming inactive
      const currentTab = tabs[currentTabIndex];
      if (currentTab && (currentTab.selected_verse_id !== null || currentTab.selected_chapter_id !== null)) {
        const updatedTabs = [...tabs];
        updatedTabs[currentTabIndex] = {
          ...currentTab,
          selected_verse_id: null,
          selected_chapter_id: null
        };
        tabStore$.tabs.set(updatedTabs);
      }

      // Switch to new tab
      tabStore$.active_tab_index.set(index);

      // Save state to storage
      tabStore$.saveTabsToStorage();
    }
  },

  /**
   * Go back to the previous tab in history
   * Returns true if navigation happened, false if no history
   */
  goBackTab: (): boolean => {
    const history = tabStore$.tabHistory.get();
    const tabs = tabStore$.tabs.get();

    if (history.length === 0) {
      return false;
    }

    // Pop the most recent tab from history
    const newHistory = [...history];
    let previousTabIndex = newHistory.pop()!;

    // Validate the index still exists (tabs may have been removed)
    while (previousTabIndex >= tabs.length && newHistory.length > 0) {
      previousTabIndex = newHistory.pop()!;
    }

    // If no valid history entry found
    if (previousTabIndex >= tabs.length) {
      tabStore$.tabHistory.set([]);
      return false;
    }

    // Update history first
    tabStore$.tabHistory.set(newHistory);

    // Switch to the previous tab (skip adding to history to avoid loops)
    const currentTabIndex = tabStore$.active_tab_index.get();
    if (previousTabIndex !== currentTabIndex) {
      tabStore$.active_tab_index.set(previousTabIndex);
      tabStore$.saveTabsToStorage();
    }

    return true;
  },

  /**
   * Check if there's tab history to go back to
   */
  canGoBackTab: (): boolean => {
    return tabStore$.tabHistory.get().length > 0;
  },

  /**
   * Clear tab history (useful when resetting app state)
   */
  clearTabHistory: () => {
    tabStore$.tabHistory.set([]);
  },

  // Update tab title when navigation changes
  updateActiveTabTitle: (title: string) => {
    const tabs = tabStore$.tabs.get();
    const activeTabIndex = tabStore$.active_tab_index.get();
    const activeTab = tabs[activeTabIndex];

    if (activeTab && activeTab.title !== title) {
      const updatedTabs = [...tabs];
      updatedTabs[activeTabIndex] = {
        ...activeTab,
        title
      };
      tabStore$.tabs.set(updatedTabs);
      tabStore$.saveTabsToStorage();
    }
  },

  // Update selected verse for active tab
  setActiveTabSelectedVerse: (verseId: number | null) => {
    const tabs = tabStore$.tabs.get();
    const activeTabIndex = tabStore$.active_tab_index.get();
    const activeTab = tabs[activeTabIndex];

    if (activeTab) {
      const updatedTabs = [...tabs];
      updatedTabs[activeTabIndex] = {
        ...activeTab,
        selected_verse_id: verseId
      };
      tabStore$.tabs.set(updatedTabs);
      // Don't save to storage on every verse selection - only on tab switch/close
    }
  },

  // Clear both verse and chapter selections from active tab (after navigation completes)
  clearActiveTabSelections: () => {
    const tabs = tabStore$.tabs.get();
    const activeTabIndex = tabStore$.active_tab_index.get();
    const activeTab = tabs[activeTabIndex];

    if (activeTab && (activeTab.selected_verse_id !== null || activeTab.selected_chapter_id !== null)) {
      const updatedTabs = [...tabs];
      updatedTabs[activeTabIndex] = {
        ...activeTab,
        selected_verse_id: null,
        selected_chapter_id: null
      };
      tabStore$.tabs.set(updatedTabs);
    }
  },

  // Clear all tabs and reset to default Genesis 1 tab
  clearAllTabs: () => {
    const defaultTab: TabState = {
      id: 'tab-1',
      tab_id: 'tab-1',
      current_chapter_id: 1001000,  // Genesis 1
      scroll_position: 0,
      title: 'Genesis 1',
      tab_order: 0,
      is_active: true,
      current_book_name: 'Genesis',
      current_chapter_number: 1,
      selected_verse_id: null,
      selected_chapter_id: null
    };

    tabStore$.tabs.set([defaultTab]);
    tabStore$.active_tab_index.set(0);
    tabStore$.saveTabsToStorage();
  },

  // Save tabs to AsyncStorage
  saveTabsToStorage: async () => {
    try {
      const tabs = tabStore$.tabs.get();
      const activeTabIndex = tabStore$.active_tab_index.get();

      const tabsState = {
        tabs: tabs.map((tab: TabState) => ({
          id: tab.id,
          title: tab.title,
          current_chapter_id: tab.current_chapter_id,
          scroll_position: tab.scroll_position,
          current_book_name: tab.current_book_name,
          current_chapter_number: tab.current_chapter_number,
          tab_order: tab.tab_order,
          selected_verse_id: tab.selected_verse_id
        })),
        activeTabIndex
      };

      if (__DEV__) {
        console.log('[TabStore] 💾 Saving tabs to storage');
      }

      await AsyncStorage.setItem('bible_tabs_state', JSON.stringify(tabsState));
    } catch (error) {
      console.error('[TabStore] Failed to save tabs to storage:', error);
    }
  },

  // Load tabs from AsyncStorage
  loadTabsFromStorage: async () => {
    try {
      const stored = await AsyncStorage.getItem('bible_tabs_state');
      if (stored) {
        const tabsState = JSON.parse(stored);

        console.log('[TabStore] 📂 Loading tabs from storage:', JSON.stringify(tabsState, null, 2));

        // Restore tabs with proper structure
        // ALWAYS clear selected_verse_id and selected_chapter_id - selections should never persist across sessions
        const restoredTabs = tabsState.tabs.map((tab: any) => ({
          ...tab,
          tab_id: tab.id,
          is_active: false,
          selected_verse_id: null, // Never restore verse selection from storage
          selected_chapter_id: null, // Never restore chapter selection from storage
          created_at: tab.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString()
        }));

        console.log('[TabStore] ✅ Restored tabs:', restoredTabs.map((t: any) => ({
          title: t.title,
          current_chapter_id: t.current_chapter_id,
          current_book_name: t.current_book_name,
          current_chapter_number: t.current_chapter_number,
        })));

        if (restoredTabs.length > 0) {
          tabStore$.tabs.set(restoredTabs);
          tabStore$.active_tab_index.set(tabsState.activeTabIndex || 0);
        }
      }
    } catch (error) {
      console.error('[TabStore] Failed to load tabs from storage:', error);
    }
  },

  // Clear all verse selections from all tabs (cleanup for any persisted remnants)
  clearAllVerseSelections: () => {
    const tabs = tabStore$.tabs.get();
    const hasAnySelection = tabs.some((tab: TabState) => tab.selected_verse_id !== null);

    if (hasAnySelection) {
      console.log('[TabStore] Clearing persisted verse selections from all tabs');
      const clearedTabs = tabs.map((tab: TabState) => ({
        ...tab,
        selected_verse_id: null
      }));
      tabStore$.tabs.set(clearedTabs);
    }
  },
});
