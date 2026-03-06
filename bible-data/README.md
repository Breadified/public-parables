# Bible Data Processing Scripts

This directory contains scripts for fetching, processing, and building the Bible database for the Parables app.

## Directory Structure

```
bible-data/
├── source/              # Source data from ESV API
│   ├── esvSourceBibleChapter.json  # All fetched chapters (backup)
│   └── sampleBibleChapter.json     # Current chapter being processed
├── data/                # Processed Bible data
│   └── ESV_bibleData.json          # Final structured Bible data
├── scripts/             # Processing scripts
│   ├── esvFetchBibleChapters.js    # Fetches chapters from ESV API
│   ├── esvBibleScript.js           # Processes HTML into structured JSON
│   ├── create_bible_database.py   # Creates SQLite database
│   └── create_lorem_bible.py      # Creates Lorem Ipsum test version
└── package.json         # Node.js dependencies
```

## Setup

Install dependencies:
```bash
npm install
```

## Usage

### 1. Fetch Bible Chapters from ESV API

Fetches all Bible chapters from the ESV API and processes them:

```bash
npm run fetch
```

This will:
- Fetch chapters starting from Genesis 1
- Save raw data to `source/esvSourceBibleChapter.json`
- Automatically process each chapter with `esvBibleScript.js`
- Build the final `data/ESV_bibleData.json`

### 2. Build SQLite Database

Once you have `data/ESV_bibleData.json`, create the SQLite database:

```bash
npm run build-db
```

This creates `../frontend/assets/bible.db` with the subtitle field included.

### 3. Build Lorem Ipsum Test Version (Optional)

Create a Lorem Ipsum version for development testing:

```bash
npm run build-lorem
```

## ESV API

The scripts use the ESV API with the following configuration:
- API Key: Configured in `esvFetchBibleChapters.js`
- Endpoint: `https://api.esv.org/v3/passage/html/`
- Rate limiting: 1 second delay between requests

## Data Flow

```
ESV API → source/esvSourceBibleChapter.json
         ↓
    esvBibleScript.js
         ↓
    data/ESV_bibleData.json
         ↓
    create_bible_database.py
         ↓
    frontend/assets/bible.db
```

## Subtitle Feature

The scripts now support section subtitles (h4 elements):
- Used for Psalm titles
- Acrostic headers (e.g., "Aleph", "Beth")
- Speaker labels
- Special annotations

These are stored in the database `sections.subtitle` field and rendered in the app.
