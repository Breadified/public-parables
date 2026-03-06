/**
 * Bible Item Height Estimation Utilities
 * Shared height estimation for FlashList overrideItemLayout
 * Used by both SinglePaneBibleView and ChapterLevelBibleView
 */

import { type VerseLine } from '@/services/sqlite';

/**
 * Types for render items (shared between views)
 */
export type RenderItemType = 'chapter-header' | 'section-header' | 'paragraph' | 'merged-paragraph';

export interface ChapterHeaderItem {
  type: 'chapter-header';
  chapterId: number;
  title: string;
  key: string;
}

export interface SectionHeaderItem {
  type: 'section-header';
  title: string;
  subtitle?: string;
  key: string;
}

export interface ParagraphItem {
  type: 'paragraph';
  verseLines: VerseLine[];
  isPoetry: boolean;
  key: string;
}

export interface MergedParagraphItem {
  type: 'merged-paragraph';
  paragraphs: { verseLines: VerseLine[]; isPoetry: boolean }[];
  key: string;
}

export type RenderItem = ChapterHeaderItem | SectionHeaderItem | ParagraphItem | MergedParagraphItem;

/**
 * Estimate height for a chapter header item
 */
export function estimateChapterHeaderHeight(): number {
  return 80;
}

/**
 * Estimate height for a section header item
 */
export function estimateSectionHeaderHeight(hasSubtitle: boolean): number {
  return hasSubtitle ? 70 : 55;
}

/**
 * Estimate height for a paragraph item
 * Uses two-stage loading: returns cached height if available, otherwise estimates
 */
export function estimateParagraphHeight(
  verseLines: VerseLine[],
  isPoetry: boolean,
  fontSize: number,
  cachedHeight?: number
): number {
  // Two-stage loading: Use cached height if available (from native measurement)
  if (cachedHeight !== undefined) {
    return cachedHeight;
  }

  const lineCount = verseLines?.length || 1;

  if (isPoetry) {
    // Poetry: each verse line = one rendered line (short lines)
    const poetryLineHeight = fontSize * 1.6;
    return 8 + lineCount * poetryLineHeight;
  }

  // Prose: estimate based on character count
  // Use slightly HIGHER estimate to prevent clipping (will shrink after measurement)
  const totalChars = verseLines?.reduce((sum, line) => {
    return sum + (line.text?.length || 0) + 3;
  }, 0) || 100;

  // Use lower chars per line (35) for wider estimate on mobile
  const charsPerLine = 35;
  const estimatedLines = Math.ceil(totalChars / charsPerLine);

  // Add extra buffer (1.2x) to ensure text is visible on first render
  return Math.ceil((16 + estimatedLines * (fontSize * 1.5)) * 1.2);
}

/**
 * Estimate height for a merged paragraph item
 */
export function estimateMergedParagraphHeight(
  paragraphs: { verseLines: VerseLine[]; isPoetry: boolean }[],
  fontSize: number,
  cachedHeight?: number
): number {
  // Two-stage loading: Use cached height if available
  if (cachedHeight !== undefined) {
    return cachedHeight;
  }

  // Estimate based on total character count
  let mergedChars = 0;
  paragraphs?.forEach((para) => {
    para.verseLines?.forEach((line) => {
      mergedChars += (line.text?.length || 0) + 3;
    });
  });

  const mergedEstLines = Math.ceil(mergedChars / 35);
  return Math.ceil((24 + mergedEstLines * (fontSize * 1.5)) * 1.2);
}

/**
 * Main function to estimate any render item height
 * Used by FlashList's overrideItemLayout callback
 */
export function estimateItemHeight(
  item: RenderItem,
  fontSize: number,
  heightCache: Map<string, number>
): number {
  const cachedHeight = heightCache.get(item.key);

  switch (item.type) {
    case 'chapter-header':
      return estimateChapterHeaderHeight();

    case 'section-header':
      return estimateSectionHeaderHeight(!!item.subtitle);

    case 'paragraph':
      return estimateParagraphHeight(
        item.verseLines,
        item.isPoetry,
        fontSize,
        cachedHeight
      );

    case 'merged-paragraph':
      return estimateMergedParagraphHeight(
        item.paragraphs,
        fontSize,
        cachedHeight
      );

    default:
      return 150;
  }
}

/**
 * Create overrideItemLayout callback for FlashList
 * Wraps estimateItemHeight for direct FlashList usage
 */
export function createOverrideItemLayout(
  fontSize: number,
  heightCache: Map<string, number>
): (layout: { size: number }, item: RenderItem) => void {
  return (layout, item) => {
    layout.size = estimateItemHeight(item, fontSize, heightCache);
  };
}
