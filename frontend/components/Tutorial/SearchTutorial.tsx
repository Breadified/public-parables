/**
 * Interactive Search Tutorial
 * A delightful onboarding experience for first-time users
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Modal,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  withDelay,
  withRepeat,
  BounceIn,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const TUTORIAL_STEPS = [
  {
    id: 'welcome',
    emoji: '👋',
    title: 'Welcome to Scripture Search!',
    description: 'Let me show you around this powerful Bible navigation tool',
    tip: 'You can skip this anytime',
  },
  {
    id: 'testaments',
    emoji: '📚',
    title: 'Start with Testaments',
    description: 'Choose between Old and New Testament with beautiful cards',
    tip: 'Each has its own unique personality',
  },
  {
    id: 'books',
    emoji: '📖',
    title: 'Visual Book Grid',
    description: 'Books are organized by category - Law, History, Gospels, and more',
    tip: 'Popular books have quick access pills',
  },
  {
    id: 'search',
    emoji: '🔍',
    title: 'Smart Search',
    description: 'Type any word, phrase, or reference like "John 3:16"',
    tip: 'Use quotes for exact matches',
  },
  {
    id: 'gestures',
    emoji: '✨',
    title: 'Delightful Interactions',
    description: 'Every tap, swipe, and selection has been crafted with care',
    tip: 'Try triple-tapping the logo for a surprise!',
  },
];

interface SearchTutorialProps {
  visible: boolean;
  onComplete: () => void;
}

const TutorialStep = ({ step, index, isActive, onNext }: any) => {
  const scale = useSharedValue(0);
  const rotation = useSharedValue(0);
  const emojiScale = useSharedValue(1);

  React.useEffect(() => {
    if (isActive) {
      scale.value = withSpring(1, { damping: 12, stiffness: 200 });
      rotation.value = withSequence(
        withTiming(-5, { duration: 100 }),
        withSpring(0, { damping: 10, stiffness: 300 })
      );
      
      // Animate emoji
      emojiScale.value = withRepeat(
        withSequence(
          withTiming(1.2, { duration: 1000 }),
          withTiming(1, { duration: 1000 })
        ),
        -1,
        true
      );
    } else {
      scale.value = withTiming(0, { duration: 200 });
    }
  }, [isActive]);

  const containerStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { rotate: `${rotation.value}deg` },
    ],
    opacity: scale.value,
  }));

  const emojiStyle = useAnimatedStyle(() => ({
    transform: [{ scale: emojiScale.value }],
  }));

  if (!isActive) return null;

  return (
    <Animated.View style={[styles.stepContainer, containerStyle]}>
      <Animated.Text style={[styles.stepEmoji, emojiStyle]}>
        {step.emoji}
      </Animated.Text>
      
      <Text style={styles.stepTitle}>{step.title}</Text>
      <Text style={styles.stepDescription}>{step.description}</Text>
      
      <View style={styles.tipContainer}>
        <Text style={styles.tipEmoji}>💡</Text>
        <Text style={styles.tipText}>{step.tip}</Text>
      </View>
      
      <TouchableOpacity
        style={styles.nextButton}
        onPress={onNext}
        activeOpacity={0.8}
      >
        <Text style={styles.nextButtonText}>
          {index === TUTORIAL_STEPS.length - 1 ? "Let's Begin!" : 'Next'}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

// Separate component for progress dot to avoid hooks in loops
const ProgressDot = ({ isActive }: { isActive: boolean }) => {
  const scale = useSharedValue(isActive ? 1 : 0.6);
  const opacity = useSharedValue(isActive ? 1 : 0.4);

  React.useEffect(() => {
    scale.value = withSpring(isActive ? 1.2 : 0.6, {
      damping: 15,
      stiffness: 300,
    });
    opacity.value = withTiming(isActive ? 1 : 0.4, {
      duration: 200,
    });
  }, [isActive, scale, opacity]);

  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.progressDot,
        isActive && styles.progressDotActive,
        dotStyle,
      ]}
    />
  );
};

const ProgressDots = ({ currentStep, totalSteps }: any) => {
  return (
    <View style={styles.progressContainer}>
      {Array.from({ length: totalSteps }).map((_, index) => (
        <ProgressDot key={index} isActive={index === currentStep} />
      ))}
    </View>
  );
};

export default function SearchTutorial({ visible, onComplete }: SearchTutorialProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const backgroundOpacity = useSharedValue(0);
  const confettiScale = useSharedValue(0);

  React.useEffect(() => {
    if (visible) {
      backgroundOpacity.value = withTiming(1, { duration: 300 });
    } else {
      backgroundOpacity.value = withTiming(0, { duration: 300 });
    }
  }, [visible]);

  const handleNext = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    if (currentStep < TUTORIAL_STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      // Complete tutorial with celebration
      confettiScale.value = withSequence(
        withSpring(1, { damping: 5, stiffness: 200 }),
        withDelay(500, withTiming(0, { duration: 300 }))
      );
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      // Save completion state
      AsyncStorage.setItem('searchTutorialCompleted', 'true');
      
      setTimeout(() => {
        onComplete();
      }, 800);
    }
  }, [currentStep, onComplete]);

  const handleSkip = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    AsyncStorage.setItem('searchTutorialCompleted', 'true');
    onComplete();
  }, [onComplete]);

  const backgroundStyle = useAnimatedStyle(() => ({
    opacity: backgroundOpacity.value,
  }));

  const confettiStyle = useAnimatedStyle(() => ({
    transform: [{ scale: confettiScale.value }],
    opacity: confettiScale.value,
  }));

  if (!visible) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      statusBarTranslucent
    >
      <Animated.View style={[styles.overlay, backgroundStyle]}>
        {/* Skip button */}
        <TouchableOpacity
          style={styles.skipButton}
          onPress={handleSkip}
          activeOpacity={0.7}
        >
          <Text style={styles.skipButtonText}>Skip Tutorial</Text>
        </TouchableOpacity>

        {/* Main content */}
        <View style={styles.content}>
          {/* Floating decorations */}
          <Animated.View
            entering={BounceIn.delay(300).springify()}
            style={[styles.decoration, styles.decorationTopLeft]}
          >
            <Text style={styles.decorationEmoji}>✨</Text>
          </Animated.View>
          
          <Animated.View
            entering={BounceIn.delay(400).springify()}
            style={[styles.decoration, styles.decorationTopRight]}
          >
            <Text style={styles.decorationEmoji}>📖</Text>
          </Animated.View>
          
          <Animated.View
            entering={BounceIn.delay(500).springify()}
            style={[styles.decoration, styles.decorationBottomLeft]}
          >
            <Text style={styles.decorationEmoji}>🙏</Text>
          </Animated.View>
          
          <Animated.View
            entering={BounceIn.delay(600).springify()}
            style={[styles.decoration, styles.decorationBottomRight]}
          >
            <Text style={styles.decorationEmoji}>💫</Text>
          </Animated.View>

          {/* Tutorial steps */}
          {TUTORIAL_STEPS.map((step, index) => (
            <TutorialStep
              key={step.id}
              step={step}
              index={index}
              isActive={currentStep === index}
              onNext={handleNext}
            />
          ))}

          {/* Progress indicator */}
          <ProgressDots
            currentStep={currentStep}
            totalSteps={TUTORIAL_STEPS.length}
          />

          {/* Celebration confetti */}
          <Animated.View style={[styles.confetti, confettiStyle]}>
            <Text style={styles.confettiEmoji}>🎉</Text>
          </Animated.View>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    width: SCREEN_WIDTH * 0.85,
    maxWidth: 400,
    alignItems: 'center',
  },
  skipButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
  },
  skipButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '500',
  },
  stepContainer: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  stepEmoji: {
    fontSize: 64,
    marginBottom: 20,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: 12,
    textAlign: 'center',
  },
  stepDescription: {
    fontSize: 16,
    color: '#7F8C8D',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 20,
  },
  tipContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF9E6',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 24,
  },
  tipEmoji: {
    fontSize: 20,
    marginRight: 8,
  },
  tipText: {
    flex: 1,
    fontSize: 14,
    color: '#8B7700',
    fontStyle: 'italic',
  },
  nextButton: {
    backgroundColor: '#3498DB',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 25,
    shadowColor: '#3498DB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  nextButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  progressContainer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 30,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#BDC3C7',
  },
  progressDotActive: {
    backgroundColor: '#3498DB',
    width: 24,
  },
  decoration: {
    position: 'absolute',
    opacity: 0.3,
  },
  decorationTopLeft: {
    top: -40,
    left: -20,
  },
  decorationTopRight: {
    top: -40,
    right: -20,
  },
  decorationBottomLeft: {
    bottom: -40,
    left: -20,
  },
  decorationBottomRight: {
    bottom: -40,
    right: -20,
  },
  decorationEmoji: {
    fontSize: 32,
  },
  confetti: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -50,
    marginTop: -50,
  },
  confettiEmoji: {
    fontSize: 100,
  },
});