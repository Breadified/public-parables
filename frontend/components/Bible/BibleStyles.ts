/**
 * Unified Bible Styles
 * Shared styling system for BibleViewerSimplified and Study Mode
 * Uses global theme configuration for consistency
 */

import { StyleSheet } from 'react-native';
import { type Theme } from '@/config/theme';

interface BibleStylesParams {
  theme: Theme;
  fontSize: number;
  contentPadding: number;
  responsiveFontSizes: {
    small: number;
    base: number;
    large: number;
    title: number;
  };
  isSmallScreen: boolean;
  splitScreen?: boolean; // Flag for split-screen mode (halves content padding)
  indentIncrement?: number; // Poetry indent per level: default 20, small screen 16, multipane 12, compact 8
}

/**
 * Create unified Bible styles for any viewer
 * Used by both BibleViewerSimplified and Study Mode components
 */
export const createBibleStyles = ({
  theme,
  fontSize,
  contentPadding,
  responsiveFontSizes,
  isSmallScreen,
  splitScreen = false,
  indentIncrement: customIndent,
}: BibleStylesParams) => {
  // For split-screen, use half the content padding
  const effectivePadding = splitScreen ? contentPadding / 2 : contentPadding;
  // Calculate indent increment based on context if not explicitly provided
  // Hierarchy: custom > splitScreen (12) > smallScreen (16) > default (20)
  const indentIncrement = customIndent ?? (splitScreen ? 12 : isSmallScreen ? 16 : 20);
  const { colors, typography, spacing, bibleTypography } = theme;
  const baseFontSize =
    responsiveFontSizes?.base ||
    fontSize ||
    bibleTypography.body.default.fontSize;

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background.primary,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.background.primary,
    },
    loadingText: {
      marginTop: spacing.lg,
      fontSize: baseFontSize,
      color: colors.text.secondary,
      fontFamily: typography.fontFamily.sansSerif,
    },

    // Chapter header - clean and elegant
    chapterHeader: {
      paddingHorizontal: effectivePadding || spacing.xl,
      paddingTop: isSmallScreen ? spacing.xl : spacing['2xl'],
      paddingBottom: isSmallScreen ? spacing.lg : spacing.xl,
      backgroundColor: colors.background.primary,
    },
    chapterTitle: {
      fontSize:
        responsiveFontSizes?.title || bibleTypography.chapterHeader.fontSize,
      fontWeight: bibleTypography.chapterHeader.fontWeight as any,
      color: colors.text.primary,
      fontFamily: bibleTypography.chapterHeader.fontFamily,
      letterSpacing: bibleTypography.chapterHeader.letterSpacing,
      textAlign: 'center' as const,
    },

    // Section headers - subtle signposts
    sectionHeader: {
      paddingHorizontal: effectivePadding || spacing.xl,
      paddingTop: isSmallScreen ? spacing.lg : spacing.xl,
      paddingBottom: spacing.xs,
    },
    sectionTitle: {
      fontSize:
        responsiveFontSizes?.small || bibleTypography.sectionHeader.fontSize,
      fontWeight: bibleTypography.sectionHeader.fontWeight as any,
      color: colors.text.muted,
      fontFamily: bibleTypography.sectionHeader.fontFamily,
      letterSpacing: bibleTypography.sectionHeader.letterSpacing,
      textTransform: bibleTypography.sectionHeader.textTransform,
      textAlign: 'center' as const,
    },
    sectionSubtitle: {
      fontSize:
        responsiveFontSizes?.small || bibleTypography.sectionHeader.fontSize,
      fontWeight: bibleTypography.sectionHeader.fontWeight as any,
      color: colors.text.muted,
      fontFamily: bibleTypography.sectionHeader.fontFamily,
      fontStyle: 'italic' as const,
      textAlign: 'center' as const,
      marginTop: spacing.xs / 2,
    },

    // Main text paragraphs with inline verse numbers
    paragraphContainer: {
      paddingHorizontal: effectivePadding || spacing.xl,
      paddingTop: spacing.xs, // Minimal top padding (4px)
      paddingBottom: spacing.xs, // Minimal bottom padding (4px)
      marginBottom: spacing.md, // 16px - paragraph spacing for readability
    },

    // Verse wrapper for floating layout
    verseWrapper: {
      position: 'relative',
      flexDirection: 'row',
      alignItems: 'flex-start',
    },

    paragraphText: {
      fontSize: baseFontSize,
      lineHeight: baseFontSize * bibleTypography.body.default.lineHeight,
      color: colors.text.primary,
      fontFamily: bibleTypography.body.default.fontFamily,
      textAlign: 'left' as const,
    },

    // Continuation text (seamless flow between verses)
    verseTextContinuation: {
      marginTop: -2,
    },

    // Poetry with elegant indentation - container without horizontal padding
    poetryContainer: {
      paddingHorizontal: 0, // No container padding - handled at line level
      paddingTop: spacing.xs, // Minimal top padding (4px)
      paddingBottom: spacing.xs, // Minimal bottom padding (4px)
    },
    poetryLine: {
      marginTop: 0, // No top margin
      marginBottom: spacing.xs / 2, // Small bottom margin only (2px)
      position: 'relative',
      minHeight: baseFontSize * bibleTypography.poetry.lineHeight,
    },
    poetryText: {
      fontSize: baseFontSize,
      lineHeight: baseFontSize * bibleTypography.poetry.lineHeight,
      color: colors.text.primary,
      fontFamily: bibleTypography.body.default.fontFamily,
    },

    // Floating verse numbers for poetry - positioned in left margin
    // Width of 24 supports 3-digit verse numbers (e.g., Psalm 119:176)
    verseNumberFloating: {
      position: 'absolute',
      left: 0, // Will be overridden inline
      top: 2,
      fontSize: responsiveFontSizes?.small || bibleTypography.verseNumber.fontSize,
      fontWeight: bibleTypography.verseNumber.fontWeight as any,
      color: colors.verseNumber,
      fontFamily: bibleTypography.verseNumber.fontFamily,
      width: 24,
      textAlign: 'right' as const, // Right align for consistency
      opacity: bibleTypography.verseNumber.opacity,
    },

    // Inline verse numbers for prose paragraphs - smaller and distinct
    // Note: marginLeft/marginRight don't work on nested Text in React Native
    // Spacing is controlled by literal space characters in the rendering logic
    verseNumberInline: {
      fontSize: responsiveFontSizes?.small || bibleTypography.verseNumber.fontSize,
      fontWeight: bibleTypography.verseNumber.fontWeight as any,
      color: colors.verseNumber,
      fontFamily: bibleTypography.verseNumber.fontFamily,
      opacity: bibleTypography.verseNumber.opacity,
    },

    // Verse selection highlighting (from search)
    // Container with bold left indicator and light background
    selectedVerseContainer: {
      flexDirection: 'row' as const,
      alignItems: 'stretch' as const,
      marginVertical: spacing.xs / 2, // 2px vertical margin
      borderRadius: 4,
      overflow: 'hidden' as const,
    },

    // Bold colored indicator on the left
    selectedVerseIndicator: {
      width: 8, // Bold 8px indicator
      backgroundColor:
        theme.mode === 'dark'
          ? 'rgba(129, 140, 248, 0.8)' // primary[400] - bold and visible
          : theme.mode === 'sepia'
          ? 'rgba(93, 64, 55, 0.8)' // brown[700] - bold warm
          : 'rgba(79, 70, 229, 0.8)', // primary[600] - bold highlight
    },

    // Light background for verse text that extends to full width
    selectedVerseTextContainer: {
      flex: 1, // Take remaining width
      backgroundColor:
        theme.mode === 'dark'
          ? 'rgba(129, 140, 248, 0.12)' // primary[400] - subtle light
          : theme.mode === 'sepia'
          ? 'rgba(93, 64, 55, 0.10)' // brown[700] - subtle warm
          : 'rgba(79, 70, 229, 0.10)', // primary[600] - subtle light
      paddingHorizontal: spacing.sm, // 8px horizontal padding
      paddingVertical: spacing.xs, // 4px vertical padding
    },

    // For inline prose highlighting (preserves paragraph flow)
    selectedVerseHighlight: {
      backgroundColor:
        theme.mode === 'dark'
          ? 'rgba(129, 140, 248, 0.20)' // primary[400] - visible highlight
          : theme.mode === 'sepia'
          ? 'rgba(93, 64, 55, 0.18)' // brown[700] - warm highlight
          : 'rgba(79, 70, 229, 0.18)', // primary[600] - bold highlight
      paddingHorizontal: spacing.xs / 2, // 2px horizontal padding
      paddingVertical: spacing.xs / 4, // 1px vertical padding
      borderRadius: 3, // Subtle rounding
    },
  });

  // Return both styles and computed values for use by renderers
  return {
    ...styles,
    // Computed indent increment for poetry indentation
    // Can be overridden by BibleContentRenderer's indentIncrement prop
    computedIndentIncrement: indentIncrement,
  };
};

/**
 * Type export for consistent usage
 */
export type BibleStyles = ReturnType<typeof createBibleStyles>;
