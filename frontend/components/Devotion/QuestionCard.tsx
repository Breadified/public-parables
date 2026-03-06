/**
 * QuestionCard - Displays the daily apologetics question
 * Features: Category badge, question text, inline verse references
 *
 * Variants:
 * - "full": Full view (apologetics mode)
 * - "compact": Scrollable, elevated background (comments mode)
 */

import React, { useRef, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
  LayoutChangeEvent,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@/contexts/ThemeContext";
import { toTransparent } from "@/utils/themeHelpers";
import type { ApologeticsQuestion } from "@/state";
import { fontSize, lineHeight } from "@/constants/Typography";
import VerseDisplay from "./VerseDisplay";

interface QuestionCardProps {
  question: ApologeticsQuestion;
  variant?: "full" | "compact";
  /** Padding at top for header overlay */
  contentPaddingTop?: number;
  /** Padding at bottom for bottom element overlays */
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
  /** Optional footer component rendered at bottom of scroll content */
  footer?: React.ReactNode;
  /** Callback with section positions (Y offsets relative to scroll content) */
  onSectionPositions?: (positions: number[]) => void;
  /** Callback with total content height */
  onContentLayout?: (height: number) => void;
}

const QuestionCard = ({
  question,
  variant = "full",
  contentPaddingTop = 0,
  contentPaddingBottom = 0,
  scrollProps,
  footer,
  onSectionPositions,
  onContentLayout,
}: QuestionCardProps) => {
  const { theme } = useTheme();
  const isCompact = variant === "compact";

  // Track section positions for progress map
  const sectionPositionsRef = useRef<Record<string, number>>({});
  const contentHeightRef = useRef<number>(0);
  const expectedSectionsRef = useRef<string[]>([]);

  // Calculate which sections exist based on verse references
  useEffect(() => {
    if (!question?.verseReferences) {
      expectedSectionsRef.current = [];
      return;
    }

    const contextVerses = question.verseReferences.filter((v) => v.type === "context");
    const responseVerses = question.verseReferences.filter((v) => v.type === "response");
    const untypedVerses = question.verseReferences.filter((v) => !v.type);

    const sections: string[] = [];
    if (contextVerses.length > 0 || responseVerses.length > 0) {
      if (contextVerses.length > 0) sections.push("context");
      if (responseVerses.length > 0) sections.push("response");
    } else {
      untypedVerses.forEach((_, i) => sections.push(`verse-${i}`));
    }
    expectedSectionsRef.current = sections;
    sectionPositionsRef.current = {};
  }, [question?.verseReferences]);

  // Handle section layout measurement
  const handleSectionLayout = useCallback((sectionId: string) => (event: LayoutChangeEvent) => {
    const { y } = event.nativeEvent.layout;
    sectionPositionsRef.current[sectionId] = y;

    // Check if all expected sections have been measured
    const expected = expectedSectionsRef.current;
    const measured = Object.keys(sectionPositionsRef.current);
    if (expected.length > 0 && measured.length === expected.length && contentHeightRef.current > 0) {
      // All sections measured, report positions in order
      const positions = expected.map((id) => sectionPositionsRef.current[id] || 0);
      onSectionPositions?.(positions);
    }
  }, [onSectionPositions]);

  // Handle content layout for total height
  const handleContentLayout = useCallback((event: LayoutChangeEvent) => {
    const { height } = event.nativeEvent.layout;
    contentHeightRef.current = height;
    onContentLayout?.(height);

    // Check if sections are ready
    const expected = expectedSectionsRef.current;
    const measured = Object.keys(sectionPositionsRef.current);
    if (expected.length > 0 && measured.length === expected.length && height > 0) {
      const positions = expected.map((id) => sectionPositionsRef.current[id] || 0);
      onSectionPositions?.(positions);
    }
  }, [onContentLayout, onSectionPositions]);

  const containerStyle = [
    styles.container,
    {
      backgroundColor: theme.colors.background.primary,
    },
    isCompact && {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
  ];

  const contentStyle = [
    styles.contentContainer,
    isCompact && styles.contentContainerCompact,
    !isCompact && {
      paddingTop: contentPaddingTop || 16,
      paddingBottom: contentPaddingBottom || 24,
    },
  ];

  return (
    <View style={containerStyle}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={contentStyle}
        showsVerticalScrollIndicator={true}
        nestedScrollEnabled={isCompact}
        scrollEventThrottle={scrollProps?.scrollEventThrottle ?? 16}
        // Touch handlers for UI auto-hide (tap-to-toggle, scroll-to-hide)
        onTouchStart={scrollProps?.onTouchStart}
        onTouchEnd={scrollProps?.onTouchEnd}
        onTouchCancel={scrollProps?.onTouchCancel}
        onScroll={scrollProps?.onScroll}
        onScrollBeginDrag={scrollProps?.onScrollBeginDrag}
        onScrollEndDrag={scrollProps?.onScrollEndDrag}
        onContentSizeChange={(_, h) => {
          contentHeightRef.current = h;
          onContentLayout?.(h);
        }}
      >
        {/* Category Badge */}
        <Text style={[styles.category, { color: theme.colors.accent }]}>
          {question.categoryName}
        </Text>

        {/* Question Text */}
        <Text style={[styles.questionText, { color: theme.colors.text.primary }]}>
          {question.questionText}
        </Text>

        {/* Verse References - Grouped by Type */}
        {question.verseReferences.length > 0 && (
          <View style={styles.versesContainer}>
            <View style={styles.versesHeader}>
              <Ionicons
                name="book-outline"
                size={16}
                color={theme.colors.text.muted}
              />
              <Text style={[styles.versesLabel, { color: theme.colors.text.muted }]}>
                Suggested Passages
              </Text>
            </View>
            <Text style={[styles.disclaimer, { color: theme.colors.text.muted }]}>
              Passages and commentary are AI-generated and may contain inaccuracies. Always verify with Scripture.
            </Text>

            {/* Group verses by type if type field exists */}
            {(() => {
              const contextVerses = question.verseReferences.filter((v) => v.type === "context");
              const responseVerses = question.verseReferences.filter((v) => v.type === "response");
              const untypedVerses = question.verseReferences.filter((v) => !v.type);

              // If no typed verses, show all verses without sections (backwards compatible)
              if (contextVerses.length === 0 && responseVerses.length === 0) {
                return untypedVerses.map((verse, index) => (
                  <View
                    key={`verse-${index}`}
                    onLayout={handleSectionLayout(`verse-${index}`)}
                  >
                    <VerseDisplay
                      verseRef={verse}
                      showReference={true}
                    />
                  </View>
                ));
              }

              return (
                <>
                  {/* Context Section */}
                  {contextVerses.length > 0 && (
                    <View
                      style={styles.verseSection}
                      onLayout={handleSectionLayout("context")}
                    >
                      <Text style={[styles.sectionLabel, { color: theme.colors.text.secondary }]}>
                        Context
                      </Text>
                      {contextVerses.map((verse, index) => (
                        <VerseDisplay
                          key={`context-${verse.reference}-${index}`}
                          verseRef={verse}
                          showReference={true}
                        />
                      ))}
                    </View>
                  )}

                  {/* Response Section */}
                  {responseVerses.length > 0 && (
                    <View
                      style={styles.verseSection}
                      onLayout={handleSectionLayout("response")}
                    >
                      <Text style={[styles.sectionLabel, { color: theme.colors.text.secondary }]}>
                        Scripture Responds
                      </Text>
                      {responseVerses.map((verse, index) => (
                        <VerseDisplay
                          key={`response-${verse.reference}-${index}`}
                          verseRef={verse}
                          showReference={true}
                        />
                      ))}
                    </View>
                  )}

                  {/* Any untyped verses (fallback) */}
                  {untypedVerses.length > 0 && untypedVerses.map((verse, index) => (
                    <VerseDisplay
                      key={`untyped-${verse.reference}-${index}`}
                      verseRef={verse}
                      showReference={true}
                    />
                  ))}
                </>
              );
            })()}
          </View>
        )}

        {/* Optional footer component (e.g., completion button) */}
        {footer}
      </ScrollView>

      {/* Bottom gradient fade - only in compact mode */}
      {isCompact && (
        <LinearGradient
          colors={[
            toTransparent(theme.colors.background.primary),
            theme.colors.background.primary,
          ]}
          style={styles.bottomGradient}
          pointerEvents="none"
          dither
        />
      )}
    </View>
  );
};

export default QuestionCard;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: "relative",
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingBottom: 24,
  },
  contentContainerCompact: {
    paddingVertical: 12,
    paddingBottom: 12,
  },
  category: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  questionText: {
    fontSize: fontSize.xl,
    fontWeight: "600",
    lineHeight: fontSize.xl * lineHeight.normal,
    marginBottom: 20,
  },
  versesContainer: {
    gap: 4,
  },
  versesHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
  },
  versesLabel: {
    fontSize: fontSize.sm,
    fontWeight: "500",
  },
  disclaimer: {
    fontSize: fontSize.xs,
    fontStyle: "italic",
    marginBottom: 12,
  },
  verseSection: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  bottomGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 24,
  },
});
