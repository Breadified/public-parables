#!/usr/bin/env python3
"""Comprehensive verification - check ALL books, chapters, and verses."""

import sqlite3
from pathlib import Path

# Expected chapter counts per book
EXPECTED_CHAPTERS = [
    (1, "Genesis", 50), (2, "Exodus", 40), (3, "Leviticus", 27),
    (4, "Numbers", 36), (5, "Deuteronomy", 34), (6, "Joshua", 24),
    (7, "Judges", 21), (8, "Ruth", 4), (9, "1 Samuel", 31),
    (10, "2 Samuel", 24), (11, "1 Kings", 22), (12, "2 Kings", 25),
    (13, "1 Chronicles", 29), (14, "2 Chronicles", 36), (15, "Ezra", 10),
    (16, "Nehemiah", 13), (17, "Esther", 10), (18, "Job", 42),
    (19, "Psalms", 150), (20, "Proverbs", 31), (21, "Ecclesiastes", 12),
    (22, "Song of Solomon", 8), (23, "Isaiah", 66), (24, "Jeremiah", 52),
    (25, "Lamentations", 5), (26, "Ezekiel", 48), (27, "Daniel", 12),
    (28, "Hosea", 14), (29, "Joel", 3), (30, "Amos", 9),
    (31, "Obadiah", 1), (32, "Jonah", 4), (33, "Micah", 7),
    (34, "Nahum", 3), (35, "Habakkuk", 3), (36, "Zephaniah", 3),
    (37, "Haggai", 2), (38, "Zechariah", 14), (39, "Malachi", 4),
    (40, "Matthew", 28), (41, "Mark", 16), (42, "Luke", 24),
    (43, "John", 21), (44, "Acts", 28), (45, "Romans", 16),
    (46, "1 Corinthians", 16), (47, "2 Corinthians", 13), (48, "Galatians", 6),
    (49, "Ephesians", 6), (50, "Philippians", 4), (51, "Colossians", 4),
    (52, "1 Thessalonians", 5), (53, "2 Thessalonians", 3), (54, "1 Timothy", 6),
    (55, "2 Timothy", 4), (56, "Titus", 3), (57, "Philemon", 1),
    (58, "Hebrews", 13), (59, "James", 5), (60, "1 Peter", 5),
    (61, "2 Peter", 3), (62, "1 John", 5), (63, "2 John", 1),
    (64, "3 John", 1), (65, "Jude", 1), (66, "Revelation", 22),
]

def verify_database():
    db_path = Path(__file__).parent.parent / "data" / "bible.db"
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    print("="*70)
    print("COMPREHENSIVE NIV DATABASE VERIFICATION")
    print("="*70)

    total_missing_chapters = 0
    total_missing_verses = 0

    for book_num, book_name, expected_chapters in EXPECTED_CHAPTERS:
        book_id = book_num * 1000000

        # Check chapters by calculating from verse_id
        cursor.execute('''
            SELECT DISTINCT (verse_id / 1000) * 1000 as chapter_id
            FROM verse_lines
            WHERE version_id = 'NIV' AND verse_id >= ? AND verse_id < ?
            ORDER BY chapter_id
        ''', (book_id, book_id + 1000000))

        found_chapters = {row[0] for row in cursor.fetchall()}
        expected_chapter_ids = {book_id + (ch * 1000) for ch in range(1, expected_chapters + 1)}
        missing_chapter_ids = expected_chapter_ids - found_chapters

        if missing_chapter_ids:
            total_missing_chapters += len(missing_chapter_ids)
            print(f"\n{book_name} - MISSING {len(missing_chapter_ids)} CHAPTERS:")
            for ch_id in sorted(missing_chapter_ids):
                chapter_num = (ch_id - book_id) // 1000
                print(f"  Missing Chapter {chapter_num}")

        # Check verse counts per chapter
        for chapter_num in range(1, expected_chapters + 1):
            chapter_id = book_id + (chapter_num * 1000)
            verse_start = chapter_id
            verse_end = chapter_id + 1000

            cursor.execute('''
                SELECT COUNT(DISTINCT verse_id) FROM verse_lines
                WHERE version_id = 'NIV' AND verse_id >= ? AND verse_id < ?
            ''', (verse_start, verse_end))

            verse_count = cursor.fetchone()[0]

            if verse_count == 0:
                total_missing_verses += 1
                print(f"{book_name} {chapter_num} - NO VERSES FOUND!")
            elif verse_count < 5 and book_num not in [31, 57, 63, 64, 65]:  # Skip very short books
                print(f"{book_name} {chapter_num} - Only {verse_count} verses (might be missing some)")

    print("\n" + "="*70)
    print("SUMMARY")
    print("="*70)
    print(f"Total missing chapters: {total_missing_chapters}")
    print(f"Total chapters with no verses: {total_missing_verses}")

    # Get total verse lines
    cursor.execute('SELECT COUNT(*) FROM verse_lines WHERE version_id = "NIV"')
    total_verse_lines = cursor.fetchone()[0]
    print(f"Total NIV verse lines in database: {total_verse_lines:,}")

    # Check for bracketed markers in section titles
    print("\n" + "="*70)
    print("CHECKING FOR BRACKETED MARKERS IN TITLES")
    print("="*70)

    cursor.execute('''
        SELECT DISTINCT title FROM sections
        WHERE version_id = 'NIV' AND title IS NOT NULL
        AND (title LIKE '%(A)%' OR title LIKE '%(B)%' OR title LIKE '%(AN)%'
             OR title LIKE '%(N)%' OR title LIKE '%(C)%')
        LIMIT 20
    ''')

    bad_titles = cursor.fetchall()
    if bad_titles:
        print(f"Found {len(bad_titles)} titles with bracketed markers (showing first 20):")
        for title in bad_titles:
            print(f"  '{title[0]}'")
    else:
        print("No bracketed markers found in titles (GOOD!)")

    conn.close()

if __name__ == "__main__":
    verify_database()
