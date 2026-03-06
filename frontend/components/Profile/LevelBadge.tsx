/**
 * LevelBadge - Level indicator badge that overlays on avatar
 *
 * Displays the user's level number with a colored badge that changes
 * appearance based on the level tier (Bronze, Silver, Gold, Platinum, Diamond).
 * Designed to be positioned at the bottom-right of an avatar.
 * Silver+ tiers have an animated sheen effect for premium appearance.
 * Platinum+ tiers also have a pulsing ring effect.
 */

import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";

import { useTheme } from "@/contexts/ThemeContext";
import { getLevelInfo, getStreakTier, type LevelTier } from "@/utils/levelSystem";
import ShimmerOverlay from "@/components/Shared/ShimmerOverlay";

interface LevelBadgeProps {
  /** Total XP to calculate level from */
  totalXP: number;
  /** Size of the badge (default: 16) */
  size?: number;
  /** Whether to show as standalone (not overlaid) */
  standalone?: boolean;
  /** Server-provided level (if available, used instead of calculating from XP) */
  serverLevel?: number;
  /** Login streak count - when provided, badge shows streak number and uses streak-based tiers */
  streakCount?: number;
}

// Tiers that get the sheen effect (everything except bronze)
const SHEEN_TIERS: LevelTier[] = ["silver", "gold", "platinum", "diamond"];

// Tiers that get the pulsing ring effect (premium tiers only)
const PULSE_TIERS: LevelTier[] = ["platinum", "diamond"];

// Pulse ring settings
const RING_MAX_SCALE = 1.8;
const RING_DURATION = 1200;
const RING_STAGGER = 400;

/**
 * LevelBadge Component
 * Shows a small circular badge with the level number
 */
const LevelBadge: React.FC<LevelBadgeProps> = ({
  totalXP,
  size = 16,
  standalone = false,
  serverLevel,
  streakCount,
}) => {
  const { theme } = useTheme();

  // When streakCount is provided, use streak-based tiers and display streak number
  const isStreakMode = streakCount !== undefined;
  const levelInfo = getLevelInfo(totalXP);
  const tier = isStreakMode ? getStreakTier(streakCount) : levelInfo.tier;
  const displayLevel = isStreakMode ? streakCount : (serverLevel ?? levelInfo.level);
  const badgeColors = theme.colors.gamification.levelBadge[tier];

  // Scale font size based on badge size and level digits
  const levelStr = String(displayLevel);
  const fontSize = levelStr.length > 1 ? size * 0.5 : size * 0.6;

  // Show sheen for silver and above
  const showSheen = SHEEN_TIERS.includes(tier);

  // Show pulsing ring for platinum and diamond
  const showPulse = PULSE_TIERS.includes(tier);

  // Pulse ring animations (2 staggered rings)
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (showPulse) {
      const createRing = (anim: Animated.Value, delay: number) => {
        return Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.timing(anim, {
              toValue: 1,
              duration: RING_DURATION,
              useNativeDriver: true,
            }),
            Animated.timing(anim, {
              toValue: 0,
              duration: 0,
              useNativeDriver: true,
            }),
          ])
        );
      };

      const anim1 = createRing(ring1, 0);
      const anim2 = createRing(ring2, RING_STAGGER);

      anim1.start();
      anim2.start();

      return () => {
        anim1.stop();
        anim2.stop();
        ring1.setValue(0);
        ring2.setValue(0);
      };
    }
  }, [showPulse, ring1, ring2]);

  // Render a single pulse ring
  const renderPulseRing = (anim: Animated.Value, key: string) => {
    const scale = anim.interpolate({
      inputRange: [0, 1],
      outputRange: [1, RING_MAX_SCALE],
    });
    const opacity = anim.interpolate({
      inputRange: [0, 0.2, 1],
      outputRange: [0.6, 0.4, 0],
    });

    return (
      <Animated.View
        key={key}
        style={[
          styles.pulseRing,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderColor: badgeColors.border,
            opacity,
            transform: [{ scale }],
          },
        ]}
      />
    );
  };

  // Container size needs to accommodate the pulse rings
  const containerSize = showPulse ? size * RING_MAX_SCALE : size;
  const containerOffset = showPulse ? (containerSize - size) / 2 : 0;

  return (
    <View
      style={[
        !standalone && styles.overlayPosition,
        !standalone && showPulse && {
          bottom: -2 - containerOffset,
          right: -2 - containerOffset,
        },
        {
          width: containerSize,
          height: containerSize,
          alignItems: "center",
          justifyContent: "center",
        },
      ]}
    >
      {/* Pulse rings for platinum+ tiers */}
      {showPulse && (
        <>
          {renderPulseRing(ring1, "ring1")}
          {renderPulseRing(ring2, "ring2")}
        </>
      )}

      {/* Main badge */}
      <View
        style={[
          styles.badge,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: badgeColors.background,
            borderColor: badgeColors.border,
            borderWidth: size > 14 ? 1.5 : 1,
          },
        ]}
      >
        {/* Animated sheen effect for silver+ tiers */}
        {showSheen && (
          <ShimmerOverlay
            width={size}
            height={size}
            duration={1000}
            delay={2000}
            overshoot={1.2}
          />
        )}
        <Text
          style={[
            styles.levelText,
            {
              fontSize,
              color: badgeColors.text,
            },
          ]}
          numberOfLines={1}
        >
          {displayLevel}
        </Text>
      </View>
    </View>
  );
};

export default LevelBadge;

const styles = StyleSheet.create({
  badge: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  overlayPosition: {
    position: "absolute",
    bottom: -2,
    right: -2,
  },
  pulseRing: {
    position: "absolute",
    borderWidth: 1.5,
    backgroundColor: "transparent",
  },
  levelText: {
    fontWeight: "700",
    textAlign: "center",
  },
});
