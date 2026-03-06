/**
 * XPProgressBar - Shows XP progress toward next level
 *
 * Displays:
 * - Current level and tier name
 * - Progress bar from current level to next level
 * - XP count (current / needed for next level)
 */

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, {
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";

import { useTheme } from "@/contexts/ThemeContext";
import {
  getLevelInfo,
  getTierDisplayName,
  formatXP,
  getXPToNextLevel,
} from "@/utils/levelSystem";

interface XPProgressBarProps {
  /** Total XP to display progress for */
  totalXP: number;
  /** Whether to show the level info label above the bar */
  showLevelInfo?: boolean;
  /** Whether to show XP numbers below the bar */
  showXPCount?: boolean;
  /** Height of the progress bar (default: 8) */
  barHeight?: number;
  /** Server-provided level (if available, displayed instead of calculated) */
  serverLevel?: number;
}

/**
 * XPProgressBar Component
 * Shows progress toward the next level with an animated fill
 */
const XPProgressBar: React.FC<XPProgressBarProps> = ({
  totalXP,
  showLevelInfo = true,
  showXPCount = true,
  barHeight = 8,
  serverLevel,
}) => {
  const { theme } = useTheme();

  const levelInfo = getLevelInfo(totalXP);
  // Use server-provided level if available
  const displayLevel = serverLevel ?? levelInfo.level;
  const tierName = getTierDisplayName(levelInfo.tier);
  const badgeColors = theme.colors.gamification.levelBadge[levelInfo.tier];
  const xpToNext = getXPToNextLevel(totalXP);

  // Animated width for progress bar
  const progressStyle = useAnimatedStyle(() => {
    return {
      width: withTiming(`${levelInfo.progressToNextLevel * 100}%`, {
        duration: 300,
      }),
    };
  }, [levelInfo.progressToNextLevel]);

  return (
    <View style={styles.container}>
      {showLevelInfo && (
        <View style={styles.levelInfoRow}>
          <View style={styles.levelLabelRow}>
            <Text
              style={[
                styles.levelLabel,
                { color: theme.colors.text.primary },
              ]}
            >
              Level {displayLevel}
            </Text>
            <View
              style={[
                styles.tierBadge,
                { backgroundColor: badgeColors.background },
              ]}
            >
              <Text
                style={[styles.tierText, { color: badgeColors.text }]}
              >
                {tierName}
              </Text>
            </View>
          </View>
          <Text
            style={[styles.xpToNext, { color: theme.colors.text.muted }]}
          >
            {xpToNext > 0 ? `${formatXP(xpToNext)} to next` : "Max level!"}
          </Text>
        </View>
      )}

      {/* Progress Bar */}
      <View
        style={[
          styles.progressBarBackground,
          {
            height: barHeight,
            backgroundColor: theme.colors.gamification.xpBar.background,
          },
        ]}
      >
        <Animated.View
          style={[
            styles.progressBarFill,
            {
              height: barHeight,
              backgroundColor: theme.colors.gamification.xpBar.fill,
            },
            progressStyle,
          ]}
        />
      </View>

      {showXPCount && (
        <View style={styles.xpCountRow}>
          <Text
            style={[styles.xpCount, { color: theme.colors.text.secondary }]}
          >
            {formatXP(totalXP)}
          </Text>
          <Text
            style={[styles.xpCount, { color: theme.colors.text.muted }]}
          >
            {formatXP(levelInfo.xpForNextLevel)}
          </Text>
        </View>
      )}
    </View>
  );
};

export default XPProgressBar;

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  levelInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  levelLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  levelLabel: {
    fontSize: 16,
    fontWeight: "600",
  },
  tierBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  tierText: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  xpToNext: {
    fontSize: 12,
  },
  progressBarBackground: {
    borderRadius: 4,
    overflow: "hidden",
  },
  progressBarFill: {
    borderRadius: 4,
  },
  xpCountRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  xpCount: {
    fontSize: 11,
  },
});
