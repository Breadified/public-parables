/**
 * ActivityItem - Single activity row with XP and completion status
 * Shows a glowing halo checkmark when completed
 * Incomplete tappable items have enhanced visual feedback
 */

import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@/contexts/ThemeContext";
import RotatingHalo from "@/components/Shared/RotatingHalo";

interface ActivityItemProps {
  /** Activity name/description */
  name: string;
  /** XP amount for this activity */
  xp: number;
  /** Whether the activity is completed */
  isCompleted: boolean;
  /** Optional icon name */
  icon?: keyof typeof Ionicons.glyphMap;
  /** Whether to show the rotating halo animation when completed */
  showHalo?: boolean;
  /** Optional progress text (e.g., "3/7 days") */
  progress?: string;
  /** Optional callback when item is pressed (for navigation shortcuts) */
  onPress?: () => void;
  /** Compact mode for streak items (smaller padding/text) */
  compact?: boolean;
}

const ActivityItem: React.FC<ActivityItemProps> = ({
  name,
  xp,
  isCompleted,
  icon = "checkmark-circle-outline",
  showHalo = true,
  progress,
  onPress,
  compact = false,
}) => {
  const { theme } = useTheme();
  const gamification = theme.colors.gamification;

  const checkmarkSize = compact ? 18 : 22;
  const haloSize = checkmarkSize + 10;
  const iconContainerSize = compact ? 28 : 32;
  const iconSize = compact ? 14 : 18;

  // Only make pressable when not completed and onPress is provided
  const isPressable = !isCompleted && onPress;

  // Subtle pulse animation for pressable items
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isPressable) {
      // Subtle breathing animation
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.02,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isPressable, pulseAnim]);

  const content = (
    <>
      {/* Left side: Icon and name */}
      <View style={styles.leftContent}>
        <View
          style={[
            styles.iconContainer,
            {
              width: iconContainerSize,
              height: iconContainerSize,
              backgroundColor: isCompleted
                ? gamification.nodeComplete + "20"
                : isPressable
                  ? theme.colors.accent + "25"
                  : theme.colors.accent + "15",
              borderWidth: isPressable ? 1.5 : 0,
              borderColor: isPressable
                ? theme.colors.accent + "40"
                : "transparent",
            },
          ]}
        >
          <Ionicons
            name={icon}
            size={iconSize}
            color={
              isCompleted
                ? gamification.nodeComplete
                : isPressable
                  ? theme.colors.accent
                  : theme.colors.text.muted
            }
          />
        </View>
        <View style={styles.textContainer}>
          <Text
            style={[
              styles.name,
              {
                fontSize: compact ? 13 : 14,
                color: isCompleted
                  ? theme.colors.text.primary
                  : isPressable
                    ? theme.colors.text.primary
                    : theme.colors.text.secondary,
                fontWeight: isPressable ? "600" : "500",
              },
            ]}
          >
            {name}
          </Text>
          {progress && (
            <Text
              style={[styles.progress, { color: theme.colors.text.muted }]}
            >
              {progress}
            </Text>
          )}
        </View>
      </View>

      {/* Right side: XP and completion indicator */}
      <View style={styles.rightContent}>
        <Text
          style={[
            styles.xp,
            {
              fontSize: compact ? 12 : 13,
              color: isCompleted
                ? gamification.nodeComplete
                : theme.colors.text.muted,
            },
          ]}
        >
          +{xp.toLocaleString()} XP
        </Text>

        {/* Completion indicator with halo */}
        <View
          style={[
            styles.checkmarkWrapper,
            { width: haloSize, height: haloSize },
          ]}
        >
          {isCompleted ? (
            <>
              {showHalo && (
                <RotatingHalo
                  size={haloSize}
                  strokeWidth={2}
                  startColor={gamification.haloGradientStart}
                  endColor={gamification.haloGradientEnd}
                  animate
                  duration={3000}
                  style={styles.halo}
                />
              )}
              <View
                style={[
                  styles.checkmark,
                  {
                    width: checkmarkSize,
                    height: checkmarkSize,
                    borderRadius: checkmarkSize / 2,
                    backgroundColor: gamification.nodeComplete,
                  },
                ]}
              >
                <Ionicons
                  name="checkmark"
                  size={checkmarkSize * 0.65}
                  color={theme.colors.text.inverse}
                />
              </View>
            </>
          ) : (
            <View
              style={[
                styles.emptyCheckmark,
                {
                  width: checkmarkSize,
                  height: checkmarkSize,
                  borderRadius: checkmarkSize / 2,
                  borderColor: isPressable
                    ? theme.colors.accent + "60"
                    : theme.colors.border,
                  borderWidth: isPressable ? 2.5 : 2,
                },
              ]}
            />
          )}
        </View>
      </View>

      {/* Show chevron when pressable */}
      {isPressable && (
        <Ionicons
          name="chevron-forward"
          size={18}
          color={theme.colors.text.muted}
          style={styles.chevron}
        />
      )}
    </>
  );

  if (isPressable) {
    return (
      <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
        <TouchableOpacity
          style={[
            styles.container,
            styles.pressableContainer,
            compact && styles.compactContainer,
            {
              backgroundColor: theme.colors.accent + "08",
              borderRadius: 8,
            },
          ]}
          onPress={onPress}
          activeOpacity={0.7}
        >
          {content}
        </TouchableOpacity>
      </Animated.View>
    );
  }

  return <View style={[styles.container, compact && styles.compactContainer]}>{content}</View>;
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  compactContainer: {
    paddingVertical: 8,
  },
  pressableContainer: {
    marginHorizontal: -4,
    paddingHorizontal: 8,
    marginVertical: 2,
  },
  leftContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  iconContainer: {
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  name: {
    fontSize: 14,
    fontWeight: "500",
  },
  progress: {
    fontSize: 12,
    marginTop: 2,
  },
  rightContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  xp: {
    fontSize: 13,
    fontWeight: "600",
  },
  checkmarkWrapper: {
    alignItems: "center",
    justifyContent: "center",
  },
  halo: {
    position: "absolute",
    top: 0,
    left: 0,
  },
  checkmark: {
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  emptyCheckmark: {
    // borderWidth is set dynamically based on isPressable
  },
  chevron: {
    marginLeft: 8,
  },
});

export default ActivityItem;
