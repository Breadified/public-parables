/**
 * Note Content Parser
 * Parses note content with Bible Peek/Verse Reference markers and renders blocks
 */

import React, { useRef, useState, useEffect, forwardRef, useImperativeHandle, useCallback } from "react";
import { View, TextInput, Text, StyleSheet } from "react-native";

import {
  parseNoteContent,
  serializeBlocks,
  type NoteBlock,
  createBiblePeekMarker,
  createVerseRefMarker,
  insertMarkerWithContext,
} from "@/modules/bible/markerParser";
import { detectVerseShorthand, detectReferenceAtLineEnd } from "@/modules/bible/referenceDetector";
import { findBookByPrefix } from "@/modules/bible/bibleBookMappings";
import { ScrollableTextInput } from "@/components/ScrollableTextInput";
import { getSmartCompletion } from "@/modules/bible/searchSuggestions";
import { BiblePeek } from "./BiblePeek";
import { VerseReference } from "./VerseReference";

export interface NoteContentParserProps {
  content: string;
  noteId: string;
  chapterId?: number; // For verse reference resolution
  onContentChange: (newContent: string, blocks: NoteBlock[]) => void;
  onFocus?: (blockId: string) => void;
  onBlur?: () => void;
  editable?: boolean;
  fontSize?: number; // For responsive font sizing
  lineHeight?: number; // For responsive line height
  fontFamily?: string; // For consistent font family
  paddingVertical?: number; // TextInput vertical padding (for ghost text positioning)
  // Styling props from NoteBody
  style?: any; // TextInput style
  placeholder?: string;
  placeholderTextColor?: string;
  // Gesture handlers
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeProgress?: (deltaX: number) => void;
  onSwipeCancel?: () => void;
  onTapAtY?: (screenY: number) => void;
}

export interface NoteContentParserRef {
  blur: () => void;
  focus: () => void;
}

export const NoteContentParser = forwardRef<NoteContentParserRef, NoteContentParserProps>((
  {
    content,
    noteId,
    chapterId,
    onContentChange,
    onFocus,
    onBlur,
    editable = true,
    fontSize,
    lineHeight,
    fontFamily,
    paddingVertical = 0,
    style,
    placeholder,
    placeholderTextColor,
    onSwipeLeft,
    onSwipeRight,
    onSwipeProgress,
    onSwipeCancel,
    onTapAtY,
  },
  ref
) => {
  // Block caching for performance - avoid recreating unchanged blocks
  const blocksRef = useRef<NoteBlock[]>([]);
  const previousContentRef = useRef<string>('');
  const previousChapterIdRef = useRef<number | undefined>(undefined);

  const blocks = React.useMemo(() => {
    // Fast path: if content and chapterId unchanged, return cached blocks
    if (previousContentRef.current === content && previousChapterIdRef.current === chapterId) {
      return blocksRef.current;
    }

    const newBlocks = parseNoteContent(content, chapterId);

    // Structural sharing: reuse unchanged block references
    const mergedBlocks = newBlocks.map((newBlock, idx) => {
      const oldBlock = blocksRef.current[idx];
      if (oldBlock && oldBlock.type === newBlock.type) {
        // Type-specific content comparison
        if (newBlock.type === 'text' && oldBlock.type === 'text') {
          if (oldBlock.content === newBlock.content) return oldBlock;
        } else if (newBlock.type === 'biblePeek' && oldBlock.type === 'biblePeek') {
          if (oldBlock.reference === newBlock.reference) return oldBlock;
        } else if (newBlock.type === 'verseRef' && oldBlock.type === 'verseRef') {
          if (oldBlock.verseNumber === newBlock.verseNumber) return oldBlock;
        }
      }
      return newBlock;
    });

    // Update cache
    previousContentRef.current = content;
    previousChapterIdRef.current = chapterId;
    blocksRef.current = mergedBlocks;

    return mergedBlocks;
  }, [content, chapterId]);

  // Track TextInput refs by index for programmatic focus
  const textInputRefs = useRef<Record<number, TextInput | null>>({});

  // Expose blur and focus methods to parent (focus first text block)
  useImperativeHandle(ref, () => ({
    blur: () => {
      // Blur all text inputs
      Object.values(textInputRefs.current).forEach(input => input?.blur());
    },
    focus: () => {
      // Focus the first text block (index 0)
      const firstInput = textInputRefs.current[0];
      if (firstInput) {
        firstInput.focus();
      }
    },
  }));

  // Track which block index to focus after marker insertion
  const [pendingFocusIndex, setPendingFocusIndex] = useState<number | null>(
    null
  );

  // Track autocomplete suggestion state for each block
  const [suggestionState, setSuggestionState] = useState<{
    blockIndex: number;
    inputText: string; // The text portion being typed that matches a book reference
  } | null>(null);

  // Debounce timer for suggestion calculation
  const suggestionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pre-compiled regex patterns for suggestion matching (avoid creating on every keystroke)
  const suggestionPatterns = useRef({
    spacedRef: /([1-3]?\s*[a-zA-Z]{2,}\s+\d+[:;]?\d*[-]?\d*)$/,
    compactRef: /([a-zA-Z0-9]+)$/,
    bookWithSpace: /([1-3]?\s*[a-zA-Z][a-zA-Z\s]*[a-zA-Z])$/,
    completeVerseRange: /:\d+-\d+$/,
    completeSingleVerse: /[:;]\d+$/,
    trailingSeparator: /[:;]$/,
    spaceSeparatedVerse: /\d+\s+\d+$/,
  }).current;

  // Apply focus after blocks re-render
  useEffect(() => {
    if (pendingFocusIndex !== null) {
      // Small delay to ensure blocks have re-rendered
      const timer = setTimeout(() => {
        const targetRef = textInputRefs.current[pendingFocusIndex];
        if (targetRef) {
          targetRef.focus();
        }
        setPendingFocusIndex(null);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [pendingFocusIndex, blocks]);

  // Cleanup suggestion timeout on unmount
  useEffect(() => {
    return () => {
      if (suggestionTimeoutRef.current) {
        clearTimeout(suggestionTimeoutRef.current);
      }
    };
  }, []);

  const handleTextChange = (blockIndex: number, newText: string) => {
    const updatedBlocks = [...blocks];
    const block = updatedBlocks[blockIndex];

    if (block?.type !== "text") return;

    const oldText = block.content;

    // Find where the change occurred by comparing old and new text
    // This allows detecting space/newline insertion anywhere, not just at the end
    let changePosition = -1;
    let addedChar = "";

    if (newText.length === oldText.length + 1) {
      // Single character was added - find where
      for (let i = 0; i < newText.length; i++) {
        if (i >= oldText.length || newText[i] !== oldText[i]) {
          changePosition = i;
          addedChar = newText[i];
          break;
        }
      }
    }

    const addedSpace = addedChar === " ";
    const addedNewline = addedChar === "\n";

    if ((addedSpace || addedNewline) && chapterId && changePosition >= 0) {
      // Get text before the trigger character
      const textBeforeTrigger = newText.slice(0, changePosition);

      // Get the line where the trigger occurred (text after last newline before trigger)
      const lastNewlineIndex = textBeforeTrigger.lastIndexOf("\n");
      const currentLine =
        lastNewlineIndex === -1
          ? textBeforeTrigger
          : textBeforeTrigger.slice(lastNewlineIndex + 1);

      // Search for verse patterns ONLY in current line
      const verseMatches = detectVerseShorthand(currentLine);
      const lastMatch = verseMatches[verseMatches.length - 1];

      // Only process if match ends at the END of current line (before the trigger)
      if (
        lastMatch &&
        lastMatch.endIndex === currentLine.length &&
        lastMatch.verseNumber
      ) {
        const marker = createVerseRefMarker(lastMatch.verseNumber);

        // Calculate ABSOLUTE positions in full text
        const lineStartOffset =
          lastNewlineIndex === -1 ? 0 : lastNewlineIndex + 1;
        const absoluteStart = lineStartOffset + lastMatch.startIndex;
        const absoluteEnd = lineStartOffset + lastMatch.endIndex;

        // insertMarkerWithContext handles replace vs insert logic:
        // - If pattern at line start: REPLACE pattern with marker
        // - If pattern mid-line: KEEP pattern, INSERT marker on next line
        const { content: processedText } = insertMarkerWithContext(
          textBeforeTrigger, // Text before the trigger
          marker,
          absoluteStart,
          absoluteEnd
        );

        // Append any text that was after the trigger position (for mid-text insertions)
        const textAfterTrigger = newText.slice(changePosition + 1);
        const finalText = processedText + (textAfterTrigger ? "\n" + textAfterTrigger : "");

        // Update and save
        updatedBlocks[blockIndex] = { ...block, content: finalText };
        onContentChange(serializeBlocks(updatedBlocks), updatedBlocks);

        // Focus the text block AFTER the marker (blockIndex + 2)
        // After re-parse: [TextBlock, VerseRefBlock, TextBlock] - we want the last one
        setPendingFocusIndex(blockIndex + 2);

        console.log(
          "[NoteContentParser] Converted",
          lastMatch.text,
          "to verse reference marker"
        );
        return;
      }

      // Check for Bible reference pattern (e.g., "John 3:16", "Mat 10:1-5")
      // Use shared detection function that matches the CommentInput logic
      const detectedRef = detectReferenceAtLineEnd(currentLine);

      if (detectedRef) {
        const marker = createBiblePeekMarker(detectedRef.reference);

        // Calculate absolute positions using detected reference positions
        const lineStartOffset =
          lastNewlineIndex === -1 ? 0 : lastNewlineIndex + 1;
        const absoluteStart = lineStartOffset + detectedRef.startIndex;
        const absoluteEnd = lineStartOffset + detectedRef.endIndex;

        const { content: processedText } = insertMarkerWithContext(
          textBeforeTrigger,
          marker,
          absoluteStart,
          absoluteEnd
        );

        // Append any text that was after the trigger position (for mid-text insertions)
        const textAfterTrigger = newText.slice(changePosition + 1);
        const finalText = processedText + (textAfterTrigger ? "\n" + textAfterTrigger : "");

        updatedBlocks[blockIndex] = { ...block, content: finalText };
        onContentChange(serializeBlocks(updatedBlocks), updatedBlocks);

        // Focus the text block AFTER the marker (blockIndex + 2)
        setPendingFocusIndex(blockIndex + 2);

        console.log(
          "[NoteContentParser] Converted",
          detectedRef.text,
          "to Bible peek marker"
        );
        return;
      }
    }

    // No pattern matched - update normally
    updatedBlocks[blockIndex] = { ...block, content: newText };
    const newContent = serializeBlocks(updatedBlocks);
    onContentChange(newContent, updatedBlocks);

    // Debounce suggestion calculation to avoid running on every keystroke
    // Clear any pending suggestion calculation
    if (suggestionTimeoutRef.current) {
      clearTimeout(suggestionTimeoutRef.current);
    }

    // Schedule suggestion calculation after a short delay (150ms)
    suggestionTimeoutRef.current = setTimeout(() => {
      calculateSuggestion(blockIndex, newText);
    }, 150);
  };

  // Memoized suggestion calculation function with early termination
  const calculateSuggestion = useCallback((blockIndex: number, newText: string) => {
    // Fast paths - terminate early for common cases that don't need suggestions
    if (newText.length < 3) {
      setSuggestionState(null);
      return;
    }
    const lastChar = newText[newText.length - 1];
    if (lastChar === '\n') {
      setSuggestionState(null);
      return;
    }

    // Check for Bible reference patterns at the END of the text (where cursor is when typing)
    // Trim trailing space for matching, but remember if it was there
    const trimmedText = newText.trimEnd();
    const endsWithSpace = newText.length > trimmedText.length;

    // Try to match spaced Bible reference pattern first (e.g., "Mat 10", "1 Cor 13")
    const spacedRefMatch = trimmedText.match(suggestionPatterns.spacedRef);

    // Also match compact format (e.g., "mat10", "mat10:")
    const compactRefMatch = trimmedText.match(suggestionPatterns.compactRef);
    const lastWord = compactRefMatch ? compactRefMatch[1] : "";

    // Match book name with trailing space (e.g., "Mat ", "Song Of Solomon ")
    const bookWithSpaceMatch = trimmedText.match(suggestionPatterns.bookWithSpace);

    // Determine which pattern to use for suggestion
    let inputTextForSuggestion = "";

    if (spacedRefMatch) {
      // Check if the spaced match looks like a Bible reference
      const spacedText = spacedRefMatch[1];
      const bookPart = spacedText.replace(/[\s\d:;-]+$/, "").trim();
      if (bookPart.length >= 2 && findBookByPrefix(bookPart)) {
        inputTextForSuggestion = spacedText;
      }
    }

    // Check for book name followed by space (e.g., "Mat ", "Genesis ", "Song Of Solomon ")
    if (!inputTextForSuggestion && endsWithSpace && bookWithSpaceMatch) {
      const potentialBook = bookWithSpaceMatch[1].trim();
      if (potentialBook.length >= 2 && findBookByPrefix(potentialBook)) {
        inputTextForSuggestion = potentialBook;
      }
    }

    // Fall back to compact format if spaced didn't match a book
    // IMPORTANT: Only show suggestion if there's an actual book match
    // Don't trigger on arbitrary 3+ letter words like "the", "and", etc.
    if (!inputTextForSuggestion && lastWord.length >= 3) {
      const bookOnlyPart = lastWord.replace(/\d.*$/, "");
      const hasBookMatch =
        bookOnlyPart.length >= 2 && findBookByPrefix(bookOnlyPart);

      // Only proceed if we actually matched a Bible book
      if (hasBookMatch) {
        inputTextForSuggestion = lastWord;
      }
    }

    // Show suggestion if we have a valid reference pattern
    if (inputTextForSuggestion) {
      // Don't suggest if already has complete verse range (e.g., "mat10:5-10" or "Mat 10:5-10")
      const hasCompleteVerseRange = suggestionPatterns.completeVerseRange.test(inputTextForSuggestion);
      const hasCompleteSingleVerse =
        suggestionPatterns.completeSingleVerse.test(inputTextForSuggestion) &&
        !suggestionPatterns.trailingSeparator.test(inputTextForSuggestion);
      // Also check for space-separated complete verse (e.g., "Mat 10 5")
      const hasSpaceSeparatedVerse = suggestionPatterns.spaceSeparatedVerse.test(inputTextForSuggestion);

      if (
        !hasCompleteVerseRange &&
        !hasCompleteSingleVerse &&
        !hasSpaceSeparatedVerse
      ) {
        setSuggestionState({
          blockIndex,
          inputText: inputTextForSuggestion,
        });
      } else {
        setSuggestionState(null);
      }
    } else {
      setSuggestionState(null);
    }
  }, [suggestionPatterns]);

  const handleDeleteBlock = (blockIndex: number) => {
    const updatedBlocks = blocks.filter((_, idx) => idx !== blockIndex);

    // Ensure we always have at least one text block
    if (updatedBlocks.length === 0) {
      updatedBlocks.push({
        id: `block_${Date.now()}`,
        type: "text",
        content: "",
      });
    }

    const newContent = serializeBlocks(updatedBlocks);
    onContentChange(newContent, updatedBlocks);
  };

  return (
    <View>
      {blocks.map((block, index) => {
        switch (block.type) {
          case "text":
            // Calculate suggestion for this block if active
            const blockSuggestion = suggestionState?.blockIndex === index
              ? getSmartCompletion(suggestionState.inputText, 1, true)
              : null;

            return (
              <View key={index} style={{ position: "relative" }}>
                {/* Background layer: shows content + ghost suggestion */}
                {blockSuggestion && (
                  <View style={suggestionStyles.ghostContainer} pointerEvents="none">
                    <Text
                      style={[
                        style,
                        suggestionStyles.ghostText,
                        { color: "transparent" }, // Hide the real text part
                      ]}
                    >
                      {block.content}
                      <Text style={{ color: placeholderTextColor || "#9CA3AF", fontStyle: "italic", opacity: 0.7 }}>
                        {blockSuggestion}
                      </Text>
                    </Text>
                  </View>
                )}
                {/* Foreground layer: actual editable TextInput */}
                <ScrollableTextInput
                  ref={(ref) => {
                    textInputRefs.current[index] = ref;
                  }}
                  value={block.content}
                  onChangeText={(text) => handleTextChange(index, text)}
                  placeholder={placeholder || "Write your note..."}
                  placeholderTextColor={placeholderTextColor}
                  multiline
                  onFocus={() => {
                    onFocus?.(block.id);
                  }}
                  onBlur={() => {
                    onBlur?.();
                    // Clear suggestion when losing focus
                    if (suggestionState?.blockIndex === index) {
                      setSuggestionState(null);
                    }
                  }}
                  editable={editable}
                  style={[style, blockSuggestion ? { backgroundColor: "transparent" } : null]}
                  onSwipeLeft={onSwipeLeft}
                  onSwipeRight={onSwipeRight}
                  onSwipeProgress={onSwipeProgress}
                  onSwipeCancel={onSwipeCancel}
                  onTapAtY={onTapAtY}
                />
              </View>
            );

          case "biblePeek":
            return (
              <BiblePeek
                key={index}
                reference={block.reference}
                bookNumber={block.bookNumber}
                chapter={block.chapter}
                verseStart={block.verseStart}
                verseEnd={block.verseEnd}
                noteId={noteId}
                onDelete={() => handleDeleteBlock(index)}
                fontSize={fontSize}
              />
            );

          case "verseRef":
            return (
              <VerseReference
                key={index}
                verseNumber={block.verseNumber}
                chapterId={block.chapterId}
                onDelete={() => handleDeleteBlock(index)}
                fontSize={fontSize}
                lineHeight={lineHeight}
                fontFamily={fontFamily}
              />
            );

          default:
            return null;
        }
      })}
    </View>
  );
});

NoteContentParser.displayName = "NoteContentParser";

// Styles for inline suggestion overlay
const suggestionStyles = StyleSheet.create({
  ghostContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  ghostText: {
    // Inherits style from the passed style prop
  },
});
