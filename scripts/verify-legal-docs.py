#!/usr/bin/env python3
"""Verify structural parity of the 3 legal documents across the 3 locales.

For each document (terms / website_terms / privacy), checks that zh-HK,
zh-CN, and en all have the same number of numbered sections. zh-HK is the
canonical source (terms=8, website_terms=8, privacy=9 sections); zh-CN and
en are required to be faithful 1:1 translations with identical structure —
never independently rewritten or summarized.

Exits non-zero and prints a clear error if any locale's section count
doesn't match. Run after any edit to content/legal/*.ts.

Usage: python3 scripts/verify-legal-docs.py
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LEGAL_DIR = ROOT / "content" / "legal"

DOCS = ["terms", "website-terms", "privacy"]
LOCALES = ["zh-HK", "zh-CN", "en"]


def count_sections(ts_path: Path) -> int:
    """Count top-level `{ title: ..., body: ... }` entries in the `sections:`
    array of a content/legal/*.ts file, by counting `title:` occurrences
    that appear after the `sections: [` marker."""
    text = ts_path.read_text(encoding="utf-8")
    match = re.search(r"sections:\s*\[(.*)\]\s*,?\s*\}\s*$", text, re.DOTALL)
    if not match:
        raise ValueError(f"Could not locate sections array in {ts_path}")
    body = match.group(1)
    # Each section object starts with a `title:` key at the same nesting
    # level; count occurrences of the `\n      title:` pattern used by the
    # generator (2 levels of indentation under sections).
    return len(re.findall(r"^\s{6}title:", body, re.MULTILINE))


def main() -> int:
    print(f"{'Document':<16} {'zh-HK':>6} {'zh-CN':>6} {'en':>6}   Status")
    print("-" * 50)
    all_ok = True
    for doc in DOCS:
        counts = {}
        for locale in LOCALES:
            path = LEGAL_DIR / f"{doc}.{locale}.ts"
            if not path.exists():
                print(f"{doc:<16} MISSING FILE: {path}")
                all_ok = False
                counts[locale] = None
                continue
            counts[locale] = count_sections(path)

        values = [v for v in counts.values() if v is not None]
        ok = len(set(values)) == 1 and None not in counts.values()
        status = "OK" if ok else "MISMATCH"
        if not ok:
            all_ok = False
        print(
            f"{doc:<16} {str(counts.get('zh-HK', '-')):>6} "
            f"{str(counts.get('zh-CN', '-')):>6} {str(counts.get('en', '-')):>6}   {status}"
        )

    print()
    if all_ok:
        print("All documents have matching section counts across zh-HK / zh-CN / en.")
        return 0
    else:
        print("ERROR: section count mismatch detected — see table above.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
