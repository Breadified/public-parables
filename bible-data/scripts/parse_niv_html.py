#!/usr/bin/env python3
"""
Step 2: Parse downloaded NIV HTML files into structured JSON.
Follows the same patterns as ESV parser for consistency.
"""

import json
import re
import zipfile
from pathlib import Path
from typing import Dict, List, Optional, Set
from bs4 import BeautifulSoup, Tag, NavigableString

# Book information (bookNumber, name, testament, num_chapters)
BOOK_INFO = [
    (1, "Genesis", "Old", 50), (2, "Exodus", "Old", 40), (3, "Leviticus", "Old", 27),
    (4, "Numbers", "Old", 36), (5, "Deuteronomy", "Old", 34), (6, "Joshua", "Old", 24),
    (7, "Judges", "Old", 21), (8, "Ruth", "Old", 4), (9, "1 Samuel", "Old", 31),
    (10, "2 Samuel", "Old", 24), (11, "1 Kings", "Old", 22), (12, "2 Kings", "Old", 25),
    (13, "1 Chronicles", "Old", 29), (14, "2 Chronicles", "Old", 36), (15, "Ezra", "Old", 10),
    (16, "Nehemiah", "Old", 13), (17, "Esther", "Old", 10), (18, "Job", "Old", 42),
    (19, "Psalms", "Old", 150), (20, "Proverbs", "Old", 31), (21, "Ecclesiastes", "Old", 12),
    (22, "Song of Solomon", "Old", 8), (23, "Isaiah", "Old", 66), (24, "Jeremiah", "Old", 52),
    (25, "Lamentations", "Old", 5), (26, "Ezekiel", "Old", 48), (27, "Daniel", "Old", 12),
    (28, "Hosea", "Old", 14), (29, "Joel", "Old", 3), (30, "Amos", "Old", 9),
    (31, "Obadiah", "Old", 1), (32, "Jonah", "Old", 4), (33, "Micah", "Old", 7),
    (34, "Nahum", "Old", 3), (35, "Habakkuk", "Old", 3), (36, "Zephaniah", "Old", 3),
    (37, "Haggai", "Old", 2), (38, "Zechariah", "Old", 14), (39, "Malachi", "Old", 4),
    (40, "Matthew", "New", 28), (41, "Mark", "New", 16), (42, "Luke", "New", 24),
    (43, "John", "New", 21), (44, "Acts", "New", 28), (45, "Romans", "New", 16),
    (46, "1 Corinthians", "New", 16), (47, "2 Corinthians", "New", 13), (48, "Galatians", "New", 6),
    (49, "Ephesians", "New", 6), (50, "Philippians", "New", 4), (51, "Colossians", "New", 4),
    (52, "1 Thessalonians", "New", 5), (53, "2 Thessalonians", "New", 3), (54, "1 Timothy", "New", 6),
    (55, "2 Timothy", "New", 4), (56, "Titus", "New", 3), (57, "Philemon", "New", 1),
    (58, "Hebrews", "New", 13), (59, "James", "New", 5), (60, "1 Peter", "New", 5),
    (61, "2 Peter", "New", 3), (62, "1 John", "New", 5), (63, "2 John", "New", 1),
    (64, "3 John", "New", 1), (65, "Jude", "New", 1), (66, "Revelation", "New", 22),
]


def extract_verse_number_from_span(span: Tag) -> Optional[int]:
    """
    Extract verse number from span class like 'Gen-1-5', '1Sam-12-3', or 'Ps-23-2'.
    Uses regex to match any book abbreviation pattern followed by chapter-verse numbers.
    """
    classes = span.get('class', [])
    for cls in classes:
        # Match pattern: optional number, letters (book abbreviation), dash, numbers, dash, numbers
        # Examples: Gen-1-5, 1Sam-12-3, 2Cor-5-17, Rev-21-4
        match = re.match(r'^(\d)?([A-Za-z]+)-(\d+)-(\d+)$', cls)
        if match:
            verse_number = int(match.group(4))  # The last number is the verse number
            return verse_number
    return None


def get_indent_level(elem: Tag) -> int:
    """Determine indent level from element's parent span classes."""
    # Check if element or its parent has indent classes
    current = elem
    while current:
        if isinstance(current, Tag):
            classes = current.get('class', [])
            for cls in classes:
                if cls == 'indent-1':
                    return 3
                elif cls == 'indent-2':
                    return 4
                elif cls == 'indent-3':
                    return 5
        current = current.parent if hasattr(current, 'parent') else None
    return 2  # Base poetry indent


def clean_text(text: str) -> str:
    """
    Aggressively clean text to ensure only valid Bible text remains.
    Remove all non-printable characters, encoded garbage, and normalize whitespace.
    """
    # First, remove all control characters (0x00-0x1F and 0x7F-0x9F) except tabs and newlines
    # This catches characters like 0x9d that cause encoding errors
    cleaned_chars = []
    for char in text:
        code = ord(char)
        # Keep printable ASCII (32-126), tab (9), newline (10)
        # Skip ALL control characters including 0x80-0x9F range
        if (code >= 32 and code <= 126) or code == 9 or code == 10:
            cleaned_chars.append(char)
        # Keep common accented characters
        elif char in 'àáâãäåèéêëìíîïòóôõöùúûüýÿñçÀÁÂÃÄÅÈÉÊËÌÍÎÏÒÓÔÕÖÙÚÛÜÝŸÑÇ':
            cleaned_chars.append(char)
        # Keep common punctuation marks in extended ASCII (use unicode escapes)
        elif char in '\u2018\u2019\u201C\u201D\u2013\u2014':
            # Convert fancy quotes/dashes to ASCII
            if char == '\u2018': cleaned_chars.append("'")  # Left single quote
            elif char == '\u2019': cleaned_chars.append("'")  # Right single quote
            elif char == '\u201C': cleaned_chars.append('"')  # Left double quote
            elif char == '\u201D': cleaned_chars.append('"')  # Right double quote
            elif char == '\u2013': cleaned_chars.append('-')  # En dash
            elif char == '\u2014': cleaned_chars.append('-')  # Em dash
        # Skip everything else (including 0x9d and other garbage)

    text = ''.join(cleaned_chars)

    # Replace various space characters with regular space
    text = text.replace('\u00A0', ' ')
    text = text.replace('\xa0', ' ')
    text = text.replace('\u202F', ' ')
    text = text.replace('\u2003', ' ')

    # Normalize multiple spaces/whitespace to single space
    text = re.sub(r'\s+', ' ', text)

    return text.strip()


def parse_chapter_html(html_content: str, book_id: int, chapter_num: int) -> Dict:
    """Parse a single chapter HTML into structured format."""
    soup = BeautifulSoup(html_content, 'html.parser')
    chapter_id = book_id + (chapter_num * 1000)

    # Find std-text div
    std_text = soup.find('div', class_='std-text')
    if not std_text:
        return None

    chapter = {
        "id": chapter_id,
        "chapterNumber": chapter_num,
        "bookId": book_id,
        "version": "NIV",
        "sections": []
    }

    section_counter = 1
    paragraph_counter = 1
    current_section = None
    processed_verses: Set[int] = set()  # Track which verses we've seen
    verse_line_counters: Dict[int, int] = {}  # Track suffix counter for each verse globally

    # Process all direct children in order
    for elem in std_text.children:
        if not isinstance(elem, Tag):
            continue

        # Section titles (h3)
        if elem.name == 'h3':
            # Remove bracketed markers like (A), (B), (AN), etc.
            title = elem.get_text(strip=True)
            title = re.sub(r'\([A-Z]+\)', '', title).strip()

            if title:
                current_section = {
                    "id": chapter_id + section_counter,
                    "chapterId": chapter_id,
                    "title": title,
                    "paragraphs": []
                }
                chapter["sections"].append(current_section)
                section_counter += 1
            continue

        # Subtitles (h4) - psalm titles, etc.
        if elem.name == 'h4':
            if current_section:
                subtitle = elem.get_text(strip=True)
                # Remove bracketed markers
                subtitle = re.sub(r'\([A-Z]+\)', '', subtitle).strip()
                current_section["subtitle"] = subtitle
            continue

        # Direct paragraph tags (some chapters have p directly under std-text)
        if elem.name == 'p':
            # Create default section if none exists
            if not current_section:
                current_section = {
                    "id": chapter_id + section_counter,
                    "chapterId": chapter_id,
                    "title": None,
                    "paragraphs": []
                }
                chapter["sections"].append(current_section)
                section_counter += 1

            # Process this paragraph
            paragraph_id = chapter_id + paragraph_counter
            paragraph = {
                "id": paragraph_id,
                "sectionId": current_section["id"],
                "verseLines": []
            }

            # Check if it's poetry (look for <br> tags)
            if elem.find('br'):
                parse_poetry_paragraph(elem, paragraph, chapter_id, processed_verses, verse_line_counters)
            else:
                parse_prose_paragraph(elem, paragraph, chapter_id, processed_verses, verse_line_counters)

            if paragraph["verseLines"]:
                current_section["paragraphs"].append(paragraph)
                paragraph_counter += 1
            continue

        # Content divs (list or poetry)
        if elem.name == 'div':
            is_poetry = 'poetry' in elem.get('class', [])

            # Create default section if none exists
            if not current_section:
                current_section = {
                    "id": chapter_id + section_counter,
                    "chapterId": chapter_id,
                    "title": None,
                    "paragraphs": []
                }
                chapter["sections"].append(current_section)
                section_counter += 1

            # Find all paragraphs in this div
            paragraphs = elem.find_all('p', recursive=False)

            for p_tag in paragraphs:
                paragraph_id = chapter_id + paragraph_counter
                paragraph = {
                    "id": paragraph_id,
                    "sectionId": current_section["id"],
                    "verseLines": []
                }

                if is_poetry:
                    # Poetry: split by <br> tags into separate lines
                    parse_poetry_paragraph(p_tag, paragraph, chapter_id, processed_verses, verse_line_counters)
                else:
                    # Prose: regular paragraph processing
                    parse_prose_paragraph(p_tag, paragraph, chapter_id, processed_verses, verse_line_counters)

                if paragraph["verseLines"]:
                    current_section["paragraphs"].append(paragraph)
                    paragraph_counter += 1

    # Clean up undefined subtitles
    for section in chapter["sections"]:
        if "subtitle" in section and not section["subtitle"]:
            del section["subtitle"]

    return chapter


def parse_poetry_paragraph(p_tag: Tag, paragraph: Dict, chapter_id: int, processed_verses: Set[int], verse_line_counters: Dict[int, int]):
    """Parse a poetry paragraph (split by <br> tags)."""
    # Get HTML and split by <br> tags
    html = str(p_tag)
    line_htmls = re.split(r'<br\s*/?>', html)

    for line_html in line_htmls:
        if not line_html.strip():
            continue

        line_soup = BeautifulSoup(line_html, 'html.parser')

        # Find verse spans in this line
        verse_spans = line_soup.find_all('span', class_='text')

        for span in verse_spans:
            verse_num = extract_verse_number_from_span(span)
            if not verse_num:
                continue

            verse_id = chapter_id + verse_num

            # Remove cross-references and footnotes
            for sup in span.find_all('sup', class_='crossreference'):
                sup.decompose()
            for sup in span.find_all('sup', class_='footnote'):
                sup.decompose()
            for sup in span.find_all('sup', class_='versenum'):
                sup.decompose()

            # Remove indent-breaks spans (they're just whitespace)
            for indent_break in span.find_all('span', class_=lambda x: x and 'indent' in ' '.join(x) and 'breaks' in ' '.join(x)):
                indent_break.decompose()

            # Get text
            text = span.get_text(separator=' ', strip=True)
            text = clean_text(text)

            # Remove verse number from start of text
            text = re.sub(rf'^{verse_num}\s+', '', text)

            if text:
                # Determine indent level
                indent_level = get_indent_level(span)

                # Check if first occurrence
                is_first_occurrence = verse_id not in processed_verses
                if is_first_occurrence:
                    processed_verses.add(verse_id)

                # Calculate suffix using global counter
                if verse_id not in verse_line_counters:
                    verse_line_counters[verse_id] = 0
                suffix = f"_{verse_line_counters[verse_id]}"
                verse_line_counters[verse_id] += 1

                verse_line = {
                    "id": f"{verse_id}{suffix}",
                    "text": text,
                    "isIsolated": True,  # Poetry
                    "indentLevel": indent_level,
                    "paragraphId": paragraph["id"],
                    "verseId": verse_id,
                }

                if is_first_occurrence:
                    verse_line["verseNumber"] = verse_num

                paragraph["verseLines"].append(verse_line)


def parse_prose_paragraph(p_tag: Tag, paragraph: Dict, chapter_id: int, processed_verses: Set[int], verse_line_counters: Dict[int, int]):
    """Parse a regular prose paragraph."""
    # Find all verse spans
    verse_spans = p_tag.find_all('span', class_='text')

    if not verse_spans:
        return

    for span in verse_spans:
        verse_num = extract_verse_number_from_span(span)
        if not verse_num:
            continue

        verse_id = chapter_id + verse_num

        # Remove cross-references and footnotes
        for sup in span.find_all('sup', class_='crossreference'):
            sup.decompose()
        for sup in span.find_all('sup', class_='footnote'):
            sup.decompose()
        for sup in span.find_all('sup', class_='versenum'):
            sup.decompose()
        for sup in span.find_all('span', class_='chapternum'):
            sup.decompose()

        # Get text
        text = span.get_text(separator=' ', strip=True)
        text = clean_text(text)

        # Remove verse number from start
        text = re.sub(rf'^{verse_num}\s+', '', text)

        if text:
            # Check if first occurrence
            is_first_occurrence = verse_id not in processed_verses
            if is_first_occurrence:
                processed_verses.add(verse_id)

            # Calculate suffix using global counter
            if verse_id not in verse_line_counters:
                verse_line_counters[verse_id] = 0
            suffix = f"_{verse_line_counters[verse_id]}"
            verse_line_counters[verse_id] += 1

            verse_line = {
                "id": f"{verse_id}{suffix}",
                "text": text,
                "isIsolated": False,  # Prose
                "indentLevel": 0,
                "paragraphId": paragraph["id"],
                "verseId": verse_id,
            }

            if is_first_occurrence:
                verse_line["verseNumber"] = verse_num

            paragraph["verseLines"].append(verse_line)


def main():
    """Main entry point."""
    script_dir = Path(__file__).parent
    zip_path = script_dir.parent / "source" / "niv_html.zip"
    output_path = script_dir.parent / "data" / "NIV_bibleData.json"

    print("="*60)
    print("NIV HTML Parser - Step 2")
    print("="*60)
    print(f"Input ZIP file: {zip_path}")
    print(f"Output file: {output_path}")
    print("="*60)

    if not zip_path.exists():
        print(f"\nERROR: ZIP file not found at {zip_path}")
        return

    books = []

    with zipfile.ZipFile(zip_path, 'r') as zip_ref:
        for book_num, book_name, testament, num_chapters in BOOK_INFO:
            book_id = book_num * 1000000
            print(f"\n{book_name} ({num_chapters} chapters)")

            chapters = []
            for chapter_num in range(1, num_chapters + 1):
                # Construct the path inside the ZIP
                book_folder = f"{book_num:02d}_{book_name.replace(' ', '_')}"
                html_file_path = f"niv_html/{book_folder}/chapter_{chapter_num:03d}.html"

                print(f"  Chapter {chapter_num:3d}/{num_chapters} - ", end='', flush=True)

                try:
                    # Read from ZIP
                    html_content = zip_ref.read(html_file_path).decode('utf-8')
                    chapter = parse_chapter_html(html_content, book_id, chapter_num)

                    if chapter:
                        chapters.append(chapter)
                        print("OK")
                    else:
                        print("EMPTY")
                except KeyError:
                    print("MISSING")
                except Exception as e:
                    print(f"ERROR: {e}")

            book = {
                "id": book_id,
                "name": book_name,
                "testament": testament,
                "chapters": chapters
            }
            books.append(book)

    # Save final output
    output_data = {"books": books}
    print(f"\nWriting output to: {output_path}")
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, ensure_ascii=False, indent=2)

    print(f"\n{'='*60}")
    print("PARSING COMPLETE!")
    print(f"Total books: {len(books)}")
    total_chapters = sum(len(book['chapters']) for book in books)
    print(f"Total chapters: {total_chapters}")
    total_verses = sum(
        len(para['verseLines'])
        for book in books
        for chapter in book['chapters']
        for section in chapter['sections']
        for para in section['paragraphs']
    )
    print(f"Total verse lines: {total_verses}")
    print(f"Output: {output_path}")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
