/**
 * RotatingHalo - Spinning ring with gradient effect
 * Used for completion indicators and achievement celebrations
 */

import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View, ViewStyle } from "react-native";
import Svg, { Defs, LinearGradient, Stop, Circle } from "react-native-svg";

interface RotatingHaloProps {
  /** Size of the halo (diameter) */
  size: number;
  /** Stroke width of the ring */
  strokeWidth?: number;
  /** Start color of the gradient */
  startColor: string;
  /** End color of the gradient */
  endColor: string;
  /** Whether to animate rotation */
  animate?: boolean;
  /** Duration of one full rotation in ms */
  duration?: number;
  /** Additional styles for the container */
  style?: ViewStyle;
}

const AnimatedSvg = Animated.createAnimatedComponent(Svg);

const RotatingHalo = ({
  size,
  strokeWidth = 3,
  startColor,
  endColor,
  animate = true,
  duration = 3000,
  style,
}: RotatingHaloProps) => {
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animate) {
      rotateAnim.setValue(0);
      return;
    }

    const animation = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration,
        useNativeDriver: true,
      })
    );

    animation.start();

    return () => {
      animation.stop();
    };
  }, [animate, duration, rotateAnim]);

  const rotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const radius = (size - strokeWidth) / 2;
  const center = size / 2;

  return (
    <View style={[styles.container, { width: size, height: size }, style]}>
      <AnimatedSvg
        width={size}
        height={size}
        style={{ transform: [{ rotate: rotation }] }}
      >
        <Defs>
          <LinearGradient id="haloGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={startColor} stopOpacity="1" />
            <Stop offset="50%" stopColor={endColor} stopOpacity="0.8" />
            <Stop offset="100%" stopColor={startColor} stopOpacity="0.4" />
          </LinearGradient>
        </Defs>
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke="url(#haloGradient)"
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${radius * 2} ${radius * 4}`}
        />
      </AnimatedSvg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
  },
});

export default RotatingHalo;
