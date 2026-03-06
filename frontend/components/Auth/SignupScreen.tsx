/**
 * Signup Screen Component
 *
 * Reusable signup screen with:
 * - Email/password registration
 * - Display name picker with discriminator
 * - Social OAuth providers (Google, Apple, X, Facebook, Instagram)
 * - "Skip" button for offline mode
 * - Link to login screen
 */

import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useSelector } from "@legendapp/state/react";
import { useUnifiedAuth } from "../../hooks/useUnifiedAuth";
import { authStore$ } from "../../state/bibleStore";
import { useTheme } from "../../contexts/ThemeContext";
import { SocialAuthButton } from "./SocialAuthButton";
import { validateEmail, validatePassword } from "../../utils/validation";
import { getAuthErrorMessage } from "../../utils/authErrorMessages";
import { ConfirmationModal } from "../ConfirmationModal";
import { Ionicons } from "@expo/vector-icons";
import type { Provider } from "@supabase/supabase-js";

interface SignupScreenProps {
  onSkip?: () => void;
  onSignupSuccess?: () => void;
  onSwitchToLogin?: () => void;
  promptMessage?: string;
}

export const SignupScreen: React.FC<SignupScreenProps> = ({
  onSkip,
  onSignupSuccess,
  onSwitchToLogin,
  promptMessage,
}) => {
  const router = useRouter();
  const { signUp, signInWithProvider, signInWithGoogle, signInWithApple, hasSignedInOnDevice, getUserProfile, getAndClearReturnUrl, isOnline } = useUnifiedAuth();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  // Track network state for disabling sign-up when offline
  const network = useSelector(authStore$.network);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<string | null>(null);

  // Modal state
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorTitle, setErrorTitle] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // Create theme-aware styles with safe area insets
  const styles = createStyles(theme, insets);

  const handleEmailSignup = async () => {
    // Client-side validation before API call

    // Email validation
    const emailError = validateEmail(email);
    if (emailError) {
      setErrorTitle("Invalid Email");
      setErrorMessage(emailError);
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

    setLoading(true);
    try {
      // Sign up with Supabase (display name will be set in onboarding)
      const result = await signUp(email, password, "");

      if (!result || !result.user) {
        throw new Error("Failed to create account");
      }

      if (__DEV__) {
        console.log("[Signup] Result:", {
          hasUser: !!result.user,
          hasSession: !!result.session,
          email: result.user.email,
        });
      }

      // Small delay to ensure any async operations complete
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Check if we have a session (email auto-confirmed or OAuth)
      if (result.session) {
        // Has session - email already verified, go to display name
        if (__DEV__) {
          console.log("[Signup] ✅ Session exists, navigating to display-name");
        }
        router.replace("/auth/display-name");
      } else {
        // No session - OTP verification required
        if (__DEV__) {
          console.log("[Signup] 🔐 No session, navigating to verify-otp");
        }
        router.replace({
          pathname: "/auth/verify-otp",
          params: { email: email },
        } as any);
      }
    } catch (error: any) {
      // Log error in development only
      if (__DEV__) {
        console.error("Signup error:", error);
      }

      // Show user-friendly error message
      const friendlyMessage = getAuthErrorMessage(error);
      setErrorTitle("Signup Failed");
      setErrorMessage(friendlyMessage);
      setShowErrorModal(true);
    } finally {
      setLoading(false);
    }
  };

  const handleSocialSignup = async (provider: Provider) => {
    setSocialLoading(provider);
    try {
      // Use native SDK for Google and Apple, fallback to OAuth for others
      if (provider === 'google') {
        const result = await signInWithGoogle();
        // Wait a moment for session to be fully persisted to AsyncStorage
        if (result?.session) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        // Check if user already has customized display name (existing user)
        const profile = await getUserProfile();
        if (profile?.user_display_names?.is_customized) {
          // Existing user - skip display name, go to destination
          const returnUrl = getAndClearReturnUrl();
          if (returnUrl) {
            router.replace(returnUrl as any);
          } else {
            router.replace("/(tabs)");
          }
        } else {
          // New user - needs display name setup
          router.replace("/auth/display-name");
        }
      } else if (provider === 'apple') {
        const result = await signInWithApple();
        // Wait a moment for session to be fully persisted to AsyncStorage
        if (result?.session) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        // Check if user already has customized display name (existing user)
        const profile = await getUserProfile();
        if (profile?.user_display_names?.is_customized) {
          // Existing user - skip display name, go to destination
          const returnUrl = getAndClearReturnUrl();
          if (returnUrl) {
            router.replace(returnUrl as any);
          } else {
            router.replace("/(tabs)");
          }
        } else {
          // New user - needs display name setup
          router.replace("/auth/display-name");
        }
      } else {
        // Twitter, Facebook, etc. use web-based OAuth
        await signInWithProvider(provider);
        // OAuth will redirect to display name picker if needed
      }
    } catch (error: any) {
      // Log error in development only
      if (__DEV__) {
        console.error(`${provider} signup error:`, error);
      }

      // Don't show error modal for user cancellation
      if (error.message?.includes('cancelled') || error.message?.includes('canceled')) {
        setSocialLoading(null);
        return;
      }

      // Show user-friendly error message
      const friendlyMessage = getAuthErrorMessage(error);
      setErrorTitle("Signup Failed");
      setErrorMessage(friendlyMessage);
      setShowErrorModal(true);
    } finally {
      setSocialLoading(null);
    }
  };

  const handleSkip = () => {
    if (onSkip) {
      onSkip();
    } else {
      router.back();
    }
  };

  const handleLoginPress = () => {
    if (onSwitchToLogin) {
      onSwitchToLogin();
    } else {
      router.replace("/auth/login" as any);
    }
  };

  return (
    <View style={styles.container}>
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
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>
              {promptMessage ||
                (!hasSignedInOnDevice
                  ? "Get started by creating your account"
                  : "Sign up to sync your notes and highlights across devices")}
            </Text>
          </View>

          {/* Offline Banner */}
          {!isOnline && (
            <View style={[styles.offlineBanner, { backgroundColor: theme.colors.background.secondary, borderColor: theme.colors.border }]}>
              <Ionicons name="cloud-offline-outline" size={20} color={theme.colors.text.muted} />
              <Text style={[styles.offlineBannerText, { color: theme.colors.text.muted }]}>
                Sign up requires internet connection
              </Text>
            </View>
          )}

          {/* Signup Form */}
          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="your@email.com"
                placeholderTextColor="#999"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
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

            <TouchableOpacity
              style={[styles.signupButton, (loading || !isOnline) && styles.buttonDisabled]}
              onPress={handleEmailSignup}
              disabled={loading || !isOnline}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.signupButtonText}>Create Account</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or sign up with</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Social Signup Buttons */}
          <View style={styles.socialButtons}>
            <SocialAuthButton
              provider="google"
              onPress={() => handleSocialSignup("google")}
              loading={socialLoading === "google"}
              disabled={loading || socialLoading !== null || !isOnline}
            />
            <SocialAuthButton
              provider="apple"
              onPress={() => handleSocialSignup("apple")}
              loading={socialLoading === "apple"}
              disabled={loading || socialLoading !== null || !isOnline}
            />
            <SocialAuthButton
              provider="twitter"
              onPress={() => handleSocialSignup("twitter")}
              loading={socialLoading === "twitter"}
              disabled={loading || socialLoading !== null || !isOnline}
            />
            <SocialAuthButton
              provider="facebook"
              onPress={() => handleSocialSignup("facebook")}
              loading={socialLoading === "facebook"}
              disabled={loading || socialLoading !== null || !isOnline}
            />
            {/* Instagram uses Facebook OAuth - configure through Facebook Developer Console */}
          </View>

          {/* Login Link */}
          <View style={styles.loginContainer}>
            <Text style={styles.loginText}>Already have an account? </Text>
            <TouchableOpacity onPress={handleLoginPress} disabled={loading}>
              <Text style={styles.loginLink}>Sign in</Text>
            </TouchableOpacity>
          </View>

          {/* Skip Button */}
          <TouchableOpacity
            style={styles.skipButton}
            onPress={handleSkip}
            disabled={loading}
          >
            <Text style={styles.skipButtonText}>Skip for now</Text>
          </TouchableOpacity>
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
    </View>
  );
};

const createStyles = (theme: any, insets: { top: number; bottom: number; left: number; right: number }) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background.primary,
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Math.max(24, insets.left + 24, insets.right + 24),
    paddingTop: Math.max(24, insets.top + 24),
    paddingBottom: Math.max(48, insets.bottom + 24),
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
  signupButton: {
    backgroundColor: theme.colors.interactive.button.background,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  signupButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: theme.colors.border,
  },
  dividerText: {
    marginHorizontal: 16,
    color: theme.colors.text.secondary,
    fontSize: 14,
  },
  socialButtons: {
    gap: 12,
  },
  loginContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 24,
  },
  loginText: {
    fontSize: 14,
    color: theme.colors.text.secondary,
  },
  loginLink: {
    fontSize: 14,
    color: theme.colors.interactive.button.background,
    fontWeight: "600",
  },
  skipButton: {
    alignItems: "center",
    marginTop: 24,
    paddingVertical: 12,
  },
  skipButtonText: {
    fontSize: 16,
    color: theme.colors.text.secondary,
    fontWeight: "500",
  },
  offlineBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
  },
  offlineBannerText: {
    fontSize: 14,
    fontWeight: "500",
  },
});
