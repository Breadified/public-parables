/**
 * PlanDiscoveryList - Browse and search available Bible reading plans
 * Groups plans by group_name and shows active badges
 */

import React, { useMemo } from "react";
import { View, Text, StyleSheet, Pressable, SectionList } from "react-native";
import { observer, useSelector } from "@legendapp/state/react";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { useTheme } from "@/contexts/ThemeContext";
import { filteredPlans$, planStore$ } from "@/state";
import type { BiblePlan } from "@/types/database";

interface PlanGroup {
  title: string;
  data: BiblePlan[];
}

const PlanDiscoveryList = observer(function PlanDiscoveryList() {
  const { theme } = useTheme();
  const router = useRouter();
  const plans = useSelector(filteredPlans$);
  const mySessions = useSelector(() => planStore$.mySessions.get());

  // Get set of plan IDs that user has active sessions for
  const activePlanIds = useMemo(() => {
    return new Set(mySessions.map((s: { plan_id: string }) => s.plan_id));
  }, [mySessions]);

  // Group plans by group_name
  const sections = useMemo((): PlanGroup[] => {
    const groups = new Map<string, BiblePlan[]>();

    for (const plan of plans) {
      const groupName = plan.group_name || "Other Plans";
      if (!groups.has(groupName)) {
        groups.set(groupName, []);
      }
      groups.get(groupName)!.push(plan);
    }

    // Convert to sections array, sorted by first plan's sort_order
    return Array.from(groups.entries())
      .sort((a, b) => {
        const aOrder = a[1][0]?.sort_order ?? 999;
        const bOrder = b[1][0]?.sort_order ?? 999;
        return aOrder - bOrder;
      })
      .map(([title, data]) => ({ title, data }));
  }, [plans]);

  const handlePlanPress = (plan: BiblePlan) => {
    router.push({
      pathname: "/plans/[planId]",
      params: { planId: plan.id },
    });
  };

  if (plans.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons
          name="compass-outline"
          size={48}
          color={theme.colors.text.muted}
        />
        <Text style={[styles.emptyTitle, { color: theme.colors.text.primary }]}>
          No Plans Available
        </Text>
        <Text style={[styles.emptySubtitle, { color: theme.colors.text.muted }]}>
          Bible reading plans will appear here once loaded
        </Text>
      </View>
    );
  }

  const renderItem = ({ item }: { item: BiblePlan }) => {
    const isActive = activePlanIds.has(item.id);

    return (
      <Pressable
        onPress={() => handlePlanPress(item)}
        style={({ pressed }) => [
          styles.planCard,
          {
            backgroundColor: theme.colors.background.secondary,
            borderColor: isActive ? theme.colors.accent : theme.colors.border,
            borderWidth: isActive ? 2 : 1,
            opacity: pressed ? 0.8 : 1,
          },
        ]}
      >
        <View style={styles.planHeader}>
          <Text
            style={[styles.planName, { color: theme.colors.text.primary }]}
            numberOfLines={2}
          >
            {item.name}
          </Text>
          {isActive && (
            <View
              style={[
                styles.activeBadge,
                { backgroundColor: theme.colors.accent },
              ]}
            >
              <Text style={styles.activeBadgeText}>Active</Text>
            </View>
          )}
        </View>
        <View style={styles.planMeta}>
          <View style={styles.metaItem}>
            <Ionicons
              name="calendar-outline"
              size={14}
              color={theme.colors.text.muted}
            />
            <Text style={[styles.metaText, { color: theme.colors.text.muted }]}>
              {item.duration_days} days
            </Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={20}
            color={theme.colors.text.muted}
          />
        </View>
      </Pressable>
    );
  };

  const renderSectionHeader = ({
    section,
  }: {
    section: PlanGroup;
  }) => (
    <View
      style={[
        styles.sectionHeader,
        { backgroundColor: theme.colors.background.primary },
      ]}
    >
      <Text
        style={[styles.sectionTitle, { color: theme.colors.text.primary }]}
      >
        {section.title}
      </Text>
      <Text style={[styles.sectionCount, { color: theme.colors.text.muted }]}>
        {section.data.length} {section.data.length === 1 ? "plan" : "plans"}
      </Text>
    </View>
  );

  return (
    <SectionList
      sections={sections}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      renderSectionHeader={renderSectionHeader}
      contentContainerStyle={styles.listContent}
      stickySectionHeadersEnabled={false}
    />
  );
});

export default PlanDiscoveryList;

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
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 4,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  sectionCount: {
    fontSize: 13,
  },
  planCard: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 10,
    gap: 6,
  },
  planHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  planName: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 20,
  },
  activeBadge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  activeBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#fff",
  },
  planMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 2,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontSize: 12,
  },
});
