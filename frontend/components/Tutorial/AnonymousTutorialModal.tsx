/**
 * AnonymousTutorialModal - Tutorial for the "Anonymous" comment feature
 * Explains that posting anonymously hides your identity from other users
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
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { useTheme } from "@/contexts/ThemeContext";
import * as Haptics from "expo-haptics";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface AnonymousTutorialModalProps {
  visible: boolean;
  onDismiss: () => void;
}

export const AnonymousTutorialModal: React.FC<AnonymousTutorialModalProps> = ({
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
    muted: theme.colors.text.muted,
    border: theme.colors.border,
    cardBg:
      theme.mode === "dark"
        ? theme.colors.background.secondary
        : theme.mode === "sepia"
        ? "#FFF8DC"
        : "#f8fafc",
  };

  // Animation values
  const scaleAnim = useRef(new RNAnimated.Value(0.8)).current;
  const fadeAnim = useRef(new RNAnimated.Value(0)).current;

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
    } else {
      // Reset animations
      scaleAnim.setValue(0.8);
      fadeAnim.setValue(0);
    }
  }, [visible, scaleAnim, fadeAnim]);

  const handleDismiss = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onDismiss();
  }, [onDismiss]);

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
                  name="glasses-outline"
                  size={32}
                  color={colors.accent}
                />
              </View>
              <Text style={[styles.title, { color: colors.text }]}>
                Anonymous Comments
              </Text>
              <Text
                style={[styles.description, { color: colors.secondaryText }]}
              >
                Share your thoughts without revealing your identity
              </Text>
            </View>

            {/* Demo Area */}
            <View style={styles.demoContainer}>
              {/* Mock comment comparison */}
              <View
                style={[
                  styles.mockComment,
                  {
                    backgroundColor: colors.cardBg,
                    borderColor: colors.border,
                  },
                ]}
              >
                <View style={styles.commentHeader}>
                  <Ionicons
                    name="person-circle"
                    size={24}
                    color={colors.accent}
                  />
                  <Text style={[styles.commentAuthor, { color: colors.accent }]}>
                    Your Name
                  </Text>
                </View>
                <Text style={[styles.commentText, { color: colors.text }]}>
                  Normal comment shows your name
                </Text>
              </View>

              <View style={styles.arrowContainer}>
                <Ionicons
                  name="arrow-down"
                  size={20}
                  color={colors.muted}
                />
              </View>

              <View
                style={[
                  styles.mockComment,
                  {
                    backgroundColor: colors.cardBg,
                    borderColor: colors.accent,
                  },
                ]}
              >
                <View style={styles.commentHeader}>
                  <Ionicons
                    name="glasses-outline"
                    size={24}
                    color={colors.accent}
                  />
                  <Text style={[styles.commentAuthor, { color: colors.accent }]}>
                    Anonymous
                  </Text>
                </View>
                <Text style={[styles.commentText, { color: colors.text }]}>
                  Anonymous comment hides your identity
                </Text>
              </View>

              {/* Tip */}
              <View
                style={[
                  styles.tipContainer,
                  { backgroundColor: colors.accentLight },
                ]}
              >
                <Ionicons
                  name="information-circle"
                  size={16}
                  color={colors.accent}
                />
                <Text style={[styles.tipText, { color: colors.accent }]}>
                  Your identity is still tracked for moderation purposes
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
    gap: 12,
  },
  mockComment: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    gap: 8,
  },
  commentHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  commentAuthor: {
    fontSize: 14,
    fontWeight: "600",
  },
  commentText: {
    fontSize: 13,
    lineHeight: 18,
  },
  arrowContainer: {
    alignItems: "center",
    paddingVertical: 4,
  },
  tipContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    gap: 8,
    marginTop: 4,
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
