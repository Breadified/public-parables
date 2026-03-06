/**
 * Navigation Hooks - Barrel Export
 *
 * Unified navigation system for Bible viewers
 * All hooks share the same base navigation logic (useNavigationBase)
 */

export { useNavigationBase } from './useNavigationBase';
export type { NavigationBaseParams, NavigationBaseReturn } from './useNavigationBase';

export { useScrollNavigation } from './useScrollNavigation';
export type { UseScrollNavigationParams, UseBibleNavigationReturn } from './useScrollNavigation';

export { useVerseAlignedNavigation } from './useVerseAlignedNavigation';
