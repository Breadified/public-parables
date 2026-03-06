/**
 * BibleVersesRenderer - DRY wrapper for rendering grouped Bible paragraphs
 *
 * Takes a flat array of VerseLine[] and automatically:
 * 1. Groups them by paragraph_id
 * 2. Detects poetry per paragraph
 * 3. Renders each with BibleContentRenderer with proper spacing
 *
 * Use this instead of BibleContentRenderer when you have raw verse lines
 * that may span multiple paragraphs.
 */

import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { BibleContentRenderer, type TextActionEvent } from './BibleContentRenderer';
import type { BibleStyles } from './BibleStyles';
import type { VerseLine } from '@/services/sqlite';
import type { VerseHighlight } from '@/state/notesStore';
import type { Theme } from '@/config/theme';

interface GroupedParagraph {
  paragraphId: string;
  verseLines: VerseLine[];
  isPoetry: boolean;
}

interface BibleVersesRendererProps {
  verseLines: VerseLine[];
  showVerseNumbers?: boolean;
  styles: BibleStyles;
  textColor?: string;
  verseNumberColor?: string;
  onTextAction?: (event: TextActionEvent) => void;
  persistedHighlights?: VerseHighlight[];
  highlightColors?: Theme['colors']['highlightColors'];
  paragraphGap?: number;
}

/**
 * Groups verse lines by paragraph_id, preserving order
 */
function groupByParagraph(lines: VerseLine[]): GroupedParagraph[] {
  const paragraphMap = new Map<string, VerseLine[]>();
  const paragraphOrder: string[] = [];

  for (const line of lines) {
    const pid = line.paragraph_id;
    if (!paragraphMap.has(pid)) {
      paragraphMap.set(pid, []);
      paragraphOrder.push(pid);
    }
    paragraphMap.get(pid)!.push(line);
  }

  return paragraphOrder.map(pid => {
    const verseLines = paragraphMap.get(pid)!;
    // Poetry detection: any line with indent_level > 0 marks paragraph as poetry
    const isPoetry = verseLines.some((line) => (line.indent_level || 0) > 0);
    return {
      paragraphId: pid,
      verseLines,
      isPoetry,
    };
  });
}

/**
 * Filter highlights for specific verse lines
 */
function getHighlightsForLines(
  verseLines: VerseLine[],
  allHighlights: VerseHighlight[]
): VerseHighlight[] {
  const verseIds = new Set(verseLines.map(line => line.verse_id).filter(Boolean));
  return allHighlights.filter((h) => verseIds.has(h.verse_id));
}

export const BibleVersesRenderer: React.FC<BibleVersesRendererProps> = ({
  verseLines,
  showVerseNumbers = true,
  styles,
  textColor,
  verseNumberColor,
  onTextAction,
  persistedHighlights = [],
  highlightColors,
  paragraphGap = 16,
}) => {
  // Group verse lines by paragraph
  const paragraphs = useMemo(() => groupByParagraph(verseLines), [verseLines]);

  if (paragraphs.length === 0) {
    return null;
  }

  return (
    <View style={localStyles.container}>
      {paragraphs.map((paragraph, index) => (
        <View
          key={paragraph.paragraphId}
          style={index > 0 ? { marginTop: paragraphGap } : undefined}
        >
          <BibleContentRenderer
            verseLines={paragraph.verseLines}
            isPoetry={paragraph.isPoetry}
            showVerseNumbers={showVerseNumbers}
            styles={styles}
            textColor={textColor}
            verseNumberColor={verseNumberColor}
            onTextAction={onTextAction}
            persistedHighlights={getHighlightsForLines(paragraph.verseLines, persistedHighlights)}
            highlightColors={highlightColors}
          />
        </View>
      ))}
    </View>
  );
};

const localStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
