#!/usr/bin/env python3
"""Install TrendPilot V9 assets and inject them into every HTML page."""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STYLE_TAG = '<link rel="stylesheet" href="/css/style-v9.css?v=9.0.0">'
SCRIPT_TAG = '<script defer src="/js/site-v9.js?v=9.0.0"></script>'

STYLE_RE = re.compile(r'\s*<link[^>]+href=["\']/css/style-v9\.css(?:\?[^"\']*)?["\'][^>]*>\s*', re.I)
SCRIPT_RE = re.compile(r'\s*<script[^>]+src=["\']/js/site-v9\.js(?:\?[^"\']*)?["\'][^>]*>\s*</script>\s*', re.I)


def inject(path: Path) -> bool:
    original = path.read_text(encoding="utf-8")
    text = STYLE_RE.sub("\n", original)
    text = SCRIPT_RE.sub("\n", text)

    if re.search(r"</head>", text, flags=re.I):
        text = re.sub(r"</head>", f"  {STYLE_TAG}\n</head>", text, count=1, flags=re.I)
    else:
        text = STYLE_TAG + "\n" + text

    if re.search(r"</body>", text, flags=re.I):
        text = re.sub(r"</body>", f"  {SCRIPT_TAG}\n</body>", text, count=1, flags=re.I)
    else:
        text = text + "\n" + SCRIPT_TAG + "\n"

    if text != original:
        path.write_text(text, encoding="utf-8")
        return True
    return False


def main() -> None:
    changed = 0
    scanned = 0
    for path in ROOT.rglob("*.html"):
        if any(part.startswith(".") for part in path.relative_to(ROOT).parts):
            continue
        if "node_modules" in path.parts:
            continue
        scanned += 1
        changed += int(inject(path))

    print(f"TrendPilot V9 injection complete: scanned={scanned}, changed={changed}")
    if scanned == 0:
        raise SystemExit("No HTML pages were found.")


if __name__ == "__main__":
    main()
