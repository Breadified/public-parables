/**
 * Supabase Client Configuration
 *
 * Initializes the Supabase client with AsyncStorage for session persistence.
 * Configured for remote Supabase instance.
 */

import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Remote Supabase configuration (from environment variables)
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Supabase client instance
 *
 * Features:
 * - AsyncStorage for persistent auth sessions
 * - Auto-refresh of access tokens (managed via AppState in useUnifiedAuth)
 * - Persistent storage for OAuth state
 * - Connects to remote Supabase instance (wiepinhkzxpiaiipflcb.supabase.co)
 *
 * IMPORTANT: React Native requires AppState listener for auto-refresh
 * - Call startAutoRefresh() when app becomes active
 * - Call stopAutoRefresh() when app goes to background
 * - This is handled in useUnifiedAuth.ts initializeAuth()
 *
 * Token Lifecycle:
 * - Access tokens: Short-lived (default 1 hour)
 * - Refresh tokens: Single-use with 10-second reuse window
 * - Auto-refresh happens proactively before token expiration
 * - TOKEN_REFRESHED event fires on each successful refresh
 */
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    // Use AsyncStorage for session persistence (not SecureStore - sessions often exceed 2048 byte limit)
    storage: AsyncStorage,
    // Auto-refresh tokens before expiry (requires AppState management in React Native)
    autoRefreshToken: true,
    // Persist session across app restarts
    persistSession: true,
    // Detect session from URL (for OAuth callbacks and email verification)
    // IMPORTANT: Set to true to enable deep link authentication
    detectSessionInUrl: true,
  },
});

/**
 * Type exports for TypeScript support
 */
export type Database = any; // Will be generated from Supabase schema

/**
 * Auth event types
 */
export type AuthChangeEvent =
  | 'SIGNED_IN'
  | 'SIGNED_OUT'
  | 'TOKEN_REFRESHED'
  | 'USER_UPDATED'
  | 'PASSWORD_RECOVERY';
