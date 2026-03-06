/**
 * useSQLiteBible Hook
 * Efficient data fetching and prefetching for Bible content
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { bibleSQLite, type ChapterContent, type Chapter } from '../services/sqlite';

interface UseSQLiteBibleOptions {
  initialChapterId?: number;
  prefetchAhead?: number;
  prefetchBehind?: number;
  onError?: (error: Error) => void;
}

interface UseSQLiteBibleResult {
  currentChapter: ChapterContent | null;
  loadedChapters: Map<number, ChapterContent>;
  isLoading: boolean;
  error: Error | null;
  loadChapter: (chapterId: number) => Promise<void>;
  prefetchAdjacentChapters: (chapterId: number) => Promise<void>;
  getAllChapters: () => Promise<Chapter[]>;
  getTotalChapterCount: () => Promise<number>;
  clearCache: () => void;
}

/**
 * Hook for managing SQLite Bible data with intelligent prefetching
 */
export function useSQLiteBible({
  initialChapterId = 1001000, // Genesis 1
  prefetchAhead = 10, // More aggressive prefetching
  prefetchBehind = 5,
  onError,
}: UseSQLiteBibleOptions = {}): UseSQLiteBibleResult {
  const [currentChapter, setCurrentChapter] = useState<ChapterContent | null>(null);
  const [loadedChapters, setLoadedChapters] = useState<Map<number, ChapterContent>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  // Track ongoing fetches to prevent duplicates
  const fetchingChapters = useRef<Set<number>>(new Set());
  const isInitialized = useRef(false);
  const loadedChaptersRef = useRef<Map<number, ChapterContent>>(new Map());

  /**
   * Initialize SQLite and load initial chapter
   */
  useEffect(() => {
    if (!isInitialized.current) {
      isInitialized.current = true;
      initializeAndLoad();
    }
  }, []);

  const initializeAndLoad = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Initialize SQLite
      await bibleSQLite.initialize();
      console.log('[useSQLiteBible] SQLite initialized');
      
      // Load initial chapter
      await loadChapter(initialChapterId);
      
      // Prefetch adjacent chapters
      await prefetchAdjacentChapters(initialChapterId);
      
    } catch (err) {
      const error = err as Error;
      console.error('[useSQLiteBible] Initialization failed:', error);
      setError(error);
      onError?.(error);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Load a specific chapter
   */
  const loadChapter = useCallback(async (chapterId: number) => {
    // Validate chapter ID format (should end in 000)
    if (chapterId % 1000 !== 0) {
      console.error(`[useSQLiteBible] Invalid chapter ID format: ${chapterId}. Chapter IDs should end in 000`);
      // Try to fix it by zeroing out the last 3 digits
      const bookPart = Math.floor(chapterId / 1000000) * 1000000;
      const chapterPart = Math.floor((chapterId % 1000000) / 1000) * 1000;
      chapterId = bookPart + chapterPart;
      console.log(`[useSQLiteBible] Corrected to: ${chapterId}`);
    }
    
    // Check cache first using ref for latest value
    const cached = loadedChaptersRef.current.get(chapterId);
    if (cached) {
      setCurrentChapter(cached);
      return;
    }
    
    // Prevent duplicate fetches
    if (fetchingChapters.current.has(chapterId)) {
      console.log(`[useSQLiteBible] Chapter ${chapterId} already being fetched, skipping duplicate`);
      return;
    }
    
    fetchingChapters.current.add(chapterId);
    
    try {
      const startTime = performance.now();
      const content = await bibleSQLite.getChapterContent(chapterId);
      
      if (content) {
        // Update cache
        setLoadedChapters(prev => {
          const updated = new Map(prev);
          updated.set(chapterId, content);
          
          // Limit cache size to prevent memory issues
          if (updated.size > 50) { // Increased cache size
            // Remove oldest entries
            const entries = Array.from(updated.entries());
            const toRemove = entries.slice(0, entries.length - 50);
            toRemove.forEach(([id]) => updated.delete(id));
          }
          
          // Update ref with latest cache
          loadedChaptersRef.current = updated;
          return updated;
        });
        
        setCurrentChapter(content);
        
        const loadTime = performance.now() - startTime;
        console.log(`[useSQLiteBible] Chapter ${chapterId} loaded in ${loadTime.toFixed(2)}ms`);
      }
    } catch (err) {
      const error = err as Error;
      console.error(`[useSQLiteBible] Failed to load chapter ${chapterId}:`, error);
      setError(error);
      onError?.(error);
    } finally {
      fetchingChapters.current.delete(chapterId);
    }
  }, [onError]); // Remove loadedChapters from deps to avoid stale closure

  /**
   * Prefetch adjacent chapters for smooth scrolling
   */
  const prefetchAdjacentChapters = useCallback(async (chapterId: number) => {
    try {
      // Validate and fix chapter ID if needed
      if (chapterId % 1000 !== 0) {
        const bookPart = Math.floor(chapterId / 1000000) * 1000000;
        const chapterPart = Math.floor((chapterId % 1000000) / 1000) * 1000;
        chapterId = bookPart + chapterPart;
        console.log(`[useSQLiteBible] Fixed chapter ID for prefetch: ${chapterId}`);
      }
      // Use the new sequential method for proper book transitions
      const adjacentIds = await bibleSQLite.getSequentialChapterRange(
        chapterId,
        prefetchBehind,
        prefetchAhead
      );
      
      console.log(`[useSQLiteBible] Got ${adjacentIds.length} adjacent chapter IDs for ${chapterId}`);
      
      // IMPORTANT: Load ALL chapters in the range to ensure continuity
      // Don't just load missing ones - ensure we have a continuous range
      const toLoad = adjacentIds.filter(id => 
        !loadedChaptersRef.current.has(id) && !fetchingChapters.current.has(id)
      );
      
      if (toLoad.length === 0) {
        console.log(`[useSQLiteBible] All ${adjacentIds.length} chapters already loaded`);
        return;
      }
      
      console.log(`[useSQLiteBible] Need to load ${toLoad.length} chapters: ${toLoad.slice(0, 5).join(', ')}...`);
      
      // Load chapters in parallel WITHOUT delays
      const promises = toLoad.map(async (id) => {
        // Double-check to prevent race conditions
        if (fetchingChapters.current.has(id) || loadedChaptersRef.current.has(id)) {
          return null;
        }
        
        fetchingChapters.current.add(id);
        
        try {
          const content = await bibleSQLite.getChapterContent(id);
          if (content) {
            return { id, content };
          } else {
            console.warn(`[useSQLiteBible] Chapter ${id} returned no content`);
            return null;
          }
        } catch (error) {
          console.error(`[useSQLiteBible] Failed to prefetch chapter ${id}:`, error);
          return null;
        } finally {
          fetchingChapters.current.delete(id);
        }
      });
      
      const results = await Promise.all(promises);
      
      // Update cache with prefetched chapters
      setLoadedChapters(prev => {
        const updated = new Map(prev);
        
        results.forEach(result => {
          if (result) {
            updated.set(result.id, result.content);
          }
        });
        
        // Limit cache size but be smart about what to remove
        if (updated.size > 50) { // Increased cache size
          const entries = Array.from(updated.entries());
          // Sort by distance from current chapter if available
          const currentId = currentChapter?.chapter.id;
          if (currentId) {
            entries.sort(([a], [b]) => {
              const distA = Math.abs(a - currentId);
              const distB = Math.abs(b - currentId);
              return distB - distA; // Remove furthest first
            });
          }
          const toRemove = entries.slice(50);
          toRemove.forEach(([id]) => updated.delete(id));
        }
        
        // Update ref with latest cache
        loadedChaptersRef.current = updated;
        console.log(`[useSQLiteBible] Prefetch complete, new cache size: ${updated.size}`);
        return updated;
      });
      
    } catch (err) {
      const error = err as Error;
      console.error('[useSQLiteBible] Prefetch failed:', error);
      // Don't set error state for prefetch failures
    }
  }, [prefetchAhead, prefetchBehind]); // Remove loadedChapters from deps

  /**
   * Get all chapters for navigation
   */
  const getAllChapters = useCallback(async (): Promise<Chapter[]> => {
    try {
      return await bibleSQLite.getAllChaptersWithBooks();
    } catch (err) {
      const error = err as Error;
      console.error('[useSQLiteBible] Failed to get all chapters:', error);
      throw error;
    }
  }, []);

  /**
   * Get total chapter count
   */
  const getTotalChapterCount = useCallback(async (): Promise<number> => {
    try {
      return await bibleSQLite.getTotalChapterCount();
    } catch (err) {
      const error = err as Error;
      console.error('[useSQLiteBible] Failed to get chapter count:', error);
      throw error;
    }
  }, []);

  /**
   * Clear the cache
   */
  const clearCache = useCallback(() => {
    setLoadedChapters(new Map());
    setCurrentChapter(null);
    fetchingChapters.current.clear();
    console.log('[useSQLiteBible] Cache cleared');
  }, []);

  return {
    currentChapter,
    loadedChapters,
    isLoading,
    error,
    loadChapter,
    prefetchAdjacentChapters,
    getAllChapters,
    getTotalChapterCount,
    clearCache,
  };
}