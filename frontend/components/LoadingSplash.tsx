import React, { useMemo } from 'react';
import { StyleSheet, ActivityIndicator, View, Text, useColorScheme } from 'react-native';
import { observer } from '@legendapp/state/react';
import { useUnifiedData } from '@/hooks/useUnifiedData';
import { getTheme } from '@/config/theme';

export const LoadingSplash = observer(() => {
  const { isLoading, dataLoadingStatus } = useUnifiedData();
  const systemColorScheme = useColorScheme();
  const themeMode = systemColorScheme === 'dark' ? 'dark' : 'light';
  const theme = useMemo(() => getTheme(themeMode), [themeMode]);
  const styles = useMemo(() => createStyles(theme), [theme]);

  if (!isLoading) return null;

  // Calculate progress from blocking tasks only (embeddings load in background)
  const getLoadingProgress = () => {
    const statuses = Object.values(dataLoadingStatus);
    const completed = statuses.filter(Boolean).length;
    const total = statuses.length;
    return Math.round((completed / total) * 100);
  };

  const getLoadingMessage = () => {
    if (!dataLoadingStatus.auth) return "Restoring session...";
    if (!dataLoadingStatus.tabs) return "Loading your tabs...";
    if (!dataLoadingStatus.notes) return "Loading your notes...";
    if (!dataLoadingStatus.versions) return "Initializing Bible versions...";
    if (!dataLoadingStatus.settings) return "Loading settings...";
    return "Almost ready...";
  };

  const progress = getLoadingProgress();
  const message = getLoadingMessage();

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Parables Bible</Text>
        <Text style={styles.subtitle}>Loading Scripture...</Text>
        
        <View style={styles.loadingContainer}>
          <ActivityIndicator
            size="large"
            color={theme.colors.interactive.button.background}
            style={styles.spinner}
          />

          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${progress}%` }]} />
            </View>
            <Text style={styles.progressText}>{progress}%</Text>
          </View>

          <Text style={styles.message}>{message}</Text>
        </View>
      </View>
    </View>
  );
});

const createStyles = (theme: ReturnType<typeof getTheme>) => StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background.primary,
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: theme.colors.text.primary,
    marginBottom: 8,
    fontFamily: theme.typography.fontFamily.serif,
  },
  subtitle: {
    fontSize: 18,
    color: theme.colors.text.secondary,
    marginBottom: 40,
    fontFamily: theme.typography.fontFamily.sansSerif,
  },
  loadingContainer: {
    alignItems: 'center',
    width: '100%',
  },
  spinner: {
    marginBottom: 30,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 20,
  },
  progressBar: {
    flex: 1,
    height: 8,
    backgroundColor: theme.mode === 'dark' ? theme.colors.border : '#e0e0e0',
    borderRadius: 4,
    marginRight: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.colors.interactive.button.background,
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text.primary,
    minWidth: 40,
    textAlign: 'right',
    fontFamily: theme.typography.fontFamily.mono,
  },
  message: {
    fontSize: 16,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    marginTop: 10,
    fontFamily: theme.typography.fontFamily.sansSerif,
  },
});