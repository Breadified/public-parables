/**
 * User Profile Cache - Lazy-loading cache for comment author profiles
 *
 * Stores user display names and avatars locally (AsyncStorage) for users we encounter in comments.
 * Only fetches profiles for user IDs not already cached.
 * Subscribes to real-time updates for display name and avatar changes.
 *
 * Tables:
 * - user_display_names (columns: id, user_id, display_name, discriminator)
 * - user_profiles (columns: id, avatar_url, ...)
 */

import { observable } from "@legendapp/state";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

// Track real-time subscription
let realtimeChannel: RealtimeChannel | null = null;

const STORAGE_KEY = "user_profile_cache_v3"; // Bumped to force re-fetch after realtime sync fix

export interface CachedProfile {
  user_id: string;
  display_name: string | null;
  discriminator: number | null; // 4-digit int (e.g., 1, 42, 1234)
  avatar_url: string | null; // User's profile avatar
  level: number; // User's level (from user_global_stats or user_profile_summary, default: 1)
  /** @deprecated For other users, XP is not needed - only level matters. Kept for legacy code. */
  total_xp: number;
  login_streak: number; // User's current login streak (from user_activity_streaks, default: 0)
  cached_at: number; // Timestamp for optional TTL
}

/**
 * Format discriminator as #0000 (4 digits, zero-padded)
 */
function formatDiscriminator(discriminator: number): string {
  return `#${discriminator.toString().padStart(4, "0")}`;
}

export const userProfileCache$ = observable({
  profiles: {} as Record<string, CachedProfile>,

  /**
   * Get profile from cache (returns undefined if not cached)
   */
  getProfile: (userId: string): CachedProfile | undefined => {
    return userProfileCache$.profiles[userId]?.get();
  },

  /**
   * Batch fetch and cache profiles for given user IDs
   * Only fetches profiles not already in cache
   * Fetches from both user_display_names and user_profiles tables
   */
  ensureProfiles: async (userIds: string[]): Promise<void> => {
    if (!userIds || userIds.length === 0) return;

    const cached = userProfileCache$.profiles.get();
    const missing = userIds.filter((id) => id && !cached[id]);

    if (missing.length === 0) {
      console.log("[UserProfileCache] All profiles already cached");
      return;
    }

    console.log(
      `[UserProfileCache] Fetching ${missing.length} missing profiles`
    );

    try {
      // Fetch display names, avatars, global stats, and login streaks in parallel
      const [displayNamesResult, profilesResult, globalStatsResult, loginStreakResult] = await Promise.all([
        supabase
          .from("user_display_names")
          .select("user_id, display_name, discriminator")
          .in("user_id", missing),
        supabase
          .from("user_profiles")
          .select("id, avatar_url")
          .in("id", missing),
        supabase
          .from("user_global_stats")
          .select("user_id, level, total_xp")
          .in("user_id", missing),
        supabase
          .from("user_activity_streaks")
          .select("user_id, current_streak")
          .in("user_id", missing)
          .eq("activity_type", "login"),
      ]);

      if (displayNamesResult.error) {
        console.error("[UserProfileCache] Display names fetch error:", displayNamesResult.error);
      }
      if (profilesResult.error) {
        console.error("[UserProfileCache] Profiles fetch error:", profilesResult.error);
      }
      if (globalStatsResult.error) {
        console.error("[UserProfileCache] Global stats fetch error:", globalStatsResult.error);
      }
      if (loginStreakResult.error) {
        console.error("[UserProfileCache] Login streak fetch error:", loginStreakResult.error);
      }

      // Build a map of avatar URLs by user ID
      const avatarMap = new Map<string, string | null>();
      if (profilesResult.data) {
        profilesResult.data.forEach((p) => {
          avatarMap.set(p.id, p.avatar_url);
        });
      }

      // Build a map of level/xp by user ID
      const statsMap = new Map<string, { level: number; total_xp: number }>();
      if (globalStatsResult.data) {
        globalStatsResult.data.forEach((s) => {
          statsMap.set(s.user_id, { level: s.level, total_xp: s.total_xp });
        });
      }

      // Build a map of login streaks by user ID
      const loginStreakMap = new Map<string, number>();
      if (loginStreakResult.data) {
        loginStreakResult.data.forEach((s) => {
          loginStreakMap.set(s.user_id, s.current_streak);
        });
      }

      const now = Date.now();
      const updates: Record<string, CachedProfile> = {};

      // Process display names data
      if (displayNamesResult.data && displayNamesResult.data.length > 0) {
        displayNamesResult.data.forEach((profile) => {
          const stats = statsMap.get(profile.user_id);
          updates[profile.user_id] = {
            user_id: profile.user_id,
            display_name: profile.display_name,
            discriminator: profile.discriminator,
            avatar_url: avatarMap.get(profile.user_id) || null,
            level: stats?.level ?? 1,
            total_xp: stats?.total_xp ?? 0,
            login_streak: loginStreakMap.get(profile.user_id) ?? 0,
            cached_at: now,
          };
        });
      }

      // Also add any users who have profiles/stats but not display names
      missing.forEach((userId) => {
        if (!updates[userId] && (avatarMap.has(userId) || statsMap.has(userId) || loginStreakMap.has(userId))) {
          const stats = statsMap.get(userId);
          updates[userId] = {
            user_id: userId,
            display_name: null,
            discriminator: null,
            avatar_url: avatarMap.get(userId) || null,
            level: stats?.level ?? 1,
            total_xp: stats?.total_xp ?? 0,
            login_streak: loginStreakMap.get(userId) ?? 0,
            cached_at: now,
          };
        }
      });

      if (Object.keys(updates).length > 0) {
        // Update cache - re-read current state to avoid race condition
        const currentCache = userProfileCache$.profiles.get();
        userProfileCache$.profiles.set({ ...currentCache, ...updates });

        console.log(
          `[UserProfileCache] Cached ${Object.keys(updates).length} profiles`
        );

        // Persist to AsyncStorage
        await userProfileCache$.saveToStorage();
      }
    } catch (err) {
      console.error("[UserProfileCache] ensureProfiles error:", err);
    }
  },

  /**
   * Save cache to AsyncStorage
   */
  saveToStorage: async (): Promise<void> => {
    try {
      const profiles = userProfileCache$.profiles.get();
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
    } catch (error) {
      console.error("[UserProfileCache] Failed to save:", error);
    }
  },

  /**
   * Load cache from AsyncStorage
   */
  loadFromStorage: async (): Promise<void> => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const profiles = JSON.parse(stored);
        userProfileCache$.profiles.set(profiles);
        console.log(
          `[UserProfileCache] Loaded ${Object.keys(profiles).length} cached profiles`
        );
      }
    } catch (error) {
      console.error("[UserProfileCache] Failed to load:", error);
    }
  },

  /**
   * Clear all cached profiles
   */
  clearCache: async (): Promise<void> => {
    userProfileCache$.profiles.set({});
    await AsyncStorage.removeItem(STORAGE_KEY);
    console.log("[UserProfileCache] Cache cleared");
  },

  /**
   * Get formatted display name for a user
   * Appends discriminator (#0000) only if there's a conflict in the local cache
   * (i.e., another user has the same display_name)
   */
  getFormattedDisplayName: (userId: string): string => {
    const profiles = userProfileCache$.profiles.get();
    const profile = profiles[userId];

    if (!profile || !profile.display_name) {
      return "Anonymous";
    }

    // Check if there's a conflict (same display_name, different user_id)
    const hasConflict = Object.values(profiles).some(
      (p) =>
        p.user_id !== userId &&
        p.display_name === profile.display_name
    );

    if (hasConflict && profile.discriminator !== null) {
      return `${profile.display_name}${formatDiscriminator(profile.discriminator)}`;
    }

    return profile.display_name;
  },

  /**
   * Get avatar URL for a user (returns null if not cached or no avatar)
   */
  getAvatarUrl: (userId: string): string | null => {
    const profiles = userProfileCache$.profiles.get();
    const profile = profiles[userId];
    return profile?.avatar_url || null;
  },

  /**
   * Get level for a user (returns 1 if not cached)
   */
  getLevel: (userId: string): number => {
    const profiles = userProfileCache$.profiles.get();
    const profile = profiles[userId];
    return profile?.level ?? 1;
  },

  /**
   * Get total XP for a user (returns 0 if not cached)
   */
  getTotalXP: (userId: string): number => {
    const profiles = userProfileCache$.profiles.get();
    const profile = profiles[userId];
    return profile?.total_xp ?? 0;
  },

  /**
   * Subscribe to real-time display name and avatar changes
   * Only updates profiles that are already in the cache
   */
  subscribeToChanges: (): (() => void) => {
    // Cleanup existing subscription
    if (realtimeChannel) {
      supabase.removeChannel(realtimeChannel);
      realtimeChannel = null;
    }

    console.log("[UserProfileCache] Subscribing to profile changes");

    realtimeChannel = supabase
      .channel("user-profile-changes")
      // Display name changes
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "user_display_names",
        },
        (payload) => {
          const { user_id, display_name, discriminator } = payload.new as {
            user_id: string;
            display_name: string | null;
            discriminator: number | null;
          };

          // Only update if this user is already in our cache
          const profiles = userProfileCache$.profiles.get();
          if (profiles[user_id]) {
            console.log("[UserProfileCache] Display name updated:", user_id, display_name);
            userProfileCache$.profiles[user_id].set({
              ...profiles[user_id],
              display_name,
              discriminator,
              cached_at: Date.now(),
            });
            userProfileCache$.saveToStorage();
          }
        }
      )
      // Avatar changes
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "user_profiles",
        },
        (payload) => {
          const { id: user_id, avatar_url } = payload.new as {
            id: string;
            avatar_url: string | null;
          };

          // Only update if this user is already in our cache
          const profiles = userProfileCache$.profiles.get();
          if (profiles[user_id]) {
            console.log("[UserProfileCache] Avatar updated:", user_id);
            userProfileCache$.profiles[user_id].set({
              ...profiles[user_id],
              avatar_url,
              cached_at: Date.now(),
            });
            userProfileCache$.saveToStorage();
          }
        }
      )
      // Global stats changes (level/XP)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "user_global_stats",
        },
        (payload) => {
          const { user_id, level, total_xp } = payload.new as {
            user_id: string;
            level: number;
            total_xp: number;
          };

          // Only update if this user is already in our cache
          const profiles = userProfileCache$.profiles.get();
          if (profiles[user_id]) {
            console.log("[UserProfileCache] Level updated:", user_id, level);
            userProfileCache$.profiles[user_id].set({
              ...profiles[user_id],
              level,
              total_xp,
              cached_at: Date.now(),
            });
            userProfileCache$.saveToStorage();
          }
        }
      )
      .subscribe((status) => {
        console.log("[UserProfileCache] Subscription status:", status);
      });

    // Return cleanup function
    return () => {
      if (realtimeChannel) {
        console.log("[UserProfileCache] Unsubscribing from profile changes");
        supabase.removeChannel(realtimeChannel);
        realtimeChannel = null;
      }
    };
  },

  /**
   * Unsubscribe from real-time changes
   */
  unsubscribe: (): void => {
    if (realtimeChannel) {
      console.log("[UserProfileCache] Unsubscribing from profile changes");
      supabase.removeChannel(realtimeChannel);
      realtimeChannel = null;
    }
  },

  /**
   * Check if real-time subscription is active
   */
  isSubscriptionActive: (): boolean => {
    return realtimeChannel !== null;
  },

  /**
   * Refresh stale profiles and reconnect subscription if needed
   * Called on app resume or network reconnect
   */
  refreshProfilesIfNeeded: async (): Promise<void> => {
    // Re-subscribe if subscription lost
    if (!realtimeChannel) {
      console.log("[UserProfileCache] Subscription lost, reconnecting...");
      userProfileCache$.subscribeToChanges();
    }

    // Refresh profiles that are older than 5 minutes
    const staleThreshold = 5 * 60 * 1000; // 5 minutes
    const now = Date.now();
    const profiles = userProfileCache$.profiles.get();

    const staleIds = Object.entries(profiles)
      .filter(([_, profile]) => now - profile.cached_at > staleThreshold)
      .map(([id]) => id);

    if (staleIds.length > 0) {
      console.log(`[UserProfileCache] Refreshing ${staleIds.length} stale profiles`);
      // Force refresh by temporarily removing from cache
      const currentProfiles = userProfileCache$.profiles.get();
      const freshProfiles = { ...currentProfiles };
      staleIds.forEach(id => {
        delete freshProfiles[id];
      });
      userProfileCache$.profiles.set(freshProfiles);

      // Re-fetch stale profiles
      await userProfileCache$.ensureProfiles(staleIds);
    } else {
      console.log("[UserProfileCache] No stale profiles to refresh");
    }
  },
});
