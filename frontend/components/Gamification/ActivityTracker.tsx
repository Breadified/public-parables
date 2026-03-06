/**
 * ActivityTracker - Shows daily activities and login streak milestones
 *
 * Two sections:
 * 1. Daily Activities - Login, plan day, note, devotion (reset at midnight)
 * 2. Login Streak - Progress toward 7-day, 30-day, and 365-day milestones
 *
 * Supports offline mode:
 * - Uses reactive local tracking for instant UI updates
 * - Fetches streak data from server when online
 * - Tapping incomplete activities navigates to relevant screen
 */

import React, { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useSelector } from "@legendapp/state/react";
import { useRouter } from "expo-router";

import { useTheme } from "@/contexts/ThemeContext";
import { REWARD_POINTS, REWARD_TYPES } from "@/types/database";
import { authStore$ } from "@/state/bibleStore";
import {
  dailyActivityStatus$,
  allStreaks$,
  TOTAL_DAILY_ACTIVITIES,
  furthestProgressSession$,
  planStore$,
} from "@/state";
import { studyModeStore$ } from "@/state/studyModeStore";
import { calculatePlanDay } from "@/utils/dateFormatters";
import ActivityItem from "./ActivityItem";
import StreakProgressBar from "./StreakProgressBar";

interface ActivityTrackerProps {
  /** User ID for fetching activity status */
  userId: string;
  /** Whether the user is authenticated */
  isAuthenticated: boolean;
}

/**
 * Calculate progress toward next milestone
 * @param currentStreak Current streak count
 * @param milestone Milestone interval (7, 30, or 365)
 * @returns Progress value (0-milestone)
 */
function getProgressTowardMilestone(currentStreak: number, milestone: number): number {
  if (currentStreak === 0) return 0;
  const remainder = currentStreak % milestone;
  // If exactly at milestone, show full progress (just completed)
  return remainder === 0 ? milestone : remainder;
}

const ActivityTracker: React.FC<ActivityTrackerProps> = ({
  userId,
  isAuthenticated,
}) => {
  const { theme } = useTheme();
  const router = useRouter();

  // Reactive daily activity status (updates instantly when activities complete)
  const daily = useSelector(dailyActivityStatus$);

  // Reactive streaks for all activity types
  const streaks = useSelector(allStreaks$);

  // Loading state for streak data
  const [isLoadingStreak, setIsLoadingStreak] = useState(true);

  // Watch for auth state changes to refresh streak when coming online
  const shouldSync = useSelector(authStore$.shouldSync);

  // Get furthest progress session for plan navigation
  const furthestSession = useSelector(furthestProgressSession$);

  useEffect(() => {
    if (!isAuthenticated || !userId) {
      setIsLoadingStreak(false);
      return;
    }

    const syncData = async () => {
      try {
        // Sync sessions data with server (if online)
        if (shouldSync) {
          // Sync sessions to get latest status (removes inactive sessions)
          await planStore$.syncSessionsFromServer(userId);
        }
        // Streaks are synced automatically via performBatchSync
        // and tracked locally via allStreaks$ reactive state
      } catch (error) {
        console.error("[ActivityTracker] Error syncing data:", error);
      } finally {
        setIsLoadingStreak(false);
      }
    };

    syncData();
  }, [userId, isAuthenticated, shouldSync]);

  // Navigation handlers for incomplete activities
  const handleNavigateToPlan = useCallback(() => {
    // Only navigate to session if it's actually active
    if (furthestSession && furthestSession.status === 'active') {
      // Calculate today's plan day based on when the session started
      const todayPlanDay = calculatePlanDay(furthestSession.started_at);

      // Reset day progress state for fresh view
      planStore$.resetDayProgress();
      planStore$.setActiveSession(furthestSession.id);
      // Navigate with gotoDay param so session screen jumps to today's day
      router.push(`/plans/session/${furthestSession.id}?gotoDay=${todayPlanDay}`);
    } else {
      // Fallback to plans tab if no active session
      router.push("/(tabs)/plans");
    }
  }, [furthestSession, router]);

  const handleNavigateToAddNote = useCallback(() => {
    studyModeStore$.enterNotesMode();
    router.push("/(tabs)");
  }, [router]);

  const handleNavigateToDevotions = useCallback(() => {
    router.push("/(tabs)/devotion");
  }, [router]);

  if (!isAuthenticated) {
    return null;
  }

  // Login streak data
  const loginStreak = streaks.login.currentStreak;
  const weekNumber = loginStreak > 0 ? Math.ceil(loginStreak / 7) : 1;
  const monthNumber = loginStreak > 0 ? Math.ceil(loginStreak / 30) : 1;
  const yearNumber = loginStreak > 0 ? Math.ceil(loginStreak / 365) : 1;

  return (
    <View style={styles.container}>
      {/* Daily Activities Section */}
      <View
        style={[
          styles.section,
          { backgroundColor: theme.colors.background.secondary },
        ]}
      >
        <Text
          style={[styles.sectionTitle, { color: theme.colors.text.primary }]}
        >
          Daily Activities
        </Text>
        <Text
          style={[styles.sectionSubtitle, { color: theme.colors.text.muted }]}
        >
          Resets at midnight
        </Text>

        <View style={styles.activitiesList}>
          <ActivityItem
            name="All complete bonus"
            xp={REWARD_POINTS[REWARD_TYPES.DAILY_ALL_COMPLETE]}
            isCompleted={daily.loginCompleted && daily.planDayCompleted && daily.noteAddedCompleted && daily.devotionCompleted}
            icon="trophy-outline"
            showHalo={daily.loginCompleted && daily.planDayCompleted && daily.noteAddedCompleted && daily.devotionCompleted}
          />
          <StreakProgressBar
            current={
              (daily.loginCompleted ? 1 : 0) +
              (daily.planDayCompleted ? 1 : 0) +
              (daily.noteAddedCompleted ? 1 : 0) +
              (daily.devotionCompleted ? 1 : 0)
            }
            target={TOTAL_DAILY_ACTIVITIES}
            isLoading={false}
            compact
          />
          <View
            style={[styles.divider, { backgroundColor: theme.colors.border }]}
          />
          <ActivityItem
            name="Login bonus"
            xp={REWARD_POINTS[REWARD_TYPES.LOGIN]}
            isCompleted={daily.loginCompleted}
            icon="log-in-outline"
            showHalo={daily.loginCompleted}
          />
          <View
            style={[styles.divider, { backgroundColor: theme.colors.border }]}
          />
          <ActivityItem
            name="Today's bible plan"
            xp={REWARD_POINTS[REWARD_TYPES.DAY_COMPLETE]}
            isCompleted={daily.planDayCompleted}
            icon="checkmark-circle-outline"
            showHalo={daily.planDayCompleted}
            onPress={handleNavigateToPlan}
          />
          <View
            style={[styles.divider, { backgroundColor: theme.colors.border }]}
          />
          <ActivityItem
            name="Add a note"
            xp={REWARD_POINTS[REWARD_TYPES.DAILY_NOTE]}
            isCompleted={daily.noteAddedCompleted}
            icon="create-outline"
            showHalo={daily.noteAddedCompleted}
            onPress={handleNavigateToAddNote}
          />
          <View
            style={[styles.divider, { backgroundColor: theme.colors.border }]}
          />
          <ActivityItem
            name="Today's devotion"
            xp={REWARD_POINTS[REWARD_TYPES.DAILY_DEVOTION]}
            isCompleted={daily.devotionCompleted}
            icon="bulb-outline"
            showHalo={daily.devotionCompleted}
            onPress={handleNavigateToDevotions}
          />
        </View>
      </View>

      {/* Login Streak Section */}
      <View
        style={[
          styles.section,
          { backgroundColor: theme.colors.background.secondary },
        ]}
      >
        <View style={styles.streakHeader}>
          <Text
            style={[styles.sectionTitle, { color: theme.colors.text.primary }]}
          >
            Login Streak
          </Text>
          <View style={styles.streakCountBadge}>
            <Text style={styles.streakEmoji}>🔥</Text>
            <Text
              style={[styles.streakCount, { color: theme.colors.text.primary }]}
            >
              {loginStreak}
            </Text>
          </View>
        </View>

        <View style={styles.activitiesList}>
          {/* Week milestone */}
          <View style={styles.milestoneRow}>
            <Text
              style={[styles.milestoneName, { color: theme.colors.text.primary }]}
            >
              Week {weekNumber} streak bonus
            </Text>
            <Text
              style={[styles.milestoneXP, { color: theme.colors.text.secondary }]}
            >
              +{REWARD_POINTS[REWARD_TYPES.LOGIN_STREAK_7].toLocaleString()} XP
            </Text>
          </View>
          <StreakProgressBar
            current={getProgressTowardMilestone(loginStreak, 7)}
            target={7}
            isLoading={isLoadingStreak}
            activityType="login"
            compact
          />
          <View
            style={[styles.divider, { backgroundColor: theme.colors.border }]}
          />

          {/* Month milestone */}
          <View style={styles.milestoneRow}>
            <Text
              style={[styles.milestoneName, { color: theme.colors.text.primary }]}
            >
              Month {monthNumber} streak bonus
            </Text>
            <Text
              style={[styles.milestoneXP, { color: theme.colors.text.secondary }]}
            >
              +{REWARD_POINTS[REWARD_TYPES.LOGIN_STREAK_30].toLocaleString()} XP
            </Text>
          </View>
          <StreakProgressBar
            current={getProgressTowardMilestone(loginStreak, 30)}
            target={30}
            isLoading={isLoadingStreak}
            activityType="login"
            compact
          />
          <View
            style={[styles.divider, { backgroundColor: theme.colors.border }]}
          />

          {/* Year milestone */}
          <View style={styles.milestoneRow}>
            <Text
              style={[styles.milestoneName, { color: theme.colors.text.primary }]}
            >
              Year {yearNumber} streak bonus
            </Text>
            <Text
              style={[styles.milestoneXP, { color: theme.colors.text.secondary }]}
            >
              +{REWARD_POINTS[REWARD_TYPES.LOGIN_STREAK_365].toLocaleString()} XP
            </Text>
          </View>
          <StreakProgressBar
            current={getProgressTowardMilestone(loginStreak, 365)}
            target={365}
            isLoading={isLoadingStreak}
            activityType="login"
            compact
          />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 12,
    marginBottom: 12,
  },
  section: {
    borderRadius: 12,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 2,
  },
  sectionSubtitle: {
    fontSize: 12,
    marginBottom: 12,
  },
  activitiesList: {
    gap: 0,
  },
  divider: {
    height: 1,
    marginHorizontal: -4,
    marginVertical: 8,
  },
  streakHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  streakCountBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  streakEmoji: {
    fontSize: 16,
  },
  streakCount: {
    fontSize: 18,
    fontWeight: "700",
  },
  milestoneRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  milestoneName: {
    fontSize: 13,
    fontWeight: "500",
  },
  milestoneXP: {
    fontSize: 12,
    fontWeight: "600",
  },
});

export default ActivityTracker;
