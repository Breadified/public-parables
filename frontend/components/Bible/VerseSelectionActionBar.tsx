/**
 * VerseSelectionActionBar - Floating action bar for verse selection
 * Appears when verses are selected with copy, share, note, highlight, and bookmark actions
 */

import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
} from "react-native";
import { BlurView } from "expo-blur";
import Animated, {
  useAnimatedStyle,
  withSpring,
  withTiming,
  FadeIn,
  FadeOut,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/contexts/ThemeContext";
import type { HighlightColorName } from "@/config/theme";

interface VerseSelectionActionBarProps {
  /** Whether the action bar is visible */
  visible: boolean;
  /** Position Y (relative to parent) */
  positionY: number;
  /** Called when copy action is pressed */
  onCopy: () => void;
  /** Called when share action is pressed */
  onShare: () => void;
  /** Called when note action is pressed */
  onNote: () => void;
  /** Called when highlight action is pressed with color */
  onHighlight: (color: HighlightColorName) => void;
  /** Called when bookmark action is pressed */
  onBookmark: () => void;
  /** Called when action bar should be dismissed */
  onDismiss: () => void;
}

const HIGHLIGHT_COLORS: HighlightColorName[] = [
  "yellow",
  "green",
  "blue",
  "pink",
  "orange",
];

const ACTION_BAR_HEIGHT = 56;
const COLOR_PICKER_HEIGHT = 48;

export const VerseSelectionActionBar: React.FC<VerseSelectionActionBarProps> =
  ({
    visible,
    positionY,
    onCopy,
    onShare,
    onNote,
    onHighlight,
    onBookmark,
    onDismiss,
  }) => {
    const { theme, themeMode } = useTheme();
    const [showColorPicker, setShowColorPicker] = useState(false);

    const handleHighlightPress = useCallback(() => {
      setShowColorPicker((prev) => !prev);
    }, []);

    const handleColorSelect = useCallback(
      (color: HighlightColorName) => {
        onHighlight(color);
        setShowColorPicker(false);
      },
      [onHighlight]
    );

    // Animated position style
    const animatedStyle = useAnimatedStyle(() => {
      return {
        transform: [
          {
            translateY: withSpring(visible ? 0 : 20, {
              damping: 15,
              stiffness: 150,
            }),
          },
        ],
        opacity: withTiming(visible ? 1 : 0, { duration: 150 }),
      };
    }, [visible]);

    if (!visible) return null;

    const blurTint = themeMode === "dark" ? "dark" : "light";

    return (
      <Animated.View
        entering={FadeIn.duration(150)}
        exiting={FadeOut.duration(100)}
        style={[
          styles.container,
          {
            top: positionY - ACTION_BAR_HEIGHT - 12,
          },
          animatedStyle,
        ]}
      >
        {/* Main action bar */}
        <BlurView intensity={80} tint={blurTint} style={styles.blurContainer}>
          <View
            style={[
              styles.actionBar,
              {
                backgroundColor:
                  themeMode === "dark"
                    ? "rgba(30, 41, 59, 0.9)"
                    : "rgba(255, 255, 255, 0.9)",
                borderColor: theme.colors.border,
              },
            ]}
          >
            {/* Copy */}
            <ActionButton
              icon="copy-outline"
              label="Copy"
              onPress={onCopy}
              theme={theme}
              themeMode={themeMode}
            />

            <Divider theme={theme} />

            {/* Share */}
            <ActionButton
              icon="share-outline"
              label="Share"
              onPress={onShare}
              theme={theme}
              themeMode={themeMode}
            />

            <Divider theme={theme} />

            {/* Note */}
            <ActionButton
              icon="create-outline"
              label="Note"
              onPress={onNote}
              theme={theme}
              themeMode={themeMode}
            />

            <Divider theme={theme} />

            {/* Highlight */}
            <ActionButton
              icon="color-palette-outline"
              label="Highlight"
              onPress={handleHighlightPress}
              theme={theme}
              themeMode={themeMode}
              isActive={showColorPicker}
            />

            <Divider theme={theme} />

            {/* Bookmark */}
            <ActionButton
              icon="bookmark-outline"
              label="Bookmark"
              onPress={onBookmark}
              theme={theme}
              themeMode={themeMode}
            />
          </View>
        </BlurView>

        {/* Color picker popover */}
        {showColorPicker && (
          <Animated.View
            entering={FadeIn.duration(100)}
            exiting={FadeOut.duration(100)}
            style={styles.colorPickerContainer}
          >
            <BlurView
              intensity={80}
              tint={blurTint}
              style={styles.colorPickerBlur}
            >
              <View
                style={[
                  styles.colorPicker,
                  {
                    backgroundColor:
                      themeMode === "dark"
                        ? "rgba(30, 41, 59, 0.9)"
                        : "rgba(255, 255, 255, 0.9)",
                    borderColor: theme.colors.border,
                  },
                ]}
              >
                {HIGHLIGHT_COLORS.map((color) => (
                  <Pressable
                    key={color}
                    onPress={() => handleColorSelect(color)}
                    style={({ pressed }) => [
                      styles.colorButton,
                      {
                        backgroundColor: theme.colors.highlightColors[color].bg,
                        borderColor:
                          theme.colors.highlightColors[color].indicator,
                        transform: [{ scale: pressed ? 0.9 : 1 }],
                      },
                    ]}
                  />
                ))}
              </View>
            </BlurView>
          </Animated.View>
        )}

        {/* Dismiss overlay - tap outside to close */}
        <Pressable
          style={styles.dismissOverlay}
          onPress={onDismiss}
          hitSlop={{ top: 100, bottom: 100, left: 50, right: 50 }}
        />
      </Animated.View>
    );
  };

// Action button component
interface ActionButtonProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  theme: ReturnType<typeof useTheme>["theme"];
  themeMode: ReturnType<typeof useTheme>["themeMode"];
  isActive?: boolean;
}

const ActionButton: React.FC<ActionButtonProps> = ({
  icon,
  label,
  onPress,
  theme,
  themeMode,
  isActive = false,
}) => {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.actionButton,
        isActive && {
          backgroundColor:
            themeMode === "dark" ? "rgba(99, 102, 241, 0.2)" : "rgba(99, 102, 241, 0.1)",
        },
      ]}
      activeOpacity={0.7}
    >
      <Ionicons
        name={icon}
        size={20}
        color={isActive ? theme.colors.primary : theme.colors.text.primary}
      />
      <Text
        style={[
          styles.actionLabel,
          {
            color: isActive ? theme.colors.primary : theme.colors.text.secondary,
          },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
};

// Divider component
const Divider: React.FC<{ theme: ReturnType<typeof useTheme>["theme"] }> = ({
  theme,
}) => (
  <View
    style={[
      styles.divider,
      { backgroundColor: theme.colors.divider },
    ]}
  />
);

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 1000,
    elevation: 10,
  },
  blurContainer: {
    borderRadius: 12,
    overflow: "hidden",
  },
  actionBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    height: ACTION_BAR_HEIGHT,
    paddingHorizontal: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  actionButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 8,
  },
  actionLabel: {
    fontSize: 10,
    marginTop: 2,
    fontWeight: "500",
  },
  divider: {
    width: 1,
    height: 32,
    opacity: 0.3,
  },
  colorPickerContainer: {
    position: "absolute",
    top: ACTION_BAR_HEIGHT + 8,
    left: "50%",
    transform: [{ translateX: -100 }],
    width: 200,
  },
  colorPickerBlur: {
    borderRadius: 24,
    overflow: "hidden",
  },
  colorPicker: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    height: COLOR_PICKER_HEIGHT,
    paddingHorizontal: 16,
    borderRadius: 24,
    borderWidth: 1,
  },
  colorButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
  },
  dismissOverlay: {
    position: "absolute",
    top: -1000,
    left: -1000,
    right: -1000,
    bottom: -1000,
    zIndex: -1,
  },
});
