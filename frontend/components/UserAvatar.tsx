/**
 * UserAvatar - Reusable avatar component with cached color generation
 *
 * Features:
 * - Displays user's profile avatar if available (from user_profiles.avatar_url)
 * - Falls back to initial with generated background color
 * - AI agents show their configured avatar image
 * - Colors are cached globally for performance
 * - Text color automatically contrasts with background (WCAG 2.0)
 */

import React from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import { useSelector } from "@legendapp/state/react";
import { isAiAgent, getAiAgent } from "@/constants/aiAgents";
import { userProfileCache$ } from "@/state/userProfileCache";

// ============================================================================
// Color Generation & Caching
// ============================================================================

interface CachedAvatarColors {
  backgroundColor: string;
  textColor: string;
}

// Global cache for avatar colors - persists across renders
const avatarColorCache = new Map<string, CachedAvatarColors>();

/**
 * Generate a consistent color from a string (like a hash)
 * Returns an HSL color with good saturation and lightness for backgrounds
 */
function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash; // Convert to 32-bit integer
  }
  // Use HSL for more control over saturation and lightness
  const hue = Math.abs(hash) % 360;
  const saturation = 65 + (Math.abs(hash >> 8) % 20); // 65-85%
  const lightness = 45 + (Math.abs(hash >> 16) % 15); // 45-60%
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

/**
 * Convert HSL to RGB for luminance calculation
 */
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) =>
    l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [
    Math.round(f(0) * 255),
    Math.round(f(8) * 255),
    Math.round(f(4) * 255),
  ];
}

/**
 * Calculate relative luminance of a color (WCAG 2.0 formula)
 */
function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Determine if text should be white or black based on background color
 */
function shouldUseWhiteText(backgroundColor: string): boolean {
  const match = backgroundColor.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
  if (!match) return true;

  const [, h, s, l] = match.map(Number);
  const [r, g, b] = hslToRgb(h, s, l);
  const luminance = getLuminance(r, g, b);

  return luminance < 0.5;
}

/**
 * Get cached avatar colors for a user ID
 * Calculates and caches if not already cached
 */
export function getAvatarColors(userId: string): CachedAvatarColors {
  const cached = avatarColorCache.get(userId);
  if (cached) return cached;

  const backgroundColor = stringToColor(userId);
  const textColor = shouldUseWhiteText(backgroundColor) ? "#FFFFFF" : "#000000";
  const colors = { backgroundColor, textColor };

  avatarColorCache.set(userId, colors);
  return colors;
}

/**
 * Get the first initial from a display name
 */
export function getInitial(name: string): string {
  if (!name || name === "Anonymous") return "?";
  // Handle names like "Anonymous (by you)"
  const cleanName = name.replace(/\s*\(.*\)/, "").trim();
  return cleanName.charAt(0).toUpperCase();
}

/**
 * Clear the avatar color cache (useful for testing or memory management)
 */
export function clearAvatarCache(): void {
  avatarColorCache.clear();
}

/**
 * Get current cache size (for debugging)
 */
export function getAvatarCacheSize(): number {
  return avatarColorCache.size;
}

// ============================================================================
// Component
// ============================================================================

interface UserAvatarProps {
  /** User ID for color generation */
  userId: string;
  /** Display name to extract initial from */
  displayName: string;
  /** Size of the avatar in pixels (default: 20) */
  size?: number;
  /** Whether this is an anonymous user */
  isAnonymous?: boolean;
  /** Optional border color (e.g., for AI agents) */
  borderColor?: string;
}

const UserAvatar = ({
  userId,
  displayName,
  size = 20,
  isAnonymous = false,
  borderColor,
}: UserAvatarProps) => {
  // Check if this is an AI agent
  const aiAgent = isAiAgent(userId) ? getAiAgent(userId) : null;

  // Reactively observe the user's cached profile for avatar URL
  // This will re-render when the cache updates (e.g., after async fetch)
  const cachedProfile = useSelector(() => userProfileCache$.profiles[userId]?.get());
  const cachedAvatarUrl = cachedProfile?.avatar_url;

  // AI agents use their configured avatar image
  if (aiAgent?.avatarUrl) {
    return (
      <Image
        source={{ uri: aiAgent.avatarUrl }}
        style={[
          styles.avatar,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderColor: borderColor,
            borderWidth: borderColor ? 1 : 0,
          },
        ]}
      />
    );
  }

  // If user has a profile avatar, use it
  if (cachedAvatarUrl && !isAnonymous) {
    return (
      <Image
        source={{ uri: cachedAvatarUrl }}
        style={[
          styles.avatar,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderColor: borderColor,
            borderWidth: borderColor ? 1 : 0,
          },
        ]}
      />
    );
  }

  // Fall back to initial-based avatar with cached colors
  const colors = getAvatarColors(userId);
  const initial = isAnonymous ? "?" : getInitial(displayName);

  return (
    <View
      style={[
        styles.avatar,
        styles.initialAvatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.backgroundColor,
          borderColor: borderColor,
          borderWidth: borderColor ? 1 : 0,
        },
      ]}
    >
      <Text
        style={[
          styles.initialText,
          {
            fontSize: size * 0.5,
            color: colors.textColor,
          },
        ]}
      >
        {initial}
      </Text>
    </View>
  );
};

export default UserAvatar;

const styles = StyleSheet.create({
  avatar: {
    backgroundColor: "#E5E7EB", // Fallback
  },
  initialAvatar: {
    alignItems: "center",
    justifyContent: "center",
  },
  initialText: {
    fontWeight: "700",
  },
});
