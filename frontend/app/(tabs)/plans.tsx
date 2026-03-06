/**
 * Plans Tab Screen - Bible Reading Plans Hub
 * Discover plans, manage sessions, and share with friends
 */

import { observer } from "@legendapp/state/react";
import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet } from "react-native";

import { useTheme } from "@/contexts/ThemeContext";
import { PlansContent } from "@/components/Plans";

export default observer(function PlansScreen() {
  const { theme } = useTheme();

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background.primary }]}
      edges={["top", "left", "right"]}
    >
      <PlansContent />
    </SafeAreaView>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
