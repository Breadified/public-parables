/**
 * NoteEditor - Simple note editing component
 * Uses useNoteEditor hook for all logic
 * Auto-unfocuses on scroll for better UX
 * Matches Bible reader styling and theme
 *
 * COLLAPSIBLE: Notes can be collapsed/expanded
 * Multiple notes can be expanded simultaneously
 * Expansion state is persisted to AsyncStorage
 */

import React, { useRef, useImperativeHandle, forwardRef, useMemo, useEffect } from "react";
import { View, StyleSheet, Animated } from "react-native";
import { observer, useSelector } from "@legendapp/state/react";
import { NoteHeader } from "./NoteHeader";
import { NoteBody, NoteBodyRef } from "./NoteBody";
import { useNoteEditor } from "../../hooks/useNoteEditor";
import { useTheme } from "../../contexts/ThemeContext";
import { useDimensions } from "../../contexts/DimensionsContext";
import { getStudyModeFontSizes } from "../../utils/themeHelpers";
import { bibleStore$ } from "../../state/bibleStore";
import { notesStore$ } from "../../state/notesStore";
import { formatVerseReference } from "../../utils/verseReference";

interface NoteEditorProps {
  chapterId: number;
  verseId?: number | null;
  bookId: number;
  noteId?: string | null; // Specific note to edit (if null, creates new note)
  formattingType?: "prose" | "poetry" | "custom";
  placeholder?: string;
  debounceMs?: number;
  headerRef?: React.RefObject<View | null>; // Ref to header view for measurement
  bodyWrapperRef?: React.RefObject<View | null>; // Ref to body wrapper for keyboard avoidance measurement
  onNoteRelocate?: () => void; // Called when user wants to relocate note (bound callback from parent)
  onScrollToVerse?: (noteId: string) => void; // Called when user wants to scroll to verse in Bible reader
  onCopyText?: (noteId: string, content: string) => void; // Called when user wants to copy note text
  onShareNote?: (noteId: string, content: string) => void; // Called when user wants to share note
  onDelete?: () => void; // Called when user wants to delete note (screen-level handler)
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeProgress?: (deltaX: number) => void;
  onSwipeCancel?: () => void;
  onBodyFocus?: () => void; // Called when note body TextInput receives focus (for keyboard avoidance)
  onBodyBlur?: () => void; // Called when note body TextInput loses focus (for keyboard avoidance)
  onBodyTapAtY?: (screenY: number) => void; // Called when user taps note body with screen Y coordinate
}

export interface NoteEditorRef {
  blur: () => void;
  focus: () => void;
}

/**
 * Note Editor with Auto-Save
 * All logic delegated to useNoteEditor hook
 */
const NoteEditorComponent = forwardRef<NoteEditorRef, NoteEditorProps>(
  (
    {
      chapterId,
      verseId = null,
      bookId,
      noteId = null,
      formattingType = "prose",
      placeholder = "Write your notes here...",
      debounceMs = 1000,
      headerRef,
      bodyWrapperRef,
      onNoteRelocate,
      onScrollToVerse,
      onCopyText,
      onShareNote,
      onDelete,
      onSwipeLeft,
      onSwipeRight,
      onSwipeProgress,
      onSwipeCancel,
      onBodyFocus,
      onBodyBlur,
      onBodyTapAtY,
    },
    ref
  ) => {
    // Refs for content body
    const bodyRef = useRef<NoteBodyRef>(null);

    // Theme and dimensions for Bible-matching styling
    const { theme } = useTheme();
    const dimensions = useDimensions();

    // Use the hook - gets content with setter and action handlers
    const { note, content, setContent, handleRelocate } = useNoteEditor({
      chapterId,
      bookId,
      verseId,
      debounceMs,
      noteId,
    });

    // Get expansion state for this specific note
    // Use a stable key for the observable subscription (React hooks must be unconditional)
    const stableNoteId = note?.id || '__temp__';
    const expandedState = useSelector(bibleStore$.expandedNotes[stableNoteId]) ?? false;

    // For temp notes (noteId=null), default to expanded (show both title and body)
    const isExpanded = note?.id ? expandedState : true;

    // Highlight state for gradient animation (from Library navigation)
    const highlightedNoteId = useSelector(notesStore$.highlightedNoteId);
    const isHighlighted = note?.id && highlightedNoteId === note.id;
    const highlightOpacity = useRef(new Animated.Value(0)).current;

    // Animate highlight when note becomes highlighted
    useEffect(() => {
      if (isHighlighted) {
        // Animate: fade in -> hold -> fade out
        Animated.sequence([
          Animated.timing(highlightOpacity, {
            toValue: 1,
            duration: 200,
            useNativeDriver: false,
          }),
          Animated.delay(800),
          Animated.timing(highlightOpacity, {
            toValue: 0,
            duration: 400,
            useNativeDriver: false,
          }),
        ]).start(() => {
          // Clear highlight after animation
          notesStore$.setHighlightedNote(null);
        });
      }
      // highlightOpacity is a ref value, excluded from deps
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isHighlighted]);

    // Track previous expansion state to detect collapses
    const prevIsExpandedRef = React.useRef(isExpanded);

    // Track expansion state changes but DON'T auto-scroll
    // (Auto-scroll on collapse was causing conflicts with manual scrolling)
    React.useEffect(() => {
      prevIsExpandedRef.current = isExpanded;
    }, [isExpanded]);

    // Toggle expansion
    const handleToggleExpand = () => {
      // Only toggle if note has an ID (not empty placeholder)
      if (note?.id) {
        bibleStore$.toggleNoteExpansion(note.id);
      }
    };

    // Handle delete - calls screen-level handler
    const handleDeleteNote = () => {
      if (note?.id && onDelete) {
        onDelete();
      }
    };

    // Handle relocate request
    const handleRelocateRequest = () => {
      if (note?.id && onNoteRelocate) {
        onNoteRelocate();
      }
    };

    // Handle scroll to verse
    const handleScrollToVerse = () => {
      if (note?.id && onScrollToVerse) {
        onScrollToVerse(note.id);
      }
    };

    // Handle copy text
    const handleCopyText = () => {
      if (note?.id && onCopyText) {
        onCopyText(note.id, content);
      }
    };

    // Handle share note
    const handleShareNote = () => {
      if (note?.id && onShareNote) {
        onShareNote(note.id, content);
      }
    };

    // Expose blur and focus methods to parent
    useImperativeHandle(ref, () => ({
      blur: () => {
        bodyRef.current?.blur();
      },
      focus: () => {
        bodyRef.current?.focus();
      },
    }));

    // Create dynamic styles based on theme and dimensions (matches Bible reader)
    const { styles: dynamicStyles, fontSize: baseFontSize, lineHeight, fontFamily } = useMemo(() => {
      // Use exact same font size calculation as Bible prose viewer
      const responsiveFontSizes = getStudyModeFontSizes(dimensions.fontSize);
      const baseFontSize = responsiveFontSizes.base || 18;
      const lineHeight =
        baseFontSize * theme.bibleTypography.body.default.lineHeight;
      const fontFamily = theme.bibleTypography.body.default.fontFamily;

      return {
        fontSize: baseFontSize,
        lineHeight,
        fontFamily,
        styles: StyleSheet.create({
          container: {
            backgroundColor: theme.colors.background.primary,
          },
          headerWrapper: {
            paddingHorizontal: 0,
            paddingTop: dimensions.isSmallScreen ? 8 : 12,
            paddingBottom: 4,
          },
          headerContainer: {
            borderBottomWidth: 1,
            borderBottomColor: theme.colors.border,
          },
          contentWrapper: {
            paddingHorizontal: 12,
            paddingTop: 4,
            paddingBottom: 8,
          },
          contentInput: {
            fontSize: baseFontSize,
            color: theme.colors.text.primary,
            fontFamily: theme.bibleTypography.body.default.fontFamily,
            paddingVertical: 8,
            paddingHorizontal: 0,
            lineHeight: lineHeight,
          },
          poetryInput: {
            fontFamily: "monospace",
            lineHeight: lineHeight * 1.17, // Slightly more spacing for poetry
          },
          bottomDivider: {
            height: 1,
            marginTop: 16,
            marginBottom: 8,
            marginHorizontal: 20, // Shorter width with horizontal margin
          },
        }),
      };
    }, [theme, dimensions]);

    // Generate verse reference for header
    const verseReference = note ? formatVerseReference(note) : 'New Note';

    return (
      <View style={dynamicStyles.container}>
        {/* Gradient highlight overlay for Library navigation */}
        {isHighlighted && (
          <Animated.View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: theme.colors.accent,
                opacity: highlightOpacity.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 0.12],
                }),
                borderRadius: 8,
              },
            ]}
          />
        )}

        {/* Note Header - adapts based on expansion state */}
        {note && (
          <NoteHeader
            note={note}
            content={content}
            isExpanded={isExpanded}
            onToggleExpand={handleToggleExpand}
            onDelete={handleDeleteNote}
            onRelocate={handleRelocateRequest}
            onScrollToVerse={handleScrollToVerse}
            onCopy={handleCopyText}
            onShare={handleShareNote}
            canToggle={!!note}
            headerRef={headerRef}
            wrapperStyle={dynamicStyles.headerWrapper}
            containerStyle={dynamicStyles.headerContainer}
            textColor={theme.colors.text.primary}
            accentColor={theme.colors.accent}
            backgroundColor={theme.colors.background.primary}
            placeholderTextColor={theme.colors.text.secondary}
            timestampTextColor={theme.colors.text.muted}
            verseReference={verseReference}
            baseFontSize={baseFontSize}
            fontFamily={theme.bibleTypography.body.default.fontFamily}
          />
        )}

        {/* Content body - only render when expanded */}
        {isExpanded && (
          <>
            <NoteBody
              ref={bodyRef}
              content={content}
              onContentChange={setContent}
              placeholder={placeholder}
              placeholderTextColor={theme.colors.text.secondary}
              isPoetry={formattingType === "poetry"}
              contentWrapperStyle={dynamicStyles.contentWrapper}
              contentInputStyle={dynamicStyles.contentInput}
              poetryInputStyle={dynamicStyles.poetryInput}
              bottomDividerStyle={dynamicStyles.bottomDivider}
              dividerColor={theme.colors.border}
              bodyWrapperRef={bodyWrapperRef}
              noteId={note?.id}
              chapterId={chapterId}
              onSwipeLeft={onSwipeLeft}
              onSwipeRight={onSwipeRight}
              onSwipeProgress={onSwipeProgress}
              onSwipeCancel={onSwipeCancel}
              onFocus={onBodyFocus}
              onBlur={onBodyBlur}
              onTapAtY={onBodyTapAtY}
              fontSize={baseFontSize}
              lineHeight={lineHeight}
              fontFamily={fontFamily}
              paddingVertical={8}
            />
          </>
        )}
      </View>
    );
  }
);

NoteEditorComponent.displayName = "NoteEditorComponent";

// Export with observer wrapper
export const NoteEditor = observer(NoteEditorComponent);
