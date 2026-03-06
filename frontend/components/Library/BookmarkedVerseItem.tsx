/**
 * BookmarkedVerseItem - Bookmark card for Library display
 * Shows verse reference, optional title, and timestamp
 */

import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { observer } from "@legendapp/state/react";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/contexts/ThemeContext";
import { getBookName } from "@/modules/bible/bibleBookMappings";
import type { Bookmark } from "@/types/database";

interface BookmarkedVerseItemProps {
  bookmark: Bookmark;
  onPress: () => void;
}

/**
 * Parse verse_line_id to get verse reference
 * Format: {verseId}_{suffix} where verseId is BBCCCVVV
 */
function parseVerseLineId(verseLineId: string): {
  bookId: number;
  chapter: number;
  verse: number;
} | null {
  const parts = verseLineId.split('_');
  if (parts.length < 2) return null;

  const verseId = parseInt(parts[0], 10);
  if (isNaN(verseId)) return null;

  const bookId = Math.floor(verseId / 1000000);
  const chapter = Math.floor((verseId % 1000000) / 1000);
  const verse = verseId % 1000;

  return { bookId, chapter, verse };
}

/**
 * Format verse reference from bookmark data
 */
function formatBookmarkReference(bookmark: Bookmark): string | null {
  const parsed = parseVerseLineId(bookmark.verse_line_id);
  if (!parsed) return null;

  const bookName = getBookName(parsed.bookId);
  if (!bookName) return null;

  return `${bookName} ${parsed.chapter}:${parsed.verse}`;
}

/**
 * Format relative timestamp
 */
function formatTime(timestamp: string): string {
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
}

const BookmarkedVerseItem = observer(function BookmarkedVerseItem({
  bookmark,
  onPress,
}: BookmarkedVerseItemProps) {
  const { theme } = useTheme();

  const reference = formatBookmarkReference(bookmark);

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
      {/* Color indicator and reference */}
      <View style={styles.header}>
        <View style={styles.referenceRow}>
          {/* Color dot indicator */}
          <View
            style={[
              styles.colorDot,
              {
                backgroundColor:
                  bookmark.color === "default"
                    ? theme.colors.accent
                    : bookmark.color,
              },
            ]}
          />

          {/* Reference badge */}
          {reference && (
            <View
              style={[
                styles.referenceBadge,
                { backgroundColor: `${theme.colors.accent}20` },
              ]}
            >
              <Ionicons
                name="bookmark"
                size={12}
                color={theme.colors.accent}
              />
              <Text style={[styles.referenceText, { color: theme.colors.accent }]}>
                {reference}
              </Text>
            </View>
          )}
        </View>

        {/* Timestamp */}
        <Text style={[styles.timestamp, { color: theme.colors.text.muted }]}>
          {formatTime(bookmark.created_at)}
        </Text>
      </View>

      {/* Optional title */}
      {bookmark.title && (
        <Text
          style={[styles.titleText, { color: theme.colors.text.primary }]}
          numberOfLines={2}
        >
          {bookmark.title}
        </Text>
      )}

      {/* Footer with tags and navigation */}
      <View style={styles.footer}>
        <View style={styles.tagsRow}>
          {bookmark.tags && bookmark.tags.length > 0 && (
            <>
              {bookmark.tags.slice(0, 3).map((tag, index) => (
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
              {bookmark.tags.length > 3 && (
                <Text style={[styles.moreTagsText, { color: theme.colors.text.muted }]}>
                  +{bookmark.tags.length - 3}
                </Text>
              )}
            </>
          )}
        </View>

        {/* Navigation indicator */}
        <View style={styles.navIndicator}>
          <Text style={[styles.navText, { color: theme.colors.accent }]}>
            Go to verse
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

export default BookmarkedVerseItem;

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
  referenceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
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
  titleText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
    fontWeight: "500",
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
