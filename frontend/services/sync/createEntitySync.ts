/**
 * Generic Entity Sync Factory
 *
 * Creates a reusable sync system for any entity (notes, bookmarks, etc.)
 * Uses Legend State's onChange for automatic reactive syncing to Supabase.
 *
 * Benefits:
 * - DRY: Write sync logic once, reuse for all entities
 * - Type-safe: Full TypeScript generics support
 * - Consistent: Same sync behavior across all entities
 * - Easy to extend: New entities require only 3 lines of config
 *
 * @example
 * const notesSync = createEntitySync<Note>({
 *   tableName: 'notes',
 *   storeObservable: bibleStore$.notes,
 *   getUserId: () => authStore$.user.peek()?.id || null,
 *   saveToStorage: () => bibleStore$.saveNotesToStorage(),
 * });
 *
 * const cleanup = notesSync.initialize();
 */

import { supabase } from '../../lib/supabase';
import { authStore$ } from '../../state/bibleStore';
import type { ObservableObject } from '@legendapp/state';
import type { RealtimeChannel } from '@supabase/supabase-js';

/**
 * Entity must have an id field and optionally updated_at for conflict resolution
 */
export interface SyncableEntity {
  id: string;
  user_id?: string;
  updated_at?: string;
  created_at?: string;
}

/**
 * Configuration for entity sync
 */
export interface EntitySyncConfig<T extends SyncableEntity> {
  /** Supabase table name */
  tableName: string;

  /** Legend State observable reference */
  storeObservable: ObservableObject<T[]>;

  /** Function to get current user ID for filtering */
  getUserId: () => string | null;

  /** Merge strategy for conflicts (default: 'server-wins') */
  mergeStrategy?: 'server-wins' | 'client-wins' | 'newest-wins';

  /** Optional: Save to AsyncStorage after changes */
  saveToStorage?: () => Promise<void>;

  /** Optional: Transform data before sending to Supabase */
  transformToServer?: (item: T) => any;

  /** Optional: Transform data after receiving from Supabase */
  transformFromServer?: (item: any) => T;

  /** Optional: Additional Supabase query filters */
  additionalFilters?: Record<string, any>;

  /** Optional: Debounce delay for onChange sync (default: 500ms) */
  debounceMs?: number;
}

/**
 * Create a sync system for an entity
 */
export function createEntitySync<T extends SyncableEntity>(
  config: EntitySyncConfig<T>
) {
  const {
    tableName,
    storeObservable,
    getUserId,
    mergeStrategy = 'server-wins',
    saveToStorage,
    transformToServer = (item) => item,
    transformFromServer = (item) => item,
    additionalFilters = {},
    debounceMs = 500,
  } = config;

  // Sync state management
  let realtimeChannel: RealtimeChannel | null = null;
  let isSyncing = false;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Load entities from Supabase (initial sync)
   */
  async function loadFromSupabase(): Promise<void> {
    try {
      const userId = getUserId();
      if (!userId) {
        console.log(`[${tableName}Sync] No user ID, skipping load`);
        return;
      }

      console.log(`[${tableName}Sync] 📥 Loading from Supabase...`, {
        tableName,
        userId,
        additionalFilters,
      });

      // Build query with user filter
      let query = supabase
        .from(tableName)
        .select('*')
        .eq('user_id', userId);

      // Apply additional filters
      Object.entries(additionalFilters).forEach(([key, value]) => {
        query = query.eq(key, value);
      });

      const { data, error } = await query.order('created_at', { ascending: false });

      console.log(`[${tableName}Sync] 📊 Query result:`, {
        hasData: !!data,
        dataCount: data?.length || 0,
        hasError: !!error,
        errorMessage: error?.message,
      });

      if (error) throw error;

      // Transform data from server
      const remoteItems = (data || []).map(transformFromServer);

      // Merge with local data
      isSyncing = true;
      const localItems = storeObservable.peek();
      const mergedItems = mergeData(localItems, remoteItems);
      storeObservable.set(mergedItems);
      isSyncing = false;

      console.log(
        `[${tableName}Sync] ✅ Loaded ${remoteItems.length} items from Supabase`
      );
    } catch (error: any) {
      console.error(`[${tableName}Sync] ❌ Error loading:`, {
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        code: error?.code,
        fullError: error,
      });
      isSyncing = false;
    }
  }

  /**
   * Merge local and remote data according to strategy
   */
  function mergeData(localItems: T[], remoteItems: T[]): T[] {
    const remoteMap = new Map(remoteItems.map((item) => [item.id, item]));
    const localMap = new Map(localItems.map((item) => [item.id, item]));

    if (mergeStrategy === 'server-wins') {
      // Remote wins, keep local-only items
      const localOnly = localItems.filter((item) => !remoteMap.has(item.id));
      return [...remoteItems, ...localOnly];
    } else if (mergeStrategy === 'client-wins') {
      // Local wins, add remote-only items
      const remoteOnly = remoteItems.filter((item) => !localMap.has(item.id));
      return [...localItems, ...remoteOnly];
    } else {
      // newest-wins: Compare updated_at timestamps
      const merged: T[] = [];
      const allIds = new Set([
        ...localItems.map((i) => i.id),
        ...remoteItems.map((i) => i.id),
      ]);

      allIds.forEach((id) => {
        const local = localMap.get(id);
        const remote = remoteMap.get(id);

        if (!local) {
          merged.push(remote!);
        } else if (!remote) {
          merged.push(local);
        } else {
          // Both exist - compare timestamps
          const localTime = new Date(local.updated_at || local.created_at || 0).getTime();
          const remoteTime = new Date(remote.updated_at || remote.created_at || 0).getTime();
          merged.push(remoteTime > localTime ? remote : local);
        }
      });

      return merged;
    }
  }

  /**
   * Sync entities to Supabase
   */
  async function syncToSupabase(items: T[]): Promise<void> {
    try {
      const userId = getUserId();
      if (!userId) return;

      // Filter to only sync items that belong to current user (or have no user_id yet)
      // This prevents RLS errors when stale data from other users exists locally
      const userItems = items.filter(
        (item) => !item.user_id || item.user_id === userId
      );

      if (userItems.length === 0) {
        console.log(`[${tableName}Sync] ⏭️ No items to sync for current user`);
        return;
      }

      console.log(`[${tableName}Sync] 📤 Syncing to Supabase...`, {
        total: items.length,
        syncing: userItems.length,
        skipped: items.length - userItems.length,
      });

      // Ensure all items have correct user_id and transform for server
      const itemsToSync = userItems.map((item) =>
        transformToServer({
          ...item,
          user_id: userId,
        })
      );

      const { error } = await supabase
        .from(tableName)
        .upsert(itemsToSync, { onConflict: 'id' });

      if (error) throw error;

      console.log(`[${tableName}Sync] ✅ Synced successfully`);
    } catch (error) {
      console.error(`[${tableName}Sync] ❌ Error syncing:`, error);
    }
  }

  /**
   * Subscribe to real-time changes from Supabase
   */
  async function subscribeToRealtime(): Promise<void> {
    try {
      const userId = getUserId();
      if (!userId) return;

      console.log(`[${tableName}Sync] 📡 Subscribing to real-time changes...`);

      realtimeChannel = supabase
        .channel(`${tableName}:user_id=eq.${userId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: tableName,
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            console.log(
              `[${tableName}Sync] 📨 Real-time change:`,
              payload.eventType
            );

            // Prevent onChange from triggering sync back to Supabase
            isSyncing = true;

            if (payload.eventType === 'INSERT') {
              const newItem = transformFromServer(payload.new);
              const currentItems = storeObservable.peek();
              if (!currentItems.find((item) => item.id === newItem.id)) {
                storeObservable.set([...currentItems, newItem as T]);
              }
            } else if (payload.eventType === 'UPDATE') {
              const updatedItem = transformFromServer(payload.new);
              const currentItems = storeObservable.peek();
              const index = currentItems.findIndex(
                (item) => item.id === updatedItem.id
              );
              if (index !== -1) {
                const updated = [...currentItems];
                updated[index] = updatedItem as T;
                storeObservable.set(updated);
              }
            } else if (payload.eventType === 'DELETE') {
              const currentItems = storeObservable.peek();
              const filtered = currentItems.filter(
                (item) => item.id !== payload.old.id
              );
              storeObservable.set(filtered);
            }

            isSyncing = false;
          }
        )
        .subscribe();

      console.log(`[${tableName}Sync] ✅ Real-time subscription active`);
    } catch (error) {
      console.error(`[${tableName}Sync] ❌ Error subscribing:`, error);
      isSyncing = false;
    }
  }

  /**
   * Initialize sync system
   * Returns cleanup function
   */
  function initialize(): () => void {
    console.log(`[${tableName}Sync] 🔄 Initializing sync...`);

    // 1. Load from Supabase
    loadFromSupabase();

    // 2. Watch for local changes and debounce sync
    const unsubscribe = storeObservable.onChange(
      async ({ value }: { value: T[] }) => {
        // Skip if not authenticated or if change came from Supabase
        if (!authStore$.shouldSync.peek() || isSyncing) return;

        // Clear existing timer
        if (debounceTimer) {
          clearTimeout(debounceTimer);
        }

        // Debounce to avoid syncing on every keystroke
        debounceTimer = setTimeout(async () => {
          console.log(`[${tableName}Sync] 📤 Local change detected, syncing...`);
          await syncToSupabase(value);

          // Save to AsyncStorage if configured
          if (saveToStorage) {
            await saveToStorage();
          }
        }, debounceMs);
      }
    );

    // 3. Subscribe to real-time changes
    subscribeToRealtime();

    console.log(`[${tableName}Sync] ✅ Sync initialized`);

    // Return cleanup function
    return () => {
      console.log(`[${tableName}Sync] 🧹 Cleaning up sync...`);

      unsubscribe();

      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }

      if (realtimeChannel) {
        realtimeChannel.unsubscribe();
        realtimeChannel = null;
      }
    };
  }

  /**
   * Check if real-time subscription is active
   */
  function isSubscriptionActive(): boolean {
    return realtimeChannel !== null;
  }

  /**
   * Reconnect subscription if it was lost
   * Called on app resume or network reconnect
   */
  async function reconnectIfNeeded(): Promise<void> {
    const userId = getUserId();
    if (!userId) {
      console.log(`[${tableName}Sync] No user ID, skipping reconnect`);
      return;
    }

    if (!realtimeChannel) {
      console.log(`[${tableName}Sync] Subscription lost, reconnecting...`);
      await subscribeToRealtime();
      // Also reload data to ensure we didn't miss any updates
      await loadFromSupabase();
    } else {
      console.log(`[${tableName}Sync] Subscription still active, no reconnect needed`);
    }
  }

  // Return sync interface
  return {
    initialize,
    loadFromSupabase,
    syncToSupabase,
    subscribeToRealtime,
    isSubscriptionActive,
    reconnectIfNeeded,
  };
}
