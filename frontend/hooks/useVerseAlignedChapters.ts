/**
 * Hook for verse-aligned split view (SIMPLE & PERFORMANT)
 * Every verse becomes its own paragraph for perfect 1:1 alignment
 * No complex calculations or height measurements needed
 */

import { useState, useEffect, useRef } from 'react';
import { InteractionManager } from 'react-native';
import { useSelector } from '@legendapp/state/react';
import { studyModeStore$ } from '@/state/studyModeStore';
import { AlignmentMode } from '@/config/studyModeConfig';
import { useSimplifiedBibleLoader, type ProcessedChapterData } from './useSimplifiedBibleLoader';
import { type VerseLine, type ChapterContent } from '@/services/sqlite';
import { getMinMaxVerseIds } from '@/modules/bible/verseCalculations';

interface AlignedParagraph {
  verseLines: VerseLine[];
  isPoetry: boolean;
  topPadding: number; // Always 0 for verse-aligned (no padding needed)
  minVerseId: number;
  maxVerseId: number;
}

interface AlignedSection {
  leftTitle?: string;
  leftSubtitle?: string;
  rightTitle?: string;
  rightSubtitle?: string;
  leftParagraphs: AlignedParagraph[];
  rightParagraphs: AlignedParagraph[];
}

interface ChapterData {
  chapterId: number;
  bookName: string;
  chapterNumber: number;
  sections: AlignedSection[];
}

interface UseVerseAlignedChaptersProps {
  initialChapterId: number;
  leftVersionId: string;
  rightVersionId: string;
}

/**
 * Converts chapter content to verse-aligned structure
 * Each verse becomes its own paragraph for guaranteed 1:1 alignment
 */
const convertToVerseAligned = (
  leftContent: ChapterContent,
  rightContent: ChapterContent
): AlignedSection[] => {
  // Collect all verse IDs from both versions
  const allVerseIds = new Set<number>();

  // Helper to collect verse IDs from chapter content
  const collectVerseIds = (content: ChapterContent) => {
    content.sections.forEach(section => {
      section.paragraphs.forEach(para => {
        para.verseLines.forEach(line => {
          if (line.verse_id) {
            allVerseIds.add(line.verse_id);
          }
        });
      });
    });
  };

  collectVerseIds(leftContent);
  collectVerseIds(rightContent);

  // Sort verse IDs for consistent ordering
  const sortedVerseIds = Array.from(allVerseIds).sort((a, b) => a - b);

  // Create verse lookup maps for both versions
  const createVerseLookup = (content: ChapterContent): Map<number, VerseLine[]> => {
    const lookup = new Map<number, VerseLine[]>();

    // PERF FIX: Use push instead of spread to avoid O(n²) array recreation
    content.sections.forEach(section => {
      section.paragraphs.forEach(para => {
        para.verseLines.forEach(line => {
          if (line.verse_id) {
            let existing = lookup.get(line.verse_id);
            if (!existing) {
              existing = [];
              lookup.set(line.verse_id, existing);
            }
            existing.push(line);
          }
        });
      });
    });

    return lookup;
  };

  const leftVerseLookup = createVerseLookup(leftContent);
  const rightVerseLookup = createVerseLookup(rightContent);

  // Create one paragraph per verse
  const leftParagraphs: AlignedParagraph[] = [];
  const rightParagraphs: AlignedParagraph[] = [];

  sortedVerseIds.forEach(verseId => {
    const leftLines = leftVerseLookup.get(verseId) || [];
    const rightLines = rightVerseLookup.get(verseId) || [];

    // Determine if verse is poetry (check any line's indent level or poetry flag)
    const leftIsPoetry = leftLines.some(line => (line.indent_level || 0) > 0);
    const rightIsPoetry = rightLines.some(line => (line.indent_level || 0) > 0);

    // Create left paragraph (or empty placeholder if verse doesn't exist in left version)
    leftParagraphs.push({
      verseLines: leftLines,
      isPoetry: leftIsPoetry,
      topPadding: 0, // No padding needed - verse-aligned guarantees 1:1
      minVerseId: verseId,
      maxVerseId: verseId,
    });

    // Create right paragraph (or empty placeholder if verse doesn't exist in right version)
    rightParagraphs.push({
      verseLines: rightLines,
      isPoetry: rightIsPoetry,
      topPadding: 0, // No padding needed - verse-aligned guarantees 1:1
      minVerseId: verseId,
      maxVerseId: verseId,
    });
  });

  // Get section titles (use first section from each version)
  const leftSection = leftContent.sections[0];
  const rightSection = rightContent.sections[0];

  // Return single section containing all verse-aligned paragraphs
  return [{
    leftTitle: leftSection?.section.title,
    leftSubtitle: leftSection?.section.subtitle,
    rightTitle: rightSection?.section.title,
    rightSubtitle: rightSection?.section.subtitle,
    leftParagraphs,
    rightParagraphs,
  }];
};

/**
 * Per-chapter conversion cache shared across all hook instances
 * Key format: `${chapterId}-${leftVersionId}-${rightVersionId}`
 * PERFORMANCE FIX: Per-chapter cache (not batch) enables cache hits when scrolling
 */
const perChapterConversionCache = new Map<string, AlignedSection[]>();

export function useVerseAlignedChapters({
  initialChapterId,
  leftVersionId,
  rightVersionId,
}: UseVerseAlignedChaptersProps) {
  const [chaptersData, setChaptersData] = useState<ChapterData[]>([]);
  const [isLoading, setIsLoading] = useState(true); // Start as loading to prevent premature render

  // Check if this hook should be active
  const alignmentMode = useSelector(studyModeStore$.alignmentMode);
  const isActive = alignmentMode === AlignmentMode.VERSE_ALIGNED;

  // Load data for left version
  // PERFORMANCE: Pass isActive to skip loading when not in verse-aligned mode
  // PERFORMANCE: loadSize: 10 to prevent loading 93+ chapters
  // startFromTarget: true ensures target chapter is at index 0 (no scrolling needed)
  const {
    chapters: leftChapters,
    isLoading: leftLoading,
    loadMoreChapters: leftLoadMore,
    loadPreviousChapters: leftLoadPrev,
  } = useSimplifiedBibleLoader({
    initialChapterId,
    versionId: leftVersionId,
    isActive, // Skip loading when not in verse-aligned mode
    loadSize: 10, // Only load 10 chapters at a time (not default 30)
    startFromTarget: true, // Load FROM target forward (target at index 0)
  });

  // Load data for right version
  // PERFORMANCE: Pass isActive to skip loading when not in verse-aligned mode
  // PERFORMANCE: loadSize: 10 to prevent loading 93+ chapters
  // startFromTarget: true ensures target chapter is at index 0 (no scrolling needed)
  const {
    chapters: rightChapters,
    isLoading: rightLoading,
    loadMoreChapters: rightLoadMore,
    loadPreviousChapters: rightLoadPrev,
  } = useSimplifiedBibleLoader({
    initialChapterId,
    versionId: rightVersionId,
    isActive, // Skip loading when not in verse-aligned mode
    loadSize: 10, // Only load 10 chapters at a time (not default 30)
    startFromTarget: true, // Load FROM target forward (target at index 0)
  });

  // Convert chapter data to verse-aligned structure using InteractionManager for non-blocking
  // PERFORMANCE FIX: Use per-chapter cache to skip already-converted chapters
  useEffect(() => {
    // Skip if not active mode
    if (!isActive) {
      setChaptersData([]);
      setIsLoading(false);
      return;
    }

    if (leftLoading || rightLoading) {
      setIsLoading(true);
      return;
    }

    // Get chapter IDs that exist in BOTH versions (intersection, not union)
    // This prevents warnings about missing chapters during async loading
    const leftChapterIds = Object.keys(leftChapters).map(Number);
    const rightChapterIds = Object.keys(rightChapters).map(Number);
    const rightChapterSet = new Set(rightChapterIds);

    // Only include chapters that both versions have loaded
    const commonChapterIds = leftChapterIds.filter(id => rightChapterSet.has(id));
    const sortedChapterIds = commonChapterIds.sort((a, b) => a - b);

    // Use InteractionManager to defer work until after animations/interactions
    const task = InteractionManager.runAfterInteractions(() => {
      const combined: ChapterData[] = [];
      let convertedCount = 0;
      let cachedCount = 0;

      sortedChapterIds.forEach(chapterId => {
        const leftChapter = leftChapters[chapterId];
        const rightChapter = rightChapters[chapterId];

        // Both chapters must exist for alignment
        if (!leftChapter || !rightChapter) {
          if (__DEV__) console.warn(`[VerseAligned] Missing chapter ${chapterId} in one version`);
          return;
        }

        // PERFORMANCE FIX: Per-chapter cache key
        const chapterCacheKey = `${chapterId}-${leftVersionId}-${rightVersionId}`;

        // Check per-chapter cache FIRST - skip conversion if cached
        if (perChapterConversionCache.has(chapterCacheKey)) {
          combined.push({
            chapterId,
            bookName: leftChapter.chapter.book_name || 'Unknown',
            chapterNumber: leftChapter.chapter.chapter_number,
            sections: perChapterConversionCache.get(chapterCacheKey)!,
          });
          cachedCount++;
          return; // Skip expensive conversion!
        }

        // Only convert if not cached
        const sections = convertToVerseAligned(leftChapter, rightChapter);
        perChapterConversionCache.set(chapterCacheKey, sections);

        combined.push({
          chapterId,
          bookName: leftChapter.chapter.book_name || 'Unknown',
          chapterNumber: leftChapter.chapter.chapter_number,
          sections,
        });
        convertedCount++;
      });

      if (__DEV__) {
        console.log(`[VerseAligned] ✅ ${convertedCount} converted, ${cachedCount} from cache (${combined.length} total)`);
      }

      setChaptersData(combined);
      setIsLoading(false);
    });

    return () => task.cancel();
  }, [leftChapters, rightChapters, leftLoading, rightLoading, isActive, leftVersionId, rightVersionId]);

  // Load more chapters when needed (forward direction)
  const loadMoreChapters = (chapterId: number) => {
    leftLoadMore(chapterId);
    rightLoadMore(chapterId);
  };

  // Load previous chapters when needed (backward direction for maintainVisibleContentPosition)
  const loadPreviousChapters = (chapterId: number, count?: number) => {
    leftLoadPrev(chapterId, count);
    rightLoadPrev(chapterId, count);
  };

  return {
    chaptersData,
    isLoading,
    loadMoreChapters,
    loadPreviousChapters,
  };
}
