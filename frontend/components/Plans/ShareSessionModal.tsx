/**
 * ShareSessionModal - Create and share a session with friends
 */

import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ActivityIndicator,
  Modal,
  Share,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";

import { useTheme } from "@/contexts/ThemeContext";
import { useUnifiedAuth } from "@/hooks/useUnifiedAuth";
import { planStore$, userProfileCache$ } from "@/state";
import { sharePlanSession } from "@/services/planService";
import type { PlanSession } from "@/types/database";
import type { SharedSessionWithDetails } from "@/state/planStore";

interface ShareSessionModalProps {
  visible: boolean;
  onClose: () => void;
  planSessionId: string;
  planName: string;
  existingSharedSession?: PlanSession | null;
}

export default function ShareSessionModal({
  visible,
  onClose,
  planSessionId,
  planName,
  existingSharedSession,
}: ShareSessionModalProps) {
  const { theme } = useTheme();
  const { user } = useUnifiedAuth();

  const [sessionName, setSessionName] = useState(planName);
  const [creating, setCreating] = useState(false);
  const [sharedSession, setSharedSession] = useState<PlanSession | null>(
    existingSharedSession || null
  );
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Use Supabase Edge Function URL - this is an HTTPS URL that will be hyperlinked
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const inviteLink = sharedSession && supabaseUrl
    ? `${supabaseUrl}/functions/v1/invite?code=${sharedSession.invite_code}`
    : "";

  const handleCreate = useCallback(async () => {
    if (!user?.id || !sessionName.trim()) return;

    setCreating(true);
    setError(null);

    try {
      // Convert existing plan session to shared by setting is_shared=true
      const session = await sharePlanSession(
        planSessionId,
        sessionName.trim()
      );

      if (session) {
        // Ensure current user's profile is cached, then enrich session
        await userProfileCache$.ensureProfiles([user.id]);
        const ownerProfile = userProfileCache$.getProfile(user.id);
        const enrichedSession: SharedSessionWithDetails = {
          ...session,
          participant_count: 1, // Owner is first participant
          owner_display_name: ownerProfile?.display_name || undefined,
          owner_avatar_url: ownerProfile?.avatar_url || null,
        };

        setSharedSession(session);
        planStore$.addSharedSession(enrichedSession);

        // Also update mySessions so owner's local session has is_shared=true
        planStore$.updateSession({
          id: session.id,
          is_shared: true,
          shared_name: session.shared_name,
          invite_code: session.invite_code,
        });
      } else {
        setError("Failed to create shared session");
      }
    } catch (err) {
      setError("Failed to create shared session");
    } finally {
      setCreating(false);
    }
  }, [user?.id, sessionName, planSessionId]);

  const handleCopy = useCallback(async () => {
    if (!sharedSession) return;

    try {
      await Clipboard.setStringAsync(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }, [inviteLink, sharedSession]);

  const handleShare = useCallback(async () => {
    if (!sharedSession) return;

    try {
      // Include HTTPS link which will be auto-hyperlinked in messaging apps
      const displayName = sharedSession.shared_name || 'Bible Plan';
      const message = `Join my Bible reading plan "${displayName}" on Parables!\n\n` +
        `${inviteLink}\n\n` +
        `Or enter code manually: ${sharedSession.invite_code}`;

      await Share.share({
        message,
        title: `Join ${displayName}`,
      });
    } catch (err) {
      console.error("Failed to share:", err);
    }
  }, [sharedSession, inviteLink]);

  const handleClose = () => {
    setSessionName(planName);
    setError(null);
    setCopied(false);
    onClose();
  };

  return (
    <Modal
      visible={visible}
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
            {sharedSession ? "Share Session" : "Create Shared Session"}
          </Text>
          <View style={styles.closeButton} />
        </View>

        <View style={styles.content}>
          {!sharedSession ? (
            // Create shared session form
            <>
              <View
                style={[
                  styles.iconContainer,
                  { backgroundColor: theme.colors.background.secondary },
                ]}
              >
                <Ionicons name="share-social" size={40} color={theme.colors.text.primary} />
              </View>

              <Text style={[styles.title, { color: theme.colors.text.primary }]}>
                Share with Friends
              </Text>
              <Text style={[styles.subtitle, { color: theme.colors.text.muted }]}>
                Create a shared session so friends can follow along and discuss the readings
              </Text>

              <View style={styles.inputSection}>
                <Text style={[styles.inputLabel, { color: theme.colors.text.secondary }]}>
                  Session Name
                </Text>
                <TextInput
                  style={[
                    styles.nameInput,
                    {
                      backgroundColor: theme.colors.background.secondary,
                      color: theme.colors.text.primary,
                      borderColor: theme.colors.border,
                    },
                  ]}
                  value={sessionName}
                  onChangeText={setSessionName}
                  placeholder="Enter a name for this session"
                  placeholderTextColor={theme.colors.text.muted}
                  autoCapitalize="sentences"
                  autoCorrect
                />
              </View>

              {error && (
                <View style={styles.errorContainer}>
                  <Ionicons
                    name="alert-circle"
                    size={20}
                    color="#E53E3E"
                  />
                  <Text
                    style={[
                      styles.errorText,
                      { color: "#E53E3E" },
                    ]}
                  >
                    {error}
                  </Text>
                </View>
              )}

              <Pressable
                onPress={handleCreate}
                disabled={creating || !sessionName.trim()}
                style={({ pressed }) => [
                  styles.createButton,
                  {
                    backgroundColor: theme.colors.interactive.button.background,
                    opacity: pressed || creating || !sessionName.trim() ? 0.6 : 1,
                  },
                ]}
              >
                {creating ? (
                  <ActivityIndicator size="small" color={theme.colors.text.primary} />
                ) : (
                  <>
                    <Ionicons name="add-circle" size={20} color={theme.colors.text.primary} />
                    <Text
                      style={[styles.createButtonText, { color: theme.colors.text.primary }]}
                    >
                      Create Shared Session
                    </Text>
                  </>
                )}
              </Pressable>
            </>
          ) : (
            // Share existing session
            <>
              <View
                style={[
                  styles.iconContainer,
                  { backgroundColor: theme.colors.background.secondary },
                ]}
              >
                <Ionicons
                  name="checkmark-circle"
                  size={40}
                  color="#38A169"
                />
              </View>

              <Text style={[styles.title, { color: theme.colors.text.primary }]}>
                Session Ready!
              </Text>
              <Text style={[styles.subtitle, { color: theme.colors.text.muted }]}>
                Share the invite code or link with friends to let them join
              </Text>

              {/* Invite Code Display */}
              <View
                style={[
                  styles.codeContainer,
                  { backgroundColor: theme.colors.background.secondary },
                ]}
              >
                <Text style={[styles.codeLabel, { color: theme.colors.text.muted }]}>
                  Invite Code
                </Text>
                <Text style={[styles.inviteCode, { color: theme.colors.text.primary }]}>
                  {sharedSession.invite_code}
                </Text>
              </View>

              {/* Action Buttons */}
              <View style={styles.actionButtons}>
                <Pressable
                  onPress={handleCopy}
                  style={({ pressed }) => [
                    styles.actionButton,
                    {
                      backgroundColor: theme.colors.background.secondary,
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}
                >
                  <Ionicons
                    name={copied ? "checkmark" : "copy-outline"}
                    size={22}
                    color={theme.colors.text.primary}
                  />
                  <Text style={[styles.actionButtonText, { color: theme.colors.text.primary }]}>
                    {copied ? "Copied!" : "Copy Link"}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={handleShare}
                  style={({ pressed }) => [
                    styles.actionButton,
                    {
                      backgroundColor: theme.colors.interactive.button.background,
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}
                >
                  <Ionicons name="share-outline" size={22} color={theme.colors.text.primary} />
                  <Text style={[styles.actionButtonText, { color: theme.colors.text.primary }]}>
                    Share
                  </Text>
                </Pressable>
              </View>

              {/* Instructions */}
              <View style={styles.instructions}>
                <Text style={[styles.instructionText, { color: theme.colors.text.muted }]}>
                  Friends can join by:
                </Text>
                <View style={styles.instructionStep}>
                  <Text style={[styles.stepNumber, { color: theme.colors.text.secondary }]}>
                    1.
                  </Text>
                  <Text style={[styles.stepText, { color: theme.colors.text.muted }]}>
                    Opening Parables app
                  </Text>
                </View>
                <View style={styles.instructionStep}>
                  <Text style={[styles.stepNumber, { color: theme.colors.text.secondary }]}>
                    2.
                  </Text>
                  <Text style={[styles.stepText, { color: theme.colors.text.muted }]}>
                    Going to Plans {">"} Shared tab
                  </Text>
                </View>
                <View style={styles.instructionStep}>
                  <Text style={[styles.stepNumber, { color: theme.colors.text.secondary }]}>
                    3.
                  </Text>
                  <Text style={[styles.stepText, { color: theme.colors.text.muted }]}>
                    Entering the invite code
                  </Text>
                </View>
              </View>
            </>
          )}
        </View>
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
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 32,
  },
  inputSection: {
    width: "100%",
    gap: 8,
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "500",
  },
  nameInput: {
    width: "100%",
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 14,
    fontWeight: "500",
  },
  createButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: "100%",
    paddingVertical: 14,
    borderRadius: 12,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  codeContainer: {
    alignItems: "center",
    padding: 20,
    borderRadius: 16,
    marginBottom: 12,
    gap: 8,
  },
  codeLabel: {
    fontSize: 13,
    fontWeight: "500",
  },
  inviteCode: {
    fontSize: 32,
    fontWeight: "700",
    letterSpacing: 4,
  },
  linkContainer: {
    width: "100%",
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    gap: 6,
  },
  linkLabel: {
    fontSize: 12,
    fontWeight: "500",
  },
  linkText: {
    fontSize: 13,
    textDecorationLine: "underline",
  },
  actionButtons: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
    marginBottom: 32,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: "600",
  },
  instructions: {
    width: "100%",
    gap: 12,
  },
  instructionText: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 4,
  },
  instructionStep: {
    flexDirection: "row",
    gap: 8,
  },
  stepNumber: {
    fontSize: 14,
    fontWeight: "600",
    width: 20,
  },
  stepText: {
    fontSize: 14,
    flex: 1,
  },
});
