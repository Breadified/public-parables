#!/usr/bin/env node
/**
 * Generate Pastor Kenny Sermon Embeddings using Local Model
 *
 * This script:
 * 1. Reads all sermon markdown files from pastor-kenny-sermons/
 * 2. Uses the actual sermon content directly for semantic embedding
 * 3. Generates vector embeddings using local all-MiniLM-L6-v2 model
 * 4. Stores embeddings in sermon-embeddings.json for fast semantic search
 *
 * The model naturally understands semantic meaning from the content itself.
 * No hardcoded categories needed - the embedding captures theological concepts,
 * themes, and nuances directly from Pastor Kenny's actual words.
 *
 * Usage:
 *   node .reference/generate-sermon-embeddings.js [options]
 *   node .reference/generate-sermon-embeddings.js --reset     # Reset and regenerate all
 *   node .reference/generate-sermon-embeddings.js --dry-run   # Preview without generating
 *
 * Requirements:
 *   - @xenova/transformers package installed (npm install @xenova/transformers)
 */

const fs = require('fs');
const path = require('path');

// Configuration
const SERMON_DIR = path.join(__dirname, 'pastor-kenny-sermons');
const EMBEDDINGS_FILE = path.join(__dirname, 'sermon-embeddings.json');
const PROGRESS_FILE = path.join(__dirname, '.sermon-embedding-progress.json');
const EMBEDDING_DIM = 384; // all-MiniLM-L6-v2 dimensions
const MAX_EMBEDDING_CHARS = 8000; // Model handles ~512 tokens well, ~8k chars is safe

// Bible book names for reference formatting
const BOOK_NAMES = {
  1: 'Genesis', 2: 'Exodus', 3: 'Leviticus', 4: 'Numbers', 5: 'Deuteronomy',
  6: 'Joshua', 7: 'Judges', 8: 'Ruth', 9: '1 Samuel', 10: '2 Samuel',
  11: '1 Kings', 12: '2 Kings', 13: '1 Chronicles', 14: '2 Chronicles', 15: 'Ezra',
  16: 'Nehemiah', 17: 'Esther', 18: 'Job', 19: 'Psalms', 20: 'Proverbs',
  21: 'Ecclesiastes', 22: 'Song of Solomon', 23: 'Isaiah', 24: 'Jeremiah', 25: 'Lamentations',
  26: 'Ezekiel', 27: 'Daniel', 28: 'Hosea', 29: 'Joel', 30: 'Amos',
  31: 'Obadiah', 32: 'Jonah', 33: 'Micah', 34: 'Nahum', 35: 'Habakkuk',
  36: 'Zephaniah', 37: 'Haggai', 38: 'Zechariah', 39: 'Malachi',
  40: 'Matthew', 41: 'Mark', 42: 'Luke', 43: 'John', 44: 'Acts',
  45: 'Romans', 46: '1 Corinthians', 47: '2 Corinthians', 48: 'Galatians', 49: 'Ephesians',
  50: 'Philippians', 51: 'Colossians', 52: '1 Thessalonians', 53: '2 Thessalonians',
  54: '1 Timothy', 55: '2 Timothy', 56: 'Titus', 57: 'Philemon', 58: 'Hebrews',
  59: 'James', 60: '1 Peter', 61: '2 Peter', 62: '1 John', 63: '2 John',
  64: '3 John', 65: 'Jude', 66: 'Revelation'
};

/**
 * Convert verse ID to human-readable reference
 */
function verseIdToReference(verseId) {
  const bookId = Math.floor(verseId / 1000000);
  const chapter = Math.floor((verseId % 1000000) / 1000);
  const verse = verseId % 1000;
  const bookName = BOOK_NAMES[bookId] || `Book ${bookId}`;
  return `${bookName} ${chapter}:${verse}`;
}

/**
 * Parse sermon filename to extract metadata
 */
function parseSermonFilename(filename) {
  const match = filename.match(/^(\w+)_(\d+)_(\d+)(?:\+\d+_\d+)?_(.+)\.md$/);
  if (!match) {
    const simpleMatch = filename.match(/^(\w+)_(\d+)_(.+)\.md$/);
    if (simpleMatch) {
      const [, date, verseId, title] = simpleMatch;
      return {
        date,
        startVerseId: parseInt(verseId, 10),
        endVerseId: parseInt(verseId, 10) + 999,
        title: title.replace(/_/g, ' ')
      };
    }
    return null;
  }

  const [, date, startId, endId, title] = match;
  return {
    date,
    startVerseId: parseInt(startId, 10),
    endVerseId: parseInt(endId, 10),
    title: title.replace(/_/g, ' ')
  };
}

/**
 * Clean sermon content for embedding
 * Removes markdown artifacts but preserves the actual teaching content
 */
function cleanContentForEmbedding(content) {
  return content
    // Remove markdown links but keep text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove bold/italic markers but keep text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    // Remove bullet points but keep content
    .replace(/^[-*]\s+/gm, '')
    // Remove multiple newlines
    .replace(/\n{3,}/g, '\n\n')
    // Remove excessive spaces
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Extract section headers from content (they reveal sermon structure)
 */
function extractHeaders(content) {
  const headers = [];
  const headerMatches = content.matchAll(/^##\s+(.+)$/gm);
  for (const match of headerMatches) {
    // Clean the header text
    const header = match[1]
      .replace(/\*\*/g, '')
      .replace(/\*([^*]+)\*/g, '$1')
      .trim();
    if (header.length > 2 && header.length < 100) {
      headers.push(header);
    }
  }
  return headers;
}

/**
 * Extract rich content from sermon for embedding
 * Uses the actual sermon content - the embedding model understands meaning naturally
 */
function extractSermonContent(filepath, metadata) {
  const rawContent = fs.readFileSync(filepath, 'utf-8');

  // Get title from metadata or first heading
  const titleMatch = rawContent.match(/^#\s+(.+)$/m) || rawContent.match(/\*\*Title:\*\*\s*(.+)$/m);
  const title = titleMatch ? titleMatch[1].replace(/\*\*/g, '') : metadata.title;

  // Extract section headers (they reveal sermon structure and themes)
  const headers = extractHeaders(rawContent);

  // Get passage reference
  const passageRef = `${verseIdToReference(metadata.startVerseId)} to ${verseIdToReference(metadata.endVerseId)}`;

  // Clean the content for embedding
  const cleanedContent = cleanContentForEmbedding(rawContent);

  // Build embedding text with actual sermon content
  // The model will naturally understand theological concepts from the content
  let embeddingParts = [
    `Sermon: "${title}"`,
    `Scripture: ${passageRef}`,
  ];

  // Add headers if present (they capture the sermon's main points)
  if (headers.length > 0) {
    embeddingParts.push(`Main Points: ${headers.slice(0, 10).join('. ')}`);
  }

  // Add the actual sermon content
  embeddingParts.push('');
  embeddingParts.push('Sermon Content:');

  // Calculate remaining space for content
  const headerSize = embeddingParts.join('\n').length;
  const contentBudget = MAX_EMBEDDING_CHARS - headerSize - 100;

  // Use as much actual content as we can fit
  // The model understands context, so more real content = better semantic matching
  if (cleanedContent.length <= contentBudget) {
    embeddingParts.push(cleanedContent);
  } else {
    // Take content from multiple parts of the sermon for better coverage
    const thirdSize = Math.floor(contentBudget / 3);
    const start = cleanedContent.slice(0, thirdSize);
    const middle = cleanedContent.slice(
      Math.floor(cleanedContent.length / 2) - thirdSize / 2,
      Math.floor(cleanedContent.length / 2) + thirdSize / 2
    );
    const end = cleanedContent.slice(-thirdSize);
    embeddingParts.push(start + '\n[...]\n' + middle + '\n[...]\n' + end);
  }

  const embeddingText = embeddingParts.join('\n');

  return {
    title,
    headers,
    embeddingText,
    contentLength: rawContent.length
  };
}

// =============================================================================
// PROGRESS TRACKING
// =============================================================================

function loadProgress() {
  if (fs.existsSync(PROGRESS_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
    } catch {
      return { embedded: [], failed: [], lastRun: null };
    }
  }
  return { embedded: [], failed: [], lastRun: null };
}

function saveProgress(progress) {
  progress.lastRun = new Date().toISOString();
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

function resetProgress() {
  if (fs.existsSync(PROGRESS_FILE)) {
    fs.unlinkSync(PROGRESS_FILE);
  }
  if (fs.existsSync(EMBEDDINGS_FILE)) {
    fs.unlinkSync(EMBEDDINGS_FILE);
  }
  console.log('Progress and embeddings reset. Starting fresh.');
}

// =============================================================================
// EMBEDDING GENERATION
// =============================================================================

let embeddingPipeline = null;

async function initEmbeddingModel() {
  if (embeddingPipeline) return embeddingPipeline;

  console.log('Loading embedding model (all-MiniLM-L6-v2)...');
  console.log('First run will download the model (~22MB)...');

  try {
    const { pipeline } = await import('@xenova/transformers');
    embeddingPipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    console.log('Embedding model loaded successfully!');
    return embeddingPipeline;
  } catch (error) {
    console.error('Failed to load embedding model:', error.message);
    console.error('Make sure @xenova/transformers is installed: npm install @xenova/transformers');
    throw error;
  }
}

async function generateEmbedding(text) {
  const extractor = await initEmbeddingModel();
  const output = await extractor(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data);
}

// =============================================================================
// MAIN
// =============================================================================

function parseArgs() {
  const args = {
    dryRun: false,
    reset: false,
    batchSize: 100
  };

  process.argv.slice(2).forEach(arg => {
    if (arg === '--dry-run') args.dryRun = true;
    if (arg === '--reset') args.reset = true;
    if (arg.startsWith('--batch-size=')) {
      args.batchSize = parseInt(arg.split('=')[1], 10);
    }
  });

  return args;
}

async function main() {
  const args = parseArgs();

  if (args.reset) {
    resetProgress();
  }

  // Load existing embeddings or start fresh
  let embeddings = {};
  if (fs.existsSync(EMBEDDINGS_FILE)) {
    try {
      embeddings = JSON.parse(fs.readFileSync(EMBEDDINGS_FILE, 'utf-8'));
    } catch {
      embeddings = {};
    }
  }

  // Get all sermon files
  const sermonFiles = fs.readdirSync(SERMON_DIR)
    .filter(f => f.endsWith('.md') && !f.startsWith('.'));

  console.log(`\n========================================`);
  console.log(`SERMON EMBEDDING GENERATOR`);
  console.log(`========================================`);
  console.log(`Using actual sermon content for embedding`);
  console.log(`Model naturally captures semantic meaning`);
  console.log(`========================================`);
  console.log(`Total sermon files:  ${sermonFiles.length}`);
  console.log(`Already embedded:    ${Object.keys(embeddings).length}`);

  // Find sermons that need embedding
  const pendingSermons = sermonFiles.filter(f => !embeddings[f]);
  console.log(`Pending:             ${pendingSermons.length}`);
  console.log(`========================================\n`);

  if (pendingSermons.length === 0) {
    console.log('All sermons have been embedded!');
    console.log(`Embeddings file: ${EMBEDDINGS_FILE}`);
    return;
  }

  if (args.dryRun) {
    console.log('DRY RUN - no changes will be made');
    console.log('\nSample extraction:');
    const sampleFile = pendingSermons[0];
    const filepath = path.join(SERMON_DIR, sampleFile);
    const metadata = parseSermonFilename(sampleFile);
    if (metadata) {
      const content = extractSermonContent(filepath, metadata);
      console.log(`\nTitle: ${content.title}`);
      console.log(`Content Length: ${content.contentLength} chars`);
      console.log(`Headers: ${content.headers.slice(0, 5).join(', ')}`);
      console.log(`\nEmbedding text preview (first 1000 chars):`);
      console.log(content.embeddingText.slice(0, 1000));
      console.log('...');
    }
    return;
  }

  // Pre-load embedding model
  await initEmbeddingModel();

  const sermonsToProcess = pendingSermons.slice(0, args.batchSize);
  let embedded = 0;
  let failed = 0;

  for (let i = 0; i < sermonsToProcess.length; i++) {
    const filename = sermonsToProcess[i];
    const filepath = path.join(SERMON_DIR, filename);
    const metadata = parseSermonFilename(filename);

    if (!metadata) {
      console.log(`[${i + 1}/${sermonsToProcess.length}] Skipping (invalid filename): ${filename}`);
      failed++;
      continue;
    }

    console.log(`[${i + 1}/${sermonsToProcess.length}] ${metadata.title}`);

    try {
      const content = extractSermonContent(filepath, metadata);
      const embedding = await generateEmbedding(content.embeddingText);

      embeddings[filename] = {
        filename,
        title: content.title,
        date: metadata.date,
        startVerseId: metadata.startVerseId,
        endVerseId: metadata.endVerseId,
        headers: content.headers.slice(0, 10), // Store section headers for reference
        contentLength: content.contentLength,
        embedding
      };

      embedded++;
      const previewHeaders = content.headers.slice(0, 3).join(', ') || 'No headers';
      console.log(`   ${content.contentLength} chars | ${previewHeaders}`);

      // Save periodically
      if (embedded % 20 === 0) {
        fs.writeFileSync(EMBEDDINGS_FILE, JSON.stringify(embeddings, null, 2));
        console.log(`   [Saved ${Object.keys(embeddings).length} embeddings]`);
      }
    } catch (error) {
      console.log(`   ERROR: ${error.message}`);
      failed++;
    }
  }

  // Final save
  fs.writeFileSync(EMBEDDINGS_FILE, JSON.stringify(embeddings, null, 2));

  console.log(`\n========================================`);
  console.log(`COMPLETE`);
  console.log(`========================================`);
  console.log(`This session:  ${embedded} embedded, ${failed} failed`);
  console.log(`Total:         ${Object.keys(embeddings).length} embeddings`);
  console.log(`Output:        ${EMBEDDINGS_FILE}`);
  console.log(`========================================\n`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
