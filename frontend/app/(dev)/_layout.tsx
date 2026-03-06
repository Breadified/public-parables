/**
 * Developer Routes Layout - DEV MODE ONLY
 * These routes are only accessible in development mode via deep links
 */

import { Stack } from 'expo-router';

export default function DevLayout() {
  // Only render in DEV mode
  if (!__DEV__) {
    return null;
  }

  return (
    <Stack>
      <Stack.Screen
        name="test"
        options={{
          title: 'Developer Testing',
          headerShown: true,
        }}
      />
    </Stack>
  );
}