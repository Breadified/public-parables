/**
 * LibraryFAB - Floating Action Button for Library screen
 * Simple "+" button to add new notes with verse selection
 */

import React, { useRef } from "react";
import { StyleSheet, Animated, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/contexts/ThemeContext";
import * as Haptics from "expo-haptics";

interface LibraryFABProps {
  onPress: () => void;
}

export const LibraryFAB: React.FC<LibraryFABProps> = ({ onPress }) => {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    // Animate press
    Animated.sequence([
      Animated.timing(scale, {
        toValue: 0.9,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        friction: 3,
        useNativeDriver: true,
      }),
    ]).start();

    // Haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Trigger callback
    onPress();
  };

  // Position above tab bar
  const fabBottomPosition = insets.bottom + 70;

  return (
    <Animated.View
      style={[
        styles.fab,
        {
          bottom: fabBottomPosition,
          backgroundColor: theme.colors.accent,
          transform: [{ scale }],
        },
      ]}
    >
      <Pressable onPress={handlePress} style={styles.pressable}>
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  pressable: {
    flex: 1,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
});
