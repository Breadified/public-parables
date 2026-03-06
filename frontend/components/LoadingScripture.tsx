/**
 * LoadingScripture - Full-screen overlay shown during initial Bible loading
 *
 * Prevents showing incorrect chapter positions during tab restoration
 */

import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

interface LoadingScriptureProps {
  /** Whether to show the loading overlay */
  visible: boolean;
}

export const LoadingScripture: React.FC<LoadingScriptureProps> = ({ visible }) => {
  const { theme } = useTheme();

  if (!visible) {
    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background.primary }]}>
      <ActivityIndicator size="large" color={theme.colors.text.primary} />
      <Text style={[styles.text, { color: theme.colors.text.primary }]}>
        Loading Scripture...
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  text: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '500',
  },
});
