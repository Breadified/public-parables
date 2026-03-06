/**
 * RichText - Renders comment content with Bible verse embeds inline
 *
 * Storage format:
 * ```
 * I love this verse:
 * [[bibleRef:John3:16]]
 * It shows God's love
 * ```
 *
 * Renders as: Text and verse embeds inline, wherever markers appear
 * When collapsed: Height-limited with gradient fade effect
 *
 * Note: VerseDisplay handles its own "Read chapter" modal internally
 */

import React, { useMemo, useState, useCallback } from "react";
import { View, Text, StyleSheet } from "react-native";
import type { StyleProp, TextStyle, LayoutChangeEvent } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { useTheme } from "@/contexts/ThemeContext";
import { toTransparent } from "@/utils/themeHelpers";
import { parseReference } from "@/modules/bible/referenceParser";
import type { VerseReference } from "@/state";
import VerseDisplay from "@/components/Devotion/VerseDisplay";

interface RichTextProps {
  content: string;
  textStyle: StyleProp<TextStyle>;
  maxHeight?: number; // Max height before truncation (default: 100)
  onTruncationChange?: (isTruncated: boolean) => void;
  isExpanded?: boolean; // Whether to show full content
  backgroundColor?: string; // Background color for gradient fade (default: theme.colors.background.primary)
}

// Block types for inline rendering
type CommentBlock =
  | { type: "text"; content: string }
  | { type: "verseRef"; verseRef: VerseReference };

// Regex to match [[bibleRef:John3:16]] or [[bibleRef:John3:16-17]] markers
const BIBLE_REF_MARKER = /\[\[bibleRef:([^\]]+)\]\]/g;

/**
 * Strip Bible reference markers from content for plain text display
 * Replaces [[bibleRef:John3:16]] with "(John 3:16)"
 * Useful for collapsed previews where we can't render full verse embeds
 */
export function stripBibleRefMarkers(content: string): string {
  return content.replace(BIBLE_REF_MARKER, (_, refString) => {
    // Parse the reference to get a clean format
    const parsed = parseReference(refString);
    if (parsed.isValid && parsed.normalizedReference) {
      return `(${parsed.normalizedReference})`;
    }
    // Fallback: just show the raw reference
    return `(${refString})`;
  });
}

/**
 * Parse content into blocks (text and verse references)
 * Renders markers inline wherever they appear in the content
 */
function parseContentIntoBlocks(content: string): CommentBlock[] {
  const blocks: CommentBlock[] = [];
  let lastIndex = 0;

  // Find all markers in order
  BIBLE_REF_MARKER.lastIndex = 0;
  let match;

  while ((match = BIBLE_REF_MARKER.exec(content)) !== null) {
    // Add text block before this marker (if any)
    if (match.index > lastIndex) {
      const textContent = content.slice(lastIndex, match.index);
      // Trim trailing newlines from text before markers, but preserve leading content
      const trimmedText = textContent.replace(/\n+$/, "");
      if (trimmedText) {
        blocks.push({ type: "text", content: trimmedText });
      }
    }

    // Parse the verse reference
    const refString = match[1]; // e.g., "John3:16" or "John3:16-17"
    const parsed = parseReference(refString);

    if (parsed.isValid && parsed.chapter && parsed.verseStart) {
      blocks.push({
        type: "verseRef",
        verseRef: {
          reference: parsed.normalizedReference,
          bookNumber: parsed.bookNumber,
          chapter: parsed.chapter,
          verseStart: parsed.verseStart,
          verseEnd: parsed.verseEnd || parsed.verseStart,
        },
      });
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text after last marker
  if (lastIndex < content.length) {
    const textContent = content.slice(lastIndex);
    // Trim leading newlines from text after markers
    const trimmedText = textContent.replace(/^\n+/, "").trim();
    if (trimmedText) {
      blocks.push({ type: "text", content: trimmedText });
    }
  }

  return blocks;
}

// Height for gradient fade overlay
const GRADIENT_HEIGHT = 32;

/**
 * Render a single block (text or verse reference)
 * Note: VerseDisplay handles its own "Read chapter" modal internally
 */
const renderBlock = (
  block: CommentBlock,
  index: number,
  textStyle: StyleProp<TextStyle>,
  keyPrefix: string = ""
) => {
  if (block.type === "text") {
    return (
      <Text key={`${keyPrefix}text-${index}`} style={textStyle}>
        {block.content}
      </Text>
    );
  }

  if (block.type === "verseRef") {
    const { verseRef } = block;
    return (
      <View
        key={`${keyPrefix}verse-${verseRef.bookNumber}-${verseRef.chapter}-${verseRef.verseStart}-${index}`}
        style={styles.verseContainer}
      >
        <VerseDisplay
          verseRef={verseRef}
          showReference={true}
          fontSize={13}
        />
      </View>
    );
  }

  return null;
};

const RichText = ({
  content,
  textStyle,
  maxHeight = 100,
  onTruncationChange,
  isExpanded = false,
  backgroundColor,
}: RichTextProps) => {
  const { theme } = useTheme();
  const [contentHeight, setContentHeight] = useState(0);
  const [hasMeasured, setHasMeasured] = useState(false);

  // Parse content into blocks for inline rendering
  const blocks = useMemo(() => parseContentIntoBlocks(content), [content]);

  // Ensure text style always has theme-appropriate color as fallback
  const themedTextStyle = useMemo(
    () => [{ color: theme.colors.text.secondary }, textStyle],
    [theme.colors.text.secondary, textStyle]
  );

  // Check if content exceeds max height
  const isTruncated = hasMeasured && contentHeight > maxHeight;

  // Notify parent of truncation state
  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const height = e.nativeEvent.layout.height;
    setContentHeight(height);
    setHasMeasured(true);
    onTruncationChange?.(height > maxHeight);
  }, [maxHeight, onTruncationChange]);

  // Gradient colors for fade effect (use toTransparent, not "transparent" - iOS renders it as black)
  const bgColor = backgroundColor || theme.colors.background.primary;
  const gradientColors: [string, string] = [
    toTransparent(bgColor),
    bgColor,
  ];

  // When expanded, show full content without height limit
  if (isExpanded) {
    return (
      <View style={styles.container}>
        {blocks.map((block, index) => renderBlock(block, index, themedTextStyle))}
      </View>
    );
  }

  // Collapsed view with height limit and gradient fade
  return (
    <View style={styles.container}>
      {/* Measure full content height (invisible) */}
      {!hasMeasured && (
        <View style={styles.measureContainer} onLayout={handleLayout} pointerEvents="none">
          {blocks.map((block, index) => renderBlock(block, index, themedTextStyle, "measure-"))}
        </View>
      )}

      {/* Visible content with height limit */}
      <View style={[styles.contentWrapper, { maxHeight: isTruncated ? maxHeight : undefined }]}>
        {blocks.map((block, index) => renderBlock(block, index, themedTextStyle))}

        {/* Gradient fade overlay when truncated */}
        {isTruncated && (
          <LinearGradient
            colors={gradientColors}
            style={styles.fadeGradient}
            pointerEvents="none"
          />
        )}
      </View>
    </View>
  );
};

export default RichText;

const styles = StyleSheet.create({
  container: {
    gap: 4,
  },
  measureContainer: {
    position: "absolute",
    opacity: 0,
    pointerEvents: "none",
  },
  contentWrapper: {
    overflow: "hidden",
  },
  verseContainer: {
    marginTop: 8,
  },
  fadeGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: GRADIENT_HEIGHT,
  },
});
