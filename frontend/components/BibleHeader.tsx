/**
 * Bible Header Component
 * Displays the header with tabs and current chapter reference
 */

import React from "react";
import { StyleSheet, View, Text } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BibleTabsList } from "./BibleTabsList";
import { ThemeToggle } from "./ThemeToggle";
import { useScrollContext } from "@/contexts/ScrollContext";
import { useTheme } from "@/contexts/ThemeContext";
import {
  getHeaderColor,
  getTextColor,
} from "@/utils/themeHelpers";

interface BibleHeaderProps {
  theme?: import('@/config/theme').ThemeMode;
  currentTitle: string;
  onAddPress?: () => void;
}

export const BibleHeader: React.FC<BibleHeaderProps> = ({
  theme: themeProp,
  currentTitle,
  onAddPress,
}) => {
  const scrollContext = useScrollContext();
  const { themeMode } = useTheme();
  const theme = themeProp || themeMode;
  const insets = useSafeAreaInsets();

  // Create fallback SharedValues unconditionally (React Hooks rule)
  const fallbackOpacity = useSharedValue(1);
  const fallbackTranslateY = useSharedValue(0);

  // Extract SharedValues early to avoid serialization warnings
  const headerOpacity = scrollContext?.headerOpacity ?? fallbackOpacity;
  const headerTranslateY = scrollContext?.headerTranslateY ?? fallbackTranslateY;

  // Create animated style using extracted SharedValues
  const headerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: headerOpacity.value,
    transform: [{ translateY: headerTranslateY.value }],
  }));

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.headerOverlay,
        {
          paddingTop: insets.top,
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
        },
        headerAnimatedStyle,
      ]}
    >
      <View style={styles.headerContent}>
        <ThemeToggle />
        <BibleTabsList onAddPress={onAddPress} />
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  headerOverlay: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
});