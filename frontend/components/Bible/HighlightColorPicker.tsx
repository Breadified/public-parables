/**
 * Highlight Color Picker Component
 * Modal for selecting highlight colors for verse highlighting
 */

import React, { useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Pressable,
} from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import type { HighlightColorName } from '../../config/theme';

interface HighlightColorPickerProps {
  visible: boolean;
  onClose: () => void;
  onColorSelect: (color: HighlightColorName) => void;
  onRemoveHighlight?: () => void;
  existingColor?: HighlightColorName;
}

const COLOR_OPTIONS: { name: HighlightColorName; label: string }[] = [
  { name: 'yellow', label: 'Yellow' },
  { name: 'green', label: 'Green' },
  { name: 'blue', label: 'Blue' },
  { name: 'pink', label: 'Pink' },
  { name: 'orange', label: 'Orange' },
];

export const HighlightColorPicker: React.FC<HighlightColorPickerProps> = ({
  visible,
  onClose,
  onColorSelect,
  onRemoveHighlight,
  existingColor,
}) => {
  const { theme } = useTheme();

  const handleColorPress = useCallback(
    (color: HighlightColorName) => {
      onColorSelect(color);
      onClose();
    },
    [onColorSelect, onClose]
  );

  const handleRemovePress = useCallback(() => {
    onRemoveHighlight?.();
    onClose();
  }, [onRemoveHighlight, onClose]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <View
          style={[
            styles.container,
            { backgroundColor: theme.colors.background.elevated },
          ]}
        >
          <Text
            style={[styles.title, { color: theme.colors.text.primary }]}
          >
            Highlight Color
          </Text>

          <View style={styles.colorsContainer}>
            {COLOR_OPTIONS.map(({ name, label }) => {
              const colorConfig = theme.colors.highlightColors[name];
              const isSelected = existingColor === name;

              return (
                <TouchableOpacity
                  key={name}
                  style={styles.colorOption}
                  onPress={() => handleColorPress(name)}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.colorCircle,
                      { backgroundColor: colorConfig.indicator },
                      isSelected && styles.colorCircleSelected,
                    ]}
                  >
                    {isSelected && (
                      <Text style={styles.checkmark}>✓</Text>
                    )}
                  </View>
                  <Text
                    style={[
                      styles.colorLabel,
                      { color: theme.colors.text.secondary },
                    ]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {onRemoveHighlight && (
            <TouchableOpacity
              style={[
                styles.removeButton,
                { borderColor: theme.colors.border },
              ]}
              onPress={handleRemovePress}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.removeButtonText,
                  { color: theme.colors.text.secondary },
                ]}
              >
                Remove Highlight
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.cancelButtonText,
                { color: theme.colors.text.muted },
              ]}
            >
              Cancel
            </Text>
          </TouchableOpacity>
        </View>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '85%',
    maxWidth: 320,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 20,
  },
  colorsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 20,
  },
  colorOption: {
    alignItems: 'center',
  },
  colorCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  colorCircleSelected: {
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.8)',
  },
  checkmark: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  colorLabel: {
    fontSize: 12,
  },
  removeButton: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 12,
  },
  removeButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  cancelButton: {
    paddingVertical: 8,
  },
  cancelButtonText: {
    fontSize: 14,
  },
});
