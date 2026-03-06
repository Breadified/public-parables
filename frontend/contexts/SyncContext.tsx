/**
 * Sync Context - Generic sync coordination for app state and network changes
 *
 * Provides a reusable infrastructure for features to register sync handlers
 * that are triggered when:
 * 1. App returns to foreground (AppState change)
 * 2. Network reconnects (NetInfo change)
 * 3. Manual sync triggered
 *
 * Key features:
 * - Priority-based handler execution (lower number = higher priority)
 * - Sequential execution to prevent API flooding
 * - Prevents concurrent syncs with isSyncing flag
 * - Network state tracking via isOnline
 *
 * Usage:
 * ```tsx
 * // Register a sync handler with useSyncHandler
 * useSyncHandler('devotion-comments', async () => {
 *   await syncDevotionComments();
 * }, { priority: 10, deps: [questionId, userId] });
 * ```
 */

import React, { createContext, useContext, useRef, useEffect, useCallback, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

export type SyncTriggerReason = 'app_foreground' | 'network_reconnect' | 'manual';

export interface SyncHandler {
  name: string;
  priority: number; // Lower = higher priority (default: 100)
  sync: () => Promise<void>;
  isActive?: () => boolean; // Optional: check if handler should run
}

interface SyncRegistry {
  [name: string]: SyncHandler;
}

export interface SyncContextValue {
  /** Register a sync handler - returns unregister function */
  registerHandler: (name: string, handler: SyncHandler) => () => void;
  /** Unregister a handler by name */
  unregisterHandler: (name: string) => void;
  /** Manually trigger all registered sync handlers */
  triggerSync: (reason: SyncTriggerReason) => Promise<void>;
  /** Current network online status */
  isOnline: boolean;
  /** Whether a sync is currently in progress */
  isSyncing: boolean;
}

const SyncContext = createContext<SyncContextValue | null>(null);

interface SyncProviderProps {
  children: React.ReactNode;
  /** Whether syncing is enabled (e.g., only when authenticated) */
  enabled?: boolean;
}

/**
 * Provider that handles AppState and network change listeners,
 * triggering all registered sync handlers on reconnect/foreground.
 */
export function SyncProvider({
  children,
  enabled = true,
}: SyncProviderProps) {
  const registryRef = useRef<SyncRegistry>({});
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const prevAppStateRef = useRef<AppStateStatus>(AppState.currentState);
  const prevNetworkConnectedRef = useRef<boolean | null>(null);

  // Register a sync handler
  const registerHandler = useCallback((name: string, handler: SyncHandler) => {
    registryRef.current[name] = handler;
    console.log(`[SyncProvider] Registered handler: ${name} (priority: ${handler.priority})`);

    // Return unregister function
    return () => {
      delete registryRef.current[name];
      console.log(`[SyncProvider] Unregistered handler: ${name}`);
    };
  }, []);

  // Unregister a handler by name
  const unregisterHandler = useCallback((name: string) => {
    delete registryRef.current[name];
    console.log(`[SyncProvider] Unregistered handler: ${name}`);
  }, []);

  // Trigger all registered sync handlers (sequential, priority-sorted)
  const triggerSync = useCallback(async (reason: SyncTriggerReason) => {
    // Skip if syncing or disabled
    if (isSyncing || !enabled) {
      console.log(`[SyncProvider] Skipping sync - isSyncing: ${isSyncing}, enabled: ${enabled}`);
      return;
    }

    const handlers = Object.values(registryRef.current);
    if (handlers.length === 0) {
      console.log('[SyncProvider] No handlers registered, skipping sync');
      return;
    }

    // Sort by priority (lower = higher priority)
    const sortedHandlers = handlers.sort((a, b) => a.priority - b.priority);

    // Filter to only active handlers
    const activeHandlers = sortedHandlers.filter(
      handler => !handler.isActive || handler.isActive()
    );

    if (activeHandlers.length === 0) {
      console.log('[SyncProvider] No active handlers, skipping sync');
      return;
    }

    setIsSyncing(true);
    console.log(`[SyncProvider] Triggering ${activeHandlers.length} sync handlers - reason: ${reason}`);

    // Run handlers sequentially to prevent API flooding
    for (const handler of activeHandlers) {
      try {
        console.log(`[SyncProvider] Running handler: ${handler.name}`);
        await handler.sync();
        console.log(`[SyncProvider] Completed handler: ${handler.name}`);
      } catch (error) {
        console.error(`[SyncProvider] Handler '${handler.name}' failed:`, error);
        // Continue with other handlers even if one fails
      }
    }

    setIsSyncing(false);
    console.log('[SyncProvider] Sync complete');
  }, [isSyncing, enabled]);

  // Handle AppState changes (foreground/background)
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      const wasInBackground = prevAppStateRef.current.match(/inactive|background/);
      const isNowActive = nextAppState === 'active';

      if (wasInBackground && isNowActive) {
        console.log('[SyncProvider] App returned to foreground');
        // Small delay to let the app settle
        setTimeout(() => triggerSync('app_foreground'), 500);
      }

      prevAppStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [triggerSync]);

  // Handle network connectivity changes
  useEffect(() => {
    const handleNetworkChange = (state: NetInfoState) => {
      const isConnected = state.isConnected ?? false;
      const wasDisconnected = prevNetworkConnectedRef.current === false;
      const isNowConnected = isConnected;

      // Update isOnline state
      setIsOnline(isConnected);

      // Detect transition from disconnected to connected
      if (wasDisconnected && isNowConnected) {
        console.log('[SyncProvider] Network reconnected');
        // Small delay to ensure network is stable
        setTimeout(() => triggerSync('network_reconnect'), 1000);
      }

      prevNetworkConnectedRef.current = isConnected;
    };

    const unsubscribe = NetInfo.addEventListener(handleNetworkChange);

    // Initialize the network state
    NetInfo.fetch().then(state => {
      const isConnected = state.isConnected ?? false;
      prevNetworkConnectedRef.current = isConnected;
      setIsOnline(isConnected);
    });

    return () => unsubscribe();
  }, [triggerSync]);

  const value: SyncContextValue = {
    registerHandler,
    unregisterHandler,
    triggerSync,
    isOnline,
    isSyncing,
  };

  return (
    <SyncContext.Provider value={value}>
      {children}
    </SyncContext.Provider>
  );
}

/**
 * Hook to access the sync context
 * @throws Error if used outside SyncProvider
 */
export function useSyncContext(): SyncContextValue {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error('useSyncContext must be used within SyncProvider');
  }
  return context;
}

/**
 * Hook to safely access sync context (returns null if outside provider)
 * Useful for optional sync integration
 */
export function useSyncContextSafe(): SyncContextValue | null {
  return useContext(SyncContext);
}

export default SyncContext;
