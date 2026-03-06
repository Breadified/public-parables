/**
 * DayCompletionButton - Bottom circle+tick button with spring animation
 * Shows locked state for future days, shimmer CTA for enabled, halo for completed
 * Displays "Completed!" label when day is marked complete
 */

import React, { useRef, useCallback, useEffect } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  View,
  Text,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@/contexts/ThemeContext";
import CheckmarkIcon from "@/components/Shared/CheckmarkIcon";
import { useToast } from "@/contexts/ToastContext";
import RotatingHalo from "@/components/Shared/RotatingHalo";
import ShimmerOverlay from "@/components/Shared/ShimmerOverlay";

// Sonar ring settings (matching ProgressMap tracker)
const RING_SIZE = 56; // Same as button
const RING_MAX_SCALE = 1.6; // Slightly larger than button

interface DayCompletionButtonProps {
  /** Whether the day is already marked as complete */
  isComplete: boolean;
  /** Whether the button should be enabled (e.g., all readings scrolled) */
  isEnabled?: boolean;
  /** Whether this is a future day (shows locked state) */
  isLocked?: boolean;
  /** Number of days until this day unlocks (for toast message) */
  daysUntilUnlock?: number;
  /** Callback when button is pressed */
  onPress: () => void;
  /** Offset to adjust horizontal centering (e.g., to account for sidebar) */
  horizontalOffset?: number;
}

const BUTTON_SIZE = 56;
const HALO_SIZE = BUTTON_SIZE + 12;
const LOCK_SIZE = 18;
const SPRING_CONFIG = { damping: 15, stiffness: 150, mass: 1 };

const DayCompletionButton = ({
  isComplete,
  isEnabled = true,
  isLocked = false,
  daysUntilUnlock = 1,
  onPress,
  horizontalOffset = 0,
}: DayCompletionButtonProps) => {
  const { theme } = useTheme();
  const { showToast } = useToast();
  const gamification = theme.colors.gamification;

  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Sonar ring animations (3 staggered rings) - same as ProgressMap tracker
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const ring3 = useRef(new Animated.Value(0)).current;

  // Run sonar animation when enabled but not complete (call to action)
  useEffect(() => {
    if (isEnabled && !isComplete && !isLocked) {
      const createRing = (anim: Animated.Value, delay: number) => {
        return Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.timing(anim, {
              toValue: 1,
              duration: 1200,
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
      const anim2 = createRing(ring2, 400);
      const anim3 = createRing(ring3, 800);

      anim1.start();
      anim2.start();
      anim3.start();

      return () => {
        anim1.stop();
        anim2.stop();
        anim3.stop();
        ring1.setValue(0);
        ring2.setValue(0);
        ring3.setValue(0);
      };
    }
  }, [isEnabled, isComplete, isLocked, ring1, ring2, ring3]);

  const handlePressIn = useCallback(() => {
    Animated.timing(scaleAnim, {
      toValue: 0.9,
      duration: 100,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      ...SPRING_CONFIG,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);

  const handleLockedPress = useCallback(() => {
    const message =
      daysUntilUnlock === 1
        ? "Bible reading will unlock tomorrow"
        : `Bible reading will unlock in ${daysUntilUnlock} days`;

    showToast({
      message,
      type: "info",
      duration: 2500,
    });
  }, [daysUntilUnlock, showToast]);

  const handlePress = useCallback(() => {
    if (isLocked) {
      handleLockedPress();
      return;
    }
    if (!isEnabled || isComplete) return;
    onPress();
  }, [isLocked, isEnabled, isComplete, onPress, handleLockedPress]);

  // Locked state: greyed out with lock icon overlay
  if (isLocked) {
    return (
      <View style={styles.container}>
        <Animated.View
          style={[
            styles.buttonWrapper,
            {
              transform: [
                { scale: scaleAnim },
                { translateX: horizontalOffset },
              ],
            },
          ]}
        >
          <Pressable
            onPress={handlePress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            style={[
              styles.button,
              {
                backgroundColor: theme.colors.background.secondary,
                shadowColor: theme.colors.text.muted,
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.2,
                shadowRadius: 4,
                elevation: 2,
              },
            ]}
          >
            <CheckmarkIcon
              size={28}
              strokeWidth={3.5}
              color={theme.colors.text.muted}
            />
          </Pressable>

          {/* Lock icon overlay */}
          <View
            style={[
              styles.lockContainer,
              {
                backgroundColor: theme.colors.background.primary,
              },
            ]}
          >
            <Ionicons
              name="lock-closed"
              size={LOCK_SIZE * 0.7}
              color={theme.colors.text.muted}
            />
          </View>
        </Animated.View>
      </View>
    );
  }

  // Complete state: checkmark with rotating halo (no shimmer)
  if (isComplete) {
    return (
      <View style={styles.container}>
        <View style={[styles.haloContainer, { transform: [{ translateX: horizontalOffset }] }]}>
          {/* Rotating halo */}
          <RotatingHalo
            size={HALO_SIZE}
            strokeWidth={3}
            startColor={gamification.haloGradientStart}
            endColor={gamification.haloGradientEnd}
            animate
            duration={3000}
            style={styles.halo}
          />

          {/* Checkmark button */}
          <View
            style={[
              styles.button,
              {
                backgroundColor: gamification.nodeComplete,
                shadowColor: gamification.nodeComplete,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.4,
                shadowRadius: 8,
                elevation: 6,
              },
            ]}
          >
            <CheckmarkIcon
              size={28}
              strokeWidth={3.5}
              color={theme.colors.text.inverse}
            />
          </View>
        </View>
        {/* Completed label */}
        <Text
          style={[
            styles.completedLabel,
            {
              color: gamification.nodeComplete,
              transform: [{ translateX: horizontalOffset }],
            },
          ]}
        >
          Completed!
        </Text>
      </View>
    );
  }

  // Normal state: enabled/disabled button with shimmer when enabled
  const buttonColor = isEnabled
    ? gamification.nodeCurrent
    : gamification.nodePending;

  const iconColor = isEnabled
    ? theme.colors.text.inverse
    : theme.colors.text.muted;

  // Sonar ring component (outline only, expands outward) - same as ProgressMap
  const renderSonarRing = (anim: Animated.Value, key: string) => {
    const scale = anim.interpolate({
      inputRange: [0, 1],
      outputRange: [1, RING_MAX_SCALE],
    });
    const opacity = anim.interpolate({
      inputRange: [0, 0.2, 1],
      outputRange: [0.8, 0.5, 0],
    });

    return (
      <Animated.View
        key={key}
        style={[
          styles.sonarRing,
          {
            borderColor: gamification.nodeCurrent,
            opacity,
            transform: [{ scale }],
          },
        ]}
      />
    );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.sonarContainer, { transform: [{ translateX: horizontalOffset }] }]}>
        {/* Sonar rings - only when enabled (call to action) */}
        {isEnabled && (
          <>
            {renderSonarRing(ring1, "ring1")}
            {renderSonarRing(ring2, "ring2")}
            {renderSonarRing(ring3, "ring3")}
          </>
        )}

        <Animated.View
          style={[
            styles.buttonWrapper,
            {
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <Pressable
            onPress={handlePress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            disabled={!isEnabled}
            style={[
              styles.button,
              {
                backgroundColor: buttonColor,
                shadowColor: buttonColor,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: isEnabled ? 0.4 : 0.2,
                shadowRadius: 8,
                elevation: isEnabled ? 6 : 2,
              },
            ]}
          >
            <CheckmarkIcon
              size={28}
              strokeWidth={3.5}
              color={iconColor}
            />

            {/* Shimmer sheen effect - only when enabled */}
            <ShimmerOverlay
              width={BUTTON_SIZE}
              height={BUTTON_SIZE}
              duration={400}
              delay={2500}
              active={isEnabled}
            />
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    paddingVertical: 16,
    gap: 12,
  },
  haloContainer: {
    width: HALO_SIZE,
    height: HALO_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  completedLabel: {
    fontSize: 14,
    fontWeight: "500",
  },
  halo: {
    position: "absolute",
    top: 0,
    left: 0,
  },
  sonarContainer: {
    width: RING_SIZE * RING_MAX_SCALE,
    height: RING_SIZE * RING_MAX_SCALE,
    alignItems: "center",
    justifyContent: "center",
  },
  sonarRing: {
    position: "absolute",
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: 2,
    backgroundColor: "transparent",
  },
  buttonWrapper: {
    borderRadius: BUTTON_SIZE / 2,
  },
  button: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  lockContainer: {
    position: "absolute",
    bottom: -2,
    right: -4,
    width: LOCK_SIZE,
    height: LOCK_SIZE,
    borderRadius: LOCK_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
  },
});

export default DayCompletionButton;
