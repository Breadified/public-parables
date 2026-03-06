/**
 * NoteTitle - Title input with collapse/expand button
 * Separated component for better code organization
 */

import React from "react";
import { View, TouchableOpacity, Text } from "react-native";
import Animated from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { ScrollableTextInput } from "../ScrollableTextInput";
import { formatTimestamp } from "../../utils/dateFormatters";

interface NoteTitleProps {
  title: string;
  onTitleChange: (title: string) => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
  canToggle: boolean; // Whether the note can be collapsed/expanded
  titleAnimatedStyle?: any; // Animated style for visibility
  titleRef?: React.RefObject<View | null>; // Ref for measurements
  inputRef?: React.RefObject<any>; // Ref for the input element (for focus)
  wrapperStyle: any; // Wrapper padding style
  titleStyle: any; // Dynamic text style
  containerStyle: any; // Dynamic container style
  inputWrapperStyle: any; // Dynamic input wrapper style
  chevronButtonStyle: any; // Dynamic chevron button style
  placeholderTextColor: string;
  chevronColor: string;
  timestampTextColor: string; // Color for timestamp text
  updatedAt?: string | null; // ISO timestamp for last updated date
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeProgress?: (deltaX: number) => void;
  onSwipeCancel?: () => void;
}

export const NoteTitle = ({
  title,
  onTitleChange,
  isExpanded,
  onToggleExpand,
  canToggle,
  titleAnimatedStyle,
  titleRef,
  inputRef,
  wrapperStyle,
  titleStyle,
  containerStyle,
  inputWrapperStyle,
  chevronButtonStyle,
  placeholderTextColor,
  chevronColor,
  timestampTextColor,
  updatedAt,
  onSwipeLeft,
  onSwipeRight,
  onSwipeProgress,
  onSwipeCancel,
}: NoteTitleProps) => {
  return (
    <Animated.View ref={titleRef} style={[wrapperStyle, titleAnimatedStyle]}>
      <View style={containerStyle}>
        <TouchableOpacity
          style={inputWrapperStyle}
          onPress={() => {
            // Only expand when collapsed - allow normal editing when expanded
            if (!isExpanded && canToggle) {
              onToggleExpand();
            }
          }}
          activeOpacity={isExpanded ? 1 : 0.7} // No visual feedback when expanded
          disabled={isExpanded} // Allow text input to handle touches when expanded
        >
          <ScrollableTextInput
            ref={inputRef}
            style={titleStyle}
            value={title}
            onChangeText={onTitleChange}
            placeholder="Note title (optional)"
            placeholderTextColor={placeholderTextColor}
            maxLength={200}
            returnKeyType="done"
            onSwipeLeft={onSwipeLeft}
            onSwipeRight={onSwipeRight}
            onSwipeProgress={onSwipeProgress}
            onSwipeCancel={onSwipeCancel}
            editable={isExpanded} // Only allow editing when expanded
          />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onToggleExpand}
          activeOpacity={0.7}
          style={chevronButtonStyle}
          disabled={!canToggle}
        >
          <Ionicons
            name={isExpanded ? "chevron-down" : "chevron-forward"}
            size={24}
            color={chevronColor}
          />
        </TouchableOpacity>
      </View>

      {/* Timestamp - only show updated when note has been saved - below HR */}
      {updatedAt && (
        <View style={{ marginTop: 2, paddingHorizontal: 8 }}>
          <Text
            style={{
              fontSize: 8,
              color: timestampTextColor,
              textAlign: 'right',
            }}
          >
            Updated: {formatTimestamp(updatedAt)}
          </Text>
        </View>
      )}
    </Animated.View>
  );
};
