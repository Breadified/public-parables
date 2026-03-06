/**
 * ThemeToggle - Theme switcher component
 * Compact button for cycling through themes
 */

import React from "react";
import { TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/contexts/ThemeContext";
import { ThemeMode } from "@/config/theme";

export const ThemeToggle: React.FC = () => {
  const { theme, themeMode, setThemeMode } = useTheme();

  const themes: ThemeMode[] = ["light", "dark", "sepia"];

  const handleToggle = () => {
    const currentIndex = themes.indexOf(themeMode);
    const nextIndex = (currentIndex + 1) % themes.length;
    setThemeMode(themes[nextIndex]);
  };

  const getCurrentThemeIcon = (): keyof typeof Ionicons.glyphMap => {
    switch (themeMode) {
      case "light":
        return "sunny";
      case "dark":
        return "moon";
      case "sepia":
        return "book";
      default:
        return "color-palette";
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.primary,
        },
      ]}
      onPress={handleToggle}
      activeOpacity={0.7}
    >
      <Ionicons name={getCurrentThemeIcon()} size={16} color="#FFFFFF" />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
});
