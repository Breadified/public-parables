/**
 * MembersListModal - View and manage session members
 * Owner can promote/demote admins, admins can remove members
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Modal,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";

import { useTheme } from "@/contexts/ThemeContext";
import { useUnifiedAuth } from "@/hooks/useUnifiedAuth";
import { useFlashListConfig } from "@/hooks/useFlashListConfig";
import AvatarWithLevel from "@/components/AvatarWithLevel";
import {
  fetchSessionParticipants,
  promoteToAdmin,
  demoteFromAdmin,
  removeMember,
} from "@/services/planService";
import type { ParticipantWithProfile } from "@/state/planStore";

interface MembersListModalProps {
  visible: boolean;
  onClose: () => void;
  sessionId: string;
  userRole: 'owner' | 'admin' | 'member' | null;
}

export default function MembersListModal({
  visible,
  onClose,
  sessionId,
  userRole,
}: MembersListModalProps) {
  const { theme } = useTheme();
  const { user } = useUnifiedAuth();

  const [participants, setParticipants] = useState<ParticipantWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const flashListConfig = useFlashListConfig({ estimatedItemSize: 72 });

  const isOwner = userRole === 'owner';
  const isAdmin = userRole === 'owner' || userRole === 'admin';

  useEffect(() => {
    if (visible) {
      loadParticipants();
    }
  }, [visible, sessionId]);

  const loadParticipants = async () => {
    setLoading(true);
    try {
      const data = await fetchSessionParticipants(sessionId);
      // Sort: owner first, then admins, then members
      const sorted = data.sort((a, b) => {
        const roleOrder = { owner: 0, admin: 1, member: 2 };
        return roleOrder[a.role] - roleOrder[b.role];
      });
      setParticipants(sorted);
    } catch (error) {
      console.error("Failed to load participants:", error);
    } finally {
      setLoading(false);
    }
  };

  const handlePromote = useCallback(async (targetUserId: string, displayName: string) => {
    Alert.alert(
      "Promote to Admin",
      `Make ${displayName} an admin? They will be able to manage members.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Promote",
          onPress: async () => {
            setActionLoading(targetUserId);
            try {
              const result = await promoteToAdmin(sessionId, targetUserId);
              if (result.success) {
                await loadParticipants();
              } else {
                Alert.alert("Error", result.error || "Failed to promote member");
              }
            } catch {
              Alert.alert("Error", "Failed to promote member");
            } finally {
              setActionLoading(null);
            }
          },
        },
      ]
    );
  }, [sessionId]);

  const handleDemote = useCallback(async (targetUserId: string, displayName: string) => {
    Alert.alert(
      "Remove Admin",
      `Remove admin rights from ${displayName}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove Admin",
          style: "destructive",
          onPress: async () => {
            setActionLoading(targetUserId);
            try {
              const result = await demoteFromAdmin(sessionId, targetUserId);
              if (result.success) {
                await loadParticipants();
              } else {
                Alert.alert("Error", result.error || "Failed to demote admin");
              }
            } catch {
              Alert.alert("Error", "Failed to demote admin");
            } finally {
              setActionLoading(null);
            }
          },
        },
      ]
    );
  }, [sessionId]);

  const handleRemove = useCallback(async (targetUserId: string, displayName: string) => {
    Alert.alert(
      "Remove Member",
      `Remove ${displayName} from this session?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            setActionLoading(targetUserId);
            try {
              const result = await removeMember(sessionId, targetUserId);
              if (result.success) {
                await loadParticipants();
              } else {
                Alert.alert("Error", result.error || "Failed to remove member");
              }
            } catch {
              Alert.alert("Error", "Failed to remove member");
            } finally {
              setActionLoading(null);
            }
          },
        },
      ]
    );
  }, [sessionId]);

  const renderParticipant = useCallback(({ item }: { item: ParticipantWithProfile }) => {
    const isCurrentUser = item.user_id === user?.id;
    const isItemOwner = item.role === 'owner';
    const isItemAdmin = item.role === 'admin';
    const displayName = item.displayName || "Anonymous";

    // Determine what actions are available
    const canPromote = isOwner && item.role === 'member';
    const canDemote = isOwner && isItemAdmin;
    const canRemove = isAdmin && item.role === 'member' && !isCurrentUser;

    const showActions = (canPromote || canDemote || canRemove) && actionLoading !== item.user_id;
    const isLoadingThis = actionLoading === item.user_id;

    return (
      <View
        style={[
          styles.participantRow,
          { backgroundColor: theme.colors.background.secondary },
        ]}
      >
        {/* Avatar with Level Badge */}
        <AvatarWithLevel
          userId={item.user_id}
          displayName={displayName}
          size={40}
        />

        {/* Info */}
        <View style={styles.participantInfo}>
          <View style={styles.nameRow}>
            <Text style={[styles.participantName, { color: theme.colors.text.primary }]}>
              {displayName}
            </Text>
            {isCurrentUser && (
              <Text style={[styles.youBadge, { color: theme.colors.text.muted }]}>
                (you)
              </Text>
            )}
          </View>
          <View style={styles.roleContainer}>
            {isItemOwner && (
              <View style={[styles.roleBadge, { backgroundColor: theme.colors.accent + '20' }]}>
                <Ionicons name="shield" size={12} color={theme.colors.accent} />
                <Text style={[styles.roleBadgeText, { color: theme.colors.accent }]}>
                  Owner
                </Text>
              </View>
            )}
            {isItemAdmin && (
              <View style={[styles.roleBadge, { backgroundColor: theme.colors.interactive.button.background + '30' }]}>
                <Ionicons name="shield-half" size={12} color={theme.colors.text.secondary} />
                <Text style={[styles.roleBadgeText, { color: theme.colors.text.secondary }]}>
                  Admin
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Actions */}
        {isLoadingThis ? (
          <ActivityIndicator size="small" color={theme.colors.text.muted} />
        ) : showActions ? (
          <View style={styles.actions}>
            {canPromote && (
              <Pressable
                onPress={() => handlePromote(item.user_id, displayName)}
                style={({ pressed }) => [
                  styles.actionButton,
                  { backgroundColor: theme.colors.interactive.button.background },
                  pressed && styles.actionPressed,
                ]}
              >
                <Ionicons name="arrow-up" size={16} color={theme.colors.text.primary} />
              </Pressable>
            )}
            {canDemote && (
              <Pressable
                onPress={() => handleDemote(item.user_id, displayName)}
                style={({ pressed }) => [
                  styles.actionButton,
                  { backgroundColor: theme.colors.background.elevated },
                  pressed && styles.actionPressed,
                ]}
              >
                <Ionicons name="arrow-down" size={16} color={theme.colors.text.secondary} />
              </Pressable>
            )}
            {canRemove && (
              <Pressable
                onPress={() => handleRemove(item.user_id, displayName)}
                style={({ pressed }) => [
                  styles.actionButton,
                  { backgroundColor: '#E53E3E20' },
                  pressed && styles.actionPressed,
                ]}
              >
                <Ionicons name="close" size={16} color="#E53E3E" />
              </Pressable>
            )}
          </View>
        ) : null}
      </View>
    );
  }, [theme, user?.id, isOwner, isAdmin, actionLoading, handlePromote, handleDemote, handleRemove]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.colors.background.primary }]}
        edges={["top", "bottom"]}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <Ionicons name="chevron-back" size={24} color={theme.colors.text.primary} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: theme.colors.text.primary }]}>
            Members ({participants.length})
          </Text>
          <View style={styles.closeButton} />
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.text.muted} />
          </View>
        ) : participants.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={48} color={theme.colors.text.muted} />
            <Text style={[styles.emptyText, { color: theme.colors.text.muted }]}>
              No members found
            </Text>
          </View>
        ) : (
          <FlashList
            data={participants}
            renderItem={renderParticipant}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            {...flashListConfig.props}
          />
        )}

        {/* Legend */}
        {!loading && participants.length > 0 && isOwner && (
          <View style={[styles.legend, { borderTopColor: theme.colors.border }]}>
            <View style={styles.legendRow}>
              <View style={[styles.legendIcon, { backgroundColor: theme.colors.interactive.button.background }]}>
                <Ionicons name="arrow-up" size={12} color={theme.colors.text.primary} />
              </View>
              <Text style={[styles.legendText, { color: theme.colors.text.muted }]}>
                Promote to admin
              </Text>
            </View>
            <View style={styles.legendRow}>
              <View style={[styles.legendIcon, { backgroundColor: theme.colors.background.elevated }]}>
                <Ionicons name="arrow-down" size={12} color={theme.colors.text.secondary} />
              </View>
              <Text style={[styles.legendText, { color: theme.colors.text.muted }]}>
                Remove admin rights
              </Text>
            </View>
            <View style={styles.legendRow}>
              <View style={[styles.legendIcon, { backgroundColor: '#E53E3E20' }]}>
                <Ionicons name="close" size={12} color="#E53E3E" />
              </View>
              <Text style={[styles.legendText, { color: theme.colors.text.muted }]}>
                Remove from session
              </Text>
            </View>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "600",
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
  },
  listContent: {
    padding: 16,
  },
  participantRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    gap: 12,
  },
  participantInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  participantName: {
    fontSize: 16,
    fontWeight: "600",
  },
  youBadge: {
    fontSize: 13,
  },
  roleContainer: {
    flexDirection: "row",
    gap: 6,
    marginTop: 4,
  },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  actions: {
    flexDirection: "row",
    gap: 8,
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  actionPressed: {
    opacity: 0.7,
  },
  legend: {
    padding: 16,
    borderTopWidth: 1,
    gap: 10,
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  legendIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  legendText: {
    fontSize: 13,
  },
});
