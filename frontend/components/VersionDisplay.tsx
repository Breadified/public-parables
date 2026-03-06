/**
 * VersionDisplay Component
 * Displays app version in bottom-left corner with subtle styling
 */

import React from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import { observer } from "@legendapp/state/react";
import { getVersionDisplay } from "../config/version";
import { typography } from "../config/theme";
import { useTheme } from "../contexts/ThemeContext";

export const VersionDisplay = observer(() => {
  const { theme } = useTheme();

  return (
    <View style={styles.container} pointerEvents="none">
      <Text
        style={[
          styles.versionText,
          {
            fontFamily: typography.fontFamily.mono,
            // Use a neutral color that works across all themes
            color: theme.mode === "dark" ? "#9CA3AF" : "#6B7280",
          },
        ]}
      >
        {getVersionDisplay()}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: Platform.select({
      ios: 0, // Account for safe area
      android: 0,
      default: 0,
    }),
    left: 40,
    zIndex: 999999, // Extremely high z-index
    elevation: 999999, // Android elevation to ensure it's on top
    // Ensure it doesn't interfere with touch events
    pointerEvents: "none",
  },
  versionText: {
    fontSize: typography.fontSize.xs,
    opacity: 0.5, // Subtle, not distracting
    letterSpacing: 0.5,
  },
});
