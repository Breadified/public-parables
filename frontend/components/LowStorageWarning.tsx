/**
 * Low Storage Warning Screen
 *
 * Shows a blocking screen when device storage is low.
 * The app requires approximately 1GB to function properly,
 * so we warn users if they have less than 2GB free.
 *
 * This screen appears BEFORE app initialization to prevent
 * the app from failing due to insufficient storage.
 */

import React, { useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Platform,
  useColorScheme,
} from "react-native";
import { getTheme } from "@/config/theme";
import { formatBytes, type StorageInfo } from "@/utils/storageCheck";

interface LowStorageWarningProps {
  storageInfo: StorageInfo;
  onContinue: () => void;
}

export const LowStorageWarning: React.FC<LowStorageWarningProps> = ({
  storageInfo,
  onContinue,
}) => {
  const systemColorScheme = useColorScheme();
  const themeMode = systemColorScheme === "dark" ? "dark" : "light";
  const theme = useMemo(() => getTheme(themeMode), [themeMode]);
  const styles = useMemo(() => createStyles(theme), [theme]);

  const isCritical = storageInfo.isCritical;

  const handleOpenSettings = () => {
    if (Platform.OS === "ios") {
      // iOS storage settings
      Linking.openURL("App-prefs:General&path=STORAGE_ICLOUD_USAGE/DEVICE_STORAGE").catch(() => {
        Linking.openSettings();
      });
    } else {
      Linking.openSettings();
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={[styles.iconContainer, isCritical && styles.iconCritical]}>
          <Text style={styles.icon}>{isCritical ? "!!" : "!"}</Text>
        </View>

        <Text style={styles.title}>
          {isCritical ? "Storage Critically Low" : "Low Storage Warning"}
        </Text>

        <View style={styles.storageInfo}>
          <Text style={styles.storageValue}>
            {formatBytes(storageInfo.freeBytes)}
          </Text>
          <Text style={styles.storageLabel}>
            free of {formatBytes(storageInfo.totalBytes)}
          </Text>
        </View>

        <Text style={styles.description}>
          {isCritical
            ? "Your device has very little storage remaining. Parables Bible requires approximately 1GB to store Bible data and may not work properly."
            : "Your device is running low on storage. For the best experience, we recommend having at least 2GB of free space."}
        </Text>

        <Text style={styles.recommendation}>
          {isCritical
            ? "You must free up at least 1.5GB of space to use the app."
            : "Consider freeing up some space to ensure smooth performance."}
        </Text>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={handleOpenSettings}
          >
            <Text style={styles.settingsText}>Manage Storage</Text>
          </TouchableOpacity>

          {/* Only show Continue button for amber warning, not critical */}
          {!isCritical && (
            <TouchableOpacity
              style={styles.continueButton}
              onPress={onContinue}
            >
              <Text style={styles.continueText}>Continue</Text>
            </TouchableOpacity>
          )}
        </View>

        {isCritical && (
          <Text style={styles.warningNote}>
            Free up storage and reopen the app to continue.
          </Text>
        )}
      </View>
    </View>
  );
};

const createStyles = (theme: ReturnType<typeof getTheme>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: theme.colors.background.primary,
      paddingHorizontal: 24,
    },
    content: {
      alignItems: "center",
      maxWidth: 340,
    },
    iconContainer: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: "#F59E0B", // Amber
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 24,
    },
    iconCritical: {
      backgroundColor: "#EF4444", // Red
    },
    icon: {
      fontSize: 36,
      color: "#FFF",
      fontWeight: "bold",
    },
    title: {
      fontSize: 24,
      fontWeight: "bold",
      color: theme.colors.text.primary,
      marginBottom: 16,
      textAlign: "center",
      fontFamily: theme.typography.fontFamily.sansSerif,
    },
    storageInfo: {
      alignItems: "center",
      marginBottom: 20,
      paddingVertical: 12,
      paddingHorizontal: 20,
      backgroundColor: theme.mode === "dark" ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
      borderRadius: 12,
    },
    storageValue: {
      fontSize: 32,
      fontWeight: "bold",
      color: theme.colors.text.primary,
      fontFamily: theme.typography.fontFamily.mono,
    },
    storageLabel: {
      fontSize: 14,
      color: theme.colors.text.secondary,
      marginTop: 4,
      fontFamily: theme.typography.fontFamily.sansSerif,
    },
    description: {
      fontSize: 16,
      color: theme.colors.text.secondary,
      textAlign: "center",
      lineHeight: 24,
      marginBottom: 12,
      fontFamily: theme.typography.fontFamily.sansSerif,
    },
    recommendation: {
      fontSize: 14,
      color: theme.colors.text.muted,
      textAlign: "center",
      marginBottom: 32,
      fontStyle: "italic",
      fontFamily: theme.typography.fontFamily.sansSerif,
    },
    actions: {
      width: "100%",
      gap: 12,
    },
    settingsButton: {
      backgroundColor: theme.colors.interactive.button.background,
      paddingVertical: 14,
      paddingHorizontal: 24,
      borderRadius: 12,
      alignItems: "center",
    },
    settingsText: {
      color: theme.colors.interactive.button.icon,
      fontSize: 16,
      fontWeight: "600",
      fontFamily: theme.typography.fontFamily.sansSerif,
    },
    continueButton: {
      backgroundColor: "transparent",
      paddingVertical: 14,
      paddingHorizontal: 24,
      borderRadius: 12,
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    continueText: {
      color: theme.colors.text.secondary,
      fontSize: 16,
      fontWeight: "500",
      fontFamily: theme.typography.fontFamily.sansSerif,
    },
    warningNote: {
      marginTop: 20,
      fontSize: 12,
      color: "#EF4444",
      textAlign: "center",
      fontFamily: theme.typography.fontFamily.sansSerif,
    },
  });
