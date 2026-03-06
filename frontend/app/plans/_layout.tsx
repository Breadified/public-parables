/**
 * Plans Stack Layout
 * Handles navigation within the Plans feature
 */

import { Stack } from "expo-router";
import { useTheme } from "@/contexts/ThemeContext";

export default function PlansLayout() {
  const { theme } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background.primary },
        animation: "slide_from_right",
      }}
    >
      <Stack.Screen name="[planId]" />
      <Stack.Screen
        name="session/[sessionId]"
        options={{
          presentation: "card",
        }}
      />
      <Stack.Screen
        name="invite"
        options={{
          presentation: "modal",
          animation: "slide_from_bottom",
        }}
      />
    </Stack>
  );
}
