/**
 * DailyProgressBar - Thin progress bar at the top of the screen
 *
 * A ~3px horizontal bar pinned to the very top of the screen that fills
 * as daily activities are completed. Built with React Native Skia + Reanimated
 * for a mystical glow effect.
 *
 * - Blue while in progress, transitions to green when all 4 activities complete
 * - Subtle aura glow effect around the bar edges
 * - Fill animates left-to-right with fluid timing
 * - Brief flash/pulse at the fill edge on progress
 */

import React, { useEffect } from "react";
import { StyleSheet, useWindowDimensions } from "react-native";
import {
  Canvas,
  Rect,
  LinearGradient,
  BlurMask,
  vec,
} from "@shopify/react-native-skia";
import {
  useSharedValue,
  useDerivedValue,
  withTiming,
  withSequence,
  withRepeat,
  Easing,
} from "react-native-reanimated";
import { useSelector } from "@legendapp/state/react";

import { completedActivitiesCount$, TOTAL_DAILY_ACTIVITIES } from "@/state/gamificationStore";
import { useTheme } from "@/contexts/ThemeContext";

const BAR_HEIGHT = 3;
const GLOW_HEIGHT = 12; // Total height including glow above/below
const CANVAS_HEIGHT = GLOW_HEIGHT + BAR_HEIGHT + GLOW_HEIGHT;

const DailyProgressBar: React.FC = () => {
  const { width: screenWidth } = useWindowDimensions();
  const { theme } = useTheme();
  const completedCount = useSelector(completedActivitiesCount$);

  const colors = theme.colors.gamification.progressBar;

  // Shared values for animations
  const fillProgress = useSharedValue(0);
  const flashOpacity = useSharedValue(0);
  const glowBreath = useSharedValue(0);

  // Target progress (0 to 1)
  const targetProgress = completedCount / TOTAL_DAILY_ACTIVITIES;

  // Animate fill progress when count changes
  useEffect(() => {
    const prevProgress = fillProgress.value;
    fillProgress.value = withTiming(targetProgress, {
      duration: 800,
      easing: Easing.inOut(Easing.cubic),
    });

    // Flash pulse on progress increment (only if increasing)
    if (targetProgress > prevProgress && targetProgress > 0) {
      flashOpacity.value = withSequence(
        withTiming(0.8, { duration: 200 }),
        withTiming(0, { duration: 400 }),
      );
    }
  }, [targetProgress]);

  // Ambient breathing glow (very subtle, continuous)
  useEffect(() => {
    glowBreath.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
      ),
      -1, // Infinite repeat
    );
  }, []);

  // Derived: bar fill width
  const fillWidth = useDerivedValue(() => {
    return fillProgress.value * screenWidth;
  });

  // Derived: glow opacity with breathing modulation
  const glowOpacity = useDerivedValue(() => {
    if (fillProgress.value <= 0) return 0;
    // Base glow: 0.15 to 0.3, modulated by breathing
    const baseGlow = 0.15 + glowBreath.value * 0.15;
    return baseGlow;
  });

  // Derived: flash glow at the leading edge
  const flashGlowOpacity = useDerivedValue(() => {
    return flashOpacity.value;
  });

  // Don't render if no activities completed
  if (completedCount <= 0) {
    return null;
  }

  const isComplete = completedCount >= TOTAL_DAILY_ACTIVITIES;
  const barColor = isComplete ? colors.green : colors.blue;
  const glowColor = isComplete ? colors.glowGreen : colors.glowBlue;

  return (
    <Canvas
      style={[
        styles.canvas,
        { width: screenWidth, height: CANVAS_HEIGHT },
      ]}
      pointerEvents="none"
    >
      {/* Track background (very subtle) */}
      <Rect
        x={0}
        y={GLOW_HEIGHT}
        width={screenWidth}
        height={BAR_HEIGHT}
        color={colors.track}
      />

      {/* Glow aura above the bar */}
      <Rect
        x={0}
        y={0}
        width={screenWidth}
        height={GLOW_HEIGHT + BAR_HEIGHT}
        opacity={glowOpacity}
      >
        <LinearGradient
          start={vec(0, 0)}
          end={vec(0, GLOW_HEIGHT + BAR_HEIGHT)}
          colors={["transparent", glowColor + "40", glowColor + "80"]}
        />
      </Rect>

      {/* Main fill bar */}
      <Rect
        x={0}
        y={GLOW_HEIGHT}
        width={fillWidth}
        height={BAR_HEIGHT}
        color={barColor}
      />

      {/* Glow aura below the bar */}
      <Rect
        x={0}
        y={GLOW_HEIGHT + BAR_HEIGHT}
        width={screenWidth}
        height={GLOW_HEIGHT}
        opacity={glowOpacity}
      >
        <LinearGradient
          start={vec(0, 0)}
          end={vec(0, GLOW_HEIGHT)}
          colors={[glowColor + "60", glowColor + "20", "transparent"]}
        />
      </Rect>

      {/* Flash pulse at leading edge (when progress increases) */}
      <Rect
        x={0}
        y={GLOW_HEIGHT - 4}
        width={fillWidth}
        height={BAR_HEIGHT + 8}
        opacity={flashGlowOpacity}
        color="white"
      >
        <BlurMask blur={6} style="normal" />
      </Rect>
    </Canvas>
  );
};

const styles = StyleSheet.create({
  canvas: {
    position: "absolute",
    top: 0,
    left: 0,
    zIndex: 9999,
  },
});

export default DailyProgressBar;
