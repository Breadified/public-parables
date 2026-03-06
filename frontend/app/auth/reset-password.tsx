/**
 * Reset Password Screen
 *
 * Allows users to set a new password after requesting a reset via email.
 * This screen is accessed via a deep link from the password reset email.
 *
 * The deep link contains access_token and refresh_token that must be
 * exchanged for a session before updatePassword can be called.
 */

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as Linking from "expo-linking";
import { useUnifiedAuth } from "../../hooks/useUnifiedAuth";
import { useTheme } from "../../contexts/ThemeContext";
import { validatePassword, validatePasswordConfirm } from "../../utils/validation";
import { ConfirmationModal } from "../../components/ConfirmationModal";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../lib/supabase";

export default function ResetPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { updatePassword } = useUnifiedAuth();
  const { theme } = useTheme();

  const [sessionReady, setSessionReady] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Modal state
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorTitle, setErrorTitle] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // Create theme-aware styles
  const styles = createStyles(theme);

  // Extract tokens from deep link URL and establish session
  // In React Native, Supabase's detectSessionInUrl doesn't work because there's no window.location
  // We need to manually get the URL and extract tokens
  useEffect(() => {
    let isMounted = true;

    const setupSession = async () => {
      try {
        // First, check if we already have a valid session
        const { data: { session: existingSession } } = await supabase.auth.getSession();
        if (existingSession) {
          console.log('[ResetPassword] Already have session, ready for password reset');
          if (isMounted) {
            setSessionReady(true);
          }
          return;
        }

        // Get the URL that opened this screen - try multiple sources
        // 1. First check useLocalSearchParams (Expo Router parses query params)
        // 2. Then try to get the raw URL via Linking

        let accessToken: string | null = null;
        let refreshToken: string | null = null;
        let urlError: string | null = null;

        // Check params from Expo Router first
        if (params.access_token) {
          accessToken = params.access_token as string;
          refreshToken = params.refresh_token as string;
          urlError = params.error as string | null;
          console.log('[ResetPassword] Got tokens from Expo Router params');
        }

        // If no tokens in params, try to get from the raw URL
        if (!accessToken) {
          const url = await Linking.getInitialURL();
          console.log('[ResetPassword] Initial URL:', url);

          if (url) {
            // Parse the URL to extract fragment or query parameters
            // Supabase may return tokens in the URL fragment (#) or query string (?)
            const parsedUrl = Linking.parse(url);
            console.log('[ResetPassword] Parsed URL:', JSON.stringify(parsedUrl, null, 2));

            // Check query params
            if (parsedUrl.queryParams?.access_token) {
              accessToken = parsedUrl.queryParams.access_token as string;
              refreshToken = parsedUrl.queryParams.refresh_token as string;
              urlError = parsedUrl.queryParams.error as string | null;
              console.log('[ResetPassword] Got tokens from query params');
            }

            // If tokens are in the fragment (hash), we need to parse that
            // URL format might be: parables://auth/reset-password#access_token=...&refresh_token=...
            if (!accessToken && url.includes('#')) {
              const fragment = url.split('#')[1];
              if (fragment) {
                const fragmentParams = new URLSearchParams(fragment);
                accessToken = fragmentParams.get('access_token');
                refreshToken = fragmentParams.get('refresh_token');
                urlError = fragmentParams.get('error');
                if (accessToken) {
                  console.log('[ResetPassword] Got tokens from URL fragment');
                }
              }
            }
          }
        }

        // Check for URL error
        if (urlError) {
          console.error('[ResetPassword] URL error:', urlError);
          if (isMounted) {
            setSessionError(`Reset link error: ${urlError}`);
          }
          return;
        }

        // If we have tokens, set the session
        if (accessToken && refreshToken) {
          console.log('[ResetPassword] Setting session with tokens...');

          const { data, error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (sessionError) {
            console.error('[ResetPassword] Failed to set session:', sessionError.message);
            if (isMounted) {
              setSessionError(sessionError.message);
            }
            return;
          }

          if (data.session) {
            console.log('[ResetPassword] Session established successfully');
            if (isMounted) {
              setSessionReady(true);
            }
            return;
          }
        }

        // No tokens found - show error
        console.log('[ResetPassword] No tokens found in URL');
        console.log('[ResetPassword] Params:', JSON.stringify(params, null, 2));

        if (isMounted) {
          setSessionError('Invalid or expired reset link. Please request a new password reset.');
        }

      } catch (error: any) {
        console.error('[ResetPassword] Setup error:', error);
        if (isMounted) {
          setSessionError(error.message || 'Failed to process reset link');
        }
      }
    };

    setupSession();

    return () => {
      isMounted = false;
    };
  }, [params]);

  const handleResetPassword = async () => {
    // Ensure session is ready
    if (!sessionReady) {
      setErrorTitle("Session Error");
      setErrorMessage("Please wait for the session to be established or request a new reset link.");
      setShowErrorModal(true);
      return;
    }
    // Password validation
    const passwordError = validatePassword(password);
    if (passwordError) {
      setErrorTitle("Invalid Password");
      setErrorMessage(passwordError);
      setShowErrorModal(true);
      return;
    }

    // Password confirmation
    const confirmError = validatePasswordConfirm(password, confirmPassword);
    if (confirmError) {
      setErrorTitle("Password Mismatch");
      setErrorMessage(confirmError);
      setShowErrorModal(true);
      return;
    }

    setLoading(true);
    try {
      // Update password with Supabase
      await updatePassword(password);

      setShowSuccessModal(true);
    } catch (error: any) {
      // Log error in development only
      if (__DEV__) {
        console.error("Reset password error:", error);
      }

      setErrorTitle("Reset Failed");
      setErrorMessage(error.message || "Failed to reset password. Please try again.");
      setShowErrorModal(true);
    } finally {
      setLoading(false);
    }
  };

  // Handle success confirmation (navigates to tabs)
  const handleSuccessConfirm = () => {
    setShowSuccessModal(false);
    // Navigate to tabs (user is already authenticated via the reset link)
    router.replace("/(tabs)");
  };

  // Show error state if session setup failed
  if (sessionError) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorIcon}>!</Text>
          <Text style={styles.title}>Reset Link Error</Text>
          <Text style={styles.errorText}>{sessionError}</Text>
          <TouchableOpacity
            style={styles.resetButton}
            onPress={() => router.replace("/auth/forgot-password")}
          >
            <Text style={styles.resetButtonText}>Request New Link</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Show loading state while setting up session
  if (!sessionReady) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.interactive.button.background} />
          <Text style={styles.loadingText}>Verifying reset link...</Text>
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
            <Text style={styles.title}>Reset Password</Text>
            <Text style={styles.subtitle}>
              Enter a new password for your account
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>New Password</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={styles.passwordInput}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="At least 8 characters"
                  placeholderTextColor="#999"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!loading}
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowPassword(!showPassword)}
                  disabled={loading}
                >
                  <Ionicons
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={22}
                    color={theme.colors.text.secondary}
                  />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Confirm Password</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={styles.passwordInput}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Re-enter password"
                  placeholderTextColor="#999"
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!loading}
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  disabled={loading}
                >
                  <Ionicons
                    name={showConfirmPassword ? "eye-off-outline" : "eye-outline"}
                    size={22}
                    color={theme.colors.text.secondary}
                  />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.resetButton, loading && styles.buttonDisabled]}
              onPress={handleResetPassword}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.resetButtonText}>Reset Password</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Error Modal */}
      <ConfirmationModal
        visible={showErrorModal}
        variant="info"
        title={errorTitle}
        message={errorMessage}
        semanticType="error"
        onConfirm={() => setShowErrorModal(false)}
      />

      {/* Success Modal */}
      <ConfirmationModal
        visible={showSuccessModal}
        variant="info"
        title="Success"
        message="Your password has been reset successfully!"
        semanticType="success"
        onConfirm={handleSuccessConfirm}
      />
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
    form: {
      marginBottom: 24,
    },
    inputGroup: {
      marginBottom: 16,
    },
    label: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.text.primary,
      marginBottom: 8,
    },
    input: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 12,
      paddingVertical: 14,
      paddingHorizontal: 16,
      fontSize: 16,
      backgroundColor: theme.colors.background.secondary,
      color: theme.colors.text.primary,
    },
    passwordContainer: {
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 12,
      backgroundColor: theme.colors.background.secondary,
    },
    passwordInput: {
      flex: 1,
      paddingVertical: 14,
      paddingHorizontal: 16,
      fontSize: 16,
      color: theme.colors.text.primary,
    },
    eyeButton: {
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    resetButton: {
      backgroundColor: theme.colors.interactive.button.background,
      borderRadius: 12,
      paddingVertical: 16,
      alignItems: "center",
      marginTop: 8,
    },
    buttonDisabled: {
      opacity: 0.5,
    },
    resetButtonText: {
      color: "#FFFFFF",
      fontSize: 16,
      fontWeight: "600",
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
    },
    errorContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 24,
    },
    errorIcon: {
      fontSize: 48,
      fontWeight: "700",
      color: theme.colors.text.primary,
      backgroundColor: theme.colors.border,
      width: 80,
      height: 80,
      borderRadius: 40,
      textAlign: "center",
      lineHeight: 80,
      marginBottom: 24,
    },
    errorText: {
      fontSize: 16,
      color: theme.colors.text.secondary,
      textAlign: "center",
      marginBottom: 24,
      lineHeight: 24,
    },
  });
