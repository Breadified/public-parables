/**
 * BottomGlowOverlay - Hollow Knight-inspired holy aura effect
 * Custom Skia implementation with edge glow and floating fireflies
 * Synth aesthetic with graceful pulsing and smooth dithering
 */

import React, {
  useEffect,
  useMemo,
  useState,
  useRef,
  useCallback,
} from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Canvas,
  RadialGradient,
  Rect,
  vec,
  Circle,
  Group,
  LinearGradient,
  BlurMask,
} from "@shopify/react-native-skia";
import {
  useSharedValue,
  withTiming,
  withDelay,
  withSequence,
  withRepeat,
  Easing,
  useDerivedValue,
  runOnJS,
  interpolate,
  cancelAnimation,
  type SharedValue,
} from "react-native-reanimated";

import { useTheme } from "@/contexts/ThemeContext";

interface BottomGlowOverlayProps {
  /** Whether the glow should be visible */
  visible: boolean;
  /** Callback when burst animation completes */
  onComplete?: () => void;
  /** Duration of burst animation in ms */
  duration?: number;
  /** If true, shows a fainter continuous glow instead of burst animation */
  continuous?: boolean;
  /** Opacity multiplier for the glow (0-1), defaults to 1 for burst, 0.33 for continuous */
  intensity?: number;
}

interface Firefly {
  id: number;
  startX: number;
  startY: number;
  size: number;
  speed: number;
  delay: number;
  amplitude: number;
}

const NUM_FIREFLIES = 12;

const CONTINUOUS_INTENSITY = 0.12;

const BottomGlowOverlay = ({
  visible,
  onComplete,
  duration = 4000,
  continuous = false,
  intensity,
}: BottomGlowOverlayProps) => {
  // Default intensity: 1.0 for burst mode, 0.12 for continuous mode
  const effectiveIntensity =
    intensity ?? (continuous ? CONTINUOUS_INTENSITY : 1.0);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const gamification = theme.colors.gamification;

  // Total height including safe area insets
  const totalHeight = height + insets.top + insets.bottom;

  // Track if component should render (stays true during fade-out)
  const [shouldRender, setShouldRender] = useState(false);

  // Track animation phase to prevent restarts
  const animationPhaseRef = useRef<"idle" | "continuous" | "burst">("idle");

  // Animation values
  const masterOpacity = useSharedValue(0);
  const breathe = useSharedValue(0);
  const fireflyOpacity = useSharedValue(0);

  // Generate firefly positions (offset by insets.top since canvas extends above safe area)
  const fireflies = useMemo<Firefly[]>(() => {
    return Array.from({ length: NUM_FIREFLIES }, (_, i) => ({
      id: i,
      startX: Math.random() * width,
      startY: insets.top + height * 0.4 + Math.random() * height * 0.6,
      size: 2 + Math.random() * 3,
      speed: 0.3 + Math.random() * 0.4,
      delay: Math.random() * 800,
      amplitude: 15 + Math.random() * 30,
    }));
  }, [width, height, insets.top]);

  // Individual firefly animations - create fixed number of shared values
  // (hooks cannot be called inside callbacks, so we create them individually)
  const fireflyX0 = useSharedValue(0),
    fireflyY0 = useSharedValue(0),
    fireflyOp0 = useSharedValue(0);
  const fireflyX1 = useSharedValue(0),
    fireflyY1 = useSharedValue(0),
    fireflyOp1 = useSharedValue(0);
  const fireflyX2 = useSharedValue(0),
    fireflyY2 = useSharedValue(0),
    fireflyOp2 = useSharedValue(0);
  const fireflyX3 = useSharedValue(0),
    fireflyY3 = useSharedValue(0),
    fireflyOp3 = useSharedValue(0);
  const fireflyX4 = useSharedValue(0),
    fireflyY4 = useSharedValue(0),
    fireflyOp4 = useSharedValue(0);
  const fireflyX5 = useSharedValue(0),
    fireflyY5 = useSharedValue(0),
    fireflyOp5 = useSharedValue(0);
  const fireflyX6 = useSharedValue(0),
    fireflyY6 = useSharedValue(0),
    fireflyOp6 = useSharedValue(0);
  const fireflyX7 = useSharedValue(0),
    fireflyY7 = useSharedValue(0),
    fireflyOp7 = useSharedValue(0);
  const fireflyX8 = useSharedValue(0),
    fireflyY8 = useSharedValue(0),
    fireflyOp8 = useSharedValue(0);
  const fireflyX9 = useSharedValue(0),
    fireflyY9 = useSharedValue(0),
    fireflyOp9 = useSharedValue(0);
  const fireflyX10 = useSharedValue(0),
    fireflyY10 = useSharedValue(0),
    fireflyOp10 = useSharedValue(0);
  const fireflyX11 = useSharedValue(0),
    fireflyY11 = useSharedValue(0),
    fireflyOp11 = useSharedValue(0);

  const fireflyAnimations = useMemo(
    () => [
      { x: fireflyX0, y: fireflyY0, opacity: fireflyOp0 },
      { x: fireflyX1, y: fireflyY1, opacity: fireflyOp1 },
      { x: fireflyX2, y: fireflyY2, opacity: fireflyOp2 },
      { x: fireflyX3, y: fireflyY3, opacity: fireflyOp3 },
      { x: fireflyX4, y: fireflyY4, opacity: fireflyOp4 },
      { x: fireflyX5, y: fireflyY5, opacity: fireflyOp5 },
      { x: fireflyX6, y: fireflyY6, opacity: fireflyOp6 },
      { x: fireflyX7, y: fireflyY7, opacity: fireflyOp7 },
      { x: fireflyX8, y: fireflyY8, opacity: fireflyOp8 },
      { x: fireflyX9, y: fireflyY9, opacity: fireflyOp9 },
      { x: fireflyX10, y: fireflyY10, opacity: fireflyOp10 },
      { x: fireflyX11, y: fireflyY11, opacity: fireflyOp11 },
    ],
    [],
  );

  const handleComplete = () => {
    setShouldRender(false);
    onComplete?.();
  };

  // Helper to start continuous mode animations
  const startContinuousAnimations = (fadeInDuration = 1000) => {
    // Slower breathing for ambient effect
    breathe.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2500, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 2500, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    );

    // Fireflies stay visible continuously
    fireflyOpacity.value = withTiming(0.6, { duration: fadeInDuration });

    // Continuous firefly movements (oscillating, not rising)
    fireflyAnimations.forEach((anim, i) => {
      const firefly = fireflies[i];

      // Gentle floating X movement
      anim.x.value = withRepeat(
        withSequence(
          withTiming(firefly.amplitude, {
            duration: 4000 / firefly.speed,
            easing: Easing.inOut(Easing.sin),
          }),
          withTiming(-firefly.amplitude, {
            duration: 4000 / firefly.speed,
            easing: Easing.inOut(Easing.sin),
          }),
        ),
        -1,
        true,
      );

      // Slow floating Y movement (oscillates instead of rising away)
      anim.y.value = withRepeat(
        withSequence(
          withTiming(-totalHeight * 0.15, {
            duration: 6000 / firefly.speed,
            easing: Easing.inOut(Easing.sin),
          }),
          withTiming(totalHeight * 0.05, {
            duration: 6000 / firefly.speed,
            easing: Easing.inOut(Easing.sin),
          }),
        ),
        -1,
        true,
      );

      // Gentle pulse
      anim.opacity.value = withRepeat(
        withSequence(
          withTiming(1, {
            duration: 800 + i * 100,
            easing: Easing.inOut(Easing.sin),
          }),
          withTiming(0.3, {
            duration: 800 + i * 100,
            easing: Easing.inOut(Easing.sin),
          }),
        ),
        -1,
        true,
      );
    });
  };

  // Reset phase when visibility changes
  const handleFadeOutComplete = useCallback(() => {
    animationPhaseRef.current = "idle";
    setShouldRender(false);
  }, []);

  useEffect(() => {
    if (visible) {
      setShouldRender(true);

      // Cancel any running animations and reset to 0
      cancelAnimation(masterOpacity);
      cancelAnimation(fireflyOpacity);
      masterOpacity.value = 0;
      fireflyOpacity.value = 0;

      if (continuous) {
        // CONTINUOUS MODE: Fade in to faint level and stay there
        animationPhaseRef.current = "continuous";
        // Use withDelay to ensure we start from 0 on next frame
        masterOpacity.value = withDelay(
          50,
          withTiming(CONTINUOUS_INTENSITY, {
            duration: 1500,
            easing: Easing.out(Easing.cubic),
          }),
        );
        startContinuousAnimations(1500);
      } else {
        // BURST MODE: Fade in to full intensity, then fade out completely
        animationPhaseRef.current = "burst";

        // Use withDelay(16) to ensure we start from 0 on next frame
        masterOpacity.value = withDelay(
          16,
          withSequence(
            withTiming(effectiveIntensity, {
              duration: duration * 0.2,
              easing: Easing.out(Easing.cubic),
            }),
            withDelay(
              duration * 0.5,
              withTiming(
                0,
                { duration: duration * 0.3, easing: Easing.in(Easing.cubic) },
                (finished) => {
                  if (finished) {
                    runOnJS(handleComplete)();
                  }
                },
              ),
            ),
          ),
        );

        // Synth breathing effect - graceful slow pulse
        breathe.value = withRepeat(
          withSequence(
            withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.sin) }),
            withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.sin) }),
          ),
          -1,
          true,
        );

        // Fireflies fade in then out with burst
        fireflyOpacity.value = withSequence(
          withDelay(
            300,
            withTiming(1, { duration: 800, easing: Easing.out(Easing.quad) }),
          ),
          withDelay(
            duration * 0.4,
            withTiming(0, { duration: 1000, easing: Easing.in(Easing.quad) }),
          ),
        );

        // Start individual firefly movements
        fireflyAnimations.forEach((anim, i) => {
          const firefly = fireflies[i];

          // Gentle floating X movement
          anim.x.value = withDelay(
            firefly.delay,
            withRepeat(
              withSequence(
                withTiming(firefly.amplitude, {
                  duration: 3000 / firefly.speed,
                  easing: Easing.inOut(Easing.sin),
                }),
                withTiming(-firefly.amplitude, {
                  duration: 3000 / firefly.speed,
                  easing: Easing.inOut(Easing.sin),
                }),
              ),
              -1,
              true,
            ),
          );

          // Slow rising Y movement
          anim.y.value = withDelay(
            firefly.delay,
            withTiming(-totalHeight * 0.3, {
              duration: duration * 0.8,
              easing: Easing.out(Easing.quad),
            }),
          );

          // Gentle pulse
          anim.opacity.value = withDelay(
            firefly.delay,
            withRepeat(
              withSequence(
                withTiming(1, {
                  duration: 600 + i * 50,
                  easing: Easing.inOut(Easing.sin),
                }),
                withTiming(0.4, {
                  duration: 600 + i * 50,
                  easing: Easing.inOut(Easing.sin),
                }),
              ),
              -1,
              true,
            ),
          );
        });
      }
    } else {
      // Fade out when visibility changes to false
      if (animationPhaseRef.current !== "idle") {
        masterOpacity.value = withTiming(
          0,
          { duration: 500, easing: Easing.in(Easing.cubic) },
          (finished) => {
            if (finished) {
              runOnJS(handleFadeOutComplete)();
            }
          },
        );
        fireflyOpacity.value = withTiming(0, { duration: 500 });
      }
    }
  }, [visible, continuous]);

  // Derived values for Skia with breathing modulation
  const glowOpacity = useDerivedValue(() => masterOpacity.value);
  const fireflyGroupOpacity = useDerivedValue(() => fireflyOpacity.value);

  // Breathing intensity modulation (0.85 to 1.0)
  const breatheIntensity = useDerivedValue(() =>
    interpolate(breathe.value, [0, 1], [0.85, 1]),
  );

  // Colors
  const glowColorStart = gamification.haloGradientStart;
  const glowColorEnd = gamification.haloGradientEnd;
  const coreColor = gamification.nodeComplete;

  // Don't render if not visible and animation is complete
  if (!shouldRender) {
    return null;
  }

  return (
    <View
      pointerEvents="none"
      style={[styles.container, { top: -insets.top, height: totalHeight }]}
    >
      <Canvas style={styles.canvas} pointerEvents="none">
        <Group opacity={glowOpacity}>
          {/* ===== BOTTOM GLOW - Extra Strong ===== */}
          {/* Layer 1: Deep base glow */}
          <Rect x={0} y={0} width={width} height={totalHeight}>
            <RadialGradient
              c={vec(width / 2, totalHeight + 50)}
              r={totalHeight * 0.9}
              colors={[
                coreColor + "DD",
                coreColor + "99",
                glowColorStart + "66",
                glowColorStart + "33",
                glowColorEnd + "1A",
                glowColorEnd + "0D",
                "transparent",
              ]}
              positions={[0, 0.15, 0.3, 0.45, 0.6, 0.75, 1]}
            />
          </Rect>

          {/* Layer 2: Breathing overlay for synth pulse */}
          <Group opacity={breatheIntensity}>
            <Rect
              x={0}
              y={totalHeight * 0.3}
              width={width}
              height={totalHeight * 0.7}
            >
              <RadialGradient
                c={vec(width / 2, totalHeight)}
                r={width * 0.7}
                colors={[
                  "#FFFFFF33",
                  "#FFFFFF1A",
                  coreColor + "22",
                  "transparent",
                ]}
                positions={[0, 0.25, 0.5, 1]}
              />
              <BlurMask blur={40} style="normal" />
            </Rect>
          </Group>

          {/* ===== LEFT EDGE GLOW - Full Height ===== */}
          {/* Layer 1: Primary edge glow */}
          <Rect x={0} y={0} width={width * 0.5} height={totalHeight}>
            <LinearGradient
              start={vec(0, totalHeight / 2)}
              end={vec(width * 0.5, totalHeight / 2)}
              colors={[
                glowColorStart + "77",
                glowColorStart + "44",
                glowColorStart + "22",
                glowColorStart + "11",
                glowColorStart + "08",
                "transparent",
              ]}
              positions={[0, 0.1, 0.25, 0.45, 0.7, 1]}
            />
          </Rect>

          {/* Layer 2: Softer wide spread */}
          <Rect x={0} y={0} width={width * 0.4} height={totalHeight}>
            <LinearGradient
              start={vec(0, totalHeight / 2)}
              end={vec(width * 0.4, totalHeight / 2)}
              colors={[
                glowColorEnd + "44",
                glowColorEnd + "22",
                glowColorEnd + "0D",
                "transparent",
              ]}
              positions={[0, 0.2, 0.5, 1]}
            />
            <BlurMask blur={25} style="normal" />
          </Rect>

          {/* Layer 3: Breathing accent on left */}
          <Group opacity={breatheIntensity}>
            <Rect x={0} y={0} width={width * 0.25} height={totalHeight}>
              <LinearGradient
                start={vec(0, totalHeight / 2)}
                end={vec(width * 0.25, totalHeight / 2)}
                colors={["#FFFFFF22", "#FFFFFF0D", "transparent"]}
                positions={[0, 0.3, 1]}
              />
            </Rect>
          </Group>

          {/* ===== RIGHT EDGE GLOW - Full Height ===== */}
          {/* Layer 1: Primary edge glow */}
          <Rect x={width * 0.5} y={0} width={width * 0.5} height={totalHeight}>
            <LinearGradient
              start={vec(width, totalHeight / 2)}
              end={vec(width * 0.5, totalHeight / 2)}
              colors={[
                glowColorStart + "77",
                glowColorStart + "44",
                glowColorStart + "22",
                glowColorStart + "11",
                glowColorStart + "08",
                "transparent",
              ]}
              positions={[0, 0.1, 0.25, 0.45, 0.7, 1]}
            />
          </Rect>

          {/* Layer 2: Softer wide spread */}
          <Rect x={width * 0.6} y={0} width={width * 0.4} height={totalHeight}>
            <LinearGradient
              start={vec(width, totalHeight / 2)}
              end={vec(width * 0.6, totalHeight / 2)}
              colors={[
                glowColorEnd + "44",
                glowColorEnd + "22",
                glowColorEnd + "0D",
                "transparent",
              ]}
              positions={[0, 0.2, 0.5, 1]}
            />
            <BlurMask blur={25} style="normal" />
          </Rect>

          {/* Layer 3: Breathing accent on right */}
          <Group opacity={breatheIntensity}>
            <Rect
              x={width * 0.75}
              y={0}
              width={width * 0.25}
              height={totalHeight}
            >
              <LinearGradient
                start={vec(width, totalHeight / 2)}
                end={vec(width * 0.75, totalHeight / 2)}
                colors={["#FFFFFF22", "#FFFFFF0D", "transparent"]}
                positions={[0, 0.3, 1]}
              />
            </Rect>
          </Group>

          {/* ===== CORNER INTENSIFIERS ===== */}
          {/* Bottom-left corner radial */}
          <Rect
            x={0}
            y={totalHeight * 0.5}
            width={width * 0.5}
            height={totalHeight * 0.5}
          >
            <RadialGradient
              c={vec(0, totalHeight)}
              r={width * 0.6}
              colors={[
                glowColorStart + "55",
                glowColorStart + "33",
                glowColorStart + "1A",
                glowColorStart + "0D",
                "transparent",
              ]}
              positions={[0, 0.2, 0.4, 0.6, 1]}
            />
          </Rect>

          {/* Bottom-right corner radial */}
          <Rect
            x={width * 0.5}
            y={totalHeight * 0.5}
            width={width * 0.5}
            height={totalHeight * 0.5}
          >
            <RadialGradient
              c={vec(width, totalHeight)}
              r={width * 0.6}
              colors={[
                glowColorStart + "55",
                glowColorStart + "33",
                glowColorStart + "1A",
                glowColorStart + "0D",
                "transparent",
              ]}
              positions={[0, 0.2, 0.4, 0.6, 1]}
            />
          </Rect>
        </Group>

        {/* ===== FIREFLIES ===== */}
        <Group opacity={fireflyGroupOpacity}>
          {fireflies.map((firefly, index) => (
            <FireflyParticle
              key={firefly.id}
              firefly={firefly}
              animation={fireflyAnimations[index]}
              color={
                index % 3 === 0
                  ? "#FFFFFF"
                  : index % 3 === 1
                    ? coreColor
                    : glowColorStart
              }
            />
          ))}
        </Group>
      </Canvas>
    </View>
  );
};

interface FireflyParticleProps {
  firefly: Firefly;
  animation: {
    x: SharedValue<number>;
    y: SharedValue<number>;
    opacity: SharedValue<number>;
  };
  color: string;
}

const FireflyParticle = ({
  firefly,
  animation,
  color,
}: FireflyParticleProps) => {
  const cx = useDerivedValue(() => firefly.startX + animation.x.value);
  const cy = useDerivedValue(() => firefly.startY + animation.y.value);
  const opacity = useDerivedValue(() => animation.opacity.value);

  return (
    <Group opacity={opacity}>
      {/* Outer soft glow */}
      <Circle cx={cx} cy={cy} r={firefly.size * 6}>
        <RadialGradient
          c={vec(firefly.startX, firefly.startY)}
          r={firefly.size * 6}
          colors={[color + "22", color + "11", "transparent"]}
          positions={[0, 0.4, 1]}
        />
      </Circle>
      {/* Mid glow */}
      <Circle cx={cx} cy={cy} r={firefly.size * 3}>
        <RadialGradient
          c={vec(firefly.startX, firefly.startY)}
          r={firefly.size * 3}
          colors={[color + "66", color + "33", "transparent"]}
          positions={[0, 0.5, 1]}
        />
      </Circle>
      {/* Core */}
      <Circle cx={cx} cy={cy} r={firefly.size} color={color + "CC"} />
      {/* Bright center */}
      <Circle cx={cx} cy={cy} r={firefly.size * 0.4} color="#FFFFFFEE" />
    </Group>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
  },
  canvas: {
    flex: 1,
  },
});

export default BottomGlowOverlay;
