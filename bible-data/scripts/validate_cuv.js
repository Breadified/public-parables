/**
 * CUV Bible Validation Script
 *
 * Validates the CUV (Chinese Union Version) Bible data for:
 * - Missing verses
 * - Verse numbering gaps
 * - Empty text content
 * - Structure issues
 *
 * NOTE: The CUV follows the Critical Text, which omits certain verses
 * found in the Textus Receptus/Majority Text. These are expected:
 * - Matthew 18:11, 23:14
 * - Mark 7:16, 15:28
 * - Luke 17:36, 23:17
 * - John 5:4
 * - Acts 8:37, 15:34, 24:7, 28:29
 */

const fs = require('fs');
const path = require('path');

// Book names for reporting
const BOOK_NAMES = [
  '', // 0 placeholder
  'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy',
  'Joshua', 'Judges', 'Ruth', '1 Samuel', '2 Samuel',
  '1 Kings', '2 Kings', '1 Chronicles', '2 Chronicles', 'Ezra',
  'Nehemiah', 'Esther', 'Job', 'Psalms', 'Proverbs',
  'Ecclesiastes', 'Song of Solomon', 'Isaiah', 'Jeremiah', 'Lamentations',
  'Ezekiel', 'Daniel', 'Hosea', 'Joel', 'Amos',
  'Obadiah', 'Jonah', 'Micah', 'Nahum', 'Habakkuk',
  'Zephaniah', 'Haggai', 'Zechariah', 'Malachi',
  'Matthew', 'Mark', 'Luke', 'John', 'Acts',
  'Romans', 'Corinthians1', '2 Corinthians', 'Galatians', 'Ephesians',
  'Philippians', 'Colossians', '1 Thessalonians', '2 Thessalonians', '1 Timothy',
  '2 Timothy', 'Titus', 'Philemon', 'Hebrews', 'James',
  '1 Peter', '2 Peter', '1 John', '2 John', '3 John',
  'Jude', 'Revelation'
];

// Expected verse counts per chapter (from standard Bible)
// Format: { bookId: [ch1_verses, ch2_verses, ...] }
const EXPECTED_VERSES = {
  // Romans (book 45)
  45: [32, 29, 31, 25, 21, 23, 25, 39, 33, 21, 36, 21, 14, 23, 33, 27]
};

function loadCUVData() {
  const filePath = path.join(__dirname, '..', 'data', 'CUV_bibleData.json');
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return data;
}

function extractAllVerseLines(chapter) {
  const lines = [];
  if (!chapter.sections) return lines;

  chapter.sections.forEach(section => {
    if (!section.paragraphs) return;
    section.paragraphs.forEach(para => {
      if (!para.verseLines) return;
      para.verseLines.forEach(line => {
        lines.push(line);
      });
    });
  });

  return lines;
}

function getVerseNumber(line) {
  if (line.verseNumber !== undefined) return line.verseNumber;
  if (line.verseId !== undefined) return line.verseId % 1000;
  // Extract from ID like "45003005_0"
  const match = line.id.match(/(\d+)_\d+$/);
  if (match) {
    return parseInt(match[1]) % 1000;
  }
  return null;
}

function validateChapter(book, chapter, chapterIndex) {
  const bookId = Math.floor(book.id / 1000000);
  const chapterNum = chapterIndex + 1;
  const issues = [];

  const lines = extractAllVerseLines(chapter);

  if (lines.length === 0) {
    issues.push({
      type: 'empty_chapter',
      book: book.name,
      bookEn: book.nameEn || BOOK_NAMES[bookId],
      chapter: chapterNum,
      message: 'Chapter has no verse lines'
    });
    return issues;
  }

  // Group lines by verse
  const verseMap = new Map();
  lines.forEach(line => {
    const verseNum = getVerseNumber(line);
    if (verseNum === null) {
      issues.push({
        type: 'invalid_verse_id',
        book: book.name,
        bookEn: book.nameEn || BOOK_NAMES[bookId],
        chapter: chapterNum,
        lineId: line.id,
        message: 'Could not extract verse number from line'
      });
      return;
    }

    if (!verseMap.has(verseNum)) {
      verseMap.set(verseNum, []);
    }
    verseMap.get(verseNum).push(line);
  });

  // Check for gaps in verse numbers
  const verses = Array.from(verseMap.keys()).sort((a, b) => a - b);
  const minVerse = Math.min(...verses);
  const maxVerse = Math.max(...verses);

  // Verses should start at 1
  if (minVerse !== 1) {
    issues.push({
      type: 'missing_first_verse',
      book: book.name,
      bookEn: book.nameEn || BOOK_NAMES[bookId],
      chapter: chapterNum,
      firstVerse: minVerse,
      message: `First verse is ${minVerse}, expected 1`
    });
  }

  // Check for gaps
  for (let v = 1; v <= maxVerse; v++) {
    if (!verseMap.has(v)) {
      issues.push({
        type: 'missing_verse',
        book: book.name,
        bookEn: book.nameEn || BOOK_NAMES[bookId],
        chapter: chapterNum,
        verse: v,
        message: `Missing verse ${v}`
      });
    }
  }

  // Check expected verse count if available
  if (EXPECTED_VERSES[bookId] && EXPECTED_VERSES[bookId][chapterIndex] !== undefined) {
    const expected = EXPECTED_VERSES[bookId][chapterIndex];
    if (maxVerse !== expected) {
      issues.push({
        type: 'verse_count_mismatch',
        book: book.name,
        bookEn: book.nameEn || BOOK_NAMES[bookId],
        chapter: chapterNum,
        expected: expected,
        found: maxVerse,
        message: `Expected ${expected} verses, found up to verse ${maxVerse}`
      });
    }
  }

  // Check for empty text
  lines.forEach(line => {
    if (!line.text || line.text.trim() === '') {
      issues.push({
        type: 'empty_text',
        book: book.name,
        bookEn: book.nameEn || BOOK_NAMES[bookId],
        chapter: chapterNum,
        lineId: line.id,
        message: 'Line has empty text'
      });
    }
  });

  return issues;
}

function validateBook(book) {
  const bookId = Math.floor(book.id / 1000000);
  const issues = [];

  if (!book.chapters || book.chapters.length === 0) {
    issues.push({
      type: 'no_chapters',
      book: book.name,
      bookEn: book.nameEn || BOOK_NAMES[bookId],
      message: 'Book has no chapters'
    });
    return issues;
  }

  book.chapters.forEach((chapter, index) => {
    const chapterIssues = validateChapter(book, chapter, index);
    issues.push(...chapterIssues);
  });

  return issues;
}

function validateCUV() {
  console.log('Loading CUV Bible data...');
  const data = loadCUVData();

  if (!data.books || data.books.length === 0) {
    console.error('ERROR: No books found in CUV data');
    return;
  }

  console.log(`Found ${data.books.length} books\n`);

  const allIssues = [];

  data.books.forEach(book => {
    const bookIssues = validateBook(book);
    allIssues.push(...bookIssues);
  });

  // Summary
  console.log('='.repeat(60));
  console.log('VALIDATION SUMMARY');
  console.log('='.repeat(60));

  if (allIssues.length === 0) {
    console.log('\n✅ No issues found! CUV data is valid.\n');
    return;
  }

  // Group by type
  const byType = {};
  allIssues.forEach(issue => {
    if (!byType[issue.type]) byType[issue.type] = [];
    byType[issue.type].push(issue);
  });

  console.log(`\n❌ Found ${allIssues.length} issues:\n`);

  Object.keys(byType).forEach(type => {
    console.log(`\n${type.toUpperCase()} (${byType[type].length} issues):`);
    console.log('-'.repeat(40));
    byType[type].forEach(issue => {
      const loc = `${issue.bookEn || issue.book} ${issue.chapter || ''}${issue.verse ? ':' + issue.verse : ''}`.trim();
      console.log(`  ${loc}: ${issue.message}`);
    });
  });

  // Detailed look at Romans 3
  console.log('\n' + '='.repeat(60));
  console.log('DETAILED: Romans Chapter 3');
  console.log('='.repeat(60));

  const romans = data.books.find(b => Math.floor(b.id / 1000000) === 45);
  if (romans && romans.chapters[2]) {
    const ch3 = romans.chapters[2];
    const lines = extractAllVerseLines(ch3);

    console.log(`\nTotal lines in Romans 3: ${lines.length}`);

    // Show all lines grouped by verse
    const verseMap = new Map();
    lines.forEach(line => {
      const v = getVerseNumber(line);
      if (!verseMap.has(v)) verseMap.set(v, []);
      verseMap.get(v).push(line);
    });

    const verses = Array.from(verseMap.keys()).sort((a, b) => a - b);
    console.log(`Verses present: ${verses.join(', ')}`);

    // Show verses 4-7 in detail
    console.log('\nVerses 4-7 detail:');
    [4, 5, 6, 7].forEach(v => {
      console.log(`\n  Verse ${v}:`);
      if (verseMap.has(v)) {
        verseMap.get(v).forEach(line => {
          console.log(`    [${line.id}] ${line.text}`);
        });
      } else {
        console.log('    ⚠️  MISSING!');
      }
    });
  }
}

// Run validation
validateCUV();
