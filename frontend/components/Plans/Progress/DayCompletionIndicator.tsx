/**
 * DayCompletionIndicator - Tick with rotating halo for completed days
 * Displays next to "Day X of Y" text
 */

import React from "react";
import { View, StyleSheet } from "react-native";
import { useTheme } from "@/contexts/ThemeContext";
import CheckmarkIcon from "@/components/Shared/CheckmarkIcon";
import RotatingHalo from "@/components/Shared/RotatingHalo";

interface DayCompletionIndicatorProps {
  /** Size of the indicator */
  size?: number;
  /** Whether to show the rotating halo animation */
  showHalo?: boolean;
}

const DayCompletionIndicator = ({
  size = 20,
  showHalo = true,
}: DayCompletionIndicatorProps) => {
  const { theme } = useTheme();
  const gamification = theme.colors.gamification;

  const haloSize = size + 8;

  return (
    <View
      style={[
        styles.container,
        {
          width: haloSize,
          height: haloSize,
        },
      ]}
    >
      {/* Rotating halo */}
      {showHalo && (
        <RotatingHalo
          size={haloSize}
          strokeWidth={2}
          startColor={gamification.haloGradientStart}
          endColor={gamification.haloGradientEnd}
          animate
          duration={3000}
          style={styles.halo}
        />
      )}

      {/* Checkmark icon */}
      <View
        style={[
          styles.iconContainer,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: gamification.nodeComplete,
          },
        ]}
      >
        <CheckmarkIcon
          size={size * 0.65}
          strokeWidth={3}
          color={theme.colors.text.inverse}
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
  halo: {
    position: "absolute",
    top: 0,
    left: 0,
  },
  iconContainer: {
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
});

export default DayCompletionIndicator;
