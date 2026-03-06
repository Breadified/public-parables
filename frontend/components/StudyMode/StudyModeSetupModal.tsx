/**
 * StudyModeSetupModal - Modern, intuitive study mode setup
 *
 * Two-step process:
 * 1. Choose mode: Compare (versions) or Notes (note-taking)
 * 2. If Compare mode: Select comparison version
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  StatusBar,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import { StudyModeType } from '../../config/studyModeConfig';
import { VersionSelector } from '../VersionSelector';
import type { BibleVersion } from '../../state/studyModeStore';
import { actionIcons, studyModeConfig } from '../../config/iconConfig';

interface StudyModeSetupModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectCompare: (version: BibleVersion) => void;
  onSelectNotes: (message?: string) => void;
  availableVersions: BibleVersion[];
  currentVersion?: string;
}

/**
 * Study Mode Setup Modal
 * Step 1: Choose between Compare and Notes modes
 * Step 2: If Compare, select version
 */
export const StudyModeSetupModal: React.FC<StudyModeSetupModalProps> = ({
  visible,
  onClose,
  onSelectCompare,
  onSelectNotes,
  availableVersions,
  currentVersion,
}) => {
  const [step, setStep] = useState<'mode' | 'version'>('mode');
  const [selectedMode, setSelectedMode] = useState<StudyModeType | null>(null);
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  // Reset to first step when modal closes
  const handleClose = () => {
    setStep('mode');
    setSelectedMode(null);
    onClose();
  };

  // Handle mode selection
  const handleModeSelect = (mode: StudyModeType) => {
    setSelectedMode(mode);

    if (mode === StudyModeType.NOTES) {
      // Notes mode - activate immediately with contextual message
      onSelectNotes(
        "Sign in to save your notes online and sync across all your devices"
      );
      handleClose();
    } else {
      // Compare mode - proceed to version selection
      setStep('version');
    }
  };

  // Handle version selection (for Compare mode)
  const handleVersionSelect = (version: BibleVersion) => {
    onSelectCompare(version);
    handleClose();
  };

  // Show version selector if in version step
  if (step === 'version') {
    return (
      <VersionSelector
        visible={visible}
        onClose={handleClose}
        onSelectVersion={handleVersionSelect}
        availableVersions={availableVersions}
        currentVersion={currentVersion}
        excludeVersion={currentVersion}
        title="Select Version to Compare"
      />
    );
  }

  // Get icon colors from theme
  const iconColors = theme.colors.icons;

  // Helper to render a mode card
  const renderModeCard = (
    mode: 'COMPARE' | 'NOTES',
    studyModeType: StudyModeType
  ) => {
    const config = studyModeConfig[mode];
    const isSelected = selectedMode === studyModeType;

    return (
      <TouchableOpacity
        style={[
          styles.modeCard,
          {
            backgroundColor: theme.colors.background.primary,
            borderColor: isSelected ? iconColors.accent : theme.colors.border,
          },
          isSelected && {
            backgroundColor: iconColors.toggle.activeBackground + '10'
          },
        ]}
        onPress={() => handleModeSelect(studyModeType)}
        activeOpacity={0.7}
      >
        <View style={styles.iconContainer}>
          <Ionicons
            name={config.icon.name as any}
            size={48}
            color={iconColors.accent}
          />
        </View>
        <Text style={[styles.modeTitle, { color: theme.colors.text.primary }]}>
          {config.label}
        </Text>
        <Text style={[styles.modeDescription, { color: theme.colors.text.secondary }]}>
          {config.description}
        </Text>
        <View style={styles.featureList}>
          {config.features.map((feature, index) => (
            <View key={index} style={styles.featureItem}>
              <Ionicons
                name={actionIcons.checkmark.name as any}
                size={16}
                color={iconColors.success}
              />
              <Text style={[styles.featureText, { color: theme.colors.text.primary }]}>
                {feature}
              </Text>
            </View>
          ))}
        </View>
      </TouchableOpacity>
    );
  };

  // Step 1: Mode selection
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      statusBarTranslucent={true}
      onRequestClose={handleClose}
    >
      <View style={[
        styles.fullScreenContainer,
        { backgroundColor: theme.colors.background.secondary }
      ]}>
        {/* Header with safe area padding */}
        <View style={[
          styles.modalHeader,
          {
            borderBottomColor: theme.colors.border,
            paddingTop: (insets.top || StatusBar.currentHeight || 20) + 16,
          }
        ]}>
          <Text style={[
            styles.modalTitle,
            { color: theme.colors.text.primary }
          ]}>
            Choose Study Mode
          </Text>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Ionicons
              name={actionIcons.close.name as any}
              size={28}
              color={theme.colors.text.secondary}
            />
          </TouchableOpacity>
        </View>

        {/* Mode Cards - Scrollable */}
        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={[
            styles.contentContainer,
            { paddingBottom: insets.bottom + 24 }
          ]}
        >
          <View style={styles.modeCards}>
            {renderModeCard('COMPARE', StudyModeType.COMPARE)}
            {renderModeCard('NOTES', StudyModeType.NOTES)}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  fullScreenContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  closeButton: {
    padding: 4,
  },
  scrollContainer: {
    flex: 1,
  },
  contentContainer: {
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  modeCards: {
    gap: 16,
  },
  modeCard: {
    padding: 24,
    borderRadius: 16,
    borderWidth: 2,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  modeTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  modeDescription: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  featureList: {
    gap: 12,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  featureText: {
    fontSize: 15,
    fontWeight: '500',
  },
});
