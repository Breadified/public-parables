/**
 * Marker Parser - Bible Peek Feature
 * Parses note content with embedded Bible Peek/Verse Reference markers
 * Converts between string format (with markers) and block array format
 */

import { parseReference } from './referenceParser';

export type NoteBlockType = 'text' | 'biblePeek' | 'verseRef';

export interface BaseNoteBlock {
  id: string;
  type: NoteBlockType;
}

export interface TextBlock extends BaseNoteBlock {
  type: 'text';
  content: string;
}

export interface BiblePeekBlock extends BaseNoteBlock {
  type: 'biblePeek';
  reference: string; // e.g., "John 3:16-17"
  bookNumber: number;
  chapter: number;
  verseStart?: number;
  verseEnd?: number;
}

export interface VerseRefBlock extends BaseNoteBlock {
  type: 'verseRef';
  verseNumber: number;
  chapterId?: number; // Will be populated from note's chapter_id
}

export type NoteBlock = TextBlock | BiblePeekBlock | VerseRefBlock;

/**
 * Marker patterns for detection
 * Format: [[biblePeek:John3:16-17]] or [[verseRef:7]]
 */
const MARKER_PATTERNS = {
  biblePeek: /\[\[biblePeek:([^\]]+)\]\]/g,
  verseRef: /\[\[verseRef:(\d+)\]\]/g,
  anyMarker: /\[\[(biblePeek|verseRef):([^\]]+)\]\]/g,
};

/**
 * Generate unique ID for blocks
 */
function generateBlockId(): string {
  return `block_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Parse note content string into array of blocks
 * Splits text on markers and creates appropriate block types
 */
export function parseNoteContent(
  content: string,
  noteChapterId?: number
): NoteBlock[] {
  if (!content) {
    return [
      {
        id: generateBlockId(),
        type: 'text',
        content: '',
      },
    ];
  }

  const blocks: NoteBlock[] = [];
  let lastIndex = 0;

  // Find all markers in content
  const markerMatches: Array<{
    type: 'biblePeek' | 'verseRef';
    data: string;
    index: number;
    fullMatch: string;
  }> = [];

  // Find Bible Peek markers
  let match;
  const biblePeekRegex = new RegExp(MARKER_PATTERNS.biblePeek);
  while ((match = biblePeekRegex.exec(content)) !== null) {
    markerMatches.push({
      type: 'biblePeek',
      data: match[1],
      index: match.index,
      fullMatch: match[0],
    });
  }

  // Find Verse Ref markers
  const verseRefRegex = new RegExp(MARKER_PATTERNS.verseRef);
  while ((match = verseRefRegex.exec(content)) !== null) {
    markerMatches.push({
      type: 'verseRef',
      data: match[1],
      index: match.index,
      fullMatch: match[0],
    });
  }

  // Sort markers by position in text
  markerMatches.sort((a, b) => a.index - b.index);

  // Process each marker
  markerMatches.forEach(marker => {
    // Add text block before this marker (if any)
    if (marker.index > lastIndex) {
      const textContent = content.slice(lastIndex, marker.index);
      if (textContent) {
        blocks.push({
          id: generateBlockId(),
          type: 'text',
          content: textContent,
        });
      }
    }

    // Add marker block
    if (marker.type === 'biblePeek') {
      const parsedRef = parseReference(marker.data);
      if (parsedRef.isValid && parsedRef.chapter !== undefined) {
        blocks.push({
          id: generateBlockId(),
          type: 'biblePeek',
          reference: marker.data,
          bookNumber: parsedRef.bookNumber,
          chapter: parsedRef.chapter,
          verseStart: parsedRef.verseStart,
          verseEnd: parsedRef.verseEnd,
        });
      } else {
        // Invalid reference - keep as text
        blocks.push({
          id: generateBlockId(),
          type: 'text',
          content: marker.fullMatch,
        });
      }
    } else if (marker.type === 'verseRef') {
      const verseNumber = parseInt(marker.data, 10);
      if (!isNaN(verseNumber) && verseNumber > 0) {
        blocks.push({
          id: generateBlockId(),
          type: 'verseRef',
          verseNumber,
          chapterId: noteChapterId,
        });
      } else {
        // Invalid verse number - keep as text
        blocks.push({
          id: generateBlockId(),
          type: 'text',
          content: marker.fullMatch,
        });
      }
    }

    lastIndex = marker.index + marker.fullMatch.length;
  });

  // Add remaining text after last marker
  if (lastIndex < content.length) {
    const textContent = content.slice(lastIndex);
    if (textContent) {
      blocks.push({
        id: generateBlockId(),
        type: 'text',
        content: textContent,
      });
    }
  }

  // Ensure we always have at least one text block
  if (blocks.length === 0) {
    blocks.push({
      id: generateBlockId(),
      type: 'text',
      content: '',
    });
  }

  return blocks;
}

/**
 * Serialize blocks back to string with markers
 */
export function serializeBlocks(blocks: NoteBlock[]): string {
  return blocks
    .map(block => {
      switch (block.type) {
        case 'text':
          return block.content;

        case 'biblePeek':
          return `[[biblePeek:${block.reference}]]`;

        case 'verseRef':
          return `[[verseRef:${block.verseNumber}]]`;

        default:
          return '';
      }
    })
    .join('');
}

/**
 * Insert a marker at a specific position in content
 * Handles line isolation rule: if not at line start, insert linebreak
 */
export function insertMarkerAtPosition(
  content: string,
  marker: string,
  startPos: number,
  endPos: number,
  ensureLineBreak: boolean = true
): string {
  // Check if we're at the start of a line
  const isAtLineStart = startPos === 0 || content[startPos - 1] === '\n';

  let result = content.slice(0, startPos);

  // Add linebreak if not at line start and isolation is required
  if (ensureLineBreak && !isAtLineStart) {
    result += '\n';
  }

  // Add the marker
  result += marker;

  // Add linebreak after marker to continue typing
  result += '\n';

  // Add remaining content after the replaced text
  result += content.slice(endPos);

  return result;
}

/**
 * Insert a marker with context-aware behavior
 * - If pattern is at line start: REPLACE the pattern with marker
 * - If pattern is mid-line: KEEP the pattern, INSERT marker on next line
 * Returns both the new content and cursor position after the marker
 */
export function insertMarkerWithContext(
  content: string,
  marker: string,
  patternStart: number,
  patternEnd: number,
): { content: string; cursorPosition: number } {
  // Check if pattern is at the start of a line
  const isAtLineStart = patternStart === 0 || content[patternStart - 1] === '\n';

  let result: string;
  let cursorPosition: number;

  if (isAtLineStart) {
    // REPLACE: Pattern is at line start, replace it with marker
    result = content.slice(0, patternStart) + marker + '\n' + content.slice(patternEnd);
    cursorPosition = patternStart + marker.length + 1; // After marker + newline
  } else {
    // INSERT: Pattern is mid-line, keep text and add marker on next line
    // Keep everything up to and including the pattern
    result = content.slice(0, patternEnd) + '\n' + marker + '\n' + content.slice(patternEnd);
    cursorPosition = patternEnd + 1 + marker.length + 1; // After pattern + newline + marker + newline
  }

  return { content: result, cursorPosition };
}

/**
 * Remove a marker at specific position
 * Returns the new content string
 */
export function removeMarkerAtPosition(
  content: string,
  markerStartIndex: number,
  markerEndIndex: number
): string {
  // Remove the marker and any surrounding linebreaks that were added for isolation
  let startIdx = markerStartIndex;
  let endIdx = markerEndIndex;

  // Remove linebreak before if it was added for isolation
  if (startIdx > 0 && content[startIdx - 1] === '\n') {
    // Check if there's content before this linebreak
    const beforeLinebreak = content.slice(0, startIdx - 1);
    const lastLineStart = beforeLinebreak.lastIndexOf('\n') + 1;
    const lineContent = beforeLinebreak.slice(lastLineStart).trim();

    // If there's content on the line before, remove the linebreak
    if (lineContent.length > 0) {
      startIdx--;
    }
  }

  // Remove linebreak after marker
  if (endIdx < content.length && content[endIdx] === '\n') {
    endIdx++;
  }

  return content.slice(0, startIdx) + content.slice(endIdx);
}

/**
 * Create Bible Peek marker string
 */
export function createBiblePeekMarker(reference: string): string {
  return `[[biblePeek:${reference}]]`;
}

/**
 * Create Verse Reference marker string
 */
export function createVerseRefMarker(verseNumber: number): string {
  return `[[verseRef:${verseNumber}]]`;
}

/**
 * Check if content contains any markers
 */
export function hasMarkers(content: string): boolean {
  return MARKER_PATTERNS.anyMarker.test(content);
}

/**
 * Extract all markers from content
 * Useful for validation or migration
 */
export function extractMarkers(content: string): Array<{
  type: 'biblePeek' | 'verseRef';
  data: string;
  index: number;
  fullMatch: string;
}> {
  const markers: Array<{
    type: 'biblePeek' | 'verseRef';
    data: string;
    index: number;
    fullMatch: string;
  }> = [];

  // Find Bible Peek markers
  let match;
  const biblePeekRegex = new RegExp(MARKER_PATTERNS.biblePeek);
  while ((match = biblePeekRegex.exec(content)) !== null) {
    markers.push({
      type: 'biblePeek',
      data: match[1],
      index: match.index,
      fullMatch: match[0],
    });
  }

  // Find Verse Ref markers
  const verseRefRegex = new RegExp(MARKER_PATTERNS.verseRef);
  while ((match = verseRefRegex.exec(content)) !== null) {
    markers.push({
      type: 'verseRef',
      data: match[1],
      index: match.index,
      fullMatch: match[0],
    });
  }

  return markers.sort((a, b) => a.index - b.index);
}

/**
 * Validate marker syntax
 */
export function isValidMarker(marker: string): {
  isValid: boolean;
  type?: 'biblePeek' | 'verseRef';
  data?: string;
} {
  const biblePeekMatch = marker.match(/^\[\[biblePeek:([^\]]+)\]\]$/);
  if (biblePeekMatch) {
    return {
      isValid: true,
      type: 'biblePeek',
      data: biblePeekMatch[1],
    };
  }

  const verseRefMatch = marker.match(/^\[\[verseRef:(\d+)\]\]$/);
  if (verseRefMatch) {
    return {
      isValid: true,
      type: 'verseRef',
      data: verseRefMatch[1],
    };
  }

  return { isValid: false };
}
