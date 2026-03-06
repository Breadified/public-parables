/**
 * PaneSearch - Wrapper for search within a pane
 * Renders SearchInterface with appropriate styling and overlay
 */

import React, { useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Dimensions,
} from "react-native";
import { observer } from "@legendapp/state/react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/contexts/ThemeContext";
import { getTheme } from "@/config/theme";
import { SearchInterface, SearchInterfaceProps } from "./SearchInterface";

interface PaneSearchProps
  extends Omit<SearchInterfaceProps, "paddingBottom" | "autoFocus"> {
  /** Position of the pane ('left' or 'right') */
  position: "left" | "right";
  /** Title to display in header */
  title?: string;
  /** Whether to show dim overlay on opposite side */
  showOverlay?: boolean;
}

export const PaneSearch = observer(
  ({
    position,
    title = "Search Bible",
    showOverlay = true,
    onClose,
    ...searchProps
  }: PaneSearchProps) => {
    const { theme } = useTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);
    const insets = useSafeAreaInsets();

    // Calculate pane width (50% of screen) for proper button sizing
    const paneWidth = useMemo(() => Dimensions.get("window").width * 0.5, []);

    return (
      <View style={styles.container}>
        {/* Dim overlay covering the entire screen */}
        {showOverlay && <Pressable style={styles.overlay} onPress={onClose} />}

        {/* Search pane - positioned based on position prop */}
        <View
          style={[
            styles.pane,
            position === "left" ? styles.paneLeft : styles.paneRight,
          ]}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.keyboardView}
          >
            <View style={styles.content}>
              {/* Header */}
              <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
                <Text style={styles.title}>{title}</Text>
                <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                  <Text style={styles.closeButtonText}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Search Interface */}
              <SearchInterface
                {...searchProps}
                onClose={onClose}
                autoFocus={true}
                paddingBottom={Math.max(20, insets.bottom + 20)}
                containerWidth={paneWidth}
                scaleFactor={0.7}
              />
            </View>
          </KeyboardAvoidingView>
        </View>
      </View>
    );
  }
);

const createStyles = (theme: ReturnType<typeof getTheme>) =>
  StyleSheet.create({
    container: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 10000,
    },
    overlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      zIndex: 1,
    },
    pane: {
      position: "absolute",
      top: 0,
      bottom: 0,
      width: "50%",
      zIndex: 2,
      backgroundColor: theme.colors.background.primary,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 8,
      elevation: 5,
    },
    paneLeft: {
      left: 0,
    },
    paneRight: {
      right: 0,
    },
    keyboardView: {
      flex: 1,
    },
    content: {
      flex: 1,
      backgroundColor: theme.colors.background.primary,
    },
    header: {
      flexDirection: "row" as const,
      justifyContent: "space-between" as const,
      alignItems: "center" as const,
      paddingHorizontal: 16,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      backgroundColor: theme.colors.background.secondary,
    },
    title: {
      fontSize: theme.typography.fontSize.lg,
      fontWeight: theme.typography.fontWeight.semibold as any,
      color: theme.colors.text.primary,
      fontFamily: theme.typography.fontFamily.sansSerif,
    },
    closeButton: {
      width: 32,
      height: 32,
      justifyContent: "center",
      alignItems: "center",
    },
    closeButtonText: {
      fontSize: theme.typography.fontSize.xl,
      color: theme.colors.text.secondary,
      fontWeight: theme.typography.fontWeight.bold as any,
      fontFamily: theme.typography.fontFamily.sansSerif,
    },
  });
