#!/usr/bin/env python3
"""
Split the compressed bible.db.gz file into multiple parts for Metro bundler.

This script splits the large bible.db.gz file into smaller chunks to work around
Metro bundler's asset size handling limitations. The chunks can be reassembled
at runtime by the app.
"""

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
SOURCE_FILE = PROJECT_ROOT / "frontend" / "assets" / "bible.db.gz"
OUTPUT_DIR = PROJECT_ROOT / "frontend" / "assets"

# Chunk size: 5 MB per chunk
CHUNK_SIZE = 5 * 1024 * 1024  # 5 MB in bytes

def split_file():
    """Split the bible.db.gz file into multiple chunks"""

    if not SOURCE_FILE.exists():
        print(f"❌ Source file not found: {SOURCE_FILE}")
        return False

    # Get file size
    file_size = SOURCE_FILE.stat().st_size
    file_size_mb = file_size / 1024 / 1024

    print(f"📦 Splitting {SOURCE_FILE.name}")
    print(f"   Size: {file_size_mb:.2f} MB")
    print(f"   Chunk size: {CHUNK_SIZE / 1024 / 1024:.0f} MB")

    # Calculate number of chunks needed
    num_chunks = (file_size + CHUNK_SIZE - 1) // CHUNK_SIZE
    print(f"   Total chunks: {num_chunks}")

    # Read the source file
    with open(SOURCE_FILE, 'rb') as source:
        chunk_num = 1

        while True:
            # Read chunk
            chunk_data = source.read(CHUNK_SIZE)

            if not chunk_data:
                break

            # Write chunk to file
            chunk_filename = f"bible.db.gz.{chunk_num}"
            chunk_path = OUTPUT_DIR / chunk_filename

            with open(chunk_path, 'wb') as chunk_file:
                chunk_file.write(chunk_data)

            chunk_size_mb = len(chunk_data) / 1024 / 1024
            print(f"   ✅ Created {chunk_filename} ({chunk_size_mb:.2f} MB)")

            chunk_num += 1

    print(f"\n🎉 Successfully split into {num_chunks} chunks!")
    print(f"\n📝 Next steps:")
    print(f"   1. Delete the original bible.db.gz file")
    print(f"   2. Update dbDecompressor.ts to reassemble chunks")
    print(f"   3. Test the multi-part decompression")

    return True

if __name__ == "__main__":
    success = split_file()
    sys.exit(0 if success else 1)
