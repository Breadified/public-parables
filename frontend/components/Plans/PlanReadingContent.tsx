/**
 * PlanReadingContent - Renders Bible chapters for plan readings
 * Uses ChapterSelectableText for cross-paragraph text selection
 * XP is awarded only on day completion button press (not on scroll)
 */

import React, { useEffect, useState, useRef, useCallback, useImperativeHandle, forwardRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  NativeSyntheticEvent,
  NativeScrollEvent,
  LayoutChangeEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/contexts/ThemeContext";
import { useBibleStyleSpec } from "@/contexts/BibleRenderingContext";
import { bibleSQLite, type VerseLine } from "@/services/sqlite";
import { planStore$ } from "@/state";
import { ChapterSelectableText } from "@/modules/expo-selectable-text";
import { HighlightColorPicker } from "@/components/Bible/HighlightColorPicker";
import { transformVerseLinesToStyledSections } from "@/modules/bible/chapterDataTransform";
import { type VerseBoundary } from "@/modules/bible/textUtils";
import { usePlanTextSelection } from "@/hooks/usePlanTextSelection";
import { DayCompletionButton } from "./Progress";
import ReadingRecap from "./ReadingRecap";
import type { BiblePlanReadingData, PlanContentItem } from "@/types/database";

interface ReadingSection {
  reference: string;
  verseLines: VerseLine[];
  styledSections: ReturnType<typeof transformVerseLinesToStyledSections>['styledSections'];
  verseBoundaries: VerseBoundary[];
  chapterId: number;
  bookId: number;
  bookName: string;
  chapterNumber: number;
}

/** Handle for parent to control scrolling */
export interface PlanReadingContentHandle {
  scrollToSection: (index: number) => void;
}

interface PlanReadingContentProps {
  /** New unified content structure - array of intro/reading/recap items */
  content?: PlanContentItem[];
  /** Day number for context */
  dayNumber?: number;

  /** Legacy: readings array (deprecated - use content instead) */
  readings?: BiblePlanReadingData[];
  /** Legacy: recap text to show (deprecated - use content instead) */
  recapText?: string;
  /** Legacy: previous day number for recap header (deprecated) */
  previousDay?: number;

  variant?: "full" | "compact";
  isDayComplete?: boolean; // Whether this day is marked complete
  onDayComplete?: () => void; // Callback when completion button is pressed
  isFutureDay?: boolean; // Whether this is a future day (locks completion button)
  daysUntilUnlock?: number; // Number of days until this day unlocks (for toast)
  sessionId?: string; // Plan session ID (optional, used for tracking)

  /** Padding at top for header overlay */
  contentPaddingTop?: number;
  /** Padding at bottom for FAB/collapsed preview overlays */
  contentPaddingBottom?: number;

  /** Optional content to render at the top of the scroll content (e.g., reminder banner) */
  headerContent?: React.ReactNode;

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

const PlanReadingContentInner = forwardRef<PlanReadingContentHandle, PlanReadingContentProps>(function PlanReadingContent({
  content,
  dayNumber,
  readings: legacyReadings,
  variant = "full",
  recapText: legacyRecapText,
  previousDay,
  isDayComplete = false,
  onDayComplete,
  isFutureDay = false,
  daysUntilUnlock = 1,
  sessionId,
  contentPaddingTop = 0,
  contentPaddingBottom = 0,
  scrollProps,
  headerContent,
}, ref) {
  // Convert legacy props to unified content structure if needed
  const contentItems: PlanContentItem[] = React.useMemo(() => {
    // Use new content array if provided - sort by order
    if (content && content.length > 0) {
      return [...content].sort((a, b) => a.order - b.order);
    }

    // Convert legacy readings + recapText to content array
    const items: PlanContentItem[] = [];

    // Add recap at the beginning (legacy behavior)
    if (legacyRecapText) {
      items.push({
        order: 0,
        type: 'recap',
        text: legacyRecapText,
      });
    }

    // Add readings
    if (legacyReadings) {
      legacyReadings.forEach((reading, index) => {
        items.push({
          order: items.length,
          type: 'reading',
          reference: reading.reference,
          verse_id_start: reading.verse_id_start,
          verse_id_end: reading.verse_id_end,
        });
      });
    }

    return items;
  }, [content, legacyReadings, legacyRecapText]);

  // Extract readings from content items for loading
  const readings = React.useMemo(() =>
    contentItems
      .filter(item => item.type === 'reading')
      .map(item => ({
        reference: item.reference!,
        verse_id_start: item.verse_id_start!,
        verse_id_end: item.verse_id_end!,
        sort_order: item.order,
      })),
    [contentItems]
  );
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const tabBarHeight = insets.bottom + 58;

  // Track content height and scroll position for progress
  const contentHeight = useRef(0);
  const scrollViewHeight = useRef(0);

  // Track section positions for scrollToSection
  const sectionPositions = useRef<Record<number, number>>({});

  // Track reading ID to section index mapping
  const readingIndexMap = useRef<Record<string, number>>({});

  // Get styleSpec with width-based font size (full width)
  const { styleSpec } = useBibleStyleSpec();

  // Shared hook for text selection handling in plan sessions
  const {
    primaryVersion,
    getHighlightsForVerseLines,
    createTextActionHandler,
    highlightActions,
  } = usePlanTextSelection({ usePlanStudyMode: true });

  const [sections, setSections] = useState<ReadingSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const scrollViewRef = useRef<ScrollView>(null);

  // Expose scrollToSection method to parent via ref
  useImperativeHandle(ref, () => ({
    scrollToSection: (index: number) => {
      if (!scrollViewRef.current) return;

      // Index -1 means scroll to top (start/recap)
      if (index === -1) {
        scrollViewRef.current.scrollTo({ y: 0, animated: true });
        return;
      }

      const position = sectionPositions.current[index];
      if (position !== undefined) {
        scrollViewRef.current.scrollTo({ y: position, animated: true });
      }
    },
  }), []);

  // Load all reading sections - reload when readings or version changes
  useEffect(() => {
    loadReadings();
  }, [readings, primaryVersion]);

  const loadReadings = async () => {
    if (readings.length === 0) {
      setSections([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      await bibleSQLite.initialize();

      const loadedSections: ReadingSection[] = [];

      for (const reading of readings) {
        // Parse verse IDs to get chapter info
        // verse_id format: bookId * 1000000 + chapter * 1000 + verse
        const startVerseId = reading.verse_id_start;
        const endVerseId = reading.verse_id_end;

        const startBookId = Math.floor(startVerseId / 1000000);
        const startChapter = Math.floor((startVerseId % 1000000) / 1000);
        const startVerse = startVerseId % 1000;

        const endBookId = Math.floor(endVerseId / 1000000);
        const endChapter = Math.floor((endVerseId % 1000000) / 1000);
        const endVerse = endVerseId % 1000;

        // Single chapter reading
        if (startBookId === endBookId && startChapter === endChapter) {
          const chapterId = startBookId * 1000000 + startChapter * 1000;
          const lines = await bibleSQLite.getVerseLineRange(
            chapterId,
            startVerse,
            endVerse
          );

          if (lines.length > 0) {
            const { styledSections, verseBoundaries } = transformVerseLinesToStyledSections(lines);
            const bookName = reading.reference.split(' ')[0];
            loadedSections.push({
              reference: reading.reference,
              verseLines: lines,
              styledSections,
              verseBoundaries,
              chapterId,
              bookId: startBookId,
              bookName,
              chapterNumber: startChapter,
            });
          }
        } else {
          // Multi-chapter reading - load each chapter
          for (let book = startBookId; book <= endBookId; book++) {
            const chapStart = book === startBookId ? startChapter : 1;
            const chapEnd = book === endBookId ? endChapter : 150;

            for (let chap = chapStart; chap <= chapEnd; chap++) {
              const chapterId = book * 1000000 + chap * 1000;
              const vStart = book === startBookId && chap === startChapter ? startVerse : 1;
              const vEnd = book === endBookId && chap === endChapter ? endVerse : 999;

              const lines = await bibleSQLite.getVerseLineRange(chapterId, vStart, vEnd);

              if (lines.length > 0) {
                const sectionRef = chap === startChapter && book === startBookId
                  ? reading.reference
                  : `${reading.reference.split(" ")[0]} ${chap}`;
                const { styledSections, verseBoundaries } = transformVerseLinesToStyledSections(lines);
                const bookName = reading.reference.split(' ')[0];

                loadedSections.push({
                  reference: sectionRef,
                  verseLines: lines,
                  styledSections,
                  verseBoundaries,
                  chapterId,
                  bookId: book,
                  bookName,
                  chapterNumber: chap,
                });
              }
            }
          }
        }
      }

      setSections(loadedSections);
    } catch (err) {
      console.error("[PlanReadingContent] Error loading readings:", err);
      setError(err instanceof Error ? err.message : "Failed to load readings");
    } finally {
      setLoading(false);
    }
  };

  // Create text action handlers for sections using shared hook
  const createSectionActionHandler = useCallback((section: ReadingSection) => {
    return createTextActionHandler({
      chapterId: section.chapterId,
      bookName: section.bookName,
      verseBoundaries: section.verseBoundaries,
      verseLines: section.verseLines,
    });
  }, [createTextActionHandler]);

  // Calculate and update reading start positions when we have all measurements
  const updateReadingStartPositions = useCallback(() => {
    if (variant !== "full" || sections.length === 0) return;
    if (contentHeight.current === 0 || scrollViewHeight.current === 0) return;

    const maxScroll = contentHeight.current - scrollViewHeight.current;
    if (maxScroll <= 0) return;

    const positions: Record<string, number> = {};

    sections.forEach((section, index) => {
      const sectionTop = sectionPositions.current[index];
      if (sectionTop !== undefined) {
        // Calculate position as percentage of max scroll (0-1)
        // Clamp to ensure it's within valid range
        const position = Math.min(1, Math.max(0, sectionTop / maxScroll));
        positions[section.reference] = position;
        // Also store the mapping for reference
        readingIndexMap.current[section.reference] = index;
      }
    });

    // Only update if we have all positions
    if (Object.keys(positions).length === sections.length) {
      planStore$.updateReadingStartPositions(positions);
    }
  }, [variant, sections]);

  // Handle scroll events to track reading progress (for completion button enabling)
  // Also calls external scroll handlers for UI auto-hide functionality
  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      // Call external scroll handlers for UI auto-hide (tap-to-show, scroll-to-hide)
      scrollProps?.onScroll?.(event);

      if (variant !== "full") return; // Only track progress in full mode

      const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
      const didSizeChange = contentHeight.current !== contentSize.height ||
                           scrollViewHeight.current !== layoutMeasurement.height;
      contentHeight.current = contentSize.height;
      scrollViewHeight.current = layoutMeasurement.height;

      // Calculate overall scroll progress (0-1)
      const maxScroll = contentSize.height - layoutMeasurement.height;
      if (maxScroll > 0) {
        const progress = Math.min(1, Math.max(0, contentOffset.y / maxScroll));
        planStore$.updateScrollProgress(progress);
      }

      // Recalculate reading start positions if sizes changed
      if (didSizeChange) {
        updateReadingStartPositions();
      }

      // Calculate progress for each reading section
      // Uses measured section positions for accuracy
      if (sections.length > 0) {
        const viewportTop = contentOffset.y;

        sections.forEach((section, index) => {
          // Get actual section position if available, otherwise estimate
          const sectionTop = sectionPositions.current[index] ?? (index * (contentSize.height / sections.length));
          const nextSectionTop = sectionPositions.current[index + 1] ?? ((index + 1) * (contentSize.height / sections.length));
          const sectionHeight = nextSectionTop - sectionTop;

          // Calculate how much of this section has been scrolled past
          if (viewportTop > sectionTop && sectionHeight > 0) {
            const sectionProgress = Math.min(1, (viewportTop - sectionTop) / sectionHeight);
            planStore$.updateReadingScrollPosition(section.reference, sectionProgress);
          }
        });
      }
    },
    [variant, sections, updateReadingStartPositions, scrollProps]
  );

  // Check if completion button should be enabled (scrolled to near end)
  const isCompletionEnabled = variant === "full" &&
    planStore$.dayProgress.maxScrollProgress.peek() >= 0.8;

  // Handle ScrollView layout to get viewport height
  const handleScrollViewLayout = useCallback((event: LayoutChangeEvent) => {
    const { height } = event.nativeEvent.layout;
    if (scrollViewHeight.current !== height) {
      scrollViewHeight.current = height;
      updateReadingStartPositions();
    }
  }, [updateReadingStartPositions]);

  // Handle content size change to get total content height
  const handleContentSizeChange = useCallback((width: number, height: number) => {
    if (contentHeight.current !== height) {
      contentHeight.current = height;
      updateReadingStartPositions();
    }
  }, [updateReadingStartPositions]);

  // Build a unified render list that interleaves intro/recap with reading sections
  // Must be called before early returns (React hooks rules)
  const renderItems = React.useMemo(() => {
    const items: Array<{
      key: string;
      type: 'intro' | 'recap' | 'reading';
      contentItem?: PlanContentItem;
      section?: ReadingSection;
      sectionIndex?: number;
    }> = [];

    // Track which reading section we're on
    let readingIndex = 0;

    contentItems.forEach((item, contentIndex) => {
      if (item.type === 'intro' || item.type === 'recap') {
        items.push({
          key: `${item.type}-${contentIndex}`,
          type: item.type,
          contentItem: item,
        });
      } else if (item.type === 'reading') {
        // Find the matching section for this reading
        const section = sections[readingIndex];
        if (section) {
          items.push({
            key: `reading-${contentIndex}-${section.reference}`,
            type: 'reading',
            contentItem: item,
            section,
            sectionIndex: readingIndex,
          });
          readingIndex++;
        }
      }
    });

    return items;
  }, [contentItems, sections]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
        <Text style={[styles.loadingText, { color: theme.colors.text.muted }]}>
          Loading today&apos;s reading...
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={[styles.errorText, { color: theme.colors.text.muted }]}>
          {error}
        </Text>
      </View>
    );
  }

  if (sections.length === 0 && contentItems.filter(c => c.type !== 'reading').length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={[styles.emptyText, { color: theme.colors.text.muted }]}>
          No readings for this day
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      ref={scrollViewRef}
      style={styles.container}
      contentContainerStyle={[
        styles.contentContainer,
        {
          paddingTop: contentPaddingTop || 8,
          paddingBottom: variant === "full" ? (contentPaddingBottom || tabBarHeight) + 100 : 24,
        },
      ]}
      showsVerticalScrollIndicator={false}
      onScroll={handleScroll}
      scrollEventThrottle={scrollProps?.scrollEventThrottle ?? 16}
      onLayout={handleScrollViewLayout}
      onContentSizeChange={handleContentSizeChange}
      // Touch handlers for UI auto-hide (tap-to-toggle, scroll-to-hide)
      onTouchStart={scrollProps?.onTouchStart}
      onTouchEnd={scrollProps?.onTouchEnd}
      onTouchCancel={scrollProps?.onTouchCancel}
      onScrollBeginDrag={scrollProps?.onScrollBeginDrag}
      onScrollEndDrag={scrollProps?.onScrollEndDrag}
    >
      {/* Optional header content (e.g., reminder banner) */}
      {headerContent}

      {/* Render content items in order (intro, reading, recap interleaved) */}
      {renderItems.map((item) => {
        // Render intro or recap text
        if (item.type === 'intro' || item.type === 'recap') {
          if (variant !== "full" || !item.contentItem?.text) return null;
          return (
            <ReadingRecap
              key={item.key}
              text={item.contentItem.text}
              variant={item.type}
              dayNumber={item.type === 'recap' ? (dayNumber ? dayNumber - 1 : previousDay) : dayNumber}
            />
          );
        }

        // Render reading section
        if (item.type === 'reading' && item.section) {
          return (
            <View
              key={item.key}
              style={styles.sectionContainer}
              onLayout={(event: LayoutChangeEvent) => {
                if (item.sectionIndex !== undefined) {
                  sectionPositions.current[item.sectionIndex] = event.nativeEvent.layout.y;
                  // Trigger position update when all sections have been measured
                  if (Object.keys(sectionPositions.current).length === sections.length) {
                    updateReadingStartPositions();
                  }
                }
              }}
            >
              {/* Section reference header */}
              <View style={[styles.referenceHeader, { borderBottomColor: theme.colors.border }]}>
                <Text style={[styles.referenceText, { color: theme.colors.text.primary }]}>
                  {item.section.reference}
                </Text>
              </View>

              {/* Bible content - ChapterSelectableText for cross-paragraph selection */}
              <View style={styles.contentWrapper}>
                <ChapterSelectableText
                  sections={item.section.styledSections}
                  styleSpec={styleSpec}
                  highlights={getHighlightsForVerseLines(item.section.verseLines)}
                  onAction={createSectionActionHandler(item.section)}
                />
              </View>
            </View>
          );
        }

        return null;
      })}

      {/* Day Completion Button - only shown in full mode */}
      {/* Button is already inside readingContent area, so it centers naturally */}
      {variant === "full" && onDayComplete && (
        <DayCompletionButton
          isComplete={isDayComplete}
          isEnabled={isCompletionEnabled}
          isLocked={isFutureDay}
          daysUntilUnlock={daysUntilUnlock}
          onPress={onDayComplete}
        />
      )}

      <HighlightColorPicker
        visible={highlightActions.highlightPickerVisible}
        onClose={highlightActions.handleCloseHighlightPicker}
        onColorSelect={highlightActions.handleHighlightColorPick}
        onRemoveHighlight={highlightActions.handleRemoveHighlight}
      />
    </ScrollView>
  );
});

// Export with ref support - useSelector hooks handle reactivity
export default PlanReadingContentInner;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    // paddingTop and paddingBottom set dynamically via props
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
  sectionContainer: {
    marginBottom: 24,
  },
  referenceHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: 8,
  },
  referenceText: {
    fontSize: 18,
    fontWeight: "600",
  },
  contentWrapper: {
    paddingHorizontal: 8,
  },
});
