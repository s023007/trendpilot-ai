#!/usr/bin/env python3
"""Validate TrendPilot V13.4.1 universal taxonomy, scopes and browser runtime."""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VERSION = "13.4.1"


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def main() -> int:
    manifest_path = ROOT / "data" / "search-catalog" / "manifest.json"
    require(manifest_path.exists(), "Search manifest missing")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    require(manifest.get("version") == VERSION, "Catalogue is not V13.4.1")
    require(manifest.get("productCount", 0) > 0, "Catalogue has zero products")
    require(isinstance(manifest.get("segments"), list) and manifest["segments"], "Exact segments missing")

    rules = manifest.get("searchRules", {})
    for key in (
        "canonicalFamiliesOnly", "queryCorrection", "virtualFamilyExpansion",
        "allDepartmentsCanonical", "scopeCoverageReport", "fallbackFamilyLabelGuard", "strictTitleFamily", "strictAudience",
    ):
        require(rules.get(key) is True, f"Search rule missing: {key}")

    required_scopes = {
        "clothing", "electronics", "home", "school", "sports", "beauty", "kids",
        "software", "business", "pets", "automotive", "tools", "toys", "bags",
        "jewelry", "audio", "cameras", "phones", "computers", "smart-home", "printing",
    }
    scope_groups = manifest.get("scopeGroups", {})
    require(required_scopes.issubset(scope_groups), f"Missing scopes: {sorted(required_scopes-set(scope_groups))}")
    require("apparel" in scope_groups["kids"], "Kids scope cannot reach kids clothing")
    require("footwear" in scope_groups["kids"], "Kids scope cannot reach kids footwear")
    require("smart-home" in scope_groups["home"], "Home scope cannot reach smart-home products")

    aliases = manifest.get("familyAliases", {})
    require(len(aliases) >= 300, f"Family alias dictionary is too small: {len(aliases)}")
    labels = manifest.get("familyLabels", {})
    require(labels.get("other") == "Other products", "Top-level fallback family label is missing")
    segment_families = {s.get("family", "") for s in manifest["segments"]}
    dynamic = [family for family in segment_families if ":" in family]
    require(not dynamic, f"Supplier title fragments still appear as families: {dynamic[:5]}")
    missing_labels = sorted(f for f in segment_families if f and not f.startswith("other-") and f not in labels)
    require(not missing_labels, f"Canonical family labels missing: {missing_labels[:10]}")

    taxonomy = manifest.get("familyTaxonomy", {})
    for parent in ("makeup", "beauty", "clothing-all", "electronics-all", "school-office-all", "sports-all", "kids-all", "software-all", "business-all"):
        require(taxonomy.get(parent, {}).get("members"), f"Virtual taxonomy missing: {parent}")

    coverage_path = ROOT / "data" / "search-catalog" / "coverage-report.json"
    require(coverage_path.exists(), "Coverage report missing")
    coverage = json.loads(coverage_path.read_text(encoding="utf-8"))
    require(coverage.get("version") == VERSION, "Coverage report is not V13.4.1")
    search_coverage = coverage.get("searchCoverage", {})
    require(required_scopes.issubset(search_coverage), f"Coverage missing scopes: {sorted(required_scopes-set(search_coverage))}")
    for scope in required_scopes:
        row = search_coverage[scope]
        require("uniqueProducts" in row and "families" in row and "advertisers" in row, f"Incomplete coverage: {scope}")

    js_path = ROOT / "js" / "site-v13-4.js"
    require(js_path.exists(), "V13.4 browser runtime missing")
    js = js_path.read_text(encoding="utf-8")
    for marker in (
        "QUERY_WORD_CORRECTIONS", "familyAliases", "aliasBoundaryMatch", "scope===\"kids\"",
        "familyGroups", "allDepartmentsCanonical",
        "filterProducts(activeProducts()).length", "Corrected “${state.originalQuery}”",
    ):
        # allDepartmentsCanonical is in manifest builder, not JS; skip separately below
        if marker == "allDepartmentsCanonical":
            continue
        require(marker in js, f"Browser runtime marker missing: {marker}")

    pages = [
        "index.html", "find/index.html", "deals/index.html", "compare/index.html",
        "price-watch/index.html", "products/index.html", "software/index.html",
        "sourcing/index.html", "rare-used/index.html", "guides/index.html",
    ]
    found_scope_select = False
    for rel in pages:
        path = ROOT / rel
        require(path.exists(), f"Page missing: {rel}")
        text = path.read_text(encoding="utf-8", errors="ignore")
        require("/js/site-v13-4.js?v=13.4.1" in text, f"V13.4.1 runtime not linked from {rel}")
        require("/js/site-v13-3.js" not in text and "/js/site-v13-2.js" not in text, f"Old search runtime remains in {rel}")
        require(not re.search(r'<input[^>]+type=["\']search["\'][^>]*\srequired(?:\s|>)', text, re.I), f"Category-only search blocked in {rel}")
        if "data-tp-search-scope" in text:
            found_scope_select = True
            for value in ("clothing", "electronics", "beauty", "pets", "automotive", "tools", "printing"):
                require(f'value="{value}"' in text, f"Scope option {value} missing from {rel}")
            require("<optgroup" in text, f"Department selector is not grouped in {rel}")
    installer_text = (ROOT / "automation" / "install_v13_4_1_taxonomy_hotfix.py").read_text(encoding="utf-8")
    require("<optgroup label=\"Main departments\">" in installer_text, "Grouped scope selector template missing")
    for value in ("clothing", "electronics", "beauty", "pets", "automotive", "tools", "printing"):
        require(f'value=\"{value}\"' in installer_text, f"Installer scope option missing: {value}")

    print(
        f"TrendPilot V13.4.1 validation passed: {manifest['productCount']:,} products, "
        f"{len(manifest['segments']):,} segments, {len(scope_groups)} searchable scopes, {len(aliases)} aliases"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
