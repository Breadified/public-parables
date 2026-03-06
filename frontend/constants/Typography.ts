import { Platform } from 'react-native';

/**
 * Platform-aware typography system for Parables
 *
 * iOS: Uses native fonts (Georgia, San Francisco) for EAS update compatibility
 * Android/Web: Uses custom fonts (Literata, Inter)
 */

// Bible reading fonts (serif)
export const bibleFont = {
  regular: Platform.select({
    ios: 'Georgia',
    default: 'Literata-Regular',
  }),
  medium: Platform.select({
    ios: 'Georgia', // Georgia uses fontWeight instead
    default: 'Literata-Medium',
  }),
};

// UI fonts (sans-serif)
export const uiFont = {
  regular: Platform.select({
    ios: 'System',
    default: 'Inter-Regular',
  }),
  medium: Platform.select({
    ios: 'System', // San Francisco uses fontWeight instead
    default: 'Inter-Medium',
  }),
  semibold: Platform.select({
    ios: 'System', // San Francisco uses fontWeight instead
    default: 'Inter-SemiBold',
  }),
  bold: Platform.select({
    ios: 'System', // San Francisco uses fontWeight instead
    default: 'Inter-Bold',
  }),
};

// Font weights for iOS native fonts
export const fontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

// Font sizes following iOS HIG
export const fontSize = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
};

// Line height multipliers
export const lineHeight = {
  tight: 1.25,
  normal: 1.5,
  relaxed: 1.75,
};

/**
 * Helper function to create Bible text styles
 * Automatically handles platform differences
 */
export const createBibleTextStyle = (options?: {
  size?: number;
  weight?: 'regular' | 'medium';
  lineHeightMultiplier?: number;
}) => {
  const size = options?.size ?? fontSize.lg;
  const weight = options?.weight ?? 'regular';
  const lineHeightMultiplier = options?.lineHeightMultiplier ?? lineHeight.normal;

  return {
    fontFamily: weight === 'regular' ? bibleFont.regular : bibleFont.medium,
    ...(Platform.OS === 'ios' && weight === 'medium' && { fontWeight: fontWeight.medium }),
    fontSize: size,
    lineHeight: size * lineHeightMultiplier,
    letterSpacing: 0.2,
  };
};

/**
 * Helper function to create UI text styles
 * Automatically handles platform differences
 */
export const createUITextStyle = (options?: {
  size?: number;
  weight?: 'regular' | 'medium' | 'semibold' | 'bold';
}) => {
  const size = options?.size ?? fontSize.base;
  const weight = options?.weight ?? 'regular';

  const fontFamilyMap = {
    regular: uiFont.regular,
    medium: uiFont.medium,
    semibold: uiFont.semibold,
    bold: uiFont.bold,
  };

  const style: any = {
    fontFamily: fontFamilyMap[weight],
    fontSize: size,
  };

  // Add fontWeight for iOS native fonts
  if (Platform.OS === 'ios' && weight !== 'regular') {
    style.fontWeight = fontWeight[weight];
  }

  return style;
};
