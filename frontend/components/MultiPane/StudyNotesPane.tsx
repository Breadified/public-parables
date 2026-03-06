/**
 * StudyNotesPane - Note-taking pane for multi-pane mode
 *
 * Supports two modes:
 * 1. CONTENT_ALIGNED: Notes aligned with Bible verses (FlashList synced)
 * 2. INDEPENDENT/REFERENCE_LINKED: Separate note list
 */

import React, { useCallback, useMemo } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { observer, useSelector } from '@legendapp/state/react';
import { FlashList } from '@shopify/flash-list';
import { v4 as uuidv4 } from 'uuid';
import { StudyNotesPaneState, PaneLinkMode } from '../../types/multiPane';
import { bibleStore$ } from '../../state/bibleStore';
import { NoteEditor } from '../Notes/NoteEditor';
import { useFlashListConfig } from '../../hooks/useFlashListConfig';
import { useTheme } from '../../contexts/ThemeContext';
import type { Note } from '../../types/database';

interface StudyNotesPaneProps {
  pane: StudyNotesPaneState;
  isActive?: boolean;
  isTabActive?: boolean;
}

/**
 * Study Notes Pane Component
 */
export const StudyNotesPane = observer(({
  pane,
  isActive = true,
  isTabActive = true,
}: StudyNotesPaneProps) => {
  const { theme } = useTheme();

  // Get active notes from store (excludes soft-deleted notes)
  const notes = useSelector(bibleStore$.activeNotes);

  // FlashList configuration
  const flashListConfig = useFlashListConfig({
    estimatedItemSize: 100,
    loadMoreThreshold: 1.5,
    viewAreaCoveragePercentThreshold: 50,
    minimumViewTime: 300,
    scrollEventThrottle: 16,
    removeClippedSubviews: false,
    drawDistance: 4000,
    keyExtractor: (item: Note) => item.id,
  });

  // Filter notes based on pane context
  const filteredNotes = useMemo(() => {
    let filtered = notes;

    // Filter by chapter if in CONTENT_ALIGNED mode
    if (pane.linkMode === PaneLinkMode.CONTENT_ALIGNED && pane.currentChapterId) {
      filtered = filtered.filter((note: Note) =>
        note.chapter_id === pane.currentChapterId
      );
    }

    // Filter by verse if specified
    if (pane.currentVerseId) {
      filtered = filtered.filter((note: Note) =>
        note.verse_id === pane.currentVerseId
      );
    }

    // Filter by book if specified
    if (pane.currentBookId) {
      filtered = filtered.filter((note: Note) =>
        note.book_id === pane.currentBookId
      );
    }

    // Filter by tags if specified
    if (pane.filterTags && pane.filterTags.length > 0) {
      filtered = filtered.filter((note: Note) =>
        pane.filterTags!.some(tag => note.tags.includes(tag))
      );
    }

    // Sort notes
    return filtered.sort((a: Note, b: Note) => {
      switch (pane.sortBy) {
        case 'date':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'modified':
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        case 'verse':
          return (a.verse_id || 0) - (b.verse_id || 0);
        default:
          return 0;
      }
    });
  }, [notes, pane.currentChapterId, pane.currentVerseId, pane.currentBookId, pane.filterTags, pane.sortBy, pane.linkMode]);

  // Get the active note or prepare for new note
  const activeNote = useMemo(() => {
    if (pane.activeNoteId) {
      return filteredNotes.find((note: Note) => note.id === pane.activeNoteId) || null;
    }
    return null;
  }, [filteredNotes, pane.activeNoteId]);

  // Handle note save
  const handleSave = useCallback(async (content: string, title?: string) => {
    if (!activeNote) return;

    // Update note in store
    const noteIndex = notes.findIndex((n: Note) => n.id === activeNote.id);
    if (noteIndex !== -1) {
      bibleStore$.notes[noteIndex].set({
        ...activeNote,
        content,
        title: title || activeNote.title,
        updated_at: new Date().toISOString(),
      });
    }
  }, [activeNote, notes]);

  // Handle new note creation
  const handleCreateNew = useCallback(async (content: string) => {
    const verseId = pane.currentVerseId || null;
    const newNote: Note = {
      id: uuidv4(),
      user_id: 'current_user', // Will be replaced by actual auth
      book_id: pane.currentBookId || null,
      chapter_id: pane.currentChapterId || null,
      verse_id: verseId,
      verse_line_id: null,
      verse_start_id: verseId, // For single verse, start = end
      verse_end_id: verseId,
      content,
      tags: [],
      is_private: true,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      edit_history: [],
      formatting_type: pane.formattingType,
    };

    bibleStore$.notes.push(newNote);
  }, [pane.currentBookId, pane.currentChapterId, pane.currentVerseId, pane.formattingType]);

  // Render for CONTENT_ALIGNED mode (synced with Bible)
  if (pane.linkMode === PaneLinkMode.CONTENT_ALIGNED) {
    return (
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Notes</Text>
          {pane.currentChapterId && (
            <Text style={styles.headerSubtitle}>
              Chapter {pane.currentChapterId}
            </Text>
          )}
        </View>

        {/* Note editor - synced with current verse/chapter - Hook handles ALL logic */}
        <NoteEditor
          chapterId={pane.currentChapterId || 0}
          verseId={pane.currentVerseId || null}
          bookId={pane.currentBookId || 0}
          formattingType={pane.formattingType}
          placeholder="Take notes for this chapter..."
        />
      </View>
    );
  }

  // PERF FIX: Memoize renderItem to prevent recreation on every render
  const renderNote = useCallback(({ item }: { item: Note }) => (
    <View style={[styles.noteCard, { borderBottomColor: theme.colors.border }]}>
      <Text style={[styles.noteContent, { color: theme.colors.text.secondary }]} numberOfLines={3}>
        {item.content}
      </Text>
      <Text style={[styles.noteDate, { color: theme.colors.text.muted }]}>
        {new Date(item.updated_at).toLocaleDateString()}
      </Text>
    </View>
  ), [theme.colors]);

  // Render for INDEPENDENT/REFERENCE_LINKED mode (separate list)
  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background.primary }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <Text style={[styles.headerTitle, { color: theme.colors.text.primary }]}>Study Notes</Text>
        <Text style={[styles.headerSubtitle, { color: theme.colors.text.muted }]}>
          {filteredNotes.length} {filteredNotes.length === 1 ? 'note' : 'notes'}
        </Text>
      </View>

      {/* Notes list */}
      {filteredNotes.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyText, { color: theme.colors.text.muted }]}>No notes yet</Text>
          <Text style={[styles.emptySubtext, { color: theme.colors.text.muted }]}>
            Start taking notes to see them here
          </Text>
        </View>
      ) : (
        <FlashList
          data={filteredNotes}
          renderItem={renderNote}
          {...flashListConfig.props}
        />
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
  noteCard: {
    padding: 16,
    borderBottomWidth: 1,
  },
  noteTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  noteContent: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  noteDate: {
    fontSize: 12,
  },
});
