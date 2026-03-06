/**
 * usePlanReadingAdapter - Transforms plan readings into study mode compatible format
 *
 * Loads verse data for plan readings, optionally loading a second version for COMPARE mode.
 * Returns data organized for simple two-column rendering.
 */

import { useState, useEffect } from "react";
import { useSelector } from "@legendapp/state/react";
import { bibleSQLite, type VerseLine } from "../services/sqlite";
import { bibleVersionStore$ } from "../state/bibleVersionStore";
import { notesStore$ } from "../state/notesStore";
import type { BiblePlanReadingData } from "../types/database";
import type { Note } from "../types/database";

/**
 * Load verse lines for a specific version by temporarily switching versions
 * Note: This is a workaround since getVerseLineRange uses currentVersion internally
 */
async function loadVerseLineRangeForVersion(
  chapterId: number,
  startVerse: number,
  endVerse: number,
  versionId: string
): Promise<VerseLine[]> {
  const originalVersion = bibleSQLite.getCurrentVersion();
  try {
    await bibleSQLite.setCurrentVersion(versionId);
    const lines = await bibleSQLite.getVerseLineRange(chapterId, startVerse, endVerse);
    return lines;
  } finally {
    // Restore original version
    await bibleSQLite.setCurrentVersion(originalVersion);
  }
}

export interface PlanReadingSection {
  reference: string;
  verseIdStart: number;
  verseIdEnd: number;
  chapterId: number;
  bookId: number;
  primaryVerseLines: VerseLine[];
  secondaryVerseLines?: VerseLine[]; // Only in COMPARE mode
  notes?: Note[]; // Only in NOTES mode
  isPoetry: boolean;
}

interface UsePlanReadingAdapterProps {
  readings: BiblePlanReadingData[];
  secondaryVersionId?: string; // For COMPARE mode
  loadNotes?: boolean; // For NOTES mode
  isActive?: boolean;
}

interface UsePlanReadingAdapterResult {
  sections: PlanReadingSection[];
  isLoading: boolean;
  error: string | null;
  primaryVersionId: string;
}

/**
 * Parse verse ID to get book, chapter, and verse numbers
 * Verse ID format: bookId * 1000000 + chapter * 1000 + verse
 */
function parseVerseId(verseId: number): {
  bookId: number;
  chapterNum: number;
  verseNum: number;
  chapterId: number;
} {
  const bookId = Math.floor(verseId / 1000000);
  const chapterNum = Math.floor((verseId % 1000000) / 1000);
  const verseNum = verseId % 1000;
  const chapterId = bookId * 1000000 + chapterNum * 1000;
  return { bookId, chapterNum, verseNum, chapterId };
}

/**
 * Hook for loading and transforming plan readings for study mode
 */
export function usePlanReadingAdapter({
  readings,
  secondaryVersionId,
  loadNotes = false,
  isActive = true,
}: UsePlanReadingAdapterProps): UsePlanReadingAdapterResult {
  const primaryVersionId = useSelector(bibleVersionStore$.primaryVersion);
  const allNotes = useSelector(notesStore$.activeNotes);

  const [sections, setSections] = useState<PlanReadingSection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load readings when inputs change
  useEffect(() => {
    if (!isActive || readings.length === 0) {
      setSections([]);
      setIsLoading(false);
      return;
    }

    loadReadings();

    async function loadReadings() {
      try {
        setIsLoading(true);
        setError(null);

        await bibleSQLite.initialize();

        const loadedSections: PlanReadingSection[] = [];

        for (const reading of readings) {
          const start = parseVerseId(reading.verse_id_start);
          const end = parseVerseId(reading.verse_id_end);

          // Handle single chapter readings
          if (start.bookId === end.bookId && start.chapterNum === end.chapterNum) {
            const primaryLines = await bibleSQLite.getVerseLineRange(
              start.chapterId,
              start.verseNum,
              end.verseNum
            );

            let secondaryLines: VerseLine[] | undefined;
            if (secondaryVersionId) {
              // Load secondary version for COMPARE mode
              secondaryLines = await loadVerseLineRangeForVersion(
                start.chapterId,
                start.verseNum,
                end.verseNum,
                secondaryVersionId
              );
            }

            // Get notes for this verse range if requested
            let notes: Note[] | undefined;
            if (loadNotes && allNotes) {
              notes = allNotes.filter(
                (note: Note) =>
                  note.verse_id !== null &&
                  note.verse_id >= reading.verse_id_start &&
                  note.verse_id <= reading.verse_id_end
              );
            }

            if (primaryLines.length > 0) {
              const hasIndent = primaryLines.some((line) => (line.indent_level || 0) > 0);
              loadedSections.push({
                reference: reading.reference,
                verseIdStart: reading.verse_id_start,
                verseIdEnd: reading.verse_id_end,
                chapterId: start.chapterId,
                bookId: start.bookId,
                primaryVerseLines: primaryLines,
                secondaryVerseLines: secondaryLines,
                notes,
                isPoetry: hasIndent,
              });
            }
          } else {
            // Multi-chapter reading - load each chapter separately
            for (let book = start.bookId; book <= end.bookId; book++) {
              const chapStart = book === start.bookId ? start.chapterNum : 1;
              const chapEnd = book === end.bookId ? end.chapterNum : 150; // Max chapters

              for (let chap = chapStart; chap <= chapEnd; chap++) {
                const chapterId = book * 1000000 + chap * 1000;
                const vStart = book === start.bookId && chap === start.chapterNum ? start.verseNum : 1;
                const vEnd = book === end.bookId && chap === end.chapterNum ? end.verseNum : 999;

                const primaryLines = await bibleSQLite.getVerseLineRange(chapterId, vStart, vEnd);

                let secondaryLines: VerseLine[] | undefined;
                if (secondaryVersionId) {
                  secondaryLines = await loadVerseLineRangeForVersion(
                    chapterId,
                    vStart,
                    vEnd,
                    secondaryVersionId
                  );
                }

                // Calculate verse ID range for this chunk
                const chunkStartVerseId = chapterId + vStart;
                const chunkEndVerseId = chapterId + vEnd;

                // Get notes for this chunk if requested
                let notes: Note[] | undefined;
                if (loadNotes && allNotes) {
                  notes = allNotes.filter(
                    (note: Note) =>
                      note.verse_id !== null &&
                      note.verse_id >= chunkStartVerseId &&
                      note.verse_id <= chunkEndVerseId
                  );
                }

                if (primaryLines.length > 0) {
                  const hasIndent = primaryLines.some((line) => (line.indent_level || 0) > 0);
                  // Create reference for this section
                  const sectionRef =
                    chap === start.chapterNum && book === start.bookId
                      ? reading.reference
                      : `${reading.reference.split(" ")[0]} ${chap}`;

                  loadedSections.push({
                    reference: sectionRef,
                    verseIdStart: chunkStartVerseId,
                    verseIdEnd: chunkEndVerseId,
                    chapterId,
                    bookId: book,
                    primaryVerseLines: primaryLines,
                    secondaryVerseLines: secondaryLines,
                    notes,
                    isPoetry: hasIndent,
                  });
                }
              }
            }
          }
        }

        setSections(loadedSections);
      } catch (err) {
        console.error("[usePlanReadingAdapter] Error loading readings:", err);
        setError(err instanceof Error ? err.message : "Failed to load readings");
      } finally {
        setIsLoading(false);
      }
    }
  }, [readings, primaryVersionId, secondaryVersionId, loadNotes, isActive, allNotes]);

  return {
    sections,
    isLoading,
    error,
    primaryVersionId,
  };
}
