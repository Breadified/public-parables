/**
 * BibleRenderingContext - Unified Bible rendering configuration
 *
 * Centralizes Bible styling, styleSpec, and utility functions that were
 * previously duplicated across 10+ components. Components that render
 * Bible content should use this context instead of creating their own
 * bibleStyles and styleSpec.
 *
 * Consolidates:
 * - createBibleStyles() calls from 10+ components
 * - buildStyleSpec() calls from ChapterSelectableText usages
 * - toSuperscript utility (from textUtils)
 * - getHighlightHexColor utility
 */

import React, { createContext, useContext, useMemo, useCallback } from 'react';
import { useTheme } from './ThemeContext';
import { useDimensions } from './DimensionsContext';
import { createBibleStyles, type BibleStyles } from '../components/Bible/BibleStyles';
import { buildStyleSpec, getBibleFontSize, type StyleSpec } from '../components/Bible/selectableText/styleSpec';
import { toSuperscript } from '../modules/bible/textUtils';
import type { HighlightColorName } from '../config/theme';

/**
 * Bible rendering configuration options
 */
export interface BibleRenderingOptions {
  /**
   * Base font size override (uses dimensions.fontSize.base if not specified)
   */
  fontSize?: number;

  /**
   * Enable compact/split screen mode (reduces spacing)
   */
  splitScreen?: boolean;
}

/**
 * Context value provided by BibleRenderingProvider
 */
export interface BibleRenderingContextValue {
  /**
   * Pre-computed Bible styles for React Native components
   * Uses theme and dimensions from context
   */
  bibleStyles: BibleStyles;

  /**
   * Style spec for native selectable text modules
   * Passed to ChapterSelectableText and SelectableTextView
   */
  styleSpec: StyleSpec;

  /**
   * Convert number to superscript unicode (for verse numbers)
   */
  toSuperscript: (num: string | number) => string;

  /**
   * Convert highlight color name to hex color string
   */
  getHighlightHexColor: (colorName: HighlightColorName) => string;

  /**
   * Theme colors for direct access
   */
  colors: {
    textPrimary: string;
    textMuted: string;
    verseNumber: string;
    background: string;
    highlightColors: Record<HighlightColorName, { bg: string; indicator: string }>;
  };

  /**
   * Dimension values for direct access
   */
  dimensions: {
    fontSize: number;
    contentPadding: number;
    isSmallScreen: boolean;
  };
}

const BibleRenderingContext = createContext<BibleRenderingContextValue | null>(null);

interface BibleRenderingProviderProps {
  children: React.ReactNode;
  options?: BibleRenderingOptions;
}

/**
 * Provider for Bible rendering configuration
 *
 * Should be placed inside ThemeProvider and DimensionsProvider.
 * Most apps should place this at the root layout level.
 *
 * @example
 * ```tsx
 * // In _layout.tsx
 * <ThemeProvider>
 *   <DimensionsProvider>
 *     <BibleRenderingProvider>
 *       {children}
 *     </BibleRenderingProvider>
 *   </DimensionsProvider>
 * </ThemeProvider>
 * ```
 */
export const BibleRenderingProvider: React.FC<BibleRenderingProviderProps> = ({
  children,
  options = {},
}) => {
  const { theme } = useTheme();
  const dimensions = useDimensions();

  const { fontSize: fontSizeOverride, splitScreen = false } = options;

  // Compute effective font size based on content width (single source of truth)
  const effectiveFontSize = fontSizeOverride ?? getBibleFontSize(dimensions.contentWidth);

  // Create Bible styles (memoized)
  const bibleStyles = useMemo(
    () =>
      createBibleStyles({
        theme,
        fontSize: effectiveFontSize,
        contentPadding: dimensions.contentPadding,
        responsiveFontSizes: dimensions.fontSize,
        isSmallScreen: dimensions.isSmallScreen,
        splitScreen,
      }),
    [theme, effectiveFontSize, dimensions.contentPadding, dimensions.fontSize, dimensions.isSmallScreen, splitScreen]
  );

  // Build style spec for native modules (memoized)
  const styleSpec = useMemo(
    () =>
      buildStyleSpec(
        {
          text: {
            primary: theme.colors.text.primary,
            muted: theme.colors.text.muted,
          },
          verseNumber: theme.colors.verseNumber,
        },
        {
          fontSize: dimensions.fontSize,
          isSmallScreen: dimensions.isSmallScreen,
        },
        effectiveFontSize
      ),
    [theme.colors.text.primary, theme.colors.text.muted, theme.colors.verseNumber, dimensions.fontSize, dimensions.isSmallScreen, effectiveFontSize]
  );

  // Convert highlight color name to hex (memoized callback)
  const getHighlightHexColor = useCallback(
    (colorName: HighlightColorName): string => {
      const colorConfig = theme.colors.highlightColors[colorName];
      return colorConfig?.bg || '#FFEB3B80'; // Fallback to yellow with alpha
    },
    [theme.colors.highlightColors]
  );

  // Extract commonly used colors
  const colors = useMemo(
    () => ({
      textPrimary: theme.colors.text.primary,
      textMuted: theme.colors.text.muted,
      verseNumber: theme.colors.verseNumber,
      background: theme.colors.background.primary,
      highlightColors: theme.colors.highlightColors,
    }),
    [theme.colors.text.primary, theme.colors.text.muted, theme.colors.verseNumber, theme.colors.background.primary, theme.colors.highlightColors]
  );

  // Extract commonly used dimensions
  const dimensionValues = useMemo(
    () => ({
      fontSize: effectiveFontSize,
      contentPadding: dimensions.contentPadding,
      isSmallScreen: dimensions.isSmallScreen,
    }),
    [effectiveFontSize, dimensions.contentPadding, dimensions.isSmallScreen]
  );

  const contextValue = useMemo<BibleRenderingContextValue>(
    () => ({
      bibleStyles,
      styleSpec,
      toSuperscript,
      getHighlightHexColor,
      colors,
      dimensions: dimensionValues,
    }),
    [bibleStyles, styleSpec, getHighlightHexColor, colors, dimensionValues]
  );

  return (
    <BibleRenderingContext.Provider value={contextValue}>
      {children}
    </BibleRenderingContext.Provider>
  );
};

/**
 * Hook to access Bible rendering configuration
 *
 * @throws Error if used outside BibleRenderingProvider
 *
 * @example
 * ```tsx
 * const { bibleStyles, styleSpec, getHighlightHexColor } = useBibleRendering();
 *
 * return (
 *   <ChapterSelectableText
 *     sections={sections}
 *     styleSpec={styleSpec}
 *     highlights={highlights.map(h => ({
 *       verseId: h.verse_id,
 *       color: getHighlightHexColor(h.color),
 *     }))}
 *   />
 * );
 * ```
 */
export const useBibleRendering = (): BibleRenderingContextValue => {
  const context = useContext(BibleRenderingContext);
  if (!context) {
    throw new Error('useBibleRendering must be used within a BibleRenderingProvider');
  }
  return context;
};

/**
 * Hook for components that only need styles (not styleSpec)
 * Lighter-weight alternative to useBibleRendering
 */
export const useBibleStyles = (): BibleStyles => {
  const { bibleStyles } = useBibleRendering();
  return bibleStyles;
};

/**
 * Options for useBibleStyleSpec hook
 */
interface BibleStyleSpecOptions {
  /**
   * Multiplier for content width (e.g., 0.5 for split view)
   * Default: 1 (full width)
   */
  widthMultiplier?: number;
}

/**
 * Hook that returns a styleSpec with font size based on content width.
 *
 * This is the single source of truth for Bible text font sizing.
 * Uses getBibleFontSize internally to calculate appropriate font size.
 *
 * @example
 * ```tsx
 * // Full-width Bible reading
 * const { styleSpec } = useBibleStyleSpec();
 *
 * // Split view (half width)
 * const { styleSpec } = useBibleStyleSpec({ widthMultiplier: 0.5 });
 * ```
 */
export const useBibleStyleSpec = (options: BibleStyleSpecOptions = {}) => {
  const { theme } = useTheme();
  const dimensions = useDimensions();
  const { widthMultiplier = 1 } = options;

  // Calculate effective width and font size
  const effectiveWidth = dimensions.contentWidth * widthMultiplier;
  const fontSize = getBibleFontSize(effectiveWidth);

  const styleSpec = useMemo(
    () =>
      buildStyleSpec(
        {
          text: {
            primary: theme.colors.text.primary,
            muted: theme.colors.text.muted,
          },
          verseNumber: theme.colors.verseNumber,
        },
        {
          fontSize: dimensions.fontSize,
          isSmallScreen: dimensions.isSmallScreen,
        },
        fontSize
      ),
    [theme.colors.text.primary, theme.colors.text.muted, theme.colors.verseNumber, dimensions.fontSize, dimensions.isSmallScreen, fontSize]
  );

  return { styleSpec, fontSize };
};
