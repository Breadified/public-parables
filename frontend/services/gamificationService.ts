/**
 * Gamification Service - Handles XP rewards and streak tracking
 *
 * Architecture: Local-first with batch sync to server
 *
 * Flow:
 * 1. Activity happens -> recordActivityOnServer (if online) OR recordActivity (if offline)
 * 2. XP is added to local cache immediately (gamificationStore.localRewards)
 * 3. UI updates instantly (XP/level computed from local rewards)
 * 4. Server confirms & updates level for others to see
 *
 * SECURITY: XP amounts are determined SERVER-SIDE only.
 * The client sends activity type, server looks up points from reward_points_config.
 */

import { supabase } from "@/lib/supabase";
import { authStore$ } from "@/state/bibleStore";
import {
  awardXPLocally,
  queueRewardSync,
  hasActivityToday,
  gamificationStore$,
  saveStreaksToCache,
  saveTodayActivityToCache,
  totalXP$,
  currentLevel$,
  type StreakActivityType,
  type LocalReward,
} from "@/state/gamificationStore";
import {
  REWARD_TYPES,
  REWARD_POINTS,
  type UserGlobalStats,
  type RewardType,
} from "@/types/database";
import { getLocalDateString } from "@/utils/dateFormatters";

// ============================================================================
// SERVER-SIDE ACTIVITY RECORDING (Secure XP)
// ============================================================================

/**
 * Server response from record_activity_with_streak RPC
 */
interface ServerActivityResult {
  daily_xp: number;
  new_streak: number;
  streak_milestone_type: string | null;
  streak_milestone_xp: number;
  total_xp: number;
  level: number;
  all_complete_bonus_xp: number;  // Bonus for completing all 5 daily activities
}

/**
 * Record activity with server-side XP calculation
 * This is the primary entry point when ONLINE
 *
 * @param userId - User ID
 * @param activityType - 'login' | 'reading' | 'notes'
 * @param referenceId - Optional reference (e.g., chapter key, note ID)
 * @returns Result with XP awarded (determined by server) and streak info
 */
export async function recordActivityOnServer(
  userId: string,
  activityType: StreakActivityType,
  referenceId?: string
): Promise<{
  dailyXP: number;
  newStreak: number;
  streakMilestone?: { type: '7-day' | '30-day' | '365-day'; xp: number; rewardType: RewardType };
  totalXP: number;
  level: number;
  alreadyRecordedToday: boolean;
  allCompleteBonusXP: number;  // Bonus for completing all 5 daily activities
} | null> {
  try {
    // Pass client's local date so daily resets happen at midnight local time
    // Without this, the server uses UTC which causes timezone issues
    const clientLocalDate = getLocalDateString();

    const { data, error } = await supabase.rpc('record_activity_with_streak', {
      p_user_id: userId,
      p_activity_type: activityType,
      p_reference_id: referenceId || null,
      p_client_date: clientLocalDate,
    });

    if (error) {
      console.error('[GamificationService] Server activity error:', error);
      return null;
    }

    const result = data?.[0] as ServerActivityResult | undefined;
    if (!result) {
      console.error('[GamificationService] No result from server');
      return null;
    }

    // Already recorded today if daily_xp is 0
    const alreadyRecordedToday = result.daily_xp === 0;

    // Map streak milestone type to reward type
    let streakMilestone: { type: '7-day' | '30-day' | '365-day'; xp: number; rewardType: RewardType } | undefined;
    if (result.streak_milestone_type) {
      const milestoneType = result.streak_milestone_type as '7-day' | '30-day' | '365-day';
      streakMilestone = {
        type: milestoneType,
        xp: result.streak_milestone_xp,
        rewardType: getStreakRewardType(activityType, milestoneType),
      };
    }

    // Add the reward to local cache (if not already recorded)
    if (!alreadyRecordedToday && result.daily_xp > 0) {
      const localReward: LocalReward = {
        type: getDailyRewardType(activityType),
        points: result.daily_xp,
        timestamp: new Date().toISOString(),
        ref: referenceId,
      };
      gamificationStore$.localRewards.push(localReward);
    }

    // Add milestone reward to local cache if applicable
    if (streakMilestone && result.streak_milestone_xp > 0) {
      const milestoneReward: LocalReward = {
        type: streakMilestone.rewardType,
        points: result.streak_milestone_xp,
        timestamp: new Date().toISOString(),
      };
      gamificationStore$.localRewards.push(milestoneReward);
    }

    // Update local streaks state
    gamificationStore$.streaks[activityType].currentStreak.set(result.new_streak);
    gamificationStore$.streaks[activityType].lastActivityDate.set(getLocalDateString());

    // Also update todayActivity so dailyActivityStatus$ reflects the completed activity
    if (!alreadyRecordedToday) {
      const today = getLocalDateString();
      const activity = gamificationStore$.todayActivity.peek();

      // Reset if it's a new day
      if (activity.date !== today) {
        gamificationStore$.todayActivity.set({
          date: today,
          loginBonusAwarded: activityType === 'login',
          chaptersRead: activityType === 'reading' && referenceId ? [referenceId] : [],
          notesAdded: activityType === 'notes' && referenceId ? [referenceId] : [],
          planDaysCompleted: activityType === 'plan' && referenceId ? [referenceId] : [],
          hasOnTimePlanCompletion: activityType === 'plan',
          plansCompleted: [],
          devotionCompleted: activityType === 'devotion',
        });
      } else {
        // Update the specific activity field
        switch (activityType) {
          case 'login':
            gamificationStore$.todayActivity.loginBonusAwarded.set(true);
            break;
          case 'reading':
            if (referenceId && !activity.chaptersRead.includes(referenceId)) {
              gamificationStore$.todayActivity.chaptersRead.set([...activity.chaptersRead, referenceId]);
            }
            break;
          case 'notes':
            if (referenceId && !activity.notesAdded.includes(referenceId)) {
              gamificationStore$.todayActivity.notesAdded.set([...activity.notesAdded, referenceId]);
            }
            break;
          case 'plan':
            // Track plan completion for daily activity
            if (referenceId && !activity.planDaysCompleted.includes(referenceId)) {
              gamificationStore$.todayActivity.planDaysCompleted.set([...activity.planDaysCompleted, referenceId]);
            }
            gamificationStore$.todayActivity.hasOnTimePlanCompletion.set(true);
            break;
          case 'devotion':
            gamificationStore$.todayActivity.devotionCompleted.set(true);
            break;
        }
      }

      // Persist changes to AsyncStorage
      saveStreaksToCache();
      saveTodayActivityToCache();
    }

    return {
      dailyXP: result.daily_xp,
      newStreak: result.new_streak,
      streakMilestone,
      totalXP: result.total_xp,
      level: result.level,
      alreadyRecordedToday,
      allCompleteBonusXP: result.all_complete_bonus_xp || 0,
    };
  } catch (error) {
    console.error('[GamificationService] recordActivityOnServer error:', error);
    return null;
  }
}

/**
 * Get the reward type for a streak milestone
 */
function getStreakRewardType(activityType: StreakActivityType, milestoneType: '7-day' | '30-day' | '365-day'): RewardType {
  if (milestoneType === '7-day') {
    switch (activityType) {
      case 'login': return REWARD_TYPES.LOGIN_STREAK_7;
      case 'reading': return REWARD_TYPES.READ_STREAK_7;
      case 'notes': return REWARD_TYPES.NOTE_STREAK_7;
      case 'plan': return REWARD_TYPES.STREAK_7;
      case 'devotion': return REWARD_TYPES.DEVOTION_STREAK_7;
    }
  } else if (milestoneType === '30-day') {
    switch (activityType) {
      case 'login': return REWARD_TYPES.LOGIN_STREAK_30;
      case 'reading': return REWARD_TYPES.READ_STREAK_30;
      case 'notes': return REWARD_TYPES.NOTE_STREAK_30;
      case 'plan': return REWARD_TYPES.STREAK_30;
      case 'devotion': return REWARD_TYPES.DEVOTION_STREAK_30;
    }
  } else {
    // 365-day
    switch (activityType) {
      case 'login': return REWARD_TYPES.LOGIN_STREAK_365;
      case 'reading': return REWARD_TYPES.READ_STREAK_365;
      case 'notes': return REWARD_TYPES.NOTE_STREAK_365;
      case 'plan': return REWARD_TYPES.STREAK_365;
      case 'devotion': return REWARD_TYPES.DEVOTION_STREAK_365;
    }
  }
}

/**
 * Get the daily reward type for an activity
 */
function getDailyRewardType(activityType: StreakActivityType): RewardType {
  switch (activityType) {
    case 'login': return REWARD_TYPES.LOGIN;
    case 'reading': return REWARD_TYPES.CHAPTER_READ;
    case 'notes': return REWARD_TYPES.DAILY_NOTE;
    case 'plan': return REWARD_TYPES.DAY_COMPLETE;
    case 'devotion': return REWARD_TYPES.DAILY_DEVOTION;
  }
}

// ============================================================================
// DEVOTION CATCH-UP (No XP, No Streak)
// ============================================================================

/**
 * Record a devotion completion (both on-time and catch-up)
 *
 * This function:
 * 1. ALWAYS inserts into user_rewards for completion tracking
 * 2. For on-time: also calls recordActivityOnServer for XP/streak
 * 3. For catch-up: only inserts the record with 0 XP
 *
 * @param userId - User ID
 * @param devotionDate - The devotion date (YYYY-MM-DD)
 * @param isOnTime - true for today's devotion (awards XP), false for catch-up (0 XP)
 * @returns Result with XP and streak info
 */
export async function recordDevotionCompletion(
  userId: string,
  devotionDate: string,
  isOnTime: boolean
): Promise<{
  xpAwarded: boolean;
  pointsAwarded: number;
  newStreak?: number;
  streakMilestone?: { type: '7-day' | '30-day' | '365-day'; xp: number; rewardType: RewardType };
  alreadyCompleted: boolean;
  allCompleteBonusXP?: number;
}> {
  const referenceId = `devotion_${devotionDate}`;

  try {
    // Check if already completed
    const { data: existing } = await supabase
      .from('user_rewards')
      .select('id')
      .eq('user_id', userId)
      .eq('reward_type', REWARD_TYPES.DAILY_DEVOTION)
      .eq('reference_id', referenceId)
      .single();

    if (existing) {
      console.log('[GamificationService] Devotion already completed:', devotionDate);
      return {
        xpAwarded: false,
        pointsAwarded: 0,
        alreadyCompleted: true,
      };
    }

    if (isOnTime) {
      // ON-TIME: Insert record AND call server for XP/streak
      const points = REWARD_POINTS[REWARD_TYPES.DAILY_DEVOTION];

      // Insert the reward record first
      const { error: insertError } = await supabase.from('user_rewards').insert({
        user_id: userId,
        reward_type: REWARD_TYPES.DAILY_DEVOTION,
        points: points,
        reference_id: referenceId,
        is_on_time: true,
      });

      if (insertError && insertError.code !== '23505') {
        console.error('[GamificationService] Error inserting devotion reward:', insertError);
      }

      // Call server RPC for streak tracking and all-complete bonus
      const result = await recordActivityOnServer(userId, 'devotion', referenceId);

      if (result) {
        return {
          xpAwarded: result.dailyXP > 0 || points > 0,
          pointsAwarded: result.dailyXP > 0 ? result.dailyXP : points,
          newStreak: result.newStreak,
          streakMilestone: result.streakMilestone,
          alreadyCompleted: false,
          allCompleteBonusXP: result.allCompleteBonusXP,
        };
      }

      // RPC failed but record was inserted
      return {
        xpAwarded: true,
        pointsAwarded: points,
        alreadyCompleted: false,
      };
    } else {
      // CATCH-UP: Insert record with 0 XP, no streak update
      const { error } = await supabase.from('user_rewards').insert({
        user_id: userId,
        reward_type: REWARD_TYPES.DAILY_DEVOTION,
        points: 0,
        reference_id: referenceId,
        is_on_time: false,
      });

      if (error && error.code !== '23505') {
        console.error('[GamificationService] Error recording devotion catch-up:', error);
      }

      console.log('[GamificationService] Devotion catch-up recorded:', devotionDate, '(0 XP)');
      return {
        xpAwarded: false,
        pointsAwarded: 0,
        alreadyCompleted: false,
      };
    }
  } catch (error) {
    console.error('[GamificationService] recordDevotionCompletion error:', error);
    return {
      xpAwarded: false,
      pointsAwarded: 0,
      alreadyCompleted: false,
    };
  }
}

// ============================================================================
// USER STATS (for OTHER users only)
// ============================================================================

/**
 * Fetch another user's global stats from server
 * For current user, use totalXP$/currentLevel$ from gamificationStore instead.
 */
export async function fetchUserGlobalStats(
  userId: string
): Promise<UserGlobalStats | null> {
  const { data, error } = await supabase
    .from("user_global_stats")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    console.error("[GamificationService] Error fetching stats:", error);
    return null;
  }

  return data as UserGlobalStats;
}

// ============================================================================
// DAILY NOTE REWARDS (with diminishing returns)
// ============================================================================

/**
 * Award daily note XP
 * - First note: Full XP via recordActivityOnServer
 * - Subsequent notes: Diminishing returns, tracked server-side
 */
export async function awardDailyNoteReward(
  userId: string,
  noteId: string
): Promise<{
  xpGained: number;
  totalXP: number;
  level: number;
  rewardType: RewardType;
  streakMilestone?: { type: '7-day' | '30-day' | '365-day'; xp: number; rewardType: RewardType };
  alreadyRecordedToday: boolean;
  allCompleteBonusXP?: number;
} | null> {
  const shouldSync = authStore$.shouldSync.peek();
  const isFirstNoteToday = !hasActivityToday('notes');

  if (shouldSync) {
    // ONLINE: Use server-side XP calculation
    if (isFirstNoteToday) {
      const result = await recordActivityOnServer(userId, 'notes', noteId);
      if (!result) return null;

      return {
        xpGained: result.dailyXP,
        totalXP: result.totalXP,
        level: result.level,
        rewardType: REWARD_TYPES.DAILY_NOTE,
        streakMilestone: result.streakMilestone,
        alreadyRecordedToday: result.alreadyRecordedToday,
        allCompleteBonusXP: result.allCompleteBonusXP,
      };
    } else {
      // Subsequent notes - server handles diminishing returns via trigger
      // The trigger will look up the base points and the insert will work
      const today = getLocalDateString();
      const { error } = await supabase.from("user_rewards").insert({
        user_id: userId,
        reward_type: REWARD_TYPES.DAILY_NOTE,
        reference_id: `${today}_note_${noteId}`,
        // points will be set by server trigger
      });

      if (error) {
        if (error.code === "23505") {
          // Duplicate - already awarded for this note
          return {
            xpGained: 0,
            totalXP: totalXP$.peek(),
            level: currentLevel$.peek(),
            rewardType: REWARD_TYPES.DAILY_NOTE,
            alreadyRecordedToday: true,
          };
        }
        console.error("[GamificationService] Error tracking note:", error);
        return null;
      }

      // Use computed values from local state
      const xpGained = REWARD_POINTS[REWARD_TYPES.DAILY_NOTE]; // Show expected XP for toast

      return {
        xpGained,
        totalXP: totalXP$.peek(),
        level: currentLevel$.peek(),
        rewardType: REWARD_TYPES.DAILY_NOTE,
        alreadyRecordedToday: false,
      };
    }
  } else {
    // OFFLINE: Use local tracking, queue for sync
    // Local XP is for UI feedback only - server will recalculate when online
    const xpAmount = REWARD_POINTS[REWARD_TYPES.DAILY_NOTE];

    awardXPLocally(REWARD_TYPES.DAILY_NOTE, xpAmount, noteId);
    queueRewardSync(REWARD_TYPES.DAILY_NOTE, xpAmount, noteId);

    return {
      xpGained: xpAmount,
      totalXP: totalXP$.peek(),
      level: currentLevel$.peek(),
      rewardType: REWARD_TYPES.DAILY_NOTE,
      alreadyRecordedToday: false,
    };
  }
}

