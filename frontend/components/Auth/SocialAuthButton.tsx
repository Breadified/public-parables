/**
 * Social Auth Button Component
 *
 * Standards-compliant social authentication buttons.
 * - Apple: Uses expo-apple-authentication native button (iOS only, App Store requirement)
 * - Google, Facebook, X: Custom buttons with official FontAwesome icons + OAuth redirect
 */

import React from "react";
import {
  TouchableOpacity,
  Text,
  View,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from "react-native";
import { Provider } from "@supabase/supabase-js";
import * as AppleAuthentication from "expo-apple-authentication";
import { FontAwesome } from "@expo/vector-icons";

interface SocialAuthButtonProps {
  provider: Provider;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}

/**
 * Custom button configuration for OAuth providers
 * Using official brand colors and FontAwesome icons
 */
const CUSTOM_PROVIDER_CONFIG: Record<
  string,
  {
    label: string;
    iconName: keyof typeof FontAwesome.glyphMap;
    color: string;
    textColor: string;
  }
> = {
  google: {
    label: "Continue with Google",
    iconName: "google",
    color: "#FFFFFF", // Google white background
    textColor: "#1F1F1F", // Google dark text
  },
  facebook: {
    label: "Continue with Facebook",
    iconName: "facebook",
    color: "#1877F2", // Official Facebook Blue
    textColor: "#FFFFFF",
  },
  twitter: {
    label: "Continue with X",
    iconName: "twitter", // Using Twitter icon (X not available in FontAwesome yet)
    color: "#000000", // Official X black
    textColor: "#FFFFFF",
  },
};

export const SocialAuthButton: React.FC<SocialAuthButtonProps> = ({
  provider,
  onPress,
  loading = false,
  disabled = false,
}) => {
  // Apple Sign In Button (iOS only - App Store requirement)
  if (provider === "apple" && Platform.OS === "ios") {
    return (
      <View style={styles.nativeButtonContainer}>
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
          cornerRadius={12}
          style={styles.appleButton}
          onPress={onPress}
        />
        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator color="#FFFFFF" />
          </View>
        )}
      </View>
    );
  }

  // Apple on non-iOS platforms - don't show
  if (provider === "apple" && Platform.OS !== "ios") {
    return null;
  }

  // Custom buttons for Google, Facebook, X/Twitter
  const config = CUSTOM_PROVIDER_CONFIG[provider as string];

  if (!config) {
    // Fallback for unknown providers
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled || loading}
        style={[styles.button, styles.fallbackButton]}
        activeOpacity={0.7}
      >
        <Text style={styles.fallbackText}>
          Continue with {provider}
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.button,
        { backgroundColor: config.color },
        (disabled || loading) && styles.disabled,
        // Add border for white Google button
        provider === "google" && styles.googleBorder,
      ]}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator
          color={config.textColor}
          style={styles.loadingIndicator}
        />
      ) : (
        <>
          <View style={styles.iconContainer}>
            <FontAwesome
              name={config.iconName}
              size={20}
              color={config.textColor}
            />
          </View>
          <Text style={[styles.label, { color: config.textColor }]}>
            {config.label}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  // Container for native Apple button
  nativeButtonContainer: {
    width: "100%",
    position: "relative",
  },

  // Apple button specific styles
  appleButton: {
    width: "100%",
    height: 52,
  },

  // Loading overlay for native buttons
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 12,
  },

  // Custom button styles (Google, Facebook, X/Twitter)
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    minHeight: 52,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },

  // Google-specific border (white button needs visible border)
  googleBorder: {
    borderWidth: 1,
    borderColor: "#747775",
  },

  disabled: {
    opacity: 0.5,
  },
  iconContainer: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    flex: 1,
    textAlign: "center",
  },
  loadingIndicator: {
    marginRight: 0,
  },

  // Fallback button for unknown providers
  fallbackButton: {
    backgroundColor: "#666666",
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.1)",
  },
  fallbackText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
