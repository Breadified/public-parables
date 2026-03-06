/**
 * StreakProgressBar - Visual progress bar for streak milestones
 * Shows progress toward 7 or 30 day goal with animated fill
 * Supports all activity types: login, reading, notes
 */

import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";

import { useTheme } from "@/contexts/ThemeContext";
import type { StreakActivityType } from "@/state/gamificationStore";

interface StreakProgressBarProps {
  /** Current streak count */
  current: number;
  /** Target milestone (7 or 30) */
  target: number;
  /** Whether streak data is still loading */
  isLoading?: boolean;
  /** Activity type (for styling variations if needed) */
  activityType?: StreakActivityType;
  /** Whether to show compact version (smaller) */
  compact?: boolean;
}

const StreakProgressBar: React.FC<StreakProgressBarProps> = ({
  current,
  target,
  isLoading = false,
  activityType,
  compact = false,
}) => {
  const { theme } = useTheme();
  const gamification = theme.colors.gamification;

  // Animated progress value
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Calculate progress percentage
  const progress = Math.min(current / target, 1);

  useEffect(() => {
    if (!isLoading) {
      // Animate to current progress with spring effect
      Animated.spring(progressAnim, {
        toValue: progress,
        tension: 50,
        friction: 8,
        useNativeDriver: false,
      }).start();
    }
  }, [progress, isLoading, progressAnim]);

  // Interpolate width
  const animatedWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.track,
          { backgroundColor: theme.colors.border },
        ]}
      >
        <Animated.View
          style={[
            styles.fill,
            {
              width: animatedWidth,
              backgroundColor: gamification.nodeComplete,
            },
          ]}
        />
      </View>
      <Text style={[styles.label, { color: theme.colors.text.muted }]}>
        {isLoading ? "..." : `${current}/${target}`}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 4,
    paddingHorizontal: 4,
    marginTop: -4,
    marginBottom: 8,
  },
  track: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 3,
  },
  label: {
    fontSize: 12,
    fontWeight: "500",
    minWidth: 40,
    textAlign: "right",
  },
});

export default StreakProgressBar;
