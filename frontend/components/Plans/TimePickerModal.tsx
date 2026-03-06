/**
 * TimePickerModal - Simple time picker for selecting reminder time
 * Uses scrollable wheel pickers for hour, minute, and AM/PM
 */

import React, { useState, useRef, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
} from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";

import { useTheme } from "@/contexts/ThemeContext";

interface TimePickerModalProps {
  visible: boolean;
  hour: number; // 0-23
  minute: number; // 0-59
  onConfirm: (hour: number, minute: number) => void;
  onCancel: () => void;
}

const ITEM_HEIGHT = 44;
const VISIBLE_ITEMS = 5;
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;

// Generate arrays for picker values
const HOURS_12 = Array.from({ length: 12 }, (_, i) => i + 1); // 1-12
const MINUTES = Array.from({ length: 60 }, (_, i) => i); // 0-59
const PERIODS = ["AM", "PM"];

export const TimePickerModal: React.FC<TimePickerModalProps> = ({
  visible,
  hour,
  minute,
  onConfirm,
  onCancel,
}) => {
  const { theme, themeMode } = useTheme();

  // Convert 24h to 12h format
  const initialPeriod = hour >= 12 ? "PM" : "AM";
  const initialHour12 = hour % 12 || 12;

  const [selectedHour12, setSelectedHour12] = useState(initialHour12);
  const [selectedMinute, setSelectedMinute] = useState(minute);
  const [selectedPeriod, setSelectedPeriod] = useState(initialPeriod);

  // Refs for scrollviews
  const hourScrollRef = useRef<ScrollView>(null);
  const minuteScrollRef = useRef<ScrollView>(null);
  const periodScrollRef = useRef<ScrollView>(null);

  // Animation values
  const backdropOpacity = useSharedValue(0);
  const translateY = useSharedValue(300);

  // Reset values when modal opens
  useEffect(() => {
    if (visible) {
      const period = hour >= 12 ? "PM" : "AM";
      const hour12 = hour % 12 || 12;
      setSelectedHour12(hour12);
      setSelectedMinute(minute);
      setSelectedPeriod(period);

      // Animate in
      backdropOpacity.value = withTiming(1, { duration: 150 });
      translateY.value = withTiming(0, { duration: 150 });

      // Scroll to initial positions after a brief delay
      setTimeout(() => {
        scrollToItem(hourScrollRef, HOURS_12.indexOf(hour12));
        scrollToItem(minuteScrollRef, minute);
        scrollToItem(periodScrollRef, PERIODS.indexOf(period));
      }, 100);
    } else {
      backdropOpacity.value = withTiming(0, { duration: 100 });
      translateY.value = withTiming(300, { duration: 100 });
    }
  }, [visible, hour, minute]);

  const scrollToItem = (ref: React.RefObject<ScrollView | null>, index: number) => {
    if (ref.current) {
      ref.current.scrollTo({
        y: index * ITEM_HEIGHT,
        animated: false,
      });
    }
  };

  const handleScrollEnd = (
    event: any,
    items: any[],
    setter: (value: any) => void,
    scrollRef: React.RefObject<ScrollView | null>
  ) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    const index = Math.round(offsetY / ITEM_HEIGHT);
    const clampedIndex = Math.max(0, Math.min(index, items.length - 1));
    setter(items[clampedIndex]);

    // Snap to exact position to fix alignment
    const targetOffset = clampedIndex * ITEM_HEIGHT;
    if (scrollRef.current && Math.abs(offsetY - targetOffset) > 1) {
      scrollRef.current.scrollTo({ y: targetOffset, animated: true });
    }
  };

  const handleConfirm = () => {
    // Convert back to 24h format
    let hour24 = selectedHour12;
    if (selectedPeriod === "PM" && selectedHour12 !== 12) {
      hour24 = selectedHour12 + 12;
    } else if (selectedPeriod === "AM" && selectedHour12 === 12) {
      hour24 = 0;
    }
    onConfirm(hour24, selectedMinute);
  };

  // Animated styles
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const renderPickerColumn = (
    items: (number | string)[],
    selectedValue: number | string,
    scrollRef: React.RefObject<ScrollView | null>,
    onScrollEnd: (e: any) => void,
    formatValue?: (v: number | string) => string
  ) => {
    const format = formatValue || ((v) => String(v));

    return (
      <View style={styles.pickerColumn}>
        {/* Highlight band */}
        <View
          style={[
            styles.highlightBand,
            {
              backgroundColor: theme.colors.background.secondary,
              top: ITEM_HEIGHT * 2,
            },
          ]}
          pointerEvents="none"
        />
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          snapToInterval={ITEM_HEIGHT}
          decelerationRate="fast"
          onMomentumScrollEnd={onScrollEnd}
          nestedScrollEnabled={true}
          scrollEventThrottle={16}
          bounces={false}
          contentContainerStyle={{
            paddingVertical: ITEM_HEIGHT * 2,
          }}
        >
          {items.map((item, index) => {
            const isSelected = item === selectedValue;
            return (
              <View key={index} style={styles.pickerItem}>
                <Text
                  style={[
                    styles.pickerItemText,
                    {
                      color: isSelected
                        ? theme.colors.text.primary
                        : theme.colors.text.muted,
                      fontWeight: isSelected ? "600" : "400",
                    },
                  ]}
                >
                  {format(item)}
                </Text>
              </View>
            );
          })}
        </ScrollView>
        {/* Gradient overlays for fade effect */}
        <LinearGradient
          colors={[theme.colors.background.elevated, "transparent"]}
          style={styles.gradientTop}
          pointerEvents="none"
          dither={true}
        />
        <LinearGradient
          colors={["transparent", theme.colors.background.elevated]}
          style={styles.gradientBottom}
          pointerEvents="none"
          dither={true}
        />
      </View>
    );
  };

  if (!visible) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        {Platform.OS === "ios" ? (
          <BlurView
            style={StyleSheet.absoluteFill}
            intensity={20}
            tint={themeMode === "dark" ? "dark" : "light"}
            pointerEvents="none"
          />
        ) : (
          <View
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor:
                  themeMode === "dark"
                    ? "rgba(0, 0, 0, 0.7)"
                    : "rgba(0, 0, 0, 0.5)",
              },
            ]}
            pointerEvents="none"
          />
        )}

        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />

        <Animated.View
          style={[
            styles.modalContainer,
            { backgroundColor: theme.colors.background.elevated },
            containerStyle,
          ]}
        >
          {/* Title */}
          <Text style={[styles.title, { color: theme.colors.text.primary }]}>
            Set Reminder Time
          </Text>

          {/* Picker Row */}
          <View style={styles.pickerRow}>
            {/* Hour picker */}
            {renderPickerColumn(
              HOURS_12,
              selectedHour12,
              hourScrollRef,
              (e) => handleScrollEnd(e, HOURS_12, setSelectedHour12, hourScrollRef)
            )}

            {/* Separator */}
            <Text
              style={[styles.separator, { color: theme.colors.text.primary }]}
            >
              :
            </Text>

            {/* Minute picker */}
            {renderPickerColumn(
              MINUTES,
              selectedMinute,
              minuteScrollRef,
              (e) => handleScrollEnd(e, MINUTES, setSelectedMinute, minuteScrollRef),
              (v) => String(v).padStart(2, "0")
            )}

            {/* Period picker */}
            {renderPickerColumn(
              PERIODS,
              selectedPeriod,
              periodScrollRef,
              (e) => handleScrollEnd(e, PERIODS, setSelectedPeriod, periodScrollRef)
            )}
          </View>

          {/* Buttons */}
          <View style={styles.buttonsContainer}>
            <TouchableOpacity
              style={[
                styles.button,
                styles.cancelButton,
                { backgroundColor: theme.colors.background.secondary },
              ]}
              onPress={onCancel}
            >
              <Text
                style={[styles.buttonText, { color: theme.colors.text.primary }]}
              >
                Cancel
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.button,
                styles.confirmButton,
                { backgroundColor: theme.colors.interactive.button.background },
              ]}
              onPress={handleConfirm}
            >
              <Text
                style={[
                  styles.buttonText,
                  { color: theme.colors.interactive.button.icon },
                ]}
              >
                Done
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContainer: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 16,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 20,
  },
  pickerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: PICKER_HEIGHT,
    marginBottom: 24,
  },
  pickerColumn: {
    width: 60,
    height: PICKER_HEIGHT,
    overflow: "hidden",
    position: "relative",
  },
  highlightBand: {
    position: "absolute",
    left: 0,
    right: 0,
    height: ITEM_HEIGHT,
    borderRadius: 8,
    zIndex: -1,
  },
  pickerItem: {
    height: ITEM_HEIGHT,
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
  },
  pickerItemText: {
    fontSize: 20,
    textAlign: "center",
    minWidth: 40,
    fontVariant: ["tabular-nums"],
  },
  separator: {
    fontSize: 24,
    fontWeight: "600",
    marginHorizontal: 4,
  },
  gradientTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: ITEM_HEIGHT * 2,
  },
  gradientBottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: ITEM_HEIGHT * 2,
  },
  buttonsContainer: {
    flexDirection: "row",
    gap: 12,
  },
  button: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  cancelButton: {},
  confirmButton: {},
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
  },
});
