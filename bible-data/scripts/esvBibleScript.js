const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

// Path to input and output files
const inputFilePath = path.join(
  __dirname,
  "..",
  "source",
  "sampleBibleChapter.json",
);
const outputFilePath = path.join(
  __dirname,
  "..",
  "data",
  "ESV_bibleData.json",
);

// Helper functions
function extractBookInfo(canonical) {
  // Parse canonical text like "Genesis 14" or "1 Samuel 14" or "Obadiah" (single chapter)
  const parts = canonical.split(" ");
  
  // List of single-chapter books
  const singleChapterBooks = ["Obadiah", "Philemon", "2 John", "3 John", "Jude"];
  
  let bookName, chapterNumber;
  
  // Check if this is a single-chapter book
  if (singleChapterBooks.includes(canonical)) {
    bookName = canonical;
    chapterNumber = 1;
  } else {
    bookName = parts.slice(0, -1).join(" ");
    chapterNumber = parseInt(parts[parts.length - 1], 10);
  }

  const books = {
    // Old Testament
    Genesis: 1,
    Exodus: 2,
    Leviticus: 3,
    Numbers: 4,
    Deuteronomy: 5,
    Joshua: 6,
    Judges: 7,
    Ruth: 8,
    "1 Samuel": 9,
    "2 Samuel": 10,
    "1 Kings": 11,
    "2 Kings": 12,
    "1 Chronicles": 13,
    "2 Chronicles": 14,
    Ezra: 15,
    Nehemiah: 16,
    Esther: 17,
    Job: 18,
    Psalm: 19,
    Psalms: 19,
    Proverbs: 20,
    Ecclesiastes: 21,
    "Song of Solomon": 22,
    Isaiah: 23,
    Jeremiah: 24,
    Lamentations: 25,
    Ezekiel: 26,
    Daniel: 27,
    Hosea: 28,
    Joel: 29,
    Amos: 30,
    Obadiah: 31,
    Jonah: 32,
    Micah: 33,
    Nahum: 34,
    Habakkuk: 35,
    Zephaniah: 36,
    Haggai: 37,
    Zechariah: 38,
    Malachi: 39,
    // New Testament
    Matthew: 40,
    Mark: 41,
    Luke: 42,
    John: 43,
    Acts: 44,
    Romans: 45,
    "1 Corinthians": 46,
    "2 Corinthians": 47,
    Galatians: 48,
    Ephesians: 49,
    Philippians: 50,
    Colossians: 51,
    "1 Thessalonians": 52,
    "2 Thessalonians": 53,
    "1 Timothy": 54,
    "2 Timothy": 55,
    Titus: 56,
    Philemon: 57,
    Hebrews: 58,
    James: 59,
    "1 Peter": 60,
    "2 Peter": 61,
    "1 John": 62,
    "2 John": 63,
    "3 John": 64,
    Jude: 65,
    Revelation: 66,
  };

  const bookId = books[bookName] * 1000000;
  const chapterId = bookId + chapterNumber * 1000;

  return { bookName, bookId, chapterNumber, chapterId };
}

function parseVerseId(verseElement) {
  // Extract verse ID from HTML element
  const idAttr = verseElement.attr("id");
  if (!idAttr || !idAttr.startsWith("v")) return null;

  const numericPart = idAttr.substring(1, 9);
  return parseInt(numericPart, 10);
}

// Helper function to extract verse number from a line ID
function extractVerseNumberFromId(id) {
  if (!id) return null;

  // Split by underscore and get the first part
  const parts = id.split("_");
  if (parts.length === 0) return null;

  // Get the last 3 digits from the first part
  const firstPart = parts[0];
  if (firstPart.length < 3) return null;

  // Extract the last 3 digits which represent the verse number
  const verseNumberStr = firstPart.slice(-3);
  return parseInt(verseNumberStr, 10);
}

function extractIndentLevel(element) {
  if (element.hasClass("indent")) return 1;
  if (element.hasClass("double-indent")) return 2;
  return 0;
}

// New helper function to extract verse ID from paragraph ID
function extractVerseIdFromParagraphId(paraId) {
  if (!paraId) return null;

  // Match pattern p{digits} and extract the numeric part
  const match = paraId.match(/p0*(\d+)_/);
  if (match && match[1]) {
    return parseInt(match[1], 10);
  }
  return null;
}

function processHtmlContent(htmlContent, chapterId, bookId) {
  // IMPORTANT: Extract block-indent paragraphs from raw HTML BEFORE Cheerio parses it
  // Cheerio will restructure invalid HTML (h4 inside p), moving h4 elements out of p tags
  // This causes the p tags to become empty
  const blockIndentMap = new Map();
  const blockIndentRegex = /<p[^>]*class="[^"]*block-indent[^"]*"[^>]*>([\s\S]*?)<\/p>/g;
  let match;
  let blockIndentCounter = 0;

  // Extract and store block-indent content with placeholders
  let processedHtml = htmlContent.replace(blockIndentRegex, (fullMatch, content) => {
    const placeholder = `__BLOCK_INDENT_${blockIndentCounter}__`;
    blockIndentMap.set(placeholder, content);
    blockIndentCounter++;
    // Return a p tag with the placeholder as data attribute
    return `<p class="block-indent" data-placeholder="${placeholder}"></p>`;
  });

  const $ = cheerio.load(processedHtml);

  // Calculate chapter number from chapterId
  const chapterNumber = Math.floor((chapterId % 1000000) / 1000);

  // Initialize the chapter structure
  const chapter = {
    id: chapterId,
    chapterNumber: chapterNumber,
    bookId: bookId,
    version: "ESV",
    sections: [],
  };

  // Create a verse map to store verses by ID
  const verses = {};

  // Track verses we've already seen to ensure only first occurrence gets _0 suffix
  const processedVerses = new Set();

  // Process all h3, h4 (psalm titles), and p elements in order to maintain proper section assignment
  const allElements = [];

  // Collect all h3, h4, and p elements with their order
  // Note: h4 elements inside p tags will be filtered out below
  $("h3, h4, p").each((i, elem) => {
    const $elem = $(elem);

    // Skip copyright paragraph
    if ($elem.is("p") && $elem.find("a.copyright").length > 0) return;

    // Skip h4 elements that are inside p tags (speaker labels in poetry)
    // Note: After our preprocessing, h4 speaker labels won't be in p tags anymore
    // But keep this check for safety
    if ($elem.is("h4") && $elem.parent().is("p")) {
      return;
    }

    allElements.push({
      type: elem.tagName.toLowerCase(),
      element: $elem,
      index: i
    });
  });

  // Initialize chapter sections array
  chapter.sections = [];
  let currentSection = null;
  let sectionCounter = 1;
  let paragraphCounter = 1;

  // Process elements in order
  allElements.forEach(item => {
    if (item.type === 'h3') {
      // Create a new section
      const title = item.element.text().trim();
      const sectionId = chapterId + sectionCounter++;

      currentSection = {
        id: sectionId,
        chapterId: chapterId,
        title: title,
        subtitle: undefined, // Placeholder, will be set by h4 if exists
        paragraphs: [],
      };
      chapter.sections.push(currentSection);
    } else if (item.type === 'h4') {
      // Add subtitle to current section (for psalm titles, acrostic headers, and speaker labels)
      if (currentSection) {
        const subtitle = item.element.text().trim();
        currentSection.subtitle = subtitle;
      }
    } else if (item.type === 'p') {
      const $para = item.element;

      // If no section exists yet, create a default one
      if (!currentSection) {
        currentSection = {
          id: chapterId + sectionCounter++,
          chapterId: chapterId,
          title: null,
          paragraphs: [],
        };
        chapter.sections.push(currentSection);
      }

      // Generate sequential paragraph ID
      const paragraphId = chapterId + paragraphCounter++;

      // Create a new paragraph
      const paragraph = {
        id: paragraphId,
        sectionId: currentSection.id,
        verseLines: [],
      };

      // Add the new paragraph to the current section
      currentSection.paragraphs.push(paragraph);

      // Try to extract verse ID from paragraph's ID attribute
      const paraId = $para.attr("id");
      const paraVerseId = extractVerseIdFromParagraphId(paraId);

      // For poetry blocks (block-indent), process each line span as a separate verse line
      if ($para.hasClass("block-indent")) {
        // Get the raw HTML content from the map (saved before Cheerio parsing)
        const placeholder = $para.attr('data-placeholder');
        let rawHtml = placeholder ? blockIndentMap.get(placeholder) : null;

        if (!rawHtml) {
          console.log(`WARNING: No raw HTML found for block-indent paragraph ${paragraphId}`);
          return; // Skip this paragraph
        }

        // Load the raw HTML into a temporary Cheerio instance for processing
        const $temp = cheerio.load(`<div>${rawHtml}</div>`);
        const $tempDiv = $temp('div').first();

        // Remove h4 speaker labels (they are handled separately as subtitles)
        $tempDiv.find('h4.speaker').remove();

        // Remove line group markers (formatting only, no content)
        $tempDiv.find('span.begin-line-group, span.end-line-group').remove();

        // Get the cleaned HTML
        const paraHtml = $tempDiv.html();

        // Split by <br /> tags to get individual lines
        const lines = paraHtml.split(/<br\s*\/?>/);

        // Process each line
        lines.forEach(lineHtml => {
          if (!lineHtml.trim()) return;

          // Create a jQuery object from the line HTML using the temp Cheerio instance
          const $line = $temp(`<div>${lineHtml}</div>`);

          // Find the span.line element within
          const $lineSpan = $line.find('span.line').first();
          if ($lineSpan.length === 0) return;

          // Get the line ID and extract verse number
          const lineId = $lineSpan.attr("id") || "";
          const verseNumber = extractVerseNumberFromId(lineId);

          if (verseNumber) {
            const verseId = paraVerseId || chapterId + verseNumber;
            
            // Create verse object if it doesn't exist
            if (!verses[verseId]) {
              verses[verseId] = {
                id: verseId,
                verseNumber: verseNumber,
              };
            }
            
            // Clone the line to avoid modifying original
            const $lineClone = $lineSpan.clone();
            
            // Remove any nested span.line elements (they are separate lines)
            $lineClone.find('span.line').remove();
            
            // Remove verse number elements
            $lineClone.find('.verse-num').remove();
            
            // Get the text and clean it
            let lineText = $lineClone.text().trim();
            
            // Replace non-breaking spaces with regular spaces
            lineText = lineText.replace(/\u00A0/g, ' ').trim();
            
            // Remove verse number if it matches and is followed by spaces
            const verseNumPattern = new RegExp(`^${verseNumber}\\s+`);
            if (verseNumPattern.test(lineText)) {
              lineText = lineText.replace(verseNumPattern, "");
            }
            
            // Calculate indentLevel based on classes and leading spaces
            let indentLevel = 2; // base level for block-indent
            if ($lineSpan.hasClass("indent")) {
              indentLevel = 3;
            }
            
            // Check if this is the first occurrence of this verse
            const isFirstOccurrence = !processedVerses.has(verseId);
            
            // Mark this verse as processed
            if (isFirstOccurrence) {
              processedVerses.add(verseId);
            }
            
            // Always use _0 for first occurrence of each verse ID
            const lineSuffix = isFirstOccurrence
              ? "_0"
              : "_" +
                paragraph.verseLines.filter((vl) => vl.verseId === verseId)
                  .length;
            
            // Create and add the verse line with correct ID format
            if (lineText) {
              paragraph.verseLines.push({
                id: `${verseId}${lineSuffix}`,
                text: lineText,
                isIsolated: true,
                indentLevel: indentLevel,
                paragraphId: paragraph.id,
                verseId: verseId,
                // Add number property only if this is the first occurrence of the verse
                verseNumber: isFirstOccurrence ? verseNumber : undefined,
              });
            }
          }
        });
      }
      // For regular paragraphs, process verse text
      else {
        // Check if there's any text before the first verse number
        let leadingText = "";
        const firstVerseNum = $para.find(".verse-num").first();

        if (firstVerseNum.length) {
          const paraHtml = $para.html();
          const versePos = paraHtml.indexOf($.html(firstVerseNum));

          if (versePos > 0) {
            // Extract text before the verse number
            leadingText = $(`<div>${paraHtml.substring(0, versePos)}</div>`)
              .text()
              .trim();
          }
        } else {
          // No verse numbers, use the whole paragraph text
          leadingText = $para.text().trim();
        }

        // If we have leading text and a paraVerseId, add it as a verse line
        if (leadingText && paraVerseId) {
          // Use the paraVerseId directly as the verseId
          const verseId = paraVerseId;
          const verseNumber = verseId % 1000;
          
          // Remove verse number only if it matches the extracted verse number
          // AND is followed by one or more non-breaking spaces (\u00A0) - specific ESV formatting
          const verseNumPattern = new RegExp(`^${verseNumber}[\u00A0]+`);
          if (verseNumPattern.test(leadingText)) {
            leadingText = leadingText.replace(verseNumPattern, "");
          }

          // Create verse object if it doesn't exist
          if (!verses[verseId]) {
            verses[verseId] = {
              id: verseId,
              verseNumber: verseNumber,
            };
          }

          // Check if this is the first occurrence of this verse
          const isFirstOccurrence = !processedVerses.has(verseId);

          // Mark this verse as processed
          if (isFirstOccurrence) {
            processedVerses.add(verseId);
          }

          paragraph.verseLines.push({
            id: `${verseId}_0`, // Leading text always gets _0 suffix
            text: leadingText,
            isIsolated: false,
            indentLevel: 0,
            paragraphId: paragraph.id,
            verseId: verseId,
            verseNumber: isFirstOccurrence ? verseNumber : undefined, // Only add number if first occurrence
          });
        }

        // Process verse numbers in this paragraph
        const verseNums = $para.find(".verse-num");
        if (verseNums.length === 0) return; // Skip if no verse numbers

        // Extract verse positions
        const versePositions = [];
        let paraHtml = $para.html();

        verseNums.each((j, verseNumElem) => {
          const $verseNum = $(verseNumElem);
          const verseId = parseVerseId($verseNum);
          if (verseId) {
            const verseNumHtml = $.html($verseNum);
            const pos = paraHtml.indexOf(verseNumHtml);
            if (pos >= 0) {
              versePositions.push({
                id: verseId,
                position: pos,
                element: $verseNum,
              });
            }
          }
        });

        // Sort verse positions
        versePositions.sort((a, b) => a.position - b.position);

        // Process each verse
        for (let j = 0; j < versePositions.length; j++) {
          const current = versePositions[j];
          const verseId = current.id; // Use the parsed verseId directly
          const verseNumber = verseId % 1000;

          // Create verse object if it doesn't exist
          if (!verses[verseId]) {
            verses[verseId] = {
              id: verseId,
              verseNumber: verseNumber,
            };
          }

          // Extract verse text
          const next = versePositions[j + 1];
          const nextPos = next ? next.position : paraHtml.length;
          const versePos = current.position;

          let verseHtml = paraHtml.substring(versePos, nextPos);
          const $tempVerse = $(`<div>${verseHtml}</div>`);
          $tempVerse.find(".verse-num").remove();
          let verseText = $tempVerse.text().trim();
          
          // Remove verse number only if it matches the current verse number
          // AND is followed by one or more non-breaking spaces (\u00A0) - specific ESV formatting
          const verseNumPattern = new RegExp(`^${verseNumber}[\u00A0]+`);
          if (verseNumPattern.test(verseText)) {
            verseText = verseText.replace(verseNumPattern, "");
          }

          if (verseText) {
            // Check if this is the first occurrence of this verse
            const isFirstOccurrence = !processedVerses.has(verseId);

            // Mark this verse as processed
            if (isFirstOccurrence) {
              processedVerses.add(verseId);
            }

            // Always use _0 for first occurrence of each verse ID
            const lineSuffix = isFirstOccurrence
              ? "_0"
              : "_" +
                paragraph.verseLines.filter((vl) => vl.verseId === verseId)
                  .length;

            // Add as a verse line with correct ID format
            paragraph.verseLines.push({
              id: `${verseId}${lineSuffix}`,
              text: verseText,
              isIsolated: false,
              indentLevel: 0,
              paragraphId: paragraph.id,
              verseId: verseId,
              verseNumber: isFirstOccurrence ? verseNumber : undefined, // Only add number if first occurrence
            });
          }
        }
      }
    }
  });

  // Clean up sections: remove subtitle property if undefined
  chapter.sections.forEach(section => {
    if (section.subtitle === undefined) {
      delete section.subtitle;
    }
  });

  return chapter;
}

// Helper function to remove duplicated text in a single verse
function removeDuplicateVerseText(text) {
  // Split text into sentences or phrases
  const parts = text.split(/([.!?]\s+)/);
  const uniqueParts = [];
  const seenParts = new Set();

  for (let i = 0; i < parts.length; i++) {
    // Skip empty parts
    if (!parts[i].trim()) continue;

    // If not seen before, add to unique parts
    if (!seenParts.has(parts[i])) {
      seenParts.add(parts[i]);
      uniqueParts.push(parts[i]);
    }
  }

  // Rejoin the unique parts
  return uniqueParts.join("");
}

// Helper function to match a line ID to a verse ID according to the specified rules
function matchLineToVerse(lineId, verseId) {
  // If no lineId, we can't match
  if (!lineId) return false;

  // Parse the verse ID to a string and get the verse number portion
  const verseIdStr = verseId.toString();
  const verseNum = verseIdStr.slice(-3); // Last 3 digits (verse number)

  // Split by underscore and get the first part
  const parts = lineId.split("_");
  if (parts.length === 0) return false;

  // Get the last 3 digits from the first part
  const firstPart = parts[0];
  if (firstPart.length < 3) return false;

  const lineVersePart = firstPart.slice(-3);
  return lineVersePart === verseNum;
}

async function main() {
  try {
    console.log("Reading input file...");
    const inputData = JSON.parse(fs.readFileSync(inputFilePath, "utf8"));

    // Extract book and chapter info
    const { bookName, bookId, chapterNumber, chapterId } = extractBookInfo(
      inputData.canonical,
    );
    console.log(`Processing ${bookName} ${chapterNumber}...`);

    // Process HTML content for this chapter
    const passageHtml = inputData.passages[0]; // Assuming there's one passage
    const chapterData = processHtmlContent(passageHtml, chapterId, bookId);

    // Create or update the output file
    let outputData = { books: [] };

    // Check if output file exists and read it
    if (fs.existsSync(outputFilePath)) {
      console.log("Output file exists, reading existing data...");
      outputData = JSON.parse(fs.readFileSync(outputFilePath, "utf8"));
    }

    // Find if the book already exists
    let bookExists = false;
    for (let book of outputData.books) {
      if (book.id === bookId) {
        console.log(`Book ${bookName} found, adding chapter...`);
        bookExists = true;

        // Check if chapter already exists, replace it if it does
        const existingChapterIndex = book.chapters.findIndex(
          (c) => c.id === chapterId,
        );
        if (existingChapterIndex >= 0) {
          console.log(`Chapter ${chapterNumber} already exists, replacing...`);
          book.chapters[existingChapterIndex] = chapterData;
        } else {
          console.log(`Adding chapter ${chapterNumber}...`);
          book.chapters.push(chapterData);

          // Sort chapters by number
          book.chapters.sort((a, b) => a.chapterNumber - b.chapterNumber);
        }
        break;
      }
    }

    // If book doesn't exist, create it
    if (!bookExists) {
      console.log(`Book ${bookName} not found, creating new book...`);
      outputData.books.push({
        id: bookId,
        name: bookName,
        testament: bookId < 40000000 ? "Old" : "New",
        chapters: [chapterData],
      });

      // Sort books by ID
      outputData.books.sort((a, b) => a.id - b.id);
    }

    // Write the output file
    console.log("Writing output file...");
    fs.writeFileSync(outputFilePath, JSON.stringify(outputData, null, 2));
    console.log("Done!");
  } catch (error) {
    console.error("Error:", error);
  }
}

main();
