/**
 * SharedSessionsList - Displays shared plan sessions user is participating in
 */

import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { observer, useSelector } from "@legendapp/state/react";
import { FlashList, ListRenderItemInfo } from "@shopify/flash-list";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { useTheme } from "@/contexts/ThemeContext";
import { activeSharedSessions$ } from "@/state";
import { useFlashListConfig } from "@/hooks/useFlashListConfig";
import AvatarWithLevel from "@/components/AvatarWithLevel";
import type { SharedSessionWithDetails } from "@/state/planStore";

const SharedSessionsList = observer(function SharedSessionsList() {
  const { theme } = useTheme();
  const router = useRouter();
  const sharedSessions = useSelector(activeSharedSessions$);

  const flashListConfig = useFlashListConfig({
    estimatedItemSize: 100,
  });

  const handleSessionPress = (session: SharedSessionWithDetails) => {
    router.push({
      pathname: "/plans/session/[sessionId]",
      params: { sessionId: session.id },
    });
  };

  const handleJoinSession = () => {
    router.push("/plans/invite" as any);
  };

  const handleDiscoverPlans = () => {
    // Switch to discover tab
    router.push("/plans?tab=discover" as any);
  };

  if (sharedSessions.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons
          name="people-outline"
          size={48}
          color={theme.colors.text.muted}
        />
        <Text style={[styles.emptyTitle, { color: theme.colors.text.primary }]}>
          No Shared Sessions
        </Text>
        <Text
          style={[styles.emptySubtitle, { color: theme.colors.text.muted }]}
        >
          Join a shared session with an invite code, or start a new Bible
          reading plan under the Discover tab
        </Text>
        <View style={styles.emptyActions}>
          <Pressable
            onPress={handleJoinSession}
            style={({ pressed }) => [
              styles.actionButton,
              {
                backgroundColor: theme.colors.interactive.button.background,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <Ionicons
              name="enter-outline"
              size={18}
              color={theme.colors.text.primary}
            />
            <Text
              style={[
                styles.actionButtonText,
                { color: theme.colors.text.primary },
              ]}
            >
              Enter Invite Code
            </Text>
          </Pressable>
          <Pressable
            onPress={handleDiscoverPlans}
            style={({ pressed }) => [
              styles.actionButton,
              styles.secondaryButton,
              {
                borderColor: theme.colors.border,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <Ionicons
              name="compass-outline"
              size={18}
              color={theme.colors.text.secondary}
            />
            <Text
              style={[
                styles.actionButtonText,
                { color: theme.colors.text.secondary },
              ]}
            >
              Discover Plans
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const renderItem = ({
    item,
  }: ListRenderItemInfo<SharedSessionWithDetails>) => (
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
        <Text
          style={[styles.sessionName, { color: theme.colors.text.primary }]}
        >
          {item.shared_name}
        </Text>
        <View style={styles.sessionMeta}>
          {/* Day progress */}
          <Text style={[styles.metaText, { color: theme.colors.text.muted }]}>
            Day {item.current_day || 1}
          </Text>

          {/* Separator dot */}
          <Text style={[styles.metaDot, { color: theme.colors.text.muted }]}>
            •
          </Text>

          {/* Participant count */}
          <View style={styles.metaItem}>
            <Ionicons name="people" size={14} color={theme.colors.text.muted} />
            <Text style={[styles.metaText, { color: theme.colors.text.muted }]}>
              {item.participant_count || 1}
            </Text>
          </View>
        </View>

        {/* Started by section */}
        <View style={styles.ownerRow}>
          <AvatarWithLevel
            userId={item.user_id}
            displayName={item.owner_display_name || "Anonymous"}
            size={24}
          />
          <Text style={[styles.ownerText, { color: theme.colors.text.muted }]}>
            Started by {item.owner_display_name || "Anonymous"}
          </Text>
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
    <FlashList<SharedSessionWithDetails>
      data={sharedSessions}
      {...flashListConfig.props}
      contentContainerStyle={styles.listContent}
      renderItem={renderItem}
    />
  );
});

export default SharedSessionsList;

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
  emptyActions: {
    flexDirection: "column",
    alignItems: "center",
    gap: 12,
    marginTop: 20,
    width: "100%",
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 10,
    minWidth: 200,
  },
  secondaryButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: "600",
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
    gap: 6,
  },
  sessionName: {
    fontSize: 16,
    fontWeight: "600",
  },
  sessionMeta: {
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
