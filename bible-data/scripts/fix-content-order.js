#!/usr/bin/env node

/**
 * Fix Bible Plan Content Order
 *
 * Reorders content arrays so that intro/recap items come before reading items.
 * The "Previously on..." recaps should appear before the Bible reading.
 *
 * Desired order:
 * 1. intro (if present)
 * 2. recap (if present)
 * 3. reading items
 */

const fs = require("fs");
const path = require("path");

const BIBLE_PLANS_PATH = path.join(__dirname, "../biblePlans.json");

function main() {
  console.log("Fixing Bible Plan Content Order");
  console.log("================================\n");

  // Load bible plans
  const data = JSON.parse(fs.readFileSync(BIBLE_PLANS_PATH, "utf-8"));
  const plans = data.biblePlans;

  let fixedCount = 0;
  let totalDays = 0;

  for (const plan of plans) {
    for (const day of plan.plan) {
      totalDays++;

      if (!day.content || day.content.length === 0) continue;

      // Check if reordering is needed
      // Find first reading index and last non-reading index
      let firstReadingIndex = -1;
      let hasNonReadingAfterReading = false;

      for (let i = 0; i < day.content.length; i++) {
        const item = day.content[i];
        if (item.type === "reading" && firstReadingIndex === -1) {
          firstReadingIndex = i;
        } else if (item.type !== "reading" && firstReadingIndex !== -1) {
          hasNonReadingAfterReading = true;
          break;
        }
      }

      // If non-reading content comes after reading, we need to reorder
      if (hasNonReadingAfterReading) {
        // Sort: intro first, then recap, then readings
        const typeOrder = { intro: 0, recap: 1, reading: 2 };

        day.content.sort((a, b) => {
          const orderA = typeOrder[a.type] ?? 99;
          const orderB = typeOrder[b.type] ?? 99;
          return orderA - orderB;
        });

        fixedCount++;
        console.log(`  Fixed: ${plan.id} Day ${day.day}`);
      }
    }
  }

  // Save
  fs.writeFileSync(BIBLE_PLANS_PATH, JSON.stringify(data, null, 2));

  console.log(`\n================================`);
  console.log(`Total days: ${totalDays}`);
  console.log(`Days reordered: ${fixedCount}`);
  console.log(`\nSaved to: ${BIBLE_PLANS_PATH}`);
}

main();
