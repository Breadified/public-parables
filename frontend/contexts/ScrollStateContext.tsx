/**
 * ScrollStateContext - Unified scroll coordination
 *
 * Eliminates timing-based race condition fixes with event-driven state transitions.
 * All systems coordinate through this central state machine instead of arbitrary timeouts.
 *
 * Phases:
 * - idle: No scroll activity, systems can react normally
 * - navigating: Navigation command issued, waiting for scroll
 * - scrolling: Active scroll (animated or user-initiated)
 * - measuring: Waiting for verse measurements to complete
 * - settling: Scroll ended, waiting for layout stability
 * - complete: All done, transition back to idle
 *
 * IMPORTANT: The 2000ms safety timeout is kept as a FALLBACK for native bridge failures,
 * not as the primary coordination mechanism.
 */

import React, { createContext, useContext, useCallback, useRef, useState, useMemo } from 'react';

export type ScrollPhase = 'idle' | 'navigating' | 'scrolling' | 'measuring' | 'settling' | 'complete';

interface ScrollTarget {
  chapterId: number | null;
  verseId: number | null;
}

interface MeasurementProgress {
  versesExpected: number;
  versesMeasured: Set<number>;
}

interface ScrollStateContextType {
  // Current state
  phase: ScrollPhase;
  target: ScrollTarget;

  // State checks (for consumers)
  isNavigating: boolean;
  isScrolling: boolean;
  isMeasuring: boolean;
  isIdle: boolean;
  /** True when any scroll/navigation activity is in progress */
  isBusy: boolean;

  // State transitions (for producers)
  startNavigation: (chapterId: number, verseId?: number) => void;
  startScrolling: () => void;
  startMeasuring: (expectedVerses: number[]) => void;
  recordVerseMeasurement: (verseId: number) => void;
  markSettling: () => void;
  markComplete: () => void;
  reset: () => void;

  // Callbacks (for coordination)
  onPhaseChange: (callback: (phase: ScrollPhase) => void) => () => void;
}

const ScrollStateContext = createContext<ScrollStateContextType | undefined>(undefined);

// Enable debug logging (set to false in production)
const DEBUG_SCROLL_STATE = __DEV__;

function logScrollState(message: string, data?: any) {
  if (DEBUG_SCROLL_STATE) {
    if (data) {
      console.log(`[ScrollState] ${message}`, data);
    } else {
      console.log(`[ScrollState] ${message}`);
    }
  }
}

export function ScrollStateProvider({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<ScrollPhase>('idle');
  const [target, setTarget] = useState<ScrollTarget>({ chapterId: null, verseId: null });
  const measurementProgress = useRef<MeasurementProgress>({ versesExpected: 0, versesMeasured: new Set() });
  const phaseListeners = useRef<Set<(phase: ScrollPhase) => void>>(new Set());

  // Safety timeout - ONLY fires if callbacks fail (native bridge issue)
  const safetyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearSafetyTimeout = useCallback(() => {
    if (safetyTimeoutRef.current) {
      clearTimeout(safetyTimeoutRef.current);
      safetyTimeoutRef.current = null;
    }
  }, []);

  const setSafetyTimeout = useCallback(() => {
    clearSafetyTimeout();
    safetyTimeoutRef.current = setTimeout(() => {
      logScrollState('⚠️ Safety timeout - forcing complete (native bridge may have dropped callback)');
      setPhase('complete');
      // Auto-reset to idle after safety timeout
      setTimeout(() => setPhase('idle'), 100);
    }, 2000);
  }, [clearSafetyTimeout]);

  const notifyListeners = useCallback((newPhase: ScrollPhase) => {
    phaseListeners.current.forEach(listener => {
      try {
        listener(newPhase);
      } catch (error) {
        console.error('[ScrollState] Listener error:', error);
      }
    });
  }, []);

  const transitionTo = useCallback((newPhase: ScrollPhase) => {
    setPhase(prev => {
      if (prev !== newPhase) {
        logScrollState(`${prev} → ${newPhase}`);
        // Notify listeners asynchronously to avoid state update conflicts
        setTimeout(() => notifyListeners(newPhase), 0);
      }
      return newPhase;
    });
  }, [notifyListeners]);

  // --- State Transitions ---

  const startNavigation = useCallback((chapterId: number, verseId?: number) => {
    logScrollState('Starting navigation', { chapterId, verseId });
    setTarget({ chapterId, verseId: verseId ?? null });
    measurementProgress.current = { versesExpected: 0, versesMeasured: new Set() };
    transitionTo('navigating');
    setSafetyTimeout();
  }, [transitionTo, setSafetyTimeout]);

  const startScrolling = useCallback(() => {
    transitionTo('scrolling');
  }, [transitionTo]);

  const startMeasuring = useCallback((expectedVerses: number[]) => {
    logScrollState('Starting measurement', { expectedCount: expectedVerses.length });
    measurementProgress.current = {
      versesExpected: expectedVerses.length,
      versesMeasured: new Set()
    };
    transitionTo('measuring');
  }, [transitionTo]);

  const recordVerseMeasurement = useCallback((verseId: number) => {
    const progress = measurementProgress.current;
    progress.versesMeasured.add(verseId);

    // Check if all expected verses are measured
    if (progress.versesMeasured.size >= progress.versesExpected && progress.versesExpected > 0) {
      logScrollState(`✅ All ${progress.versesExpected} verses measured`);
      transitionTo('settling');

      // Auto-transition to complete after short settle
      setTimeout(() => {
        clearSafetyTimeout();
        transitionTo('complete');
        // Auto-reset to idle
        setTimeout(() => transitionTo('idle'), 50);
      }, 50);
    }
  }, [transitionTo, clearSafetyTimeout]);

  const markSettling = useCallback(() => {
    transitionTo('settling');
  }, [transitionTo]);

  const markComplete = useCallback(() => {
    logScrollState('✅ Marking complete');
    clearSafetyTimeout();
    transitionTo('complete');
    // Auto-reset to idle
    setTimeout(() => transitionTo('idle'), 50);
  }, [transitionTo, clearSafetyTimeout]);

  const reset = useCallback(() => {
    logScrollState('🔄 Resetting to idle');
    clearSafetyTimeout();
    setTarget({ chapterId: null, verseId: null });
    measurementProgress.current = { versesExpected: 0, versesMeasured: new Set() };
    transitionTo('idle');
  }, [transitionTo, clearSafetyTimeout]);

  // --- Callbacks ---

  const onPhaseChange = useCallback((callback: (phase: ScrollPhase) => void) => {
    phaseListeners.current.add(callback);
    return () => {
      phaseListeners.current.delete(callback);
    };
  }, []);

  // --- Computed values ---

  const value = useMemo<ScrollStateContextType>(() => ({
    phase,
    target,
    isNavigating: phase === 'navigating',
    isScrolling: phase === 'scrolling',
    isMeasuring: phase === 'measuring',
    isIdle: phase === 'idle',
    isBusy: phase !== 'idle' && phase !== 'complete',
    startNavigation,
    startScrolling,
    startMeasuring,
    recordVerseMeasurement,
    markSettling,
    markComplete,
    reset,
    onPhaseChange,
  }), [
    phase,
    target,
    startNavigation,
    startScrolling,
    startMeasuring,
    recordVerseMeasurement,
    markSettling,
    markComplete,
    reset,
    onPhaseChange,
  ]);

  return (
    <ScrollStateContext.Provider value={value}>
      {children}
    </ScrollStateContext.Provider>
  );
}

export function useScrollState() {
  const context = useContext(ScrollStateContext);
  if (!context) {
    throw new Error('useScrollState must be used within ScrollStateProvider');
  }
  return context;
}

/**
 * Optional hook for components that may or may not be within ScrollStateProvider
 * Returns null if not within provider (for gradual migration)
 */
export function useScrollStateOptional(): ScrollStateContextType | null {
  return useContext(ScrollStateContext) ?? null;
}
