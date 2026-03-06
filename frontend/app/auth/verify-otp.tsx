/**
 * OTP Verification Screen
 *
 * Shows after signup for email verification via OTP code.
 * User enters 6-digit code from email to verify their account.
 */

import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useTheme } from "../../contexts/ThemeContext";
import { useUnifiedAuth } from "../../hooks/useUnifiedAuth";

export default function VerifyOtpScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { theme } = useTheme();
  const { verifyOtp } = useUnifiedAuth();

  const email = (params.email as string) || "";

  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const inputRef = useRef<TextInput>(null);

  // Create theme-aware styles
  const styles = createStyles(theme);

  // Auto-focus input on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  // Cooldown timer for resend button
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => {
        setResendCooldown(resendCooldown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // Auto-submit when 6 digits entered
  useEffect(() => {
    if (otp.length === 6 && !loading) {
      handleVerifyOtp();
    }
  }, [otp]);

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) {
      setError("Please enter a 6-digit code");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await verifyOtp(email, otp);

      if (__DEV__) {
        console.log("[VerifyOtp] ✅ OTP verified successfully");
      }

      // Navigate to display name screen
      router.replace("/auth/display-name");
    } catch (err: any) {
      if (__DEV__) {
        console.error("[VerifyOtp] Verification error:", err);
      }

      // Handle specific error cases
      if (err.message?.includes("Invalid") || err.message?.includes("invalid")) {
        setError("Invalid code. Please check and try again.");
      } else if (err.message?.includes("expired")) {
        setError("Code expired. Please request a new one.");
      } else {
        setError("Verification failed. Please try again.");
      }

      // Clear OTP on error
      setOtp("");
      inputRef.current?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;

    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      // Resend signup confirmation OTP
      const { supabase } = await import("../../lib/supabase");
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email: email,
      });

      if (resendError) throw resendError;

      if (__DEV__) {
        console.log("[VerifyOtp] New OTP code sent to:", email);
      }

      setSuccessMessage("New code sent! Check your email.");
      setResendCooldown(60); // 60 second cooldown
      setOtp("");
    } catch (err: any) {
      if (__DEV__) {
        console.error("[VerifyOtp] Resend error:", err);
      }
      setError("Failed to resend code. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  const handleBackToLogin = () => {
    router.replace("/auth/login");
  };

  const handleOtpChange = (text: string) => {
    // Only allow digits, max 6 characters
    const cleaned = text.replace(/[^0-9]/g, "").slice(0, 6);
    setOtp(cleaned);
    setError(null);
  };

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
          {/* Icon */}
          <View style={styles.iconContainer}>
            <Text style={styles.icon}>🔐</Text>
          </View>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Enter Verification Code</Text>
            <Text style={styles.subtitle}>
              We&apos;ve sent a 6-digit code to:
            </Text>
            <Text style={styles.email}>{email}</Text>
          </View>

          {/* OTP Input */}
          <View style={styles.otpContainer}>
            <TextInput
              ref={inputRef}
              style={styles.otpInput}
              value={otp}
              onChangeText={handleOtpChange}
              placeholder="000000"
              placeholderTextColor={theme.colors.text.muted}
              keyboardType="number-pad"
              maxLength={6}
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              editable={!loading}
              selectTextOnFocus
            />
            {loading && (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator color={theme.colors.interactive.button.background} />
              </View>
            )}
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

          {/* Resend Button */}
          <TouchableOpacity
            style={[
              styles.resendButton,
              (loading || resendCooldown > 0) && styles.buttonDisabled,
            ]}
            onPress={handleResendOtp}
            disabled={loading || resendCooldown > 0}
          >
            <Text style={styles.resendButtonText}>
              {resendCooldown > 0
                ? `Resend Code (${resendCooldown}s)`
                : "Resend Code"}
            </Text>
          </TouchableOpacity>

          {/* Help Text */}
          <View style={styles.helpContainer}>
            <Text style={styles.helpText}>
              Didn&apos;t receive the code? Check your spam folder.
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
      marginBottom: 32,
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
    otpContainer: {
      marginBottom: 24,
      position: "relative",
    },
    otpInput: {
      fontSize: 32,
      fontWeight: "700",
      textAlign: "center",
      letterSpacing: 12,
      paddingVertical: 20,
      paddingHorizontal: 16,
      borderWidth: 2,
      borderColor: theme.colors.border,
      borderRadius: 12,
      backgroundColor: theme.colors.background.secondary,
      color: theme.colors.text.primary,
    },
    loadingOverlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: "rgba(255, 255, 255, 0.8)",
      borderRadius: 12,
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
    resendButton: {
      borderWidth: 1,
      borderColor: theme.colors.interactive.button.background,
      borderRadius: 12,
      paddingVertical: 16,
      alignItems: "center",
      marginBottom: 24,
    },
    resendButtonText: {
      color: theme.colors.interactive.button.background,
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
