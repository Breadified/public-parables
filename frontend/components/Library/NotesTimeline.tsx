/**
 * NotesTimeline - Chronological list of user's notes
 * Displays notes sorted by updated_at date
 */

import React, { useCallback } from "react";
import { View, Text, StyleSheet } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { observer, useSelector } from "@legendapp/state/react";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

import { useTheme } from "@/contexts/ThemeContext";
import { activeNotes$, notesStore$ } from "@/state";
import { navigateToVerse, navigateToChapter } from "@/modules/bible/tabManager";
import { getBookName } from "@/modules/bible/bibleBookMappings";
import { useFlashListConfig } from "@/hooks/useFlashListConfig";
import NoteListItem from "./NoteListItem";
import type { NoteData } from "@/state";

const NotesTimeline = observer(function NotesTimeline() {
  const { theme } = useTheme();
  const notes = useSelector(activeNotes$);

  // FlashList config
  const flashListConfig = useFlashListConfig({
    estimatedItemSize: 100,
  });

  // Sort notes by updated_at (newest first)
  const sortedNotes = [...notes].sort((a, b) => {
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });

  // Handle note press - navigate to verse/chapter with pending scroll
  const handleNotePress = useCallback((note: NoteData) => {
    // Calculate target chapter ID for pending scroll
    let targetChapterId: number | null = null;

    if (note.verse_id) {
      const bookId = Math.floor(note.verse_id / 1000000);
      const chapter = Math.floor((note.verse_id % 1000000) / 1000);
      targetChapterId = bookId * 1000000 + chapter * 1000;
    } else if (note.chapter_id) {
      targetChapterId = note.chapter_id;
    } else if (note.book_id) {
      targetChapterId = note.book_id * 1000000 + 1 * 1000;
    }

    // Set pending scroll and expand note BEFORE navigation
    if (targetChapterId) {
      notesStore$.setPendingNoteScroll({
        noteId: note.id,
        chapterId: targetChapterId,
      });
      notesStore$.setNoteExpanded(note.id, true);
    }

    // Verse-level note
    if (note.verse_id) {
      const bookId = Math.floor(note.verse_id / 1000000);
      const chapter = Math.floor((note.verse_id % 1000000) / 1000);
      const chapterId = bookId * 1000000 + chapter * 1000;
      const bookName = getBookName(bookId);

      if (bookName) {
        navigateToVerse(chapterId, bookName, chapter, note.verse_id);
        router.push("/(tabs)");
      }
      return;
    }

    // Chapter-level note
    if (note.chapter_id) {
      const bookId = Math.floor(note.chapter_id / 1000000);
      const chapter = Math.floor((note.chapter_id % 1000000) / 1000);
      const bookName = getBookName(bookId);

      if (bookName) {
        navigateToChapter(note.chapter_id, bookName, chapter);
        router.push("/(tabs)");
      }
      return;
    }

    // Book-level note - go to chapter 1
    if (note.book_id) {
      const chapterId = note.book_id * 1000000 + 1 * 1000;
      const bookName = getBookName(note.book_id);

      if (bookName) {
        navigateToChapter(chapterId, bookName, 1);
        router.push("/(tabs)");
      }
    }
  }, []);

  // Render individual note
  const renderNote = useCallback(
    ({ item }: { item: NoteData }) => (
      <NoteListItem note={item} onPress={() => handleNotePress(item)} />
    ),
    [handleNotePress]
  );

  // Empty state
  if (sortedNotes.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons
          name="document-text-outline"
          size={48}
          color={theme.colors.text.muted}
        />
        <Text style={[styles.emptyTitle, { color: theme.colors.text.secondary }]}>
          No notes yet
        </Text>
        <Text style={[styles.emptySubtitle, { color: theme.colors.text.muted }]}>
          Add notes while reading the Bible to see them here
        </Text>
      </View>
    );
  }

  return (
    <FlashList
      data={sortedNotes}
      renderItem={renderNote}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={true}
      {...flashListConfig.props}
    />
  );
});

export default NotesTimeline;

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
