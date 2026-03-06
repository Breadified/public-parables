#!/usr/bin/env python3
"""
Fetch a group of related Bible Plans from bible.com.

This script fetches a starting plan and all its related plans (e.g., all 12 quarters
of "A Chapter A Day 3 Years"), then saves them with proper ordering.

Usage:
    # Fetch Year 1 Quarter 1 and all related quarters
    python fetch_bible_plan_group.py --slug "3409-a-chapter-a-day-reading-the-bible-year-1-quarter-1" --group "chapter-a-day-3-years"

    # Save to biblePlans.json
    python fetch_bible_plan_group.py --slug "3409-..." --group "chapter-a-day-3-years" --name-filter "Chapter A Day" --save
"""

import argparse
import json
import os
import re
import sqlite3
import sys
import time
import urllib.request
import urllib.error
from typing import Dict, List, Optional, Set, Tuple, Any


# USFM book code to book ID mapping
USFM_TO_BOOK_ID = {
    # Old Testament
    "GEN": 1, "EXO": 2, "LEV": 3, "NUM": 4, "DEU": 5,
    "JOS": 6, "JDG": 7, "RUT": 8, "1SA": 9, "2SA": 10,
    "1KI": 11, "2KI": 12, "1CH": 13, "2CH": 14,
    "EZR": 15, "NEH": 16, "EST": 17, "JOB": 18, "PSA": 19,
    "PRO": 20, "ECC": 21, "SNG": 22, "ISA": 23,
    "JER": 24, "LAM": 25, "EZK": 26, "DAN": 27,
    "HOS": 28, "JOL": 29, "AMO": 30, "OBA": 31, "JON": 32,
    "MIC": 33, "NAM": 34, "HAB": 35, "ZEP": 36, "HAG": 37,
    "ZEC": 38, "MAL": 39,
    # New Testament
    "MAT": 40, "MRK": 41, "LUK": 42, "JHN": 43, "ACT": 44,
    "ROM": 45, "1CO": 46, "2CO": 47, "GAL": 48,
    "EPH": 49, "PHP": 50, "COL": 51,
    "1TH": 52, "2TH": 53, "1TI": 54,
    "2TI": 55, "TIT": 56, "PHM": 57, "HEB": 58,
    "JAS": 59, "1PE": 60, "2PE": 61, "1JN": 62,
    "2JN": 63, "3JN": 64, "JUD": 65, "REV": 66,
}

# Book ID to human-readable name
BOOK_ID_TO_NAME = {
    1: "Genesis", 2: "Exodus", 3: "Leviticus", 4: "Numbers", 5: "Deuteronomy",
    6: "Joshua", 7: "Judges", 8: "Ruth", 9: "1 Samuel", 10: "2 Samuel",
    11: "1 Kings", 12: "2 Kings", 13: "1 Chronicles", 14: "2 Chronicles",
    15: "Ezra", 16: "Nehemiah", 17: "Esther", 18: "Job", 19: "Psalms",
    20: "Proverbs", 21: "Ecclesiastes", 22: "Song of Songs", 23: "Isaiah",
    24: "Jeremiah", 25: "Lamentations", 26: "Ezekiel", 27: "Daniel",
    28: "Hosea", 29: "Joel", 30: "Amos", 31: "Obadiah", 32: "Jonah",
    33: "Micah", 34: "Nahum", 35: "Habakkuk", 36: "Zephaniah", 37: "Haggai",
    38: "Zechariah", 39: "Malachi",
    40: "Matthew", 41: "Mark", 42: "Luke", 43: "John", 44: "Acts",
    45: "Romans", 46: "1 Corinthians", 47: "2 Corinthians", 48: "Galatians",
    49: "Ephesians", 50: "Philippians", 51: "Colossians",
    52: "1 Thessalonians", 53: "2 Thessalonians", 54: "1 Timothy",
    55: "2 Timothy", 56: "Titus", 57: "Philemon", 58: "Hebrews",
    59: "James", 60: "1 Peter", 61: "2 Peter", 62: "1 John",
    63: "2 John", 64: "3 John", 65: "Jude", 66: "Revelation",
}


def fetch_url(url: str, retries: int = 3, delay: float = 1.0) -> str:
    """Fetch URL content with retries."""
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json, text/html",
    }

    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=30) as response:
                return response.read().decode("utf-8")
        except urllib.error.HTTPError as e:
            if e.code == 404:
                raise ValueError(f"Plan not found: {url}")
            if attempt < retries - 1:
                time.sleep(delay * (attempt + 1))
            else:
                raise
        except urllib.error.URLError as e:
            if attempt < retries - 1:
                time.sleep(delay * (attempt + 1))
            else:
                raise


def get_build_id() -> str:
    """Extract the Next.js build ID from bible.com."""
    print("Fetching build ID from bible.com...", file=sys.stderr)
    html = fetch_url("https://www.bible.com/reading-plans")

    match = re.search(r'"buildId"\s*:\s*"([^"]+)"', html)
    if match:
        build_id = match.group(1)
        print(f"Found build ID: {build_id}", file=sys.stderr)
        return build_id

    match = re.search(r'/_next/static/([a-zA-Z0-9_-]+)/', html)
    if match:
        build_id = match.group(1)
        print(f"Found build ID: {build_id}", file=sys.stderr)
        return build_id

    raise ValueError("Could not find build ID on bible.com")


def parse_usfm_reference(usfm: str) -> Tuple[Optional[int], Optional[int]]:
    """Parse USFM reference like 'GEN.1' into (book_id, chapter)."""
    parts = usfm.split(".")
    if len(parts) < 2:
        print(f"Warning: Invalid USFM format: {usfm}", file=sys.stderr)
        return None, None

    book_code = parts[0].upper()
    try:
        chapter = int(parts[1])
    except ValueError:
        print(f"Warning: Invalid chapter in USFM: {usfm}", file=sys.stderr)
        return None, None

    book_id = USFM_TO_BOOK_ID.get(book_code)
    if book_id is None:
        print(f"Warning: Unknown USFM book code: {book_code}", file=sys.stderr)
        return None, None

    return book_id, chapter


def get_verse_range(cursor, book_id: int, chapter: int) -> Tuple[int, int]:
    """Query the database for the first and last verse IDs in a chapter."""
    chapter_start = book_id * 1000000 + chapter * 1000
    chapter_end = chapter_start + 999

    cursor.execute("""
        SELECT MIN(id), MAX(id)
        FROM verses
        WHERE id >= ? AND id <= ?
    """, (chapter_start, chapter_end))

    result = cursor.fetchone()
    if result and result[0] is not None:
        return result[0], result[1]

    # Fallback
    verse_id_start = book_id * 1000000 + chapter * 1000 + 1
    return verse_id_start, verse_id_start


def fetch_plan_day(build_id: str, slug: str, day: int) -> Dict:
    """Fetch a single day's data from the plan."""
    url = f"https://www.bible.com/_next/data/{build_id}/en/reading-plans/{slug}/day/{day}.json?plan={slug}&day={day}"

    try:
        content = fetch_url(url)
        return json.loads(content)
    except Exception as e:
        print(f"Error fetching day {day}: {e}", file=sys.stderr)
        raise


def extract_readings_from_page(page_props: Dict) -> List[Dict]:
    """Extract reading references from page props."""
    readings = []
    verse_data = page_props.get("verseChapterData", [])

    for item in verse_data:
        ref = item.get("reference", {})
        usfm_list = ref.get("usfm", [])
        human = ref.get("human", "")

        for usfm in usfm_list:
            readings.append({
                "usfm": usfm,
                "human": human,
            })

    return readings


def fetch_plan(slug: str, build_id: Optional[str] = None) -> Dict:
    """Fetch all days of a reading plan."""
    if build_id is None:
        build_id = get_build_id()

    print(f"Fetching plan: {slug}", file=sys.stderr)

    # Fetch day 1 to get metadata
    day1_data = fetch_plan_day(build_id, slug, 1)
    page_props = day1_data.get("pageProps", {})

    plan_data = page_props.get("planData", {})
    total_days = plan_data.get("total_days", 1)

    name_obj = plan_data.get("name", {})
    name = name_obj.get("en") or name_obj.get("default", "Unknown Plan")

    about_obj = plan_data.get("about", {}).get("text", {})
    description = about_obj.get("en") or about_obj.get("default", "")

    metadata = {
        "id": plan_data.get("id"),
        "slug": plan_data.get("slug", slug),
        "name": name,
        "description": description.strip(),
        "total_days": total_days,
    }

    # Extract related plans
    related_plans = []
    for rp in page_props.get("readingPlans", []):
        related_plans.append({
            "id": rp.get("id"),
            "slug": rp.get("slug"),
            "name": rp.get("name", {}).get("default") if isinstance(rp.get("name"), dict) else rp.get("name"),
            "title": rp.get("title"),
            "total_days": rp.get("total_days"),
        })

    # Collect all days
    days = []

    # Process day 1
    day1_readings = extract_readings_from_page(page_props)
    days.append({"day": 1, "readings": day1_readings})

    # Fetch remaining days
    for day in range(2, total_days + 1):
        print(f"  Fetching day {day}/{total_days}...", file=sys.stderr)
        try:
            day_data = fetch_plan_day(build_id, slug, day)
            readings = extract_readings_from_page(day_data.get("pageProps", {}))
            days.append({"day": day, "readings": readings})

            if day % 10 == 0:
                time.sleep(0.5)
        except Exception as e:
            print(f"  Error on day {day}: {e}", file=sys.stderr)
            days.append({"day": day, "readings": []})

    return {
        "metadata": metadata,
        "days": days,
        "related_plans": related_plans,
    }


def generate_stable_id(name: str, group_id: str) -> Optional[str]:
    """Generate a stable ID from plan name using pattern {group}-y{year}q{quarter}."""
    year_match = re.search(r'Year\s*(\d+)', name, re.IGNORECASE)
    quarter_match = re.search(r'Quarter\s*(\d+)', name, re.IGNORECASE)

    if year_match and quarter_match:
        year = year_match.group(1)
        quarter = quarter_match.group(1)
        return f"{group_id}-y{year}q{quarter}"
    return None


def convert_to_bible_plan(
    plan_data: Dict,
    cursor,
    group_id: Optional[str] = None,
    group_name: Optional[str] = None,
    order: Optional[int] = None,
    existing_plans: Optional[Dict[str, str]] = None,
) -> Dict:
    """Convert fetched plan data to biblePlans.json format.

    Args:
        existing_plans: Dict mapping plan names to existing IDs to preserve
    """
    metadata = plan_data["metadata"]
    plan_name = metadata["name"]

    # Check if plan already exists in biblePlans.json (match by name)
    if existing_plans and plan_name in existing_plans:
        plan_id = existing_plans[plan_name]
        print(f"  Using existing ID: {plan_id}", file=sys.stderr)
    elif group_id:
        # Generate stable ID for new plans
        plan_id = generate_stable_id(plan_name, group_id)
        if plan_id:
            print(f"  Generated stable ID: {plan_id}", file=sys.stderr)
        else:
            # Fallback to UUID if pattern doesn't match
            import uuid
            plan_id = f"{group_id}-{str(uuid.uuid4())[:8]}"
            print(f"  Generated UUID ID: {plan_id}", file=sys.stderr)
    else:
        # Fallback to slug-based ID
        slug = metadata.get("slug", "")
        plan_id = slug if slug else f"plan-{metadata.get('id', 'unknown')}"

    plan_days = []

    for day_data in plan_data["days"]:
        day_num = day_data["day"]
        readings = []

        for reading in day_data["readings"]:
            usfm = reading.get("usfm", "")
            human = reading.get("human", "")

            book_id, chapter = parse_usfm_reference(usfm)
            if book_id is None:
                continue

            verse_id_start, verse_id_end = get_verse_range(cursor, book_id, chapter)
            reference = human if human else f"{BOOK_ID_TO_NAME.get(book_id, 'Unknown')} {chapter}"

            readings.append({
                "reference": reference,
                "verseIdStart": verse_id_start,
                "verseIdEnd": verse_id_end,
            })

        plan_days.append({
            "day": day_num,
            "readings": readings,
        })

    result = {
        "id": plan_id,
        "name": metadata["name"],
        "description": metadata["description"],
        "duration": metadata["total_days"],
        "source": "bible.com",
        "plan": plan_days,
    }

    if group_id:
        result["group"] = group_id

    if group_name:
        result["groupName"] = group_name

    if order is not None:
        result["order"] = order

    return result


def load_existing_plans(path: str) -> Dict:
    """Load existing biblePlans.json if it exists."""
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    return {"biblePlans": []}


def save_plans(plans: Dict, path: str):
    """Save plans to biblePlans.json."""
    with open(path, "w", encoding="utf-8") as f:
        json.dump(plans, f, indent=2, ensure_ascii=False)


def sort_plans_by_name(plans: List[Dict]) -> List[Dict]:
    """Sort plans by year and quarter extracted from their names."""
    def extract_order(plan: Dict) -> tuple:
        name = plan.get("name", "")
        year_match = re.search(r'Year\s*(\d+)', name, re.IGNORECASE)
        quarter_match = re.search(r'Quarter\s*(\d+)', name, re.IGNORECASE)
        year = int(year_match.group(1)) if year_match else 999
        quarter = int(quarter_match.group(1)) if quarter_match else 999
        return (year, quarter, name)

    return sorted(plans, key=extract_order)


def fetch_plan_group(
    starting_slug: str,
    group_id: str,
    group_name: str,
    cursor,
    build_id: Optional[str] = None,
    delay_between_plans: float = 2.0,
    name_filter: Optional[str] = None,
    existing_plans: Optional[Dict[str, str]] = None,
) -> List[Dict]:
    """Fetch a starting plan and all its related plans.

    Args:
        existing_plans: Dict mapping plan names to existing IDs to preserve
    """
    if build_id is None:
        build_id = get_build_id()

    fetched_slugs: Set[str] = set()
    all_plans: List[Dict] = []
    slugs_to_fetch: List[str] = [starting_slug]

    while slugs_to_fetch:
        slug = slugs_to_fetch.pop(0)

        if slug in fetched_slugs:
            continue

        print(f"\n{'='*60}", file=sys.stderr)
        print(f"Fetching: {slug}", file=sys.stderr)
        print(f"{'='*60}", file=sys.stderr)

        try:
            plan_data = fetch_plan(slug, build_id)
            bible_plan = convert_to_bible_plan(
                plan_data, cursor, group_id, group_name, existing_plans=existing_plans
            )
            all_plans.append(bible_plan)
            fetched_slugs.add(slug)

            # Add related plans to the queue (only if name matches)
            for rp in plan_data.get("related_plans", []):
                rp_id = rp.get("id")
                rp_slug = rp.get("slug")
                rp_name = rp.get("title") or ""
                if not rp_name:
                    name_field = rp.get("name")
                    if isinstance(name_field, str):
                        rp_name = name_field
                    elif isinstance(name_field, dict):
                        rp_name = name_field.get("default") or ""

                if name_filter and name_filter.lower() not in rp_name.lower():
                    print(f"  Skipping (name filter): {rp_name}", file=sys.stderr)
                    continue

                if rp_id and rp_slug:
                    full_slug = f"{rp_id}-{rp_slug}"
                    if full_slug not in fetched_slugs:
                        slugs_to_fetch.append(full_slug)
                        print(f"  Queued related: {full_slug}", file=sys.stderr)

            if slugs_to_fetch:
                print(f"\nWaiting {delay_between_plans}s before next plan...", file=sys.stderr)
                time.sleep(delay_between_plans)

        except Exception as e:
            print(f"Error fetching {slug}: {e}", file=sys.stderr)
            fetched_slugs.add(slug)

    # Sort plans by year/quarter and assign order numbers
    sorted_plans = sort_plans_by_name(all_plans)

    # Assign order numbers
    for i, plan in enumerate(sorted_plans):
        plan["order"] = i + 1

    return sorted_plans


def main():
    parser = argparse.ArgumentParser(
        description="Fetch a group of related Bible plans from bible.com"
    )
    parser.add_argument(
        "--slug",
        required=True,
        help="Starting plan slug (e.g., '3409-a-chapter-a-day-reading-the-bible-year-1-quarter-1')"
    )
    parser.add_argument(
        "--group",
        required=True,
        help="Group ID for organizing the plans (e.g., 'chapter-a-day-3-years')"
    )
    parser.add_argument(
        "--group-name",
        required=True,
        help="Human-readable group name (e.g., 'A Chapter A Day: Reading The Bible In 3 Years')"
    )
    parser.add_argument(
        "--build-id",
        help="Next.js build ID (fetched automatically if not provided)"
    )
    parser.add_argument(
        "--save",
        action="store_true",
        help="Save to biblePlans.json instead of printing to stdout"
    )
    parser.add_argument(
        "--output",
        help="Output file path (default: ../biblePlans.json with --save)"
    )
    parser.add_argument(
        "--replace",
        action="store_true",
        help="Replace existing plans with same IDs"
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=2.0,
        help="Delay in seconds between fetching plans (default: 2.0)"
    )
    parser.add_argument(
        "--name-filter",
        help="Only fetch related plans whose name contains this string (e.g., 'Chapter A Day')"
    )

    args = parser.parse_args()

    script_dir = os.path.dirname(os.path.abspath(__file__))
    db_path = os.path.join(script_dir, "..", "data", "bible.db")

    if not os.path.exists(db_path):
        print(f"Error: Database not found at {db_path}", file=sys.stderr)
        print("Please ensure bible.db exists in bible-data/data/", file=sys.stderr)
        sys.exit(1)

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # Load existing plans to preserve their IDs
        output_path = args.output or os.path.join(script_dir, "..", "biblePlans.json")
        existing_data = load_existing_plans(output_path)
        existing_plans_by_name = {
            p["name"]: p["id"] for p in existing_data.get("biblePlans", [])
        }
        print(f"Loaded {len(existing_plans_by_name)} existing plans", file=sys.stderr)

        plans = fetch_plan_group(
            args.slug,
            args.group,
            args.group_name,
            cursor,
            args.build_id,
            args.delay,
            args.name_filter,
            existing_plans=existing_plans_by_name,
        )

        print(f"\n{'='*60}", file=sys.stderr)
        print(f"Fetched {len(plans)} plans:", file=sys.stderr)
        for p in plans:
            print(f"  - {p['order']}: {p['name']}", file=sys.stderr)
        print(f"{'='*60}", file=sys.stderr)

        if args.save:
            output_path = args.output or os.path.join(script_dir, "..", "biblePlans.json")
            existing = load_existing_plans(output_path)
            existing_ids = {p["id"] for p in existing["biblePlans"]}

            added = 0
            replaced = 0

            for plan in plans:
                if plan["id"] in existing_ids:
                    if args.replace:
                        for i, ep in enumerate(existing["biblePlans"]):
                            if ep["id"] == plan["id"]:
                                existing["biblePlans"][i] = plan
                                replaced += 1
                                break
                    else:
                        print(f"Skipping existing: {plan['id']}", file=sys.stderr)
                else:
                    existing["biblePlans"].append(plan)
                    added += 1

            save_plans(existing, output_path)
            print(f"\nSaved to {output_path}", file=sys.stderr)
            print(f"  Added: {added}, Replaced: {replaced}", file=sys.stderr)
        else:
            output = {"biblePlans": plans}
            print(json.dumps(output, indent=2, ensure_ascii=False))

    finally:
        conn.close()

    print("\nDone!", file=sys.stderr)


if __name__ == "__main__":
    main()
