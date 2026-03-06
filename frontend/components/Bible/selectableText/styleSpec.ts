/**
 * Style Specification for ChapterSelectableText
 *
 * Defines all styling in React Native, passed to native modules as a spec.
 * Native modules apply these styles - they don't define them.
 * This keeps styling logic in one place (React Native).
 */

/**
 * Font weight options supported by native modules
 */
export type FontWeight =
  | "ultralight"
  | "light"
  | "regular"
  | "medium"
  | "semibold"
  | "bold";

/**
 * Font style options
 */
export type FontStyle = "normal" | "italic";

/**
 * Text alignment options
 */
export type TextAlign = "left" | "center" | "right";

/**
 * Individual text style properties for a section type
 */
export interface TextStyle {
  /** Font family name ('Georgia', 'System', etc.) */
  fontFamily: string;
  /** Font size in points */
  fontSize: number;
  /** Font weight */
  fontWeight: FontWeight;
  /** Font style (normal or italic) */
  fontStyle: FontStyle;
  /** Text color (hex string, e.g., '#000000') */
  color: string;
  /** Text alignment */
  textAlign: TextAlign;
  /** Line height multiplier (e.g., 1.75) */
  lineHeight: number;
  /** Top margin in points */
  marginTop: number;
  /** Bottom margin in points */
  marginBottom: number;
  /** Left indent in points (primarily for poetry) */
  indent: number;
  /**
   * Extra indent for wrapped continuation lines (hanging indent style).
   * Only applies to poetry. When a poetry line wraps, the continuation
   * is indented by (indent + wrapIndent) to distinguish it from a new verse line.
   * Default: 20 points.
   */
  wrapIndent?: number;
}

/**
 * Section types that can be styled
 */
export type SectionType =
  | "chapter-header"
  | "section-header"
  | "section-subtitle"
  | "prose"
  | "poetry";

/**
 * Complete style specification passed to native modules
 * All styling decisions are made in React Native
 */
export interface StyleSpec {
  /** Style for chapter headers (e.g., "Genesis 1") */
  "chapter-header": TextStyle;
  /** Style for section headers (e.g., "The Creation of the World") */
  "section-header": TextStyle;
  /** Style for section subtitles */
  "section-subtitle": TextStyle;
  /** Style for prose paragraphs */
  prose: TextStyle;
  /** Style for poetry (Psalms, etc.) */
  poetry: TextStyle;
  /** Color for verse numbers (superscript) */
  verseNumberColor: string;
}

/**
 * Theme colors interface (subset needed for styling)
 */
interface ThemeColors {
  text: {
    primary: string;
    muted: string;
  };
  verseNumber: string;
}

/**
 * Dimensions interface (subset needed for styling)
 */
interface DimensionsInfo {
  fontSize?: {
    title?: number;
    small?: number;
    base?: number;
  };
  isSmallScreen?: boolean;
}

/**
 * Font families interface - platform-aware fonts
 * Should match the typography.fontFamily from theme.ts
 */
interface FontFamilies {
  /** Serif font for Bible reading (iOS: Georgia, Android: Literata-Regular) */
  reading: string;
  /** Sans-serif font for UI (iOS: System, Android: Inter-Regular) */
  sansSerif: string;
}

/**
 * Build a StyleSpec from theme and dimensions
 *
 * This is the single source of truth for all Bible text styling.
 * Native modules receive this spec and apply it - no styling logic in native code.
 *
 * @param themeColors - Theme colors from ThemeContext
 * @param dimensions - Dimension info from DimensionsContext
 * @param baseFontSize - Base font size for body text (default 18)
 * @param fontFamilies - Platform-aware font families (from theme.ts typography.fontFamily)
 * @returns Complete StyleSpec for native modules
 */
export function buildStyleSpec(
  themeColors: ThemeColors,
  dimensions?: DimensionsInfo,
  baseFontSize: number = 18,
  fontFamilies?: FontFamilies
): StyleSpec {
  const titleFontSize = dimensions?.fontSize?.title ?? 36;
  const smallFontSize = dimensions?.fontSize?.small ?? 16;
  const isSmallScreen = dimensions?.isSmallScreen ?? false;

  // Default to Georgia for iOS, but callers should pass platform-aware fonts
  const readingFont = fontFamilies?.reading ?? "Georgia";
  const sansSerifFont = fontFamilies?.sansSerif ?? "System";

  return {
    "chapter-header": {
      fontFamily: sansSerifFont,
      fontSize: titleFontSize,
      fontWeight: "ultralight",
      fontStyle: "normal",
      color: themeColors.text.primary,
      textAlign: "center",
      lineHeight: 1.2,
      marginTop: 20,
      marginBottom: 10,
      indent: 0,
    },
    "section-header": {
      fontFamily: sansSerifFont,
      fontSize: smallFontSize,
      fontWeight: "medium",
      fontStyle: "normal",
      color: themeColors.text.muted,
      textAlign: "center",
      lineHeight: 1.4,
      marginTop: 16,
      marginBottom: 4,
      indent: 0,
    },
    "section-subtitle": {
      fontFamily: sansSerifFont,
      fontSize: smallFontSize,
      fontWeight: "regular",
      fontStyle: "italic",
      color: themeColors.text.muted,
      textAlign: "center",
      lineHeight: 1.4,
      marginTop: 0,
      marginBottom: 8,
      indent: 0,
    },
    prose: {
      fontFamily: readingFont,
      fontSize: baseFontSize,
      fontWeight: "regular",
      fontStyle: "normal",
      color: themeColors.text.primary,
      textAlign: "left",
      lineHeight: 1.75,
      marginTop: 0,
      marginBottom: 16,
      indent: 0,
    },
    poetry: {
      fontFamily: readingFont,
      fontSize: baseFontSize,
      fontWeight: "regular",
      fontStyle: "normal",
      color: themeColors.text.primary,
      textAlign: "left",
      lineHeight: 1.75,
      marginTop: 0,
      marginBottom: 8,
      indent: isSmallScreen ? 16 : 20,
      wrapIndent: 20, // Extra indent for wrapped continuation lines (hanging indent)
    },
    verseNumberColor: themeColors.verseNumber,
  };
}

/**
 * Calculate Bible reading font size based on content width.
 *
 * This is the single source of truth for Bible text font sizing.
 * All Bible rendering components should use this function to ensure
 * consistent font sizes across the app.
 *
 * Reference point: 390px content width → 20pt font
 * Scales down proportionally for narrower widths (split views).
 * Does NOT scale up for wider screens (tablets stay at 20pt).
 *
 * @param contentWidth - The width of the content area in pixels
 * @returns Font size in points
 */
export function getBibleFontSize(contentWidth: number): number {
  const refWidth = 358;  // Reference: phone 390px screen minus 32px padding
  const refFont = 18;    // Reference: standard Bible font size
  const minFont = 13;    // Minimum for very narrow panes

  // Cap at reference font - don't scale up for tablets/wide screens
  if (contentWidth >= refWidth) return refFont;

  // Scale down proportionally for narrower widths
  const ratio = contentWidth / refWidth;
  return Math.max(minFont, Math.round(refFont * ratio));
}

/**
 * Default style spec for fallback when theme is not available
 */
export const DEFAULT_STYLE_SPEC: StyleSpec = buildStyleSpec(
  {
    text: { primary: "#1F2937", muted: "#6B7280" },
    verseNumber: "#6366F1",
  },
  undefined,
  18
);
