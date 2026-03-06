/**
 * Display Name Onboarding Screen
 *
 * Onboarding screen for new users to set their display name.
 * Shows after successful signup before entering the main app.
 */

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useUnifiedAuth } from "../../hooks/useUnifiedAuth";
import { useTheme } from "../../contexts/ThemeContext";
import { DisplayNamePicker } from "../../components/Auth/DisplayNamePicker";
import { supabase } from "../../lib/supabase";
import { signOutFromGoogle } from "../../services/googleSignIn";

export default function DisplayNameScreen() {
  const router = useRouter();
  const { user, updateUserMetadata, getAndClearReturnUrl } = useUnifiedAuth();
  const { theme } = useTheme();

  const [displayName, setDisplayName] = useState("");
  const [displayNameValid, setDisplayNameValid] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);

  // Create theme-aware styles
  const styles = createStyles(theme);

  // Simple user availability check using useUnifiedAuth (single source of truth)
  useEffect(() => {
    let mounted = true;

    // If user is available, we're ready
    if (user) {
      if (__DEV__) {
        console.log("[DisplayName] ✅ User ready from auth store:", user.id);
      }
      setInitializing(false);
      return;
    }

    // Timeout after 3 seconds if user not available
    const timeout = setTimeout(async () => {
      if (mounted && !user) {
        console.error("[DisplayName] ❌ User not available after timeout");
        setError("Session not found. Please try signing in again.");
        setInitializing(false);

        // Reset Google Sign-In state so button works again
        await signOutFromGoogle();

        // Redirect to login after 2 seconds
        setTimeout(() => {
          if (mounted) {
            router.replace("/auth/login");
          }
        }, 2000);
      }
    }, 3000);

    return () => {
      mounted = false;
      clearTimeout(timeout);
    };
  }, [user, router]);

  const handleContinue = async () => {
    // Validate display name
    if (!displayName || !displayNameValid) {
      setError("Please choose a valid display name (3-20 characters, letters/numbers/underscore only)");
      return;
    }

    // Check if user is available
    if (!user) {
      setError("Session not ready. Please wait a moment and try again.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Update display name in database using RPC function
      const { data, error: rpcError } = await supabase.rpc('update_user_display_name', {
        p_user_id: user.id,
        p_new_display_name: displayName,
      });

      if (rpcError) {
        console.error('[DisplayName] RPC error:', rpcError);
        throw rpcError;
      }

      if (__DEV__) {
        console.log('[DisplayName] Display name updated:', data);
      }

      // Get the return URL (where user was trying to go before auth)
      const returnUrl = getAndClearReturnUrl();

      if (__DEV__) {
        console.log("[DisplayName] Return URL:", returnUrl);
        console.log("[DisplayName] Navigating to:", returnUrl || "/(tabs)");
      }

      // Navigate to original destination or default to tabs
      if (returnUrl) {
        router.replace(returnUrl as any);
      } else {
        router.replace("/(tabs)");
      }
    } catch (error: any) {
      // Log error in development only
      if (__DEV__) {
        console.error("Display name update error:", error);
      }

      // Show user-friendly error message inline
      if (error.message?.includes("session") || error.message?.includes("Auth")) {
        setError("Your session has expired. Redirecting to login...");
        setTimeout(() => {
          router.replace("/auth/login");
        }, 2000);
      } else if (error.message?.includes("duplicate") || error.message?.includes("unique")) {
        setError("This display name is already taken. Please try a different one.");
      } else {
        setError("Failed to save display name. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Show loading state while initializing
  if (initializing) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.interactive.button.background} />
          <Text style={styles.loadingText}>Setting up your account...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardAvoid}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Complete Your Profile</Text>
            <Text style={styles.subtitle}>
              Choose a display name to personalize your account
            </Text>
          </View>

          {/* Error Message */}
          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorIcon}>⚠️</Text>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Form */}
          <View style={styles.form}>
            <DisplayNamePicker
              value={displayName}
              onChangeText={(text) => {
                setDisplayName(text);
                setError(null); // Clear error when user types
              }}
              onValidationChange={setDisplayNameValid}
            />

            <TouchableOpacity
              style={[
                styles.continueButton,
                (!displayNameValid || loading || !user) && styles.buttonDisabled,
              ]}
              onPress={handleContinue}
              disabled={!displayNameValid || loading || !user}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.continueButtonText}>Continue</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Info text */}
          <View style={styles.infoContainer}>
            <Text style={styles.infoText}>
              You can change your display name anytime in settings
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background.primary,
    },
    keyboardAvoid: {
      flex: 1,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 24,
    },
    loadingText: {
      fontSize: 16,
      color: theme.colors.text.secondary,
      marginTop: 16,
      textAlign: "center",
    },
    scrollContent: {
      padding: 24,
      paddingBottom: 48,
    },
    header: {
      marginBottom: 32,
    },
    title: {
      fontSize: 32,
      fontWeight: "700",
      color: theme.colors.text.primary,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 16,
      color: theme.colors.text.secondary,
      lineHeight: 24,
    },
    errorContainer: {
      backgroundColor: "#FEE2E2",
      borderRadius: 12,
      padding: 16,
      marginBottom: 24,
      flexDirection: "row",
      alignItems: "center",
    },
    errorIcon: {
      fontSize: 20,
      marginRight: 12,
    },
    errorText: {
      flex: 1,
      fontSize: 14,
      color: "#DC2626",
      lineHeight: 20,
    },
    form: {
      marginBottom: 24,
    },
    continueButton: {
      backgroundColor: theme.colors.interactive.button.background,
      borderRadius: 12,
      paddingVertical: 16,
      alignItems: "center",
      marginTop: 24,
    },
    buttonDisabled: {
      opacity: 0.5,
    },
    continueButtonText: {
      color: "#FFFFFF",
      fontSize: 16,
      fontWeight: "600",
    },
    infoContainer: {
      alignItems: "center",
      marginTop: 16,
    },
    infoText: {
      fontSize: 14,
      color: theme.colors.text.secondary,
      textAlign: "center",
    },
  });
