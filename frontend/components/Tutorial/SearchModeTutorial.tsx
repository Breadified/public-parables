/**
 * SearchModeTutorial - Tutorial for dual-mode search (Book + Semantic)
 * Shows users they can search by reference OR by question/topic
 */

import React, {
  useEffect,
  useRef,
  useCallback,
  useState,
  useMemo,
} from "react";
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
  SharedValue,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { useTheme } from "@/contexts/ThemeContext";
import * as Haptics from "expo-haptics";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface SearchModeTutorialProps {
  visible: boolean;
  onDismiss: () => void;
}

interface ResultItemProps {
  result: { ref: string; preview: string };
  animValue: SharedValue<number>;
  backgroundColor: string;
  borderColor: string;
  accentColor: string;
  secondaryTextColor: string;
}

// Separate component for animated result items to satisfy hooks rules
const AnimatedResultItem: React.FC<ResultItemProps> = ({
  result,
  animValue,
  backgroundColor,
  borderColor,
  accentColor,
  secondaryTextColor,
}) => {
  const itemStyle = useAnimatedStyle(() => ({
    opacity: animValue.value,
    transform: [{ translateY: (1 - animValue.value) * 20 }],
  }));

  return (
    <Animated.View
      style={[styles.resultItem, { backgroundColor, borderColor }, itemStyle]}
    >
      <Text style={[styles.resultRef, { color: accentColor }]}>
        {result.ref}
      </Text>
      <Text
        style={[styles.resultPreview, { color: secondaryTextColor }]}
        numberOfLines={1}
      >
        {result.preview}
      </Text>
    </Animated.View>
  );
};

// Demo search examples
const DEMO_SEARCHES = [
  {
    type: "book" as const,
    query: "John 3:16",
    results: [{ ref: "John 3:16", preview: "For God so loved the world..." }],
  },
  {
    type: "semantic" as const,
    query: "How to find peace?",
    results: [
      {
        ref: "Philippians 4:6-7",
        preview: "Do not be anxious about anything...",
      },
      { ref: "John 14:27", preview: "Peace I leave with you..." },
      { ref: "Isaiah 26:3", preview: "You will keep in perfect peace..." },
    ],
  },
  {
    type: "book" as const,
    query: "Psalm 23",
    results: [{ ref: "Psalm 23:1-6", preview: "The Lord is my shepherd..." }],
  },
  {
    type: "semantic" as const,
    query: "What is love?",
    results: [
      {
        ref: "1 Corinthians 13:4-7",
        preview: "Love is patient, love is kind...",
      },
      { ref: "1 John 4:8", preview: "God is love..." },
      { ref: "John 3:16", preview: "For God so loved the world..." },
    ],
  },
];

// Animation timing constants (matching AnimatedPlaceholder pattern)
const TYPING_SPEED = 80;
const PAUSE_AFTER_COMPLETE = 2000;
const PAUSE_BEFORE_NEXT = 500;

export const SearchModeTutorial: React.FC<SearchModeTutorialProps> = ({
  visible,
  onDismiss,
}) => {
  const { theme } = useTheme();
  const [currentDemoIndex, setCurrentDemoIndex] = useState(0);
  const [displayedText, setDisplayedText] = useState("");
  const [showResults, setShowResults] = useState(false);

  // Theme colors
  const colors = {
    background: theme.colors.interactive.modal.background,
    text: theme.colors.text.primary,
    secondaryText: theme.colors.text.secondary,
    accent: theme.colors.accent,
    accentLight:
      theme.mode === "dark"
        ? "rgba(129, 140, 248, 0.1)"
        : theme.mode === "sepia"
        ? "rgba(139, 115, 85, 0.1)"
        : "rgba(99, 102, 241, 0.1)",
    searchBg:
      theme.mode === "dark"
        ? theme.colors.background.secondary
        : theme.mode === "sepia"
        ? "#F5F5DC"
        : "#f5f5f5",
    resultBg:
      theme.mode === "dark"
        ? theme.colors.background.elevated
        : theme.mode === "sepia"
        ? "#FFF8DC"
        : "#ffffff",
    border: theme.colors.border,
    bookBadge: "#10B981", // Green for book search
    semanticBadge: "#8B5CF6", // Purple for semantic search
  };

  // Animation values
  const scaleAnim = useRef(new RNAnimated.Value(0.8)).current;
  const fadeAnim = useRef(new RNAnimated.Value(0)).current;

  // Typing animation values (memoized to prevent re-renders from recreating)
  const cursorOpacity = useSharedValue(1);
  const resultsOpacity = useSharedValue(0);
  const resultItem0 = useSharedValue(0);
  const resultItem1 = useSharedValue(0);
  const resultItem2 = useSharedValue(0);
  const resultItems = useMemo(
    () => [resultItem0, resultItem1, resultItem2],
    [resultItem0, resultItem1, resultItem2]
  );
  const badgeScale = useSharedValue(0);

  // Single animation timeout ref (like AnimatedPlaceholder)
  const animationRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Phase-based state machine refs (like AnimatedPlaceholder)
  const phaseRef = useRef<"typing" | "showing_results" | "paused">("typing");
  const charIndexRef = useRef(0);
  const demoIndexRef = useRef(0);

  // Cursor blink animation
  useEffect(() => {
    if (visible) {
      cursorOpacity.value = withRepeat(
        withSequence(
          withTiming(0, { duration: 500 }),
          withTiming(1, { duration: 500 })
        ),
        -1,
        true
      );
    }
  }, [visible, cursorOpacity]);

  // Main animation effect (following AnimatedPlaceholder pattern exactly)
  useEffect(() => {
    if (!visible) {
      // Clear animation when hidden
      if (animationRef.current) {
        clearTimeout(animationRef.current);
        animationRef.current = null;
      }
      setDisplayedText("");
      setShowResults(false);
      setCurrentDemoIndex(0);
      charIndexRef.current = 0;
      demoIndexRef.current = 0;
      phaseRef.current = "typing";
      scaleAnim.setValue(0.8);
      fadeAnim.setValue(0);
      return;
    }

    // Entry animations (smooth timing, no bounce)
    RNAnimated.parallel([
      RNAnimated.timing(scaleAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: false,
      }),
      RNAnimated.timing(fadeAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: false,
      }),
    ]).start();

    // Initialize
    charIndexRef.current = 0;
    demoIndexRef.current = 0;
    phaseRef.current = "typing";
    setCurrentDemoIndex(0);
    setShowResults(false);
    resultsOpacity.value = 0;
    badgeScale.value = 0;
    resultItems.forEach((item) => {
      item.value = 0;
    });

    const animate = () => {
      const currentDemo = DEMO_SEARCHES[demoIndexRef.current];
      const currentQuery = currentDemo.query;

      if (phaseRef.current === "typing") {
        // Typing phase
        if (charIndexRef.current < currentQuery.length) {
          setDisplayedText(currentQuery.substring(0, charIndexRef.current + 1));
          charIndexRef.current += 1;
          animationRef.current = setTimeout(animate, TYPING_SPEED);
        } else {
          // Finished typing, show results
          phaseRef.current = "showing_results";
          setShowResults(true);
          resultsOpacity.value = withTiming(1, { duration: 200 });
          badgeScale.value = withTiming(1, { duration: 200 });
          resultItems.forEach((item, i) => {
            item.value = withDelay(i * 80, withTiming(1, { duration: 200 }));
          });
          animationRef.current = setTimeout(animate, PAUSE_AFTER_COMPLETE);
        }
      } else if (phaseRef.current === "showing_results") {
        // Pause complete, move to next demo
        phaseRef.current = "paused";
        animationRef.current = setTimeout(animate, PAUSE_BEFORE_NEXT);
      } else if (phaseRef.current === "paused") {
        // Reset for next demo
        demoIndexRef.current =
          (demoIndexRef.current + 1) % DEMO_SEARCHES.length;
        charIndexRef.current = 0;
        phaseRef.current = "typing";
        setCurrentDemoIndex(demoIndexRef.current);
        setDisplayedText("");
        setShowResults(false);
        resultsOpacity.value = 0;
        badgeScale.value = 0;
        resultItems.forEach((item) => {
          item.value = 0;
        });
        animationRef.current = setTimeout(animate, TYPING_SPEED);
      }
    };

    // Start animation after initial delay
    animationRef.current = setTimeout(animate, 800);

    return () => {
      if (animationRef.current) {
        clearTimeout(animationRef.current);
        animationRef.current = null;
      }
    };
    // Only re-run when visibility changes - all other values accessed via closure
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const handleDismiss = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onDismiss();
  }, [onDismiss]);

  // Animated styles
  const cursorStyle = useAnimatedStyle(() => ({
    opacity: cursorOpacity.value,
  }));

  const resultsContainerStyle = useAnimatedStyle(() => ({
    opacity: resultsOpacity.value,
  }));

  const badgeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: badgeScale.value }],
  }));

  const currentDemo = DEMO_SEARCHES[currentDemoIndex];
  const isSemanticSearch = currentDemo.type === "semantic";

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
              <View style={styles.iconRow}>
                <View
                  style={[
                    styles.iconBadge,
                    { backgroundColor: colors.bookBadge + "20" },
                  ]}
                >
                  <Ionicons name="book" size={20} color={colors.bookBadge} />
                </View>
                <Text
                  style={[styles.plusSign, { color: colors.secondaryText }]}
                >
                  +
                </Text>
                <View
                  style={[
                    styles.iconBadge,
                    { backgroundColor: colors.semanticBadge + "20" },
                  ]}
                >
                  <Ionicons
                    name="search"
                    size={20}
                    color={colors.semanticBadge}
                  />
                </View>
              </View>
              <Text style={[styles.title, { color: colors.text }]}>
                Two Ways to Search
              </Text>
              <Text
                style={[styles.description, { color: colors.secondaryText }]}
              >
                Find verses by reference or ask questions in plain English
              </Text>
            </View>

            {/* Animation Demo Area */}
            <View style={styles.demoContainer}>
              {/* Search Box */}
              <View
                style={[
                  styles.searchBox,
                  {
                    backgroundColor: colors.searchBg,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Ionicons
                  name="search"
                  size={18}
                  color={colors.secondaryText}
                />
                <View style={styles.searchTextContainer}>
                  <Text style={[styles.searchText, { color: colors.text }]}>
                    {displayedText}
                  </Text>
                  <Animated.View
                    style={[
                      styles.cursor,
                      { backgroundColor: colors.accent },
                      cursorStyle,
                    ]}
                  />
                </View>
              </View>

              {/* Mode Badge */}
              <Animated.View style={[styles.modeBadgeContainer, badgeStyle]}>
                {showResults && (
                  <View
                    style={[
                      styles.modeBadge,
                      {
                        backgroundColor: isSemanticSearch
                          ? colors.semanticBadge
                          : colors.bookBadge,
                      },
                    ]}
                  >
                    <Ionicons
                      name={isSemanticSearch ? "bulb" : "book"}
                      size={12}
                      color="#FFF"
                    />
                    <Text style={styles.modeBadgeText}>
                      {isSemanticSearch ? "Scripture Search" : "Book Search"}
                    </Text>
                  </View>
                )}
              </Animated.View>

              {/* Results */}
              <Animated.View
                style={[styles.resultsContainer, resultsContainerStyle]}
              >
                {showResults &&
                  currentDemo.results
                    .slice(0, 3)
                    .map((result, index) => (
                      <AnimatedResultItem
                        key={`${currentDemo.query}-${index}`}
                        result={result}
                        animValue={resultItems[index]}
                        backgroundColor={colors.resultBg}
                        borderColor={colors.border}
                        accentColor={colors.accent}
                        secondaryTextColor={colors.secondaryText}
                      />
                    ))}
              </Animated.View>
            </View>

            {/* Feature Cards */}
            <View style={styles.featuresRow}>
              <View
                style={[
                  styles.featureCard,
                  {
                    backgroundColor: colors.bookBadge + "10",
                    borderColor: colors.bookBadge + "30",
                  },
                ]}
              >
                <Ionicons name="book" size={16} color={colors.bookBadge} />
                <Text style={[styles.featureTitle, { color: colors.text }]}>
                  Book Search
                </Text>
                <Text
                  style={[styles.featureText, { color: colors.secondaryText }]}
                >
                  {'"John 3:16"\n"Psalm 23"\n"Genesis 1"'}
                </Text>
              </View>
              <View
                style={[
                  styles.featureCard,
                  {
                    backgroundColor: colors.semanticBadge + "10",
                    borderColor: colors.semanticBadge + "30",
                  },
                ]}
              >
                <Ionicons name="bulb" size={16} color={colors.semanticBadge} />
                <Text style={[styles.featureTitle, { color: colors.text }]}>
                  Scripture Search
                </Text>
                <Text
                  style={[styles.featureText, { color: colors.secondaryText }]}
                >
                  {'"How to pray?"\n"David\'s firstborn"\n"Fall of humanity"'}
                </Text>
              </View>
            </View>

            {/* Tip */}
            <View
              style={[
                styles.tipContainer,
                { backgroundColor: colors.accentLight },
              ]}
            >
              <Ionicons name="sparkles" size={16} color={colors.accent} />
              <Text style={[styles.tipText, { color: colors.accent }]}>
                {
                  "Just start typing - we'll automatically detect what you're looking for!"
                }
              </Text>
            </View>

            {/* Action Button */}
            <Pressable
              style={[styles.primaryButton, { backgroundColor: colors.accent }]}
              onPress={handleDismiss}
            >
              <Text style={styles.primaryButtonText}>Start Searching</Text>
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
    marginBottom: 20,
  },
  iconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  plusSign: {
    fontSize: 24,
    fontWeight: "300",
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
    marginBottom: 20,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  searchTextContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  searchText: {
    fontSize: 15,
    fontWeight: "500",
  },
  cursor: {
    width: 2,
    height: 18,
    marginLeft: 1,
    borderRadius: 1,
  },
  modeBadgeContainer: {
    alignItems: "center",
    marginTop: 10,
    height: 24,
  },
  modeBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  modeBadgeText: {
    color: "#FFF",
    fontSize: 11,
    fontWeight: "600",
  },
  resultsContainer: {
    marginTop: 12,
    gap: 8,
    minHeight: 190, // Fixed height for 3 results to prevent modal resizing
  },
  resultItem: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  resultRef: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 2,
  },
  resultPreview: {
    fontSize: 12,
  },
  featuresRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  featureCard: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
  },
  featureTitle: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 6,
    marginBottom: 4,
  },
  featureText: {
    fontSize: 10,
    textAlign: "center",
    lineHeight: 14,
  },
  tipContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    gap: 8,
    marginBottom: 16,
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

export default SearchModeTutorial;
