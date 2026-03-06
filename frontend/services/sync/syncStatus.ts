/**
 * Sync Status Tracking Service
 *
 * Manages and tracks the sync status for UI feedback.
 * Features:
 * - Track sync state (idle, syncing, error, offline)
 * - Track last sync time
 * - Provide sync status to UI components
 */

import { observable } from "@legendapp/state";

export type SyncState = "idle" | "syncing" | "error" | "offline";

export interface SyncStatus {
  state: SyncState;
  lastSyncTime: number | null;
  lastSyncError: string | null;
  isSyncing: boolean;
}

/**
 * Observable sync status store
 */
export const syncStatus$ = observable<SyncStatus>({
  state: "idle",
  lastSyncTime: null,
  lastSyncError: null,
  isSyncing: false,
});

/**
 * Update sync state
 */
export const setSyncState = (state: SyncState) => {
  syncStatus$.state.set(state);
  syncStatus$.isSyncing.set(state === "syncing");
};

/**
 * Mark sync as started
 */
export const startSync = () => {
  setSyncState("syncing");
  syncStatus$.lastSyncError.set(null);
};

/**
 * Mark sync as completed successfully
 */
export const completeSync = () => {
  setSyncState("idle");
  syncStatus$.lastSyncTime.set(Date.now());
  syncStatus$.lastSyncError.set(null);
};

/**
 * Mark sync as failed
 */
export const failSync = (error: string) => {
  setSyncState("error");
  syncStatus$.lastSyncError.set(error);
};

/**
 * Mark as offline
 */
export const markOffline = () => {
  setSyncState("offline");
};

/**
 * Get sync status message for UI
 */
export const getSyncStatusMessage = (): string => {
  const status = syncStatus$.peek();

  if (status.state === "offline") {
    return "Offline";
  }

  if (status.state === "syncing") {
    return "Syncing...";
  }

  if (status.state === "error") {
    return `Sync error: ${status.lastSyncError || "Unknown error"}`;
  }

  if (status.lastSyncTime) {
    const timeSince = Date.now() - status.lastSyncTime;
    if (timeSince < 60000) {
      return "Synced just now";
    } else if (timeSince < 3600000) {
      const minutes = Math.floor(timeSince / 60000);
      return `Synced ${minutes}m ago`;
    } else {
      const hours = Math.floor(timeSince / 3600000);
      return `Synced ${hours}h ago`;
    }
  }

  return "All synced";
};

/**
 * Get sync status icon for UI
 */
export const getSyncStatusIcon = (): string => {
  const status = syncStatus$.peek();

  switch (status.state) {
    case "syncing":
      return "⟳"; // Rotating arrow
    case "error":
      return "⚠"; // Warning
    case "offline":
      return "⊘"; // Circle with slash
    case "idle":
      return "✓"; // Check mark
    default:
      return "?";
  }
};
