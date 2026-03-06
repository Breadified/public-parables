/**
 * why-did-you-render setup
 *
 * This must be imported BEFORE React in the entry point.
 * It helps detect unnecessary re-renders in development.
 *
 * To track a specific component, add:
 *   ComponentName.whyDidYouRender = true;
 *
 * Or track all pure components with trackAllPureComponents: true
 */

import React from 'react';

if (__DEV__) {
  console.log('[WDYR] 🔍 why-did-you-render is initializing...');
  const whyDidYouRender = require('@welldone-software/why-did-you-render');
  whyDidYouRender(React, {
    // Track all pure components (observer wrapped components are pure)
    trackAllPureComponents: true,

    // Log when props/state are equal but component still re-renders
    // false = only log unnecessary re-renders (same props)
    // true = also log when values differ (verbose)
    logOnDifferentValues: false,

    // Include hook changes in the log
    trackHooks: true,

    // Don't collapse logs - show them expanded
    collapseGroups: false,

    // Log to console in a visible way
    notifier: ({ Component, displayName, reason }: any) => {
      console.log(`[WDYR] 🔄 ${displayName || Component?.name || 'Unknown'} re-rendered:`, reason);
    },
  });
}
