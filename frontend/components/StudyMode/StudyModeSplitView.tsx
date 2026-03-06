import React, { useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  runOnJS,
  interpolate,
} from 'react-native-reanimated';
import { useTheme } from '@/contexts/ThemeContext';
import { useScrollContext } from '@/contexts/ScrollContext';
import { useDimensions } from '@/contexts/DimensionsContext';
import { useSelector } from '@legendapp/state/react';
import { studyModeStore$ } from '@/state/studyModeStore';
import { bibleVersionStore$ } from '@/state/bibleVersionStore';
import { studyModeManager } from '@/modules/study/studyModeManager';
import { ChapterLevelBibleView } from '../ChapterLevelBibleView';
import { VerseAlignedSplitView } from '../MultiPane/VerseAlignedSplitView';
import { BibleReaderPaneState, PaneType, PaneLinkMode } from '@/types/multiPane';

interface StudyModeSplitViewProps {
  chapterId: number;
  onSwipeToTabs?: () => void;
  onChapterChange?: (chapterId: number, bookName: string, chapterNumber: number) => void;
}

export const StudyModeSplitView: React.FC<StudyModeSplitViewProps> = ({
  chapterId,
  onSwipeToTabs,
  onChapterChange,
}) => {
  const { theme } = useTheme();
  const scrollContext = useScrollContext();

  // FOLDABLE FIX: Get dimensions from context (reactive to fold/unfold)
  const dimensions = useDimensions();
  const screenWidth = dimensions.width;

  // Study mode state
  const currentView = useSelector(studyModeStore$.currentView);
  const comparisonVersion = useSelector(studyModeStore$.comparisonVersion);

  // Primary version from global store
  const primaryVersion = useSelector(bibleVersionStore$.primaryVersion);

  // Animation values for view transitions
  const viewTransition = useSharedValue(0); // 0 = split, -1 = v1 full, 1 = v2 full

  // FOLDABLE FIX: SharedValue for screenWidth that worklets can access
  const screenWidthShared = useSharedValue(screenWidth);

  // Update SharedValue when dimensions change (fold/unfold)
  useEffect(() => {
    screenWidthShared.value = screenWidth;
  }, [screenWidth, screenWidthShared]);

  // Update animation value when view changes
  useEffect(() => {
    switch (currentView) {
      case 'split':
        viewTransition.value = withTiming(0, { duration: 300 });
        break;
      case 'version1_full':
        viewTransition.value = withTiming(-1, { duration: 300 });
        break;
      case 'version2_full':
        viewTransition.value = withTiming(1, { duration: 300 });
        break;
    }
  }, [currentView, viewTransition]);

  // Handle swipe gestures
  const handleSwipeGesture = useCallback((direction: 'left' | 'right') => {
    const result = studyModeManager.handleSwipeGesture(direction);

    if (result === 'exit' && onSwipeToTabs) {
      onSwipeToTabs();
    }
  }, [onSwipeToTabs]);

  // Handle scroll events for header/tab bar visibility
  const handleScroll = useCallback((event: any) => {
    'worklet';
    if (scrollContext) {
      const scrollY = event.nativeEvent.contentOffset.y;
      scrollContext.updateScrollPosition(scrollY);
    }
  }, [scrollContext]);

  // Pan gesture - only activates for horizontal swipes, allows vertical scrolling
  // FOLDABLE FIX: Use screenWidthShared.value in worklet
  const panGesture = Gesture.Pan()
    .activeOffsetX([-20, 20])  // Only activate after 20px horizontal movement
    .failOffsetY([-10, 10])    // Fail if vertical movement > 10px (allow scrolling)
    .onEnd((event) => {
      'worklet';
      const translationX = event.translationX;
      const velocityX = event.velocityX;
      const sw = screenWidthShared.value;

      // Only trigger if horizontal movement is significant
      if (Math.abs(velocityX) > 500) {
        // Fast horizontal swipe
        if (velocityX > 0) {
          runOnJS(handleSwipeGesture)('right');
        } else {
          runOnJS(handleSwipeGesture)('left');
        }
      } else if (Math.abs(translationX) > sw * 0.3) {
        // Slow horizontal swipe but sufficient distance
        if (translationX > 0) {
          runOnJS(handleSwipeGesture)('right');
        } else {
          runOnJS(handleSwipeGesture)('left');
        }
      }
    });

  // Animated styles for view panels - FOLDABLE FIX: Use screenWidthShared.value
  const version1Style = useAnimatedStyle(() => {
    const sw = screenWidthShared.value;
    const width = interpolate(
      viewTransition.value,
      [-1, 0, 1],
      [sw, sw / 2, 0]
    );

    return {
      width,
      position: 'absolute' as const,
      left: 0,
      top: 0,
      bottom: 0,
    };
  });

  const version2Style = useAnimatedStyle(() => {
    const sw = screenWidthShared.value;
    const left = interpolate(
      viewTransition.value,
      [-1, 0, 1],
      [sw, sw / 2, 0]
    );
    const width = interpolate(
      viewTransition.value,
      [-1, 0, 1],
      [0, sw / 2, sw]
    );

    return {
      width,
      left,
      position: 'absolute' as const,
      top: 0,
      bottom: 0,
    };
  });

  const dividerStyle = useAnimatedStyle(() => {
    const sw = screenWidthShared.value;
    const opacity = interpolate(
      viewTransition.value,
      [-1, -0.5, 0, 0.5, 1],
      [0, 0, 1, 0, 0]
    );
    const left = sw / 2;

    return {
      opacity,
      left,
      position: 'absolute' as const,
      top: 0,
      bottom: 0,
    };
  });

  // Only use unified FlashList for split view when comparison version is selected
  const useDiffAlignedView = currentView === 'split' && comparisonVersion !== null;

  // Get version names for unified view
  const primaryVersionData = useSelector(bibleVersionStore$.primaryVersionData);
  const comparisonVersionData = useSelector(() =>
    comparisonVersion ? bibleVersionStore$.getVersionData(comparisonVersion) : null
  );

  // Create temporary pane states for VerseAlignedSplitView
  const tempLeftPane = React.useMemo<BibleReaderPaneState>(() => {
    const bookId = Math.floor(chapterId / 1000000);
    const chapterNum = Math.floor((chapterId % 1000000) / 1000);
    return {
      id: `temp-left-${chapterId}`,
      type: PaneType.BIBLE_READER,
      title: primaryVersionData?.name || primaryVersion,
      linkMode: PaneLinkMode.CONTENT_ALIGNED,
      createdAt: Date.now(),
      versionId: primaryVersion,
      currentChapterId: chapterId,
      scrollPosition: 0,
      selectedVerseId: null,
      bookName: 'Loading',
      chapterNumber: chapterNum,
    };
  }, [chapterId, primaryVersion, primaryVersionData]);

  const tempRightPane = React.useMemo<BibleReaderPaneState>(() => {
    const bookId = Math.floor(chapterId / 1000000);
    const chapterNum = Math.floor((chapterId % 1000000) / 1000);
    return {
      id: `temp-right-${chapterId}`,
      type: PaneType.BIBLE_READER,
      title: comparisonVersionData?.name || (comparisonVersion || ''),
      linkMode: PaneLinkMode.CONTENT_ALIGNED,
      createdAt: Date.now(),
      versionId: comparisonVersion || '',
      currentChapterId: chapterId,
      scrollPosition: 0,
      selectedVerseId: null,
      bookName: 'Loading',
      chapterNumber: chapterNum,
    };
  }, [chapterId, comparisonVersion, comparisonVersionData]);

  // Calculate display configuration directly from reactive values
  const displayConfig = React.useMemo(() => {
    let config;
    switch (currentView) {
      case 'split':
        config = {
          leftPanelVersion: primaryVersion,
          rightPanelVersion: comparisonVersion,
          leftPanelWidth: '50%',
          rightPanelWidth: '50%',
          showDivider: true
        };
        break;

      case 'version1_full':
        config = {
          leftPanelVersion: primaryVersion,
          rightPanelVersion: null,
          leftPanelWidth: '100%',
          rightPanelWidth: '0%',
          showDivider: false
        };
        break;

      case 'version2_full':
        config = {
          leftPanelVersion: null,
          rightPanelVersion: comparisonVersion,
          leftPanelWidth: '0%',
          rightPanelWidth: '100%',
          showDivider: false
        };
        break;

      default:
        config = {
          leftPanelVersion: primaryVersion,
          rightPanelVersion: null,
          leftPanelWidth: '100%',
          rightPanelWidth: '0%',
          showDivider: false
        };
    }

    return config;
  }, [currentView, comparisonVersion, primaryVersion]);

  return (
    <GestureDetector gesture={panGesture}>
      {/* FOLDABLE FIX: Key forces re-render on dimension change */}
      <Animated.View key={dimensions.flashListKey} style={styles.container}>
        {/* Use unified FlashList in split mode with both versions */}
        {useDiffAlignedView && comparisonVersion ? (
          <VerseAlignedSplitView
            leftPane={tempLeftPane}
            rightPane={tempRightPane}
            isActive={true}
            onChapterChange={onChapterChange}
          />
        ) : currentView === 'split' && !comparisonVersion ? (
          // Split mode but no comparison version selected - show placeholder
          <View style={styles.splitContainer}>
            <Animated.View
              style={[
                styles.versionPanel,
                version1Style,
              ]}
            >
              <ChapterLevelBibleView
                chapterId={chapterId}
                versionId={primaryVersion}
                isActive={true}
                onChapterChange={onChapterChange}
              />
            </Animated.View>

            <Animated.View
              style={[
                styles.versionPanel,
                version2Style,
              ]}
            >
              <View
                style={[
                  styles.placeholderPanel,
                  { backgroundColor: theme.colors.background.secondary }
                ]}
              >
                <Text style={[
                  styles.placeholderText,
                  { color: theme.colors.text.muted }
                ]}>
                  Select a second version to compare
                </Text>
              </View>
            </Animated.View>
          </View>
        ) : (
          // Single version full screen (version1_full or version2_full)
          <View style={styles.splitContainer}>
            <Animated.View
              style={[
                styles.versionPanel,
                version1Style,
              ]}
            >
              {displayConfig.leftPanelVersion && (
                <ChapterLevelBibleView
                  chapterId={chapterId}
                  versionId={primaryVersion}
                  isActive={currentView === 'version1_full'}
                  onChapterChange={onChapterChange}
                />
              )}
            </Animated.View>

            <Animated.View
              style={[
                styles.versionPanel,
                version2Style,
              ]}
            >
              {displayConfig.rightPanelVersion && comparisonVersion && (
                <ChapterLevelBibleView
                  chapterId={chapterId}
                  versionId={comparisonVersion}
                  isActive={currentView === 'version2_full'}
                  onChapterChange={onChapterChange}
                />
              )}
            </Animated.View>
          </View>
        )}
      </Animated.View>
    </GestureDetector>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden', // Clip content at container level, not at panel level
  },

  splitContainer: {
    flex: 1,
    position: 'relative', // Allow absolute positioning of children
  },

  versionPanel: {
    height: '100%',
  },

  placeholderPanel: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },

  placeholderText: {
    fontSize: 16,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});