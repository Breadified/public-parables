/**
 * NoteListItem - Note card for Library display
 * Shows verse reference, content preview, and timestamp
 */

import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { observer } from "@legendapp/state/react";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/contexts/ThemeContext";
import { getBookName } from "@/modules/bible/bibleBookMappings";
import type { NoteData } from "@/state";

interface NoteListItemProps {
  note: NoteData;
  onPress: () => void;
}

/**
 * Format verse reference from note data
 */
function formatNoteReference(note: NoteData): string | null {
  // Chapter-level note
  if (note.chapter_id && !note.verse_id) {
    const bookId = Math.floor(note.chapter_id / 1000000);
    const chapter = Math.floor((note.chapter_id % 1000000) / 1000);
    const bookName = getBookName(bookId);
    return bookName ? `${bookName} ${chapter}` : null;
  }

  // Verse-level note
  if (note.verse_id) {
    const bookId = Math.floor(note.verse_id / 1000000);
    const chapter = Math.floor((note.verse_id % 1000000) / 1000);
    const verse = note.verse_id % 1000;
    const bookName = getBookName(bookId);
    return bookName ? `${bookName} ${chapter}:${verse}` : null;
  }

  // Book-level note
  if (note.book_id) {
    const bookName = getBookName(note.book_id);
    return bookName || null;
  }

  return null;
}

const NoteListItem = observer(function NoteListItem({
  note,
  onPress,
}: NoteListItemProps) {
  const { theme } = useTheme();

  // Format timestamp
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffDays < 1) {
      const diffHours = Math.floor(diffMs / 3600000);
      if (diffHours < 1) {
        const diffMins = Math.floor(diffMs / 60000);
        return diffMins < 1 ? "Just now" : `${diffMins}m ago`;
      }
      return `${diffHours}h ago`;
    }
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;

    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  };

  const reference = formatNoteReference(note);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        {
          backgroundColor: pressed
            ? theme.colors.background.secondary
            : theme.colors.background.primary,
          borderBottomColor: theme.colors.border,
        },
      ]}
    >
      {/* Header with reference badge and timestamp */}
      <View style={styles.header}>
        {reference && (
          <View
            style={[
              styles.referenceBadge,
              { backgroundColor: `${theme.colors.accent}20` },
            ]}
          >
            <Ionicons
              name="book-outline"
              size={12}
              color={theme.colors.accent}
            />
            <Text style={[styles.referenceText, { color: theme.colors.accent }]}>
              {reference}
            </Text>
          </View>
        )}
        <Text style={[styles.timestamp, { color: theme.colors.text.muted }]}>
          {formatTime(note.updated_at)}
        </Text>
      </View>

      {/* Note content preview */}
      <Text
        style={[styles.contentText, { color: theme.colors.text.primary }]}
        numberOfLines={3}
      >
        {note.content}
      </Text>

      {/* Footer with tags and navigation */}
      <View style={styles.footer}>
        <View style={styles.tagsRow}>
          {note.tags && note.tags.length > 0 && (
            <>
              {note.tags.slice(0, 3).map((tag, index) => (
                <View
                  key={index}
                  style={[
                    styles.tag,
                    { backgroundColor: theme.colors.background.secondary },
                  ]}
                >
                  <Text style={[styles.tagText, { color: theme.colors.text.muted }]}>
                    #{tag}
                  </Text>
                </View>
              ))}
              {note.tags.length > 3 && (
                <Text style={[styles.moreTagsText, { color: theme.colors.text.muted }]}>
                  +{note.tags.length - 3}
                </Text>
              )}
            </>
          )}
        </View>

        {/* Navigation indicator */}
        <View style={styles.navIndicator}>
          <Text style={[styles.navText, { color: theme.colors.accent }]}>
            Open
          </Text>
          <Ionicons
            name="chevron-forward"
            size={14}
            color={theme.colors.accent}
          />
        </View>
      </View>
    </Pressable>
  );
});

export default NoteListItem;

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  referenceBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  referenceText: {
    fontSize: 12,
    fontWeight: "600",
  },
  timestamp: {
    fontSize: 12,
  },
  contentText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  tagsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  tag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tagText: {
    fontSize: 11,
  },
  moreTagsText: {
    fontSize: 11,
  },
  navIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  navText: {
    fontSize: 12,
    fontWeight: "500",
  },
});
