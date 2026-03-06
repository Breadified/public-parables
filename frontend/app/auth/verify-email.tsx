/**
 * Email Verification Screen
 *
 * Shows after signup when email verification is required.
 * Automatically detects when email is verified and continues to onboarding.
 */

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useTheme } from "../../contexts/ThemeContext";
import { supabase } from "../../lib/supabase";

export default function VerifyEmailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { theme } = useTheme();

  const email = (params.email as string) || "";

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Create theme-aware styles
  const styles = createStyles(theme);

  // Listen for email verification (SIGNED_IN event)
  useEffect(() => {
    if (__DEV__) {
      console.log("[VerifyEmail] Setting up auth state listener...");
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (__DEV__) {
          console.log("[VerifyEmail] Auth event:", event, "Has session:", !!session);
        }

        if (event === 'SIGNED_IN' && session) {
          // Email verified! Navigate to display-name screen
          if (__DEV__) {
            console.log("[VerifyEmail] ✅ Email verified! Navigating to display-name...");
          }
          router.replace("/auth/display-name");
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  // Cooldown timer for resend button
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => {
        setResendCooldown(resendCooldown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleResendEmail = async () => {
    if (resendCooldown > 0) return;

    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email: email,
      });

      if (resendError) throw resendError;

      setSuccessMessage("Email sent! Check your inbox.");
      setResendCooldown(60); // 60 second cooldown
    } catch (err: any) {
      if (__DEV__) {
        console.error("[VerifyEmail] Resend error:", err);
      }
      setError("Failed to resend email. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  const handleManualCheck = async () => {
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      // Refresh session to check if email is now verified
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) throw sessionError;

      if (session) {
        // Verified! Continue to display-name
        if (__DEV__) {
          console.log("[VerifyEmail] ✅ Manual check - email verified!");
        }
        router.replace("/auth/display-name");
      } else {
        setError("Email not verified yet. Please check your inbox and click the verification link.");
      }
    } catch (err: any) {
      if (__DEV__) {
        console.error("[VerifyEmail] Manual check error:", err);
      }
      setError("Unable to verify email status. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleBackToLogin = () => {
    router.replace("/auth/login");
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Icon */}
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>📧</Text>
        </View>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Check Your Email</Text>
          <Text style={styles.subtitle}>
            We&apos;ve sent a verification link to:
          </Text>
          <Text style={styles.email}>{email}</Text>
        </View>

        {/* Instructions */}
        <View style={styles.instructionsContainer}>
          <Text style={styles.instructions}>
            Click the link in the email to verify your account.
          </Text>
          <Text style={styles.instructions}>
            Once verified, we&apos;ll continue automatically.
          </Text>
        </View>

        {/* Success Message */}
        {successMessage && (
          <View style={styles.successContainer}>
            <Text style={styles.successIcon}>✓</Text>
            <Text style={styles.successText}>{successMessage}</Text>
          </View>
        )}

        {/* Error Message */}
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          {/* Resend Email Button */}
          <TouchableOpacity
            style={[
              styles.resendButton,
              (loading || resendCooldown > 0) && styles.buttonDisabled,
            ]}
            onPress={handleResendEmail}
            disabled={loading || resendCooldown > 0}
          >
            {loading ? (
              <ActivityIndicator color={theme.colors.interactive.button.background} />
            ) : (
              <Text style={styles.resendButtonText}>
                {resendCooldown > 0
                  ? `Resend Email (${resendCooldown}s)`
                  : "Resend Email"}
              </Text>
            )}
          </TouchableOpacity>

          {/* Manual Check Button */}
          <TouchableOpacity
            style={[styles.checkButton, loading && styles.buttonDisabled]}
            onPress={handleManualCheck}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.checkButtonText}>I&apos;ve Verified</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Help Text */}
        <View style={styles.helpContainer}>
          <Text style={styles.helpText}>
            Didn&apos;t receive the email? Check your spam folder.
          </Text>
        </View>

        {/* Back to Login */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBackToLogin}
          disabled={loading}
        >
          <Text style={styles.backButtonText}>← Back to Login</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background.primary,
    },
    scrollContent: {
      padding: 24,
      paddingBottom: 48,
    },
    iconContainer: {
      alignItems: "center",
      marginTop: 32,
      marginBottom: 24,
    },
    icon: {
      fontSize: 64,
    },
    header: {
      marginBottom: 24,
      alignItems: "center",
    },
    title: {
      fontSize: 28,
      fontWeight: "700",
      color: theme.colors.text.primary,
      marginBottom: 12,
      textAlign: "center",
    },
    subtitle: {
      fontSize: 16,
      color: theme.colors.text.secondary,
      marginBottom: 8,
      textAlign: "center",
    },
    email: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.interactive.button.background,
      textAlign: "center",
    },
    instructionsContainer: {
      marginBottom: 32,
      paddingHorizontal: 16,
    },
    instructions: {
      fontSize: 15,
      color: theme.colors.text.secondary,
      lineHeight: 22,
      textAlign: "center",
      marginBottom: 8,
    },
    successContainer: {
      backgroundColor: "#D1FAE5",
      borderRadius: 12,
      padding: 16,
      marginBottom: 24,
      flexDirection: "row",
      alignItems: "center",
    },
    successIcon: {
      fontSize: 20,
      marginRight: 12,
    },
    successText: {
      flex: 1,
      fontSize: 14,
      color: "#065F46",
      lineHeight: 20,
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
    actionsContainer: {
      marginBottom: 24,
    },
    resendButton: {
      borderWidth: 1,
      borderColor: theme.colors.interactive.button.background,
      borderRadius: 12,
      paddingVertical: 16,
      alignItems: "center",
      marginBottom: 12,
    },
    resendButtonText: {
      color: theme.colors.interactive.button.background,
      fontSize: 16,
      fontWeight: "600",
    },
    checkButton: {
      backgroundColor: theme.colors.interactive.button.background,
      borderRadius: 12,
      paddingVertical: 16,
      alignItems: "center",
    },
    checkButtonText: {
      color: "#FFFFFF",
      fontSize: 16,
      fontWeight: "600",
    },
    buttonDisabled: {
      opacity: 0.5,
    },
    helpContainer: {
      marginBottom: 24,
      paddingHorizontal: 16,
    },
    helpText: {
      fontSize: 14,
      color: theme.colors.text.secondary,
      textAlign: "center",
      lineHeight: 20,
    },
    backButton: {
      alignItems: "center",
      paddingVertical: 12,
    },
    backButtonText: {
      fontSize: 16,
      color: theme.colors.text.secondary,
      fontWeight: "500",
    },
  });
