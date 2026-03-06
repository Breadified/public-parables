/**
 * MyPlansList - Displays user's active and paused plan sessions
 */

import React, { useMemo } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { observer, useSelector } from "@legendapp/state/react";
import { FlashList, ListRenderItemInfo } from "@shopify/flash-list";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { useTheme } from "@/contexts/ThemeContext";
import { activeSessions$, planStore$ } from "@/state";
import { useFlashListConfig } from "@/hooks/useFlashListConfig";
import type { PlanSession, BiblePlan } from "@/types/database";

const MyPlansList = observer(function MyPlansList() {
  const { theme } = useTheme();
  const router = useRouter();
  const sessions = useSelector(activeSessions$);
  const availablePlans = useSelector(planStore$.availablePlans);

  const flashListConfig = useFlashListConfig({
    estimatedItemSize: 80,
  });

  // Create a map of plan_id -> plan name for quick lookup
  const planNameMap = useMemo(() => {
    const map = new Map<string, string>();
    availablePlans.forEach((plan: BiblePlan) => {
      map.set(plan.id, plan.name);
    });
    return map;
  }, [availablePlans]);

  // Get friendly plan name
  const getPlanName = (planId: string): string => {
    return planNameMap.get(planId) || planId;
  };

  const handleSessionPress = (session: PlanSession) => {
    router.push({
      pathname: "/plans/session/[sessionId]",
      params: { sessionId: session.id },
    });
  };

  if (sessions.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons
          name="calendar-outline"
          size={48}
          color={theme.colors.text.muted}
        />
        <Text style={[styles.emptyTitle, { color: theme.colors.text.primary }]}>
          No Active Plans
        </Text>
        <Text style={[styles.emptySubtitle, { color: theme.colors.text.muted }]}>
          Start a Bible reading plan from the Discover tab
        </Text>
      </View>
    );
  }

  const renderItem = ({ item }: ListRenderItemInfo<PlanSession>) => (
    <Pressable
      onPress={() => handleSessionPress(item)}
      style={({ pressed }) => [
        styles.sessionCard,
        {
          backgroundColor: theme.colors.background.secondary,
          borderColor: theme.colors.border,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <View style={styles.sessionInfo}>
        <Text style={[styles.planName, { color: theme.colors.text.primary }]}>
          {getPlanName(item.plan_id)}
        </Text>
        <View style={styles.progressRow}>
          <Text style={[styles.progressText, { color: theme.colors.text.muted }]}>
            Day {item.current_day}
          </Text>
          {item.status === "paused" && (
            <View style={[styles.statusBadge, { backgroundColor: theme.colors.background.primary }]}>
              <Text style={[styles.statusText, { color: theme.colors.text.muted }]}>
                Paused
              </Text>
            </View>
          )}
          {item.status === "completed" && (
            <View style={[styles.statusBadge, { backgroundColor: theme.colors.interactive.button.background }]}>
              <Text style={[styles.statusText, { color: theme.colors.text.primary }]}>
                Completed
              </Text>
            </View>
          )}
        </View>
      </View>
      <Ionicons
        name="chevron-forward"
        size={20}
        color={theme.colors.text.muted}
      />
    </Pressable>
  );

  return (
    <FlashList<PlanSession>
      data={sessions}
      {...flashListConfig.props}
      contentContainerStyle={styles.listContent}
      renderItem={renderItem}
    />
  );
});

export default MyPlansList;

const styles = StyleSheet.create({
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  sessionCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  sessionInfo: {
    flex: 1,
    gap: 4,
  },
  planName: {
    fontSize: 16,
    fontWeight: "600",
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  progressText: {
    fontSize: 13,
  },
  statusBadge: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "500",
  },
});
