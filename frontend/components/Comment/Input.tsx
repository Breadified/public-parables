/**
 * Input - Unified comment input for both Devotion and Plan Sessions
 * Uses CommentContext for submission instead of direct service access
 *
 * Features:
 * - Self-manages expansion state (expands on focus, collapses on blur if empty)
 * - Character limit: 2000 characters
 * - Submits via context's onSubmitComment
 * - Animated height transition between collapsed and expanded states
 * - Anonymous toggle (when feature enabled)
 */

import React, { useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Keyboard,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, usePathname } from "expo-router";

import { useTheme } from "@/contexts/ThemeContext";
import { useUnifiedAuth } from "@/hooks/useUnifiedAuth";
import { useComments } from "@/contexts/CommentContext";
import { tutorialStore$ } from "@/state/tutorialStore";
import ToggleCheckbox from "./ToggleCheckbox";
import { HumansOnlyTutorialModal } from "@/components/Tutorial/HumansOnlyTutorialModal";
import { AnonymousTutorialModal } from "@/components/Tutorial/AnonymousTutorialModal";

interface InputProps {
  parentCommentId?: string;
  placeholder?: string;
  onSubmit?: () => void;
  autoFocus?: boolean;
  onInputFocus?: () => void;
  onHeightChange?: (height: number) => void;
}

const MAX_COMMENT_LENGTH = 2000;
const ANCHOR_HEIGHT = 48;
const EXPANDED_MIN_HEIGHT = 120; // Min height when expanded (input + footer)

const Input = ({
  parentCommentId,
  placeholder = "Share your thoughts...",
  onSubmit,
  autoFocus = false,
  onInputFocus,
  onHeightChange,
}: InputProps) => {
  const { theme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isOnline, setReturnUrl } = useUnifiedAuth();
  const inputRef = useRef<TextInput>(null);

  // Get submission function and features from context
  const { onSubmitComment, getCurrentUserId, features } = useComments();

  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAnonymous, setIsAnonymous] = useState(false);
  // Initialize from saved preference
  const [isHumansOnly, setIsHumansOnly] = useState(() => tutorialStore$.getDefaultHumansOnly());
  const [showHumansOnlyTutorial, setShowHumansOnlyTutorial] = useState(false);
  const [showAnonymousTutorial, setShowAnonymousTutorial] = useState(false);
  const hasShownHumansOnlyTutorialRef = useRef(false);
  const hasShownAnonymousTutorialRef = useRef(false);

  // Get current user from context
  const userId = getCurrentUserId();

  // Handle Anonymous toggle with tutorial trigger
  const handleAnonymousToggle = useCallback(() => {
    // Show tutorial on first toggle if not already shown
    if (!hasShownAnonymousTutorialRef.current && tutorialStore$.shouldShowAnonymousTutorial()) {
      setShowAnonymousTutorial(true);
      hasShownAnonymousTutorialRef.current = true;
    }
    setIsAnonymous(!isAnonymous);
  }, [isAnonymous]);

  // Handle Humans Only toggle with tutorial trigger
  const handleHumansOnlyToggle = useCallback(() => {
    // Show tutorial on first toggle if not already shown
    if (!hasShownHumansOnlyTutorialRef.current && tutorialStore$.shouldShowHumansOnlyTutorial()) {
      setShowHumansOnlyTutorial(true);
      hasShownHumansOnlyTutorialRef.current = true;
    }
    const newValue = !isHumansOnly;
    setIsHumansOnly(newValue);
    // Save as default preference
    tutorialStore$.setDefaultHumansOnly(newValue);
  }, [isHumansOnly]);

  // Handle tutorial dismissals
  const handleAnonymousTutorialDismiss = useCallback(() => {
    setShowAnonymousTutorial(false);
    tutorialStore$.completeAnonymousTutorial();
  }, []);

  const handleHumansOnlyTutorialDismiss = useCallback(() => {
    setShowHumansOnlyTutorial(false);
    tutorialStore$.completeHumansOnlyTutorial();
  }, []);

  // Determine if expanded (self-managed via internal focus state)
  const isExpanded = isFocused || content.length > 0;

  // Simple character count
  const charCount = content.length;
  const isOverLimit = charCount > MAX_COMMENT_LENGTH;
  const hasTextContent = content.trim().length > 0;
  const canSubmit = hasTextContent && !isOverLimit && !isSubmitting && !!userId;

  // Navigate to auth when user taps on "Sign in to comment"
  const handleSignInPress = useCallback(() => {
    if (!isAuthenticated && isOnline) {
      setReturnUrl(pathname);
      router.push("/auth/login");
    }
  }, [isAuthenticated, isOnline, pathname, setReturnUrl, router]);

  const handleFocus = () => {
    setIsFocused(true);
    setError(null);
    onInputFocus?.();
  };

  const handleBlur = () => {
    // Only collapse if no content entered
    if (content.trim().length === 0) {
      setIsFocused(false);
    }
  };

  const handleCancel = () => {
    setContent("");
    setIsFocused(false);
    setError(null);
    setIsAnonymous(false);
    setIsHumansOnly(false);
    inputRef.current?.blur();
    Keyboard.dismiss();
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;

    if (!userId) {
      setError("Please sign in to comment");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const processedText = content.trim();

      // Submit via context
      const success = await onSubmitComment(
        processedText,
        parentCommentId,
        features.enableAnonymousToggle ? isAnonymous : undefined,
        features.enableHumansOnlyToggle ? isHumansOnly : undefined
      );

      if (success) {
        // Clear input on success
        setContent("");
        setIsFocused(false);
        setIsAnonymous(false);
        setIsHumansOnly(false);
        inputRef.current?.blur();
        Keyboard.dismiss();
        onSubmit?.();
      } else {
        setError("Failed to post comment. Please try again.");
      }
    } catch (err) {
      console.error("[CommentInput] Failed to submit:", err);
      setError("Failed to post comment. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Track actual measured height and report to parent (for layouts that need it)
  // Add container margins (marginVertical: 8 on each side = 16 total)
  const handleContainerLayout = useCallback((event: any) => {
    const { height } = event.nativeEvent.layout;
    if (height > 0) {
      onHeightChange?.(height + 16);
    }
  }, [onHeightChange]);

  return (
    <View
      onLayout={handleContainerLayout}
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.background.secondary,
          borderColor: error
            ? "#EF4444"
            : isFocused
            ? theme.colors.accent
            : theme.colors.border,
          minHeight: isExpanded ? EXPANDED_MIN_HEIGHT : ANCHOR_HEIGHT,
        },
      ]}
    >
      {/* Show sign-in prompt when not authenticated, otherwise show TextInput */}
      {!userId ? (
        <Pressable
          onPress={handleSignInPress}
          style={[styles.inputWrapper, styles.inputAnchor, styles.signInPrompt]}
        >
          <Text style={[styles.signInPromptText, { color: theme.colors.text.muted }]}>
            Sign in to comment
          </Text>
        </Pressable>
      ) : (
        <TextInput
          ref={inputRef}
          style={[
            styles.input,
            styles.inputWrapper,
            { color: theme.colors.text.primary },
            isExpanded ? styles.inputExpanded : styles.inputAnchor,
          ]}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.text.muted}
          value={content}
          onChangeText={(text) => {
            setContent(text);
            setError(null);
          }}
          onFocus={handleFocus}
          onBlur={handleBlur}
          multiline
          maxLength={MAX_COMMENT_LENGTH + 100}
          textAlignVertical="top"
          autoFocus={autoFocus}
        />
      )}

      {/* Footer - only visible when expanded */}
      {isExpanded && (
        <View style={styles.footer}>
          <View style={styles.footerLeft}>
            {/* Cancel Button (X icon) */}
            <Pressable
              onPress={handleCancel}
              style={[
                styles.cancelButton,
                { borderColor: theme.colors.border },
              ]}
            >
              <Ionicons
                name="close"
                size={24}
                color={theme.colors.text.muted}
              />
            </Pressable>

            {/* Anonymous Toggle (sunglasses icon) */}
            {features.enableAnonymousToggle && (
              <ToggleCheckbox
                icon="glasses-outline"
                checked={isAnonymous}
                onToggle={handleAnonymousToggle}
              />
            )}

            {/* Humans Only Toggle (person icon) */}
            {features.enableHumansOnlyToggle && (
              <ToggleCheckbox
                icon="person-outline"
                checked={isHumansOnly}
                onToggle={handleHumansOnlyToggle}
              />
            )}
          </View>

          <View style={styles.footerRight}>
            {/* Error message */}
            {error && (
              <Text style={styles.errorText} numberOfLines={1}>
                {error}
              </Text>
            )}

            {/* Character count */}
            {charCount > 0 && !error && (
              <Text
                style={[
                  styles.charCount,
                  {
                    color: isOverLimit
                      ? "#EF4444"
                      : charCount > MAX_COMMENT_LENGTH * 0.8
                      ? "#F59E0B"
                      : theme.colors.text.muted,
                  },
                ]}
              >
                {charCount}/{MAX_COMMENT_LENGTH}
              </Text>
            )}

            {/* Submit button */}
            <Pressable
              onPress={handleSubmit}
              disabled={!canSubmit}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={[
                styles.submitButton,
                {
                  backgroundColor: canSubmit
                    ? theme.colors.accent
                    : theme.colors.background.secondary,
                  borderColor: canSubmit
                    ? theme.colors.accent
                    : theme.colors.border,
                },
              ]}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons
                  name="send"
                  size={14}
                  color={canSubmit ? "#FFFFFF" : theme.colors.text.muted}
                />
              )}
            </Pressable>
          </View>
        </View>
      )}

      {/* Tutorial Modals */}
      <AnonymousTutorialModal
        visible={showAnonymousTutorial}
        onDismiss={handleAnonymousTutorialDismiss}
      />
      <HumansOnlyTutorialModal
        visible={showHumansOnlyTutorial}
        onDismiss={handleHumansOnlyTutorialDismiss}
      />
    </View>
  );
};

export default Input;

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 12,
    marginVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  inputWrapper: {
    paddingHorizontal: 12,
  },
  input: {
    fontSize: 14,
    lineHeight: 20,
  },
  inputAnchor: {
    paddingVertical: 12,
  },
  inputExpanded: {
    minHeight: 80,
    paddingTop: 12,
    paddingBottom: 8,
  },
  signInPrompt: {
    justifyContent: "center",
  },
  signInPromptText: {
    fontSize: 14,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingBottom: 8,
    gap: 12,
  },
  footerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  cancelButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
  },
  footerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  charCount: {
    fontSize: 11,
  },
  errorText: {
    fontSize: 11,
    color: "#EF4444",
    maxWidth: 150,
  },
  submitButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
});
