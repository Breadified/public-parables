/**
 * Notification Service - Local push notifications for daily apologetics questions
 *
 * Features:
 * - Request notification permissions (iOS requires explicit, Android 13+ requires explicit)
 * - Schedule notifications 60 days ahead (iOS has 64 notification limit)
 * - Handle notification taps to navigate to devotion tab
 * - Cancel/reschedule when preferences change
 *
 * Platform Notes:
 * - iOS: Shows system permission dialog on first request, max 64 scheduled notifications
 * - Android 12 and below: Auto-granted
 * - Android 13+: Requires POST_NOTIFICATIONS permission
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { router } from 'expo-router';

import { devotionStore$ } from '@/state';
import type { ApologeticsData, HolidayType, HolidayQuestion } from '@/state/devotionStore';

// Prefix for daily notification identifiers (format: daily-apologetics-YYYY-MM-DD)
const NOTIFICATION_ID_PREFIX = 'daily-apologetics-';

// Number of days to schedule ahead
// iOS has a hard limit of 64 scheduled local notifications per app
// We use 60 for both platforms for consistency (under iOS limit, ~2 months coverage)
const DAYS_TO_SCHEDULE = 60;

// Holiday display titles for notifications
const HOLIDAY_TITLES: Record<HolidayType, string> = {
  'christmas-eve': 'Christmas Eve',
  'christmas-day': 'Christmas Day',
  'good-friday': 'Good Friday',
  'easter-saturday': 'Holy Saturday',
  'easter-sunday': 'Easter Sunday',
  'easter-monday': 'Easter Monday',
};

/**
 * Get local date string in YYYY-MM-DD format (avoiding UTC conversion issues)
 * This ensures notifications show the correct question for the user's local date
 */
function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Configure how notifications appear when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Request notification permissions from the user
 * @returns true if permissions granted, false otherwise
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  try {
    // Check existing permissions first
    const { status: existingStatus } = await Notifications.getPermissionsAsync();

    if (existingStatus === 'granted') {
      console.log('[NotificationService] Permissions already granted');
      return true;
    }

    // Request permissions
    const { status } = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowSound: true,
        allowBadge: true,
      },
    });

    const granted = status === 'granted';
    console.log('[NotificationService] Permission request result:', status);

    return granted;
  } catch (error) {
    console.error('[NotificationService] Error requesting permissions:', error);
    return false;
  }
}

/**
 * Check if notification permissions are currently granted
 */
export async function checkNotificationPermissions(): Promise<boolean> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.error('[NotificationService] Error checking permissions:', error);
    return false;
  }
}

/**
 * Ensure questions data is loaded
 * Loads from bundled JSON if not already in store
 */
async function ensureQuestionsLoaded(): Promise<void> {
  if (devotionStore$.questionsData.get() === null) {
    try {
      // Dynamically import the bundled questions data
      const apologeticsData = require('@/assets/data/apologeticsQuestions.json');
      devotionStore$.initializeWithData(apologeticsData as ApologeticsData);
      console.log('[NotificationService] Loaded questions data');
    } catch (error) {
      console.error('[NotificationService] Failed to load questions:', error);
    }
  }
}

/**
 * Get the question text for a specific date
 * Used to populate notification content
 * Checks for holiday overrides first, then falls back to regular questions
 */
function getQuestionTextForDate(date: Date): string {
  // Check for holiday override first (from JSON data)
  const holidayQuestion = devotionStore$.getHolidayQuestion(date);
  if (holidayQuestion) {
    return holidayQuestion.questionText;
  }

  // Fall back to regular apologetics question
  const dateStr = getLocalDateString(date); // Use local date, not UTC
  const question = devotionStore$.getQuestionForDate(dateStr);

  if (question) {
    return question.questionText;
  }

  return "Today's apologetics question is waiting for you!";
}

/**
 * Build notification content for a specific date's question
 * @param date - The date to build content for
 */
function buildNotificationContentForDate(date: Date): Notifications.NotificationContentInput {
  const dateStr = getLocalDateString(date);
  const holidayType: HolidayType | null = devotionStore$.getHolidayType(date);
  const holidayQuestion: HolidayQuestion | null = devotionStore$.getHolidayQuestion(date);
  const questionText = holidayQuestion?.questionText ?? getQuestionTextForDate(date);

  // Use holiday title if it's a special day
  const title = holidayType ? HOLIDAY_TITLES[holidayType] : '';

  return {
    title, // Holiday name or empty for regular days
    body: questionText,
    data: {
      type: 'daily-apologetics',
      navigateTo: 'devotion',
      targetDate: dateStr,
      isHoliday: !!holidayType,
      holidayType: holidayType ?? null,
    },
    sound: true,
    ...(Platform.OS === 'android' && {
      channelId: 'daily-questions',
    }),
  };
}

/**
 * Schedule notifications for the next N days with correct questions
 * Each day gets its own notification with the correct question text
 *
 * Platform differences:
 * - iOS: Uses CALENDAR trigger (specific date/time)
 * - Android: Uses TIME_INTERVAL trigger (seconds from now) since CALENDAR isn't supported
 *
 * @param hour - Hour to send notification (0-23), defaults to preferences
 * @param minute - Minute to send notification (0-59), defaults to preferences
 */
export async function scheduleDailyApologeticsNotification(
  hour?: number,
  minute?: number
): Promise<void> {
  try {
    // Ensure questions data is loaded so we can get the question text
    await ensureQuestionsLoaded();

    // Check if notifications are enabled in preferences
    const prefs = devotionStore$.preferences.get();
    if (!prefs.notificationEnabled) {
      console.log('[NotificationService] Notifications disabled in preferences');
      await cancelAllScheduledNotifications();
      return;
    }

    // Check permissions
    const hasPermission = await checkNotificationPermissions();
    if (!hasPermission) {
      console.log('[NotificationService] No notification permission');
      return;
    }

    // Use provided time or fall back to preferences
    const notificationHour = hour ?? prefs.notificationHour;
    const notificationMinute = minute ?? prefs.notificationMinute;

    // Cancel all existing notifications first
    await cancelAllScheduledNotifications();

    // Get current time for calculating intervals
    const now = new Date();

    // Get today's date at midnight (local time)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check if today's notification time has already passed
    const todayNotificationTime = new Date(today);
    todayNotificationTime.setHours(notificationHour, notificationMinute, 0, 0);
    const startFromTomorrow = now >= todayNotificationTime;

    // Schedule notifications for the next N days
    let scheduledCount = 0;
    const startDay = startFromTomorrow ? 1 : 0; // Start from tomorrow if today's time passed

    for (let i = startDay; i < DAYS_TO_SCHEDULE; i++) {
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() + i);

      // Set the exact notification time for this day
      const notificationTime = new Date(targetDate);
      notificationTime.setHours(notificationHour, notificationMinute, 0, 0);

      const dateStr = getLocalDateString(targetDate);
      const content = buildNotificationContentForDate(targetDate);
      const identifier = `${NOTIFICATION_ID_PREFIX}${dateStr}`;

      // Calculate seconds from now until notification time
      const secondsUntil = Math.floor((notificationTime.getTime() - now.getTime()) / 1000);

      // Skip if time is in the past (shouldn't happen but safety check)
      if (secondsUntil <= 0) {
        continue;
      }

      try {
        // Use platform-appropriate trigger
        // iOS: Use DATE trigger (timestamp-based) - reliable and exact
        // Android: Use TIME_INTERVAL trigger (only option available in expo-notifications)
        //      Note: Android may delay notifications due to Doze mode and battery optimization.
        //      We reschedule on every app open to minimize drift.
        const trigger = Platform.OS === 'ios'
          ? {
              type: Notifications.SchedulableTriggerInputTypes.DATE as const,
              date: notificationTime, // Pass the Date object directly
            }
          : {
              type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL as const,
              seconds: secondsUntil,
            };

        await Notifications.scheduleNotificationAsync({
          content,
          trigger,
          identifier,
        });
        scheduledCount++;
      } catch (scheduleError) {
        console.error(`[NotificationService] Failed to schedule for ${dateStr}:`, scheduleError);
      }
    }

    console.log(
      `[NotificationService] Scheduled ${scheduledCount} notifications at ${notificationHour}:${String(notificationMinute).padStart(2, '0')}`,
      `(${startFromTomorrow ? 'starting tomorrow' : 'starting today'}, platform: ${Platform.OS})`
    );
  } catch (error) {
    console.error('[NotificationService] Error scheduling notifications:', error);
  }
}

/**
 * Cancel all scheduled notifications
 */
export async function cancelAllScheduledNotifications(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log('[NotificationService] Cancelled all scheduled notifications');
  } catch (error) {
    console.error('[NotificationService] Error cancelling notifications:', error);
  }
}

/**
 * Cancel just the daily apologetics notifications (not other app notifications)
 */
export async function cancelDailyNotifications(): Promise<void> {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const dailyNotifications = scheduled.filter(n =>
      n.identifier.startsWith(NOTIFICATION_ID_PREFIX)
    );

    await Promise.all(
      dailyNotifications.map(n =>
        Notifications.cancelScheduledNotificationAsync(n.identifier)
      )
    );

    console.log(`[NotificationService] Cancelled ${dailyNotifications.length} daily notifications`);
  } catch (error) {
    console.error('[NotificationService] Error cancelling daily notifications:', error);
  }
}

/**
 * Cancel today's devotion notification (called when devotion is completed)
 * Leaves future notifications intact
 */
export async function cancelTodayDevotionNotification(): Promise<void> {
  try {
    const todayStr = getLocalDateString();
    const identifier = `${NOTIFICATION_ID_PREFIX}${todayStr}`;

    await Notifications.cancelScheduledNotificationAsync(identifier);
    console.log(`[NotificationService] Cancelled today's devotion notification: ${identifier}`);
  } catch (error) {
    // Notification might not exist (already fired or not scheduled) - that's OK
    console.log('[NotificationService] No devotion notification to cancel for today');
  }
}

/**
 * Handle navigation when a notification is tapped
 * Extracted to be reusable for both cold start and warm start scenarios
 * Handles both devotion notifications and plan reminders
 */
function handleNotificationNavigation(response: Notifications.NotificationResponse): void {
  console.log('[NotificationService] Notification tapped:', response);

  const data = response.notification.request.content.data as {
    type?: string;
    navigateTo?: string;
    targetDate?: string;
    sessionId?: string;
    dayNumber?: number;
  } | undefined;

  // Handle plan reminder notifications
  if (data?.type === 'plan-reminder' && data.sessionId) {
    const sessionId = data.sessionId;
    const dayNumber = data.dayNumber;
    console.log('[NotificationService] Plan reminder tapped, navigating to session:', sessionId, 'day:', dayNumber);
    const { planStore$ } = require('@/state/planStore');

    // Set the active session
    planStore$.setActiveSession(sessionId);

    // Navigate to the session view with gotoDay to jump to today's plan day
    setTimeout(() => {
      router.push({
        pathname: '/plans/session/[sessionId]',
        params: { sessionId, ...(dayNumber && { gotoDay: String(dayNumber) }) },
      });
    }, 100);
    return;
  }

  // Navigate to devotion tab if this is our daily question notification
  if (data?.type === 'daily-apologetics' || data?.navigateTo === 'devotion') {
    // Use the targetDate from notification data (now accurate since each day has its own notification)
    // Fall back to today if not present
    const targetDateStr = data?.targetDate || getLocalDateString();
    console.log('[NotificationService] Navigating to devotion tab with date:', targetDateStr);

    // Use replace to ensure we land on devotion tab
    // Small delay to ensure app is fully loaded
    setTimeout(() => {
      router.replace({
        pathname: '/(tabs)/devotion',
        params: { date: targetDateStr },
      });
    }, 100);

    // Record that user opened from notification (for adaptive timing)
    devotionStore$.recordNotificationOpen();
  }
}

/**
 * Set up listener for notification taps
 * Handles both cold start (app killed) and warm start (app in background)
 *
 * @returns Cleanup function to remove the listener
 */
export function setupNotificationResponseListener(): () => void {
  // COLD START: Check for notification that launched the app
  // This catches notifications tapped when the app was killed
  // Uses synchronous getLastNotificationResponse() per Expo SDK 53+ docs
  const lastResponse = Notifications.getLastNotificationResponse();
  if (lastResponse) {
    console.log('[NotificationService] Cold start - found pending notification response');
    handleNotificationNavigation(lastResponse);
  }

  // WARM START: Listen for future notifications while app is running
  const subscription = Notifications.addNotificationResponseReceivedListener(
    handleNotificationNavigation
  );

  return () => {
    subscription.remove();
  };
}

/**
 * Set up Android notification channel
 * Required for Android 8.0+ (API level 26+)
 */
export async function setupAndroidNotificationChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;

  try {
    await Notifications.setNotificationChannelAsync('daily-questions', {
      name: 'Daily Questions',
      description: 'Daily apologetics question reminders',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
      enableLights: true,
      lightColor: '#4A90D9', // App accent color
    });

    console.log('[NotificationService] Android notification channel created');
  } catch (error) {
    console.error('[NotificationService] Error creating Android channel:', error);
  }
}

/**
 * Initialize notification service
 * Call this once on app startup
 *
 * @returns true if notifications are ready, false otherwise
 */
export async function initializeNotifications(): Promise<boolean> {
  console.log('[NotificationService] Initializing...');

  // Set up Android channel first
  await setupAndroidNotificationChannel();

  // Check/request permissions
  const hasPermission = await requestNotificationPermissions();

  if (hasPermission) {
    // Schedule notifications for the next 105 days
    await scheduleDailyApologeticsNotification();
    console.log('[NotificationService] Initialization complete');
    return true;
  }

  console.log('[NotificationService] Initialization complete (no permission)');
  return false;
}

/**
 * Toggle notifications on/off
 * Updates preferences and schedules/cancels notifications accordingly
 */
export async function toggleNotifications(enabled: boolean): Promise<boolean> {
  // Update preference
  devotionStore$.preferences.notificationEnabled.set(enabled);
  await devotionStore$.savePreferencesToStorage();

  if (enabled) {
    // Request permission and schedule
    const hasPermission = await requestNotificationPermissions();
    if (hasPermission) {
      await scheduleDailyApologeticsNotification();
      return true;
    }
    return false;
  } else {
    // Cancel scheduled notifications
    await cancelAllScheduledNotifications();
    return true;
  }
}

/**
 * Update notification time
 * Reschedules all notifications with new time
 */
export async function updateNotificationTime(hour: number, minute: number): Promise<void> {
  // Update preferences
  devotionStore$.preferences.notificationHour.set(hour);
  devotionStore$.preferences.notificationMinute.set(minute);
  await devotionStore$.savePreferencesToStorage();

  // Reschedule with new time
  await scheduleDailyApologeticsNotification(hour, minute);
}

/**
 * Get list of all scheduled notifications (for debugging)
 */
export async function getScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
  return await Notifications.getAllScheduledNotificationsAsync();
}

/**
 * Trigger a test notification
 * @param delaySeconds - Delay in seconds (0 = immediate, 60 = 1 minute, etc.)
 * @returns true on success, false on failure
 */
export async function triggerTestNotification(delaySeconds: number = 0): Promise<boolean> {
  try {
    // Ensure questions data is loaded
    await ensureQuestionsLoaded();

    // Check permissions first
    const hasPermission = await checkNotificationPermissions();
    if (!hasPermission) {
      console.log('[NotificationService] No permission for test notification');
      return false;
    }

    // Build notification content for today
    const content = buildNotificationContentForDate(new Date());

    // Schedule notification with appropriate trigger
    await Notifications.scheduleNotificationAsync({
      content,
      trigger: delaySeconds > 0
        ? { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: delaySeconds }
        : null,
    });

    console.log(`[NotificationService] Test notification scheduled (delay: ${delaySeconds}s, question for: ${content.data?.targetDate})`);
    return true;
  } catch (error) {
    console.error('[NotificationService] Error sending test notification:', error);
    return false;
  }
}
