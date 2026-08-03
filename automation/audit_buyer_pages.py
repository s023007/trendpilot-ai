#!/usr/bin/env python3
"""Lightweight buyer-facing HTML audit for TrendPilot.

This is deliberately dependency-free so it can run inside the existing GitHub
Action. It reports problems instead of pretending every page is a product page.
Legal/trust pages are allowed to be text-led; commercial landing pages are
checked for useful media and buyer-language hygiene.
"""
from __future__ import annotations

import argparse
import json
import re
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "buyer-page-audit.json"

SKIP_DIRS = {".git", "node_modules", "automation", "data"}
TEXT_LED = {
    "privacy.html", "terms.html", "corrections.html", "contact.html",
    "affiliate-disclosure.html", "about.html", "editorial-methodology.html",
    "how-we-test.html", "404.html",
}
BUYER_DIRS = {"find", "compare", "products", "software", "sourcing"}
INTERNAL_PHRASES = {
    "seo-friendly structure": "internalDesignLanguage",
    "buyer feeling first": "internalDesignLanguage",
    "made for human readers": "internalDesignLanguage",
    "trust and cpc kept separate": "internalRevenueLanguage",
    "active programmes": "internalProgrammeLanguage",
    "revenue model": "internalRevenueLanguage",
    "guide basis": "internalMethodLanguage",
}


def html_files() -> list[Path]:
    files = []
    for path in ROOT.rglob("*.html"):
        rel = path.relative_to(ROOT)
        if any(part in SKIP_DIRS for part in rel.parts):
            continue
        files.append(path)
    return sorted(files)


def strip_markup(text: str) -> str:
    text = re.sub(r"<script\b[^>]*>.*?</script>", " ", text, flags=re.I | re.S)
    text = re.sub(r"<style\b[^>]*>.*?</style>", " ", text, flags=re.I | re.S)
    text = re.sub(r"<[^>]+>", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def is_buyer_page(rel: Path) -> bool:
    return rel.parts[0] in BUYER_DIRS if len(rel.parts) > 1 else rel.name == "index.html"


def audit(path: Path) -> dict:
    rel = path.relative_to(ROOT)
    source = path.read_text(encoding="utf-8", errors="replace")
    lower = source.lower()
    plain = strip_markup(source)
    issues: list[dict] = []

    def add(code: str, severity: str, detail: str) -> None:
        issues.append({"code": code, "severity": severity, "detail": detail})

    if not re.search(r"<title>\s*[^<]{8,}\s*</title>", source, re.I):
        add("missingTitle", "error", "Page title is missing or too short.")
    if not re.search(r'<meta[^>]+name=["\']description["\'][^>]+content=["\'][^"\']{45,}', source, re.I) and not re.search(r'<meta[^>]+content=["\'][^"\']{45,}["\'][^>]+name=["\']description["\']', source, re.I):
        add("weakDescription", "warning", "Meta description is missing or too short.")
    if "name=\"viewport\"" not in lower and "name='viewport'" not in lower:
        add("missingViewport", "error", "Mobile viewport meta tag is missing.")
    if not re.search(r"<main\b", source, re.I):
        add("missingMain", "error", "No main landmark was found.")
    if "style-v8.css" not in lower:
        add("v8CssMissing", "warning", "V8 stylesheet is not linked.")
    if "site-v8.js" not in lower:
        add("v8JsMissing", "warning", "V8 script is not linked.")

    buyer = is_buyer_page(rel)
    text_led = rel.name in TEXT_LED and len(rel.parts) == 1
    images = len(re.findall(r"<img\b", source, re.I))
    media = images + len(re.findall(r"<(video|iframe|picture)\b", source, re.I))
    if buyer and not text_led and media == 0:
        add("buyerPageHasNoMedia", "warning", "A commercial/buyer page contains no image or video.")
    if buyer and len(plain) < 180:
        add("thinBuyerPage", "warning", "Buyer page has very little readable content.")

    for phrase, code in INTERNAL_PHRASES.items():
        if phrase in plain.lower():
            add(code, "warning", f"Buyer-facing copy contains internal phrase: {phrase}")

    empty_media = len(re.findall(r'<(?:div|section)[^>]+class=["\'][^"\']*(?:media|image|visual)[^"\']*["\'][^>]*>\s*</(?:div|section)>', source, re.I | re.S))
    if empty_media:
        add("emptyVisualContainers", "warning", f"Found {empty_media} empty media/visual container(s).")

    external_images = len(re.findall(r'<img[^>]+src=["\']https?://', source, re.I))
    missing_alt = len(re.findall(r'<img(?![^>]+\balt=)[^>]*>', source, re.I))
    if missing_alt:
        add("missingImageAlt", "warning", f"Found {missing_alt} image(s) without alt attributes.")

    return {
        "path": rel.as_posix(),
        "buyerPage": buyer,
        "readableCharacters": len(plain),
        "images": images,
        "externalImages": external_images,
        "issues": issues,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--strict", action="store_true", help="Fail on structural errors")
    args = parser.parse_args()
    pages = [audit(path) for path in html_files()]
    counts = Counter(issue["code"] for page in pages for issue in page["issues"])
    severity = Counter(issue["severity"] for page in pages for issue in page["issues"])
    report = {
        "version": "8.0.0",
        "generatedAt": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "pageCount": len(pages),
        "buyerPageCount": sum(1 for page in pages if page["buyerPage"]),
        "issueCounts": dict(counts),
        "severityCounts": dict(severity),
        "pages": pages,
        "note": "Trust/legal pages may be text-led. Buyer pages are checked for media, metadata, V8 assets and internal language.",
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Audited {len(pages)} HTML pages; {sum(severity.values())} findings recorded.")
    # Syntax/structural errors should fail installation; editorial warnings should not.
    if severity.get("error", 0):
        print(f"Structural errors: {severity['error']}")
        if args.strict:
            return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
