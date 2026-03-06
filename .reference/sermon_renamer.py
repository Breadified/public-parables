#!/usr/bin/env python3
"""
Rename sermon files from human-readable names to verse ID format.

Examples:
- Genesis_1.1-20_Title.docx -> 1001001-1001020.docx
- 1_Corinthians_1.1-18_Identity.docx -> 46001001-46001018.docx
"""

import os
import re
import json
import shutil
from pathlib import Path

# ============================================================================
# CONFIGURATION
# ============================================================================

SCRIPT_DIR = Path(__file__).parent
INPUT_DIR = SCRIPT_DIR / "Kenny_Sermon_Script_temp"
OUTPUT_DIR = SCRIPT_DIR / "Kenny_Sermon_Script_VerseID"
MANUAL_DIR = SCRIPT_DIR / "Kenny_Sermon_Script_Manual"
VERSE_COUNTS_PATH = SCRIPT_DIR / "verse_counts.json"
MAPPING_LOG_PATH = SCRIPT_DIR / "mapping_log.json"

# ============================================================================
# BOOK MAPPINGS - All 66 books with observed variations
# ============================================================================

BOOK_MAPPINGS = {
    # Old Testament - Law (1-5)
    'genesis': 1, 'gen': 1, 'ge': 1, 'gn': 1, 'ggenesis': 1,
    'exodus': 2, 'ex': 2, 'exo': 2, 'exod': 2,
    'leviticus': 3, 'lev': 3, 'le': 3, 'lv': 3,
    'numbers': 4, 'num': 4, 'nu': 4, 'nm': 4,
    'deuteronomy': 5, 'deut': 5, 'dt': 5, 'de': 5,

    # Old Testament - History (6-17)
    'joshua': 6, 'josh': 6, 'jos': 6, 'jsh': 6,
    'judges': 7, 'judg': 7, 'jdg': 7, 'jg': 7,
    'ruth': 8, 'ru': 8, 'rut': 8,
    '1_samuel': 9, '1samuel': 9, '1sam': 9, '1sa': 9, '1s': 9, '11_samuel': 9,  # typo variant
    '2_samuel': 10, '2samuel': 10, '2sam': 10, '2sa': 10, '2s': 10,
    '1_kings': 11, '1kings': 11, '1ki': 11, '1kgs': 11, '1k': 11,
    '2_kings': 12, '2kings': 12, '2ki': 12, '2kgs': 12, '2k': 12,
    '1_chronicles': 13, '1chronicles': 13, '1chron': 13, '1ch': 13, '1chr': 13,
    '2_chronicles': 14, '2chronicles': 14, '2chron': 14, '2ch': 14, '2chr': 14,
    'ezra': 15, 'ezr': 15, 'ez': 15,
    'nehemiah': 16, 'neh': 16, 'ne': 16,
    'esther': 17, 'est': 17, 'es': 17, 'esth': 17,

    # Old Testament - Poetry/Wisdom (18-22)
    'job': 18, 'jb': 18, 'jjob': 18,
    'psalms': 19, 'psalm': 19, 'ps': 19, 'psa': 19, 'pss': 19,
    'proverbs': 20, 'prov': 20, 'pr': 20, 'pro': 20,
    'ecclesiastes': 21, 'eccles': 21, 'ec': 21, 'ecc': 21, 'eccl': 21, 'eecclesiastes': 21,
    'song_of_solomon': 22, 'song': 22, 'ss': 22, 'sos': 22, 'sg': 22, 'songofsongs': 22,

    # Old Testament - Major Prophets (23-27)
    'isaiah': 23, 'isa': 23, 'is': 23,
    'jeremiah': 24, 'jer': 24, 'je': 24,
    'lamentations': 25, 'lam': 25, 'la': 25,
    'ezekiel': 26, 'ezek': 26, 'eze': 26, 'ezk': 26,
    'daniel': 27, 'dan': 27, 'da': 27, 'dn': 27,

    # Old Testament - Minor Prophets (28-39)
    'hosea': 28, 'hos': 28, 'ho': 28,
    'joel': 29, 'jl': 29, 'joe': 29,
    'amos': 30, 'am': 30,
    'obadiah': 31, 'obad': 31, 'ob': 31, 'oba': 31,
    'jonah': 32, 'jon': 32, 'jnh': 32,
    'micah': 33, 'mic': 33, 'mi': 33,
    'nahum': 34, 'nah': 34, 'na': 34,
    'habakkuk': 35, 'hab': 35, 'hb': 35,
    'zephaniah': 36, 'zeph': 36, 'zep': 36, 'zp': 36,
    'haggai': 37, 'hag': 37, 'hg': 37,
    'zechariah': 38, 'zech': 38, 'zec': 38, 'zc': 38, 'zzechariah': 38,
    'malachi': 39, 'mal': 39, 'ml': 39,

    # New Testament - Gospels (40-43)
    'matthew': 40, 'matt': 40, 'mt': 40, 'mat': 40, 'mmatthew': 40,
    'mark': 41, 'mk': 41, 'mar': 41,
    'luke': 42, 'lk': 42, 'luk': 42,
    'john': 43, 'jn': 43, 'joh': 43,

    # New Testament - Acts (44)
    'acts': 44, 'ac': 44, 'act': 44, 'aacts': 44, 'aaacts': 44,

    # New Testament - Paul's Letters (45-57)
    'romans': 45, 'rom': 45, 'ro': 45,
    '1_corinthians': 46, '1corinthians': 46, '1cor': 46, '1co': 46,
    '2_corinthians': 47, '2corinthians': 47, '2cor': 47, '2co': 47,
    'galatians': 48, 'gal': 48, 'ga': 48,
    'ephesians': 49, 'eph': 49, 'ep': 49,
    'philippians': 50, 'phil': 50, 'php': 50, 'pp': 50, 'pphilippians': 50,
    'colossians': 51, 'col': 51, 'cl': 51,
    '1_thessalonians': 52, '1thessalonians': 52, '1thess': 52, '1th': 52, '1_thess': 52,
    '2_thessalonians': 53, '2thessalonians': 53, '2thess': 53, '2th': 53, '2_thess': 53,
    '1_timothy': 54, '1timothy': 54, '1tim': 54, '1ti': 54, '1tm': 54, '1_tim': 54,
    '2_timothy': 55, '2timothy': 55, '2tim': 55, '2ti': 55, '2tm': 55, '2_tim': 55,
    'titus': 56, 'tit': 56, 'tt': 56,
    'philemon': 57, 'philem': 57, 'phm': 57, 'pm': 57,

    # New Testament - General Letters (58-65)
    'hebrews': 58, 'heb': 58, 'he': 58, 'hhebrews': 58, 'hhhebrews': 58,
    'james': 59, 'jam': 59, 'jm': 59, 'jas': 59,
    '1_peter': 60, '1peter': 60, '1pet': 60, '1pe': 60, '1pt': 60, '1_ppeter': 60, '1ppeter': 60,
    '2_peter': 61, '2peter': 61, '2pet': 61, '2pe': 61, '2pt': 61, '2_ppeter': 61, '2ppeter': 61,
    '1_john': 62, '1john': 62, '1jn': 62, '1jo': 62,
    '2_john': 63, '2john': 63, '2jn': 63, '2jo': 63,
    '3_john': 64, '3john': 64, '3jn': 64, '3jo': 64,
    'jude': 65, 'jd': 65,

    # New Testament - Prophecy (66)
    'revelation': 66, 'rev': 66, 're': 66, 'rv': 66, 'revelations': 66,
}

# ============================================================================
# REGEX PATTERNS (ordered by specificity - most specific first)
# ============================================================================

PATTERNS = [
    # Pattern 1: Cross-chapter with verses - Book_Ch.V-Ch.V (e.g., Genesis_1.1-2.3)
    (r'^([a-z0-9_]+?)_(\d+)\.(\d+)-(\d+)\.(\d+)', 'cross_chapter_verse'),

    # Pattern 2: Single chapter with verse range - Book_Ch.V-V (e.g., Genesis_1.1-20)
    (r'^([a-z0-9_]+?)_(\d+)\.(\d+)-(\d+)', 'chapter_verse_range'),

    # Pattern 3: Chapter range - Book_Ch-Ch (e.g., Daniel_8-10)
    (r'^([a-z0-9_]+?)_(\d+)-(\d+)(?:[_\s\.]|$)', 'chapter_range'),

    # Pattern 4: Single chapter only - Book_Ch (e.g., Romans_8)
    (r'^([a-z0-9_]+?)_(\d+)(?:[_\s\.]|$)', 'single_chapter'),

    # Pattern 5: Space variant with verse range - Book Ch.V-V (e.g., 1 Peter 1.1-12)
    (r'^([a-z0-9_]+?)\s+(\d+)\.(\d+)-(\d+)', 'space_verse_range'),

    # Pattern 6: Space variant chapter only - Book Ch (e.g., REVELATION 1)
    (r'^([a-z0-9_]+?)\s+(\d+)(?:[_\s\.]|$)', 'space_chapter'),

    # Pattern 7: Compact numbered book - 1Tim4 or 1 tim 4
    (r'^(\d+)\s*([a-z]+)\s+(\d+)(?:[_\s\.]|$)', 'compact_numbered'),

    # Pattern 8: Space chapter range - Book Ch-Ch (e.g., Exodus 1-3, James 3-4)
    (r'^([a-z0-9_]+?)\s+(\d+)-(\d+)(?:[_\s\.]|$)', 'space_chapter_range'),

    # Pattern 9: Double letter prefix without underscore cross-chapter - HHebrewsCh.V-Ch.V
    (r'^([a-z]+)(\d+)\.(\d+)-(\d+)\.(\d+)', 'nospace_cross_chapter'),

    # Pattern 10: Double letter prefix without underscore verse range - HHebrewsCh.V-V
    (r'^([a-z]+)(\d+)\.(\d+)-(\d+)', 'nospace_verse_range'),

    # Pattern 11: Book_PREFIX Chapter.Verse pattern (e.g., 1_Corinthians_CONNECT 12.1-6)
    (r'^([a-z0-9_]+?)_[a-z]+\s+(\d+)\.(\d+)-(\d+)', 'prefix_verse_range'),

    # Pattern 12: Book_PREFIX Chapter.V-Ch.V pattern (e.g., 1_Peter CHINESE 1.1-12)
    (r'^([a-z0-9_]+?)\s+[a-z]+\s+(\d+)\.(\d+)-(\d+)\.?(\d*)', 'prefix_cross_chapter'),

    # Pattern 13: Book PREFIX Chapter.V-V pattern (e.g., 1_Peter RUSE 2.4-11)
    (r'^([a-z0-9_]+?)\s+[a-z]+\s+(\d+)\.(\d+)-(\d+)', 'space_prefix_verse_range'),

    # Pattern 14: Chinese with space - 希伯来书 11 (Hebrews 11)
    (r'^(希伯来书)\s+(\d+)', 'chinese_hebrews'),
    (r'^(罗马书)\s+(\d+)', 'chinese_romans'),
    (r'^(路加福音)\s+(\d+)', 'chinese_luke'),

    # Pattern 15: Revelation special - Revelation 18-22
    (r'^(revelation)\s+(\d+)-(\d+)', 'revelation_range'),

    # Pattern 16: THIRST series - THIRST_N. Book_Ch.V-V
    (r'^thirst_\d+\.\s*([a-z]+)_(\d+)\.(\d+)-(\d+)', 'thirst_series'),

    # Pattern 17: THIRST series chapter range - THIRST_N. Book_Ch.V-Ch.V
    (r'^thirst_\d+\.\s*([a-z]+)_(\d+)\.(\d+)-(\d+)\.(\d+)', 'thirst_cross_chapter'),

    # Pattern 18: THIRST space format - THIRST_Book_Ch.V-V
    (r'^thirst_([a-z]+)_(\d+)\.(\d+)-(\d+)', 'thirst_underscore'),

    # Pattern 19: GGENESIS chapter range - GGENESIS_Ch-Ch
    (r'^(ggenesis)_(\d+)-(\d+)', 'ggenesis_range'),

    # Pattern 20: Single chapter with hyphen title - Book_Ch-Title
    (r'^([a-z]+)_(\d+)-[a-z]', 'chapter_hyphen_title'),

    # Pattern 21: Numbered book single chapter - 2 Tim 4
    (r'^(\d+)\s+([a-z]+)\s+(\d+)(?:[_\s\.-]|$)', 'numbered_space_chapter'),

    # Pattern 22: Luke chapter range - Luke_Ch-Ch
    (r'^(luke)_(\d+)-(\d+)', 'luke_range'),

    # Pattern 23: Exodus chapter range - Exodus_Ch-Ch
    (r'^(exodus)_(\d+)-(\d+)', 'exodus_range'),

    # Pattern 24: HEBREWS no underscore single chapter - HEBREWSCh
    (r'^(hebrews)(\d+)', 'hebrews_nospace'),

    # Pattern 25: Book_Ch-Name (single chapter with name after hyphen)
    (r'^([a-z0-9_]+?)_(\d+)-[a-z]', 'book_chapter_name'),

    # Pattern 26: THIRST_N. Book Space Ch.V-V
    (r'^thirst_\d+\.\s*([a-z]+)\s+(\d+)\.(\d+)-(\d+)', 'thirst_space_series'),

    # Pattern 27: Outline - Book Ch-Ch
    (r'^outline\s*-\s*([a-z]+)\s+(\d+)-(\d+)', 'outline_chapter_range'),

    # Pattern 28: Book only (e.g., Romans.doc, Isaiah.doc) - outputs book ID only
    (r'^([a-z]+)$', 'book_only'),

    # Pattern 29: Book with suffix - "Hebrews Overview", "James Text", "Exodus outline"
    (r'^([a-z]+)\s+(?:overview|summary|text|outline|bible|studies).*$', 'book_suffix'),

    # Pattern 30: Book - suffix - "Philippians - Outline", "Revelation - NIV TEXT"
    (r'^([a-z]+)\s*-\s*(?:outline|bible|niv|text).*$', 'book_dash_suffix'),

    # Pattern 31: phillipians misspelling
    (r'^(phillipians)$', 'misspelled_philippians'),

    # Pattern 32: Topic - Book Ch_V-V (e.g., Creation - Romans 1_18-23)
    (r'^[a-z]+\s*-\s*([a-z]+)\s+(\d+)_(\d+)-(\d+)', 'topic_book_verse'),

    # Pattern 33: Topic Book Ch (e.g., Christ Myth Luke 1)
    (r'^.*\s+([a-z]+)\s+(\d+)$', 'topic_book_chapter'),

    # Pattern 34: Book NSCA/PREFIX Ch.V-V (e.g., 1_Peter NSCA5.1-12)
    (r'^([a-z0-9_]+)\s+[a-z]+(\d+)\.(\d+)-(\d+)', 'book_prefix_nospace_verse'),

    # Pattern 35: FAREWELL style - contains "Book Ch.V"
    (r'^.*(\d)\s*([a-z]+)\s+(\d+)\.(\d+)', 'embedded_numbered_verse'),

    # Pattern 36: 1_Thess style book only
    (r'^(\d+_[a-z]+)_?(?:manuscript|outline|text)?$', 'numbered_book_only'),

    # Pattern 37: Zephaniah - Outline2 style
    (r'^([a-z]+)\s*-\s*outline\d*$', 'book_outline_numbered'),

    # Pattern 38: Numbered book - suffix (1_John - valentine, 1_Peter - no.1)
    (r'^(\d+_[a-z]+)\s*-', 'numbered_book_dash'),

    # Pattern 39: Numbered book WORD Outline (1_Peter RUSE Outline)
    (r'^(\d+_[a-z]+)\s+[a-z]+\s+outline', 'numbered_book_word_outline'),

    # Pattern 40: Book - topic (Daniel - thoughts, Exodus - Exegesis)
    (r'^([a-z]+)\s*-\s*(?:thoughts|exegesis|honour|commentary)', 'book_dash_topic'),

    # Pattern 41: Book HSC/other suffix (Philippians HSC)
    (r'^([a-z]+)\s+(?:hsc|bible|niv)', 'book_word_suffix'),

    # Pattern 42: Revelation tilde verse (Revelation 5~5)
    (r'^(revelation)\s+(\d+)~(\d+)', 'revelation_tilde'),

    # Pattern 43: Book - The_Translation_of_Book_Ch_V
    (r'^([a-z]+)\s*-.*_(\d+)_(\d+)$', 'book_translation_verse'),

    # Pattern 44: Marks Book (Marks Ephesians)
    (r'^marks\s+([a-z]+)', 'marks_book'),

    # Pattern 45: Book_0 or Book_0SUFFIX (Numbers_0NIV84) - treat as book only
    (r'^([a-z]+)_0', 'book_zero_prefix'),

    # Pattern 46: Contains "from Book" or "of Book" at end
    (r'^.*(?:from|of)\s+([a-z]+)$', 'from_book'),

    # Pattern 47: Numbered book with chapter 0 (1_Peter 0) - treat as book only
    (r'^(\d+_[a-z]+)\s+0\b', 'numbered_book_chapter_zero'),
]

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def load_verse_counts():
    """Load verse counts from JSON file."""
    with open(VERSE_COUNTS_PATH, 'r') as f:
        return json.load(f)

def normalize_book_name(raw_name):
    """
    Normalize a book name to match our mappings.
    Handles variations like:
    - 1_Corinthians -> 1_corinthians
    - 1 Corinthians -> 1_corinthians
    - HHebrews -> hhebrews
    - 11_Samuel -> 11_samuel (will map to 9 = 1 Samuel)
    """
    # Lowercase
    name = raw_name.lower().strip()

    # Replace spaces with underscores for numbered books
    # "1 corinthians" -> "1_corinthians"
    name = re.sub(r'^(\d+)\s+', r'\1_', name)

    # Remove trailing underscores
    name = name.rstrip('_')

    return name

def get_book_id(book_name):
    """Get book ID from normalized book name."""
    normalized = normalize_book_name(book_name)
    return BOOK_MAPPINGS.get(normalized)

def calculate_verse_id(book_id, chapter, verse):
    """Calculate verse ID: bookId * 1000000 + chapter * 1000 + verse"""
    return book_id * 1000000 + chapter * 1000 + verse

def get_max_verse(book_id, chapter, verse_counts):
    """Get max verse number for a chapter."""
    key = f"{book_id}_{chapter}"
    return verse_counts.get(key)

def parse_filename(filename, verse_counts):
    """
    Parse a filename and return (start_verse_id, end_verse_id, pattern_type) or None.
    """
    # Get basename without extension
    basename = filename.rsplit('.', 1)[0]

    for pattern, pattern_type in PATTERNS:
        match = re.match(pattern, basename, re.IGNORECASE)
        if match:
            groups = match.groups()

            if pattern_type == 'cross_chapter_verse':
                # Book_Ch1.V1-Ch2.V2
                book_name, ch1, v1, ch2, v2 = groups
                book_id = get_book_id(book_name)
                if book_id:
                    start_id = calculate_verse_id(book_id, int(ch1), int(v1))
                    end_id = calculate_verse_id(book_id, int(ch2), int(v2))
                    return (start_id, end_id, pattern_type)

            elif pattern_type == 'chapter_verse_range':
                # Book_Ch.V1-V2
                book_name, ch, v1, v2 = groups
                book_id = get_book_id(book_name)
                if book_id:
                    start_id = calculate_verse_id(book_id, int(ch), int(v1))
                    end_id = calculate_verse_id(book_id, int(ch), int(v2))
                    return (start_id, end_id, pattern_type)

            elif pattern_type == 'chapter_range':
                # Book_Ch1-Ch2 (full chapters)
                book_name, ch1, ch2 = groups
                book_id = get_book_id(book_name)
                if book_id:
                    start_id = calculate_verse_id(book_id, int(ch1), 1)
                    max_verse = get_max_verse(book_id, int(ch2), verse_counts)
                    if max_verse:
                        end_id = calculate_verse_id(book_id, int(ch2), max_verse)
                        return (start_id, end_id, pattern_type)

            elif pattern_type == 'single_chapter':
                # Book_Ch (full chapter)
                book_name, ch = groups
                book_id = get_book_id(book_name)
                if book_id:
                    chapter = int(ch)
                    max_verse = get_max_verse(book_id, chapter, verse_counts)
                    if max_verse:
                        start_id = calculate_verse_id(book_id, chapter, 1)
                        end_id = calculate_verse_id(book_id, chapter, max_verse)
                        return (start_id, end_id, pattern_type)

            elif pattern_type == 'space_verse_range':
                # Book Ch.V1-V2
                book_name, ch, v1, v2 = groups
                book_id = get_book_id(book_name)
                if book_id:
                    start_id = calculate_verse_id(book_id, int(ch), int(v1))
                    end_id = calculate_verse_id(book_id, int(ch), int(v2))
                    return (start_id, end_id, pattern_type)

            elif pattern_type == 'space_chapter':
                # Book Ch (full chapter)
                book_name, ch = groups
                book_id = get_book_id(book_name)
                if book_id:
                    chapter = int(ch)
                    max_verse = get_max_verse(book_id, chapter, verse_counts)
                    if max_verse:
                        start_id = calculate_verse_id(book_id, chapter, 1)
                        end_id = calculate_verse_id(book_id, chapter, max_verse)
                        return (start_id, end_id, pattern_type)

            elif pattern_type == 'compact_numbered':
                # 1Tim4 or 1 tim 4
                num, book_part, ch = groups
                book_name = f"{num}_{book_part}"
                book_id = get_book_id(book_name)
                if book_id:
                    chapter = int(ch)
                    max_verse = get_max_verse(book_id, chapter, verse_counts)
                    if max_verse:
                        start_id = calculate_verse_id(book_id, chapter, 1)
                        end_id = calculate_verse_id(book_id, chapter, max_verse)
                        return (start_id, end_id, pattern_type)

            elif pattern_type == 'space_chapter_range':
                # Book Ch-Ch (e.g., Exodus 1-3, James 3-4)
                book_name, ch1, ch2 = groups
                book_id = get_book_id(book_name)
                if book_id:
                    start_id = calculate_verse_id(book_id, int(ch1), 1)
                    max_verse = get_max_verse(book_id, int(ch2), verse_counts)
                    if max_verse:
                        end_id = calculate_verse_id(book_id, int(ch2), max_verse)
                        return (start_id, end_id, pattern_type)

            elif pattern_type == 'nospace_cross_chapter':
                # HHebrewsCh.V-Ch.V (e.g., HHebrews2.5-3.1)
                book_name, ch1, v1, ch2, v2 = groups
                book_id = get_book_id(book_name)
                if book_id:
                    start_id = calculate_verse_id(book_id, int(ch1), int(v1))
                    end_id = calculate_verse_id(book_id, int(ch2), int(v2))
                    return (start_id, end_id, pattern_type)

            elif pattern_type == 'nospace_verse_range':
                # HHebrewsCh.V-V (e.g., HHebrews1.1-4)
                book_name, ch, v1, v2 = groups
                book_id = get_book_id(book_name)
                if book_id:
                    start_id = calculate_verse_id(book_id, int(ch), int(v1))
                    end_id = calculate_verse_id(book_id, int(ch), int(v2))
                    return (start_id, end_id, pattern_type)

            elif pattern_type == 'prefix_verse_range':
                # Book_PREFIX Chapter.Verse (e.g., 1_Corinthians_CONNECT 12.1-6)
                book_name, ch, v1, v2 = groups
                book_id = get_book_id(book_name)
                if book_id:
                    start_id = calculate_verse_id(book_id, int(ch), int(v1))
                    end_id = calculate_verse_id(book_id, int(ch), int(v2))
                    return (start_id, end_id, pattern_type)

            elif pattern_type in ('prefix_cross_chapter', 'space_prefix_verse_range'):
                # Book PREFIX Chapter.V-V (e.g., 1_Peter RUSE 2.4-11)
                book_name, ch, v1, v2 = groups[:4]
                book_id = get_book_id(book_name)
                if book_id:
                    start_id = calculate_verse_id(book_id, int(ch), int(v1))
                    end_id = calculate_verse_id(book_id, int(ch), int(v2))
                    return (start_id, end_id, pattern_type)

            elif pattern_type == 'chinese_hebrews':
                # 希伯来书 11 (Hebrews 11)
                _, ch = groups
                book_id = 58  # Hebrews
                chapter = int(ch)
                max_verse = get_max_verse(book_id, chapter, verse_counts)
                if max_verse:
                    start_id = calculate_verse_id(book_id, chapter, 1)
                    end_id = calculate_verse_id(book_id, chapter, max_verse)
                    return (start_id, end_id, pattern_type)

            elif pattern_type == 'chinese_romans':
                # 罗马书 11 (Romans 11)
                _, ch = groups
                book_id = 45  # Romans
                chapter = int(ch)
                max_verse = get_max_verse(book_id, chapter, verse_counts)
                if max_verse:
                    start_id = calculate_verse_id(book_id, chapter, 1)
                    end_id = calculate_verse_id(book_id, chapter, max_verse)
                    return (start_id, end_id, pattern_type)

            elif pattern_type == 'chinese_luke':
                # 路加福音 11 (Luke 11)
                _, ch = groups
                book_id = 42  # Luke
                chapter = int(ch)
                max_verse = get_max_verse(book_id, chapter, verse_counts)
                if max_verse:
                    start_id = calculate_verse_id(book_id, chapter, 1)
                    end_id = calculate_verse_id(book_id, chapter, max_verse)
                    return (start_id, end_id, pattern_type)

            elif pattern_type == 'revelation_range':
                # Revelation 18-22
                _, ch1, ch2 = groups
                book_id = 66  # Revelation
                start_id = calculate_verse_id(book_id, int(ch1), 1)
                max_verse = get_max_verse(book_id, int(ch2), verse_counts)
                if max_verse:
                    end_id = calculate_verse_id(book_id, int(ch2), max_verse)
                    return (start_id, end_id, pattern_type)

            elif pattern_type == 'thirst_series':
                # THIRST_N. Book_Ch.V-V
                book_name, ch, v1, v2 = groups
                book_id = get_book_id(book_name)
                if book_id:
                    start_id = calculate_verse_id(book_id, int(ch), int(v1))
                    end_id = calculate_verse_id(book_id, int(ch), int(v2))
                    return (start_id, end_id, pattern_type)

            elif pattern_type == 'thirst_cross_chapter':
                # THIRST_N. Book_Ch.V-Ch.V
                book_name, ch1, v1, ch2, v2 = groups
                book_id = get_book_id(book_name)
                if book_id:
                    start_id = calculate_verse_id(book_id, int(ch1), int(v1))
                    end_id = calculate_verse_id(book_id, int(ch2), int(v2))
                    return (start_id, end_id, pattern_type)

            elif pattern_type == 'thirst_underscore':
                # THIRST_Book_Ch.V-V
                book_name, ch, v1, v2 = groups
                book_id = get_book_id(book_name)
                if book_id:
                    start_id = calculate_verse_id(book_id, int(ch), int(v1))
                    end_id = calculate_verse_id(book_id, int(ch), int(v2))
                    return (start_id, end_id, pattern_type)

            elif pattern_type == 'ggenesis_range':
                # GGENESIS_Ch-Ch
                _, ch1, ch2 = groups
                book_id = 1  # Genesis
                start_id = calculate_verse_id(book_id, int(ch1), 1)
                max_verse = get_max_verse(book_id, int(ch2), verse_counts)
                if max_verse:
                    end_id = calculate_verse_id(book_id, int(ch2), max_verse)
                    return (start_id, end_id, pattern_type)

            elif pattern_type == 'chapter_hyphen_title':
                # Book_Ch-Title (e.g., Matthew_14-TheKingdomForTheHumble)
                book_name, ch = groups
                book_id = get_book_id(book_name)
                if book_id:
                    chapter = int(ch)
                    max_verse = get_max_verse(book_id, chapter, verse_counts)
                    if max_verse:
                        start_id = calculate_verse_id(book_id, chapter, 1)
                        end_id = calculate_verse_id(book_id, chapter, max_verse)
                        return (start_id, end_id, pattern_type)

            elif pattern_type == 'numbered_space_chapter':
                # 2 Tim 4 or 1 tim 4
                num, book_part, ch = groups
                book_name = f"{num}_{book_part}"
                book_id = get_book_id(book_name)
                if book_id:
                    chapter = int(ch)
                    max_verse = get_max_verse(book_id, chapter, verse_counts)
                    if max_verse:
                        start_id = calculate_verse_id(book_id, chapter, 1)
                        end_id = calculate_verse_id(book_id, chapter, max_verse)
                        return (start_id, end_id, pattern_type)

            elif pattern_type in ('luke_range', 'exodus_range'):
                # Luke_Ch-Ch or Exodus_Ch-Ch
                book_name, ch1, ch2 = groups
                book_id = get_book_id(book_name)
                if book_id:
                    start_id = calculate_verse_id(book_id, int(ch1), 1)
                    max_verse = get_max_verse(book_id, int(ch2), verse_counts)
                    if max_verse:
                        end_id = calculate_verse_id(book_id, int(ch2), max_verse)
                        return (start_id, end_id, pattern_type)

            elif pattern_type == 'hebrews_nospace':
                # HEBREWSCh (e.g., HEBREWS12)
                _, ch = groups
                book_id = 58  # Hebrews
                chapter = int(ch)
                max_verse = get_max_verse(book_id, chapter, verse_counts)
                if max_verse:
                    start_id = calculate_verse_id(book_id, chapter, 1)
                    end_id = calculate_verse_id(book_id, chapter, max_verse)
                    return (start_id, end_id, pattern_type)

            elif pattern_type == 'book_chapter_name':
                # Book_Ch-Name (single chapter)
                book_name, ch = groups
                book_id = get_book_id(book_name)
                if book_id:
                    chapter = int(ch)
                    max_verse = get_max_verse(book_id, chapter, verse_counts)
                    if max_verse:
                        start_id = calculate_verse_id(book_id, chapter, 1)
                        end_id = calculate_verse_id(book_id, chapter, max_verse)
                        return (start_id, end_id, pattern_type)

            elif pattern_type == 'thirst_space_series':
                # THIRST_N. Book Space Ch.V-V (e.g., THIRST_3. Isaiah 55.1-7)
                book_name, ch, v1, v2 = groups
                book_id = get_book_id(book_name)
                if book_id:
                    start_id = calculate_verse_id(book_id, int(ch), int(v1))
                    end_id = calculate_verse_id(book_id, int(ch), int(v2))
                    return (start_id, end_id, pattern_type)

            elif pattern_type == 'outline_chapter_range':
                # Outline - Book Ch-Ch
                book_name, ch1, ch2 = groups
                book_id = get_book_id(book_name)
                if book_id:
                    start_id = calculate_verse_id(book_id, int(ch1), 1)
                    max_verse = get_max_verse(book_id, int(ch2), verse_counts)
                    if max_verse:
                        end_id = calculate_verse_id(book_id, int(ch2), max_verse)
                        return (start_id, end_id, pattern_type)

            elif pattern_type == 'book_only':
                # Book only (e.g., Romans.doc) - return full book ID (bookNum * 1000000)
                book_name = groups[0]
                book_num = get_book_id(book_name)
                if book_num:
                    full_book_id = book_num * 1000000
                    return (full_book_id, None, pattern_type)

            elif pattern_type in ('book_suffix', 'book_dash_suffix', 'book_outline_numbered'):
                # Book with suffix (Hebrews Overview, Philippians - Outline)
                book_name = groups[0]
                book_num = get_book_id(book_name)
                if book_num:
                    full_book_id = book_num * 1000000
                    return (full_book_id, None, pattern_type)

            elif pattern_type == 'misspelled_philippians':
                # phillipians -> Philippians (book 50)
                full_book_id = 50 * 1000000
                return (full_book_id, None, pattern_type)

            elif pattern_type == 'topic_book_verse':
                # Topic - Book Ch_V-V (e.g., Creation - Romans 1_18-23)
                book_name, ch, v1, v2 = groups
                book_id = get_book_id(book_name)
                if book_id:
                    start_id = calculate_verse_id(book_id, int(ch), int(v1))
                    end_id = calculate_verse_id(book_id, int(ch), int(v2))
                    return (start_id, end_id, pattern_type)

            elif pattern_type == 'topic_book_chapter':
                # Topic Book Ch (e.g., Christ Myth Luke 1)
                book_name, ch = groups
                book_id = get_book_id(book_name)
                if book_id:
                    chapter = int(ch)
                    max_verse = get_max_verse(book_id, chapter, verse_counts)
                    if max_verse:
                        start_id = calculate_verse_id(book_id, chapter, 1)
                        end_id = calculate_verse_id(book_id, chapter, max_verse)
                        return (start_id, end_id, pattern_type)

            elif pattern_type == 'book_prefix_nospace_verse':
                # Book PREFIX Ch.V-V (e.g., 1_Peter NSCA5.1-12)
                book_name, ch, v1, v2 = groups
                book_id = get_book_id(book_name)
                if book_id:
                    start_id = calculate_verse_id(book_id, int(ch), int(v1))
                    end_id = calculate_verse_id(book_id, int(ch), int(v2))
                    return (start_id, end_id, pattern_type)

            elif pattern_type == 'embedded_numbered_verse':
                # FAREWELL - 1 Tim 4.16
                num, book_part, ch, v = groups
                book_name = f"{num}_{book_part}"
                book_id = get_book_id(book_name)
                if book_id:
                    # Single verse
                    verse_id = calculate_verse_id(book_id, int(ch), int(v))
                    return (verse_id, verse_id, pattern_type)

            elif pattern_type == 'numbered_book_only':
                # 1_Thess style book only
                book_name = groups[0]
                book_num = get_book_id(book_name)
                if book_num:
                    full_book_id = book_num * 1000000
                    return (full_book_id, None, pattern_type)

            elif pattern_type in ('numbered_book_dash', 'numbered_book_word_outline'):
                # 1_John - valentine, 1_Peter RUSE Outline
                book_name = groups[0]
                book_num = get_book_id(book_name)
                if book_num:
                    full_book_id = book_num * 1000000
                    return (full_book_id, None, pattern_type)

            elif pattern_type in ('book_dash_topic', 'book_word_suffix'):
                # Daniel - thoughts, Philippians HSC
                book_name = groups[0]
                book_num = get_book_id(book_name)
                if book_num:
                    full_book_id = book_num * 1000000
                    return (full_book_id, None, pattern_type)

            elif pattern_type == 'revelation_tilde':
                # Revelation 5~5 -> Revelation 5:5
                _, ch, v = groups
                book_id = 66  # Revelation
                verse_id = calculate_verse_id(book_id, int(ch), int(v))
                return (verse_id, verse_id, pattern_type)

            elif pattern_type == 'book_translation_verse':
                # Romans - The_Translation_of_Romans_3_22 -> Romans 3:22
                book_name, ch, v = groups
                book_id = get_book_id(book_name)
                if book_id:
                    verse_id = calculate_verse_id(book_id, int(ch), int(v))
                    return (verse_id, verse_id, pattern_type)

            elif pattern_type == 'marks_book':
                # Marks Ephesians -> Ephesians
                book_name = groups[0]
                book_num = get_book_id(book_name)
                if book_num:
                    full_book_id = book_num * 1000000
                    return (full_book_id, None, pattern_type)

            elif pattern_type in ('book_zero_prefix', 'from_book', 'numbered_book_chapter_zero'):
                # Numbers_0NIV84 -> Numbers, "from Genesis" -> Genesis, "1_Peter 0" -> 1 Peter
                book_name = groups[0]
                book_num = get_book_id(book_name)
                if book_num:
                    full_book_id = book_num * 1000000
                    return (full_book_id, None, pattern_type)

    return None

def get_file_extension(filename):
    """Get file extension, preserving case."""
    parts = filename.rsplit('.', 1)
    return parts[1] if len(parts) > 1 else 'docx'

def main():
    """Main function to rename sermon files."""
    print("Loading verse counts...")
    verse_counts = load_verse_counts()
    print(f"Loaded {len(verse_counts)} chapter verse counts")

    # Ensure output directories exist
    OUTPUT_DIR.mkdir(exist_ok=True)
    MANUAL_DIR.mkdir(exist_ok=True)

    # Track seen ranges for duplicate handling
    seen_ranges = {}

    # Mapping log
    mapping_log = {
        'successful': [],
        'manual_review': [],
        'stats': {
            'total': 0,
            'renamed': 0,
            'manual': 0,
            'by_pattern': {}
        }
    }

    # Process all files
    files = list(INPUT_DIR.iterdir())
    print(f"Processing {len(files)} files...")

    for filepath in files:
        if not filepath.is_file():
            continue

        filename = filepath.name
        mapping_log['stats']['total'] += 1

        # Try to parse the filename
        result = parse_filename(filename, verse_counts)

        if result:
            start_id, end_id, pattern_type = result

            # Generate new filename
            ext = get_file_extension(filename)

            # Handle book-only pattern (end_id is None)
            if end_id is None:
                base_name = str(start_id)  # Just the book ID
            else:
                base_name = f"{start_id}-{end_id}"

            # Handle duplicates
            if base_name in seen_ranges:
                seen_ranges[base_name] += 1
                new_filename = f"{base_name}_{seen_ranges[base_name]}.{ext}"
            else:
                seen_ranges[base_name] = 0
                new_filename = f"{base_name}.{ext}"

            # Copy file to output directory
            new_path = OUTPUT_DIR / new_filename
            shutil.copy2(filepath, new_path)

            # Log successful mapping
            mapping_log['successful'].append({
                'original': filename,
                'new': new_filename,
                'start_verse_id': start_id,
                'end_verse_id': end_id,
                'pattern': pattern_type
            })
            mapping_log['stats']['renamed'] += 1
            mapping_log['stats']['by_pattern'][pattern_type] = \
                mapping_log['stats']['by_pattern'].get(pattern_type, 0) + 1

        else:
            # Could not parse - move to manual review
            manual_path = MANUAL_DIR / filename
            shutil.copy2(filepath, manual_path)

            mapping_log['manual_review'].append({
                'original': filename,
                'reason': 'Could not parse verse reference'
            })
            mapping_log['stats']['manual'] += 1

    # Write mapping log
    with open(MAPPING_LOG_PATH, 'w', encoding='utf-8') as f:
        json.dump(mapping_log, f, indent=2, ensure_ascii=False)

    # Print summary
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"Total files processed: {mapping_log['stats']['total']}")
    print(f"Successfully renamed:  {mapping_log['stats']['renamed']}")
    print(f"Manual review needed:  {mapping_log['stats']['manual']}")
    print("\nBy pattern type:")
    for pattern, count in sorted(mapping_log['stats']['by_pattern'].items()):
        print(f"  {pattern}: {count}")
    print(f"\nMapping log saved to: {MAPPING_LOG_PATH}")
    print(f"Renamed files in: {OUTPUT_DIR}")
    print(f"Manual review files in: {MANUAL_DIR}")

if __name__ == '__main__':
    main()
