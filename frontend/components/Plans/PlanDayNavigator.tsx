/**
 * PlanDayNavigator - Day navigation for Bible reading plans
 * Features: Previous/Next day arrows, day number with calendar date display
 * Similar structure to DayNavigator in Devotion
 */

import React, { useMemo, useCallback } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { observer } from "@legendapp/state/react";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@/contexts/ThemeContext";
import { useToast } from "@/contexts/ToastContext";
import { DayCompletionIndicator, LockedDayIndicator } from "./Progress";
import type { DayRewardsSummary } from "@/types/database";

interface PlanDayNavigatorProps {
  currentDay: number;
  totalDays: number;
  startedAt: string; // ISO date string when plan was started
  onPreviousDay: () => void;
  onNextDay: () => void;
  onDayPress?: () => void; // Optional: called when day display is pressed (for date picker)
  isComplete?: boolean; // Whether this day has been marked as complete
  dayRewardsSummary?: DayRewardsSummary[]; // Rewards summary for showing comment indicators
}

/**
 * Calculate the calendar date for a given plan day.
 * Correctly handles timezone by extracting local date components from the ISO string.
 */
function getDateForDay(startedAt: string, dayNumber: number): Date {
  const parsedStart = new Date(startedAt);
  // Extract local date at midnight (not the UTC time from the ISO string)
  const startDate = new Date(
    parsedStart.getFullYear(),
    parsedStart.getMonth(),
    parsedStart.getDate(),
  );
  const result = new Date(startDate);
  result.setDate(startDate.getDate() + (dayNumber - 1));
  return result;
}

/**
 * Format date for display (e.g., "Mon, Jan 6" or "Today")
 */
function formatDayDate(date: Date): string {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  // Compare dates (ignoring time)
  const isSameDay = (d1: Date, d2: Date) =>
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();

  if (isSameDay(date, today)) {
    return "Today";
  }
  if (isSameDay(date, tomorrow)) {
    return "Tomorrow";
  }
  if (isSameDay(date, yesterday)) {
    return "Yesterday";
  }

  // Format as "Mon, Jan 6"
  const dayName = date.toLocaleDateString("en-US", { weekday: "short" });
  const month = date.toLocaleDateString("en-US", { month: "short" });
  const dayNum = date.getDate();

  return `${dayName}, ${month} ${dayNum}`;
}

/**
 * Check if a day is in the future (locked)
 * Returns number of days until unlock, or 0 if already unlocked
 */
function getDaysUntilUnlock(startedAt: string, dayNumber: number): number {
  const dayDate = getDateForDay(startedAt, dayNumber);
  const today = new Date();

  // Reset time to midnight for accurate day comparison
  dayDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  const diffTime = dayDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays > 0 ? diffDays : 0;
}

const PlanDayNavigator = observer(function PlanDayNavigator({
  currentDay,
  totalDays,
  startedAt,
  onPreviousDay,
  onNextDay,
  onDayPress,
  isComplete = false,
  dayRewardsSummary = [],
}: PlanDayNavigatorProps) {
  const { theme } = useTheme();
  const { showToast } = useToast();

  const canGoPrevious = currentDay > 1;
  const canGoNext = currentDay < totalDays;

  // Calculate the calendar date for the current day
  const currentDayDate = useMemo(() => {
    const date = getDateForDay(startedAt, currentDay);
    return formatDayDate(date);
  }, [startedAt, currentDay]);

  // Check if current day is in the future (locked)
  const daysUntilUnlock = useMemo(() => {
    return getDaysUntilUnlock(startedAt, currentDay);
  }, [startedAt, currentDay]);

  const isFutureDay = daysUntilUnlock > 0;

  // Handle tap on locked day indicator
  const handleLockedDayPress = useCallback(() => {
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

  // Check if current day has a comment reward
  const currentDayRewards = dayRewardsSummary.find(
    (d) => d.dayNumber === currentDay,
  );
  const hasComment = currentDayRewards?.hasComment ?? false;

  // Use darker background when day is complete for visual distinction
  const headerBackgroundColor = theme.colors.background.primary;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: headerBackgroundColor,
          borderBottomColor: theme.colors.border,
        },
      ]}
    >
      {/* Previous Day Button */}
      <Pressable
        onPress={onPreviousDay}
        style={[styles.arrowButton, !canGoPrevious && styles.arrowDisabled]}
        disabled={!canGoPrevious}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Ionicons
          name="chevron-back"
          size={24}
          color={
            canGoPrevious ? theme.colors.text.primary : theme.colors.text.muted
          }
        />
      </Pressable>

      {/* Day Display - shows day number, date, and progress. Pressable for date picker */}
      <Pressable
        style={styles.dayContainer}
        onPress={onDayPress}
        disabled={!onDayPress}
      >
        <View style={styles.dayInfo}>
          <Text style={[styles.dayText, { color: theme.colors.text.primary }]}>
            Day {currentDay}
          </Text>
          {isFutureDay ? (
            <Pressable onPress={handleLockedDayPress} hitSlop={8}>
              <LockedDayIndicator size={16} />
            </Pressable>
          ) : isComplete ? (
            <DayCompletionIndicator size={16} showHalo />
          ) : null}
          {hasComment && !isFutureDay && (
            <Ionicons
              name="chatbubble"
              size={14}
              color={theme.colors.gamification.trophy}
              style={styles.commentIcon}
            />
          )}
          <Text style={[styles.separator, { color: theme.colors.text.muted }]}>
            •
          </Text>
          <Text
            style={[styles.dateText, { color: theme.colors.text.secondary }]}
          >
            {currentDayDate}
          </Text>
        </View>
        <View style={styles.progressRow}>
          <Text style={[styles.totalText, { color: theme.colors.text.muted }]}>
            {currentDay} of {totalDays}
          </Text>
          {onDayPress && (
            <Ionicons
              name="calendar-outline"
              size={14}
              color={theme.colors.text.muted}
              style={styles.calendarIcon}
            />
          )}
        </View>
      </Pressable>

      {/* Next Day Button */}
      <Pressable
        onPress={onNextDay}
        style={[styles.arrowButton, !canGoNext && styles.arrowDisabled]}
        disabled={!canGoNext}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Ionicons
          name="chevron-forward"
          size={24}
          color={
            canGoNext ? theme.colors.text.primary : theme.colors.text.muted
          }
        />
      </Pressable>
    </View>
  );
});

export default PlanDayNavigator;

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingTop: 2, // Minimal gap from header above
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  arrowButton: {
    padding: 8,
  },
  arrowDisabled: {
    opacity: 0.3,
  },
  dayContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  dayInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dayText: {
    fontSize: 16,
    fontWeight: "600",
  },
  separator: {
    fontSize: 14,
  },
  dateText: {
    fontSize: 15,
    fontWeight: "500",
  },
  totalText: {
    fontSize: 12,
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  calendarIcon: {
    marginLeft: 2,
  },
  commentIcon: {
    marginLeft: 2,
  },
});
