import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme as useSystemColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { getTheme, Theme, ThemeMode } from '../config/theme';

interface ThemeContextType {
  theme: Theme;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode | 'system') => void;
  userPreference: ThemeMode | 'system';
  systemTheme: 'light' | 'dark';
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = '@parables/theme_preference';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemColorScheme = useSystemColorScheme();
  const systemTheme = systemColorScheme ?? 'light';
  
  const [userPreference, setUserPreference] = useState<ThemeMode | 'system'>('system');
  const [isLoading, setIsLoading] = useState(true);

  // Load saved theme preference on mount
  useEffect(() => {
    const loadThemePreference = async () => {
      try {
        const saved = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (saved && (saved === 'light' || saved === 'dark' || saved === 'sepia' || saved === 'system')) {
          setUserPreference(saved);
        }
      } catch (error) {
        console.error('Failed to load theme preference:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadThemePreference();
  }, []);

  // Determine actual theme mode based on user preference and system theme
  const getActualThemeMode = (): ThemeMode => {
    if (userPreference === 'system') {
      // Sepia is not a system theme, so we only use light/dark from system
      return systemTheme === 'dark' ? 'dark' : 'light';
    }
    return userPreference;
  };

  const themeMode = getActualThemeMode();
  const theme = getTheme(themeMode);

  const setThemeMode = async (mode: ThemeMode | 'system') => {
    try {
      setUserPreference(mode);
      await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch (error) {
      console.error('Failed to save theme preference:', error);
    }
  };

  // Don't render children until we've loaded the theme preference
  if (isLoading) {
    return null;
  }

  // Determine status bar style based on theme
  // 'light' = light icons (for dark backgrounds)
  // 'dark' = dark icons (for light backgrounds)
  const statusBarStyle = themeMode === 'dark' ? 'light' : 'dark';

  return (
    <ThemeContext.Provider
      value={{
        theme,
        themeMode,
        setThemeMode,
        userPreference,
        systemTheme,
      }}
    >
      <StatusBar style={statusBarStyle} translucent />
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};