#!/usr/bin/env python3
"""
Create Notes SQLite Database
Separate database for user notes, independent from Bible content
"""

import sqlite3
import os
import gzip
import shutil
from pathlib import Path

# Paths
SCRIPT_DIR = Path(__file__).parent
DATA_DIR = SCRIPT_DIR.parent / "data"
NOTES_DB_PATH = DATA_DIR / "notes.db"
NOTES_DB_BACKUP_PATH = DATA_DIR / "notes.db.backup"
NOTES_DB_COMPRESSED_PATH = Path(__file__).parent.parent.parent / "frontend" / "assets" / "notes.db.gz"

def create_notes_database():
    """Create the notes SQLite database with schema"""

    # Remove existing database
    if NOTES_DB_PATH.exists():
        print(f"Removing existing database: {NOTES_DB_PATH}")
        NOTES_DB_PATH.unlink()

    print(f"Creating notes database: {NOTES_DB_PATH}")

    # Create database and schema
    conn = sqlite3.connect(NOTES_DB_PATH)
    cursor = conn.cursor()

    # Enable foreign keys
    cursor.execute("PRAGMA foreign_keys = ON;")

    # Create notes table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS notes (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,

        -- Flexible nullable references (note can be scoped to book, chapter, or verse)
        book_id INTEGER,
        chapter_id INTEGER,
        verse_id INTEGER,
        verse_line_id TEXT,

        -- Note content
        title TEXT,
        content TEXT NOT NULL,
        tags TEXT DEFAULT '[]', -- JSON array of tags
        is_private INTEGER DEFAULT 1, -- SQLite boolean (1=true, 0=false)

        -- Timestamps for tracking changes
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        edit_history TEXT DEFAULT '[]', -- JSON array of edit timestamps

        -- Formatting metadata
        formatting_type TEXT DEFAULT 'prose' CHECK (formatting_type IN ('prose', 'poetry', 'custom'))
    );
    """)

    # Create indexes for efficient querying
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_notes_book_id ON notes(book_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_notes_chapter_id ON notes(chapter_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_notes_verse_id ON notes(verse_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_notes_verse_line_id ON notes(verse_line_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_notes_created_at ON notes(created_at DESC);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_notes_updated_at ON notes(updated_at DESC);")

    # Create full-text search virtual table for note content
    cursor.execute("""
    CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
        title,
        content,
        content='notes',
        content_rowid='rowid'
    );
    """)

    # Create triggers to keep FTS index up-to-date
    cursor.execute("""
    CREATE TRIGGER IF NOT EXISTS notes_ai AFTER INSERT ON notes BEGIN
        INSERT INTO notes_fts(rowid, title, content)
        VALUES (new.rowid, new.title, new.content);
    END;
    """)

    cursor.execute("""
    CREATE TRIGGER IF NOT EXISTS notes_ad AFTER DELETE ON notes BEGIN
        DELETE FROM notes_fts WHERE rowid = old.rowid;
    END;
    """)

    cursor.execute("""
    CREATE TRIGGER IF NOT EXISTS notes_au AFTER UPDATE ON notes BEGIN
        UPDATE notes_fts SET title = new.title, content = new.content
        WHERE rowid = new.rowid;
    END;
    """)

    # Create trigger to automatically update edit_history and updated_at
    cursor.execute("""
    CREATE TRIGGER IF NOT EXISTS notes_update_history
    AFTER UPDATE ON notes
    FOR EACH ROW
    WHEN old.content != new.content OR old.title != new.title
    BEGIN
        UPDATE notes SET
            updated_at = CURRENT_TIMESTAMP,
            edit_history = json_insert(
                COALESCE(old.edit_history, '[]'),
                '$[#]',
                CURRENT_TIMESTAMP
            )
        WHERE id = new.id;
    END;
    """)

    conn.commit()
    conn.close()

    print(f"Notes database created successfully")

    # Get database size
    size_bytes = NOTES_DB_PATH.stat().st_size
    size_kb = size_bytes / 1024
    print(f"Database size: {size_kb:.2f} KB")

    return NOTES_DB_PATH

def compress_database(db_path):
    """Compress the database for mobile app distribution"""

    print(f"\nCompressing database for mobile deployment...")

    # Ensure output directory exists
    NOTES_DB_COMPRESSED_PATH.parent.mkdir(parents=True, exist_ok=True)

    # Compress
    with open(db_path, 'rb') as f_in:
        with gzip.open(NOTES_DB_COMPRESSED_PATH, 'wb', compresslevel=9) as f_out:
            shutil.copyfileobj(f_in, f_out)

    # Get sizes
    original_size = db_path.stat().st_size / 1024
    compressed_size = NOTES_DB_COMPRESSED_PATH.stat().st_size / 1024
    compression_ratio = (1 - compressed_size / original_size) * 100

    print(f"Original size: {original_size:.2f} KB")
    print(f"Compressed size: {compressed_size:.2f} KB")
    print(f"Compression ratio: {compression_ratio:.1f}%")
    print(f"Compressed database: {NOTES_DB_COMPRESSED_PATH}")

def create_backup(db_path):
    """Create a backup of the database"""

    print(f"\nCreating backup...")
    shutil.copy2(db_path, NOTES_DB_BACKUP_PATH)
    print(f"Backup created: {NOTES_DB_BACKUP_PATH}")

def main():
    """Main execution"""

    print("=" * 60)
    print("NOTES DATABASE CREATION")
    print("=" * 60)
    print()

    # Ensure data directory exists
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    # Create database
    db_path = create_notes_database()

    # Create backup
    create_backup(db_path)

    # Compress for mobile
    compress_database(db_path)

    print()
    print("=" * 60)
    print("NOTES DATABASE READY!")
    print("=" * 60)
    print()
    print("Next steps:")
    print("1. Uncompressed DB (for debugging): bible-data/data/notes.db")
    print("2. Backup copy: bible-data/data/notes.db.backup")
    print("3. Compressed for app: frontend/assets/notes.db.gz")
    print()

if __name__ == "__main__":
    main()
