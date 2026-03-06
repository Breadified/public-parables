/**
 * InlineCompletionButton - Completion button for use within scroll content
 * Unlike DayCompletionButton which is absolutely positioned, this is inline
 *
 * Features:
 * - Sonar ring animation when enabled (call to action)
 * - Shimmer effect when enabled
 * - Rotating halo when complete
 * - Spring animation on press
 * - Works within ScrollView content
 */

import React, { useRef, useCallback, useEffect } from "react";
import { Animated, Pressable, StyleSheet, View, Text } from "react-native";

import { useTheme } from "@/contexts/ThemeContext";
import CheckmarkIcon from "@/components/Shared/CheckmarkIcon";
import RotatingHalo from "@/components/Shared/RotatingHalo";
import ShimmerOverlay from "@/components/Shared/ShimmerOverlay";

interface InlineCompletionButtonProps {
  /** Whether the action is complete */
  isComplete: boolean;
  /** Whether the button is enabled */
  isEnabled?: boolean;
  /** Callback when pressed */
  onPress: () => void;
  /** Label text (shown next to button) */
  label?: string;
  /** Size of the button */
  size?: "small" | "medium" | "large";
}

const SIZES = {
  small: { button: 44, icon: 20, halo: 56, ring: 44, ringMaxScale: 1.6 },
  medium: { button: 56, icon: 24, halo: 68, ring: 56, ringMaxScale: 1.6 },
  large: { button: 64, icon: 28, halo: 76, ring: 64, ringMaxScale: 1.6 },
};

const SPRING_CONFIG = { damping: 15, stiffness: 150, mass: 1 };

const InlineCompletionButton: React.FC<InlineCompletionButtonProps> = ({
  isComplete,
  isEnabled = true,
  onPress,
  label,
  size = "medium",
}) => {
  const { theme } = useTheme();
  const gamification = theme.colors.gamification;
  const sizeConfig = SIZES[size];

  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Sonar ring animations (3 staggered rings) - matching DayCompletionButton
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const ring3 = useRef(new Animated.Value(0)).current;

  // Run sonar animation when enabled but not complete (call to action)
  useEffect(() => {
    if (isEnabled && !isComplete) {
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
  }, [isEnabled, isComplete, ring1, ring2, ring3]);

  const handlePressIn = useCallback(() => {
    if (!isComplete && isEnabled) {
      Animated.spring(scaleAnim, {
        toValue: 0.9,
        ...SPRING_CONFIG,
        useNativeDriver: true,
      }).start();
    }
  }, [isComplete, isEnabled, scaleAnim]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      ...SPRING_CONFIG,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);

  const handlePress = useCallback(() => {
    if (!isComplete && isEnabled) {
      onPress();
    }
  }, [isComplete, isEnabled, onPress]);

  // Determine button colors based on state (matching DayCompletionButton)
  const buttonBackground = isComplete
    ? gamification.nodeComplete
    : isEnabled
    ? gamification.nodeCurrent
    : gamification.nodePending;

  const iconColor = isComplete
    ? theme.colors.text.inverse
    : isEnabled
    ? theme.colors.text.inverse
    : theme.colors.text.muted;

  // Sonar ring component (outline only, expands outward)
  const renderSonarRing = (anim: Animated.Value, key: string) => {
    const scale = anim.interpolate({
      inputRange: [0, 1],
      outputRange: [1, sizeConfig.ringMaxScale],
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
            width: sizeConfig.ring,
            height: sizeConfig.ring,
            borderRadius: sizeConfig.ring / 2,
            borderColor: gamification.nodeCurrent,
            opacity,
            transform: [{ scale }],
          },
        ]}
      />
    );
  };

  // Calculate sonar container size
  const sonarContainerSize = sizeConfig.ring * sizeConfig.ringMaxScale;

  return (
    <View style={styles.container}>
      {/* Complete state: halo + checkmark */}
      {isComplete ? (
        <View
          style={[
            styles.haloContainer,
            { width: sizeConfig.halo, height: sizeConfig.halo },
          ]}
        >
          {/* Rotating halo for completed state */}
          <RotatingHalo
            size={sizeConfig.halo}
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
                width: sizeConfig.button,
                height: sizeConfig.button,
                borderRadius: sizeConfig.button / 2,
                backgroundColor: buttonBackground,
                shadowColor: gamification.nodeComplete,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.4,
                shadowRadius: 8,
                elevation: 6,
              },
            ]}
          >
            <CheckmarkIcon
              size={sizeConfig.icon}
              strokeWidth={3.5}
              color={iconColor}
            />
          </View>
        </View>
      ) : (
        /* Enabled/disabled state: sonar rings + shimmer button */
        <View
          style={[
            styles.sonarContainer,
            { width: sonarContainerSize, height: sonarContainerSize },
          ]}
        >
          {/* Sonar rings - only when enabled (call to action) */}
          {isEnabled && (
            <>
              {renderSonarRing(ring1, "ring1")}
              {renderSonarRing(ring2, "ring2")}
              {renderSonarRing(ring3, "ring3")}
            </>
          )}

          <Animated.View
            style={[styles.buttonContainer, { transform: [{ scale: scaleAnim }] }]}
          >
            <Pressable
              onPress={handlePress}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              disabled={!isEnabled}
              style={[
                styles.button,
                {
                  width: sizeConfig.button,
                  height: sizeConfig.button,
                  borderRadius: sizeConfig.button / 2,
                  backgroundColor: buttonBackground,
                  shadowColor: buttonBackground,
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: isEnabled ? 0.4 : 0.2,
                  shadowRadius: 8,
                  elevation: isEnabled ? 6 : 2,
                },
              ]}
            >
              <CheckmarkIcon
                size={sizeConfig.icon}
                strokeWidth={3.5}
                color={iconColor}
              />

              {/* Shimmer overlay for enabled state */}
              {isEnabled && (
                <ShimmerOverlay
                  width={sizeConfig.button}
                  height={sizeConfig.button}
                  duration={400}
                  delay={2500}
                  active={true}
                />
              )}
            </Pressable>
          </Animated.View>
        </View>
      )}

      {/* Optional label */}
      {label && (
        <Text
          style={[
            styles.label,
            {
              color: isComplete
                ? gamification.nodeComplete
                : theme.colors.text.secondary,
            },
          ]}
        >
          {label}
        </Text>
      )}
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
    alignItems: "center",
    justifyContent: "center",
  },
  halo: {
    position: "absolute",
    top: 0,
    left: 0,
  },
  sonarContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  sonarRing: {
    position: "absolute",
    borderWidth: 2,
    backgroundColor: "transparent",
  },
  buttonContainer: {
    // Centered within sonar container
  },
  button: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
  },
});

export default InlineCompletionButton;
