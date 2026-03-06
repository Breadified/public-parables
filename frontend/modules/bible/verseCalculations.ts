/**
 * Verse Calculation Utilities
 *
 * Centralized utilities for verse ID parsing, chapter ID extraction,
 * and verse position calculations. Used across diff viewer components
 * to eliminate code duplication and ensure consistency.
 */

import { type VerseLine } from '@/services/sqlite';

/**
 * Verse ID Format: BBCCCVVV
 * - BB: Book ID (2 digits)
 * - CCC: Chapter number (3 digits)
 * - VVV: Verse number (3 digits)
 *
 * Example: 43003016 = John (43) Chapter 3 Verse 16
 */

/**
 * Extract chapter ID from verse ID
 * Chapter ID format: BBCCC000 (verse portion set to 000)
 *
 * @param verseId - Full verse ID (BBCCCVVV)
 * @returns Chapter ID (BBCCC000)
 */
export function getChapterIdFromVerseId(verseId: number | null | undefined): number | null {
  if (!verseId) return null;
  // Truncate to chapter level: divide by 1000, floor, multiply by 1000
  return Math.floor(verseId / 1000) * 1000;
}

/**
 * Parse verse ID into components
 *
 * @param verseId - Full verse ID (BBCCCVVV)
 * @returns Object with bookId, chapterNum, verseNum
 */
export function parseVerseId(verseId: number): {
  bookId: number;
  chapterNum: number;
  verseNum: number;
} {
  const bookId = Math.floor(verseId / 1000000);
  const chapterNum = Math.floor((verseId % 1000000) / 1000);
  const verseNum = verseId % 1000;

  return { bookId, chapterNum, verseNum };
}

/**
 * Get min and max verse IDs from an array of verse lines
 * Optimized single-pass algorithm
 *
 * @param verseLines - Array of verse lines
 * @returns Object with minVerseId and maxVerseId (0 if array is empty)
 */
export function getMinMaxVerseIds(verseLines: VerseLine[]): {
  minVerseId: number;
  maxVerseId: number;
} {
  if (verseLines.length === 0) {
    return { minVerseId: 0, maxVerseId: 0 };
  }

  let minId = verseLines[0].verse_id;
  let maxId = verseLines[0].verse_id;

  for (let i = 1; i < verseLines.length; i++) {
    const id = verseLines[i].verse_id;
    if (id !== undefined) {
      if (id < minId) minId = id;
      if (id > maxId) maxId = id;
    }
  }

  return { minVerseId: minId || 0, maxVerseId: maxId || 0 };
}

/**
 * Calculate proportional verse offset for prose paragraphs
 * Since we can't measure individual verses in flowing text,
 * we estimate position based on line count
 *
 * @param verseLines - Array of verse lines in paragraph
 * @param targetVerseId - Verse ID to find position for
 * @param totalHeight - Total rendered height of paragraph
 * @returns Estimated Y offset of verse from top of paragraph
 */
export function calculateProportionalVerseOffset(
  verseLines: VerseLine[],
  targetVerseId: number,
  totalHeight: number
): number {
  if (verseLines.length === 0) return 0;

  // Find first line with verse_id >= targetVerseId
  const targetIndex = verseLines.findIndex(vl => vl.verse_id >= targetVerseId);

  if (targetIndex === -1) return totalHeight; // Verse not found, use end of paragraph
  if (targetIndex === 0) return 0; // First verse, use start of paragraph

  // Calculate proportional offset based on line position
  // This assumes roughly equal height per line (not perfect, but reasonable)
  return (targetIndex / verseLines.length) * totalHeight;
}

/**
 * Interface for verse position measurements within a paragraph
 */
export interface VersePosition {
  verseId: number;
  offsetY: number;  // Y offset from top of paragraph
  height: number;   // Height of this verse line
}

/**
 * Interface for paragraph measurements with verse positions
 */
export interface ParagraphMeasurement {
  totalHeight: number;
  versePositions: VersePosition[];  // Ordered list of verse positions within paragraph
  isPoetry: boolean;
}

/**
 * Get the Y offset of a specific verse within a paragraph
 * Uses measured positions for poetry, proportional calculation for prose
 *
 * @param verseLines - Array of verse lines in paragraph
 * @param targetVerseId - Verse ID to find position for
 * @param paragraphHeight - Total rendered height of paragraph
 * @param verseMeasurement - Optional measurement data for poetry paragraphs
 * @returns Y offset of verse from top of paragraph
 */
export function getVerseOffsetInParagraph(
  verseLines: VerseLine[],
  targetVerseId: number,
  paragraphHeight: number,
  isPoetry: boolean,
  verseMeasurement?: ParagraphMeasurement
): number {
  // For poetry with measurements, use actual measured positions
  if (verseMeasurement && verseMeasurement.isPoetry && verseMeasurement.versePositions.length > 0) {
    // Find the verse position closest to or at the target verse
    const versePos = verseMeasurement.versePositions.find(vp => vp.verseId >= targetVerseId);
    if (versePos) {
      return versePos.offsetY;
    }
    // If target verse is after all measured verses, return end of paragraph
    return paragraphHeight;
  }

  // For prose or when measurements aren't available, use proportional calculation
  return calculateProportionalVerseOffset(verseLines, targetVerseId, paragraphHeight);
}

/**
 * Check if two verse ranges overlap
 *
 * @param range1 - First verse range { minVerseId, maxVerseId }
 * @param range2 - Second verse range { minVerseId, maxVerseId }
 * @returns True if ranges overlap, false otherwise
 */
export function doVerseRangesOverlap(
  range1: { minVerseId: number; maxVerseId: number },
  range2: { minVerseId: number; maxVerseId: number }
): boolean {
  return !(
    range1.maxVerseId < range2.minVerseId ||
    range2.maxVerseId < range1.minVerseId
  );
}

/**
 * Get the starting verse ID of an overlap between two ranges
 * Returns the maximum of the two minVerseIds
 *
 * @param range1 - First verse range { minVerseId, maxVerseId }
 * @param range2 - Second verse range { minVerseId, maxVerseId }
 * @returns Starting verse ID of overlap, or null if no overlap
 */
export function getOverlapStartVerseId(
  range1: { minVerseId: number; maxVerseId: number },
  range2: { minVerseId: number; maxVerseId: number }
): number | null {
  if (!doVerseRangesOverlap(range1, range2)) {
    return null;
  }
  return Math.max(range1.minVerseId, range2.minVerseId);
}
