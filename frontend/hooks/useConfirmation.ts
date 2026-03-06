/**
 * useConfirmation - Hook for easier confirmation modal state management
 *
 * Usage:
 * ```typescript
 * const { show, hide, ConfirmationModal } = useConfirmation();
 *
 * // Show modal
 * show({
 *   variant: 'destructive',
 *   title: 'Delete Note?',
 *   message: 'This cannot be undone',
 *   onConfirm: () => console.log('Deleted!')
 * });
 *
 * // Render modal
 * <ConfirmationModal />
 * ```
 */

import { useState, useCallback } from 'react';
import React from 'react';
import {
  ConfirmationModal as ConfirmationModalComponent,
  ConfirmationModalProps,
} from '../components/ConfirmationModal';

type ShowConfirmationOptions = Omit<ConfirmationModalProps, 'visible' | 'onCancel'> & {
  onCancel?: () => void;
};

export function useConfirmation() {
  const [visible, setVisible] = useState(false);
  const [options, setOptions] = useState<ShowConfirmationOptions | null>(null);

  const show = useCallback((opts: ShowConfirmationOptions) => {
    setOptions(opts);
    setVisible(true);
  }, []);

  const hide = useCallback(() => {
    setVisible(false);
    // Clear options after animation completes
    setTimeout(() => setOptions(null), 300);
  }, []);

  const handleConfirm = useCallback(() => {
    if (options?.onConfirm) {
      options.onConfirm();
    }
    hide();
  }, [options, hide]);

  const handleCancel = useCallback(() => {
    if (options?.onCancel) {
      options.onCancel();
    }
    hide();
  }, [options, hide]);

  const ConfirmationModal = useCallback(() => {
    if (!options) return null;

    return React.createElement(ConfirmationModalComponent, {
      ...options,
      visible,
      onConfirm: handleConfirm,
      onCancel: handleCancel,
    });
  }, [visible, options, handleConfirm, handleCancel]);

  return {
    show,
    hide,
    confirm: show, // Alias
    ConfirmationModal,
  };
}
