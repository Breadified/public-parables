/**
 * ReadingRecap - Shows intro or recap blurb text for the day
 * Supports markdown-style formatting: **bold**, *italic*, \n newlines
 *
 * Variants:
 * - "intro": Book introduction (shown BEFORE reading)
 * - "recap": Day recap (shown AFTER reading)
 */

import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@/contexts/ThemeContext";
import type { PlanContentType } from "@/types/database";

interface ReadingRecapProps {
  /** Text to display (supports markdown-style formatting) */
  text: string;
  /** Variant determines header icon and label */
  variant: "intro" | "recap";
  /** Optional day number for header context */
  dayNumber?: number;

  // Legacy props (deprecated - for backwards compatibility)
  recapText?: string;
  previousDay?: number;
}

/**
 * Parse markdown-style text into styled segments
 * Supports: **bold**, *italic*, \n newlines
 */
function parseMarkdownText(
  text: string,
): Array<{ text: string; bold?: boolean; italic?: boolean }> {
  const segments: Array<{ text: string; bold?: boolean; italic?: boolean }> =
    [];

  // Replace \n with actual newlines
  const normalizedText = text.replace(/\\n/g, "\n");

  // Regex to match **bold** and *italic* patterns
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;

  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(normalizedText)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      segments.push({ text: normalizedText.slice(lastIndex, match.index) });
    }

    // Process the match
    const matchText = match[0];
    if (matchText.startsWith("**") && matchText.endsWith("**")) {
      // Bold text
      segments.push({ text: matchText.slice(2, -2), bold: true });
    } else if (matchText.startsWith("*") && matchText.endsWith("*")) {
      // Italic text
      segments.push({ text: matchText.slice(1, -1), italic: true });
    }

    lastIndex = match.index + matchText.length;
  }

  // Add remaining text
  if (lastIndex < normalizedText.length) {
    segments.push({ text: normalizedText.slice(lastIndex) });
  }

  return segments;
}

const ReadingRecap = ({
  text,
  variant,
  dayNumber,
  // Legacy props
  recapText,
  previousDay,
}: ReadingRecapProps) => {
  const { theme } = useTheme();

  // Support legacy props
  const displayText = text || recapText;
  const displayVariant = variant || "recap";
  const displayDayNumber = dayNumber || previousDay;

  // Parse markdown segments
  const textSegments = useMemo(
    () => (displayText ? parseMarkdownText(displayText) : []),
    [displayText],
  );

  if (!displayText) {
    return null;
  }

  // Variant-specific configuration
  const variantConfig = {
    intro: {
      icon: "book-outline" as const,
      label: "Introduction",
      accentColor: theme.colors.accent,
    },
    recap: {
      icon: "refresh-outline" as const,
      label: "Recap",
      accentColor: theme.colors.accent,
    },
  };

  const config = variantConfig[displayVariant];

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.background.secondary,
          borderLeftColor: config.accentColor,
        },
      ]}
    >
      <View style={styles.header}>
        <Ionicons
          name={config.icon}
          size={16}
          color={theme.colors.text.secondary}
        />
        <Text
          style={[styles.headerText, { color: theme.colors.text.secondary }]}
        >
          {config.label}
        </Text>
      </View>
      <Text style={[styles.recapText, { color: theme.colors.text.primary }]}>
        {textSegments.map((segment, index) => (
          <Text
            key={index}
            style={[
              segment.bold && styles.boldText,
              segment.italic && styles.italicText,
            ]}
          >
            {segment.text}
          </Text>
        ))}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginVertical: 12,
    padding: 16,
    borderRadius: 8,
    borderLeftWidth: 3,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  headerText: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  recapText: {
    fontSize: 15,
    lineHeight: 22,
  },
  boldText: {
    fontWeight: "700",
  },
  italicText: {
    fontStyle: "italic",
  },
});

export default ReadingRecap;
