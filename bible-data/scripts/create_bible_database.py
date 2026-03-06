#!/usr/bin/env python3
"""
Create SQLite database from Bible JSON data with multi-version support
Also imports Bible reading plans from biblePlans.json
"""

import json
import sqlite3
import gzip
import shutil
import sys
from pathlib import Path

# Fix Windows console encoding for Unicode characters
if sys.platform == 'win32':
    try:
        # Force UTF-8 encoding on Windows
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except AttributeError:
        # Python < 3.7
        import codecs
        sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
        sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'strict')

# Paths
PROJECT_ROOT = Path(__file__).parent.parent.parent
BIBLE_DATA_DIR = PROJECT_ROOT / "bible-data" / "data"
# Store uncompressed database in bible-data/data
DB_PATH = BIBLE_DATA_DIR / "bible.db"
# Store compressed database in frontend/assets (this is what the app uses)
ASSETS_DIR = PROJECT_ROOT / "frontend" / "assets"

# Available Bible versions
BIBLE_VERSIONS = {
    "ESV": {
        "id": "ESV",
        "name": "English Standard Version",
        "abbreviation": "ESV",
        "language": "en",
        "file": "ESV_bibleData.json"
    },
    "WEB": {
        "id": "WEB",
        "name": "World English Bible",
        "abbreviation": "WEB",
        "language": "en",
        "file": "WEB_bibleData.json"
    },
    "KJV": {
        "id": "KJV",
        "name": "King James Version",
        "abbreviation": "KJV",
        "language": "en",
        "file": "KJV_bibleData.json"
    },
    "NIV": {
        "id": "NIV",
        "name": "New International Version",
        "abbreviation": "NIV",
        "language": "en",
        "file": "NIV_bibleData.json"
    },
    "CUV": {
        "id": "CUV",
        "name": "Chinese Union Version",
        "abbreviation": "和合本",
        "language": "zh",
        "file": "CUV_bibleData.json"
    }
}

def import_bible_plans(cursor, stats):
    """Import Bible reading plans from biblePlans.json

    New content structure:
    {
      "day": 1,
      "content": [
        { "type": "intro", "text": "..." },
        { "type": "reading", "reference": "...", "verseIdStart": ..., "verseIdEnd": ... },
        { "type": "recap", "text": "..." }
      ]
    }
    """
    # biblePlans.json is in bible-data/, not bible-data/data/
    plans_path = BIBLE_DATA_DIR.parent / "biblePlans.json"

    if not plans_path.exists():
        print(f"\n⚠️  Warning: {plans_path} not found, skipping Bible plans import")
        return

    print(f"\n📖 Loading Bible plans from {plans_path}...")

    with open(plans_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    plans = data.get('biblePlans', [])
    stats["plans"] = 0
    stats["plan_days"] = 0
    stats["plan_content"] = 0
    stats["plan_readings"] = 0
    stats["plan_intros"] = 0
    stats["plan_recaps"] = 0

    for plan in plans:
        # Insert the plan
        cursor.execute("""
            INSERT INTO bible_plans (id, name, description, duration_days, group_id, group_name, sort_order, source)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            plan['id'],
            plan['name'],
            plan.get('description'),
            plan['duration'],
            plan.get('group'),
            plan.get('groupName'),
            plan.get('order', 0),
            plan.get('source')
        ))
        stats["plans"] += 1

        # Insert each day and its content items
        for day_data in plan.get('plan', []):
            day_number = day_data['day']

            # Insert the day
            cursor.execute("""
                INSERT INTO bible_plan_days (plan_id, day_number)
                VALUES (?, ?)
            """, (plan['id'], day_number))

            plan_day_id = cursor.lastrowid
            stats["plan_days"] += 1

            # Insert content items for this day (new unified structure)
            for content_order, content_item in enumerate(day_data.get('content', [])):
                content_type = content_item['type']

                # Reading items have reference and verse IDs
                if content_type == 'reading':
                    cursor.execute("""
                        INSERT INTO bible_plan_content
                        (plan_day_id, content_order, content_type, reference, verse_id_start, verse_id_end)
                        VALUES (?, ?, ?, ?, ?, ?)
                    """, (
                        plan_day_id,
                        content_order,
                        content_type,
                        content_item['reference'],
                        content_item['verseIdStart'],
                        content_item['verseIdEnd']
                    ))
                    stats["plan_readings"] += 1
                else:
                    # Intro/recap items have text
                    cursor.execute("""
                        INSERT INTO bible_plan_content
                        (plan_day_id, content_order, content_type, text)
                        VALUES (?, ?, ?, ?)
                    """, (
                        plan_day_id,
                        content_order,
                        content_type,
                        content_item['text']
                    ))
                    if content_type == 'intro':
                        stats["plan_intros"] += 1
                    else:
                        stats["plan_recaps"] += 1

                stats["plan_content"] += 1

    print(f"   ✅ Imported {stats['plans']} plans, {stats['plan_days']} days, {stats['plan_content']} content items")
    print(f"      ({stats['plan_readings']} readings, {stats['plan_intros']} intros, {stats['plan_recaps']} recaps)")


def create_database():
    """Create and populate SQLite database from JSON with multi-version support"""

    # Create database
    print(f"Creating database at {DB_PATH}...")
    if DB_PATH.exists():
        DB_PATH.unlink()  # Remove existing database

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Create tables with optimized schema for multi-version support
    cursor.executescript("""
        -- Bible versions table
        CREATE TABLE bible_versions (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            abbreviation TEXT NOT NULL,
            language TEXT NOT NULL,
            is_default BOOLEAN DEFAULT 0
        );

        -- Books table (common across all versions)
        CREATE TABLE books (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            name_en TEXT,
            testament TEXT NOT NULL,
            book_order INTEGER NOT NULL,
            abbreviation TEXT
        );

        -- Chapters table (common across all versions)
        CREATE TABLE chapters (
            id INTEGER PRIMARY KEY,
            book_id INTEGER NOT NULL,
            chapter_number INTEGER NOT NULL,
            FOREIGN KEY (book_id) REFERENCES books(id)
        );

        -- Verses table (common entity across all versions)
        CREATE TABLE verses (
            id INTEGER PRIMARY KEY,  -- Verse ID like 40013014 for Matthew 13:14
            chapter_id INTEGER NOT NULL,
            verse_number INTEGER NOT NULL,
            FOREIGN KEY (chapter_id) REFERENCES chapters(id),
            UNIQUE(chapter_id, verse_number)
        );

        -- Sections table (version-specific)
        CREATE TABLE sections (
            id TEXT PRIMARY KEY,  -- Changed to TEXT to support version prefixes
            version_id TEXT NOT NULL,
            chapter_id INTEGER NOT NULL,
            title TEXT,
            subtitle TEXT,
            section_order INTEGER NOT NULL,
            FOREIGN KEY (version_id) REFERENCES bible_versions(id),
            FOREIGN KEY (chapter_id) REFERENCES chapters(id)
        );

        -- Paragraphs table (version-specific)
        CREATE TABLE paragraphs (
            id TEXT PRIMARY KEY,  -- Changed to TEXT to support version prefixes
            version_id TEXT NOT NULL,
            section_id TEXT NOT NULL,  -- Changed to TEXT to match sections table
            paragraph_order INTEGER NOT NULL,
            is_poetry BOOLEAN DEFAULT 0,
            FOREIGN KEY (version_id) REFERENCES bible_versions(id),
            FOREIGN KEY (section_id) REFERENCES sections(id)
        );

        -- Verse lines table (version-specific text)
        CREATE TABLE verse_lines (
            id TEXT NOT NULL,  -- Line ID like "40013014_0", "40013014_1"
            version_id TEXT NOT NULL,
            verse_id INTEGER NOT NULL,
            paragraph_id TEXT NOT NULL,  -- Changed to TEXT to match paragraphs table
            text TEXT NOT NULL,
            indent_level INTEGER DEFAULT 0,
            is_isolated BOOLEAN DEFAULT 0,
            line_order INTEGER DEFAULT 0,
            show_verse_number BOOLEAN DEFAULT 0,
            sequence_order INTEGER NOT NULL,  -- Added for proper ordering in queries
            PRIMARY KEY (version_id, id),  -- Simplified primary key
            FOREIGN KEY (version_id) REFERENCES bible_versions(id),
            FOREIGN KEY (verse_id) REFERENCES verses(id),
            FOREIGN KEY (paragraph_id) REFERENCES paragraphs(id)
        );

        -- Create indexes for performance
        CREATE INDEX idx_chapters_book ON chapters(book_id);
        CREATE INDEX idx_verses_chapter ON verses(chapter_id);
        CREATE INDEX idx_verses_number ON verses(verse_number);
        CREATE INDEX idx_sections_version_chapter ON sections(version_id, chapter_id);
        CREATE INDEX idx_paragraphs_version_section ON paragraphs(version_id, section_id);
        CREATE INDEX idx_verse_lines_version_verse ON verse_lines(version_id, verse_id);
        CREATE INDEX idx_verse_lines_version_paragraph ON verse_lines(version_id, paragraph_id);
        CREATE INDEX idx_verse_lines_sequence ON verse_lines(version_id, sequence_order);

        -- Bible reading plans (bundled with app)
        CREATE TABLE bible_plans (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            duration_days INTEGER NOT NULL,
            group_id TEXT,
            group_name TEXT,
            sort_order INTEGER DEFAULT 0,
            source TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Index for grouping plans
        CREATE INDEX idx_bible_plans_group ON bible_plans(group_id, sort_order);

        -- Plan days
        CREATE TABLE bible_plan_days (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            plan_id TEXT NOT NULL REFERENCES bible_plans(id),
            day_number INTEGER NOT NULL,
            UNIQUE(plan_id, day_number)
        );

        -- Plan content (unified content items: intro, reading, recap)
        -- Replaces the old bible_plan_readings table with a flexible content array
        CREATE TABLE bible_plan_content (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            plan_day_id INTEGER NOT NULL REFERENCES bible_plan_days(id),
            content_order INTEGER NOT NULL,     -- Array index (0, 1, 2...)
            content_type TEXT NOT NULL,         -- 'intro', 'reading', 'recap'
            -- For readings:
            reference TEXT,
            verse_id_start INTEGER,
            verse_id_end INTEGER,
            -- For intro/recap:
            text TEXT,
            UNIQUE(plan_day_id, content_order)
        );

        -- Indexes for plan queries
        CREATE INDEX idx_plan_days_plan_id ON bible_plan_days(plan_id);
        CREATE INDEX idx_plan_content_day ON bible_plan_content(plan_day_id, content_order);
    """)

    print("Database schema created...")

    # Track statistics
    stats = {
        "versions": 0,
        "books": 0,
        "chapters": 0,
        "verses": 0,
        "verse_lines": {}  # Per version
    }

    # Process each Bible version
    for version_key, version_info in BIBLE_VERSIONS.items():
        json_path = BIBLE_DATA_DIR / version_info["file"]

        if not json_path.exists():
            print(f"Warning: {json_path} not found, skipping {version_key}")
            continue

        print(f"\nLoading {version_key} from {json_path}...")
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        # Insert Bible version
        cursor.execute("""
            INSERT INTO bible_versions (id, name, abbreviation, language, is_default)
            VALUES (?, ?, ?, ?, ?)
        """, (
            version_info["id"],
            version_info["name"],
            version_info["abbreviation"],
            version_info["language"],
            1 if version_key == "ESV" else 0  # ESV is default
        ))
        stats["versions"] += 1
        stats["verse_lines"][version_key] = 0

        # Track what we've already inserted (for shared entities)
        seen_books = set()
        seen_chapters = set()
        seen_verses = set()
        seen_composite_keys = set()

        # Insert data for this version
        for book_data in data['books']:
            # Insert book (only if not already inserted)
            if book_data['id'] not in seen_books:
                try:
                    # Get English name if available (for CUV which has both)
                    name_en = book_data.get('nameEn')
                    name = book_data.get('name')

                    cursor.execute("""
                        INSERT INTO books (id, name, name_en, testament, book_order)
                        VALUES (?, ?, ?, ?, ?)
                    """, (
                        book_data['id'],
                        name,
                        name_en,
                        book_data['testament'],
                        book_data['id']
                    ))
                    stats["books"] += 1
                except sqlite3.IntegrityError:
                    pass  # Book already exists from another version
                seen_books.add(book_data['id'])

            for chapter_data in book_data['chapters']:
                # Insert chapter (only if not already inserted)
                if chapter_data['id'] not in seen_chapters:
                    try:
                        cursor.execute("""
                            INSERT INTO chapters (id, book_id, chapter_number)
                            VALUES (?, ?, ?)
                        """, (
                            chapter_data['id'],
                            chapter_data['bookId'],
                            chapter_data['chapterNumber']
                        ))
                        stats["chapters"] += 1
                    except sqlite3.IntegrityError:
                        pass  # Chapter already exists
                    seen_chapters.add(chapter_data['id'])

                # Process version-specific content
                for section_idx, section_data in enumerate(chapter_data['sections']):
                    # Create version-specific section ID to avoid conflicts
                    version_section_id = f"{version_key}_{section_data['id']}"

                    # Insert section (version-specific)
                    cursor.execute("""
                        INSERT INTO sections (id, version_id, chapter_id, title, subtitle, section_order)
                        VALUES (?, ?, ?, ?, ?, ?)
                    """, (
                        version_section_id,
                        version_key,
                        section_data['chapterId'],
                        section_data.get('title'),
                        section_data.get('subtitle'),
                        section_idx
                    ))

                    for para_idx, paragraph_data in enumerate(section_data['paragraphs']):
                        # Check if poetry
                        is_poetry = any(vl.get('indentLevel', 0) > 0 for vl in paragraph_data['verseLines'])

                        # Create version-specific paragraph ID
                        version_para_id = f"{version_key}_{paragraph_data['id']}"

                        # Insert paragraph (version-specific)
                        cursor.execute("""
                            INSERT INTO paragraphs (id, version_id, section_id, paragraph_order, is_poetry)
                            VALUES (?, ?, ?, ?, ?)
                        """, (
                            version_para_id,
                            version_key,
                            version_section_id,  # Use the version-specific section ID
                            para_idx,
                            1 if is_poetry else 0
                        ))

                        verse_line_sequence = 0  # Track sequence within this version
                        for verse_line in paragraph_data['verseLines']:
                            # Skip if missing required fields
                            if 'id' not in verse_line or 'text' not in verse_line:
                                print(f"Warning: Skipping verse line with missing fields: {verse_line}")
                                continue

                            # Get verse info
                            verse_line_id = verse_line['id']

                            # Extract verse ID from verse line ID
                            verse_id_num = int(verse_line_id.split('_')[0]) if '_' in verse_line_id else int(verse_line.get('verseId', 0))

                            # Extract line order from ID
                            line_order = int(verse_line_id.split('_')[1]) if '_' in verse_line_id else 0

                            # Insert verse if it's a new one (shared across versions)
                            if verse_line.get('verseNumber') or line_order == 0:
                                if verse_id_num not in seen_verses:
                                    chapter_id = (verse_id_num // 1000) * 1000
                                    verse_num = verse_id_num % 1000
                                    actual_verse_num = verse_line.get('verseNumber', verse_num)

                                    try:
                                        cursor.execute("""
                                            INSERT INTO verses (id, chapter_id, verse_number)
                                            VALUES (?, ?, ?)
                                        """, (verse_id_num, chapter_id, actual_verse_num))
                                        seen_verses.add(verse_id_num)
                                        stats["verses"] += 1
                                    except sqlite3.IntegrityError:
                                        pass  # Verse already exists

                            # Create composite key for verse line
                            composite_key = (version_key, verse_line_id)

                            # Skip if this exact combination already exists
                            if composite_key in seen_composite_keys:
                                print(f"Warning: Duplicate composite key skipped: version {version_key}, verse line {verse_line_id}")
                                continue
                            seen_composite_keys.add(composite_key)

                            # Insert verse line (version-specific)
                            show_verse_number = 1 if 'verseNumber' in verse_line else 0

                            cursor.execute("""
                                INSERT INTO verse_lines (id, version_id, verse_id, paragraph_id, text, indent_level, is_isolated, line_order, show_verse_number, sequence_order)
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                            """, (
                                verse_line_id,
                                version_key,
                                verse_id_num,
                                version_para_id,  # Use the version-specific paragraph ID
                                verse_line['text'],
                                verse_line.get('indentLevel', 0),
                                1 if verse_line.get('isIsolated', False) else 0,
                                line_order,
                                show_verse_number,
                                verse_line_sequence  # Add sequence for proper ordering
                            ))
                            stats["verse_lines"][version_key] += 1
                            verse_line_sequence += 1

    # Import Bible reading plans
    import_bible_plans(cursor, stats)

    # Commit and optimize
    conn.commit()

    # Run VACUUM to compress and optimize
    print("\n🔧 Optimizing database with VACUUM...")
    cursor.execute("VACUUM")

    # Analyze for query optimization
    print("🔧 Running ANALYZE for query optimization...")
    cursor.execute("ANALYZE")

    # Get database size before gzip
    cursor.execute("SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()")
    db_size = cursor.fetchone()[0]

    conn.close()

    print(f"\n✅ Database created successfully!")
    print(f"Statistics:")
    print(f"  - Bible versions: {stats['versions']}")
    print(f"  - Books: {stats['books']}")
    print(f"  - Chapters: {stats['chapters']}")
    print(f"  - Verses: {stats['verses']}")
    for version, count in stats["verse_lines"].items():
        print(f"  - Verse lines ({version}): {count}")
    if "plans" in stats:
        print(f"  - Bible plans: {stats['plans']}")
        print(f"  - Plan days: {stats['plan_days']}")
        print(f"  - Plan readings: {stats['plan_readings']}")
    print(f"  - Optimized size: {db_size / 1024 / 1024:.2f} MB")
    print(f"  - Location: {DB_PATH}")

    # Compress and copy to assets
    compress_database(db_size)

def compress_database(original_size: int):
    """Compress database and copy to frontend/assets"""
    print(f"\n📦 Preparing compressed database for app...")

    # Backup stays in bible-data/data
    backup_path = DB_PATH.with_suffix('.db.backup')
    print(f"📋 Creating backup at {backup_path.relative_to(PROJECT_ROOT)}...")
    shutil.copy2(DB_PATH, backup_path)

    # Ensure assets directory exists
    ASSETS_DIR.mkdir(parents=True, exist_ok=True)

    # Compress database
    gz_dest = ASSETS_DIR / "bible.db.gz"
    print(f"\n📄 Compressing database...")
    print(f"   Source: {DB_PATH.relative_to(PROJECT_ROOT)}")
    print(f"   Destination: {gz_dest.relative_to(PROJECT_ROOT)}")

    with open(DB_PATH, 'rb') as f_in:
        with gzip.open(gz_dest, 'wb', compresslevel=9) as f_out:
            shutil.copyfileobj(f_in, f_out)

    compressed_size = gz_dest.stat().st_size
    original_size_mb = original_size / 1024 / 1024
    compressed_size_mb = compressed_size / 1024 / 1024
    compression_ratio = (1 - compressed_size / original_size) * 100

    print(f"   ✅ Compressed: {original_size_mb:.2f} MB → {compressed_size_mb:.2f} MB ({compression_ratio:.1f}% reduction)")

    # Verify the compressed database
    verify_compressed_database(gz_dest)

def verify_compressed_database(gz_path: Path):
    """Verify the compressed database integrity"""
    print(f"\n🔍 Verifying compressed database integrity...")

    try:
        # Decompress to temporary location
        temp_db = gz_path.parent / "bible-temp.db"

        with gzip.open(gz_path, 'rb') as f_in:
            with open(temp_db, 'wb') as f_out:
                shutil.copyfileobj(f_in, f_out)

        # Check integrity
        conn = sqlite3.connect(temp_db)
        cursor = conn.cursor()

        # Integrity check
        cursor.execute("PRAGMA integrity_check")
        integrity = cursor.fetchone()[0]

        # Count records
        cursor.execute("SELECT COUNT(*) FROM bible_versions")
        version_count = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM verse_lines")
        verse_line_count = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM books")
        book_count = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM bible_plans")
        plan_count = cursor.fetchone()[0]

        conn.close()

        # Clean up temp file
        temp_db.unlink()

        print(f"   Integrity: {integrity}")
        print(f"   Bible versions: {version_count}")
        print(f"   Verse lines: {verse_line_count}")
        print(f"   Books: {book_count}")
        print(f"   Bible plans: {plan_count}")

        if integrity == "ok":
            print(f"\n✅ Database integrity verified!")
            print(f"🎉 {gz_path.name} is ready to use in your Expo app!")
        else:
            print(f"\n❌ Integrity check failed: {integrity}")

    except Exception as e:
        print(f"❌ Verification failed: {e}")

if __name__ == "__main__":
    create_database()
