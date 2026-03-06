/**
 * Search Modal - Main container
 * Refactored to use SearchInterface component
 */

import React, { useCallback, useMemo, useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { observer, useSelector } from '@legendapp/state/react';
import { navigateToVerse, navigateToChapter } from '@/modules/bible/tabManager';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { getTheme } from '@/config/theme';
import { SearchInterface } from './SearchInterface';
import { SearchModeTutorial } from '@/components/Tutorial/SearchModeTutorial';
import { tutorialStore$ } from '@/state/tutorialStore';

interface SearchModalProps {
  visible: boolean;
  onClose: () => void;
}

export const SearchModal = observer(({ visible, onClose }: SearchModalProps) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();

  // Tutorial state
  const [showTutorial, setShowTutorial] = useState(false);
  const completedSearchModeTutorial = useSelector(tutorialStore$.completedSearchModeTutorial);

  // Show tutorial when modal opens for first time
  useEffect(() => {
    if (visible && !completedSearchModeTutorial) {
      // Small delay to let modal animate in first
      const timer = setTimeout(() => {
        setShowTutorial(true);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [visible, completedSearchModeTutorial]);

  // Handle tutorial dismiss
  const handleTutorialDismiss = useCallback(() => {
    setShowTutorial(false);
    tutorialStore$.completeSearchModeTutorial();
  }, []);

  // Handle selection from SearchInterface
  const handleSelect = useCallback(({ chapterId, verseId, bookName, chapter, verse }: {
    bookId: number;
    chapterId: number;
    verseId: number | null;
    bookName: string;
    chapter: number;
    verse?: number;
  }) => {
    // Navigate based on whether verse is specified
    if (verseId && verse) {
      navigateToVerse(chapterId, bookName, chapter, verseId);
    } else {
      navigateToChapter(chapterId, bookName, chapter);
    }
    onClose();
  }, [onClose]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent={true}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <View style={styles.modal}>
          <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
            <Text style={styles.title}>Bible Navigation</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <SearchInterface
            onSelect={handleSelect}
            mode="navigate"
            onClose={onClose}
            autoFocus={true}
            paddingBottom={Math.max(20, insets.bottom + 20)}
          />
        </View>
      </KeyboardAvoidingView>

      {/* Search Mode Tutorial - shown on first use */}
      <SearchModeTutorial
        visible={showTutorial}
        onDismiss={handleTutorialDismiss}
      />
    </Modal>
  );
});

const createStyles = (theme: ReturnType<typeof getTheme>) => StyleSheet.create({
  keyboardView: {
    flex: 1,
    width: '100%',
    backgroundColor: theme.colors.background.primary,
  },
  modal: {
    flex: 1,
    width: '100%',
    backgroundColor: theme.colors.background.primary,
    overflow: 'hidden',
    flexDirection: 'column' as const,
  },
  header: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.background.secondary,
  },
  title: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.semibold as any,
    color: theme.colors.text.primary,
    fontFamily: theme.typography.fontFamily.sansSerif,
  },
  closeButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: theme.typography.fontSize.xl,
    color: theme.colors.text.secondary,
    fontWeight: theme.typography.fontWeight.bold as any,
    fontFamily: theme.typography.fontFamily.sansSerif,
  },
});
