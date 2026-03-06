/**
 * Tab Manager Module
 * Centralizes all tab-related business logic
 * Components should use these functions instead of directly accessing the store
 */

import { bibleStore$ } from '@/state/bibleStore';
import * as Haptics from 'expo-haptics';

/**
 * Switch to a specific tab with haptic feedback
 */
export const switchToTab = async (index: number): Promise<void> => {
  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  bibleStore$.switchTab(index);
};

/**
 * Add a new tab with optional chapter and verse selection
 */
export const addNewTab = async (
  chapterId?: number,
  bookName?: string,
  chapterNumber?: number,
  selectedVerseId?: number | null,
  selectedChapterId?: number | null
): Promise<void> => {
  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  bibleStore$.addTab(chapterId, bookName, chapterNumber, selectedVerseId, selectedChapterId);
};

/**
 * Remove a tab with haptic feedback
 */
export const removeTab = async (index: number): Promise<void> => {
  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  bibleStore$.removeTab(index);
};

/**
 * Update tab state for a specific tab
 */
export const updateTabState = (
  tabIndex: number,
  chapterId: number,
  bookName: string,
  chapterNumber: number
): void => {
  const tabs = bibleStore$.tabs.get();
  const oldTab = tabs[tabIndex];

  // ✅ CRITICAL FIX: Don't update tabs that don't exist (e.g., just-closed tabs)
  if (!oldTab) {
    console.log('[TabManager] ⚠️ updateTabState ignored - tab does not exist:', {
      tabIndex,
      totalTabs: tabs.length,
      attemptedUpdate: `${bookName} ${chapterNumber}`,
    });
    return;
  }

  // Skip update if chapter hasn't actually changed (reduces unnecessary store updates)
  if (oldTab.current_chapter_id === chapterId) {
    return;
  }

  if (__DEV__) {
    console.log('[TabManager] 📝 Chapter changed:', {
      tabIndex,
      from: oldTab.title,
      to: `${bookName} ${chapterNumber}`,
    });
  }

  const updatedTabs = [...tabs];
  updatedTabs[tabIndex] = {
    ...updatedTabs[tabIndex],
    current_chapter_id: chapterId,
    current_book_name: bookName,
    current_chapter_number: chapterNumber,
    title: `${bookName} ${chapterNumber}`,
  };
  bibleStore$.tabs.set(updatedTabs);
};

/**
 * Save tabs to storage (debounced)
 */
let saveDebounceTimer: ReturnType<typeof setTimeout> | null = null;

export const saveTabsDebounced = (delay: number = 1000): void => {
  if (saveDebounceTimer) {
    clearTimeout(saveDebounceTimer);
  }
  saveDebounceTimer = setTimeout(() => {
    bibleStore$.saveTabsToStorage();
  }, delay);
};

/**
 * Save tabs immediately
 */
export const saveTabsImmediate = (): void => {
  if (saveDebounceTimer) {
    clearTimeout(saveDebounceTimer);
  }
  bibleStore$.saveTabsToStorage();
};

/**
 * Get current tab chapter ID without subscribing to changes
 */
export const getCurrentTabChapterId = (tabIndex: number): number | undefined => {
  return bibleStore$.tabs.get()[tabIndex]?.current_chapter_id;
};

/**
 * Navigate to a specific verse with highlighting
 * @param chapterId - The chapter ID to navigate to
 * @param bookName - The book name for tab title
 * @param chapterNumber - The chapter number for tab title
 * @param verseId - Optional verse ID to highlight (e.g., 43003016 for John 3:16)
 */
export const navigateToVerse = async (
  chapterId: number,
  bookName: string,
  chapterNumber: number,
  verseId?: number
): Promise<void> => {
  // Add new tab with verse selection already set
  // This prevents race condition where the tab loads before verse is selected
  await addNewTab(chapterId, bookName, chapterNumber, verseId || null);
};

/**
 * Navigate to chapter without verse highlighting
 * @param chapterId - The chapter ID to navigate to (e.g., 43003000 for John 3)
 * @param bookName - The book name for tab title
 * @param chapterNumber - The chapter number for tab title
 */
export const navigateToChapter = async (
  chapterId: number,
  bookName: string,
  chapterNumber: number
): Promise<void> => {
  // Add new tab with chapter selection (no verse highlighting)
  // Pass chapterId as selectedChapterId to trigger navigation without verse selection
  await addNewTab(chapterId, bookName, chapterNumber, null, chapterId);
};