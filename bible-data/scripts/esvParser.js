const cheerio = require("cheerio");

// Book mapping
const BOOK_MAP = {
  "Genesis": 1, "Exodus": 2, "Leviticus": 3, "Numbers": 4,
  "Deuteronomy": 5, "Joshua": 6, "Judges": 7, "Ruth": 8,
  "1 Samuel": 9, "2 Samuel": 10, "1 Kings": 11, "2 Kings": 12,
  "1 Chronicles": 13, "2 Chronicles": 14, "Ezra": 15, "Nehemiah": 16,
  "Esther": 17, "Job": 18, "Psalm": 19, "Psalms": 19,
  "Proverbs": 20, "Ecclesiastes": 21, "Song of Solomon": 22,
  "Isaiah": 23, "Jeremiah": 24, "Lamentations": 25, "Ezekiel": 26,
  "Daniel": 27, "Hosea": 28, "Joel": 29, "Amos": 30,
  "Obadiah": 31, "Jonah": 32, "Micah": 33, "Nahum": 34,
  "Habakkuk": 35, "Zephaniah": 36, "Haggai": 37, "Zechariah": 38,
  "Malachi": 39, "Matthew": 40, "Mark": 41, "Luke": 42,
  "John": 43, "Acts": 44, "Romans": 45, "1 Corinthians": 46,
  "2 Corinthians": 47, "Galatians": 48, "Ephesians": 49,
  "Philippians": 50, "Colossians": 51, "1 Thessalonians": 52,
  "2 Thessalonians": 53, "1 Timothy": 54, "2 Timothy": 55,
  "Titus": 56, "Philemon": 57, "Hebrews": 58, "James": 59,
  "1 Peter": 60, "2 Peter": 61, "1 John": 62, "2 John": 63,
  "3 John": 64, "Jude": 65, "Revelation": 66
};

const SINGLE_CHAPTER_BOOKS = ["Obadiah", "Philemon", "2 John", "3 John", "Jude"];

function extractBookInfo(canonical) {
  const parts = canonical.split(" ");

  let bookName, chapterNumber;

  if (SINGLE_CHAPTER_BOOKS.includes(canonical)) {
    bookName = canonical;
    chapterNumber = 1;
  } else {
    bookName = parts.slice(0, -1).join(" ");
    chapterNumber = parseInt(parts[parts.length - 1], 10);
  }

  const bookNumber = BOOK_MAP[bookName];
  const bookId = bookNumber * 1000000;
  const chapterId = bookId + chapterNumber * 1000;

  return { bookName, bookId, chapterNumber, chapterId };
}

function parseVerseId($elem) {
  const idAttr = $elem.attr("id");
  if (!idAttr || !idAttr.startsWith("v")) return null;
  const numericPart = idAttr.substring(1, 9);
  return parseInt(numericPart, 10);
}

function extractVerseNumberFromId(id) {
  if (!id) return null;
  const parts = id.split("_");
  if (parts.length === 0) return null;
  const firstPart = parts[0];
  if (firstPart.length < 3) return null;
  return parseInt(firstPart.slice(-3), 10);
}

function extractVerseIdFromParagraphId(paraId) {
  if (!paraId) return null;
  const match = paraId.match(/p0*(\d+)_/);
  if (match && match[1]) {
    return parseInt(match[1], 10);
  }
  return null;
}

function processHtmlContent(htmlContent, chapterId, bookId) {
  const $ = cheerio.load(htmlContent);
  const chapterNumber = Math.floor((chapterId % 1000000) / 1000);

  const chapter = {
    id: chapterId,
    chapterNumber: chapterNumber,
    bookId: bookId,
    version: "ESV",
    sections: []
  };

  const verses = {};
  const processedVerses = new Set();
  const verseLineCounters = {}; // Track suffix counter for each verse globally

  let currentSection = null;
  let sectionCounter = 1;
  let paragraphCounter = 1;

  // Process all h3, h4, and p elements in order
  $("h3, h4, p").each((i, elem) => {
    const $elem = $(elem);
    const tagName = elem.tagName.toLowerCase();

    // Skip copyright paragraph
    if (tagName === "p" && $elem.find("a.copyright").length > 0) return;

    if (tagName === 'h3') {
      // Section title
      const title = $elem.text().trim();
      currentSection = {
        id: chapterId + sectionCounter++,
        chapterId: chapterId,
        title: title,
        subtitle: undefined,
        paragraphs: []
      };
      chapter.sections.push(currentSection);
    } else if (tagName === 'h4') {
      // Subtitle (psalm titles, etc.)
      if (currentSection) {
        currentSection.subtitle = $elem.text().trim();
      }
    } else if (tagName === 'p') {
      // Create default section if none exists
      if (!currentSection) {
        currentSection = {
          id: chapterId + sectionCounter++,
          chapterId: chapterId,
          title: null,
          paragraphs: []
        };
        chapter.sections.push(currentSection);
      }

      const paragraphId = chapterId + paragraphCounter++;
      const paragraph = {
        id: paragraphId,
        sectionId: currentSection.id,
        verseLines: []
      };
      currentSection.paragraphs.push(paragraph);

      const paraId = $elem.attr("id");
      const paraVerseId = extractVerseIdFromParagraphId(paraId);

      // Handle poetry (block-indent)
      if ($elem.hasClass("block-indent")) {
        const paraHtml = $elem.html();
        const lines = paraHtml.split(/<br\s*\/?>/);

        lines.forEach(lineHtml => {
          if (!lineHtml.trim()) return;

          const $line = $(`<div>${lineHtml}</div>`);
          const $lineSpan = $line.find('span.line').first();
          if ($lineSpan.length === 0) return;

          const lineId = $lineSpan.attr("id") || "";
          const verseNumber = extractVerseNumberFromId(lineId);

          if (verseNumber) {
            const verseId = paraVerseId || chapterId + verseNumber;

            if (!verses[verseId]) {
              verses[verseId] = { id: verseId, verseNumber: verseNumber };
            }

            const $lineClone = $lineSpan.clone();
            $lineClone.find('span.line').remove();
            $lineClone.find('.verse-num').remove();

            let lineText = $lineClone.text().trim();
            lineText = lineText.replace(/\u00A0/g, ' ').trim();

            const verseNumPattern = new RegExp(`^${verseNumber}\\s+`);
            if (verseNumPattern.test(lineText)) {
              lineText = lineText.replace(verseNumPattern, "");
            }

            // Calculate indent level
            let indentLevel = 2; // base for block-indent
            if ($lineSpan.hasClass("indent")) {
              indentLevel = 3;
            }

            const isFirstOccurrence = !processedVerses.has(verseId);
            if (isFirstOccurrence) {
              processedVerses.add(verseId);
            }

            // Calculate suffix using global counter
            if (!verseLineCounters[verseId]) {
              verseLineCounters[verseId] = 0;
            }
            const lineSuffix = "_" + verseLineCounters[verseId];
            verseLineCounters[verseId]++;

            if (lineText) {
              paragraph.verseLines.push({
                id: `${verseId}${lineSuffix}`,
                text: lineText,
                isIsolated: true,
                indentLevel: indentLevel,
                paragraphId: paragraph.id,
                verseId: verseId,
                verseNumber: isFirstOccurrence ? verseNumber : undefined
              });
            }
          }
        });
      } else {
        // Handle regular paragraphs
        let leadingText = "";
        const firstVerseNum = $elem.find(".verse-num").first();

        if (firstVerseNum.length) {
          const paraHtml = $elem.html();
          const versePos = paraHtml.indexOf($.html(firstVerseNum));

          if (versePos > 0) {
            leadingText = $(`<div>${paraHtml.substring(0, versePos)}</div>`).text().trim();
          }
        } else {
          leadingText = $elem.text().trim();
        }

        // Add leading text if exists
        if (leadingText && paraVerseId) {
          const verseId = paraVerseId;
          const verseNumber = verseId % 1000;

          const verseNumPattern = new RegExp(`^${verseNumber}[\u00A0]+`);
          if (verseNumPattern.test(leadingText)) {
            leadingText = leadingText.replace(verseNumPattern, "");
          }

          if (!verses[verseId]) {
            verses[verseId] = { id: verseId, verseNumber: verseNumber };
          }

          const isFirstOccurrence = !processedVerses.has(verseId);
          if (isFirstOccurrence) {
            processedVerses.add(verseId);
          }

          // Calculate suffix using global counter
          if (!verseLineCounters[verseId]) {
            verseLineCounters[verseId] = 0;
          }
          const lineSuffix = "_" + verseLineCounters[verseId];
          verseLineCounters[verseId]++;

          paragraph.verseLines.push({
            id: `${verseId}${lineSuffix}`,
            text: leadingText,
            isIsolated: false,
            indentLevel: 0,
            paragraphId: paragraph.id,
            verseId: verseId,
            verseNumber: isFirstOccurrence ? verseNumber : undefined
          });
        }

        // Process verse numbers
        const verseNums = $elem.find(".verse-num");
        if (verseNums.length === 0) return;

        const versePositions = [];
        const paraHtml = $elem.html();

        verseNums.each((j, verseNumElem) => {
          const $verseNum = $(verseNumElem);
          const verseId = parseVerseId($verseNum);
          if (verseId) {
            const verseNumHtml = $.html($verseNum);
            const pos = paraHtml.indexOf(verseNumHtml);
            if (pos >= 0) {
              versePositions.push({ id: verseId, position: pos, element: $verseNum });
            }
          }
        });

        versePositions.sort((a, b) => a.position - b.position);

        for (let j = 0; j < versePositions.length; j++) {
          const current = versePositions[j];
          const verseId = current.id;
          const verseNumber = verseId % 1000;

          if (!verses[verseId]) {
            verses[verseId] = { id: verseId, verseNumber: verseNumber };
          }

          const next = versePositions[j + 1];
          const nextPos = next ? next.position : paraHtml.length;
          const versePos = current.position;

          let verseHtml = paraHtml.substring(versePos, nextPos);
          const $tempVerse = $(`<div>${verseHtml}</div>`);
          $tempVerse.find(".verse-num").remove();
          let verseText = $tempVerse.text().trim();

          const verseNumPattern = new RegExp(`^${verseNumber}[\u00A0]+`);
          if (verseNumPattern.test(verseText)) {
            verseText = verseText.replace(verseNumPattern, "");
          }

          if (verseText) {
            const isFirstOccurrence = !processedVerses.has(verseId);
            if (isFirstOccurrence) {
              processedVerses.add(verseId);
            }

            // Calculate suffix using global counter
            if (!verseLineCounters[verseId]) {
              verseLineCounters[verseId] = 0;
            }
            const lineSuffix = "_" + verseLineCounters[verseId];
            verseLineCounters[verseId]++;

            paragraph.verseLines.push({
              id: `${verseId}${lineSuffix}`,
              text: verseText,
              isIsolated: false,
              indentLevel: 0,
              paragraphId: paragraph.id,
              verseId: verseId,
              verseNumber: isFirstOccurrence ? verseNumber : undefined
            });
          }
        }
      }
    }
  });

  // Clean up undefined subtitles
  chapter.sections.forEach(section => {
    if (section.subtitle === undefined) {
      delete section.subtitle;
    }
  });

  return chapter;
}

module.exports = {
  extractBookInfo,
  processHtmlContent
};
