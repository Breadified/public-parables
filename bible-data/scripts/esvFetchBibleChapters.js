const fs = require("fs");
const path = require("path");
const https = require("https");
const { extractBookInfo, processHtmlContent } = require("./esvParser");

// Configuration
const API_KEY = "63cc1335b0c7c2e774ba42535e2f23e53d148f75";
const SOURCE_FILE = path.join(__dirname, "..", "source", "esvSourceBibleChapter.json");
const OUTPUT_FILE = path.join(__dirname, "..", "data", "ESV_bibleData.json");

// Check if --fetch flag is provided
const FETCH_MODE = process.argv.includes("--fetch");

// Start from Genesis chapter 1
const START_CHAPTER = "1001001-1001031"; // Genesis 1:1-31

// Function to make API request
function fetchPassage(query) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "api.esv.org",
      path: `/v3/passage/html/?q=${query}&include-footnotes=false&include-footnote-body=false&include-audio-link=false&include-first-verse-numbers=true&include-chapter-numbers=false`,
      method: "GET",
      headers: {
        Authorization: API_KEY,
      },
    };

    const req = https.request(options, (res) => {
      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        try {
          const jsonData = JSON.parse(data);
          resolve(jsonData);
        } catch (error) {
          reject(new Error("Failed to parse response: " + error.message));
        }
      });
    });

    req.on("error", (error) => {
      reject(error);
    });

    req.end();
  });
}

// Load existing source data
function loadSourceData() {
  if (fs.existsSync(SOURCE_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(SOURCE_FILE, "utf8"));
    } catch (error) {
      console.warn("Could not parse existing source file, starting fresh");
      return { chapters: {} };
    }
  }
  return { chapters: {} };
}

// Save source data
function saveSourceData(sourceData) {
  return new Promise((resolve, reject) => {
    fs.writeFile(SOURCE_FILE, JSON.stringify(sourceData, null, 2), (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

// Load or create output data
function loadOutputData() {
  if (fs.existsSync(OUTPUT_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(OUTPUT_FILE, "utf8"));
    } catch (error) {
      console.warn("Could not parse output file, starting fresh");
      return { books: [] };
    }
  }
  return { books: [] };
}

// Save output data
function saveOutputData(outputData) {
  return new Promise((resolve, reject) => {
    fs.writeFile(OUTPUT_FILE, JSON.stringify(outputData, null, 2), (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

// Add chapter to output data (in-memory)
function addChapterToOutput(outputData, bookInfo, chapterData) {
  const { bookName, bookId } = bookInfo;

  // Find or create book
  let book = outputData.books.find(b => b.id === bookId);
  if (!book) {
    book = {
      id: bookId,
      name: bookName,
      testament: bookId < 40000000 ? "Old" : "New",
      chapters: []
    };
    outputData.books.push(book);
    outputData.books.sort((a, b) => a.id - b.id);
  }

  // Add or replace chapter
  const existingIndex = book.chapters.findIndex(c => c.id === chapterData.id);
  if (existingIndex >= 0) {
    book.chapters[existingIndex] = chapterData;
  } else {
    book.chapters.push(chapterData);
    book.chapters.sort((a, b) => a.chapterNumber - b.chapterNumber);
  }

  return outputData;
}

// Process all chapters from source file (no API calls)
async function processFromSource() {
  console.log("=== PROCESS MODE: Using existing source file ===");

  const sourceData = loadSourceData();
  const chapters = Object.values(sourceData.chapters);

  if (chapters.length === 0) {
    console.error("No chapters found in source file!");
    console.log("Run with --fetch flag to fetch from API");
    return;
  }

  console.log(`Found ${chapters.length} chapters in source file`);

  let outputData = loadOutputData();

  for (let i = 0; i < chapters.length; i++) {
    const chapterData = chapters[i];
    const canonical = chapterData.canonical || `Chapter ${i + 1}`;

    console.log(`Processing ${i + 1}/${chapters.length}: ${canonical}`);

    try {
      // Extract book info
      const bookInfo = extractBookInfo(canonical);

      // Process HTML in-memory (no file writes)
      const passageHtml = chapterData.passages[0];
      const processedChapter = processHtmlContent(passageHtml, bookInfo.chapterId, bookInfo.bookId);

      // Add to output data in-memory
      outputData = addChapterToOutput(outputData, bookInfo, processedChapter);

    } catch (error) {
      console.error(`Error processing ${canonical}:`, error.message);
    }
  }

  // Write final output once
  console.log("Writing output file...");
  await saveOutputData(outputData);

  console.log("All chapters processed!");
  console.log(`Total books: ${outputData.books.length}`);
  console.log(`Output: ${OUTPUT_FILE}`);
}

// Fetch from API and build both source and output files
async function fetchFromAPI() {
  console.log("=== FETCH MODE: Getting chapters from ESV API ===");

  let currentQuery = START_CHAPTER;
  let chapterCount = 0;

  const sourceData = loadSourceData();
  let outputData = loadOutputData();

  while (true) {
    try {
      console.log(`Fetching chapter: ${currentQuery}`);
      const data = await fetchPassage(currentQuery);
      chapterCount++;

      const canonical = data.canonical;

      // Save to source file
      sourceData.chapters[canonical] = data;
      await saveSourceData(sourceData);
      console.log(`Saved to source: ${canonical}`);

      // Extract book info and process in-memory
      const bookInfo = extractBookInfo(canonical);
      const passageHtml = data.passages[0];
      const processedChapter = processHtmlContent(passageHtml, bookInfo.chapterId, bookInfo.bookId);

      // Add to output data in-memory
      outputData = addChapterToOutput(outputData, bookInfo, processedChapter);

      // Save output periodically (every 10 chapters) to avoid data loss
      if (chapterCount % 10 === 0) {
        await saveOutputData(outputData);
        console.log(`Saved progress: ${chapterCount} chapters`);
      }

      // Check if we've reached the end
      const nextChapterRef = data.passage_meta[0].next_chapter;
      if (!nextChapterRef || nextChapterRef.length === 0) {
        console.log("Reached the end of the Bible!");
        console.log(`Total chapters fetched: ${chapterCount}`);
        break;
      }

      // Format next chapter query
      currentQuery = `${nextChapterRef[0]}-${nextChapterRef[1]}`;

      // Delay to avoid API rate limits
      await new Promise((resolve) => setTimeout(resolve, 1000));

    } catch (error) {
      console.error("Error occurred:", error);
      // Save progress before exiting
      await saveOutputData(outputData);
      console.log("Progress saved before exit");
      break;
    }
  }

  // Final save
  await saveOutputData(outputData);
  console.log("API fetch complete!");
  console.log(`Output: ${OUTPUT_FILE}`);
}

// Main execution
async function main() {
  try {
    if (FETCH_MODE) {
      await fetchFromAPI();
    } else {
      await processFromSource();
    }

    console.log("All processing complete!");
  } catch (error) {
    console.error("Fatal error:", error);
  }
}

main();
