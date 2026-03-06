/**
 * useDelete - Simple soft delete with undo functionality
 *
 * Provides a 5-second window to undo deletions before permanent removal.
 * Uses dependency injection pattern - no registry needed.
 *
 * Usage:
 * ```typescript
 * const { deleteItem, ToastComponent } = useDelete({
 *   onDelete: () => store$.softDelete(item.id),
 *   onRestore: () => store$.restore(item.id),
 *   onPermanentDelete: () => store$.permanentDelete(item.id),
 *   message: "Note removed"
 * });
 *
 * // Trigger delete
 * deleteItem();
 *
 * // Render toast
 * <ToastComponent />
 * ```
 */

import { useState, useCallback, useRef } from 'react';
import React from 'react';
import { DelightfulToast, ToastConfig } from '../components/DelightfulToast';

export interface UseDeleteOptions {
  onDelete: () => void;              // Execute soft delete (move to pending)
  onRestore: () => void;             // Undo the delete (restore from pending)
  onPermanentDelete?: () => void;    // Called after timeout (optional cleanup)
  message: string;                   // Toast message ("Note removed", "Bookmark removed")
  undoLabel?: string;                // Action button label (default: "Undo")
  duration?: number;                 // Time before permanent delete in ms (default: 5000)
}

export function useDelete(options: UseDeleteOptions) {
  const {
    onDelete,
    onRestore,
    onPermanentDelete,
    message,
    undoLabel = 'Undo',
    duration = 5000,
  } = options;

  const [toastConfig, setToastConfig] = useState<ToastConfig | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear any existing timeout
  const clearTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // Execute delete and show undo toast
  const deleteItem = useCallback(() => {
    console.log('[useDelete] deleteItem called');

    // Clear any existing timeout
    clearTimer();

    // Execute soft delete
    onDelete();
    console.log('[useDelete] onDelete executed, setting toast config');

    // Show toast with undo action
    const config = {
      message,
      type: 'info' as const,
      position: 'bottom' as const,
      duration: duration,
      actionLabel: undoLabel,
      onAction: () => {
        // User clicked undo - restore and hide toast
        clearTimer();
        onRestore();
        setToastConfig(null);
      },
    };

    setToastConfig(config);
    console.log('[useDelete] Toast config set:', { message, duration, actionLabel: undoLabel });

    // Start timer for permanent deletion
    timeoutRef.current = setTimeout(() => {
      console.log('[useDelete] Timer expired, permanently deleting');
      // Time's up - permanently delete
      onPermanentDelete?.();
      setToastConfig(null);
      timeoutRef.current = null;
    }, duration);
  }, [onDelete, onRestore, onPermanentDelete, message, undoLabel, duration, clearTimer]);

  // Programmatic undo (can be called externally)
  const undoDelete = useCallback(() => {
    clearTimer();
    onRestore();
    setToastConfig(null);
  }, [onRestore, clearTimer]);

  // Toast component to render
  const ToastComponent = useCallback(() => {
    console.log('[useDelete] ToastComponent render, toastConfig:', toastConfig);

    // Only create element if config exists
    if (!toastConfig) {
      console.log('[useDelete] toastConfig is null, returning null');
      return null;
    }

    console.log('[useDelete] Creating DelightfulToast with config:', toastConfig);
    return React.createElement(DelightfulToast, {
      config: toastConfig,
      onHide: () => setToastConfig(null),
    });
  }, [toastConfig]); // Update when config changes to avoid stale closure

  return {
    deleteItem,
    undoDelete,
    ToastComponent,
  };
}
