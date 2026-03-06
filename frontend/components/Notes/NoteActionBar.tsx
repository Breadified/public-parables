/**
 * NoteActionBar - Reusable action bar for notes
 * - Shows verse reference badge and menu button
 * - Used in both expanded note header and sticky header
 * - Includes optional timestamp display and options menu
 */

import React, { useState, useRef } from "react";
import { View, TouchableOpacity, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { formatTimestamp } from "../../utils/dateFormatters";
import { NoteOptionsMenu } from "./NoteOptionsMenu";

interface NoteActionBarProps {
  verseReference: string; // Formatted verse reference (e.g., "Psalm 23:1")
  updatedAt?: string; // ISO timestamp for note
  onScrollToVerse?: () => void; // Callback to scroll Bible reader to verse
  onToggleExpand: () => void; // Callback to toggle note expansion
  onDelete?: () => void; // Callback to delete note
  onRelocate?: () => void; // Callback to relocate note
  onCopy?: () => void; // Callback to copy note text
  onShare?: () => void; // Callback to share note
  canToggle: boolean; // Whether the note can be collapsed/expanded
  containerStyle?: any; // Dynamic container style
  textColor: string;
  accentColor: string;
  backgroundColor: string;
  timestampTextColor: string;
  showTimestamp?: boolean; // Whether to show timestamp (default: true)
}

export const NoteActionBar = ({
  verseReference,
  updatedAt,
  onScrollToVerse,
  onToggleExpand,
  onDelete,
  onRelocate,
  onCopy,
  onShare,
  canToggle,
  containerStyle,
  textColor,
  accentColor,
  backgroundColor,
  timestampTextColor,
  showTimestamp = true,
}: NoteActionBarProps) => {
  // Menu state
  const [showMenu, setShowMenu] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<{ x: number; y: number } | null>(null);

  // Ref for menu button
  const menuButtonRef = useRef<View>(null);

  return (
    <>
      <View style={[containerStyle, styles.expandedContainer]}>
        {/* Left: Verse Reference Badge - Scrolls to verse */}
        <TouchableOpacity
          style={[styles.verseReferenceBadge, { backgroundColor: `${accentColor}20` }]}
          onPress={onScrollToVerse}
          activeOpacity={0.7}
        >
          <Ionicons name="location" size={14} color={accentColor} style={{ marginRight: 4 }} />
          <Text style={[styles.verseReferenceText, { color: accentColor }]}>
            {verseReference}
          </Text>
        </TouchableOpacity>

        {/* Right: Menu Button - Simple horizontal ellipsis */}
        <TouchableOpacity
          ref={menuButtonRef}
          onPress={() => {
            menuButtonRef.current?.measureInWindow((x: number, y: number, width: number, height: number) => {
              setMenuAnchor({ x: x + width, y: y + height });
              setShowMenu(true);
            });
          }}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.menuButton}
        >
          <Ionicons name="ellipsis-horizontal" size={20} color={textColor} />
        </TouchableOpacity>
      </View>

      {/* Timestamp - Below Action Bar */}
      {showTimestamp && updatedAt && (
        <View style={styles.expandedTimestampWrapper}>
          <Text style={[styles.expandedTimestamp, { color: timestampTextColor }]}>
            Updated: {formatTimestamp(updatedAt)}
          </Text>
        </View>
      )}

      {/* Options Menu */}
      <NoteOptionsMenu
        visible={showMenu}
        onClose={() => setShowMenu(false)}
        onCollapse={canToggle ? onToggleExpand : undefined}
        onDelete={() => onDelete?.()}
        onRelocate={() => onRelocate?.()}
        onCopy={() => onCopy?.()}
        onShare={() => onShare?.()}
        anchorX={menuAnchor?.x}
        anchorY={menuAnchor?.y}
      />
    </>
  );
};

const styles = StyleSheet.create({
  expandedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  verseReferenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  verseReferenceText: {
    fontSize: 13,
    fontWeight: '600',
  },
  menuButton: {
    padding: 4,
  },
  expandedTimestampWrapper: {
    marginTop: 2,
    paddingHorizontal: 12,
  },
  expandedTimestamp: {
    fontSize: 8,
    textAlign: 'right',
  },
});
