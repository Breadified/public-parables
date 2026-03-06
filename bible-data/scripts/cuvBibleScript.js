const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");
const { createTempDir, unzipToTemp, cleanupTemp } = require("./unzipUtils");

// Path to input zip and output files
const inputZip = path.join(__dirname, "..", "source", "cn-cuv_html.zip");
const outputFilePath = path.join(
  __dirname,
  "..",
  "data",
  "CUV_bibleData.json",
);

// Book mapping with file prefixes and IDs (same as ESV/WEB for compatibility)
const BOOK_MAP = {
  // Old Testament
  GN: { name: "创世记", nameEn: "Genesis", id: 1000000, testament: "Old" },
  EX: { name: "出埃及记", nameEn: "Exodus", id: 2000000, testament: "Old" },
  LV: { name: "利未记", nameEn: "Leviticus", id: 3000000, testament: "Old" },
  NU: { name: "民数记", nameEn: "Numbers", id: 4000000, testament: "Old" },
  DT: { name: "申命记", nameEn: "Deuteronomy", id: 5000000, testament: "Old" },
  JS: { name: "约书亚记", nameEn: "Joshua", id: 6000000, testament: "Old" },
  JG: { name: "士师记", nameEn: "Judges", id: 7000000, testament: "Old" },
  RT: { name: "路得记", nameEn: "Ruth", id: 8000000, testament: "Old" },
  S1: { name: "撒母耳记上", nameEn: "1 Samuel", id: 9000000, testament: "Old" },
  S2: { name: "撒母耳记下", nameEn: "2 Samuel", id: 10000000, testament: "Old" },
  K1: { name: "列王纪上", nameEn: "1 Kings", id: 11000000, testament: "Old" },
  K2: { name: "列王纪下", nameEn: "2 Kings", id: 12000000, testament: "Old" },
  R1: { name: "历代志上", nameEn: "1 Chronicles", id: 13000000, testament: "Old" },
  R2: { name: "历代志下", nameEn: "2 Chronicles", id: 14000000, testament: "Old" },
  ER: { name: "以斯拉记", nameEn: "Ezra", id: 15000000, testament: "Old" },
  NH: { name: "尼希米记", nameEn: "Nehemiah", id: 16000000, testament: "Old" },
  ET: { name: "以斯帖记", nameEn: "Esther", id: 17000000, testament: "Old" },
  JB: { name: "约伯记", nameEn: "Job", id: 18000000, testament: "Old" },
  PS: { name: "诗篇", nameEn: "Psalms", id: 19000000, testament: "Old" },
  PR: { name: "箴言", nameEn: "Proverbs", id: 20000000, testament: "Old" },
  EC: { name: "传道书", nameEn: "Ecclesiastes", id: 21000000, testament: "Old" },
  SS: { name: "雅歌", nameEn: "Song of Solomon", id: 22000000, testament: "Old" },
  IS: { name: "以赛亚书", nameEn: "Isaiah", id: 23000000, testament: "Old" },
  JR: { name: "耶利米书", nameEn: "Jeremiah", id: 24000000, testament: "Old" },
  LM: { name: "耶利米哀歌", nameEn: "Lamentations", id: 25000000, testament: "Old" },
  EK: { name: "以西结书", nameEn: "Ezekiel", id: 26000000, testament: "Old" },
  DN: { name: "但以理书", nameEn: "Daniel", id: 27000000, testament: "Old" },
  HS: { name: "何西阿书", nameEn: "Hosea", id: 28000000, testament: "Old" },
  JL: { name: "约珥书", nameEn: "Joel", id: 29000000, testament: "Old" },
  AM: { name: "阿摩司书", nameEn: "Amos", id: 30000000, testament: "Old" },
  OB: { name: "俄巴底亚书", nameEn: "Obadiah", id: 31000000, testament: "Old" },
  JH: { name: "约拿书", nameEn: "Jonah", id: 32000000, testament: "Old" },
  MC: { name: "弥迦书", nameEn: "Micah", id: 33000000, testament: "Old" },
  NM: { name: "那鸿书", nameEn: "Nahum", id: 34000000, testament: "Old" },
  HK: { name: "哈巴谷书", nameEn: "Habakkuk", id: 35000000, testament: "Old" },
  ZP: { name: "西番雅书", nameEn: "Zephaniah", id: 36000000, testament: "Old" },
  HG: { name: "哈该书", nameEn: "Haggai", id: 37000000, testament: "Old" },
  ZC: { name: "撒迦利亚书", nameEn: "Zechariah", id: 38000000, testament: "Old" },
  ML: { name: "玛拉基书", nameEn: "Malachi", id: 39000000, testament: "Old" },
  // New Testament
  MT: { name: "马太福音", nameEn: "Matthew", id: 40000000, testament: "New" },
  MK: { name: "马可福音", nameEn: "Mark", id: 41000000, testament: "New" },
  LK: { name: "路加福音", nameEn: "Luke", id: 42000000, testament: "New" },
  JN: { name: "约翰福音", nameEn: "John", id: 43000000, testament: "New" },
  AC: { name: "使徒行传", nameEn: "Acts", id: 44000000, testament: "New" },
  RM: { name: "罗马书", nameEn: "Romans", id: 45000000, testament: "New" },
  C1: { name: "哥林多前书", nameEn: "1 Corinthians", id: 46000000, testament: "New" },
  C2: { name: "哥林多后书", nameEn: "2 Corinthians", id: 47000000, testament: "New" },
  GL: { name: "加拉太书", nameEn: "Galatians", id: 48000000, testament: "New" },
  EP: { name: "以弗所书", nameEn: "Ephesians", id: 49000000, testament: "New" },
  PP: { name: "腓立比书", nameEn: "Philippians", id: 50000000, testament: "New" },
  CL: { name: "歌罗西书", nameEn: "Colossians", id: 51000000, testament: "New" },
  H1: { name: "帖撒罗尼迦前书", nameEn: "1 Thessalonians", id: 52000000, testament: "New" },
  H2: { name: "帖撒罗尼迦后书", nameEn: "2 Thessalonians", id: 53000000, testament: "New" },
  T1: { name: "提摩太前书", nameEn: "1 Timothy", id: 54000000, testament: "New" },
  T2: { name: "提摩太后书", nameEn: "2 Timothy", id: 55000000, testament: "New" },
  TT: { name: "提多书", nameEn: "Titus", id: 56000000, testament: "New" },
  PM: { name: "腓利门书", nameEn: "Philemon", id: 57000000, testament: "New" },
  HB: { name: "希伯来书", nameEn: "Hebrews", id: 58000000, testament: "New" },
  JM: { name: "雅各书", nameEn: "James", id: 59000000, testament: "New" },
  P1: { name: "彼得前书", nameEn: "1 Peter", id: 60000000, testament: "New" },
  P2: { name: "彼得后书", nameEn: "2 Peter", id: 61000000, testament: "New" },
  J1: { name: "约翰一书", nameEn: "1 John", id: 62000000, testament: "New" },
  J2: { name: "约翰二书", nameEn: "2 John", id: 63000000, testament: "New" },
  J3: { name: "约翰三书", nameEn: "3 John", id: 64000000, testament: "New" },
  JD: { name: "犹大书", nameEn: "Jude", id: 65000000, testament: "New" },
  RV: { name: "启示录", nameEn: "Revelation", id: 66000000, testament: "New" },
};

// Extract book code and chapter number from filename
function parseFilename(filename) {
  // Examples: GN1.html, PS23.html, JN.html (single chapter books)
  // Match patterns: XX1.html, XX123.html, X1.html (single letter books like C, H, J, K, P, R, S, T)
  const match = filename.match(/^([A-Z][A-Z0-9]?)(\d{1,3})\.html$/);
  if (!match) return null;

  const bookCode = match[1];
  const chapterNum = parseInt(match[2], 10);

  if (!BOOK_MAP[bookCode]) return null;

  // Skip chapter 0 (invalid placeholder files)
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
    version: "CUV",
    sections: [],
  };

  // Track verse occurrence counts across all paragraphs in the chapter
  const verseOccurrenceCounts = new Map();
  let currentSection = null;
  let sectionCounter = 1;
  let paragraphCounter = 1;
  let currentVerseId = chapterId + 1; // Track current verse across paragraphs

  // Process all elements in order within .chapter div
  $(".chapter")
    .children()
    .each((i, elem) => {
      const $elem = $(elem);
      const tagName = elem.tagName.toLowerCase();

      // Section headings (s class)
      if ($elem.hasClass("s")) {
        const title = $elem.text().trim();
        if (title) {
          currentSection = {
            id: chapterId + sectionCounter++,
            chapterId: chapterId,
            title: title,
            paragraphs: [],
          };
          chapter.sections.push(currentSection);
        }
        return;
      }

      // Psalm titles/subtitles (d class)
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

      // Poetry line (q class) - each is its own paragraph
      if ($elem.hasClass("q")) {
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
        const indentLevel = 2;
        const isPoetry = true;

        // Extract verse information - process ALL verse spans in this poetry div
        const $verseSpans = $elem.find(".v");
        if ($verseSpans.length > 0) {
          $verseSpans.each((j, verseElem) => {
            const $verseSpan = $(verseElem);

            // Extract all verse IDs from class attribute (handles combined verses like "v PS8_7 PS8_8")
            const classList = $verseSpan.attr("class") || "";
            const verseClasses = classList.match(/[A-Z][A-Z0-9]*\d+_(\d+)/g) || [];
            const verseNumbers = verseClasses.map(vc => {
              const match = vc.match(/_(\d+)$/);
              return match ? parseInt(match[1], 10) : null;
            }).filter(v => v !== null);

            // If no verse numbers from class, try data-id as fallback
            if (verseNumbers.length === 0) {
              const dataId = $verseSpan.attr("data-id");
              const verseMatch = dataId ? dataId.match(/_(\d+)$/) : null;
              if (verseMatch) {
                verseNumbers.push(parseInt(verseMatch[1], 10));
              }
            }

            if (verseNumbers.length > 0) {
              // Extract text (remove verse number span)
              let text = $verseSpan.clone().children(".v-num").remove().end().text().trim();

              // Clean text (remove multiple spaces, non-breaking spaces)
              text = text
                .replace(/\u00A0/g, " ")
                .replace(/\s+/g, " ")
                .trim();

              if (text) {
                // Create entry for each verse number (for combined verses like 7-8)
                verseNumbers.forEach(verseNumber => {
                  const verseId = chapterId + verseNumber;
                  // Update chapter-level tracker
                  currentVerseId = verseId;

                  // Get current count for this verse ID and increment
                  const currentCount = verseOccurrenceCounts.get(verseId) || 0;
                  const lineSuffix = `_${currentCount}`;
                  verseOccurrenceCounts.set(verseId, currentCount + 1);

                  const isFirstOccurrence = currentCount === 0;

                  paragraph.verseLines.push({
                    id: `${verseId}${lineSuffix}`,
                    text: text,
                    isIsolated: isPoetry,
                    indentLevel: indentLevel,
                    paragraphId: paragraph.id,
                    verseId: verseId,
                    verseNumber: isFirstOccurrence ? verseNumber : undefined,
                  });
                });
              }
            }
          });
        } else {
          // No verse marker, continuation of previous verse
          let text = $elem.text().trim();

          // Clean text
          text = text
            .replace(/\u00A0/g, " ")
            .replace(/\s+/g, " ")
            .trim();

          if (text) {
            // Get current count for this verse ID and increment
            const currentCount = verseOccurrenceCounts.get(currentVerseId) || 0;
            const lineSuffix = `_${currentCount}`;
            verseOccurrenceCounts.set(currentVerseId, currentCount + 1);

            paragraph.verseLines.push({
              id: `${currentVerseId}${lineSuffix}`,
              text: text,
              isIsolated: isPoetry,
              indentLevel: indentLevel,
              paragraphId: paragraph.id,
              verseId: currentVerseId,
              verseNumber: undefined, // Not first occurrence
            });
          }
        }
        return;
      }

      // Blank line separator (b class) - skip
      if ($elem.hasClass("b")) {
        return;
      }

      // Regular paragraph (p class) or margin text (m class)
      // Both contain prose verses in similar format
      if ($elem.hasClass("p") || $elem.hasClass("m")) {
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

        const indentLevel = 0;
        const isPoetry = false;

        // Find all verse spans in this paragraph
        const verses = [];
        $elem.find(".v").each((j, verseElem) => {
          const $verseSpan = $(verseElem);

          // Extract all verse IDs from class attribute (handles combined verses like "v GN24_29 GN24_30")
          const classList = $verseSpan.attr("class") || "";
          const verseClasses = classList.match(/[A-Z][A-Z0-9]*\d+_(\d+)/g) || [];
          const verseNumbers = verseClasses.map(vc => {
            const match = vc.match(/_(\d+)$/);
            return match ? parseInt(match[1], 10) : null;
          }).filter(v => v !== null);

          // If no verse numbers from class, try data-id as fallback
          if (verseNumbers.length === 0) {
            const dataId = $verseSpan.attr("data-id");
            const verseMatch = dataId ? dataId.match(/_(\d+)$/) : null;
            if (verseMatch) {
              verseNumbers.push(parseInt(verseMatch[1], 10));
            }
          }

          if (verseNumbers.length > 0) {
            // Extract text (remove verse number span)
            let text = $verseSpan.clone().children(".v-num").remove().end().text().trim();

            // Clean text
            text = text
              .replace(/\u00A0/g, " ")
              .replace(/\s+/g, " ")
              .trim();

            if (text) {
              // Create entry for each verse number (for combined verses like 29-30)
              verseNumbers.forEach(verseNumber => {
                const verseId = chapterId + verseNumber;
                // Update chapter-level tracker
                currentVerseId = verseId;

                verses.push({
                  verseId: verseId,
                  verseNumber: verseNumber,
                  text: text,
                });
              });
            }
          }
        });

        // Create verse lines
        verses.forEach((verse) => {
          // Get current count for this verse ID and increment
          const currentCount = verseOccurrenceCounts.get(verse.verseId) || 0;
          const lineSuffix = `_${currentCount}`;
          verseOccurrenceCounts.set(verse.verseId, currentCount + 1);

          const isFirstOccurrence = currentCount === 0;

          paragraph.verseLines.push({
            id: `${verse.verseId}${lineSuffix}`,
            text: verse.text,
            isIsolated: isPoetry,
            indentLevel: indentLevel,
            paragraphId: paragraph.id,
            verseId: verse.verseId,
            verseNumber: isFirstOccurrence ? verse.verseNumber : undefined,
          });
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
    console.log("Starting CUV Bible data extraction...");

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
      .filter((f) => f.endsWith(".html") && parseFilename(f))
      .sort();

    console.log(`Found ${files.length} chapter files to process`);

    let processedCount = 0;

    for (const filename of files) {
      const parsed = parseFilename(filename);
      if (!parsed) continue;

      const { bookCode, chapterNumber, bookInfo } = parsed;
      const filePath = path.join(inputDir, filename);

      console.log(
        `Processing ${bookInfo.name} (${bookInfo.nameEn}) ${chapterNumber} (${filename})...`,
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
            nameEn: bookInfo.nameEn,
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
