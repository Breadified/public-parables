/**
 * Question Utilities - Lookup and date calculation for apologetics questions
 * Used by Library to navigate to the correct devotion date for a comment
 */

import type { ApologeticsQuestion, ApologeticsData } from "@/state/devotionStore";
import apologeticsData from "@/assets/data/apologeticsQuestions.json";

// Constants matching devotionStore
const CYCLE_START_DATE = '2025-12-01';
const TOTAL_QUESTIONS = 105;

// Cast the imported JSON to proper type
const questionsData = apologeticsData as ApologeticsData;

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
 * Parse a YYYY-MM-DD string into a local Date object at midnight
 */
function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

/**
 * Lookup a question by its ID from bundled questions data
 */
export function getQuestionById(questionId: string): ApologeticsQuestion | null {
  return questionsData.questions.find(q => q.id === questionId) || null;
}

/**
 * Get all questions data
 */
export function getQuestionsData(): ApologeticsData {
  return questionsData;
}

/**
 * Calculate the most recent date when a question with this orderIndex was shown
 * Used for navigating from Library comment to the correct devotion date
 *
 * @param orderIndex - The question's orderIndex (0-104)
 * @returns Date string in YYYY-MM-DD format
 */
export function getDateForQuestionIndex(orderIndex: number): string {
  const today = new Date();
  const todayStr = getLocalDateString(today);
  const startDate = parseLocalDate(CYCLE_START_DATE);
  const todayDate = parseLocalDate(todayStr);

  // Calculate days since cycle start
  const daysSinceStart = Math.floor(
    (todayDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  // If before cycle start, use the cycle start date + orderIndex
  if (daysSinceStart < 0) {
    const targetDate = new Date(startDate);
    targetDate.setDate(targetDate.getDate() + orderIndex);
    return getLocalDateString(targetDate);
  }

  // Calculate which cycle day we're on today
  const todaysCycleDay = daysSinceStart % TOTAL_QUESTIONS;

  // Calculate days ago this question was shown
  let daysAgo: number;
  if (orderIndex <= todaysCycleDay) {
    // Question was shown earlier in this cycle
    daysAgo = todaysCycleDay - orderIndex;
  } else {
    // Question was shown in the previous cycle
    daysAgo = todaysCycleDay + (TOTAL_QUESTIONS - orderIndex);
  }

  // Calculate the target date
  const targetDate = new Date(todayDate);
  targetDate.setDate(targetDate.getDate() - daysAgo);

  return getLocalDateString(targetDate);
}

/**
 * Get the date string for a question by its ID
 * Convenience function combining lookup and date calculation
 */
export function getDateForQuestionId(questionId: string): string | null {
  const question = getQuestionById(questionId);
  if (!question) return null;
  return getDateForQuestionIndex(question.orderIndex);
}
