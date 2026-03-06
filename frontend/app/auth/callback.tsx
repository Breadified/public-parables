/**
 * OAuth Callback Screen
 *
 * Handles OAuth authentication callbacks from providers like Google, Apple, etc.
 * Also handles email verification deep links.
 * Processes the auth tokens and redirects appropriately based on user state.
 */

import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams, useSegments } from "expo-router";
import { useUnifiedAuth } from "../../hooks/useUnifiedAuth";
import { useTheme } from "../../contexts/ThemeContext";
import { supabase } from "../../lib/supabase";

export default function CallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user, getUserProfile, getAndClearReturnUrl } = useUnifiedAuth();
  const { theme } = useTheme();
  const [error, setError] = useState<string | null>(null);

  // Create theme-aware styles
  const styles = createStyles(theme);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        if (__DEV__) {
          console.log('[Callback] Starting callback handler');
          console.log('[Callback] URL params:', params);
        }

        // FALLBACK: Manual token extraction from URL parameters
        // This handles cases where detectSessionInUrl might not work
        const { access_token, refresh_token, type, error: urlError } = params;

        if (urlError) {
          if (__DEV__) {
            console.error('[Callback] URL contains error:', urlError);
          }
          setError(`Authentication error: ${urlError}`);
          setTimeout(() => router.replace("/auth/login"), 2000);
          return;
        }

        // If we have tokens in URL, manually set the session
        if (access_token && refresh_token) {
          if (__DEV__) {
            console.log('[Callback] Found tokens in URL, setting session manually');
          }

          const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
            access_token: access_token as string,
            refresh_token: refresh_token as string,
          });

          if (sessionError) {
            console.error('[Callback] Error setting session:', sessionError);
            throw sessionError;
          }

          if (__DEV__) {
            console.log('[Callback] Session set successfully:', !!sessionData.session);
          }
        }

        // Wait for Supabase to process the auth state change
        // detectSessionInUrl might have already handled this
        await new Promise((resolve) => setTimeout(resolve, 1500));

        // Check if user is authenticated
        if (!user) {
          if (__DEV__) {
            console.log('[Callback] No user found after waiting, checking session directly');
          }

          // Double-check session directly
          const { data: { session } } = await supabase.auth.getSession();

          if (!session) {
            setError("Authentication failed. Please try again.");
            setTimeout(() => router.replace("/auth/login"), 2000);
            return;
          }
        }

        if (__DEV__) {
          console.log('[Callback] User authenticated, checking profile');
        }

        // Check if user has customized their display name
        const profile = await getUserProfile();

        // If user hasn't customized their display name, send to onboarding
        // Auto-generated display names have is_customized = false
        if (!profile?.user_display_names?.is_customized) {
          if (__DEV__) {
            console.log('[Callback] Display name not customized, redirecting to customization screen');
          }
          router.replace("/auth/display-name");
          return;
        }

        if (__DEV__) {
          console.log('[Callback] User has display name, navigating to app');
        }

        // Get the return URL (where user was trying to go before auth)
        const returnUrl = getAndClearReturnUrl();

        // Navigate to original destination or default to tabs
        if (returnUrl) {
          router.replace(returnUrl as any);
        } else {
          router.replace("/(tabs)");
        }
      } catch (err: any) {
        console.error("[Callback] Error:", err);
        setError("An error occurred. Redirecting to login...");
        setTimeout(() => router.replace("/auth/login"), 2000);
      }
    };

    handleCallback();
  }, [user, getUserProfile, getAndClearReturnUrl, router, params]);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.content}>
        {error ? (
          <>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorText}>{error}</Text>
          </>
        ) : (
          <>
            <ActivityIndicator size="large" color={theme.colors.interactive.button.background} />
            <Text style={styles.loadingText}>Completing sign in...</Text>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background.primary,
    },
    content: {
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
    errorIcon: {
      fontSize: 48,
      marginBottom: 16,
    },
    errorText: {
      fontSize: 16,
      color: theme.colors.text.secondary,
      textAlign: "center",
    },
  });
