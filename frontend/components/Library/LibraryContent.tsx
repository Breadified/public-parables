/**
 * LibraryContent - Main container for Library tab
 * Displays Notes, My Comments, and Liked Comments sections
 * Includes FAB for adding new notes with verse selection
 */

import React, { useEffect, useState, useCallback } from "react";
import { View, StyleSheet, Modal, Text, Pressable } from "react-native";
import { observer, useSelector } from "@legendapp/state/react";
import { useSafeAreaInsets, SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { v4 as uuidv4 } from "uuid";

import { useTheme } from "@/contexts/ThemeContext";
import { libraryStore$, activeNotes$, activeBookmarks$, notesStore$ } from "@/state";
import type { LibrarySegment } from "@/state";
import type { Note } from "@/types/database";
import LibrarySegmentedControl from "./LibrarySegmentedControl";
import NotesTimeline from "./NotesTimeline";
import BookmarkedVersesList from "./BookmarkedVersesList";
import MyCommentsList from "./MyCommentsList";
import LikedCommentsList from "./LikedCommentsList";
import { LibraryFAB } from "./LibraryFAB";
import { SearchInterface } from "../Search/SearchInterface";
import { navigateToVerse } from "@/modules/bible/tabManager";

const LibraryContent = observer(function LibraryContent() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const activeSegment = useSelector(libraryStore$.activeSegment);
  const notes = useSelector(activeNotes$);
  const bookmarks = useSelector(activeBookmarks$);
  // Use .get() for comments to avoid circular reference TypeScript error with replies
  const myComments = libraryStore$.myComments.get();
  const likedComments = libraryStore$.likedComments.get();

  // Tab bar height
  const tabBarHeight = insets.bottom + 58;

  // Verse selector modal state for adding new notes
  const [showVerseSelector, setShowVerseSelector] = useState(false);

  // Reset library state when component unmounts (optional - preserves state for now)
  useEffect(() => {
    return () => {
      // Uncomment to reset on unmount:
      // libraryStore$.resetAll();
    };
  }, []);

  const handleSegmentSelect = (segment: LibrarySegment) => {
    libraryStore$.setActiveSegment(segment);
  };

  // FAB press handler - open verse selector
  const handleFABPress = useCallback(() => {
    setShowVerseSelector(true);
  }, []);

  // Verse selection handler - create new note and navigate
  const handleVerseSelect = useCallback((params: {
    bookId: number;
    chapterId: number;
    verseId: number | null;
    bookName: string;
    chapter: number;
  }) => {
    // Create new note with selected verse reference
    const newNote: Note = {
      id: uuidv4(),
      user_id: "", // Will be set by sync
      book_id: params.bookId,
      chapter_id: params.chapterId,
      verse_id: params.verseId,
      verse_line_id: null,
      verse_start_id: params.verseId, // For single verse, start = end
      verse_end_id: params.verseId,
      content: "",
      tags: [],
      is_private: true,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      edit_history: [],
      formatting_type: 'prose',
    };

    // Add to store and expand
    notesStore$.notes.push(newNote);
    notesStore$.setNoteExpanded(newNote.id, true);
    notesStore$.saveNotesToStorage();

    // Set pending scroll for highlight after navigation
    notesStore$.setPendingNoteScroll({
      noteId: newNote.id,
      chapterId: params.chapterId,
    });

    // Navigate to Bible view
    navigateToVerse(params.chapterId, params.bookName, params.chapter, params.verseId ?? undefined);
    router.push("/(tabs)");

    // Close modal
    setShowVerseSelector(false);
  }, []);

  // Segment options with icons and counts
  const segments = [
    { key: 'notes' as LibrarySegment, label: 'Notes', icon: 'document-text-outline' as const, count: notes.length },
    { key: 'bookmarks' as LibrarySegment, label: 'Verses', icon: 'bookmark-outline' as const, count: bookmarks.length },
    { key: 'comments' as LibrarySegment, label: 'Comments', icon: 'chatbubble-outline' as const, count: myComments.length },
    { key: 'liked' as LibrarySegment, label: 'Liked', icon: 'heart-outline' as const, count: likedComments.length },
  ];

  // Render active section
  const renderActiveSection = () => {
    switch (activeSegment) {
      case 'notes':
        return <NotesTimeline />;
      case 'bookmarks':
        return <BookmarkedVersesList />;
      case 'comments':
        return <MyCommentsList />;
      case 'liked':
        return <LikedCommentsList />;
      default:
        return <NotesTimeline />;
    }
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.background.primary,
          paddingBottom: tabBarHeight,
        },
      ]}
    >
      {/* Segmented Control */}
      <LibrarySegmentedControl
        segments={segments}
        activeKey={activeSegment}
        onSelect={handleSegmentSelect}
      />

      {/* Content Area */}
      <View style={styles.contentArea}>
        {renderActiveSection()}
      </View>

      {/* FAB - only show on Notes segment */}
      {activeSegment === 'notes' && (
        <LibraryFAB onPress={handleFABPress} />
      )}

      {/* Verse Selector Modal for creating new notes */}
      <Modal
        visible={showVerseSelector}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowVerseSelector(false)}
      >
        <SafeAreaView
          style={[styles.modalContainer, { backgroundColor: theme.colors.background.primary }]}
          edges={["top", "left", "right"]}
        >
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: theme.colors.text.primary }]}>
              Select Verse for Note
            </Text>
            <Pressable
              onPress={() => setShowVerseSelector(false)}
              style={styles.closeButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={24} color={theme.colors.text.primary} />
            </Pressable>
          </View>
          <SearchInterface
            mode="navigate"
            onSelect={handleVerseSelect}
            onClose={() => setShowVerseSelector(false)}
            autoFocus={true}
            paddingBottom={insets.bottom + 20}
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
});

export default LibraryContent;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentArea: {
    flex: 1,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(128, 128, 128, 0.3)",
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "600",
  },
  closeButton: {
    padding: 4,
  },
});
