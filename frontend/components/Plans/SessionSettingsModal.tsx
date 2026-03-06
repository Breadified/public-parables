/**
 * SessionSettingsModal - Manage session settings
 * Options: Share, Manage Members, Leave, Delete
 */

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Modal,
  Alert,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { useTheme } from "@/contexts/ThemeContext";
import { useUnifiedAuth } from "@/hooks/useUnifiedAuth";
import { planStore$, planReminderPreferences$ } from "@/state";
import { useSelector } from "@legendapp/state/react";
import {
  getUserSessionRole,
  canUserLeaveSession,
  leaveSharedSession,
  deleteSession,
} from "@/services/planService";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import type { PlanSession } from "@/types/database";

import ShareSessionModal from "./ShareSessionModal";
import MembersListModal from "./MembersListModal";
import TransferOwnershipModal from "./TransferOwnershipModal";
import { TimePickerModal } from "./TimePickerModal";
import { updatePlanReminderTime } from "@/services/planReminderService";

interface SessionSettingsModalProps {
  visible: boolean;
  onClose: () => void;
  session: PlanSession;
  planName: string;
}

export default function SessionSettingsModal({
  visible,
  onClose,
  session,
  planName,
}: SessionSettingsModalProps) {
  const { theme } = useTheme();
  const { user } = useUnifiedAuth();
  const router = useRouter();

  const [userRole, setUserRole] = useState<'owner' | 'admin' | 'member' | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Plan reminder preferences
  const reminderPrefs = useSelector(planReminderPreferences$);
  const [showReminderTimePicker, setShowReminderTimePicker] = useState(false);

  // Sub-modals
  const [showShareModal, setShowShareModal] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);

  // Confirmation modals
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const isShared = session.is_shared;
  const isOwner = userRole === 'owner' || session.user_id === user?.id;
  const isAdmin = userRole === 'owner' || userRole === 'admin';

  // Load user's role
  useEffect(() => {
    if (visible && user?.id && session.is_shared) {
      loadUserRole();
    } else if (!session.is_shared) {
      // Personal session - user is always owner
      setUserRole('owner');
      setLoading(false);
    }
  }, [visible, user?.id, session.id, session.is_shared]);

  const loadUserRole = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const role = await getUserSessionRole(session.id, user.id);
      setUserRole(role);
    } catch (error) {
      console.error("Failed to load role:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = () => {
    setShowShareModal(true);
  };

  const handleManageMembers = () => {
    setShowMembersModal(true);
  };

  const handleLeave = async () => {
    if (!user?.id) return;

    // Check if can leave
    const canLeave = await canUserLeaveSession(session.id, user.id);

    if (canLeave.needsTransfer) {
      // Show transfer modal
      setShowTransferModal(true);
      return;
    }

    if (!canLeave.canLeave) {
      setErrorMessage(canLeave.reason || "Unable to leave session");
      setShowErrorModal(true);
      return;
    }

    // On iOS, use native Alert because transparent Modal doesn't layer well over pageSheet
    if (Platform.OS === 'ios') {
      Alert.alert(
        "Leave Session",
        "Are you sure you want to leave this session? You can rejoin with an invite code.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Leave", style: "destructive", onPress: confirmLeave }
        ]
      );
    } else {
      setShowLeaveConfirm(true);
    }
  };

  const confirmLeave = async () => {
    if (!user?.id) return;

    setShowLeaveConfirm(false);
    setActionLoading(true);
    try {
      const success = await leaveSharedSession(session.id, user.id);
      if (success) {
        // Leave is only for shared sessions
        planStore$.removeSharedSession(session.id);
        onClose();
        router.back();
      } else {
        setErrorMessage("Failed to leave session");
        setShowErrorModal(true);
      }
    } catch {
      setErrorMessage("Failed to leave session");
      setShowErrorModal(true);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = () => {
    if (!user?.id) return;

    // On iOS, use native Alert because transparent Modal doesn't layer well over pageSheet
    if (Platform.OS === 'ios') {
      Alert.alert(
        "Delete Session",
        isShared
          ? "This will permanently delete the session for all members. This cannot be undone."
          : "Are you sure you want to delete this reading plan? This cannot be undone.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Delete", style: "destructive", onPress: confirmDelete }
        ]
      );
    } else {
      setShowDeleteConfirm(true);
    }
  };

  const confirmDelete = async () => {
    if (!user?.id) return;

    setShowDeleteConfirm(false);
    setActionLoading(true);
    try {
      const result = await deleteSession(session.id, user.id);
      console.log('[SessionSettings] deleteSession result:', result);
      if (result.success) {
        console.log('[SessionSettings] Removing from store...');
        // Owner always has the session in mySessions, so soft delete there
        // (removeSharedSession is for participants who joined, not owners)
        planStore$.softDeleteSession(session.id);
        console.log('[SessionSettings] Calling onClose...');
        onClose();
        console.log('[SessionSettings] Calling router.back...');
        router.back();
        console.log('[SessionSettings] Delete complete');
      } else {
        setErrorMessage(result.error || "Failed to delete session");
        setShowErrorModal(true);
      }
    } catch (err) {
      console.error('[SessionSettings] confirmDelete error:', err);
      setErrorMessage("Failed to delete session");
      setShowErrorModal(true);
    } finally {
      setActionLoading(false);
    }
  };

  const handleTransferComplete = () => {
    setShowTransferModal(false);
    // Reload role after transfer
    loadUserRole();
  };

  const handleReminderTimeConfirm = async (hour: number, minute: number) => {
    setShowReminderTimePicker(false);
    await updatePlanReminderTime(hour, minute);
  };

  // Format time for display
  const formatTime = (hour: number, minute: number): string => {
    const period = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 || 12;
    const displayMinute = String(minute).padStart(2, "0");
    return `${displayHour}:${displayMinute} ${period}`;
  };

  const handleClose = () => {
    setShowShareModal(false);
    setShowMembersModal(false);
    setShowTransferModal(false);
    setShowLeaveConfirm(false);
    setShowDeleteConfirm(false);
    setShowErrorModal(false);
    onClose();
  };

  return (
    <>
      <Modal
        visible={visible && !showShareModal && !showMembersModal && !showTransferModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleClose}
      >
        <SafeAreaView
          style={[styles.container, { backgroundColor: theme.colors.background.primary }]}
          edges={["top", "bottom"]}
        >
          {/* Header */}
          <View style={styles.header}>
            <Pressable onPress={handleClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={theme.colors.text.primary} />
            </Pressable>
            <Text style={[styles.headerTitle, { color: theme.colors.text.primary }]}>
              Session Settings
            </Text>
            <View style={styles.closeButton} />
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.colors.text.muted} />
            </View>
          ) : (
            <View style={styles.content}>
              {/* Icon */}
              <View
                style={[
                  styles.iconContainer,
                  { backgroundColor: theme.colors.background.secondary },
                ]}
              >
                <Ionicons name="settings" size={40} color={theme.colors.text.primary} />
              </View>

              {/* Session Info */}
              <Text style={[styles.sessionName, { color: theme.colors.text.primary }]}>
                {session.shared_name || planName}
              </Text>
              <View style={styles.roleRow}>
                <View
                  style={[
                    styles.roleBadge,
                    { backgroundColor: theme.colors.background.secondary },
                  ]}
                >
                  <Ionicons
                    name={isOwner ? "shield" : isAdmin ? "shield-half" : "person"}
                    size={14}
                    color={theme.colors.text.secondary}
                  />
                  <Text style={[styles.roleText, { color: theme.colors.text.secondary }]}>
                    {isOwner ? "Owner" : isAdmin ? "Admin" : "Member"}
                  </Text>
                </View>
                {isShared && (
                  <View
                    style={[
                      styles.roleBadge,
                      { backgroundColor: theme.colors.background.secondary },
                    ]}
                  >
                    <Ionicons name="people" size={14} color={theme.colors.text.secondary} />
                    <Text style={[styles.roleText, { color: theme.colors.text.secondary }]}>
                      Shared
                    </Text>
                  </View>
                )}
              </View>

              {/* Options */}
              <View style={styles.optionsList}>
                {/* Share (only if owner and is_shared or want to share) */}
                <Pressable
                  onPress={handleShare}
                  style={({ pressed }) => [
                    styles.optionRow,
                    { backgroundColor: theme.colors.background.secondary },
                    pressed && styles.optionPressed,
                  ]}
                >
                  <View style={styles.optionLeft}>
                    <Ionicons name="share-social" size={22} color={theme.colors.text.primary} />
                    <View style={styles.optionText}>
                      <Text style={[styles.optionTitle, { color: theme.colors.text.primary }]}>
                        {isShared ? "Share Session" : "Share with Friends"}
                      </Text>
                      <Text style={[styles.optionSubtitle, { color: theme.colors.text.muted }]}>
                        {isShared ? "Get invite code or link" : "Convert to shared session"}
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={theme.colors.text.muted} />
                </Pressable>

                {/* Manage Members (only for shared sessions, admin+) */}
                {isShared && isAdmin && (
                  <Pressable
                    onPress={handleManageMembers}
                    style={({ pressed }) => [
                      styles.optionRow,
                      { backgroundColor: theme.colors.background.secondary },
                      pressed && styles.optionPressed,
                    ]}
                  >
                    <View style={styles.optionLeft}>
                      <Ionicons name="people" size={22} color={theme.colors.text.primary} />
                      <View style={styles.optionText}>
                        <Text style={[styles.optionTitle, { color: theme.colors.text.primary }]}>
                          Manage Members
                        </Text>
                        <Text style={[styles.optionSubtitle, { color: theme.colors.text.muted }]}>
                          View, promote, or remove members
                        </Text>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={theme.colors.text.muted} />
                  </Pressable>
                )}

                {/* Reminder Settings */}
                <Pressable
                  onPress={() => setShowReminderTimePicker(true)}
                  style={({ pressed }) => [
                    styles.optionRow,
                    { backgroundColor: theme.colors.background.secondary },
                    pressed && styles.optionPressed,
                  ]}
                >
                  <View style={styles.optionLeft}>
                    <Ionicons name="alarm-outline" size={22} color={theme.colors.text.primary} />
                    <View style={styles.optionText}>
                      <Text style={[styles.optionTitle, { color: theme.colors.text.primary }]}>
                        Reminder Settings
                      </Text>
                      <Text style={[styles.optionSubtitle, { color: theme.colors.text.muted }]}>
                        {reminderPrefs.reminderEnabled
                          ? `Daily at ${formatTime(reminderPrefs.reminderHour, reminderPrefs.reminderMinute)}`
                          : "Not set"}
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={theme.colors.text.muted} />
                </Pressable>

                {/* Divider */}
                <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

                {/* Leave Session (only for shared sessions, non-owners) */}
                {isShared && (
                  <Pressable
                    onPress={handleLeave}
                    disabled={actionLoading}
                    style={({ pressed }) => [
                      styles.optionRow,
                      { backgroundColor: theme.colors.background.secondary },
                      pressed && styles.optionPressed,
                    ]}
                  >
                    <View style={styles.optionLeft}>
                      <Ionicons name="exit-outline" size={22} color="#E53E3E" />
                      <View style={styles.optionText}>
                        <Text style={[styles.optionTitle, { color: "#E53E3E" }]}>
                          Leave Session
                        </Text>
                        <Text style={[styles.optionSubtitle, { color: theme.colors.text.muted }]}>
                          {isOwner ? "Transfer ownership first" : "Exit this shared session"}
                        </Text>
                      </View>
                    </View>
                    {actionLoading && (
                      <ActivityIndicator size="small" color={theme.colors.text.muted} />
                    )}
                  </Pressable>
                )}

                {/* Delete Session (owner only, or personal session) */}
                {isOwner && (
                  <Pressable
                    onPress={handleDelete}
                    disabled={actionLoading}
                    style={({ pressed }) => [
                      styles.optionRow,
                      { backgroundColor: theme.colors.background.secondary },
                      pressed && styles.optionPressed,
                    ]}
                  >
                    <View style={styles.optionLeft}>
                      <Ionicons name="trash" size={22} color="#E53E3E" />
                      <View style={styles.optionText}>
                        <Text style={[styles.optionTitle, { color: "#E53E3E" }]}>
                          Delete Session
                        </Text>
                        <Text style={[styles.optionSubtitle, { color: theme.colors.text.muted }]}>
                          {isShared ? "Delete for all members" : "Remove this plan"}
                        </Text>
                      </View>
                    </View>
                    {actionLoading && (
                      <ActivityIndicator size="small" color={theme.colors.text.muted} />
                    )}
                  </Pressable>
                )}
              </View>
            </View>
          )}
        </SafeAreaView>
      </Modal>

      {/* Sub-modals */}
      <ShareSessionModal
        visible={showShareModal}
        onClose={() => setShowShareModal(false)}
        planSessionId={session.id}
        planName={planName}
        existingSharedSession={isShared ? session : null}
      />

      <MembersListModal
        visible={showMembersModal}
        onClose={() => setShowMembersModal(false)}
        sessionId={session.id}
        userRole={userRole}
      />

      <TransferOwnershipModal
        visible={showTransferModal}
        onClose={() => setShowTransferModal(false)}
        sessionId={session.id}
        onTransferComplete={handleTransferComplete}
      />

      {/* Confirmation Modals */}
      <ConfirmationModal
        visible={showLeaveConfirm}
        variant="destructive"
        title="Leave Session"
        message="Are you sure you want to leave this session? You can rejoin with an invite code."
        confirmLabel="Leave"
        cancelLabel="Cancel"
        icon="exit-outline"
        onConfirm={confirmLeave}
        onCancel={() => setShowLeaveConfirm(false)}
      />

      <ConfirmationModal
        visible={showDeleteConfirm}
        variant="destructive"
        title="Delete Session"
        message={
          isShared
            ? "This will permanently delete the session for all members. This cannot be undone."
            : "Are you sure you want to delete this reading plan? This cannot be undone."
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        icon="trash"
        onConfirm={confirmDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />

      <ConfirmationModal
        visible={showErrorModal}
        variant="info"
        title="Error"
        message={errorMessage}
        confirmLabel="OK"
        icon="alert-circle"
        onConfirm={() => setShowErrorModal(false)}
      />

      {/* Reminder Time Picker */}
      <TimePickerModal
        visible={showReminderTimePicker}
        hour={reminderPrefs.reminderHour}
        minute={reminderPrefs.reminderMinute}
        onConfirm={handleReminderTimeConfirm}
        onCancel={() => setShowReminderTimePicker(false)}
      />
    </>
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
  content: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  sessionName: {
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 12,
  },
  roleRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 32,
  },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  roleText: {
    fontSize: 13,
    fontWeight: "500",
  },
  optionsList: {
    width: "100%",
    gap: 10,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderRadius: 12,
  },
  optionPressed: {
    opacity: 0.7,
  },
  optionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    flex: 1,
  },
  optionText: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  optionSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  divider: {
    height: 1,
    marginVertical: 6,
  },
});
