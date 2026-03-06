/**
 * NoteBody - Content input with horizontal rule separator
 * Now supports Bible Peek auto-conversion via NoteContentParser
 */

import React, { forwardRef, useRef } from "react";
import { View } from "react-native";
import { NoteContentParser, NoteContentParserRef } from "./NoteContentParser";

interface NoteBodyProps {
  content: string;
  onContentChange: (content: string) => void;
  placeholder: string;
  placeholderTextColor: string;
  isPoetry: boolean; // Whether to use poetry formatting
  contentWrapperStyle: any; // Dynamic wrapper style
  contentInputStyle: any; // Dynamic input style
  poetryInputStyle?: any; // Additional poetry style
  bottomDividerStyle: any; // Horizontal rule style
  dividerColor: string;
  bodyWrapperRef?: React.RefObject<View | null>; // Ref to body wrapper for position measurement
  noteId?: string; // For Bible Peek rendering
  chapterId?: number; // For verse reference auto-conversion
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeProgress?: (deltaX: number) => void;
  onSwipeCancel?: () => void;
  onFocus?: () => void; // Called when TextInput receives focus (for keyboard avoidance)
  onBlur?: () => void; // Called when TextInput loses focus (for keyboard avoidance)
  onTapAtY?: (screenY: number) => void; // Called when user taps TextInput with screen Y coordinate
  fontSize?: number; // For responsive font sizing
  lineHeight?: number; // For responsive line height
  fontFamily?: string; // For consistent font family
  paddingVertical?: number; // TextInput vertical padding (for ghost text positioning)
}

export interface NoteBodyRef {
  blur: () => void;
  focus: () => void;
}

export const NoteBody = forwardRef<NoteBodyRef, NoteBodyProps>(
  (
    {
      content,
      onContentChange,
      placeholder,
      placeholderTextColor,
      isPoetry,
      contentWrapperStyle,
      contentInputStyle,
      poetryInputStyle,
      bottomDividerStyle,
      dividerColor,
      bodyWrapperRef,
      noteId,
      chapterId,
      onSwipeLeft,
      onSwipeRight,
      onSwipeProgress,
      onSwipeCancel,
      onFocus,
      onBlur,
      onTapAtY,
      fontSize,
      lineHeight,
      fontFamily,
      paddingVertical,
    },
    ref
  ) => {
    const parserRef = useRef<NoteContentParserRef>(null);

    // Expose blur and focus methods to parent (forward to NoteContentParser)
    React.useImperativeHandle(ref, () => ({
      blur: () => {
        parserRef.current?.blur();
      },
      focus: () => {
        parserRef.current?.focus();
      },
    }));

    // Compute the style for text inputs
    const inputStyle = isPoetry
      ? [contentInputStyle, poetryInputStyle]
      : contentInputStyle;

    return (
      <View ref={bodyWrapperRef} style={contentWrapperStyle}>
        <NoteContentParser
          ref={parserRef}
          content={content}
          noteId={noteId || 'temp'}
          chapterId={chapterId}
          onContentChange={(newContent, blocks) => {
            onContentChange(newContent);
          }}
          onFocus={(blockId) => {
            console.log(`[NoteBody] onFocus called for block ${blockId}, has onFocus: ${!!onFocus}`);
            onFocus?.();
          }}
          onBlur={onBlur}
          editable={true}
          fontSize={fontSize}
          lineHeight={lineHeight}
          fontFamily={fontFamily}
          paddingVertical={paddingVertical}
          style={inputStyle}
          placeholder={placeholder}
          placeholderTextColor={placeholderTextColor}
          onSwipeLeft={onSwipeLeft}
          onSwipeRight={onSwipeRight}
          onSwipeProgress={onSwipeProgress}
          onSwipeCancel={onSwipeCancel}
          onTapAtY={onTapAtY}
        />
        {/* Horizontal rule at bottom of note */}
        <View
          style={[bottomDividerStyle, { backgroundColor: dividerColor }]}
        />
      </View>
    );
  }
);

NoteBody.displayName = "NoteBody";
