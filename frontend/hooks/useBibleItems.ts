/**
 * Shared Bible Items Hook
 * Converts ChapterContent to renderable items for FlashList
 * Used by both SinglePaneBibleView and ChapterLevelBibleView
 */

import { useCallback, useMemo } from 'react';
import { type ChapterContent, type VerseLine } from '@/services/sqlite';
import {
  type RenderItem,
  type ChapterHeaderItem,
  type SectionHeaderItem,
  type ParagraphItem,
  type MergedParagraphItem,
} from '@/components/Bible/bibleItemEstimation';

// Re-export types for consumers
export type { RenderItem, ChapterHeaderItem, SectionHeaderItem, ParagraphItem, MergedParagraphItem };

interface UseBibleItemsOptions {
  /** Chapters data from useSimplifiedBibleLoader */
  chapters: Record<number, ChapterContent>;
  /** Optional selected verse ID for highlighting (merges adjacent paragraphs with same verse) */
  selectedVerseId?: number | null;
}

interface UseBibleItemsResult {
  /** Rendered items for FlashList */
  items: RenderItem[];
  /** Converts a single chapter to items (for incremental updates) */
  convertChapterToItems: (content: ChapterContent) => RenderItem[];
}

/**
 * Merge consecutive paragraphs that share the same selected verse_id
 * This creates a unified highlight across paragraph boundaries
 */
function mergeParagraphsWithSameVerse(
  items: RenderItem[],
  selectedVerseId: number | null | undefined
): RenderItem[] {
  if (!selectedVerseId) return items;

  const merged: RenderItem[] = [];
  let i = 0;

  while (i < items.length) {
    const item = items[i];

    if (item.type !== 'paragraph') {
      merged.push(item);
      i++;
      continue;
    }

    const hasSelectedVerse = item.verseLines.some(
      (line) => line.verse_id === selectedVerseId
    );

    if (!hasSelectedVerse) {
      merged.push(item);
      i++;
      continue;
    }

    // Found a paragraph with the selected verse - check for more consecutive ones
    const paragraphGroup: { verseLines: VerseLine[]; isPoetry: boolean }[] = [
      { verseLines: item.verseLines, isPoetry: item.isPoetry },
    ];
    let j = i + 1;

    while (j < items.length && items[j].type === 'paragraph') {
      const nextPara = items[j] as ParagraphItem;
      const hasVerse = nextPara.verseLines.some(
        (line) => line.verse_id === selectedVerseId
      );

      if (hasVerse) {
        paragraphGroup.push({
          verseLines: nextPara.verseLines,
          isPoetry: nextPara.isPoetry,
        });
        j++;
      } else {
        break;
      }
    }

    if (paragraphGroup.length > 1) {
      // Merge into a single merged-paragraph item
      merged.push({
        type: 'merged-paragraph',
        paragraphs: paragraphGroup,
        key: `${item.key}-merged`,
      } as MergedParagraphItem);
      i = j;
    } else {
      merged.push(item);
      i++;
    }
  }

  return merged;
}

/**
 * Convert a single chapter's content to renderable items
 */
function convertChapterToItemsInternal(
  content: ChapterContent,
  selectedVerseId?: number | null
): RenderItem[] {
  const chapterItems: RenderItem[] = [];
  const chapterKey = `ch-${content.chapter.id}`;

  // Chapter header
  chapterItems.push({
    type: 'chapter-header',
    chapterId: content.chapter.id,
    title: `${content.chapter.book_name} ${content.chapter.chapter_number}`,
    key: chapterKey,
  } as ChapterHeaderItem);

  // Sections and paragraphs
  content.sections.forEach((section, sectionIdx) => {
    // Section header (if has title or subtitle)
    if (section.section.title || section.section.subtitle) {
      chapterItems.push({
        type: 'section-header',
        title: section.section.title || '',
        subtitle: section.section.subtitle,
        key: `${chapterKey}-sec-${sectionIdx}`,
      } as SectionHeaderItem);
    }

    // Paragraphs
    section.paragraphs.forEach((paragraph) => {
      const validVerseLines: VerseLine[] = paragraph.verseLines
        .filter((vl: VerseLine) => vl && typeof vl === 'object')
        .map(
          (vl: VerseLine): VerseLine => ({
            id: vl.id,
            version_id: vl.version_id,
            verse_id: vl.verse_id,
            paragraph_id: vl.paragraph_id,
            verse_number: vl.verse_number || null,
            show_verse_number: vl.show_verse_number || false,
            text: String(vl.text || ''),
            indent_level: vl.indent_level || 0,
            is_isolated: vl.is_isolated || false,
            line_order: vl.line_order || 0,
          })
        );

      if (validVerseLines.length === 0) {
        return;
      }

      const isPoetry = validVerseLines.some((vl) => vl.indent_level > 0);
      chapterItems.push({
        type: 'paragraph',
        verseLines: validVerseLines,
        isPoetry,
        key: `${chapterKey}-para-${paragraph.paragraph.id}`,
      } as ParagraphItem);
    });
  });

  // Apply verse merging if a verse is selected
  return mergeParagraphsWithSameVerse(chapterItems, selectedVerseId);
}

/**
 * Hook to convert chapters to renderable items
 * Memoizes the conversion for performance
 */
export function useBibleItems({
  chapters,
  selectedVerseId,
}: UseBibleItemsOptions): UseBibleItemsResult {
  // Memoized converter for a single chapter
  const convertChapterToItems = useCallback(
    (content: ChapterContent): RenderItem[] => {
      return convertChapterToItemsInternal(content, selectedVerseId);
    },
    [selectedVerseId]
  );

  // Convert all chapters to items
  const items = useMemo(() => {
    if (!chapters || Object.keys(chapters).length === 0) {
      return [];
    }

    const sortedIds = Object.keys(chapters)
      .map(Number)
      .sort((a, b) => a - b);

    const allItems: RenderItem[] = [];
    sortedIds.forEach((id) => {
      if (chapters[id]) {
        allItems.push(...convertChapterToItems(chapters[id]));
      }
    });

    return allItems;
  }, [chapters, convertChapterToItems]);

  return {
    items,
    convertChapterToItems,
  };
}

/**
 * Standalone function to convert chapters to items (for non-hook contexts)
 */
export function convertChaptersToItems(
  chapters: Record<number, ChapterContent>,
  selectedVerseId?: number | null
): RenderItem[] {
  if (!chapters || Object.keys(chapters).length === 0) {
    return [];
  }

  const sortedIds = Object.keys(chapters)
    .map(Number)
    .sort((a, b) => a - b);

  const allItems: RenderItem[] = [];
  sortedIds.forEach((id) => {
    if (chapters[id]) {
      allItems.push(...convertChapterToItemsInternal(chapters[id], selectedVerseId));
    }
  });

  return allItems;
}
