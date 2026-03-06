/**
 * Auth Error Message Mapper
 *
 * Converts technical Supabase error messages into user-friendly messages
 */

interface ErrorPattern {
  pattern: RegExp | string;
  message: string;
}

/**
 * Error patterns mapped to user-friendly messages
 * Order matters - more specific patterns should come first
 */
const ERROR_PATTERNS: ErrorPattern[] = [
  // Email validation errors
  {
    pattern: /email.*invalid/i,
    message: "Please enter a valid email address (e.g., name@example.com)",
  },
  {
    pattern: /email.*not.*valid/i,
    message: "Please enter a valid email address (e.g., name@example.com)",
  },

  // User already exists
  {
    pattern: /user.*already.*registered/i,
    message: "This email is already registered. Try signing in instead?",
  },
  {
    pattern: /user.*already.*exists/i,
    message: "This email is already registered. Try signing in instead?",
  },
  {
    pattern: /email.*already.*use/i,
    message: "This email is already in use. Try signing in or use a different email",
  },

  // Password errors
  {
    pattern: /password.*least.*(\d+).*character/i,
    message: "Please choose a stronger password (at least 8 characters)",
  },
  {
    pattern: /password.*too.*weak/i,
    message: "Please choose a stronger password with letters and numbers",
  },
  {
    pattern: /password.*short/i,
    message: "Password is too short. Please use at least 8 characters",
  },

  // Invalid credentials
  {
    pattern: /invalid.*credentials/i,
    message: "Invalid email or password. Please check and try again",
  },
  {
    pattern: /invalid.*login/i,
    message: "Invalid email or password. Please check and try again",
  },

  // Rate limiting
  {
    pattern: /rate.*limit/i,
    message: "Too many attempts. Please wait a moment and try again",
  },
  {
    pattern: /too.*many.*requests/i,
    message: "Too many attempts. Please wait a moment and try again",
  },
  {
    pattern: /email.*rate.*limit/i,
    message: "Too many emails sent. Please wait before requesting another",
  },

  // Network errors
  {
    pattern: /failed.*fetch/i,
    message: "Connection issue. Please check your internet and try again",
  },
  {
    pattern: /network.*request.*failed/i,
    message: "Connection issue. Please check your internet and try again",
  },
  {
    pattern: /network.*error/i,
    message: "Connection issue. Please check your internet and try again",
  },
  {
    pattern: /timeout/i,
    message: "Request timed out. Please check your connection and try again",
  },

  // Server errors
  {
    pattern: /internal.*server.*error/i,
    message: "Server error. Please try again in a moment",
  },
  {
    pattern: /service.*unavailable/i,
    message: "Service temporarily unavailable. Please try again shortly",
  },

  // Database/RLS errors
  {
    pattern: /row.*level.*security/i,
    message: "Account setup issue. Please try again or contact support if this persists",
  },
  {
    pattern: /permission.*denied/i,
    message: "Permission error. Please try again or contact support",
  },

  // Email confirmation
  {
    pattern: /email.*not.*confirmed/i,
    message: "Please check your email and confirm your account before signing in",
  },
  {
    pattern: /confirmation.*required/i,
    message: "Please check your email and confirm your account",
  },

  // Session errors
  {
    pattern: /session.*expired/i,
    message: "Your session has expired. Please sign in again",
  },
  {
    pattern: /token.*expired/i,
    message: "Your session has expired. Please sign in again",
  },
  {
    pattern: /refresh.*token.*expired/i,
    message: "Your session has expired. Please sign in again",
  },

  // OAuth errors
  {
    pattern: /oauth.*error/i,
    message: "Authentication with provider failed. Please try again",
  },
  {
    pattern: /provider.*error/i,
    message: "Authentication provider error. Please try again",
  },

  // Generic auth errors
  {
    pattern: /auth.*error/i,
    message: "Authentication error. Please try again",
  },
  {
    pattern: /authentication.*failed/i,
    message: "Authentication failed. Please check your credentials and try again",
  },
];

/**
 * Get user-friendly error message from Supabase error
 * @param error - Error object from Supabase or generic Error
 * @returns User-friendly error message
 */
export function getAuthErrorMessage(error: any): string {
  // Handle null/undefined
  if (!error) {
    return "An unknown error occurred. Please try again";
  }

  // Extract error message
  let errorMessage = "";

  if (typeof error === "string") {
    errorMessage = error;
  } else if (error.message) {
    errorMessage = error.message;
  } else if (error.error_description) {
    // OAuth errors sometimes use this field
    errorMessage = error.error_description;
  } else if (error.msg) {
    // Some errors use 'msg' field
    errorMessage = error.msg;
  }

  // If we couldn't extract a message, return generic error
  if (!errorMessage) {
    return "An error occurred. Please try again";
  }

  // Try to match against known patterns
  for (const { pattern, message } of ERROR_PATTERNS) {
    if (typeof pattern === "string") {
      if (errorMessage.toLowerCase().includes(pattern.toLowerCase())) {
        return message;
      }
    } else {
      if (pattern.test(errorMessage)) {
        return message;
      }
    }
  }

  // If no pattern matched but message is reasonable length, sanitize and return it
  if (errorMessage.length < 200 && !errorMessage.includes("{") && !errorMessage.includes("Error:")) {
    // Remove technical prefixes
    const sanitized = errorMessage
      .replace(/^AuthApiError:\s*/i, "")
      .replace(/^Error:\s*/i, "")
      .replace(/^AuthError:\s*/i, "")
      .trim();

    // Capitalize first letter
    return sanitized.charAt(0).toUpperCase() + sanitized.slice(1);
  }

  // Fallback to generic error
  return "An error occurred. Please try again or contact support if this persists";
}

/**
 * Check if error is due to network/connection issues
 * @param error - Error object
 * @returns True if network error
 */
export function isNetworkError(error: any): boolean {
  const message = typeof error === "string" ? error : error?.message || "";

  return (
    /failed.*fetch/i.test(message) ||
    /network.*request.*failed/i.test(message) ||
    /network.*error/i.test(message) ||
    /timeout/i.test(message)
  );
}

/**
 * Check if error is due to rate limiting
 * @param error - Error object
 * @returns True if rate limit error
 */
export function isRateLimitError(error: any): boolean {
  const message = typeof error === "string" ? error : error?.message || "";

  return (
    /rate.*limit/i.test(message) ||
    /too.*many.*requests/i.test(message) ||
    /too.*many.*attempts/i.test(message)
  );
}
