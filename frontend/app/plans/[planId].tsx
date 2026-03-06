/**
 * Plan Detail Screen
 * View plan information and select which day to start from
 *
 * UX: Tap any day in the reading schedule to select it as your start day.
 * The selected day becomes "today" when you start the plan.
 */

import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { observer } from "@legendapp/state/react";
import { FlashList } from "@shopify/flash-list";

import { useTheme } from "@/contexts/ThemeContext";
import { planStore$ } from "@/state";
import { createPlanSession } from "@/services/planService";
import { useUnifiedAuth } from "@/hooks/useUnifiedAuth";
import { useFlashListConfig } from "@/hooks/useFlashListConfig";
import { AuthModal } from "@/components/Auth/AuthModal";
import type { BiblePlanWithDays, BiblePlanDayData } from "@/types/database";

export default observer(function PlanDetailScreen() {
  const { planId } = useLocalSearchParams<{ planId: string }>();
  const router = useRouter();
  const { theme } = useTheme();
  const { user, isAuthenticated, hasSignedInOnDevice } = useUnifiedAuth();
  const flashListRef = useRef<any>(null);

  const flashListConfig = useFlashListConfig({
    estimatedItemSize: 80,
  });

  const [plan, setPlan] = useState<BiblePlanWithDays | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [startDay, setStartDay] = useState(1);
  const [showAuthModal, setShowAuthModal] = useState(false);

  useEffect(() => {
    if (planId) {
      loadPlanDetails();
    }
  }, [planId]);

  const loadPlanDetails = async () => {
    setLoading(true);
    try {
      const planData = await planStore$.loadPlanDetails(planId!);
      setPlan(planData);
    } catch (error) {
      console.error("Failed to load plan:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartPlan = async () => {
    if (!plan) return;

    // Show auth modal if not authenticated
    if (!isAuthenticated || !user?.id) {
      setShowAuthModal(true);
      return;
    }

    await startPlanSession();
  };

  // Actual plan start logic - called after authentication
  const startPlanSession = async () => {
    if (!plan || !user?.id) return;

    setStarting(true);
    try {
      // Create session via service with selected start day
      const session = await createPlanSession(plan.id, user.id, { startDay });

      if (session) {
        // Add to store
        planStore$.addSession(session);

        // Navigate to session view
        router.replace({
          pathname: "/plans/session/[sessionId]",
          params: { sessionId: session.id },
        });
      }
    } catch (error) {
      console.error("Failed to start plan:", error);
    } finally {
      setStarting(false);
    }
  };

  // Handle successful auth - start the plan
  const handleAuthSuccess = () => {
    setShowAuthModal(false);
    // Slight delay to ensure auth state is updated
    setTimeout(() => {
      startPlanSession();
    }, 100);
  };

  const handleSelectDay = useCallback((dayNumber: number) => {
    setStartDay(dayNumber);
  }, []);

  const handleBack = () => {
    router.back();
  };

  // Render day item - tappable to select as start day
  const renderDayItem = useCallback(
    ({ item }: { item: BiblePlanDayData }) => {
      const isSelected = item.day_number === startDay;

      return (
        <Pressable
          onPress={() => handleSelectDay(item.day_number)}
          style={({ pressed }) => [
            styles.dayItem,
            {
              backgroundColor: isSelected
                ? theme.colors.interactive.button.background
                : theme.colors.background.secondary,
              borderColor: isSelected
                ? theme.colors.interactive.button.background
                : 'transparent',
              transform: [{ scale: pressed ? 0.98 : 1 }],
            },
          ]}
        >
          {/* Day Number with Selection Indicator */}
          <View style={styles.dayLeft}>
            <View style={[
              styles.dayNumberBadge,
              {
                backgroundColor: isSelected
                  ? 'rgba(255,255,255,0.2)'
                  : theme.colors.background.elevated,
              }
            ]}>
              <Text style={[
                styles.dayNumberText,
                {
                  color: isSelected
                    ? theme.colors.text.primary
                    : theme.colors.text.secondary
                }
              ]}>
                {item.day_number}
              </Text>
            </View>

            {/* Selection indicator */}
            {isSelected && (
              <View style={styles.startIndicator}>
                <Ionicons
                  name="flag"
                  size={14}
                  color={theme.colors.text.primary}
                />
                <Text style={[styles.startIndicatorText, { color: theme.colors.text.primary }]}>
                  Start here
                </Text>
              </View>
            )}
          </View>

          {/* Readings */}
          <View style={styles.dayRight}>
            <Text
              style={[
                styles.dayReadings,
                {
                  color: isSelected
                    ? theme.colors.text.primary
                    : theme.colors.text.muted
                }
              ]}
              numberOfLines={2}
            >
              {item.readings?.map((r) => r.reference).join(", ") || "No readings"}
            </Text>
          </View>

          {/* Tap hint for non-selected items */}
          {!isSelected && (
            <View style={styles.tapHint}>
              <Ionicons
                name="chevron-forward"
                size={16}
                color={theme.colors.text.muted}
              />
            </View>
          )}
        </Pressable>
      );
    },
    [theme, startDay, handleSelectDay]
  );

  // List header with plan info and instructions
  const ListHeader = useCallback(
    () => (
      <View style={styles.listHeader}>
        {/* Plan Info */}
        <View style={styles.planInfo}>
          <Text style={[styles.planName, { color: theme.colors.text.primary }]}>
            {plan?.name}
          </Text>
          {plan?.description && (
            <Text style={[styles.planDescription, { color: theme.colors.text.muted }]}>
              {plan.description}
            </Text>
          )}
          <View style={styles.metaRow}>
            <View
              style={[styles.metaBadge, { backgroundColor: theme.colors.background.secondary }]}
            >
              <Ionicons name="calendar-outline" size={14} color={theme.colors.text.secondary} />
              <Text style={[styles.metaText, { color: theme.colors.text.secondary }]}>
                {plan?.duration_days} days
              </Text>
            </View>
          </View>
        </View>

        {/* Instructions */}
        <View style={[styles.instructionsCard, { backgroundColor: theme.colors.background.secondary }]}>
          <Ionicons name="hand-left-outline" size={20} color={theme.colors.text.secondary} />
          <Text style={[styles.instructionsText, { color: theme.colors.text.secondary }]}>
            Tap any day below to choose where to start. Day {startDay} will become today.
          </Text>
        </View>

        {/* Section Title */}
        <Text style={[styles.sectionTitle, { color: theme.colors.text.primary }]}>
          Reading Schedule
        </Text>
      </View>
    ),
    [plan, theme, startDay]
  );

  if (loading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.colors.background.primary }]}
      >
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.text.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!plan) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.colors.background.primary }]}
      >
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: theme.colors.text.muted }]}>
            Plan not found
          </Text>
          <Pressable onPress={handleBack} style={styles.backButton}>
            <Text style={[styles.backButtonText, { color: theme.colors.text.primary }]}>
              Go Back
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background.primary }]}
      edges={["top"]}
    >
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={handleBack} style={styles.headerButton}>
          <Ionicons name="chevron-back" size={24} color={theme.colors.text.primary} />
        </Pressable>
        <Text
          style={[styles.headerTitle, { color: theme.colors.text.primary }]}
          numberOfLines={1}
        >
          Choose Start Day
        </Text>
        <View style={styles.headerButton} />
      </View>

      {/* Reading Schedule FlashList */}
      <FlashList<BiblePlanDayData>
        ref={flashListRef}
        data={plan.days}
        renderItem={renderDayItem}
        keyExtractor={(item) => item.day_number.toString()}
        ListHeaderComponent={ListHeader}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={true}
        extraData={startDay}
        {...flashListConfig.props}
      />

      {/* Footer with Confirmation */}
      <View
        style={[
          styles.footer,
          {
            backgroundColor: theme.colors.background.primary,
            borderTopColor: theme.colors.border,
          }
        ]}
      >
        {/* Selection Summary */}
        <View style={styles.selectionSummary}>
          <View style={[styles.summaryIcon, { backgroundColor: theme.colors.interactive.button.background }]}>
            <Ionicons name="flag" size={16} color={theme.colors.text.primary} />
          </View>
          <View style={styles.summaryText}>
            <Text style={[styles.summaryLabel, { color: theme.colors.text.muted }]}>
              Starting from
            </Text>
            <Text style={[styles.summaryValue, { color: theme.colors.text.primary }]}>
              Day {startDay} of {plan.duration_days}
            </Text>
          </View>
        </View>

        {/* Start Button */}
        <Pressable
          onPress={handleStartPlan}
          disabled={starting}
          style={({ pressed }) => [
            styles.startButton,
            {
              backgroundColor: theme.colors.interactive.button.background,
              opacity: pressed || starting ? 0.8 : 1,
            },
          ]}
        >
          {starting ? (
            <ActivityIndicator size="small" color={theme.colors.text.primary} />
          ) : (
            <>
              <Ionicons name="play" size={20} color={theme.colors.text.primary} />
              <Text style={[styles.startButtonText, { color: theme.colors.text.primary }]}>
                Start Plan
              </Text>
            </>
          )}
        </Pressable>
      </View>

      {/* Auth Modal - shown when user tries to start without being signed in */}
      <AuthModal
        visible={showAuthModal}
        mode={hasSignedInOnDevice ? "login" : "signup"}
        onClose={() => setShowAuthModal(false)}
        onSuccess={handleAuthSuccess}
        promptMessage="Sign in to start your Bible reading plan"
      />
    </SafeAreaView>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  errorText: {
    fontSize: 16,
  },
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  headerButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "600",
    flex: 1,
    textAlign: "center",
  },
  listContent: {
    padding: 16,
    paddingBottom: 200,
  },
  listHeader: {
    marginBottom: 16,
  },
  planInfo: {
    gap: 12,
    marginBottom: 20,
  },
  planName: {
    fontSize: 24,
    fontWeight: "700",
    lineHeight: 30,
  },
  planDescription: {
    fontSize: 15,
    lineHeight: 22,
  },
  metaRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  metaBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  metaText: {
    fontSize: 13,
    fontWeight: "500",
  },
  instructionsCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 12,
    marginBottom: 20,
  },
  instructionsText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
  },
  // Day item styles - tappable cards
  dayItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 2,
    minHeight: 72,
  },
  dayLeft: {
    marginRight: 14,
    alignItems: "center",
    minWidth: 60,
  },
  dayNumberBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  dayNumberText: {
    fontSize: 15,
    fontWeight: "700",
  },
  startIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
  },
  startIndicatorText: {
    fontSize: 11,
    fontWeight: "600",
  },
  dayRight: {
    flex: 1,
  },
  dayReadings: {
    fontSize: 14,
    lineHeight: 20,
  },
  tapHint: {
    marginLeft: 8,
  },
  // Footer styles
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: 32,
    gap: 14,
    borderTopWidth: 1,
  },
  selectionSummary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  summaryIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryText: {
    flex: 1,
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: "500",
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: "600",
  },
  startButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  startButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
});
