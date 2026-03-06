/**
 * Simplified Bible Data Loading Hook
 * Clean, predictable loading without complex gap detection
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { bibleSQLite, type ChapterContent } from '../services/sqlite';

interface UseSimplifiedBibleLoaderOptions {
  initialChapterId?: number;
  loadSize?: number; // How many chapters to load at once
  versionId?: string; // Bible version to load
  isActive?: boolean; // PERFORMANCE: Skip loading when tab is inactive
  startFromTarget?: boolean; // Load starting FROM target, not centered (for verse-aligned mode)
}

export interface ProcessedChapterData {
  [chapterId: number]: ChapterContent;
}

/**
 * Global cache shared across all hook instances
 * Key format: `${chapterId}-${versionId}`
 * This enables instant tab switching without SQLite queries
 */
const globalChapterCache = new Map<string, ChapterContent>();
const globalLoadingSet = new Set<string>();

/**
 * Global chapter list cache (shared across all hook instances)
 * Prevents querying SQLite for chapter IDs multiple times
 */
let globalChapterList: number[] | null = null;
let globalChapterListPromise: Promise<number[]> | null = null;

/**
 * Clear global cache for a specific version (called when version changes)
 */
const clearGlobalCacheForVersion = (versionId: string) => {
  const keysToDelete: string[] = [];
  globalChapterCache.forEach((_, key) => {
    if (key.endsWith(`-${versionId}`)) {
      keysToDelete.push(key);
    }
  });
  keysToDelete.forEach(key => globalChapterCache.delete(key));
};

export function useSimplifiedBibleLoader({
  initialChapterId = 1001000,
  loadSize = 30, // Reasonable default for smooth scrolling
  versionId,
  isActive = true, // PERFORMANCE: Default to active, skip work when inactive
  startFromTarget = false, // When true, load from target forward (not centered)
}: UseSimplifiedBibleLoaderOptions = {}) {
  const [chapters, setChapters] = useState<ProcessedChapterData>({});
  const [isLoading, setIsLoading] = useState(true);
  const [chapterList, setChapterList] = useState<number[]>([]);
  const [currentVersion, setCurrentVersion] = useState<string | undefined>(versionId);
  const [chaptersVersion, setChaptersVersion] = useState<string | undefined>(versionId); // Track version of loaded chapters

  // Track loading state to prevent duplicates
  const loadingRef = useRef<Set<number>>(new Set());
  const loadedRef = useRef<Set<number>>(new Set());

  // Track if we need to reload after version change
  const needsReloadRef = useRef(false);

  /**
   * Process raw verse data into chapter structure
   */
  const processVerses = useCallback((verses: any[], versionId: string): ProcessedChapterData => {
    const processedChapters: ProcessedChapterData = {};

    verses.forEach(verse => {
      const chapterId = verse.chapter_id;

      // Initialize chapter
      if (!processedChapters[chapterId]) {
        processedChapters[chapterId] = {
          chapter: {
            id: chapterId,
            book_id: verse.book_id,
            chapter_number: verse.chapter_number,
            book_name: verse.book_name,
          },
          sections: [],
        };
      }

      // Find or create section
      let section = processedChapters[chapterId].sections.find(
        s => s.section.id === verse.section_id
      );

      if (!section) {
        section = {
          section: {
            id: verse.section_id,
            version_id: versionId,
            chapter_id: chapterId,
            title: verse.section_title,
            subtitle: verse.section_subtitle,
            section_order: verse.section_order,
          },
          paragraphs: [],
        };
        processedChapters[chapterId].sections.push(section);
      }

      // Find or create paragraph
      let paragraph = section.paragraphs.find(
        p => p.paragraph.id === verse.paragraph_id
      );

      if (!paragraph) {
        paragraph = {
          paragraph: {
            id: verse.paragraph_id,
            version_id: versionId,
            section_id: verse.section_id,
            paragraph_order: verse.paragraph_order,
            is_poetry: verse.is_poetry,
          },
          verseLines: [],
        };
        section.paragraphs.push(paragraph);
      }

      // Add verse line with validation
      if (verse.text === null || verse.text === undefined) {
        if (__DEV__) console.warn(`[SimplifiedLoader] Verse ${verse.verse_id} has null/undefined text in chapter ${chapterId}`);
      }

      // Extract numeric verse ID from line ID (e.g., "40013014_0" -> 40013014)
      const verseIdNum = verse.verse_id.includes('_')
        ? parseInt(verse.verse_id.split('_')[0])
        : parseInt(verse.verse_id);

      paragraph.verseLines.push({
        id: verse.verse_id,
        version_id: versionId,
        verse_id: verseIdNum, // Numeric verse entity ID
        paragraph_id: verse.paragraph_id,
        verse_number: verse.verse_number,
        show_verse_number: verse.show_verse_number || false,
        text: verse.text || "", // Ensure text is never null/undefined
        indent_level: verse.indent_level || 0,
        is_isolated: verse.is_isolated || false,
        line_order: verse.line_order || 0,
      });
    });

    // Sort sections and paragraphs
    Object.values(processedChapters).forEach(chapter => {
      chapter.sections.sort((a: any, b: any) => a.section.section_order - b.section.section_order);
      chapter.sections.forEach((section: any) => {
        section.paragraphs.sort((a: any, b: any) => a.paragraph.paragraph_order - b.paragraph.paragraph_order);
      });
    });

    return processedChapters;
  }, []);

  // Track if we're in the middle of a version change
  const isChangingVersionRef = useRef(false);

  // Reset and reload when version changes
  useEffect(() => {
    // PERFORMANCE: Skip version change processing when inactive
    if (!isActive) return;

    const newVersion = versionId || bibleSQLite.getCurrentVersion();
    if (newVersion !== currentVersion) {
      if (__DEV__) console.log(`[SimplifiedLoader] Version changed from ${currentVersion} to ${newVersion}, clearing cache`);

      // Mark that we're changing versions to prevent other loads
      isChangingVersionRef.current = true;

      // DON'T set global version - just use it for queries
      (async () => {
        // Clear global cache for old version
        if (currentVersion) {
          clearGlobalCacheForVersion(currentVersion);
        }

        // COMPLETELY clear all cached data - this is critical!
        setChapters({});
        loadingRef.current = new Set(); // Create new Set to break any references
        loadedRef.current = new Set(); // Create new Set to break any references
        setCurrentVersion(newVersion);
        setIsLoading(true);

        // Force immediate reload with new version
        if (initialChapterId && chapterList.length > 0) {
          if (__DEV__) console.log(`[SimplifiedLoader] Force reloading chapters with new version ${newVersion}`);

          // Calculate the same range as loadMoreChapters
          const centerIndex = chapterList.indexOf(initialChapterId);
          if (centerIndex !== -1) {
            const halfSize = Math.floor(loadSize / 2);
            const startIndex = Math.max(0, centerIndex - halfSize);
            const endIndex = Math.min(chapterList.length - 1, centerIndex + halfSize);

            const toLoad: number[] = [];
            for (let i = startIndex; i <= endIndex; i++) {
              toLoad.push(chapterList[i]);
            }

            try {
              // Mark as loading to prevent duplicate loads
              toLoad.forEach(id => loadingRef.current.add(id));

              const verses = await bibleSQLite.getBulkVersesForChapterIds(toLoad, newVersion);
              if (__DEV__) console.log(`[SimplifiedLoader] Loaded ${verses.length} verses for ${toLoad.length} chapters from ${newVersion}`);

              if (verses.length > 0) {
                const processedChapters = processVerses(verses, newVersion);

                // Store in global cache
                Object.entries(processedChapters).forEach(([chapterIdStr, chapterContent]) => {
                  const cacheKey = `${chapterIdStr}-${newVersion}`;
                  globalChapterCache.set(cacheKey, chapterContent);
                });

                // Force complete replacement of chapters state
                // Use a function to ensure we're not dependent on stale state
                setChapters(() => {
                  if (__DEV__) {
                    console.log(`[SimplifiedLoader] Setting new chapters for ${newVersion}`);
                    // Log sample text to verify it's the right version
                    const firstChapter = Object.values(processedChapters)[0] as any;
                    if (firstChapter?.sections?.[0]?.paragraphs?.[0]?.verseLines?.[0]) {
                      const sampleText = firstChapter.sections[0].paragraphs[0].verseLines[0].text;
                      console.log(`[SimplifiedLoader] Sample text from new chapters: "${sampleText?.substring(0, 50)}..."`);
                    }
                  }
                  return processedChapters;
                });

                // Mark these as loaded AFTER setting chapters
                toLoad.forEach(id => {
                  loadedRef.current.add(id);
                  loadingRef.current.delete(id);
                });

                if (__DEV__) console.log(`[SimplifiedLoader] Chapters state updated with ${Object.keys(processedChapters).length} chapters from ${newVersion}`);
              } else {
                console.warn(`[SimplifiedLoader] No verses found for version ${newVersion}, chapters: ${toLoad.join(',')}`);
              }

              setIsLoading(false);
            } catch (error) {
              console.error('[SimplifiedLoader] Error reloading after version change:', error);
              setIsLoading(false);
            } finally {
              // Clear the version changing flag
              setTimeout(() => {
                isChangingVersionRef.current = false;
              }, 100);
            }
          }
        } else {
          isChangingVersionRef.current = false;
        }
      })();
    }
  }, [versionId, currentVersion, initialChapterId, chapterList, loadSize, processVerses, isActive]);

  /**
   * Load the complete list of chapter IDs (using global cache)
   */
  useEffect(() => {
    // PERFORMANCE: Skip chapter list loading when inactive (will use cache when activated)
    if (!isActive) return;

    const loadChapterList = async () => {
      try {
        // Check global cache first
        if (globalChapterList) {
          if (__DEV__) console.log(`[GlobalCache] ✅ Using cached chapter list (${globalChapterList.length} chapters)`);
          setChapterList(globalChapterList);
          return;
        }

        // If another hook is already loading, wait for it
        if (globalChapterListPromise) {
          if (__DEV__) console.log(`[GlobalCache] ⏳ Waiting for in-progress chapter list load`);
          const ids = await globalChapterListPromise;
          setChapterList(ids);
          return;
        }

        // Load from SQLite and cache globally
        if (__DEV__) console.log(`[GlobalCache] 📥 Loading chapter list from SQLite (first time)`);
        globalChapterListPromise = (async () => {
          const allChapters = await bibleSQLite.getAllChaptersWithBooks();
          const ids = allChapters.map(c => c.id).filter(id => id % 1000 === 0);
          globalChapterList = ids;
          globalChapterListPromise = null;
          return ids;
        })();

        const ids = await globalChapterListPromise;
        setChapterList(ids);
        if (__DEV__) console.log(`[SimplifiedLoader] Loaded ${ids.length} chapter IDs`);
      } catch (error) {
        console.error('[SimplifiedLoader] Failed to load chapter list:', error);
        globalChapterListPromise = null;
      }
    };
    loadChapterList();
  }, [isActive]);

  // This function was moved up before the version change effect

  /**
   * Load chapters around a center point
   */
  const loadMoreChapters = useCallback(async (centerChapterId: number, forceReload: boolean = false) => {
    // PERFORMANCE: Don't load chapters when tab is inactive
    if (!isActive) {
      if (__DEV__) console.log(`[SimplifiedLoader] loadMoreChapters skipped - tab inactive`);
      return;
    }

    // Don't load if we're in the middle of changing versions
    if (isChangingVersionRef.current) {
      if (__DEV__) console.log(`[SimplifiedLoader] loadMoreChapters skipped - version change in progress`);
      return;
    }

    if (chapterList.length === 0) return;

    // Find center in list
    const centerIndex = chapterList.indexOf(centerChapterId);
    if (centerIndex === -1) {
      if (__DEV__) console.warn(`[SimplifiedLoader] Chapter ${centerChapterId} not found`);
      return;
    }

    // Calculate range to load
    let startIndex: number;
    let endIndex: number;

    if (startFromTarget) {
      // Forward-only loading: start FROM target, load forward
      startIndex = centerIndex;
      endIndex = Math.min(chapterList.length - 1, centerIndex + loadSize - 1);
    } else {
      // Centered loading: target is in the middle
      const halfSize = Math.floor(loadSize / 2);
      startIndex = Math.max(0, centerIndex - halfSize);
      endIndex = Math.min(chapterList.length - 1, centerIndex + halfSize);
    }

    const version = currentVersion || 'ESV';

    // Check global cache first, collect what needs loading
    const toLoad: number[] = [];
    const cachedChapters: ProcessedChapterData = {};
    let cacheHits = 0;

    for (let i = startIndex; i <= endIndex; i++) {
      const chapterId = chapterList[i];
      const cacheKey = `${chapterId}-${version}`;

      if (!forceReload && globalChapterCache.has(cacheKey)) {
        // Found in global cache - reuse it!
        cachedChapters[chapterId] = globalChapterCache.get(cacheKey)!;
        loadedRef.current.add(chapterId);
        cacheHits++;
      } else if (forceReload || (!loadedRef.current.has(chapterId) && !loadingRef.current.has(chapterId))) {
        toLoad.push(chapterId);
        loadingRef.current.add(chapterId);
      }
    }

    if (cacheHits > 0) {
      if (__DEV__) console.log(`[GlobalCache] ✅ Retrieved ${cacheHits} chapters from global cache for ${version}`);
    }

    // If we have cached chapters, update state immediately
    if (Object.keys(cachedChapters).length > 0) {
      setChapters(prev => ({
        ...prev,
        ...cachedChapters,
      }));
    }

    if (toLoad.length === 0) {
      setIsLoading(false);
      return;
    }

    if (__DEV__) console.log(`[SimplifiedLoader] Loading ${toLoad.length} new chapters around ${centerChapterId}`);

    try {
      // Load verses for chapters
      const verses = await bibleSQLite.getBulkVersesForChapterIds(toLoad, version);
      const newChapters = processVerses(verses, version);

      // Store in global cache
      Object.entries(newChapters).forEach(([chapterIdStr, chapterContent]) => {
        const cacheKey = `${chapterIdStr}-${version}`;
        globalChapterCache.set(cacheKey, chapterContent);
      });

      // Mark as loaded
      toLoad.forEach(id => {
        loadedRef.current.add(id);
        loadingRef.current.delete(id);
      });

      // Update state
      setChapters(prev => ({
        ...prev,
        ...newChapters,
      }));

      setIsLoading(false);
      if (__DEV__) console.log(`[SimplifiedLoader] Successfully loaded ${Object.keys(newChapters).length} chapters`);
    } catch (error) {
      console.error('[SimplifiedLoader] Failed to load chapters:', error);
      // Clear loading state on error
      toLoad.forEach(id => loadingRef.current.delete(id));
    }
  }, [chapterList, loadSize, processVerses, currentVersion, isActive, startFromTarget]);

  /**
   * Load previous chapters (for backward scrolling with maintainVisibleContentPosition)
   * Prepends chapters BEFORE the given chapter ID
   */
  const loadPreviousChapters = useCallback(async (beforeChapterId: number, count: number = 5) => {
    if (!isActive) return;
    if (isChangingVersionRef.current) return;
    if (chapterList.length === 0) return;

    const beforeIndex = chapterList.indexOf(beforeChapterId);
    if (beforeIndex <= 0) {
      if (__DEV__) console.log('[SimplifiedLoader] Already at start, no previous chapters');
      return;
    }

    const loadStartIndex = Math.max(0, beforeIndex - count);
    const version = currentVersion || 'ESV';

    // Collect chapters to load (excluding already loaded)
    const toLoad: number[] = [];
    const cachedChapters: ProcessedChapterData = {};
    let cacheHits = 0;

    for (let i = loadStartIndex; i < beforeIndex; i++) {
      const chapterId = chapterList[i];
      const cacheKey = `${chapterId}-${version}`;

      if (globalChapterCache.has(cacheKey)) {
        cachedChapters[chapterId] = globalChapterCache.get(cacheKey)!;
        loadedRef.current.add(chapterId);
        cacheHits++;
      } else if (!loadedRef.current.has(chapterId) && !loadingRef.current.has(chapterId)) {
        toLoad.push(chapterId);
        loadingRef.current.add(chapterId);
      }
    }

    if (cacheHits > 0) {
      if (__DEV__) console.log(`[SimplifiedLoader] loadPrevious: ${cacheHits} from cache`);
    }

    // Update state with cached chapters
    if (Object.keys(cachedChapters).length > 0) {
      setChapters(prev => ({
        ...cachedChapters,
        ...prev,
      }));
    }

    if (toLoad.length === 0) {
      return;
    }

    if (__DEV__) console.log(`[SimplifiedLoader] Loading ${toLoad.length} previous chapters before ${beforeChapterId}`);

    try {
      const verses = await bibleSQLite.getBulkVersesForChapterIds(toLoad, version);
      const newChapters = processVerses(verses, version);

      // Store in global cache
      Object.entries(newChapters).forEach(([chapterIdStr, chapterContent]) => {
        const cacheKey = `${chapterIdStr}-${version}`;
        globalChapterCache.set(cacheKey, chapterContent);
      });

      // Mark as loaded
      toLoad.forEach(id => {
        loadedRef.current.add(id);
        loadingRef.current.delete(id);
      });

      // PREPEND to state (new chapters come first)
      setChapters(prev => ({
        ...newChapters,
        ...prev,
      }));

      if (__DEV__) console.log(`[SimplifiedLoader] Successfully loaded ${Object.keys(newChapters).length} previous chapters`);
    } catch (error) {
      console.error('[SimplifiedLoader] Failed to load previous chapters:', error);
      toLoad.forEach(id => loadingRef.current.delete(id));
    }
  }, [chapterList, processVerses, currentVersion, isActive]);

  /**
   * Initial load and reload on version change
   */
  useEffect(() => {
    // PERFORMANCE: Skip initial load when tab is inactive
    if (!isActive) return;

    // Don't run this if we're in the middle of changing versions
    if (isChangingVersionRef.current) {
      if (__DEV__) console.log(`[SimplifiedLoader] Skipping regular load - version change in progress`);
      return;
    }

    if (chapterList.length > 0 && initialChapterId) {
      // Check if we need to reload due to version change
      if (needsReloadRef.current) {
        if (__DEV__) console.log(`[SimplifiedLoader] Executing reload for version ${currentVersion}`);
        needsReloadRef.current = false;
      }
      loadMoreChapters(initialChapterId);
    }
  }, [chapterList.length, initialChapterId, currentVersion, isActive, loadMoreChapters]); // Reload when version changes or tab becomes active

  return {
    chapters,
    isLoading,
    loadMoreChapters,
    loadPreviousChapters,
  };
}