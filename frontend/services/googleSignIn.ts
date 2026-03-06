/**
 * Google Sign-In Configuration
 *
 * Configures @react-native-google-signin/google-signin for native authentication.
 * Must be called once at app startup before any sign-in attempts.
 */

import {
  GoogleSignin,
  statusCodes,
} from "@react-native-google-signin/google-signin";

// TODO: Replace these with your actual client IDs from Google Cloud Console
// Get these from: https://console.cloud.google.com/apis/credentials
const GOOGLE_IOS_CLIENT_ID =
  "1082884751116-3inocdviem12rlllhut06s5g83899og4.apps.googleusercontent.com";
const GOOGLE_WEB_CLIENT_ID =
  "1082884751116-qfq1rq5cfcmoo63umt8846265r31cr11.apps.googleusercontent.com";

// You can also use environment variables:
// const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
// const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

let isConfigured = false;

/**
 * Configure Google Sign-In
 * Call this once at app startup (in _layout.tsx)
 */
export const configureGoogleSignIn = () => {
  if (isConfigured) {
    console.log("[GoogleSignIn] Already configured");
    return;
  }

  try {
    GoogleSignin.configure({
      // iOS client ID - required for iOS
      iosClientId: GOOGLE_IOS_CLIENT_ID,

      // Web client ID - required to get ID token for Supabase
      // This must match what's configured in Supabase Google provider
      webClientId: GOOGLE_WEB_CLIENT_ID,

      // Request offline access for refresh tokens (optional)
      offlineAccess: false,

      // Force account selection even if only one account (good for switching accounts)
      forceCodeForRefreshToken: false,
    });

    isConfigured = true;
    console.log("[GoogleSignIn] Configured successfully");
  } catch (error) {
    console.error("[GoogleSignIn] Configuration error:", error);
  }
};

/**
 * Sign in with Google natively
 * Returns the ID token for Supabase authentication
 */
export const signInWithGoogleNative = async (): Promise<string> => {
  if (!isConfigured) {
    configureGoogleSignIn();
  }

  try {
    // Check if device has Google Play Services (Android)
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

    // Sign in and get user info
    const response = await GoogleSignin.signIn();

    // Extract ID token
    const idToken = response.data?.idToken;

    if (!idToken) {
      throw new Error(
        "No ID token received from Google. Make sure webClientId is configured correctly."
      );
    }

    if (__DEV__) {
      console.log("[GoogleSignIn] Sign-in successful, got ID token");
    }

    return idToken;
  } catch (error: any) {
    // Handle specific error codes
    if (error.code === statusCodes.SIGN_IN_CANCELLED) {
      throw new Error("Google sign-in was cancelled");
    } else if (error.code === statusCodes.IN_PROGRESS) {
      throw new Error("Google sign-in is already in progress");
    } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      throw new Error("Google Play Services is not available on this device");
    } else {
      console.error("[GoogleSignIn] Error:", error);
      throw error;
    }
  }
};

/**
 * Sign out from Google
 * Call this when user signs out of the app
 */
export const signOutFromGoogle = async (): Promise<void> => {
  try {
    await GoogleSignin.signOut();
    console.log("[GoogleSignIn] Signed out");
  } catch (error) {
    console.error("[GoogleSignIn] Sign out error:", error);
  }
};

/**
 * Check if user is currently signed in to Google
 */
export const isSignedInToGoogle = async (): Promise<boolean> => {
  try {
    const currentUser = await GoogleSignin.getCurrentUser();
    return currentUser !== null;
  } catch {
    return false;
  }
};

/**
 * Get currently signed in user (if any)
 */
export const getCurrentGoogleUser = async () => {
  try {
    const userInfo = await GoogleSignin.getCurrentUser();
    return userInfo;
  } catch {
    return null;
  }
};

export { statusCodes };
