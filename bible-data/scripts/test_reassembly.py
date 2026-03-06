#!/usr/bin/env python3
"""
Test script to verify chunk reassembly produces valid database
"""

import gzip
import shutil
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
ASSETS_DIR = PROJECT_ROOT / "frontend" / "assets"
ORIGINAL_DB = PROJECT_ROOT / "bible-data" / "data" / "bible.db"

def test_reassembly():
    """Test reassembling chunks and verify the result"""

    print("🔍 Testing chunk reassembly...")

    # Find all chunk files
    chunk_files = sorted(ASSETS_DIR.glob("bible.db.gz.*"))

    if not chunk_files:
        print("❌ No chunk files found!")
        return False

    print(f"\n📦 Found {len(chunk_files)} chunks:")
    total_size = 0
    for chunk in chunk_files:
        size = chunk.stat().st_size
        total_size += size
        print(f"   - {chunk.name}: {size / 1024 / 1024:.2f} MB")

    print(f"\n   Total: {total_size / 1024 / 1024:.2f} MB")

    # Reassemble chunks
    print("\n🔧 Reassembling chunks...")
    reassembled_gz = ASSETS_DIR / "bible-reassembled.db.gz"

    with open(reassembled_gz, 'wb') as output:
        for chunk in chunk_files:
            with open(chunk, 'rb') as input_chunk:
                shutil.copyfileobj(input_chunk, output)

    reassembled_size = reassembled_gz.stat().st_size
    print(f"   ✅ Reassembled: {reassembled_size / 1024 / 1024:.2f} MB")

    if reassembled_size != total_size:
        print(f"   ❌ Size mismatch! Expected {total_size}, got {reassembled_size}")
        return False

    # Decompress
    print("\n🗜️  Decompressing reassembled file...")
    decompressed_db = ASSETS_DIR / "bible-reassembled.db"

    try:
        with gzip.open(reassembled_gz, 'rb') as f_in:
            with open(decompressed_db, 'wb') as f_out:
                shutil.copyfileobj(f_in, f_out)

        decompressed_size = decompressed_db.stat().st_size
        print(f"   ✅ Decompressed: {decompressed_size / 1024 / 1024:.2f} MB")
    except Exception as e:
        print(f"   ❌ Decompression failed: {e}")
        return False

    # Verify integrity
    print("\n🔍 Verifying database integrity...")
    try:
        conn = sqlite3.connect(decompressed_db)
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

        conn.close()

        print(f"   Integrity: {integrity}")
        print(f"   Bible versions: {version_count}")
        print(f"   Verse lines: {verse_line_count}")
        print(f"   Books: {book_count}")

        if integrity != "ok":
            print(f"\n❌ Integrity check failed!")
            return False

        print(f"\n✅ Database integrity verified!")

    except Exception as e:
        print(f"   ❌ Database verification failed: {e}")
        return False

    # Compare with original
    print("\n🔍 Comparing with original database...")
    original_size = ORIGINAL_DB.stat().st_size

    print(f"   Original: {original_size / 1024 / 1024:.2f} MB")
    print(f"   Reassembled: {decompressed_size / 1024 / 1024:.2f} MB")

    if original_size == decompressed_size:
        print(f"   ✅ Sizes match!")
    else:
        print(f"   ⚠️  Size difference: {abs(original_size - decompressed_size)} bytes")

    # Clean up test files
    print("\n🧹 Cleaning up test files...")
    reassembled_gz.unlink()
    decompressed_db.unlink()

    print("\n🎉 Chunk reassembly test passed!")
    return True

if __name__ == "__main__":
    success = test_reassembly()
    sys.exit(0 if success else 1)
