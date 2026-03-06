/**
 * Accept Invite Screen
 * Modal for accepting shared session invite links
 */

import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { observer } from "@legendapp/state/react";

import { useTheme } from "@/contexts/ThemeContext";
import { useUnifiedAuth } from "@/hooks/useUnifiedAuth";
import { planStore$ } from "@/state";
import { userProfileCache$ } from "@/state/userProfileCache";
import {
  joinSharedSession,
  fetchSharedSessionByCode,
  checkSessionParticipation,
} from "@/services/planService";
import { AuthModal } from "@/components/Auth/AuthModal";
import type { PlanSession } from "@/types/database";
import type { SharedSessionWithDetails } from "@/state/planStore";

export default observer(function AcceptInviteScreen() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  const router = useRouter();
  const { theme } = useTheme();
  const { user, isAuthenticated, hasSignedInOnDevice, setReturnUrl } = useUnifiedAuth();
  const insets = useSafeAreaInsets();

  const [inviteCode, setInviteCode] = useState(code || "");
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [sessionInfo, setSessionInfo] = useState<PlanSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Track if we've already started joining to prevent double-join
  const hasInitiatedJoin = useRef(false);

  // Validate code on mount or change
  useEffect(() => {
    if (inviteCode.length === 8) {
      validateCode(inviteCode);
    } else {
      setSessionInfo(null);
      setError(null);
    }
  }, [inviteCode]);

  // Check for pending invite code from deep link
  useEffect(() => {
    const pendingCode = planStore$.pendingInviteCode.get();
    if (pendingCode && !code) {
      setInviteCode(pendingCode);
      planStore$.setPendingInviteCode(null);
    }
  }, [code]);

  // Auto-join when user returns after authentication (via returnUrl)
  // This triggers when sessionInfo is valid and user just authenticated
  useEffect(() => {
    if (sessionInfo && isAuthenticated && user?.id && code && !hasInitiatedJoin.current && !loading) {
      // User returned from auth flow with valid session - auto-join
      hasInitiatedJoin.current = true;
      joinSession();
    }
  }, [sessionInfo, isAuthenticated, user?.id, code, loading]);

  const validateCode = async (codeToValidate: string) => {
    setValidating(true);
    setError(null);

    try {
      const session = await fetchSharedSessionByCode(codeToValidate);
      if (session) {
        // Check if user is already a participant - if so, go directly to the session
        if (user?.id) {
          const isParticipant = await checkSessionParticipation(
            session.id,
            user.id
          );
          if (isParticipant) {
            // Already a member - navigate directly to the session
            router.replace({
              pathname: "/plans/session/[sessionId]",
              params: { sessionId: session.id },
            });
            return;
          }
        }
        setSessionInfo(session);
      } else {
        setError("Invalid or expired invite code");
        setSessionInfo(null);
      }
    } catch (err) {
      setError("Failed to validate invite code");
      setSessionInfo(null);
    } finally {
      setValidating(false);
    }
  };

  const handleJoin = useCallback(async () => {
    if (!sessionInfo) return;

    // Show auth modal if not authenticated
    if (!isAuthenticated || !user?.id) {
      // Set return URL so user comes back here after auth to complete the join
      setReturnUrl(`/plans/invite?code=${inviteCode}`);
      setShowAuthModal(true);
      return;
    }

    await joinSession();
  }, [isAuthenticated, user?.id, sessionInfo, inviteCode, setReturnUrl]);

  // Actual join logic - called after authentication
  const joinSession = useCallback(async () => {
    if (!user?.id || !sessionInfo) return;

    setLoading(true);
    setError(null);

    try {
      const result = await joinSharedSession(inviteCode, user.id);

      if (result.success && result.sharedSession) {
        // Fetch owner's profile to get display name
        const ownerId = result.sharedSession.user_id;
        await userProfileCache$.ensureProfiles([ownerId]);
        const ownerProfile = userProfileCache$.getProfile(ownerId);

        // Enrich session with owner display name before adding to store
        const enrichedSession: SharedSessionWithDetails = {
          ...result.sharedSession,
          owner_display_name: ownerProfile?.display_name || undefined,
          owner_avatar_url: ownerProfile?.avatar_url || undefined,
          participant_count: 1, // At least the user who just joined
        };

        // Add to local store
        planStore$.addSharedSession(enrichedSession);

        // Navigate to the shared session view
        router.replace({
          pathname: "/plans/session/[sessionId]",
          params: { sessionId: result.sharedSession.id },
        });
      } else {
        setError(result.error || "Failed to join session");
      }
    } catch (err) {
      setError("Failed to join session");
    } finally {
      setLoading(false);
    }
  }, [user?.id, sessionInfo, inviteCode, router]);

  // Handle successful auth - join the session
  const handleAuthSuccess = useCallback(() => {
    setShowAuthModal(false);
    // Slight delay to ensure auth state is updated
    setTimeout(() => {
      joinSession();
    }, 100);
  }, [joinSession]);

  const handleClose = () => {
    router.back();
  };

  const handleCodeChange = (text: string) => {
    // Convert to uppercase and remove non-alphanumeric
    const cleaned = text.toUpperCase().replace(/[^A-Z0-9]/g, "");
    setInviteCode(cleaned.slice(0, 8));
  };

  return (
    <SafeAreaView
      style={[
        styles.container,
        { backgroundColor: theme.colors.background.primary },
      ]}
      edges={["top", "bottom"]}
    >
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={handleClose} style={styles.closeButton}>
            <Ionicons
              name="close"
              size={24}
              color={theme.colors.text.primary}
            />
          </Pressable>
          <Text
            style={[styles.headerTitle, { color: theme.colors.text.primary }]}
          >
            Join Session
          </Text>
          <View style={styles.closeButton} />
        </View>

        <View style={styles.content}>
          {/* Icon */}
          <View
            style={[
              styles.iconContainer,
              { backgroundColor: theme.colors.background.secondary },
            ]}
          >
            <Ionicons
              name="people"
              size={40}
              color={theme.colors.text.primary}
            />
          </View>

          {/* Title */}
          <Text style={[styles.title, { color: theme.colors.text.primary }]}>
            Join a friend&apos;s session
          </Text>
          <Text style={[styles.subtitle, { color: theme.colors.text.muted }]}>
            Enter the 8-character invite code to join a shared reading plan
          </Text>

          {/* Code Input */}
          <View style={styles.inputSection}>
            <TextInput
              style={[
                styles.codeInput,
                {
                  backgroundColor: theme.colors.background.secondary,
                  color: theme.colors.text.primary,
                  borderColor: error
                    ? "#E53E3E"
                    : sessionInfo
                    ? "#38A169"
                    : theme.colors.border,
                },
              ]}
              value={inviteCode}
              onChangeText={handleCodeChange}
              placeholder="ABCD1234"
              placeholderTextColor={theme.colors.text.muted}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={8}
              textAlign="center"
            />

            {validating && (
              <View style={styles.validatingContainer}>
                <ActivityIndicator
                  size="small"
                  color={theme.colors.text.muted}
                />
                <Text
                  style={[
                    styles.validatingText,
                    { color: theme.colors.text.muted },
                  ]}
                >
                  Validating...
                </Text>
              </View>
            )}
          </View>

          {/* Session Info */}
          {sessionInfo && !validating && (
            <View
              style={[
                styles.sessionCard,
                { backgroundColor: theme.colors.background.secondary },
              ]}
            >
              <Ionicons name="checkmark-circle" size={24} color="#38A169" />
              <View style={styles.sessionInfo}>
                <Text
                  style={[
                    styles.sessionName,
                    { color: theme.colors.text.primary },
                  ]}
                >
                  {sessionInfo.shared_name}
                </Text>
                <Text
                  style={[
                    styles.sessionMeta,
                    { color: theme.colors.text.muted },
                  ]}
                >
                  Valid invite code
                </Text>
              </View>
            </View>
          )}

          {/* Error */}
          {error && (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={20} color="#E53E3E" />
              <Text style={[styles.errorText, { color: "#E53E3E" }]}>
                {error}
              </Text>
            </View>
          )}

          </View>

        {/* Join Button */}
        <View style={styles.footer}>
          <Pressable
            onPress={handleJoin}
            disabled={loading || !sessionInfo}
            style={({ pressed }) => [
              styles.joinButton,
              {
                backgroundColor: theme.colors.interactive.button.background,
                opacity:
                  pressed || loading || !sessionInfo
                    ? 0.6
                    : 1,
              },
            ]}
          >
            {loading ? (
              <ActivityIndicator
                size="small"
                color={theme.colors.text.primary}
              />
            ) : (
              <>
                <Ionicons
                  name="enter"
                  size={20}
                  color={theme.colors.text.primary}
                />
                <Text
                  style={[
                    styles.joinButtonText,
                    { color: theme.colors.text.primary },
                  ]}
                >
                  Join Session
                </Text>
              </>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {/* Auth Modal - shown when user tries to join without being signed in */}
      <AuthModal
        visible={showAuthModal}
        mode={hasSignedInOnDevice ? "login" : "signup"}
        onClose={() => setShowAuthModal(false)}
        onSuccess={handleAuthSuccess}
        promptMessage="Sign in to join this shared session"
      />
    </SafeAreaView>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
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
  },
  subtitle: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 32,
  },
  inputSection: {
    width: "100%",
    alignItems: "center",
    gap: 12,
  },
  codeInput: {
    width: "100%",
    maxWidth: 280,
    height: 56,
    borderRadius: 12,
    borderWidth: 2,
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: 4,
    paddingHorizontal: 16,
  },
  validatingContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  validatingText: {
    fontSize: 14,
  },
  sessionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    width: "100%",
    padding: 16,
    borderRadius: 12,
    marginTop: 24,
  },
  sessionInfo: {
    flex: 1,
    gap: 2,
  },
  sessionName: {
    fontSize: 16,
    fontWeight: "600",
  },
  sessionMeta: {
    fontSize: 13,
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 16,
  },
  errorText: {
    fontSize: 14,
    fontWeight: "500",
  },
  footer: {
    padding: 16,
    paddingBottom: 24,
  },
  joinButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  joinButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
});
