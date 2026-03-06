/**
 * Database Version Configuration
 * Increment this version whenever the bible.db structure or content changes
 * This will force users to re-copy the bundled database
 */

export const DATABASE_VERSION = {
  // Increment this number to force database refresh
  current: 46,

  // Optional: Add changelog for tracking what changed
  changelog: {
    1: "Initial database version",
    2: "Fixed verse number display logic in paragraphs",
    3: "Updated database schema for improved performance",
    4: "Optimized verse line retrieval for better performance",
    5: "Added new translations and fixed minor bugs",
    6: "Added World English Bible (WEB) translation, fixed psalm subtitles/titles, improved poetry indent levels, refactored ESV processing for reliability",
    7: "Resolved verseLine logic for WEB version",
    8: "Another attempt to resolve verseLine logic for WEB version",
    9: "Fixed WEB version verseId tracking across poetry paragraphs (Psalm 77 and others)",
    10: "Resolved WEB version random chapter 0 issues",
    11: "Set WEB as default version, fixed PSA000.htm causing empty chapter",
    12: "Added CUV Chinese Version",
    13: "Split compressed database into multi-part files for Metro bundler compatibility",
    14: "Second attempt to split database into multi-part",
    15: "Updated CUV to Simplified Chinese version",
    16: "Enhanced decompression verification and logging",
    17: "Regenerated database with proper integrity",
    18: "Write database in chunks to prevent corruption",
    19: "Use base64 encoding for reliable binary file write",
    20: "Fixed base64 encoding parameter",
    21: "Use File.write() API for reliable binary write",
    22: "Simplified approach - split uncompressed database, no compression/decompression",
    23: "Trigger database refresh",
    24: "Dual loading strategy - full database for EAS builds, chunks for Metro dev",
    25: "CRITICAL FIX: WEB parser now includes all 17 missing numbered books (1 Samuel, 2 Samuel, 1 Kings, 2 Kings, 1 Chronicles, 2 Chronicles, 1 Corinthians, 2 Corinthians, 1 Thessalonians, 2 Thessalonians, 1 Timothy, 2 Timothy, 1 Peter, 2 Peter, 1 John, 2 John, 3 John) - complete 66 book Bible restored",
    26: "Triggering new build due to timeout restraints",
    27: "Added King James Version (KJV) - 31,102 verses with classic English translation. All Bible scripts now use temporary directory for unzipping source files. Database size increased to 53 MB with 5 total versions (ESV, WEB, KJV, CUV, LIV).",
    28: "Optimized chunk size from 20MB to 10MB for better Metro bundler performance - now 6 chunks instead of 3 (10+10+10+10+10+3.12 MB)",
    29: "Resolved Song of Solomon in ESV",
    30: "Added notes db",
    31: "CRITICAL FIX: WEB parser now supports 'pi' (paragraph indent) class - fixes missing verses in Daniel 4 and other chapters. Previously only captured 2 verses in Daniel 4, now captures all 37 verses.",
    32: "Added NIV (New International Version) - 31,103 verses. Removed LIV (Lorem Ipsum test version). Database now contains 5 production Bible versions: ESV, WEB, NIV, KJV, CUV.",
    33: "Added NIV (New International Version) from proper html formatting",
    34: "Ensure NIV and ESV do not have duplicate verseLineID entries",
    35: "Only compressed database is loaded with the launch",
    36: "Default Bible version set to NIV for new users",
    37: "Fixed missing verses in CUV version",
    38: "Rebuild database to apply new CUV version",
    39: "Added bible plan feature",
    40: "Added bible plan grouping feature",
    41: "Stable plan IDs (format: group-y{year}q{quarter}) to prevent session references breaking on database regeneration",
    42: "Better apologetics question suggestions",
    43: "Bible plan content restructure: unified content array (intro/reading/recap) with flexible ordering, markdown support for text formatting",
    44: "Trigger reload",
    45: "Corrected Bible Plan reading display order",
    46: "Better recap summary",
  },
};

// Storage key for tracking user's current database version
export const DB_VERSION_KEY = "@parables/db_version";

// Embeddings database version - tied to main database version
// Increment when embeddings.db content changes
export const EMBEDDINGS_VERSION = {
  current: 11,
  changelog: {
    1: "Initial embeddings database with all-MiniLM-L6-v2 vectors",
    2: "Force fresh copy with SQLite version tracking fix",
    3: "Fixed embedding dimension to 1536 (OpenAI ada-002 model)",
    4: "Fixed book_id format (was stored as bookId*1000000, now extracted correctly)",
    5: "Corrected to 384-dim embeddings (all-MiniLM-L6-v2) for on-device semantic search",
    6: "Updated embeddings to improve search relevance",
    7: "Re-embedded with enriched description",
    8: "More search engine calculation",
    9: "Int8 quantization - 75% size reduction (229MB -> 62MB uncompressed, 166MB -> 41MB compressed)",
    10: "Added chunk loading for embeddings database",
    11: "Better embedding loading",
  },
};

export const EMBEDDINGS_VERSION_KEY = "@parables/embeddings_version";
