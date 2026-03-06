/**
 * XP Calculator - Super User Scenario Analysis
 * Run with: npx ts-node scripts/xp-calculator.ts
 */

// Current XP values (100x scaled)
const REWARDS = {
  LOGIN: 1000,
  LOGIN_STREAK_7: 2500,
  LOGIN_STREAK_30: 10000,
  CHAPTER_READ: 500,
  DAILY_NOTE: 1000, // Base, with diminishing returns
  DAY_COMPLETE: 1000,
  DAY_COMMENT: 500,
  STREAK_3: 1500,
  STREAK_7: 5000,
  STREAK_14: 10000,
  STREAK_30: 25000,
  STREAK_60: 50000,
  STREAK_90: 75000,
  PLAN_COMPLETE_PER_DAY: 500,
};

// Note diminishing returns multipliers
const NOTE_MULTIPLIERS = [1.0, 0.5, 0.25, 0.1];

// Level calculation
function calculateLevelFromXP(totalXP: number): number {
  if (totalXP <= 0) return 1;

  let currentLevel = 1;
  let accumulated = 0;
  let xpForNext = 18000;

  while (accumulated <= totalXP) {
    currentLevel++;
    accumulated += xpForNext;
    xpForNext = Math.floor(18000 * Math.pow(1.05, currentLevel - 1));
  }

  return currentLevel - 1;
}

function getXPForLevel(level: number): number {
  if (level <= 1) return 0;
  let total = 0;
  for (let i = 2; i <= level; i++) {
    total += Math.floor(18000 * Math.pow(1.05, i - 2));
  }
  return total;
}

// Calculate daily XP for notes with diminishing returns
function calculateNoteXP(notesPerDay: number): number {
  let total = 0;
  for (let i = 0; i < notesPerDay; i++) {
    const multiplier = NOTE_MULTIPLIERS[Math.min(i, NOTE_MULTIPLIERS.length - 1)];
    total += Math.floor(REWARDS.DAILY_NOTE * multiplier);
  }
  return total;
}

// Super user scenario
interface UserScenario {
  name: string;
  chaptersPerDay: number;
  notesPerDay: number;
  hasActivePlan: boolean;
  commentsOnPlan: boolean;
  planLengthDays: number;
}

function calculateYearlyXP(scenario: UserScenario, years: number): void {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`SCENARIO: ${scenario.name}`);
  console.log(`${'='.repeat(60)}`);
  console.log(`- Chapters/day: ${scenario.chaptersPerDay}`);
  console.log(`- Notes/day: ${scenario.notesPerDay}`);
  console.log(`- Active plan: ${scenario.hasActivePlan ? `Yes (${scenario.planLengthDays} days)` : 'No'}`);
  console.log(`- Comments on plan: ${scenario.commentsOnPlan ? 'Yes' : 'No'}`);

  const days = years * 365;
  let totalXP = 0;

  // Daily recurring rewards
  const dailyXP = {
    login: REWARDS.LOGIN,
    chapters: scenario.chaptersPerDay * REWARDS.CHAPTER_READ,
    notes: calculateNoteXP(scenario.notesPerDay),
    planDay: scenario.hasActivePlan ? REWARDS.DAY_COMPLETE : 0,
    planComment: scenario.hasActivePlan && scenario.commentsOnPlan ? REWARDS.DAY_COMMENT : 0,
  };

  const dailyTotal = Object.values(dailyXP).reduce((a, b) => a + b, 0);
  totalXP += dailyTotal * days;

  console.log(`\nDAILY XP BREAKDOWN:`);
  console.log(`  Login: ${dailyXP.login.toLocaleString()}`);
  console.log(`  Chapters (${scenario.chaptersPerDay}): ${dailyXP.chapters.toLocaleString()}`);
  console.log(`  Notes (${scenario.notesPerDay}): ${dailyXP.notes.toLocaleString()}`);
  if (scenario.hasActivePlan) {
    console.log(`  Plan day complete: ${dailyXP.planDay.toLocaleString()}`);
    console.log(`  Plan comment: ${dailyXP.planComment.toLocaleString()}`);
  }
  console.log(`  DAILY TOTAL: ${dailyTotal.toLocaleString()} XP`);

  // Weekly login streaks (every 7 days)
  const weeks = Math.floor(days / 7);
  totalXP += weeks * REWARDS.LOGIN_STREAK_7;

  // Monthly login streaks (every 30 days)
  const months = Math.floor(days / 30);
  totalXP += months * REWARDS.LOGIN_STREAK_30;

  console.log(`\nSTREAK BONUSES (over ${years} year${years > 1 ? 's' : ''}):`);
  console.log(`  7-day login streaks (${weeks}x): ${(weeks * REWARDS.LOGIN_STREAK_7).toLocaleString()}`);
  console.log(`  30-day login streaks (${months}x): ${(months * REWARDS.LOGIN_STREAK_30).toLocaleString()}`);

  // Plan streak bonuses (per plan completion)
  if (scenario.hasActivePlan) {
    const plansCompleted = Math.floor(days / scenario.planLengthDays);
    const planStreakXP = REWARDS.STREAK_3 + REWARDS.STREAK_7 + REWARDS.STREAK_14 +
                         REWARDS.STREAK_30 + REWARDS.STREAK_60 + REWARDS.STREAK_90;
    const planCompleteXP = scenario.planLengthDays * REWARDS.PLAN_COMPLETE_PER_DAY;

    totalXP += plansCompleted * (planStreakXP + planCompleteXP);

    console.log(`\nPLAN BONUSES (${plansCompleted} plan${plansCompleted > 1 ? 's' : ''} completed):`);
    console.log(`  Plan streak bonuses: ${planStreakXP.toLocaleString()} XP each`);
    console.log(`  Plan completion (${scenario.planLengthDays} days): ${planCompleteXP.toLocaleString()} XP each`);
    console.log(`  Total plan XP: ${(plansCompleted * (planStreakXP + planCompleteXP)).toLocaleString()}`);
  }

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`YEARLY BREAKDOWN:`);

  for (let y = 1; y <= years; y++) {
    const yearDays = y * 365;
    let yearXP = dailyTotal * yearDays;
    yearXP += Math.floor(yearDays / 7) * REWARDS.LOGIN_STREAK_7;
    yearXP += Math.floor(yearDays / 30) * REWARDS.LOGIN_STREAK_30;

    if (scenario.hasActivePlan) {
      const plansCompleted = Math.floor(yearDays / scenario.planLengthDays);
      const planStreakXP = REWARDS.STREAK_3 + REWARDS.STREAK_7 + REWARDS.STREAK_14 +
                           REWARDS.STREAK_30 + REWARDS.STREAK_60 + REWARDS.STREAK_90;
      const planCompleteXP = scenario.planLengthDays * REWARDS.PLAN_COMPLETE_PER_DAY;
      yearXP += plansCompleted * (planStreakXP + planCompleteXP);
    }

    const level = calculateLevelFromXP(yearXP);
    const xpForCurrentLevel = getXPForLevel(level);
    const xpForNextLevel = getXPForLevel(level + 1);
    const progress = ((yearXP - xpForCurrentLevel) / (xpForNextLevel - xpForCurrentLevel) * 100).toFixed(1);

    console.log(`  Year ${y}: ${yearXP.toLocaleString()} XP → Level ${level} (${progress}% to ${level + 1})`);
  }

  console.log(`${'─'.repeat(60)}`);
}

// Print level thresholds
console.log('LEVEL THRESHOLDS:');
console.log('─'.repeat(40));
[1, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50].forEach(level => {
  const xp = getXPForLevel(level);
  const tier = level < 5 ? 'Bronze' : level < 10 ? 'Silver' : level < 20 ? 'Gold' : level < 30 ? 'Platinum' : 'Diamond';
  console.log(`  Level ${level.toString().padStart(2)} (${tier.padEnd(8)}): ${xp.toLocaleString().padStart(12)} XP`);
});

// Calculate scenarios
const superUser: UserScenario = {
  name: 'SUPER USER (Very Active)',
  chaptersPerDay: 4,
  notesPerDay: 3,
  hasActivePlan: true,
  commentsOnPlan: true,
  planLengthDays: 365, // Year-long Bible reading plan
};

const activeUser: UserScenario = {
  name: 'ACTIVE USER (Regular)',
  chaptersPerDay: 2,
  notesPerDay: 1,
  hasActivePlan: true,
  commentsOnPlan: false,
  planLengthDays: 365,
};

const casualUser: UserScenario = {
  name: 'CASUAL USER (Light)',
  chaptersPerDay: 1,
  notesPerDay: 0,
  hasActivePlan: false,
  commentsOnPlan: false,
  planLengthDays: 0,
};

calculateYearlyXP(superUser, 3);
calculateYearlyXP(activeUser, 3);
calculateYearlyXP(casualUser, 3);

// Target analysis
console.log(`\n${'='.repeat(60)}`);
console.log('TARGET ANALYSIS:');
console.log('─'.repeat(60));
console.log(`Target: Level 30 in 1 year, Level 50 in 3 years`);
console.log(`XP needed for Level 30: ${getXPForLevel(30).toLocaleString()}`);
console.log(`XP needed for Level 50: ${getXPForLevel(50).toLocaleString()}`);
console.log(`\nDaily XP needed for Level 30 in 1 year: ${Math.ceil(getXPForLevel(30) / 365).toLocaleString()}`);
console.log(`Daily XP needed for Level 50 in 3 years: ${Math.ceil(getXPForLevel(50) / (365 * 3)).toLocaleString()}`);
