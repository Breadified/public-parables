/**
 * Date and Time Formatting Utilities
 * Provides locale-aware date formatting functions for consistent formatting across the app
 */

/**
 * Format an ISO timestamp string using device's locale settings
 *
 * @param isoString - ISO 8601 date string (e.g., "2025-01-15T14:30:00.000Z")
 * @param options - Optional Intl.DateTimeFormatOptions to customize formatting
 * @returns Formatted date string or empty string if invalid
 *
 * @example
 * formatTimestamp("2025-01-15T14:30:00.000Z")
 * // Returns: "1/15/2025, 2:30 PM" (US locale)
 * // Returns: "15/1/2025, 14:30" (UK locale with 24h time)
 */
export function formatTimestamp(
  isoString: string | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!isoString) return "";

  try {
    const date = new Date(isoString);

    // Default options for notes timestamps
    const defaultOptions: Intl.DateTimeFormatOptions = {
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    };

    // Use device's locale for date/time formatting
    return date.toLocaleString(undefined, options || defaultOptions);
  } catch {
    return "";
  }
}

/**
 * Format a date without time (date only)
 *
 * @param isoString - ISO 8601 date string
 * @returns Formatted date string (e.g., "Jan 15, 2025")
 */
export function formatDate(isoString: string | null | undefined): string {
  if (!isoString) return "";

  try {
    const date = new Date(isoString);
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

/**
 * Format time only (no date)
 *
 * @param isoString - ISO 8601 date string
 * @returns Formatted time string (e.g., "2:30 PM" or "14:30")
 */
export function formatTime(isoString: string | null | undefined): string {
  if (!isoString) return "";

  try {
    const date = new Date(isoString);
    return date.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

/**
 * Calculate the current day in a Bible plan based on when the session started.
 * Day 1 is the start date, Day 2 is the next day, etc.
 * Uses local device time for the calculation.
 *
 * @param startedAt - ISO 8601 timestamp when the session started
 * @param maxDay - Optional maximum day (plan duration) to cap the result
 * @returns The calculated current day number (minimum 1)
 *
 * @example
 * // Started 9 days ago -> returns 10 (day 1 + 9 days elapsed)
 * calculatePlanDay("2025-01-01T10:00:00.000Z", 30)
 */
export function calculatePlanDay(
  startedAt: string | null | undefined,
  maxDay?: number
): number {
  if (!startedAt) return 1;

  try {
    const now = new Date();
    const start = new Date(startedAt);

    // Get start of day in local timezone for both dates
    const startOfStartDay = new Date(
      start.getFullYear(),
      start.getMonth(),
      start.getDate()
    );
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );

    // Calculate days difference
    const msPerDay = 24 * 60 * 60 * 1000;
    const daysElapsed = Math.floor(
      (startOfToday.getTime() - startOfStartDay.getTime()) / msPerDay
    );

    // Day 1 on start date, Day 2 the next day, etc.
    const calculatedDay = 1 + daysElapsed;

    // Cap at maxDay if provided, minimum of 1
    if (maxDay !== undefined) {
      return Math.max(1, Math.min(calculatedDay, maxDay));
    }

    return Math.max(1, calculatedDay);
  } catch {
    return 1;
  }
}

/**
 * Get date string in YYYY-MM-DD format using device local time
 * (NOT UTC - avoids timezone issues with toISOString)
 *
 * @param date - Optional Date object (defaults to current date)
 * @returns Date string in YYYY-MM-DD format using local timezone
 *
 * @example
 * getLocalDateString() // Returns "2025-01-21" (in local timezone)
 * getLocalDateString(new Date("2025-01-15")) // Returns "2025-01-15"
 */
export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Get relative time from now (e.g., "2 hours ago", "yesterday")
 *
 * @param isoString - ISO 8601 date string
 * @returns Relative time string or absolute date if too old
 */
export function formatRelativeTime(isoString: string | null | undefined): string {
  if (!isoString) return "";

  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

    // Fall back to absolute date for older items
    return formatDate(isoString);
  } catch {
    return "";
  }
}
