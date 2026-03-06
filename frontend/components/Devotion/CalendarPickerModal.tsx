/**
 * CalendarPickerModal - Full calendar for date selection
 * Features: Month navigation, cannot select future dates
 */

import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@/contexts/ThemeContext";

interface CalendarPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectDate: (dateStr: string) => void;
  selectedDate: string;
  // Plan mode props (optional) - when set, shows plan day numbers on calendar
  planMode?: {
    startedAt: string; // ISO date when plan started
    totalDays: number; // Plan duration
    currentDay: number; // Currently selected day
    onSelectDay: (day: number) => void; // Callback when day is selected
  };
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

/**
 * Get local date string in YYYY-MM-DD format (avoiding UTC conversion)
 */
function getLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parse a YYYY-MM-DD string into a local Date object at midnight
 */
function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

/**
 * Parse an ISO timestamp and extract the local date at midnight.
 * This correctly handles timezone conversion by parsing the full ISO string
 * and then extracting local date components.
 */
function getLocalDateFromISO(isoString: string): Date {
  const parsed = new Date(isoString);
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

/**
 * Calculate plan day number for a given date (returns null if outside plan range)
 */
function getPlanDayForDate(date: Date, planStartedAt: string, totalDays: number): number | null {
  // Parse the ISO string correctly to get the LOCAL date, not the UTC date portion
  const startDate = getLocalDateFromISO(planStartedAt);
  const diffTime = date.getTime() - startDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  const planDay = diffDays + 1; // Day 1 is the start date

  if (planDay >= 1 && planDay <= totalDays) {
    return planDay;
  }
  return null;
}

const CalendarPickerModal = ({
  visible,
  onClose,
  onSelectDate,
  selectedDate,
  planMode,
}: CalendarPickerModalProps) => {
  const { theme } = useTheme();

  // Parse selected date to get initial month view (using local date)
  const initialDate = parseLocalDate(selectedDate);
  const [viewYear, setViewYear] = useState(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth());

  const today = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);

  // Generate calendar days for the view month
  const calendarDays = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    const lastDay = new Date(viewYear, viewMonth + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay();

    const days: {
      date: Date | null;
      dateStr: string;
      isToday: boolean;
      isFuture: boolean;
      isSelected: boolean;
      planDay: number | null; // Plan day number (if in plan mode and within range)
      isPlanSelected: boolean; // Is this the currently selected plan day
    }[] = [];

    // Fill empty slots before first day
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push({ date: null, dateStr: "", isToday: false, isFuture: false, isSelected: false, planDay: null, isPlanSelected: false });
    }

    // Fill actual days
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(viewYear, viewMonth, day);
      // Use local date string to avoid UTC conversion issues
      const dateStr = getLocalDateString(date);
      const isToday = date.getTime() === today.getTime();
      const isFuture = date > today;
      const isSelected = dateStr === selectedDate;

      // Plan mode: calculate plan day for this date
      const planDay = planMode ? getPlanDayForDate(date, planMode.startedAt, planMode.totalDays) : null;
      const isPlanSelected = planMode ? planDay === planMode.currentDay : false;

      days.push({ date, dateStr, isToday, isFuture, isSelected, planDay, isPlanSelected });
    }

    return days;
  }, [viewYear, viewMonth, today, selectedDate, planMode]);

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewYear(viewYear - 1);
      setViewMonth(11);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const handleNextMonth = () => {
    // Can navigate to current month but not beyond
    const nextMonth = viewMonth === 11 ? 0 : viewMonth + 1;
    const nextYear = viewMonth === 11 ? viewYear + 1 : viewYear;

    const canNavigate =
      nextYear < today.getFullYear() ||
      (nextYear === today.getFullYear() && nextMonth <= today.getMonth());

    if (canNavigate) {
      setViewYear(nextYear);
      setViewMonth(nextMonth);
    }
  };

  const canGoNextMonth = useMemo(() => {
    const nextMonth = viewMonth === 11 ? 0 : viewMonth + 1;
    const nextYear = viewMonth === 11 ? viewYear + 1 : viewYear;

    return (
      nextYear < today.getFullYear() ||
      (nextYear === today.getFullYear() && nextMonth <= today.getMonth())
    );
  }, [viewYear, viewMonth, today]);

  const handleDayPress = (dateStr: string, isFuture: boolean, planDay: number | null) => {
    if (planMode && planDay !== null) {
      // Plan mode: select by plan day (future days are allowed - completion is locked separately)
      planMode.onSelectDay(planDay);
    } else if (!isFuture && dateStr) {
      // Normal mode: select by date
      onSelectDate(dateStr);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[
            styles.modalContent,
            { backgroundColor: theme.colors.background.elevated },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Month Navigation */}
          <View style={styles.monthNav}>
            <Pressable onPress={handlePrevMonth} style={styles.navButton}>
              <Ionicons name="chevron-back" size={24} color={theme.colors.text.primary} />
            </Pressable>

            <Text style={[styles.monthTitle, { color: theme.colors.text.primary }]}>
              {MONTHS[viewMonth]} {viewYear}
            </Text>

            <Pressable
              onPress={handleNextMonth}
              style={[styles.navButton, !canGoNextMonth && styles.navDisabled]}
              disabled={!canGoNextMonth}
            >
              <Ionicons
                name="chevron-forward"
                size={24}
                color={canGoNextMonth ? theme.colors.text.primary : theme.colors.text.muted}
              />
            </Pressable>
          </View>

          {/* Weekday Headers */}
          <View style={styles.weekdaysRow}>
            {WEEKDAYS.map((day) => (
              <View key={day} style={styles.weekdayCell}>
                <Text style={[styles.weekdayText, { color: theme.colors.text.muted }]}>
                  {day}
                </Text>
              </View>
            ))}
          </View>

          {/* Calendar Grid */}
          <View style={styles.calendarGrid}>
            {calendarDays.map((item, index) => {
              // In plan mode: disabled if no plan day
              // In normal mode: disabled if future, selected if isSelected
              const isDisabled = planMode
                ? !item.date || item.planDay === null
                : !item.date || item.isFuture;
              const isSelectedDay = planMode ? item.isPlanSelected : item.isSelected;

              return (
                <Pressable
                  key={index}
                  style={[
                    styles.dayCell,
                    isSelectedDay && {
                      backgroundColor: theme.colors.accent,
                    },
                    item.isToday && !isSelectedDay && {
                      borderWidth: 1,
                      borderColor: theme.colors.accent,
                    },
                  ]}
                  onPress={() => handleDayPress(item.dateStr, item.isFuture, item.planDay)}
                  disabled={isDisabled}
                >
                  {item.date && (
                    <View style={styles.dayCellContent}>
                      <Text
                        style={[
                          styles.dayText,
                          {
                            color: isSelectedDay
                              ? "#FFFFFF"
                              : isDisabled
                              ? theme.colors.text.muted
                              : theme.colors.text.primary,
                          },
                        ]}
                      >
                        {item.date.getDate()}
                      </Text>
                      {planMode && item.planDay !== null && (
                        <Text
                          style={[
                            styles.planDayText,
                            {
                              color: isSelectedDay
                                ? "#FFFFFF"
                                : theme.colors.text.muted,
                            },
                          ]}
                        >
                          D{item.planDay}
                        </Text>
                      )}
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>

          {/* Close Button */}
          <Pressable
            style={[styles.closeButton, { borderTopColor: theme.colors.border }]}
            onPress={onClose}
          >
            <Text style={[styles.closeButtonText, { color: theme.colors.accent }]}>
              Close
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

export default CalendarPickerModal;

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: "90%",
    maxWidth: 360,
    borderRadius: 16,
    overflow: "hidden",
  },
  monthNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 16,
  },
  navButton: {
    padding: 8,
  },
  navDisabled: {
    opacity: 0.3,
  },
  monthTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  weekdaysRow: {
    flexDirection: "row",
    paddingHorizontal: 8,
    marginBottom: 8,
  },
  weekdayCell: {
    flex: 1,
    alignItems: "center",
  },
  weekdayText: {
    fontSize: 12,
    fontWeight: "500",
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 8,
    paddingBottom: 16,
  },
  dayCell: {
    width: "14.28%", // 100% / 7 days
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  dayCellContent: {
    alignItems: "center",
    justifyContent: "center",
  },
  dayText: {
    fontSize: 14,
    fontWeight: "500",
  },
  planDayText: {
    fontSize: 9,
    fontWeight: "500",
    marginTop: -2,
  },
  closeButton: {
    paddingVertical: 16,
    alignItems: "center",
    borderTopWidth: 1,
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
});
