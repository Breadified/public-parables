/**
 * Chapter Padding Utilities
 *
 * Provides consistent padding for first and last chapters of the Bible
 * across all viewer components.
 */

/**
 * Chapter IDs for first and last chapters
 */
const GENESIS_1_CHAPTER_ID = 1001000; // Book 1, Chapter 1
const REVELATION_22_CHAPTER_ID = 66022000; // Book 66, Chapter 22

/**
 * Get special padding for first and last chapters of the Bible
 *
 * @param chapterId - The chapter ID to check
 * @returns Object with paddingTop and paddingBottom values
 *
 * @example
 * ```tsx
 * const { paddingTop, paddingBottom } = getChapterPadding(chapterId);
 * <View style={[styles.chapterHeader, { paddingTop, paddingBottom }]}>
 * ```
 */
export function getChapterPadding(chapterId: number): {
  paddingTop: number;
  paddingBottom: number;
} {
  const isFirstChapter = chapterId === GENESIS_1_CHAPTER_ID;
  const isLastChapter = chapterId === REVELATION_22_CHAPTER_ID;

  return {
    paddingTop: isFirstChapter ? 125 : 75,
    paddingBottom: isLastChapter ? 125 : 0, // Extra padding at end of Bible
  };
}

/**
 * Check if chapter is the first chapter of the Bible (Genesis 1)
 */
export function isFirstChapter(chapterId: number): boolean {
  return chapterId === GENESIS_1_CHAPTER_ID;
}

/**
 * Check if chapter is the last chapter of the Bible (Revelation 22)
 */
export function isLastChapter(chapterId: number): boolean {
  return chapterId === REVELATION_22_CHAPTER_ID;
}
