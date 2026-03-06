#!/usr/bin/env node
/**
 * Migration script: Convert biblePlans.json from old structure to new content array
 *
 * Old structure:
 * {
 *   "day": 1,
 *   "readings": [{ "reference": "...", "verseIdStart": ..., "verseIdEnd": ... }],
 *   "recap": "text..."
 * }
 *
 * New structure:
 * {
 *   "day": 1,
 *   "content": [
 *     { "type": "intro", "text": "..." },      // Day 1 recap becomes intro
 *     { "type": "reading", "reference": "...", "verseIdStart": ..., "verseIdEnd": ... },
 *     { "type": "recap", "text": "..." }       // Day 2+ recap stays as recap
 *   ]
 * }
 */

const fs = require('fs');
const path = require('path');

// Paths
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const BIBLE_DATA_DIR = path.join(PROJECT_ROOT, 'bible-data');
const PLANS_PATH = path.join(BIBLE_DATA_DIR, 'biblePlans.json');
const BACKUP_PATH = path.join(BIBLE_DATA_DIR, 'biblePlans.backup.json');

/**
 * Determine if this day should use 'intro' instead of 'recap'
 * Logic:
 * 1. If this is the FIRST occurrence of this book in the plan → intro
 * 2. Otherwise → recap
 *
 * The seenBooks set is tracked at the plan level to identify book introductions
 */
function getTextType(dayNumber, currentReadings, recapText, seenBooks) {
  if (!currentReadings || currentReadings.length === 0) {
    return 'recap';
  }

  // Get the book ID of the first reading
  const currentFirstReading = currentReadings[0];
  const currentBookId = Math.floor(currentFirstReading.verseIdStart / 1000000);

  // If we haven't seen this book before, this is an intro
  if (!seenBooks.has(currentBookId)) {
    seenBooks.add(currentBookId);
    return 'intro';
  }

  return 'recap';
}

/**
 * Migrate a single plan's day data to new content structure
 * @param {object} dayData - The day data to migrate
 * @param {Set} seenBooks - Set of book IDs already seen in this plan
 */
function migratePlanDay(dayData, seenBooks) {
  const { day, readings = [], recap } = dayData;

  // Build content array
  const content = [];

  // Determine text type for recap based on whether we've seen this book before
  const textType = recap ? getTextType(
    day,
    readings,
    recap,
    seenBooks
  ) : null;

  // Mark books as seen (even if no recap text)
  if (!recap && readings.length > 0) {
    const firstBookId = Math.floor(readings[0].verseIdStart / 1000000);
    seenBooks.add(firstBookId);
  }

  // For day 1 or book intros: intro comes BEFORE readings
  // For other days: recap comes AFTER readings
  if (textType === 'intro' && recap) {
    content.push({
      type: 'intro',
      text: recap,
    });
  }

  // Add readings
  for (const reading of readings) {
    content.push({
      type: 'reading',
      reference: reading.reference,
      verseIdStart: reading.verseIdStart,
      verseIdEnd: reading.verseIdEnd,
    });
  }

  // For regular recaps (day 2+): recap comes AFTER readings
  if (textType === 'recap' && recap) {
    content.push({
      type: 'recap',
      text: recap,
    });
  }

  return {
    day,
    content,
  };
}

/**
 * Migrate all plans
 */
function migratePlans(data) {
  const migrated = {
    biblePlans: [],
  };

  for (const plan of data.biblePlans) {
    const migratedPlan = {
      ...plan,
      plan: [],
    };

    // Track which books we've seen in this plan (for intro vs recap logic)
    const seenBooks = new Set();

    // Migrate each day
    for (let i = 0; i < plan.plan.length; i++) {
      const dayData = plan.plan[i];

      // Skip if already migrated (has content array)
      if (dayData.content) {
        migratedPlan.plan.push(dayData);
        // Still track books from migrated content
        dayData.content.forEach(c => {
          if (c.type === 'reading') {
            seenBooks.add(Math.floor(c.verseIdStart / 1000000));
          }
        });
        continue;
      }

      const migratedDay = migratePlanDay(dayData, seenBooks);
      migratedPlan.plan.push(migratedDay);
    }

    migrated.biblePlans.push(migratedPlan);
  }

  return migrated;
}

/**
 * Validate migration results
 */
function validateMigration(original, migrated) {
  const issues = [];

  // Check plan count
  if (original.biblePlans.length !== migrated.biblePlans.length) {
    issues.push(`Plan count mismatch: ${original.biblePlans.length} vs ${migrated.biblePlans.length}`);
  }

  // Validate each plan
  for (let p = 0; p < original.biblePlans.length; p++) {
    const origPlan = original.biblePlans[p];
    const migrPlan = migrated.biblePlans[p];

    if (origPlan.plan.length !== migrPlan.plan.length) {
      issues.push(`Plan "${origPlan.id}" day count mismatch: ${origPlan.plan.length} vs ${migrPlan.plan.length}`);
    }

    // Check each day
    for (let d = 0; d < origPlan.plan.length; d++) {
      const origDay = origPlan.plan[d];
      const migrDay = migrPlan.plan[d];

      // Skip already migrated days
      if (origDay.content) continue;

      // Count readings in migrated content
      const migrReadings = migrDay.content.filter(c => c.type === 'reading');
      if ((origDay.readings?.length || 0) !== migrReadings.length) {
        issues.push(`Plan "${origPlan.id}" day ${origDay.day}: reading count mismatch`);
      }

      // Check recap preservation
      const migrText = migrDay.content.find(c => c.type === 'intro' || c.type === 'recap');
      if (origDay.recap && !migrText) {
        issues.push(`Plan "${origPlan.id}" day ${origDay.day}: recap text lost`);
      }
      if (!origDay.recap && migrText) {
        issues.push(`Plan "${origPlan.id}" day ${origDay.day}: unexpected text added`);
      }
    }
  }

  return issues;
}

/**
 * Generate stats about the migration
 */
function generateStats(migrated) {
  let totalDays = 0;
  let daysWithIntro = 0;
  let daysWithRecap = 0;
  let daysWithBothTextTypes = 0;
  let totalReadings = 0;

  for (const plan of migrated.biblePlans) {
    for (const day of plan.plan) {
      totalDays++;

      const hasIntro = day.content.some(c => c.type === 'intro');
      const hasRecap = day.content.some(c => c.type === 'recap');
      const readingCount = day.content.filter(c => c.type === 'reading').length;

      if (hasIntro) daysWithIntro++;
      if (hasRecap) daysWithRecap++;
      if (hasIntro && hasRecap) daysWithBothTextTypes++;
      totalReadings += readingCount;
    }
  }

  return {
    totalPlans: migrated.biblePlans.length,
    totalDays,
    daysWithIntro,
    daysWithRecap,
    daysWithBothTextTypes,
    totalReadings,
  };
}

/**
 * Main migration function
 */
function main() {
  console.log('Bible Plans Migration: readings + recap -> content array\n');

  // Check if already migrated
  const data = JSON.parse(fs.readFileSync(PLANS_PATH, 'utf-8'));
  const firstDay = data.biblePlans[0]?.plan[0];
  if (firstDay?.content) {
    console.log('Plans appear to already be migrated (first day has content array).');
    console.log('To re-run migration, restore from backup first.\n');

    // Show current stats
    const stats = generateStats(data);
    console.log('Current structure stats:');
    console.log(`  Total plans: ${stats.totalPlans}`);
    console.log(`  Total days: ${stats.totalDays}`);
    console.log(`  Days with intro: ${stats.daysWithIntro}`);
    console.log(`  Days with recap: ${stats.daysWithRecap}`);
    console.log(`  Total readings: ${stats.totalReadings}`);
    return;
  }

  // Create backup
  console.log('Creating backup at:', BACKUP_PATH);
  fs.copyFileSync(PLANS_PATH, BACKUP_PATH);

  // Migrate
  console.log('Migrating plans...\n');
  const migrated = migratePlans(data);

  // Validate
  const issues = validateMigration(data, migrated);
  if (issues.length > 0) {
    console.error('VALIDATION ERRORS:');
    issues.forEach(issue => console.error(`  - ${issue}`));
    console.error('\nMigration aborted. Backup preserved.');
    return;
  }

  console.log('Validation passed!\n');

  // Generate stats
  const stats = generateStats(migrated);
  console.log('Migration stats:');
  console.log(`  Total plans: ${stats.totalPlans}`);
  console.log(`  Total days: ${stats.totalDays}`);
  console.log(`  Days with intro: ${stats.daysWithIntro}`);
  console.log(`  Days with recap: ${stats.daysWithRecap}`);
  console.log(`  Days with both intro & recap: ${stats.daysWithBothTextTypes}`);
  console.log(`  Total readings: ${stats.totalReadings}`);

  // Write migrated data
  console.log('\nWriting migrated data...');
  fs.writeFileSync(PLANS_PATH, JSON.stringify(migrated, null, 2));

  console.log('\nMigration complete!');
  console.log(`Backup saved at: ${BACKUP_PATH}`);
}

// Run migration
main();
