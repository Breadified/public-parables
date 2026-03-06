/**
 * Theme Helper Functions
 * Provides utilities for theme-related operations
 */

import { themeColors, type ThemeMode } from "../config/theme";

/**
 * Get header background color for a theme mode
 */
export const getHeaderColor = (theme: ThemeMode): string => {
  return themeColors[theme].background.elevated;
};

/**
 * Get primary text color for a theme mode
 */
export const getTextColor = (theme: ThemeMode): string => {
  return themeColors[theme].text.primary;
};

/**
 * Get secondary text color for a theme mode
 */
export const getSecondaryTextColor = (theme: ThemeMode): string => {
  return themeColors[theme].text.secondary;
};

/**
 * Get theme button background color for a theme mode
 */
export const getThemeButtonColor = (theme: ThemeMode): string => {
  return themeColors[theme].background.secondary;
};

/**
 * Get primary background color for a theme mode
 */
export const getBackgroundColor = (theme: ThemeMode): string => {
  return themeColors[theme].background.primary;
};

/**
 * Reduces font sizes for Study Mode split-screen view
 * Applies 0.875x multiplier (one step down) to all font sizes
 */
export const getStudyModeFontSizes = (normalSizes: {
  small: number;
  base: number;
  large: number;
  title: number;
}): {
  small: number;
  base: number;
  large: number;
  title: number;
} => {
  const REDUCTION_FACTOR = 0.875; // One level smaller (e.g., 16px -> 14px)

  return {
    small: Math.round(normalSizes.small * REDUCTION_FACTOR),
    base: Math.round(normalSizes.base * REDUCTION_FACTOR),
    large: Math.round(normalSizes.large * REDUCTION_FACTOR),
    title: Math.round(normalSizes.title * REDUCTION_FACTOR),
  };
};

/**
 * Converts a hex color to its fully transparent version.
 *
 * IMPORTANT: Don't use the literal "transparent" keyword in LinearGradient colors.
 * On iOS, "transparent" renders as transparent BLACK (rgba(0,0,0,0)), causing
 * dark artifacts in gradients. Instead, use this function to create a transparent
 * version of your target color.
 *
 * @param hexColor - A hex color string (e.g., "#FFFFFF" or "#FFFFFFFF")
 * @returns The same color with 00 alpha (fully transparent)
 *
 * @example
 * // Instead of: colors={["transparent", theme.colors.background.primary]}
 * // Use: colors={[toTransparent(theme.colors.background.primary), theme.colors.background.primary]}
 */
export const toTransparent = (hexColor: string): string => {
  // Handle 6-digit hex (#RRGGBB) -> add 00 alpha
  if (hexColor.length === 7 && hexColor.startsWith('#')) {
    return `${hexColor}00`;
  }
  // Handle 8-digit hex (#RRGGBBAA) -> replace alpha with 00
  if (hexColor.length === 9 && hexColor.startsWith('#')) {
    return `${hexColor.slice(0, 7)}00`;
  }
  // Fallback: return as-is (shouldn't happen with proper hex colors)
  return hexColor;
};
