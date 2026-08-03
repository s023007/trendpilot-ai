#!/usr/bin/env python3
"""Apply the V8 buyer-search patch to the current TrendPilot repository."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
UPDATE_WORKFLOW = ROOT / ".github" / "workflows" / "update-products.yml"

BUYER_PREFIXES = {"find", "compare", "products", "software", "sourcing"}
COPY_REPLACEMENTS = {
    "Approved affiliate route": "Current product page",
    "approved affiliate route": "current product page",
    "Affiliate route": "Product link",
    "affiliate route": "product link",
    "Affiliate catalogue": "Product catalogue",
    "affiliate catalogue": "product catalogue",
    "Affiliate feed": "Product catalogue",
    "affiliate feed": "product catalogue",
}


def buyer_page(path: Path) -> bool:
    rel = path.relative_to(ROOT)
    return rel.name == "index.html" and (len(rel.parts) == 1 or rel.parts[0] in BUYER_PREFIXES)


def patch_html(path: Path) -> bool:
    source = path.read_text(encoding="utf-8", errors="replace")
    original = source

    # Replace V7 assets without depending on attribute order or exact query string.
    source = re.sub(
        r'/css/style-v7\.css(?:\?[^"\']*)?',
        '/css/style-v8.css?v=8.0.0',
        source,
        flags=re.I,
    )
    source = re.sub(
        r'/js/site-v7\.js(?:\?[^"\']*)?',
        '/js/site-v8.js?v=8.0.0',
        source,
        flags=re.I,
    )

    # V7 public pages should all get the new assets. If one was missing either
    # file, add it safely rather than producing a half-upgraded page.
    if "style-v8.css" not in source and (buyer_page(path) or "data-primary-nav" in source):
        source = source.replace("</head>", '<link href="/css/style-v8.css?v=8.0.0" rel="stylesheet"/></head>', 1)
    if "site-v8.js" not in source and (buyer_page(path) or "data-primary-nav" in source):
        source = source.replace("</body>", '<script defer src="/js/site-v8.js?v=8.0.0"></script></body>', 1)

    # Improve full-screen rendering around notches and browser chrome.
    source = re.sub(
        r'<meta\s+content=["\']width=device-width,initial-scale=1["\']\s+name=["\']viewport["\']\s*/?>',
        '<meta content="width=device-width,initial-scale=1,viewport-fit=cover" name="viewport"/>',
        source,
        flags=re.I,
    )

    if buyer_page(path) and "affiliate-disclosure" not in path.as_posix():
        for old, new in COPY_REPLACEMENTS.items():
            source = source.replace(old, new)

    # Finder copy: set the expectation that relevance comes before quantity.
    if path.relative_to(ROOT).as_posix() == "find/index.html":
        source = source.replace(
            "We will show the closest guides first and current product listings underneath.",
            "We will show close product matches first and leave unrelated listings out.",
        )
        source = source.replace(
            '<button data-query="supplier" type="button">Supplier</button>',
            '<button data-query="running shoes" type="button">Running shoes</button><button data-query="automatic pet feeder" type="button">Pet feeder</button>',
        )

    if source != original:
        path.write_text(source, encoding="utf-8")
        return True
    return False


def patch_update_workflow() -> bool:
    if not UPDATE_WORKFLOW.exists():
        print("Update workflow was not found; catalogue refresh hook was not installed.")
        return False
    source = UPDATE_WORKFLOW.read_text(encoding="utf-8")
    original = source

    if "automation/build_search_catalog.py" not in source:
        marker = "        run: python automation/source_ingestion.py\n"
        block = (
            marker
            + "      - name: Build buyer product search catalogue\n"
            + "        run: python automation/build_search_catalog.py\n"
        )
        if marker not in source:
            raise SystemExit("Could not find source_ingestion.py step in update-products.yml")
        source = source.replace(marker, block, 1)

    # Add generated shards and audit report to the existing public commit set.
    if "data/search-catalog" not in source:
        source = source.replace(
            'FILES="',
            'FILES="data/search-catalog data/buyer-page-audit.json ',
            1,
        )

    # Audit after the site/catalogue generation. It records warnings without
    # blocking a product refresh.
    if "automation/audit_buyer_pages.py" not in source:
        marker = "      - name: Commit clean public outputs and review evidence\n"
        block = (
            "      - name: Audit buyer pages\n"
            "        run: python automation/audit_buyer_pages.py\n"
            + marker
        )
        if marker in source:
            source = source.replace(marker, block, 1)

    if source != original:
        UPDATE_WORKFLOW.write_text(source, encoding="utf-8")
        return True
    return False


def main() -> int:
    changed = 0
    for path in sorted(ROOT.rglob("*.html")):
        if ".git" in path.parts or "node_modules" in path.parts:
            continue
        changed += int(patch_html(path))
    workflow_changed = False
    print(f"V8 assets applied to {changed} HTML page(s).")
    print("Product update workflow is installed separately by the repository owner.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
