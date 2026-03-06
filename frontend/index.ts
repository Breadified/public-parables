import "./wdyr"; // Must be FIRST - before React is imported
import "react-native-get-random-values"; // Second - crypto polyfill

// Suppress noisy Reanimated useEffect dependency warnings in dev mode
// These are caused by react-native-keyboard-controller's useSmoothKeyboardHandler
// using SharedValues that have internal BigInt tracking IDs
if (__DEV__) {
  const originalConsoleError = console.error;
  console.error = (...args: any[]) => {
    // Filter out the "Previous: %s Incoming: %s useEffect" warnings
    if (
      args.length > 0 &&
      typeof args[0] === "string" &&
      (args[0].includes("Previous: %s") ||
        args[0].includes("The final argument passed to %s changed size between renders"))
    ) {
      return;
    }
    originalConsoleError(...args);
  };
}

import "./config/legendState"; // Second
import "expo-router/entry"; // Third