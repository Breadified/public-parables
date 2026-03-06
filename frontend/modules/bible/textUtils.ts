/**
 * Text Utilities for Bible Rendering
 *
 * Consolidated utilities for text transformation and verse selection mapping.
 * These were previously duplicated across multiple files.
 */

/**
 * Unicode superscript digit mapping for verse numbers
 */
export const SUPERSCRIPT_DIGITS: Record<string, string> = {
  '0': '\u2070',
  '1': '\u00B9',
  '2': '\u00B2',
  '3': '\u00B3',
  '4': '\u2074',
  '5': '\u2075',
  '6': '\u2076',
  '7': '\u2077',
  '8': '\u2078',
  '9': '\u2079',
};

/**
 * Convert a number to its Unicode superscript representation
 * Used for verse numbers in Bible text rendering
 *
 * @param num - Number to convert (accepts string or number)
 * @returns Unicode superscript string
 *
 * @example
 * toSuperscript(123) // '¹²³'
 * toSuperscript('45') // '⁴⁵'
 */
export function toSuperscript(num: string | number): string {
  return String(num)
    .split('')
    .map((c) => SUPERSCRIPT_DIGITS[c] || c)
    .join('');
}

/**
 * Verse boundary information for selection mapping
 */
export interface VerseBoundary {
  verseId: number;
  start: number;
  end: number;
}

/**
 * Find all verse IDs that overlap with a text selection range
 * Used to map native text selection positions back to verse IDs
 *
 * @param verseBoundaries - Array of verse boundaries with start/end positions
 * @param selectionStart - Start index of text selection
 * @param selectionEnd - End index of text selection
 * @returns Array of verse IDs that overlap with the selection
 *
 * @example
 * const boundaries = [
 *   { verseId: 1001001, start: 0, end: 50 },
 *   { verseId: 1001002, start: 51, end: 100 }
 * ];
 * findVersesInSelection(boundaries, 40, 60) // [1001001, 1001002]
 */
export function findVersesInSelection(
  verseBoundaries: VerseBoundary[],
  selectionStart: number,
  selectionEnd: number
): number[] {
  const verseIds: number[] = [];
  for (const boundary of verseBoundaries) {
    // Check if this verse overlaps with the selection
    const overlaps = boundary.start < selectionEnd && boundary.end > selectionStart;
    if (overlaps) {
      verseIds.push(boundary.verseId);
    }
  }
  return verseIds;
}
