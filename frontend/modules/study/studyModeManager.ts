import { studyModeStore$ } from '../../state/studyModeStore';
import { bibleStore$ } from '../../state/bibleStore';
import type { BibleVersion, StudyModeView } from '../../state/studyModeStore';

/**
 * Study Mode Manager Module
 * Handles all business logic for Study Mode functionality
 * Separated from UI components for clean architecture
 */

export interface StudyModeScrollPosition {
  version1: number;
  version2: number;
  syncPoint: number; // The verse ID where both versions are synced
}

export interface StudyModeContent {
  version1: {
    versionId: string;
    chapterId: number;
    content: any; // Chapter content from database
  };
  version2: {
    versionId: string;
    chapterId: number;
    content: any;
  } | null;
}

export class StudyModeManager {
  private scrollPositions: StudyModeScrollPosition = {
    version1: 0,
    version2: 0,
    syncPoint: 0
  };

  /**
   * Initialize Study Mode with version selection
   */
  async initializeStudyMode(primaryVersion?: string, secondaryVersion?: string): Promise<void> {
    // Set primary version if provided
    if (primaryVersion) {
      studyModeStore$.setVersion1(primaryVersion);
    }

    // Validate versions are available
    if (!this.validateVersionAvailability(primaryVersion || studyModeStore$.version1.get())) {
      throw new Error('Primary version is not available');
    }

    if (secondaryVersion) {
      if (!this.validateVersionAvailability(secondaryVersion)) {
        throw new Error('Secondary version is not available');
      }
      studyModeStore$.setVersion2(secondaryVersion);
    }

    // Enter study mode
    studyModeStore$.enterStudyMode(secondaryVersion);
  }

  /**
   * Validate if a Bible version is available for use
   */
  private validateVersionAvailability(versionId: string): boolean {
    return studyModeStore$.isVersionAvailable(versionId);
  }

  /**
   * Get study mode content for current chapter
   */
  async getStudyModeContent(chapterId: number): Promise<StudyModeContent> {
    const version1 = studyModeStore$.version1.get();
    const version2 = studyModeStore$.version2.get();

    // This would normally fetch from SQLite database
    // For now, returning structure
    const content: StudyModeContent = {
      version1: {
        versionId: version1,
        chapterId,
        content: null // Will be fetched from database
      },
      version2: null
    };

    if (version2) {
      content.version2 = {
        versionId: version2,
        chapterId,
        content: null // Will be fetched from database
      };
    }

    return content;
  }

  /**
   * Handle synchronized scrolling between versions
   */
  handleSynchronizedScroll(
    sourceVersion: 'version1' | 'version2',
    scrollPosition: number,
    verseId: number
  ): StudyModeScrollPosition {
    if (!studyModeStore$.scrollSync.get()) {
      // If not synced, only update the source version
      if (sourceVersion === 'version1') {
        this.scrollPositions.version1 = scrollPosition;
      } else {
        this.scrollPositions.version2 = scrollPosition;
      }
      return this.scrollPositions;
    }

    // Synchronized scrolling logic
    // Both versions should show the same verse at the same relative position
    this.scrollPositions.syncPoint = verseId;

    if (sourceVersion === 'version1') {
      this.scrollPositions.version1 = scrollPosition;
      // Calculate equivalent position for version2
      // This would involve mapping verse positions between versions
      this.scrollPositions.version2 = this.calculateSyncedPosition(
        scrollPosition,
        verseId,
        'version1',
        'version2'
      );
    } else {
      this.scrollPositions.version2 = scrollPosition;
      this.scrollPositions.version1 = this.calculateSyncedPosition(
        scrollPosition,
        verseId,
        'version2',
        'version1'
      );
    }

    return this.scrollPositions;
  }

  /**
   * Calculate synchronized scroll position between versions
   * This accounts for different text lengths in different translations
   */
  private calculateSyncedPosition(
    sourcePosition: number,
    verseId: number,
    sourceVersion: string,
    targetVersion: string
  ): number {
    // This would calculate the equivalent position in the target version
    // based on verse alignment
    // For now, returning the same position
    return sourcePosition;
  }

  /**
   * Handle swipe gestures for view transitions
   */
  handleSwipeGesture(direction: 'left' | 'right'): StudyModeView | 'exit' {
    const currentView = studyModeStore$.currentView.get();
    const isActive = studyModeStore$.isActive.get();

    if (!isActive) {
      return 'exit';
    }

    // State machine for swipe navigation
    const transitions: Record<StudyModeView, Record<'left' | 'right', StudyModeView | 'exit'>> = {
      'split': {
        'left': 'version2_full',
        'right': 'version1_full'
      },
      'version1_full': {
        'left': 'split',
        'right': 'exit' // Double swipe right exits to tabs
      },
      'version2_full': {
        'left': 'exit', // Double swipe left exits to tabs
        'right': 'split'
      }
    };

    const nextState = transitions[currentView as StudyModeView][direction];

    if (nextState === 'exit') {
      // Exit study mode and return to normal tab view
      studyModeStore$.exitStudyMode();
      return 'exit';
    }

    // Transition to new view
    studyModeStore$.toggleView(nextState);
    return nextState;
  }

  /**
   * Get display configuration for current study mode state
   */
  getDisplayConfiguration(): {
    leftPanelVersion: string | null;
    rightPanelVersion: string | null;
    leftPanelWidth: string;
    rightPanelWidth: string;
    showDivider: boolean;
  } {
    const currentView = studyModeStore$.currentView.get();
    const version1 = studyModeStore$.version1.get();
    const version2 = studyModeStore$.version2.get();

    switch (currentView) {
      case 'split':
        return {
          leftPanelVersion: version1,
          rightPanelVersion: version2,
          leftPanelWidth: '50%',
          rightPanelWidth: '50%',
          showDivider: true
        };

      case 'version1_full':
        return {
          leftPanelVersion: version1,
          rightPanelVersion: null,
          leftPanelWidth: '100%',
          rightPanelWidth: '0%',
          showDivider: false
        };

      case 'version2_full':
        return {
          leftPanelVersion: null,
          rightPanelVersion: version2,
          leftPanelWidth: '0%',
          rightPanelWidth: '100%',
          showDivider: false
        };

      default:
        return {
          leftPanelVersion: version1,
          rightPanelVersion: null,
          leftPanelWidth: '100%',
          rightPanelWidth: '0%',
          showDivider: false
        };
    }
  }

  /**
   * Get available versions for selection
   */
  getAvailableVersions(excludeVersion?: string): BibleVersion[] {
    const versions = studyModeStore$.availableVersions.get();
    if (excludeVersion) {
      return versions.filter((v: BibleVersion) => v.id !== excludeVersion && v.isDownloaded);
    }
    return versions.filter((v: BibleVersion) => v.isDownloaded);
  }

  /**
   * Show study mode onboarding
   */
  getOnboardingText(): string {
    return `Study Mode allows you to compare Bible translations side by side.

• View two translations simultaneously
• Synchronized scrolling keeps verses aligned
• Swipe to focus on individual translations
• Take notes and highlight across versions

Swipe right to focus on the left translation, or left for the right translation.`;
  }

  /**
   * Check if study mode can be activated
   */
  canActivateStudyMode(): { canActivate: boolean; reason?: string } {
    const availableVersions = this.getAvailableVersions();

    if (availableVersions.length < 1) {
      return {
        canActivate: false,
        reason: 'No Bible versions available. Please download a Bible version first.'
      };
    }

    // In future, check if at least 2 versions are available
    // For now, allowing study mode with just one version (ESV)

    return { canActivate: true };
  }

  /**
   * Clean up study mode resources
   */
  cleanup(): void {
    this.scrollPositions = {
      version1: 0,
      version2: 0,
      syncPoint: 0
    };
  }
}

// Export singleton instance
export const studyModeManager = new StudyModeManager();