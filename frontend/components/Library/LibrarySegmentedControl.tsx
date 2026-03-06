/**
 * LibrarySegmentedControl - Segmented control for Library tab sections
 * [ Notes | My Comments | Liked ]
 */

import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { observer } from "@legendapp/state/react";
import { useTheme } from "@/contexts/ThemeContext";
import type { LibrarySegment } from "@/state";

interface SegmentOption {
  key: LibrarySegment;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  count?: number;
}

interface LibrarySegmentedControlProps {
  segments: SegmentOption[];
  activeKey: LibrarySegment;
  onSelect: (key: LibrarySegment) => void;
}

const LibrarySegmentedControl = observer(function LibrarySegmentedControl({
  segments,
  activeKey,
  onSelect,
}: LibrarySegmentedControlProps) {
  const { theme } = useTheme();

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.colors.background.secondary },
      ]}
    >
      {segments.map((segment) => {
        const isActive = segment.key === activeKey;
        return (
          <Pressable
            key={segment.key}
            style={[
              styles.segment,
              isActive && [
                styles.activeSegment,
                { backgroundColor: theme.colors.background.primary },
              ],
            ]}
            onPress={() => onSelect(segment.key)}
          >
            <Ionicons
              name={segment.icon}
              size={16}
              color={isActive ? theme.colors.text.primary : theme.colors.text.muted}
            />
            <Text
              style={[
                styles.segmentText,
                {
                  color: isActive
                    ? theme.colors.text.primary
                    : theme.colors.text.muted,
                },
                isActive && styles.activeSegmentText,
              ]}
              numberOfLines={1}
            >
              {segment.label}
            </Text>
            {segment.count !== undefined && segment.count > 0 && (
              <Text
                style={[
                  styles.countText,
                  {
                    color: isActive
                      ? theme.colors.text.secondary
                      : theme.colors.text.muted,
                  },
                ]}
              >
                {segment.count}
              </Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
});

export default LibrarySegmentedControl;

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    borderRadius: 10,
    padding: 4,
    marginHorizontal: 16,
    marginVertical: 8,
  },
  segment: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  activeSegment: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: "500",
  },
  activeSegmentText: {
    fontWeight: "600",
  },
  countText: {
    fontSize: 11,
    fontWeight: "500",
  },
});
