/**
 * Auth Stack Layout
 *
 * Stack navigator for authentication screens.
 * Handles login, signup, and related auth flows.
 */

import { useEffect } from "react";
import { Stack } from "expo-router";
import { useUnifiedAuth } from "../../hooks/useUnifiedAuth";

export default function AuthLayout() {
  const { setIsInAuthFlow } = useUnifiedAuth();

  // Track when user enters/exits auth flow
  useEffect(() => {
    setIsInAuthFlow(true);
    return () => {
      setIsInAuthFlow(false);
    };
  }, [setIsInAuthFlow]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        presentation: "card", // Full-screen navigation, not modal
        animation: "slide_from_right",
      }}
    >
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" />
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="reset-password" />
      <Stack.Screen name="verify-email" />
      <Stack.Screen name="verify-otp" />
      <Stack.Screen name="display-name" />
      <Stack.Screen name="callback" />
    </Stack>
  );
}
