/**
 * Auto-scroll to selected verse logic
 * Shared between BibleViewerSimplified and DiffAlignedSplitView
 */

import { useEffect, useRef } from 'react';
import { Dimensions } from 'react-native';

interface AutoScrollToVerseParams {
  selectedVerseId: number | null;
  isActive: boolean;
  flashListRef: React.RefObject<any>;
  findVerseItem: (verseId: number) => { index: number; offset?: number }; // Returns item index and optional offset within item
  isLoading?: boolean;
}

/**
 * Hook to auto-scroll to selected verse
 * Positions verse 1/3 from top with proper handling for verses at chapter start
 */
export function useAutoScrollToVerse({
  selectedVerseId,
  isActive,
  flashListRef,
  findVerseItem,
  isLoading = false,
}: AutoScrollToVerseParams) {
  const lastScrolledVerseId = useRef<number | null>(null);

  useEffect(() => {
    // Only scroll if:
    // 1. We have a selected verse
    // 2. Data is loaded
    // 3. This is a NEW selection (not the same verse we already scrolled to)
    // 4. This is the active tab/viewer
    if (
      !selectedVerseId ||
      isLoading ||
      selectedVerseId === lastScrolledVerseId.current ||
      !isActive ||
      !flashListRef.current
    ) {
      return;
    }

    lastScrolledVerseId.current = selectedVerseId;

    // Find the item containing this verse
    const result = findVerseItem(selectedVerseId);

    if (result.index < 0) {
      return; // Verse not found
    }

    // Calculate desired position: 1/3 from top
    const screenHeight = Dimensions.get('window').height;
    const desiredTopOffset = screenHeight / 3;

    // Use setTimeout to ensure rendering is complete
    setTimeout(() => {
      if (!flashListRef.current) return;

      try {
        // Strategy: Use scrollToIndex with viewPosition to control where item appears
        // viewPosition: 0 = top of viewport, 0.5 = middle, 1 = bottom
        // We want item at 1/3 from top, which is position ~0.33

        // Calculate viewPosition based on desired offset
        const viewPosition = desiredTopOffset / screenHeight;

        flashListRef.current.scrollToIndex({
          index: result.index,
          animated: true,
          viewPosition: viewPosition, // Position the item at 1/3 from top
        });
      } catch (error) {
        console.warn('[AutoScroll] Failed to scroll to verse:', error);

        // Fallback: Try without animation if first attempt fails
        try {
          flashListRef.current?.scrollToIndex({
            index: result.index,
            animated: false,
            viewPosition: 0.33,
          });
        } catch (fallbackError) {
          console.warn('[AutoScroll] Fallback scroll also failed:', fallbackError);
        }
      }
    }, 150); // Slightly longer delay for reliability
  }, [selectedVerseId, isActive, isLoading, flashListRef, findVerseItem]);

  return { lastScrolledVerseId };
}

/**
 * Find item index containing verse in BibleViewerSimplified items
 */
export function findVerseInSimplifiedItems(
  items: any[],
  verseId: number
): { index: number; offset?: number } {
  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    if (item.type === 'paragraph') {
      const hasVerse = item.verseLines?.some(
        (line: any) => line.verse_id === verseId
      );
      if (hasVerse) return { index: i };
    } else if (item.type === 'merged-paragraph') {
      const hasVerse = item.paragraphs?.some((para: any) =>
        para.verseLines?.some((line: any) => line.verse_id === verseId)
      );
      if (hasVerse) return { index: i };
    }
  }

  return { index: -1 }; // Not found
}

/**
 * Find chapter index containing verse in DiffAlignedSplitView chapters
 */
export function findVerseInChapters(
  chapters: any[],
  verseId: number
): { index: number; offset?: number } {
  // Calculate target chapter ID from verse ID
  // Verse ID format: BBCCCVVV (Book Chapter Verse)
  const bookId = Math.floor(verseId / 1000000);
  const chapterNum = Math.floor((verseId % 1000000) / 1000);
  const targetChapterId = bookId * 1000000 + chapterNum * 1000;

  // Find the chapter in our data
  const index = chapters.findIndex((ch) => ch.chapterId === targetChapterId);
  return { index };
}

/**
 * Find chapter index by chapter ID
 */
export function findChapterInChapters(
  chapters: any[],
  chapterId: number
): { index: number; offset?: number } {
  const index = chapters.findIndex((ch) => ch.chapterId === chapterId);
  return { index };
}
