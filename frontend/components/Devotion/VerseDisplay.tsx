/**
 * VerseDisplay - Simple inline verse display with HighlightedText
 * Replaces VersePeekEmbed for devotion questions
 * Loads verse text from SQLite and displays with highlighted styling
 *
 * Now includes built-in "Read chapter" functionality with ReadChapterModal
 */

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { View, Text, StyleSheet, ActivityIndicator, Pressable } from "react-native";

import { useTheme } from "@/contexts/ThemeContext";
import { bibleSQLite, type VerseLine } from "@/services/sqlite";
import { HighlightedText } from "@/components/Bible/HighlightedText";
import { BibleContentRenderer } from "@/components/Bible/BibleContentRenderer";
import { createBibleStyles } from "@/components/Bible/BibleStyles";
import ReadChapterModal from "@/components/Bible/ReadChapterModal";
import type { VerseReference } from "@/state";

interface VerseDisplayProps {
  verseRef: VerseReference;
  showReference?: boolean; // Show "Romans 1:20" label above (default: true)
  fontSize?: number;
  showReadChapter?: boolean; // Show "Read Chapter" button below (default: true)
}

const VerseDisplay = ({
  verseRef,
  showReference = true,
  fontSize = 14,
  showReadChapter = true,
}: VerseDisplayProps) => {
  const { theme } = useTheme();
  const [verseLines, setVerseLines] = useState<VerseLine[]>([]);
  const [isPoetry, setIsPoetry] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state for Read Chapter
  const [showModal, setShowModal] = useState(false);

  const handleReadChapter = useCallback(() => {
    setShowModal(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setShowModal(false);
  }, []);

  // Create Bible styles
  const bibleStyles = useMemo(
    () =>
      createBibleStyles({
        theme,
        fontSize,
        contentPadding: 8,
        responsiveFontSizes: {
          small: fontSize * 0.875,
          base: fontSize,
          large: fontSize * 1.125,
          title: fontSize * 1.25,
        },
        isSmallScreen: true,
        splitScreen: true, // Compact mode
      }),
    [theme, fontSize]
  );

  useEffect(() => {
    loadVerses();
  }, [verseRef.bookNumber, verseRef.chapter, verseRef.verseStart, verseRef.verseEnd]);

  const loadVerses = async () => {
    try {
      setLoading(true);
      setError(null);

      // Ensure SQLite is initialized
      await bibleSQLite.initialize();

      // Build chapter ID: bookNumber * 1000000 + chapter * 1000
      const chapterId = verseRef.bookNumber * 1000000 + verseRef.chapter * 1000;

      // Fetch verse lines for the range
      const lines = await bibleSQLite.getVerseLineRange(
        chapterId,
        verseRef.verseStart,
        verseRef.verseEnd || verseRef.verseStart
      );

      if (lines.length === 0) {
        setError("Verse not found");
        return;
      }

      // Determine if poetry by checking indent_level
      const hasIndent = lines.some((line) => (line.indent_level || 0) > 0);
      setIsPoetry(hasIndent);

      setVerseLines(lines);
    } catch (err) {
      console.error("[VerseDisplay] Error loading verses:", err);
      setError(err instanceof Error ? err.message : "Failed to load verse");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        {showReference && (
          <Text style={[styles.referenceLabel, { color: theme.colors.text.muted }]}>
            {verseRef.reference}
          </Text>
        )}
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={theme.colors.text.muted} />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        {showReference && (
          <Text style={[styles.referenceLabel, { color: theme.colors.text.muted }]}>
            {verseRef.reference}
          </Text>
        )}
        <Text style={[styles.errorText, { color: theme.colors.text.muted }]}>
          {error}
        </Text>
      </View>
    );
  }

  return (
    <>
      <View style={styles.container}>
        {showReference && (
          <Text style={[styles.referenceLabel, { color: theme.colors.text.muted }]}>
            {verseRef.reference}
          </Text>
        )}
        <HighlightedText>
          <BibleContentRenderer
            verseLines={verseLines}
            isPoetry={isPoetry}
            showVerseNumbers={true}
            styles={bibleStyles}
            compact={true}
            onTextAction={() => {}} // Enable native selection path
          />
        </HighlightedText>
        {showReadChapter && (
          <Pressable
            onPress={handleReadChapter}
            style={styles.readChapterButton}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={[styles.readChapterText, { color: theme.colors.accent }]}>
              Read chapter
            </Text>
          </Pressable>
        )}
      </View>
      <ReadChapterModal
        visible={showModal}
        onClose={handleCloseModal}
        verseRef={verseRef}
      />
    </>
  );
};

export default VerseDisplay;

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
  referenceLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  loadingContainer: {
    paddingVertical: 16,
    alignItems: "center",
  },
  errorText: {
    fontSize: 13,
    fontStyle: "italic",
  },
  readChapterButton: {
    paddingTop: 8,
    paddingBottom: 4,
  },
  readChapterText: {
    fontSize: 13,
    fontWeight: "500",
  },
});
