/**
 * Bible Notes Aligned Item - Renders one chapter with Bible on left, Notes on right
 * Uses same FlashList item for synchronized scrolling
 *
 * SIMPLE: All note logic handled by useNoteEditor hook
 */

import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { observer, useSelector } from '@legendapp/state/react';
import { v4 as uuidv4 } from 'uuid';
import { useTheme } from '../../contexts/ThemeContext';
import { useBibleStyleSpec } from '../../contexts/BibleRenderingContext';
import { ChapterSelectableText, type ChapterSelectionEvent } from '../../modules/expo-selectable-text';
import { transformChapterToSectionsWithBoundaries, type VerseBoundary } from '../../modules/bible/chapterDataTransform';
import { getBookByName, getLocalizedBookName } from '../../modules/bible/bibleBookMappings';
import { NoteEditor } from '../Notes/NoteEditor';
import { AddNoteButton } from '../Notes/AddNoteButton';
import { bibleStore$, authStore$ } from '../../state/bibleStore';
import { bibleVersionStore$ } from '../../state/bibleVersionStore';
import { notesStore$, activeHighlights$, type VerseHighlight } from '../../state/notesStore';
import { getChapterPadding } from '../../utils/chapterPadding';
import type { Note } from '../../types/database';

interface BibleNotesAlignedItemProps {
  chapter: any; // Chapter data from hook
  selectedVerseId: number | null;
  versionId: string;
  titleRefs: React.MutableRefObject<Map<string, React.RefObject<View | null>>>; // Map of noteId -> title ref
  bodyWrapperRefs: React.MutableRefObject<Map<string, React.RefObject<View | null>>>; // Map of noteId -> body wrapper ref (for keyboard avoidance)
  addButtonRefs: React.MutableRefObject<Map<number, React.RefObject<View | null>>>; // Map of chapterId -> add button ref
  emptyPlaceholderTitleRefs: React.MutableRefObject<Map<number, React.RefObject<View | null>>>; // Map of chapterId -> empty placeholder title ref
  addNoteHandlers: React.MutableRefObject<Map<number, () => void>>; // Map of chapterId -> add note handler
  onFocusEmptyPlaceholder?: (chapterId: number) => void; // Called when empty placeholder is focused for scrolling
  onBodyFocus?: (noteId: string) => void; // Called when note body receives focus (for keyboard avoidance)
  onBodyBlur?: (noteId: string) => void; // Called when note body loses focus (for keyboard avoidance)
  onBodyTapAtY?: (noteId: string, tapY: number) => void; // Called when note body is tapped with screen Y coordinate
  onScrollToVerse?: (noteId: string) => void; // Called when user wants to scroll to verse
  onCopyText?: (noteId: string, content: string) => void; // Called when user wants to copy note
  onShareNote?: (noteId: string, content: string) => void; // Called when user wants to share note
  onDeleteNote?: (noteId: string) => void; // Called when user wants to delete note
  onNoteRelocate?: (noteId: string, bookId: number, chapterId: number) => void; // Called when user wants to relocate note
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeProgress?: (deltaX: number) => void;
  onSwipeCancel?: () => void;
  // Bible text selection callback
  onBibleAction?: (
    event: { nativeEvent: ChapterSelectionEvent },
    chapterId: number,
    verseBoundaries: VerseBoundary[]
  ) => void;
}

/**
 * Individual Note Item Component
 * Extracted to avoid Rules of Hooks violation (can't call hooks in .map())
 */
const NoteItem = observer(({
  noteId,
  chapterId,
  bookId,
  bookName,
  chapterNumber,
  titleRefs,
  bodyWrapperRefs,
  editorRef,
  onBodyFocus,
  onBodyBlur,
  onBodyTapAtY,
  onScrollToVerse,
  onCopyText,
  onShareNote,
  onDeleteNote,
  onNoteRelocate,
  onSwipeLeft,
  onSwipeRight,
  onSwipeProgress,
  onSwipeCancel,
}: {
  noteId: string;
  chapterId: number;
  bookId: number;
  bookName: string;
  chapterNumber: number;
  titleRefs: React.MutableRefObject<Map<string, React.RefObject<View | null>>>;
  bodyWrapperRefs: React.MutableRefObject<Map<string, React.RefObject<View | null>>>;
  editorRef?: React.RefObject<any>;
  onBodyFocus?: (noteId: string) => void;
  onBodyBlur?: (noteId: string) => void;
  onBodyTapAtY?: (noteId: string, tapY: number) => void;
  onScrollToVerse?: (noteId: string) => void;
  onCopyText?: (noteId: string, content: string) => void;
  onShareNote?: (noteId: string, content: string) => void;
  onDeleteNote?: (noteId: string) => void;
  onNoteRelocate?: (noteId: string, bookId: number, chapterId: number) => void;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeProgress?: (deltaX: number) => void;
  onSwipeCancel?: () => void;
}) => {
  // Get or create ref for this specific note's title
  const noteTitleRef = useMemo(() => {
    if (!titleRefs.current.has(noteId)) {
      titleRefs.current.set(noteId, React.createRef<View>());
    }
    return titleRefs.current.get(noteId)!;
  }, [noteId, titleRefs]);

  // Get or create ref for this specific note's body wrapper
  const noteBodyWrapperRef = useMemo(() => {
    if (!bodyWrapperRefs.current.has(noteId)) {
      bodyWrapperRefs.current.set(noteId, React.createRef<View>());
    }
    return bodyWrapperRefs.current.get(noteId)!;
  }, [noteId, bodyWrapperRefs]);

  return (
    <NoteEditor
      ref={editorRef}
      key={noteId}
      chapterId={chapterId}
      verseId={null}
      bookId={bookId}
      noteId={noteId}
      formattingType="prose"
      placeholder={`Notes for ${bookName} ${chapterNumber}...`}
      headerRef={noteTitleRef}
      bodyWrapperRef={noteBodyWrapperRef}
      onBodyFocus={onBodyFocus ? () => onBodyFocus(noteId) : undefined}
      onBodyBlur={onBodyBlur ? () => onBodyBlur(noteId) : undefined}
      onBodyTapAtY={onBodyTapAtY ? (tapY) => onBodyTapAtY(noteId, tapY) : undefined}
      onScrollToVerse={onScrollToVerse ? () => onScrollToVerse(noteId) : undefined}
      onCopyText={onCopyText ? (id: string, content: string) => onCopyText(id, content) : undefined}
      onShareNote={onShareNote ? (id: string, content: string) => onShareNote(id, content) : undefined}
      onDelete={onDeleteNote ? () => onDeleteNote(noteId) : undefined}
      onNoteRelocate={onNoteRelocate ? () => onNoteRelocate(noteId, bookId, chapterId) : undefined}
      onSwipeLeft={onSwipeLeft}
      onSwipeRight={onSwipeRight}
      onSwipeProgress={onSwipeProgress}
      onSwipeCancel={onSwipeCancel}
    />
  );
});

/**
 * Bible Notes Aligned Item Component
 * Renders Bible content on left, Notes editor on right in same FlashList item
 * Wrapped with React.memo + observer for optimal performance in FlashList
 */
const BibleNotesAlignedItemComponent = ({
  chapter,
  selectedVerseId,
  versionId,
  titleRefs,
  bodyWrapperRefs,
  addButtonRefs,
  emptyPlaceholderTitleRefs,
  addNoteHandlers,
  onFocusEmptyPlaceholder,
  onBodyFocus,
  onBodyBlur,
  onBodyTapAtY,
  onScrollToVerse,
  onCopyText,
  onShareNote,
  onDeleteNote,
  onNoteRelocate,
  onSwipeLeft,
  onSwipeRight,
  onSwipeProgress,
  onSwipeCancel,
  onBibleAction,
}: BibleNotesAlignedItemProps) => {
  const { theme } = useTheme();

  // Get styleSpec with width-based font size (half width for split view)
  const { styleSpec } = useBibleStyleSpec({ widthMultiplier: 0.5 });

  // Subscribe to active highlights for reactive updates
  const allActiveHighlights = useSelector(activeHighlights$);

  // Convert highlight color name to hex color for native rendering
  const getHighlightHexColor = React.useCallback((colorName: VerseHighlight['color']): string => {
    const colorConfig = theme.colors.highlightColors[colorName];
    return colorConfig?.bg || '#FFEB3B80'; // Fallback to yellow with alpha
  }, [theme.colors.highlightColors]);

  // Get highlights for this chapter in native format
  const chapterHighlights = useMemo(() => {
    // Filter highlights that belong to this chapter
    // Verse ID format: BBCCCVVV - chapter portion is BBCCC000
    const chapterBase = Math.floor(chapter.chapterId / 1000) * 1000;
    const chapterEnd = chapterBase + 999;

    return allActiveHighlights
      .filter((h: VerseHighlight) => h.verse_id >= chapterBase && h.verse_id <= chapterEnd)
      .map((h: VerseHighlight) => ({
        verseId: h.verse_id,
        color: getHighlightHexColor(h.color),
      }));
  }, [allActiveHighlights, getHighlightHexColor, chapter.chapterId]);

  // Get chapter notes directly - filter inside useSelector for better reactivity
  const chapterNotes = useSelector(() => {
    const notes = bibleStore$.activeNotes.get();

    if (!Array.isArray(notes)) {
      return [];
    }

    return notes.filter((n: Note) => n.chapter_id === chapter.chapterId);
  });

  // Calculate bookId from chapterId (needed for creating notes)
  const bookId = useMemo(() => Math.floor(chapter.chapterId / 1000000), [chapter.chapterId]);

  // Get all note IDs for this chapter
  const allNoteIds = useMemo(() => {
    // DEFENSIVE: Ensure chapterNotes is array before mapping
    if (!Array.isArray(chapterNotes)) {
      return [];
    }
    return chapterNotes.map((n: Note) => n.id);
  }, [chapterNotes]);

  // Track the ID of a newly created note (for focusing after render)
  const [pendingFocusNoteId, setPendingFocusNoteId] = React.useState<string | null>(null);

  // Map of noteId -> ref for focusing
  const noteRefs = React.useRef<Map<string, React.RefObject<any>>>(new Map());

  // Get or create ref for a note
  const getNoteRef = React.useCallback((noteId: string) => {
    if (!noteRefs.current.has(noteId)) {
      noteRefs.current.set(noteId, React.createRef());
    }
    return noteRefs.current.get(noteId)!;
  }, []);

  // Handle adding a new note - creates real note immediately
  const handleAddNote = React.useCallback(() => {
    // Create a real note immediately with UUID
    const newNote: Note = {
      id: uuidv4(),
      user_id: authStore$.user.peek()?.id || "",
      book_id: bookId,
      chapter_id: chapter.chapterId,
      verse_id: null,
      verse_line_id: null,
      verse_start_id: null, // Chapter-level note, no specific verse
      verse_end_id: null,
      content: "",  // Empty - will be filled as user types
      tags: [],
      is_private: true,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      edit_history: [],
      formatting_type: 'prose',
    };

    console.log(`[BibleNotesAlignedItem] ➕ Creating new note immediately: id=${newNote.id}`);

    // Add to store
    bibleStore$.notes.push(newNote);
    bibleStore$.setNoteExpanded(newNote.id, true);
    bibleStore$.saveNotesToStorage();

    // Mark this note for focusing after it renders
    setPendingFocusNoteId(newNote.id);
  }, [bookId, chapter.chapterId]);

  // Focus the newly created note after it renders (local state - for add button)
  React.useEffect(() => {
    if (pendingFocusNoteId && allNoteIds.includes(pendingFocusNoteId)) {
      // Note has appeared in the list - focus it
      const timer = setTimeout(() => {
        const noteRef = noteRefs.current.get(pendingFocusNoteId);
        if (noteRef?.current?.focus) {
          noteRef.current.focus();
        }
        setPendingFocusNoteId(null);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [pendingFocusNoteId, allNoteIds]);

  // Subscribe to store-level pending focus (for notes created via text selection)
  const pendingFocusFromStore = useSelector(notesStore$.pendingFocusNoteId);

  // Focus note from store-level pending focus (for notes created via text selection in other views)
  React.useEffect(() => {
    if (pendingFocusFromStore && allNoteIds.includes(pendingFocusFromStore)) {
      // Note has appeared in this chapter's list - focus it
      const timer = setTimeout(() => {
        const noteRef = noteRefs.current.get(pendingFocusFromStore);
        if (noteRef?.current?.focus) {
          noteRef.current.focus();
        }
        notesStore$.clearPendingFocusNote();
      }, 150); // Slightly longer delay for view transition + render
      return () => clearTimeout(timer);
    }
  }, [pendingFocusFromStore, allNoteIds]);

  // Register handleAddNote in the handlers map
  React.useEffect(() => {
    const handlers = addNoteHandlers.current;
    handlers.set(chapter.chapterId, handleAddNote);

    // Clean up on unmount
    return () => {
      handlers.delete(chapter.chapterId);
    };
  }, [chapter.chapterId, handleAddNote, addNoteHandlers]);

  // Get or create ref for this chapter's add button (always create it)
  const addButtonRef = useMemo(() => {
    if (!addButtonRefs.current.has(chapter.chapterId)) {
      addButtonRefs.current.set(chapter.chapterId, React.createRef<View>());
    }
    return addButtonRefs.current.get(chapter.chapterId)!;
  }, [chapter.chapterId, addButtonRefs]);

  // Get primary version's language for localized chapter titles
  const primaryVersion = useSelector(bibleVersionStore$.primaryVersion);
  const versionLanguage = useMemo(() => {
    const versionData = bibleVersionStore$.getVersionData(primaryVersion);
    return versionData?.language || 'en';
  }, [primaryVersion]);

  // Transform chapter sections to styled sections for native rendering
  // Also get verseBoundaries for selection-to-verse mapping
  const chapterTitle = useMemo(() => {
    if (versionLanguage === 'zh' && chapter.bookName) {
      const book = getBookByName(chapter.bookName);
      if (book) {
        return `${getLocalizedBookName(book.id, versionLanguage)} ${chapter.chapterNumber}`;
      }
    }
    return `${chapter.bookName} ${chapter.chapterNumber}`;
  }, [chapter.bookName, chapter.chapterNumber, versionLanguage]);

  const { styledSections, verseBoundaries } = useMemo(() => {
    return transformChapterToSectionsWithBoundaries(chapterTitle, chapter.sections);
  }, [chapterTitle, chapter.sections]);

  // Get chapter-specific padding (paddingTop for header, paddingBottom for end of chapter)
  const { paddingTop, paddingBottom } = useMemo(
    () => getChapterPadding(chapter.chapterId),
    [chapter.chapterId]
  );

  return (
    <View style={{ paddingTop, paddingBottom }}>
      {/* Bible + Notes side-by-side */}
      <View style={styles.splitContainer}>
        {/* Left side: Bible content - Chapter-level native text selection */}
        <View style={styles.biblePane}>
          <ChapterSelectableText
            sections={styledSections}
            styleSpec={styleSpec}
            highlights={chapterHighlights}
            chapterKey={`notes-bible-${chapter.chapterId}`}
            onAction={onBibleAction ? (event) => onBibleAction(event, chapter.chapterId, verseBoundaries) : undefined}
          />
        </View>

        {/* Divider */}
        <View style={[styles.divider, { backgroundColor: theme.colors.accent }]} />

        {/* Right side: Notes editor - Hook handles ALL logic */}
        <View style={{ flex: 1 }}>
          {/* Render all notes (including newly created empty ones) */}
          {allNoteIds.map((noteId) => (
            <NoteItem
              key={noteId}
              noteId={noteId}
              chapterId={chapter.chapterId}
              bookId={bookId}
              bookName={chapter.bookName}
              chapterNumber={chapter.chapterNumber}
              titleRefs={titleRefs}
              bodyWrapperRefs={bodyWrapperRefs}
              editorRef={getNoteRef(noteId)}
              onBodyFocus={onBodyFocus}
              onBodyBlur={onBodyBlur}
              onBodyTapAtY={onBodyTapAtY}
              onScrollToVerse={onScrollToVerse}
              onCopyText={onCopyText}
              onShareNote={onShareNote}
              onDeleteNote={onDeleteNote}
              onNoteRelocate={onNoteRelocate}
              onSwipeLeft={onSwipeLeft}
              onSwipeRight={onSwipeRight}
              onSwipeProgress={onSwipeProgress}
              onSwipeCancel={onSwipeCancel}
            />
          ))}

          {/* Show "+" button to add new notes - always visible as last item */}
          <AddNoteButton
            ref={addButtonRef}
            onPress={handleAddNote}
          />
        </View>
      </View>
    </View>
  );
};

// ✅ PERFORMANCE FIX: Wrap with observer for FlashList optimization
// Observer handles reactivity to Legend State changes (including notes array)
// React.memo custom comparison was blocking re-renders when notes changed
export const BibleNotesAlignedItem = observer(BibleNotesAlignedItemComponent);

BibleNotesAlignedItem.displayName = 'BibleNotesAlignedItem';

const styles = StyleSheet.create({
  splitContainer: {
    flexDirection: 'row',
    flex: 1,
  },
  biblePane: {
    flex: 1,
    paddingHorizontal: 8,
  },
  divider: {
    width: 1,
  },
});
