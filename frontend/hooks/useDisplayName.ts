/**
 * useDisplayName - Hook for getting formatted user display names
 *
 * Uses the userProfileCache$ to get display names for users.
 * Automatically appends discriminator (#0000) when there's a conflict
 * (same display_name, different user_id) in the local cache.
 */

import { useSelector } from "@legendapp/state/react";
import { userProfileCache$ } from "@/state/userProfileCache";

/**
 * Get the formatted display name for a user
 * @param userId - The user's ID
 * @returns The display name, with discriminator if there's a conflict, or "Anonymous"
 */
export function useDisplayName(userId: string): string {
  // Subscribe to the entire profiles Record - guarantees re-render on any change
  // Using direct observable subscription per CLAUDE.md pattern
  const profiles = useSelector(userProfileCache$.profiles);

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
    const formattedDiscriminator = `#${profile.discriminator.toString().padStart(4, "0")}`;
    return `${profile.display_name}${formattedDiscriminator}`;
  }

  return profile.display_name;
}
