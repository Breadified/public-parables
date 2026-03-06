/**
 * SwipeTutorialModal - Professional tutorial for tab swipe gestures
 * Demonstrates the side swipe navigation with realistic animation
 */

import React, { useEffect, useRef, useCallback } from "react";
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
  withSequence,
  withDelay,
  withRepeat,
  Easing,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { useTheme } from "@/contexts/ThemeContext";
import * as Haptics from "expo-haptics";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface SwipeTutorialModalProps {
  visible: boolean;
  onDismiss: () => void;
}

export const SwipeTutorialModal: React.FC<SwipeTutorialModalProps> = ({
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
    accentLight: theme.mode === "dark"
      ? "rgba(129, 140, 248, 0.1)"
      : theme.mode === "sepia"
      ? "rgba(139, 115, 85, 0.1)"
      : "rgba(99, 102, 241, 0.1)",
    card1: theme.mode === "dark"
      ? theme.colors.background.secondary
      : theme.mode === "sepia"
      ? "#F5F5DC"
      : "#f0f9ff",
    card2: theme.mode === "dark"
      ? theme.colors.background.elevated
      : theme.mode === "sepia"
      ? "#FFF8DC"
      : "#fef3c7",
    border: theme.colors.border,
  };

  // Animation values
  const scaleAnim = useRef(new RNAnimated.Value(0.8)).current;
  const fadeAnim = useRef(new RNAnimated.Value(0)).current;

  // Swipe animation values - matches BibleSwipeableViewer exactly
  const translateX = useSharedValue(0);
  const handOpacity = useSharedValue(0);
  const handScale = useSharedValue(0.8);
  const handTranslateX = useSharedValue(0); // Hand position independent of cards

  const startSwipeAnimation = useCallback(() => {
    "worklet";
    // Looping animation sequence that demonstrates the swipe gesture
    // Shows only 1 tab at a time, just like real behavior
    const cardWidth = SCREEN_WIDTH * 0.5; // Cards are 50% of screen width
    const gap = 40; // Larger gap between cards for better visual separation
    const handSwipeDistance = (cardWidth + gap) / 2; // Hand moves half the distance of cards

    translateX.value = withDelay(
      500,
      withRepeat(
        withSequence(
          // Start: Current tab is visible (container offset to show right card)
          withTiming(-(cardWidth + gap), { duration: 0 }),

          // Hand appears EARLY before the swipe starts
          withTiming(-(cardWidth + gap), { duration: 0 }, () => {
            "worklet";
            handOpacity.value = withTiming(1, { duration: 300 });
            handScale.value = withTiming(1, { duration: 300 });
            handTranslateX.value = -handSwipeDistance * 0.6; // Start slightly left of center (60% of full distance)
          }),

          // Wait 600ms so user can see the hand before swipe starts
          withDelay(600, withTiming(-(cardWidth + gap), { duration: 0 })),

          // FIRST GESTURE: Swipe RIGHT to reveal previous tab
          // Hand starts moving FIRST
          withTiming(-(cardWidth + gap), { duration: 0 }, () => {
            "worklet";
            // Animate hand to move with swipe - starts immediately
            handTranslateX.value = withTiming(handSwipeDistance * 0.6, {
              duration: 600,
              easing: Easing.bezier(0.25, 0.1, 0.25, 1)
            });
            // Shrink during swipe
            handScale.value = withTiming(0.9, { duration: 600 });
          }),
          // Container swipes right - DELAYED to follow hand
          withDelay(
            150, // 150ms delay so hand moves first
            withTiming(
              0, // Move to show left card (Previous Tab)
              {
                duration: 600,
                easing: Easing.bezier(0.25, 0.1, 0.25, 1),
              }
            )
          ),

          // Hold on previous tab - hand stays visible
          withDelay(600, withTiming(0, { duration: 0 })),

          // SECOND GESTURE: Swipe LEFT from previous tab back to current tab
          // Hand resets for second gesture
          withTiming(0, { duration: 0 }, () => {
            "worklet";
            // Reset hand scale and start swipe animation
            handScale.value = withTiming(1, { duration: 200 });
            // Animate hand from right to left during swipe - hand moves FIRST
            handTranslateX.value = withSequence(
              withTiming(handSwipeDistance * 0.6, { duration: 0 }), // Start at right position (60% of full distance)
              withDelay(200, withTiming(-handSwipeDistance * 0.6, { duration: 600, easing: Easing.bezier(0.25, 0.1, 0.25, 1) })) // Swipe left (60% of full distance)
            );
            // Animate scale during swipe
            handScale.value = withSequence(
              withTiming(1, { duration: 200 }), // Full scale
              withDelay(200, withTiming(0.9, { duration: 600 })) // Shrink during swipe
            );
          }),
          // Container swipes left - DELAYED to follow hand (200ms wait + 150ms delay)
          withDelay(350, withTiming(
            -(cardWidth + gap), // Move back to show right card (Current Tab)
            {
              duration: 600,
              easing: Easing.bezier(0.25, 0.1, 0.25, 1),
            }
          )),

          // Hold on current tab, then hide hand
          withDelay(400, withTiming(-(cardWidth + gap), { duration: 0 }, () => {
            "worklet";
            handOpacity.value = withTiming(0, { duration: 200 });
          })),

          // Pause before loop repeats
          withDelay(800, withTiming(-(cardWidth + gap), { duration: 0 })),
        ),
        -1, // Infinite loop
        false
      )
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // SharedValues intentionally excluded per CLAUDE.md

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

      // Start the looping swipe demonstration after a brief delay
      startSwipeAnimation();
    } else {
      // Reset animations
      scaleAnim.setValue(0.8);
      fadeAnim.setValue(0);
      translateX.value = -(SCREEN_WIDTH * 0.5 + 40); // Reset to show current tab (cardWidth + gap)
      handOpacity.value = 0;
      handTranslateX.value = 0;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, scaleAnim, fadeAnim, startSwipeAnimation]); // SharedValues intentionally excluded per CLAUDE.md

  const handleDismiss = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onDismiss();
  }, [onDismiss]);

  // Animated styles for the cards
  // Cards are positioned side-by-side, container translateX reveals different tabs
  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const leftCardStyle = useAnimatedStyle(() => ({
    opacity: 1, // Always fully opaque when visible
  }));

  const rightCardStyle = useAnimatedStyle(() => ({
    opacity: 1, // Always fully opaque when visible
  }));

  const handStyle = useAnimatedStyle(() => ({
    opacity: handOpacity.value,
    transform: [
      { scale: handScale.value },
      { translateX: handTranslateX.value }, // Hand moves with the gesture
    ],
  }));

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
                <Ionicons name="swap-horizontal" size={32} color={colors.accent} />
              </View>
              <Text style={[styles.title, { color: colors.text }]}>
                Swipe between tabs
              </Text>
              <Text style={[styles.description, { color: colors.secondaryText }]}>
                Quickly navigate your open Bible tabs with a simple swipe
              </Text>
            </View>

            {/* Animation Demo Area */}
            <View style={styles.demoContainer}>
              <View style={styles.demoViewport}>
                {/* Swipeable cards container */}
                <Animated.View style={[styles.cardsContainer, containerStyle]}>
                  {/* Left card (hidden by default, revealed on swipe right) */}
                  <Animated.View
                    style={[
                      styles.demoCard,
                      styles.leftCard,
                      {
                        backgroundColor: colors.card1,
                        borderColor: colors.border,
                      },
                      leftCardStyle,
                    ]}
                  >
                    <View style={styles.cardHeader}>
                      <Ionicons name="book" size={16} color={colors.accent} />
                      <Text style={[styles.cardTitle, { color: colors.text }]}>
                        Previous Tab
                      </Text>
                    </View>
                    <View style={styles.cardContent}>
                      <View style={[styles.cardLine, { backgroundColor: colors.border }]} />
                      <View style={[styles.cardLine, { backgroundColor: colors.border, width: '90%' }]} />
                      <View style={[styles.cardLine, { backgroundColor: colors.border, width: '95%' }]} />
                    </View>
                  </Animated.View>

                  {/* Center card (current tab) */}
                  <Animated.View
                    style={[
                      styles.demoCard,
                      styles.centerCard,
                      {
                        backgroundColor: colors.card2,
                        borderColor: colors.border,
                      },
                      rightCardStyle,
                    ]}
                  >
                    <View style={styles.cardHeader}>
                      <Ionicons name="book-outline" size={16} color={colors.accent} />
                      <Text style={[styles.cardTitle, { color: colors.text }]}>
                        Current Tab
                      </Text>
                    </View>
                    <View style={styles.cardContent}>
                      <View style={[styles.cardLine, { backgroundColor: colors.border }]} />
                      <View style={[styles.cardLine, { backgroundColor: colors.border, width: '85%' }]} />
                      <View style={[styles.cardLine, { backgroundColor: colors.border, width: '92%' }]} />
                    </View>
                  </Animated.View>
                </Animated.View>

                {/* Animated hand indicator - fist during swipe */}
                <Animated.View style={[styles.handIndicator, handStyle]}>
                  <Ionicons name="hand-left-outline" size={32} color={colors.accent} />
                </Animated.View>
              </View>

              {/* Instructional text */}
              <View style={[styles.tipContainer, { backgroundColor: colors.accentLight }]}>
                <Ionicons name="information-circle" size={16} color={colors.accent} />
                <Text style={[styles.tipText, { color: colors.accent }]}>
                  Swipe left or right to switch between your open tabs
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
    fontSize: 24,
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
  },
  demoViewport: {
    height: 180,
    overflow: "hidden",
    borderRadius: 16,
    marginBottom: 16,
    position: "relative",
    width: SCREEN_WIDTH * 0.7, // Viewport is 70% of screen
    alignSelf: "center",
  },
  cardsContainer: {
    flexDirection: "row",
    position: "absolute",
    left: SCREEN_WIDTH * 0.1, // Offset to center cards in viewport (70% viewport - 50% card = 20% / 2 = 10%)
    top: 0,
    bottom: 0,
    width: SCREEN_WIDTH * 1.5, // Wide enough for both cards + gap
    gap: 40, // Larger gap between cards for better visual separation
  },
  demoCard: {
    width: SCREEN_WIDTH * 0.5, // Cards are 50% of screen width
    height: "100%",
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 16,
    // No shadow - clean look
  },
  leftCard: {
    marginRight: 0,
  },
  centerCard: {
    marginLeft: 0,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 8,
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: "600",
  },
  cardContent: {
    gap: 8,
  },
  cardLine: {
    height: 8,
    borderRadius: 4,
    width: "100%",
  },
  handIndicator: {
    position: "absolute",
    bottom: 20,
    left: "50%",
    marginLeft: -16,
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
