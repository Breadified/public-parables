/**
 * Account Page - User profile and app settings
 *
 * Displays:
 * - User profile header with avatar, level badge, and XP progress
 * - Account management (sign in/out)
 * - App settings and preferences
 * - App status and version info
 */

import { observer, useSelector } from "@legendapp/state/react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Switch,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useState, useEffect, useCallback } from "react";

import { useUnifiedAuth } from "@/hooks/useUnifiedAuth";
import { tutorialStore$ } from "@/state/tutorialStore";
import { devotionStore$ } from "@/state/devotionStore";
import { planReminderPreferences$ } from "@/state/planStore";
import {
  enablePlanReminder,
  disablePlanReminder,
  updatePlanReminderTime,
} from "@/services/planReminderService";
import { TimePickerModal } from "@/components/Plans";
import { DATABASE_VERSION } from "@/config/databaseVersion";
import { bibleStore$, authStore$ } from "@/state/bibleStore";
import { appStateStore$ } from "@/state/appStateStore";
import {
  initializeGamificationStore,
  performBatchSync,
  totalXP$,
  currentLevel$,
  testResetAllActivities,
  testSetActivities,
} from "@/state";
import { useTheme } from "@/contexts/ThemeContext";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { UserProfileHeader } from "@/components/Profile";
import {
  ActivityTracker,
} from "@/components/Gamification";
import {
  triggerTestNotification,
  toggleNotifications,
  checkNotificationPermissions,
} from "@/services/notificationService";
// fetchUserGlobalStats deprecated - using local-first XP from gamificationStore
import { type UserGlobalStats } from "@/types/database";

// Collapsible section component
interface CollapsibleSectionProps {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  children: React.ReactNode;
  defaultExpanded?: boolean;
}

const CollapsibleSection = observer(function CollapsibleSection({
  title,
  icon,
  children,
  defaultExpanded = false,
}: CollapsibleSectionProps) {
  const { theme } = useTheme();
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <View
      style={[
        styles.sectionContainer,
        { backgroundColor: theme.colors.background.secondary },
      ]}
    >
      <Pressable
        style={styles.sectionHeader}
        onPress={() => setIsExpanded(!isExpanded)}
      >
        <View style={styles.sectionHeaderLeft}>
          <Ionicons
            name={icon}
            size={20}
            color={theme.colors.text.primary}
            style={styles.sectionIcon}
          />
          <Text
            style={[styles.sectionTitle, { color: theme.colors.text.primary }]}
          >
            {title}
          </Text>
        </View>
        <Ionicons
          name={isExpanded ? "chevron-up" : "chevron-down"}
          size={20}
          color={theme.colors.text.muted}
        />
      </Pressable>
      {isExpanded && (
        <View style={styles.sectionContent}>{children}</View>
      )}
    </View>
  );
});

export default observer(function AccountScreen() {
  const router = useRouter();
  const auth = useUnifiedAuth();
  const tutorialVersion = useSelector(tutorialStore$.version);
  const { theme } = useTheme();
  const tabs = useSelector(bibleStore$.tabs);
  const biblePeekSettings = useSelector(appStateStore$.biblePeekSettings);
  const notificationPrefs = useSelector(devotionStore$.preferences);

  const [userProfile, setUserProfile] = useState<any>(null);
  const [globalStats, setGlobalStats] = useState<UserGlobalStats | null>(null);

  // Bible Peek settings local state
  const [visibleLines, setVisibleLines] = useState(
    biblePeekSettings.visibleLines.toString()
  );
  const [contextChapters, setContextChapters] = useState(
    biblePeekSettings.contextChapters.toString()
  );

  // Notification settings state
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    notificationPrefs.notificationEnabled
  );
  const [hasNotificationPermission, setHasNotificationPermission] =
    useState(false);
  const [isSendingTestNotification, setIsSendingTestNotification] =
    useState(false);

  // Plan reminder settings state
  const planReminderPrefs = useSelector(planReminderPreferences$);
  const [planReminderEnabled, setPlanReminderEnabled] = useState(
    planReminderPrefs.reminderEnabled
  );
  const [showPlanTimePicker, setShowPlanTimePicker] = useState(false);

  // Sync local plan reminder state with store
  useEffect(() => {
    setPlanReminderEnabled(planReminderPrefs.reminderEnabled);
  }, [planReminderPrefs.reminderEnabled]);

  // Modal states
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [showClearTabsConfirm, setShowClearTabsConfirm] = useState(false);
  const [showResetTutorialConfirm, setShowResetTutorialConfirm] =
    useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [infoModalConfig, setInfoModalConfig] = useState<{
    title: string;
    message: string;
    semanticType?: "success" | "error";
  }>({ title: "", message: "" });

  // Track online/offline state for sync
  const shouldSync = useSelector(authStore$.shouldSync);

  // Get local-first XP and level (computed from local rewards)
  const localTotalXP = useSelector(totalXP$);
  const localLevel = useSelector(currentLevel$);

  // Initialize gamification store on mount
  useEffect(() => {
    if (auth.isAuthenticated && auth.user?.id) {
      initializeGamificationStore(auth.user.id);
    }
  }, [auth.isAuthenticated, auth.user?.id]);

  // Load user profile if authenticated
  // XP/level are now computed locally from localRewards - no server fetch needed
  useEffect(() => {
    if (auth.isAuthenticated && auth.user?.id) {
      auth.getUserProfile().then(setUserProfile).catch(console.error);

      // If online, perform batch sync for any pending activities
      if (shouldSync) {
        performBatchSync().catch(console.error);
      }

      // Use local-first XP/level for globalStats (for compatibility with existing UI)
      setGlobalStats({
        id: "",
        user_id: auth.user.id,
        total_xp: localTotalXP,
        level: localLevel,
        total_days_completed: 0,
        total_comments: 0,
        plans_completed: 0,
        longest_streak: 0,
        created_at: "",
        updated_at: new Date().toISOString(),
      });
    } else {
      setUserProfile(null);
      setGlobalStats(null);
    }
  }, [auth.isAuthenticated, auth.user?.id, shouldSync, localTotalXP, localLevel]);

  // Check notification permission on mount
  useEffect(() => {
    checkNotificationPermissions().then(setHasNotificationPermission);
  }, []);

  // Sync notification toggle with store
  useEffect(() => {
    setNotificationsEnabled(notificationPrefs.notificationEnabled);
  }, [notificationPrefs.notificationEnabled]);

  const handleNotificationToggle = async (value: boolean) => {
    setNotificationsEnabled(value);
    const success = await toggleNotifications(value);
    if (success) {
      const hasPermission = await checkNotificationPermissions();
      setHasNotificationPermission(hasPermission);
    } else if (value) {
      setNotificationsEnabled(false);
      setInfoModalConfig({
        title: "Permission Required",
        message:
          "Please enable notifications in your device settings to receive daily reminders.",
        semanticType: "error",
      });
      setShowInfoModal(true);
    }
  };

  const handleTestNotification = async (delaySeconds: number = 0) => {
    setIsSendingTestNotification(true);
    const success = await triggerTestNotification(delaySeconds);
    setIsSendingTestNotification(false);

    if (success) {
      const message =
        delaySeconds === 0
          ? "Check your notification center! Tap the notification to navigate to Devotion."
          : `Notification scheduled for ${delaySeconds} seconds from now. Close the app to test!`;
      setInfoModalConfig({
        title: delaySeconds === 0 ? "Test Sent" : "Scheduled",
        message,
        semanticType: "success",
      });
    } else {
      setInfoModalConfig({
        title: "Failed",
        message:
          "Could not send test notification. Please check notification permissions.",
        semanticType: "error",
      });
    }
    setShowInfoModal(true);
  };

  // Plan reminder handlers
  const handlePlanReminderToggle = async (value: boolean) => {
    setPlanReminderEnabled(value);
    if (value) {
      const success = await enablePlanReminder(
        planReminderPrefs.reminderHour,
        planReminderPrefs.reminderMinute
      );
      if (!success) {
        setPlanReminderEnabled(false);
        setInfoModalConfig({
          title: "Permission Required",
          message:
            "Please enable notifications in your device settings to receive plan reminders.",
          semanticType: "error",
        });
        setShowInfoModal(true);
      }
    } else {
      await disablePlanReminder();
    }
  };

  const handlePlanReminderTimeConfirm = async (hour: number, minute: number) => {
    setShowPlanTimePicker(false);
    await updatePlanReminderTime(hour, minute);
  };

  const handleLogin = useCallback(() => {
    router.push("/auth/login" as any);
  }, [router]);

  const handleSignup = useCallback(() => {
    router.push("/auth/signup" as any);
  }, [router]);

  const handleLogout = () => {
    setShowSignOutConfirm(true);
  };

  const handleConfirmedSignOut = async () => {
    setShowSignOutConfirm(false);
    try {
      await auth.signOut();
      setInfoModalConfig({
        title: "Signed Out",
        message: "You've been signed out successfully",
        semanticType: "success",
      });
      setShowInfoModal(true);
    } catch (error: any) {
      setInfoModalConfig({
        title: "Error",
        message: error.message || "Failed to sign out",
        semanticType: "error",
      });
      setShowInfoModal(true);
    }
  };

  const handleClearAllTabs = () => {
    setShowClearTabsConfirm(true);
  };

  const handleConfirmedClearTabs = () => {
    bibleStore$.clearAllTabs();
    setShowClearTabsConfirm(false);
  };

  const handleResetTutorial = () => {
    setShowResetTutorialConfirm(true);
  };

  const handleConfirmedResetTutorial = async () => {
    setShowResetTutorialConfirm(false);
    await tutorialStore$.resetAll();
    setInfoModalConfig({
      title: "Tutorial Reset",
      message:
        "All tutorials have been reset. You'll now see first-time experiences again.",
      semanticType: "success",
    });
    setShowInfoModal(true);
  };

  const handleVisibleLinesChange = (text: string) => {
    setVisibleLines(text);
    const num = parseInt(text, 10);
    if (!isNaN(num) && num > 0 && num <= 50) {
      appStateStore$.updateBiblePeekSettings({ visibleLines: num });
    }
  };

  const handleContextChaptersChange = (text: string) => {
    setContextChapters(text);
    const num = parseInt(text, 10);
    if (!isNaN(num) && num >= 0 && num <= 5) {
      appStateStore$.updateBiblePeekSettings({ contextChapters: num });
    }
  };

  // Get total XP from server-driven global stats
  const totalXP = globalStats?.total_xp ?? 0;

  return (
    <SafeAreaView
      style={[
        styles.container,
        { backgroundColor: theme.colors.background.primary },
      ]}
      edges={["top", "left", "right"]}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
      >
        <Text style={[styles.title, { color: theme.colors.text.primary }]}>
          Account
        </Text>

        {/* User Profile Header */}
        <UserProfileHeader
          userId={auth.user?.id ?? "anonymous"}
          email={auth.user?.email ?? ""}
          displayName={
            userProfile?.user_display_names?.display_name ?? "Anonymous"
          }
          discriminator={userProfile?.user_display_names?.discriminator}
          totalXP={totalXP}
          serverLevel={globalStats?.level}
          isAuthenticated={auth.isAuthenticated}
          onSignIn={handleLogin}
        />

        {/* Activity Tracker - Daily and Long-term Activities */}
        <ActivityTracker
          userId={auth.user?.id ?? ""}
          isAuthenticated={auth.isAuthenticated}
        />

        {/* Sign Out Button (if authenticated) */}
        {auth.isAuthenticated && (
          <TouchableOpacity
            style={[
              styles.signOutButton,
              {
                backgroundColor: theme.colors.background.secondary,
                borderColor: theme.colors.border,
              },
            ]}
            onPress={handleLogout}
          >
            <Ionicons
              name="log-out-outline"
              size={18}
              color={theme.colors.icons.error}
            />
            <Text
              style={[
                styles.signOutText,
                { color: theme.colors.icons.error },
              ]}
            >
              Sign Out
            </Text>
          </TouchableOpacity>
        )}

        {/* Create Account (if not authenticated) */}
        {!auth.isAuthenticated && (
          <TouchableOpacity
            style={[
              styles.createAccountButton,
              { borderColor: theme.colors.border },
            ]}
            onPress={handleSignup}
          >
            <Text
              style={[
                styles.createAccountText,
                { color: theme.colors.text.primary },
              ]}
            >
              Create Account
            </Text>
          </TouchableOpacity>
        )}

        {/* Notifications Section */}
        <CollapsibleSection
          title="Daily Reminders"
          icon="notifications-outline"
          defaultExpanded={false}
        >
          <Text
            style={[
              styles.settingDescription,
              { color: theme.colors.text.secondary },
            ]}
          >
            Get reminded about the daily apologetics question
          </Text>

          <View style={styles.settingRow}>
            <View style={styles.settingLabelContainer}>
              <Text
                style={[
                  styles.settingLabel,
                  { color: theme.colors.text.primary },
                ]}
              >
                Daily Notification
              </Text>
              <Text
                style={[
                  styles.settingSubtext,
                  { color: theme.colors.text.muted },
                ]}
              >
                {notificationsEnabled
                  ? `Scheduled for ${notificationPrefs.notificationHour}:${String(notificationPrefs.notificationMinute).padStart(2, "0")} AM`
                  : "Disabled"}
              </Text>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={handleNotificationToggle}
              trackColor={{
                false: theme.colors.border,
                true: theme.colors.accent,
              }}
              thumbColor="#FFFFFF"
            />
          </View>

          {!hasNotificationPermission && notificationsEnabled && (
            <Text style={[styles.warningText, { color: "#F59E0B" }]}>
              Notification permission not granted. Please enable in device
              settings.
            </Text>
          )}

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[
                styles.testButton,
                {
                  backgroundColor: theme.colors.interactive.button.background,
                  borderColor: theme.colors.border,
                  opacity: isSendingTestNotification ? 0.6 : 1,
                },
              ]}
              onPress={() => handleTestNotification(0)}
              disabled={isSendingTestNotification}
            >
              {isSendingTestNotification ? (
                <ActivityIndicator
                  size="small"
                  color={theme.colors.text.primary}
                />
              ) : (
                <Text
                  style={[
                    styles.testButtonText,
                    { color: theme.colors.interactive.button.icon },
                  ]}
                >
                  Test Now
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.testButton,
                {
                  backgroundColor: theme.colors.interactive.button.background,
                  borderColor: theme.colors.border,
                  opacity: isSendingTestNotification ? 0.6 : 1,
                },
              ]}
              onPress={() => handleTestNotification(60)}
              disabled={isSendingTestNotification}
            >
              <Text
                style={[
                  styles.testButtonText,
                  { color: theme.colors.interactive.button.icon },
                ]}
              >
                Test in 1 min
              </Text>
            </TouchableOpacity>

          </View>

          {/* Progress Bar Test Button (DEV only) */}
          {__DEV__ && (
            <>
              <Text
                style={[
                  styles.settingDescription,
                  { color: theme.colors.text.secondary, marginTop: 16 },
                ]}
              >
                Test daily progress bar (cycles 0→1→2→3→4→0)
              </Text>
              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[
                    styles.testButton,
                    {
                      backgroundColor: theme.colors.interactive.button.background,
                      borderColor: theme.colors.border,
                    },
                  ]}
                  onPress={() => {
                    testResetAllActivities();
                  }}
                >
                  <Text
                    style={[
                      styles.testButtonText,
                      { color: theme.colors.interactive.button.icon },
                    ]}
                  >
                    Reset (0/4)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.testButton,
                    {
                      backgroundColor: theme.colors.accent + "30",
                      borderColor: theme.colors.accent,
                    },
                  ]}
                  onPress={() => {
                    testSetActivities({
                      login: true,
                      noteAdded: true,
                    });
                  }}
                >
                  <Text
                    style={[
                      styles.testButtonText,
                      { color: theme.colors.accent },
                    ]}
                  >
                    Half (2/4)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.testButton,
                    {
                      backgroundColor: theme.colors.gamification?.nodeComplete ?? theme.colors.accent,
                      borderColor: theme.colors.border,
                    },
                  ]}
                  onPress={() => {
                    testSetActivities({
                      login: true,
                      noteAdded: true,
                      planDay: true,
                      devotion: true,
                    });
                  }}
                >
                  <Text
                    style={[
                      styles.testButtonText,
                      { color: "#FFFFFF" },
                    ]}
                  >
                    Full (4/4)
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </CollapsibleSection>

        {/* Bible Plan Reminders Section */}
        <CollapsibleSection
          title="Bible Plan Reminders"
          icon="calendar-outline"
          defaultExpanded={false}
        >
          <Text
            style={[
              styles.settingDescription,
              { color: theme.colors.text.secondary },
            ]}
          >
            Get reminded about your daily Bible reading plan
          </Text>

          <View style={styles.settingRow}>
            <View style={styles.settingLabelContainer}>
              <Text
                style={[
                  styles.settingLabel,
                  { color: theme.colors.text.primary },
                ]}
              >
                Daily Reminder
              </Text>
              <Text
                style={[
                  styles.settingSubtext,
                  { color: theme.colors.text.muted },
                ]}
              >
                {planReminderEnabled
                  ? `Scheduled for ${planReminderPrefs.reminderHour % 12 || 12}:${String(planReminderPrefs.reminderMinute).padStart(2, "0")} ${planReminderPrefs.reminderHour >= 12 ? "PM" : "AM"}`
                  : "Disabled"}
              </Text>
            </View>
            <Switch
              value={planReminderEnabled}
              onValueChange={handlePlanReminderToggle}
              trackColor={{
                false: theme.colors.border,
                true: theme.colors.accent,
              }}
              thumbColor="#FFFFFF"
            />
          </View>

          {planReminderEnabled && (
            <TouchableOpacity
              style={[
                styles.settingRow,
                { paddingVertical: 12 },
              ]}
              onPress={() => setShowPlanTimePicker(true)}
            >
              <View style={styles.settingLabelContainer}>
                <Text
                  style={[
                    styles.settingLabel,
                    { color: theme.colors.text.primary },
                  ]}
                >
                  Reminder Time
                </Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text
                  style={[
                    styles.settingSubtext,
                    { color: theme.colors.text.secondary, marginRight: 8 },
                  ]}
                >
                  {planReminderPrefs.reminderHour % 12 || 12}:{String(planReminderPrefs.reminderMinute).padStart(2, "0")} {planReminderPrefs.reminderHour >= 12 ? "PM" : "AM"}
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={theme.colors.text.muted}
                />
              </View>
            </TouchableOpacity>
          )}

          {!hasNotificationPermission && planReminderEnabled && (
            <Text style={[styles.warningText, { color: "#F59E0B" }]}>
              Notification permission not granted. Please enable in device
              settings.
            </Text>
          )}
        </CollapsibleSection>

        {/* Bible Peek Settings */}
        <CollapsibleSection
          title="Bible Peek Settings"
          icon="book-outline"
          defaultExpanded={false}
        >
          <Text
            style={[
              styles.settingDescription,
              { color: theme.colors.text.secondary },
            ]}
          >
            Configure how Bible references appear in notes
          </Text>

          <View style={styles.settingRow}>
            <View style={styles.settingLabelContainer}>
              <Text
                style={[
                  styles.settingLabel,
                  { color: theme.colors.text.primary },
                ]}
              >
                Visible Lines
              </Text>
              <Text
                style={[
                  styles.settingSubtext,
                  { color: theme.colors.text.muted },
                ]}
              >
                Lines shown in peek (1-50)
              </Text>
            </View>
            <TextInput
              style={[
                styles.settingInput,
                {
                  color: theme.colors.text.primary,
                  borderColor: theme.colors.border,
                  backgroundColor: theme.colors.background.primary,
                },
              ]}
              value={visibleLines}
              onChangeText={handleVisibleLinesChange}
              keyboardType="number-pad"
              maxLength={2}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingLabelContainer}>
              <Text
                style={[
                  styles.settingLabel,
                  { color: theme.colors.text.primary },
                ]}
              >
                Context Chapters
              </Text>
              <Text
                style={[
                  styles.settingSubtext,
                  { color: theme.colors.text.muted },
                ]}
              >
                Chapters before/after (0-5)
              </Text>
            </View>
            <TextInput
              style={[
                styles.settingInput,
                {
                  color: theme.colors.text.primary,
                  borderColor: theme.colors.border,
                  backgroundColor: theme.colors.background.primary,
                },
              ]}
              value={contextChapters}
              onChangeText={handleContextChaptersChange}
              keyboardType="number-pad"
              maxLength={1}
            />
          </View>
        </CollapsibleSection>

        {/* Bible Tabs */}
        <CollapsibleSection
          title="Bible Tabs"
          icon="layers-outline"
          defaultExpanded={false}
        >
          <Text
            style={[
              styles.settingDescription,
              { color: theme.colors.text.secondary },
            ]}
          >
            Active tabs: {tabs.length}
          </Text>
          <TouchableOpacity
            style={[
              styles.actionButton,
              {
                backgroundColor: theme.colors.interactive.button.background,
                borderColor: theme.colors.border,
              },
            ]}
            onPress={handleClearAllTabs}
          >
            <Text
              style={[
                styles.actionButtonText,
                { color: theme.colors.interactive.button.icon },
              ]}
            >
              Clear All Bible Tabs
            </Text>
          </TouchableOpacity>
        </CollapsibleSection>

        {/* Tutorial Reset */}
        <CollapsibleSection
          title="Tutorial & Onboarding"
          icon="school-outline"
          defaultExpanded={false}
        >
          <Text
            style={[
              styles.settingDescription,
              { color: theme.colors.text.secondary },
            ]}
          >
            Reset to see onboarding and tutorials again
          </Text>
          <TouchableOpacity
            style={[
              styles.actionButton,
              {
                backgroundColor: theme.colors.interactive.button.background,
                borderColor: theme.colors.border,
              },
            ]}
            onPress={handleResetTutorial}
          >
            <Text
              style={[
                styles.actionButtonText,
                { color: theme.colors.interactive.button.icon },
              ]}
            >
              Reset Tutorial Progress
            </Text>
          </TouchableOpacity>
        </CollapsibleSection>

        {/* App Status & Versions */}
        <CollapsibleSection
          title="App Information"
          icon="information-circle-outline"
          defaultExpanded={false}
        >
          <View style={styles.infoRow}>
            <Text
              style={[styles.infoLabel, { color: theme.colors.text.secondary }]}
            >
              Network
            </Text>
            <Text
              style={[styles.infoValue, { color: theme.colors.text.primary }]}
            >
              {auth.network}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text
              style={[styles.infoLabel, { color: theme.colors.text.secondary }]}
            >
              Auth
            </Text>
            <Text
              style={[styles.infoValue, { color: theme.colors.text.primary }]}
            >
              {auth.auth}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text
              style={[styles.infoLabel, { color: theme.colors.text.secondary }]}
            >
              Experience
            </Text>
            <Text
              style={[styles.infoValue, { color: theme.colors.text.primary }]}
            >
              {auth.experience}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text
              style={[styles.infoLabel, { color: theme.colors.text.secondary }]}
            >
              Database Version
            </Text>
            <Text
              style={[styles.infoValue, { color: theme.colors.text.primary }]}
            >
              v{DATABASE_VERSION.current}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text
              style={[styles.infoLabel, { color: theme.colors.text.secondary }]}
            >
              Tutorial Version
            </Text>
            <Text
              style={[styles.infoValue, { color: theme.colors.text.primary }]}
            >
              v{tutorialVersion}
            </Text>
          </View>
        </CollapsibleSection>
      </ScrollView>

      {/* Sign Out Confirmation */}
      <ConfirmationModal
        visible={showSignOutConfirm}
        variant="destructive"
        title="Sign out?"
        message="Notes and bookmarks remain on this device."
        confirmLabel="Sign Out"
        onConfirm={handleConfirmedSignOut}
        onCancel={() => setShowSignOutConfirm(false)}
      />

      {/* Clear Tabs Confirmation */}
      <ConfirmationModal
        visible={showClearTabsConfirm}
        variant="destructive"
        title="Remove all tabs?"
        message={`Resets to Genesis 1. You have ${tabs.length} tab${tabs.length > 1 ? "s" : ""}.`}
        confirmLabel="Remove All"
        onConfirm={handleConfirmedClearTabs}
        onCancel={() => setShowClearTabsConfirm(false)}
      />

      {/* Reset Tutorial Confirmation */}
      <ConfirmationModal
        visible={showResetTutorialConfirm}
        variant="confirm"
        title="Reset tutorial?"
        message="See first-time experiences again. Tabs not affected."
        confirmLabel="Reset"
        onConfirm={handleConfirmedResetTutorial}
        onCancel={() => setShowResetTutorialConfirm(false)}
      />

      {/* Info/Success/Error Modal */}
      <ConfirmationModal
        visible={showInfoModal}
        variant="info"
        title={infoModalConfig.title}
        message={infoModalConfig.message}
        semanticType={infoModalConfig.semanticType}
        onConfirm={() => setShowInfoModal(false)}
      />

      {/* Plan Reminder Time Picker */}
      <TimePickerModal
        visible={showPlanTimePicker}
        hour={planReminderPrefs.reminderHour}
        minute={planReminderPrefs.reminderMinute}
        onConfirm={handlePlanReminderTimeConfirm}
        onCancel={() => setShowPlanTimePicker(false)}
      />
    </SafeAreaView>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 20,
  },
  // Sign out button
  signOutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 24,
  },
  signOutText: {
    fontSize: 14,
    fontWeight: "600",
  },
  // Create account button
  createAccountButton: {
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 24,
  },
  createAccountText: {
    fontSize: 14,
    fontWeight: "600",
  },
  // Collapsible section styles
  sectionContainer: {
    borderRadius: 12,
    marginBottom: 12,
    overflow: "hidden",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  sectionHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  sectionIcon: {
    marginRight: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  sectionContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  // Setting styles
  settingDescription: {
    fontSize: 13,
    marginBottom: 12,
  },
  settingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
  },
  settingLabelContainer: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 2,
  },
  settingSubtext: {
    fontSize: 12,
  },
  settingInput: {
    width: 56,
    height: 38,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 15,
    textAlign: "center",
    fontWeight: "600",
  },
  // Button styles
  buttonRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
  },
  testButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
  },
  testButtonText: {
    fontSize: 13,
    fontWeight: "600",
  },
  actionButton: {
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    marginTop: 8,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: "600",
  },
  // Warning text
  warningText: {
    fontSize: 12,
    marginTop: 8,
    fontStyle: "italic",
  },
  // Info row for app status
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  infoLabel: {
    fontSize: 13,
  },
  infoValue: {
    fontSize: 13,
    fontFamily: "monospace",
  },
});
