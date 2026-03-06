/**
 * Tutorial Version Configuration
 * Increment this version whenever tutorial logic changes and you want to reset user progress
 * This allows re-showing tutorials or updating tutorial flows
 */

export const TUTORIAL_VERSION = {
  // Increment this number to force tutorial reset
  current: 4,

  // Optional: Add changelog for tracking what changed
  changelog: {
    1: "Initial tutorial version - Study Mode and Search tutorials",
    2: "Test Tutorial version increment",
    3: "Reset tutorials after adding new onboarding flow",
    4: "Reset for testing",
  },
};

// Storage key for tracking user's current tutorial version
export const TUTORIAL_VERSION_KEY = "@parables/tutorial_version";
