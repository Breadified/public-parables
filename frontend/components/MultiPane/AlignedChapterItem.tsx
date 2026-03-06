/**
 * Aligned Chapter Item - Renders one chapter with both versions side-by-side
 * Uses two-pass rendering for perfect verse-by-verse alignment:
 * 1. First render: measure all paragraph heights (no padding)
 * 2. Second render: apply calculated padding based on measurements
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, LayoutChangeEvent, InteractionManager } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { useDimensions } from '../../contexts/DimensionsContext';
import { BibleContentRenderer } from '../Bible/BibleContentRenderer';
import { createBibleStyles } from '../Bible/BibleStyles';
import { getStudyModeFontSizes } from '../../utils/themeHelpers';
import { getChapterPadding } from '../../utils/chapterPadding';
import { bibleVersionStore$ } from '../../state/bibleVersionStore';
import { getLocalizedChapterDisplayName } from '../../modules/bible/bibleBookMappings';
import type { TextActionEvent } from '../Bible/BibleContentRenderer';
import type { VerseHighlight } from '../../state/notesStore';
import type { Theme } from '../../config/theme';

interface AlignedChapterItemProps {
  chapter: any; // Chapter data from useVerseAlignedChapters
  selectedVerseId: number | null;
  leftVersionId: string;
  rightVersionId: string;
  onVersePositionReady?: (chapterId: number, verseId: number, yOffset: number) => void;
  // Verse selection support
  onVerseLineLayout?: (verseId: number, offsetY: number, height: number) => void;
  // Native text selection callback
  onTextAction?: (event: TextActionEvent) => void;
  // Persisted verse highlights
  persistedHighlights?: VerseHighlight[];
  // Theme colors for highlights
  highlightColors?: Theme['colors']['highlightColors'];
}

/**
 * Helper to generate paragraph key
 */
const getParagraphKey = (sectionIdx: number, paraIdx: number): string => {
  return `${sectionIdx}-${paraIdx}`;
};

/**
 * Global cache for completed alignment calculations
 */
const alignmentCache = new Map<string, {
  leftPaddingMap: Map<string, number>;
  rightPaddingMap: Map<string, number>;
  leftTitleHeights: Map<string, number>;
  rightTitleHeights: Map<string, number>;
  leftParagraphHeights: Map<string, number>;
  rightParagraphHeights: Map<string, number>;
}>();

/**
 * Side content component - renders one version with measurement and padding
 */
const SideContent = React.memo<{
  sections: any[];
  side: 'left' | 'right';
  bibleStyles: ReturnType<typeof createBibleStyles>;
  contentPadding: number;
  selectedVerseId?: number | null;
  onParagraphLayout?: (key: string, height: number) => void;
  onTitleLayout?: (key: string, height: number) => void;
  paragraphPadding: Map<string, number>;
  measurementPhase: number;
  measurementGeneration: number; // Forces new View instances on recycling
  onVerseLineLayout?: (verseId: number, offsetY: number, height: number) => void;
  textColor?: string; // Text color for native view
  verseNumberColor?: string; // Verse number color for native view
  onTextAction?: (event: TextActionEvent) => void; // Native text selection callback
  persistedHighlights?: VerseHighlight[];
  highlightColors?: Theme['colors']['highlightColors'];
}>(({
  sections,
  side,
  bibleStyles,
  contentPadding,
  selectedVerseId,
  onParagraphLayout,
  onTitleLayout,
  paragraphPadding,
  measurementPhase,
  measurementGeneration,
  onVerseLineLayout,
  textColor,
  verseNumberColor,
  onTextAction,
  persistedHighlights,
  highlightColors,
}) => {
  const measurementComplete = measurementPhase > 0;

  return (
    <View style={{ flex: 1 }}>
      {sections.map((section: any, sectionIdx: number) => {
        const paragraphs = side === 'left' ? section.leftParagraphs : section.rightParagraphs;
        const title = side === 'left' ? section.leftTitle : section.rightTitle;
        const subtitle = side === 'left' ? section.leftSubtitle : section.rightSubtitle;

        return (
          <View key={`section-${sectionIdx}-gen${measurementGeneration}`}>
            {paragraphs.map((paragraph: any, paraIdx: number) => {
              const key = getParagraphKey(sectionIdx, paraIdx);
              const topPadding = measurementComplete ? (paragraphPadding.get(key) || 0) : 0;
              const isFirstParagraph = paraIdx === 0;

              return (
                <View key={`${key}-gen${measurementGeneration}`}>
                  {/* Add spacing for alignment */}
                  {measurementComplete && topPadding > 0 && (
                    <View style={{ height: topPadding }} />
                  )}

                  {/* Section title/subtitle measured separately for alignment */}
                  {isFirstParagraph && (title || subtitle) && (
                    <View
                      {...(!measurementComplete && onTitleLayout ? {
                        onLayout: (e: LayoutChangeEvent) => {
                          const { height } = e.nativeEvent.layout;
                          const titleKey = `title-${sectionIdx}`;
                          onTitleLayout(titleKey, height);
                        }
                      } : {})}
                      style={bibleStyles.sectionHeader}
                    >
                      {title && (
                        <Text style={bibleStyles.sectionTitle}>{title}</Text>
                      )}
                      {subtitle && (
                        <Text style={bibleStyles.sectionSubtitle}>{subtitle}</Text>
                      )}
                    </View>
                  )}

                  {/* Paragraph content - uses SelectableTextView's onContentSizeChange for height */}
                  <View>
                    <BibleContentRenderer
                      verseLines={paragraph.verseLines}
                      isPoetry={paragraph.isPoetry}
                      showVerseNumbers={true}
                      styles={bibleStyles}
                      textColor={textColor}
                      verseNumberColor={verseNumberColor}
                      contentPadding={contentPadding / 2}
                      indentIncrement={4}
                      selectedVerseId={selectedVerseId}
                      persistedHighlights={persistedHighlights}
                      highlightColors={highlightColors}
                      // Always use SelectableTextView for consistent height measurement
                      onTextAction={onTextAction}
                      // Report height from SelectableTextView's onContentSizeChange
                      onParagraphHeight={!measurementComplete && onParagraphLayout ? (height) => {
                        onParagraphLayout(key, height);
                      } : undefined}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        );
      })}
    </View>
  );
});

SideContent.displayName = 'SideContent';

/**
 * Aligned Chapter Item Component
 * Two-pass rendering for perfect alignment
 * Wrapped with React.memo for optimal performance in FlashList
 */
const AlignedChapterItemComponent = ({
  chapter,
  selectedVerseId,
  leftVersionId,
  rightVersionId,
  onVersePositionReady,
  onVerseLineLayout,
  onTextAction,
  persistedHighlights,
  highlightColors,
}: AlignedChapterItemProps) => {
  const { theme } = useTheme();
  const dimensions = useDimensions();

  // Cache key for this chapter + versions
  const cacheKey = `${chapter.chapterId}-${leftVersionId}-${rightVersionId}`;
  const cachedAlignment = alignmentCache.get(cacheKey);

  // Track measured heights - restore from cache if available
  const leftHeightsRef = useRef<Map<string, number>>(
    cachedAlignment?.leftParagraphHeights || new Map()
  );
  const rightHeightsRef = useRef<Map<string, number>>(
    cachedAlignment?.rightParagraphHeights || new Map()
  );
  const leftTitleHeightsRef = useRef<Map<string, number>>(
    cachedAlignment?.leftTitleHeights || new Map()
  );
  const rightTitleHeightsRef = useRef<Map<string, number>>(
    cachedAlignment?.rightTitleHeights || new Map()
  );

  // Track reported verse to avoid duplicate callbacks
  const reportedVerseRef = useRef<number | null>(null);

  // CRITICAL: Lock to prevent ANY recalculation once done
  const calculationLockRef = useRef(false);

  // Calculate expected paragraph counts SEPARATELY for left and right
  // Each side only renders its own paragraphs, so we need separate counts
  const { expectedLeftCount, expectedRightCount } = useMemo(() => {
    let leftCount = 0;
    let rightCount = 0;
    chapter.sections.forEach((section: any) => {
      leftCount += section.leftParagraphs.length;
      rightCount += section.rightParagraphs.length;
    });
    return { expectedLeftCount: leftCount, expectedRightCount: rightCount };
  }, [chapter.sections]);

  // Track measurement counts for verse position calculation only
  const [leftHeightCount, setLeftHeightCount] = useState(
    cachedAlignment ? expectedLeftCount : 0
  );
  const [rightHeightCount, setRightHeightCount] = useState(
    cachedAlignment ? expectedRightCount : 0
  );
  const [measurementPhase, setMeasurementPhase] = useState(cachedAlignment ? 1 : 0);

  const [leftPaddingMap, setLeftPaddingMap] = useState<Map<string, number>>(
    cachedAlignment?.leftPaddingMap || new Map()
  );
  const [rightPaddingMap, setRightPaddingMap] = useState<Map<string, number>>(
    cachedAlignment?.rightPaddingMap || new Map()
  );

  // Generation counter - increments on recycling to force new View instances
  // This ensures onLayout callbacks fire for fresh Views
  const [measurementGeneration, setMeasurementGeneration] = useState(0);

  // Track the last cacheKey to detect FlashList recycling
  const lastCacheKeyRef = useRef<string>(cacheKey);

  /**
   * FLASHLIST RECYCLING FIX: Reset state when component is recycled for a different chapter
   * Without this, state from the old chapter persists and causes alignment issues
   */
  useEffect(() => {
    if (lastCacheKeyRef.current === cacheKey) {
      return; // Same chapter, no reset needed
    }

    lastCacheKeyRef.current = cacheKey;

    // Check if new chapter is cached
    const newCachedAlignment = alignmentCache.get(cacheKey);

    if (newCachedAlignment) {
      // Restore from cache
      leftHeightsRef.current = new Map(newCachedAlignment.leftParagraphHeights);
      rightHeightsRef.current = new Map(newCachedAlignment.rightParagraphHeights);
      leftTitleHeightsRef.current = new Map(newCachedAlignment.leftTitleHeights);
      rightTitleHeightsRef.current = new Map(newCachedAlignment.rightTitleHeights);
      setLeftPaddingMap(newCachedAlignment.leftPaddingMap);
      setRightPaddingMap(newCachedAlignment.rightPaddingMap);
      setLeftHeightCount(expectedLeftCount);
      setRightHeightCount(expectedRightCount);
      setMeasurementPhase(1);
      calculationLockRef.current = true;
    } else {
      // Reset for fresh measurement
      leftHeightsRef.current = new Map();
      rightHeightsRef.current = new Map();
      leftTitleHeightsRef.current = new Map();
      rightTitleHeightsRef.current = new Map();
      setLeftPaddingMap(new Map());
      setRightPaddingMap(new Map());
      setLeftHeightCount(0);
      setRightHeightCount(0);
      setMeasurementPhase(0);
      calculationLockRef.current = false;
      // INCREMENT GENERATION: Forces React to create new View instances
      // This ensures onLayout callbacks fire for the fresh measurement cycle
      setMeasurementGeneration(prev => prev + 1);
    }

    // Reset reported verse
    reportedVerseRef.current = null;
  }, [cacheKey, expectedLeftCount, expectedRightCount]);

  // Initialize lock from cache on initial mount
  if (cachedAlignment && lastCacheKeyRef.current === cacheKey) {
    if (measurementPhase === 0) {
      calculationLockRef.current = true;
    }
  }

  // Callback-triggered calculation function
  const triggerCalculationIfReady = useCallback(() => {
    // GUARD 0: Absolute lock
    if (calculationLockRef.current) {
      return;
    }

    // GUARD 1: Check if all measurements are collected (each side has its own expected count)
    if (leftHeightsRef.current.size < expectedLeftCount ||
        rightHeightsRef.current.size < expectedRightCount) {
      return;
    }

    // Set lock IMMEDIATELY
    calculationLockRef.current = true;

    // Run calculation after interactions (avoid blocking UI)
    InteractionManager.runAfterInteractions(() => {

      const newLeftPadding = new Map<string, number>();
      const newRightPadding = new Map<string, number>();

      let leftCumulativeY = 0;
      let rightCumulativeY = 0;

      chapter.sections.forEach((section: any, sectionIdx: number) => {
        const maxParas = Math.max(
          section.leftParagraphs.length,
          section.rightParagraphs.length
        );

        for (let paraIdx = 0; paraIdx < maxParas; paraIdx++) {
          const key = getParagraphKey(sectionIdx, paraIdx);
          const leftHeight = leftHeightsRef.current.get(key) || 0;
          const rightHeight = rightHeightsRef.current.get(key) || 0;

          // VERSE_ALIGNED mode: Simple cumulative Y synchronization
          if (paraIdx === 0) {
            // Account for title heights in cumulative Y (first paragraph only)
            const titleKey = `title-${sectionIdx}`;
            const leftTitleHeight = leftTitleHeightsRef.current.get(titleKey) || 0;
            const rightTitleHeight = rightTitleHeightsRef.current.get(titleKey) || 0;

            leftCumulativeY += leftTitleHeight;
            rightCumulativeY += rightTitleHeight;

            // Sync cumulative Y after titles
            const titleSyncDiff = leftCumulativeY - rightCumulativeY;
            if (titleSyncDiff > 0) {
              newRightPadding.set(key, titleSyncDiff);
              rightCumulativeY += titleSyncDiff;
            } else if (titleSyncDiff < 0) {
              newLeftPadding.set(key, Math.abs(titleSyncDiff));
              leftCumulativeY += Math.abs(titleSyncDiff);
            }
          } else {
            // Sync cumulative Y BEFORE the verse renders
            const syncDiff = leftCumulativeY - rightCumulativeY;
            if (syncDiff > 0) {
              newRightPadding.set(key, syncDiff);
              rightCumulativeY += syncDiff;
            } else if (syncDiff < 0) {
              newLeftPadding.set(key, Math.abs(syncDiff));
              leftCumulativeY += Math.abs(syncDiff);
            }
          }

          // Add this verse's height to cumulative Y
          leftCumulativeY += leftHeight;
          rightCumulativeY += rightHeight;
        }
      });

      setLeftPaddingMap(newLeftPadding);
      setRightPaddingMap(newRightPadding);
      setMeasurementPhase(1);

      // Save to cache
      alignmentCache.set(cacheKey, {
        leftPaddingMap: newLeftPadding,
        rightPaddingMap: newRightPadding,
        leftTitleHeights: new Map(leftTitleHeightsRef.current),
        rightTitleHeights: new Map(rightTitleHeightsRef.current),
        leftParagraphHeights: new Map(leftHeightsRef.current),
        rightParagraphHeights: new Map(rightHeightsRef.current),
      });
    });
  }, [cacheKey, expectedLeftCount, expectedRightCount, chapter.sections]);

  // Create Bible styles
  const bibleStyles = useMemo(
    () =>
      createBibleStyles({
        theme,
        fontSize: 18,
        contentPadding: dimensions.contentPadding,
        responsiveFontSizes: getStudyModeFontSizes(dimensions.fontSize),
        isSmallScreen: dimensions.isSmallScreen,
      }),
    [theme, dimensions.contentPadding, dimensions.fontSize, dimensions.isSmallScreen]
  );

  // Colors for native text rendering (from theme)
  const textColor = theme.colors.text.primary;
  const verseNumberColor = theme.colors.verseNumber;

  // Measurement callbacks - trigger calculation when all measurements collected
  const handleLeftLayout = useCallback((key: string, height: number) => {
    // CRITICAL: Stop accepting measurements after calculation
    if (calculationLockRef.current) return;

    leftHeightsRef.current.set(key, height);

    // Update count for verse position calculation effect
    setLeftHeightCount(leftHeightsRef.current.size);

    // Trigger calculation check after this measurement
    triggerCalculationIfReady();
  }, [triggerCalculationIfReady]);

  const handleRightLayout = useCallback((key: string, height: number) => {
    // CRITICAL: Stop accepting measurements after calculation
    if (calculationLockRef.current) return;

    rightHeightsRef.current.set(key, height);

    // Update count for verse position calculation effect
    setRightHeightCount(rightHeightsRef.current.size);

    // Trigger calculation check after this measurement
    triggerCalculationIfReady();
  }, [triggerCalculationIfReady]);

  const handleLeftTitleLayout = useCallback((key: string, height: number) => {
    if (calculationLockRef.current) return;
    leftTitleHeightsRef.current.set(key, height);
  }, []);

  const handleRightTitleLayout = useCallback((key: string, height: number) => {
    if (calculationLockRef.current) return;
    rightTitleHeightsRef.current.set(key, height);
  }, []);

  // Calculate and report verse position after measurements complete
  useEffect(() => {
    if (!selectedVerseId || !onVersePositionReady) {
      return;
    }

    // Check if selected verse belongs to this chapter
    const selectedChapterId = Math.floor(selectedVerseId / 1000) * 1000;
    if (selectedChapterId !== chapter.chapterId) {
      return;
    }

    // Wait for measurements to complete (each side has its own expected count)
    if (leftHeightCount < expectedLeftCount || rightHeightCount < expectedRightCount) {
      return;
    }

    // Check if we've already reported this verse
    if (reportedVerseRef.current === selectedVerseId) {
      return;
    }

    // Calculate verse Y position by accumulating paragraph heights + padding
    let accumulatedY = 0;
    let foundVerseY: number | null = null;

    // Add chapter header height (estimate)
    accumulatedY += 60; // Approximate chapter header height

    for (let sectionIdx = 0; sectionIdx < chapter.sections.length; sectionIdx++) {
      const section = chapter.sections[sectionIdx];

      // Add title height
      const titleKey = `title-${sectionIdx}`;
      const leftTitleHeight = leftTitleHeightsRef.current.get(titleKey) || 0;
      const rightTitleHeight = rightTitleHeightsRef.current.get(titleKey) || 0;
      const maxTitleHeight = Math.max(leftTitleHeight, rightTitleHeight);
      accumulatedY += maxTitleHeight;

      const maxParas = Math.max(section.leftParagraphs.length, section.rightParagraphs.length);

      for (let paraIdx = 0; paraIdx < maxParas; paraIdx++) {
        const key = getParagraphKey(sectionIdx, paraIdx);
        const leftPara = section.leftParagraphs[paraIdx];
        const rightPara = section.rightParagraphs[paraIdx];

        // Check if this paragraph contains the selected verse
        const hasSelectedVerse =
          (leftPara && leftPara.verseLines.some((line: any) => line.verse_id === selectedVerseId)) ||
          (rightPara && rightPara.verseLines.some((line: any) => line.verse_id === selectedVerseId));

        if (hasSelectedVerse && foundVerseY === null) {
          // Found the verse! Record position before adding this paragraph's height
          foundVerseY = accumulatedY;
        }

        // Add padding for this paragraph
        const leftPadding = leftPaddingMap.get(key) || 0;
        const rightPadding = rightPaddingMap.get(key) || 0;
        const maxPadding = Math.max(leftPadding, rightPadding);
        accumulatedY += maxPadding;

        // Add paragraph height
        const leftHeight = leftHeightsRef.current.get(key) || 0;
        const rightHeight = rightHeightsRef.current.get(key) || 0;
        const maxHeight = Math.max(leftHeight, rightHeight);
        accumulatedY += maxHeight;
      }
    }

    if (foundVerseY !== null) {
      reportedVerseRef.current = selectedVerseId;
      onVersePositionReady(chapter.chapterId, selectedVerseId, foundVerseY);
    }
  }, [selectedVerseId, onVersePositionReady, chapter.chapterId, chapter.sections, leftHeightCount, rightHeightCount, expectedLeftCount, expectedRightCount, leftPaddingMap, rightPaddingMap]);

  // Reset reported verse when selectedVerseId changes
  useEffect(() => {
    reportedVerseRef.current = null;
  }, [selectedVerseId]);

  // Get chapter-specific padding (paddingTop for header, paddingBottom for end of chapter)
  const { paddingTop, paddingBottom } = useMemo(
    () => getChapterPadding(chapter.chapterId),
    [chapter.chapterId]
  );

  // Get languages for both versions to determine header display
  const { isSameLanguage, leftLanguage, rightLanguage } = useMemo(() => {
    const leftLang = bibleVersionStore$.getVersionData(leftVersionId)?.language || 'en';
    const rightLang = bibleVersionStore$.getVersionData(rightVersionId)?.language || 'en';
    return {
      isSameLanguage: leftLang === rightLang,
      leftLanguage: leftLang,
      rightLanguage: rightLang,
    };
  }, [leftVersionId, rightVersionId]);

  // Get localized chapter headers
  const localizedHeaders = useMemo(() => {
    if (isSameLanguage) {
      return {
        centered: getLocalizedChapterDisplayName(chapter.chapterId, leftLanguage),
      };
    }
    return {
      left: getLocalizedChapterDisplayName(chapter.chapterId, leftLanguage),
      right: getLocalizedChapterDisplayName(chapter.chapterId, rightLanguage),
    };
  }, [chapter.chapterId, isSameLanguage, leftLanguage, rightLanguage]);

  return (
    <View style={{ paddingBottom }}>
      {/* Chapter header - show centered if same language, split if different */}
      {chapter.sections[0] && (
        isSameLanguage ? (
          <View style={[bibleStyles.chapterHeader, { paddingTop }]}>
            <Text style={bibleStyles.chapterTitle}>
              {localizedHeaders.centered}
            </Text>
          </View>
        ) : (
          <View style={[styles.splitHeader, { paddingTop }]}>
            <View style={styles.splitHeaderLeft}>
              <Text style={bibleStyles.chapterTitle}>
                {localizedHeaders.left}
              </Text>
            </View>
            <View style={styles.splitHeaderRight}>
              <Text style={bibleStyles.chapterTitle}>
                {localizedHeaders.right}
              </Text>
            </View>
          </View>
        )
      )}

      {/* Both versions side-by-side */}
      <View style={styles.splitContainer}>
        <SideContent
          sections={chapter.sections}
          side="left"
          bibleStyles={bibleStyles}
          textColor={textColor}
          verseNumberColor={verseNumberColor}
          contentPadding={dimensions.contentPadding}
          selectedVerseId={selectedVerseId}
          onParagraphLayout={measurementPhase === 0 ? handleLeftLayout : undefined}
          onTitleLayout={measurementPhase === 0 ? handleLeftTitleLayout : undefined}
          paragraphPadding={leftPaddingMap}
          measurementPhase={measurementPhase}
          measurementGeneration={measurementGeneration}
          onVerseLineLayout={onVerseLineLayout}
          onTextAction={onTextAction}
          persistedHighlights={persistedHighlights}
          highlightColors={highlightColors}
        />

        <View style={[styles.divider, { backgroundColor: theme.colors.accent }]} />

        <SideContent
          sections={chapter.sections}
          side="right"
          bibleStyles={bibleStyles}
          textColor={textColor}
          verseNumberColor={verseNumberColor}
          contentPadding={dimensions.contentPadding}
          selectedVerseId={selectedVerseId}
          onParagraphLayout={measurementPhase === 0 ? handleRightLayout : undefined}
          onTitleLayout={measurementPhase === 0 ? handleRightTitleLayout : undefined}
          paragraphPadding={rightPaddingMap}
          measurementPhase={measurementPhase}
          measurementGeneration={measurementGeneration}
          onVerseLineLayout={onVerseLineLayout}
          onTextAction={onTextAction}
          persistedHighlights={persistedHighlights}
          highlightColors={highlightColors}
        />
      </View>
    </View>
  );
};

// ✅ PERFORMANCE FIX: Wrap with React.memo for FlashList optimization
// This prevents unnecessary re-renders when other list items update
export const AlignedChapterItem = React.memo(
  AlignedChapterItemComponent,
  (prevProps, nextProps) => {
    // Custom comparison to prevent re-renders when props haven't meaningfully changed
    return (
      prevProps.chapter.chapterId === nextProps.chapter.chapterId &&
      prevProps.selectedVerseId === nextProps.selectedVerseId &&
      prevProps.leftVersionId === nextProps.leftVersionId &&
      prevProps.rightVersionId === nextProps.rightVersionId &&
      prevProps.onVersePositionReady === nextProps.onVersePositionReady &&
      prevProps.onVerseLineLayout === nextProps.onVerseLineLayout &&
      prevProps.onTextAction === nextProps.onTextAction &&
      prevProps.persistedHighlights === nextProps.persistedHighlights &&
      prevProps.highlightColors === nextProps.highlightColors
    );
  }
);

AlignedChapterItem.displayName = 'AlignedChapterItem';

// Enable why-did-you-render tracking
// @ts-ignore - whyDidYouRender is added by the library
AlignedChapterItem.whyDidYouRender = true;

const styles = StyleSheet.create({
  splitContainer: {
    flexDirection: 'row',
    flex: 1,
  },
  divider: {
    width: 1,
  },
  splitHeader: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  splitHeaderLeft: {
    flex: 1,
    alignItems: 'center',
  },
  splitHeaderRight: {
    flex: 1,
    alignItems: 'center',
  },
});
