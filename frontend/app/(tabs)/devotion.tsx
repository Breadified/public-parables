/**
 * Devotion Tab Screen - Daily Apologetics Challenge
 * Displays daily questions with Bible passages and community comments
 */

import React, { useEffect, useState, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { observer, useSelector } from "@legendapp/state/react";
import { useLocalSearchParams } from "expo-router";

import { useTheme } from "@/contexts/ThemeContext";
import { useUnifiedAuth } from "@/hooks/useUnifiedAuth";
import { devotionStore$ } from "@/state";
import type { ApologeticsData } from "@/state";
import DevotionContent from "@/components/Devotion/DevotionContent";
import { AuthModal } from "@/components/Auth/AuthModal";
import {
  initializeCommentsForQuestion,
  cleanupCommentsSubscription,
} from "@/services/apologeticsService";
import { getDateForQuestionId } from "@/modules/devotion/questionUtils";

// Import bundled apologetics questions
import apologeticsData from "@/assets/data/apologeticsQuestions.json";

// URL params interface for deep-linking
interface DevotionParams {
  date?: string;                    // YYYY-MM-DD format (from push notification)
  targetCommentId?: string;         // Specific comment to scroll to (from Library)
  targetQuestionId?: string;        // Question the comment belongs to (from Library)
}

export default observer(function DevotionScreen() {
  const { theme } = useTheme();
  const { isAuthenticated, hasSignedInOnDevice, user } = useUnifiedAuth();

  // Get navigation params (from push notification or Library deep-link)
  const { date, targetCommentId, targetQuestionId } = useLocalSearchParams<{
    date?: string;
    targetCommentId?: string;
    targetQuestionId?: string;
  }>();

  // Watch for question changes to reload comments
  const todaysQuestion = useSelector(devotionStore$.todaysQuestion);
  const lastQuestionIdRef = useRef<string | null>(null);

  // Auth modal state
  const [showAuthModal, setShowAuthModal] = useState(!isAuthenticated);
  const authMode: "login" | "signup" = hasSignedInOnDevice ? "login" : "signup";

  // Update auth modal visibility when auth state changes
  useEffect(() => {
    if (isAuthenticated) {
      setShowAuthModal(false);
    }
  }, [isAuthenticated]);

  // Load completed devotion dates when user is authenticated
  // This enables showing checkmarks for past completed devotions
  useEffect(() => {
    if (user?.id) {
      devotionStore$.loadCompletedDevotionDates(user.id);
    }
  }, [user?.id]);

  // Initialize store with bundled data on mount
  useEffect(() => {
    // Initialize with bundled questions data (smart caching - only resets at midnight)
    devotionStore$.initializeWithData(apologeticsData as ApologeticsData);

    // Handle deep-link navigation from Library to specific comment
    if (targetQuestionId && targetCommentId) {
      console.log("[DevotionScreen] Deep-link to comment:", targetCommentId, "in question:", targetQuestionId);

      // Calculate the date for this question
      const calculatedDate = getDateForQuestionId(targetQuestionId);
      if (calculatedDate) {
        devotionStore$.setSelectedDate(calculatedDate);
      }

      // Set target comment for scrolling (handled in DevotionContent)
      devotionStore$.setTargetComment(targetCommentId);

      // Switch to comments mode to show the comment
      devotionStore$.setUIMode('comments');
    } else if (date) {
      // If navigated with date param (from push notification), use that specific date
      console.log("[DevotionScreen] Navigated from notification with date:", date);
      devotionStore$.setSelectedDate(date);
    }

    // Note: devotionStore$.initialize() is now called at app startup in _layout.tsx
    // for instant offline support

    // Cleanup on unmount
    return () => {
      cleanupCommentsSubscription();
      // Clear any pending target comment
      devotionStore$.setTargetComment(null);
    };
  }, [date, targetCommentId, targetQuestionId]); // Re-run if params change

  // Initialize comments when question changes
  useEffect(() => {
    if (todaysQuestion && todaysQuestion.id !== lastQuestionIdRef.current) {
      lastQuestionIdRef.current = todaysQuestion.id;
      console.log("[DevotionScreen] Question changed, loading comments for:", todaysQuestion.id);
      initializeCommentsForQuestion(todaysQuestion.id, user?.id);
    }
  }, [todaysQuestion, user?.id]);

  const handleAuthSuccess = () => {
    setShowAuthModal(false);
  };

  const handleAuthSkip = () => {
    setShowAuthModal(false);
  };

  const handleAuthClose = () => {
    setShowAuthModal(false);
  };

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background.primary }]}
    >
      <DevotionContent />

      {/* Auth Modal - shown when user is not authenticated */}
      <AuthModal
        visible={showAuthModal}
        mode={authMode}
        onClose={handleAuthClose}
        onSuccess={handleAuthSuccess}
        onSkip={handleAuthSkip}
        promptMessage="Sign in to join the discussion and save your comments across devices"
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
