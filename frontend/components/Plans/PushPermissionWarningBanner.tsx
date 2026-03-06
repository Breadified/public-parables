/**
 * PushPermissionWarningBanner - Warning when notifications are off but reminder is enabled
 * Prompts user to enable notifications in device settings
 */

import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@/contexts/ThemeContext";

export const PushPermissionWarningBanner: React.FC = () => {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  const handleEnableNotifications = async () => {
    try {
      if (Platform.OS === "ios") {
        await Linking.openURL("app-settings:");
      } else {
        await Linking.openSettings();
      }
    } catch (error) {
      console.error("[PushPermissionWarningBanner] Failed to open settings:", error);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons
            name="warning-outline"
            size={18}
            color={theme.colors.icons.warning}
          />
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.title}>Notifications are off</Text>
          <Text style={styles.subtitle}>
            Enable them to receive your daily reading reminders
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.enableButton}
        onPress={handleEnableNotifications}
      >
        <Text style={styles.enableButtonText}>Enable</Text>
        <Ionicons
          name="open-outline"
          size={14}
          color={theme.colors.interactive.button.icon}
        />
      </TouchableOpacity>
    </View>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      backgroundColor: theme.colors.background.warning || theme.colors.background.secondary,
      marginHorizontal: 16,
      marginTop: 12,
      marginBottom: 8,
      padding: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.border.warning || theme.colors.border.light,
    },
    content: {
      flexDirection: "row",
      alignItems: "flex-start",
      marginBottom: 12,
    },
    iconContainer: {
      marginRight: 10,
      marginTop: 2,
    },
    textContainer: {
      flex: 1,
    },
    title: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.text.primary,
      marginBottom: 2,
    },
    subtitle: {
      fontSize: 13,
      color: theme.colors.text.secondary,
      lineHeight: 18,
    },
    enableButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.interactive.button.background,
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 8,
      gap: 6,
    },
    enableButtonText: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.interactive.button.icon,
    },
  });
