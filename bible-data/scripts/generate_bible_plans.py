#!/usr/bin/env python3
"""
Generate Bible Plans JSON file with verse ID ranges.

This script takes reading plan data and converts chapter references
to verseIdStart and verseIdEnd values by querying the bible.db.

Usage:
    python generate_bible_plans.py

Output:
    ../biblePlans.json
"""

import sqlite3
import json
import os

# Book name to ID mapping (matching bibleBookMappings.ts)
BOOK_NAME_TO_ID = {
    # Old Testament
    "Genesis": 1, "Exodus": 2, "Leviticus": 3, "Numbers": 4, "Deuteronomy": 5,
    "Joshua": 6, "Judges": 7, "Ruth": 8, "1 Samuel": 9, "2 Samuel": 10,
    "1 Kings": 11, "2 Kings": 12, "1 Chronicles": 13, "2 Chronicles": 14,
    "Ezra": 15, "Nehemiah": 16, "Esther": 17, "Job": 18, "Psalms": 19,
    "Proverbs": 20, "Ecclesiastes": 21, "Song of Solomon": 22, "Isaiah": 23,
    "Jeremiah": 24, "Lamentations": 25, "Ezekiel": 26, "Daniel": 27,
    "Hosea": 28, "Joel": 29, "Amos": 30, "Obadiah": 31, "Jonah": 32,
    "Micah": 33, "Nahum": 34, "Habakkuk": 35, "Zephaniah": 36, "Haggai": 37,
    "Zechariah": 38, "Malachi": 39,
    # New Testament
    "Matthew": 40, "Mark": 41, "Luke": 42, "John": 43, "Acts": 44,
    "Romans": 45, "1 Corinthians": 46, "2 Corinthians": 47, "Galatians": 48,
    "Ephesians": 49, "Philippians": 50, "Colossians": 51,
    "1 Thessalonians": 52, "2 Thessalonians": 53, "1 Timothy": 54,
    "2 Timothy": 55, "Titus": 56, "Philemon": 57, "Hebrews": 58,
    "James": 59, "1 Peter": 60, "2 Peter": 61, "1 John": 62,
    "2 John": 63, "3 John": 64, "Jude": 65, "Revelation": 66,
    # Aliases
    "Song of Songs": 22, "Psalm": 19,
}


def parse_reference(ref: str) -> tuple:
    """
    Parse a reference like 'Isaiah 42' or 'Psalms 107' into (book_id, chapter).

    Returns (book_id, chapter_number) or (None, None) if parsing fails.
    """
    ref = ref.strip()

    # Handle numbered books like "1 Thessalonians 1"
    parts = ref.rsplit(" ", 1)
    if len(parts) != 2:
        print(f"Warning: Could not parse reference: {ref}")
        return None, None

    book_name = parts[0]
    try:
        chapter = int(parts[1])
    except ValueError:
        print(f"Warning: Could not parse chapter number from: {ref}")
        return None, None

    book_id = BOOK_NAME_TO_ID.get(book_name)
    if book_id is None:
        print(f"Warning: Unknown book name: {book_name}")
        return None, None

    return book_id, chapter


def get_verse_range(cursor, book_id: int, chapter: int) -> tuple:
    """
    Query the database for the first and last verse IDs in a chapter.

    verseId format: bookId * 1000000 + chapterNumber * 1000 + verseNumber
    """
    # Calculate the chapter ID range
    chapter_start = book_id * 1000000 + chapter * 1000
    chapter_end = chapter_start + 999

    # Query for min and max verse IDs in this chapter
    # Note: column is 'id' not 'verse_id'
    cursor.execute("""
        SELECT MIN(id), MAX(id)
        FROM verses
        WHERE id >= ? AND id <= ?
    """, (chapter_start, chapter_end))

    result = cursor.fetchone()
    if result and result[0] is not None:
        return result[0], result[1]

    # Fallback: calculate based on standard format
    verse_id_start = book_id * 1000000 + chapter * 1000 + 1
    # Assume typical chapter length for fallback
    cursor.execute("""
        SELECT COUNT(*) FROM verses
        WHERE id >= ? AND id <= ?
    """, (chapter_start, chapter_end))
    count = cursor.fetchone()[0]
    if count > 0:
        verse_id_end = book_id * 1000000 + chapter * 1000 + count
    else:
        verse_id_end = verse_id_start  # Single verse chapter fallback

    return verse_id_start, verse_id_end


# Reading plan data (Year 3, Quarter 1)
READING_PLAN_DATA = [
    {"day": 1, "refs": ["Isaiah 42", "Psalms 107"]},
    {"day": 2, "refs": ["Isaiah 43"]},
    {"day": 3, "refs": ["Psalms 106"]},
    {"day": 4, "refs": ["Isaiah 44"]},
    {"day": 5, "refs": ["Isaiah 45"]},
    {"day": 6, "refs": ["Daniel 4"]},
    {"day": 7, "refs": ["Isaiah 46"]},
    {"day": 8, "refs": ["Isaiah 47"]},
    {"day": 9, "refs": ["Daniel 5"]},
    {"day": 10, "refs": ["Isaiah 48"]},
    {"day": 11, "refs": ["Isaiah 49"]},
    {"day": 12, "refs": ["Isaiah 50"]},
    {"day": 13, "refs": ["Proverbs 20"]},
    {"day": 14, "refs": ["Isaiah 51"]},
    {"day": 15, "refs": ["Isaiah 52"]},
    {"day": 16, "refs": ["Daniel 6"]},
    {"day": 17, "refs": ["Isaiah 53"]},
    {"day": 18, "refs": ["Isaiah 54"]},
    {"day": 19, "refs": ["Daniel 7"]},
    {"day": 20, "refs": ["Isaiah 55", "Psalms 109"]},
    {"day": 21, "refs": ["Isaiah 56"]},
    {"day": 22, "refs": ["Psalms 108"]},
    {"day": 23, "refs": ["Isaiah 57"]},
    {"day": 24, "refs": ["Isaiah 58"]},
    {"day": 25, "refs": ["Daniel 8"]},
    {"day": 26, "refs": ["Isaiah 59"]},
    {"day": 27, "refs": ["Isaiah 60"]},
    {"day": 28, "refs": ["Daniel 9"]},
    {"day": 29, "refs": ["Isaiah 61"]},
    {"day": 30, "refs": ["Isaiah 62"]},
    {"day": 31, "refs": ["Daniel 10"]},
    {"day": 32, "refs": ["Isaiah 63"]},
    {"day": 33, "refs": ["Isaiah 64"]},
    {"day": 34, "refs": ["Daniel 11"]},
    {"day": 35, "refs": ["Isaiah 65"]},
    {"day": 36, "refs": ["Isaiah 66", "Psalms 111"]},
    {"day": 37, "refs": ["Daniel 12"]},
    {"day": 38, "refs": ["Psalms 110"]},
    {"day": 39, "refs": ["Song of Songs 1"]},
    {"day": 40, "refs": ["Song of Songs 2"]},
    {"day": 41, "refs": ["1 Thessalonians 1"]},
    {"day": 42, "refs": ["Song of Songs 3"]},
    {"day": 43, "refs": ["Song of Songs 4"]},
    {"day": 44, "refs": ["1 Thessalonians 2"]},
    {"day": 45, "refs": ["Song of Songs 5"]},
    {"day": 46, "refs": ["Song of Songs 6"]},
    {"day": 47, "refs": ["1 Thessalonians 3"]},
    {"day": 48, "refs": ["Song of Songs 7"]},
    {"day": 49, "refs": ["Song of Songs 8"]},
    {"day": 50, "refs": ["Proverbs 21"]},
    {"day": 51, "refs": ["Job 1"]},
    {"day": 52, "refs": ["Job 2"]},
    {"day": 53, "refs": ["1 Thessalonians 4"]},
    {"day": 54, "refs": ["Job 3"]},
    {"day": 55, "refs": ["Job 4", "Psalms 113", "Psalms 114"]},
    {"day": 56, "refs": ["1 Thessalonians 5"]},
    {"day": 57, "refs": ["Psalms 112"]},
    {"day": 58, "refs": ["Job 5"]},
    {"day": 59, "refs": ["Job 6"]},
    {"day": 60, "refs": ["2 Thessalonians 1"]},
    {"day": 61, "refs": ["Job 7", "Psalms 116"]},
    {"day": 62, "refs": ["Job 8"]},
    {"day": 63, "refs": ["Psalms 115"]},
    {"day": 64, "refs": ["Job 9"]},
    {"day": 65, "refs": ["Job 10"]},
    {"day": 66, "refs": ["2 Thessalonians 2"]},
    {"day": 67, "refs": ["Job 11"]},
    {"day": 68, "refs": ["Proverbs 22"]},
    {"day": 69, "refs": ["Job 12"]},
    {"day": 70, "refs": ["2 Thessalonians 3"]},
    {"day": 71, "refs": ["Job 13"]},
    {"day": 72, "refs": ["Job 14"]},
    {"day": 73, "refs": ["Titus 1"]},
    {"day": 74, "refs": ["Job 15", "Psalms 118"]},
    {"day": 75, "refs": ["Job 16"]},
    {"day": 76, "refs": ["Psalms 117"]},
    {"day": 77, "refs": ["Job 17"]},
    {"day": 78, "refs": ["Job 18"]},
    {"day": 79, "refs": ["Titus 2"]},
    {"day": 80, "refs": ["Job 19"]},
    {"day": 81, "refs": ["Job 20"]},
    {"day": 82, "refs": ["Titus 3"]},
    {"day": 83, "refs": ["Job 21"]},
    {"day": 84, "refs": ["Job 22"]},
    {"day": 85, "refs": ["Jude 1"]},
    {"day": 86, "refs": ["Job 23"]},
    {"day": 87, "refs": ["Job 24"]},
    {"day": 88, "refs": ["Philemon 1"]},
    {"day": 89, "refs": ["Job 25"]},
    {"day": 90, "refs": ["Job 26"]},
]


def main():
    # Get script directory
    script_dir = os.path.dirname(os.path.abspath(__file__))

    # Database path
    db_path = os.path.join(script_dir, "..", "data", "bible.db")

    if not os.path.exists(db_path):
        print(f"Error: Database not found at {db_path}")
        print("Please ensure bible.db exists in bible-data/data/")
        return

    # Connect to database
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Check table structure
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = cursor.fetchall()
    print(f"Available tables: {[t[0] for t in tables]}")

    # Get column names for verses table
    cursor.execute("PRAGMA table_info(verses)")
    columns = cursor.fetchall()
    print(f"Verses table columns: {[c[1] for c in columns]}")

    # Build the plan
    plan_days = []

    for day_data in READING_PLAN_DATA:
        day_num = day_data["day"]
        readings = []

        for ref in day_data["refs"]:
            book_id, chapter = parse_reference(ref)
            if book_id is None:
                continue

            verse_id_start, verse_id_end = get_verse_range(cursor, book_id, chapter)
            readings.append({
                "reference": ref,
                "verseIdStart": verse_id_start,
                "verseIdEnd": verse_id_end
            })

        plan_days.append({
            "day": day_num,
            "readings": readings
        })

    conn.close()

    # Build final structure
    bible_plans = {
        "biblePlans": [
            {
                "id": "chapter-a-day-3-years-y3q1",
                "name": "A Chapter A Day: Reading The Bible In 3 Years (Year 3, Quarter 1)",
                "description": "Read the entire Bible over a 3-year period by committing to just one or two chapters a day.",
                "duration": 90,
                "source": "bible.com",
                "plan": plan_days
            }
        ]
    }

    # Output path
    output_path = os.path.join(script_dir, "..", "biblePlans.json")

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(bible_plans, f, indent=2, ensure_ascii=False)

    print(f"Generated {output_path}")
    print(f"Total days: {len(plan_days)}")
    total_readings = sum(len(d["readings"]) for d in plan_days)
    print(f"Total readings: {total_readings}")


if __name__ == "__main__":
    main()
