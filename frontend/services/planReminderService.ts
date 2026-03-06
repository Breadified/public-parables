/**
 * Plan Reminder Service - Daily notification reminders for Bible reading plans
 *
 * Features:
 * - Schedule 15 days of reminders ahead at user-selected local time
 * - Show reading reference for each day's plan reading
 * - Handle permission checks and requests
 * - Update notifications when session progresses
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { router } from 'expo-router';

import { planStore$, furthestProgressSession$ } from '@/state';
import { bibleSQLite } from '@/services/sqlite';

// Notification identifier prefix for plan reminders (each day gets unique ID)
const PLAN_REMINDER_PREFIX = 'plan-reminder-';

// Number of days to schedule ahead
const DAYS_TO_SCHEDULE = 15;

// Android notification channel for plan reminders
const PLAN_REMINDER_CHANNEL = 'plan-reminders';

/**
 * Get local date string in YYYY-MM-DD format
 */
function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Build notification content for a specific plan day
 * Used to schedule notifications for multiple days ahead
 *
 * @param session - The plan session
 * @param plan - The plan with days data
 * @param dayNumber - The plan day number to build content for
 */
function buildNotificationContentForDay(
  session: { id: string },
  plan: { name: string },
  dayNumber: number,
  reference: string | null
): Notifications.NotificationContentInput {
  return {
    title: plan.name,
    body: reference || 'Continue your daily reading',
    data: {
      type: 'plan-reminder',
      sessionId: session.id,
      dayNumber,
    },
    sound: true,
    ...(Platform.OS === 'android' && {
      channelId: PLAN_REMINDER_CHANNEL,
    }),
  };
}

/**
 * Get reading reference for a specific day from plan data
 * Returns a human-readable reference like "John 3:1-16"
 */
function getReadingReferenceForDay(
  plan: Awaited<ReturnType<typeof bibleSQLite.getPlanById>> | null,
  dayNumber: number
): string | null {
  if (!plan) return null;

  const dayData = plan.days.find(d => d.day_number === dayNumber);
  if (!dayData) return null;

  // Find reading content items and extract references
  const readings = dayData.content
    .filter(c => c.type === 'reading' && c.reference)
    .map(c => c.reference!)
    .filter(Boolean);

  if (readings.length === 0) return null;

  // If multiple readings, combine them (e.g., "John 3:1-16, Mark 1:1-20")
  if (readings.length > 2) {
    return `${readings[0]} + ${readings.length - 1} more`;
  }

  return readings.join(', ');
}

/**
 * Schedule plan reminder notifications for the next 15 days
 * Each day gets its own notification with the correct reading reference
 *
 * @param hour - Hour in local time (0-23)
 * @param minute - Minute (0-59)
 */
export async function schedulePlanReminderNotification(
  hour: number,
  minute: number
): Promise<void> {
  try {
    // Get the active session
    const session = furthestProgressSession$.get();
    if (!session) {
      console.log('[PlanReminderService] No active session found');
      return;
    }

    // Fetch plan details
    const plan = await bibleSQLite.getPlanById(session.plan_id);
    if (!plan) {
      console.log('[PlanReminderService] Plan not found:', session.plan_id);
      return;
    }

    const currentDay = session.current_day || 1;

    // Check if session is "in progress"
    if (currentDay > plan.duration_days) {
      console.log('[PlanReminderService] Session completed all days');
      return;
    }

    // Cancel existing plan reminders first
    await cancelPlanReminderNotifications();

    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    // Check if today's notification time has passed
    const todayNotificationTime = new Date(today);
    todayNotificationTime.setHours(hour, minute, 0, 0);
    const startFromTomorrow = now >= todayNotificationTime;

    // Schedule notifications for the next N days
    let scheduledCount = 0;
    const startOffset = startFromTomorrow ? 1 : 0;

    for (let i = startOffset; i < DAYS_TO_SCHEDULE; i++) {
      // Calculate which plan day this notification is for
      const planDay = currentDay + i;

      // Stop if we've passed the end of the plan
      if (planDay > plan.duration_days) {
        break;
      }

      // Calculate the notification date
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() + i);

      // Set the exact notification time
      const notificationTime = new Date(targetDate);
      notificationTime.setHours(hour, minute, 0, 0);

      const dateStr = getLocalDateString(targetDate);
      const identifier = `${PLAN_REMINDER_PREFIX}${dateStr}`;

      // Get reading reference for this plan day
      const reference = getReadingReferenceForDay(plan, planDay);

      // Build notification content
      const content = buildNotificationContentForDay(session, plan, planDay, reference);

      // Calculate seconds from now until notification time
      const secondsUntil = Math.floor((notificationTime.getTime() - now.getTime()) / 1000);

      // Skip if time is in the past
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
              date: notificationTime,
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
        console.error(`[PlanReminderService] Failed to schedule for ${dateStr}:`, scheduleError);
      }
    }

    console.log(
      `[PlanReminderService] Scheduled ${scheduledCount} notifications at ${hour}:${String(minute).padStart(2, '0')} ` +
      `(days ${currentDay}-${Math.min(currentDay + scheduledCount - 1, plan.duration_days)} of ${plan.duration_days})`
    );
  } catch (error) {
    console.error('[PlanReminderService] Error scheduling notifications:', error);
  }
}

/**
 * Cancel all plan reminder notifications
 */
export async function cancelPlanReminderNotifications(): Promise<void> {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const planReminders = scheduled.filter(n =>
      n.identifier.startsWith(PLAN_REMINDER_PREFIX)
    );

    await Promise.all(
      planReminders.map(n =>
        Notifications.cancelScheduledNotificationAsync(n.identifier)
      )
    );

    console.log(`[PlanReminderService] Cancelled ${planReminders.length} plan reminders`);
  } catch (error) {
    console.error('[PlanReminderService] Error cancelling reminders:', error);
  }
}

/**
 * Cancel today's plan reminder notification (called when plan day is completed)
 * Leaves future notifications intact
 */
export async function cancelTodayPlanReminder(): Promise<void> {
  try {
    const todayStr = getLocalDateString();
    const identifier = `${PLAN_REMINDER_PREFIX}${todayStr}`;

    await Notifications.cancelScheduledNotificationAsync(identifier);
    console.log(`[PlanReminderService] Cancelled today's plan reminder: ${identifier}`);
  } catch (error) {
    // Notification might not exist (already fired or not scheduled) - that's OK
    console.log('[PlanReminderService] No plan reminder to cancel for today');
  }
}

// Backwards compatibility alias
export const cancelPlanReminderNotification = cancelPlanReminderNotifications;

/**
 * Update the plan reminder content (call when session progresses)
 * Re-schedules with same time but updated reading reference
 */
export async function updatePlanReminderContent(): Promise<void> {
  const prefs = planStore$.planReminderPreferences.get();

  if (!prefs.reminderEnabled) {
    console.log('[PlanReminderService] Reminders not enabled, skipping update');
    return;
  }

  // Re-schedule with current preferences to update content
  await schedulePlanReminderNotification(prefs.reminderHour, prefs.reminderMinute);
}

/**
 * Set up Android notification channel for plan reminders
 */
export async function setupPlanReminderChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;

  try {
    await Notifications.setNotificationChannelAsync(PLAN_REMINDER_CHANNEL, {
      name: 'Bible Plan Reminders',
      description: 'Daily reminders for your Bible reading plan',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
      enableLights: true,
      lightColor: '#4A90D9',
    });

    console.log('[PlanReminderService] Android notification channel created');
  } catch (error) {
    console.error('[PlanReminderService] Error creating Android channel:', error);
  }
}

/**
 * Handle plan reminder notification tap
 * Navigates to the session view with gotoDay to jump to today's plan day
 */
export function handlePlanReminderNavigation(response: Notifications.NotificationResponse): void {
  const data = response.notification.request.content.data as {
    type?: string;
    sessionId?: string;
    dayNumber?: number;
  } | undefined;

  if (data?.type === 'plan-reminder' && data.sessionId) {
    const sessionId = data.sessionId;
    const dayNumber = data.dayNumber;
    console.log('[PlanReminderService] Navigating to session:', sessionId, 'day:', dayNumber);

    // Set the active session
    planStore$.setActiveSession(sessionId);

    // Navigate to the session view with gotoDay to jump to today's plan day
    setTimeout(() => {
      router.push({
        pathname: '/plans/session/[sessionId]',
        params: { sessionId, ...(dayNumber && { gotoDay: String(dayNumber) }) },
      });
    }, 100);
  }
}

/**
 * Initialize plan reminder service
 * Sets up Android channel and schedules reminder if enabled
 */
export async function initializePlanReminders(): Promise<void> {
  console.log('[PlanReminderService] Initializing...');

  // Set up Android channel
  await setupPlanReminderChannel();

  // Load preferences and schedule if enabled
  const prefs = planStore$.planReminderPreferences.get();

  if (prefs.reminderEnabled) {
    await schedulePlanReminderNotification(prefs.reminderHour, prefs.reminderMinute);
    console.log('[PlanReminderService] Initialization complete (reminder enabled)');
  } else {
    console.log('[PlanReminderService] Initialization complete (reminder disabled)');
  }
}

/**
 * Enable plan reminder with specified time
 * Handles permission check/request
 *
 * @returns true if reminder was enabled, false if permission denied
 */
export async function enablePlanReminder(hour: number, minute: number): Promise<boolean> {
  try {
    // Import notification permission helpers
    const { checkNotificationPermissions, requestNotificationPermissions } = await import('./notificationService');

    // Check permission
    let hasPermission = await checkNotificationPermissions();

    if (!hasPermission) {
      // Request permission
      hasPermission = await requestNotificationPermissions();
      if (!hasPermission) {
        console.log('[PlanReminderService] Permission denied');
        return false;
      }
    }

    // Schedule notification
    await schedulePlanReminderNotification(hour, minute);

    // Update preferences
    planStore$.planReminderPreferences.reminderEnabled.set(true);
    planStore$.planReminderPreferences.reminderHour.set(hour);
    planStore$.planReminderPreferences.reminderMinute.set(minute);
    planStore$.planReminderPreferences.reminderDismissed.set(false);
    await planStore$.savePlanReminderPreferencesToStorage();

    console.log('[PlanReminderService] Reminder enabled');
    return true;
  } catch (error) {
    console.error('[PlanReminderService] Error enabling reminder:', error);
    return false;
  }
}

/**
 * Disable plan reminder
 */
export async function disablePlanReminder(): Promise<void> {
  try {
    await cancelPlanReminderNotification();

    // Update preferences
    planStore$.planReminderPreferences.reminderEnabled.set(false);
    await planStore$.savePlanReminderPreferencesToStorage();

    console.log('[PlanReminderService] Reminder disabled');
  } catch (error) {
    console.error('[PlanReminderService] Error disabling reminder:', error);
  }
}

/**
 * Update plan reminder time
 */
export async function updatePlanReminderTime(hour: number, minute: number): Promise<void> {
  // Update preferences
  planStore$.planReminderPreferences.reminderHour.set(hour);
  planStore$.planReminderPreferences.reminderMinute.set(minute);
  await planStore$.savePlanReminderPreferencesToStorage();

  // Re-schedule with new time
  const prefs = planStore$.planReminderPreferences.get();
  if (prefs.reminderEnabled) {
    await schedulePlanReminderNotification(hour, minute);
  }
}
