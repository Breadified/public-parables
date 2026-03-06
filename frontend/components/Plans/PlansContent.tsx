/**
 * PlansContent - Main container for Plans tab
 * Displays My Plans (combined personal + shared) and Discover sections
 */

import React, { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import { observer, useSelector } from "@legendapp/state/react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/contexts/ThemeContext";
import { useUnifiedAuth } from "@/hooks/useUnifiedAuth";
import { planStore$, authStore$ } from "@/state";
import type { PlansSegment } from "@/state";
import PlansSegmentedControl from "./PlansSegmentedControl";
import UnifiedPlansList from "./UnifiedPlansList";
import PlanDiscoveryList from "./PlanDiscoveryList";

const PlansContent = observer(function PlansContent() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, isAuthenticated } = useUnifiedAuth();
  const shouldSync = useSelector(authStore$.shouldSync);

  const activeSegment = useSelector(planStore$.activeSegment);

  // Load plans from SQLite on mount
  useEffect(() => {
    planStore$.loadPlansFromSQLite();
  }, []);

  // Sync sessions from server when online
  useEffect(() => {
    if (isAuthenticated && user?.id && shouldSync) {
      planStore$.syncSessionsFromServer(user.id);
    }
  }, [isAuthenticated, user?.id, shouldSync]);

  // Tab bar height
  const tabBarHeight = insets.bottom + 58;

  const handleSegmentSelect = (segment: PlansSegment) => {
    planStore$.setActiveSegment(segment);
  };

  // Segment options with icons (no counts - redundant)
  const segments = [
    { key: 'my-plans' as PlansSegment, label: 'My Plans', icon: 'list-outline' as const },
    { key: 'discover' as PlansSegment, label: 'Discover', icon: 'compass-outline' as const },
  ];

  // Render active section
  const renderActiveSection = () => {
    switch (activeSegment) {
      case 'my-plans':
      case 'shared': // Fallback - redirect 'shared' to unified list
        return <UnifiedPlansList />;
      case 'discover':
        return <PlanDiscoveryList />;
      default:
        return <UnifiedPlansList />;
    }
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.background.primary,
          paddingBottom: tabBarHeight,
        },
      ]}
    >
      {/* Segmented Control */}
      <PlansSegmentedControl
        segments={segments}
        activeKey={activeSegment === 'shared' ? 'my-plans' : activeSegment}
        onSelect={handleSegmentSelect}
      />

      {/* Content Area */}
      <View style={styles.contentArea}>
        {renderActiveSection()}
      </View>
    </View>
  );
});

export default PlansContent;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentArea: {
    flex: 1,
  },
});
