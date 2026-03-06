/**
 * AI Agents Configuration
 *
 * Generic system for AI-powered agents in the Parables app.
 * Each agent has a unique ID, display name, avatar, and disclaimer.
 */

/**
 * AI Agent definition
 */
export interface AIAgent {
  /** Unique UUID for this agent (must match database) */
  id: string;
  /** Display name shown in UI */
  displayName: string;
  /** Avatar URL */
  avatarUrl: string;
  /** Disclaimer shown below AI-generated content */
  disclaimer: string;
  /** Short identifier for the agent */
  slug: string;
}

/**
 * Registry of all AI agents
 * Add new agents here as needed
 */
export const AI_AGENTS: Record<string, AIAgent> = {
  kenny: {
    id: "00000000-0000-0000-0000-000000000001",
    displayName: "Kenny 🤖",
    // Use PNG format - React Native Image cannot render SVG URLs
    avatarUrl: "https://cdn-icons-png.flaticon.com/128/3558/3558977.png",
    disclaimer:
      "Note: AI-generated. May not fully represent Pastor Kenny's views.",
    slug: "kenny",
  },
  // Add more agents here as needed:
  // studyHelper: {
  //   id: '00000000-0000-0000-0000-000000000002',
  //   displayName: 'Study Helper 🤖',
  //   avatarUrl: 'https://api.dicebear.com/7.x/bottts/png?seed=study-helper',
  //   disclaimer: 'Note: AI-generated study assistance.',
  //   slug: 'study-helper',
  // },
};

/**
 * Set of all AI agent user IDs for quick lookup
 */
export const AI_AGENT_IDS = new Set(
  Object.values(AI_AGENTS).map((agent) => agent.id)
);

/**
 * Check if a user ID belongs to any AI agent
 */
export function isAiAgent(userId: string | undefined | null): boolean {
  if (!userId) return false;
  return AI_AGENT_IDS.has(userId);
}

/**
 * Get the AI agent for a given user ID (or undefined if not an AI agent)
 */
export function getAiAgent(
  userId: string | undefined | null
): AIAgent | undefined {
  if (!userId) return undefined;
  return Object.values(AI_AGENTS).find((agent) => agent.id === userId);
}

/**
 * Get the default disclaimer for AI-generated content
 */
export function getAiDisclaimer(userId: string | undefined | null): string {
  const agent = getAiAgent(userId);
  return agent?.disclaimer ?? "Note: AI-generated content.";
}

// ============================================================================
// Legacy exports for backward compatibility
// ============================================================================

/** @deprecated Use AI_AGENTS.kenny.id instead */
export const AI_KENNY_USER_ID = AI_AGENTS.kenny.id;

/** @deprecated Use AI_AGENTS.kenny.displayName instead */
export const AI_KENNY_DISPLAY_NAME = AI_AGENTS.kenny.displayName;

/** @deprecated Use AI_AGENTS.kenny.disclaimer instead */
export const AI_KENNY_DISCLAIMER = AI_AGENTS.kenny.disclaimer;

/** @deprecated Use AI_AGENTS.kenny.avatarUrl instead */
export const AI_KENNY_AVATAR_URL = AI_AGENTS.kenny.avatarUrl;

/** @deprecated Use isAiAgent() instead */
export function isAiKenny(userId: string | undefined | null): boolean {
  return userId === AI_AGENTS.kenny.id;
}
