/**
 * Bible Peek Component
 * Displays a scrollable Bible reference with configurable context chapters
 * Uses BiblePeekWindow for recessed panel effect and BibleContentRenderer for consistent formatting
 */

import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { useSelector } from "@legendapp/state/react";

import {
  bibleSQLite,
  type ChapterContent,
  type VerseLine,
} from "@/services/sqlite";
import { appStateStore$ } from "@/state/appStateStore";
import { BibleContentRenderer } from "@/components/Bible/BibleContentRenderer";
import {
  BiblePeekWindow,
  type BiblePeekWindowRef,
} from "@/components/Bible/BiblePeekWindow";
import { HighlightedText } from "@/components/Bible/HighlightedText";
import { createBibleStyles } from "@/components/Bible/BibleStyles";
import { useTheme } from "@/contexts/ThemeContext";

export interface BiblePeekProps {
  reference: string; // e.g., "John 3:16-17"
  bookNumber: number;
  chapter: number;
  verseStart?: number;
  verseEnd?: number;
  noteId: string; // For scroll position persistence (future)
  onDelete?: () => void;
  fontSize?: number; // For responsive font sizing from parent note
  showHeader?: boolean; // Whether to show the header in BiblePeekWindow (default: true)
  showCloseButton?: boolean; // Whether to show close button (default: true)
  contextChapters?: number; // Override context chapters (default: from settings, typically 2)
}

// Represents a renderable item (a paragraph or segment that may be highlighted)
type RenderableItem = {
  paragraphData: { paragraph: any; verseLines: VerseLine[] };
  highlighted: boolean; // true if ALL lines in this item should be highlighted
  partial: boolean; // true if this paragraph contains mixed highlight/non-highlight
  key: string;
  // Section info - only set on first paragraph of a section
  sectionTitle?: string | null;
  sectionSubtitle?: string | null;
  isFirstInSection: boolean;
};

export const BiblePeek: React.FC<BiblePeekProps> = ({
  reference,
  bookNumber,
  chapter,
  verseStart,
  verseEnd,
  onDelete,
  fontSize: propFontSize,
  showHeader = true,
  showCloseButton = true,
}) => {
  const { theme } = useTheme();
  const rawSettings = useSelector(appStateStore$.biblePeekSettings);
  const settings = rawSettings || { visibleLines: 8, contextChapters: 2 };

  const effectiveFontSize = propFontSize || 14;

  const bibleStyles = React.useMemo(
    () =>
      createBibleStyles({
        theme,
        fontSize: effectiveFontSize,
        contentPadding: 2, // Minimal padding for BiblePeek
        responsiveFontSizes: {
          small: effectiveFontSize * 0.875,
          base: effectiveFontSize,
          large: effectiveFontSize * 1.125,
          title: effectiveFontSize * 1.25,
        },
        isSmallScreen: false,
        indentIncrement: 8, // Compact indent for BiblePeek
      }),
    [theme, effectiveFontSize]
  );

  const [chapters, setChapters] = useState<ChapterContent[]>([]);
  const [loading, setLoading] = useState(true);

  const windowRef = useRef<BiblePeekWindowRef>(null);

  const containerHeight = settings.visibleLines * 24;

  useEffect(() => {
    loadChapters();
  }, [bookNumber, chapter, settings.contextChapters]);

  const loadChapters = async () => {
    try {
      setLoading(true);
      const result = await bibleSQLite.getChaptersForBiblePeek(
        bookNumber,
        chapter,
        settings.contextChapters
      );
      setChapters(result.chapters);
    } catch (error) {
      console.error("[BiblePeek] Error loading chapters:", error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate verse IDs to highlight
  const highlightVerseStart = verseStart
    ? bookNumber * 1000000 + chapter * 1000 + verseStart
    : null;
  const highlightVerseEnd = verseEnd
    ? bookNumber * 1000000 + chapter * 1000 + verseEnd
    : highlightVerseStart;

  // Check if a verse ID is within the highlight range
  const isVerseHighlighted = (verseId: number): boolean => {
    if (!highlightVerseStart) return false;
    const end = highlightVerseEnd ?? highlightVerseStart;
    return verseId >= highlightVerseStart && verseId <= end;
  };

  // Check paragraph highlight status
  const getParagraphHighlightStatus = (
    verseLines: VerseLine[]
  ): { all: boolean; some: boolean; none: boolean } => {
    if (!highlightVerseStart) return { all: false, some: false, none: true };

    let highlightedCount = 0;
    verseLines.forEach((line) => {
      if (isVerseHighlighted(line.verse_id)) highlightedCount++;
    });

    return {
      all: highlightedCount === verseLines.length,
      some: highlightedCount > 0 && highlightedCount < verseLines.length,
      none: highlightedCount === 0,
    };
  };

  const fullWidthStyle = { marginHorizontal: -12 };

  // Render section title if present
  const renderSectionTitle = useCallback((item: RenderableItem) => {
    if (!item.sectionTitle && !item.sectionSubtitle) return null;

    return (
      <View key={`section-${item.key}`}>
        {item.sectionTitle && (
          <Text
            style={[
              bibleStyles.sectionTitle,
              { color: theme.colors.text.muted },
            ]}
          >
            {item.sectionTitle}
          </Text>
        )}
        {item.sectionSubtitle && (
          <Text
            style={[
              bibleStyles.sectionSubtitle,
              { color: theme.colors.text.muted },
            ]}
          >
            {item.sectionSubtitle}
          </Text>
        )}
      </View>
    );
  }, [bibleStyles, theme.colors.text.muted]);

  // Render a paragraph using BibleContentRenderer
  const renderParagraph = useCallback((
    paragraphData: { paragraph: any; verseLines: VerseLine[] },
    key: string,
    passHighlightRange: boolean
  ) => {
    const isPoetry = paragraphData.paragraph.is_poetry;

    return (
      <BibleContentRenderer
        key={key}
        verseLines={paragraphData.verseLines}
        isPoetry={isPoetry}
        showVerseNumbers={true}
        styles={bibleStyles}
        contentPadding={2}
        indentIncrement={8} // Compact indent for BiblePeek
        highlightVerseStart={passHighlightRange ? highlightVerseStart : null}
        highlightVerseEnd={passHighlightRange ? highlightVerseEnd : null}
        compact={true}
      />
    );
  }, [bibleStyles, highlightVerseStart, highlightVerseEnd]);

  // Find which chapter index contains the first highlight
  const initialScrollIndex = useMemo(() => {
    if (!highlightVerseStart) return undefined;

    for (let i = 0; i < chapters.length; i++) {
      const chapterContent = chapters[i];
      for (const sectionData of chapterContent.sections) {
        for (const paragraphData of sectionData.paragraphs) {
          for (const line of paragraphData.verseLines) {
            if (isVerseHighlighted(line.verse_id)) {
              return i;
            }
          }
        }
      }
    }
    return undefined;
  }, [chapters, highlightVerseStart, isVerseHighlighted]);

  // Render a single chapter - used by FlashList
  const renderChapter = useCallback((chapterContent: ChapterContent, chapterIdx: number) => {
    // Build items for this chapter
    const items: RenderableItem[] = [];
    let paragraphIdx = 0;

    chapterContent.sections.forEach((sectionData) => {
      sectionData.paragraphs.forEach((paragraphData, sectionParagraphIdx) => {
        const status = getParagraphHighlightStatus(paragraphData.verseLines);
        const isFirstInSection = sectionParagraphIdx === 0;
        items.push({
          paragraphData,
          highlighted: status.all,
          partial: status.some,
          key: `c${chapterIdx}-p${paragraphIdx}`,
          sectionTitle: isFirstInSection ? sectionData.section.title : null,
          sectionSubtitle: isFirstInSection ? sectionData.section.subtitle : null,
          isFirstInSection,
        });
        paragraphIdx++;
      });
    });

    // Render items, grouping consecutive fully-highlighted ones
    const renderedItems: React.ReactNode[] = [];
    let i = 0;

    while (i < items.length) {
      const item = items[i];

      if (item.highlighted) {
        // Collect consecutive fully-highlighted paragraphs
        const highlightGroup: RenderableItem[] = [];
        while (i < items.length && items[i].highlighted) {
          highlightGroup.push(items[i]);
          i++;
        }

        // Render section titles before the highlight group (for first item if it has one)
        const firstItem = highlightGroup[0];
        if (firstItem.sectionTitle || firstItem.sectionSubtitle) {
          renderedItems.push(renderSectionTitle(firstItem));
        }

        // Wrap all in a single HighlightedText
        renderedItems.push(
          <View key={`highlight-${highlightGroup[0].key}`}>
            <HighlightedText>
              {highlightGroup.map((groupItem, groupIdx) => (
                <React.Fragment key={groupItem.key}>
                  {groupIdx > 0 && renderSectionTitle(groupItem)}
                  {renderParagraph(groupItem.paragraphData, groupItem.key, false)}
                </React.Fragment>
              ))}
            </HighlightedText>
          </View>
        );
      } else if (item.partial) {
        // Render section title before the partial highlight
        if (item.sectionTitle || item.sectionSubtitle) {
          renderedItems.push(renderSectionTitle(item));
        }

        // Partial highlight - let BibleContentRenderer handle the splitting
        renderedItems.push(
          <View key={item.key}>
            {renderParagraph(item.paragraphData, item.key, true)}
          </View>
        );
        i++;
      } else {
        // Render section title before non-highlighted paragraph
        if (item.sectionTitle || item.sectionSubtitle) {
          renderedItems.push(renderSectionTitle(item));
        }
        // No highlight - render normally
        renderedItems.push(renderParagraph(item.paragraphData, item.key, false));
        i++;
      }
    }

    return (
      <View>
        {/* Chapter Header */}
        <View
          style={{
            paddingTop: chapterIdx > 0 ? 12 : 0,
            paddingBottom: 4,
          }}
        >
          <Text
            style={{
              fontSize: effectiveFontSize,
              fontWeight: "bold",
              color: theme.colors.text.primary,
            }}
          >
            {chapterContent.chapter.book_name} {chapterContent.chapter.chapter_number}
          </Text>
        </View>

        {/* Rendered paragraphs with grouped highlights and inline section titles */}
        {renderedItems}

        {/* Spacing between chapters */}
        {chapterIdx < chapters.length - 1 && <View style={{ height: 16 }} />}
      </View>
    );
  }, [
    chapters.length,
    effectiveFontSize,
    theme.colors.text.primary,
    getParagraphHighlightStatus,
    renderSectionTitle,
    renderParagraph,
  ]);

  // Loading state
  if (loading) {
    return (
      <View style={fullWidthStyle}>
        <View style={{ marginVertical: 4 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 2, paddingHorizontal: 12 }}>
            <Text style={{ fontSize: 12, fontWeight: "600", color: theme.colors.text.secondary }}>{reference}</Text>
          </View>
          <View style={{ height: containerHeight, justifyContent: "center", alignItems: "center" }}>
            <ActivityIndicator size="small" color={theme.colors.text.muted} />
          </View>
        </View>
      </View>
    );
  }

  // Error state
  if (chapters.length === 0) {
    return (
      <View style={fullWidthStyle}>
        <View style={{ marginVertical: 4 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 2, paddingHorizontal: 12 }}>
            <Text style={{ fontSize: 12, fontWeight: "600", color: theme.colors.text.secondary }}>{reference}</Text>
          </View>
          <View style={{ height: containerHeight, justifyContent: "center", alignItems: "center" }}>
            <Text style={{ color: theme.colors.text.muted, fontSize: 14 }}>
              Unable to load chapters
            </Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={fullWidthStyle}>
      <BiblePeekWindow
        ref={windowRef}
        header={reference}
        onClose={onDelete}
        maxHeight={containerHeight}
        data={chapters}
        renderChapter={renderChapter}
        initialScrollIndex={initialScrollIndex}
        showHeader={showHeader}
        showCloseButton={showCloseButton}
      />
    </View>
  );
};
