#!/usr/bin/env python3
"""
TrendPilot AI v0.5 Product Matcher

Reads:
- a local Admitad Hot Products CSV snapshot;
- an optional private AliExpress feed URL from the environment variable
  ADMITAD_ALIEXPRESS_FEED_25_40.

Writes only small, public output files:
- data/matched-products.json
- data/product-matcher-report.json
- js/matched-products.js

The private feed URL is never written to output or logs.
"""

from __future__ import annotations

import csv
import gzip
import io
import itertools
import json
import math
import os
import re
import sys
import urllib.parse
import urllib.request
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Iterable, Iterator, List, Mapping, Optional, Tuple

ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = ROOT / "config" / "product-matcher.json"
DISCOVERED_TRENDS_PATH = ROOT / "data" / "discovered-trends.json"

FIELD_ALIASES = {
    "id": ("id", "product_id", "productId"),
    "name": ("name", "title", "product_name", "productName"),
    "url": ("url", "deeplink", "affiliate_url", "product_url", "productUrl"),
    "category": ("category", "categoryName", "category_name", "type"),
    "currency": ("currencyId", "currency", "currency_id"),
    "image": ("picture", "image", "imageUrl", "image_url"),
    "old_price": ("oldprice", "old_price", "originalPrice"),
    "price": ("price", "current_price", "salePrice"),
    "commission_rate": ("commissionRate", "commission_rate"),
    "available": ("available", "availability"),
    "modified_time": ("modified_time", "modifiedTime"),
    "shop_id": ("shopId", "shop_id"),
    "param": ("param", "params"),
}

def load_config() -> dict:
    with CONFIG_PATH.open("r", encoding="utf-8") as handle:
        config = json.load(handle)

    # v0.5: automatically create product profiles for newly discovered trends.
    existing = {profile.get("slug") for profile in config.get("trendProfiles", [])}
    if DISCOVERED_TRENDS_PATH.exists():
        try:
            discovered = json.loads(DISCOVERED_TRENDS_PATH.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            discovered = {}
        for trend in discovered.get("trends", []):
            match = trend.get("productMatch") or {}
            slug = text(trend.get("slug"))
            include_terms = [text(item) for item in match.get("includeTerms", []) if text(item)]
            if not slug or slug in existing or not include_terms:
                continue
            config.setdefault("trendProfiles", []).append({
                "slug": slug,
                "title": text(trend.get("title")) or slug,
                "includeTerms": include_terms,
                "preferredCategories": match.get("preferredCategories", []),
                "excludeTerms": match.get("excludeTerms", []),
                "minimumPrice": match.get("minimumPrice"),
                "maximumPrice": match.get("maximumPrice"),
            })
            existing.add(slug)
    return config

def text(value: object) -> str:
    return str(value or "").strip()

def normalise(value: object) -> str:
    value = text(value).lower()
    value = re.sub(r"[\u2010-\u2015]", "-", value)
    value = re.sub(r"[^a-z0-9%$€£+\-./ ]+", " ", value)
    return re.sub(r"\s+", " ", value).strip()

def first_value(row: Mapping[str, object], aliases: Iterable[str]) -> str:
    for alias in aliases:
        if alias in row and text(row[alias]):
            return text(row[alias])
    return ""

def parse_number(value: object) -> Optional[float]:
    raw = text(value).replace(",", "").replace("%", "")
    match = re.search(r"-?\d+(?:\.\d+)?", raw)
    if not match:
        return None
    try:
        number = float(match.group(0))
        return number if math.isfinite(number) else None
    except ValueError:
        return None

def parse_param(param: str, key: str) -> str:
    # Admitad snapshot format: discount|50%|;commissionRate|6.15%|;
    match = re.search(rf"(?:^|;){re.escape(key)}\|([^|;]*)\|", param or "", re.I)
    return match.group(1).strip() if match else ""

def safe_url(value: str, allowed_schemes: set[str]) -> str:
    value = text(value)
    try:
        parsed = urllib.parse.urlparse(value)
    except ValueError:
        return ""
    if parsed.scheme.lower() not in allowed_schemes or not parsed.netloc:
        return ""
    return value

def open_remote_csv(url: str) -> Tuple[io.TextIOBase, object]:
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "TrendPilotAI-ProductMatcher/0.5",
            "Accept-Encoding": "gzip",
            "Accept": "text/csv,text/plain,*/*",
        },
    )
    response = urllib.request.urlopen(request, timeout=180)
    raw_stream = response
    encoding = (response.headers.get("Content-Encoding") or "").lower()
    content_type = (response.headers.get("Content-Type") or "").lower()
    if "gzip" in encoding or urllib.parse.urlparse(url).path.endswith(".gz"):
        raw_stream = gzip.GzipFile(fileobj=response)
    text_stream = io.TextIOWrapper(raw_stream, encoding="utf-8-sig", errors="replace", newline="")
    return text_stream, response

def detect_delimiter(sample: str) -> str:
    counts = {delimiter: sample.count(delimiter) for delimiter in (";", ",", "\t", "|")}
    return max(counts, key=counts.get) if max(counts.values(), default=0) else ";"

def iter_local_rows(path: Path) -> Iterator[dict]:
    with path.open("r", encoding="utf-8-sig", errors="replace", newline="") as handle:
        sample = handle.read(8192)
        handle.seek(0)
        reader = csv.DictReader(handle, delimiter=detect_delimiter(sample))
        yield from reader

def iter_remote_rows(url: str, maximum: int) -> Iterator[dict]:
    """Stream only the requested number of rows from the private feed.

    The earlier implementation loaded the entire multi-million-row feed into
    memory before applying the row limit. This version samples a few lines to
    detect the delimiter, then continues reading the HTTP response line by line.
    """
    stream = None
    response = None
    try:
        stream, response = open_remote_csv(url)

        sampled_lines = []
        for _ in range(20):
            line = stream.readline()
            if not line:
                break
            sampled_lines.append(line)

        sample = "".join(sampled_lines)
        if not sample.strip():
            return

        reader = csv.DictReader(
            itertools.chain(sampled_lines, stream),
            delimiter=detect_delimiter(sample),
        )

        for index, row in enumerate(reader, start=1):
            if index > maximum:
                break
            if index % 5000 == 0:
                print(f"Remote rows processed: {index}")
            yield row
    finally:
        try:
            if stream:
                stream.close()
        finally:
            if response:
                response.close()

def row_to_product(
    row: Mapping[str, object],
    source_label: str,
    allowed_schemes: set[str],
) -> Optional[dict]:
    product_url = safe_url(first_value(row, FIELD_ALIASES["url"]), allowed_schemes)
    name = first_value(row, FIELD_ALIASES["name"])
    if not name or not product_url:
        return None

    param = first_value(row, FIELD_ALIASES["param"])
    commission_raw = first_value(row, FIELD_ALIASES["commission_rate"]) or parse_param(param, "commissionRate")
    discount_raw = parse_param(param, "discount")
    price = parse_number(first_value(row, FIELD_ALIASES["price"]))
    old_price = parse_number(first_value(row, FIELD_ALIASES["old_price"]))
    commission = parse_number(commission_raw)
    discount = parse_number(discount_raw)
    if discount is None and price is not None and old_price and old_price > price:
        discount = max(0.0, min(100.0, (old_price - price) / old_price * 100.0))

    available_raw = normalise(first_value(row, FIELD_ALIASES["available"]))
    available = available_raw not in {"0", "false", "no", "out of stock", "unavailable"}

    return {
        "id": first_value(row, FIELD_ALIASES["id"]) or product_url,
        "name": name,
        "url": product_url,
        "category": first_value(row, FIELD_ALIASES["category"]),
        "currency": first_value(row, FIELD_ALIASES["currency"]) or "USD",
        "image": safe_url(first_value(row, FIELD_ALIASES["image"]), allowed_schemes),
        "price": price,
        "oldPrice": old_price,
        "commissionRate": commission,
        "discount": discount,
        "available": available,
        "shopId": first_value(row, FIELD_ALIASES["shop_id"]) or parse_param(param, "shopId"),
        "modifiedTime": first_value(row, FIELD_ALIASES["modified_time"]),
        "source": source_label,
    }

def contains_any(haystack: str, needles: Iterable[str]) -> bool:
    return any(normalise(needle) in haystack for needle in needles if normalise(needle))

def score_product(product: dict, profile: dict) -> Optional[float]:
    haystack = normalise(f"{product['name']} {product.get('category', '')}")
    includes = [normalise(term) for term in profile.get("includeTerms", []) if normalise(term)]
    excludes = [normalise(term) for term in profile.get("excludeTerms", []) if normalise(term)]

    if not includes or not any(term in haystack for term in includes):
        return None
    if any(term in haystack for term in excludes):
        return None
    if not product.get("available", True):
        return None

    price = product.get("price")
    minimum_price = profile.get("minimumPrice")
    maximum_price = profile.get("maximumPrice")
    if price is not None:
        if minimum_price is not None and price < minimum_price:
            return None
        if maximum_price is not None and price > maximum_price:
            return None

    score = 20.0
    matched_terms = sum(1 for term in includes if term in haystack)
    score += min(42.0, matched_terms * 14.0)

    preferred_categories = [normalise(item) for item in profile.get("preferredCategories", [])]
    category = normalise(product.get("category"))
    if category and category in preferred_categories:
        score += 18.0
    elif preferred_categories and any(item in category or category in item for item in preferred_categories):
        score += 12.0

    commission = product.get("commissionRate")
    if commission is not None:
        score += min(10.0, commission)

    discount = product.get("discount")
    if discount is not None:
        score += min(8.0, discount / 10.0)

    if product.get("image"):
        score += 3.0
    if price is not None:
        score += 2.0

    return round(score, 2)

def public_product(product: dict, score: float) -> dict:
    result = {
        "id": text(product.get("id")),
        "name": text(product.get("name")),
        "url": text(product.get("url")),
        "category": text(product.get("category")),
        "currency": text(product.get("currency") or "USD"),
        "image": text(product.get("image")),
        "source": text(product.get("source")),
        "matchScore": score,
    }
    for source_key, public_key in (
        ("price", "price"),
        ("oldPrice", "oldPrice"),
        ("commissionRate", "commissionRate"),
        ("discount", "discount"),
    ):
        if product.get(source_key) is not None:
            result[public_key] = round(float(product[source_key]), 2)
    return result

def process_rows(
    rows: Iterable[Mapping[str, object]],
    source_label: str,
    config: dict,
    matches: dict[str, list],
    seen: dict[str, set],
    counters: dict,
) -> None:
    allowed_schemes = set(config["compliance"]["allowedSchemes"])
    blocked_terms = [normalise(item) for item in config["compliance"].get("blockedTerms", [])]
    minimum_score = float(config["sourceSettings"].get("minimumScore", 0))
    profiles = config["trendProfiles"]

    for row in rows:
        counters["rowsRead"] += 1
        product = row_to_product(row, source_label, allowed_schemes)
        if not product:
            counters["invalidRows"] += 1
            continue

        haystack = normalise(f"{product['name']} {product.get('category', '')}")
        if any(term and term in haystack for term in blocked_terms):
            counters["complianceBlocked"] += 1
            continue

        for profile in profiles:
            score = score_product(product, profile)
            if score is None or score < minimum_score:
                continue
            key = text(product.get("id")) or text(product.get("url"))
            if key in seen[profile["slug"]]:
                continue
            seen[profile["slug"]].add(key)
            matches[profile["slug"]].append(public_product(product, score))
            counters["candidateMatches"] += 1

def trim_and_sort(matches: dict[str, list], maximum: int) -> None:
    for slug, products in matches.items():
        products.sort(
            key=lambda item: (
                item.get("matchScore", 0),
                item.get("commissionRate", 0),
                item.get("discount", 0),
            ),
            reverse=True,
        )
        matches[slug] = products[:maximum]

def main() -> int:
    config = load_config()
    settings = config["sourceSettings"]
    local_path = ROOT / settings["localHotProducts"]
    remote_env = settings["remoteFeedEnvironmentVariable"]
    remote_url = os.environ.get(remote_env, "").strip()

    matches = defaultdict(list)
    seen = defaultdict(set)
    counters = defaultdict(int)
    sources = []

    if local_path.exists():
        sources.append({
            "label": "Admitad Hot Products snapshot",
            "type": "local snapshot",
            "status": "processed",
        })
        process_rows(
            iter_local_rows(local_path),
            "Admitad Hot Products snapshot",
            config,
            matches,
            seen,
            counters,
        )
    else:
        sources.append({
            "label": "Admitad Hot Products snapshot",
            "type": "local snapshot",
            "status": "missing",
        })

    if remote_url:
        try:
            process_rows(
                iter_remote_rows(remote_url, int(settings["maxRemoteRows"])),
                settings["remoteFeedLabel"],
                config,
                matches,
                seen,
                counters,
            )
            sources.append({
                "label": settings["remoteFeedLabel"],
                "type": "private remote feed",
                "status": "processed",
                "rowLimit": int(settings["maxRemoteRows"]),
            })
        except Exception as exc:
            # Never print the secret URL.
            print(f"Remote feed could not be processed: {type(exc).__name__}: {exc}", file=sys.stderr)
            sources.append({
                "label": settings["remoteFeedLabel"],
                "type": "private remote feed",
                "status": "error",
                "errorType": type(exc).__name__,
            })
    else:
        sources.append({
            "label": settings["remoteFeedLabel"],
            "type": "private remote feed",
            "status": "secret not supplied",
        })

    for profile in config["trendProfiles"]:
        matches.setdefault(profile["slug"], [])

    trim_and_sort(matches, int(settings["topProductsPerTrend"]))

    generated_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    output = {
        "version": config["version"],
        "generatedAt": generated_at,
        "productsByTrend": dict(matches),
    }
    report = {
        "version": config["version"],
        "generatedAt": generated_at,
        "sources": sources,
        "counters": dict(counters),
        "matchesPerTrend": {slug: len(items) for slug, items in matches.items()},
        "note": "Only small matched outputs are public. Private feed URLs are read from GitHub Actions secrets and are never written to the repository.",
    }

    data_path = ROOT / "data" / "matched-products.json"
    report_path = ROOT / "data" / "product-matcher-report.json"
    js_path = ROOT / "js" / "matched-products.js"
    data_path.parent.mkdir(parents=True, exist_ok=True)
    js_path.parent.mkdir(parents=True, exist_ok=True)

    data_path.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    js_path.write_text(
        "window.TRENDPILOT_MATCHED_PRODUCTS = "
        + json.dumps(dict(matches), ensure_ascii=False, separators=(",", ":"))
        + ";\n"
        + "window.TRENDPILOT_MATCHED_PRODUCTS_META = "
        + json.dumps({"generatedAt": generated_at, "version": config["version"]}, ensure_ascii=False)
        + ";\n",
        encoding="utf-8",
    )

    print(f"Rows read: {counters['rowsRead']}")
    print(f"Candidate matches: {counters['candidateMatches']}")
    for slug, items in matches.items():
        print(f"{slug}: {len(items)} public matches")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
