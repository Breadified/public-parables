/**
 * NoteHeader - Header for notes that adapts based on expansion state
 * - When collapsed: Shows 2-3 line content preview with gradient fade
 * - When expanded: Shows action bar with verse reference, menu button, and chevron
 */

import React from "react";
import { View, TouchableOpacity, Text, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { formatTimestamp } from "../../utils/dateFormatters";
import { getTextPreview } from "../../utils/textPreview";
import { NoteActionBar } from "./NoteActionBar";
import type { Note } from "../../types/database";

interface NoteHeaderProps {
  note: Note;
  content: string;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onDelete?: () => void;
  onRelocate?: () => void;
  onScrollToVerse?: () => void; // Auto-scroll Bible reader to verse
  onCopy?: () => void; // Copy note text
  onShare?: () => void; // Share note
  canToggle: boolean; // Whether the note can be collapsed/expanded
  headerRef?: React.RefObject<View | null>; // Ref for measurements
  wrapperStyle: any; // Wrapper padding style
  containerStyle: any; // Dynamic container style
  textColor: string;
  accentColor: string;
  backgroundColor: string;
  placeholderTextColor: string;
  timestampTextColor: string;
  verseReference: string; // Formatted verse reference (e.g., "Psalm 23:1")
  baseFontSize: number; // Font size from parent (matches expanded body)
  fontFamily: string; // Font family from parent (matches expanded body)
}

export const NoteHeader = ({
  note,
  content,
  isExpanded,
  onToggleExpand,
  onDelete,
  onRelocate,
  onScrollToVerse,
  onCopy,
  onShare,
  canToggle,
  headerRef,
  wrapperStyle,
  containerStyle,
  textColor,
  accentColor,
  backgroundColor,
  placeholderTextColor,
  timestampTextColor,
  verseReference,
  baseFontSize,
  fontFamily,
}: NoteHeaderProps) => {
  // Generate preview for collapsed state
  const { preview } = getTextPreview(content, 3, 60);

  // Calculate line height based on font size (matching expanded body)
  const lineHeight = baseFontSize * 1.4; // 1.4 is common line-height ratio

  if (!isExpanded) {
    // COLLAPSED STATE: Show content preview
    return (
      <View
        ref={headerRef}
        style={wrapperStyle}
      >
        <TouchableOpacity
          style={[containerStyle, styles.collapsedContainer]}
          onPress={() => {
            if (canToggle) {
              onToggleExpand();
            }
          }}
          activeOpacity={0.7}
        >
          {/* Verse Reference Badge */}
          <TouchableOpacity
            style={[
              styles.collapsedBadge,
              { backgroundColor: `${accentColor}20` },
            ]}
            onPress={onScrollToVerse}
            activeOpacity={0.7}
          >
            <Ionicons
              name="location"
              size={14}
              color={accentColor}
              style={{ marginRight: 4 }}
            />
            <Text style={[styles.collapsedBadgeText, { color: accentColor }]}>
              {verseReference}
            </Text>
          </TouchableOpacity>

          {/* Preview Text */}
          <View style={styles.previewWrapper}>
            <Text
              style={[
                styles.previewText,
                {
                  color: textColor,
                  fontSize: baseFontSize,
                  lineHeight: lineHeight,
                  fontFamily: fontFamily,
                },
              ]}
              numberOfLines={3}
              ellipsizeMode="clip"
            >
              {preview || (
                <Text style={{ color: placeholderTextColor }}>Empty note</Text>
              )}
            </Text>

            {/* Gradient Fade - Always visible for fade effect */}
            <LinearGradient
              colors={[
                `${backgroundColor}00`, // Fully transparent at top
                `${backgroundColor}`, // Fully opaque at bottom
              ]}
              style={styles.gradientFade}
              pointerEvents="none"
            />
          </View>

          {/* Timestamp - Bottom Right */}
          {note.updated_at && (
            <Text
              style={[styles.collapsedTimestamp, { color: timestampTextColor }]}
            >
              {formatTimestamp(note.updated_at)}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    );
  }

  // EXPANDED STATE: Show action bar
  return (
    <View ref={headerRef} style={wrapperStyle}>
      <NoteActionBar
        verseReference={verseReference}
        updatedAt={note.updated_at}
        onScrollToVerse={onScrollToVerse}
        onToggleExpand={onToggleExpand}
        onDelete={onDelete}
        onRelocate={onRelocate}
        onCopy={onCopy}
        onShare={onShare}
        canToggle={canToggle}
        containerStyle={containerStyle}
        textColor={textColor}
        accentColor={accentColor}
        backgroundColor={backgroundColor}
        timestampTextColor={timestampTextColor}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  // COLLAPSED STATE STYLES
  collapsedContainer: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    position: "relative",
  },
  collapsedBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: "flex-start",
    marginBottom: 8,
  },
  collapsedBadgeText: {
    fontSize: 13,
    fontWeight: "600",
  },
  previewWrapper: {
    position: "relative",
    paddingBottom: 16, // Space for timestamp
  },
  previewText: {
    // fontSize and lineHeight are now dynamic (passed from parent to match expanded body)
  },
  gradientFade: {
    position: "absolute",
    bottom: 15,
    left: 0,
    right: 0,
    height: 44,
  },
  collapsedTimestamp: {
    position: "absolute",
    bottom: 12,
    right: 12,
    fontSize: 8,
  },
});
