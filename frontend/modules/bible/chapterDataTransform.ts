/**
 * Chapter Data Transformation Utilities
 *
 * Transforms ChapterContent from SQLite into the format expected by
 * ChapterSelectableText component for chapter-level rendering.
 */

import type { ChapterContent, VerseLine as SQLiteVerseLine } from '../../services/sqlite';
import { buildChapterText, mapSelectionToVerses, type VerseBoundary } from './chapterTextBuilder';
import { toSuperscript, type VerseBoundary as TextUtilsVerseBoundary } from './textUtils';
import { getBookByName, getLocalizedBookName } from './bibleBookMappings';

/**
 * Per-line indentation for poetry sections
 * Used by native modules to apply paragraph-level indentation per line
 */
export interface SectionLineIndent {
  startIndex: number;  // Character position where this line starts
  endIndex: number;    // Character position where this line ends (before newline)
  indent: number;      // Indent in dp/points for this line
}

/**
 * StyledSection - Native module section format for styled rendering
 *
 * Each section has a type that determines styling in the native view:
 * - chapter-header: Large centered title (36px, ultra-light)
 * - section-header: Centered section title (16px, medium weight, muted)
 * - section-subtitle: Centered italic subtitle (16px, italic, muted)
 * - prose: Standard paragraph text (Georgia font, line-height 1.75)
 * - poetry: Indented poetry lines (Georgia font, poetry indent, preserve newlines)
 */
export interface StyledSection {
  type: 'chapter-header' | 'section-header' | 'section-subtitle' | 'prose' | 'poetry';
  text: string;
  verseStart?: number;  // First verse ID in this section (for boundary tracking)
  verseEnd?: number;    // Last verse ID in this section
  lineIndents?: SectionLineIndent[];  // Per-line indentation for poetry (relative to section text)
}

/**
 * Section structure for chapter rendering
 */
export interface Section {
  title?: string;
  subtitle?: string;
  paragraphs: Paragraph[];
}

/**
 * Paragraph structure
 */
export interface Paragraph {
  paragraphId?: string;
  isPoetry: boolean;
  verseLines: VerseLine[];
}

/**
 * Verse line structure
 */
export interface VerseLine {
  verse_id: number;
  verse_number?: number;
  text: string;
  indent_level?: number;
}

// =============================================================================
// Shared Helper Types and Functions
// =============================================================================

/**
 * Generic verse line for shared helpers (works with both VerseLine and SQLiteVerseLine)
 */
interface GenericVerseLine {
  verse_id: number;
  verse_number?: number | null;
  text?: string | null;
  indent_level?: number | null;
  show_verse_number?: boolean;
}

/**
 * Result from building a poetry section
 */
interface PoetryBuildResult {
  text: string;
  verseStart: number;
  verseEnd: number;
  lineIndents: SectionLineIndent[];
  /** Position delta (how much currentPos should advance) */
  positionDelta: number;
  /** Verse boundaries with local indices (caller converts to global) */
  localBoundaries: { verseId: number; start: number; end: number }[];
}

/**
 * Result from building a prose section (merged paragraphs)
 */
interface ProseBuildResult {
  text: string;
  verseStart: number;
  verseEnd: number;
  /** Position delta (how much currentPos should advance) */
  positionDelta: number;
  /** Verse boundaries with local indices (caller converts to global) */
  localBoundaries: { verseId: number; start: number; end: number }[];
}

/**
 * Build a poetry section from verse lines
 *
 * @param verseLines - Array of verse lines for this poetry paragraph
 * @param indentIncrement - Pixels per indent level (default 20)
 * @param checkShowVerseNumber - Whether to check show_verse_number flag
 */
function buildPoetrySection(
  verseLines: GenericVerseLine[],
  indentIncrement: number = 20,
  checkShowVerseNumber: boolean = false
): PoetryBuildResult {
  const lines: string[] = [];
  const lineIndents: SectionLineIndent[] = [];
  const localBoundaries: { verseId: number; start: number; end: number }[] = [];
  let localPos = 0;

  const verseIds = verseLines.map(line => line.verse_id);
  const verseStart = Math.min(...verseIds);
  const verseEnd = Math.max(...verseIds);

  for (const line of verseLines) {
    const lineLocalStart = localPos;
    let lineText = '';

    // Verse number as superscript
    const shouldShowNumber = checkShowVerseNumber
      ? (line.verse_number != null && line.show_verse_number)
      : (line.verse_number != null);

    if (shouldShowNumber) {
      lineText += toSuperscript(line.verse_number!) + '\u00A0';
    }

    // Verse text
    lineText += line.text || '';

    // Track verse boundary
    localBoundaries.push({
      verseId: line.verse_id,
      start: localPos,
      end: localPos + lineText.length,
    });

    localPos += lineText.length;

    // Track line indent
    const indentLevel = line.indent_level || 0;
    lineIndents.push({
      startIndex: lineLocalStart,
      endIndex: localPos,
      indent: indentLevel * indentIncrement,
    });

    lines.push(lineText);
    localPos += 1; // \n within poetry
  }

  return {
    text: lines.join('\n'),
    verseStart,
    verseEnd,
    lineIndents,
    positionDelta: localPos + 1, // +1 for spacing after poetry
    localBoundaries,
  };
}

/**
 * Build a prose section from multiple paragraphs (merged)
 *
 * @param paragraphLines - Array of arrays, each inner array is a paragraph's verse lines
 * @param checkShowVerseNumber - Whether to check show_verse_number flag
 */
function buildMergedProseSection(
  paragraphLines: GenericVerseLine[][],
  checkShowVerseNumber: boolean = false
): ProseBuildResult {
  const parts: string[] = [];
  const localBoundaries: { verseId: number; start: number; end: number }[] = [];
  const allVerseIds: number[] = [];
  let localPos = 0;

  for (let pIdx = 0; pIdx < paragraphLines.length; pIdx++) {
    const paraLines = paragraphLines[pIdx];

    // Add paragraph separator: newline + 4-space indent for visual paragraph break
    if (pIdx > 0) {
      parts.push('\n    ');
      localPos += 5; // \n + 4 spaces
    }

    for (let vIdx = 0; vIdx < paraLines.length; vIdx++) {
      const line = paraLines[vIdx];
      const verseStartPos = localPos;

      // Space between verses within same paragraph (except first)
      if (vIdx > 0) {
        parts.push(' ');
        localPos += 1;
      }

      // Verse number as superscript
      const shouldShowNumber = checkShowVerseNumber
        ? (line.verse_number != null && line.show_verse_number)
        : (line.verse_number != null);

      if (shouldShowNumber) {
        const superscript = toSuperscript(line.verse_number!) + '\u00A0';
        parts.push(superscript);
        localPos += superscript.length;
      }

      // Verse text
      const text = line.text || '';
      parts.push(text);
      localPos += text.length;

      // Track verse boundary
      localBoundaries.push({
        verseId: line.verse_id,
        start: verseStartPos,
        end: localPos,
      });

      allVerseIds.push(line.verse_id);
    }
  }

  return {
    text: parts.join(''),
    verseStart: Math.min(...allVerseIds),
    verseEnd: Math.max(...allVerseIds),
    positionDelta: localPos + 1, // +1 for spacing after prose section
    localBoundaries,
  };
}

// =============================================================================
// Main Types and Functions
// =============================================================================

/**
 * Chapter render item for FlashList virtualization
 */
export interface ChapterRenderItem {
  type: 'chapter';
  key: string;
  chapterId: number;
  bookName: string;
  chapterNumber: number;
  chapterTitle: string;
  /** Pre-formatted plain text for native view (legacy - for backward compatibility) */
  plainText: string;
  /** Styled sections for native view (new approach with rich styling) */
  styledSections: StyledSection[];
  /** Verse boundaries for mapping selection to verse IDs */
  verseBoundaries: VerseBoundary[];
  /** Original sections (kept for potential fallback) */
  sections: Section[];
  /** Estimated height in pixels for FlashList layout */
  estimatedHeight: number;
}

/**
 * Transform ChapterContent from SQLite into the format expected by ChapterSelectableText
 *
 * @param chapterContent - The chapter data from SQLite
 * @param language - Optional language code for localized book names ('en' | 'zh')
 * @returns ChapterRenderItem ready for FlashList and ChapterSelectableText
 */
export function transformChapterContent(chapterContent: ChapterContent, language: string = 'en'): ChapterRenderItem {
  const { chapter, sections: sqliteSections } = chapterContent;

  // Build chapter title with localization support
  let chapterTitle = `${chapter.book_name} ${chapter.chapter_number}`;
  if (language === 'zh' && chapter.book_name) {
    // Get book ID from English name and use localized name
    const book = getBookByName(chapter.book_name);
    if (book) {
      const localizedName = getLocalizedBookName(book.id, language);
      chapterTitle = `${localizedName} ${chapter.chapter_number}`;
    }
  }

  // Transform sections
  const sections: Section[] = sqliteSections.map(sqliteSection => {
    const { section, paragraphs: sqliteParagraphs } = sqliteSection;

    // Transform paragraphs
    const paragraphs: Paragraph[] = sqliteParagraphs.map(sqliteParagraph => {
      const { paragraph, verseLines: sqliteVerseLines } = sqliteParagraph;

      // Transform verse lines
      const verseLines: VerseLine[] = sqliteVerseLines.map(line => ({
        verse_id: line.verse_id,
        verse_number: line.show_verse_number ? (line.verse_number ?? undefined) : undefined,
        text: line.text || '',
        indent_level: line.indent_level || 0,
      }));

      return {
        paragraphId: paragraph.id,
        isPoetry: paragraph.is_poetry,
        verseLines,
      };
    });

    return {
      title: section.title || undefined,
      subtitle: section.subtitle || undefined,
      paragraphs,
    };
  });

  // Pre-compute plain text for legacy native view mode
  const { plainText } = buildChapterText(chapterTitle, sections);

  // Generate styled sections with verse boundaries for native module (new approach)
  // Use these verseBoundaries which match the sections text format
  const { styledSections, verseBoundaries } = transformChapterToSectionsWithBoundaries(chapterTitle, sections);

  // Calculate estimated height for FlashList
  const estimatedHeight = calculateEstimatedHeight(sections);

  return {
    type: 'chapter',
    key: `chapter-${chapter.id}`,
    chapterId: chapter.id,
    bookName: chapter.book_name || '',
    chapterNumber: chapter.chapter_number,
    chapterTitle,
    plainText,
    styledSections,
    verseBoundaries,
    sections,
    estimatedHeight,
  };
}

/**
 * Calculate estimated height for a chapter based on its sections
 * Used for FlashList layout before native measurement
 */
function calculateEstimatedHeight(sections: Section[], fontSize: number = 20): number {
  const lineHeight = fontSize * 1.5;

  // Chapter title height (larger font + margins)
  let height = 80;

  sections.forEach(section => {
    // Section header (if present)
    if (section.title) {
      height += 60;
    }

    section.paragraphs.forEach(paragraph => {
      if (paragraph.isPoetry) {
        // Poetry: each line is a separate visual line
        height += paragraph.verseLines.length * lineHeight;
      } else {
        // Prose: estimate wrapping based on character count
        const totalChars = paragraph.verseLines.reduce(
          (sum, line) => sum + (line.text?.length || 0) + 3,
          0
        );
        const charsPerLine = 38; // Conservative estimate for mobile width
        const estimatedLines = Math.ceil(totalChars / charsPerLine);
        height += estimatedLines * lineHeight;
      }

      // Paragraph spacing
      height += 24;
    });
  });

  return Math.ceil(height);
}

/**
 * Transform multiple chapters for FlashList rendering
 *
 * @param chapters - Map of chapterId to ChapterContent
 * @param sortedChapterIds - Ordered list of chapter IDs for display
 * @param language - Optional language code for localized book names ('en' | 'zh')
 * @returns Array of ChapterRenderItems in display order
 */
export function transformChaptersForList(
  chapters: { [chapterId: number]: ChapterContent },
  sortedChapterIds: number[],
  language: string = 'en'
): ChapterRenderItem[] {
  return sortedChapterIds
    .filter(chapterId => chapters[chapterId] !== undefined)
    .map(chapterId => transformChapterContent(chapters[chapterId], language));
}

/**
 * Estimate chapter height for FlashList overrideItemLayout
 * This provides a reasonable estimate before native measurement
 *
 * @param item - ChapterRenderItem
 * @param fontSize - Current font size
 * @returns Estimated height in pixels
 */
export function estimateChapterHeight(item: ChapterRenderItem, fontSize: number = 18): number {
  const lineHeight = fontSize * 1.5;

  // Chapter title height (larger font + margins)
  let height = 60;

  item.sections.forEach(section => {
    // Section header (if present)
    if (section.title) {
      height += 60; // Header + margins
    }

    section.paragraphs.forEach(paragraph => {
      if (paragraph.isPoetry) {
        // Poetry: each line is a separate visual line
        height += paragraph.verseLines.length * lineHeight;
      } else {
        // Prose: estimate wrapping based on character count
        const totalChars = paragraph.verseLines.reduce(
          (sum, line) => sum + (line.text?.length || 0) + 3, // +3 for verse number
          0
        );
        const charsPerLine = 42; // ~40-45 chars per line at typical width
        const estimatedLines = Math.ceil(totalChars / charsPerLine);
        height += estimatedLines * lineHeight;
      }

      // Paragraph spacing
      height += 16;
    });
  });

  return height;
}

/**
 * Find verse IDs within a selection range in a chapter
 * Uses pre-computed verse boundaries for efficient lookup
 *
 * @param item - ChapterRenderItem with pre-computed verseBoundaries
 * @param selectionStart - Start character index
 * @param selectionEnd - End character index
 * @returns Array of verse IDs that overlap with the selection
 */
export function findVersesInChapterSelection(
  item: ChapterRenderItem,
  selectionStart: number,
  selectionEnd: number
): number[] {
  return mapSelectionToVerses(selectionStart, selectionEnd, item.verseBoundaries);
}

/**
 * Result of formatting verse text for copying
 */
export interface FormattedVerseResult {
  /** Full formatted text with reference and verse numbers */
  text: string;
  /** Short reference string (e.g., "Genesis 1:1" or "Genesis 1:1-3") */
  reference: string;
}

/**
 * Get formatted verse text for copying
 * Returns full verses with [1], [2] style verse numbers
 *
 * @param item - ChapterRenderItem containing sections
 * @param verseIds - Array of verse IDs to include
 * @returns Formatted text with verse numbers and reference string
 */
export function getFormattedVerseText(
  item: ChapterRenderItem,
  verseIds: number[]
): FormattedVerseResult {
  if (verseIds.length === 0) return { text: '', reference: '' };

  const verseIdSet = new Set(verseIds);
  const verses: { verseNumber: number; text: string }[] = [];

  // Extract verses from sections
  for (const section of item.sections) {
    for (const paragraph of section.paragraphs) {
      for (const line of paragraph.verseLines) {
        if (verseIdSet.has(line.verse_id) && line.verse_number != null) {
          // Check if we already have this verse (avoid duplicates from multi-line verses)
          const existing = verses.find(v => v.verseNumber === line.verse_number);
          if (existing) {
            // Append to existing verse (for poetry with multiple lines per verse)
            existing.text += ' ' + line.text.trim();
          } else {
            verses.push({
              verseNumber: line.verse_number,
              text: line.text.trim(),
            });
          }
        }
      }
    }
  }

  // Sort by verse number and format
  verses.sort((a, b) => a.verseNumber - b.verseNumber);

  // Build reference string (e.g., "Genesis 1:1" or "Genesis 1:1-3")
  const firstVerse = verses[0]?.verseNumber || '';
  const lastVerse = verses[verses.length - 1]?.verseNumber || '';
  const reference = `${item.bookName} ${item.chapterNumber}:${firstVerse}${verses.length > 1 ? `-${lastVerse}` : ''}`;

  // Format with [1] style verse numbers
  const formatted = verses
    .map(v => `[${v.verseNumber}] ${v.text}`)
    .join(' ');

  // Full text with reference
  const text = `${reference}\n${formatted}`;

  return { text, reference };
}

/**
 * Format verse lines for copying (for BibleContentRenderer events)
 * Works with VerseLine[] directly instead of ChapterRenderItem
 *
 * @param bookName - Book name (e.g., "Genesis")
 * @param chapterNumber - Chapter number
 * @param verseLines - Array of verse lines from the selection
 * @returns Formatted text with verse numbers and reference string
 */
export function formatVerseLinesForCopy(
  bookName: string,
  chapterNumber: number,
  verseLines: { verse_id: number; verse_number?: number | null; text: string }[]
): FormattedVerseResult {
  if (verseLines.length === 0) return { text: '', reference: '' };

  const verses: { verseNumber: number; text: string }[] = [];

  // Extract verses from verseLines, grouping by verse number
  for (const line of verseLines) {
    if (line.verse_number != null) {
      // Check if we already have this verse (avoid duplicates from multi-line verses)
      const existing = verses.find(v => v.verseNumber === line.verse_number);
      if (existing) {
        // Append to existing verse (for poetry with multiple lines per verse)
        existing.text += ' ' + line.text.trim();
      } else {
        verses.push({
          verseNumber: line.verse_number,
          text: line.text.trim(),
        });
      }
    }
  }

  if (verses.length === 0) return { text: '', reference: '' };

  // Sort by verse number and format
  verses.sort((a, b) => a.verseNumber - b.verseNumber);

  // Build reference string (e.g., "Genesis 1:1" or "Genesis 1:1-3")
  const firstVerse = verses[0]?.verseNumber || '';
  const lastVerse = verses[verses.length - 1]?.verseNumber || '';
  const reference = `${bookName} ${chapterNumber}:${firstVerse}${verses.length > 1 ? `-${lastVerse}` : ''}`;

  // Format with [1] style verse numbers
  const formatted = verses
    .map(v => `[${v.verseNumber}] ${v.text}`)
    .join(' ');

  // Full text with reference
  const text = `${reference}\n${formatted}`;

  return { text, reference };
}

/**
 * Result of transforming sections with verse boundary tracking
 */
export interface SectionsWithBoundaries {
  styledSections: StyledSection[];
  verseBoundaries: VerseBoundary[];
}

/**
 * Transform sections into StyledSection array for native module rendering
 *
 * This function converts the hierarchical Section[] structure into a flat
 * StyledSection[] array that the native module can render with appropriate
 * styling for each section type.
 *
 * Also computes verse boundaries that match the sections text format for
 * accurate selection-to-verse mapping.
 *
 * @param chapterTitle - Chapter title (e.g., "Genesis 1")
 * @param sections - Array of sections from transformChapterContent
 * @returns Object containing styledSections and verseBoundaries
 */
export function transformChapterToSectionsWithBoundaries(
  chapterTitle: string,
  sections: Section[]
): SectionsWithBoundaries {
  const styledSections: StyledSection[] = [];
  const verseBoundaries: VerseBoundary[] = [];
  let currentPos = 0;

  // Chapter header
  styledSections.push({
    type: 'chapter-header',
    text: chapterTitle,
  });
  currentPos += chapterTitle.length;
  currentPos += 2; // \n\n spacing

  for (let sectionIdx = 0; sectionIdx < sections.length; sectionIdx++) {
    const section = sections[sectionIdx];
    const isFirstSection = sectionIdx === 0;

    // Section header (if present)
    // Add leading \n to create bigger gap BEFORE header (but not for first section after chapter header)
    if (section.title) {
      const headerText = isFirstSection ? section.title : '\n' + section.title;
      styledSections.push({
        type: 'section-header',
        text: headerText,
      });
      currentPos += headerText.length;
      currentPos += 1; // \n spacing from native after header

      // Section subtitle (if present)
      if (section.subtitle) {
        styledSections.push({
          type: 'section-subtitle',
          text: section.subtitle,
        });
        currentPos += section.subtitle.length;
        currentPos += 2; // \n\n spacing
      }
    }

    // Process paragraphs - merge consecutive prose paragraphs to avoid native \n\n between them
    let pIdx = 0;
    while (pIdx < section.paragraphs.length) {
      const paragraph = section.paragraphs[pIdx];

      if (paragraph.isPoetry) {
        // Use shared helper for poetry (indentIncrement=4 for chapter view)
        const result = buildPoetrySection(paragraph.verseLines, 4, false);

        // Convert local boundaries to global and add to verseBoundaries
        for (const b of result.localBoundaries) {
          verseBoundaries.push({
            verseId: b.verseId,
            startIndex: currentPos + b.start,
            endIndex: currentPos + b.end,
          });
        }

        styledSections.push({
          type: 'poetry',
          text: result.text,
          verseStart: result.verseStart,
          verseEnd: result.verseEnd,
          lineIndents: result.lineIndents,
        });
        currentPos += result.positionDelta;
        pIdx++;
      } else {
        // Collect consecutive prose paragraphs for merging
        const proseParas: Paragraph[] = [];
        while (pIdx < section.paragraphs.length && !section.paragraphs[pIdx].isPoetry) {
          proseParas.push(section.paragraphs[pIdx]);
          pIdx++;
        }

        // Use shared helper for merged prose
        const paragraphLines = proseParas.map(p => p.verseLines);
        const result = buildMergedProseSection(paragraphLines, false);

        // Convert local boundaries to global and add to verseBoundaries
        for (const b of result.localBoundaries) {
          verseBoundaries.push({
            verseId: b.verseId,
            startIndex: currentPos + b.start,
            endIndex: currentPos + b.end,
          });
        }

        styledSections.push({
          type: 'prose',
          text: result.text,
          verseStart: result.verseStart,
          verseEnd: result.verseEnd,
        });
        currentPos += result.positionDelta;
      }
    }
  }

  return { styledSections, verseBoundaries };
}

/**
 * Transform sections into StyledSection array for native module rendering
 * (Legacy function for backward compatibility - use transformChapterToSectionsWithBoundaries)
 *
 * @param chapterTitle - Chapter title (e.g., "Genesis 1")
 * @param sections - Array of sections from transformChapterContent
 * @returns Array of StyledSection objects for native rendering
 */
export function transformChapterToSections(
  chapterTitle: string,
  sections: Section[]
): StyledSection[] {
  const styledSections: StyledSection[] = [];

  // Chapter header
  styledSections.push({
    type: 'chapter-header',
    text: chapterTitle,
  });

  for (const section of sections) {
    // Section header (if present)
    if (section.title) {
      styledSections.push({
        type: 'section-header',
        text: section.title,
      });

      // Section subtitle (if present)
      if (section.subtitle) {
        styledSections.push({
          type: 'section-subtitle',
          text: section.subtitle,
        });
      }
    }

    // Process paragraphs
    for (const paragraph of section.paragraphs) {
      const verseIds = paragraph.verseLines.map(line => line.verse_id);
      const verseStart = Math.min(...verseIds);
      const verseEnd = Math.max(...verseIds);

      if (paragraph.isPoetry) {
        // Poetry: each line preserved with proper formatting
        const lines: string[] = [];
        for (const line of paragraph.verseLines) {
          let lineText = '';

          // Add indent spaces (em-spaces for poetry indentation)
          const indentLevel = line.indent_level || 0;
          if (indentLevel > 0) {
            lineText += '\u2003'.repeat(indentLevel * 2);
          }

          // Verse number as superscript (skip if null/undefined)
          if (line.verse_number != null) {
            lineText += toSuperscript(line.verse_number) + '\u00A0';
          }

          // Verse text
          lineText += line.text || '';
          lines.push(lineText);
        }

        styledSections.push({
          type: 'poetry',
          text: lines.join('\n'),
          verseStart,
          verseEnd,
        });
      } else {
        // Prose: verse lines joined inline
        const parts: string[] = [];
        for (let i = 0; i < paragraph.verseLines.length; i++) {
          const line = paragraph.verseLines[i];

          // Space between verses (except first)
          if (i > 0) {
            parts.push(' ');
          }

          // Verse number as superscript (skip if null/undefined)
          if (line.verse_number != null) {
            parts.push(toSuperscript(line.verse_number) + '\u00A0');
          }

          // Verse text
          parts.push(line.text || '');
        }

        styledSections.push({
          type: 'prose',
          text: parts.join(''),
          verseStart,
          verseEnd,
        });
      }
    }
  }

  return styledSections;
}

/**
 * Extract full verse lines for a set of verse IDs from sections
 * Used for getting complete verse data when user selects partial text
 *
 * @param sections - Array of sections from chapter data
 * @param verseIds - Array of verse IDs to extract
 * @returns Array of VerseLine objects for the specified verses
 */
export function extractVerseLinesForIds(
  sections: Section[],
  verseIds: number[]
): VerseLine[] {
  const verseIdSet = new Set(verseIds);
  const lines: VerseLine[] = [];

  for (const section of sections) {
    for (const paragraph of section.paragraphs) {
      for (const line of paragraph.verseLines) {
        if (verseIdSet.has(line.verse_id)) {
          lines.push(line);
        }
      }
    }
  }

  return lines;
}

/**
 * Transform raw VerseLine[] into StyledSection[] format for ChapterSelectableText
 *
 * This enables cross-paragraph text selection by rendering all content as a single
 * native view. Used by PlanReadingContent, PlanStudyModeView, etc.
 *
 * Merges consecutive prose paragraphs into a single section with \n between them
 * to avoid native code adding \n\n between each section.
 *
 * @param verseLines - Raw verse lines from SQLite
 * @returns Object with styledSections and verseBoundaries for selection mapping
 */
export function transformVerseLinesToStyledSections(
  verseLines: SQLiteVerseLine[]
): { styledSections: StyledSection[]; verseBoundaries: TextUtilsVerseBoundary[] } {
  if (verseLines.length === 0) {
    return { styledSections: [], verseBoundaries: [] };
  }

  // Group verse lines by paragraph_id
  const paragraphMap = new Map<string, SQLiteVerseLine[]>();
  const paragraphOrder: string[] = [];

  for (const line of verseLines) {
    const pid = line.paragraph_id;
    if (!paragraphMap.has(pid)) {
      paragraphMap.set(pid, []);
      paragraphOrder.push(pid);
    }
    paragraphMap.get(pid)!.push(line);
  }

  // Build paragraph info with poetry detection
  interface ParagraphInfo {
    lines: SQLiteVerseLine[];
    isPoetry: boolean;
  }
  const paragraphs: ParagraphInfo[] = paragraphOrder.map(pid => {
    const lines = paragraphMap.get(pid)!;
    const isPoetry = lines.some((line) => (line.indent_level || 0) > 0);
    return { lines, isPoetry };
  });

  const styledSections: StyledSection[] = [];
  const verseBoundaries: TextUtilsVerseBoundary[] = [];
  let currentPos = 0;

  let i = 0;
  while (i < paragraphs.length) {
    const para = paragraphs[i];

    if (para.isPoetry) {
      // Use shared helper for poetry (checkShowVerseNumber=true for SQLiteVerseLine)
      const result = buildPoetrySection(para.lines, 20, true);

      // Convert local boundaries to global and add to verseBoundaries
      for (const b of result.localBoundaries) {
        verseBoundaries.push({
          verseId: b.verseId,
          start: currentPos + b.start,
          end: currentPos + b.end,
        });
      }

      styledSections.push({
        type: 'poetry',
        text: result.text,
        verseStart: result.verseStart,
        verseEnd: result.verseEnd,
        lineIndents: result.lineIndents,
      });
      currentPos += result.positionDelta;
      i++;
    } else {
      // Collect consecutive prose paragraphs for merging
      const proseParas: ParagraphInfo[] = [];
      while (i < paragraphs.length && !paragraphs[i].isPoetry) {
        proseParas.push(paragraphs[i]);
        i++;
      }

      // Use shared helper for merged prose (checkShowVerseNumber=true for SQLiteVerseLine)
      const paragraphLines = proseParas.map(p => p.lines);
      const result = buildMergedProseSection(paragraphLines, true);

      // Convert local boundaries to global and add to verseBoundaries
      for (const b of result.localBoundaries) {
        verseBoundaries.push({
          verseId: b.verseId,
          start: currentPos + b.start,
          end: currentPos + b.end,
        });
      }

      styledSections.push({
        type: 'prose',
        text: result.text,
        verseStart: result.verseStart,
        verseEnd: result.verseEnd,
      });
      currentPos += result.positionDelta;
    }
  }

  return { styledSections, verseBoundaries };
}

// Re-export for convenience
export { mapSelectionToVerses, type VerseBoundary } from './chapterTextBuilder';
