/**
 * Bible Viewer Logic Module - Sprint 2
 * Handles continuous Bible reading experience with optimized performance
 */

import { bibleStore$, type VerseLineData, type TabState } from "../../state/bibleStore";
import { getBookName } from './bibleBookMappings';

// Performance optimization: Reference cache to avoid repeated lookups
const referenceCache = new Map<string, string>();

// Clear cache periodically to prevent memory leaks
setInterval(() => {
  if (referenceCache.size > 1000) {
    referenceCache.clear();
  }
}, 60000); // Clear every minute if cache gets too large

export interface ViewerState {
  currentVerseIndex: number;
  scrollPosition: number;
  visibleRange: {
    startIndex: number;
    endIndex: number;
  };
  totalVerses: number;
}

export interface NavigationOptions {
  verseId?: string;
  book?: string;
  chapter?: number;
  verse?: number;
  smooth?: boolean;
}

/**
 * Calculate the optimal window size for virtual scrolling
 * Based on device performance and memory constraints
 * Optimized for Android Pixel 9 Pro and similar devices
 */
export const calculateOptimalWindowSize = (): number => {
  // Optimized for mobile performance - smaller window for continuous text
  // Since we're now rendering paragraphs as continuous text (not individual verses),
  // we can handle more content efficiently
  return 25; // Reduced window size for memory efficiency
};

/**
 * Calculate optimal chapter loading range based on current position
 */
export const getOptimalChapterRange = (currentChapter: number, totalChapters: number) => {
  const CHAPTER_BUFFER = 2; // Load 2 chapters before and after current
  
  return {
    start: Math.max(0, currentChapter - CHAPTER_BUFFER),
    end: Math.min(totalChapters - 1, currentChapter + CHAPTER_BUFFER),
    immediate: [currentChapter], // Load immediately
    background: [ // Load in background
      currentChapter - 1,
      currentChapter + 1,
      currentChapter - 2,
      currentChapter + 2
    ].filter(ch => ch >= 0 && ch < totalChapters)
  };
};

/**
 * Get the current viewer state (Performance Optimized)
 */
export const getCurrentViewerState = (): ViewerState => {
  const verseLines = bibleStore$.verse_lines.get();
  const currentVerseLineId = bibleStore$.current_verse_line_id.get();
  
  const currentIndex = currentVerseLineId ? 
    verseLines.findIndex((v: VerseLineData) => v.id === currentVerseLineId) : 0;
  
  const windowSize = calculateOptimalWindowSize();
  const safeCurrentIndex = Math.max(0, currentIndex);
  
  // Calculate visible range centered around current verse
  const halfWindow = Math.floor(windowSize / 2);
  const startIndex = Math.max(0, safeCurrentIndex - halfWindow);
  const endIndex = Math.min(verseLines.length - 1, startIndex + windowSize - 1);
  
  return {
    currentVerseIndex: safeCurrentIndex,
    scrollPosition: 0, // Will be managed by the component
    visibleRange: {
      startIndex,
      endIndex
    },
    totalVerses: verseLines.length
  };
};

/**
 * Navigate to a specific verse with smooth scrolling (Enhanced)
 */
export const navigateToVerse = (options: NavigationOptions): boolean => {
  const verseLines = bibleStore$.verse_lines.get();
  const chapters = bibleStore$.chapters.get();
  const books = bibleStore$.books.get();
  
  let targetVerseId: string | null = null;

  if (options.verseId) {
    // Verify the verse ID exists before setting it as target
    const verseExists = verseLines.some((vl: VerseLineData) => vl.id === options.verseId);
    targetVerseId = verseExists ? options.verseId : null;
  } else if (options.book && options.chapter && options.verse) {
    // Enhanced reference matching logic
    const targetBook = books.find((b: any) => 
      b.name.toLowerCase() === options.book?.toLowerCase() ||
      b.name.toLowerCase().includes(options.book?.toLowerCase() || '')
    );
    
    if (targetBook) {
      const targetChapter = targetBook.chapters.find((ch: any) => 
        ch.chapter_number === options.chapter
      );
      
      if (targetChapter) {
        // Find the verse in the chapter
        for (const section of targetChapter.sections) {
          for (const paragraph of section.paragraphs) {
            const targetVerse = paragraph.verse_lines.find((vl: any) => 
              vl.verse_number === options.verse
            );
            if (targetVerse) {
              targetVerseId = targetVerse.id;
              break;
            }
          }
          if (targetVerseId) break;
        }
      }
    }
  }

  if (targetVerseId) {
    updateReadingPosition(targetVerseId, 0);
    
    // Performance tracking
    if (__DEV__) {
      console.log(`🎯 Navigated to: ${getVerseReference(targetVerseId)}`);
    }
    
    return true;
  }

  return false;
};

/**
 * Get verses within a specific range for virtual scrolling (Performance Optimized)
 */
export const getVersesInRange = (startIndex: number, endIndex: number): VerseLineData[] => {
  const verseLines = bibleStore$.verse_lines.get();
  const safeStartIndex = Math.max(0, startIndex);
  const safeEndIndex = Math.min(endIndex, verseLines.length - 1);
  
  if (safeStartIndex > safeEndIndex || safeStartIndex >= verseLines.length) {
    return [];
  }
  
  return verseLines.slice(safeStartIndex, safeEndIndex + 1);
};

/**
 * Update the current reading position (Performance Optimized)
 */
export const updateReadingPosition = (verseLineId: string, scrollPosition: number): void => {
  // Batch store updates to minimize re-renders
  const tabs = bibleStore$.tabs.get();
  const activeTabIndex = bibleStore$.active_tab_index.get();
  
  // Always update verse line ID if it's different (remove scroll position check that was blocking updates)
  const currentVerseId = bibleStore$.current_verse_line_id.get();
  const shouldUpdateVerse = currentVerseId !== verseLineId;
  const shouldUpdateScroll = tabs[activeTabIndex]?.scroll_position !== scrollPosition;
  
  if (!shouldUpdateVerse && !shouldUpdateScroll) {
    return; // No change needed
  }
  
  // Always update the current verse line ID for header tracking
  if (shouldUpdateVerse) {
    bibleStore$.current_verse_line_id.set(verseLineId);
  }
  
  // Update active tab if exists
  if (tabs[activeTabIndex] && (shouldUpdateVerse || shouldUpdateScroll)) {
    const updatedTabs = [...tabs];
    updatedTabs[activeTabIndex] = {
      ...updatedTabs[activeTabIndex],
      current_verse_line_id: verseLineId,
      scroll_position: scrollPosition,
    };
    bibleStore$.tabs.set(updatedTabs);
  }
  
  // Performance tracking (development only)
  if (__DEV__ && shouldUpdateVerse) {
    console.log(`📖 Reading position updated: ${getVerseReference(verseLineId)}`);
  }
};

/**
 * Get chapter and verse reference for a verse line (Performance Optimized)
 */
export const getVerseReference = (verseLineId: string): string => {
  // Parse verse ID directly using numerical structure (X00Y00Z format)
  const verseIdNum = parseInt(verseLineId);
  if (isNaN(verseIdNum)) {
    console.warn(`Invalid verse ID format: ${verseLineId}`);
    return "Unknown";
  }
  
  // Extract book, chapter, and verse numbers from the ID
  const bookNumber = Math.floor(verseIdNum / 1000000);
  const chapterNumber = Math.floor((verseIdNum % 1000000) / 1000);
  const verseNumber = verseIdNum % 1000;
  
  // Get book name using existing mapping
  const bookName = getBookName(bookNumber);
  
  if (bookName === 'Unknown') {
    console.warn(`Unknown book number: ${bookNumber} from verse ID ${verseLineId}`);
    return "Unknown";
  }
  
  // Format reference as "BookName ChapterNumber:VerseNumber"
  return `${bookName} ${chapterNumber}:${verseNumber}`;
};

/**
 * Performance optimization: Pre-calculate verse heights for smooth scrolling
 * Enhanced for continuous text rendering
 */
export const estimateVerseHeight = (verseLine: VerseLineData): number => {
  // For continuous text paragraphs, height calculation is different
  if (verseLine.is_isolated || verseLine.indent_level > 0) {
    // Individual verse line (poetry or isolated)
    const baseHeight = 32;
    const textHeight = Math.ceil(verseLine.text.length / 50) * 20;
    const indentHeight = verseLine.indent_level * 4;
    return baseHeight + textHeight + indentHeight;
  } else {
    // Part of continuous paragraph - minimal individual height
    return Math.ceil(verseLine.text.length / 80) * 16; // Approximate inline height
  }
};

/**
 * Estimate paragraph height for continuous text rendering
 */
export const estimateParagraphHeight = (verseLines: VerseLineData[], fontSize: number = 16): number => {
  const isPoetry = verseLines.some(vl => vl.indent_level > 0);
  const isIsolated = verseLines.some(vl => vl.is_isolated);
  
  if (isPoetry || isIsolated) {
    // Sum individual verse heights
    return verseLines.reduce((total, vl) => total + estimateVerseHeight(vl), 0);
  } else {
    // Continuous paragraph height estimation
    const totalCharacters = verseLines.reduce((sum, vl) => sum + vl.text.length, 0);
    const averageCharsPerLine = 50; // Approximate for mobile display
    const lineHeight = fontSize * 1.6;
    const estimatedLines = Math.ceil(totalCharacters / averageCharsPerLine);
    return estimatedLines * lineHeight + 16; // Additional padding
  }
};

/**
 * Calculate total content height for virtual scrolling
 * Enhanced for paragraph-based continuous text layout
 */
export const calculateTotalContentHeight = (): number => {
  const chapters = bibleStore$.chapters.get();
  let totalHeight = 0;
  
  for (const chapter of chapters) {
    totalHeight += 80; // Chapter header height
    
    for (const section of chapter.sections) {
      if (section.title) {
        totalHeight += 40; // Section header height
      }
      
      for (const paragraph of section.paragraphs) {
        totalHeight += estimateParagraphHeight(paragraph.verse_lines);
      }
    }
  }
  
  return totalHeight;
};

/**
 * Memory optimization: Clear non-visible chapters from memory
 */
export const optimizeMemoryUsage = (visibleChapterRange: { start: number; end: number }) => {
  const allChapters = bibleStore$.chapters.get();
  
  // Only keep chapters in visible range + buffer
  const MEMORY_BUFFER = 5;
  const keepStart = Math.max(0, visibleChapterRange.start - MEMORY_BUFFER);
  const keepEnd = Math.min(allChapters.length - 1, visibleChapterRange.end + MEMORY_BUFFER);
  
  const optimizedChapters = allChapters.slice(keepStart, keepEnd + 1);
  
  if (optimizedChapters.length !== allChapters.length) {
    console.log(`Memory optimization: Keeping ${optimizedChapters.length}/${allChapters.length} chapters in memory`);
    // Note: Be careful with this - might need to re-implement based on actual data loading strategy
    // bibleStore$.chapters.set(optimizedChapters);
  }
};

/**
 * Find the verse index at a specific scroll position
 * Enhanced for continuous text and paragraph-based layout
 */
export const getVerseIndexAtPosition = (scrollPosition: number): number => {
  const chapters = bibleStore$.chapters.get();
  let currentPosition = 0;
  
  // Navigate through chapters -> sections -> paragraphs -> verses
  for (const chapter of chapters) {
    for (const section of chapter.sections) {
      for (const paragraph of section.paragraphs) {
        const paragraphHeight = estimateParagraphHeight(paragraph.verse_lines);
        
        if (currentPosition + paragraphHeight > scrollPosition) {
          // Found the paragraph, now find the specific verse
          const verseLines = paragraph.verse_lines;
          if (verseLines.length === 0) continue;
          
          // For continuous paragraphs, return the first verse
          // For poetry/isolated, calculate more precisely
          const isPoetry = verseLines.some((vl: any) => vl.indent_level > 0);
          const isIsolated = verseLines.some((vl: any) => vl.is_isolated);
          
          if (isPoetry || isIsolated) {
            // Calculate precise verse position within paragraph
            let positionInParagraph = scrollPosition - currentPosition;
            let runningHeight = 0;
            
            for (let i = 0; i < verseLines.length; i++) {
              const verseHeight = estimateVerseHeight(verseLines[i]);
              if (runningHeight + verseHeight > positionInParagraph) {
                const allVerses = bibleStore$.verse_lines.get();
                return allVerses.findIndex((vl: VerseLineData) => vl.id === verseLines[i].id);
              }
              runningHeight += verseHeight;
            }
          } else {
            // For continuous text, return first verse in paragraph
            const allVerses = bibleStore$.verse_lines.get();
            return allVerses.findIndex((vl: VerseLineData) => vl.id === verseLines[0].id);
          }
        }
        
        currentPosition += paragraphHeight;
      }
    }
  }
  
  return Math.max(0, bibleStore$.verse_lines.get().length - 1);
};