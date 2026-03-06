/**
 * Gamification Store - Local-first XP state with realtime sync
 *
 * Core Principle: Local-first with durable persistence, realtime sync to server
 *
 * Data Flow:
 * 1. Activity happens -> Immediate write to AsyncStorage (survives kill/crash)
 * 2. UI updates instantly (XP/level computed locally)
 * 3. Realtime sync to server (with small debounce for rapid actions)
 * 4. Server confirms & updates level for others to see
 *
 * XP Calculation:
 * - XP = SUM of all local rewards (never stored separately)
 * - Level = computed from XP using getLevelFromXP (never fetched)
 */

import { observable, computed } from "@legendapp/state";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState, type AppStateStatus } from "react-native";
import { supabase } from "@/lib/supabase";
import { authStore$ } from "./bibleStore";
import {
  REWARD_TYPES,
  REWARD_POINTS,
  DAILY_NOTE_MULTIPLIERS,
  type RewardType,
} from "@/types/database";
import { getLevelFromXP } from "@/utils/levelSystem";

// Storage keys
const STORAGE_KEYS = {
  LOCAL_REWARDS: "@parables/local_rewards",
  PENDING_SYNC: "@parables/pending_sync",
  STREAKS: "@parables/streaks",
  TODAY_ACTIVITY: "@parables/today_activity",
  LAST_SYNC: "@parables/last_sync_at",
};

// Sync configuration
const SYNC_DELAY_MS = 500; // Small delay to debounce rapid actions, then sync immediately

// Placeholder session ID for non-plan rewards
const GLOBAL_SESSION_ID = "00000000-0000-0000-0000-000000000000";

/**
 * Get today's date string in YYYY-MM-DD format (LOCAL time)
 */
function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Get yesterday's date string in YYYY-MM-DD format (LOCAL time)
 */
function getYesterdayDateString(): string {
  const now = new Date();
  now.setDate(now.getDate() - 1);
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Types

/** Activity types that support streaks */
export type StreakActivityType = 'login' | 'reading' | 'notes' | 'plan' | 'devotion';

/** Streak state per activity type */
export interface ActivityStreak {
  currentStreak: number;
  lastActivityDate: string | null;  // YYYY-MM-DD
  streak7Completed: boolean;
  streak30Completed: boolean;
  streak365Completed: boolean;
}

/** Default streak state for new activity types */
const DEFAULT_STREAK: ActivityStreak = {
  currentStreak: 0,
  lastActivityDate: null,
  streak7Completed: false,
  streak30Completed: false,
  streak365Completed: false,
};

/** Local reward record (persisted to AsyncStorage) */
export interface LocalReward {
  type: RewardType;
  points: number;
  timestamp: string;  // ISO string
  ref?: string;       // Optional reference ID
}

/** Pending activity for batch sync */
export interface PendingActivity {
  type: RewardType;
  timestamp: string;
  ref?: string;
}

export interface TodayActivity {
  date: string; // YYYY-MM-DD
  loginBonusAwarded: boolean;
  chaptersRead: string[]; // "bookId_chapter" keys
  notesAdded: string[]; // noteId keys
  planDaysCompleted: string[]; // "sessionId_dayNumber" keys for diminishing returns
  hasOnTimePlanCompletion: boolean; // Whether any on-time plan day was completed today
  plansCompleted: string[]; // sessionId keys for plan completion diminishing returns
  devotionCompleted: boolean; // Whether today's devotion was completed
}


export interface GamificationState {
  // Local rewards cache (source of truth for XP)
  localRewards: LocalReward[];
  localRewardsLoaded: boolean;

  // Pending sync queue
  pendingActivities: PendingActivity[];

  // Today's activity tracking (local)
  todayActivity: TodayActivity;

  // Streak tracking per activity type (local copy, server is authoritative)
  streaks: Record<StreakActivityType, ActivityStreak>;

  // Sync state
  isSyncing: boolean;
  lastSyncAt: string | null;

  // Loading state
  isLoading: boolean;
}

// Create the store
export const gamificationStore$ = observable<GamificationState>({
  localRewards: [],
  localRewardsLoaded: false,
  pendingActivities: [],
  todayActivity: {
    date: getTodayDateString(),
    loginBonusAwarded: false,
    chaptersRead: [],
    notesAdded: [],
    planDaysCompleted: [],
    hasOnTimePlanCompletion: false,
    plansCompleted: [],
    devotionCompleted: false,
  },
  streaks: {
    login: { ...DEFAULT_STREAK },
    reading: { ...DEFAULT_STREAK },
    notes: { ...DEFAULT_STREAK },
    plan: { ...DEFAULT_STREAK },
    devotion: { ...DEFAULT_STREAK },
  },
  isSyncing: false,
  lastSyncAt: null,
  isLoading: false,
});

// =============================================================================
// Computed Values (Local-First)
// =============================================================================

/**
 * Total XP computed from local rewards
 * This is the source of truth for the user's XP
 */
export const totalXP$ = computed(() => {
  const rewards = gamificationStore$.localRewards.get();
  return rewards.reduce((sum, r) => sum + r.points, 0);
});

/**
 * Current level computed from total XP
 * Never stored or fetched - always computed locally
 */
export const currentLevel$ = computed(() => {
  return getLevelFromXP(totalXP$.get());
});

export const hasPendingRewards$ = computed(() => {
  return gamificationStore$.pendingActivities.get().length > 0;
});

/**
 * Reactive daily activity status
 */
export const dailyActivityStatus$ = computed(() => {
  const activity = gamificationStore$.todayActivity.get();
  const streaks = gamificationStore$.streaks.get();
  const today = getTodayDateString();

  const activityIsToday = activity.date === today;

  const streakDoneToday = (type: StreakActivityType) =>
    streaks[type].lastActivityDate === today;

  return {
    loginCompleted: (activityIsToday && activity.loginBonusAwarded) || streakDoneToday('login'),
    noteAddedCompleted: (activityIsToday && activity.notesAdded.length > 0) || streakDoneToday('notes'),
    planDayCompleted: (activityIsToday && activity.hasOnTimePlanCompletion) || streakDoneToday('plan'),
    devotionCompleted: (activityIsToday && activity.devotionCompleted) || streakDoneToday('devotion'),
  };
});

/**
 * Count of completed daily activities
 */
/**
 * Total daily activities tracked (login, plan, note, devotion)
 */
export const TOTAL_DAILY_ACTIVITIES = 4;

export const completedActivitiesCount$ = computed(() => {
  const status = dailyActivityStatus$.get();
  let count = 0;
  if (status.loginCompleted) count++;
  if (status.noteAddedCompleted) count++;
  if (status.planDayCompleted) count++;
  if (status.devotionCompleted) count++;
  return count;
});

/**
 * Reactive streaks state
 */
export const allStreaks$ = computed(() => {
  return gamificationStore$.streaks.get();
});

export const getStreak$ = (type: StreakActivityType) => computed(() => {
  return gamificationStore$.streaks[type].get();
});

// =============================================================================
// Storage Functions
// =============================================================================

async function saveRewardsToStorage(): Promise<void> {
  try {
    const rewards = gamificationStore$.localRewards.peek();
    await AsyncStorage.setItem(STORAGE_KEYS.LOCAL_REWARDS, JSON.stringify(rewards));
  } catch (error) {
    console.error("[GamificationStore] Error saving rewards:", error);
  }
}

async function savePendingToStorage(): Promise<void> {
  try {
    const pending = gamificationStore$.pendingActivities.peek();
    await AsyncStorage.setItem(STORAGE_KEYS.PENDING_SYNC, JSON.stringify(pending));
  } catch (error) {
    console.error("[GamificationStore] Error saving pending:", error);
  }
}

export async function saveStreaksToCache(): Promise<void> {
  try {
    const streaks = gamificationStore$.streaks.peek();
    await AsyncStorage.setItem(STORAGE_KEYS.STREAKS, JSON.stringify(streaks));
  } catch (error) {
    console.error("[GamificationStore] Error saving streaks:", error);
  }
}

export async function saveTodayActivityToCache(): Promise<void> {
  try {
    const activity = gamificationStore$.todayActivity.peek();
    await AsyncStorage.setItem(STORAGE_KEYS.TODAY_ACTIVITY, JSON.stringify(activity));
  } catch (error) {
    console.error("[GamificationStore] Error saving today activity:", error);
  }
}

async function loadRewardsFromStorage(): Promise<LocalReward[]> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEYS.LOCAL_REWARDS);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error("[GamificationStore] Error loading rewards:", error);
    return [];
  }
}

async function loadPendingFromStorage(): Promise<PendingActivity[]> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEYS.PENDING_SYNC);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error("[GamificationStore] Error loading pending:", error);
    return [];
  }
}

async function loadStreaksFromStorage(): Promise<Record<StreakActivityType, ActivityStreak>> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEYS.STREAKS);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        login: { ...DEFAULT_STREAK, ...parsed.login },
        reading: { ...DEFAULT_STREAK, ...parsed.reading },
        notes: { ...DEFAULT_STREAK, ...parsed.notes },
        plan: { ...DEFAULT_STREAK, ...parsed.plan },
        devotion: { ...DEFAULT_STREAK, ...parsed.devotion },
      };
    }
    return {
      login: { ...DEFAULT_STREAK },
      reading: { ...DEFAULT_STREAK },
      notes: { ...DEFAULT_STREAK },
      plan: { ...DEFAULT_STREAK },
      devotion: { ...DEFAULT_STREAK },
    };
  } catch (error) {
    console.error("[GamificationStore] Error loading streaks:", error);
    return {
      login: { ...DEFAULT_STREAK },
      reading: { ...DEFAULT_STREAK },
      notes: { ...DEFAULT_STREAK },
      plan: { ...DEFAULT_STREAK },
      devotion: { ...DEFAULT_STREAK },
    };
  }
}

// =============================================================================
// Today Activity Management
// =============================================================================

function resetTodayActivity(): void {
  gamificationStore$.todayActivity.set({
    date: getTodayDateString(),
    loginBonusAwarded: false,
    chaptersRead: [],
    notesAdded: [],
    planDaysCompleted: [],
    hasOnTimePlanCompletion: false,
    plansCompleted: [],
    devotionCompleted: false,
  });
  saveTodayActivityToCache();
}

export function resetTodayIfNewDay(): void {
  const activity = gamificationStore$.todayActivity.peek();
  if (activity.date !== getTodayDateString()) {
    resetTodayActivity();
  }
}

function updateTodayActivity(type: RewardType, referenceId?: string): void {
  resetTodayIfNewDay();
  const activity = gamificationStore$.todayActivity.peek();

  switch (type) {
    case REWARD_TYPES.LOGIN:
      gamificationStore$.todayActivity.loginBonusAwarded.set(true);
      break;
    case REWARD_TYPES.CHAPTER_READ:
      if (referenceId && !activity.chaptersRead.includes(referenceId)) {
        gamificationStore$.todayActivity.chaptersRead.set([
          ...activity.chaptersRead,
          referenceId,
        ]);
      }
      break;
    case REWARD_TYPES.DAILY_NOTE:
      if (referenceId && !activity.notesAdded.includes(referenceId)) {
        gamificationStore$.todayActivity.notesAdded.set([
          ...activity.notesAdded,
          referenceId,
        ]);
      }
      break;
    case REWARD_TYPES.DAILY_DEVOTION:
      gamificationStore$.todayActivity.devotionCompleted.set(true);
      break;
  }

  saveTodayActivityToCache();
}

// =============================================================================
// Realtime Sync Logic (with small debounce)
// =============================================================================

let syncTimer: ReturnType<typeof setTimeout> | null = null;
let appStateSubscription: ReturnType<typeof AppState.addEventListener> | null = null;

/**
 * Schedule immediate sync (with small debounce for rapid actions)
 * Unlike batch sync, this syncs quickly after each activity
 */
function scheduleImmediateSync(): void {
  // Clear existing timer to debounce rapid actions
  if (syncTimer) {
    clearTimeout(syncTimer);
  }

  const pending = gamificationStore$.pendingActivities.peek();
  if (pending.length === 0) return;

  // Sync after small delay (debounce rapid actions like multiple notes)
  syncTimer = setTimeout(async () => {
    syncTimer = null;
    await performBatchSync();
  }, SYNC_DELAY_MS);
}

/**
 * Perform batch sync to server
 * Sends all pending activities in one RPC call
 */
export async function performBatchSync(): Promise<void> {
  const pending = gamificationStore$.pendingActivities.peek();
  if (pending.length === 0) return;

  const shouldSync = authStore$.shouldSync.peek();
  const userId = authStore$.user.peek()?.id;

  if (!shouldSync || !userId) {
    console.log("[GamificationStore] Skipping sync - offline or not authenticated");
    return;
  }

  gamificationStore$.isSyncing.set(true);

  try {
    const { data, error } = await supabase.rpc('batch_record_activities', {
      p_user_id: userId,
      p_activities: pending,
      p_client_date: getTodayDateString(),
    });

    if (error) {
      console.error("[GamificationStore] Batch sync error:", error);
      // Keep pending, will retry next interval
      return;
    }

    // Clear confirmed activities from pending
    const confirmed = new Set(data?.confirmed || []);
    const remaining = pending.filter(p => !confirmed.has(p.type));
    gamificationStore$.pendingActivities.set(remaining);
    await savePendingToStorage();

    // Update streaks from server response (server is authoritative)
    if (data?.streaks) {
      const serverStreaks = data.streaks as Record<string, { current: number; last_date: string | null }>;
      const currentStreaks = gamificationStore$.streaks.peek();

      // Update each streak from server
      for (const [activityType, streakData] of Object.entries(serverStreaks)) {
        if (activityType in currentStreaks) {
          gamificationStore$.streaks[activityType as StreakActivityType].currentStreak.set(streakData.current);
          gamificationStore$.streaks[activityType as StreakActivityType].lastActivityDate.set(streakData.last_date);
        }
      }
      await saveStreaksToCache();
    }

    // Process any milestone rewards
    if (data?.milestones && Array.isArray(data.milestones)) {
      for (const milestone of data.milestones) {
        const milestoneReward: LocalReward = {
          type: milestone.type as RewardType,
          points: milestone.xp || 0,
          timestamp: new Date().toISOString(),
        };
        gamificationStore$.localRewards.push(milestoneReward);
      }
      await saveRewardsToStorage();
    }

    gamificationStore$.lastSyncAt.set(new Date().toISOString());
    await AsyncStorage.setItem(STORAGE_KEYS.LAST_SYNC, new Date().toISOString());

    console.log(`[GamificationStore] Batch sync complete: ${confirmed.size} confirmed, ${remaining.length} pending`);
  } catch (error) {
    console.error("[GamificationStore] Batch sync failed:", error);
    // Keep pending, will retry
  } finally {
    gamificationStore$.isSyncing.set(false);
  }
}

// =============================================================================
// Activity Recording (Local-First)
// =============================================================================

/**
 * Award XP locally and queue for sync
 * This is the main entry point for recording activities
 */
export function awardXPLocally(
  type: RewardType,
  points: number,
  referenceId?: string
): { previousXP: number; newXP: number } {
  const previousXP = totalXP$.peek();

  // 1. Immediate local write
  const reward: LocalReward = {
    type,
    points,
    timestamp: new Date().toISOString(),
    ref: referenceId,
  };
  gamificationStore$.localRewards.push(reward);

  // Save to storage immediately (survives kill/crash)
  saveRewardsToStorage();

  // 2. Update today's activity tracking
  updateTodayActivity(type, referenceId);

  const newXP = totalXP$.peek();
  return { previousXP, newXP };
}

/**
 * Queue a reward for sync and trigger immediate sync
 */
export function queueRewardSync(
  type: RewardType,
  _points: number, // Not used - server determines points
  referenceId?: string
): void {
  const pending: PendingActivity = {
    type,
    timestamp: new Date().toISOString(),
    ref: referenceId,
  };

  gamificationStore$.pendingActivities.push(pending);
  savePendingToStorage();

  // Sync immediately (with small debounce for rapid actions)
  scheduleImmediateSync();
}

/**
 * Record an activity with streak tracking
 * This is the unified entry point for all activity types
 */
export function recordActivity(
  type: StreakActivityType,
  referenceId?: string
): {
  dailyXP: number;
  alreadyRecordedToday: boolean;
  streakMilestone?: { type: '7-day' | '30-day' | '365-day'; xp: number; rewardType: RewardType };
  newStreak: number;
} {
  const today = getTodayDateString();
  const yesterday = getYesterdayDateString();
  const streak = gamificationStore$.streaks[type].peek();

  // Check if already recorded today
  if (streak.lastActivityDate === today) {
    return {
      dailyXP: 0,
      alreadyRecordedToday: true,
      newStreak: streak.currentStreak,
    };
  }

  // Calculate new streak
  let newStreak = 1;
  if (streak.lastActivityDate === yesterday) {
    newStreak = streak.currentStreak + 1;
  }

  // Check for milestones
  let milestone: { type: '7-day' | '30-day' | '365-day'; xp: number; rewardType: RewardType } | undefined;

  if (newStreak > 0 && newStreak % 365 === 0) {
    milestone = {
      type: '365-day',
      xp: get365DayStreakXP(type),
      rewardType: get365DayStreakRewardType(type),
    };
    if (!streak.streak365Completed) {
      gamificationStore$.streaks[type].streak365Completed.set(true);
    }
  } else if (newStreak > 0 && newStreak % 30 === 0) {
    milestone = {
      type: '30-day',
      xp: get30DayStreakXP(type),
      rewardType: get30DayStreakRewardType(type),
    };
    if (!streak.streak30Completed) {
      gamificationStore$.streaks[type].streak30Completed.set(true);
    }
  } else if (newStreak > 0 && newStreak % 7 === 0) {
    milestone = {
      type: '7-day',
      xp: get7DayStreakXP(type),
      rewardType: get7DayStreakRewardType(type),
    };
    if (!streak.streak7Completed) {
      gamificationStore$.streaks[type].streak7Completed.set(true);
    }
  }

  // Update streak state
  gamificationStore$.streaks[type].currentStreak.set(newStreak);
  gamificationStore$.streaks[type].lastActivityDate.set(today);
  saveStreaksToCache();

  // Get daily XP and award locally
  const dailyXP = getDailyXP(type);
  awardXPLocally(getDailyRewardType(type), dailyXP, referenceId);

  // Award milestone XP if applicable
  if (milestone) {
    awardXPLocally(milestone.rewardType, milestone.xp);
  }

  // Queue for sync
  queueRewardSync(getDailyRewardType(type), dailyXP, referenceId);

  return {
    dailyXP,
    alreadyRecordedToday: false,
    streakMilestone: milestone,
    newStreak,
  };
}

// =============================================================================
// Streak Helper Functions
// =============================================================================

function getDailyRewardType(type: StreakActivityType): RewardType {
  switch (type) {
    case 'login': return REWARD_TYPES.LOGIN;
    case 'reading': return REWARD_TYPES.CHAPTER_READ;
    case 'notes': return REWARD_TYPES.DAILY_NOTE;
    case 'plan': return REWARD_TYPES.DAY_COMPLETE;
    case 'devotion': return REWARD_TYPES.DAILY_DEVOTION;
  }
}

function get7DayStreakRewardType(type: StreakActivityType): RewardType {
  switch (type) {
    case 'login': return REWARD_TYPES.LOGIN_STREAK_7;
    case 'reading': return REWARD_TYPES.READ_STREAK_7;
    case 'notes': return REWARD_TYPES.NOTE_STREAK_7;
    case 'plan': return REWARD_TYPES.STREAK_7;
    case 'devotion': return REWARD_TYPES.DEVOTION_STREAK_7;
  }
}

function get30DayStreakRewardType(type: StreakActivityType): RewardType {
  switch (type) {
    case 'login': return REWARD_TYPES.LOGIN_STREAK_30;
    case 'reading': return REWARD_TYPES.READ_STREAK_30;
    case 'notes': return REWARD_TYPES.NOTE_STREAK_30;
    case 'plan': return REWARD_TYPES.STREAK_30;
    case 'devotion': return REWARD_TYPES.DEVOTION_STREAK_30;
  }
}

function get365DayStreakRewardType(type: StreakActivityType): RewardType {
  switch (type) {
    case 'login': return REWARD_TYPES.LOGIN_STREAK_365;
    case 'reading': return REWARD_TYPES.READ_STREAK_365;
    case 'notes': return REWARD_TYPES.NOTE_STREAK_365;
    case 'plan': return REWARD_TYPES.STREAK_365;
    case 'devotion': return REWARD_TYPES.DEVOTION_STREAK_365;
  }
}

function getDailyXP(type: StreakActivityType): number {
  return REWARD_POINTS[getDailyRewardType(type)];
}

function get7DayStreakXP(type: StreakActivityType): number {
  return REWARD_POINTS[get7DayStreakRewardType(type)];
}

function get30DayStreakXP(type: StreakActivityType): number {
  return REWARD_POINTS[get30DayStreakRewardType(type)];
}

function get365DayStreakXP(type: StreakActivityType): number {
  return REWARD_POINTS[get365DayStreakRewardType(type)];
}

// =============================================================================
// Initialization
// =============================================================================

/**
 * Initialize the gamification store
 * Loads from local storage, optionally fetches from server on fresh install
 */
export async function initializeGamificationStore(userId?: string): Promise<void> {
  gamificationStore$.isLoading.set(true);

  try {
    // Load from local storage
    const localRewards = await loadRewardsFromStorage();
    const pendingActivities = await loadPendingFromStorage();
    const streaks = await loadStreaksFromStorage();

    if (localRewards.length > 0) {
      // Local cache exists, use it
      gamificationStore$.localRewards.set(localRewards);
      gamificationStore$.pendingActivities.set(pendingActivities);
      gamificationStore$.streaks.set(streaks);
      gamificationStore$.localRewardsLoaded.set(true);

      // Sync any pending activities immediately
      if (pendingActivities.length > 0) {
        scheduleImmediateSync();
      }

      console.log(`[GamificationStore] Loaded ${localRewards.length} rewards from cache`);
    } else if (userId) {
      // No local cache (fresh install or reinstall)
      // Fetch all rewards from server to rebuild cache
      await rebuildCacheFromServer(userId);
    }

    // Load today's activity
    const todayActivity = await AsyncStorage.getItem(STORAGE_KEYS.TODAY_ACTIVITY);
    if (todayActivity) {
      const parsed = JSON.parse(todayActivity);
      if (parsed.date === getTodayDateString()) {
        gamificationStore$.todayActivity.set(parsed);
      } else {
        resetTodayActivity();
      }
    }

    // Setup AppState listener for background/foreground sync
    setupAppStateListener();
  } catch (error) {
    console.error("[GamificationStore] Initialization error:", error);
  } finally {
    gamificationStore$.isLoading.set(false);
  }
}

/**
 * Rebuild local cache from server (for fresh install / reinstall)
 */
async function rebuildCacheFromServer(userId: string): Promise<void> {
  console.log("[GamificationStore] Rebuilding cache from server...");

  try {
    // Fetch all rewards from server
    const { data: rewards, error } = await supabase
      .from('user_rewards')
      .select('reward_type, points, created_at, reference_id')
      .eq('user_id', userId);

    if (error) {
      console.error("[GamificationStore] Error fetching rewards:", error);
      return;
    }

    const localRewards: LocalReward[] = (rewards || []).map(r => ({
      type: r.reward_type as RewardType,
      points: r.points,
      timestamp: r.created_at,
      ref: r.reference_id || undefined,
    }));

    gamificationStore$.localRewards.set(localRewards);
    await saveRewardsToStorage();

    // Fetch current streaks
    const { data: streakData } = await supabase
      .from('user_activity_streaks')
      .select('activity_type, current_streak, last_activity_date, streak_7_completed, streak_30_completed')
      .eq('user_id', userId);

    if (streakData) {
      const streaks: Record<StreakActivityType, ActivityStreak> = {
        login: { ...DEFAULT_STREAK },
        reading: { ...DEFAULT_STREAK },
        notes: { ...DEFAULT_STREAK },
        plan: { ...DEFAULT_STREAK },
        devotion: { ...DEFAULT_STREAK },
      };

      for (const row of streakData) {
        const type = row.activity_type as StreakActivityType;
        if (type in streaks) {
          streaks[type] = {
            currentStreak: row.current_streak,
            lastActivityDate: row.last_activity_date,
            streak7Completed: row.streak_7_completed,
            streak30Completed: row.streak_30_completed,
            streak365Completed: row.current_streak >= 365,
          };
        }
      }

      gamificationStore$.streaks.set(streaks);
      await saveStreaksToCache();
    }

    gamificationStore$.localRewardsLoaded.set(true);

    console.log(`[GamificationStore] Rebuilt cache with ${localRewards.length} rewards`);
  } catch (error) {
    console.error("[GamificationStore] Error rebuilding cache:", error);
  }
}

/**
 * Setup AppState listener for background/foreground sync
 */
function setupAppStateListener(): void {
  if (appStateSubscription) {
    appStateSubscription.remove();
  }

  appStateSubscription = AppState.addEventListener('change', async (state: AppStateStatus) => {
    if (state === 'background') {
      // Sync immediately before app goes to background
      await performBatchSync();
    } else if (state === 'active') {
      // Check for pending sync when app comes to foreground
      const pending = gamificationStore$.pendingActivities.peek();
      if (pending.length > 0) {
        await performBatchSync();
      }
    }
  });
}

/**
 * Clear all gamification caches - call on logout
 */
export async function clearAllCaches(): Promise<void> {
  try {
    // Cancel sync timer
    if (syncTimer) {
      clearTimeout(syncTimer);
      syncTimer = null;
    }

    // Clear AsyncStorage
    await Promise.all([
      AsyncStorage.removeItem(STORAGE_KEYS.LOCAL_REWARDS),
      AsyncStorage.removeItem(STORAGE_KEYS.PENDING_SYNC),
      AsyncStorage.removeItem(STORAGE_KEYS.STREAKS),
      AsyncStorage.removeItem(STORAGE_KEYS.TODAY_ACTIVITY),
      AsyncStorage.removeItem(STORAGE_KEYS.LAST_SYNC),
    ]);

    // Reset store state
    gamificationStore$.localRewards.set([]);
    gamificationStore$.localRewardsLoaded.set(false);
    gamificationStore$.pendingActivities.set([]);
    gamificationStore$.todayActivity.set({
      date: getTodayDateString(),
      loginBonusAwarded: false,
      chaptersRead: [],
      notesAdded: [],
      planDaysCompleted: [],
      hasOnTimePlanCompletion: false,
      plansCompleted: [],
      devotionCompleted: false,
    });
    gamificationStore$.streaks.set({
      login: { ...DEFAULT_STREAK },
      reading: { ...DEFAULT_STREAK },
      notes: { ...DEFAULT_STREAK },
      plan: { ...DEFAULT_STREAK },
      devotion: { ...DEFAULT_STREAK },
    });
    gamificationStore$.lastSyncAt.set(null);

    console.log("[GamificationStore] All caches cleared");
  } catch (error) {
    console.error("[GamificationStore] Error clearing caches:", error);
  }
}

// =============================================================================
// Activity Status Helpers
// =============================================================================

export function hasActivityToday(type: StreakActivityType): boolean {
  const streak = gamificationStore$.streaks[type].peek();
  return streak.lastActivityDate === getTodayDateString();
}

export function getStreakInfo(type: StreakActivityType): ActivityStreak {
  return gamificationStore$.streaks[type].peek();
}

// Plan completion tracking
export function getPlanDaysCompletedToday(): number {
  resetTodayIfNewDay();
  return gamificationStore$.todayActivity.planDaysCompleted.peek().length;
}

export function trackPlanDayCompletion(sessionId: string, dayNumber: number, isOnTime: boolean = false): void {
  resetTodayIfNewDay();
  const key = `${sessionId}_${dayNumber}`;

  const current = gamificationStore$.todayActivity.planDaysCompleted.peek();
  if (!current.includes(key)) {
    gamificationStore$.todayActivity.planDaysCompleted.set([...current, key]);
  }

  if (isOnTime && !gamificationStore$.todayActivity.hasOnTimePlanCompletion.peek()) {
    gamificationStore$.todayActivity.hasOnTimePlanCompletion.set(true);
  }

  saveTodayActivityToCache();
}

export function hasPlanDayCompletedToday(sessionId: string, dayNumber: number): boolean {
  resetTodayIfNewDay();
  const key = `${sessionId}_${dayNumber}`;
  return gamificationStore$.todayActivity.planDaysCompleted.peek().includes(key);
}

export function getPlansCompletedToday(): number {
  resetTodayIfNewDay();
  return gamificationStore$.todayActivity.plansCompleted.peek().length;
}

export function trackPlanCompletion(sessionId: string): void {
  resetTodayIfNewDay();
  const current = gamificationStore$.todayActivity.plansCompleted.peek();
  if (!current.includes(sessionId)) {
    gamificationStore$.todayActivity.plansCompleted.set([...current, sessionId]);
    saveTodayActivityToCache();
  }
}

export function hasPlanCompletedToday(sessionId: string): boolean {
  resetTodayIfNewDay();
  return gamificationStore$.todayActivity.plansCompleted.peek().includes(sessionId);
}

// =============================================================================
// Test Functions (DEV only)
// =============================================================================

export function testResetStreaks(): void {
  gamificationStore$.streaks.set({
    login: { ...DEFAULT_STREAK },
    reading: { ...DEFAULT_STREAK },
    notes: { ...DEFAULT_STREAK },
    plan: { ...DEFAULT_STREAK },
    devotion: { ...DEFAULT_STREAK },
  });
  saveStreaksToCache();
}

export function testSetStreak(
  type: StreakActivityType,
  config: Partial<ActivityStreak>
): void {
  const current = gamificationStore$.streaks[type].peek();
  gamificationStore$.streaks[type].set({
    ...current,
    ...config,
  });
  saveStreaksToCache();
}

export function testResetAllActivities(): void {
  gamificationStore$.todayActivity.set({
    date: getTodayDateString(),
    loginBonusAwarded: false,
    chaptersRead: [],
    notesAdded: [],
    planDaysCompleted: [],
    hasOnTimePlanCompletion: false,
    plansCompleted: [],
    devotionCompleted: false,
  });
  saveTodayActivityToCache();
}

export function testSetActivities(config: {
  login?: boolean;
  chapterRead?: boolean;
  noteAdded?: boolean;
  planDay?: boolean;
  devotion?: boolean;
}): void {
  const today = getTodayDateString();
  gamificationStore$.todayActivity.set({
    date: today,
    loginBonusAwarded: config.login ?? false,
    chaptersRead: config.chapterRead ? ["1_1"] : [],
    notesAdded: config.noteAdded ? ["test-note-1"] : [],
    planDaysCompleted: config.planDay ? ["test-session_1"] : [],
    hasOnTimePlanCompletion: config.planDay ?? false,
    plansCompleted: [],
    devotionCompleted: config.devotion ?? false,
  });
  saveTodayActivityToCache();
}
