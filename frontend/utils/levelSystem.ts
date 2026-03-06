/**
 * Level System - XP to Level calculations and tier definitions
 *
 * Level tiers determine badge appearance:
 * - Bronze: Levels 1-4
 * - Silver: Levels 5-9
 * - Gold: Levels 10-19
 * - Platinum: Levels 20-29
 * - Diamond: Levels 30+
 *
 * Progression targets (super user):
 * - Level 30 (Diamond): ~1 year
 * - Level 50: ~3 years
 */

// XP required per level (gentle exponential curve)
// 4x increase from original for longer progression
// Level 1: 0 XP, Level 2: 72,000 XP, Level 5: ~312,000 XP, Level 10: ~800,000 XP
// Level 30: ~4,480,000 XP, Level 50: ~14,280,000 XP
const XP_PER_LEVEL_BASE = 72000;
const XP_CURVE_MULTIPLIER = 1.05;

export type LevelTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';

export interface LevelInfo {
  level: number;
  tier: LevelTier;
  currentXP: number;
  xpForCurrentLevel: number;
  xpForNextLevel: number;
  progressToNextLevel: number; // 0-1
  totalXPForNextLevel: number;
}

/**
 * Calculate the total XP required to reach a specific level
 */
export function getXPForLevel(level: number): number {
  if (level <= 1) return 0;

  // Accumulate with full precision, then round at the end
  // This prevents cumulative truncation that caused off-by-one errors
  let totalXP = 0;
  for (let i = 2; i <= level; i++) {
    totalXP += XP_PER_LEVEL_BASE * Math.pow(XP_CURVE_MULTIPLIER, i - 2);
  }
  return Math.round(totalXP);
}

/**
 * Calculate level from total XP
 */
export function getLevelFromXP(totalXP: number): number {
  let level = 1;
  let xpNeeded = 0;

  while (true) {
    const nextLevelXP = getXPForLevel(level + 1);
    if (totalXP < nextLevelXP) {
      break;
    }
    level++;
    xpNeeded = nextLevelXP;
  }

  return level;
}

/**
 * Get the tier for a given level
 */
export function getTierForLevel(level: number): LevelTier {
  if (level < 5) return 'bronze';
  if (level < 10) return 'silver';
  if (level < 20) return 'gold';
  if (level < 30) return 'platinum';
  return 'diamond';
}

/**
 * Get complete level information from XP
 */
export function getLevelInfo(totalXP: number): LevelInfo {
  const level = getLevelFromXP(totalXP);
  const tier = getTierForLevel(level);
  const xpForCurrentLevel = getXPForLevel(level);
  const xpForNextLevel = getXPForLevel(level + 1);
  const xpInCurrentLevel = totalXP - xpForCurrentLevel;
  const xpNeededForNextLevel = xpForNextLevel - xpForCurrentLevel;
  const progressToNextLevel = xpNeededForNextLevel > 0
    ? xpInCurrentLevel / xpNeededForNextLevel
    : 0;

  return {
    level,
    tier,
    currentXP: totalXP,
    xpForCurrentLevel,
    xpForNextLevel,
    progressToNextLevel: Math.min(1, Math.max(0, progressToNextLevel)),
    totalXPForNextLevel: xpForNextLevel,
  };
}

/**
 * Get a human-readable tier name
 */
export function getTierDisplayName(tier: LevelTier): string {
  const names: Record<LevelTier, string> = {
    bronze: 'Bronze',
    silver: 'Silver',
    gold: 'Gold',
    platinum: 'Platinum',
    diamond: 'Diamond',
  };
  return names[tier];
}

/**
 * Format XP for display (e.g., "1,234 XP")
 */
export function formatXP(xp: number): string {
  return `${xp.toLocaleString()} XP`;
}

/**
 * Get XP needed for next level
 */
export function getXPToNextLevel(totalXP: number): number {
  const levelInfo = getLevelInfo(totalXP);
  return levelInfo.xpForNextLevel - totalXP;
}

/**
 * Get tier based on login streak count (for streak badges)
 * - 0-6 days: Bronze
 * - 7-29 days: Silver
 * - 30-99 days: Gold
 * - 100-364 days: Platinum
 * - 365+ days: Diamond
 */
export function getStreakTier(streakCount: number): LevelTier {
  if (streakCount < 7) return 'bronze';
  if (streakCount < 30) return 'silver';
  if (streakCount < 100) return 'gold';
  if (streakCount < 365) return 'platinum';
  return 'diamond';
}

// Pre-calculated level thresholds for reference (72000 base, 1.05 curve)
// Level 1: 0 XP
// Level 2: 72,000 XP
// Level 3: 147,600 XP (72,000 + 75,600)
// Level 4: 227,580 XP
// Level 5: ~312,000 XP - Silver starts
// Level 10: ~800,000 XP - Gold starts
// Level 20: ~2,400,000 XP - Platinum starts
// Level 30: ~4,480,000 XP - Diamond starts
