/**
 * Validation Utilities
 *
 * Client-side validation for auth forms to catch errors before API calls
 */

/**
 * RFC 5322 compliant email validation
 * Checks format: local@domain.tld
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;

  // Basic RFC 5322 pattern
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  return emailRegex.test(email.trim());
}

/**
 * Validate email format and return error message if invalid
 * @param email - Email address to validate
 * @returns Error message or null if valid
 */
export function validateEmail(email: string): string | null {
  if (!email || email.trim().length === 0) {
    return "Email address is required";
  }

  const trimmed = email.trim();

  // Check basic format
  if (!isValidEmail(trimmed)) {
    return "Please enter a valid email address (e.g., name@example.com)";
  }

  // Check for common typos
  const typoSuggestion = detectEmailTypos(trimmed);
  if (typoSuggestion) {
    return typoSuggestion;
  }

  // Check length (reasonable limits)
  if (trimmed.length > 254) {
    return "Email address is too long";
  }

  const [local, domain] = trimmed.split('@');

  if (local.length > 64) {
    return "Email username part is too long";
  }

  if (domain.length > 253) {
    return "Email domain is too long";
  }

  return null;
}

/**
 * Detect common email typos and suggest corrections
 * @param email - Email to check
 * @returns Suggestion message or null
 */
export function detectEmailTypos(email: string): string | null {
  const commonTypos: Record<string, string> = {
    // Gmail typos
    'gmail.con': 'gmail.com',
    'gmail.cmo': 'gmail.com',
    'gmai.com': 'gmail.com',
    'gmial.com': 'gmail.com',
    'gmal.com': 'gmail.com',

    // Outlook typos
    'outlook.con': 'outlook.com',
    'outlok.com': 'outlook.com',
    'outloo.com': 'outlook.com',

    // Yahoo typos
    'yahoo.con': 'yahoo.com',
    'yaho.com': 'yahoo.com',
    'yahooo.com': 'yahoo.com',

    // Hotmail typos
    'hotmail.con': 'hotmail.com',
    'hotmai.com': 'hotmail.com',
    'hotmal.com': 'hotmail.com',

    // iCloud typos
    'icloud.con': 'icloud.com',
    'iclod.com': 'icloud.com',
  };

  const domain = email.split('@')[1]?.toLowerCase();

  if (domain && commonTypos[domain]) {
    return `Did you mean ${email.split('@')[0]}@${commonTypos[domain]}?`;
  }

  return null;
}

/**
 * Validate password strength
 * @param password - Password to validate
 * @returns Error message or null if valid
 */
export function validatePassword(password: string): string | null {
  if (!password || password.length === 0) {
    return "Password is required";
  }

  if (password.length < 8) {
    return "Password must be at least 8 characters long";
  }

  if (password.length > 72) {
    // bcrypt limit
    return "Password is too long (max 72 characters)";
  }

  // Check for at least some complexity (optional, can be adjusted)
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);

  if (!hasLetter) {
    return "Password should contain at least one letter";
  }

  if (!hasNumber) {
    return "Password should contain at least one number";
  }

  // Check for common weak passwords
  const commonWeak = [
    '12345678',
    'password',
    'password1',
    'password123',
    'qwerty123',
    'abc12345',
  ];

  if (commonWeak.includes(password.toLowerCase())) {
    return "This password is too common. Please choose a stronger password";
  }

  return null;
}

/**
 * Validate password confirmation
 * @param password - Original password
 * @param confirm - Confirmation password
 * @returns Error message or null if matching
 */
export function validatePasswordConfirm(password: string, confirm: string): string | null {
  if (!confirm || confirm.length === 0) {
    return "Please confirm your password";
  }

  if (password !== confirm) {
    return "Passwords do not match";
  }

  return null;
}

/**
 * Validate display name format (username part only, without discriminator)
 * @param displayName - Display name to validate
 * @returns Error message or null if valid
 */
export function validateDisplayName(displayName: string): string | null {
  if (!displayName || displayName.trim().length === 0) {
    return "Display name is required";
  }

  const trimmed = displayName.trim();

  // Must be 3-20 characters (schema constraint)
  if (trimmed.length < 3) {
    return "Display name must be at least 3 characters";
  }

  if (trimmed.length > 20) {
    return "Display name must be 20 characters or less";
  }

  // Must be alphanumeric or underscore (schema constraint)
  const validFormat = /^[a-zA-Z0-9_]+$/.test(trimmed);

  if (!validFormat) {
    return "Display name can only contain letters, numbers, and underscores";
  }

  return null;
}
