/**
 * NumberButton - Reusable button for both chapters and verses
 * Chapters: 72px (4-8 columns)
 * Verses: 56px (5-6 columns) - slightly smaller as per UX research
 */

import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeOut, Easing } from 'react-native-reanimated';
import type { DisplayMode } from './types';

interface NumberButtonProps {
  number: number;
  onPress: () => void;
  width: number;
  height: number;
  mode: DisplayMode;
  isFiltering: boolean;
  isAnimating: boolean;
  prepareAnimations: boolean;
  layoutTransition: any;
  textColor: string;
  backgroundColor: string;
  borderColor: string;
}

export const NumberButton = React.memo(function NumberButton({
  number,
  onPress,
  width,
  height,
  mode,
  isFiltering,
  isAnimating,
  prepareAnimations,
  layoutTransition,
  textColor,
  backgroundColor,
  borderColor,
}: NumberButtonProps) {
  const shouldAttachLayout = prepareAnimations || isFiltering;

  // Verse buttons are slightly smaller and lighter (visual hierarchy)
  const fontSize = mode === 'verses' ? 16 : 16;
  const fontWeight = mode === 'verses' ? '500' : '600';

  return (
    <Animated.View
      style={{ width, height }}
      layout={shouldAttachLayout ? layoutTransition : undefined}
      entering={shouldAttachLayout ? FadeIn.duration(250).easing(Easing.out(Easing.ease)) : undefined}
      exiting={shouldAttachLayout ? FadeOut.duration(150).easing(Easing.in(Easing.ease)) : undefined}
    >
      <TouchableOpacity
        style={[
          styles.button,
          {
            width,
            height,
            backgroundColor,
            borderColor,
          }
        ]}
        onPress={onPress}
        activeOpacity={0.7}
      >
        <Text style={[styles.text, { fontSize, fontWeight: fontWeight as any, color: textColor }]}>
          {number}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  button: {
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
  },
  text: {
    textAlign: 'center',
  },
});
