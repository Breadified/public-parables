/**
 * DelightfulToast - Animated toast notifications with personality
 * Shows brief, delightful messages that enhance user experience
 */

import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
  TouchableOpacity,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/contexts/ThemeContext";

const { width: screenWidth } = Dimensions.get("window");

export interface ToastConfig {
  message: string;
  emoji?: string;
  subtitle?: string;
  duration?: number;
  position?: "top" | "bottom" | "center";
  type?: "success" | "info" | "warning" | "celebration";
  actionLabel?: string;        // Action button label ("Undo")
  onAction?: () => void;        // Action button callback
}

interface DelightfulToastProps {
  config: ToastConfig | null;
  onHide?: () => void;
}

export const DelightfulToast: React.FC<DelightfulToastProps> = ({
  config,
  onHide,
}) => {
  console.log('[DelightfulToast] Component render, config:', config);

  const { themeMode, theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);

  console.log('[DelightfulToast] State - visible:', visible);

  // Animation values
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.8)).current;
  const rotation = useRef(new Animated.Value(0)).current;
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    console.log('[DelightfulToast] useEffect triggered, config:', config, 'visible:', visible);

    if (config) {
      console.log('[DelightfulToast] Config exists, setting visible to true and showing toast');
      setVisible(true);
      showToast();
    } else if (visible) {
      console.log('[DelightfulToast] No config but visible, hiding toast');
      hideToast();
    }
  }, [config]);

  const showToast = () => {
    const duration = config?.duration || 2500;
    const isCelebration = config?.type === "celebration";

    // Reset animations
    translateY.setValue(config?.position === "bottom" ? 100 : -100);
    opacity.setValue(0);
    scale.setValue(0.8);
    rotation.setValue(0);

    // Entry animations
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        tension: 50,
        friction: 8,
        useNativeDriver: false,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: false,
      }),
      Animated.spring(scale, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: false,
      }),
    ]).start();

    // Special celebration animation
    if (isCelebration) {
      Animated.sequence([
        Animated.timing(rotation, {
          toValue: 1,
          duration: 200,
          useNativeDriver: false,
        }),
        Animated.timing(rotation, {
          toValue: -1,
          duration: 200,
          useNativeDriver: false,
        }),
        Animated.timing(rotation, {
          toValue: 0,
          duration: 200,
          useNativeDriver: false,
        }),
      ]).start();
    }

    // Shimmer effect for success
    if (config?.type === "success") {
      Animated.loop(
        Animated.sequence([
          Animated.timing(shimmer, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: false,
          }),
          Animated.timing(shimmer, {
            toValue: 0,
            duration: 1000,
            useNativeDriver: false,
          }),
        ])
      ).start();
    }

    // Auto-hide after duration
    setTimeout(() => {
      hideToast();
    }, duration);
  };

  const hideToast = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: config?.position === "bottom" ? 100 : -100,
        duration: 300,
        useNativeDriver: false,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: false,
      }),
      Animated.timing(scale, {
        toValue: 0.8,
        duration: 300,
        useNativeDriver: false,
      }),
    ]).start(() => {
      setVisible(false);
      onHide?.();
    });
  };

  console.log('[DelightfulToast] Render check - visible:', visible, 'config:', !!config);

  if (!visible || !config) {
    console.log('[DelightfulToast] Returning null - visible:', visible, 'config:', !!config);
    return null;
  }

  console.log('[DelightfulToast] Rendering toast UI');

  // Use theme colors directly - type-specific border/particle colors for visual distinction
  const typeColors = getTypeColors(config.type, themeMode === "dark");
  const colors = {
    background: theme.colors.background.elevated,
    text: theme.colors.text.primary,
    subtext: theme.colors.text.muted,
    border: typeColors.border || theme.colors.border,
    shimmer: theme.colors.background.secondary,
    particle: typeColors.particle || theme.colors.accent,
    action: theme.colors.accent,
  };

  const rotationDeg = rotation.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ["-5deg", "0deg", "5deg"],
  });

  const shimmerOpacity = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.3],
  });

  const getPositionStyle = (): any => {
    switch (config.position) {
      case "bottom":
        return { bottom: insets.bottom + 100 };
      case "center":
        return { top: "50%", marginTop: -50 };
      default:
        return { top: insets.top + 60 };
    }
  };

  return (
    <Animated.View
      style={[
        styles.container,
        getPositionStyle(),
        {
          opacity,
          transform: [
            { translateY },
            { scale },
            { rotate: rotationDeg },
          ],
        },
      ]}
      pointerEvents={config.onAction ? "auto" : "none"}
    >
      <View
        style={[
          styles.toast,
          {
            backgroundColor: colors.background,
            borderColor: colors.border,
          },
        ]}
      >
        {/* Shimmer overlay for success */}
        {config.type === "success" && (
          <Animated.View
            style={[
              styles.shimmer,
              {
                backgroundColor: colors.shimmer,
                opacity: shimmerOpacity,
              },
            ]}
          />
        )}

        {/* Content */}
        <View style={styles.content}>
          {config.emoji && (
            <Animated.Text
              style={[
                styles.emoji,
                config.type === "celebration" && {
                  transform: [
                    {
                      scale: scale.interpolate({
                        inputRange: [0.8, 1],
                        outputRange: [1, 1.2],
                      }),
                    },
                  ],
                },
              ]}
            >
              {config.emoji}
            </Animated.Text>
          )}
          
          <View style={styles.textContainer}>
            <Text style={[styles.message, { color: colors.text }]}>
              {config.message}
            </Text>
            {config.subtitle && (
              <Text style={[styles.subtitle, { color: colors.subtext }]}>
                {config.subtitle}
              </Text>
            )}
          </View>

          {/* Action button (Undo) */}
          {config.onAction && config.actionLabel && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={config.onAction}
              activeOpacity={0.7}
            >
              <Text style={[styles.actionLabel, { color: colors.action }]}>
                {config.actionLabel}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Celebration particles */}
        {config.type === "celebration" && (
          <View style={styles.particlesContainer}>
            {[...Array(6)].map((_, i) => (
              <Animated.View
                key={i}
                style={[
                  styles.particle,
                  {
                    backgroundColor: colors.particle,
                    opacity: opacity.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 0.8],
                    }),
                    transform: [
                      {
                        translateX: scale.interpolate({
                          inputRange: [0.8, 1],
                          outputRange: [0, (i - 2.5) * 20],
                        }),
                      },
                      {
                        translateY: scale.interpolate({
                          inputRange: [0.8, 1],
                          outputRange: [0, Math.sin(i) * 15],
                        }),
                      },
                    ],
                  },
                ]}
              />
            ))}
          </View>
        )}
      </View>
    </Animated.View>
  );
};

// Type-specific border/particle colors for visual distinction
const getTypeColors = (type?: string, isDark?: boolean): { border?: string; particle?: string } => {
  switch (type) {
    case "success":
      return { border: isDark ? "#10b981" : "#34d399", particle: "#10b981" };
    case "warning":
      return { border: isDark ? "#f59e0b" : "#fbbf24", particle: "#f59e0b" };
    case "celebration":
      return { border: isDark ? "#8b5cf6" : "#a78bfa", particle: "#8b5cf6" };
    default:
      return {};
  }
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 9999,
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    maxWidth: Math.min(screenWidth * 0.9, 400),
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  emoji: {
    fontSize: 28,
  },
  textContainer: {
    flex: 1,
  },
  message: {
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 20,
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
    lineHeight: 18,
  },
  actionButton: {
    marginLeft: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "rgba(59, 130, 246, 0.1)",
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  shimmer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 16,
  },
  particlesContainer: {
    position: "absolute",
    top: "50%",
    left: "50%",
  },
  particle: {
    position: "absolute",
    width: 4,
    height: 4,
    borderRadius: 2,
  },
});