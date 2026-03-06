/**
 * ScrollableTextInput - TextInput that works with gesture-handler FlatList scrolling
 *
 * This component solves the multiline TextInput scroll conflict:
 * - Uses React Native's native TextInput (NOT gesture-handler TextInput)
 * - Fixed height prevents internal scrolling
 * - scrollEnabled={false} ensures no internal scroll view
 * - Parent FlatList (from gesture-handler) handles scrolling
 * - Keyboard.dismiss() on scroll blur TextInput automatically
 *
 * CRITICAL: Only use with FlatList from react-native-gesture-handler!
 * Works because both are from different systems that don't conflict:
 * - TextInput = React Native (native)
 * - FlatList = gesture-handler (JavaScript-controlled)
 */

import React, { forwardRef } from "react";
import { View, TextInput, TextInputProps, StyleSheet, TextStyle } from "react-native";
import { useHorizontalSwipe } from "../hooks/useHorizontalSwipe";

export interface ScrollableTextInputProps extends Omit<TextInputProps, 'scrollEnabled' | 'textAlignVertical'> {
  /**
   * Fixed height for the TextInput (optional)
   * - If specified: TextInput uses fixed height (prevents internal scrolling, best for multiline)
   * - If omitted: TextInput auto-sizes to content (best for single-line inputs)
   */
  height?: number;

  /**
   * Enable multiline input (default: true for backward compatibility)
   */
  multiline?: boolean;

  /**
   * Additional styles (height from this prop takes precedence)
   */
  style?: TextStyle | TextStyle[];

  /**
   * Callback for swipe gestures (optional)
   */
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;

  /**
   * Real-time feedback during horizontal swipe (optional)
   * @param deltaX - Horizontal distance from touch start (positive = right, negative = left)
   */
  onSwipeProgress?: (deltaX: number) => void;

  /**
   * Called when horizontal swipe is cancelled (optional)
   */
  onSwipeCancel?: () => void;

  /**
   * Called when TextInput receives focus (optional)
   * Used for keyboard avoidance in scrollable lists
   */
  onFocus?: () => void;

  /**
   * Called when TextInput loses focus (optional)
   * Used for keyboard avoidance in scrollable lists
   */
  onBlur?: () => void;

  /**
   * Called when selection/cursor position changes (optional)
   * Used to track cursor position for keyboard avoidance
   */
  onSelectionChange?: (event: any) => void;

  /**
   * Controlled selection/cursor position (optional)
   * When set, the TextInput's selection will be controlled
   * @example { start: 5, end: 5 } // Cursor at position 5
   */
  selection?: { start: number; end: number };

  /**
   * Called when user taps on the TextInput (optional)
   * Provides screen Y coordinate where user tapped
   * @param screenY - Y position relative to screen
   */
  onTapAtY?: (screenY: number) => void;
}

/**
 * TextInput designed to work with gesture-handler FlatList scrolling
 *
 * Key features:
 * - Fixed height (no internal scrolling)
 * - multiline support
 * - Works with FlatList from react-native-gesture-handler
 * - Focus on tap, scroll on drag
 * - Horizontal swipe detection using useHorizontalSwipe hook
 * - Doesn't interfere with vertical scrolling
 */
export const ScrollableTextInput = forwardRef<TextInput, ScrollableTextInputProps>(
  ({ height, style, multiline = true, onSwipeLeft, onSwipeRight, onSwipeProgress, onSwipeCancel, onFocus, onBlur, onSelectionChange, selection, onTapAtY, ...props }, ref) => {
    // Use horizontal swipe hook for gesture detection
    const { handleTouchStart, handleTouchMove, handleTouchEnd } = useHorizontalSwipe({
      onSwipeLeft,
      onSwipeRight,
      onSwipeProgress,
      onSwipeCancel,
      onTapAtY,
    });

    // Merge styles with optional fixed height
    const combinedStyle = [
      styles.base,
      height !== undefined && { height }, // Only apply height if specified
      style,
    ];

    // Wrap handleTouchEnd to call original onTouchEnd if provided
    const handleTouchEndWrapper = (e: any) => {
      handleTouchEnd(e);
      if (props.onTouchEnd) {
        props.onTouchEnd(e);
      }
    };

    const handleFocus = () => {
      console.log('[ScrollableTextInput] onFocus fired');
      onFocus?.();
    };

    return (
      <View
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEndWrapper}
      >
        <TextInput
          ref={ref}
          multiline={multiline}
          scrollEnabled={false}
          textAlignVertical="top"
          style={combinedStyle}
          onFocus={handleFocus}
          onBlur={onBlur}
          onSelectionChange={onSelectionChange}
          selection={selection}
          {...props}
        />
      </View>
    );
  }
);

ScrollableTextInput.displayName = "ScrollableTextInput";

const styles = StyleSheet.create({
  base: {
    // Base styles that can be overridden
    backgroundColor: "transparent",
  },
});
