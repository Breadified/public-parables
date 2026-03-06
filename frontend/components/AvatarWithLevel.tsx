/**
 * AvatarWithLevel - DRY component combining UserAvatar with LevelBadge
 *
 * Displays user avatar with level badge overlay.
 *
 * Level data sources (in priority order):
 * 1. Override props (overrideLevel, overrideTotalXP) - for explicit control
 * 2. Computed totalXP$/currentLevel$ - for current user (local-first, computed from rewards)
 * 3. userProfileCache$ - for other users (fetched with ensureProfiles)
 *
 * Features:
 * - Wraps UserAvatar with LevelBadge overlay
 * - Automatically uses correct level source for current vs other users
 * - Badge size scales with avatar size
 * - Supports all UserAvatar props
 */

import React from "react";
import { View } from "react-native";
import { useSelector } from "@legendapp/state/react";

import UserAvatar from "@/components/UserAvatar";
import LevelBadge from "@/components/Profile/LevelBadge";
import { userProfileCache$ } from "@/state/userProfileCache";
import { authStore$ } from "@/state/bibleStore";
import { totalXP$, allStreaks$ } from "@/state/gamificationStore";

interface AvatarWithLevelProps {
  /** User ID for avatar generation and level lookup */
  userId: string;
  /** Display name to extract initial from */
  displayName: string;
  /** Size of the avatar in pixels (default: 28) */
  size?: number;
  /** Whether this is an anonymous user (hides level badge) */
  isAnonymous?: boolean;
  /** Optional border color (e.g., for AI agents) */
  borderColor?: string;
  /** Override level (e.g., for current user from gamificationStore) */
  overrideLevel?: number;
  /** Override totalXP (e.g., for current user from gamificationStore) */
  overrideTotalXP?: number;
  /** Hide the level badge */
  hideBadge?: boolean;
}

/**
 * Calculate appropriate badge size based on avatar size
 * Smaller avatars get proportionally smaller badges
 */
function getBadgeSize(avatarSize: number): number {
  if (avatarSize <= 24) return 12;
  if (avatarSize <= 32) return 14;
  if (avatarSize <= 48) return 18;
  if (avatarSize <= 64) return 22;
  return 26;
}

const AvatarWithLevel: React.FC<AvatarWithLevelProps> = ({
  userId,
  displayName,
  size = 28,
  isAnonymous = false,
  borderColor,
  overrideLevel,
  overrideTotalXP,
  hideBadge = false,
}) => {
  // Get current user ID to check if this is the current user's avatar
  const currentUserId = useSelector(authStore$.user.id);
  const isCurrentUser = userId === currentUserId;

  // Get local-first XP/level for current user (computed from local rewards)
  const localTotalXP = useSelector(totalXP$);

  // Get login streak for current user
  const loginStreak = useSelector(() => allStreaks$.get().login.currentStreak);

  // Get cached profile for other users' data
  const cachedProfile = useSelector(() => userProfileCache$.profiles[userId]?.get());

  // Use override values if provided, otherwise:
  // - For current user: use computed local XP (local-first source of truth)
  // - For other users: use userProfileCache$
  const totalXP = overrideTotalXP
    ?? (isCurrentUser ? localTotalXP : cachedProfile?.total_xp)
    ?? 0;

  // Login streak: current user uses local store, other users use cached profile
  const streakCount = isCurrentUser
    ? loginStreak
    : (cachedProfile?.login_streak ?? 0);

  // Don't show badge for anonymous users or if explicitly hidden
  const showBadge = !isAnonymous && !hideBadge;

  const badgeSize = getBadgeSize(size);

  return (
    <View style={{ width: size, height: size }}>
      <UserAvatar
        userId={userId}
        displayName={displayName}
        size={size}
        isAnonymous={isAnonymous}
        borderColor={borderColor}
      />
      {showBadge && (
        <LevelBadge
          totalXP={totalXP}
          streakCount={streakCount}
          size={badgeSize}
        />
      )}
    </View>
  );
};

export default AvatarWithLevel;
