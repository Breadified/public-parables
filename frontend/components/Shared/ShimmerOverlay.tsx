/**
 * ShimmerOverlay - Animated sheen effect for buttons/views
 * Uses Reanimated for performant off-thread animation
 *
 * Creates a diagonal white sheen that sweeps across the component
 */

import React, { useEffect } from "react";
import { StyleSheet, ViewStyle } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withDelay,
  withSequence,
  Easing,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";

interface ShimmerOverlayProps {
  /** Width of the container to shimmer across */
  width: number;
  /** Height of the container */
  height: number;
  /** Duration of the sweep animation in ms */
  duration?: number;
  /** Delay between sweeps in ms */
  delay?: number;
  /** How far past the container the sheen travels (1 = edge, 2 = double width past) */
  overshoot?: number;
  /** Whether the shimmer is active */
  active?: boolean;
  /** Additional styles */
  style?: ViewStyle;
}

const ShimmerOverlay = ({
  width,
  height,
  duration = 500,
  delay = 2000,
  overshoot = 1,
  active = true,
  style,
}: ShimmerOverlayProps) => {
  const startPos = -width * overshoot;
  const endPos = width * overshoot;
  const translateX = useSharedValue(startPos);

  useEffect(() => {
    if (active) {
      // Start off-screen left, sweep way past right edge, then pause
      translateX.value = startPos;
      translateX.value = withRepeat(
        withSequence(
          withTiming(endPos, {
            duration,
            easing: Easing.inOut(Easing.ease),
          }),
          withDelay(
            delay,
            withTiming(startPos, { duration: 0 })
          )
        ),
        -1, // infinite repeat
        false
      );
    } else {
      translateX.value = startPos;
    }
  }, [active, width, duration, delay, overshoot, translateX, startPos, endPos]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { rotate: "20deg" },
    ],
  }));

  if (!active) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        { width: width * 2, height: height * 2 },
        animatedStyle,
        style,
      ]}
      pointerEvents="none"
    >
      <LinearGradient
        colors={[
          "transparent",
          "rgba(255,255,255,0.1)",
          "rgba(255,255,255,0.4)",
          "rgba(255,255,255,0.1)",
          "transparent",
        ]}
        locations={[0, 0.35, 0.5, 0.65, 1]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.gradient}
      />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: "-50%",
    left: "-50%",
  },
  gradient: {
    flex: 1,
    width: "100%",
  },
});

export default ShimmerOverlay;
