/**
 * Library Tab Screen - My Content Hub
 * Displays user's notes, comments, and liked comments
 */

import { observer } from "@legendapp/state/react";
import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet } from "react-native";

import { useTheme } from "@/contexts/ThemeContext";
import { LibraryContent } from "@/components/Library";

export default observer(function LibraryScreen() {
  const { theme } = useTheme();

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background.primary }]}
      edges={["top", "left", "right"]}
    >
      <LibraryContent />
    </SafeAreaView>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
