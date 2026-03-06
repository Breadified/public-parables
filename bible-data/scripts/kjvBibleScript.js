const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");
const { createTempDir, unzipToTemp, cleanupTemp } = require("./unzipUtils");

// Path to input zip and output files
const inputZip = path.join(__dirname, "..", "source", "eng-kjv_html.zip");
const outputFilePath = path.join(
  __dirname,
  "..",
  "data",
  "KJV_bibleData.json",
);

// Book mapping with file prefixes and IDs (same as ESV/WEB for compatibility)
const BOOK_MAP = {
  // Old Testament
  GEN: { name: "Genesis", id: 1000000, testament: "Old" },
  EXO: { name: "Exodus", id: 2000000, testament: "Old" },
  LEV: { name: "Leviticus", id: 3000000, testament: "Old" },
  NUM: { name: "Numbers", id: 4000000, testament: "Old" },
  DEU: { name: "Deuteronomy", id: 5000000, testament: "Old" },
  JOS: { name: "Joshua", id: 6000000, testament: "Old" },
  JDG: { name: "Judges", id: 7000000, testament: "Old" },
  RUT: { name: "Ruth", id: 8000000, testament: "Old" },
  "1SA": { name: "1 Samuel", id: 9000000, testament: "Old" },
  "2SA": { name: "2 Samuel", id: 10000000, testament: "Old" },
  "1KI": { name: "1 Kings", id: 11000000, testament: "Old" },
  "2KI": { name: "2 Kings", id: 12000000, testament: "Old" },
  "1CH": { name: "1 Chronicles", id: 13000000, testament: "Old" },
  "2CH": { name: "2 Chronicles", id: 14000000, testament: "Old" },
  EZR: { name: "Ezra", id: 15000000, testament: "Old" },
  NEH: { name: "Nehemiah", id: 16000000, testament: "Old" },
  EST: { name: "Esther", id: 17000000, testament: "Old" },
  JOB: { name: "Job", id: 18000000, testament: "Old" },
  PSA: { name: "Psalms", id: 19000000, testament: "Old" },
  PRO: { name: "Proverbs", id: 20000000, testament: "Old" },
  ECC: { name: "Ecclesiastes", id: 21000000, testament: "Old" },
  SNG: { name: "Song of Solomon", id: 22000000, testament: "Old" },
  ISA: { name: "Isaiah", id: 23000000, testament: "Old" },
  JER: { name: "Jeremiah", id: 24000000, testament: "Old" },
  LAM: { name: "Lamentations", id: 25000000, testament: "Old" },
  EZK: { name: "Ezekiel", id: 26000000, testament: "Old" },
  DAN: { name: "Daniel", id: 27000000, testament: "Old" },
  HOS: { name: "Hosea", id: 28000000, testament: "Old" },
  JOL: { name: "Joel", id: 29000000, testament: "Old" },
  AMO: { name: "Amos", id: 30000000, testament: "Old" },
  OBA: { name: "Obadiah", id: 31000000, testament: "Old" },
  JON: { name: "Jonah", id: 32000000, testament: "Old" },
  MIC: { name: "Micah", id: 33000000, testament: "Old" },
  NAM: { name: "Nahum", id: 34000000, testament: "Old" },
  HAB: { name: "Habakkuk", id: 35000000, testament: "Old" },
  ZEP: { name: "Zephaniah", id: 36000000, testament: "Old" },
  HAG: { name: "Haggai", id: 37000000, testament: "Old" },
  ZEC: { name: "Zechariah", id: 38000000, testament: "Old" },
  MAL: { name: "Malachi", id: 39000000, testament: "Old" },
  // New Testament
  MAT: { name: "Matthew", id: 40000000, testament: "New" },
  MRK: { name: "Mark", id: 41000000, testament: "New" },
  LUK: { name: "Luke", id: 42000000, testament: "New" },
  JHN: { name: "John", id: 43000000, testament: "New" },
  ACT: { name: "Acts", id: 44000000, testament: "New" },
  ROM: { name: "Romans", id: 45000000, testament: "New" },
  "1CO": { name: "1 Corinthians", id: 46000000, testament: "New" },
  "2CO": { name: "2 Corinthians", id: 47000000, testament: "New" },
  GAL: { name: "Galatians", id: 48000000, testament: "New" },
  EPH: { name: "Ephesians", id: 49000000, testament: "New" },
  PHP: { name: "Philippians", id: 50000000, testament: "New" },
  COL: { name: "Colossians", id: 51000000, testament: "New" },
  "1TH": { name: "1 Thessalonians", id: 52000000, testament: "New" },
  "2TH": { name: "2 Thessalonians", id: 53000000, testament: "New" },
  "1TI": { name: "1 Timothy", id: 54000000, testament: "New" },
  "2TI": { name: "2 Timothy", id: 55000000, testament: "New" },
  TIT: { name: "Titus", id: 56000000, testament: "New" },
  PHM: { name: "Philemon", id: 57000000, testament: "New" },
  HEB: { name: "Hebrews", id: 58000000, testament: "New" },
  JAS: { name: "James", id: 59000000, testament: "New" },
  "1PE": { name: "1 Peter", id: 60000000, testament: "New" },
  "2PE": { name: "2 Peter", id: 61000000, testament: "New" },
  "1JN": { name: "1 John", id: 62000000, testament: "New" },
  "2JN": { name: "2 John", id: 63000000, testament: "New" },
  "3JN": { name: "3 John", id: 64000000, testament: "New" },
  JUD: { name: "Jude", id: 65000000, testament: "New" },
  REV: { name: "Revelation", id: 66000000, testament: "New" },
};

// Extract book code and chapter number from filename
function parseFilename(filename) {
  // Examples: GEN01.htm, PSA023.htm, JHN.htm (single chapter books)
  const match = filename.match(/^([A-Z0-9]{3})(\d{2,3})?\.htm$/);
  if (!match) return null;

  const bookCode = match[1];
  const chapterNum = match[2] ? parseInt(match[2], 10) : 1;

  if (!BOOK_MAP[bookCode]) return null;

  // Skip chapter 0 (invalid placeholder files like PSA000.htm)
  if (chapterNum === 0) return null;

  return {
    bookCode,
    chapterNumber: chapterNum,
    bookInfo: BOOK_MAP[bookCode],
  };
}

function processHtmlFile(filePath, bookId, chapterNumber) {
  const html = fs.readFileSync(filePath, "utf8");
  const $ = cheerio.load(html);

  const chapterId = bookId + chapterNumber * 1000;

  // Initialize chapter structure
  const chapter = {
    id: chapterId,
    chapterNumber: chapterNumber,
    bookId: bookId,
    version: "KJV",
    sections: [],
  };

  // Track verse occurrence counts across all paragraphs in the chapter
  const verseOccurrenceCounts = new Map();
  let currentSection = null;
  let sectionCounter = 1;
  let paragraphCounter = 1;
  let currentVerseId = chapterId + 1; // Track current verse across paragraphs

  // Process all elements in order within .main div
  $(".main")
    .children()
    .each((i, elem) => {
      const $elem = $(elem);
      const tagName = elem.tagName.toLowerCase();

      // Psalm titles (d class)
      if ($elem.hasClass("d")) {
        const subtitle = $elem.text().trim();
        if (subtitle) {
          // Create default section if none exists
          if (!currentSection) {
            currentSection = {
              id: chapterId + sectionCounter++,
              chapterId: chapterId,
              title: null,
              paragraphs: [],
            };
            chapter.sections.push(currentSection);
          }
          currentSection.subtitle = subtitle;
        }
        return;
      }

      // Paragraph elements (p, q classes)
      // KJV uses .q for each poetry line (no q2/q3/q4 variants)
      if (
        tagName === "div" &&
        ($elem.hasClass("p") || $elem.hasClass("q"))
      ) {
        // Create default section if none exists
        if (!currentSection) {
          currentSection = {
            id: chapterId + sectionCounter++,
            chapterId: chapterId,
            title: null,
            paragraphs: [],
          };
          chapter.sections.push(currentSection);
        }

        const paragraphId = chapterId + paragraphCounter++;
        const paragraph = {
          id: paragraphId,
          sectionId: currentSection.id,
          verseLines: [],
        };
        currentSection.paragraphs.push(paragraph);

        // Poetry has indent level of 2 (base for poetry)
        const isPoetry = $elem.hasClass("q");
        const indentLevel = isPoetry ? 2 : 0;

        // Get the HTML content
        const html = $elem.html();

        // Split by verse markers
        const verses = [];
        let currentVerse = null;
        let currentText = "";

        // Parse HTML to find verse markers
        const $content = $(`<div>${html}</div>`);

        $content.contents().each((j, node) => {
          if (node.type === "tag" && $(node).hasClass("verse")) {
            // Save previous verse if exists
            if (currentVerse !== null && currentText.trim()) {
              verses.push({
                verseId: currentVerse,
                text: currentText.trim(),
              });
            }

            // Extract verse number from ID (e.g., "V23" -> 23)
            const verseId = $(node).attr("id");
            const verseMatch = verseId ? verseId.match(/V(\d+)/) : null;
            currentVerse = verseMatch
              ? chapterId + parseInt(verseMatch[1], 10)
              : null;

            // Update chapter-level tracker when we find a verse marker
            if (currentVerse !== null) {
              currentVerseId = currentVerse;
            }

            currentText = "";
          } else {
            // Accumulate text (skip footnote links, clean markup)
            if (node.type === "text") {
              currentText += $(node).text();
            } else if (
              node.type === "tag" &&
              !$(node).hasClass("notemark") &&
              !$(node).hasClass("popup")
            ) {
              // Include text from <span class='add'> and <span class='nd'> but not the tags
              currentText += $(node).text();
            }
          }
        });

        // Save last verse
        if (currentVerse !== null && currentText.trim()) {
          verses.push({
            verseId: currentVerse,
            text: currentText.trim(),
          });
        }

        // If no verses found but there's text, it's continuation from previous paragraph
        if (verses.length === 0 && $elem.text().trim()) {
          const text = $elem.text().trim();
          // Use chapter-level currentVerseId instead of looking back at previous paragraph
          verses.push({
            verseId: currentVerseId,
            text: text,
          });
        }

        // Create verse lines
        verses.forEach((verse) => {
          const verseNumber = verse.verseId % 1000;

          // Get current count for this verse ID and increment
          const currentCount = verseOccurrenceCounts.get(verse.verseId) || 0;
          const lineSuffix = `_${currentCount}`;
          verseOccurrenceCounts.set(verse.verseId, currentCount + 1);

          const isFirstOccurrence = currentCount === 0;

          // Clean text (remove multiple spaces, non-breaking spaces)
          let text = verse.text
            .replace(/\u00A0/g, " ")
            .replace(/\s+/g, " ")
            .trim();

          // Remove verse number from start if present
          const verseNumPattern = new RegExp(`^${verseNumber}\\s+`);
          text = text.replace(verseNumPattern, "");

          if (text) {
            paragraph.verseLines.push({
              id: `${verse.verseId}${lineSuffix}`,
              text: text,
              isIsolated: isPoetry,
              indentLevel: indentLevel,
              paragraphId: paragraph.id,
              verseId: verse.verseId,
              verseNumber: isFirstOccurrence ? verseNumber : undefined,
            });
          }
        });
      }
    });

  // Clean up sections: remove subtitle property if undefined
  chapter.sections.forEach((section) => {
    if (section.subtitle === undefined) {
      delete section.subtitle;
    }
  });

  return chapter;
}

async function main() {
  let tempDir = null;

  try {
    console.log("Starting KJV Bible data extraction...");

    // Create temp directory and unzip
    tempDir = createTempDir();
    const inputDir = unzipToTemp(inputZip, tempDir);

    // Initialize output structure
    let outputData = { books: [] };

    // Check if output file exists and read it
    if (fs.existsSync(outputFilePath)) {
      console.log("Output file exists, reading existing data...");
      outputData = JSON.parse(fs.readFileSync(outputFilePath, "utf8"));
    }

    // Get all HTML files
    const files = fs
      .readdirSync(inputDir)
      .filter((f) => f.endsWith(".htm") && parseFilename(f))
      .sort();

    console.log(`Found ${files.length} chapter files to process`);

    let processedCount = 0;

    for (const filename of files) {
      const parsed = parseFilename(filename);
      if (!parsed) continue;

      const { bookCode, chapterNumber, bookInfo } = parsed;
      const filePath = path.join(inputDir, filename);

      console.log(
        `Processing ${bookInfo.name} ${chapterNumber} (${filename})...`,
      );

      try {
        const chapterData = processHtmlFile(
          filePath,
          bookInfo.id,
          chapterNumber,
        );

        // Find or create book
        let book = outputData.books.find((b) => b.id === bookInfo.id);
        if (!book) {
          book = {
            id: bookInfo.id,
            name: bookInfo.name,
            testament: bookInfo.testament,
            chapters: [],
          };
          outputData.books.push(book);
        }

        // Add or update chapter
        const existingChapterIndex = book.chapters.findIndex(
          (c) => c.id === chapterData.id,
        );
        if (existingChapterIndex >= 0) {
          book.chapters[existingChapterIndex] = chapterData;
        } else {
          book.chapters.push(chapterData);
        }

        // Sort chapters by number
        book.chapters.sort((a, b) => a.chapterNumber - b.chapterNumber);

        processedCount++;
      } catch (error) {
        console.error(`Error processing ${filename}:`, error.message);
      }
    }

    // Sort books by ID
    outputData.books.sort((a, b) => a.id - b.id);

    // Write output file
    console.log("\nWriting output file...");
    fs.writeFileSync(outputFilePath, JSON.stringify(outputData, null, 2));

    console.log("\nDone!");
    console.log(`Processed ${processedCount} chapters`);
    console.log(`Total books: ${outputData.books.length}`);
    console.log(`Output: ${outputFilePath}`);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  } finally {
    // Cleanup temp directory
    if (tempDir) {
      cleanupTemp(tempDir);
    }
  }
}

main();
