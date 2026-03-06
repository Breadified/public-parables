/**
 * ScrollProgressBar - Glow bar that advances with scroll position
 * Progress only advances (doesn't retract on scroll up)
 */

import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Animated } from "react-native";

import { useTheme } from "@/contexts/ThemeContext";

interface ScrollProgressBarProps {
  /** Maximum scroll progress reached (0-1) - doesn't retract */
  maxProgress: number;
  /** Current scroll position (0-1) */
  currentProgress?: number;
  /** Height of the progress bar */
  height?: number;
  /** Whether progress is at 100% */
  isComplete?: boolean;
}

const ScrollProgressBar = ({
  maxProgress,
  currentProgress = 0,
  height = 4,
  isComplete = false,
}: ScrollProgressBarProps) => {
  const { theme } = useTheme();
  const gamification = theme.colors.gamification;

  const progressAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0.3)).current;

  // Animate progress width
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: maxProgress,
      duration: 200,
      useNativeDriver: false, // Width animation requires layout
    }).start();
  }, [maxProgress, progressAnim]);

  // Animate glow intensity based on progress
  useEffect(() => {
    // Glow intensity increases with progress
    const targetGlow = 0.3 + maxProgress * 0.5;
    Animated.timing(glowAnim, {
      toValue: targetGlow,
      duration: 200,
      useNativeDriver: false, // shadowOpacity requires layout
    }).start();
  }, [maxProgress, glowAnim]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  const progressColor = isComplete
    ? gamification.progressComplete
    : gamification.progressGlow;

  return (
    <View style={styles.container}>
      {/* Background track */}
      <View
        style={[
          styles.track,
          {
            height,
            backgroundColor: theme.colors.background.secondary,
          },
        ]}
      >
        {/* Progress fill with glow */}
        <Animated.View
          style={[
            styles.progress,
            {
              width: progressWidth,
              height,
              backgroundColor: progressColor,
              shadowColor: progressColor,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: glowAnim,
              shadowRadius: 4,
            },
          ]}
        />

        {/* Current position marker */}
        {currentProgress > 0 && currentProgress < 1 && !isComplete && (
          <Animated.View
            style={[
              styles.marker,
              {
                left: `${currentProgress * 100}%`,
                backgroundColor: progressColor,
                shadowColor: progressColor,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.8,
                shadowRadius: 6,
              },
            ]}
          />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  track: {
    borderRadius: 2,
    overflow: "visible",
  },
  progress: {
    borderRadius: 2,
    elevation: 2,
  },
  marker: {
    position: "absolute",
    top: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: -4,
    elevation: 4,
  },
});

export default ScrollProgressBar;
