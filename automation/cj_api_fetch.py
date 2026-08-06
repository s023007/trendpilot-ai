#!/usr/bin/env python3
"""Fetch joined CJ product records privately and expose only clean public outputs."""
from __future__ import annotations

import collections
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / "automation" / "cache" / "cj-products.json"
REPORT = ROOT / "data" / "cj-api-report.json"

PRODUCT_ENDPOINT = "https://product-search.api.cj.com/v2/product-search"
LINK_ENDPOINT = "https://link-search.api.cj.com/v2/link-search"

def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()

def local_name(tag: object) -> str:
    return str(tag).rsplit("}", 1)[-1].strip().lower()

def clean(value: object) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()

def as_number(value: object):
    raw = clean(value).replace(",", "").replace("%", "")
    match = re.search(r"-?\d+(?:\.\d+)?", raw)
    if not match:
        return None
    try:
        return float(match.group(0))
    except ValueError:
        return None

def bool_text(value: object) -> str:
    raw = clean(value).lower()
    if raw in {"0", "false", "no", "out of stock", "unavailable", "sold out"}:
        return "false"
    return "true"

def request_xml(endpoint: str, params: dict[str, object], token: str) -> tuple[ET.Element, bytes]:
    query = urllib.parse.urlencode(
        {key: value for key, value in params.items() if value not in (None, "")}
    )
    request = urllib.request.Request(
        f"{endpoint}?{query}",
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/xml,text/xml,*/*",
            "User-Agent": "TrendPilotChoice-CJ-Bridge/13.8",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=90) as response:
            raw = response.read()
    except urllib.error.HTTPError as exc:
        body = exc.read(500).decode("utf-8", errors="replace")
        raise RuntimeError(
            f"CJ HTTP {exc.code} from {endpoint}. Response: {body}"
        ) from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"CJ connection failed for {endpoint}: {exc}") from exc

    probe = raw[:500].lstrip().lower()
    if probe.startswith(b"<!doctype html") or probe.startswith(b"<html"):
        raise RuntimeError(f"CJ returned an HTML page instead of XML from {endpoint}.")
    try:
        return ET.fromstring(raw), raw
    except ET.ParseError as exc:
        sample = raw[:500].decode("utf-8", errors="replace")
        raise RuntimeError(f"CJ returned invalid XML: {sample}") from exc

def flatten(element: ET.Element) -> dict[str, str]:
    row: dict[str, str] = {}
    for node in element.iter():
        key = local_name(node.tag)
        value = clean(node.text)
        if key and value and key not in row:
            row[key] = value
        for attr, attr_value in node.attrib.items():
            attr_key = local_name(attr)
            if attr_key and clean(attr_value):
                row.setdefault(attr_key, clean(attr_value))
                row.setdefault(f"{key}-{attr_key}", clean(attr_value))
    return row

def first(row: dict[str, str], *keys: str) -> str:
    for key in keys:
        value = clean(row.get(key))
        if value:
            return value
    return ""

def total_from_root(root: ET.Element) -> int:
    for node in root.iter():
        for key in ("total-matched", "totalmatched", "total"):
            value = node.attrib.get(key)
            if value and str(value).isdigit():
                return int(value)
    return 0

def product_rows(root: ET.Element) -> list[dict[str, str]]:
    rows = []
    for node in root.iter():
        if local_name(node.tag) == "product":
            rows.append(flatten(node))
    return rows

def normalize_product(row: dict[str, str]) -> dict | None:
    affiliate_url = first(row, "buy-url", "buyurl", "click-url", "link")
    name = first(row, "name", "title", "product-name")
    if not affiliate_url or not name:
        return None

    advertiser_id = first(row, "advertiser-id", "advertiserid")
    advertiser = first(row, "advertiser-name", "advertisername") or "CJ advertiser"
    sku = first(
        row,
        "sku",
        "manufacturer-sku",
        "manufacturersku",
        "catalog-id",
        "catalogid",
        "upc",
        "isbn",
    )
    product_id = "|".join(part for part in (advertiser_id, sku) if part) or affiliate_url

    price = as_number(first(row, "sale-price", "saleprice", "price"))
    regular = as_number(first(row, "retail-price", "retailprice", "price"))
    old_price = regular if regular and price is not None and regular > price else None

    return {
        "productId": product_id,
        "sku": sku,
        "name": name,
        "description": first(row, "description", "short-description", "long-description"),
        "category": first(
            row,
            "advertiser-category",
            "advertisercategory",
            "category",
            "department",
        ),
        "brand": first(row, "manufacturer-name", "manufacturername", "brand"),
        "affiliateUrl": affiliate_url,
        "productUrl": first(row, "destination-url", "destinationurl"),
        "imageUrl": first(row, "image-url", "imageurl", "image"),
        "price": price,
        "oldPrice": old_price,
        "currency": first(row, "currency", "price-currency") or "USD",
        "availability": bool_text(first(row, "in-stock", "instock", "availability")),
        "advertiser": advertiser,
        "advertiserId": advertiser_id,
        "catalogId": first(row, "catalog-id", "catalogid"),
        "country": first(row, "country"),
        "updatedAt": now_iso(),
        "sourceNetwork": "CJ",
    }

def fetch_products(token: str, website_id: str, max_products: int) -> tuple[list[dict], dict]:
    records_per_page = 1000
    max_pages = max(1, min(25, (max_products + records_per_page - 1) // records_per_page))
    products: list[dict] = []
    seen: set[str] = set()
    total_matched = 0
    pages_read = 0

    for page in range(1, max_pages + 1):
        root, _ = request_xml(
            PRODUCT_ENDPOINT,
            {
                "website-id": website_id,
                "advertiser-ids": "joined",
                "records-per-page": records_per_page,
                "page-number": page,
            },
            token,
        )
        pages_read += 1
        total_matched = max(total_matched, total_from_root(root))
        rows = product_rows(root)
        if not rows:
            break

        accepted_before = len(products)
        for row in rows:
            item = normalize_product(row)
            if not item:
                continue
            stable = item["productId"]
            if stable in seen:
                continue
            seen.add(stable)
            products.append(item)
            if len(products) >= max_products:
                break

        print(
            f"CJ product page {page}: rows={len(rows)}, "
            f"accepted={len(products) - accepted_before}, total={len(products)}"
        )
        if len(products) >= max_products or len(rows) < records_per_page:
            break
        time.sleep(0.35)

    return products, {
        "endpoint": PRODUCT_ENDPOINT,
        "pagesRead": pages_read,
        "totalMatched": total_matched,
        "recordsAccepted": len(products),
        "limitApplied": max_products,
    }

def link_diagnostic(token: str, website_id: str) -> dict:
    root, _ = request_xml(
        LINK_ENDPOINT,
        {
            "website-id": website_id,
            "advertiser-ids": "joined",
            "records-per-page": 100,
            "page-number": 1,
            "keywords": "sale",
        },
        token,
    )
    advertisers = collections.Counter()
    link_types = collections.Counter()
    records = 0
    for node in root.iter():
        if local_name(node.tag) != "link":
            continue
        row = flatten(node)
        records += 1
        advertisers[first(row, "advertiser-name", "advertisername") or "Unknown"] += 1
        link_types[first(row, "link-type", "linktype") or "Unknown"] += 1
    return {
        "endpoint": LINK_ENDPOINT,
        "recordsReturned": records,
        "topAdvertisers": dict(advertisers.most_common(15)),
        "linkTypes": dict(link_types.most_common()),
    }

def write_outputs(products: list[dict], report: dict) -> None:
    CACHE.parent.mkdir(parents=True, exist_ok=True)
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    CACHE.write_text(
        json.dumps({"products": products}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    REPORT.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

def main() -> int:
    token = os.environ.get("CJ_PERSONAL_ACCESS_TOKEN", "").strip()
    website_id = os.environ.get("CJ_WEBSITE_ID", "").strip()
    max_products = int(os.environ.get("CJ_MAX_PRODUCTS", "12000"))

    if not token or not website_id:
        raise SystemExit(
            "CJ_PERSONAL_ACCESS_TOKEN and CJ_WEBSITE_ID are required."
        )

    report = {
        "version": "13.8",
        "generatedAt": now_iso(),
        "websiteIdMasked": f"***{website_id[-4:]}" if len(website_id) >= 4 else "***",
        "status": "started",
        "productSearch": {},
        "linkSearch": {},
        "topAdvertisers": {},
        "notes": [],
    }

    products: list[dict] = []
    product_error = ""
    try:
        products, product_meta = fetch_products(token, website_id, max_products)
        report["productSearch"] = product_meta
    except Exception as exc:
        product_error = f"{type(exc).__name__}: {exc}"
        report["productSearch"] = {
            "endpoint": PRODUCT_ENDPOINT,
            "status": "error",
            "error": product_error[:700],
        }
        print(f"Product Search warning: {product_error}", file=sys.stderr)

    try:
        report["linkSearch"] = link_diagnostic(token, website_id)
    except Exception as exc:
        link_error = f"{type(exc).__name__}: {exc}"
        report["linkSearch"] = {
            "endpoint": LINK_ENDPOINT,
            "status": "error",
            "error": link_error[:700],
        }
        print(f"Link Search warning: {link_error}", file=sys.stderr)

    advertiser_counts = collections.Counter(
        item.get("advertiser") or "Unknown" for item in products
    )
    report["topAdvertisers"] = dict(advertiser_counts.most_common(25))
    report["status"] = "success" if products else "connected-no-products"
    if not products:
        report["notes"].append(
            "The CJ token was tested, but joined advertisers returned no usable "
            "product records. Link data may still be available, or the advertisers "
            "may not expose products through Product Search."
        )

    write_outputs(products, report)
    print(f"CJ products accepted: {len(products):,}")
    print(f"CJ advertisers represented: {len(advertiser_counts):,}")

    # Invalid credentials should stop the workflow. A valid connection with zero
    # product records is retained as a diagnostic rather than inventing products.
    errors = " ".join(
        str(report.get(section, {}).get("error", ""))
        for section in ("productSearch", "linkSearch")
    )
    if not products and ("HTTP 401" in errors or "HTTP 403" in errors):
        raise SystemExit("CJ authentication or Property ID was rejected.")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
