# Bible Data Scripts

This folder contains scripts for processing Bible data and generating the SQLite database for the Parables app.

## Scripts Overview

### Python Scripts

#### `create_bible_database.py` (Main Script)
Creates a SQLite database from Bible JSON files with automatic compression.

**What it does:**
1. Creates multi-version SQLite database from JSON files
2. Runs VACUUM to optimize and compress
3. Runs ANALYZE for query optimization
4. Compresses to .db.gz with maximum gzip compression
5. Verifies integrity of compressed database
6. Creates backup of uncompressed database

**Usage:**
```bash
python bible-data/scripts/create_bible_database.py
```

**Output:**
- `bible-data/data/bible.db` - Optimized uncompressed database (~32MB)
- `frontend/assets/bible.db.gz` - Compressed database (~8MB) ✅ **Use this in Expo**
- `bible-data/data/bible.db.backup` - Backup of uncompressed database

**Supported versions:**
- ESV (English Standard Version)
- WEB (World English Bible)
- LIV (Lorem Ipsum Version - development only)

Add new versions by:
1. Adding JSON file to `bible-data/data/`
2. Adding version info to `BIBLE_VERSIONS` dict in script

#### `webBibleScript.js`
Parses WEB Bible HTML source and generates JSON data.

**Usage:**
```bash
node bible-data/scripts/webBibleScript.js
```

**Output:**
- `bible-data/data/WEB_bibleData.json`

### Node.js Utility Scripts

These scripts can be run manually if needed, but `create_bible_database.py` now handles compression automatically.

#### `compress-bible-db.js`
Optimizes database with SQLite VACUUM (included in Python script).

**Usage:**
```bash
node bible-data/scripts/compress-bible-db.js
```

#### `gzip-bible-db.js`
Compresses database with gzip (included in Python script).

**Usage:**
```bash
node bible-data/scripts/gzip-bible-db.js
```

#### `verify-gzip-db.js`
Verifies integrity of compressed database (included in Python script).

**Usage:**
```bash
node bible-data/scripts/verify-gzip-db.js
```

## Workflow

### Full Database Rebuild

```bash
# 1. Generate database with automatic compression
python bible-data/scripts/create_bible_database.py

# That's it! The script automatically:
# - Creates optimized SQLite database
# - Compresses to .db.gz format
# - Verifies integrity
# - Creates backup
```

### Adding a New Bible Version

```bash
# 1. Add JSON file to bible-data/data/
#    (or create parser script like webBibleScript.js)

# 2. Edit create_bible_database.py
#    Add version to BIBLE_VERSIONS dict:
BIBLE_VERSIONS = {
    # ... existing versions ...
    "NIV": {
        "id": "NIV",
        "name": "New International Version",
        "abbreviation": "NIV",
        "language": "en",
        "file": "NIV_bibleData.json"
    }
}

# 3. Run database creation
python bible-data/scripts/create_bible_database.py
```

### Manual Compression (if needed)

```bash
# If you need to compress an existing database:

# Step 1: Optimize
node bible-data/scripts/compress-bible-db.js

# Step 2: Compress
node bible-data/scripts/gzip-bible-db.js

# Step 3: Verify
node bible-data/scripts/verify-gzip-db.js
```

## Output Files

After running `create_bible_database.py`:

```
bible-data/data/
  bible.db          (~32MB) - Optimized uncompressed (gitignore)
  bible.db.backup   (~32MB) - Backup of uncompressed (gitignore)
  *_bibleData.json  - Source JSON files

frontend/assets/
  bible.db.gz       (~8MB)  - Compressed for Expo Go ✅ COMMIT THIS
```

**Important:** Only `frontend/assets/bible.db.gz` should be committed to the repository. The uncompressed files in `bible-data/data/` are for development and should be gitignored.

## Database Schema

The database uses a multi-version architecture:

**Shared tables:**
- `books` - Bible books (common across versions)
- `chapters` - Chapter structure (common across versions)
- `verses` - Verse identifiers (common across versions)

**Version-specific tables:**
- `bible_versions` - Version metadata
- `sections` - Headings and sections (per version)
- `paragraphs` - Paragraph structure (per version)
- `verse_lines` - Actual verse text (per version)

This design allows:
- Multiple Bible versions in one database
- Efficient storage (shared structure)
- Easy version switching
- Fast queries with proper indexes

## Compression Details

**VACUUM optimization:**
- Removes free pages
- Defragments database
- Typically saves 4-5% of space

**GZIP compression:**
- Maximum compression (level 9)
- Reduces size by ~74%
- 34MB → 8.24MB
- Safe for Expo Go (under 25MB limit)

**Decompression in app:**
- Automatic on first launch
- Uses `pako` library
- Takes ~3-5 seconds
- Cached for subsequent launches

See `frontend/utils/dbDecompressor.ts` for decompression implementation.

## Troubleshooting

### Database too large after compression
- Remove unused Bible versions
- Check for duplicate data
- Verify VACUUM is running

### Compression fails
- Check Node.js version (needs >=14)
- Verify better-sqlite3 is installed
- Check file permissions

### Integrity check fails
- Re-run database creation
- Check source JSON files
- Verify gzip compression level

## Dependencies

**Python:**
- Python 3.6+
- Standard library only (json, sqlite3, gzip, shutil, pathlib)

**Node.js (for manual scripts):**
- better-sqlite3 (installed in frontend/)
- pako (for app decompression)

## Performance Metrics

**Database generation:** ~10-20 seconds
**VACUUM optimization:** ~2-5 seconds
**GZIP compression:** ~3-5 seconds
**Verification:** ~2-3 seconds
**Total:** ~20-35 seconds

**Database stats:**
- 3 Bible versions
- 127,028 verse lines
- 66 books
- 1,189 chapters
- ~31,000 verses
