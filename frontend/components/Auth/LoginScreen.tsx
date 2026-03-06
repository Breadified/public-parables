/**
 * Login Screen Component
 *
 * Reusable login screen with:
 * - Email/password authentication
 * - Social OAuth providers (Google, Apple, X, Facebook, Instagram)
 * - "Skip" button for offline mode
 * - Link to signup screen
 */

import React, { useState, useEffect, useRef } from "react";
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
import { validateEmail } from "../../utils/validation";
import { getAuthErrorMessage } from "../../utils/authErrorMessages";
import { ConfirmationModal } from "../ConfirmationModal";
import { Ionicons } from "@expo/vector-icons";
import type { Provider } from "@supabase/supabase-js";

interface LoginScreenProps {
  onSkip?: () => void;
  onLoginSuccess?: () => void;
  onSwitchToSignup?: () => void;
  promptMessage?: string;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onSkip,
  onLoginSuccess,
  onSwitchToSignup,
  promptMessage,
}) => {
  const router = useRouter();
  const { signIn, signInWithProvider, signInWithGoogle, signInWithApple, hasSignedInOnDevice, getUserProfile, isAuthenticated, isOnline } = useUnifiedAuth();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  // Track network state for disabling sign-in when offline
  const network = useSelector(authStore$.network);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<string | null>(null);

  // Track if login was attempted (to distinguish from already-logged-in state)
  const loginAttempted = useRef(false);
  // Track initial auth state to detect changes
  const initialAuthState = useRef(isAuthenticated);

  // Modal state
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorTitle, setErrorTitle] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // Create theme-aware styles with safe area insets
  const styles = createStyles(theme, insets);

  // Auto-close when auth state changes to authenticated after a login attempt
  useEffect(() => {
    // Only trigger if:
    // 1. User is now authenticated
    // 2. They weren't authenticated when the screen mounted
    // 3. A login was attempted (prevents auto-close if user was already logged in)
    if (isAuthenticated && !initialAuthState.current && loginAttempted.current) {
      if (__DEV__) {
        console.log('[LoginScreen] Auth state changed to authenticated, checking display name');
      }

      // Check if user needs to set display name before entering app
      const checkAndNavigate = async () => {
        try {
          const profile = await getUserProfile();
          if (!profile?.user_display_names?.is_customized) {
            if (__DEV__) {
              console.log('[LoginScreen] Display name not customized, redirecting to setup');
            }
            router.replace("/auth/display-name");
            return;
          }
        } catch (error) {
          // On error, still let user in - tabs layout will catch it
          if (__DEV__) {
            console.error('[LoginScreen] Error checking display name:', error);
          }
        }

        // Display name is set, proceed normally
        if (onLoginSuccess) {
          onLoginSuccess();
        } else {
          router.back();
        }
      };

      // Small delay to ensure state is fully updated
      setTimeout(checkAndNavigate, 100);
    }
  }, [isAuthenticated, onLoginSuccess, router, getUserProfile]);

  const handleEmailLogin = async () => {
    // Client-side validation before API call
    const emailError = validateEmail(email);
    if (emailError) {
      setErrorTitle("Invalid Email");
      setErrorMessage(emailError);
      setShowErrorModal(true);
      return;
    }

    if (!password || password.trim().length === 0) {
      setErrorTitle("Password Required");
      setErrorMessage("Please enter your password");
      setShowErrorModal(true);
      return;
    }

    setLoading(true);
    loginAttempted.current = true;
    try {
      await signIn(email, password);
      // onLoginSuccess is now handled by useEffect watching isAuthenticated
    } catch (error: any) {
      // Log error in development only
      if (__DEV__) {
        console.error("Login error:", error);
      }

      // Show user-friendly error message
      const friendlyMessage = getAuthErrorMessage(error);
      setErrorTitle("Login Failed");
      setErrorMessage(friendlyMessage);
      setShowErrorModal(true);
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = async (provider: Provider) => {
    setSocialLoading(provider);
    loginAttempted.current = true;
    try {
      // Use native SDK for Google and Apple, fallback to OAuth for others
      if (provider === 'google') {
        await signInWithGoogle();
        // Check if user needs to set display name
        const profile = await getUserProfile();
        if (!profile?.user_display_names?.is_customized) {
          router.replace("/auth/display-name");
          return;
        }
        // onLoginSuccess is now handled by useEffect watching isAuthenticated
      } else if (provider === 'apple') {
        await signInWithApple();
        // Check if user needs to set display name
        const profile = await getUserProfile();
        if (!profile?.user_display_names?.is_customized) {
          router.replace("/auth/display-name");
          return;
        }
        // onLoginSuccess is now handled by useEffect watching isAuthenticated
      } else {
        // Twitter, Facebook, etc. use web-based OAuth
        await signInWithProvider(provider);
        // OAuth will redirect, success handled by callback
      }
    } catch (error: any) {
      // Log error in development only
      if (__DEV__) {
        console.error(`${provider} login error:`, error);
      }

      // Don't show error modal for user cancellation
      if (error.message?.includes('cancelled') || error.message?.includes('canceled')) {
        setSocialLoading(null);
        return;
      }

      // Show user-friendly error message
      const friendlyMessage = getAuthErrorMessage(error);
      setErrorTitle("Login Failed");
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

  const handleSignupPress = () => {
    if (onSwitchToSignup) {
      onSwitchToSignup();
    } else {
      router.replace("/auth/signup" as any);
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
            <Text style={styles.title}>
              {hasSignedInOnDevice ? "Welcome Back" : "Welcome"}
            </Text>
            <Text style={styles.subtitle}>
              {promptMessage ||
                (hasSignedInOnDevice
                  ? "Sign in to continue"
                  : "Sign in to get started")}
            </Text>
          </View>

          {/* Offline Banner */}
          {!isOnline && (
            <View style={[styles.offlineBanner, { backgroundColor: theme.colors.background.secondary, borderColor: theme.colors.border }]}>
              <Ionicons name="cloud-offline-outline" size={20} color={theme.colors.text.muted} />
              <Text style={[styles.offlineBannerText, { color: theme.colors.text.muted }]}>
                Sign in requires internet connection
              </Text>
            </View>
          )}

          {/* Email/Password Form */}
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
                returnKeyType="next"
                blurOnSubmit={false}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={styles.passwordInput}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  placeholderTextColor="#999"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!loading}
                  returnKeyType="go"
                  onSubmitEditing={handleEmailLogin}
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
              style={[styles.loginButton, (loading || !isOnline) && styles.buttonDisabled]}
              onPress={handleEmailLogin}
              disabled={loading || !isOnline}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.loginButtonText}>Sign In</Text>
              )}
            </TouchableOpacity>

            {/* Forgot Password */}
            <TouchableOpacity
              style={styles.forgotPassword}
              onPress={() => router.push("/auth/forgot-password" as any)}
              disabled={loading}
            >
              <Text style={styles.forgotPasswordText}>Forgot password?</Text>
            </TouchableOpacity>
          </View>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or continue with</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Social Login Buttons */}
          <View style={styles.socialButtons}>
            <SocialAuthButton
              provider="google"
              onPress={() => handleSocialLogin("google")}
              loading={socialLoading === "google"}
              disabled={loading || socialLoading !== null || !isOnline}
            />
            <SocialAuthButton
              provider="apple"
              onPress={() => handleSocialLogin("apple")}
              loading={socialLoading === "apple"}
              disabled={loading || socialLoading !== null || !isOnline}
            />
            <SocialAuthButton
              provider="twitter"
              onPress={() => handleSocialLogin("twitter")}
              loading={socialLoading === "twitter"}
              disabled={loading || socialLoading !== null || !isOnline}
            />
            <SocialAuthButton
              provider="facebook"
              onPress={() => handleSocialLogin("facebook")}
              loading={socialLoading === "facebook"}
              disabled={loading || socialLoading !== null || !isOnline}
            />
            {/* Instagram uses Facebook OAuth - configure through Facebook Developer Console */}
          </View>

          {/* Sign Up Link */}
          <View style={styles.signupContainer}>
            <Text style={styles.signupText}>Don&apos;t have an account? </Text>
            <TouchableOpacity onPress={handleSignupPress} disabled={loading}>
              <Text style={styles.signupLink}>Sign up</Text>
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
  loginButton: {
    backgroundColor: theme.colors.interactive.button.background,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  loginButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  forgotPassword: {
    alignItems: "center",
    marginTop: 16,
  },
  forgotPasswordText: {
    color: theme.colors.interactive.button.background,
    fontSize: 14,
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
  signupContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 24,
  },
  signupText: {
    fontSize: 14,
    color: theme.colors.text.secondary,
  },
  signupLink: {
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
