/**
 * LockedDayIndicator - Greyed out tick with lock icon for future days
 * Displays next to "Day X of Y" text for days that haven't unlocked yet
 */

import React from "react";
import { View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@/contexts/ThemeContext";
import CheckmarkIcon from "@/components/Shared/CheckmarkIcon";

interface LockedDayIndicatorProps {
  /** Size of the indicator */
  size?: number;
}

const LockedDayIndicator = ({ size = 20 }: LockedDayIndicatorProps) => {
  const { theme } = useTheme();

  const lockSize = size * 0.55;

  return (
    <View style={styles.container}>
      {/* Greyed out checkmark */}
      <View
        style={[
          styles.iconContainer,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: theme.colors.background.secondary,
          },
        ]}
      >
        <CheckmarkIcon
          size={size * 0.65}
          strokeWidth={2.5}
          color={theme.colors.text.muted}
        />
      </View>

      {/* Lock icon overlay */}
      <View
        style={[
          styles.lockContainer,
          {
            width: lockSize + 4,
            height: lockSize + 4,
            borderRadius: (lockSize + 4) / 2,
            backgroundColor: theme.colors.background.primary,
          },
        ]}
      >
        <Ionicons
          name="lock-closed"
          size={lockSize}
          color={theme.colors.text.muted}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  iconContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  lockContainer: {
    position: "absolute",
    bottom: -2,
    right: -4,
    alignItems: "center",
    justifyContent: "center",
  },
});

export default LockedDayIndicator;
