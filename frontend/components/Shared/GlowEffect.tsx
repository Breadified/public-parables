/**
 * GlowEffect - Reusable pulsating glow animation component
 * Uses shadow-based glow effect with Animated API
 */

import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, ViewStyle } from "react-native";

interface GlowEffectProps {
  /** Color of the glow */
  color: string;
  /** Size of the glow element */
  size: number;
  /** Whether to animate the glow */
  animate?: boolean;
  /** Duration of one pulse cycle in ms */
  duration?: number;
  /** Minimum opacity during pulse */
  minOpacity?: number;
  /** Maximum opacity during pulse */
  maxOpacity?: number;
  /** Additional styles */
  style?: ViewStyle;
}

const GlowEffect = ({
  color,
  size,
  animate = true,
  duration = 2000,
  minOpacity = 0.3,
  maxOpacity = 0.8,
  style,
}: GlowEffectProps) => {
  const pulseAnim = useRef(new Animated.Value(minOpacity)).current;

  useEffect(() => {
    if (!animate) {
      pulseAnim.setValue(maxOpacity);
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: maxOpacity,
          duration: duration / 2,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: minOpacity,
          duration: duration / 2,
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();

    return () => {
      animation.stop();
    };
  }, [animate, duration, minOpacity, maxOpacity, pulseAnim]);

  return (
    <Animated.View
      style={[
        styles.glow,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          opacity: pulseAnim,
          shadowColor: color,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 1,
          shadowRadius: size / 3,
        },
        style,
      ]}
    />
  );
};

const styles = StyleSheet.create({
  glow: {
    position: "absolute",
  },
});

export default GlowEffect;
