/**
 * Verse Navigation Service - Using Biblical ID Mapping System
 * Provides efficient navigation using numerical verse IDs (X00Y00Z format)
 */

import { bibleStore$ } from '../../state/bibleStore';
import { getGlobalChapterIndexFromVerseId, getBookName } from './bibleBookMappings';

/**
 * Navigate to a specific verse using book name and chapter/verse numbers
 */
export const navigateToReference = (bookName: string, chapter: number, verse: number = 1): boolean => {
  try {
    // Find the book number from our mapping
    let bookNumber: number | null = null;
    
    // Search through book numbers 1-66 to find matching name
    for (let i = 1; i <= 66; i++) {
      if (getBookName(i).toLowerCase() === bookName.toLowerCase()) {
        bookNumber = i;
        break;
      }
    }
    
    if (!bookNumber) {
      console.warn(`Book not found: ${bookName}`);
      return false;
    }
    
    // Calculate verse ID using X00Y00Z format
    const verseId = bookNumber * 1000000 + chapter * 1000 + verse;
    const verseIdString = `${verseId}_0`; // Add the line suffix
    
    // Navigate to this verse
    return navigateToVerseId(verseIdString);
  } catch (error) {
    console.error('Navigation error:', error);
    return false;
  }
};

/**
 * Navigate directly using verse ID
 */
export const navigateToVerseId = (verseId: string): boolean => {
  try {
    // Update the current verse in the store
    bibleStore$.current_verse_line_id.set(verseId);
    
    // Calculate the global chapter index for scrolling
    const verseIdNum = parseInt(verseId);
    const globalChapterIndex = getGlobalChapterIndexFromVerseId(verseIdNum);
    
    // Log navigation
    const bookNumber = Math.floor(verseIdNum / 1000000);
    const chapterNumber = Math.floor((verseIdNum % 1000000) / 1000);
    const verseNumber = verseIdNum % 1000;
    const bookName = getBookName(bookNumber);
    
    // Update the active tab's current chapter for navigation
    const activeTabIndex = bibleStore$.active_tab_index.get();
    const tabs = bibleStore$.tabs.get();
    const activeTab = tabs[activeTabIndex];
    
    if (activeTab) {
      const chapterId = bookNumber * 1000000 + chapterNumber * 1000;
      const newTitle = `${bookName} ${chapterNumber}`;
      const updatedTabs = [...tabs];
      updatedTabs[activeTabIndex] = {
        ...activeTab,
        current_chapter_id: chapterId,
        current_book_name: bookName,
        current_chapter_number: chapterNumber,
        title: newTitle,
      };
      bibleStore$.tabs.set(updatedTabs);
      
      // Save to storage immediately
      if (bibleStore$.saveTabsToStorage) {
        bibleStore$.saveTabsToStorage();
      }
    }
    
    console.log(`🎯 Navigating to ${bookName} ${chapterNumber}:${verseNumber} (ID: ${verseId}, Global Chapter: ${globalChapterIndex})`);
    
    return true;
  } catch (error) {
    console.error('Verse navigation error:', error);
    return false;
  }
};

/**
 * Quick navigation presets for common verses
 */
export const quickNavigation = {
  genesis1: () => navigateToReference('Genesis', 1, 1),
  john3_16: () => navigateToReference('John', 3, 16),
  psalms23: () => navigateToReference('Psalms', 23, 1),
  romans8_28: () => navigateToReference('Romans', 8, 28),
  matthew5: () => navigateToReference('Matthew', 5, 1),
  revelation22: () => navigateToReference('Revelation', 22, 1),
};

/**
 * Navigate to next/previous chapter
 */
export const navigateToNextChapter = (): boolean => {
  try {
    const currentVerseId = bibleStore$.current_verse_line_id.get();
    if (!currentVerseId) return false;
    
    const verseIdNum = parseInt(currentVerseId);
    const bookNumber = Math.floor(verseIdNum / 1000000);
    const chapterNumber = Math.floor((verseIdNum % 1000000) / 1000);
    
    // Navigate to next chapter, verse 1
    return navigateToReference(getBookName(bookNumber), chapterNumber + 1, 1);
  } catch (error) {
    console.error('Next chapter navigation error:', error);
    return false;
  }
};

export const navigateToPreviousChapter = (): boolean => {
  try {
    const currentVerseId = bibleStore$.current_verse_line_id.get();
    if (!currentVerseId) return false;
    
    const verseIdNum = parseInt(currentVerseId);
    const bookNumber = Math.floor(verseIdNum / 1000000);
    const chapterNumber = Math.floor((verseIdNum % 1000000) / 1000);
    
    if (chapterNumber <= 1) return false; // Can't go to chapter 0
    
    // Navigate to previous chapter, verse 1
    return navigateToReference(getBookName(bookNumber), chapterNumber - 1, 1);
  } catch (error) {
    console.error('Previous chapter navigation error:', error);
    return false;
  }
};