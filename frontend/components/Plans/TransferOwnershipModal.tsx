/**
 * TransferOwnershipModal - Select a new owner when leaving a session
 * Shown when owner/last admin tries to leave without another admin
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
import { useRouter } from "expo-router";

import { useTheme } from "@/contexts/ThemeContext";
import { useUnifiedAuth } from "@/hooks/useUnifiedAuth";
import { useFlashListConfig } from "@/hooks/useFlashListConfig";
import AvatarWithLevel from "@/components/AvatarWithLevel";
import { planStore$ } from "@/state";
import {
  getEligibleOwnershipRecipients,
  transferOwnership,
  leaveSharedSession,
} from "@/services/planService";
import type { ParticipantWithProfile } from "@/state/planStore";

interface TransferOwnershipModalProps {
  visible: boolean;
  onClose: () => void;
  sessionId: string;
  onTransferComplete?: () => void;
}

export default function TransferOwnershipModal({
  visible,
  onClose,
  sessionId,
  onTransferComplete,
}: TransferOwnershipModalProps) {
  const { theme } = useTheme();
  const { user } = useUnifiedAuth();
  const router = useRouter();

  const [participants, setParticipants] = useState<ParticipantWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [transferring, setTransferring] = useState(false);

  const flashListConfig = useFlashListConfig({ estimatedItemSize: 72 });

  useEffect(() => {
    if (visible && user?.id) {
      loadParticipants();
    }
  }, [visible, sessionId, user?.id]);

  const loadParticipants = async () => {
    if (!user?.id) return;
    setLoading(true);
    setSelectedUserId(null);
    try {
      const data = await getEligibleOwnershipRecipients(sessionId, user.id);
      setParticipants(data);
    } catch (error) {
      console.error("Failed to load participants:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = useCallback((userId: string) => {
    setSelectedUserId(userId);
  }, []);

  const handleTransferAndLeave = async () => {
    if (!selectedUserId || !user?.id) return;

    const selectedParticipant = participants.find(p => p.user_id === selectedUserId);
    const displayName = selectedParticipant?.displayName || "this member";

    Alert.alert(
      "Transfer Ownership",
      `Transfer ownership to ${displayName} and leave the session?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Transfer & Leave",
          onPress: async () => {
            setTransferring(true);
            try {
              // Transfer ownership
              const transferResult = await transferOwnership(sessionId, selectedUserId);
              if (!transferResult.success) {
                Alert.alert("Error", transferResult.error || "Failed to transfer ownership");
                setTransferring(false);
                return;
              }

              // Leave session
              const leaveSuccess = await leaveSharedSession(sessionId, user.id);
              if (!leaveSuccess) {
                Alert.alert("Warning", "Ownership transferred but failed to leave. You are now an admin.");
                onTransferComplete?.();
                onClose();
                return;
              }

              // Success - remove from store and navigate back (transfer is only for shared sessions)
              planStore$.removeSharedSession(sessionId);
              onClose();
              router.back();
            } catch {
              Alert.alert("Error", "Failed to transfer ownership");
            } finally {
              setTransferring(false);
            }
          },
        },
      ]
    );
  };

  const handleTransferOnly = async () => {
    if (!selectedUserId) return;

    const selectedParticipant = participants.find(p => p.user_id === selectedUserId);
    const displayName = selectedParticipant?.displayName || "this member";

    Alert.alert(
      "Transfer Ownership",
      `Transfer ownership to ${displayName}? You will become an admin.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Transfer",
          onPress: async () => {
            setTransferring(true);
            try {
              const result = await transferOwnership(sessionId, selectedUserId);
              if (result.success) {
                onTransferComplete?.();
                onClose();
              } else {
                Alert.alert("Error", result.error || "Failed to transfer ownership");
              }
            } catch {
              Alert.alert("Error", "Failed to transfer ownership");
            } finally {
              setTransferring(false);
            }
          },
        },
      ]
    );
  };

  const renderParticipant = useCallback(({ item }: { item: ParticipantWithProfile }) => {
    const displayName = item.displayName || "Anonymous";
    const isSelected = item.user_id === selectedUserId;
    const isAdmin = item.role === 'admin';

    return (
      <Pressable
        onPress={() => handleSelect(item.user_id)}
        style={({ pressed }) => [
          styles.participantRow,
          {
            backgroundColor: isSelected
              ? theme.colors.interactive.button.background
              : theme.colors.background.secondary,
            borderColor: isSelected
              ? theme.colors.interactive.button.background
              : 'transparent',
          },
          pressed && !isSelected && styles.participantPressed,
        ]}
      >
        {/* Selection indicator */}
        <View style={[
          styles.radioOuter,
          {
            borderColor: isSelected
              ? theme.colors.text.primary
              : theme.colors.text.muted,
          }
        ]}>
          {isSelected && (
            <View style={[styles.radioInner, { backgroundColor: theme.colors.text.primary }]} />
          )}
        </View>

        {/* Avatar with Level Badge */}
        <AvatarWithLevel
          userId={item.user_id}
          displayName={displayName}
          size={40}
        />

        {/* Info */}
        <View style={styles.participantInfo}>
          <Text style={[
            styles.participantName,
            { color: isSelected ? theme.colors.text.primary : theme.colors.text.primary }
          ]}>
            {displayName}
          </Text>
          {isAdmin && (
            <View style={[styles.adminBadge, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
              <Ionicons name="shield-half" size={10} color={theme.colors.text.secondary} />
              <Text style={[styles.adminBadgeText, { color: theme.colors.text.secondary }]}>
                Admin
              </Text>
            </View>
          )}
        </View>
      </Pressable>
    );
  }, [theme, selectedUserId, handleSelect]);

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
            <Ionicons name="close" size={24} color={theme.colors.text.primary} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: theme.colors.text.primary }]}>
            Transfer Ownership
          </Text>
          <View style={styles.closeButton} />
        </View>

        {/* Content */}
        <View style={styles.content}>
          {/* Warning */}
          <View style={[styles.warningCard, { backgroundColor: '#FEF3C7' }]}>
            <Ionicons name="warning" size={24} color="#D97706" />
            <Text style={[styles.warningText, { color: '#92400E' }]}>
              You must assign a new owner before leaving. Select someone below to transfer ownership.
            </Text>
          </View>

          {/* Participants list */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.colors.text.muted} />
            </View>
          ) : participants.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={48} color={theme.colors.text.muted} />
              <Text style={[styles.emptyText, { color: theme.colors.text.muted }]}>
                No other members to transfer to
              </Text>
              <Text style={[styles.emptySubtext, { color: theme.colors.text.muted }]}>
                You can delete the session instead
              </Text>
            </View>
          ) : (
            <FlashList
              data={participants}
              renderItem={renderParticipant}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              extraData={selectedUserId}
              {...flashListConfig.props}
            />
          )}
        </View>

        {/* Footer */}
        {participants.length > 0 && (
          <View style={[styles.footer, { borderTopColor: theme.colors.border }]}>
            <Pressable
              onPress={handleTransferOnly}
              disabled={!selectedUserId || transferring}
              style={({ pressed }) => [
                styles.secondaryButton,
                { borderColor: theme.colors.border },
                pressed && styles.buttonPressed,
                (!selectedUserId || transferring) && styles.buttonDisabled,
              ]}
            >
              <Text style={[styles.secondaryButtonText, { color: theme.colors.text.primary }]}>
                Transfer Only
              </Text>
            </Pressable>

            <Pressable
              onPress={handleTransferAndLeave}
              disabled={!selectedUserId || transferring}
              style={({ pressed }) => [
                styles.primaryButton,
                { backgroundColor: theme.colors.interactive.button.background },
                pressed && styles.buttonPressed,
                (!selectedUserId || transferring) && styles.buttonDisabled,
              ]}
            >
              {transferring ? (
                <ActivityIndicator size="small" color={theme.colors.text.primary} />
              ) : (
                <>
                  <Ionicons name="exit-outline" size={18} color={theme.colors.text.primary} />
                  <Text style={[styles.primaryButtonText, { color: theme.colors.text.primary }]}>
                    Transfer & Leave
                  </Text>
                </>
              )}
            </Pressable>
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
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  warningCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 14,
    borderRadius: 12,
    marginBottom: 20,
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
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
    fontWeight: "600",
  },
  emptySubtext: {
    fontSize: 14,
  },
  listContent: {
    paddingBottom: 16,
  },
  participantRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    gap: 12,
    borderWidth: 2,
  },
  participantPressed: {
    opacity: 0.7,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  participantInfo: {
    flex: 1,
    gap: 4,
  },
  participantName: {
    fontSize: 16,
    fontWeight: "600",
  },
  adminBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  adminBadgeText: {
    fontSize: 11,
    fontWeight: "500",
  },
  footer: {
    flexDirection: "row",
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
  },
  secondaryButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: "600",
  },
  primaryButton: {
    flex: 1,
    flexDirection: "row",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: "600",
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
