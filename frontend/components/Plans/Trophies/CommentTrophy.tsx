/**
 * CommentTrophy - Speech bubble with rotating ring celebration
 * Triggers when user posts a comment
 */

import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@/contexts/ThemeContext";
import RotatingHalo from "@/components/Shared/RotatingHalo";

interface CommentTrophyProps {
  /** Whether the animation should play */
  visible: boolean;
  /** Callback when animation completes */
  onComplete?: () => void;
  /** Size of the trophy icon */
  size?: number;
}

const CommentTrophy = ({
  visible,
  onComplete,
  size = 48,
}: CommentTrophyProps) => {
  const { theme } = useTheme();
  const gamification = theme.colors.gamification;

  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const bounceAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      scaleAnim.setValue(0);
      opacityAnim.setValue(0);
      bounceAnim.setValue(0);
      return;
    }

    // Animation sequence:
    // 1. Pop in with scale
    // 2. Bounce effect
    // 3. Hold for a moment
    // 4. Fade out
    Animated.sequence([
      // Pop in
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          damping: 10,
          stiffness: 200,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]),
      // Bounce
      Animated.sequence([
        Animated.timing(bounceAnim, {
          toValue: -10,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.spring(bounceAnim, {
          toValue: 0,
          damping: 8,
          stiffness: 200,
          useNativeDriver: true,
        }),
      ]),
      // Hold
      Animated.delay(1000),
      // Fade out
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 0.8,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      onComplete?.();
    });
  }, [visible, scaleAnim, opacityAnim, bounceAnim, onComplete]);

  if (!visible) {
    return null;
  }

  const haloSize = size + 16;

  return (
    <View style={styles.container} pointerEvents="none">
      <Animated.View
        style={[
          styles.trophyContainer,
          {
            opacity: opacityAnim,
            transform: [
              { scale: scaleAnim },
              { translateY: bounceAnim },
            ],
          },
        ]}
      >
        {/* Rotating halo */}
        <RotatingHalo
          size={haloSize}
          strokeWidth={3}
          startColor={gamification.trophyRing}
          endColor={gamification.trophy}
          animate
          duration={2000}
          style={styles.halo}
        />

        {/* Trophy background */}
        <View
          style={[
            styles.iconBackground,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: gamification.trophy,
              shadowColor: gamification.trophy,
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.5,
              shadowRadius: 8,
            },
          ]}
        >
          <Ionicons
            name="chatbubble"
            size={size * 0.5}
            color={theme.colors.text.inverse}
          />
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  trophyContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  halo: {
    position: "absolute",
  },
  iconBackground: {
    alignItems: "center",
    justifyContent: "center",
    elevation: 8,
  },
});

export default CommentTrophy;
