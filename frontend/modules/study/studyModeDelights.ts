/**
 * Study Mode Delights - Micro-interactions and delightful moments
 * Adds personality and joy to the Study Mode experience
 */

import * as Haptics from 'expo-haptics';

export interface DelightfulMessage {
  title: string;
  subtitle?: string;
  emoji?: string;
  duration?: number;
}

/**
 * Collection of delightful messages for various Study Mode states
 */
export class StudyModeDelights {
  /**
   * Welcome messages that rotate for variety
   */
  static getWelcomeMessage(isReturning: boolean): DelightfulMessage {
    if (isReturning) {
      const messages: DelightfulMessage[] = [
        { title: "Back for more wisdom?", emoji: "💡" },
        { title: "Ready to dig deeper?", emoji: "⛏️" },
        { title: "Your insights await", emoji: "✨" },
        { title: "Welcome back, scholar", emoji: "🎓" },
        { title: "Time to explore truth", emoji: "🦭" },
        { title: "Let's uncover treasures", emoji: "💎" },
      ];
      return messages[Math.floor(Math.random() * messages.length)];
    }

    return {
      title: "Welcome to Study Mode",
      subtitle: "Where understanding begins",
      emoji: "🎉",
    };
  }

  /**
   * Achievement messages for milestones
   */
  static getAchievementMessage(type: 'first_comparison' | 'first_note' | 'study_streak' | 'verse_mastery'): DelightfulMessage {
    const achievements: Record<string, DelightfulMessage> = {
      first_comparison: {
        title: "Translation Explorer",
        subtitle: "You've compared your first verses",
        emoji: "🏆",
      },
      first_note: {
        title: "Deep Thinker",
        subtitle: "Your first study note is saved",
        emoji: "📝",
      },
      study_streak: {
        title: "Dedicated Scholar",
        subtitle: "3 days of consistent study",
        emoji: "🔥",
      },
      verse_mastery: {
        title: "Verse Master",
        subtitle: "You've studied this passage thoroughly",
        emoji: "⭐",
      },
    };
    return achievements[type];
  }

  /**
   * Encouraging messages during loading states
   */
  static getLoadingMessage(): string {
    const messages = [
      "Gathering wisdom...",
      "Opening the scrolls...",
      "Preparing insights...",
      "Loading treasures...",
      "Fetching revelations...",
      "Assembling verses...",
    ];
    return messages[Math.floor(Math.random() * messages.length)];
  }

  /**
   * Transition messages for view changes
   */
  static getTransitionMessage(from: string, to: string): DelightfulMessage | null {
    if (from === 'split' && to === 'version1_full') {
      return { title: "Focused view", emoji: "🎯", duration: 1000 };
    }
    if (from === 'split' && to === 'version2_full') {
      return { title: "Comparing closely", emoji: "🔍", duration: 1000 };
    }
    if (to === 'split') {
      return { title: "Side by side", emoji: "📚", duration: 1000 };
    }
    return null;
  }

  /**
   * Empty state messages that encourage action
   */
  static getEmptyStateMessage(context: 'no_notes' | 'no_highlights' | 'no_bookmarks'): DelightfulMessage {
    const messages: Record<string, DelightfulMessage> = {
      no_notes: {
        title: "Your thoughts matter",
        subtitle: "Tap any verse to add your first note",
        emoji: "💭",
      },
      no_highlights: {
        title: "Illuminate the text",
        subtitle: "Press and hold to highlight verses",
        emoji: "🌆",
      },
      no_bookmarks: {
        title: "Save for later",
        subtitle: "Bookmark verses that speak to you",
        emoji: "🔖",
      },
    };
    return messages[context];
  }

  /**
   * Success messages for user actions
   */
  static getSuccessMessage(action: 'note_saved' | 'highlight_added' | 'bookmark_created' | 'verse_copied'): DelightfulMessage {
    const messages: Record<string, DelightfulMessage> = {
      note_saved: {
        title: "Note saved",
        emoji: "✅",
        duration: 1500,
      },
      highlight_added: {
        title: "Highlighted",
        emoji: "✨",
        duration: 1500,
      },
      bookmark_created: {
        title: "Bookmarked",
        emoji: "🔖",
        duration: 1500,
      },
      verse_copied: {
        title: "Copied to clipboard",
        emoji: "📋",
        duration: 1500,
      },
    };
    return messages[action];
  }

  /**
   * Error messages that maintain positivity
   */
  static getErrorMessage(error: 'network' | 'version_unavailable' | 'sync_failed'): DelightfulMessage {
    const messages: Record<string, DelightfulMessage> = {
      network: {
        title: "Offline mode active",
        subtitle: "Your work is saved locally",
        emoji: "📡",
      },
      version_unavailable: {
        title: "Version not ready",
        subtitle: "Try another translation for now",
        emoji: "📖",
      },
      sync_failed: {
        title: "Sync paused",
        subtitle: "We'll try again when you're online",
        emoji: "⏸️",
      },
    };
    return messages[error];
  }

  /**
   * Tips that appear randomly to teach features
   */
  static getRandomTip(): DelightfulMessage {
    const tips: DelightfulMessage[] = [
      {
        title: "Pro tip",
        subtitle: "Double-tap any verse for quick actions",
        emoji: "💡",
      },
      {
        title: "Did you know?",
        subtitle: "Swipe with two fingers to switch chapters",
        emoji: "🤔",
      },
      {
        title: "Quick trick",
        subtitle: "Pinch to adjust the split view size",
        emoji: "✌️",
      },
      {
        title: "Power move",
        subtitle: "Triple-tap for verse cross-references",
        emoji: "⚡",
      },
      {
        title: "Hidden feature",
        subtitle: "Shake to reset your view preferences",
        emoji: "🎲",
      },
    ];
    return tips[Math.floor(Math.random() * tips.length)];
  }

  /**
   * Celebration messages for special moments
   */
  static getCelebrationMessage(type: 'chapter_complete' | 'book_complete' | 'daily_goal'): DelightfulMessage {
    const celebrations: Record<string, DelightfulMessage> = {
      chapter_complete: {
        title: "Chapter complete!",
        subtitle: "You're making great progress",
        emoji: "🎆",
      },
      book_complete: {
        title: "Book finished!",
        subtitle: "What an accomplishment",
        emoji: "🎇",
      },
      daily_goal: {
        title: "Daily goal achieved!",
        subtitle: "Your consistency is inspiring",
        emoji: "🎉",
      },
    };
    return celebrations[type];
  }

  /**
   * Trigger haptic feedback for various interactions
   */
  static async triggerHaptic(type: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error'): Promise<void> {
    try {
      switch (type) {
        case 'light':
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          break;
        case 'medium':
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          break;
        case 'heavy':
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          break;
        case 'success':
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          break;
        case 'warning':
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          break;
        case 'error':
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          break;
      }
    } catch (error) {
      // Haptics might not be available on all devices
      console.log('Haptics not available');
    }
  }

  /**
   * Get a contextual greeting based on time of day
   */
  static getTimeBasedGreeting(): string {
    const hour = new Date().getHours();
    
    if (hour < 6) return "Burning the midnight oil";
    if (hour < 12) return "Morning revelations";
    if (hour < 17) return "Afternoon insights";
    if (hour < 21) return "Evening reflections";
    return "Late night wisdom";
  }

  /**
   * Get encouraging messages for long study sessions
   */
  static getSessionEncouragement(minutesStudied: number): DelightfulMessage | null {
    if (minutesStudied === 15) {
      return { title: "15 minutes of focus", emoji: "🧘", duration: 2000 };
    }
    if (minutesStudied === 30) {
      return { title: "Half hour of dedication", emoji: "🏅", duration: 2000 };
    }
    if (minutesStudied === 60) {
      return { title: "One hour of deep study!", emoji: "🎆", duration: 3000 };
    }
    return null;
  }

  /**
   * Easter egg messages for special interactions
   */
  static getEasterEgg(trigger: string): DelightfulMessage | null {
    const eggs: Record<string, DelightfulMessage> = {
      'konami': { title: "You found it!", subtitle: "The secret scholar path", emoji: "🥳" },
      'shake_3x': { title: "Whoa there!", subtitle: "Easy on the shaking", emoji: "🌀" },
      'speed_reader': { title: "Speed reader detected", subtitle: "Impressive scroll velocity", emoji: "🏃" },
      'night_owl': { title: "Night owl mode", subtitle: "Studying past midnight", emoji: "🦉" },
    };
    return eggs[trigger] || null;
  }
}