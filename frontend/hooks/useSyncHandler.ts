/**
 * useSyncHandler - Hook to register a sync handler with the SyncProvider
 *
 * Automatically registers/unregisters the handler based on component lifecycle
 * and re-registers when dependencies change.
 *
 * @example
 * ```tsx
 * useSyncHandler(
 *   'devotion-comments',
 *   async () => {
 *     const questionId = devotionStore$.todaysQuestion.get()?.id;
 *     if (questionId) {
 *       await syncDevotionCommentsIfNeeded(questionId, userId);
 *     }
 *   },
 *   {
 *     priority: 10,
 *     isActive: () => !!devotionStore$.todaysQuestion.get()?.id,
 *     deps: [userId]
 *   }
 * );
 * ```
 */

import { useEffect, useRef, useCallback, type DependencyList } from 'react';
import { useSyncContextSafe, type SyncHandler } from '@/contexts/SyncContext';

interface UseSyncHandlerOptions {
  /** Priority for execution order (lower = higher priority). Default: 100 */
  priority?: number;
  /** Optional function to check if handler should run */
  isActive?: () => boolean;
  /** Dependencies that should trigger re-registration when changed */
  deps?: DependencyList;
}

/**
 * Register a sync handler that runs on app resume or network reconnect.
 * The handler is automatically unregistered when the component unmounts.
 *
 * @param name - Unique identifier for this sync handler
 * @param handler - Async function to run on sync trigger
 * @param options - Configuration options
 */
export function useSyncHandler(
  name: string,
  handler: () => Promise<void>,
  options: UseSyncHandlerOptions = {}
): void {
  const { priority = 100, isActive, deps = [] } = options;
  const context = useSyncContextSafe();

  // Keep a stable reference to the handler that updates when deps change
  const handlerRef = useRef(handler);
  const isActiveRef = useRef(isActive);

  // Update refs when handler or isActive changes
  useEffect(() => {
    handlerRef.current = handler;
    isActiveRef.current = isActive;
  }, [handler, isActive]);

  // Create a stable sync function that uses the refs
  const stableSync = useCallback(async () => {
    await handlerRef.current();
  }, []);

  const stableIsActive = useCallback(() => {
    return isActiveRef.current ? isActiveRef.current() : true;
  }, []);

  useEffect(() => {
    // If no provider, silently skip (allows usage without provider)
    if (!context) {
      return;
    }

    const syncHandler: SyncHandler = {
      name,
      priority,
      sync: stableSync,
      isActive: stableIsActive,
    };

    const unregister = context.registerHandler(name, syncHandler);
    return unregister;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context, name, priority, stableSync, stableIsActive, ...deps]);
}

export default useSyncHandler;
