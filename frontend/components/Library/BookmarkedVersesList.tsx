/**
 * BookmarkedVersesList - List of user's bookmarked verses
 * Displays bookmarks sorted by created_at date (newest first)
 */

import React, { useCallback } from "react";
import { View, Text, StyleSheet } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { observer, useSelector } from "@legendapp/state/react";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

import { useTheme } from "@/contexts/ThemeContext";
import { activeBookmarks$ } from "@/state";
import { navigateToVerse } from "@/modules/bible/tabManager";
import { getBookName } from "@/modules/bible/bibleBookMappings";
import { useFlashListConfig } from "@/hooks/useFlashListConfig";
import BookmarkedVerseItem from "./BookmarkedVerseItem";
import type { Bookmark } from "@/types/database";

/**
 * Parse verse_line_id to get navigation target
 * Format: {verseId}_{suffix} where verseId is BBCCCVVV
 */
function parseVerseLineId(verseLineId: string): {
  verseId: number;
  bookId: number;
  chapter: number;
  chapterId: number;
} | null {
  const parts = verseLineId.split('_');
  if (parts.length < 2) return null;

  const verseId = parseInt(parts[0], 10);
  if (isNaN(verseId)) return null;

  const bookId = Math.floor(verseId / 1000000);
  const chapter = Math.floor((verseId % 1000000) / 1000);
  const chapterId = bookId * 1000000 + chapter * 1000;

  return { verseId, bookId, chapter, chapterId };
}

const BookmarkedVersesList = observer(function BookmarkedVersesList() {
  const { theme } = useTheme();
  const bookmarks = useSelector(activeBookmarks$);

  // FlashList config
  const flashListConfig = useFlashListConfig({
    estimatedItemSize: 80,
  });

  // Sort bookmarks by created_at (newest first)
  const sortedBookmarks = [...bookmarks].sort((a, b) => {
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  // Handle bookmark press - navigate to verse
  const handleBookmarkPress = useCallback((bookmark: Bookmark) => {
    const parsed = parseVerseLineId(bookmark.verse_line_id);
    if (!parsed) return;

    const bookName = getBookName(parsed.bookId);
    if (!bookName) return;

    // Navigate to the bookmarked verse
    navigateToVerse(parsed.chapterId, bookName, parsed.chapter, parsed.verseId);
    router.push("/(tabs)");
  }, []);

  // Render individual bookmark
  const renderBookmark = useCallback(
    ({ item }: { item: Bookmark }) => (
      <BookmarkedVerseItem bookmark={item} onPress={() => handleBookmarkPress(item)} />
    ),
    [handleBookmarkPress]
  );

  // Empty state
  if (sortedBookmarks.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons
          name="bookmark-outline"
          size={48}
          color={theme.colors.text.muted}
        />
        <Text style={[styles.emptyTitle, { color: theme.colors.text.secondary }]}>
          No bookmarked verses
        </Text>
        <Text style={[styles.emptySubtitle, { color: theme.colors.text.muted }]}>
          Long press on a verse and tap bookmark to save verses here
        </Text>
      </View>
    );
  }

  return (
    <FlashList
      data={sortedBookmarks}
      renderItem={renderBookmark}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={true}
      {...flashListConfig.props}
    />
  );
});

export default BookmarkedVersesList;

const styles = StyleSheet.create({
  listContent: {
    paddingBottom: 100,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
});
