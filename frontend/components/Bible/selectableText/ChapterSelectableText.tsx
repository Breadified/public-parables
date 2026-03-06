import { requireNativeViewManager } from 'expo-modules-core';
import * as React from 'react';
import { ViewProps } from 'react-native';
import { StyleSpec } from './styleSpec';

// Action types for the custom context menu
export type ChapterSelectableTextAction = 'copy' | 'share' | 'note' | 'highlight' | 'bookmark';

// Event emitted when user selects an action
export interface ChapterSelectionEvent {
  action: ChapterSelectableTextAction;
  selectedText: string;
  selectionStart: number;
  selectionEnd: number;
}

export interface ChapterContentSizeEvent {
  width: number;
  height: number;
}

/**
 * Per-line indentation for poetry sections
 */
export interface SectionLineIndent {
  startIndex: number;  // Character position where this line starts
  endIndex: number;    // Character position where this line ends
  indent: number;      // Indent in dp/points for this line
}

/**
 * StyledSection - Section format for native module rendering
 * Matches the StyledSection interface in chapterDataTransform.ts
 */
export interface StyledSection {
  type: 'chapter-header' | 'section-header' | 'section-subtitle' | 'prose' | 'poetry';
  text: string;
  verseStart?: number;
  verseEnd?: number;
  lineIndents?: SectionLineIndent[];  // Per-line indentation for poetry
}

/**
 * Highlight for a single verse
 */
export interface VerseHighlight {
  verseId: number;
  color: string;  // Hex color string, e.g. "#FFEB3B" or "#FFEB3B80" (with alpha)
}

export interface ChapterSelectableTextProps extends ViewProps {
  /** Pre-formatted plain text with unicode superscript verse numbers (legacy fallback) */
  text?: string;

  /** Styled sections for rich rendering */
  sections?: StyledSection[];

  /**
   * Style specification from React Native
   * All styling is defined in React Native - native modules only apply styles
   */
  styleSpec?: StyleSpec;

  /**
   * Verse highlights - array of { verseId, color } to apply background colors
   */
  highlights?: VerseHighlight[];

  /** Callback when user selects an action from the context menu */
  onAction?: (event: { nativeEvent: ChapterSelectionEvent }) => void;

  /** Callback when content size changes (after text measurement) */
  onContentSizeChange?: (event: { nativeEvent: ChapterContentSizeEvent }) => void;

  /** Unique key for this chapter (for height caching in FlashList) */
  chapterKey?: string;

  /** Callback when height is measured (for FlashList re-layout) */
  onMeasuredHeight?: (key: string, height: number) => void;
}

// Native view manager
const NativeView: React.ComponentType<ChapterSelectableTextProps> =
  requireNativeViewManager('ChapterSelectableText');

/**
 * ChapterSelectableText - Native text selection container
 *
 * Style Spec Architecture:
 * - All styling is defined in React Native and passed via styleSpec
 * - Native modules only apply styles, they don't define them
 * - This keeps styling logic in one place (React Native)
 *
 * Uses onContentSizeChange to dynamically size itself based on measured content.
 * This is critical for proper layout - without applying the measured height,
 * React Native's layout system thinks the view is 0 height.
 */
export default function ChapterSelectableText(props: ChapterSelectableTextProps) {
  const { style, onContentSizeChange, chapterKey, onMeasuredHeight, ...rest } = props;

  // Track measured height from native view - THIS IS THE KEY FIX
  const [measuredHeight, setMeasuredHeight] = React.useState<number | null>(null);

  // Handle native content size change - store height and forward to parent
  const handleContentSizeChange = React.useCallback(
    (event: { nativeEvent: ChapterContentSizeEvent }) => {
      const { height } = event.nativeEvent;
      if (height > 0) {
        setMeasuredHeight(height);

        // Report to parent for FlashList re-layout
        if (chapterKey && onMeasuredHeight) {
          onMeasuredHeight(chapterKey, height);
        }
      }
      // Forward to parent callback if provided
      onContentSizeChange?.(event);
    },
    [chapterKey, onMeasuredHeight, onContentSizeChange]
  );

  // Apply measured height to style - without this, RN thinks view is 0 height
  const combinedStyle = React.useMemo(() => {
    const baseStyle = [{ width: '100%' as const }, style];
    if (measuredHeight !== null) {
      return [...baseStyle, { height: measuredHeight }];
    }
    return baseStyle;
  }, [style, measuredHeight]);

  return (
    <NativeView
      {...rest}
      style={combinedStyle}
      onContentSizeChange={handleContentSizeChange}
    />
  );
}
