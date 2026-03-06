/**
 * Bible Version Store
 * Manages global Bible version selection and available versions
 * Separate from study mode to maintain single responsibility
 */

import { observable, computed } from "@legendapp/state";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { bibleSQLite } from '../services/sqlite';

// Bible Version type (matches database structure)
export interface BibleVersion {
  id: string;
  name: string;
  abbreviation: string;
  language: string;
  isDefault: boolean;
  isDownloaded: boolean;
}

// Bible Version State Interface
export interface BibleVersionState {
  primaryVersion: string; // Current primary Bible version (e.g., "ESV")
  availableVersions: BibleVersion[];
  isLoading: boolean;
}

// Bible Version Store
export const bibleVersionStore$: any = observable({
  // Core state
  primaryVersion: 'NIV', // Default primary version
  availableVersions: [] as BibleVersion[],
  isLoading: false,

  // Computed properties
  primaryVersionData: computed((): BibleVersion | undefined => {
    const state = bibleVersionStore$.get();
    return state.availableVersions.find((v: BibleVersion) => v.id === state.primaryVersion);
  }),

  // Get a specific version's data
  getVersionData: (versionId: string): BibleVersion | undefined => {
    const versions = bibleVersionStore$.availableVersions.get();
    return versions.find((v: BibleVersion) => v.id === versionId);
  },

  // Methods
  setPrimaryVersion: async (versionId: string) => {
    // Validate version exists
    const versions = bibleVersionStore$.availableVersions.get();
    const version = versions.find((v: BibleVersion) => v.id === versionId);

    if (!version) {
      console.warn(`[BibleVersionStore] Version ${versionId} not found`);
      return false;
    }

    // Update SQLite service
    const success = await bibleSQLite.setCurrentVersion(versionId);
    if (!success) {
      console.error(`[BibleVersionStore] Failed to set version ${versionId} in SQLite`);
      return false;
    }

    // Update store
    bibleVersionStore$.primaryVersion.set(versionId);

    // Save state
    await bibleVersionStore$.saveState();

    console.log(`[BibleVersionStore] Primary version set to ${versionId}`);
    return true;
  },

  // Load available versions from database
  loadAvailableVersions: async (): Promise<BibleVersion[]> => {
    try {
      bibleVersionStore$.isLoading.set(true);

      const dbVersions = await bibleSQLite.getAvailableVersions();

      // Convert database versions to BibleVersion interface
      const versions = dbVersions.map(v => ({
        id: v.id,
        name: v.name,
        abbreviation: v.abbreviation,
        language: v.language,
        isDefault: v.is_default,
        isDownloaded: true // All versions in database are downloaded
      }));

      // Add LIV version label in dev mode
      if (__DEV__) {
        const livIndex = versions.findIndex(v => v.id === 'LIV');
        if (livIndex >= 0) {
          versions[livIndex].name = 'Lorem Ipsum Version (Dev)';
        }
      }

      // Update store with loaded versions
      bibleVersionStore$.availableVersions.set(versions);
      bibleVersionStore$.isLoading.set(false);

      console.log(`[BibleVersionStore] Loaded ${versions.length} versions`);
      return versions;
    } catch (error) {
      console.error('[BibleVersionStore] Failed to load versions:', error);
      bibleVersionStore$.isLoading.set(false);

      // Fallback to NIV only
      const fallback = [{
        id: 'NIV',
        name: 'New International Version',
        abbreviation: 'NIV',
        language: 'en',
        isDefault: true,
        isDownloaded: true
      }];
      bibleVersionStore$.availableVersions.set(fallback);
      return fallback;
    }
  },

  // Check if a version is available
  isVersionAvailable: (versionId: string): boolean => {
    const versions = bibleVersionStore$.availableVersions.get();
    const version = versions.find((v: BibleVersion) => v.id === versionId);
    return version?.isDownloaded || false;
  },

  // Get versions for a specific language
  getVersionsByLanguage: (language: string): BibleVersion[] => {
    const versions = bibleVersionStore$.availableVersions.get();
    return versions.filter((v: BibleVersion) => v.language === language);
  },

  // Persistence methods
  saveState: async () => {
    try {
      const state = {
        primaryVersion: bibleVersionStore$.primaryVersion.get(),
      };

      await AsyncStorage.setItem('bible_version_state', JSON.stringify(state));
      console.log('[BibleVersionStore] State saved');
    } catch (error) {
      console.error('[BibleVersionStore] Failed to save state:', error);
    }
  },

  loadState: async () => {
    try {
      // Load available versions from database first
      await bibleVersionStore$.loadAvailableVersions();

      // Load saved preferences
      const stored = await AsyncStorage.getItem('bible_version_state');
      if (stored) {
        const state = JSON.parse(stored);

        // Validate saved version is still available
        if (state.primaryVersion && bibleVersionStore$.isVersionAvailable(state.primaryVersion)) {
          bibleVersionStore$.primaryVersion.set(state.primaryVersion);

          // Set in SQLite service
          await bibleSQLite.setCurrentVersion(state.primaryVersion);
        } else {
          // Default to NIV if saved version not available
          bibleVersionStore$.primaryVersion.set('NIV');
          await bibleSQLite.setCurrentVersion('NIV');
        }
      } else {
        // First time - use default
        await bibleSQLite.setCurrentVersion('NIV');
      }

      console.log(`[BibleVersionStore] State loaded, primary version: ${bibleVersionStore$.primaryVersion.get()}`);
    } catch (error) {
      console.error('[BibleVersionStore] Failed to load state:', error);
      // Ensure we have a working default
      bibleVersionStore$.primaryVersion.set('NIV');
      await bibleSQLite.setCurrentVersion('NIV');
    }
  },

  // Initialize the store (called on app start)
  initialize: async () => {
    await bibleVersionStore$.loadState();
  }
});