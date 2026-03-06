/**
 * Comment Content Parser
 * Parses comment content with Bible reference markers and renders blocks inline
 * Similar to NoteContentParser but for comments (no chapter context)
 *
 * Supports:
 * - Full Bible references: "John 3:16", "Genesis 1:1-3"
 * - Auto-converts on space/newline
 * - Cursor moves to new line after rendered verse
 */

import React, { useRef, useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { View, TextInput, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { parseReference } from "@/modules/bible/referenceParser";
import { detectReferenceAtLineEnd } from "@/modules/bible/referenceDetector";
import { ScrollableTextInput } from "@/components/ScrollableTextInput";
import VerseDisplay from "@/components/Devotion/VerseDisplay";
import { useTheme } from "@/contexts/ThemeContext";
import type { VerseReference } from "@/state";

// Block types for inline rendering
export type CommentBlockType = "text" | "bibleRef";

export interface TextBlock {
  id: string;
  type: "text";
  content: string;
}

export interface BibleRefBlock {
  id: string;
  type: "bibleRef";
  reference: string; // e.g., "John3:16"
  verseRef: VerseReference;
}

export type CommentBlock = TextBlock | BibleRefBlock;

/**
 * Marker pattern for Bible references in comments
 * Format: [[bibleRef:John3:16]] or [[bibleRef:John3:16-17]]
 */
const BIBLE_REF_MARKER = /\[\[bibleRef:([^\]]+)\]\]/g;

/**
 * Generate unique ID for blocks
 */
function generateBlockId(): string {
  return `block_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create Bible reference marker string
 */
export function createBibleRefMarker(ref: VerseReference): string {
  // Format: [[bibleRef:John3:16]] or [[bibleRef:John3:16-17]]
  const book = ref.reference.split(" ")[0]; // Get book name
  let marker = `${book}${ref.chapter}:${ref.verseStart}`;
  if (ref.verseEnd && ref.verseEnd !== ref.verseStart) {
    marker += `-${ref.verseEnd}`;
  }
  return `[[bibleRef:${marker}]]`;
}

/**
 * Parse comment content string into array of blocks
 */
export function parseCommentContent(content: string): CommentBlock[] {
  if (!content) {
    return [
      {
        id: generateBlockId(),
        type: "text",
        content: "",
      },
    ];
  }

  const blocks: CommentBlock[] = [];
  let lastIndex = 0;

  // Find all markers in content
  BIBLE_REF_MARKER.lastIndex = 0;
  let match;

  while ((match = BIBLE_REF_MARKER.exec(content)) !== null) {
    // Add text block before this marker (if any)
    if (match.index > lastIndex) {
      const textContent = content.slice(lastIndex, match.index);
      if (textContent) {
        blocks.push({
          id: generateBlockId(),
          type: "text",
          content: textContent,
        });
      }
    }

    // Parse the verse reference
    const refString = match[1]; // e.g., "John3:16" or "John3:16-17"
    const parsed = parseReference(refString);

    if (parsed.isValid && parsed.chapter && parsed.verseStart) {
      blocks.push({
        id: generateBlockId(),
        type: "bibleRef",
        reference: refString,
        verseRef: {
          reference: parsed.normalizedReference,
          bookNumber: parsed.bookNumber,
          chapter: parsed.chapter,
          verseStart: parsed.verseStart,
          verseEnd: parsed.verseEnd || parsed.verseStart,
        },
      });
    } else {
      // Invalid reference - keep as text
      blocks.push({
        id: generateBlockId(),
        type: "text",
        content: match[0],
      });
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text after last marker
  if (lastIndex < content.length) {
    const textContent = content.slice(lastIndex);
    if (textContent) {
      blocks.push({
        id: generateBlockId(),
        type: "text",
        content: textContent,
      });
    }
  }

  // Ensure we always have at least one text block
  if (blocks.length === 0) {
    blocks.push({
      id: generateBlockId(),
      type: "text",
      content: "",
    });
  }

  return blocks;
}

/**
 * Serialize blocks back to string with markers
 */
export function serializeCommentBlocks(blocks: CommentBlock[]): string {
  return blocks
    .map((block) => {
      switch (block.type) {
        case "text":
          return block.content;
        case "bibleRef":
          return `[[bibleRef:${block.reference}]]`;
        default:
          return "";
      }
    })
    .join("");
}

export interface CommentContentParserProps {
  content: string;
  onContentChange: (newContent: string, blocks: CommentBlock[]) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  editable?: boolean;
  placeholder?: string;
  placeholderTextColor?: string;
  textStyle?: any;
}

export interface CommentContentParserRef {
  blur: () => void;
  focus: () => void;
}

export const CommentContentParser = forwardRef<
  CommentContentParserRef,
  CommentContentParserProps
>(
  (
    {
      content,
      onContentChange,
      onFocus,
      onBlur,
      editable = true,
      placeholder,
      placeholderTextColor,
      textStyle,
    },
    ref
  ) => {
    const blocks = React.useMemo(() => parseCommentContent(content), [content]);

    // Track TextInput refs by index for programmatic focus
    const textInputRefs = useRef<Record<number, TextInput | null>>({});

    // Expose blur and focus methods to parent
    useImperativeHandle(ref, () => ({
      blur: () => {
        Object.values(textInputRefs.current).forEach((input) => input?.blur());
      },
      focus: () => {
        const firstInput = textInputRefs.current[0];
        if (firstInput) {
          firstInput.focus();
        }
      },
    }));

    // Track which block index to focus after marker insertion
    const [pendingFocusIndex, setPendingFocusIndex] = useState<number | null>(null);

    // Apply focus after blocks re-render
    useEffect(() => {
      if (pendingFocusIndex !== null) {
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

    const handleTextChange = (blockIndex: number, newText: string) => {
      const updatedBlocks = [...blocks];
      const block = updatedBlocks[blockIndex];

      if (block?.type !== "text") return;

      const oldText = block.content;

      // Find where the change occurred
      let changePosition = -1;
      let addedChar = "";

      if (newText.length === oldText.length + 1) {
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

      if ((addedSpace || addedNewline) && changePosition >= 0) {
        // Get text before the trigger character
        const textBeforeTrigger = newText.slice(0, changePosition);

        // Get the line where the trigger occurred
        const lastNewlineIndex = textBeforeTrigger.lastIndexOf("\n");
        const currentLine =
          lastNewlineIndex === -1
            ? textBeforeTrigger
            : textBeforeTrigger.slice(lastNewlineIndex + 1);

        // Check for Bible reference pattern at line end
        const detectedRef = detectReferenceAtLineEnd(currentLine);

        if (detectedRef) {
          // Create verse reference
          const verseRef: VerseReference = {
            reference: detectedRef.reference,
            bookNumber: detectedRef.bookNumber,
            chapter: detectedRef.chapter,
            verseStart: detectedRef.verseStart,
            verseEnd: detectedRef.verseEnd || detectedRef.verseStart,
          };

          const marker = createBibleRefMarker(verseRef);

          // Calculate absolute positions
          const lineStartOffset =
            lastNewlineIndex === -1 ? 0 : lastNewlineIndex + 1;
          const absoluteStart = lineStartOffset + detectedRef.startIndex;
          const isAtLineStart = absoluteStart === 0 || textBeforeTrigger[absoluteStart - 1] === "\n";

          let processedText: string;
          if (isAtLineStart) {
            // REPLACE: Pattern is at line start
            processedText =
              textBeforeTrigger.slice(0, absoluteStart) +
              marker +
              "\n";
          } else {
            // INSERT: Pattern is mid-line, keep text and add marker on next line
            processedText =
              textBeforeTrigger.slice(0, absoluteStart + detectedRef.text.length) +
              "\n" +
              marker +
              "\n";
          }

          // Append any text after the trigger position
          const textAfterTrigger = newText.slice(changePosition + 1);
          const finalText = processedText + textAfterTrigger;

          // Update and save
          updatedBlocks[blockIndex] = { ...block, content: finalText };
          onContentChange(serializeCommentBlocks(updatedBlocks), updatedBlocks);

          // Focus the text block AFTER the marker (blockIndex + 2)
          setPendingFocusIndex(blockIndex + 2);

          console.log(
            "[CommentContentParser] Converted",
            detectedRef.text,
            "to Bible reference marker"
          );
          return;
        }
      }

      // No pattern matched - update normally
      updatedBlocks[blockIndex] = { ...block, content: newText };
      const newContent = serializeCommentBlocks(updatedBlocks);
      onContentChange(newContent, updatedBlocks);
    };

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

      const newContent = serializeCommentBlocks(updatedBlocks);
      onContentChange(newContent, updatedBlocks);
    };

    // Get the index of the first text block (for placeholder display)
    const firstTextBlockIndex = blocks.findIndex((b) => b.type === "text");
    const { theme } = useTheme();

    return (
      <View style={styles.container}>
        {blocks.map((block, index) => {
          switch (block.type) {
            case "text":
              return (
                <ScrollableTextInput
                  key={block.id}
                  ref={(inputRef) => {
                    textInputRefs.current[index] = inputRef;
                  }}
                  value={block.content}
                  onChangeText={(text) => handleTextChange(index, text)}
                  placeholder={index === firstTextBlockIndex ? placeholder : undefined}
                  placeholderTextColor={placeholderTextColor}
                  multiline
                  onFocus={() => onFocus?.()}
                  onBlur={() => onBlur?.()}
                  editable={editable}
                  style={textStyle}
                />
              );

            case "bibleRef":
              return (
                <View key={block.id} style={styles.verseContainer}>
                  {/* Delete button */}
                  <TouchableOpacity
                    onPress={() => handleDeleteBlock(index)}
                    style={styles.deleteButton}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close-circle" size={18} color={theme.colors.text.muted} />
                  </TouchableOpacity>
                  <VerseDisplay
                    verseRef={block.verseRef}
                    showReference={true}
                    fontSize={12}
                    showReadChapter={false}
                  />
                </View>
              );

            default:
              return null;
          }
        })}
      </View>
    );
  }
);

CommentContentParser.displayName = "CommentContentParser";

const styles = StyleSheet.create({
  container: {
    // Blocks stack vertically
  },
  verseContainer: {
    marginVertical: 8,
    paddingHorizontal: 4,
    position: "relative",
  },
  deleteButton: {
    position: "absolute",
    top: 0,
    right: 0,
    zIndex: 10,
    padding: 4,
  },
});
