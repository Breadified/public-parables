/**
 * Floating Action Button Component
 * Adaptive FAB that changes based on Study Mode state
 * Normal Mode: Version 1 | Chapter Title (clickable) | Study Mode Icon
 * Study Mode: Version 1 | Chapter Title | Version 2 | X
 */

import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, View, Text, Animated, Pressable } from "react-native";
import ReAnimated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSpring,
  withSequence,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useScrollContext } from "@/contexts/ScrollContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useSelector } from "@legendapp/state/react";
import { studyModeStore$ } from "@/state/studyModeStore";
import { bibleVersionStore$ } from "@/state/bibleVersionStore";
import { tutorialStore$ } from "@/state/tutorialStore";
import { getFABIconForMode, getFABConfigForMode } from "@/state/fabRegistry";
import { VersionSelector } from "./VersionSelector";

interface FloatingActionButtonProps {
  title: string;
  onSearchPress: () => void;
  onEnterStudyMode: () => void;
  onExitStudyMode?: () => void;
}

// Animation Constants for delightful interactions
const SPRING_CONFIG = {
  damping: 15,
  stiffness: 150,
  mass: 1,
};

const BOUNCE_CONFIG = {
  damping: 10,
  stiffness: 200,
  mass: 0.8,
};

const MICRO_SPRING = {
  damping: 20,
  stiffness: 300,
  mass: 0.5,
};

export const FloatingActionButton: React.FC<FloatingActionButtonProps> = ({
  title,
  onSearchPress,
  onEnterStudyMode,
  onExitStudyMode,
}) => {
  // Theme-aware colors
  const { theme } = useTheme();

  // Safe area insets
  const insets = useSafeAreaInsets();

  // Study Mode state
  const isStudyModeActive = useSelector(studyModeStore$.isActive);
  const studyModeType = useSelector(studyModeStore$.studyModeType);
  const comparisonVersion = useSelector(studyModeStore$.comparisonVersion);

  // Bible version state
  const primaryVersion = useSelector(bibleVersionStore$.primaryVersion);
  const availableVersions = useSelector(bibleVersionStore$.availableVersions);

  // Tutorial state
  const hasUsedStudyMode = useSelector(tutorialStore$.hasUsedStudyMode);

  // Version selector modals
  const [showVersion1Selector, setShowVersion1Selector] = useState(false);
  const [showVersion2Selector, setShowVersion2Selector] = useState(false);

  // Get version display names
  const primaryVersionData = availableVersions.find((v: any) => v.id === primaryVersion);
  const comparisonVersionData = availableVersions.find((v: any) => v.id === comparisonVersion);

  // FAB uses ScrollContext to move with footer
  const scrollContext = useScrollContext();

  // Create fallback SharedValue unconditionally (React Hooks rule)
  const fallbackTranslateY = useSharedValue(0);

  // Extract SharedValue early to avoid serialization warnings
  // This prevents the entire scrollContext object from being captured in worklets
  const tabBarTranslateY = scrollContext?.tabBarTranslateY ?? fallbackTranslateY;

  // Individual button animations
  const version1Scale = useRef(new Animated.Value(1)).current;
  const version2Scale = useRef(new Animated.Value(1)).current;
  const chapterScale = useRef(new Animated.Value(1)).current;
  const studyButtonScale = useRef(new Animated.Value(1)).current;
  const studyButtonRotation = useRef(new Animated.Value(0)).current;
  const exitButtonScale = useRef(new Animated.Value(1)).current;
  const exitButtonRotation = useRef(new Animated.Value(0)).current;

  // Mode transition animations - separate values for native and non-native animations
  const modeTransitionProgress = useRef(new Animated.Value(isStudyModeActive ? 1 : 0)).current;
  const modeOpacityProgress = useRef(new Animated.Value(isStudyModeActive ? 1 : 0)).current;

  // First-time user wiggle animation for study mode button
  const studyButtonWiggle = useRef(new Animated.Value(0)).current;

  // FAB now moves in tandem with footer - no independent logic needed

  // Wiggle animation for first-time users - runs every 4 seconds
  useEffect(() => {
    // Only wiggle if:
    // 1. User hasn't used study mode before
    // 2. Study mode is not currently active
    if (!hasUsedStudyMode && !isStudyModeActive) {
      const performWiggle = () => {
        // 2-second wiggle with easing that tapers off
        // Using easeOut for natural deceleration
        Animated.sequence([
          // Initial wiggle - full amplitude (0-400ms)
          Animated.timing(studyButtonWiggle, {
            toValue: 1,
            duration: 100,
            useNativeDriver: true,
          }),
          Animated.timing(studyButtonWiggle, {
            toValue: -1,
            duration: 100,
            useNativeDriver: true,
          }),
          Animated.timing(studyButtonWiggle, {
            toValue: 1,
            duration: 100,
            useNativeDriver: true,
          }),
          Animated.timing(studyButtonWiggle, {
            toValue: -1,
            duration: 100,
            useNativeDriver: true,
          }),
          // Mid wiggle - slightly reduced (400-900ms)
          Animated.timing(studyButtonWiggle, {
            toValue: 0.9,
            duration: 110,
            useNativeDriver: true,
          }),
          Animated.timing(studyButtonWiggle, {
            toValue: -0.9,
            duration: 110,
            useNativeDriver: true,
          }),
          Animated.timing(studyButtonWiggle, {
            toValue: 0.8,
            duration: 120,
            useNativeDriver: true,
          }),
          Animated.timing(studyButtonWiggle, {
            toValue: -0.8,
            duration: 150,
            useNativeDriver: true,
          }),
          // Tapering off - progressive easing (900-2000ms)
          Animated.timing(studyButtonWiggle, {
            toValue: 0.6,
            duration: 150,
            useNativeDriver: true,
          }),
          Animated.timing(studyButtonWiggle, {
            toValue: -0.5,
            duration: 170,
            useNativeDriver: true,
          }),
          Animated.timing(studyButtonWiggle, {
            toValue: 0.3,
            duration: 190,
            useNativeDriver: true,
          }),
          Animated.timing(studyButtonWiggle, {
            toValue: -0.2,
            duration: 210,
            useNativeDriver: true,
          }),
          Animated.timing(studyButtonWiggle, {
            toValue: 0,
            duration: 240,
            useNativeDriver: true,
          }),
        ]).start();
      };

      // Perform immediately on mount
      performWiggle();

      // Then repeat every 4 seconds
      const wiggleInterval = setInterval(performWiggle, 4000);

      return () => clearInterval(wiggleInterval);
    }
  }, [hasUsedStudyMode, isStudyModeActive]);

  // Animate mode transitions - Adaptive width based on content
  useEffect(() => {
    // Calculate adaptive width based on mode
    // Normal mode: Version(50) + Divider(25) + Chapter(flex) + StudyButton(40) = ~200-250px
    // Study mode: Version(50) + Divider(25) + Chapter(flex) + Divider(25) + Version2(50) + Exit(40) = ~260-320px
    // Let content determine width automatically

    // Animate layout properties separately from opacity
    Animated.spring(modeTransitionProgress, {
      toValue: isStudyModeActive ? 1 : 0,
      ...SPRING_CONFIG,
      useNativeDriver: false, // For layout properties
    }).start();

    Animated.spring(modeOpacityProgress, {
      toValue: isStudyModeActive ? 1 : 0,
      ...SPRING_CONFIG,
      useNativeDriver: true, // For opacity
    }).start();
  }, [isStudyModeActive]);

  // Use ScrollContext animations to move FAB with footer
  // Footer now moves by tabBarHeight + 60 = 160px, which is enough to hide both
  // CRITICAL: Use the extracted SharedValue directly to avoid serialization warnings
  const fabAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateY: tabBarTranslateY.value }
      ],
    };
  });

  // Simple, snappy button press animation - shrink, expand, normal
  const animateButtonPress = (scaleAnim: Animated.Value, callback: () => void) => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.85,   // Original deeper shrink
        duration: 30,    // VERY quick
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1.15,   // Original bigger expand
        duration: 50,    // Quick expand
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,      // Back to normal
        duration: 30,    // Quick settle
        useNativeDriver: true,
      }),
    ]).start();

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    callback();
  };

  const handleSearchPress = () => {
    animateButtonPress(chapterScale, onSearchPress);
  };

  const handleStudyModePress = () => {
    // Rotate and scale animation for study mode button
    Animated.parallel([
      Animated.sequence([
        Animated.timing(studyButtonScale, {
          toValue: 0.9,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.spring(studyButtonScale, {
          toValue: 1.15,
          ...BOUNCE_CONFIG,
          useNativeDriver: true,
        }),
        Animated.spring(studyButtonScale, {
          toValue: 1,
          ...MICRO_SPRING,
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.timing(studyButtonRotation, {
          toValue: 0.1,
          duration: 50,
          useNativeDriver: true,
        }),
        Animated.timing(studyButtonRotation, {
          toValue: -0.1,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.spring(studyButtonRotation, {
          toValue: 0,
          ...MICRO_SPRING,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onEnterStudyMode();
  };

  const handleVersion1Press = () => {
    animateButtonPress(version1Scale, () => setShowVersion1Selector(true));
  };

  const handleVersion2Press = () => {
    // In COMPARE mode, open Study Mode Setup Modal to switch modes/versions
    animateButtonPress(version2Scale, () => {
      if (isStudyModeActive && studyModeType === 'COMPARE') {
        onEnterStudyMode(); // Opens Study Mode Setup Modal
      } else {
        setShowVersion2Selector(true); // Fallback for other modes
      }
    });
  };

  const handleExitPress = () => {
    if (onExitStudyMode) {
      // Spin and scale animation for exit button
      Animated.parallel([
        Animated.sequence([
          Animated.timing(exitButtonScale, {
            toValue: 0.8,
            duration: 100,
            useNativeDriver: true,
          }),
          Animated.spring(exitButtonScale, {
            toValue: 1.2,
            ...BOUNCE_CONFIG,
            useNativeDriver: true,
          }),
          Animated.spring(exitButtonScale, {
            toValue: 1,
            ...MICRO_SPRING,
            useNativeDriver: true,
          }),
        ]),
        Animated.timing(exitButtonRotation, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => {
        exitButtonRotation.setValue(0);
      });

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onExitStudyMode();
    }
  };

  // Use theme colors from centralized theme configuration
  const fabColors = theme.colors.interactive.button;

  // Calculate responsive padding based on title length
  const titleLength = title.length;
  const isLongTitle = titleLength > 12; // "Deuteronomy 1" is 13 chars
  const fabPaddingHorizontal = isLongTitle ? 14 : 20; // Tighter for long titles
  const fabGap = isLongTitle ? 6 : 8; // Reduce gap for long titles

  // Calculate FAB bottom position using safe area insets
  // Tab bar components:
  // - Safe area inset (bottom): varies by device
  // - Tab bar padding bottom: 8px
  // - Tab bar padding top: 6px
  // - Tab bar content height: ~48px (paddingVertical: 8px * 2 + icon: 22px + button padding)
  // - FAB spacing above tab bar: minimal gap, scales slightly with safe area
  const tabBarHeight = 48 + 6 + 8; // content + top padding + bottom padding (excluding safe area)
  const fabSpacing = Math.max(16, insets.bottom * 0.4); // Narrower gap: min 16px, scales at 40% of inset
  const fabBottomPosition = insets.bottom + tabBarHeight + fabSpacing;

  return (
    <>
      <ReAnimated.View
        style={[
          styles.floatingSearchButton,
          { bottom: fabBottomPosition },
          fabAnimatedStyle
        ]}
        pointerEvents="box-none"
      >
        <Animated.View
          style={[
            styles.floatingSearchButtonInner,
            {
              backgroundColor: fabColors.background,
              shadowColor: fabColors.shadow,
              // Adaptive width and padding based on content length
              alignSelf: 'center',
              paddingHorizontal: fabPaddingHorizontal,
            }
          ]}
        >
          <View style={[styles.fabContent, { gap: fabGap }]}>
            {/* Always show Version 1 with animated scale - Extended touch area */}
            <Pressable
              onPress={handleVersion1Press}
              onPressIn={() => {
                Animated.timing(version1Scale, {
                  toValue: 0.92,  // More noticeable press
                  duration: 25,    // Super quick
                  useNativeDriver: true,
                }).start();
              }}
              onPressOut={() => {
                Animated.timing(version1Scale, {
                  toValue: 1,
                  duration: 25,
                  useNativeDriver: true,
                }).start();
              }}
              style={styles.versionTouchArea}
            >
              <Animated.View
                style={[
                  styles.versionButton,
                  {
                    transform: [{ scale: version1Scale }]
                  }
                ]}
              >
                <Text style={[styles.versionText, { color: fabColors.icon }]} numberOfLines={1}>
                  {primaryVersionData?.abbreviation || 'ESV'}
                </Text>
              </Animated.View>
            </Pressable>

            <View style={[styles.fabDivider, { backgroundColor: fabColors.divider }]} />

            {/* Chapter Title - clickable for search with bounce */}
            <Pressable
              onPress={handleSearchPress}
              onPressIn={() => {
                Animated.timing(chapterScale, {
                  toValue: 0.92,  // More noticeable press
                  duration: 25,    // Super quick
                  useNativeDriver: true,
                }).start();
              }}
              onPressOut={() => {
                Animated.timing(chapterScale, {
                  toValue: 1,
                  duration: 25,
                  useNativeDriver: true,
                }).start();
              }}
              style={styles.chapterTouchArea}
            >
              <Animated.View
                style={[
                  styles.chapterButton,
                  {
                    transform: [{ scale: chapterScale }],
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                  }
                ]}
              >
                <Text style={[styles.fabTitle, { color: fabColors.icon }]} numberOfLines={1}>
                  {title}
                </Text>
                <Ionicons name="search-outline" size={16} color={fabColors.icon} />
              </Animated.View>
            </Pressable>

            {isStudyModeActive ? (
              <>
                {/* Only show study mode switcher button in NOTES mode, not COMPARE mode */}
                {studyModeType !== 'COMPARE' && (
                  <>
                    <View style={[styles.fabDivider, { backgroundColor: fabColors.divider }]} />

                    {/* Study Mode button - opens modal to switch modes */}
                    <Pressable
                      onPress={handleStudyModePress}
                      onPressIn={() => {
                        Animated.spring(studyButtonScale, {
                          toValue: 0.9,
                          ...MICRO_SPRING,
                          useNativeDriver: true,
                        }).start();
                      }}
                      onPressOut={() => {
                        Animated.spring(studyButtonScale, {
                          toValue: 1,
                          ...MICRO_SPRING,
                          useNativeDriver: true,
                        }).start();
                      }}
                      style={styles.studyButtonTouchArea}
                    >
                      <Animated.View
                        style={[
                          styles.exitButton, // Reuse exit button style
                          {
                            transform: [
                              { scale: studyButtonScale },
                            ],
                            opacity: modeOpacityProgress.interpolate({
                              inputRange: [0, 0.5, 1],
                              outputRange: [0, 0, 1],
                            }),
                          }
                        ]}
                      >
                        {(() => {
                          const iconConfig = getFABIconForMode(studyModeType);
                          return iconConfig.library === "MaterialIcons" ? (
                            <MaterialIcons name={iconConfig.name as any} size={20} color={fabColors.icon} />
                          ) : (
                            <Ionicons name={iconConfig.name as any} size={20} color={fabColors.icon} />
                          );
                        })()}
                      </Animated.View>
                    </Pressable>
                  </>
                )}

                {/* Study Mode COMPARE: add comparison version */}
                {studyModeType === 'COMPARE' && (
                  <>
                    <View style={[styles.fabDivider, { backgroundColor: fabColors.divider }]} />
                    {comparisonVersion ? (
                  <Pressable
                    onPress={handleVersion2Press}
                    onPressIn={() => {
                      Animated.timing(version2Scale, {
                        toValue: 0.92,  // More noticeable press
                        duration: 25,    // Super quick
                        useNativeDriver: true,
                      }).start();
                    }}
                    onPressOut={() => {
                      Animated.timing(version2Scale, {
                        toValue: 1,
                        duration: 25,
                        useNativeDriver: true,
                      }).start();
                    }}
                    style={styles.versionTouchArea}
                  >
                    <Animated.View
                      style={[
                        styles.versionButton,
                        {
                          transform: [{ scale: version2Scale }],
                          opacity: modeOpacityProgress.interpolate({
                            inputRange: [0, 0.5, 1],
                            outputRange: [0, 0, 1],
                          }),
                        }
                      ]}
                    >
                      <Text style={[styles.versionText, { color: fabColors.icon }]} numberOfLines={1}>
                        {comparisonVersionData?.abbreviation || 'V2'}
                      </Text>
                    </Animated.View>
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={handleVersion2Press}
                    onPressIn={() => {
                      Animated.timing(version2Scale, {
                        toValue: 0.92,  // More noticeable press
                        duration: 25,    // Super quick
                        useNativeDriver: true,
                      }).start();
                    }}
                    onPressOut={() => {
                      Animated.timing(version2Scale, {
                        toValue: 1,
                        duration: 25,
                        useNativeDriver: true,
                      }).start();
                    }}
                    style={styles.versionTouchArea}
                  >
                    <Animated.View
                      style={[
                        styles.versionButton,
                        {
                          transform: [{ scale: version2Scale }],
                          opacity: modeOpacityProgress.interpolate({
                            inputRange: [0, 0.5, 1],
                            outputRange: [0, 0, 1],
                          }),
                        }
                      ]}
                    >
                      <MaterialIcons name="add" size={20} color={fabColors.icon} />
                    </Animated.View>
                  </Pressable>
                )}
                  </>
                )}

                {/* X button to exit study mode */}
                <Pressable
                  onPress={handleExitPress}
                  onPressIn={() => {
                    Animated.spring(exitButtonScale, {
                      toValue: 0.9,
                      ...MICRO_SPRING,
                      useNativeDriver: true,
                    }).start();
                  }}
                  onPressOut={() => {
                    Animated.spring(exitButtonScale, {
                      toValue: 1,
                      ...MICRO_SPRING,
                      useNativeDriver: true,
                    }).start();
                  }}
                  style={styles.exitTouchArea}
                >
                  <Animated.View
                    style={[
                      styles.exitButton,
                      {
                        transform: [
                          { scale: exitButtonScale },
                          {
                            rotate: exitButtonRotation.interpolate({
                              inputRange: [0, 1],
                              outputRange: ['0deg', '180deg'],
                            }),
                          },
                        ],
                        opacity: modeOpacityProgress.interpolate({
                          inputRange: [0, 0.7, 1],
                          outputRange: [0, 0, 1],
                        }),
                      }
                    ]}
                  >
                    <Ionicons name="close" size={24} color={fabColors.icon} />
                  </Animated.View>
                </Pressable>
              </>
            ) : (
              <>
                {/* Divider before Study Mode button */}
                <View style={[styles.fabDivider, { backgroundColor: fabColors.divider }]} />

                {/* Normal Mode: add Study Mode button with rotation and wiggle for first-time users */}
                <Pressable
                  onPress={handleStudyModePress}
                  onPressIn={() => {
                    Animated.spring(studyButtonScale, {
                      toValue: 0.9,
                      ...MICRO_SPRING,
                      useNativeDriver: true,
                    }).start();
                  }}
                  onPressOut={() => {
                    Animated.spring(studyButtonScale, {
                      toValue: 1,
                      ...MICRO_SPRING,
                      useNativeDriver: true,
                    }).start();
                  }}
                  style={styles.studyButtonTouchArea}
                >
                  <Animated.View
                    style={[
                      styles.iconButton,
                      {
                        transform: [
                          { scale: studyButtonScale },
                          {
                            rotate: studyButtonRotation.interpolate({
                              inputRange: [-0.1, 0, 0.1],
                              outputRange: ['-5deg', '0deg', '5deg'],
                            }),
                          },
                          {
                            rotate: studyButtonWiggle.interpolate({
                              inputRange: [-1, 0, 1],
                              outputRange: ['-8deg', '0deg', '8deg'],
                            }),
                          },
                        ],
                        opacity: modeOpacityProgress.interpolate({
                          inputRange: [0, 0.3, 1],
                          outputRange: [1, 0, 0],
                        }),
                      }
                    ]}
                  >
                    {(() => {
                      const iconConfig = getFABIconForMode(null);
                      return iconConfig.library === "MaterialIcons" ? (
                        <MaterialIcons name={iconConfig.name as any} size={22} color={fabColors.icon} />
                      ) : (
                        <Ionicons name={iconConfig.name as any} size={22} color={fabColors.icon} />
                      );
                    })()}
                  </Animated.View>
                </Pressable>
              </>
            )}
          </View>
        </Animated.View>
      </ReAnimated.View>

      {/* Version Selectors - available in both modes */}
      <VersionSelector
        visible={showVersion1Selector}
        onClose={() => setShowVersion1Selector(false)}
        onSelectVersion={(version) => {
          // Smart version swapping: if selecting the same version as comparison, swap them
          if (isStudyModeActive && comparisonVersion && version.id === comparisonVersion) {
            // Atomic swap using dedicated swap function
            studyModeStore$.swapVersions();
          } else {
            // Normal: just set version 1
            bibleVersionStore$.setPrimaryVersion(version.id);
          }
        }}
        availableVersions={availableVersions}
        currentVersion={primaryVersion}
        title="Select Bible Version"
      />

      {/* Second version selector - only in COMPARE mode */}
      {isStudyModeActive && studyModeType === 'COMPARE' && (
        <VersionSelector
          visible={showVersion2Selector}
          onClose={() => setShowVersion2Selector(false)}
          onSelectVersion={(version) => {
            // Smart version swapping: if selecting the same version as primary, swap them
            if (version.id === primaryVersion) {
              // Atomic swap using dedicated swap function
              studyModeStore$.swapVersions();
            } else {
              // Normal: just set version 2
              studyModeStore$.setComparisonVersion(version.id);
            }
          }}
          availableVersions={availableVersions}
          currentVersion={comparisonVersion || undefined}
          title="Select Comparison Version"
        />
      )}
    </>
  );
};

const styles = StyleSheet.create({
  floatingSearchButton: {
    position: "absolute",
    // bottom is now set dynamically using safe area insets
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 999,
  },

  floatingSearchButtonInner: {
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    elevation: 6,
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    // Padding is set dynamically based on title length
    // Adaptive width - no fixed width constraints
    minWidth: 200,
    maxWidth: 340,
  },

  fabContent: {
    flexDirection: "row",
    alignItems: "center",
    // Gap is set dynamically based on title length
  },

  fabTitle: {
    fontSize: 16,
    fontWeight: "600",
    flexShrink: 1,
  },

  fabDivider: {
    width: 1,
    height: 24,
  },

  versionTouchArea: {
    // Extended touch target for easier tapping
    minHeight: 48,
    minWidth: 48,
    paddingHorizontal: 4, // Reduced from 8
    paddingVertical: 4,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: -4, // Extend touch area into gaps
  },

  versionButton: {
    minWidth: 40,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
  },

  versionText: {
    fontSize: 14,
    fontWeight: "600",
  },

  chapterTouchArea: {
    // Extended touch target for easier tapping - fills entire height
    minHeight: 48,
    paddingHorizontal: 8, // Generous horizontal padding for touch
    paddingVertical: 4,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: -4, // Extend touch area into gaps
  },

  chapterButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    minWidth: 80, // Minimum width for short titles like "John 1"
  },

  exitButton: {
    padding: 2,
  },

  exitTouchArea: {
    // Extended touch target closer to version 2
    minHeight: 48,
    minWidth: 44, // Reduced from 48
    paddingHorizontal: 2, // Reduced from 4
    paddingVertical: 4,
    marginLeft: -8, // Increased from -4 to bring much closer
    alignItems: "center",
    justifyContent: "center",
  },

  iconButton: {
    padding: 4,
  },

  studyButtonTouchArea: {
    // Compact touch area with reasonable spacing
    minHeight: 48,
    minWidth: 40,
    paddingHorizontal: 2, // Minimal horizontal padding
    paddingVertical: 4,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -2, // Bring slightly closer to divider
  },
});