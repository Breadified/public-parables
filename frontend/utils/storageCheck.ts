/**
 * Storage Check Utility
 *
 * Checks available device storage and warns users if space is low.
 * The app requires approximately 1GB to function properly.
 */

import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

// Minimum recommended free storage in bytes (2GB) - amber warning
export const MINIMUM_STORAGE_BYTES = 2 * 1024 * 1024 * 1024;

// Critical threshold in bytes (1.5GB) - red critical warning
export const CRITICAL_STORAGE_BYTES = 1.5 * 1024 * 1024 * 1024;

export interface StorageInfo {
  freeBytes: number;
  totalBytes: number;
  freeGB: number;
  totalGB: number;
  isLow: boolean;
  isCritical: boolean;
}

/**
 * Get device storage information
 * @returns Storage info with free space and status flags
 */
export async function getStorageInfo(): Promise<StorageInfo | null> {
  try {
    // Note: These functions are only available on iOS and Android
    if (Platform.OS === 'web') {
      return null;
    }

    const freeBytes = await FileSystem.getFreeDiskStorageAsync();
    const totalBytes = await FileSystem.getTotalDiskCapacityAsync();

    const freeGB = freeBytes / (1024 * 1024 * 1024);
    const totalGB = totalBytes / (1024 * 1024 * 1024);

    return {
      freeBytes,
      totalBytes,
      freeGB: Math.round(freeGB * 100) / 100,
      totalGB: Math.round(totalGB * 100) / 100,
      isLow: freeBytes < MINIMUM_STORAGE_BYTES,
      isCritical: freeBytes < CRITICAL_STORAGE_BYTES,
    };
  } catch (error) {
    console.warn('[StorageCheck] Failed to get storage info:', error);
    return null;
  }
}

/**
 * Check if device has sufficient storage for the app
 * @returns true if storage is sufficient, false if low
 */
export async function hasEnoughStorage(): Promise<boolean> {
  const info = await getStorageInfo();
  return info === null || !info.isLow;
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
