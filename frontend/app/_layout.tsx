import FontAwesome from "@expo/vector-icons/FontAwesome";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState, useMemo } from "react";
import "react-native-reanimated";
import { observer, useSelector } from "@legendapp/state/react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { Platform, View, useColorScheme } from "react-native";
import * as Linking from "expo-linking";

import { LoadingSplash } from "@/components/LoadingSplash";
import { VersionDisplay } from "@/components/VersionDisplay";
import { UpdateBanner } from "@/components/UpdateBanner";
import { LowStorageWarning } from "@/components/LowStorageWarning";
import { getStorageInfo, type StorageInfo } from "@/utils/storageCheck";
import { bibleStore$ } from "@/state/bibleStore";
import { notesStore$ } from "@/state/notesStore";
import { bibleVersionStore$ } from "@/state/bibleVersionStore";
import { studyModeStore$ } from "@/state/studyModeStore";
import { appStateStore$ } from "@/state/appStateStore";
import { userProfileCache$ } from "@/state/userProfileCache";
import { devotionStore$ } from "@/state/devotionStore";
import { planStore$ } from "@/state/planStore";
import { ScrollProvider } from "@/contexts/ScrollContext";
import { DimensionsProvider } from "@/contexts/DimensionsContext";
import { ScrollStateProvider } from "@/contexts/ScrollStateContext";
import { ThemeProvider as CustomThemeProvider } from "@/contexts/ThemeContext";
import { getTheme } from "@/config/theme";
import { ToastProvider } from "@/contexts/ToastContext";
import { BibleRenderingProvider } from "@/contexts/BibleRenderingContext";
import DailyProgressBar from "@/components/Gamification/DailyProgressBar";
import { initializeAuth, useUnifiedAuth } from "@/hooks/useUnifiedAuth";
import { SyncProvider } from "@/contexts/SyncContext";
import { useSyncRegistration } from "@/hooks/useSyncRegistration";
import { runAllDataMigrations } from "@/services/migrations/dataMigrations";
import { configureGoogleSignIn } from "@/services/googleSignIn";
import {
  initializeNotifications,
  setupNotificationResponseListener,
} from "@/services/notificationService";
import { initializePlanReminders } from "@/services/planReminderService";
// NOTE: Embeddings are lazy-loaded on first semantic search, not at startup
// This provides much faster app startup UX
import { supabase } from "@/lib/supabase";
import Animated from "react-native-reanimated";

// Configure Google Sign-In at module load time
configureGoogleSignIn();

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from "expo-router";

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: "(tabs)",
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default observer(function RootLayout() {
  // iOS: Use native fonts (Georgia, San Francisco) - don't load custom fonts
  // Android/Web: Load custom fonts (Literata, Inter)
  const [loaded, error] = useFonts(
    Platform.OS === "ios"
      ? {
          SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
          ...FontAwesome.font,
        }
      : {
          SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
          "Literata-Regular": require("../assets/fonts/Literata-Regular.ttf"),
          "Literata-Medium": require("../assets/fonts/Literata-Medium.ttf"),
          "Inter-Regular": require("../assets/fonts/Inter-Regular.ttf"),
          "Inter-Medium": require("../assets/fonts/Inter-Medium.ttf"),
          "Inter-SemiBold": require("../assets/fonts/Inter-SemiBold.ttf"),
          "Inter-Bold": require("../assets/fonts/Inter-Bold.ttf"),
          ...FontAwesome.font,
        }
  );

  // CRITICAL: Only subscribe to isLoading, not the entire store!
  // This prevents re-renders when tabs/chapters update during scrolling
  const isLoading = useSelector(bibleStore$.is_loading);
  const [dataLoadStarted, setDataLoadStarted] = useState(false);
  const [forceShow, setForceShow] = useState(false);

  // Storage check state - check BEFORE loading data
  const [storageChecked, setStorageChecked] = useState(false);
  const [lowStorageInfo, setLowStorageInfo] = useState<StorageInfo | null>(null);
  const [storageWarningDismissed, setStorageWarningDismissed] = useState(false);

  // Theme for splash screen (before ThemeContext is available)
  const systemColorScheme = useColorScheme();
  const splashThemeMode = systemColorScheme === 'dark' ? 'dark' : 'light';
  const splashTheme = useMemo(() => getTheme(splashThemeMode), [splashThemeMode]);
  const splashStatusBarStyle = splashThemeMode === 'dark' ? 'light' : 'dark';

  console.log(
    "RootLayout render - loaded:",
    loaded,
    "isLoading:",
    isLoading,
    "dataLoadStarted:",
    dataLoadStarted,
    "storageChecked:",
    storageChecked
  );

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  // Check storage BEFORE starting data load - this is critical for the app to function
  useEffect(() => {
    const checkStorage = async () => {
      console.log("[Storage] Checking device storage...");
      const info = await getStorageInfo();
      if (info) {
        console.log(`[Storage] Free: ${info.freeGB}GB, Total: ${info.totalGB}GB, Low: ${info.isLow}, Critical: ${info.isCritical}`);
        if (info.isLow) {
          setLowStorageInfo(info);
        }
      }
      setStorageChecked(true);
    };
    checkStorage();
  }, []);

  // Safety timeout - force show app after 10 seconds even if loading
  useEffect(() => {
    const timeout = setTimeout(() => {
      console.log("🚨 SAFETY TIMEOUT: Forcing app to show after 10 seconds");
      bibleStore$.is_loading.set(false);
      setForceShow(true);
    }, 10000);

    return () => clearTimeout(timeout);
  }, []);

  // Load Bible data on startup - but don't start until:
  // 1. Fonts are loaded
  // 2. Storage is checked
  // 3. Storage is OK OR user has dismissed the warning
  const canStartLoading = loaded && storageChecked && (!lowStorageInfo || storageWarningDismissed);

  useEffect(() => {
    if (canStartLoading && !dataLoadStarted) {
      console.log("Ready to load data, starting Bible data loading...");
      setDataLoadStarted(true);

      // Hide the native splash immediately since we'll show our custom one
      SplashScreen.hideAsync().catch(console.error);

      // Bible data now loaded via SQLite on demand
      // Load all stores in parallel, tracking progress for each
      // NOTE: Embeddings load in BACKGROUND after app starts for faster startup
      Promise.all([
        initializeAuth().then(() => {
          appStateStore$.data_loading_status.auth.set(true);
        }),
        Promise.all([
          bibleStore$.loadTabsFromStorage(),
          bibleStore$.loadNotesFromStorage(),
          bibleStore$.loadExpandedNotesFromStorage(),
          notesStore$.loadBookmarksFromStorage(),
        ]).then(() => {
          appStateStore$.data_loading_status.tabs.set(true);
          appStateStore$.data_loading_status.notes.set(true);
        }),
        bibleVersionStore$.initialize().then(() => {
          appStateStore$.data_loading_status.versions.set(true);
        }),
        Promise.all([
          studyModeStore$.loadState(),
          appStateStore$.loadBiblePeekSettings(),
          userProfileCache$.loadFromStorage().then(() => {
            // Subscribe to real-time display name/avatar changes
            userProfileCache$.subscribeToChanges();
          }),
          // Load devotion and plan caches at startup for offline support
          devotionStore$.initialize(),
          planStore$.initialize(),
        ]).then(() => {
          appStateStore$.data_loading_status.settings.set(true);
        }),
      ]).then(async () => {
        // NOTE: Embeddings are lazy-loaded on first semantic search
        // See SearchInterface.tsx for the lazy loading trigger

        // 🔧 Run data migrations after loading from storage
        // This fixes any legacy data format issues
        await runAllDataMigrations();

        // 🔔 Initialize notifications (request permission + schedule daily notification)
        await initializeNotifications();

        // 🔔 Initialize plan reminders (schedule if enabled)
        await initializePlanReminders();

        setTimeout(() => {
          bibleStore$.is_loading.set(false);
          console.log("✅ Auth restored, SQLite database ready, versions loaded, tabs and notes restored, migrations complete, notifications initialized");
        }, 100);
      }).catch((error) => {
        console.error("❌ Error initializing stores:", error);
        // Still show the app even if there's an error
        bibleStore$.is_loading.set(false);
      });
    }
  }, [canStartLoading, dataLoadStarted]);

  // Show storage warning FIRST if storage is low and user hasn't dismissed it
  // This blocks the app from loading until user acknowledges
  const shouldShowStorageWarning = storageChecked && lowStorageInfo && !storageWarningDismissed;

  // Don't hide our custom splash until both fonts are loaded AND data is loaded (or forced)
  // FIXED: Prioritize forceShow to prevent render loops
  const shouldShowSplash = forceShow ? false : !loaded || isLoading;
  console.log(
    "Should show splash:",
    shouldShowSplash,
    "(loaded:",
    loaded,
    "isLoading:",
    isLoading,
    "forceShow:",
    forceShow,
    "storageWarning:",
    shouldShowStorageWarning,
    ")"
  );

  // Show storage warning before anything else if storage is low
  if (shouldShowStorageWarning) {
    return (
      <SafeAreaProvider>
        <View style={{ flex: 1, backgroundColor: splashTheme.colors.background.primary }}>
          <StatusBar style={splashStatusBarStyle} translucent />
          <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right"]}>
            <LowStorageWarning
              storageInfo={lowStorageInfo}
              onContinue={() => setStorageWarningDismissed(true)}
            />
          </SafeAreaView>
        </View>
      </SafeAreaProvider>
    );
  }

  if (shouldShowSplash) {
    return (
      <SafeAreaProvider>
        <View style={{ flex: 1, backgroundColor: splashTheme.colors.background.primary }}>
          <StatusBar style={splashStatusBarStyle} translucent />
          <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right"]}>
            <LoadingSplash />
          </SafeAreaView>
        </View>
      </SafeAreaProvider>
    );
  }

  return <RootLayoutNav />;
});

const RootLayoutNav = observer(function RootLayoutNav() {
  // Get auth state for sync coordination
  const { user, isOnline } = useUnifiedAuth();

  // Register all sync handlers for app state and network changes
  // This ensures data stays in sync when app resumes or network reconnects
  useSyncRegistration({
    userId: user?.id,
  });

  // Handle deep links for email verification, OAuth callbacks, and password reset
  // IMPORTANT: Supabase returns tokens in URL fragment (#), but Expo Router only parses query params (?)
  // We need to intercept the URL and extract tokens from the fragment
  useEffect(() => {
    const extractTokensFromUrl = async (url: string) => {
      console.log('[DeepLink] Processing URL:', url);

      // Check if URL contains a fragment with tokens
      if (url.includes('#')) {
        const [, fragment] = url.split('#');

        if (fragment && (fragment.includes('access_token') || fragment.includes('error'))) {
          console.log('[DeepLink] Found tokens in URL fragment, extracting...');

          // Parse the fragment as URL params
          const fragmentParams = new URLSearchParams(fragment);
          const accessToken = fragmentParams.get('access_token');
          const refreshToken = fragmentParams.get('refresh_token');
          const error = fragmentParams.get('error');
          const errorDescription = fragmentParams.get('error_description');
          const type = fragmentParams.get('type');

          console.log('[DeepLink] Parsed fragment:', {
            hasAccessToken: !!accessToken,
            hasRefreshToken: !!refreshToken,
            type,
            error,
          });

          // If there's an error, we'll let the reset-password screen handle it
          if (error) {
            console.error('[DeepLink] Auth error:', error, errorDescription);
            return;
          }

          // If we have tokens and this is a recovery (password reset), set the session
          if (accessToken && refreshToken) {
            try {
              console.log('[DeepLink] Setting Supabase session from tokens...');
              const { data, error: sessionError } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
              });

              if (sessionError) {
                console.error('[DeepLink] Failed to set session:', sessionError.message);
              } else if (data.session) {
                console.log('[DeepLink] Session established successfully, type:', type);
              }
            } catch (err) {
              console.error('[DeepLink] Error setting session:', err);
            }
          }
        }
      }
    };

    // Handle deep link when app is already open
    const subscription = Linking.addEventListener('url', ({ url }) => {
      console.log('[DeepLink] URL received while app open:', url);
      extractTokensFromUrl(url);
    });

    // Handle deep link when app is opened from closed state
    Linking.getInitialURL().then((url) => {
      if (url) {
        console.log('[DeepLink] Initial URL (app opened from link):', url);
        extractTokensFromUrl(url);
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // Handle notification taps - navigate to devotion tab
  // Handles both cold start (app killed) and warm start (app in background)
  useEffect(() => {
    const cleanup = setupNotificationResponseListener();
    return cleanup;
  }, []);

  return (
    <SafeAreaProvider>
      <SyncProvider enabled={isOnline}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <KeyboardProvider>
            <CustomThemeProvider>
              <ToastProvider>
                <>
                  <DimensionsProvider>
                    <BibleRenderingProvider>
                      <ScrollStateProvider>
                        <ScrollProvider>
                          <Stack screenOptions={{ headerShown: false }}>
                            <Stack.Screen name="(tabs)" />
                            <Stack.Screen name="auth" />
                            <Stack.Screen name="plans" />
                          </Stack>
                        </ScrollProvider>
                      </ScrollStateProvider>
                    </BibleRenderingProvider>
                  </DimensionsProvider>
                  <VersionDisplay />
                  <UpdateBanner />
                  <DailyProgressBar />
                </>
              </ToastProvider>
            </CustomThemeProvider>
          </KeyboardProvider>
        </GestureHandlerRootView>
      </SyncProvider>
    </SafeAreaProvider>
  );
});
