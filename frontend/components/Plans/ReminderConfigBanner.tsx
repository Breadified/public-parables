/**
 * ReminderConfigBanner - Shows at top of reading content when reminder is not set
 * Allows users to quickly configure daily reading plan reminders
 */

import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { observer, useSelector } from "@legendapp/state/react";

import { useTheme } from "@/contexts/ThemeContext";
import { useToast } from "@/contexts/ToastContext";
import { planStore$, planReminderPreferences$ } from "@/state/planStore";
import { enablePlanReminder } from "@/services/planReminderService";
import { TimePickerModal } from "./TimePickerModal";

interface ReminderConfigBannerProps {
  onConfigured?: () => void;
}

function formatTime(hour: number, minute: number): string {
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  const displayMinute = String(minute).padStart(2, "0");
  return `${displayHour}:${displayMinute} ${period}`;
}

export const ReminderConfigBanner = observer(function ReminderConfigBanner({
  onConfigured,
}: ReminderConfigBannerProps) {
  const { theme } = useTheme();
  const { showToast } = useToast();
  const styles = createStyles(theme);

  const prefs = useSelector(planReminderPreferences$);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const [selectedHour, setSelectedHour] = useState(prefs.reminderHour);
  const [selectedMinute, setSelectedMinute] = useState(prefs.reminderMinute);

  // Hide immediately if reminder is already enabled
  if (isHidden || prefs.reminderEnabled) {
    return null;
  }

  const handleSetReminder = async () => {
    setIsLoading(true);
    try {
      const success = await enablePlanReminder(selectedHour, selectedMinute);
      if (success) {
        setIsHidden(true); // Immediately hide the banner
        showToast({
          message: "Reminder set!",
          subtitle: `Daily at ${formatTime(selectedHour, selectedMinute)}`,
          type: "success",
          duration: 2500,
        });
        onConfigured?.();
      } else {
        showToast({
          message: "Enable notifications in Settings",
          type: "info",
          duration: 3500,
        });
      }
    } catch (error) {
      console.error("[ReminderConfigBanner] Error setting reminder:", error);
      showToast({
        message: "Failed to set reminder",
        type: "warning",
        duration: 2500,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDismiss = () => {
    setIsHidden(true); // Immediately hide the banner
    planStore$.dismissReminderBanner();
    showToast({
      message: "You can set reminders in Settings",
      emoji: "⚙️",
      type: "info",
      duration: 4000,
    });
  };

  const handleTimeSelected = (hour: number, minute: number) => {
    setSelectedHour(hour);
    setSelectedMinute(minute);
    setShowTimePicker(false);
  };

  return (
    <>
      <View style={styles.container}>
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <Ionicons
              name="notifications-outline"
              size={20}
              color={theme.colors.icons.accent}
            />
          </View>
          <View style={styles.textContainer}>
            <Text style={styles.title}>Set a daily reading reminder</Text>
            <Text style={styles.subtitle}>Stay consistent with your plan</Text>
          </View>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.timeButton}
            onPress={() => setShowTimePicker(true)}
            disabled={isLoading}
          >
            <Ionicons
              name="time-outline"
              size={16}
              color={theme.colors.text.secondary}
            />
            <Text style={styles.timeText}>
              {formatTime(selectedHour, selectedMinute)}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.setButton, isLoading && styles.setButtonDisabled]}
            onPress={handleSetReminder}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator
                size="small"
                color={theme.colors.background.primary}
              />
            ) : (
              <Text style={styles.setButtonText}>Set</Text>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.dismissButton}
          onPress={handleDismiss}
          disabled={isLoading}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close" size={18} color={theme.colors.text.muted} />
        </TouchableOpacity>
      </View>

      <TimePickerModal
        visible={showTimePicker}
        hour={selectedHour}
        minute={selectedMinute}
        onConfirm={handleTimeSelected}
        onCancel={() => setShowTimePicker(false)}
      />
    </>
  );
});

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      backgroundColor: theme.colors.background.secondary,
      marginHorizontal: 16,
      marginTop: 12,
      marginBottom: 8,
      padding: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.border.light,
    },
    content: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 12,
    },
    iconContainer: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.colors.background.tertiary,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12,
    },
    textContainer: {
      flex: 1,
    },
    title: {
      fontSize: 15,
      fontWeight: "600",
      color: theme.colors.text.primary,
      marginBottom: 2,
    },
    subtitle: {
      fontSize: 13,
      color: theme.colors.text.secondary,
    },
    actions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    timeButton: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.background.primary,
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.colors.border.light,
      gap: 6,
    },
    timeText: {
      fontSize: 14,
      fontWeight: "500",
      color: theme.colors.text.primary,
    },
    setButton: {
      backgroundColor: theme.colors.interactive.button.background,
      paddingVertical: 10,
      paddingHorizontal: 20,
      borderRadius: 8,
      minWidth: 70,
      alignItems: "center",
    },
    setButtonDisabled: {
      opacity: 0.7,
    },
    setButtonText: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.interactive.button.icon,
    },
    dismissButton: {
      position: "absolute",
      top: 10,
      right: 10,
      padding: 4,
    },
  });
