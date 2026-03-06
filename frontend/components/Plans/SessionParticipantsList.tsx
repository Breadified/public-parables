/**
 * SessionParticipantsList - Shows participants in a shared session
 */

import React from "react";
import { View, Text, StyleSheet, Pressable, Image } from "react-native";
import { observer, useSelector } from "@legendapp/state/react";
import { FlashList, ListRenderItemInfo } from "@shopify/flash-list";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@/contexts/ThemeContext";
import { planStore$, activeParticipantsCount$ } from "@/state";
import { useFlashListConfig } from "@/hooks/useFlashListConfig";
import type { ParticipantWithProfile } from "@/state/planStore";

interface SessionParticipantsListProps {
  maxDays: number;
}

const SessionParticipantsList = observer(function SessionParticipantsList({
  maxDays,
}: SessionParticipantsListProps) {
  const { theme } = useTheme();
  const participants = useSelector(() => planStore$.participants.get());
  const participantCount = useSelector(activeParticipantsCount$);
  const loading = useSelector(() => planStore$.participantsLoading.get());

  const flashListConfig = useFlashListConfig({
    estimatedItemSize: 64,
  });

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={[styles.loadingText, { color: theme.colors.text.muted }]}>
          Loading participants...
        </Text>
      </View>
    );
  }

  if (participants.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons
          name="person-outline"
          size={40}
          color={theme.colors.text.muted}
        />
        <Text style={[styles.emptyText, { color: theme.colors.text.muted }]}>
          No participants yet
        </Text>
      </View>
    );
  }

  const renderItem = ({ item }: ListRenderItemInfo<ParticipantWithProfile>) => {
    const progress = Math.round((item.current_day / maxDays) * 100);
    const isOwner = item.role === "owner";

    return (
      <View
        style={[
          styles.participantCard,
          { backgroundColor: theme.colors.background.secondary },
        ]}
      >
        {/* Avatar */}
        <View
          style={[
            styles.avatar,
            { backgroundColor: theme.colors.background.primary },
          ]}
        >
          {item.avatarUrl ? (
            <Image source={{ uri: item.avatarUrl }} style={styles.avatarImage} />
          ) : (
            <Ionicons
              name="person"
              size={22}
              color={theme.colors.text.muted}
            />
          )}
        </View>

        {/* Info */}
        <View style={styles.participantInfo}>
          <View style={styles.nameRow}>
            <Text style={[styles.participantName, { color: theme.colors.text.primary }]}>
              {item.displayName || "Anonymous"}
            </Text>
            {isOwner && (
              <View
                style={[
                  styles.ownerBadge,
                  { backgroundColor: theme.colors.interactive.button.background },
                ]}
              >
                <Text style={[styles.ownerText, { color: theme.colors.text.primary }]}>
                  Owner
                </Text>
              </View>
            )}
          </View>

          {/* Progress */}
          <View style={styles.progressRow}>
            <Text style={[styles.progressText, { color: theme.colors.text.muted }]}>
              Day {item.current_day} of {maxDays}
            </Text>
            <Text style={[styles.progressPercent, { color: theme.colors.text.secondary }]}>
              {progress}%
            </Text>
          </View>

          {/* Progress bar */}
          <View
            style={[
              styles.progressTrack,
              { backgroundColor: theme.colors.background.primary },
            ]}
          >
            <View
              style={[
                styles.progressFill,
                {
                  backgroundColor: theme.colors.interactive.button.background,
                  width: `${progress}%`,
                },
              ]}
            />
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: theme.colors.text.primary }]}>
          Participants
        </Text>
        <View
          style={[
            styles.countBadge,
            { backgroundColor: theme.colors.background.secondary },
          ]}
        >
          <Text style={[styles.countText, { color: theme.colors.text.secondary }]}>
            {participantCount}
          </Text>
        </View>
      </View>

      <FlashList<ParticipantWithProfile>
        data={participants}
        {...flashListConfig.props}
        renderItem={renderItem}
      />
    </View>
  );
});

export default SessionParticipantsList;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  loadingText: {
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  countBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  countText: {
    fontSize: 13,
    fontWeight: "600",
  },
  participantCard: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 14,
    borderRadius: 12,
    gap: 14,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  participantInfo: {
    flex: 1,
    gap: 6,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  participantName: {
    fontSize: 15,
    fontWeight: "600",
  },
  ownerBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  ownerText: {
    fontSize: 11,
    fontWeight: "600",
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  progressText: {
    fontSize: 12,
  },
  progressPercent: {
    fontSize: 12,
    fontWeight: "500",
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
  },
});
