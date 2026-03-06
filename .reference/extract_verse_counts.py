#!/usr/bin/env python3
"""Extract verse counts per chapter from Bible database."""

import sqlite3
import json
import os

DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'bible-data', 'data', 'bible.db')
OUTPUT_PATH = os.path.join(os.path.dirname(__file__), 'verse_counts.json')

def main():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Query max verse number for each chapter
    # Chapter ID format: bookId * 1000000 + chapterNum * 1000
    cursor.execute("""
        SELECT
            chapter_id,
            MAX(verse_number) as max_verse
        FROM verses
        GROUP BY chapter_id
        ORDER BY chapter_id
    """)

    verse_counts = {}
    for row in cursor.fetchall():
        chapter_id = row[0]
        max_verse = row[1]

        # Parse chapter_id to book_id and chapter_num
        book_id = chapter_id // 1000000
        chapter_num = (chapter_id % 1000000) // 1000

        # Store as "bookId_chapterNum": maxVerse
        key = f"{book_id}_{chapter_num}"
        verse_counts[key] = max_verse

    conn.close()

    # Write to JSON
    with open(OUTPUT_PATH, 'w') as f:
        json.dump(verse_counts, f, indent=2)

    print(f"Extracted {len(verse_counts)} chapter verse counts to {OUTPUT_PATH}")

    # Print some examples
    examples = [("1_1", "Genesis 1"), ("1_50", "Genesis 50"), ("40_1", "Matthew 1"), ("66_22", "Revelation 22")]
    for key, name in examples:
        if key in verse_counts:
            print(f"  {name}: {verse_counts[key]} verses")

if __name__ == '__main__':
    main()
