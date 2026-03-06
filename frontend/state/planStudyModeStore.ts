/**
 * Plan Study Mode Store
 * Manages study mode state specifically for Plan Sessions
 * Separate from main studyModeStore to avoid interference
 */

import { observable, computed } from "@legendapp/state";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { bibleVersionStore$ } from "./bibleVersionStore";

// Plan Study Mode Types
export type PlanStudyModeType = "SIMPLE" | "NOTES" | "COMPARE";

// Plan Study Mode State Interface
export interface PlanStudyModeState {
  isActive: boolean;
  studyModeType: PlanStudyModeType;
  comparisonVersion: string | null;
}

const STORAGE_KEY = "plan_study_mode_state";

// Plan Study Mode Store
export const planStudyModeStore$: any = observable({
  // Core state
  isActive: false,
  studyModeType: "SIMPLE" as PlanStudyModeType,
  comparisonVersion: null as string | null,

  // Computed properties
  isCompareMode: computed((): boolean => {
    return planStudyModeStore$.isActive.get() && planStudyModeStore$.studyModeType.get() === "COMPARE";
  }),

  isNotesMode: computed((): boolean => {
    return planStudyModeStore$.isActive.get() && planStudyModeStore$.studyModeType.get() === "NOTES";
  }),

  // Methods
  enterStudyMode: (type: PlanStudyModeType, comparisonVersion?: string) => {
    planStudyModeStore$.studyModeType.set(type);
    planStudyModeStore$.isActive.set(type !== "SIMPLE");

    if (type === "COMPARE" && comparisonVersion) {
      const primaryVersion = bibleVersionStore$.primaryVersion.get();
      if (comparisonVersion !== primaryVersion) {
        planStudyModeStore$.comparisonVersion.set(comparisonVersion);
      }
    } else if (type !== "COMPARE") {
      planStudyModeStore$.comparisonVersion.set(null);
    }

    planStudyModeStore$.saveState();
    console.log(`[PlanStudyMode] Entered ${type} mode`);
  },

  exitStudyMode: () => {
    planStudyModeStore$.isActive.set(false);
    planStudyModeStore$.studyModeType.set("SIMPLE");
    planStudyModeStore$.comparisonVersion.set(null);
    planStudyModeStore$.saveState();
    console.log("[PlanStudyMode] Exited study mode");
  },

  setStudyModeType: (type: PlanStudyModeType) => {
    planStudyModeStore$.studyModeType.set(type);
    planStudyModeStore$.isActive.set(type !== "SIMPLE");

    if (type !== "COMPARE") {
      planStudyModeStore$.comparisonVersion.set(null);
    }

    planStudyModeStore$.saveState();
    console.log(`[PlanStudyMode] Set study mode type to ${type}`);
  },

  setComparisonVersion: (versionId: string | null) => {
    const primaryVersion = bibleVersionStore$.primaryVersion.get();
    if (versionId === primaryVersion) {
      console.warn("[PlanStudyMode] Cannot set comparison version same as primary");
      return;
    }

    planStudyModeStore$.comparisonVersion.set(versionId);
    planStudyModeStore$.saveState();
    console.log(`[PlanStudyMode] Set comparison version to ${versionId}`);
  },

  // Atomic swap function: primary <-> comparison
  swapVersions: async () => {
    const primaryVersion = bibleVersionStore$.primaryVersion.get();
    const comparisonVersion = planStudyModeStore$.comparisonVersion.get();

    if (!comparisonVersion) {
      console.warn("[PlanStudyMode] Cannot swap: no comparison version set");
      return;
    }

    // Three-way atomic swap
    const temp = primaryVersion;
    await bibleVersionStore$.setPrimaryVersion(comparisonVersion);
    planStudyModeStore$.comparisonVersion.set(temp);

    planStudyModeStore$.saveState();
    console.log(`[PlanStudyMode] Swapped versions: ${temp} <-> ${comparisonVersion}`);
  },

  // Persistence methods
  saveState: async () => {
    try {
      const state = {
        isActive: planStudyModeStore$.isActive.get(),
        studyModeType: planStudyModeStore$.studyModeType.get(),
        comparisonVersion: planStudyModeStore$.comparisonVersion.get(),
      };

      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.error("[PlanStudyMode] Failed to save state:", error);
    }
  },

  loadState: async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const state = JSON.parse(stored);
        planStudyModeStore$.isActive.set(state.isActive ?? false);
        planStudyModeStore$.studyModeType.set(state.studyModeType ?? "SIMPLE");
        planStudyModeStore$.comparisonVersion.set(state.comparisonVersion ?? null);
        console.log("[PlanStudyMode] Loaded state:", state);
      }
    } catch (error) {
      console.error("[PlanStudyMode] Failed to load state:", error);
    }
  },
});
