/**
 * PlanStudyModeView - Study mode view for Bible plan readings
 *
 * Single component that handles both COMPARE and NOTES modes.
 * Uses ChapterSelectableText for cross-paragraph text selection.
 */

import React, { useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { observer, useSelector } from "@legendapp/state/react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "../../../contexts/ThemeContext";
import { useBibleStyleSpec } from "../../../contexts/BibleRenderingContext";
import { useToast } from "../../../contexts/ToastContext";
import { planStudyModeStore$ } from "../../../state";
import { usePlanReadingAdapter, type PlanReadingSection } from "../../../hooks/usePlanReadingAdapter";
import { usePlanTextSelection } from "../../../hooks/usePlanTextSelection";
import { ChapterSelectableText } from "../../../modules/expo-selectable-text";
import { HighlightColorPicker } from "../../Bible/HighlightColorPicker";
import { ReadingSeparator } from "./ReadingSeparator";
import { transformVerseLinesToStyledSections } from "../../../modules/bible/chapterDataTransform";
import { type VerseBoundary } from "../../../modules/bible/textUtils";
import type { BiblePlanReadingData } from "../../../types/database";
import type { VerseLine } from "../../../services/sqlite";
import { AddNoteButton } from "../../Notes/AddNoteButton";
import { NoteEditor } from "../../Notes/NoteEditor";
import { bibleStore$ } from "../../../state/bibleStore";
import { getBookName } from "../../../modules/bible/bibleBookMappings";
import { v4 as uuidv4 } from "uuid";

interface PlanStudyModeViewProps {
  readings: BiblePlanReadingData[];
  /** Padding at top for header overlay (consistent with normal reading mode) */
  contentPaddingTop?: number;
  /** Padding at bottom for FAB/collapsed preview overlays (consistent with normal reading mode) */
  contentPaddingBottom?: number;
  /** External scroll props for UI auto-hide (from useReadingUIToggle) */
  scrollProps?: {
    onTouchStart: (event: any) => void;
    onTouchEnd: (event: any) => void;
    onTouchCancel: () => void;
    onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
    onScrollBeginDrag: () => void;
    onScrollEndDrag: () => void;
    scrollEventThrottle: number;
  };
}

/**
 * Notes Section for a verse range - reactive to store changes
 */
const NotesSection = observer(function NotesSection({
  verseIdStart,
  verseIdEnd,
  chapterId,
  bookId,
  reference,
}: {
  verseIdStart: number;
  verseIdEnd: number;
  chapterId: number;
  bookId: number;
  reference: string;
}) {
  const { theme } = useTheme();
  const { showToast } = useToast();

  // Get book name for placeholder
  const bookName = getBookName(bookId);
  const chapterNum = Math.floor((chapterId % 1000000) / 1000);
  const startVerse = verseIdStart % 1000;

  // Subscribe to notes reactively - filter to this verse range
  const sectionNotes = useSelector(() => {
    const notes = bibleStore$.activeNotes.get();
    if (!Array.isArray(notes)) return [];

    return notes.filter(
      (n: any) =>
        n.verse_id !== null &&
        n.verse_id >= verseIdStart &&
        n.verse_id <= verseIdEnd
    );
  });

  // Handle adding a new note
  const handleAddNote = React.useCallback(() => {
    const newNote = {
      id: uuidv4(),
      user_id: "",
      book_id: bookId,
      chapter_id: chapterId,
      verse_id: verseIdStart,
      verse_line_id: null,
      verse_start_id: verseIdStart,
      verse_end_id: verseIdStart,
      content: "",
      tags: [],
      is_private: true,
      status: "active" as const,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      edit_history: [],
      formatting_type: "prose" as const,
    };

    bibleStore$.notes.push(newNote);
    bibleStore$.setNoteExpanded(newNote.id, true);
    bibleStore$.saveNotesToStorage();
    showToast({ message: "Note created", type: "success", duration: 2000 });
  }, [bookId, chapterId, verseIdStart, showToast]);

  return (
    <View style={notesSectionStyles.container}>
      {/* Section header */}
      <View style={[notesSectionStyles.header, { borderBottomColor: theme.colors.border }]}>
        <Text style={[notesSectionStyles.headerText, { color: theme.colors.text.primary }]}>
          Notes
        </Text>
        <Text style={[notesSectionStyles.verseRef, { color: theme.colors.text.muted }]}>
          {reference}
        </Text>
      </View>

      {/* Notes list */}
      <View style={notesSectionStyles.notesList}>
        {sectionNotes.map((note: any) => (
          <NoteEditor
            key={note.id}
            chapterId={chapterId}
            verseId={note.verse_id}
            bookId={bookId}
            noteId={note.id}
            formattingType="prose"
            placeholder={`Notes for ${bookName} ${chapterNum}:${startVerse}...`}
          />
        ))}

        {/* Add Note button */}
        <AddNoteButton onPress={handleAddNote} />
      </View>
    </View>
  );
});

const notesSectionStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerText: {
    fontSize: 15,
    fontWeight: "600",
  },
  verseRef: {
    fontSize: 11,
  },
  notesList: {
    paddingVertical: 8,
  },
});

/**
 * Section header for readings
 */
const SectionHeader = React.memo(function SectionHeader({
  reference,
  versionId,
}: {
  reference: string;
  versionId?: string;
}) {
  const { theme } = useTheme();

  return (
    <View style={[styles.sectionHeader, { borderBottomColor: theme.colors.border }]}>
      <Text style={[styles.referenceText, { color: theme.colors.text.primary }]}>
        {reference}
      </Text>
      {versionId && (
        <Text style={[styles.versionLabel, { color: theme.colors.text.muted }]}>
          {versionId.toUpperCase()}
        </Text>
      )}
    </View>
  );
});

/**
 * Main PlanStudyModeView component
 */
export const PlanStudyModeView = observer(function PlanStudyModeView({
  readings,
  contentPaddingTop,
  contentPaddingBottom,
  scrollProps,
}: PlanStudyModeViewProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<ScrollView>(null);

  // Get styleSpec for full-width and split-view modes
  const { styleSpec: fullWidthStyleSpec } = useBibleStyleSpec();
  const { styleSpec: splitViewStyleSpec } = useBibleStyleSpec({ widthMultiplier: 0.5 });

  // Study mode state
  const studyModeType = useSelector(planStudyModeStore$.studyModeType);
  const comparisonVersion = useSelector(planStudyModeStore$.comparisonVersion);

  // Shared hook for text selection handling in plan sessions
  const {
    primaryVersion,
    getHighlightsForVerseLines,
    createTextActionHandler,
    highlightActions,
  } = usePlanTextSelection({ usePlanStudyMode: true });

  // Load data based on study mode
  const { sections, isLoading, error } = usePlanReadingAdapter({
    readings,
    secondaryVersionId: studyModeType === "COMPARE" ? comparisonVersion || undefined : undefined,
    loadNotes: studyModeType === "NOTES",
    isActive: true,
  });

  // Transform verse lines to styledSections (memoized per section)
  const getSectionData = useCallback((verseLines: VerseLine[]) => {
    return transformVerseLinesToStyledSections(verseLines);
  }, []);

  /**
   * Create text action handler for a section using shared hook
   */
  const createSectionActionHandler = useCallback(
    (section: PlanReadingSection, verseBoundaries: VerseBoundary[], verseLines: VerseLine[]) => {
      const bookName = section.reference.split(" ")[0];
      return createTextActionHandler({
        chapterId: section.chapterId,
        bookName,
        verseBoundaries,
        verseLines,
      });
    },
    [createTextActionHandler]
  );

  // Note: We intentionally do NOT auto-advance to next day on scroll-to-end
  // in study mode. Users can use the day navigator to manually advance.
  // This prevents accidental day changes when scrolling up/down.

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
        <Text style={[styles.loadingText, { color: theme.colors.text.muted }]}>
          Loading study mode...
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={[styles.errorText, { color: theme.colors.text.muted }]}>{error}</Text>
      </View>
    );
  }

  if (sections.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={[styles.emptyText, { color: theme.colors.text.muted }]}>
          No readings for this day
        </Text>
      </View>
    );
  }

  const isCompareMode = studyModeType === "COMPARE" && comparisonVersion;
  const isNotesMode = studyModeType === "NOTES";

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={[
          styles.contentContainer,
          {
            paddingTop: contentPaddingTop || 8,
            paddingBottom: contentPaddingBottom || (insets.bottom + 100),
          },
        ]}
        showsVerticalScrollIndicator={true}
        onScroll={scrollProps?.onScroll}
        scrollEventThrottle={scrollProps?.scrollEventThrottle ?? 16}
        onTouchStart={scrollProps?.onTouchStart}
        onTouchEnd={scrollProps?.onTouchEnd}
        onTouchCancel={scrollProps?.onTouchCancel}
        onScrollBeginDrag={scrollProps?.onScrollBeginDrag}
        onScrollEndDrag={scrollProps?.onScrollEndDrag}
      >
        {sections.map((section, index) => (
          <View key={`${section.reference}-${index}`}>
            {/* Separator between readings (not before first) */}
            {index > 0 && <ReadingSeparator reference={section.reference} />}

            {/* Reading content based on mode */}
            {isCompareMode ? (
              // COMPARE MODE: Two columns side-by-side
              <View style={styles.compareContainer}>
                {/* Left column - Primary version */}
                <View style={styles.compareColumn}>
                  <SectionHeader reference={section.reference} versionId={primaryVersion} />
                  <View style={styles.contentWrapper}>
                    {(() => {
                      const { styledSections, verseBoundaries } = getSectionData(section.primaryVerseLines);
                      return (
                        <ChapterSelectableText
                          sections={styledSections}
                          styleSpec={splitViewStyleSpec}
                          highlights={getHighlightsForVerseLines(section.primaryVerseLines)}
                          onAction={createSectionActionHandler(section, verseBoundaries, section.primaryVerseLines)}
                        />
                      );
                    })()}
                  </View>
                </View>

                {/* Divider */}
                <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

                {/* Right column - Comparison version */}
                <View style={styles.compareColumn}>
                  <SectionHeader
                    reference={section.reference}
                    versionId={comparisonVersion || undefined}
                  />
                  <View style={styles.contentWrapper}>
                    {section.secondaryVerseLines ? (
                      (() => {
                        const secondaryLines = section.secondaryVerseLines!;
                        const { styledSections, verseBoundaries } = getSectionData(secondaryLines);
                        return (
                          <ChapterSelectableText
                            sections={styledSections}
                            styleSpec={splitViewStyleSpec}
                            highlights={getHighlightsForVerseLines(secondaryLines)}
                            onAction={createSectionActionHandler(section, verseBoundaries, secondaryLines)}
                          />
                        );
                      })()
                    ) : (
                      <Text style={[styles.emptyText, { color: theme.colors.text.muted }]}>
                        Version not available
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            ) : isNotesMode ? (
              // NOTES MODE: Bible text + notes column
              <View style={styles.notesContainer}>
                {/* Left column - Bible text */}
                <View style={styles.notesColumn}>
                  <SectionHeader reference={section.reference} />
                  <View style={styles.contentWrapper}>
                    {(() => {
                      const { styledSections, verseBoundaries } = getSectionData(section.primaryVerseLines);
                      return (
                        <ChapterSelectableText
                          sections={styledSections}
                          styleSpec={splitViewStyleSpec}
                          highlights={getHighlightsForVerseLines(section.primaryVerseLines)}
                          onAction={createSectionActionHandler(section, verseBoundaries, section.primaryVerseLines)}
                        />
                      );
                    })()}
                  </View>
                </View>

                {/* Divider */}
                <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

                {/* Right column - Notes (reactive) */}
                <View style={styles.notesColumn}>
                  <NotesSection
                    verseIdStart={section.verseIdStart}
                    verseIdEnd={section.verseIdEnd}
                    chapterId={section.chapterId}
                    bookId={section.bookId}
                    reference={section.reference}
                  />
                </View>
              </View>
            ) : (
              // SIMPLE MODE: Single column (shouldn't reach here in study mode)
              <View>
                <SectionHeader reference={section.reference} />
                <View style={styles.contentWrapper}>
                  {(() => {
                    const { styledSections, verseBoundaries } = getSectionData(section.primaryVerseLines);
                    return (
                      <ChapterSelectableText
                        sections={styledSections}
                        styleSpec={fullWidthStyleSpec}
                        highlights={getHighlightsForVerseLines(section.primaryVerseLines)}
                        onAction={createSectionActionHandler(section, verseBoundaries, section.primaryVerseLines)}
                      />
                    );
                  })()}
                </View>
              </View>
            )}
          </View>
        ))}
      </ScrollView>

      {/* Highlight color picker */}
      <HighlightColorPicker
        visible={highlightActions.highlightPickerVisible}
        onClose={highlightActions.handleCloseHighlightPicker}
        onColorSelect={highlightActions.handleHighlightColorPick}
        onRemoveHighlight={highlightActions.handleRemoveHighlight}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingTop: 8,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  loadingText: {
    fontSize: 14,
  },
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  errorText: {
    fontSize: 14,
    textAlign: "center",
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  referenceText: {
    fontSize: 15,
    fontWeight: "600",
  },
  versionLabel: {
    fontSize: 12,
    fontWeight: "500",
  },
  contentWrapper: {
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  // Compare mode styles
  compareContainer: {
    flexDirection: "row",
  },
  compareColumn: {
    flex: 1,
  },
  divider: {
    width: 1,
  },
  // Notes mode styles
  notesContainer: {
    flexDirection: "row",
  },
  notesColumn: {
    flex: 1,
  },
});
