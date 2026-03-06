/**
 * UnifiedPlansList - Displays both personal plan sessions and shared sessions in one list
 */

import React, { useMemo } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { observer, useSelector } from "@legendapp/state/react";
import { FlashList, ListRenderItemInfo } from "@shopify/flash-list";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { useTheme } from "@/contexts/ThemeContext";
import { useUnifiedAuth } from "@/hooks/useUnifiedAuth";
import { activeSessions$, activeSharedSessions$, planStore$ } from "@/state";
import { useFlashListConfig } from "@/hooks/useFlashListConfig";
import AvatarWithLevel from "@/components/AvatarWithLevel";
import { calculatePlanDay } from "@/utils/dateFormatters";
import type { PlanSession, BiblePlan } from "@/types/database";
import type { SharedSessionWithDetails } from "@/state/planStore";

// Unified item type that can represent either a personal or shared session
interface UnifiedPlanItem {
  id: string;
  type: 'personal' | 'shared';
  name: string;
  currentDay: number;
  status: string;
  // Shared session specific
  participantCount?: number;
  ownerUserId?: string;
  ownerDisplayName?: string;
  // Original data
  planSessionId: string;
  planId: string;
}

const UnifiedPlansList = observer(function UnifiedPlansList() {
  const { theme } = useTheme();
  const router = useRouter();
  const { user } = useUnifiedAuth();
  const personalSessions = useSelector(activeSessions$);
  const sharedSessions = useSelector(activeSharedSessions$);
  const availablePlans = useSelector(planStore$.availablePlans);

  const flashListConfig = useFlashListConfig({
    estimatedItemSize: 100,
  });

  // Create maps for plan_id -> name and plan_id -> duration for quick lookup
  const planNameMap = useMemo(() => {
    const map = new Map<string, string>();
    availablePlans.forEach((plan: BiblePlan) => {
      map.set(plan.id, plan.name);
    });
    return map;
  }, [availablePlans]);

  const planDurationMap = useMemo(() => {
    const map = new Map<string, number>();
    availablePlans.forEach((plan: BiblePlan) => {
      map.set(plan.id, plan.duration_days);
    });
    return map;
  }, [availablePlans]);

  // Combine sessions, avoiding duplicates
  // - Personal sessions: all sessions I own (show shared indicator if is_shared=true)
  // - Shared sessions: only sessions I joined but DON'T own
  // For the list, we show "today's" calculated day (based on started_at)
  const unifiedItems = useMemo((): UnifiedPlanItem[] => {
    const items: UnifiedPlanItem[] = [];
    const addedSessionIds = new Set<string>();

    // First add all MY sessions (sessions I own)
    personalSessions.forEach((session: PlanSession) => {
      addedSessionIds.add(session.id);

      // Calculate "today's" day based on started_at and plan duration
      const maxDays = planDurationMap.get(session.plan_id);
      const todayDay = calculatePlanDay(session.started_at, maxDays);

      // Check if this session is shared (has enriched data in sharedSessions)
      const sharedInfo = sharedSessions.find(
        (s: SharedSessionWithDetails) => s.id === session.id
      );

      if (session.is_shared && sharedInfo) {
        // My session that I've shared - show as shared with participant info
        items.push({
          id: `shared-${session.id}`,
          type: 'shared',
          name: session.shared_name || planNameMap.get(session.plan_id) || session.plan_id,
          currentDay: todayDay,
          status: session.status,
          participantCount: sharedInfo.participant_count,
          ownerUserId: session.user_id,
          ownerDisplayName: sharedInfo.owner_display_name,
          planSessionId: session.id,
          planId: session.plan_id,
        });
      } else {
        // Personal session (not shared)
        items.push({
          id: `personal-${session.id}`,
          type: 'personal',
          name: planNameMap.get(session.plan_id) || session.plan_id,
          currentDay: todayDay,
          status: session.status,
          planSessionId: session.id,
          planId: session.plan_id,
        });
      }
    });

    // Add shared sessions I joined but DON'T own (avoid duplicates)
    sharedSessions.forEach((session: SharedSessionWithDetails) => {
      // Skip if already added (I own this session)
      if (addedSessionIds.has(session.id)) return;

      // Skip if I'm the owner (shouldn't happen but safety check)
      if (session.user_id === user?.id) return;

      // Calculate "today's" day based on started_at and plan duration
      const maxDays = planDurationMap.get(session.plan_id);
      const todayDay = calculatePlanDay(session.started_at, maxDays);

      items.push({
        id: `shared-${session.id}`,
        type: 'shared',
        name: session.shared_name || 'Shared Plan',
        currentDay: todayDay,
        status: session.status,
        participantCount: session.participant_count,
        ownerUserId: session.user_id,
        ownerDisplayName: session.owner_display_name,
        planSessionId: session.id,
        planId: session.plan_id,
      });
    });

    return items;
  }, [personalSessions, sharedSessions, planNameMap, planDurationMap, user?.id]);

  const handleItemPress = (item: UnifiedPlanItem) => {
    router.push({
      pathname: "/plans/session/[sessionId]",
      params: { sessionId: item.planSessionId },
    });
  };

  const handleJoinSession = () => {
    router.push("/plans/invite" as any);
  };

  // Header component with invite button (always shown)
  const ListHeader = () => (
    <Pressable
      onPress={handleJoinSession}
      style={({ pressed }) => [
        styles.inviteButton,
        {
          backgroundColor: theme.colors.background.secondary,
          borderColor: theme.colors.border,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <View style={styles.inviteButtonContent}>
        <Ionicons name="enter-outline" size={20} color={theme.colors.text.primary} />
        <Text style={[styles.inviteButtonText, { color: theme.colors.text.primary }]}>
          Enter Invite Code
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.colors.text.muted} />
    </Pressable>
  );

  // Empty state (shown below header when no plans)
  const EmptyComponent = () => (
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
        Start a Bible reading plan from the Discover tab, or join a shared session
      </Text>
    </View>
  );

  const renderItem = ({ item }: ListRenderItemInfo<UnifiedPlanItem>) => (
    <Pressable
      onPress={() => handleItemPress(item)}
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
          {item.name}
        </Text>
        <View style={styles.metaRow}>
          {/* Day progress */}
          <Text style={[styles.metaText, { color: theme.colors.text.muted }]}>
            Day {item.currentDay}
          </Text>

          {/* Status badge for personal sessions */}
          {item.type === 'personal' && item.status === "paused" && (
            <>
              <Text style={[styles.metaDot, { color: theme.colors.text.muted }]}>•</Text>
              <View style={[styles.statusBadge, { backgroundColor: theme.colors.background.primary }]}>
                <Text style={[styles.statusText, { color: theme.colors.text.muted }]}>
                  Paused
                </Text>
              </View>
            </>
          )}
          {item.type === 'personal' && item.status === "completed" && (
            <>
              <Text style={[styles.metaDot, { color: theme.colors.text.muted }]}>•</Text>
              <View style={[styles.statusBadge, { backgroundColor: theme.colors.interactive.button.background }]}>
                <Text style={[styles.statusText, { color: theme.colors.text.primary }]}>
                  Completed
                </Text>
              </View>
            </>
          )}

          {/* Participant count for shared sessions */}
          {item.type === 'shared' && (
            <>
              <Text style={[styles.metaDot, { color: theme.colors.text.muted }]}>•</Text>
              <View style={styles.metaItem}>
                <Ionicons
                  name="people"
                  size={14}
                  color={theme.colors.text.muted}
                />
                <Text style={[styles.metaText, { color: theme.colors.text.muted }]}>
                  {item.participantCount || 1}
                </Text>
              </View>
            </>
          )}
        </View>

        {/* Started by section for shared sessions */}
        {item.type === 'shared' && item.ownerUserId && (
          <View style={styles.ownerRow}>
            <AvatarWithLevel
              userId={item.ownerUserId}
              displayName={item.ownerDisplayName || "Anonymous"}
              size={24}
            />
            <Text style={[styles.ownerText, { color: theme.colors.text.muted }]}>
              Started by {item.ownerDisplayName || "Anonymous"}
            </Text>
          </View>
        )}
      </View>
      <Ionicons
        name="chevron-forward"
        size={20}
        color={theme.colors.text.muted}
      />
    </Pressable>
  );

  return (
    <FlashList<UnifiedPlanItem>
      data={unifiedItems}
      {...flashListConfig.props}
      contentContainerStyle={styles.listContent}
      renderItem={renderItem}
      ListHeaderComponent={ListHeader}
      ListEmptyComponent={EmptyComponent}
    />
  );
});

export default UnifiedPlansList;

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
  joinButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginTop: 16,
  },
  joinButtonText: {
    fontSize: 15,
    fontWeight: "600",
  },
  inviteButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  inviteButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  inviteButtonText: {
    fontSize: 15,
    fontWeight: "500",
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
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontSize: 13,
  },
  metaDot: {
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
  ownerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  ownerText: {
    fontSize: 12,
  },
});
