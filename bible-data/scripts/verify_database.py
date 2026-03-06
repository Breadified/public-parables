#!/usr/bin/env python3
"""
Verify the Bible database contains all expected versions
"""

import sqlite3
import sys
from pathlib import Path

# Fix Windows console encoding
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except AttributeError:
        import codecs
        sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
        sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'strict')

# Paths
PROJECT_ROOT = Path(__file__).parent.parent.parent
DB_PATH = PROJECT_ROOT / "bible-data" / "data" / "bible.db"
GZ_PATH = PROJECT_ROOT / "frontend" / "assets" / "bible.db.gz"

def verify_database():
    """Verify database contents"""

    # Check files exist
    if not DB_PATH.exists():
        print(f"❌ Database not found: {DB_PATH}")
        return False

    if not GZ_PATH.exists():
        print(f"❌ Compressed database not found: {GZ_PATH}")
        return False

    # Check sizes
    db_size = DB_PATH.stat().st_size / 1024 / 1024
    gz_size = GZ_PATH.stat().st_size / 1024 / 1024

    print(f"✅ Database files found:")
    print(f"   - Uncompressed: {db_size:.2f} MB")
    print(f"   - Compressed: {gz_size:.2f} MB")

    # Check compressed size is under limit
    if gz_size > 25:
        print(f"⚠️  WARNING: Compressed file is over 25MB Expo limit!")
    else:
        print(f"✅ Compressed file is under 25MB Expo limit (headroom: {25 - gz_size:.2f} MB)")

    # Connect and verify contents
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Check versions
    cursor.execute('SELECT id, name, abbreviation, language FROM bible_versions ORDER BY id')
    versions = cursor.fetchall()

    print(f"\n✅ Bible versions ({len(versions)}):")
    for version in versions:
        print(f"   - {version[0]}: {version[1]}")
        print(f"     Abbreviation: {version[2]}")
        print(f"     Language: {version[3]}")

    # Check verse counts
    cursor.execute('SELECT version_id, COUNT(*) FROM verse_lines GROUP BY version_id ORDER BY version_id')
    verse_counts = cursor.fetchall()

    print(f"\n✅ Verse lines per version:")
    for vc in verse_counts:
        print(f"   - {vc[0]}: {vc[1]:,} verses")

    # Check books
    cursor.execute('SELECT COUNT(*) FROM books')
    book_count = cursor.fetchone()[0]
    print(f"\n✅ Total books: {book_count}")

    # Check chapters
    cursor.execute('SELECT COUNT(*) FROM chapters')
    chapter_count = cursor.fetchone()[0]
    print(f"✅ Total chapters: {chapter_count}")

    # Verify CUV specifically
    cursor.execute('SELECT text FROM verse_lines WHERE version_id = ? AND verse_id = ? LIMIT 1',
                   ('CUV', 1001001))
    genesis_1_1 = cursor.fetchone()

    if genesis_1_1:
        print(f"\n✅ CUV Genesis 1:1: {genesis_1_1[0]}")
    else:
        print(f"\n❌ CUV Genesis 1:1 not found!")

    conn.close()

    print(f"\n🎉 Database verification complete!")
    return True

if __name__ == "__main__":
    verify_database()
