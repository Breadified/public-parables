#!/usr/bin/env python3
"""
Verify the source bible.db integrity
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

PROJECT_ROOT = Path(__file__).parent.parent.parent
DB_PATH = PROJECT_ROOT / "bible-data" / "data" / "bible.db"

def verify_database():
    """Verify source database integrity"""

    if not DB_PATH.exists():
        print(f"❌ Database not found: {DB_PATH}")
        return False

    db_size = DB_PATH.stat().st_size / 1024 / 1024
    print(f"📊 Database size: {db_size:.2f} MB")

    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        # Integrity check
        print("\n🔍 Running integrity check...")
        cursor.execute("PRAGMA integrity_check")
        integrity = cursor.fetchone()[0]

        if integrity != "ok":
            print(f"❌ Integrity check failed: {integrity}")
            conn.close()
            return False

        print(f"✅ Integrity check: {integrity}")

        # Count records
        cursor.execute("SELECT COUNT(*) FROM bible_versions")
        version_count = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM verse_lines")
        verse_line_count = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM books")
        book_count = cursor.fetchone()[0]

        print(f"\n📊 Database contents:")
        print(f"   Bible versions: {version_count}")
        print(f"   Verse lines: {verse_line_count:,}")
        print(f"   Books: {book_count}")

        # Test a sample query
        print(f"\n🔍 Testing sample query...")
        cursor.execute("""
            SELECT vl.text, bv.abbreviation
            FROM verse_lines vl
            JOIN bible_versions bv ON vl.version_id = bv.id
            WHERE vl.verse_id = 43003016
            LIMIT 5
        """)
        results = cursor.fetchall()

        print(f"   Found {len(results)} results for John 3:16:")
        for text, version in results:
            print(f"   - {version}: {text[:50]}...")

        conn.close()
        print(f"\n✅ Source database is valid!")
        return True

    except Exception as e:
        print(f"❌ Database verification failed: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = verify_database()
    sys.exit(0 if success else 1)
