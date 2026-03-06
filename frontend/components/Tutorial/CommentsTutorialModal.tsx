/**
 * CommentsTutorialModal - Tutorial for Bible reference detection in comments
 * Demonstrates how typing a verse reference auto-detects and embeds it
 * Shows animated demo: typing comment → reference detected → verse embedded
 */

import React, { useEffect, useRef, useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  Dimensions,
  Animated as RNAnimated,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
  interpolateColor,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { useTheme } from "@/contexts/ThemeContext";
import * as Haptics from "expo-haptics";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// The full comment text to type
const FULL_COMMENT = "I think we can find more applicable ideas in John 3:16-17";
// The part before the reference (for splitting)
const TEXT_BEFORE_REF = "I think we can find more applicable ideas in ";

interface CommentsTutorialModalProps {
  visible: boolean;
  onDismiss: () => void;
}

export const CommentsTutorialModal: React.FC<CommentsTutorialModalProps> = ({
  visible,
  onDismiss,
}) => {
  const { theme } = useTheme();

  // Use theme colors with proper mapping
  const colors = {
    background: theme.colors.interactive.modal.background,
    text: theme.colors.text.primary,
    secondaryText: theme.colors.text.secondary,
    accent: theme.colors.accent,
    accentLight:
      theme.mode === "dark"
        ? "rgba(129, 140, 248, 0.15)"
        : theme.mode === "sepia"
        ? "rgba(139, 115, 85, 0.15)"
        : "rgba(99, 102, 241, 0.15)",
    highlight:
      theme.mode === "dark"
        ? "rgba(129, 140, 248, 0.25)"
        : theme.mode === "sepia"
        ? "rgba(139, 115, 85, 0.2)"
        : "rgba(99, 102, 241, 0.2)",
    inputBg:
      theme.mode === "dark"
        ? theme.colors.background.secondary
        : theme.mode === "sepia"
        ? "#FFF8DC"
        : "#f8fafc",
    border: theme.colors.border,
  };

  // Animation values
  const scaleAnim = useRef(new RNAnimated.Value(0.8)).current;
  const fadeAnim = useRef(new RNAnimated.Value(0)).current;

  // Typing animation state (driven by JS for character-by-character)
  const [displayedText, setDisplayedText] = useState("");
  const [animationPhase, setAnimationPhase] = useState<"typing" | "highlight" | "embed" | "hold" | "reset">("typing");
  const typingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const animationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reanimated values for smooth transitions
  const highlightOpacity = useSharedValue(0);
  const embedOpacity = useSharedValue(0);
  const embedScale = useSharedValue(0.9);
  const cursorOpacity = useSharedValue(1);

  // Cleanup function
  const cleanupAnimations = useCallback(() => {
    if (typingIntervalRef.current) {
      clearInterval(typingIntervalRef.current);
      typingIntervalRef.current = null;
    }
    if (animationTimeoutRef.current) {
      clearTimeout(animationTimeoutRef.current);
      animationTimeoutRef.current = null;
    }
  }, []);

  // Start typing animation
  const startTypingAnimation = useCallback(() => {
    cleanupAnimations();
    setDisplayedText("");
    setAnimationPhase("typing");
    highlightOpacity.value = 0;
    embedOpacity.value = 0;
    embedScale.value = 0.9;

    let charIndex = 0;
    const totalChars = FULL_COMMENT.length;

    // Typing interval - slightly faster for smoother feel
    typingIntervalRef.current = setInterval(() => {
      if (charIndex <= totalChars) {
        setDisplayedText(FULL_COMMENT.slice(0, charIndex));
        charIndex++;
      } else {
        // Typing complete
        cleanupAnimations();

        // Phase 2: Highlight the reference
        setAnimationPhase("highlight");
        highlightOpacity.value = withTiming(1, { duration: 400 });

        // Phase 3: Show embed after highlight
        animationTimeoutRef.current = setTimeout(() => {
          setAnimationPhase("embed");
          embedOpacity.value = withTiming(1, { duration: 300 });
          embedScale.value = withTiming(1, {
            duration: 300,
            easing: Easing.bezier(0.34, 1.56, 0.64, 1),
          });

          // Phase 4: Hold, then reset for loop
          animationTimeoutRef.current = setTimeout(() => {
            setAnimationPhase("hold");

            // Reset after hold
            animationTimeoutRef.current = setTimeout(() => {
              setAnimationPhase("reset");
              highlightOpacity.value = withTiming(0, { duration: 200 });
              embedOpacity.value = withTiming(0, { duration: 200 });
              embedScale.value = withTiming(0.9, { duration: 200 });

              // Restart loop
              animationTimeoutRef.current = setTimeout(() => {
                startTypingAnimation();
              }, 500);
            }, 2000);
          }, 1000);
        }, 600);
      }
    }, 45); // ~22 chars/sec typing speed
  }, [cleanupAnimations, highlightOpacity, embedOpacity, embedScale]);

  // Cursor blink animation
  useEffect(() => {
    if (visible) {
      cursorOpacity.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 400 }),
          withTiming(0, { duration: 400 })
        ),
        -1,
        true
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]); // SharedValues intentionally excluded per CLAUDE.md

  useEffect(() => {
    if (visible) {
      // Entry animations
      RNAnimated.parallel([
        RNAnimated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: false,
        }),
        RNAnimated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: false,
        }),
      ]).start();

      // Start the typing demonstration after modal opens
      const startDelay = setTimeout(() => {
        startTypingAnimation();
      }, 600);

      return () => {
        clearTimeout(startDelay);
        cleanupAnimations();
      };
    } else {
      // Reset animations
      scaleAnim.setValue(0.8);
      fadeAnim.setValue(0);
      setDisplayedText("");
      setAnimationPhase("typing");
      highlightOpacity.value = 0;
      embedOpacity.value = 0;
      embedScale.value = 0.9;
      cleanupAnimations();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, scaleAnim, fadeAnim, startTypingAnimation, cleanupAnimations]); // SharedValues intentionally excluded per CLAUDE.md

  const handleDismiss = useCallback(() => {
    cleanupAnimations();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onDismiss();
  }, [onDismiss, cleanupAnimations]);

  // Animated styles
  const highlightStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      highlightOpacity.value,
      [0, 1],
      ["transparent", colors.highlight]
    ),
  }));

  const embedStyle = useAnimatedStyle(() => ({
    opacity: embedOpacity.value,
    transform: [{ scale: embedScale.value }],
  }));

  const cursorStyle = useAnimatedStyle(() => ({
    opacity: animationPhase === "typing" ? cursorOpacity.value : 0,
  }));

  // Split displayed text into before-reference and reference parts
  const beforeRef = displayedText.length <= TEXT_BEFORE_REF.length
    ? displayedText
    : TEXT_BEFORE_REF;
  const refPart = displayedText.length > TEXT_BEFORE_REF.length
    ? displayedText.slice(TEXT_BEFORE_REF.length)
    : "";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
    >
      <View style={styles.modalOverlay}>
        <BlurView intensity={20} style={styles.blurContainer}>
          <RNAnimated.View
            style={[
              styles.contentContainer,
              {
                backgroundColor: colors.background,
                transform: [{ scale: scaleAnim }],
                opacity: fadeAnim,
              },
            ]}
          >
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.iconContainer}>
                <Ionicons
                  name="book"
                  size={32}
                  color={colors.accent}
                />
              </View>
              <Text style={[styles.title, { color: colors.text }]}>
                Reference Bible verses
              </Text>
              <Text
                style={[styles.description, { color: colors.secondaryText }]}
              >
                Type any verse reference and it will automatically be detected
                and displayed
              </Text>
            </View>

            {/* Animation Demo Area */}
            <View style={styles.demoContainer}>
              {/* Mock comment input */}
              <View
                style={[
                  styles.mockInput,
                  {
                    backgroundColor: colors.inputBg,
                    borderColor: colors.accent,
                  },
                ]}
              >
                <View style={styles.inputTextContainer}>
                  <Text style={[styles.inputText, { color: colors.text }]}>
                    {beforeRef}
                  </Text>
                  {/* Reference part with highlight */}
                  {refPart.length > 0 && (
                    <Animated.View style={[styles.highlightWrap, highlightStyle]}>
                      <Text style={[styles.inputText, styles.refText, { color: colors.accent }]}>
                        {refPart}
                      </Text>
                    </Animated.View>
                  )}
                  {/* Blinking cursor */}
                  <Animated.View style={[styles.cursor, { backgroundColor: colors.accent }, cursorStyle]} />
                </View>
              </View>

              {/* Embedded verse preview */}
              <Animated.View
                style={[
                  styles.embedPreview,
                  {
                    backgroundColor: colors.accentLight,
                    borderColor: colors.accent,
                  },
                  embedStyle,
                ]}
              >
                <View style={styles.embedHeader}>
                  <Ionicons
                    name="book-outline"
                    size={14}
                    color={colors.accent}
                  />
                  <Text style={[styles.embedReference, { color: colors.accent }]}>
                    John 3:16-17
                  </Text>
                </View>
                <Text
                  style={[styles.embedText, { color: colors.secondaryText }]}
                  numberOfLines={2}
                >
                  For God so loved the world that he gave his one and only Son, that whoever believes in him shall not perish...
                </Text>
              </Animated.View>

              {/* Instructional text */}
              <View
                style={[
                  styles.tipContainer,
                  { backgroundColor: colors.accentLight },
                ]}
              >
                <Ionicons
                  name="sparkles"
                  size={16}
                  color={colors.accent}
                />
                <Text style={[styles.tipText, { color: colors.accent }]}>
                  Verses are automatically embedded in your comment for others to see
                </Text>
              </View>
            </View>

            {/* Action Button */}
            <Pressable
              style={[styles.primaryButton, { backgroundColor: colors.accent }]}
              onPress={handleDismiss}
            >
              <Text style={styles.primaryButtonText}>Got it</Text>
            </Pressable>
          </RNAnimated.View>
        </BlurView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  blurContainer: {
    flex: 1,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  contentContainer: {
    width: Math.min(SCREEN_WIDTH * 0.9, 400),
    borderRadius: 24,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    alignItems: "center",
    marginBottom: 24,
  },
  iconContainer: {
    marginBottom: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
  },
  description: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  demoContainer: {
    marginBottom: 24,
    gap: 16,
  },
  mockInput: {
    borderRadius: 12,
    borderWidth: 2,
    padding: 14,
    minHeight: 56,
  },
  inputTextContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
  },
  inputText: {
    fontSize: 14,
    lineHeight: 22,
  },
  refText: {
    fontWeight: "500",
  },
  highlightWrap: {
    borderRadius: 4,
    paddingHorizontal: 2,
    marginHorizontal: -2,
  },
  cursor: {
    width: 2,
    height: 18,
    marginLeft: 1,
    borderRadius: 1,
  },
  embedPreview: {
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: "dashed",
    padding: 12,
  },
  embedHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  embedReference: {
    fontSize: 12,
    fontWeight: "600",
  },
  embedText: {
    fontSize: 13,
    lineHeight: 18,
  },
  tipContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    gap: 8,
  },
  tipText: {
    fontSize: 12,
    fontWeight: "500",
    flex: 1,
    lineHeight: 16,
  },
  primaryButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
});
