#!/usr/bin/env python3
"""Validate TrendPilot V12 installer assets and precision classification rules."""
from __future__ import annotations

import importlib.util
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def load_builder():
    path = ROOT / "automation" / "build_search_catalog.py"
    spec = importlib.util.spec_from_file_location("trendpilot_builder_v12", path)
    if spec is None or spec.loader is None:
        raise AssertionError("Could not load catalogue builder")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def validate_classifier() -> None:
    builder = load_builder()
    samples = [
        ({"name":"Men's Cotton T-Shirt Casual Short Sleeve", "category":"Men Clothing"}, "apparel", "men", "t-shirts"),
        ({"name":"Cute Summer Dress for Girls 2-7T", "category":"Kids Clothing"}, "apparel", "kids", "dresses"),
        ({"name":"ROBORE Home Exercise Bike Quiet Magnetic Resistance", "category":"Fitness Equipment"}, "sports-outdoors", "all", None),
        ({"name":"PETKIT Smart Cat Litter Box", "category":"Pet Supplies"}, "pet-supplies", "all", "pet-litter-box"),
        ({"name":"Wondershare Dr.Fone Full Toolkit for Windows Annual Plan", "category":"Software"}, "software", "all", "phone-utility-software"),
        ({"name":"Reseller Opportunities Private Label Portable Battery Charger Power Bank", "category":"Electronics"}, "business-sourcing", "all", "power-banks"),
        ({"name":"Soft Silicone Printed Case For iPhone 15", "category":"Phone Accessories"}, "phones-tablets", "all", "phone-cases"),
        ({"name":"Desktop electric meter panel ABS electronics box projector enclosure", "category":"Electrical Enclosures"}, "other", "all", None),
        ({"name":"Men's Cotton Briefs 3 Pack", "category":"Men Clothing"}, "apparel", "men", "mens-underwear"),
        ({"name":"Rare Vintage Used Oscilloscope Replacement Module", "category":"Test Equipment"}, "tools", "all", None),
    ]
    for offer, expected_group, expected_audience, expected_family in samples:
        group = builder.group_for(offer)
        audience = builder.audience_for(offer)
        family = builder.family_for(offer, group)
        require(group == expected_group, f"Wrong group for {offer['name']}: {group} != {expected_group}")
        require(audience == expected_audience, f"Wrong audience for {offer['name']}: {audience} != {expected_audience}")
        if expected_family:
            require(family == expected_family, f"Wrong family for {offer['name']}: {family} != {expected_family}")


def validate_assets() -> None:
    js = (ROOT / "js" / "site-v12.js").read_text(encoding="utf-8")
    css = (ROOT / "css" / "style-v12.css").read_text(encoding="utf-8")
    installer = (ROOT / "automation" / "install_v12_precision.py").read_text(encoding="utf-8")
    require('groups:["apparel"]' in js, "Clothing broad route must stay inside apparel")
    require('product.audience !== filters.audience' in js, "Audience filter must be exact for men, women and kids")
    require('data-filter-family' in installer, "Specific product-type filter is missing")
    require('inferredAudience(query)' in js and 'inferredFamily(query)' in js, "Query intent must preselect audience and exact type")
    require('/rare-used/' in installer, "Rare used section/page is missing")
    require('overflow-x:hidden' in css and '.tp-links.is-open' in css, "Responsive-fit/mobile navigation safeguards are missing")
    require('commercial relationship' not in js, "Editorial/legal wording must not be rewritten")


def validate_generated_pages() -> None:
    key_pages = [
        ROOT / "index.html", ROOT / "find" / "index.html", ROOT / "compare" / "index.html",
        ROOT / "products" / "index.html", ROOT / "software" / "index.html", ROOT / "sourcing" / "index.html",
        ROOT / "deals" / "index.html", ROOT / "rare-used" / "index.html",
    ]
    for path in key_pages:
        require(path.is_file() and path.stat().st_size > 200, f"Missing generated page: {path.relative_to(ROOT)}")
        text = path.read_text(encoding="utf-8", errors="ignore")
        require('name="viewport"' in text, f"Missing mobile viewport: {path.relative_to(ROOT)}")
        require('/css/style-v12.css' in text, f"V12 stylesheet missing: {path.relative_to(ROOT)}")
        require('/js/site-v12.js' in text, f"V12 JavaScript missing: {path.relative_to(ROOT)}")
        require(text.count('data-v12-header') >= 1, f"V12 header missing: {path.relative_to(ROOT)}")
        require(text.count('data-v12-footer') == 1, f"V12 footer duplicated/missing: {path.relative_to(ROOT)}")
    finder = (ROOT / "find" / "index.html").read_text(encoding="utf-8")
    require('Specific product type' in finder and 'Rare used only' in finder, "Precision finder controls are missing")
    sitemap = (ROOT / "sitemap.xml").read_text(encoding="utf-8")
    require('/rare-used/' in sitemap, "Rare used page missing from sitemap")
    require('review.html' not in sitemap, "Private review page must not be indexed")
    review = ROOT / "review.html"
    if review.exists():
        review_text = review.read_text(encoding="utf-8", errors="ignore")
        require('noindex,nofollow' in review_text, "Private review page must be noindex")
        require('data-v12-header' not in review_text and 'data-v12-footer' not in review_text, "Private review page must not contain public chrome")
    for path in ROOT.rglob("*.html"):
        rel = path.relative_to(ROOT)
        if any(part.startswith('.') for part in rel.parts):
            continue
        text = path.read_text(encoding="utf-8", errors="ignore")
        require(text.count('/css/style-v12.css') <= 1, f"V12 stylesheet duplicated: {rel}")
        require(text.count('/js/site-v12.js') <= 1, f"V12 script duplicated: {rel}")
        require(text.count('/js/matched-products.js') <= 1, f"Managed dependency duplicated: {rel}")
        require(text.count('data-v12-footer') <= 1, f"V12 footer duplicated: {rel}")


def validate_manifest_if_present() -> None:
    manifest_path = ROOT / "data" / "search-catalog" / "manifest.json"
    if not manifest_path.exists():
        return
    data = json.loads(manifest_path.read_text(encoding="utf-8"))
    if data.get("version") == "12.0.0":
        require("rareUsed" in data, "V12 manifest missing rareUsed")
        require(data.get("coverageReport"), "V12 manifest missing coverage report")


def main() -> int:
    validate_classifier()
    validate_assets()
    validate_generated_pages()
    validate_manifest_if_present()
    print("TrendPilot V12 validation passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
