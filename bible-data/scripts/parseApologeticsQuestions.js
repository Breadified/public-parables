/**
 * Parse Apologetics Questions from Markdown to JSON
 *
 * Reads: bible-data/source/100_questions_apologetics.md
 * Outputs: frontend/assets/data/apologeticsQuestions.json
 *
 * Features:
 * - Generates stable GUIDs for each question
 * - Extracts categories with question counts
 * - Smart interleaved ordering (cycles through categories for variety)
 * - Cycle starts Dec 1, 2025 for testing
 *
 * Usage: node bible-data/scripts/parseApologeticsQuestions.js
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Generate a deterministic UUID based on question text (for reproducibility)
function generateUUID(seed) {
  const hash = crypto.createHash('sha256').update(seed).digest('hex');
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    '4' + hash.slice(13, 16), // Version 4
    ((parseInt(hash.slice(16, 18), 16) & 0x3f) | 0x80).toString(16) + hash.slice(18, 20),
    hash.slice(20, 32)
  ].join('-');
}

// Deterministic seeded random number generator (Mulberry32)
function createSeededRandom(seed) {
  let state = seed;
  return function() {
    state |= 0;
    state = (state + 0x6D2B79F5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Deterministic shuffle using seeded random
function seededShuffle(array, seed) {
  const result = [...array];
  const random = createSeededRandom(seed);
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Generate a category ID from name
function generateCategoryId(name) {
  return 'cat-' + name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 30);
}

/**
 * Create interleaved ordering that cycles through categories
 * This ensures consecutive days have different topics
 *
 * Algorithm:
 * 1. Group questions by category
 * 2. Round-robin through categories, picking one question at a time
 * 3. For variety within category, pick questions in a shuffled order
 */
function createInterleavedOrdering(questions, categories) {
  // Group questions by category
  const categoryQueues = {};
  const categoryOrder = categories.map(c => c.id);

  // Initialize queues with shuffled questions per category
  for (const cat of categories) {
    const catQuestions = questions.filter(q => q.categoryId === cat.id);
    // Shuffle questions within each category using deterministic seed
    const seed = cat.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    categoryQueues[cat.id] = seededShuffle(catQuestions, seed);
  }

  // Round-robin through categories
  const orderedQuestions = [];
  let categoryIndex = 0;
  let emptyCategories = 0;

  while (emptyCategories < categories.length) {
    const catId = categoryOrder[categoryIndex];
    const queue = categoryQueues[catId];

    if (queue.length > 0) {
      orderedQuestions.push(queue.shift());
      emptyCategories = 0; // Reset counter when we find a question
    } else {
      emptyCategories++;
    }

    categoryIndex = (categoryIndex + 1) % categories.length;
  }

  // Assign orderIndex based on final position
  orderedQuestions.forEach((q, idx) => {
    q.orderIndex = idx;
  });

  return orderedQuestions;
}

// Parse the markdown file
function parseApologeticsMarkdown(content) {
  const lines = content.split('\n');
  const categories = [];
  const questions = [];

  let currentCategory = null;
  let currentCategoryId = null;
  let orderIndex = 0;

  for (const line of lines) {
    // Match category headers: ## Category N: Name (X Questions)
    const categoryMatch = line.match(/^## (?:Category \d+:|Bonus:)\s*(.+?)(?:\s*\((\d+)\s*Questions?\))?$/);
    if (categoryMatch) {
      const categoryName = categoryMatch[1].trim();
      currentCategoryId = generateCategoryId(categoryName);
      currentCategory = {
        id: currentCategoryId,
        name: categoryName,
        questionCount: 0
      };
      categories.push(currentCategory);
      continue;
    }

    // Match questions: N. Question text?
    const questionMatch = line.match(/^(\d+)\.\s+(.+)$/);
    if (questionMatch && currentCategory) {
      const questionNumber = parseInt(questionMatch[1], 10);
      const questionText = questionMatch[2].trim();

      // Generate deterministic UUID based on question number and text
      const questionId = generateUUID(`apologetics-q${questionNumber}-${questionText}`);

      questions.push({
        id: questionId,
        orderIndex: orderIndex,
        categoryId: currentCategoryId,
        categoryName: currentCategory.name,
        questionText: questionText,
        verseReferences: [] // To be populated with AI suggestions
      });

      currentCategory.questionCount++;
      orderIndex++;
    }
  }

  return { categories, questions };
}

// Main execution
function main() {
  const inputPath = path.join(__dirname, '../source/100_questions_apologetics.md');
  const outputPath = path.join(__dirname, '../../frontend/assets/data/apologeticsQuestions.json');

  // Ensure output directory exists
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Load existing JSON to preserve verse references
  let existingVerseRefs = {};
  if (fs.existsSync(outputPath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
      for (const q of existing.questions) {
        if (q.verseReferences && q.verseReferences.length > 0) {
          existingVerseRefs[q.id] = q.verseReferences;
        }
      }
      console.log(`📖 Loaded ${Object.keys(existingVerseRefs).length} existing verse references`);
    } catch (e) {
      console.log('⚠️ Could not load existing verse references');
    }
  }

  // Read and parse (questions without final ordering)
  const content = fs.readFileSync(inputPath, 'utf-8');
  const { categories, questions: rawQuestions } = parseApologeticsMarkdown(content);

  // Merge existing verse references
  for (const q of rawQuestions) {
    if (existingVerseRefs[q.id]) {
      q.verseReferences = existingVerseRefs[q.id];
    }
  }

  // Apply interleaved ordering for category variety
  const questions = createInterleavedOrdering(rawQuestions, categories);

  // Output
  const output = {
    metadata: {
      version: '1.1.0',
      generatedAt: new Date().toISOString(),
      totalQuestions: questions.length,
      totalCategories: categories.length,
      cycleStartDate: '2025-12-01', // Start Dec 1, 2025 for testing
      description: 'Daily apologetics questions with interleaved category ordering for variety'
    },
    categories,
    questions
  };

  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));

  console.log(`✅ Parsed ${questions.length} questions in ${categories.length} categories`);
  console.log(`📁 Output: ${outputPath}`);

  // Summary
  console.log('\nCategories:');
  categories.forEach((cat, i) => {
    console.log(`  ${i + 1}. ${cat.name} (${cat.questionCount} questions)`);
  });

  // Show first 14 days to verify interleaving
  console.log('\nFirst 14 days (Dec 1-14, 2025):');
  for (let i = 0; i < 14 && i < questions.length; i++) {
    const q = questions[i];
    const date = new Date(2025, 11, 1 + i); // Dec 1 + i
    const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    console.log(`  ${dateStr}: [${q.categoryName.slice(0, 25)}...] ${q.questionText.slice(0, 40)}...`);
  }
}

main();
