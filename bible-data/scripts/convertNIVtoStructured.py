#!/usr/bin/env python3
"""
Convert simple NIV JSON (book -> chapter -> verse -> text)
to structured format matching WEB_bibleData.json structure.
"""

import json
import sys
from pathlib import Path

# Book names in order with their IDs (bookNumber * 1000000)
BOOK_INFO = [
    (1, "Genesis", "Old"), (2, "Exodus", "Old"), (3, "Leviticus", "Old"),
    (4, "Numbers", "Old"), (5, "Deuteronomy", "Old"), (6, "Joshua", "Old"),
    (7, "Judges", "Old"), (8, "Ruth", "Old"), (9, "1 Samuel", "Old"),
    (10, "2 Samuel", "Old"), (11, "1 Kings", "Old"), (12, "2 Kings", "Old"),
    (13, "1 Chronicles", "Old"), (14, "2 Chronicles", "Old"), (15, "Ezra", "Old"),
    (16, "Nehemiah", "Old"), (17, "Esther", "Old"), (18, "Job", "Old"),
    (19, "Psalms", "Old"), (20, "Proverbs", "Old"), (21, "Ecclesiastes", "Old"),
    (22, "Song of Solomon", "Old"), (23, "Isaiah", "Old"), (24, "Jeremiah", "Old"),
    (25, "Lamentations", "Old"), (26, "Ezekiel", "Old"), (27, "Daniel", "Old"),
    (28, "Hosea", "Old"), (29, "Joel", "Old"), (30, "Amos", "Old"),
    (31, "Obadiah", "Old"), (32, "Jonah", "Old"), (33, "Micah", "Old"),
    (34, "Nahum", "Old"), (35, "Habakkuk", "Old"), (36, "Zephaniah", "Old"),
    (37, "Haggai", "Old"), (38, "Zechariah", "Old"), (39, "Malachi", "Old"),
    (40, "Matthew", "New"), (41, "Mark", "New"), (42, "Luke", "New"),
    (43, "John", "New"), (44, "Acts", "New"), (45, "Romans", "New"),
    (46, "1 Corinthians", "New"), (47, "2 Corinthians", "New"), (48, "Galatians", "New"),
    (49, "Ephesians", "New"), (50, "Philippians", "New"), (51, "Colossians", "New"),
    (52, "1 Thessalonians", "New"), (53, "2 Thessalonians", "New"), (54, "1 Timothy", "New"),
    (55, "2 Timothy", "New"), (56, "Titus", "New"), (57, "Philemon", "New"),
    (58, "Hebrews", "New"), (59, "James", "New"), (60, "1 Peter", "New"),
    (61, "2 Peter", "New"), (62, "1 John", "New"), (63, "2 John", "New"),
    (64, "3 John", "New"), (65, "Jude", "New"), (66, "Revelation", "New")
]

# Create lookup dictionary for book info
BOOK_LOOKUP = {name: (num, testament) for num, name, testament in BOOK_INFO}

# NIV uses slightly different book names for some books
NIV_NAME_MAP = {
    "Psalms": "Psalm",
    "Song of Solomon": "Song Of Solomon"
}

def convert_niv_to_structured(niv_json_path, output_path):
    """Convert simple NIV JSON to structured format."""

    print(f"Reading NIV JSON from: {niv_json_path}")
    with open(niv_json_path, 'r', encoding='utf-8') as f:
        niv_data = json.load(f)

    books = []

    for book_name in BOOK_INFO:
        book_num, book_name_key, testament = book_name

        # Try to find the book in NIV data (handle name variations)
        niv_book_name = NIV_NAME_MAP.get(book_name_key, book_name_key)
        niv_book_data = niv_data.get(niv_book_name)
        if not niv_book_data:
            print(f"Warning: Book '{book_name_key}' (NIV: '{niv_book_name}') not found in NIV data")
            continue

        book_id = book_num * 1000000
        print(f"Processing {book_name_key} (ID: {book_id})")

        chapters = []
        for chapter_num_str in sorted(niv_book_data.keys(), key=int):
            chapter_num = int(chapter_num_str)
            chapter_id = book_id + (chapter_num * 1000)

            verses = niv_book_data[chapter_num_str]

            # Create a single section for the chapter (no section headings in simple JSON)
            section_id = chapter_id + 1

            # Group verses into paragraphs (every 10 verses, or create one paragraph per chapter)
            # For simplicity, we'll put all verses in one paragraph per chapter
            paragraph_id = section_id

            verse_lines = []
            for verse_num_str in sorted(verses.keys(), key=int):
                verse_num = int(verse_num_str)
                verse_text = verses[verse_num_str]

                verse_id = chapter_id + verse_num

                verse_line = {
                    "id": f"{verse_id}_0",
                    "text": verse_text,
                    "isIsolated": False,
                    "indentLevel": 0,
                    "paragraphId": paragraph_id,
                    "verseId": verse_id,
                    "verseNumber": verse_num
                }
                verse_lines.append(verse_line)

            paragraph = {
                "id": paragraph_id,
                "sectionId": section_id,
                "verseLines": verse_lines
            }

            section = {
                "id": section_id,
                "chapterId": chapter_id,
                "title": None,
                "paragraphs": [paragraph]
            }

            chapter = {
                "id": chapter_id,
                "chapterNumber": chapter_num,
                "bookId": book_id,
                "version": "NIV",
                "sections": [section]
            }

            chapters.append(chapter)

        book = {
            "id": book_id,
            "name": book_name_key,
            "testament": testament,
            "chapters": chapters
        }

        books.append(book)

    output_data = {"books": books}

    print(f"\nWriting structured NIV data to: {output_path}")
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, ensure_ascii=False, indent=2)

    print("[OK] Conversion complete!")
    print(f"  Total books: {len(books)}")
    total_chapters = sum(len(book['chapters']) for book in books)
    print(f"  Total chapters: {total_chapters}")
    total_verses = sum(
        len(para['verseLines'])
        for book in books
        for chapter in book['chapters']
        for section in chapter['sections']
        for para in section['paragraphs']
    )
    print(f"  Total verses: {total_verses}")

if __name__ == "__main__":
    script_dir = Path(__file__).parent
    data_dir = script_dir.parent / "data"

    # Input: downloaded NIV JSON
    niv_input = script_dir.parent / "temp-niv-download" / "NIV" / "NIV_bible.json"

    # Output: structured NIV data
    niv_output = data_dir / "NIV_bibleData.json"

    if not niv_input.exists():
        print(f"Error: NIV input file not found: {niv_input}")
        sys.exit(1)

    convert_niv_to_structured(niv_input, niv_output)
