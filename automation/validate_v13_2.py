#!/usr/bin/env python3
"""Validate TrendPilot V13.2 calm UI and reliable search-count fixes."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def main() -> int:
    manifest_path = ROOT / "data" / "search-catalog" / "manifest.json"
    require(manifest_path.exists(), "Search manifest missing")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    require(manifest.get("productCount", 0) > 0, "Catalogue has zero products")
    require(isinstance(manifest.get("segments"), list) and manifest["segments"], "Exact segments missing")

    pages = [
        "index.html", "find/index.html", "deals/index.html", "compare/index.html",
        "price-watch/index.html", "products/index.html", "software/index.html",
        "sourcing/index.html", "rare-used/index.html", "guides/index.html",
    ]
    for rel in pages:
        text = (ROOT / rel).read_text(encoding="utf-8", errors="ignore")
        require("style-v13-2.css" in text, f"V13.2 CSS missing from {rel}")
        require("site-v13-2.js" in text, f"V13.2 JS missing from {rel}")
        require("tp-bottom-nav" in text, f"Mobile bottom navigation missing from {rel}")
        require("tp-newsletter" in text, f"Newsletter block missing from {rel}")

    home = (ROOT / "index.html").read_text(encoding="utf-8")
    require("data-tp-search-scope" in home, "Category-aware homepage search missing")
    require("data-tp-search-suggestions" in home, "Search suggestion panel missing")
    require("Four clear ways" in home, "Calmer homepage structure missing")

    finder = (ROOT / "find" / "index.html").read_text(encoding="utf-8")
    require("data-tp-finder-scope" in finder, "Finder category selector missing")
    require("counts only products it actually matched" in finder, "Accurate count explanation missing")
    require("data-tp-load-more" in finder, "Progressive loading missing")

    deals = (ROOT / "deals" / "index.html").read_text(encoding="utf-8")
    for marker in ["data-coupon-search", "data-coupon-country", "data-coupon-language", "data-coupon-toggle"]:
        require(marker in deals, f"Deals control missing: {marker}")

    css = (ROOT / "css" / "style-v13-2.css").read_text(encoding="utf-8")
    require("height:100dvh" in css, "Full-height mobile menu safeguard missing")
    require("overflow-wrap:anywhere" in css, "Long coupon text wrapping safeguard missing")
    require(".tp-bottom-nav" in css, "Bottom navigation styles missing")
    require("--canvas:#f7f5ef" in css, "Calm colour system missing")

    js = (ROOT / "js" / "site-v13-2.js").read_text(encoding="utf-8")
    require("ensureMinimumExact" in js, "Automatic exact-result loading missing")
    require("candidatePagesExhausted" in js, "Catalogue exhaustion tracking missing")
    require("totalPotential()" not in js, "Misleading segment-total counter still present")
    require("resultCountLabel" in js, "Actual result-count label missing")
    require("renderCouponGrid" in js and "couponLanguage" in js, "Coupon cleanup logic missing")
    require("initSearchSuggestions" in js, "Search suggestion behaviour missing")

    print(f"TrendPilot V13.2 validation passed: {manifest['productCount']:,} products, {len(manifest['segments']):,} segments")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
