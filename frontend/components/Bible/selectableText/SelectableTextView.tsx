import { requireNativeViewManager } from 'expo-modules-core';
import * as React from 'react';
import { ViewProps } from 'react-native';
import { StyleSpec } from './styleSpec';

// Action types for the custom context menu
export type SelectableTextAction = 'copy' | 'share' | 'note' | 'highlight' | 'bookmark';

// Event emitted when user selects an action
export interface SelectableTextEvent {
  action: SelectableTextAction;
  selectedText: string;
  verseId?: number;
  selectionStart: number;
  selectionEnd: number;
}

export interface ContentSizeChangeEvent {
  width: number;
  height: number;
}

// Character-range based highlight for paragraph-level rendering
export interface TextRangeHighlight {
  startIndex: number;
  endIndex: number;
  color: string; // Hex color string e.g. "#FFEB3B"
}

// Per-line indentation for poetry (applied via native paragraph styles)
export interface LineIndent {
  startIndex: number;  // Character position where this line starts
  endIndex: number;    // Character position where this line ends (before newline)
  indent: number;      // Indent in dp/points for this line's first line
}

export interface SelectableTextViewProps extends ViewProps {
  /** The text content to display */
  text: string;
  /** Optional verse ID for tracking which verse is selected */
  verseId?: number;

  /**
   * Style specification from React Native (preferred)
   * All styling is defined in React Native - native modules only apply styles
   * Uses "prose" section for paragraph styling
   */
  styleSpec?: StyleSpec;

  // Legacy individual props (fallback when styleSpec not provided)
  /** @deprecated Use styleSpec instead */
  fontSize?: number;
  /** @deprecated Use styleSpec instead */
  fontFamily?: string;
  /** @deprecated Use styleSpec instead */
  textColor?: string;
  /** @deprecated Use styleSpec instead */
  verseNumberColor?: string;
  /** @deprecated Use styleSpec instead */
  lineHeight?: number;

  /**
   * First-line indent in points/dp (for poetry)
   * Only the first line is indented; wrapped lines start at left margin
   */
  indent?: number;

  /**
   * Highlight ranges for persisted verse highlights
   * Each highlight specifies a character range and background color
   */
  highlights?: TextRangeHighlight[];

  /**
   * Per-line indentation for poetry
   * Each entry specifies a character range and its first-line indent
   * Used when rendering flattened poetry with newlines between lines
   */
  lineIndents?: LineIndent[];

  /** Callback when user selects an action from the context menu */
  onAction?: (event: { nativeEvent: SelectableTextEvent }) => void;
  /** Callback when content size changes (after text measurement) */
  onContentSizeChange?: (event: { nativeEvent: ContentSizeChangeEvent }) => void;
}

const NativeView: React.ComponentType<SelectableTextViewProps> = requireNativeViewManager('ExpoSelectableText');

/**
 * SelectableTextView - Native text view with custom context menu
 *
 * Provides native text selection (blue highlight + drag handles) with a custom
 * context menu containing: Copy, Share, Note, Highlight, Bookmark
 *
 * The native context menu (copy/paste) is replaced with our custom actions.
 *
 * Uses onContentSizeChange to dynamically size itself based on measured content.
 */
export default function SelectableTextView(props: SelectableTextViewProps) {
  const { style, onContentSizeChange, ...rest } = props;
  const [measuredHeight, setMeasuredHeight] = React.useState<number | null>(null);

  const handleContentSizeChange = React.useCallback((event: { nativeEvent: ContentSizeChangeEvent }) => {
    const { height } = event.nativeEvent;
    if (height > 0) {
      setMeasuredHeight(height);
    }
    // Forward to prop callback if provided
    onContentSizeChange?.(event);
  }, [onContentSizeChange]);

  // Combine styles: user style + measured height
  const combinedStyle = React.useMemo(() => {
    const baseStyle = style || {};
    if (measuredHeight !== null) {
      return [baseStyle, { height: measuredHeight }];
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
