/**
 * Auth Gate Component
 *
 * Wraps protected features and shows auth modal for unauthenticated users.
 * Allows users to sign in, sign up, or skip to continue offline.
 *
 * Usage:
 * <AuthGate feature="notes">
 *   <NoteCreationForm />
 * </AuthGate>
 */

import React, { useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useRouter, usePathname } from "expo-router";
import { useUnifiedAuth } from "../../hooks/useUnifiedAuth";

interface AuthGateProps {
  children: React.ReactNode;
  feature: string; // e.g., "notes", "bookmarks", "highlights"
  promptMessage?: string;
  blockOfflineAccess?: boolean; // If true, blocks access instead of just prompting
}

export const AuthGate: React.FC<AuthGateProps> = ({
  children,
  feature,
  promptMessage,
  blockOfflineAccess = false,
}) => {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, setReturnUrl } = useUnifiedAuth();

  const handleNavigateToAuth = useCallback((mode: "login" | "signup") => {
    // Save current pathname as return URL
    if (__DEV__) {
      console.log("[AuthGate] Setting return URL:", pathname);
    }
    setReturnUrl(pathname);
    // Navigate to auth screen
    router.push(mode === "login" ? "/auth/login" : "/auth/signup");
  }, [pathname, setReturnUrl, router]);

  // If user is authenticated, render children directly
  if (isAuthenticated) {
    return <>{children}</>;
  }

  // If blockOfflineAccess is true, show a prompt instead of rendering children
  if (blockOfflineAccess) {
    return (
      <View style={styles.blockedContainer}>
        <Text style={styles.blockedTitle}>Sign in required</Text>
        <Text style={styles.blockedMessage}>
          {promptMessage ||
            `Sign in or create an account to access ${feature}.`}
        </Text>

        <TouchableOpacity
          style={styles.signInButton}
          onPress={() => handleNavigateToAuth("login")}
        >
          <Text style={styles.signInButtonText}>Sign In</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.signUpButton}
          onPress={() => handleNavigateToAuth("signup")}
        >
          <Text style={styles.signUpButtonText}>Create Account</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Render children with auth prompt banner
  return (
    <View style={styles.container}>
      {/* Auth Prompt Banner */}
      <View style={styles.banner}>
        <View style={styles.bannerContent}>
          <Text style={styles.bannerText}>
            {promptMessage ||
              `Sign in to sync your ${feature} across devices`}
          </Text>
          <View style={styles.bannerButtons}>
            <TouchableOpacity
              style={styles.bannerSignInButton}
              onPress={() => handleNavigateToAuth("login")}
            >
              <Text style={styles.bannerSignInButtonText}>Sign In</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.bannerSignUpButton}
              onPress={() => handleNavigateToAuth("signup")}
            >
              <Text style={styles.bannerSignUpButtonText}>Sign Up</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Protected Content */}
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  banner: {
    backgroundColor: "#007AFF",
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  bannerContent: {
    flexDirection: "column",
    gap: 12,
  },
  bannerText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center",
  },
  bannerButtons: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
  },
  bannerSignInButton: {
    backgroundColor: "#FFFFFF",
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  bannerSignInButtonText: {
    color: "#007AFF",
    fontSize: 14,
    fontWeight: "600",
  },
  bannerSignUpButton: {
    backgroundColor: "transparent",
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#FFFFFF",
  },
  bannerSignUpButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  blockedContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
    backgroundColor: "#F8F8F8",
  },
  blockedTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#000",
    marginBottom: 12,
  },
  blockedMessage: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginBottom: 32,
    lineHeight: 24,
  },
  signInButton: {
    backgroundColor: "#007AFF",
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: "100%",
    maxWidth: 300,
    alignItems: "center",
    marginBottom: 12,
  },
  signInButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  signUpButton: {
    backgroundColor: "transparent",
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: "100%",
    maxWidth: 300,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#007AFF",
  },
  signUpButtonText: {
    color: "#007AFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
