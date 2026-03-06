#!/usr/bin/env python3
"""
Step 1: Download all NIV chapter HTML files from Bible Gateway.
Saves each chapter as a separate HTML file for later parsing.
"""

import time
from pathlib import Path
import requests

# Book information with IDs (bookNumber * 1000000)
BOOK_INFO = [
    (1, "Genesis", "Old", "Genesis", 50),
    (2, "Exodus", "Old", "Exodus", 40),
    (3, "Leviticus", "Old", "Leviticus", 27),
    (4, "Numbers", "Old", "Numbers", 36),
    (5, "Deuteronomy", "Old", "Deuteronomy", 34),
    (6, "Joshua", "Old", "Joshua", 24),
    (7, "Judges", "Old", "Judges", 21),
    (8, "Ruth", "Old", "Ruth", 4),
    (9, "1 Samuel", "Old", "1 Samuel", 31),
    (10, "2 Samuel", "Old", "2 Samuel", 24),
    (11, "1 Kings", "Old", "1 Kings", 22),
    (12, "2 Kings", "Old", "2 Kings", 25),
    (13, "1 Chronicles", "Old", "1 Chronicles", 29),
    (14, "2 Chronicles", "Old", "2 Chronicles", 36),
    (15, "Ezra", "Old", "Ezra", 10),
    (16, "Nehemiah", "Old", "Nehemiah", 13),
    (17, "Esther", "Old", "Esther", 10),
    (18, "Job", "Old", "Job", 42),
    (19, "Psalms", "Old", "Psalm", 150),
    (20, "Proverbs", "Old", "Proverbs", 31),
    (21, "Ecclesiastes", "Old", "Ecclesiastes", 12),
    (22, "Song of Solomon", "Old", "Song of Solomon", 8),
    (23, "Isaiah", "Old", "Isaiah", 66),
    (24, "Jeremiah", "Old", "Jeremiah", 52),
    (25, "Lamentations", "Old", "Lamentations", 5),
    (26, "Ezekiel", "Old", "Ezekiel", 48),
    (27, "Daniel", "Old", "Daniel", 12),
    (28, "Hosea", "Old", "Hosea", 14),
    (29, "Joel", "Old", "Joel", 3),
    (30, "Amos", "Old", "Amos", 9),
    (31, "Obadiah", "Old", "Obadiah", 1),
    (32, "Jonah", "Old", "Jonah", 4),
    (33, "Micah", "Old", "Micah", 7),
    (34, "Nahum", "Old", "Nahum", 3),
    (35, "Habakkuk", "Old", "Habakkuk", 3),
    (36, "Zephaniah", "Old", "Zephaniah", 3),
    (37, "Haggai", "Old", "Haggai", 2),
    (38, "Zechariah", "Old", "Zechariah", 14),
    (39, "Malachi", "Old", "Malachi", 4),
    (40, "Matthew", "New", "Matthew", 28),
    (41, "Mark", "New", "Mark", 16),
    (42, "Luke", "New", "Luke", 24),
    (43, "John", "New", "John", 21),
    (44, "Acts", "New", "Acts", 28),
    (45, "Romans", "New", "Romans", 16),
    (46, "1 Corinthians", "New", "1 Corinthians", 16),
    (47, "2 Corinthians", "New", "2 Corinthians", 13),
    (48, "Galatians", "New", "Galatians", 6),
    (49, "Ephesians", "New", "Ephesians", 6),
    (50, "Philippians", "New", "Philippians", 4),
    (51, "Colossians", "New", "Colossians", 4),
    (52, "1 Thessalonians", "New", "1 Thessalonians", 5),
    (53, "2 Thessalonians", "New", "2 Thessalonians", 3),
    (54, "1 Timothy", "New", "1 Timothy", 6),
    (55, "2 Timothy", "New", "2 Timothy", 4),
    (56, "Titus", "New", "Titus", 3),
    (57, "Philemon", "New", "Philemon", 1),
    (58, "Hebrews", "New", "Hebrews", 13),
    (59, "James", "New", "James", 5),
    (60, "1 Peter", "New", "1 Peter", 5),
    (61, "2 Peter", "New", "2 Peter", 3),
    (62, "1 John", "New", "1 John", 5),
    (63, "2 John", "New", "2 John", 1),
    (64, "3 John", "New", "3 John", 1),
    (65, "Jude", "New", "Jude", 1),
    (66, "Revelation", "New", "Revelation", 22),
]

BASE_URL = "https://www.biblegateway.com/passage/"
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
}


def download_chapter(book_name: str, chapter_num: int, output_path: Path) -> bool:
    """Download a single chapter HTML."""
    search_query = f"{book_name} {chapter_num}"
    params = {
        'search': search_query,
        'version': 'NIV'
    }

    try:
        response = requests.get(BASE_URL, params=params, headers=HEADERS, timeout=30)
        response.raise_for_status()

        # Save HTML
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(response.text)

        return True
    except Exception as e:
        print(f"    ERROR: {e}")
        return False


def main():
    """Main entry point."""
    script_dir = Path(__file__).parent
    html_dir = script_dir.parent / "niv_html"
    html_dir.mkdir(exist_ok=True)

    print("="*60)
    print("NIV HTML Downloader - Step 1")
    print("="*60)
    print(f"Output directory: {html_dir}")
    print(f"Total chapters to download: 1,189")
    print(f"Delay: 1.0 seconds between requests")
    print("="*60)

    total_chapters = 0
    downloaded = 0
    skipped = 0
    failed = 0

    for book_num, book_name, testament, book_url, num_chapters in BOOK_INFO:
        print(f"\n{book_name} ({num_chapters} chapters)")

        # Create book directory
        book_dir = html_dir / f"{book_num:02d}_{book_name.replace(' ', '_')}"
        book_dir.mkdir(exist_ok=True)

        for chapter_num in range(1, num_chapters + 1):
            total_chapters += 1

            # Check if already exists
            output_file = book_dir / f"chapter_{chapter_num:03d}.html"
            if output_file.exists():
                print(f"  Chapter {chapter_num:3d}/{num_chapters} - SKIP (exists)")
                skipped += 1
                continue

            print(f"  Chapter {chapter_num:3d}/{num_chapters} - ", end='', flush=True)

            if download_chapter(book_name, chapter_num, output_file):
                print("OK")
                downloaded += 1
            else:
                print("FAIL")
                failed += 1

            # Delay between requests
            time.sleep(1.0)

    print(f"\n{'='*60}")
    print("DOWNLOAD COMPLETE!")
    print(f"Total chapters: {total_chapters}")
    print(f"Downloaded: {downloaded}")
    print(f"Skipped (existing): {skipped}")
    print(f"Failed: {failed}")
    print(f"Output: {html_dir}")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
