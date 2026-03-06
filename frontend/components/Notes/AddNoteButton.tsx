/**
 * AddNoteButton - Simple "+" button to create a new note
 * Appears below collapsed notes in a chapter
 */

import React, { forwardRef } from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';

interface AddNoteButtonProps {
  onPress: () => void;
}

export const AddNoteButton = forwardRef<View, AddNoteButtonProps>(
  ({ onPress }, ref) => {
    const { theme } = useTheme();

    return (
      <View ref={ref}>
        <TouchableOpacity
          onPress={onPress}
          style={[
            styles.button,
            {
              backgroundColor: theme.colors.background.secondary,
              borderColor: theme.colors.accent,
            },
          ]}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.plusIcon,
              {
                color: theme.colors.accent,
              },
            ]}
          >
            +
          </Text>
        </TouchableOpacity>
      </View>
    );
  }
);

AddNoteButton.displayName = 'AddNoteButton';

const styles = StyleSheet.create({
  button: {
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    marginVertical: 12,
  },
  plusIcon: {
    fontSize: 24,
    fontWeight: '300',
  },
});
