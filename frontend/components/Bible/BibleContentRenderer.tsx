/**
 * Reusable Bible Content Renderer
 * DRY component for rendering sections, paragraphs, poetry, and prose
 * Used by both BibleViewerSimplified and study mode split views
 */

import React from 'react';
import { View, Text } from 'react-native';
import { type VerseLine } from '@/services/sqlite';
import { type BibleStyles } from './BibleStyles';
import { toSuperscript, findVersesInSelection } from '@/modules/bible/textUtils';
import type { VerseHighlight } from '@/state/notesStore';
import type { Theme } from '@/config/theme';
import { SelectableTextView, type SelectableTextEvent, type SelectableTextAction, type TextRangeHighlight } from '@/modules/expo-selectable-text';
import { useTheme } from '@/contexts/ThemeContext';

// Re-export for consumers
export type { SelectableTextAction };

// Event payload for text selection actions
export interface TextActionEvent {
  action: SelectableTextAction;
  selectedText: string;
  verseId?: number;
  verseLines: VerseLine[]; // The verse lines in the paragraph where selection occurred
}

interface BibleContentRendererProps {
  verseLines: VerseLine[];
  isPoetry: boolean;
  showVerseNumbers?: boolean;
  fontSize?: number;
  styles: BibleStyles;
  contentPadding?: number; // Optional content padding for split-screen scenarios
  indentIncrement?: number; // Indent spacing per level (default 20px, study mode uses 4px)
  onVerseLineLayout?: (verseId: number, offsetY: number, height: number) => void; // Callback for verse-level measurements
  measurementMode?: boolean; // Enable measurement mode for alignment calculations
  selectedVerseId?: number | null; // Selected verse ID for highlighting (from search)
  // Verse range highlighting (for BiblePeek)
  highlightVerseStart?: number | null;
  highlightVerseEnd?: number | null;
  compact?: boolean; // Use minimal padding for compact views like BiblePeek
  // Persisted verse highlights
  persistedHighlights?: VerseHighlight[];
  // Theme colors for highlights
  highlightColors?: Theme['colors']['highlightColors'];
  // Native text selection callbacks
  onTextAction?: (event: TextActionEvent) => void;
  // Text color for native view
  textColor?: string;
  // Verse number color for native view
  verseNumberColor?: string;
  // Two-stage loading: report measured height back to FlashList
  paragraphKey?: string;
  onMeasuredHeight?: (key: string, height: number) => void;
  // Direct height callback for alignment (uses SelectableTextView's actual height)
  onParagraphHeight?: (height: number) => void;
}

export const BibleContentRenderer: React.FC<BibleContentRendererProps> = ({
  verseLines,
  isPoetry,
  showVerseNumbers = true,
  styles,
  contentPadding = 24, // Default padding for full-width (half of typical 48px)
  indentIncrement: indentIncrementProp, // Override from prop, falls back to styles.computedIndentIncrement or 20
  onVerseLineLayout,
  measurementMode = false,
  selectedVerseId = null,
  highlightVerseStart = null,
  highlightVerseEnd = null,
  compact = false,
  persistedHighlights = [],
  highlightColors,
  onTextAction,
  textColor,
  verseNumberColor: verseNumberColorProp,
  paragraphKey,
  onMeasuredHeight,
  onParagraphHeight,
}) => {
  // Get default colors from theme (used when props not provided)
  const { theme } = useTheme();
  const verseNumberColor = verseNumberColorProp ?? theme.colors.verseNumber;
  // Use textColor prop if provided, otherwise extract from styles, finally fall back to theme
  const effectiveTextColor = textColor ?? (styles.paragraphText?.color as string) ?? theme.colors.text.primary;

  // Check if native selection is available (requires dev client with native module)
  // Falls back to regular Text if not available
  const useNativeSelection = onTextAction !== undefined;

  // Report measured height from SelectableTextView (used by prose)
  const handleContentSizeChange = React.useCallback(
    (event: { nativeEvent: { width: number; height: number } }) => {
      const height = event.nativeEvent.height;
      if (height > 0) {
        // Report to FlashList two-stage loading (if configured)
        if (paragraphKey && onMeasuredHeight) {
          onMeasuredHeight(paragraphKey, height);
        }
        // Report direct height for alignment (uses actual SelectableTextView height)
        if (onParagraphHeight) {
          onParagraphHeight(height);
        }
      }
    },
    [paragraphKey, onMeasuredHeight, onParagraphHeight]
  );

  // Helper to get highlight color for a verse
  const getHighlightForVerse = (verseId: number): VerseHighlight | undefined => {
    return persistedHighlights.find((h) => h.verse_id === verseId);
  };

  // Helper to get hex color for a highlight color name
  // Uses 'bg' for the background highlight, not 'indicator' (which is for color picker dots)
  const getHighlightHexColor = (colorName: string): string | undefined => {
    if (!highlightColors) return undefined;
    const colorConfig = highlightColors[colorName as keyof typeof highlightColors];
    return colorConfig?.bg;
  };

  // Compute highlight ranges from verse boundaries (used in prose)
  const computeHighlightRanges = (
    verseBoundaries: { verseId: number; start: number; end: number }[]
  ): TextRangeHighlight[] => {
    const ranges: TextRangeHighlight[] = [];
    for (const boundary of verseBoundaries) {
      const highlight = getHighlightForVerse(boundary.verseId);
      if (highlight) {
        const hexColor = getHighlightHexColor(highlight.color);
        if (hexColor) {
          ranges.push({
            startIndex: boundary.start,
            endIndex: boundary.end,
            color: hexColor,
          });
        }
      }
    }
    return ranges;
  };

  // Use prop > styles computed value > compact default (8) > standard default (20)
  const indentIncrement = indentIncrementProp ?? styles.computedIndentIncrement ?? (compact ? 8 : 20);

  // Handle empty verse lines (placeholders for alignment)
  if (verseLines.length === 0) {
    return <View style={{ minHeight: 1 }} />; // Minimal placeholder for measurement
  }

  // POETRY PATH - Flattened approach for native selection (like prose)
  // When native selection is enabled, flatten poetry into single SelectableTextView with lineIndents
  // This ensures reliable height measurement via onContentSizeChange (same as prose)
  if (isPoetry && useNativeSelection) {
    // Build flattened text with newlines and track boundaries
    const flattenedParts: string[] = [];
    const verseBoundaries: { verseId: number; start: number; end: number }[] = [];
    const lineIndentsArray: { startIndex: number; endIndex: number; indent: number }[] = [];
    let currentPosition = 0;

    verseLines.forEach((line, lineIndex) => {
      const lineStart = currentPosition;
      const verseText = String(line.text || '');
      const verseNum = line.verse_number ? String(line.verse_number) : null;
      const shouldShowNumber = showVerseNumbers && line.show_verse_number && verseNum;
      // Poetry-specific extra indentation based on indent_level
      const poetryIndent = (line.indent_level || 0) * indentIncrement;

      // Add verse number if needed
      if (shouldShowNumber) {
        const verseContent = toSuperscript(verseNum!) + '\u00A0' + verseText;
        flattenedParts.push(verseContent);
        currentPosition += verseContent.length;
      } else {
        flattenedParts.push(verseText);
        currentPosition += verseText.length;
      }

      // Track line indent - only poetry-specific indentation
      // Base padding comes from the container (styles.paragraphContainer)
      lineIndentsArray.push({
        startIndex: lineStart,
        endIndex: currentPosition,
        indent: poetryIndent,
      });

      // Track verse boundary
      if (line.verse_id) {
        // Check if we already have a boundary for this verse (poetry can have multiple lines per verse)
        const existingBoundary = verseBoundaries.find(b => b.verseId === line.verse_id);
        if (existingBoundary) {
          // Extend the existing boundary
          existingBoundary.end = currentPosition;
        } else {
          verseBoundaries.push({
            verseId: line.verse_id,
            start: lineStart,
            end: currentPosition,
          });
        }
      }

      // Add newline between lines (except last)
      if (lineIndex < verseLines.length - 1) {
        flattenedParts.push('\n');
        currentPosition += 1;
      }
    });

    const flattenedText = flattenedParts.join('');

    // Handle poetry action with verse mapping - only include selected verses
    const handlePoetryAction = (event: { nativeEvent: SelectableTextEvent }) => {
      if (!onTextAction) return;
      const selectedVerseIds = findVersesInSelection(
        verseBoundaries,
        event.nativeEvent.selectionStart,
        event.nativeEvent.selectionEnd
      );
      // Filter verse lines to only include verses that overlap with selection
      const selectedVerseIdSet = new Set(selectedVerseIds);
      const selectedVerseLines = verseLines.filter(line =>
        line.verse_id !== undefined && selectedVerseIdSet.has(line.verse_id)
      );
      onTextAction({
        action: event.nativeEvent.action,
        selectedText: event.nativeEvent.selectedText,
        verseId: selectedVerseIds[0], // First verse for backward compat
        verseLines: selectedVerseLines.length > 0 ? selectedVerseLines : verseLines,
      });
    };

    // Extract styling - use paragraph styles (same as prose) for consistent appearance
    const fontSize = (styles.paragraphText?.fontSize as number) || 18;
    const lineHeightValue = (styles.paragraphText?.lineHeight as number) || fontSize * 1.75;
    const fontFamily = styles.paragraphText?.fontFamily as string | undefined;

    // Compute highlight ranges from verse boundaries
    const highlightRanges = computeHighlightRanges(verseBoundaries);

    // Use paragraphContainer for consistent padding with prose
    // lineIndents adds poetry-specific extra indentation on top
    return (
      <View style={styles.paragraphContainer}>
        <SelectableTextView
          text={flattenedText}
          verseId={verseBoundaries[0]?.verseId}
          fontSize={fontSize}
          fontFamily={fontFamily}
          textColor={effectiveTextColor}
          verseNumberColor={verseNumberColor}
          lineHeight={isNaN(lineHeightValue) ? fontSize * 1.75 : lineHeightValue}
          lineIndents={lineIndentsArray}
          highlights={highlightRanges}
          onAction={handlePoetryAction}
          onContentSizeChange={handleContentSizeChange}
        />
      </View>
    );
  }

  // PROSE PATH - Native selection only
  // When native selection is enabled, render entire paragraph as SelectableTextView
  // This skips the split/HighlightedVerse path which doesn't support selection
  if (useNativeSelection) {
    // Build flattened text and track verse boundaries for selection mapping
    const flattenedParts: string[] = [];
    const verseBoundaries: { verseId: number; start: number; end: number }[] = [];
    let currentPosition = 0;

    verseLines.forEach((line, lineIndex) => {
      const verseText = String(line.text || '');
      const verseNum = line.verse_number ? String(line.verse_number) : null;
      const shouldShowNumber = showVerseNumbers && line.show_verse_number && verseNum;
      const isFirstItem = flattenedParts.length === 0;

      // Track start position for this verse
      const verseStart = currentPosition;

      if (shouldShowNumber) {
        // Add separator space before verse number (if not first item)
        if (!isFirstItem) {
          flattenedParts.push(' ');
          currentPosition += 1;
        }
        // Verse number with non-breaking space after
        const verseContent = toSuperscript(verseNum) + '\u00A0' + verseText;
        flattenedParts.push(verseContent);
        currentPosition += verseContent.length;
      } else {
        // Regular text - add separator if not first
        if (!isFirstItem) {
          flattenedParts.push(' ');
          currentPosition += 1;
        }
        flattenedParts.push(verseText);
        currentPosition += verseText.length;
      }

      // Track verse boundary
      if (line.verse_id) {
        verseBoundaries.push({
          verseId: line.verse_id,
          start: verseStart,
          end: currentPosition,
        });
      }
    });

    const flattenedText = flattenedParts.join('');

    // Handle action with proper verse ID mapping - only include selected verses
    const handleProseAction = (event: { nativeEvent: SelectableTextEvent }) => {
      if (!onTextAction) return;
      const selectedVerseIds = findVersesInSelection(
        verseBoundaries,
        event.nativeEvent.selectionStart,
        event.nativeEvent.selectionEnd
      );
      // Filter verse lines to only include verses that overlap with selection
      const selectedVerseIdSet = new Set(selectedVerseIds);
      const selectedVerseLines = verseLines.filter(line =>
        line.verse_id !== undefined && selectedVerseIdSet.has(line.verse_id)
      );
      onTextAction({
        action: event.nativeEvent.action,
        selectedText: event.nativeEvent.selectedText,
        verseId: selectedVerseIds[0], // First verse for backward compat
        verseLines: selectedVerseLines.length > 0 ? selectedVerseLines : verseLines,
      });
    };

    // Extract styling from the existing styles (already platform-aware via theme)
    const fontSize = (styles.paragraphText?.fontSize as number) || 18;
    const lineHeightValue = (styles.paragraphText?.lineHeight as number) || fontSize * 1.75;
    const fontFamily = styles.paragraphText?.fontFamily as string | undefined;

    // Compute highlight ranges from verse boundaries
    const highlightRanges = computeHighlightRanges(verseBoundaries);

    return (
      <View style={styles.paragraphContainer}>
        <SelectableTextView
          text={flattenedText}
          verseId={verseBoundaries[0]?.verseId}
          fontSize={fontSize}
          fontFamily={fontFamily}
          textColor={effectiveTextColor}
          verseNumberColor={verseNumberColor}
          lineHeight={isNaN(lineHeightValue) ? fontSize * 1.75 : lineHeightValue}
          highlights={highlightRanges}
          onAction={handleProseAction}
          onContentSizeChange={handleContentSizeChange}
        />
      </View>
    );
  }

  // Fallback: Native selection is not enabled
  // Render a simple non-interactive view with proper verse number styling
  return (
    <View style={styles.paragraphContainer}>
      <Text style={styles.paragraphText}>
        {verseLines.map((line, index) => {
          const verseNum = showVerseNumbers && line.show_verse_number && line.verse_number
            ? toSuperscript(line.verse_number)
            : null;
          const needsSpace = index > 0;
          return (
            <React.Fragment key={line.id || index}>
              {needsSpace && ' '}
              {verseNum && (
                <Text style={{ color: verseNumberColor }}>{verseNum}{'\u00A0'}</Text>
              )}
              {line.text || ''}
            </React.Fragment>
          );
        })}
      </Text>
    </View>
  );
};
