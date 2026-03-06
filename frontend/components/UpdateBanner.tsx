/**
 * Update Banner Component
 *
 * Shows a banner when an OTA update is available.
 * Only visible in development and preview builds.
 * Prompts user to restart to apply the update.
 */

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from "react-native";
import * as Updates from "expo-updates";
import { useTheme } from "../contexts/ThemeContext";

export const UpdateBanner: React.FC = () => {
  const { theme } = useTheme();
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const slideAnim = useState(new Animated.Value(-100))[0];

  // Only show in dev/preview builds
  const isProduction = Updates.channel === "production";

  // Create theme-aware styles
  const styles = createStyles(theme);

  useEffect(() => {
    // Skip update checks in development builds (not supported)
    if (__DEV__ || isProduction) return;

    const checkForUpdate = async () => {
      try {
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
          // Download the update
          await Updates.fetchUpdateAsync();
          setUpdateAvailable(true);

          // Slide in the banner
          Animated.spring(slideAnim, {
            toValue: 0,
            useNativeDriver: true,
            tension: 50,
            friction: 8,
          }).start();
        }
      } catch (error) {
        // Silently fail - don't disrupt the user
        if (__DEV__) {
          console.log("[UpdateBanner] Check failed:", error);
        }
      }
    };

    // Check on mount
    checkForUpdate();

    // Also check periodically (every 5 minutes)
    const interval = setInterval(checkForUpdate, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [isProduction]);

  const handleRestart = async () => {
    setIsRestarting(true);
    try {
      await Updates.reloadAsync();
    } catch (error) {
      if (__DEV__) {
        console.error("[UpdateBanner] Restart failed:", error);
      }
      setIsRestarting(false);
    }
  };

  const handleDismiss = () => {
    Animated.timing(slideAnim, {
      toValue: -100,
      duration: 200,
      useNativeDriver: true,
    }).start(() => setUpdateAvailable(false));
  };

  // Don't render in dev/production or if no update
  if (__DEV__ || isProduction || !updateAvailable) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.container,
        { transform: [{ translateY: slideAnim }] },
      ]}
    >
      <View style={styles.content}>
        <Text style={styles.icon}>🚀</Text>
        <View style={styles.textContainer}>
          <Text style={styles.title}>Update Ready!</Text>
          <Text style={styles.subtitle}>Restart to get the latest version</Text>
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.dismissButton}
          onPress={handleDismiss}
          disabled={isRestarting}
        >
          <Text style={styles.dismissText}>Later</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.restartButton}
          onPress={handleRestart}
          disabled={isRestarting}
        >
          <Text style={styles.restartText}>
            {isRestarting ? "Restarting..." : "Restart Now"}
          </Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      paddingTop: 50, // Safe area
      paddingBottom: 16,
      paddingHorizontal: 16,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      zIndex: 9999,
      elevation: 10,
      backgroundColor: theme.colors.interactive.button.background,
      shadowColor: theme.colors.text.primary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
    },
    content: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
    },
    icon: {
      fontSize: 24,
      marginRight: 12,
    },
    textContainer: {
      flex: 1,
    },
    title: {
      color: theme.colors.interactive.button.text,
      fontSize: 16,
      fontWeight: "700",
    },
    subtitle: {
      color: theme.colors.interactive.button.text,
      opacity: 0.8,
      fontSize: 13,
    },
    actions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    dismissButton: {
      paddingVertical: 8,
      paddingHorizontal: 12,
    },
    dismissText: {
      color: theme.colors.interactive.button.text,
      opacity: 0.7,
      fontSize: 14,
      fontWeight: "500",
    },
    restartButton: {
      backgroundColor: theme.colors.background.primary,
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 20,
    },
    restartText: {
      color: theme.colors.text.primary,
      fontSize: 14,
      fontWeight: "600",
    },
  });
