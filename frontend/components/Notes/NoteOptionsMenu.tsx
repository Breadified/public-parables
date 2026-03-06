/**
 * NoteOptionsMenu - Dropdown menu for note actions
 * Actions: Delete, Relocate, Copy, Share
 * Fast, subtle slide-in animation matching ConfirmationModal style
 */

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Dimensions,
} from "react-native";
import { BlurView } from "expo-blur";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";

export interface NoteOptionsMenuProps {
  visible: boolean;
  onClose: () => void;
  onCollapse?: () => void; // Collapse the note
  onDelete: () => void;
  onRelocate: () => void;
  onCopy: () => void;
  onShare: () => void;
  // Position relative to trigger button (optional - defaults to center-bottom)
  anchorX?: number;
  anchorY?: number;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const MENU_PADDING = 8; // Padding from screen edges
const MENU_OFFSET = 60; // Offset from trigger button (spacing to avoid blocking content)

export function NoteOptionsMenu({
  visible,
  onClose,
  onCollapse,
  onDelete,
  onRelocate,
  onCopy,
  onShare,
  anchorX,
  anchorY,
}: NoteOptionsMenuProps) {
  const { theme, themeMode } = useTheme();

  // Menu dimensions (measured dynamically)
  const [menuHeight, setMenuHeight] = useState(0);
  const [menuWidth, setMenuWidth] = useState(0);

  // Animated values
  const backdropOpacity = useSharedValue(0);
  const translateY = useSharedValue(20);
  const opacity = useSharedValue(0);

  // Open animation
  useEffect(() => {
    if (visible) {
      backdropOpacity.value = withTiming(1, { duration: 120 });
      translateY.value = withTiming(0, { duration: 120 });
      opacity.value = withTiming(1, { duration: 120 });
    } else {
      backdropOpacity.value = withTiming(0, { duration: 100 });
      translateY.value = withTiming(20, { duration: 100 });
      opacity.value = withTiming(0, { duration: 100 });
    }
  }, [visible]);

  // Animated styles
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const menuStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  // Calculate menu position (prefer bottom-right aligned, flip if needed)
  const menuPosition = (() => {
    if (!anchorX || !anchorY || !menuHeight || !menuWidth) {
      // Default centered position if no anchor or dimensions yet
      return {
        top: SCREEN_HEIGHT / 2 - 120,
        left: SCREEN_WIDTH / 2 - 100,
      };
    }

    // Calculate vertical position (prefer below, flip above if overflow)
    const spaceBelow = SCREEN_HEIGHT - anchorY;
    const spaceAbove = anchorY;
    const showBelow =
      spaceBelow >= menuHeight + MENU_OFFSET || spaceBelow > spaceAbove;

    const top = showBelow
      ? anchorY + MENU_OFFSET // Position below trigger
      : anchorY - menuHeight - MENU_OFFSET; // Position above trigger

    // Calculate horizontal position (align right edge to anchor, adjust if overflow)
    let left = anchorX - menuWidth;

    // Prevent overflow on left edge
    if (left < MENU_PADDING) {
      left = MENU_PADDING;
    }

    // Prevent overflow on right edge
    if (left + menuWidth > SCREEN_WIDTH - MENU_PADDING) {
      left = SCREEN_WIDTH - menuWidth - MENU_PADDING;
    }

    return { top, left };
  })();

  // Handle action with auto-close
  const handleAction = (action: () => void) => {
    onClose();
    // Small delay to allow close animation
    setTimeout(action, 150);
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType="none"
      onRequestClose={onClose}
    >
      {/* Backdrop */}
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
      >
        <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]}>
          <BlurView
            intensity={20}
            tint={themeMode === "dark" ? "dark" : "light"}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      </TouchableOpacity>

      {/* Menu Container */}
      <Animated.View
        style={[
          styles.menuContainer,
          {
            backgroundColor: theme.colors.background.secondary,
            borderColor: theme.colors.border,
            ...menuPosition,
          },
          menuStyle,
        ]}
        onLayout={(event) => {
          const { width, height } = event.nativeEvent.layout;
          setMenuWidth(width);
          setMenuHeight(height);
        }}
      >
        {/* Collapse - Only show if callback provided */}
        {onCollapse && (
          <>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => handleAction(onCollapse)}
              activeOpacity={0.7}
            >
              <Ionicons
                name="chevron-up-outline"
                size={20}
                color={theme.colors.text.primary}
              />
              <Text style={[styles.menuText, { color: theme.colors.text.primary }]}>
                Collapse Note
              </Text>
            </TouchableOpacity>

            <View
              style={[styles.divider, { backgroundColor: theme.colors.border }]}
            />
          </>
        )}

        {/* Relocate */}
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => handleAction(onRelocate)}
          activeOpacity={0.7}
        >
          <Ionicons
            name="location-outline"
            size={20}
            color={theme.colors.text.primary}
          />
          <Text style={[styles.menuText, { color: theme.colors.text.primary }]}>
            Relocate Note
          </Text>
        </TouchableOpacity>

        <View
          style={[styles.divider, { backgroundColor: theme.colors.border }]}
        />

        {/* Copy */}
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => handleAction(onCopy)}
          activeOpacity={0.7}
        >
          <Ionicons
            name="copy-outline"
            size={20}
            color={theme.colors.text.primary}
          />
          <Text style={[styles.menuText, { color: theme.colors.text.primary }]}>
            Copy Text
          </Text>
        </TouchableOpacity>

        <View
          style={[styles.divider, { backgroundColor: theme.colors.border }]}
        />

        {/* Share */}
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => handleAction(onShare)}
          activeOpacity={0.7}
        >
          <Ionicons
            name="share-outline"
            size={20}
            color={theme.colors.text.primary}
          />
          <Text style={[styles.menuText, { color: theme.colors.text.primary }]}>
            Share Note
          </Text>
        </TouchableOpacity>

        <View
          style={[styles.divider, { backgroundColor: theme.colors.border }]}
        />

        {/* Delete */}
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => handleAction(onDelete)}
          activeOpacity={0.7}
        >
          <Ionicons name="trash-outline" size={20} color="#DC3545" />
          <Text style={[styles.menuText, { color: "#DC3545" }]}>
            Delete Note
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
  },
  menuContainer: {
    position: "absolute",
    minWidth: 200,
    maxWidth: SCREEN_WIDTH - MENU_PADDING * 2,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  menuText: {
    fontSize: 16,
    marginLeft: 12,
    fontWeight: "500",
  },
  divider: {
    height: 1,
    marginHorizontal: 16,
  },
});
