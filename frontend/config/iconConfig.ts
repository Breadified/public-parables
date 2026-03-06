/**
 * Centralized Icon Configuration
 *
 * Single source of truth for:
 * - Icon names mapped to actions/features
 * - Icon libraries (Ionicons, MaterialIcons)
 * - Theme-aware icon color utilities
 *
 * Benefits:
 * - DRY: Change icon names in one place
 * - Consistent iconography across the app
 * - Theme-aware colors that work in light/dark/sepia
 */

import type { Theme, ThemeMode } from './theme';
import { themeColors, palette } from './theme';

// ============================================================================
// ICON LIBRARY TYPES
// ============================================================================

export type IconLibrary = 'Ionicons' | 'MaterialIcons' | 'FontAwesome';

export interface IconDefinition {
  name: string;
  library: IconLibrary;
}

// ============================================================================
// ACTION ICONS - Map actions to icon names
// ============================================================================

/**
 * Centralized icon mappings for common actions
 * Use these throughout the app for consistency
 */
export const actionIcons = {
  // Study Mode
  compare: { name: 'documents-outline', library: 'Ionicons' },
  notes: { name: 'create-outline', library: 'Ionicons' },
  studyMode: { name: 'chrome-reader-mode', library: 'MaterialIcons' },

  // Navigation
  back: { name: 'chevron-back', library: 'Ionicons' },
  forward: { name: 'chevron-forward', library: 'Ionicons' },
  close: { name: 'close', library: 'Ionicons' },
  menu: { name: 'menu', library: 'Ionicons' },

  // Actions
  delete: { name: 'trash-outline', library: 'Ionicons' },
  edit: { name: 'pencil-outline', library: 'Ionicons' },
  share: { name: 'share-outline', library: 'Ionicons' },
  copy: { name: 'copy-outline', library: 'Ionicons' },
  search: { name: 'search-outline', library: 'Ionicons' },
  add: { name: 'add', library: 'Ionicons' },
  remove: { name: 'remove', library: 'Ionicons' },

  // Content
  bookmark: { name: 'bookmark-outline', library: 'Ionicons' },
  bookmarkFilled: { name: 'bookmark', library: 'Ionicons' },
  like: { name: 'heart-outline', library: 'Ionicons' },
  likeFilled: { name: 'heart', library: 'Ionicons' },
  comment: { name: 'chatbubble-outline', library: 'Ionicons' },
  commentFilled: { name: 'chatbubble', library: 'Ionicons' },

  // Bible/Reading
  bible: { name: 'book-outline', library: 'Ionicons' },
  chapter: { name: 'document-text-outline', library: 'Ionicons' },
  verse: { name: 'text-outline', library: 'Ionicons' },
  highlight: { name: 'color-fill-outline', library: 'Ionicons' },

  // Status/Info
  checkmark: { name: 'checkmark-circle', library: 'Ionicons' },
  checkmarkOutline: { name: 'checkmark-circle-outline', library: 'Ionicons' },
  info: { name: 'information-circle-outline', library: 'Ionicons' },
  warning: { name: 'warning-outline', library: 'Ionicons' },
  error: { name: 'alert-circle-outline', library: 'Ionicons' },

  // Tabs/Navigation
  home: { name: 'home-outline', library: 'Ionicons' },
  devotion: { name: 'chatbubble-ellipses-outline', library: 'Ionicons' },
  library: { name: 'bookmark-outline', library: 'Ionicons' },
  plans: { name: 'calendar-outline', library: 'Ionicons' },
  settings: { name: 'settings-outline', library: 'Ionicons' },

  // User/Auth
  user: { name: 'person-outline', library: 'Ionicons' },
  userFilled: { name: 'person', library: 'Ionicons' },
  shield: { name: 'shield-outline', library: 'Ionicons' },
  shieldFilled: { name: 'shield', library: 'Ionicons' },

  // Misc
  swap: { name: 'swap-horizontal', library: 'Ionicons' },
  sync: { name: 'sync-outline', library: 'Ionicons' },
  calendar: { name: 'calendar-outline', library: 'Ionicons' },
  time: { name: 'time-outline', library: 'Ionicons' },
  location: { name: 'location-outline', library: 'Ionicons' },
  expand: { name: 'expand-outline', library: 'Ionicons' },
  collapse: { name: 'contract-outline', library: 'Ionicons' },
  chevronDown: { name: 'chevron-down', library: 'Ionicons' },
  chevronUp: { name: 'chevron-up', library: 'Ionicons' },
} as const;

export type ActionIconKey = keyof typeof actionIcons;

// ============================================================================
// ICON COLORS - Theme-aware color utilities
// ============================================================================

/**
 * Semantic icon colors that adapt to theme mode
 * These colors are designed for proper contrast in all themes
 */
export const getIconColors = (mode: ThemeMode) => {
  const colors = themeColors[mode];

  return {
    // Primary icon color (for most UI icons)
    primary: colors.text.primary,

    // Secondary/muted icon color
    secondary: colors.text.secondary,
    muted: colors.text.muted,

    // Interactive icon colors
    interactive: colors.interactive.button.icon,
    interactiveBackground: colors.interactive.button.background,

    // Accent colors for emphasis
    accent: colors.accent,

    // Semantic colors for status
    success: mode === 'dark' ? palette.semantic.success.dark : palette.semantic.success.light,
    warning: mode === 'dark' ? palette.semantic.warning.dark : palette.semantic.warning.light,
    error: mode === 'dark' ? palette.semantic.error.dark : palette.semantic.error.light,
    info: mode === 'dark' ? palette.semantic.info.dark : palette.semantic.info.light,

    // Special states
    liked: mode === 'dark' ? palette.semantic.error.dark : palette.semantic.error.light,
    disabled: colors.text.muted,

    // Inverse (for use on colored backgrounds)
    inverse: colors.text.inverse,

    // Contrast pairs for toggle states
    toggle: {
      active: colors.text.inverse,
      inactive: colors.text.muted,
      activeBackground: colors.interactive.button.background,
      inactiveBackground: colors.background.secondary,
    },
  };
};

export type IconColors = ReturnType<typeof getIconColors>;

/**
 * Get icon color from theme context
 * Use this in components: const iconColors = getIconColorsFromTheme(theme);
 */
export const getIconColorsFromTheme = (theme: Theme): IconColors => {
  return getIconColors(theme.mode);
};

// ============================================================================
// STUDY MODE ICON CONFIG
// ============================================================================

export interface StudyModeIconConfig {
  icon: IconDefinition;
  label: string;
  description: string;
  features: string[];
}

export const studyModeConfig: Record<'COMPARE' | 'NOTES', StudyModeIconConfig> = {
  COMPARE: {
    icon: actionIcons.compare,
    label: 'Compare Versions',
    description: 'Read two Bible translations side-by-side with verse-aligned formatting',
    features: ['Side-by-side view', 'Verse alignment', 'Synced scrolling'],
  },
  NOTES: {
    icon: actionIcons.notes,
    label: 'Take Notes',
    description: 'Study the Bible with a dedicated note-taking pane for insights and reflections',
    features: ['Auto-save notes', 'Chapter-aligned', 'Offline sync'],
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get icon name for a given action
 */
export const getIconName = (action: ActionIconKey): string => {
  return actionIcons[action].name;
};

/**
 * Get icon library for a given action
 */
export const getIconLibrary = (action: ActionIconKey): IconLibrary => {
  return actionIcons[action].library;
};

/**
 * Get full icon definition for a given action
 */
export const getIcon = (action: ActionIconKey): IconDefinition => {
  return actionIcons[action];
};
