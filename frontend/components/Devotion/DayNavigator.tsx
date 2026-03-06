/**
 * DayNavigator - Date navigation with arrows and calendar picker
 * Features: Previous/Next day arrows, calendar modal for date selection
 * Shows completion checkmark with rotating halo when today's devotion is complete
 */

import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { observer, useSelector } from "@legendapp/state/react";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@/contexts/ThemeContext";
import { devotionStore$, formattedDate$, isToday$ } from "@/state";
import { isSelectedDateComplete$ } from "@/state/devotionStore";
import CheckmarkIcon from "@/components/Shared/CheckmarkIcon";
import { RotatingHalo } from "@/components/Shared";

import CalendarPickerModal from "./CalendarPickerModal";

const CHECKMARK_SIZE = 18;
const HALO_SIZE = 26;

const DayNavigator = observer(function DayNavigator() {
  const { theme } = useTheme();
  const gamification = theme.colors.gamification;

  const formattedDate = useSelector(formattedDate$);
  const isToday = useSelector(isToday$);
  const selectedDate = useSelector(devotionStore$.selectedDate);
  const isSelectedDateCompleted = useSelector(isSelectedDateComplete$);

  // Show checkmark if the selected date is complete (from server-synced data)
  const isDevotionComplete = isSelectedDateCompleted;

  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const canGoNext = devotionStore$.canGoToNextDay();

  const handlePrevDay = () => {
    devotionStore$.goToPreviousDay();
  };

  const handleNextDay = () => {
    if (canGoNext) {
      devotionStore$.goToNextDay();
    }
  };

  const handleDateSelect = (dateStr: string) => {
    devotionStore$.setSelectedDate(dateStr);
    setIsCalendarOpen(false);
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.background.primary,
          borderBottomColor: theme.colors.border,
        },
      ]}
    >
      {/* Previous Day Button */}
      <Pressable onPress={handlePrevDay} style={styles.arrowButton}>
        <Ionicons
          name="chevron-back"
          size={24}
          color={theme.colors.text.primary}
        />
      </Pressable>

      {/* Date Display - Tap to open calendar */}
      <Pressable
        onPress={() => setIsCalendarOpen(true)}
        style={styles.dateContainer}
      >
        {/* Checkmark with rotating halo for completed devotion */}
        {isDevotionComplete && (
          <View style={styles.checkmarkWrapper}>
            <RotatingHalo
              size={HALO_SIZE}
              startColor={gamification.nodeComplete}
              endColor={gamification.progressGlow}
            />
            <View style={styles.checkmarkInner}>
              <CheckmarkIcon
                size={CHECKMARK_SIZE}
                color={gamification.nodeComplete}
              />
            </View>
          </View>
        )}
        <Text style={[styles.dateText, { color: theme.colors.text.primary }]}>
          {isToday ? "Today" : formattedDate}
        </Text>
        {isToday && (
          <Text style={[styles.fullDate, { color: theme.colors.text.muted }]}>
            {formattedDate}
          </Text>
        )}
        <Ionicons
          name="calendar-outline"
          size={16}
          color={theme.colors.text.muted}
          style={styles.calendarIcon}
        />
      </Pressable>

      {/* Next Day Button */}
      <Pressable
        onPress={handleNextDay}
        style={[styles.arrowButton, !canGoNext && styles.arrowDisabled]}
        disabled={!canGoNext}
      >
        <Ionicons
          name="chevron-forward"
          size={24}
          color={canGoNext ? theme.colors.text.primary : theme.colors.text.muted}
        />
      </Pressable>

      {/* Calendar Picker Modal */}
      <CalendarPickerModal
        visible={isCalendarOpen}
        onClose={() => setIsCalendarOpen(false)}
        onSelectDate={handleDateSelect}
        selectedDate={selectedDate}
      />
    </View>
  );
});

export default DayNavigator;

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  arrowButton: {
    padding: 8,
  },
  arrowDisabled: {
    opacity: 0.3,
  },
  dateContainer: {
    flex: 1,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  dateText: {
    fontSize: 16,
    fontWeight: "600",
  },
  fullDate: {
    fontSize: 12,
  },
  calendarIcon: {
    marginLeft: 4,
  },
  checkmarkWrapper: {
    width: HALO_SIZE,
    height: HALO_SIZE,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 4,
  },
  checkmarkInner: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
});
