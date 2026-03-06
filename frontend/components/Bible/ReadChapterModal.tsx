/**
 * ReadChapterModal - Full book reader modal with verse highlighting
 *
 * Opens from bibleRef in comments, displays entire book scrollable
 * with the referenced chapter as initial scroll position and verse highlighted.
 */

import React, { useMemo, useRef, useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  Modal,
  StyleSheet,
  Pressable,
  Platform,
  useWindowDimensions,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSelector } from "@legendapp/state/react";

import { useTheme } from "@/contexts/ThemeContext";
import { useSimplifiedBibleLoader } from "@/hooks/useSimplifiedBibleLoader";
import { useFlashListConfig } from "@/hooks/useFlashListConfig";
import { BibleContentRenderer } from "@/components/Bible/BibleContentRenderer";
import { createBibleStyles } from "@/components/Bible/BibleStyles";
import { LoadingScriptureOverlay } from "@/components/LoadingScriptureOverlay";
import { bibleVersionStore$ } from "@/state/bibleVersionStore";
import type { VerseLine } from "@/services/sqlite";
import type { VerseReference } from "@/state";

interface ReadChapterModalProps {
  visible: boolean;
  onClose: () => void;
  verseRef: VerseReference | null;
}

// Render item types for FlashList
type RenderItem =
  | { type: "chapter-header"; chapterId: number; title: string; key: string }
  | { type: "section-header"; title: string; subtitle?: string; key: string }
  | {
      type: "paragraph";
      verseLines: VerseLine[];
      isPoetry: boolean;
      key: string;
    };

const ReadChapterModal = ({
  visible,
  onClose,
  verseRef,
}: ReadChapterModalProps) => {
  const { theme, themeMode } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const flashListRef = useRef<any>(null);
  const hasScrolledRef = useRef(false);

  // Track if we've attempted the initial scroll
  const hasAttemptedScrollRef = useRef(false);

  // Get user's selected Bible version
  const primaryVersion = useSelector(bibleVersionStore$.primaryVersion);

  // Calculate chapter ID from verseRef
  const targetChapterId = useMemo(() => {
    if (!verseRef) return 0;
    return verseRef.bookNumber * 1000000 + verseRef.chapter * 1000;
  }, [verseRef?.bookNumber, verseRef?.chapter]);

  // Calculate selected verse ID for highlighting
  const selectedVerseId = useMemo(() => {
    if (!verseRef) return null;
    return (
      verseRef.bookNumber * 1000000 +
      verseRef.chapter * 1000 +
      verseRef.verseStart
    );
  }, [verseRef?.bookNumber, verseRef?.chapter, verseRef?.verseStart]);

  // Load chapters using existing hook with high loadSize for entire book
  // PERFORMANCE: Only load when modal is visible
  const { chapters, isLoading } = useSimplifiedBibleLoader({
    initialChapterId: targetChapterId,
    loadSize: 200, // Load entire book (Psalms has 150 chapters)
    versionId: primaryVersion,
    isActive: visible, // Skip loading when modal is hidden
  });

  // FlashList config for high-performance virtualization
  const flashListConfig = useFlashListConfig({
    estimatedItemSize: 100,
    loadMoreThreshold: 1.5,
  });

  // Create Bible styles
  const bibleStyles = useMemo(
    () =>
      createBibleStyles({
        theme,
        fontSize: 16,
        contentPadding: 16,
        responsiveFontSizes: {
          small: 14,
          base: 16,
          large: 18,
          title: 20,
        },
        isSmallScreen: false,
        splitScreen: false,
      }),
    [theme]
  );

  // Calculate book boundaries for filtering
  const bookBoundaries = useMemo(() => {
    if (!verseRef) return { min: 0, max: 0 };
    const bookNumber = verseRef.bookNumber;
    return {
      min: bookNumber * 1000000,
      max: (bookNumber + 1) * 1000000,
    };
  }, [verseRef?.bookNumber]);

  // Filter chapters to only include the target book
  const bookChapters = useMemo(() => {
    if (!chapters || Object.keys(chapters).length === 0) return {};

    const filtered: typeof chapters = {};
    Object.keys(chapters).forEach((key) => {
      const chapterId = Number(key);
      // Only include chapters from the target book
      if (chapterId >= bookBoundaries.min && chapterId < bookBoundaries.max) {
        filtered[chapterId] = chapters[chapterId];
      }
    });
    return filtered;
  }, [chapters, bookBoundaries]);

  // Extract book name from filtered chapters
  const bookName = useMemo(() => {
    if (!bookChapters || Object.keys(bookChapters).length === 0) return "";
    const firstChapterId = Object.keys(bookChapters)
      .map(Number)
      .sort((a, b) => a - b)[0];
    return bookChapters[firstChapterId]?.chapter?.book_name || "";
  }, [bookChapters]);

  // Convert chapters to render items (only from target book)
  const items = useMemo((): RenderItem[] => {
    if (!bookChapters || Object.keys(bookChapters).length === 0) return [];

    const renderItems: RenderItem[] = [];
    const sortedIds = Object.keys(bookChapters)
      .map(Number)
      .sort((a, b) => a - b);

    sortedIds.forEach((chapterId) => {
      const content = bookChapters[chapterId];
      if (!content) return;

      const chapterKey = `ch-${chapterId}`;

      // Chapter header
      renderItems.push({
        type: "chapter-header",
        chapterId: content.chapter.id,
        title: `Chapter ${content.chapter.chapter_number}`,
        key: chapterKey,
      });

      // Sections and paragraphs
      content.sections.forEach((section, sectionIdx) => {
        if (section.section.title || section.section.subtitle) {
          renderItems.push({
            type: "section-header",
            title: section.section.title || "",
            subtitle: section.section.subtitle,
            key: `${chapterKey}-sec-${sectionIdx}`,
          });
        }

        section.paragraphs.forEach((paragraph) => {
          const validVerseLines: VerseLine[] = paragraph.verseLines
            .filter((vl) => vl && typeof vl === "object")
            .map((vl) => ({
              id: vl.id,
              version_id: vl.version_id,
              verse_id: vl.verse_id,
              paragraph_id: vl.paragraph_id,
              verse_number: vl.verse_number || null,
              show_verse_number: vl.show_verse_number || false,
              text: String(vl.text || ""),
              indent_level: vl.indent_level || 0,
              is_isolated: vl.is_isolated || false,
              line_order: vl.line_order || 0,
            }));

          if (validVerseLines.length === 0) return;

          const isPoetry = validVerseLines.some((vl) => vl.indent_level > 0);
          renderItems.push({
            type: "paragraph",
            verseLines: validVerseLines,
            isPoetry,
            key: `${chapterKey}-para-${paragraph.paragraph.id}`,
          });
        });
      });
    });

    return renderItems;
  }, [bookChapters]);

  // Find initial scroll index for target chapter
  const initialScrollIndex = useMemo(() => {
    if (items.length === 0 || !targetChapterId) return -1;

    const index = items.findIndex(
      (item) =>
        item.type === "chapter-header" && item.chapterId === targetChapterId
    );
    return index;
  }, [items, targetChapterId]);

  // ✅ Simplified navigation for modal (mixed item types, simpler requirements)
  // Track navigation state
  const [isNavigationComplete, setIsNavigationComplete] = useState(false);

  // Reset state when modal visibility changes
  useEffect(() => {
    if (!visible) {
      hasScrolledRef.current = false;
      hasAttemptedScrollRef.current = false;
      setIsNavigationComplete(false);
    }
  }, [visible]);

  // Scroll to target chapter when items are ready
  useEffect(() => {
    if (!visible || items.length === 0 || initialScrollIndex < 0 || hasAttemptedScrollRef.current) {
      return;
    }

    hasAttemptedScrollRef.current = true;

    // Wait for FlashList to be ready, then scroll
    const scrollTimer = setTimeout(() => {
      if (flashListRef.current && initialScrollIndex < items.length) {
        console.log('[ReadChapterModal] 📜 Programmatic scroll to index:', initialScrollIndex);
        flashListRef.current.scrollToIndex({
          index: initialScrollIndex,
          animated: false,
        });
        // Mark navigation complete after scroll command
        setTimeout(() => {
          setIsNavigationComplete(true);
          console.log('[ReadChapterModal] ✅ Navigation complete');
        }, 100);
      }
    }, 100);

    return () => clearTimeout(scrollTimer);
  }, [visible, items.length, initialScrollIndex]);

  // Get item type for FlashList optimization
  const getItemType = useCallback((item: RenderItem) => item.type, []);

  // Render item
  const renderItem = useCallback(
    ({ item }: { item: RenderItem }) => {
      if (!item) return null;

      if (item.type === "chapter-header") {
        return (
          <View style={styles.chapterHeader}>
            <Text
              style={[styles.chapterHeaderText, { color: theme.colors.accent }]}
            >
              {item.title}
            </Text>
          </View>
        );
      }

      if (item.type === "section-header") {
        return (
          <View style={styles.sectionHeader}>
            {item.title && (
              <Text
                style={[
                  styles.sectionTitle,
                  { color: theme.colors.text.primary },
                ]}
              >
                {item.title}
              </Text>
            )}
            {item.subtitle && (
              <Text
                style={[
                  styles.sectionSubtitle,
                  { color: theme.colors.text.muted },
                ]}
              >
                {item.subtitle}
              </Text>
            )}
          </View>
        );
      }

      if (item.type === "paragraph") {
        return (
          <View style={styles.paragraph}>
            <BibleContentRenderer
              verseLines={item.verseLines}
              isPoetry={item.isPoetry}
              showVerseNumbers={true}
              styles={bibleStyles}
              selectedVerseId={selectedVerseId}
            />
          </View>
        );
      }

      return null;
    },
    [bibleStyles, selectedVerseId, theme]
  );

  // Key extractor
  const keyExtractor = useCallback((item: RenderItem) => item.key, []);

  // Override item layout for performance
  const overrideItemLayout = useCallback(
    (layout: { span?: number; size?: number }, item: RenderItem) => {
      if (item.type === "chapter-header") {
        layout.size = 72;
      } else if (item.type === "section-header") {
        layout.size = item.subtitle ? 70 : 50;
      } else if (item.type === "paragraph") {
        const lineCount = item.verseLines?.length || 1;
        const baseHeight = 16;
        const lineHeight = 16 * (item.isPoetry ? 1.6 : 1.75);
        layout.size = baseHeight + lineCount * lineHeight * 1.2;
      }
    },
    []
  );

  // Handle backdrop press
  const handleBackdropPress = useCallback(() => {
    onClose();
  }, [onClose]);

  if (!verseRef) return null;

  const modalWidth = Math.min(screenWidth * 0.95, 600);
  const modalHeight = screenHeight * 0.88;

  // Show loading when: still fetching, no chapters from target book, OR navigation not complete
  const hasBookChapters = Object.keys(bookChapters).length > 0;
  const showLoading = isLoading || !hasBookChapters || !isNavigationComplete;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {/* Backdrop */}
      <Pressable style={styles.backdrop} onPress={handleBackdropPress}>
        {Platform.OS === "ios" ? (
          <BlurView
            intensity={20}
            tint={themeMode === "dark" ? "dark" : "light"}
            style={StyleSheet.absoluteFill}
          />
        ) : (
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: "rgba(0, 0, 0, 0.6)" },
            ]}
          />
        )}
      </Pressable>

      {/* Modal Content */}
      <View style={styles.centeredContainer} pointerEvents="box-none">
        <View
          style={[
            styles.modalContent,
            {
              backgroundColor: theme.colors.background.primary,
              width: modalWidth,
              height: modalHeight,
              marginTop: insets.top + 16,
            },
          ]}
        >
          {/* Header */}
          <View
            style={[styles.header, { borderBottomColor: theme.colors.border }]}
          >
            <Text
              style={[styles.bookTitle, { color: theme.colors.text.primary }]}
            >
              {bookName || verseRef.reference.split(" ")[0]}
            </Text>
            <Pressable
              onPress={onClose}
              style={[
                styles.closeButton,
                { backgroundColor: theme.colors.background.secondary },
              ]}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text
                style={[
                  styles.closeButtonText,
                  { color: theme.colors.text.primary },
                ]}
              >
                ✕
              </Text>
            </Pressable>
          </View>

          {/* Content area */}
          <View style={styles.listContainer}>
            {hasBookChapters && (
              <FlashList
                ref={flashListRef}
                data={items}
                renderItem={renderItem}
                keyExtractor={keyExtractor}
                getItemType={getItemType}
                {...flashListConfig.props}
                overrideItemLayout={overrideItemLayout}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={true}
              />
            )}
          </View>

          {/* Loading overlay - positioned at modalContent level to avoid FlashList z-index issues */}
          {showLoading && (
            <View style={styles.contentOverlay}>
              <LoadingScriptureOverlay visible={true} />
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

export default ReadChapterModal;

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  centeredContainer: {
    flex: 1,
    alignItems: "center",
  },
  modalContent: {
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  bookTitle: {
    fontSize: 18,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  listContainer: {
    flex: 1,
  },
  contentOverlay: {
    position: "absolute",
    top: 60, // Below header (header height ~60px)
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
    elevation: 100,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  chapterHeader: {
    paddingTop: 32,
    paddingBottom: 16,
  },
  chapterHeaderText: {
    fontSize: 14,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 2,
  },
  sectionHeader: {
    paddingVertical: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 22,
  },
  sectionSubtitle: {
    fontSize: 14,
    fontStyle: "italic",
    marginTop: 4,
  },
  paragraph: {
    paddingVertical: 4,
  },
});
