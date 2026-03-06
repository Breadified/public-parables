/**
 * BiblePeekWindow Component
 * A "window" container that creates an inset panel effect with inner shadow
 * Full width with minimal padding for content density
 */

import React, {
  useRef,
  useImperativeHandle,
  forwardRef,
  useCallback,
} from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/contexts/ThemeContext";
import { toTransparent } from "@/utils/themeHelpers";
import { type ChapterContent } from "@/services/sqlite";
import { useFlashListConfig } from "@/hooks/useFlashListConfig";

interface BiblePeekWindowProps {
  header: string; // e.g., "Genesis 18:5"
  onClose?: () => void;
  maxHeight?: number;
  data: ChapterContent[];
  renderChapter: (chapter: ChapterContent, index: number) => React.ReactElement;
  initialScrollIndex?: number; // For auto-scroll to highlighted chapter
  showHeader?: boolean; // Whether to show the header (default: true)
  showCloseButton?: boolean; // Whether to show close button (default: true)
}

export interface BiblePeekWindowRef {
  scrollToIndex: (index: number, animated?: boolean) => void;
  scrollToOffset: (offset: number, animated?: boolean) => void;
}

/**
 * Creates an inset panel effect for Bible content
 * Uses layered views to simulate inner shadow (React Native doesn't support inset shadows)
 */
const BiblePeekWindowComponent = forwardRef<
  BiblePeekWindowRef,
  BiblePeekWindowProps
>(({ header, onClose, maxHeight = 300, data, renderChapter, initialScrollIndex, showHeader = true, showCloseButton = true }, ref) => {
  const { theme } = useTheme();
  const flashListRef = useRef<any>(null);

  // FlashList config for BiblePeek (smaller chapters, fewer items than main Bible view)
  const flashListConfig = useFlashListConfig({
    estimatedItemSize: 200, // Chapters in BiblePeek are typically smaller
    loadMoreThreshold: 1.0,
    overrideItemLayout: false, // Don't need layout override for small lists
  });

  // Expose scroll methods to parent
  useImperativeHandle(ref, () => ({
    scrollToIndex: (index: number, animated = true) => {
      flashListRef.current?.scrollToIndex({ index, animated });
    },
    scrollToOffset: (offset: number, animated = true) => {
      flashListRef.current?.scrollToOffset({ offset, animated });
    },
  }));

  // Render item for FlashList
  const renderItem = useCallback(
    ({ item, index }: { item: ChapterContent; index: number }) => {
      return renderChapter(item, index);
    },
    [renderChapter]
  );

  // Key extractor
  const keyExtractor = useCallback(
    (item: ChapterContent) => String(item.chapter.id),
    []
  );

  // Background for the recessed area
  const contentBackground =
    theme.mode === "dark"
      ? "rgba(0, 0, 0, 0.35)"
      : theme.mode === "sepia"
      ? "rgba(60, 40, 30, 0.08)"
      : "rgba(0, 0, 0, 0.04)";

  // Gradient color - more opaque for visible fade effect
  const gradientColor =
    theme.mode === "dark"
      ? "rgba(0, 0, 0, 0.85)"
      : theme.mode === "sepia"
      ? "rgba(245, 235, 220, 0.95)"
      : "rgba(255, 255, 255, 0.95)";

  return (
    <View style={styles.container}>
      {/* Header - matches VerseReference style (no background) */}
      {showHeader && (
        <View style={styles.header}>
          <Text
            style={[styles.headerText, { color: theme.colors.text.secondary }]}
          >
            {header}
          </Text>
          {showCloseButton && onClose && (
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={18} color={theme.colors.text.muted} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Content area with inset shadow effect */}
      <View
        style={[
          styles.contentArea,
          { backgroundColor: contentBackground, height: maxHeight },
        ]}
      >
        {/* Scrollable content */}
        <FlashList
          ref={flashListRef}
          data={data}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          {...flashListConfig.props}
          showsVerticalScrollIndicator={true}
          nestedScrollEnabled={true}
          contentContainerStyle={styles.contentPadding}
          initialScrollIndex={initialScrollIndex}
        />

        {/* Top gradient fade overlay */}
        <LinearGradient
          colors={[gradientColor, toTransparent(gradientColor)]}
          style={styles.gradientTop}
          pointerEvents="none"
          dither
        />

        {/* Bottom gradient fade overlay */}
        <LinearGradient
          colors={[toTransparent(gradientColor), gradientColor]}
          style={styles.gradientBottom}
          pointerEvents="none"
          dither
        />
      </View>
    </View>
  );
});

BiblePeekWindowComponent.displayName = "BiblePeekWindow";

export const BiblePeekWindow = BiblePeekWindowComponent;

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
  },
  // Header matches VerseReference - no background, smaller font
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 2,
    paddingHorizontal: 12, // Align with note content (offsets the -12 margin)
  },
  headerText: {
    fontSize: 12,
    fontWeight: "600",
    flex: 1,
  },
  closeButton: {
    padding: 2,
  },
  contentArea: {
    position: "relative",
    overflow: "hidden",
  },
  // Top gradient fade overlay
  gradientTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 24,
    zIndex: 1,
  },
  // Bottom gradient fade overlay
  gradientBottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 24,
    zIndex: 1,
  },
  contentPadding: {
    paddingHorizontal: 12,
    paddingTop: 16, // Extra top padding for gradient fade
    paddingBottom: 16, // Extra bottom padding for gradient fade
  },
});
