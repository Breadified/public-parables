/**
 * Synchronized Scroll Manager
 * Handles side-by-side Bible view synchronization similar to git diff
 *
 * Strategy: Verse-anchored scroll sync
 * - Track the currently visible verse in the active (scrolling) panel
 * - Calculate the corresponding position in the other panel
 * - Smooth scroll to maintain alignment
 */

export interface SyncScrollState {
  isEnabled: boolean;
  isPrimaryScrolling: boolean; // Which panel is being actively scrolled
  lastSyncedVerse: number | null; // ChapterId of the last synced verse
  primaryOffset: number;
  comparisonOffset: number;
}

export class SyncScrollManager {
  private state: SyncScrollState = {
    isEnabled: true,
    isPrimaryScrolling: false,
    lastSyncedVerse: null,
    primaryOffset: 0,
    comparisonOffset: 0,
  };

  private primaryRef: any = null;
  private comparisonRef: any = null;
  private isSyncing = false;
  private syncTimeout: ReturnType<typeof setTimeout> | null = null;

  /**
   * Register FlashList refs for both panels
   */
  registerRefs(primaryRef: any, comparisonRef: any) {
    this.primaryRef = primaryRef;
    this.comparisonRef = comparisonRef;
  }

  /**
   * Enable/disable synchronized scrolling
   */
  setEnabled(enabled: boolean) {
    this.state.isEnabled = enabled;
  }

  /**
   * Handle scroll event from primary panel
   */
  onPrimaryScroll(event: any) {
    if (!this.state.isEnabled || this.isSyncing) return;

    const offset = event.nativeEvent.contentOffset.y;
    this.state.primaryOffset = offset;
    this.state.isPrimaryScrolling = true;

    // Debounce sync to avoid excessive updates
    if (this.syncTimeout) clearTimeout(this.syncTimeout);
    this.syncTimeout = setTimeout(() => {
      this.syncToComparison(offset);
    }, 50);
  }

  /**
   * Handle scroll event from comparison panel
   */
  onComparisonScroll(event: any) {
    if (!this.state.isEnabled || this.isSyncing) return;

    const offset = event.nativeEvent.contentOffset.y;
    this.state.comparisonOffset = offset;
    this.state.isPrimaryScrolling = false;

    // Debounce sync to avoid excessive updates
    if (this.syncTimeout) clearTimeout(this.syncTimeout);
    this.syncTimeout = setTimeout(() => {
      this.syncToPrimary(offset);
    }, 50);
  }

  /**
   * Sync comparison panel to match primary panel's position
   */
  private syncToComparison(primaryOffset: number) {
    if (!this.comparisonRef || !this.state.isEnabled) return;

    this.isSyncing = true;

    try {
      // For now, use 1:1 offset mapping
      // In future, we can calculate based on verse heights
      this.comparisonRef.scrollToOffset({
        offset: primaryOffset,
        animated: false, // No animation for smoother sync
      });
    } catch (error) {
      console.warn('[SyncScroll] Error syncing to comparison:', error);
    } finally {
      // Reset syncing flag after a short delay
      setTimeout(() => {
        this.isSyncing = false;
      }, 100);
    }
  }

  /**
   * Sync primary panel to match comparison panel's position
   */
  private syncToPrimary(comparisonOffset: number) {
    if (!this.primaryRef || !this.state.isEnabled) return;

    this.isSyncing = true;

    try {
      // For now, use 1:1 offset mapping
      this.primaryRef.scrollToOffset({
        offset: comparisonOffset,
        animated: false,
      });
    } catch (error) {
      console.warn('[SyncScroll] Error syncing to primary:', error);
    } finally {
      setTimeout(() => {
        this.isSyncing = false;
      }, 100);
    }
  }

  /**
   * Navigate both panels to a specific chapter
   */
  syncNavigateToChapter(chapterId: number) {
    // This would calculate the index of the chapter and scroll both panels
    // For now, let the individual BibleViewerSimplified components handle navigation
    console.log('[SyncScroll] Navigate to chapter:', chapterId);
  }

  /**
   * Clean up resources
   */
  cleanup() {
    if (this.syncTimeout) clearTimeout(this.syncTimeout);
    this.primaryRef = null;
    this.comparisonRef = null;
  }
}

// Export singleton instance
export const syncScrollManager = new SyncScrollManager();