#!/usr/bin/env node

/**
 * Generate Bible Plan Recaps
 *
 * Generates dramatic recap sections for each day in biblePlans.json
 * using Claude Sonnet for narrative generation.
 *
 * Usage:
 *   node scripts/generate-plan-recaps.js [options]
 *
 * Options:
 *   --dry-run       Preview without saving
 *   --limit N       Process only N days total
 *   --plan PLAN_ID  Process specific plan only
 *   --reset         Clear progress, start fresh
 *   --verbose       Show prompts/responses
 *   --timeout N     Stop after N hours (e.g., --timeout 6)
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const { execSync } = require("child_process");

// Import sermon matching utilities from ai-kenny-shared
const kennyShared = require("../../scripts/ai-kenny-shared");

// Paths (relative to bible-data/scripts/)
const BIBLE_PLANS_PATH = path.join(__dirname, "../biblePlans.json");
const PROGRESS_PATH = path.join(__dirname, ".plan-recaps-progress.json");
const SERMON_DIR = kennyShared.SERMON_DIR;

// Parse CLI arguments
const args = process.argv.slice(2);
const options = {
  dryRun: args.includes("--dry-run"),
  verbose: args.includes("--verbose"),
  reset: args.includes("--reset"),
  limit: null,
  planId: null,
  timeoutHours: null,
};

// Parse --limit N
const limitIndex = args.indexOf("--limit");
if (limitIndex !== -1 && args[limitIndex + 1]) {
  options.limit = parseInt(args[limitIndex + 1], 10);
}

// Parse --plan PLAN_ID
const planIndex = args.indexOf("--plan");
if (planIndex !== -1 && args[planIndex + 1]) {
  options.planId = args[planIndex + 1];
}

// Parse --timeout N (hours)
const timeoutIndex = args.indexOf("--timeout");
if (timeoutIndex !== -1 && args[timeoutIndex + 1]) {
  options.timeoutHours = parseFloat(args[timeoutIndex + 1]);
}

// Track start time for timeout
const startTime = Date.now();

/**
 * Check if timeout has been exceeded
 */
function isTimeoutExceeded() {
  if (!options.timeoutHours) return false;
  const elapsedMs = Date.now() - startTime;
  const elapsedHours = elapsedMs / (1000 * 60 * 60);
  return elapsedHours >= options.timeoutHours;
}

/**
 * Get elapsed time string
 */
function getElapsedTime() {
  const elapsedMs = Date.now() - startTime;
  const hours = Math.floor(elapsedMs / (1000 * 60 * 60));
  const minutes = Math.floor((elapsedMs % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((elapsedMs % (1000 * 60)) / 1000);
  return `${hours}h ${minutes}m ${seconds}s`;
}

/**
 * Write file with retry logic (handles file lock issues)
 */
function writeFileWithRetry(filePath, content, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      fs.writeFileSync(filePath, content);
      return true;
    } catch (err) {
      if (attempt === maxRetries) {
        console.error(`    [File write failed after ${maxRetries} attempts: ${err.message}]`);
        return false;
      }
      console.log(`    [File locked, retrying in ${attempt}s...]`);
      // Synchronous sleep for retry
      const start = Date.now();
      while (Date.now() - start < attempt * 1000) {
        // busy wait
      }
    }
  }
  return false;
}

// Book context tracking for continuity
let bookContexts = {};

// Progress tracking
let progress = {
  completedDays: {}, // { "planId:dayNumber": true }
  bookContexts: {},  // Persisted book contexts
  lastUpdated: null,
};

/**
 * Load progress from disk
 */
function loadProgress() {
  if (options.reset) {
    console.log("Resetting progress...");
    return;
  }

  try {
    if (fs.existsSync(PROGRESS_PATH)) {
      const data = JSON.parse(fs.readFileSync(PROGRESS_PATH, "utf-8"));
      progress = data;
      bookContexts = data.bookContexts || {};
      console.log(`Loaded progress: ${Object.keys(progress.completedDays).length} days completed`);
    }
  } catch (err) {
    console.warn("Could not load progress:", err.message);
  }
}

/**
 * Save progress to disk
 */
function saveProgress() {
  if (options.dryRun) return;

  progress.bookContexts = bookContexts;
  progress.lastUpdated = new Date().toISOString();

  try {
    fs.writeFileSync(PROGRESS_PATH, JSON.stringify(progress, null, 2));
  } catch (err) {
    console.error("Failed to save progress:", err.message);
  }
}

/**
 * Extract book name from reference (e.g., "Genesis 1" -> "Genesis")
 */
function extractBookName(reference) {
  // Handle books with numbers like "1 Samuel", "2 Kings", "Song of Solomon"
  const match = reference.match(/^(\d?\s?[A-Za-z]+(?:\s+of\s+[A-Za-z]+)?)\s+\d/);
  if (match) {
    return match[1].trim();
  }
  // Fallback: everything before the last number sequence
  return reference.replace(/\s+\d+.*$/, "").trim();
}

/**
 * Extract chapter number from reference (e.g., "Genesis 1" -> 1)
 */
function extractChapter(reference) {
  const match = reference.match(/\s+(\d+)/);
  return match ? parseInt(match[1], 10) : 1;
}

/**
 * Build prompt for first chapter of a book (INTRO - slightly longer)
 */
function buildFirstChapterPrompt(bookName, chapter, reference, pastorContext) {
  const contextSection = pastorContext
    ? `\nPASTOR KENNY'S INSIGHTS (incorporate ONE key insight if relevant):\n${pastorContext}\n`
    : "";

  return `BOOK: ${bookName}
CHAPTER: ${chapter}
PASSAGE: ${reference}
${contextSection}
This is the FIRST CHAPTER of this book. Generate a brief INTRO (not recap) with:

1. ONE sentence: Who wrote this book and when
2. ONE sentence: What is this book about
3. 2-3 sentences: Dramatic teaser of this chapter's key moment (present tense, include ONE line of dialogue)

CRITICAL REQUIREMENTS:
- MAXIMUM 60-80 words total
- This is a TEASER, not a summary - capture the ESSENCE only
- Like a 30-second "Previously on..." NOT a plot summary
- ONE piece of dialogue max (e.g., God: "Let there be light.")
- Return ONLY the text, no headers/labels
${pastorContext ? "- Weave in ONE insight naturally, do NOT mention Pastor Kenny" : ""}

Example (Genesis 1, ~70 words):
"Moses penned this account during Israel's wilderness wandering. Genesis is the book of beginnings—creation, sin, redemption. Before anything existed, God spoke. 'Let there be light.' Darkness shatters. In six days, He separates sky from sea, fills earth with life, and crowns creation with humanity—made in His image, blessed to rule."`;
}

/**
 * Build prompt for continuing chapter (RECAP - very short)
 */
function buildContinuingChapterPrompt(bookName, chapter, reference, storyArc, lastRecap, pastorContext) {
  const contextSection = pastorContext
    ? `\nPASTOR KENNY'S INSIGHT (use ONE if relevant):\n${pastorContext}\n`
    : "";

  return `BOOK: ${bookName}
CHAPTER: ${chapter}
PASSAGE: ${reference}

STORY SO FAR: ${storyArc || "Beginning of the narrative."}
LAST CHAPTER: ${lastRecap || "This is early in the book."}
${contextSection}
Generate a BRIEF "Previously on..." style recap:

1. ONE sentence connecting to what just happened
2. 2-3 sentences: This chapter's KEY moment (present tense, ONE line of dialogue)

CRITICAL REQUIREMENTS:
- MAXIMUM 40-60 words total
- This is a 20-second TEASER, not a summary
- Capture the SINGLE most dramatic moment
- ONE piece of dialogue max
- Return ONLY the text, no headers/labels
${pastorContext ? "- Weave in ONE insight naturally, do NOT mention Pastor Kenny" : ""}

Example (Genesis 3, ~50 words):
"Previously: God breathes life into Adam, fashions Eve from his side—paradise begins. Now a serpent whispers to Eve: 'Did God really say...?' She reaches for the forbidden fruit. Their eyes open—but instead of godhood, they find shame. Footsteps echo. God is walking in the garden."`;
}

/**
 * Query Pastor Kenny's sermons for context on a passage using semantic search
 */
async function queryPastorKennyContext(reference, bookName) {
  try {
    if (options.verbose) {
      console.log(`    [Searching sermons for ${reference}...]`);
    }

    // Build a query combining the passage reference with typical themes
    const queryText = `Bible passage ${reference} from ${bookName}. Key themes and teaching points.`;

    // Use semantic search from ai-kenny-shared
    const result = await kennyShared.findSermonsBySemantic(queryText, 3);

    if (result.error || !result.matches?.length) {
      if (options.verbose) {
        console.log(`    [No sermon matches found]`);
      }
      return null;
    }

    // Filter for reasonable similarity (> 0.3)
    const relevantMatches = result.matches.filter(m => m.similarity > 0.3);

    if (!relevantMatches.length) {
      if (options.verbose) {
        console.log(`    [No high-similarity sermon matches]`);
      }
      return null;
    }

    // Extract relevant excerpts from top matches
    const excerpts = [];
    for (const match of relevantMatches.slice(0, 2)) {
      try {
        const content = fs.readFileSync(match.filepath, "utf-8");
        // Get first ~500 chars of sermon content (after headers)
        const lines = content.split("\n").filter(l => l.trim() && !l.startsWith("#"));
        const excerpt = lines.slice(0, 5).join(" ").substring(0, 500);
        if (excerpt.length > 100) {
          excerpts.push(`From "${match.title}": ${excerpt}...`);
        }
      } catch (e) {
        // Skip unreadable files
      }
    }

    if (!excerpts.length) {
      return null;
    }

    const contextText = excerpts.join("\n\n");

    if (options.verbose) {
      console.log(`    [Found ${relevantMatches.length} sermon(s): ${relevantMatches.map(m => m.title).join(", ")}]`);
    }

    return contextText;
  } catch (err) {
    if (options.verbose) {
      console.log(`    [Sermon search error: ${err.message}]`);
    }
    return null;
  }
}

/**
 * Clean response by removing AI preamble artifacts
 */
function cleanResponse(text) {
  let cleaned = text.trim();

  // Remove common AI preamble patterns
  const preamblePatterns = [
    /^I'll help you.*?\.\s*/i,
    /^Let me (create|generate|write).*?\.\s*/i,
    /^Here's a.*?:\s*/i,
    /^Here is.*?:\s*/i,
    /^Sure[,!].*?\.\s*/i,
  ];

  for (const pattern of preamblePatterns) {
    cleaned = cleaned.replace(pattern, "");
  }

  return cleaned.trim();
}

/**
 * Invoke Claude via Claude Code CLI
 */
function invokeClaudeSonnet(prompt) {
  if (options.verbose) {
    console.log("\n--- PROMPT ---");
    console.log(prompt);
    console.log("--- END PROMPT ---\n");
  }

  // Write prompt to temp file to avoid shell escaping issues
  const tempFile = path.join(os.tmpdir(), `recap-prompt-${Date.now()}.txt`);
  fs.writeFileSync(tempFile, prompt);

  try {
    // Use npx to run claude, pipe prompt from file
    const command = process.platform === "win32"
      ? `type "${tempFile}" | npx claude --model sonnet --print`
      : `cat "${tempFile}" | npx claude --model sonnet --print`;

    const result = execSync(command, {
      encoding: "utf-8",
      maxBuffer: 1024 * 1024 * 10,
      timeout: 120000, // 2 min per call
      shell: true,
    });

    const cleaned = cleanResponse(result);

    if (options.verbose) {
      console.log("\n--- RESPONSE ---");
      console.log(cleaned);
      console.log("--- END RESPONSE ---\n");
    }

    return cleaned;
  } finally {
    // Clean up temp file
    try {
      fs.unlinkSync(tempFile);
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}

/**
 * Generate recap with retry logic
 */
async function generateRecapWithRetry(prompt, maxRetries = 2) {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`  Retry attempt ${attempt}...`);
        // Exponential backoff: 2s, 4s
        await sleep(2000 * Math.pow(2, attempt - 1));
      }

      const result = invokeClaudeSonnet(prompt);

      // Validate result (shorter threshold for new brief recaps)
      if (!result || result.length < 30) {
        throw new Error("Response too short");
      }

      if (result.includes("```") || result.includes("function ")) {
        throw new Error("Response contains code artifacts");
      }

      return result;
    } catch (err) {
      lastError = err;
      console.error(`  Attempt ${attempt + 1} failed: ${err.message}`);
    }
  }

  throw lastError;
}

/**
 * Sleep utility
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate recap for a single reading
 */
async function generateReadingRecap(reading, context) {
  const { book, chapter, isFirstChapter, storyArc, lastRecap } = context;

  // Query Pastor Kenny's sermons for relevant context (async)
  const pastorContext = await queryPastorKennyContext(reading.reference, book);

  const prompt = isFirstChapter
    ? buildFirstChapterPrompt(book, chapter, reading.reference, pastorContext)
    : buildContinuingChapterPrompt(book, chapter, reading.reference, storyArc, lastRecap, pastorContext);

  const recap = await generateRecapWithRetry(prompt);

  // Extract a short summary for context tracking (first 2 sentences)
  const sentences = recap.split(/(?<=[.!?])\s+/);
  const shortSummary = sentences.slice(0, 2).join(" ");

  // Build updated story arc (keep last 3 chapter summaries to avoid context bloat)
  const newStoryArc = storyArc
    ? `${storyArc} Chapter ${chapter}: ${shortSummary}`
    : `Chapter ${chapter}: ${shortSummary}`;

  // Trim story arc if it gets too long (keep ~500 chars)
  const trimmedStoryArc = newStoryArc.length > 600
    ? "..." + newStoryArc.slice(-500)
    : newStoryArc;

  return {
    recap,
    chapterSummary: shortSummary,
    storyArc: trimmedStoryArc,
  };
}

/**
 * Combine multiple reading recaps into one day recap
 */
function combineRecaps(recaps) {
  if (recaps.length === 1) {
    return recaps[0];
  }

  // Join with paragraph break
  return recaps.join("\n\n---\n\n");
}

/**
 * Main processing function
 */
async function main() {
  console.log("Bible Plan Recap Generator");
  console.log("==========================");
  console.log(`Options: ${JSON.stringify(options)}\n`);

  // Load bible plans
  if (!fs.existsSync(BIBLE_PLANS_PATH)) {
    console.error(`Error: Bible plans not found at ${BIBLE_PLANS_PATH}`);
    process.exit(1);
  }

  const biblePlansData = JSON.parse(fs.readFileSync(BIBLE_PLANS_PATH, "utf-8"));
  const biblePlans = biblePlansData.biblePlans;

  console.log(`Found ${biblePlans.length} plans`);

  // Load progress
  loadProgress();

  // Filter plans if --plan specified
  const plansToProcess = options.planId
    ? biblePlans.filter(p => p.id === options.planId)
    : biblePlans;

  if (options.planId && plansToProcess.length === 0) {
    console.error(`Error: Plan '${options.planId}' not found`);
    process.exit(1);
  }

  console.log(`Processing ${plansToProcess.length} plan(s)`);

  // Count total days
  let totalDays = 0;
  for (const plan of plansToProcess) {
    totalDays += plan.plan.length;
  }
  console.log(`Total days: ${totalDays}`);

  if (options.limit) {
    console.log(`Limit: ${options.limit} days`);
  }

  if (options.timeoutHours) {
    console.log(`Timeout: ${options.timeoutHours} hours`);
  }

  if (options.dryRun) {
    console.log("\n*** DRY RUN MODE - No changes will be saved ***\n");
  }

  // Setup graceful shutdown
  let shuttingDown = false;
  process.on("SIGINT", () => {
    if (shuttingDown) {
      console.log("\nForce quit.");
      process.exit(1);
    }
    console.log("\n\nGraceful shutdown requested. Saving progress...");
    shuttingDown = true;
    saveProgress();
    if (!options.dryRun) {
      writeFileWithRetry(BIBLE_PLANS_PATH, JSON.stringify(biblePlansData, null, 2));
    }
    console.log("Progress saved. Exiting.");
    process.exit(0);
  });

  // Process plans
  let processedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const plan of plansToProcess) {
    console.log(`\n📖 Plan: ${plan.name}`);
    console.log(`   ID: ${plan.id}, Days: ${plan.plan.length}`);

    for (const day of plan.plan) {
      const dayKey = `${plan.id}:${day.day}`;

      // Check limit
      if (options.limit && processedCount >= options.limit) {
        console.log(`\nReached limit of ${options.limit} days. Stopping.`);
        break;
      }

      // Check timeout
      if (isTimeoutExceeded()) {
        console.log(`\nTimeout reached (${options.timeoutHours} hours, elapsed: ${getElapsedTime()}). Stopping.`);
        break;
      }

      // Skip if already processed
      if (progress.completedDays[dayKey]) {
        skippedCount++;
        continue;
      }

      // Extract readings from content array (content uses type: "reading")
      const readings = day.content.filter(c => c.type === "reading");
      if (readings.length === 0) {
        console.log(`\n  Day ${day.day}: No readings found, skipping`);
        continue;
      }

      console.log(`\n  Day ${day.day}: ${readings.map(r => r.reference).join(", ")}`);

      const recaps = [];

      try {
        for (const reading of readings) {
          const bookName = extractBookName(reading.reference);
          const chapter = extractChapter(reading.reference);

          // Determine if this is first chapter we're seeing for this book
          const isFirstChapter = chapter === 1 || !bookContexts[bookName];

          console.log(`    Processing: ${reading.reference} (${isFirstChapter ? "first chapter" : "continuing"})`);

          const context = {
            book: bookName,
            chapter,
            isFirstChapter,
            storyArc: bookContexts[bookName]?.storyArcSoFar || "",
            lastRecap: bookContexts[bookName]?.lastChapterSummary || "",
          };

          const result = await generateReadingRecap(reading, context);
          recaps.push(result.recap);

          // Update book context
          bookContexts[bookName] = {
            storyArcSoFar: result.storyArc,
            lastChapterSummary: result.chapterSummary,
            lastChapter: chapter,
          };

          // Rate limiting delay
          await sleep(1500);
        }

        // Combine recaps and update the content array
        const combinedRecap = combineRecaps(recaps);

        if (!options.dryRun) {
          // Find existing intro/recap in content array
          const existingIndex = day.content.findIndex(c => c.type === 'intro' || c.type === 'recap');

          if (existingIndex >= 0) {
            // Update existing intro/recap text
            day.content[existingIndex].text = combinedRecap;
          } else {
            // Add new recap at the beginning (before readings)
            day.content.unshift({
              type: day.day === 1 ? 'intro' : 'recap',
              text: combinedRecap,
            });
          }
        }

        // Preview in dry-run mode
        if (options.dryRun || options.verbose) {
          console.log(`\n    --- RECAP PREVIEW ---`);
          console.log(`    ${combinedRecap.substring(0, 200)}...`);
          console.log(`    --- END PREVIEW ---\n`);
        }

        // Mark as completed
        progress.completedDays[dayKey] = true;
        processedCount++;

        // Save progress after every day
        saveProgress();
        if (!options.dryRun) {
          writeFileWithRetry(BIBLE_PLANS_PATH, JSON.stringify(biblePlansData, null, 2));
        }

        // Log progress every 5 days
        if (processedCount % 5 === 0) {
          console.log(`    [Progress: ${processedCount} days processed, elapsed: ${getElapsedTime()}]`);
        }

      } catch (err) {
        console.error(`    ERROR: ${err.message}`);
        errorCount++;

        // Save progress on error
        saveProgress();
        if (!options.dryRun) {
          writeFileWithRetry(BIBLE_PLANS_PATH, JSON.stringify(biblePlansData, null, 2));
        }
      }
    }

    // Check limit after each plan
    if (options.limit && processedCount >= options.limit) {
      break;
    }

    // Check timeout after each plan
    if (isTimeoutExceeded()) {
      console.log(`\nTimeout reached (${options.timeoutHours} hours, elapsed: ${getElapsedTime()}). Stopping.`);
      break;
    }
  }

  // Final save
  saveProgress();
  if (!options.dryRun) {
    writeFileWithRetry(BIBLE_PLANS_PATH, JSON.stringify(biblePlansData, null, 2));
  }

  // Summary
  console.log("\n==========================");
  console.log("SUMMARY");
  console.log("==========================");
  console.log(`Elapsed time: ${getElapsedTime()}`);
  console.log(`Processed: ${processedCount} days`);
  console.log(`Skipped (already done): ${skippedCount} days`);
  console.log(`Errors: ${errorCount}`);
  console.log(`Total completed: ${Object.keys(progress.completedDays).length} days`);

  if (options.dryRun) {
    console.log("\n*** DRY RUN - No changes were saved ***");
  } else {
    console.log(`\nRecaps saved to: ${BIBLE_PLANS_PATH}`);
    console.log(`Progress saved to: ${PROGRESS_PATH}`);
  }
}

// Run
main().catch(err => {
  console.error("Fatal error:", err);
  saveProgress();
  process.exit(1);
});
