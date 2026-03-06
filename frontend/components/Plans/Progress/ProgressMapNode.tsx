/**
 * ProgressMapNode - Individual animated node for vertical progress map
 * States: pending, current, complete
 * Features: Pressable for navigation, prominent glow/pulse on current node
 */

import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@/contexts/ThemeContext";
import CheckmarkIcon from "@/components/Shared/CheckmarkIcon";

export type NodeState = "pending" | "current" | "complete";

interface ProgressMapNodeProps {
  /** Current state of the node */
  state: NodeState;
  /** Size of the node */
  size?: number;
  /** Index for staggered animations */
  index?: number;
  /** Whether this node is pressable */
  isPressable?: boolean;
  /** Whether this is the start node (gold color) */
  isStartNode?: boolean;
  /** Whether this is the end node (trophy) */
  isEndNode?: boolean;
  /** Callback when node is pressed */
  onPress?: () => void;
}

const SPRING_CONFIG = { damping: 15, stiffness: 150, mass: 1 };

const ProgressMapNode = ({
  state,
  size = 12,
  index = 0,
  isPressable = false,
  isStartNode = false,
  isEndNode = false,
  onPress,
}: ProgressMapNodeProps) => {
  const { theme } = useTheme();
  const gamification = theme.colors.gamification;

  const scaleAnim = useRef(new Animated.Value(state === "complete" ? 1 : 0.8)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0.3)).current;
  const checkOpacity = useRef(new Animated.Value(state === "complete" ? 1 : 0)).current;

  // Larger sizes for start/end nodes
  const nodeSize = isStartNode || isEndNode ? size + 4 : size;
  const glowSize = nodeSize + 20; // Halo is larger than node

  // Get color based on state and node type
  const getNodeColor = () => {
    if (isStartNode) {
      return gamification.trophy; // Gold for start
    }
    if (isEndNode) {
      if (state === "complete") return gamification.nodeComplete;
      if (state === "current") return gamification.nodeCurrent;
      return gamification.trophy;
    }
    switch (state) {
      case "complete":
        return gamification.nodeComplete;
      case "current":
        return gamification.nodeCurrent;
      default:
        return gamification.nodePending;
    }
  };

  useEffect(() => {
    if (state === "complete") {
      // Scale-up spring animation for completion
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          ...SPRING_CONFIG,
          useNativeDriver: true,
        }),
        Animated.timing(checkOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
      pulseAnim.setValue(1);
      glowAnim.setValue(0);
    } else if (state === "current") {
      // Enhanced pulse for current node - more noticeable "click me" effect
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.3,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      );

      // Glow/halo animation - pulsing opacity
      const glowAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 0.7,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0.2,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );

      pulseAnimation.start();
      glowAnimation.start();

      scaleAnim.setValue(0.9);
      Animated.spring(scaleAnim, {
        toValue: 1,
        ...SPRING_CONFIG,
        useNativeDriver: true,
      }).start();

      return () => {
        pulseAnimation.stop();
        glowAnimation.stop();
      };
    } else {
      // Reset for pending state
      scaleAnim.setValue(0.8);
      checkOpacity.setValue(0);
      pulseAnim.setValue(1);
      glowAnim.setValue(0);
    }
  }, [state, scaleAnim, pulseAnim, glowAnim, checkOpacity]);

  const combinedScale = Animated.multiply(scaleAnim, pulseAnim);

  // Determine if node shows outline (pending) vs filled
  const isPending = state === "pending" && !isStartNode && !isEndNode;

  const nodeContent = (
    <View style={[styles.nodeContainer, { width: glowSize, height: glowSize }]}>
      {/* Halo/Glow effect for current node - centered behind the node */}
      {state === "current" && (
        <Animated.View
          style={[
            styles.halo,
            {
              width: glowSize,
              height: glowSize,
              borderRadius: glowSize / 2,
              backgroundColor: gamification.nodeCurrent,
              opacity: glowAnim,
            },
          ]}
        />
      )}

      {/* The actual node */}
      <Animated.View
        style={[
          styles.nodeWrapper,
          {
            transform: [{ scale: combinedScale }],
          },
        ]}
      >
        <View
          style={[
            styles.node,
            {
              width: nodeSize,
              height: nodeSize,
              borderRadius: nodeSize / 2,
              backgroundColor: isPending ? "transparent" : getNodeColor(),
              borderWidth: isPending ? 2 : 0,
              borderColor: isPending ? gamification.nodePending : undefined,
            },
            // Shadow glow for current node
            state === "current" && {
              shadowColor: gamification.nodeCurrent,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 1,
              shadowRadius: 10,
              elevation: 8,
            },
          ]}
        >
          {/* Checkmark for completed nodes */}
          {state === "complete" && !isStartNode && !isEndNode && (
            <Animated.View style={{ opacity: checkOpacity }}>
              <CheckmarkIcon
                size={nodeSize * 0.6}
                strokeWidth={2.5}
                color={theme.colors.text.inverse}
              />
            </Animated.View>
          )}
          {/* Checkmark for end node when complete */}
          {isEndNode && state === "complete" && (
            <CheckmarkIcon
              size={nodeSize * 0.6}
              strokeWidth={2.5}
              color={theme.colors.text.inverse}
            />
          )}
        </View>
      </Animated.View>
    </View>
  );

  // Wrap in Pressable if clickable
  if (isPressable && onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.pressable,
          pressed && styles.pressed,
        ]}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        {nodeContent}
      </Pressable>
    );
  }

  return nodeContent;
};

const styles = StyleSheet.create({
  nodeContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  halo: {
    position: "absolute",
  },
  nodeWrapper: {
    alignItems: "center",
    justifyContent: "center",
  },
  node: {
    alignItems: "center",
    justifyContent: "center",
  },
  pressable: {
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.7,
  },
});

export default ProgressMapNode;
