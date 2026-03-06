/**
 * Bible Viewer Hook - Sprint 2 Enhanced
 * Manages the continuous Bible reading experience with optimized performance
 * Supports progressive loading and AsyncStorage persistence
 */

import { useSelector } from '@legendapp/state/react';
import { useCallback, useMemo, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { bibleStore$, type VerseLineData } from '../state/bibleStore';
import { 
  getCurrentViewerState,
  navigateToVerse,
  getVersesInRange,
  updateReadingPosition,
  getVerseReference,
  calculateOptimalWindowSize,
  getVerseIndexAtPosition,
  type NavigationOptions,
  type ViewerState
} from '../modules/bible/bibleViewerLogic';

export interface UseBibleViewerReturn {
  // State
  currentVerseLineId: string | null;
  currentViewerState: ViewerState;
  verseLines: VerseLineData[];
  isLoading: boolean;
  
  // Navigation
  navigateToVerse: (options: NavigationOptions) => boolean;
  getCurrentReference: () => string;
  
  // Virtual Scrolling
  getVisibleVerses: (startIndex: number, endIndex: number) => VerseLineData[];
  updatePosition: (verseLineId: string, scrollPosition: number) => void;
  getVerseAtPosition: (scrollPosition: number) => number;
  
  // Performance & Progressive Loading
  windowSize: number;
  totalContentHeight: number;
  loadedChaptersCount: number;
  
  // AsyncStorage Integration
  saveCurrentPosition: () => Promise<void>;
  loadLastPosition: () => Promise<string | null>;
}

/**
 * Main Bible Viewer Hook
 * Provides all functionality needed for continuous Bible reading
 */
export const useBibleViewer = (): UseBibleViewerReturn => {
  // Observe store values directly for real-time updates
  const currentVerseLineId = useSelector(bibleStore$.current_verse_line_id);
  const verseLines = [] as VerseLineData[]; // Temporarily disabled to prevent massive logging
  const isLoading = useSelector(bibleStore$.is_loading);
  
  // Performance tracking
  const loadedChaptersCount = useMemo(() => {
    const chapters = bibleStore$.chapters.get();
    return chapters?.length || 0;
  }, []);
  
  // Debug logging moved to useEffect to prevent render cycle issues

  // Calculate viewer state
  const currentViewerState = useMemo(() => getCurrentViewerState(), [currentVerseLineId, verseLines]);
  
  // Optimal window size for performance
  const windowSize = useMemo(() => calculateOptimalWindowSize(), []);
  
  // Total content height for virtual scrolling
  const totalContentHeight = useMemo(() => {
    if (!verseLines || !Array.isArray(verseLines)) return 0;
    return verseLines.reduce((total, verse) => {
      if (!verse) return total;
      // Estimate verse height based on content
      const baseHeight = 32;
      const textHeight = Math.ceil(verse.text.length / 50) * 20;
      const indentHeight = verse.indent_level * 4;
      return total + baseHeight + textHeight + indentHeight;
    }, 0);
  }, [verseLines]);

  // Navigation functions
  const handleNavigateToVerse = useCallback((options: NavigationOptions) => {
    return navigateToVerse(options);
  }, []);

  const getCurrentReference = useCallback(() => {
    if (!currentVerseLineId) return "No verse selected";
    return getVerseReference(currentVerseLineId);
  }, [currentVerseLineId]);

  // Virtual scrolling functions
  const getVisibleVerses = useCallback((startIndex: number, endIndex: number): VerseLineData[] => {
    return getVersesInRange(startIndex, endIndex).filter((v): v is VerseLineData => v != null);
  }, []);

  const updatePosition = useCallback((verseLineId: string, scrollPosition: number) => {
    updateReadingPosition(verseLineId, scrollPosition);
  }, []);

  const getVerseAtPosition = useCallback((scrollPosition: number) => {
    return getVerseIndexAtPosition(scrollPosition);
  }, []);

  // AsyncStorage integration for reading position persistence
  const saveCurrentPosition = useCallback(async () => {
    if (currentVerseLineId) {
      try {
        const reference = getCurrentReference();
        await AsyncStorage.setItem('@bible_reading_position', JSON.stringify({
          verseLineId: currentVerseLineId,
          reference,
          timestamp: Date.now()
        }));
      } catch (error) {
        console.warn('Failed to save reading position:', error);
      }
    }
  }, [currentVerseLineId, getCurrentReference]);
  
  const loadLastPosition = useCallback(async (): Promise<string | null> => {
    try {
      const stored = await AsyncStorage.getItem('@bible_reading_position');
      if (stored) {
        const { verseLineId } = JSON.parse(stored);
        return verseLineId;
      }
    } catch (error) {
      console.warn('Failed to load last position:', error);
    }
    return null;
  }, []);
  
  // Auto-save reading position when it changes
  useEffect(() => {
    if (currentVerseLineId) {
      const timeoutId = setTimeout(saveCurrentPosition, 2000); // Debounce saves
      return () => clearTimeout(timeoutId);
    }
  }, [currentVerseLineId, saveCurrentPosition]);
  
  return {
    // State
    currentVerseLineId,
    currentViewerState,
    verseLines,
    isLoading,
    
    // Navigation
    navigateToVerse: handleNavigateToVerse,
    getCurrentReference,
    
    // Virtual Scrolling
    getVisibleVerses,
    updatePosition,
    getVerseAtPosition,
    
    // Performance & Progressive Loading
    windowSize,
    totalContentHeight,
    loadedChaptersCount,
    
    // AsyncStorage Integration
    saveCurrentPosition,
    loadLastPosition,
  };
};

/**
 * Lightweight hook for just getting current verse information
 */
export const useCurrentVerse = () => {
  const currentVerseLineId = useSelector(bibleStore$.current_verse_line_id);
  const verseLines = [] as VerseLineData[]; // Temporarily disabled to prevent massive logging
  
  const currentVerse = useMemo(() => {
    const verseId = bibleStore$.current_verse_line_id.get();
    const verses = bibleStore$.verse_lines.get() || [];
    if (!verseId || !Array.isArray(verses)) return null;
    return verses.find(v => v.id === verseId) || null;
  }, []);

  const currentReference = useMemo(() => {
    const verseId = bibleStore$.current_verse_line_id.get();
    if (!verseId) return "No verse selected";
    return getVerseReference(verseId);
  }, []);

  return {
    currentVerse,
    currentReference,
    currentVerseLineId,
  };
};

/**
 * Hook specifically for performance monitoring
 */
export const useBibleViewerPerformance = () => {
  const verseLines = [] as VerseLineData[]; // Temporarily disabled to prevent massive logging
  
  const stats = useMemo(() => {
    const verses = bibleStore$.verse_lines.get() || [];
    if (!Array.isArray(verses)) {
      return {
        totalVerses: 0,
        averageVerseLength: 0,
        windowSize: calculateOptimalWindowSize(),
        estimatedMemoryUsage: 0,
      };
    }
    return {
      totalVerses: verses.length,
      averageVerseLength: verses.length > 0 ? verses.reduce((sum, v) => sum + v.text.length, 0) / verses.length : 0,
      windowSize: calculateOptimalWindowSize(),
      estimatedMemoryUsage: verses.length * 200, // Rough estimate in bytes
    };
  }, []);

  return stats;
};