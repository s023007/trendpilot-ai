#!/usr/bin/env python3
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
errors: list[str] = []

product_page = ROOT / "product" / "index.html"
if not product_page.exists():
    errors.append("product/index.html missing")
else:
    text = product_page.read_text(encoding="utf-8")
    for token in ('data-tp-product-detail', '/css/style-v13-5.css', '/js/site-v13-5.js'):
        if token not in text:
            errors.append(f"Product page missing {token}")

js_path = ROOT / "js" / "site-v13-5.js"
css_path = ROOT / "css" / "style-v13-5.css"
if not js_path.exists(): errors.append("site-v13-5.js missing")
if not css_path.exists(): errors.append("style-v13-5.css missing")
if js_path.exists():
    js = js_path.read_text(encoding="utf-8")
    for token in ('data-quick-view-id', 'data-tp-outbound', 'renderProductDetail', 'rel="nofollow sponsored noopener"', 'productIndexBase'):
        if token not in js:
            errors.append(f"Product decision JS missing {token}")

manifest_path = ROOT / "data" / "search-catalog" / "manifest.json"
if not manifest_path.exists():
    errors.append("search manifest missing")
else:
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if manifest.get("version") != "13.5.0": errors.append(f"unexpected manifest version {manifest.get('version')}")
    if not manifest.get("productIndexBase"): errors.append("productIndexBase missing")
    if not manifest.get("productIndexFiles"): errors.append("product index files missing")
    segments = manifest.get("segments") or []
    sample_segment = next((s for s in segments if s.get("files")), None)
    if sample_segment:
        shard = ROOT / sample_segment["files"][0].lstrip("/")
        payload = json.loads(shard.read_text(encoding="utf-8"))
        products = payload.get("products") or []
        if products:
            product = products[0]
            prefix = product["id"][:2]
            index_path = ROOT / "data" / "search-catalog" / "product-index" / f"{prefix}.json"
            if not index_path.exists():
                errors.append(f"product index prefix missing: {prefix}")
            else:
                index = json.loads(index_path.read_text(encoding="utf-8"))
                entry = index.get("products", {}).get(product["id"])
                if not entry or entry[0] != sample_segment["files"][0]:
                    errors.append("product index does not point to the sample shard")

for html in ROOT.rglob("*.html"):
    rel = html.relative_to(ROOT)
    if any(part.startswith(".") or part in {"node_modules", "automation", "tests"} for part in rel.parts):
        continue
    text = html.read_text(encoding="utf-8", errors="ignore")
    if '/js/site-v13-4.js' in text:
        errors.append(f"old V13.4 JS remains in {rel}")
    if '/js/site-v13-5.js' not in text:
        errors.append(f"V13.5 JS missing from {rel}")
    if '/css/style-v13-5.css' not in text:
        errors.append(f"V13.5 CSS missing from {rel}")

if errors:
    raise SystemExit("\n".join(errors))
print("TrendPilot V13.5 validation passed")
