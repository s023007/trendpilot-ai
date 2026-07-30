#!/usr/bin/env python3
"""TrendPilot AI product-link guard.

Runs after multi_network_matcher.py.

Purpose:
1. Prevent irrelevant Alibaba products from being published under a trend.
2. Resolve Alibaba affiliate links and publish only links that land on a
   product-detail page, not a homepage, category page, or search page.
3. Keep public JSON/JS and matcher report counts consistent.

The script is intentionally conservative. An Alibaba offer that cannot be
verified is removed from public output rather than sending visitors to a
random page.
"""
from __future__ import annotations

import json
import re
import socket
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

VERSION = "1.0.0"

ROOT = Path(__file__).resolve().parents[1]
MATCHED_JSON = ROOT / "data" / "matched-products.json"
MATCHED_JS = ROOT / "js" / "matched-products.js"
MATCHER_REPORT = ROOT / "data" / "product-matcher-report.json"
VALIDATION_REPORT = ROOT / "data" / "product-link-validation-report.json"

REQUIRED_PRODUCT_IDENTITY: dict[str, tuple[str, ...]] = {
    "wireless-earbuds": (
        "earbud", "earbuds", "earphone", "earphones",
        "headphone", "headphones", "tws", "in ear",
    ),
    "high-capacity-power-banks": (
        "power bank", "powerbank", "portable charger",
        "battery pack", "external battery",
    ),
    "portable-projectors": (
        "projector", "projectors", "video projector",
        "mini projector", "home theater projector",
    ),
    "compact-thermal-printers": (
        "thermal printer", "label printer", "receipt printer",
        "mini printer", "portable printer", "bluetooth printer",
    ),
}

GENERIC_PATH_MARKERS = (
    "/trade/search",
    "/products/",
    "/product/",
    "/category/",
    "/categories/",
    "/wholesale",
    "/search",
)

GENERIC_QUERY_KEYS = {
    "searchtext", "keyword", "keywords", "query", "q", "search",
}

PRODUCT_PATH_MARKERS = (
    "/product-detail/",
    "/product-detail",
)

TRACKING_HOST_MARKERS = (
    "admitad",
    "ad.admitad",
    "rzekl.com",
)


def clean_text(value: object) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def normalise(value: object) -> str:
    value = clean_text(value).lower()
    value = re.sub(r"[\u2010-\u2015]", "-", value)
    value = re.sub(r"[^a-z0-9+ ]+", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def contains_phrase(haystack: str, phrase: str) -> bool:
    hay = f" {normalise(haystack)} "
    needle = f" {normalise(phrase)} "
    return needle in hay


def title_matches_trend(slug: str, title: str) -> tuple[bool, str]:
    required = REQUIRED_PRODUCT_IDENTITY.get(slug)
    if not required:
        return True, "no-strict-identity-rule"

    hits = [phrase for phrase in required if contains_phrase(title, phrase)]
    if hits:
        return True, "identity:" + ",".join(hits[:3])
    return False, "missing-product-identity"


def is_tracking_host(host: str) -> bool:
    host = host.lower()
    return any(marker in host for marker in TRACKING_HOST_MARKERS)


def classify_destination(url: str) -> tuple[bool, str]:
    try:
        parsed = urllib.parse.urlparse(url)
    except ValueError:
        return False, "invalid-url"

    host = (parsed.hostname or "").lower()
    path = (parsed.path or "/").lower()
    query = urllib.parse.parse_qs(parsed.query, keep_blank_values=True)
    query_keys = {key.lower() for key in query}

    if not host:
        return False, "missing-host"

    if is_tracking_host(host):
        return False, "tracking-link-did-not-resolve"

    if "alibaba." not in host and not host.endswith("alibaba.com"):
        return False, "unexpected-final-host"

    if any(key in query_keys for key in GENERIC_QUERY_KEYS):
        return False, "search-query-destination"

    if path in ("", "/"):
        return False, "homepage-destination"

    if any(marker in path for marker in GENERIC_PATH_MARKERS):
        if not any(marker in path for marker in PRODUCT_PATH_MARKERS):
            return False, "generic-or-category-destination"

    if any(marker in path for marker in PRODUCT_PATH_MARKERS):
        if re.search(r"\d{8,}", path + "?" + parsed.query):
            return True, "verified-product-detail"
        return True, "product-detail-path"

    if re.search(r"\d{10,}", path + "?" + parsed.query) and path.endswith(".html"):
        return True, "verified-numeric-product-page"

    return False, "not-a-product-detail-page"


def resolve_url(url: str, timeout: float = 12.0) -> tuple[str, str]:
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/124 Safari/537.36"
        ),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.8",
    }
    request = urllib.request.Request(url, headers=headers, method="GET")
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return response.geturl(), "resolved"
    except urllib.error.HTTPError as exc:
        final_url = exc.geturl() or url
        return final_url, f"http-{exc.code}"
    except (urllib.error.URLError, TimeoutError, socket.timeout, ValueError) as exc:
        return url, f"resolve-error:{type(exc).__name__}"


def validate_alibaba_offer(slug: str, item: dict[str, Any]) -> dict[str, Any]:
    title = clean_text(item.get("name"))
    url = clean_text(item.get("url"))
    product_url = clean_text(item.get("productUrl"))

    identity_ok, identity_reason = title_matches_trend(slug, title)
    if not identity_ok:
        return {"keep": False, "reason": identity_reason, "finalUrl": ""}

    candidate_url = product_url or url
    if not candidate_url:
        return {"keep": False, "reason": "missing-product-link", "finalUrl": ""}

    if product_url:
        ok, reason = classify_destination(product_url)
        if ok:
            return {"keep": True, "reason": reason, "finalUrl": product_url}

    final_url, resolve_status = resolve_url(url)
    ok, reason = classify_destination(final_url)
    return {
        "keep": ok,
        "reason": reason if ok else f"{reason};{resolve_status}",
        "finalUrl": final_url,
    }


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def advertiser_counts(products_by_trend: dict[str, list[dict]]) -> Counter:
    counts: Counter = Counter()
    for products in products_by_trend.values():
        for item in products:
            counts[clean_text(item.get("advertiser")) or "Unknown"] += 1
    return counts


def network_counts(products_by_trend: dict[str, list[dict]]) -> Counter:
    counts: Counter = Counter()
    for products in products_by_trend.values():
        for item in products:
            counts[clean_text(item.get("network")) or "Unknown"] += 1
    return counts


def renumber(products: list[dict]) -> None:
    for position, item in enumerate(products, start=1):
        item["rank"] = position
        item["rankingLabel"] = "Best match" if position == 1 else f"Rank #{position}"


def write_js(products_by_trend: dict[str, list[dict]], metadata: dict[str, Any]) -> None:
    MATCHED_JS.parent.mkdir(parents=True, exist_ok=True)
    MATCHED_JS.write_text(
        "window.TRENDPILOT_MATCHED_PRODUCTS = "
        + json.dumps(products_by_trend, ensure_ascii=False, separators=(",", ":"))
        + ";\nwindow.TRENDPILOT_MATCHED_PRODUCTS_META = "
        + json.dumps(metadata, ensure_ascii=False, separators=(",", ":"))
        + ";\n",
        encoding="utf-8",
    )


def main() -> int:
    if not MATCHED_JSON.exists():
        raise SystemExit(f"Missing {MATCHED_JSON.relative_to(ROOT)}")

    data = load_json(MATCHED_JSON)
    products_by_trend = data.get("productsByTrend", {})
    if not isinstance(products_by_trend, dict):
        raise SystemExit("matched-products.json has no productsByTrend object")

    before_advertisers = advertiser_counts(products_by_trend)
    reviewed = 0
    kept = 0
    removed = 0
    records: list[dict[str, Any]] = []

    for slug, products in products_by_trend.items():
        if not isinstance(products, list):
            continue

        clean_products: list[dict] = []
        for item in products:
            if not isinstance(item, dict):
                continue

            advertiser = clean_text(item.get("advertiser")).lower()
            if advertiser != "alibaba":
                clean_products.append(item)
                continue

            reviewed += 1
            result = validate_alibaba_offer(slug, item)
            records.append({
                "trend": slug,
                "id": clean_text(item.get("id")),
                "name": clean_text(item.get("name")),
                "originalUrl": clean_text(item.get("url")),
                "finalUrl": result["finalUrl"],
                "kept": bool(result["keep"]),
                "reason": result["reason"],
            })

            if result["keep"]:
                item["linkValidation"] = {
                    "status": "verified-product-detail",
                    "checkedBy": f"product-link-guard-{VERSION}",
                }
                clean_products.append(item)
                kept += 1
            else:
                removed += 1

        renumber(clean_products)
        products_by_trend[slug] = clean_products

    generated_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    data["productsByTrend"] = products_by_trend
    data["linkValidation"] = {
        "version": VERSION,
        "generatedAt": generated_at,
        "policy": "publish-only-verified-alibaba-product-detail-links",
    }
    write_json(MATCHED_JSON, data)

    metadata = {
        "generatedAt": data.get("generatedAt") or generated_at,
        "version": data.get("version") or "",
        "rankingMode": data.get("rankingMode") or "",
        "linkValidationVersion": VERSION,
        "linkValidationGeneratedAt": generated_at,
    }
    write_js(products_by_trend, metadata)

    after_advertisers = advertiser_counts(products_by_trend)
    after_networks = network_counts(products_by_trend)

    if MATCHER_REPORT.exists():
        report = load_json(MATCHER_REPORT)
        report["publishedMatchesByAdvertiserBeforeLinkGuard"] = dict(before_advertisers)
        report["publishedMatchesByAdvertiser"] = dict(after_advertisers)
        report["publishedMatchesByNetwork"] = dict(after_networks)
        report["linkGuard"] = {
            "version": VERSION,
            "generatedAt": generated_at,
            "alibabaOffersReviewed": reviewed,
            "alibabaOffersKept": kept,
            "alibabaOffersRemoved": removed,
        }
        write_json(MATCHER_REPORT, report)

    validation_report = {
        "version": VERSION,
        "generatedAt": generated_at,
        "policy": (
            "Only product-relevant Alibaba offers with verified "
            "product-detail destinations are published."
        ),
        "counters": {
            "alibabaOffersReviewed": reviewed,
            "alibabaOffersKept": kept,
            "alibabaOffersRemoved": removed,
        },
        "publishedMatchesByAdvertiserBefore": dict(before_advertisers),
        "publishedMatchesByAdvertiserAfter": dict(after_advertisers),
        "records": records,
    }
    write_json(VALIDATION_REPORT, validation_report)

    print(f"Alibaba offers reviewed: {reviewed}")
    print(f"Alibaba offers kept: {kept}")
    print(f"Alibaba offers removed: {removed}")
    print(
        "Published advertisers after link guard: "
        + json.dumps(dict(after_advertisers), ensure_ascii=False)
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
