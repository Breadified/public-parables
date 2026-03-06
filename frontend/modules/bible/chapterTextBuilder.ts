/**
 * Chapter Text Builder
 *
 * Transforms chapter sections into plain text with verse boundaries.
 * The native module receives pre-formatted text, while JS handles
 * verse-to-selection mapping.
 */

import { toSuperscript } from './textUtils';

/**
 * Verse line input for text building
 */
interface VerseLineInput {
  verse_id: number;
  verse_number?: number;
  text: string;
  indent_level?: number;
}

/**
 * Paragraph input for text building
 */
interface ParagraphInput {
  isPoetry: boolean;
  verseLines: VerseLineInput[];
}

/**
 * Section input for text building
 */
interface SectionInput {
  title?: string;
  subtitle?: string;
  paragraphs: ParagraphInput[];
}

/**
 * Verse boundary tracking for selection-to-verse mapping
 */
export interface VerseBoundary {
  verseId: number;
  startIndex: number;
  endIndex: number;
}

/**
 * Result of building chapter text
 */
export interface ChapterTextResult {
  /** Pre-formatted plain text for native view */
  plainText: string;
  /** Verse boundaries for mapping selection to verse IDs */
  verseBoundaries: VerseBoundary[];
}

/**
 * Build plain text and verse boundaries from chapter sections
 *
 * @param chapterTitle - Chapter title (e.g., "Genesis 1")
 * @param sections - Array of sections containing paragraphs and verse lines
 * @returns Plain text and verse boundary mappings
 */
export function buildChapterText(
  chapterTitle: string,
  sections: SectionInput[]
): ChapterTextResult {
  const parts: string[] = [];
  const verseBoundaries: VerseBoundary[] = [];
  let currentPos = 0;

  // Chapter title
  parts.push(chapterTitle);
  parts.push('\n\n');
  currentPos += chapterTitle.length + 2;

  for (const section of sections) {
    // Section header
    if (section.title) {
      parts.push(section.title);
      parts.push('\n');
      currentPos += section.title.length + 1;

      if (section.subtitle) {
        parts.push(section.subtitle);
        parts.push('\n');
        currentPos += section.subtitle.length + 1;
      }
      parts.push('\n');
      currentPos += 1;
    }

    for (const paragraph of section.paragraphs) {
      if (paragraph.isPoetry) {
        // Poetry: each line on its own line with indentation
        for (const line of paragraph.verseLines) {
          const verseStart = currentPos;

          // Add indent spaces (2 em-spaces per level)
          const indentLevel = line.indent_level || 0;
          if (indentLevel > 0) {
            const indent = '\u2003'.repeat(indentLevel * 2);
            parts.push(indent);
            currentPos += indent.length;
          }

          // Verse number as superscript
          if (line.verse_number !== undefined) {
            const superscript = toSuperscript(line.verse_number);
            parts.push(superscript);
            parts.push('\u00A0'); // Non-breaking space
            currentPos += superscript.length + 1;
          }

          // Verse text
          const text = line.text || '';
          parts.push(text);
          currentPos += text.length;

          // Track verse boundary
          verseBoundaries.push({
            verseId: line.verse_id,
            startIndex: verseStart,
            endIndex: currentPos,
          });

          parts.push('\n');
          currentPos += 1;
        }
      } else {
        // Prose: verse lines joined inline
        for (let i = 0; i < paragraph.verseLines.length; i++) {
          const line = paragraph.verseLines[i];
          const verseStart = currentPos;

          // Space between verses (except first)
          if (i > 0) {
            parts.push(' ');
            currentPos += 1;
          }

          // Verse number as superscript
          if (line.verse_number !== undefined) {
            const superscript = toSuperscript(line.verse_number);
            parts.push(superscript);
            parts.push('\u00A0'); // Non-breaking space
            currentPos += superscript.length + 1;
          }

          // Verse text
          const text = line.text || '';
          parts.push(text);
          currentPos += text.length;

          // Track verse boundary
          verseBoundaries.push({
            verseId: line.verse_id,
            startIndex: verseStart,
            endIndex: currentPos,
          });
        }

        // Paragraph end
        parts.push('\n\n');
        currentPos += 2;
      }
    }
  }

  return {
    plainText: parts.join(''),
    verseBoundaries,
  };
}

/**
 * Map selection range to verse IDs
 *
 * @param selectionStart - Start character index in plain text
 * @param selectionEnd - End character index in plain text
 * @param verseBoundaries - Verse boundary mappings
 * @returns Array of verse IDs that overlap with selection
 */
export function mapSelectionToVerses(
  selectionStart: number,
  selectionEnd: number,
  verseBoundaries: VerseBoundary[]
): number[] {
  const verseIds: number[] = [];

  for (const boundary of verseBoundaries) {
    // Check if verse overlaps with selection
    if (boundary.endIndex > selectionStart && boundary.startIndex < selectionEnd) {
      if (!verseIds.includes(boundary.verseId)) {
        verseIds.push(boundary.verseId);
      }
    }
  }

  return verseIds;
}
