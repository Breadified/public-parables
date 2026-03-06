/**
 * DevotionProgressMap - Progress tracker for devotion verse readings
 * Wrapper around VerticalProgressTrack with devotion-specific configuration
 */

import React from "react";

import { VerticalProgressTrack, type VerticalProgressTrackConfig } from "@/components/Shared";

interface DevotionProgressMapProps {
  /** Total number of content sections (verse groups) */
  totalSections: number;
  /** Section identifiers for keys */
  sectionIds: string[];
  /** Optional custom positions for each section (0-1), defaults to even distribution */
  sectionPositions?: number[];
  /** Whether the devotion is marked as complete */
  isComplete?: boolean;
  /** Overall scroll progress (0-1) */
  overallProgress?: number;
  /** Callback when a section node is pressed */
  onNodePress?: (index: number) => void;
}

// Devotion-specific configuration (narrower, smaller nodes)
const DEVOTION_CONFIG: VerticalProgressTrackConfig = {
  width: 28,
  nodeSize: 14,
  startNodeSize: 14,
  trackerSize: 8,
  ringSize: 8,
  ringMaxScale: 3,
  trackPadding: 8,
  trackWidth: 2,
};

const DevotionProgressMap: React.FC<DevotionProgressMapProps> = ({
  totalSections,
  sectionIds,
  sectionPositions,
  isComplete = false,
  overallProgress = 0,
  onNodePress,
}) => {
  return (
    <VerticalProgressTrack
      totalSections={totalSections}
      sectionIds={sectionIds}
      sectionPositions={sectionPositions}
      isComplete={isComplete}
      progress={overallProgress}
      onNodePress={onNodePress}
      config={DEVOTION_CONFIG}
    />
  );
};

export default DevotionProgressMap;
