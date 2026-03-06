import React, { useMemo } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

interface LoadingScriptureOverlayProps {
  /**
   * Whether to show the overlay
   */
  visible?: boolean;
}

/**
 * Loading Scripture Overlay
 * Displays a semi-transparent overlay with loading indicator and text
 * Used during Bible content loading and alignment calculations
 */
export const LoadingScriptureOverlay: React.FC<LoadingScriptureOverlayProps> = ({
  visible = true,
}) => {
  const { theme } = useTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        overlay: {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor:
            theme.mode === 'dark'
              ? 'rgba(0, 0, 0, 0.7)'
              : 'rgba(255, 255, 255, 0.7)',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          pointerEvents: 'none', // Allow touch events to pass through
        },
        text: {
          marginTop: 12,
          fontSize: 16,
          color: theme.colors.text.primary,
          fontWeight: '500',
          fontFamily: theme.typography.fontFamily.sansSerif,
        },
      }),
    [theme]
  );

  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <ActivityIndicator
        size="large"
        color={theme.mode === 'dark' ? '#60A5FA' : '#6366F1'}
      />
      <Text style={styles.text}>Loading Scripture...</Text>
    </View>
  );
};
