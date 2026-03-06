/**
 * UserProfileHeader - Profile section for the Accounts page
 *
 * Displays:
 * - User avatar with level badge overlay
 * - Display name and email
 * - XP progress bar to next level
 */

import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";

import { useTheme } from "@/contexts/ThemeContext";
import AvatarWithLevel from "@/components/AvatarWithLevel";
import XPProgressBar from "./XPProgressBar";

interface UserProfileHeaderProps {
  /** User ID for avatar generation */
  userId: string;
  /** User's email address */
  email: string;
  /** User's display name */
  displayName: string;
  /** User's discriminator (4-digit number) */
  discriminator?: number;
  /** Total XP earned across all sessions */
  totalXP: number;
  /** Server-provided level (if available) */
  serverLevel?: number;
  /** Whether the user is signed in */
  isAuthenticated: boolean;
  /** Callback when sign in is pressed (for unauthenticated state) */
  onSignIn?: () => void;
  /** Callback when avatar is pressed (for editing profile) */
  onAvatarPress?: () => void;
}

/**
 * UserProfileHeader Component
 * Main profile section at the top of the Accounts page
 */
const UserProfileHeader: React.FC<UserProfileHeaderProps> = ({
  userId,
  email,
  displayName,
  discriminator,
  totalXP,
  serverLevel,
  isAuthenticated,
  onSignIn,
  onAvatarPress,
}) => {
  const { theme } = useTheme();

  // Unauthenticated state
  if (!isAuthenticated) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: theme.colors.background.secondary },
        ]}
      >
        <View style={styles.unauthContent}>
          <View style={styles.placeholderAvatar}>
            <Text style={[styles.placeholderText, { color: theme.colors.text.muted }]}>
              ?
            </Text>
          </View>
          <View style={styles.unauthTextSection}>
            <Text style={[styles.unauthTitle, { color: theme.colors.text.primary }]}>
              Sign in to track progress
            </Text>
            <Text style={[styles.unauthSubtitle, { color: theme.colors.text.muted }]}>
              Sync your notes, earn XP, and level up
            </Text>
          </View>
        </View>
        {onSignIn && (
          <Pressable
            onPress={onSignIn}
            style={[
              styles.signInButton,
              { backgroundColor: theme.colors.accent },
            ]}
          >
            <Text style={styles.signInButtonText}>Sign In</Text>
          </Pressable>
        )}
      </View>
    );
  }

  // Authenticated state
  const formattedName = discriminator
    ? `${displayName}#${String(discriminator).padStart(4, "0")}`
    : displayName;

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.colors.background.secondary },
      ]}
    >
      <View style={styles.profileRow}>
        {/* Avatar with Level Badge */}
        <Pressable
          onPress={onAvatarPress}
          style={styles.avatarContainer}
          disabled={!onAvatarPress}
        >
          <AvatarWithLevel
            userId={userId}
            displayName={displayName}
            size={64}
            overrideLevel={serverLevel}
            overrideTotalXP={totalXP}
          />
        </Pressable>

        {/* User Info */}
        <View style={styles.userInfoSection}>
          <Text
            style={[styles.displayName, { color: theme.colors.text.primary }]}
            numberOfLines={1}
          >
            {formattedName}
          </Text>
          <Text
            style={[styles.email, { color: theme.colors.text.muted }]}
            numberOfLines={1}
          >
            {email}
          </Text>
        </View>
      </View>

      {/* XP Progress */}
      <View style={styles.xpSection}>
        <XPProgressBar totalXP={totalXP} serverLevel={serverLevel} />
      </View>
    </View>
  );
};

export default UserProfileHeader;

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  avatarContainer: {
    position: "relative",
  },
  userInfoSection: {
    flex: 1,
  },
  displayName: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 2,
  },
  email: {
    fontSize: 13,
  },
  xpSection: {
    marginTop: 20,
  },
  // Unauthenticated state styles
  unauthContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  placeholderAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderText: {
    fontSize: 24,
    fontWeight: "600",
  },
  unauthTextSection: {
    flex: 1,
  },
  unauthTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  unauthSubtitle: {
    fontSize: 13,
  },
  signInButton: {
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  signInButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
});
