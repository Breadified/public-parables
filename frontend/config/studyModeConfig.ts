/**
 * Study Mode Configuration
 * Centralized settings for Study Mode behavior and display
 */

/**
 * Study mode types - what kind of study experience
 */
export enum StudyModeType {
  /**
   * COMPARE - Side-by-side Bible version comparison
   * - Left pane: Primary version (e.g., ESV)
   * - Right pane: Comparison version (e.g., NIV)
   * - Verse-aligned or diff-aligned rendering
   */
  COMPARE = 'COMPARE',

  /**
   * NOTES - Bible with note-taking
   * - Left pane: Bible reader
   * - Right pane: Note editor (aligned with chapter)
   * - Notes auto-save with debouncing
   */
  NOTES = 'NOTES',
}

/**
 * Alignment modes for study mode display
 */
export enum AlignmentMode {
  /**
   * VERSE_ALIGNED (Simple & Performant)
   * - Every verse is split into its own paragraph
   * - No complex calculations or height measurements
   * - Perfect 1:1 alignment always guaranteed
   * - Minimal CPU usage, instant rendering
   * - Recommended for most users
   */
  VERSE_ALIGNED = 'VERSE_ALIGNED',

  /**
   * DIFF_ALIGNED (Complex & Compute-Intensive)
   * - Preserves original paragraph structure
   * - Analyzes character density to detect drift
   * - Intelligently splits paragraphs when needed
   * - Requires async chunked calculations
   * - Advanced users who want original formatting
   */
  DIFF_ALIGNED = 'DIFF_ALIGNED',
}

export const studyModeConfig = {
  /**
   * Default study mode type
   * COMPARE: Side-by-side Bible version comparison
   * NOTES: Bible with note-taking pane
   */
  defaultStudyModeType: StudyModeType.COMPARE,

  /**
   * Default alignment mode for study mode
   * VERSE_ALIGNED: Simple, performant, always perfect alignment
   * DIFF_ALIGNED: Complex, preserves formatting, requires calculations
   */
  defaultAlignmentMode: AlignmentMode.VERSE_ALIGNED,

  /**
   * Verse position divergence threshold for DIFF_ALIGNED mode only
   * (Not used in VERSE_ALIGNED mode)
   *
   * During chapter load, we analyze verse positions within prose paragraphs.
   * When verse positions diverge beyond this threshold between two versions,
   * we intelligently split paragraphs at that verse to maintain alignment.
   *
   * This prevents misalignment when one version (e.g., Chinese) renders much shorter
   * than another (e.g., English) for the same verses.
   *
   * Example:
   * - English paragraph (verses 1-5): v1=0px, v2=40px, v3=80px, v4=120px, v5=160px
   * - Chinese paragraph (verses 1-5): v1=0px, v2=20px, v3=40px, v4=60px, v5=80px
   * - At verse 3: divergence = |80-40| = 40px (ok)
   * - At verse 4: divergence = |(120-80) - (60-40)| = |40-20| = 20px (ok)
   * - If divergence exceeds 60px, we split both paragraphs at that verse
   *
   * This calculation happens ONCE during chapter load and is memoized.
   */
  paragraphHeightDifferenceThreshold: 60, // pixels - approximately 2-3 lines of text at default size
} as const;

/**
 * Type for study mode configuration
 */
export type StudyModeConfig = typeof studyModeConfig;
