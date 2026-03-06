/**
 * Unified Auth Hook
 *
 * Manages authentication state with Supabase integration.
 * Handles 4 auth states automatically as per CLAUDE.md:
 * 1. Offline + None → Landing
 * 2. Offline + Anon → Local App (Device ID)
 * 3. Offline + Auth → Local App (Token)
 * 4. Online + Auth → App + Sync
 */

import { useEffect, useCallback } from "react";
import { useSelector } from "@legendapp/state/react";
import { authStore$, bibleStore$, type NoteData, type BookmarkData } from "../state/bibleStore";
import { notesStore$ } from "../state/notesStore";
import { clearAllCaches as clearGamificationCaches } from "../state/gamificationStore";
import { supabase } from "../lib/supabase";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import * as Linking from "expo-linking";
import * as AppleAuthentication from "expo-apple-authentication";
import Constants from "expo-constants";
import { AppState, type AppStateStatus, Platform } from "react-native";
import type { Session, User, AuthError, Provider } from "@supabase/supabase-js";
import { signInWithGoogleNative, signOutFromGoogle } from "../services/googleSignIn";

const DEVICE_ID_KEY = "@parables/deviceId";
const HAS_SIGNED_IN_KEY = "@parables/has_signed_in_on_device";

// Supabase stores session with this key pattern
const SUPABASE_AUTH_STORAGE_KEY = "sb-wiepinhkzxpiaiipflcb-auth-token";

/**
 * Wrap a promise with a timeout
 * Returns null if the promise doesn't resolve within the timeout
 */
const withTimeout = <T>(
  promise: Promise<T>,
  timeoutMs: number,
  fallback: T
): Promise<T> => {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      console.warn(`[Auth] Operation timed out after ${timeoutMs}ms`);
      resolve(fallback);
    }, timeoutMs);

    promise
      .then((result) => {
        clearTimeout(timeout);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timeout);
        console.error("[Auth] Operation failed:", error);
        resolve(fallback);
      });
  });
};

/**
 * Get session from Supabase with timeout protection
 * Prevents hanging on iOS when network is slow/unavailable
 * Also clears stale cached sessions when refresh token is invalid
 */
const getSessionWithTimeout = async (timeoutMs: number = 5000): Promise<Session | null> => {
  try {
    const result = await withTimeout(
      supabase.auth.getSession(),
      timeoutMs,
      { data: { session: null }, error: null }
    );

    // Check for refresh token errors - clear stale cache if token is invalid
    if (result.error) {
      const errorMessage = result.error.message || '';
      if (errorMessage.includes('Refresh Token') || errorMessage.includes('Invalid')) {
        console.warn('[Auth] Refresh token invalid, clearing cached session');
        await AsyncStorage.removeItem(SUPABASE_AUTH_STORAGE_KEY);
      }
    }

    return result.data.session;
  } catch (error: any) {
    // Handle thrown errors (shouldn't happen, but safety net)
    const errorMessage = error?.message || '';
    if (errorMessage.includes('Refresh Token') || errorMessage.includes('Invalid')) {
      console.warn('[Auth] Refresh token error, clearing cached session');
      await AsyncStorage.removeItem(SUPABASE_AUTH_STORAGE_KEY);
    }
    return null;
  }
};

/**
 * Load cached session directly from AsyncStorage without network call
 * Used for optimistic auth when offline
 */
const loadCachedSession = async (): Promise<Session | null> => {
  try {
    const storedSession = await AsyncStorage.getItem(SUPABASE_AUTH_STORAGE_KEY);
    if (!storedSession) {
      return null;
    }

    const parsed = JSON.parse(storedSession);

    // Supabase stores session in various formats, handle both
    const session = parsed?.currentSession || parsed;

    if (!session?.access_token || !session?.user) {
      return null;
    }

    if (__DEV__) {
      console.log("[Auth] Loaded cached session for offline use:", {
        hasUser: !!session.user,
        expiresAt: session.expires_at
          ? new Date(session.expires_at * 1000).toISOString()
          : null,
      });
    }

    return session as Session;
  } catch (error) {
    console.error("[Auth] Error loading cached session:", error);
    return null;
  }
};

/**
 * Get appropriate redirect URL based on environment
 * - Expo Go: Uses exp:// scheme with local IP
 * - Development/Production Build: Uses custom parables:// scheme
 */
const getRedirectUrl = (path: string = '/auth/callback'): string => {
  // Check if running in Expo Go
  const isExpoGo = Constants.appOwnership === 'expo';

  if (isExpoGo) {
    // Expo Go: Use exp:// scheme
    // Linking.createURL() generates exp://IP:PORT/--/path format
    const url = Linking.createURL(path);
    if (__DEV__) {
      console.log('[Auth] Redirect URL (Expo Go):', url);
    }
    return url;
  } else {
    // Development/Production Build: Use custom scheme
    const url = `parables://${path}`;
    if (__DEV__) {
      console.log('[Auth] Redirect URL (Build):', url);
    }
    return url;
  }
};

/**
 * Generate or retrieve device ID for offline mode
 */
const getOrCreateDeviceId = async (): Promise<string> => {
  let deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = `device_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
};

/**
 * Mark device as having signed in (for first-time sign-in tracking)
 */
const markDeviceSignedIn = async () => {
  await AsyncStorage.setItem(HAS_SIGNED_IN_KEY, "true");
  authStore$.hasSignedInOnDevice.set(true);
};

/**
 * Fix notes and bookmarks with invalid user_id values
 * Replaces 'current_user', null, or empty string with actual authenticated user ID
 */
const fixUserDataOwnership = async (session: Session | null) => {
  // Only run if user is authenticated
  if (!session?.user?.id) {
    return;
  }

  try {
    const userId = session.user.id;
    let notesFixed = 0;
    let bookmarksFixed = 0;

    // Fix notes with invalid user_id
    const notes = bibleStore$.notes.peek();
    const fixedNotes = notes.map((note: NoteData) => {
      if (!note.user_id || note.user_id === 'current_user' || note.user_id === '') {
        notesFixed++;
        return { ...note, user_id: userId };
      }
      return note;
    });

    // Fix bookmarks with invalid user_id
    const bookmarks = bibleStore$.bookmarks.peek();
    const fixedBookmarks = bookmarks.map((bookmark: BookmarkData) => {
      if (!bookmark.user_id || bookmark.user_id === 'current_user' || bookmark.user_id === '') {
        bookmarksFixed++;
        return { ...bookmark, user_id: userId };
      }
      return bookmark;
    });

    // Update store if any fixes were made
    if (notesFixed > 0 || bookmarksFixed > 0) {
      console.log(`[UserDataFix] Fixed ${notesFixed} notes and ${bookmarksFixed} bookmarks with invalid user_id`);

      if (notesFixed > 0) {
        bibleStore$.notes.set(fixedNotes);
      }

      if (bookmarksFixed > 0) {
        bibleStore$.bookmarks.set(fixedBookmarks);
        await notesStore$.saveBookmarksToStorage();
      }

      await bibleStore$.saveNotesToStorage();
      console.log('[UserDataFix] Fixed data saved successfully');
    }
  } catch (error) {
    console.error('[UserDataFix] Error fixing user data ownership:', error);
  }
};

/**
 * Update auth store based on current state
 */
const updateAuthStore = async (
  session: Session | null,
  isOnline: boolean,
  preserveDeviceTracking: boolean = false
) => {
  const deviceId = await getOrCreateDeviceId();

  // Preserve device tracking flags and returnUrl if requested
  const currentAuth = authStore$.peek();
  const hasSignedInOnDevice = preserveDeviceTracking
    ? currentAuth.hasSignedInOnDevice
    : false;
  const isInAuthFlow = preserveDeviceTracking
    ? currentAuth.isInAuthFlow
    : false;
  const returnUrl = preserveDeviceTracking
    ? currentAuth.returnUrl
    : null;

  if (session?.user) {
    // Authenticated user
    authStore$.set({
      network: isOnline ? "online" : "offline",
      auth: "authenticated",
      storage: "token",
      experience: isOnline ? "app_sync" : "local_app",
      shouldSync: isOnline,
      user: session.user,
      deviceId: null,
      token: session.access_token,
      hasSignedInOnDevice,
      isInAuthFlow,
      returnUrl,
    });
  } else {
    // Not authenticated - offline mode with device ID
    authStore$.set({
      network: isOnline ? "online" : "offline",
      auth: "none",
      storage: deviceId ? "device_id" : "empty",
      experience: deviceId ? "local_app" : "landing",
      shouldSync: false,
      user: null,
      deviceId,
      token: null,
      hasSignedInOnDevice,
      isInAuthFlow,
      returnUrl,
    });
  }
};

/**
 * Initialize auth state and listeners
 */
export const initializeAuth = async () => {
  // Check network status
  const netState = await NetInfo.fetch();
  const isOnline = netState.isConnected ?? false;

  // Load device tracking state from storage
  const hasSignedInBefore = (await AsyncStorage.getItem(HAS_SIGNED_IN_KEY)) === "true";

  // Update authStore with loaded device tracking state immediately
  authStore$.hasSignedInOnDevice.set(hasSignedInBefore);

  let session: Session | null = null;

  // OPTIMISTIC OFFLINE AUTH: If offline and has signed in before, use cached session
  if (!isOnline && hasSignedInBefore) {
    if (__DEV__) {
      console.log("[Auth] Offline mode detected, using cached session");
    }

    // Try to load cached session directly from AsyncStorage
    session = await loadCachedSession();

    if (session) {
      if (__DEV__) {
        console.log("[Auth] Using cached session for offline auth");
      }
      // Don't try to refresh or validate - just use the cached session
      await fixUserDataOwnership(session);
      await updateAuthStore(session, isOnline, true);
      // Skip setting up listeners that depend on network - will be set up when online
      return setupListeners();
    }
  }

  // Online OR no cached session: Use normal Supabase flow with timeout protection
  // iOS can hang indefinitely on getSession() in poor network conditions
  session = await getSessionWithTimeout(5000);

  // If getSession timed out or failed, try cached session as fallback
  if (!session && hasSignedInBefore) {
    session = await loadCachedSession();
    if (__DEV__ && session) {
      console.log("[Auth] Using cached session after getSession timeout/failure");
    }
  }

  if (__DEV__) {
    console.log("[Auth] Initial session loaded:", {
      hasSession: !!session,
      expiresAt: session?.expires_at
        ? new Date(session.expires_at * 1000).toISOString()
        : null,
      expiresIn: session?.expires_in,
      isOnline,
    });
  }

  // Fix any notes/bookmarks with invalid user_id if user is authenticated
  await fixUserDataOwnership(session);

  // Update store with initial state (preserve device tracking)
  await updateAuthStore(session, isOnline, true);

  return setupListeners();
};

/**
 * Set up auth and network listeners
 * Extracted to allow reuse for both online and offline init paths
 */
const setupListeners = () => {
  // Listen to auth state changes
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((event, session) => {
    // Log all auth events for debugging
    if (__DEV__) {
      console.log("[Auth Event]:", event, {
        hasSession: !!session,
        expiresAt: session?.expires_at
          ? new Date(session.expires_at * 1000).toISOString()
          : null,
        expiresIn: session?.expires_in,
      });
    }

    // Handle different auth events
    // IMPORTANT: Do NOT use async/await here to avoid deadlocks
    // Use setTimeout to defer async operations
    setTimeout(async () => {
      try {
        const currentNetState = await NetInfo.fetch();
        const currentIsOnline = currentNetState.isConnected ?? false;

        // Mark device as signed in on successful sign-in (e.g., OAuth callback)
        if (event === "SIGNED_IN" && session) {
          await markDeviceSignedIn();
        }

        // Log token refresh events
        if (event === "TOKEN_REFRESHED") {
          if (__DEV__) {
            console.log(
              "[Token Refreshed] New token expires:",
              new Date(session!.expires_at! * 1000).toISOString()
            );
          }
        }

        // Handle token refresh errors
        if (event === "SIGNED_OUT") {
          if (__DEV__) {
            console.log("[Auth] User signed out or session expired");
          }
        }

        await updateAuthStore(session, currentIsOnline, true);
      } catch (error) {
        console.error("[Auth] Error handling auth state change:", error);
      }
    }, 0);
  });

  // Listen to network state changes
  const unsubscribeNetInfo = NetInfo.addEventListener(async (state: any) => {
    const isOnline = state.isConnected ?? false;

    // When coming back online, try to get fresh session
    // When going offline, use cached session
    let session: Session | null = null;

    if (isOnline) {
      // Use timeout-protected getSession to prevent hanging
      session = await getSessionWithTimeout(5000);
      if (!session) {
        // Fallback to cached session if timeout/failure
        session = await loadCachedSession();
      }
    } else {
      // Offline - use cached session
      session = await loadCachedSession();
      if (__DEV__ && session) {
        console.log("[Auth] Network went offline, using cached session");
      }
    }

    await updateAuthStore(session, isOnline, true);
  });

  // CRITICAL: AppState listener for React Native token auto-refresh
  // Without this, auto-refresh may not work properly when app is backgrounded
  const handleAppStateChange = async (nextAppState: AppStateStatus) => {
    if (__DEV__) {
      console.log("[AppState] App state changed to:", nextAppState);
    }

    if (nextAppState === "active") {
      // Check network before attempting refresh
      const netState = await NetInfo.fetch();
      const isOnline = netState.isConnected ?? false;

      if (isOnline) {
        // App came to foreground with network - start auto-refresh
        supabase.auth.startAutoRefresh();

        // Get session - getSession() automatically refreshes expired tokens
        // DO NOT call refreshSession() after this - it would try to use the rotated token!
        const session = await getSessionWithTimeout(5000);

        if (session) {
          if (__DEV__) {
            console.log("[AppState] App resumed online, session valid:", {
              expiresAt: session.expires_at
                ? new Date(session.expires_at * 1000).toISOString()
                : null,
            });
          }
          // Update auth store with refreshed session
          await updateAuthStore(session, true, true);
        } else {
          // Session refresh failed - clear stale auth state
          if (__DEV__) {
            console.log("[AppState] No valid session after resume, clearing auth state");
          }
          await updateAuthStore(null, true, true);
        }
      } else {
        // App came to foreground but offline - use cached session, don't try to refresh
        if (__DEV__) {
          console.log("[AppState] App resumed offline, skipping session refresh");
        }
        const cachedSession = await loadCachedSession();
        if (cachedSession) {
          await updateAuthStore(cachedSession, false, true);
        }
      }
    } else {
      // App going to background - stop auto-refresh to save battery
      supabase.auth.stopAutoRefresh();
    }
  };

  const appStateSubscription = AppState.addEventListener("change", handleAppStateChange);

  // Start auto-refresh immediately if app is active
  if (AppState.currentState === "active") {
    supabase.auth.startAutoRefresh();
  }

  return () => {
    subscription.unsubscribe();
    unsubscribeNetInfo();
    appStateSubscription.remove();
  };
};

/**
 * Main auth hook
 */
export const useUnifiedAuth = () => {
  const auth = useSelector(authStore$);

  // Initialize auth on mount
  useEffect(() => {
    let cleanup: (() => void) | undefined;

    initializeAuth().then((cleanupFn) => {
      cleanup = cleanupFn;
    });

    return () => {
      cleanup?.();
    };
  }, []);

  /**
   * Sign up with email and password
   */
  const signUp = useCallback(
    async (email: string, password: string, displayName: string) => {
      const redirectUrl = getRedirectUrl('/auth/callback');

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: displayName,
          },
          emailRedirectTo: redirectUrl,
        },
      });

      if (error) throw error;

      if (__DEV__) {
        console.log('[Auth] Sign up result:', {
          hasUser: !!data.user,
          hasSession: !!data.session,
          email: data.user?.email,
          redirectUrl,
        });
      }

      // Mark device as having signed in
      await markDeviceSignedIn();

      return data;
    },
    []
  );

  /**
   * Sign in with email and password
   */
  const signIn = useCallback(async (email: string, password: string) => {
    // Normalize email - trim whitespace and lowercase
    const normalizedEmail = email.trim().toLowerCase();

    if (__DEV__) {
      // Check for existing session that might interfere
      const { data: sessionData } = await supabase.auth.getSession();
      console.log('[Auth] signIn attempt:', {
        email: normalizedEmail,
        emailLength: normalizedEmail.length,
        passwordLength: password.length,
        hasExistingSession: !!sessionData.session,
        existingSessionEmail: sessionData.session?.user?.email,
      });
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (error) {
      if (__DEV__) {
        console.error('[Auth] signIn error details:', {
          message: error.message,
          status: error.status,
          code: (error as any).code,
          name: error.name,
        });
      }
      throw error;
    }

    // Mark device as having signed in
    await markDeviceSignedIn();

    return data;
  }, []);

  /**
   * Sign in with OAuth provider (web-based flow - fallback)
   */
  const signInWithProvider = useCallback(async (provider: Provider) => {
    const redirectUrl = getRedirectUrl('/auth/callback');

    if (__DEV__) {
      console.log(`[Auth] Starting OAuth flow with ${provider}, redirectTo: ${redirectUrl}`);
    }

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: redirectUrl,
      },
    });

    if (error) throw error;
    return data;
  }, []);

  /**
   * Sign in with Google using native SDK
   * Uses @react-native-google-signin for seamless in-app experience
   */
  const signInWithGoogle = useCallback(async () => {
    try {
      if (__DEV__) {
        console.log('[Auth] Starting native Google Sign-In');
      }

      // Get ID token from native Google Sign-In
      const idToken = await signInWithGoogleNative();

      // Exchange ID token with Supabase
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
      });

      if (error) throw error;

      if (__DEV__) {
        console.log('[Auth] Google Sign-In successful:', {
          hasUser: !!data.user,
          hasSession: !!data.session,
        });
      }

      // Mark device as having signed in
      await markDeviceSignedIn();

      return data;
    } catch (error) {
      console.error('[Auth] Google Sign-In error:', error);
      throw error;
    }
  }, []);

  /**
   * Sign in with Apple using native SDK (iOS only)
   * Uses expo-apple-authentication for native Apple Sign-In sheet
   */
  const signInWithApple = useCallback(async () => {
    if (Platform.OS !== 'ios') {
      throw new Error('Apple Sign-In is only available on iOS');
    }

    try {
      if (__DEV__) {
        console.log('[Auth] Starting native Apple Sign-In');
      }

      // Request Apple Sign-In
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) {
        throw new Error('No identity token received from Apple');
      }

      // Exchange identity token with Supabase
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      });

      if (error) throw error;

      if (__DEV__) {
        console.log('[Auth] Apple Sign-In successful:', {
          hasUser: !!data.user,
          hasSession: !!data.session,
        });
      }

      // Mark device as having signed in
      await markDeviceSignedIn();

      return data;
    } catch (error: any) {
      // Handle user cancellation gracefully
      if (error.code === 'ERR_REQUEST_CANCELED') {
        throw new Error('Apple sign-in was cancelled');
      }
      console.error('[Auth] Apple Sign-In error:', error);
      throw error;
    }
  }, []);

  /**
   * Sign out
   * Clears user-specific local data to prevent cross-user contamination
   */
  const signOut = useCallback(async () => {
    // Sign out from Google if signed in
    await signOutFromGoogle();

    const { error } = await supabase.auth.signOut();
    if (error) throw error;

    // Clear user-specific local data
    bibleStore$.notes.set([]);
    bibleStore$.bookmarks.set([]);
    await bibleStore$.saveNotesToStorage();
    await notesStore$.saveBookmarksToStorage();

    // Clear gamification caches (XP, streaks, daily activity)
    await clearGamificationCaches();
  }, []);

  /**
   * Reset password
   */
  const resetPassword = useCallback(async (email: string) => {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: "parables://auth/reset-password",
    });

    if (error) throw error;
    return data;
  }, []);

  /**
   * Update password
   */
  const updatePassword = useCallback(async (newPassword: string) => {
    const { data, error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) throw error;
    return data;
  }, []);

  /**
   * Verify OTP code
   */
  const verifyOtp = useCallback(async (email: string, token: string) => {
    if (__DEV__) {
      console.log("[Auth] Verifying OTP for:", email);
    }

    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: "signup",
    });

    if (error) throw error;

    if (__DEV__) {
      console.log("[Auth] OTP verified successfully:", {
        hasUser: !!data.user,
        hasSession: !!data.session,
      });
    }

    // Mark device as having signed in
    await markDeviceSignedIn();

    return data;
  }, []);

  /**
   * Get user profile with display name
   */
  const getUserProfile = useCallback(async () => {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session?.user) return null;

    const { data, error } = await supabase
      .from("user_profiles")
      .select(
        `
        *,
        user_display_names (
          display_name,
          discriminator,
          is_customized
        )
      `
      )
      .eq("id", session.session.user.id)
      .single();

    if (error) {
      // New user may not have a profile yet - that's OK
      if (error.code === "PGRST116") return null;
      throw error;
    }
    return data;
  }, []);

  /**
   * Set return URL for post-auth navigation
   */
  const setReturnUrl = useCallback((url: string | null) => {
    authStore$.returnUrl.set(url);
  }, []);

  /**
   * Get return URL and clear it
   */
  const getAndClearReturnUrl = useCallback(() => {
    const url = authStore$.returnUrl.peek();
    authStore$.returnUrl.set(null);
    return url;
  }, []);

  /**
   * Set auth flow state (for tracking when user is in auth screens)
   */
  const setIsInAuthFlow = useCallback((value: boolean) => {
    authStore$.isInAuthFlow.set(value);
  }, []);

  /**
   * Update user metadata (e.g., display name)
   */
  const updateUserMetadata = useCallback(async (metadata: Record<string, any>) => {
    const { data, error } = await supabase.auth.updateUser({
      data: metadata,
    });

    if (error) throw error;
    return data;
  }, []);

  return {
    // State
    network: auth.network,
    auth: auth.auth,
    storage: auth.storage,
    experience: auth.experience,
    shouldSync: auth.shouldSync,
    user: auth.user,
    deviceId: auth.deviceId,
    token: auth.token,
    isAuthenticated: auth.auth === "authenticated",
    isOnline: auth.network === "online",
    returnUrl: auth.returnUrl,

    // Device tracking state
    hasSignedInOnDevice: auth.hasSignedInOnDevice,
    isInAuthFlow: auth.isInAuthFlow,
    setIsInAuthFlow,

    // Methods
    signUp,
    signIn,
    signInWithProvider,
    signInWithGoogle,   // Native Google Sign-In
    signInWithApple,    // Native Apple Sign-In (iOS only)
    signOut,
    resetPassword,
    updatePassword,
    verifyOtp,
    getUserProfile,
    setReturnUrl,
    getAndClearReturnUrl,
    updateUserMetadata,
  };
};