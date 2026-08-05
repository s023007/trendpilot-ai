#!/usr/bin/env python3
"""Validate installed TrendPilot V13 pages, taxonomy and catalogue safeguards."""
from __future__ import annotations

import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def load_builder():
    path = ROOT / "automation" / "build_decision_catalog.py"
    spec = importlib.util.spec_from_file_location("trendpilot_v13_builder", path)
    require(spec is not None and spec.loader is not None, "Cannot load V13 catalogue builder")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def product(name: str, category: str = "Apparel", description: str = "") -> dict:
    return {"name": name, "category": category, "description": description, "affiliateUrl": "https://example.com/p", "advertiser": "Test"}


def main() -> int:
    builder = load_builder()
    mens_tee = product("Men's Cotton Crew Neck Tee Short Sleeve")
    kids_tee = product("Boys Kids Graphic T-Shirt")
    mens_shorts = product("Men's Compression Shorts Athletic Fit")
    bike = product("ROBORE CBX10 Home Exercise Bike", "Sports & Outdoors", "shirt shaped screen icon")
    phone_case = product("Silicone Printed Case for iPhone 15", "Phone Accessories", "fashion shirt artwork")

    require(builder.group_for(mens_tee) == "apparel", "Men's tee must be apparel")
    require(builder.family_for(mens_tee, "apparel") == "t-shirts", "Tee synonym must classify as T-shirts")
    require(builder.audience_for(mens_tee) == "men", "Men's tee must have men audience")
    require(builder.family_for(kids_tee, "apparel") == "t-shirts", "Kids T-shirt family failed")
    require(builder.audience_for(kids_tee) == "kids", "Kids audience failed")
    require(builder.family_for(mens_shorts, "apparel") == "shorts", "Men's shorts family failed")
    require(builder.group_for(bike) != "apparel", "Exercise bike must never enter clothing")
    require(builder.group_for(phone_case) != "apparel", "Phone case must never enter clothing")

    manifest_path = ROOT / "data" / "search-catalog" / "manifest.json"
    require(manifest_path.exists(), "V13 manifest missing")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    require(manifest.get("version") == "13.0.0", "Manifest is not V13")
    require(manifest.get("productCount", 0) > 0, "Catalogue has zero products")
    require(isinstance(manifest.get("segments"), list) and manifest["segments"], "Exact segments missing")
    require(manifest.get("searchRules", {}).get("maxResults") is None, "A fixed 90-product ceiling returned")
    require(manifest.get("searchRules", {}).get("separateExactAndAlternatives") is True, "Exact/alternative separation missing")

    required_pages = ["index.html", "find/index.html", "compare/index.html", "price-watch/index.html", "deals/index.html", "rare-used/index.html", "products/index.html", "software/index.html", "sourcing/index.html", "guides/index.html"]
    for rel in required_pages:
        path = ROOT / rel
        require(path.exists(), f"Missing page: {rel}")
        text = path.read_text(encoding="utf-8", errors="ignore")
        require("style-v13.css" in text and "site-v13.js" in text, f"V13 assets missing from {rel}")

    finder = (ROOT / "find" / "index.html").read_text(encoding="utf-8")
    require("data-tp-result-tabs" in finder, "Exact/related result tabs missing")
    require("data-tp-load-more" in finder, "Progressive result loading missing")
    require("Specific product type" in finder and "For whom" in finder, "Precision filters missing")

    home = (ROOT / "index.html").read_text(encoding="utf-8")
    require("Shopping Decision Engine" in home, "V13 homepage identity missing")
    require("Electronics Lab" in home and "Software Finder" in home and "Rare Finds Radar" in home, "Distinct decision tools missing")

    js = (ROOT / "js" / "site-v13.js").read_text(encoding="utf-8")
    require("exact-segment" not in js or "segment" in js, "Segment loader missing")
    require("slice(0,90)" not in js.replace(" ", ""), "90-result limit found in JS")
    require("Related alternatives" in js, "Alternative separation missing in JS")

    legacy_builder = ROOT / "automation" / "build_search_catalog.py"
    if legacy_builder.exists():
        legacy_text = legacy_builder.read_text(encoding="utf-8", errors="ignore")
        require("TREND_PILOT_V13_REFRESH_HOOK" in legacy_text, "Future feed refresh hook missing")

    css = (ROOT / "css" / "style-v13.css").read_text(encoding="utf-8")
    require("overflow-x:hidden" in css, "Horizontal fit safeguard missing")
    require("@media(max-width:640px)" in css, "Mobile layout missing")

    print(f"TrendPilot V13 validation passed: {manifest['productCount']:,} products, {len(manifest['segments']):,} exact segments")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
