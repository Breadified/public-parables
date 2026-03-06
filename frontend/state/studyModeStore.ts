import { observable, computed } from "@legendapp/state";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { bibleVersionStore$ } from './bibleVersionStore';
import type { BibleVersion } from './bibleVersionStore';
import { AlignmentMode, StudyModeType, studyModeConfig } from '@/config/studyModeConfig';

// Study Mode View States
export type StudyModeView = 'split' | 'version1_full' | 'version2_full';

// Study Mode State Interface
export interface StudyModeState {
  isActive: boolean;
  studyModeType: StudyModeType; // COMPARE (versions) or NOTES (note-taking)
  comparisonVersion: string | null; // Version ID for comparison or null if not selected
  currentView: StudyModeView;
  scrollSync: boolean; // Whether scrolling is synchronized
  textScale: number; // 0.9 for reduced size in study mode
  showOnboarding: boolean; // Show study mode intro on first use
  alignmentMode: AlignmentMode; // VERSE_ALIGNED (simple) or DIFF_ALIGNED (complex)
}

// Paragraph info structure for caching (must match useDiffAlignedChapters)
export interface CachedParagraphInfo {
  verseLines: any[]; // VerseLine[] - keeping as any[] to avoid circular imports
  isPoetry: boolean;
  sectionIdx: number;
  sectionTitle?: string;
  sectionSubtitle?: string;
  minVerseId: number;
  maxVerseId: number;
}

// Cache entry for split paragraph calculations
export interface SplitCacheEntry {
  chapterId: number;
  leftVersionId: string;
  rightVersionId: string;
  splitLeftParagraphs: CachedParagraphInfo[];
  splitRightParagraphs: CachedParagraphInfo[];
  timestamp: number; // For potential cache invalidation
}

// Re-export for backward compatibility
export { BibleVersion } from './bibleVersionStore';

// Study Mode Store
export const studyModeStore$: any = observable({
  // Core state
  isActive: false,
  studyModeType: studyModeConfig.defaultStudyModeType, // COMPARE or NOTES
  comparisonVersion: null as string | null, // Only the comparison version for study mode
  currentView: 'split' as StudyModeView,
  scrollSync: true,
  textScale: 1.0, // Normal scale when not in study mode
  showOnboarding: true,
  alignmentMode: studyModeConfig.defaultAlignmentMode, // VERSE_ALIGNED (simple) or DIFF_ALIGNED (complex)

  // Split paragraph calculation cache
  // Key format: "{chapterId}-{sortedVersionId1}-{sortedVersionId2}"
  // Treating (v1, v2) and (v2, v1) as the same by sorting version IDs
  splitCache: {} as Record<string, SplitCacheEntry>,

  // Computed properties
  isStudyModeReady: computed((): boolean => {
    const state = studyModeStore$.get();
    return !!(state.comparisonVersion && state.isActive);
  }),

  // Get both versions for study mode (primary from bibleVersionStore, comparison from here)
  activeVersions: computed((): BibleVersion[] => {
    const state = studyModeStore$.get();
    const versions: BibleVersion[] = [];

    // Get primary version from bibleVersionStore
    const primaryVersionData = bibleVersionStore$.primaryVersionData.get();
    if (primaryVersionData) versions.push(primaryVersionData);

    // Get comparison version if set
    if (state.comparisonVersion) {
      const comparisonVersionData = bibleVersionStore$.getVersionData(state.comparisonVersion);
      if (comparisonVersionData) versions.push(comparisonVersionData);
    }

    return versions;
  }),

  // Methods
  enterStudyMode: (comparisonVersion?: string) => {
    const primaryVersion = bibleVersionStore$.primaryVersion.get();

    // Set comparison version if provided
    if (comparisonVersion && comparisonVersion !== primaryVersion) {
      studyModeStore$.comparisonVersion.set(comparisonVersion);
    }
    // NOTE: We no longer auto-select a version - user must choose

    // Activate study mode
    studyModeStore$.isActive.set(true);
    studyModeStore$.currentView.set('split');
    studyModeStore$.textScale.set(0.9); // Reduce text size as per spec

    // Save state
    studyModeStore$.saveState();
  },

  exitStudyMode: () => {
    studyModeStore$.isActive.set(false);
    studyModeStore$.currentView.set('split');
    studyModeStore$.textScale.set(1.0); // Restore normal text size
    studyModeStore$.comparisonVersion.set(null);

    // Save state
    studyModeStore$.saveState();
  },

  // Enter NOTES study mode (Bible + Notes split view)
  enterNotesMode: () => {
    studyModeStore$.studyModeType.set(StudyModeType.NOTES);
    studyModeStore$.isActive.set(true);
    studyModeStore$.currentView.set('split');
    studyModeStore$.textScale.set(0.9); // Reduce text size for split view

    // Save state
    studyModeStore$.saveState();
  },

  setComparisonVersion: (versionId: string | null) => {
    // Ensure comparison version is different from primary
    const primaryVersion = bibleVersionStore$.primaryVersion.get();
    if (versionId === primaryVersion) {
      return; // Don't allow same version
    }

    studyModeStore$.comparisonVersion.set(versionId);

    // If setting comparison version and study mode isn't active, activate it
    if (versionId && !studyModeStore$.isActive.get()) {
      studyModeStore$.enterStudyMode(versionId);
    } else {
      studyModeStore$.saveState();
    }
  },

  // Atomic swap function: primary <-> comparison
  swapVersions: async () => {
    const primaryVersion = bibleVersionStore$.primaryVersion.get();
    const comparisonVersion = studyModeStore$.comparisonVersion.get();

    if (!comparisonVersion) {
      console.warn('[StudyMode] Cannot swap: no comparison version set');
      return;
    }

    // Three-way atomic swap: a -> temp, b -> a, temp -> b
    const temp = primaryVersion;

    // Update both versions atomically
    await bibleVersionStore$.setPrimaryVersion(comparisonVersion);
    studyModeStore$.comparisonVersion.set(temp);

    // Save state
    studyModeStore$.saveState();

    console.log(`[StudyMode] Swapped versions: ${temp} <-> ${comparisonVersion}`);
  },

  toggleView: (view: StudyModeView) => {
    studyModeStore$.currentView.set(view);
    studyModeStore$.saveState();
  },

  // Swipe navigation methods
  swipeToVersion1Full: () => {
    if (studyModeStore$.isActive.get()) {
      studyModeStore$.currentView.set('version1_full');
      studyModeStore$.saveState();
    }
  },

  swipeToVersion2Full: () => {
    if (studyModeStore$.isActive.get() && studyModeStore$.comparisonVersion.get()) {
      studyModeStore$.currentView.set('version2_full');
      studyModeStore$.saveState();
    }
  },

  swipeToSplitView: () => {
    if (studyModeStore$.isActive.get()) {
      studyModeStore$.currentView.set('split');
      studyModeStore$.saveState();
    }
  },

  toggleScrollSync: () => {
    const current = studyModeStore$.scrollSync.get();
    studyModeStore$.scrollSync.set(!current);
    studyModeStore$.saveState();
  },

  dismissOnboarding: () => {
    studyModeStore$.showOnboarding.set(false);
    studyModeStore$.saveState();
  },

  setAlignmentMode: (mode: AlignmentMode) => {
    studyModeStore$.alignmentMode.set(mode);
    studyModeStore$.saveState();
    console.log(`[StudyMode] Alignment mode set to ${mode}`);
  },

  setStudyModeType: (type: StudyModeType) => {
    studyModeStore$.studyModeType.set(type);
    studyModeStore$.saveState();
    console.log(`[StudyMode] Study mode type set to ${type}`);
  },

  // Persistence methods
  saveState: async () => {
    try {
      const state = {
        isActive: studyModeStore$.isActive.get(),
        studyModeType: studyModeStore$.studyModeType.get(),
        comparisonVersion: studyModeStore$.comparisonVersion.get(),
        currentView: studyModeStore$.currentView.get(),
        scrollSync: studyModeStore$.scrollSync.get(),
        textScale: studyModeStore$.textScale.get(),
        showOnboarding: studyModeStore$.showOnboarding.get(),
        alignmentMode: studyModeStore$.alignmentMode.get()
      };

      await AsyncStorage.setItem('study_mode_state', JSON.stringify(state));
    } catch (error) {
      console.error('Failed to save study mode state:', error);
    }
  },

  loadState: async () => {
    try {
      const stored = await AsyncStorage.getItem('study_mode_state');
      if (stored) {
        const state = JSON.parse(stored);

        // Restore full study mode state including active status
        studyModeStore$.studyModeType.set(state.studyModeType ?? studyModeConfig.defaultStudyModeType); // Restore study mode type
        studyModeStore$.comparisonVersion.set(state.comparisonVersion || state.version2 || null); // Support old version2 key
        studyModeStore$.scrollSync.set(state.scrollSync ?? true);
        studyModeStore$.showOnboarding.set(state.showOnboarding ?? true);
        studyModeStore$.isActive.set(state.isActive ?? false); // Restore active state
        studyModeStore$.currentView.set(state.currentView || 'split'); // Restore view
        studyModeStore$.textScale.set(state.textScale ?? 1.0); // Restore text scale
        studyModeStore$.alignmentMode.set(state.alignmentMode ?? studyModeConfig.defaultAlignmentMode); // Restore alignment mode
      }
    } catch (error) {
      console.error('Failed to load study mode state:', error);
    }
  },

  // Delegate version availability check to bibleVersionStore
  isVersionAvailable: (versionId: string): boolean => {
    return bibleVersionStore$.isVersionAvailable(versionId);
  },

  // Split calculation cache methods
  // Generate cache key (version-order independent)
  getSplitCacheKey: (chapterId: number, version1: string, version2: string): string => {
    const sortedVersions = [version1, version2].sort();
    return `${chapterId}-${sortedVersions[0]}-${sortedVersions[1]}`;
  },

  // Get cached split calculation result
  getSplitCache: (
    chapterId: number,
    version1: string,
    version2: string
  ): SplitCacheEntry | null => {
    const key = studyModeStore$.getSplitCacheKey(chapterId, version1, version2);
    const cache = studyModeStore$.splitCache.get();
    const entry = cache[key];

    if (entry) {
      console.log(`[StudyMode] ✅ Split cache HIT for ${key}`);
      return entry;
    }

    console.log(`[StudyMode] ❌ Split cache MISS for ${key}`);
    return null;
  },

  // Store split calculation result
  setSplitCache: (
    chapterId: number,
    leftVersionId: string,
    rightVersionId: string,
    splitLeftParagraphs: CachedParagraphInfo[],
    splitRightParagraphs: CachedParagraphInfo[]
  ) => {
    const key = studyModeStore$.getSplitCacheKey(chapterId, leftVersionId, rightVersionId);
    const entry: SplitCacheEntry = {
      chapterId,
      leftVersionId,
      rightVersionId,
      splitLeftParagraphs,
      splitRightParagraphs,
      timestamp: Date.now(),
    };

    const cache = studyModeStore$.splitCache.get();
    studyModeStore$.splitCache.set({
      ...cache,
      [key]: entry,
    });

    console.log(`[StudyMode] 💾 Cached split calculation for ${key} (${splitLeftParagraphs.length} left, ${splitRightParagraphs.length} right paragraphs)`);
  },

  // Clear split cache (useful for memory management or debugging)
  clearSplitCache: () => {
    studyModeStore$.splitCache.set({});
    console.log('[StudyMode] 🗑️  Split cache cleared');
  },

  // Backward compatibility getters (will be removed later)
  get version1() { return bibleVersionStore$.primaryVersion; },
  get version2() { return studyModeStore$.comparisonVersion; },
  get availableVersions() { return bibleVersionStore$.availableVersions; },

  // Backward compatibility setters (will be removed later)
  setVersion1: (versionId: string) => {
    bibleVersionStore$.setPrimaryVersion(versionId);
  },
  setVersion2: (versionId: string | null) => {
    studyModeStore$.setComparisonVersion(versionId);
  }
});