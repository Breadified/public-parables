/**
 * Home Screen - Sprint 3 Enhanced with Smart Navigation & Study Mode
 * Main Bible reading interface with integrated navigation system and Study Mode
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { StyleSheet, View, BackHandler } from "react-native";
import { observer, useSelector } from "@legendapp/state/react";

import { BibleSwipeableViewer } from "@/components/BibleSwipeableViewer";
import { SearchModal } from "@/components/Search/Modal";
import { FloatingActionButton } from "@/components/FloatingActionButton";
import { BibleHeader } from "@/components/BibleHeader";
import { StudyModeSetupModal } from "@/components/StudyMode/StudyModeSetupModal";
import { SwipeTutorialModal } from "@/components/Tutorial";
import { bibleStore$ } from "@/state/bibleStore";
import { tabStore$ } from "@/state/tabStore";
import { studyModeStore$ } from "@/state/studyModeStore";
import { bibleVersionStore$ } from "@/state/bibleVersionStore";
import { tutorialStore$ } from "@/state/tutorialStore";
import type { BibleVersion } from "@/state/bibleVersionStore";
import { StudyModeType } from "@/config/studyModeConfig";
import { studyModeManager } from "@/modules/study/studyModeManager";
import { getBookByName, getLocalizedBookName } from "@/modules/bible/bibleBookMappings";
import { useTabsPersistence } from "@/hooks/useTabsPersistence";
import { useTheme } from "@/contexts/ThemeContext";
import { useToast } from "@/contexts/ToastContext";
import { useUnifiedAuth } from "@/hooks/useUnifiedAuth";
import { AuthModal } from "@/components/Auth/AuthModal";
import { ConfirmationModal } from "@/components/ConfirmationModal";

export default observer(function HomeScreen() {
  // Get current tab for displaying title
  const tabs = useSelector(bibleStore$.tabs);
  const activeTabIndex = useSelector(bibleStore$.active_tab_index);
  const currentTab = tabs[activeTabIndex];

  // Study Mode state
  const showOnboarding = useSelector(studyModeStore$.showOnboarding);
  const isStudyModeActive = useSelector(studyModeStore$.isActive);
  const availableVersions = useSelector(bibleVersionStore$.availableVersions);
  const primaryVersion = useSelector(bibleVersionStore$.primaryVersion);

  // Compute localized chapter title based on primary version's language
  const localizedChapterTitle = useMemo(() => {
    if (!currentTab) return "Genesis 1";

    const versionData = bibleVersionStore$.getVersionData(primaryVersion);
    const language = versionData?.language || 'en';

    // If language is not 'zh', just return the original title
    if (language !== 'zh') {
      return currentTab.title;
    }

    // For Chinese, localize the book name
    const bookName = currentTab.current_book_name;
    const chapterNumber = currentTab.current_chapter_number;

    if (!bookName || !chapterNumber) {
      return currentTab.title;
    }

    // Get book ID from English name and then get localized name
    const book = getBookByName(bookName);
    if (!book) {
      return currentTab.title;
    }

    const localizedName = getLocalizedBookName(book.id, language);
    return `${localizedName} ${chapterNumber}`;
  }, [currentTab, primaryVersion]);

  // Auth state
  const { isAuthenticated, hasSignedInOnDevice } = useUnifiedAuth();

  // Toast context for notifications
  const { showDeleteToast, showToast } = useToast();

  // Modal state
  const [showStudyModeSetup, setShowStudyModeSetup] = useState(false);
  const [showSwipeTutorial, setShowSwipeTutorial] = useState(false);
  const [showNotesAuthModal, setShowNotesAuthModal] = useState(false);
  const [showStudyModeInfoModal, setShowStudyModeInfoModal] = useState(false);
  const [studyModeInfoMessage, setStudyModeInfoMessage] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [notesAuthMessage, setNotesAuthMessage] = useState<string | undefined>(
    undefined
  );

  // Load persisted tabs on mount
  useTabsPersistence();

  // Load Study Mode and Tutorial state on mount
  useEffect(() => {
    studyModeStore$.loadState();
    tutorialStore$.loadState();
  }, []);

  // Track last back press time for exit confirmation
  const lastBackPressRef = useRef<number>(0);
  const EXIT_DELAY = 2000; // 2 seconds to press back again

  // Handle hardware back button for navigation stack
  const handleBackPress = useCallback(() => {
    // Priority 1: If in study mode, exit it
    if (isStudyModeActive) {
      studyModeStore$.exitStudyMode();
      return true;
    }

    // Priority 2: If there's tab history, go back to previous tab
    if (tabStore$.canGoBackTab()) {
      tabStore$.goBackTab();
      return true;
    }

    // Priority 3: Exit confirmation - check if pressed within delay
    const now = Date.now();
    if (now - lastBackPressRef.current < EXIT_DELAY) {
      // User pressed back twice quickly - let system exit
      return false;
    }

    // First back press - show toast and wait for second press
    lastBackPressRef.current = now;
    showToast({
      message: "Press back again to exit",
      duration: EXIT_DELAY,
      position: "bottom",
      type: "info",
    });
    return true;
  }, [isStudyModeActive, showToast]);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      handleBackPress
    );

    return () => backHandler.remove();
  }, [handleBackPress]);

  // Enhanced UI state management
  const { themeMode, theme } = useTheme();
  const [fontSize] = useState(16);
  const [showVerseNumbers] = useState(true);

  // Navigation UI state
  const [showSearchModal, setShowSearchModal] = useState(false);

  // Track tabs state when search modal opens to detect navigation
  const searchModalOpenStateRef = useRef<{
    tabsCount: number;
    activeIndex: number;
  } | null>(null);
  const searchJustClosedRef = useRef(false);

  // Handle Study Mode entry - go straight to setup modal
  const handleEnterStudyMode = () => {
    const check = studyModeManager.canActivateStudyMode();
    if (!check.canActivate) {
      setStudyModeInfoMessage(check.reason || "Cannot activate Study Mode");
      setShowStudyModeInfoModal(true);
      return;
    }

    // Dismiss onboarding if first time
    if (showOnboarding) {
      studyModeStore$.dismissOnboarding();
    }

    // Show setup modal
    setShowStudyModeSetup(true);
  };

  // Handle Compare mode selection (version comparison)
  const handleSelectCompare = (version: BibleVersion) => {
    // Set study mode type to COMPARE
    studyModeStore$.setStudyModeType(StudyModeType.COMPARE);

    // Enter study mode with selected comparison version
    studyModeStore$.enterStudyMode(version.id);

    // Mark study mode as used in tutorial store
    tutorialStore$.markStudyModeUsed();
  };

  // Activate notes mode (after auth check passes)
  const activateNotesMode = () => {
    // Set study mode type to NOTES
    studyModeStore$.setStudyModeType(StudyModeType.NOTES);

    // Enter study mode without comparison version
    studyModeStore$.enterStudyMode();

    // Mark study mode as used in tutorial store
    tutorialStore$.markStudyModeUsed();
  };

  // Handle Notes mode selection - check auth first
  const handleSelectNotes = (message?: string) => {
    // If already authenticated, activate notes mode immediately
    if (isAuthenticated) {
      activateNotesMode();
      return;
    }

    // Not authenticated - show auth modal with custom message
    setNotesAuthMessage(message);
    // Prioritize signup for new devices, login for returning devices
    setAuthMode(hasSignedInOnDevice ? "login" : "signup");
    setShowNotesAuthModal(true);
  };

  // Handle auth success for notes mode
  const handleNotesAuthSuccess = () => {
    setShowNotesAuthModal(false);
    activateNotesMode();
  };

  // Handle skip auth for notes mode (offline mode)
  const handleNotesAuthSkip = () => {
    setShowNotesAuthModal(false);
    activateNotesMode();
  };

  const handleStudyModeSetupClose = () => {
    setShowStudyModeSetup(false);
  };

  // Handle Study Mode exit
  const handleExitStudyMode = () => {
    studyModeStore$.exitStudyMode();
  };

  // Handle search modal opening - capture current state
  const handleSearchPress = () => {
    searchModalOpenStateRef.current = {
      tabsCount: tabs.length,
      activeIndex: activeTabIndex,
    };
    setShowSearchModal(true);
  };

  // Handle search modal closing - mark that we just closed
  const handleSearchClose = () => {
    setShowSearchModal(false);
    // Mark that search just closed so we can check for navigation in effect
    searchJustClosedRef.current = true;
  };

  // Watch for tab changes after search closes to detect navigation
  useEffect(() => {
    // Only check if search just closed
    if (!searchJustClosedRef.current) return;

    const openState = searchModalOpenStateRef.current;
    if (!openState) {
      searchJustClosedRef.current = false;
      return;
    }

    // Check if navigation happened (tabs changed or active index changed)
    const navigationHappened =
      tabs.length !== openState.tabsCount ||
      activeTabIndex !== openState.activeIndex;

    console.log("[SwipeTutorial] Navigation check:", {
      navigationHappened,
      openState,
      currentTabs: tabs.length,
      currentIndex: activeTabIndex,
    });

    // Reset refs
    searchModalOpenStateRef.current = null;
    searchJustClosedRef.current = false;

    // If navigation happened and tutorial not completed, show swipe tutorial
    // Only show if there are multiple tabs (swipe gesture requires multiple tabs)
    if (navigationHappened && tabs.length > 1) {
      const shouldShow = tutorialStore$.shouldShowSwipeTutorial();
      console.log("[SwipeTutorial] Should show?", shouldShow);
      if (shouldShow) {
        // Small delay to let the search modal finish closing
        setTimeout(() => {
          setShowSwipeTutorial(true);
        }, 300);
      }
    }
  }, [tabs.length, activeTabIndex]);

  // Handle swipe tutorial dismissal
  const handleSwipeTutorialDismiss = () => {
    setShowSwipeTutorial(false);
    tutorialStore$.completeSwipeTutorial();
  };

  // Handle note deletion - delegates to toast context
  const handleDeleteNote = (noteId: string) => {
    showDeleteToast(noteId);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background.primary }]}>
      {/* Enhanced Header with Bible Tabs */}
      <BibleHeader
        theme={themeMode}
        currentTitle={localizedChapterTitle}
        onAddPress={handleSearchPress}
      />

      {/* Bible Viewer - Study mode state handled internally */}
      <View style={styles.viewerContainer}>
        <BibleSwipeableViewer
          fontSize={fontSize}
          showVerseNumbers={showVerseNumbers}
          onDeleteNote={handleDeleteNote}
        />
      </View>

      {/* Floating Action Button - Adaptive based on Study Mode */}
      <FloatingActionButton
        title={localizedChapterTitle}
        onSearchPress={handleSearchPress}
        onEnterStudyMode={handleEnterStudyMode}
        onExitStudyMode={handleExitStudyMode}
      />

      {/* Search Modal */}
      <SearchModal visible={showSearchModal} onClose={handleSearchClose} />

      {/* Swipe Tutorial - shown after first search navigation */}
      <SwipeTutorialModal
        visible={showSwipeTutorial}
        onDismiss={handleSwipeTutorialDismiss}
      />

      {/* Study Mode Setup Modal - Choose between Compare or Notes mode */}
      <StudyModeSetupModal
        visible={showStudyModeSetup}
        onClose={handleStudyModeSetupClose}
        onSelectCompare={handleSelectCompare}
        onSelectNotes={handleSelectNotes}
        availableVersions={availableVersions}
        currentVersion={primaryVersion}
      />

      {/* Notes Auth Modal - shown when selecting notes mode without auth */}
      <AuthModal
        visible={showNotesAuthModal}
        mode={authMode}
        onClose={() => setShowNotesAuthModal(false)}
        onSuccess={handleNotesAuthSuccess}
        onSkip={handleNotesAuthSkip}
        promptMessage={notesAuthMessage}
      />

      {/* Study Mode Info Modal */}
      <ConfirmationModal
        visible={showStudyModeInfoModal}
        variant="info"
        title="Study Mode"
        message={studyModeInfoMessage}
        onConfirm={() => setShowStudyModeInfoModal(false)}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  viewerContainer: {
    flex: 1, // Use flex instead of absolute positioning
  },
});
