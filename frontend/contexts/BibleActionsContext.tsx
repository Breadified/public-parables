/**
 * BibleActionsContext - Unified Bible text action handling
 *
 * Provides centralized handling for all Bible text selection actions:
 * - copy: Copy formatted verses to clipboard
 * - share: Share verses via system share sheet
 * - highlight: Open color picker, then apply highlight
 * - note: Create new note linked to selected verses
 * - bookmark: Create bookmark at first selected verse
 *
 * This context wraps useTextActionHandler and provides it to all
 * Bible rendering components, eliminating the need for each component
 * to set up its own action handling.
 */

import React, { createContext, useContext, useMemo } from 'react';
import { useTextActionHandler, type TextSelectionAction, type ActionContext } from '../hooks/useTextActionHandler';
import { useHighlightActions } from '../hooks/useHighlightActions';
import type { VerseLine } from '../modules/bible/verseActions';

/**
 * Highlight actions exposed by the context
 */
export interface HighlightActionsState {
  highlightPickerVisible: boolean;
  handleHighlightColorPick: (color: any) => void;
  handleRemoveHighlight: () => void;
  handleCloseHighlightPicker: () => void;
  startHighlight: (verseIds: number[], context: { bookName: string; chapterNumber: number }) => void;
}

/**
 * Context value provided by BibleActionsProvider
 */
export interface BibleActionsContextValue {
  /**
   * Handle a text selection action
   *
   * @param action - The action type (copy, share, highlight, note, bookmark)
   * @param verseIds - Array of selected verse IDs
   * @param verseLines - VerseLine data for formatting
   * @param context - Chapter context for the action
   */
  handleTextAction: (
    action: TextSelectionAction,
    verseIds: number[],
    verseLines: VerseLine[],
    context: ActionContext
  ) => Promise<void>;

  /**
   * Highlight picker state and handlers
   * Pass these to HighlightColorPicker component
   */
  highlightActions: HighlightActionsState;

  /**
   * Current version ID used for action formatting
   */
  versionId: string;
}

const BibleActionsContext = createContext<BibleActionsContextValue | null>(null);

interface BibleActionsProviderProps {
  children: React.ReactNode;
  /**
   * Bible version ID for formatting actions (e.g., "ESV", "NIV")
   */
  versionId: string;
  /**
   * Optional callback when any action completes
   */
  onActionComplete?: (action: TextSelectionAction, success: boolean, message: string) => void;
}

/**
 * Provider for Bible text action handling
 *
 * Should be placed inside components that need text action handling.
 * Can be placed at tab level or view level depending on needs.
 *
 * @example
 * ```tsx
 * // At tab level with dynamic versionId
 * <BibleActionsProvider versionId={currentVersionId}>
 *   <BibleContentRenderer ... />
 *   <HighlightColorPicker
 *     visible={highlightActions.highlightPickerVisible}
 *     onClose={highlightActions.handleCloseHighlightPicker}
 *     onColorSelect={highlightActions.handleHighlightColorPick}
 *     onRemoveHighlight={highlightActions.handleRemoveHighlight}
 *   />
 * </BibleActionsProvider>
 * ```
 */
export const BibleActionsProvider: React.FC<BibleActionsProviderProps> = ({
  children,
  versionId,
  onActionComplete,
}) => {
  const { handleAction, highlightActions } = useTextActionHandler({
    versionId,
    onActionComplete,
  });

  const contextValue = useMemo<BibleActionsContextValue>(
    () => ({
      handleTextAction: handleAction,
      highlightActions,
      versionId,
    }),
    [handleAction, highlightActions, versionId]
  );

  return (
    <BibleActionsContext.Provider value={contextValue}>
      {children}
    </BibleActionsContext.Provider>
  );
};

/**
 * Hook to access Bible action handling
 *
 * @throws Error if used outside BibleActionsProvider
 *
 * @example
 * ```tsx
 * const { handleTextAction, highlightActions } = useBibleActions();
 *
 * const onTextSelection = async (event: TextActionEvent) => {
 *   await handleTextAction(
 *     event.action,
 *     event.verseIds,
 *     event.verseLines,
 *     { bookName, chapterNumber, chapterId }
 *   );
 * };
 * ```
 */
export const useBibleActions = (): BibleActionsContextValue => {
  const context = useContext(BibleActionsContext);
  if (!context) {
    throw new Error('useBibleActions must be used within a BibleActionsProvider');
  }
  return context;
};

/**
 * Hook that returns undefined if not within provider (for optional usage)
 * Useful for components that work both with and without action handling
 */
export const useBibleActionsOptional = (): BibleActionsContextValue | null => {
  return useContext(BibleActionsContext);
};
