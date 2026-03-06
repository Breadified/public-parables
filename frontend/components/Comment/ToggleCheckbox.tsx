/**
 * ToggleCheckbox - Reusable toggle for comment input footer
 * Supports both icon-only mode and icon+label mode
 * Used for Anonymous and Humans Only toggles
 */

import React from "react";
import { Pressable, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@/contexts/ThemeContext";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

interface ToggleCheckboxProps {
  /** Text label (optional - if not provided, icon-only mode) */
  label?: string;
  /** Icon to display (required for icon-only mode) */
  icon?: IconName;
  /** Whether the toggle is checked/active */
  checked: boolean;
  /** Callback when toggled */
  onToggle: () => void;
  /** Whether the toggle is disabled */
  disabled?: boolean;
  /** Size of the icon (default: 20 for icon-only, 16 for label mode) */
  iconSize?: number;
}

const ToggleCheckbox = ({
  label,
  icon,
  checked,
  onToggle,
  disabled = false,
  iconSize,
}: ToggleCheckboxProps) => {
  const { theme } = useTheme();

  const activeColor = theme.colors.accent;
  const inactiveColor = theme.colors.text.muted;
  const currentColor = checked ? activeColor : inactiveColor;

  // Icon-only mode (no label)
  if (!label && icon) {
    const size = iconSize ?? 24;
    return (
      <Pressable
        onPress={onToggle}
        style={[
          styles.iconContainer,
          {
            backgroundColor: checked
              ? `${activeColor}20` // 20% opacity background when active
              : "transparent",
            borderColor: checked ? activeColor : "transparent",
          },
          disabled && styles.disabled,
        ]}
        disabled={disabled}
      >
        <Ionicons name={icon} size={size} color={currentColor} />
      </Pressable>
    );
  }

  // Label mode (checkbox + text)
  const size = iconSize ?? 16;
  return (
    <Pressable
      onPress={onToggle}
      style={[styles.container, disabled && styles.disabled]}
      disabled={disabled}
    >
      <Ionicons
        name={checked ? "checkbox" : "square-outline"}
        size={size}
        color={currentColor}
      />
      {label && (
        <Text style={[styles.label, { color: currentColor }]}>{label}</Text>
      )}
    </Pressable>
  );
};

export default ToggleCheckbox;

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    fontSize: 13,
    fontWeight: "500",
  },
});
