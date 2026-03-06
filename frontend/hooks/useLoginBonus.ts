/**
 * useLoginBonus - Handles daily login bonus with 5-second delay
 *
 * Awards login XP after user has been in the app for 5 seconds.
 * Uses server-side XP calculation when online for security.
 *
 * SECURITY: XP values are determined by the server, not the client.
 * The client only sends the activity type, server looks up the points.
 */

import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";

import { useUnifiedAuth } from "@/hooks/useUnifiedAuth";
import { authStore$ } from "@/state/bibleStore";
import {
  recordActivity,
  hasActivityToday,
  queueRewardSync,
  initializeGamificationStore,
} from "@/state/gamificationStore";
import { recordActivityOnServer } from "@/services/gamificationService";
import { REWARD_TYPES, REWARD_POINTS } from "@/types/database";

// Time in ms user must be in app before receiving login bonus
const LOGIN_BONUS_DELAY = 5000;

/**
 * useLoginBonus Hook
 * Awards daily login bonus after 5 seconds in app
 * Uses server-side XP calculation when online
 */
export function useLoginBonus() {
  const auth = useUnifiedAuth();
  const hasAwardedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  // Initialize gamification store on mount with userId for reinstall recovery
  useEffect(() => {
    if (auth.isAuthenticated && auth.user?.id) {
      initializeGamificationStore(auth.user.id);
    }
  }, [auth.isAuthenticated, auth.user?.id]);

  useEffect(() => {
    // Only run for authenticated users
    if (!auth.isAuthenticated || !auth.user?.id) {
      return;
    }

    const userId = auth.user.id;

    // Check if already awarded this session
    if (hasAwardedRef.current) {
      return;
    }

    const awardLoginBonus = async () => {
      // Double check we haven't awarded
      if (hasAwardedRef.current) return;

      // Check if already recorded today via local tracking
      if (hasActivityToday("login")) {
        hasAwardedRef.current = true;
        return;
      }

      hasAwardedRef.current = true;

      const shouldSync = authStore$.shouldSync.peek();

      if (shouldSync) {
        // ONLINE: Use server-side XP calculation (secure)
        const result = await recordActivityOnServer(userId, "login");

        if (!result || result.alreadyRecordedToday) {
          return;
        }
        // Progress bar updates reactively via completedActivitiesCount$
      } else {
        // OFFLINE: Use local tracking, queue for sync
        const result = recordActivity("login");

        if (result.alreadyRecordedToday) {
          return;
        }

        // Queue for sync when back online
        queueRewardSync(REWARD_TYPES.LOGIN, REWARD_POINTS[REWARD_TYPES.LOGIN]);
      }
    };

    // Start timer when app is active
    const startTimer = () => {
      if (timerRef.current) return;

      timerRef.current = setTimeout(() => {
        awardLoginBonus();
      }, LOGIN_BONUS_DELAY);
    };

    // Clear timer when app goes to background
    const clearTimer = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    // Handle app state changes
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (
        appStateRef.current !== "active" &&
        nextState === "active" &&
        !hasAwardedRef.current
      ) {
        // App came to foreground
        startTimer();
      } else if (nextState !== "active") {
        // App went to background
        clearTimer();
      }
      appStateRef.current = nextState;
    };

    // Start initial timer if app is active
    if (AppState.currentState === "active") {
      startTimer();
    }

    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange
    );

    return () => {
      clearTimer();
      subscription.remove();
    };
  }, [auth.isAuthenticated, auth.user?.id]);
}
