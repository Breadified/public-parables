/**
 * FAB Registry - Centralized state management for FAB icons and actions
 *
 * Manages:
 * - Icon mappings for different modes
 * - Action handlers registry
 * - Mode-specific configurations
 *
 * Benefits:
 * - Single source of truth for FAB appearance
 * - Easy to update icons across the app
 * - Consistent iconography
 *
 * Note: Icon definitions are sourced from config/iconConfig.ts for DRY
 */

import { observable } from "@legendapp/state";
import type { StudyModeType } from "../config/studyModeConfig";
import { actionIcons, type IconLibrary } from "../config/iconConfig";

export type { IconLibrary };

export interface FABIcon {
  name: string;
  library: IconLibrary;
}

export interface FABModeConfig {
  icon: FABIcon;
  label: string;
  description: string;
}

export interface FABRegistryState {
  // Icon configurations for different study modes
  studyModeIcons: Record<StudyModeType, FABModeConfig>;

  // Icon for normal mode (not in study mode)
  normalModeIcon: FABModeConfig;

  // Icon for exit button
  exitIcon: FABModeConfig;
}

/**
 * FAB Registry Store
 * Centralized configuration for all FAB icons and behaviors
 * Uses actionIcons from config/iconConfig.ts for consistency
 */
export const fabRegistry$ = observable<FABRegistryState>({
  // Study Mode Icons - using centralized actionIcons
  studyModeIcons: {
    COMPARE: {
      icon: actionIcons.compare,
      label: "Compare",
      description: "Compare Bible versions side-by-side",
    },
    NOTES: {
      icon: actionIcons.notes,
      label: "Notes",
      description: "Take notes aligned with verses",
    },
  },

  // Normal Mode Icon (when NOT in study mode)
  normalModeIcon: {
    icon: actionIcons.studyMode,
    label: "Study Mode",
    description: "Enter study mode for advanced features",
  },

  // Exit Icon
  exitIcon: {
    icon: actionIcons.close,
    label: "Exit",
    description: "Exit study mode",
  },
});

/**
 * Helper function to get FAB icon for current study mode
 */
export const getFABIconForMode = (studyModeType: StudyModeType | null): FABIcon => {
  if (!studyModeType) {
    return fabRegistry$.normalModeIcon.icon.get();
  }

  return fabRegistry$.studyModeIcons[studyModeType].icon.get();
};

/**
 * Helper function to get FAB config for current study mode
 */
export const getFABConfigForMode = (studyModeType: StudyModeType | null): FABModeConfig => {
  if (!studyModeType) {
    return fabRegistry$.normalModeIcon.get();
  }

  return fabRegistry$.studyModeIcons[studyModeType].get();
};
