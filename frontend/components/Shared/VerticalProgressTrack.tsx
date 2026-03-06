/**
 * VerticalProgressTrack - Configurable vertical progress tracker
 * Reusable component for showing progress through content sections
 *
 * Used by:
 * - Plan readings (ProgressMap)
 * - Devotion verse sections (DevotionProgressMap)
 *
 * Features:
 * - Configurable node sizes, colors, and positions
 * - Start node, content nodes, completion node
 * - Animated tracker with sonar rings
 * - Progress fill that follows max scroll position
 */

import React, { useMemo, useEffect, useRef, useState } from "react";
import { View, StyleSheet, Pressable, Animated, LayoutChangeEvent } from "react-native";

import { useTheme } from "@/contexts/ThemeContext";
import CheckmarkIcon from "@/components/Shared/CheckmarkIcon";

export interface VerticalProgressTrackConfig {
  /** Container width (default: 32) */
  width?: number;
  /** Content node size (default: 16) */
  nodeSize?: number;
  /** Start node size (default: 16) */
  startNodeSize?: number;
  /** Tracker dot size (default: 10) */
  trackerSize?: number;
  /** Sonar ring base size (default: 10) */
  ringSize?: number;
  /** Sonar ring max scale (default: 3) */
  ringMaxScale?: number;
  /** Track padding from edges (default: 8) */
  trackPadding?: number;
  /** Track line width (default: 3) */
  trackWidth?: number;
  /** Whether to show checkmarks in completed nodes (default: true) */
  showCheckmarks?: boolean;
}

export interface VerticalProgressTrackProps {
  /** Number of content sections (nodes between start and end) */
  totalSections: number;
  /** Section identifiers for keys and reset detection */
  sectionIds: string[];
  /** Optional custom positions for each section (0-1), defaults to even distribution */
  sectionPositions?: number[];
  /** Whether all sections are complete (fills entire track) */
  isComplete?: boolean;
  /** Current scroll progress (0-1) */
  progress?: number;
  /** Callback when a node is pressed. Index: -1=start, 0-n=sections, n+1=end */
  onNodePress?: (index: number) => void;
  /** Visual configuration options */
  config?: VerticalProgressTrackConfig;
}

const DEFAULT_CONFIG: Required<VerticalProgressTrackConfig> = {
  width: 32,
  nodeSize: 16,
  startNodeSize: 16,
  trackerSize: 10,
  ringSize: 10,
  ringMaxScale: 3,
  trackPadding: 8,
  trackWidth: 3,
  showCheckmarks: true,
};

type NodeState = "pending" | "complete";

const VerticalProgressTrack: React.FC<VerticalProgressTrackProps> = ({
  totalSections,
  sectionIds,
  sectionPositions,
  isComplete = false,
  progress = 0,
  onNodePress,
  config: configOverrides,
}) => {
  const { theme } = useTheme();
  const gamification = theme.colors.gamification;

  // Merge config with defaults
  const config = useMemo(
    () => ({ ...DEFAULT_CONFIG, ...configOverrides }),
    [configOverrides]
  );

  const {
    width,
    nodeSize,
    startNodeSize,
    trackerSize,
    ringSize,
    ringMaxScale,
    trackPadding,
    trackWidth,
    showCheckmarks,
  } = config;

  // Track container height for positioning
  const [trackHeight, setTrackHeight] = useState(0);

  // Track max progress (never decreases within same content)
  const [maxProgress, setMaxProgress] = useState(0);

  // Update max progress
  useEffect(() => {
    if (progress > maxProgress) {
      setMaxProgress(progress);
    }
  }, [progress, maxProgress]);

  // Reset max progress when sections change (new content)
  useEffect(() => {
    setMaxProgress(0);
  }, [sectionIds.join(",")]);

  // Sonar ring animations
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const ring3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const createRing = (anim: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 1,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      );
    };

    const anim1 = createRing(ring1, 0);
    const anim2 = createRing(ring2, 400);
    const anim3 = createRing(ring3, 800);

    anim1.start();
    anim2.start();
    anim3.start();

    return () => {
      anim1.stop();
      anim2.stop();
      anim3.stop();
    };
  }, [ring1, ring2, ring3]);

  // Calculate node positions in pixels
  const nodePixelPositions = useMemo(() => {
    if (trackHeight === 0 || totalSections === 0) return [];

    const startCenter = trackPadding + startNodeSize / 2;
    const endCenter = trackHeight - trackPadding - nodeSize / 2;
    const usableHeight = endCenter - startCenter;

    const positions: number[] = [startCenter]; // Start node

    // Section nodes
    if (sectionPositions && sectionPositions.length === totalSections) {
      // Use custom positions
      sectionPositions.forEach((pos) => {
        positions.push(startCenter + pos * usableHeight);
      });
    } else {
      // Even distribution
      for (let i = 0; i < totalSections; i++) {
        const pos = (i + 1) / (totalSections + 1);
        positions.push(startCenter + pos * usableHeight);
      }
    }

    positions.push(endCenter); // End node

    return positions;
  }, [trackHeight, totalSections, sectionPositions, trackPadding, startNodeSize, nodeSize]);

  // Calculate node states based on tracker position
  const nodeStates = useMemo(() => {
    if (nodePixelPositions.length === 0) return [];

    if (isComplete) {
      return Array(totalSections + 1).fill("complete") as NodeState[];
    }

    const states: NodeState[] = [];
    const startCenter = nodePixelPositions[0];
    const endCenter = nodePixelPositions[nodePixelPositions.length - 1];
    const travelDistance = endCenter - startCenter;

    const trackerPos =
      travelDistance > 0 ? startCenter + maxProgress * travelDistance : startCenter;
    const completionBuffer = nodeSize / 2;

    // States for section nodes + end node
    for (let i = 0; i < totalSections + 1; i++) {
      const nodePos = nodePixelPositions[i + 1];
      states.push(trackerPos >= nodePos - completionBuffer ? "complete" : "pending");
    }

    return states;
  }, [nodePixelPositions, maxProgress, totalSections, isComplete, nodeSize]);

  // Tracker position in pixels
  const trackerTop = useMemo(() => {
    if (trackHeight === 0 || nodePixelPositions.length === 0) return 0;

    const startCenter = nodePixelPositions[0];
    const endCenter = nodePixelPositions[nodePixelPositions.length - 1];
    const travelDistance = endCenter - startCenter;

    const clamped = Math.min(1, Math.max(0, progress));
    return startCenter + clamped * travelDistance - trackerSize / 2;
  }, [trackHeight, nodePixelPositions, progress, trackerSize]);

  // Fill height (uses maxProgress)
  const fillHeight = useMemo(() => {
    if (trackHeight === 0 || nodePixelPositions.length === 0) return 0;

    const startCenter = nodePixelPositions[0];
    const endCenter = nodePixelPositions[nodePixelPositions.length - 1];
    const travelDistance = endCenter - startCenter;

    if (isComplete) return travelDistance;

    const clamped = Math.min(1, Math.max(0, maxProgress));
    return clamped * travelDistance;
  }, [trackHeight, nodePixelPositions, maxProgress, isComplete]);

  const handleLayout = (event: LayoutChangeEvent) => {
    setTrackHeight(event.nativeEvent.layout.height);
  };

  const getNodeColor = (state: NodeState, isStart = false, isEnd = false) => {
    if (isStart) return gamification.trophy;
    if (isEnd) {
      return state === "complete" ? gamification.nodeComplete : gamification.trophy;
    }
    return state === "complete" ? gamification.nodeComplete : gamification.nodePending;
  };

  // Render a node
  const renderNode = (
    state: NodeState,
    index: number,
    topPosition: number,
    isStart = false,
    isEnd = false
  ) => {
    const size = isStart ? startNodeSize : nodeSize;
    const color = getNodeColor(state, isStart, isEnd);
    const isPending = state === "pending" && !isStart;
    const canPress = !!onNodePress;
    const pressIndex = isStart ? -1 : isEnd ? totalSections : index;

    const nodeElement = (
      <View
        style={[
          styles.node,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: isPending ? theme.colors.background.primary : color,
            borderWidth: isPending ? 2 : 0,
            borderColor: isPending ? gamification.nodePending : undefined,
          },
        ]}
      >
        {showCheckmarks && state === "complete" && !isStart && (
          <CheckmarkIcon
            size={size * 0.6}
            strokeWidth={2.5}
            color={theme.colors.text.inverse}
          />
        )}
      </View>
    );

    const containerStyle = [styles.nodeAbsolute, { top: topPosition - size / 2 }];

    if (canPress) {
      return (
        <Pressable
          key={`node-${index}`}
          style={containerStyle}
          onPress={() => onNodePress?.(pressIndex)}
          hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
        >
          {nodeElement}
        </Pressable>
      );
    }

    return (
      <View key={`node-${index}`} style={containerStyle}>
        {nodeElement}
      </View>
    );
  };

  // Sonar ring
  const renderSonarRing = (anim: Animated.Value, key: string) => {
    const scale = anim.interpolate({
      inputRange: [0, 1],
      outputRange: [1, ringMaxScale],
    });
    const opacity = anim.interpolate({
      inputRange: [0, 0.2, 1],
      outputRange: [0.8, 0.5, 0],
    });

    return (
      <Animated.View
        key={key}
        style={[
          styles.sonarRing,
          {
            width: ringSize,
            height: ringSize,
            borderRadius: ringSize / 2,
            borderColor: gamification.nodeCurrent,
            opacity,
            transform: [{ scale }],
          },
        ]}
      />
    );
  };

  const trackLineLeft = (width - trackWidth) / 2;
  const trackerContainerSize = ringSize * ringMaxScale;
  const trackerContainerLeft = (width - trackerContainerSize) / 2;

  return (
    <View style={[styles.container, { width }]}>
      <View style={[styles.trackContainer, { width }]} onLayout={handleLayout}>
        {trackHeight > 0 && nodePixelPositions.length > 0 && (
          <>
            {/* Background track */}
            <View
              style={[
                styles.trackLine,
                {
                  top: nodePixelPositions[0],
                  height:
                    nodePixelPositions[nodePixelPositions.length - 1] - nodePixelPositions[0],
                  width: trackWidth,
                  left: trackLineLeft,
                  backgroundColor: gamification.nodePending,
                },
              ]}
            />

            {/* Progress fill */}
            <View
              style={[
                styles.trackLine,
                {
                  top: nodePixelPositions[0],
                  height: fillHeight,
                  width: trackWidth,
                  left: trackLineLeft,
                  backgroundColor: gamification.nodeComplete,
                },
              ]}
            />

            {/* Start node */}
            {renderNode("complete", -1, nodePixelPositions[0], true, false)}

            {/* Section nodes */}
            {nodeStates.slice(0, -1).map((state, index) =>
              renderNode(state, index, nodePixelPositions[index + 1], false, false)
            )}

            {/* End/completion node */}
            {renderNode(
              nodeStates[nodeStates.length - 1] || "pending",
              totalSections,
              nodePixelPositions[nodePixelPositions.length - 1],
              false,
              true
            )}

            {/* Tracker with sonar rings */}
            <View
              style={[
                styles.trackerContainer,
                {
                  top: trackerTop,
                  width: trackerContainerSize,
                  height: trackerContainerSize,
                  left: trackerContainerLeft,
                  marginTop: (trackerSize - trackerContainerSize) / 2,
                },
              ]}
            >
              {renderSonarRing(ring1, "ring1")}
              {renderSonarRing(ring2, "ring2")}
              {renderSonarRing(ring3, "ring3")}

              <View
                style={[
                  styles.tracker,
                  {
                    width: trackerSize,
                    height: trackerSize,
                    borderRadius: trackerSize / 2,
                    backgroundColor: gamification.nodeCurrent,
                    shadowColor: gamification.nodeCurrent,
                  },
                ]}
              />
            </View>
          </>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
  },
  trackContainer: {
    flex: 1,
    alignItems: "center",
  },
  trackLine: {
    position: "absolute",
    borderRadius: 1.5,
    zIndex: 1,
  },
  nodeAbsolute: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  node: {
    alignItems: "center",
    justifyContent: "center",
  },
  trackerContainer: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  sonarRing: {
    position: "absolute",
    borderWidth: 2,
    backgroundColor: "transparent",
  },
  tracker: {
    position: "absolute",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 3,
    elevation: 3,
  },
});

export default VerticalProgressTrack;
