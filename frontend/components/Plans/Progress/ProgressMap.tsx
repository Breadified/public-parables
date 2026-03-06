/**
 * ProgressMap - Vertical progress tracker for plan readings
 * Wrapper around VerticalProgressTrack with plan-specific positioning
 *
 * Features:
 * - Nodes positioned at actual reading locations (not evenly distributed)
 * - Optional recap node when content starts after 0
 * - Larger nodes for better visibility in sidebar
 */

import React, { useMemo } from "react";

import { VerticalProgressTrack, type VerticalProgressTrackConfig } from "@/components/Shared";

interface ProgressMapProps {
  /** Total number of readings for the day */
  totalReadings: number;
  /** Scroll positions for each reading (0-1) - unused, kept for API compatibility */
  readingScrollPositions?: Record<string, number>;
  /** Start positions for each reading (0-1) - where each reading begins in content */
  readingStartPositions?: Record<string, number>;
  /** Reading IDs in order */
  readingIds: string[];
  /** Whether the day is marked as complete */
  isDayComplete?: boolean;
  /** Overall scroll progress (0-1) from ScrollView */
  overallProgress?: number;
  /** Threshold for considering a reading complete (0-1) - unused, kept for API compatibility */
  completionThreshold?: number;
  /** Callback when a reading node is pressed */
  onNodePress?: (index: number) => void;
}

// Plan-specific configuration (wider, larger nodes)
const PLAN_CONFIG: VerticalProgressTrackConfig = {
  width: 32,
  nodeSize: 18,
  startNodeSize: 18,
  trackerSize: 10,
  ringSize: 10,
  ringMaxScale: 3,
  trackPadding: 8,
  trackWidth: 3,
};

const ProgressMap: React.FC<ProgressMapProps> = ({
  totalReadings,
  readingStartPositions = {},
  readingIds,
  isDayComplete = false,
  overallProgress = 0,
  onNodePress,
}) => {
  // Check if there's recap content before first reading
  const firstReadingPosition = readingIds.length > 0
    ? readingStartPositions[readingIds[0]] ?? 0
    : 0;
  const hasRecap = firstReadingPosition > 0.05;

  // Calculate section positions based on reading start positions
  // Structure: [recapEnd (if hasRecap), reading0End, reading1End, ..., lastReadingEnd]
  const { sectionIds, sectionPositions } = useMemo(() => {
    if (totalReadings === 0) {
      return { sectionIds: [], sectionPositions: [] };
    }

    const ids: string[] = [];
    const positions: number[] = [];

    // If there's recap, add a node at where the first reading starts
    if (hasRecap) {
      ids.push("recap");
      positions.push(firstReadingPosition);
    }

    // Reading end positions - each reading ends where the next one starts
    for (let i = 0; i < totalReadings; i++) {
      const readingId = readingIds[i];
      ids.push(readingId || `reading-${i}`);

      let endPosition: number;
      if (i < totalReadings - 1) {
        // Non-last readings end where next reading starts
        const nextReadingId = readingIds[i + 1];
        endPosition = readingStartPositions[nextReadingId] ?? ((i + 1) / totalReadings);
      } else {
        // Last reading ends at 1.0
        endPosition = 1;
      }
      positions.push(endPosition);
    }

    return { sectionIds: ids, sectionPositions: positions };
  }, [totalReadings, readingIds, readingStartPositions, hasRecap, firstReadingPosition]);

  // Total sections = recap (if present) + readings
  const totalSections = hasRecap ? totalReadings + 1 : totalReadings;

  // Adjust node press index to account for recap
  const handleNodePress = (index: number) => {
    if (!onNodePress) return;

    if (index === -1) {
      // Start node - scroll to top
      onNodePress(-1);
    } else if (hasRecap && index === 0) {
      // Recap node - scroll to top (recap is at the beginning)
      onNodePress(-1);
    } else {
      // Reading node - adjust index if recap exists
      const readingIndex = hasRecap ? index - 1 : index;
      onNodePress(readingIndex);
    }
  };

  return (
    <VerticalProgressTrack
      totalSections={totalSections}
      sectionIds={sectionIds}
      sectionPositions={sectionPositions}
      isComplete={isDayComplete}
      progress={overallProgress}
      onNodePress={onNodePress ? handleNodePress : undefined}
      config={PLAN_CONFIG}
    />
  );
};

export default ProgressMap;
