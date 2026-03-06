/**
 * ReadingSeparator - Visual separator between readings in plan study mode
 *
 * Shows the reference text (e.g., "Psalm 23") centered with lines on either side.
 */

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTheme } from "../../../contexts/ThemeContext";

interface ReadingSeparatorProps {
  reference: string;
}

export const ReadingSeparator = React.memo(function ReadingSeparator({
  reference,
}: ReadingSeparatorProps) {
  const { theme } = useTheme();

  return (
    <View style={styles.container}>
      <View style={[styles.line, { backgroundColor: theme.colors.border }]} />
      <Text style={[styles.text, { color: theme.colors.text.secondary }]}>
        {reference}
      </Text>
      <View style={[styles.line, { backgroundColor: theme.colors.border }]} />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  line: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  text: {
    fontSize: 14,
    fontWeight: "600",
    paddingHorizontal: 12,
  },
});
