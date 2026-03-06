// Global Theme Configuration for Parables
// Modern color scale system with semantic tokens organized by theme

// ============================================================================
// COLOR PALETTE - Modern Scale System (100-900)
// ============================================================================

const palette = {
  // Primary - Indigo scale for brand elements
  primary: {
    50: "#EEF2FF",
    100: "#E0E7FF",
    200: "#C7D2FE",
    300: "#A5B4FC",
    400: "#818CF8",
    500: "#6366F1",
    600: "#4F46E5",
    700: "#4338CA",
    800: "#3730A3",
    900: "#312E81",
  },

  // Secondary - Blue scale for supporting elements
  secondary: {
    50: "#EFF6FF",
    100: "#DBEAFE",
    200: "#BFDBFE",
    300: "#93C5FD",
    400: "#60A5FA",
    500: "#3B82F6",
    600: "#2563EB",
    700: "#1D4ED8",
    800: "#1E40AF",
    900: "#1E3A8A",
  },

  // Accent - Emerald scale for highlights
  accent: {
    50: "#ECFDF5",
    100: "#D1FAE5",
    200: "#A7F3D0",
    300: "#6EE7B7",
    400: "#34D399",
    500: "#10B981",
    600: "#059669",
    700: "#047857",
    800: "#065F46",
    900: "#064E3B",
  },

  // Neutral - Gray scale for text and backgrounds
  neutral: {
    50: "#F9FAFB",
    100: "#F3F4F6",
    200: "#E5E7EB",
    300: "#D1D5DB",
    400: "#9CA3AF",
    500: "#6B7280",
    600: "#4B5563",
    700: "#374151",
    800: "#1F2937",
    900: "#111827",
  },

  // Slate - Dark theme backgrounds
  slate: {
    50: "#F8FAFC",
    100: "#F1F5F9",
    200: "#E2E8F0",
    300: "#CBD5E1",
    400: "#94A3B8",
    500: "#64748B",
    600: "#475569",
    700: "#334155",
    800: "#1E293B",
    900: "#0F172A",
  },

  // Warm - Sepia theme colors (subtle cream/parchment tones, not orange)
  warm: {
    50: "#FDFCFA",   // Almost white with warm tint
    100: "#FAF8F5",  // Very light cream
    200: "#F5F1EB",  // Light parchment (primary bg)
    300: "#EDE8E0",  // Subtle offset (secondary bg)
    400: "#E0D8CC",  // Soft tan border
    500: "#C4B8A8",  // Muted warm gray
    600: "#A0926F",  // Darker warm accent
    700: "#8B7355",  // Brown accent
    800: "#6D5443",  // Dark brown
    900: "#3E2723",  // Deep brown text
  },

  // Brown - Sepia accents
  brown: {
    50: "#EFEBE9",
    100: "#D7CCC8",
    200: "#BCAAA4",
    300: "#A1887F",
    400: "#8D6E63",
    500: "#795548",
    600: "#6D4C41",
    700: "#5D4037",
    800: "#4E342E",
    900: "#3E2723",
  },

  // Semantic colors (status, alerts, etc.)
  semantic: {
    success: {
      light: "#10B981",
      dark: "#34D399",
    },
    warning: {
      light: "#F59E0B",
      dark: "#FBBF24",
    },
    error: {
      light: "#EF4444",
      dark: "#F87171",
    },
    info: {
      light: "#3B82F6",
      dark: "#60A5FA",
    },
  },

  // Gamification colors (progress, achievements, celebrations)
  gamification: {
    // Progress map node states
    nodePending: {
      light: "#D1D5DB", // neutral-300
      dark: "#4B5563",  // neutral-600
      sepia: "#C4B8A8", // warm-500
    },
    nodeCurrent: {
      light: "#6366F1", // primary-500
      dark: "#818CF8",  // primary-400
      sepia: "#8B7355", // warm-700
    },
    nodeComplete: {
      light: "#10B981", // accent-500
      dark: "#34D399",  // accent-400
      sepia: "#059669", // accent-600
    },
    // Progress bar glow
    progressGlow: {
      light: "#6366F1", // primary-500
      dark: "#818CF8",  // primary-400
      sepia: "#8B7355", // warm-700
    },
    progressComplete: {
      light: "#10B981", // accent-500
      dark: "#34D399",  // accent-400
      sepia: "#059669", // accent-600
    },
    // Completion celebration
    completionWave: {
      light: "#6366F1", // primary-500
      dark: "#818CF8",  // primary-400
      sepia: "#8B7355", // warm-700
    },
    completionButton: {
      light: "#10B981", // accent-500
      dark: "#34D399",  // accent-400
      sepia: "#059669", // accent-600
    },
    // Trophy/achievement
    trophy: {
      light: "#F59E0B", // amber-500
      dark: "#FBBF24",  // amber-400
      sepia: "#D97706", // amber-600
    },
    trophyRing: {
      light: "#FCD34D", // amber-300
      dark: "#FDE68A",  // amber-200
      sepia: "#F59E0B", // amber-500
    },
    // Halo animation - holy aura glow effect
    // Consistent green glow across all modes
    // Light/Sepia: darker greens for better contrast on light backgrounds
    haloGradientStart: {
      light: "#059669",  // emerald-600 - dark green
      dark: "#34D399",   // emerald-400 - teal green
      sepia: "#047857",  // emerald-700 - very dark green
    },
    haloGradientEnd: {
      light: "#10B981",  // emerald-500 - medium green
      dark: "#818CF8",   // primary-400 - soft purple accent
      sepia: "#059669",  // emerald-600 - dark green
    },
    // Level badges - colors for different level tiers
    levelBadge: {
      // Level 1-4: Bronze
      bronze: {
        background: { light: "#CD7F32", dark: "#B87333", sepia: "#A0522D" },
        border: { light: "#A0522D", dark: "#8B4513", sepia: "#8B4513" },
        text: { light: "#FFFFFF", dark: "#FFFFFF", sepia: "#FFFFFF" },
      },
      // Level 5-9: Silver
      silver: {
        background: { light: "#C0C0C0", dark: "#A8A8A8", sepia: "#B8B8B8" },
        border: { light: "#808080", dark: "#707070", sepia: "#909090" },
        text: { light: "#1F2937", dark: "#1F2937", sepia: "#1F2937" },
      },
      // Level 10-19: Gold
      gold: {
        background: { light: "#FFD700", dark: "#FFC800", sepia: "#DAA520" },
        border: { light: "#B8860B", dark: "#996515", sepia: "#B8860B" },
        text: { light: "#1F2937", dark: "#1F2937", sepia: "#1F2937" },
      },
      // Level 20-29: Platinum
      platinum: {
        background: { light: "#E5E4E2", dark: "#D0D0D0", sepia: "#E8E8E8" },
        border: { light: "#A9A9A9", dark: "#909090", sepia: "#B0B0B0" },
        text: { light: "#1F2937", dark: "#1F2937", sepia: "#1F2937" },
      },
      // Level 30+: Diamond (gradient effect via border)
      diamond: {
        background: { light: "#B9F2FF", dark: "#87CEEB", sepia: "#ADD8E6" },
        border: { light: "#4169E1", dark: "#6495ED", sepia: "#4682B4" },
        text: { light: "#1F2937", dark: "#1F2937", sepia: "#1F2937" },
      },
    },
    // XP progress bar
    xpBar: {
      background: {
        light: "#E5E7EB", // neutral-200
        dark: "#374151",  // neutral-700
        sepia: "#E0D8CC", // warm-400
      },
      fill: {
        light: "#6366F1", // primary-500
        dark: "#818CF8",  // primary-400
        sepia: "#8B7355", // warm-700
      },
    },
    // Daily progress bar (top of screen)
    progressBar: {
      blue: {
        light: "#3B82F6",
        dark: "#3B82F6",
        sepia: "#6366F1",
      },
      green: {
        light: "#10B981",
        dark: "#10B981",
        sepia: "#059669",
      },
      glowBlue: {
        light: "#60A5FA",
        dark: "#60A5FA",
        sepia: "#818CF8",
      },
      glowGreen: {
        light: "#34D399",
        dark: "#34D399",
        sepia: "#10B981",
      },
      track: {
        light: "#1E293B20",
        dark: "#94A3B820",
        sepia: "#8B735520",
      },
    },
  },

  // Pure colors
  pure: {
    white: "#FFFFFF",
    black: "#000000",
  },
} as const;

// ============================================================================
// ICON COLORS - Semantic icon colors for each theme mode
// ============================================================================

export const iconColors = {
  light: {
    primary: palette.neutral[800],
    secondary: palette.neutral[500],
    muted: palette.neutral[400],
    accent: palette.primary[500],
    interactive: palette.pure.white,
    success: palette.semantic.success.light,
    warning: palette.semantic.warning.light,
    error: palette.semantic.error.light,
    info: palette.semantic.info.light,
    liked: palette.semantic.error.light,
    disabled: palette.neutral[400],
    inverse: palette.pure.white,
    // Toggle states (for segmented controls, switches)
    toggle: {
      active: palette.pure.white,
      inactive: palette.neutral[500],
      activeBackground: palette.primary[600],
      inactiveBackground: palette.neutral[100],
    },
  },
  dark: {
    primary: palette.neutral[50],
    secondary: palette.neutral[400],
    muted: palette.neutral[500],
    accent: palette.primary[400],
    interactive: palette.neutral[200],
    success: palette.semantic.success.dark,
    warning: palette.semantic.warning.dark,
    error: palette.semantic.error.dark,
    info: palette.semantic.info.dark,
    liked: palette.semantic.error.dark,
    disabled: palette.neutral[500],
    inverse: palette.neutral[900],
    // Toggle states
    toggle: {
      active: palette.pure.white,
      inactive: palette.neutral[400],
      activeBackground: palette.slate[600],
      inactiveBackground: palette.slate[800],
    },
  },
  sepia: {
    primary: palette.warm[900],
    secondary: palette.brown[600],
    muted: palette.brown[400],
    accent: palette.brown[700],
    interactive: palette.pure.white,
    success: palette.semantic.success.light,
    warning: palette.semantic.warning.light,
    error: palette.semantic.error.light,
    info: palette.semantic.info.light,
    liked: palette.semantic.error.light,
    disabled: palette.brown[400],
    inverse: palette.pure.white,
    // Toggle states
    toggle: {
      active: palette.pure.white,
      inactive: palette.brown[500],
      activeBackground: palette.brown[700],
      inactiveBackground: palette.warm[300],
    },
  },
} as const;

// ============================================================================
// THEME MODES - Organized by Light | Dark | Sepia
// ============================================================================

export const themeColors = {
  light: {
    // Text
    text: {
      primary: palette.neutral[800],
      secondary: palette.neutral[500],
      muted: palette.neutral[400],
      inverse: palette.pure.white,
    },

    // Backgrounds
    background: {
      primary: palette.pure.white,
      secondary: palette.neutral[50],
      elevated: palette.pure.white,
      overlay: "rgba(0, 0, 0, 0.5)",
    },

    // Brand colors
    primary: palette.primary[600],
    secondary: palette.secondary[500],
    accent: palette.primary[500],

    // Bible-specific
    verseNumber: palette.primary[500],

    // Borders & dividers
    border: palette.neutral[200],
    divider: palette.neutral[200],

    // Interactive elements
    interactive: {
      button: {
        background: palette.primary[600],
        pressed: palette.primary[700],
        icon: palette.pure.white,
        divider: "rgba(255, 255, 255, 0.3)",
        shadow: "rgba(79, 70, 229, 0.3)",
      },
      modal: {
        background: palette.pure.white,
        header: palette.neutral[50],
        searchInput: palette.pure.white,
        searchButton: palette.primary[600],
        searchButtonPressed: palette.primary[700],
      },
    },

    // Book categories
    bookCategories: {
      law: { color: palette.accent[400], bg: palette.accent[50] },
      history: { color: "#F59E0B", bg: "#FFFBEB" },
      poetry: { color: palette.primary[400], bg: palette.primary[50] },
      majorProphets: { color: "#EF4444", bg: "#FEF2F2" },
      minorProphets: { color: palette.secondary[400], bg: palette.secondary[50] },
      gospels: { color: palette.accent[500], bg: palette.accent[100] },
      acts: { color: "#FB923C", bg: "#FFF7ED" },
      paulLetters: { color: palette.primary[400], bg: palette.primary[50] },
      generalLetters: { color: "#FBBF24", bg: "#FEF3C7" },
      prophecy: { color: "#EF4444", bg: "#FEF2F2" },
    },

    // Verse highlight colors - pastel backgrounds for light theme
    highlightColors: {
      yellow: { bg: "#FEF3C7", indicator: "#F59E0B" },
      green: { bg: "#D1FAE5", indicator: "#10B981" },
      blue: { bg: "#DBEAFE", indicator: "#3B82F6" },
      pink: { bg: "#FCE7F3", indicator: "#EC4899" },
      orange: { bg: "#FFEDD5", indicator: "#F97316" },
    },
  },

  dark: {
    // Text
    text: {
      primary: palette.neutral[50],
      secondary: palette.neutral[400],
      muted: palette.neutral[500],
      inverse: palette.neutral[900],
    },

    // Backgrounds
    background: {
      primary: palette.slate[900],
      secondary: palette.slate[800],
      elevated: palette.slate[800],
      overlay: "rgba(0, 0, 0, 0.7)",
    },

    // Brand colors
    primary: palette.primary[400],
    secondary: palette.secondary[400],
    accent: palette.primary[400],

    // Bible-specific
    verseNumber: palette.primary[400],

    // Borders & dividers
    border: palette.slate[700],
    divider: palette.slate[700],

    // Interactive elements
    interactive: {
      button: {
        background: palette.slate[700],
        pressed: palette.slate[600],
        icon: palette.neutral[200],
        divider: palette.slate[600],
        shadow: "rgba(0, 0, 0, 0.5)",
      },
      modal: {
        background: palette.slate[900],
        header: palette.slate[800],
        searchInput: palette.slate[800],
        searchButton: palette.slate[700],
        searchButtonPressed: palette.slate[600],
      },
    },

    // Book categories
    bookCategories: {
      law: { color: palette.accent[800], bg: "rgba(6, 95, 70, 0.1)" },
      history: { color: "#92400E", bg: "rgba(146, 64, 14, 0.1)" },
      poetry: { color: palette.primary[700], bg: "rgba(107, 33, 168, 0.1)" },
      majorProphets: { color: "#7F1D1D", bg: "rgba(127, 29, 29, 0.1)" },
      minorProphets: { color: palette.secondary[800], bg: "rgba(30, 58, 138, 0.1)" },
      gospels: { color: palette.accent[800], bg: "rgba(6, 95, 70, 0.1)" },
      acts: { color: "#831843", bg: "rgba(131, 24, 67, 0.1)" },
      paulLetters: { color: palette.primary[700], bg: "rgba(107, 33, 168, 0.1)" },
      generalLetters: { color: "#92400E", bg: "rgba(146, 64, 14, 0.1)" },
      prophecy: { color: "#7F1D1D", bg: "rgba(127, 29, 29, 0.1)" },
    },

    // Verse highlight colors - solid muted colors optimized for dark backgrounds
    // Algorithm: Use deep, saturated variants that provide contrast on dark (#0F172A)
    // while remaining distinguishable and not overwhelming white text
    highlightColors: {
      yellow: { bg: "#4D3D1A", indicator: "#FBBF24" }, // Deep amber/gold
      green: { bg: "#1A3D2E", indicator: "#34D399" },  // Deep forest teal
      blue: { bg: "#1A2D4D", indicator: "#60A5FA" },   // Deep navy
      pink: { bg: "#3D1A33", indicator: "#F472B6" },   // Deep berry/magenta
      orange: { bg: "#4D2D1A", indicator: "#FB923C" }, // Deep rust/terracotta
    },
  },

  sepia: {
    // Text
    text: {
      primary: palette.warm[900],
      secondary: palette.brown[600],
      muted: palette.brown[400],
      inverse: palette.pure.white,
    },

    // Backgrounds - Warmer, more distinct sepia/parchment tones
    background: {
      primary: palette.warm[200],      // Main sepia background (#FFF3E0)
      secondary: palette.warm[300],    // Slightly darker for sections (#FFE0B2)
      elevated: palette.warm[100],     // Elevated surfaces like cards (#FFF8E1)
      overlay: "rgba(62, 39, 35, 0.5)",
    },

    // Brand colors
    primary: palette.brown[700],
    secondary: palette.warm[600],
    accent: palette.brown[700],

    // Bible-specific
    verseNumber: palette.brown[700],

    // Borders & dividers
    border: palette.warm[400],         // Slightly more visible border
    divider: palette.warm[400],

    // Interactive elements
    interactive: {
      button: {
        background: palette.brown[700],
        pressed: palette.brown[600],
        icon: palette.pure.white,
        divider: "rgba(255, 255, 255, 0.3)",
        shadow: "rgba(139, 115, 85, 0.4)",
      },
      modal: {
        background: palette.warm[200],  // Match primary background
        header: palette.warm[300],      // Slightly darker header
        searchInput: palette.warm[100], // Lighter input field
        searchButton: palette.brown[700],
        searchButtonPressed: palette.brown[600],
      },
    },

    // Book categories
    bookCategories: {
      law: { color: "#166534", bg: "#F0FDF9" },
      history: { color: "#A16207", bg: "#FFFBEB" },
      poetry: { color: "#581C87", bg: "#F5F3FF" },
      majorProphets: { color: "#991B1B", bg: "#FEF2F2" },
      minorProphets: { color: "#1E40AF", bg: "#EFF6FF" },
      gospels: { color: "#166534", bg: "#F0FDF4" },
      acts: { color: "#9A3412", bg: "#FFF7ED" },
      paulLetters: { color: "#581C87", bg: "#F5F3FF" },
      generalLetters: { color: "#A16207", bg: "#FEF3C7" },
      prophecy: { color: "#991B1B", bg: "#FEF2F2" },
    },

    // Verse highlight colors - warm tints for sepia theme
    highlightColors: {
      yellow: { bg: "#FEF9C3", indicator: "#D97706" },
      green: { bg: "#DCFCE7", indicator: "#059669" },
      blue: { bg: "#E0F2FE", indicator: "#0284C7" },
      pink: { bg: "#FDF2F8", indicator: "#BE185D" },
      orange: { bg: "#FFF7ED", indicator: "#EA580C" },
    },
  },
} as const;

// ============================================================================
// TYPOGRAPHY
// ============================================================================

import { Platform } from "react-native";

export const typography = {
  // Font families - Platform-aware for EAS update compatibility
  fontFamily: {
    // Reading-optimized serif for Bible text
    // iOS: Native Georgia | Android/Web: Literata
    serif: Platform.select({
      ios: "Georgia",
      default: "Literata-Regular",
    }) as string,
    serifMedium: Platform.select({
      ios: "Georgia",
      default: "Literata-Medium",
    }) as string,

    // Modern UI fonts with better readability
    // iOS: Native San Francisco (System) | Android/Web: Inter
    sansSerif: Platform.select({
      ios: "System",
      default: "Inter-Regular",
    }) as string,
    sansSerifMedium: Platform.select({
      ios: "System",
      default: "Inter-Medium",
    }) as string,
    sansSerifSemiBold: Platform.select({
      ios: "System",
      default: "Inter-SemiBold",
    }) as string,
    sansSerifBold: Platform.select({
      ios: "System",
      default: "Inter-Bold",
    }) as string,

    // Modern reading font - using platform-specific serif
    reading: Platform.select({
      ios: "Georgia",
      default: "Literata-Regular",
    }) as string,
    readingMedium: Platform.select({
      ios: "Georgia",
      default: "Literata-Medium",
    }) as string,

    // Monospace for verse references - SpaceMono is bundled
    mono: "SpaceMono",

    // Accessibility option - using platform-specific sans-serif
    dyslexic: Platform.select({
      ios: "System",
      default: "Inter-Regular",
    }) as string,
  },

  // Font sizes - Optimized for readability with WCAG compliance
  fontSize: {
    xs: 12, // Minimum for accessibility
    sm: 14, // Small text
    base: 16, // Standard UI
    lg: 18, // Default Bible text
    xl: 20, // Large Bible text option
    "2xl": 24, // Headers
    "3xl": 30, // Chapter numbers
    "4xl": 36, // Book titles
    "5xl": 42, // Display text
  },

  // Font weights - Extended range for variable fonts
  fontWeight: {
    thin: "100",
    extralight: "200",
    light: "300",
    normal: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
    extrabold: "800",
    black: "900",
    // Variable font specific
    variable: {
      min: "100",
      max: "900",
      reading: "425", // Slightly heavier for better readability
    },
  },

  // Line heights - Optimized for long-form reading
  lineHeight: {
    tight: 1.2, // Headers only
    snug: 1.375, // UI elements
    normal: 1.5, // Standard UI
    relaxed: 1.75, // Default Bible text
    loose: 2, // Accessibility mode
    reading: 1.8, // Optimal for long passages
  },

  // Letter spacing - Fine-tuned for readability
  letterSpacing: {
    tighter: -0.8, // Display headers
    tight: -0.5, // Headers
    normal: 0, // Body text
    wide: 0.3, // Improved readability
    wider: 0.8, // Small caps, labels
    widest: 1.5, // Uppercase headers
    reading: 0.15, // Optimal for Bible text
  },

  // Text rendering optimizations
  textRendering: {
    optimizeLegibility: true,
    textSizeAdjust: "100%",
    webkitFontSmoothing: "antialiased",
    mozOsxFontSmoothing: "grayscale",
  },
} as const;

// ============================================================================
// SPACING
// ============================================================================

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  "2xl": 32,
  "3xl": 48,
  "4xl": 64,
} as const;

// ============================================================================
// BIBLE-SPECIFIC TYPOGRAPHY
// ============================================================================

export const bibleTypography = {
  // Main text - Multiple presets for user preference
  body: {
    default: {
      fontSize: typography.fontSize.lg,
      lineHeight: typography.lineHeight.reading,
      fontFamily: typography.fontFamily.reading,
      letterSpacing: typography.letterSpacing.reading,
      // iOS Georgia uses numeric fontWeight, Android/Web Literata uses font file
      ...(Platform.OS === "ios" ? { fontWeight: "400" as const } : {}),
    },
    compact: {
      fontSize: typography.fontSize.base,
      lineHeight: typography.lineHeight.relaxed,
      fontFamily: typography.fontFamily.sansSerif,
      letterSpacing: typography.letterSpacing.normal,
      ...(Platform.OS === "ios" ? { fontWeight: "400" as const } : {}),
    },
    large: {
      fontSize: typography.fontSize.xl,
      lineHeight: typography.lineHeight.loose,
      fontFamily: typography.fontFamily.serif,
      letterSpacing: typography.letterSpacing.wide,
      ...(Platform.OS === "ios" ? { fontWeight: "400" as const } : {}),
    },
    accessible: {
      fontSize: typography.fontSize["2xl"],
      lineHeight: typography.lineHeight.loose,
      fontFamily: typography.fontFamily.dyslexic,
      letterSpacing: typography.letterSpacing.wider,
      fontWeight: Platform.OS === "ios" ? ("500" as const) : typography.fontWeight.medium,
    },
  },

  // Verse numbers - Smaller for less visual prominence (2 levels below body lg=18)
  verseNumber: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    fontFamily: typography.fontFamily.mono,
    opacity: 0.65,
    letterSpacing: typography.letterSpacing.normal,
  },

  // Chapter headers - More distinctive
  chapterHeader: {
    fontSize: typography.fontSize["4xl"],
    fontWeight: typography.fontWeight.extralight,
    fontFamily: typography.fontFamily.serif,
    letterSpacing: typography.letterSpacing.tighter,
    marginBottom: spacing["2xl"],
  },

  // Section headers - Modern approach without all-caps
  sectionHeader: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    fontFamily: typography.fontFamily.sansSerif,
    letterSpacing: typography.letterSpacing.wide,
    textTransform: "none" as const,
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
  },

  // Poetry
  poetry: {
    indent: spacing["2xl"],
    lineHeight: typography.lineHeight.relaxed,
  },
} as const;

// ============================================================================
// ANIMATIONS
// ============================================================================

export const animations = {
  duration: {
    instant: 0,
    fast: 150,
    normal: 200,
    slow: 300,
  },
  easing: {
    easeIn: "ease-in",
    easeOut: "ease-out",
    easeInOut: "ease-in-out",
    spring: "cubic-bezier(0.68, -0.55, 0.265, 1.55)",
  },
} as const;

// ============================================================================
// TYPES & EXPORTS
// ============================================================================

export type ThemeMode = "light" | "dark" | "sepia";

export interface IconColorsType {
  primary: string;
  secondary: string;
  muted: string;
  accent: string;
  interactive: string;
  success: string;
  warning: string;
  error: string;
  info: string;
  liked: string;
  disabled: string;
  inverse: string;
  toggle: {
    active: string;
    inactive: string;
    activeBackground: string;
    inactiveBackground: string;
  };
}

export interface LevelBadgeColors {
  background: string;
  border: string;
  text: string;
}

export interface GamificationColorsType {
  nodePending: string;
  nodeCurrent: string;
  nodeComplete: string;
  progressGlow: string;
  progressComplete: string;
  completionWave: string;
  completionButton: string;
  trophy: string;
  trophyRing: string;
  haloGradientStart: string;
  haloGradientEnd: string;
  // Level badges by tier
  levelBadge: {
    bronze: LevelBadgeColors;
    silver: LevelBadgeColors;
    gold: LevelBadgeColors;
    platinum: LevelBadgeColors;
    diamond: LevelBadgeColors;
  };
  // XP progress bar
  xpBar: {
    background: string;
    fill: string;
  };
  // Daily progress bar (top of screen)
  progressBar: {
    blue: string;
    green: string;
    glowBlue: string;
    glowGreen: string;
    track: string;
  };
}

export interface Theme {
  mode: ThemeMode;
  colors: {
    text: {
      primary: string;
      secondary: string;
      muted: string;
      inverse: string;
    };
    background: {
      primary: string;
      secondary: string;
      elevated: string;
      overlay: string;
    };
    primary: string;
    secondary: string;
    accent: string;
    verseNumber: string;
    border: string;
    divider: string;
    interactive: {
      button: {
        background: string;
        pressed: string;
        icon: string;
        divider: string;
        shadow: string;
      };
      modal: {
        background: string;
        header: string;
        searchInput: string;
        searchButton: string;
        searchButtonPressed: string;
      };
    };
    bookCategories: {
      law: { color: string; bg: string };
      history: { color: string; bg: string };
      poetry: { color: string; bg: string };
      majorProphets: { color: string; bg: string };
      minorProphets: { color: string; bg: string };
      gospels: { color: string; bg: string };
      acts: { color: string; bg: string };
      paulLetters: { color: string; bg: string };
      generalLetters: { color: string; bg: string };
      prophecy: { color: string; bg: string };
    };
    highlightColors: {
      yellow: { bg: string; indicator: string };
      green: { bg: string; indicator: string };
      blue: { bg: string; indicator: string };
      pink: { bg: string; indicator: string };
      orange: { bg: string; indicator: string };
    };
    icons: IconColorsType;
    gamification: GamificationColorsType;
  };
  typography: typeof typography;
  spacing: typeof spacing;
  bibleTypography: typeof bibleTypography;
  animations: typeof animations;
}

// Helper to get gamification colors for a mode
const getGamificationColors = (mode: ThemeMode): GamificationColorsType => ({
  nodePending: palette.gamification.nodePending[mode],
  nodeCurrent: palette.gamification.nodeCurrent[mode],
  nodeComplete: palette.gamification.nodeComplete[mode],
  progressGlow: palette.gamification.progressGlow[mode],
  progressComplete: palette.gamification.progressComplete[mode],
  completionWave: palette.gamification.completionWave[mode],
  completionButton: palette.gamification.completionButton[mode],
  trophy: palette.gamification.trophy[mode],
  trophyRing: palette.gamification.trophyRing[mode],
  haloGradientStart: palette.gamification.haloGradientStart[mode],
  haloGradientEnd: palette.gamification.haloGradientEnd[mode],
  levelBadge: {
    bronze: {
      background: palette.gamification.levelBadge.bronze.background[mode],
      border: palette.gamification.levelBadge.bronze.border[mode],
      text: palette.gamification.levelBadge.bronze.text[mode],
    },
    silver: {
      background: palette.gamification.levelBadge.silver.background[mode],
      border: palette.gamification.levelBadge.silver.border[mode],
      text: palette.gamification.levelBadge.silver.text[mode],
    },
    gold: {
      background: palette.gamification.levelBadge.gold.background[mode],
      border: palette.gamification.levelBadge.gold.border[mode],
      text: palette.gamification.levelBadge.gold.text[mode],
    },
    platinum: {
      background: palette.gamification.levelBadge.platinum.background[mode],
      border: palette.gamification.levelBadge.platinum.border[mode],
      text: palette.gamification.levelBadge.platinum.text[mode],
    },
    diamond: {
      background: palette.gamification.levelBadge.diamond.background[mode],
      border: palette.gamification.levelBadge.diamond.border[mode],
      text: palette.gamification.levelBadge.diamond.text[mode],
    },
  },
  xpBar: {
    background: palette.gamification.xpBar.background[mode],
    fill: palette.gamification.xpBar.fill[mode],
  },
  progressBar: {
    blue: palette.gamification.progressBar.blue[mode],
    green: palette.gamification.progressBar.green[mode],
    glowBlue: palette.gamification.progressBar.glowBlue[mode],
    glowGreen: palette.gamification.progressBar.glowGreen[mode],
    track: palette.gamification.progressBar.track[mode],
  },
});

// Get theme by mode
export const getTheme = (mode: ThemeMode): Theme => ({
  mode,
  colors: {
    ...themeColors[mode],
    icons: iconColors[mode],
    gamification: getGamificationColors(mode),
  },
  typography,
  spacing,
  bibleTypography,
  animations,
});

// Export default theme
export const defaultTheme = getTheme("light");

// Export palette for direct access if needed (iconColors is already exported inline)
export { palette };

// Highlight color type for use in components
export type HighlightColorName = keyof Theme["colors"]["highlightColors"];
