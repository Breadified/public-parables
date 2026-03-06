/**
 * StudyModeTypeSwitcher - Toggle between Compare and Notes modes
 *
 * Visual design with icons for clear distinction:
 * - Compare mode: Two documents side-by-side icon
 * - Notes mode: Document with pencil icon
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { observer, useSelector } from '@legendapp/state/react';
import { studyModeStore$ } from '../../state/studyModeStore';
import { StudyModeType } from '../../config/studyModeConfig';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { actionIcons } from '../../config/iconConfig';

interface StudyModeTypeSwitcherProps {
  style?: any;
}

/**
 * Mode Switcher Component
 * Allows users to toggle between COMPARE and NOTES modes
 */
export const StudyModeTypeSwitcher = observer(({ style }: StudyModeTypeSwitcherProps) => {
  const studyModeType = useSelector(studyModeStore$.studyModeType);
  const { theme } = useTheme();
  const iconColors = theme.colors.icons;

  const handleModeChange = (mode: StudyModeType) => {
    studyModeStore$.setStudyModeType(mode);
  };

  const isCompareActive = studyModeType === StudyModeType.COMPARE;
  const isNotesActive = studyModeType === StudyModeType.NOTES;

  return (
    <View style={[
      styles.container,
      { backgroundColor: iconColors.toggle.inactiveBackground },
      style
    ]}>
      {/* Compare Mode Button */}
      <TouchableOpacity
        style={[
          styles.modeButton,
          isCompareActive && { backgroundColor: iconColors.toggle.activeBackground },
        ]}
        onPress={() => handleModeChange(StudyModeType.COMPARE)}
        activeOpacity={0.7}
      >
        <Ionicons
          name={actionIcons.compare.name as any}
          size={24}
          color={isCompareActive ? iconColors.toggle.active : iconColors.toggle.inactive}
        />
        <Text
          style={[
            styles.modeText,
            { color: isCompareActive ? iconColors.toggle.active : iconColors.toggle.inactive },
          ]}
        >
          Compare
        </Text>
      </TouchableOpacity>

      {/* Notes Mode Button */}
      <TouchableOpacity
        style={[
          styles.modeButton,
          isNotesActive && { backgroundColor: iconColors.toggle.activeBackground },
        ]}
        onPress={() => handleModeChange(StudyModeType.NOTES)}
        activeOpacity={0.7}
      >
        <Ionicons
          name={actionIcons.notes.name as any}
          size={24}
          color={isNotesActive ? iconColors.toggle.active : iconColors.toggle.inactive}
        />
        <Text
          style={[
            styles.modeText,
            { color: isNotesActive ? iconColors.toggle.active : iconColors.toggle.inactive },
          ]}
        >
          Notes
        </Text>
      </TouchableOpacity>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: 8,
    padding: 4,
    gap: 8,
  },
  modeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 6,
    gap: 8,
  },
  modeText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
