#!/usr/bin/env python3
"""Convert .doc/.docx files to Markdown using LibreOffice, pandoc, or mammoth."""

import os
import subprocess
import json
import shutil
import tempfile
from pathlib import Path
import time

# Configuration
INPUT_DIR = Path(__file__).parent / "Kenny_Sermon_Script_VerseID_temp"
OUTPUT_DIR = Path(__file__).parent / "Kenny_Sermon_Script_MD"
PANDOC_PATH = r"C:\Users\User\AppData\Local\Pandoc\pandoc.exe"
LIBREOFFICE_PATH = r"C:\Program Files\LibreOffice\program\soffice.exe"

# Stats tracking
stats = {
    "success": 0,
    "failed": 0,
    "skipped": 0,
    "files": []
}


def convert_doc_with_libreoffice(input_path: Path, output_path: Path) -> tuple[bool, str]:
    """Convert .doc to text using LibreOffice, then format as markdown."""
    try:
        # Create a temp directory for LibreOffice output
        with tempfile.TemporaryDirectory() as temp_dir:
            # LibreOffice converts to txt in the specified directory
            result = subprocess.run(
                [
                    LIBREOFFICE_PATH,
                    "--headless",
                    "--convert-to", "txt:Text",
                    "--outdir", temp_dir,
                    str(input_path)
                ],
                capture_output=True,
                text=True,
                timeout=120
            )

            if result.returncode != 0:
                return False, f"LibreOffice error: {result.stderr}"

            # Find the output file
            txt_file = Path(temp_dir) / (input_path.stem + ".txt")
            if not txt_file.exists():
                # Try other possible names
                txt_files = list(Path(temp_dir).glob("*.txt"))
                if txt_files:
                    txt_file = txt_files[0]
                else:
                    return False, "LibreOffice produced no output"

            # Read the text content
            try:
                content = txt_file.read_text(encoding="utf-8")
            except UnicodeDecodeError:
                content = txt_file.read_text(encoding="latin-1")

            if not content.strip():
                return False, "Empty content from LibreOffice"

            # Format as basic markdown (preserve paragraphs)
            lines = content.split('\n')
            md_lines = []
            for line in lines:
                line = line.rstrip()
                md_lines.append(line)

            # Write markdown
            output_path.write_text('\n'.join(md_lines), encoding="utf-8")

            if output_path.exists() and output_path.stat().st_size > 0:
                return True, "libreoffice"
            else:
                return False, "Failed to write output"

    except subprocess.TimeoutExpired:
        return False, "LibreOffice timeout"
    except Exception as e:
        return False, f"LibreOffice error: {str(e)}"


def convert_with_pandoc(input_path: Path, output_path: Path) -> tuple[bool, str]:
    """Convert .docx document using pandoc."""
    # Pandoc only supports docx, not doc
    if input_path.suffix.lower() == ".doc":
        return False, "Pandoc does not support .doc format"

    try:
        result = subprocess.run(
            [
                PANDOC_PATH,
                str(input_path),
                "-f", "docx",
                "-t", "markdown",
                "--wrap=none",
                "-o", str(output_path)
            ],
            capture_output=True,
            text=True,
            timeout=60
        )

        if result.returncode == 0:
            if output_path.exists() and output_path.stat().st_size > 0:
                return True, "pandoc"
            else:
                return False, f"Empty output: {result.stderr}"
        else:
            return False, f"Pandoc error: {result.stderr}"

    except subprocess.TimeoutExpired:
        return False, "Timeout"
    except Exception as e:
        return False, str(e)


def convert_with_mammoth(input_path: Path, output_path: Path) -> tuple[bool, str]:
    """Convert .docx using mammoth as fallback."""
    if input_path.suffix.lower() != ".docx":
        return False, "Mammoth only supports .docx"

    try:
        import mammoth

        with open(input_path, "rb") as docx_file:
            result = mammoth.convert_to_markdown(docx_file)
            markdown = result.value

            if markdown.strip():
                with open(output_path, "w", encoding="utf-8") as f:
                    f.write(markdown)
                return True, "mammoth"
            else:
                return False, "Empty output from mammoth"

    except Exception as e:
        return False, f"Mammoth error: {str(e)}"


def convert_with_python_docx(input_path: Path, output_path: Path) -> tuple[bool, str]:
    """Extract text using python-docx as last resort."""
    if input_path.suffix.lower() != ".docx":
        return False, "python-docx only supports .docx"

    try:
        from docx import Document

        doc = Document(str(input_path))
        lines = []

        for para in doc.paragraphs:
            text = para.text.strip()
            if text:
                style_name = para.style.name if para.style else ""
                if "Heading" in style_name:
                    level = 1
                    if "1" in style_name:
                        level = 1
                    elif "2" in style_name:
                        level = 2
                    elif "3" in style_name:
                        level = 3
                    lines.append(f"{'#' * level} {text}\n")
                else:
                    lines.append(f"{text}\n")

        if lines:
            with open(output_path, "w", encoding="utf-8") as f:
                f.writelines(lines)
            return True, "python-docx"
        else:
            return False, "No text content"

    except Exception as e:
        return False, f"python-docx error: {str(e)}"


def convert_file(input_path: Path, output_path: Path) -> dict:
    """Try multiple methods to convert a file."""
    result = {
        "input": str(input_path.name),
        "output": str(output_path.name),
        "success": False,
        "method": None,
        "error": None
    }

    is_doc = input_path.suffix.lower() == ".doc"

    if is_doc:
        # For .doc files, use LibreOffice
        success, method = convert_doc_with_libreoffice(input_path, output_path)
        if success:
            result["success"] = True
            result["method"] = method
            return result
        result["error"] = method
    else:
        # For .docx files, try pandoc first
        success, method = convert_with_pandoc(input_path, output_path)
        if success:
            result["success"] = True
            result["method"] = method
            return result

        pandoc_error = method

        # Try mammoth
        success, method = convert_with_mammoth(input_path, output_path)
        if success:
            result["success"] = True
            result["method"] = method
            return result

        # Try python-docx as last resort
        success, method = convert_with_python_docx(input_path, output_path)
        if success:
            result["success"] = True
            result["method"] = method
            return result

        # Try LibreOffice as final fallback for .docx
        success, method = convert_doc_with_libreoffice(input_path, output_path)
        if success:
            result["success"] = True
            result["method"] = method
            return result

        result["error"] = pandoc_error

    return result


def main():
    """Main conversion process."""
    print(f"Input directory: {INPUT_DIR}")
    print(f"Output directory: {OUTPUT_DIR}")
    print(f"LibreOffice: {LIBREOFFICE_PATH}")
    print(f"Pandoc: {PANDOC_PATH}")

    # Create output directory
    OUTPUT_DIR.mkdir(exist_ok=True)

    # Get list of files to convert
    files_to_convert = []
    for ext in ["*.doc", "*.docx", "*.DOC", "*.DOCX"]:
        files_to_convert.extend(INPUT_DIR.glob(ext))

    # Remove duplicates (case-insensitive on Windows)
    seen = set()
    unique_files = []
    for f in files_to_convert:
        key = f.name.lower()
        if key not in seen:
            seen.add(key)
            unique_files.append(f)
    files_to_convert = unique_files

    print(f"\nFound {len(files_to_convert)} unique files to convert")

    if not files_to_convert:
        print("No files found!")
        return

    # Separate .doc and .docx for stats
    doc_count = sum(1 for f in files_to_convert if f.suffix.lower() == ".doc")
    docx_count = len(files_to_convert) - doc_count
    print(f"  - .doc files: {doc_count}")
    print(f"  - .docx files: {docx_count}")

    # Prepare conversion tasks
    tasks = []
    for input_path in files_to_convert:
        output_name = input_path.stem + ".md"
        output_path = OUTPUT_DIR / output_name
        tasks.append((input_path, output_path))

    # Process files with progress
    start_time = time.time()
    results = []

    for i, (input_path, output_path) in enumerate(tasks, 1):
        result = convert_file(input_path, output_path)
        results.append(result)

        if result["success"]:
            stats["success"] += 1
        else:
            stats["failed"] += 1

        # Progress update every 50 files
        if i % 50 == 0 or i == len(tasks):
            elapsed = time.time() - start_time
            rate = i / elapsed if elapsed > 0 else 0
            remaining = (len(tasks) - i) / rate if rate > 0 else 0
            print(f"Progress: {i}/{len(tasks)} ({stats['success']} OK, {stats['failed']} failed) "
                  f"- {rate:.1f} files/sec, ~{remaining:.0f}s remaining")

    # Summary
    elapsed = time.time() - start_time
    print(f"\n{'='*60}")
    print(f"CONVERSION COMPLETE")
    print(f"{'='*60}")
    print(f"Total files:    {len(tasks)}")
    print(f"Successful:     {stats['success']} ({100*stats['success']/len(tasks):.1f}%)")
    print(f"Failed:         {stats['failed']} ({100*stats['failed']/len(tasks):.1f}%)")
    print(f"Time:           {elapsed:.1f} seconds")
    print(f"Output dir:     {OUTPUT_DIR}")

    # Count by method
    methods = {}
    for r in results:
        if r["success"]:
            m = r["method"]
            methods[m] = methods.get(m, 0) + 1
    if methods:
        print(f"\nConversion methods used:")
        for m, c in sorted(methods.items(), key=lambda x: -x[1]):
            print(f"  - {m}: {c} files")

    # Save detailed log
    stats["files"] = results
    log_path = Path(__file__).parent / "conversion_log.json"
    with open(log_path, "w", encoding="utf-8") as f:
        json.dump(stats, f, indent=2)
    print(f"\nDetailed log:   {log_path}")

    # Show failed files
    failed = [r for r in results if not r["success"]]
    if failed:
        print(f"\nFailed files ({len(failed)}):")
        for f in failed[:20]:
            print(f"  - {f['input']}: {f['error'][:60] if f['error'] else 'Unknown error'}")
        if len(failed) > 20:
            print(f"  ... and {len(failed) - 20} more (see conversion_log.json)")


if __name__ == "__main__":
    main()
