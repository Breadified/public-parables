/**
 * NotesTutorialModal - Tutorial for Bible Peek feature in notes
 * Demonstrates how typing a verse reference creates an embedded Bible view
 * Shows animated demo: typing note → reference detected → Bible Peek appears
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

// The full note text to type
const FULL_NOTE = "This reminds me of Romans 8:28";
// The part before the reference (for splitting)
const TEXT_BEFORE_REF = "This reminds me of ";

interface NotesTutorialModalProps {
  visible: boolean;
  onDismiss: () => void;
}

export const NotesTutorialModal: React.FC<NotesTutorialModalProps> = ({
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
    peekBg:
      theme.mode === "dark"
        ? "rgba(0, 0, 0, 0.3)"
        : theme.mode === "sepia"
        ? "rgba(139, 115, 85, 0.08)"
        : "rgba(0, 0, 0, 0.04)",
    border: theme.colors.border,
  };

  // Animation values
  const scaleAnim = useRef(new RNAnimated.Value(0.8)).current;
  const fadeAnim = useRef(new RNAnimated.Value(0)).current;

  // Typing animation state (driven by JS for character-by-character)
  const [displayedText, setDisplayedText] = useState("");
  const [animationPhase, setAnimationPhase] = useState<"typing" | "highlight" | "peek" | "hold" | "reset">("typing");
  const typingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const animationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reanimated values for smooth transitions
  const highlightOpacity = useSharedValue(0);
  const peekOpacity = useSharedValue(0);
  const peekScale = useSharedValue(0.95);
  const peekHeight = useSharedValue(0);
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
    peekOpacity.value = 0;
    peekScale.value = 0.95;
    peekHeight.value = 0;

    let charIndex = 0;
    const totalChars = FULL_NOTE.length;

    // Typing interval
    typingIntervalRef.current = setInterval(() => {
      if (charIndex <= totalChars) {
        setDisplayedText(FULL_NOTE.slice(0, charIndex));
        charIndex++;
      } else {
        // Typing complete
        cleanupAnimations();

        // Phase 2: Highlight the reference
        setAnimationPhase("highlight");
        highlightOpacity.value = withTiming(1, { duration: 400 });

        // Phase 3: Show Bible Peek after highlight
        animationTimeoutRef.current = setTimeout(() => {
          setAnimationPhase("peek");
          peekHeight.value = withTiming(100, { duration: 350 });
          peekOpacity.value = withTiming(1, { duration: 300 });
          peekScale.value = withTiming(1, {
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
              peekOpacity.value = withTiming(0, { duration: 200 });
              peekScale.value = withTiming(0.95, { duration: 200 });
              peekHeight.value = withTiming(0, { duration: 250 });

              // Restart loop
              animationTimeoutRef.current = setTimeout(() => {
                startTypingAnimation();
              }, 500);
            }, 2500);
          }, 1000);
        }, 600);
      }
    }, 50);
  }, [cleanupAnimations, highlightOpacity, peekOpacity, peekScale, peekHeight]);

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
      peekOpacity.value = 0;
      peekScale.value = 0.95;
      peekHeight.value = 0;
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

  const peekContainerStyle = useAnimatedStyle(() => ({
    opacity: peekOpacity.value,
    transform: [{ scale: peekScale.value }],
    maxHeight: peekHeight.value,
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
                  name="eye"
                  size={32}
                  color={colors.accent}
                />
              </View>
              <Text style={[styles.title, { color: colors.text }]}>
                Bible Peek
              </Text>
              <Text
                style={[styles.description, { color: colors.secondaryText }]}
              >
                Type any verse reference in your notes and a Bible view will
                appear automatically
              </Text>
            </View>

            {/* Animation Demo Area */}
            <View style={styles.demoContainer}>
              {/* Mock note editor */}
              <View
                style={[
                  styles.mockNoteEditor,
                  {
                    backgroundColor: colors.inputBg,
                    borderColor: colors.border,
                  },
                ]}
              >
                {/* Note header */}
                <View style={[styles.noteHeader, { borderBottomColor: colors.border }]}>
                  <Ionicons name="document-text-outline" size={14} color={colors.secondaryText} />
                  <Text style={[styles.noteHeaderText, { color: colors.secondaryText }]}>
                    Genesis 1:1
                  </Text>
                </View>

                {/* Note content with typing */}
                <View style={styles.noteContent}>
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

                {/* Bible Peek embed */}
                <Animated.View
                  style={[
                    styles.biblePeekContainer,
                    { backgroundColor: colors.peekBg },
                    peekContainerStyle,
                  ]}
                >
                  <View style={styles.peekHeader}>
                    <Ionicons name="book" size={12} color={colors.accent} />
                    <Text style={[styles.peekReference, { color: colors.accent }]}>
                      Romans 8:28
                    </Text>
                  </View>
                  <Text style={[styles.peekText, { color: colors.text }]} numberOfLines={2}>
                    And we know that in all things God works for the good of those who love him,
                    who have been called according to his purpose.
                  </Text>
                </Animated.View>
              </View>

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
                  References are detected and displayed inline with your notes
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
  mockNoteEditor: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  noteHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  noteHeaderText: {
    fontSize: 12,
    fontWeight: "500",
  },
  noteContent: {
    padding: 12,
    minHeight: 50,
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
  biblePeekContainer: {
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 8,
    padding: 10,
    overflow: "hidden",
  },
  peekHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  peekReference: {
    fontSize: 11,
    fontWeight: "600",
  },
  peekText: {
    fontSize: 12,
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
