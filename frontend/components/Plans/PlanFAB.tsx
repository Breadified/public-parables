/**
 * Plan Floating Action Button Component
 * Simplified FAB for Plan Sessions - no chapter title, no search
 * Shows: Version selector + Study mode controls
 */

import React, { useRef, useState } from "react";
import { StyleSheet, View, Text, Animated, Pressable } from "react-native";
import ReAnimated, {
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/contexts/ThemeContext";
import { useScrollContext } from "@/contexts/ScrollContext";
import { useSelector } from "@legendapp/state/react";
import { bibleVersionStore$ } from "@/state/bibleVersionStore";
import { planStudyModeStore$ } from "@/state/planStudyModeStore";
import { getFABIconForMode } from "@/state/fabRegistry";
import { VersionSelector } from "../VersionSelector";

interface PlanFABProps {
  onEnterStudyMode: () => void;
  onExitStudyMode?: () => void;
  /** External animated style for auto-hide (from useReadingUIToggle) */
  animatedStyle?: { transform: { translateY: number }[] };
}

// Animation Constants
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

export const PlanFAB: React.FC<PlanFABProps> = ({
  onEnterStudyMode,
  onExitStudyMode,
  animatedStyle: externalAnimatedStyle,
}) => {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  // Plan Study Mode state
  const isStudyModeActive = useSelector(planStudyModeStore$.isActive);
  const studyModeType = useSelector(planStudyModeStore$.studyModeType);
  const comparisonVersion = useSelector(planStudyModeStore$.comparisonVersion);

  // Bible version state
  const primaryVersion = useSelector(bibleVersionStore$.primaryVersion);
  const availableVersions = useSelector(bibleVersionStore$.availableVersions);

  // Version selector modals
  const [showVersion1Selector, setShowVersion1Selector] = useState(false);
  const [showVersion2Selector, setShowVersion2Selector] = useState(false);

  // Get version display names
  const primaryVersionData = availableVersions.find((v: any) => v.id === primaryVersion);
  const comparisonVersionData = availableVersions.find((v: any) => v.id === comparisonVersion);

  // ScrollContext for auto-hide animation (fallback if no external style provided)
  const scrollContext = useScrollContext();

  // Create fallback SharedValue unconditionally (React Hooks rule)
  const fallbackTranslateY = useSharedValue(0);

  // Extract SharedValue early to avoid serialization warnings
  const tabBarTranslateY = scrollContext?.tabBarTranslateY ?? fallbackTranslateY;

  // Animated style for FAB - use external style if provided, otherwise use ScrollContext
  const internalAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: tabBarTranslateY.value }],
  }));

  // Use external animated style if provided (from useReadingUIToggle)
  const fabAnimatedStyle = externalAnimatedStyle ?? internalAnimatedStyle;

  // Individual button animations
  const version1Scale = useRef(new Animated.Value(1)).current;
  const version2Scale = useRef(new Animated.Value(1)).current;
  const studyButtonScale = useRef(new Animated.Value(1)).current;
  const studyButtonRotation = useRef(new Animated.Value(0)).current;
  const exitButtonScale = useRef(new Animated.Value(1)).current;
  const exitButtonRotation = useRef(new Animated.Value(0)).current;

  // Mode transition animations
  const modeOpacityProgress = useRef(new Animated.Value(isStudyModeActive ? 1 : 0)).current;

  // Animate button press
  const animateButtonPress = (scaleAnim: Animated.Value, callback: () => void) => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.85,
        duration: 30,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1.15,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 30,
        useNativeDriver: true,
      }),
    ]).start();

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    callback();
  };

  const handleStudyModePress = () => {
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
    animateButtonPress(version2Scale, () => {
      if (isStudyModeActive && studyModeType === "COMPARE") {
        onEnterStudyMode(); // Opens Study Mode Setup Modal
      } else {
        setShowVersion2Selector(true);
      }
    });
  };

  const handleExitPress = () => {
    if (onExitStudyMode) {
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

  const fabColors = theme.colors.interactive.button;

  // Position: Comment Preview height (~80) + gap (16) + safe area
  const COMMENT_PREVIEW_HEIGHT = 80;
  const GAP = 16;
  const fabBottomPosition = insets.bottom + COMMENT_PREVIEW_HEIGHT + GAP;


  return (
    <>
      <ReAnimated.View
        style={[
          styles.floatingButton,
          { bottom: fabBottomPosition },
          fabAnimatedStyle,
        ]}
        pointerEvents="box-none"
      >
        <Animated.View
          style={[
            styles.floatingButtonInner,
            {
              backgroundColor: fabColors.background,
              shadowColor: fabColors.shadow,
            },
          ]}
        >
          <View style={styles.fabContent}>
            {/* Version 1 Selector */}
            <Pressable
              onPress={handleVersion1Press}
              onPressIn={() => {
                Animated.timing(version1Scale, {
                  toValue: 0.92,
                  duration: 25,
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
                  { transform: [{ scale: version1Scale }] },
                ]}
              >
                <Text style={[styles.versionText, { color: fabColors.icon }]} numberOfLines={1}>
                  {primaryVersionData?.abbreviation || "ESV"}
                </Text>
              </Animated.View>
            </Pressable>

            {isStudyModeActive ? (
              <>
                {/* Study Mode NOTES: show notes icon */}
                {studyModeType === "NOTES" && (
                  <>
                    <View style={[styles.fabDivider, { backgroundColor: fabColors.divider }]} />
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
                          { transform: [{ scale: studyButtonScale }] },
                        ]}
                      >
                        {(() => {
                          const iconConfig = getFABIconForMode(studyModeType);
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

                {/* Study Mode COMPARE: show comparison version */}
                {studyModeType === "COMPARE" && (
                  <>
                    <View style={[styles.fabDivider, { backgroundColor: fabColors.divider }]} />
                    <Pressable
                      onPress={handleVersion2Press}
                      onPressIn={() => {
                        Animated.timing(version2Scale, {
                          toValue: 0.92,
                          duration: 25,
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
                          { transform: [{ scale: version2Scale }] },
                        ]}
                      >
                        <Text style={[styles.versionText, { color: fabColors.icon }]} numberOfLines={1}>
                          {comparisonVersionData?.abbreviation || "NIV"}
                        </Text>
                      </Animated.View>
                    </Pressable>
                  </>
                )}

                {/* Exit button */}
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
                              outputRange: ["0deg", "180deg"],
                            }),
                          },
                        ],
                      },
                    ]}
                  >
                    <Ionicons name="close" size={24} color={fabColors.icon} />
                  </Animated.View>
                </Pressable>
              </>
            ) : (
              <>
                {/* Normal Mode: Study Mode button */}
                <View style={[styles.fabDivider, { backgroundColor: fabColors.divider }]} />
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
                              outputRange: ["-5deg", "0deg", "5deg"],
                            }),
                          },
                        ],
                      },
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

      {/* Version Selectors */}
      <VersionSelector
        visible={showVersion1Selector}
        onClose={() => setShowVersion1Selector(false)}
        onSelectVersion={(version) => {
          if (isStudyModeActive && comparisonVersion && version.id === comparisonVersion) {
            planStudyModeStore$.swapVersions();
          } else {
            bibleVersionStore$.setPrimaryVersion(version.id);
          }
        }}
        availableVersions={availableVersions}
        currentVersion={primaryVersion}
        title="Select Bible Version"
      />

      {isStudyModeActive && studyModeType === "COMPARE" && (
        <VersionSelector
          visible={showVersion2Selector}
          onClose={() => setShowVersion2Selector(false)}
          onSelectVersion={(version) => {
            if (version.id === primaryVersion) {
              planStudyModeStore$.swapVersions();
            } else {
              planStudyModeStore$.setComparisonVersion(version.id);
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
  floatingButton: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 999,
  },
  floatingButtonInner: {
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
    paddingHorizontal: 20,
    minWidth: 140,
    maxWidth: 280,
  },
  fabContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  fabDivider: {
    width: 1,
    height: 24,
  },
  versionTouchArea: {
    minHeight: 48,
    minWidth: 48,
    paddingHorizontal: 4,
    paddingVertical: 4,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: -4,
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
  iconButton: {
    padding: 4,
  },
  exitButton: {
    padding: 2,
  },
  exitTouchArea: {
    minHeight: 48,
    minWidth: 44,
    paddingHorizontal: 2,
    paddingVertical: 4,
    marginLeft: -8,
    alignItems: "center",
    justifyContent: "center",
  },
  studyButtonTouchArea: {
    minHeight: 48,
    minWidth: 40,
    paddingHorizontal: 2,
    paddingVertical: 4,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -2,
  },
});

export default PlanFAB;
