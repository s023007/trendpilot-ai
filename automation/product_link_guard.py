#!/usr/bin/env python3
"""TrendPilot AI multi-network exact-product publication guard v1.3.0.

Runs after multi_network_matcher.py and before GitHub Actions commits output.

Public rules:
- publish only named products with an image and usable affiliate URL;
- reject weak, irrelevant, unavailable or niche-conflicting matches;
- verify that tracking links lead to a precise product/detail page;
- support known stores plus safe generic product-page heuristics;
- allow direct affiliate programmes such as SaaS/services;
- preserve the affiliate tracking URL for clicks while recording the verified
  destination in productUrl;
- hide trends that have no useful verified offer.
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
from typing import Any, Iterable

VERSION = "1.3.0"
MIN_MATCH_SCORE = 75.0
MIN_OFFER_QUALITY = 75.0

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

EXCLUDED_VARIANTS: dict[str, tuple[str, ...]] = {
    "high-capacity-power-banks": (
        "solar", "solar panel", "solar charger", "photovoltaic",
        "sun powered", "hand crank", "emergency radio",
    ),
}

TRACKING_PARAMETER_NAMES = {
    "ulp", "url", "target", "redirect", "redirect_url", "redirecturl",
    "destination", "destination_url", "dest", "deeplink", "deep_link",
    "dl_target_url", "landing_page", "product_url", "redirect_uri",
}

SEARCH_QUERY_KEYS = {
    "q", "query", "keyword", "keywords", "search", "searchtext",
    "search_query", "term",
}

PRODUCT_ID_QUERY_KEYS = {
    "product_id", "productid", "item_id", "itemid", "sku", "asin",
    "pid", "offer_id", "offerid", "goods_id", "goodsid", "listing_id",
}

NON_PRODUCT_PATH_PARTS = {
    "search", "category", "categories", "collections", "catalog",
    "catalogue", "shop", "store", "brands", "vendors", "deals",
    "offers", "all-products", "allproducts",
}

GENERIC_PRODUCT_MARKERS = (
    "/product/", "/products/", "/item/", "/items/", "/listing/",
    "/detail/", "/details/", "/p/",
)


def clean_text(value: object) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def normalise(value: object) -> str:
    value = urllib.parse.unquote(clean_text(value)).lower()
    value = re.sub(r"[\u2010-\u2015]", "-", value)
    value = re.sub(r"[^a-z0-9+ ]+", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def contains_phrase(haystack: str, phrase: str) -> bool:
    return f" {normalise(phrase)} " in f" {normalise(haystack)} "


def valid_http_url(value: object) -> bool:
    try:
        parsed = urllib.parse.urlparse(clean_text(value))
    except ValueError:
        return False
    return parsed.scheme in {"http", "https"} and bool(parsed.netloc)


def item_search_text(item: dict[str, Any], destination: str = "") -> str:
    return " ".join(
        clean_text(value)
        for value in (
            item.get("name"), item.get("description"), item.get("category"),
            item.get("tags"), item.get("productType"), item.get("productUrl"),
            destination,
        )
        if clean_text(value)
    )


def content_policy(
    slug: str,
    item: dict[str, Any],
    destination: str = "",
) -> tuple[bool, str]:
    if not clean_text(item.get("name")):
        return False, "missing-product-name"
    if not valid_http_url(item.get("image")):
        return False, "missing-product-image"
    if not valid_http_url(item.get("url")):
        return False, "missing-affiliate-url"

    match_score = float(item.get("matchScore") or 0)
    quality_score = float(item.get("offerQuality") or 0)
    if match_score and match_score < MIN_MATCH_SCORE:
        return False, "match-score-below-threshold"
    if quality_score and quality_score < MIN_OFFER_QUALITY:
        return False, "offer-quality-below-threshold"

    text = item_search_text(item, destination)
    required = REQUIRED_PRODUCT_IDENTITY.get(slug)
    if required and not any(contains_phrase(text, term) for term in required):
        return False, "missing-product-identity"

    excluded = EXCLUDED_VARIANTS.get(slug, ())
    excluded_hits = [term for term in excluded if contains_phrase(text, term)]
    if excluded_hits:
        return False, "excluded-niche-variant:" + ",".join(excluded_hits[:3])

    return True, "content-policy-passed"


def iter_nested_urls(
    value: str,
    depth: int = 0,
    seen: set[str] | None = None,
) -> Iterable[str]:
    if depth > 5:
        return

    seen = seen or set()
    candidate = clean_text(value)
    for _ in range(4):
        decoded = urllib.parse.unquote(candidate)
        if decoded == candidate:
            break
        candidate = decoded

    if candidate in seen:
        return
    seen.add(candidate)

    if valid_http_url(candidate):
        yield candidate

    try:
        parsed = urllib.parse.urlparse(candidate)
        query = urllib.parse.parse_qs(parsed.query, keep_blank_values=True)
    except ValueError:
        return

    for key, values in query.items():
        if key.lower() not in TRACKING_PARAMETER_NAMES:
            continue
        for nested in values:
            yield from iter_nested_urls(nested, depth + 1, seen)


def path_segments(path: str) -> list[str]:
    return [
        segment.lower()
        for segment in path.split("/")
        if segment.strip()
    ]


def generic_exact_product_page(url: str) -> tuple[bool, str]:
    """Safe fallback for stores that do not have a dedicated rule yet."""
    parsed = urllib.parse.urlparse(url)
    path = (parsed.path or "/").lower()
    query = urllib.parse.parse_qs(parsed.query, keep_blank_values=True)
    query_keys = {key.lower() for key in query}
    segments = path_segments(path)

    if not segments:
        return False, "homepage-destination"
    if SEARCH_QUERY_KEYS.intersection(query_keys):
        return False, "search-destination"

    # A query containing a concrete product/item identifier.
    if PRODUCT_ID_QUERY_KEYS.intersection(query_keys):
        return True, "verified-generic-product-id"

    # Known generic product path markers with a real value after the marker.
    for marker in GENERIC_PRODUCT_MARKERS:
        marker_segment = marker.strip("/")
        if marker_segment not in segments:
            continue
        index = segments.index(marker_segment)
        if index + 1 >= len(segments):
            return False, "generic-product-index-page"
        value = segments[index + 1]
        if value in NON_PRODUCT_PATH_PARTS or len(value) < 3:
            return False, "generic-product-index-page"
        return True, "verified-generic-product-path"

    # Detailed HTML pages with a meaningful slug or numerical product id.
    final_segment = segments[-1]
    if final_segment.endswith((".html", ".htm")):
        stem = re.sub(r"\.(?:html?|php)$", "", final_segment)
        if len(stem) >= 6 and stem not in NON_PRODUCT_PATH_PARTS:
            return True, "verified-generic-detail-html"

    return False, "not-a-recognised-product-page"


def classify_product_destination(
    advertiser: str,
    network: str,
    url: str,
) -> tuple[bool, str]:
    if not valid_http_url(url):
        return False, "invalid-destination-url"

    parsed = urllib.parse.urlparse(url)
    host = (parsed.hostname or "").lower()
    path = (parsed.path or "/").lower()
    query = parsed.query.lower()
    advertiser_key = advertiser.lower()
    network_key = network.lower()

    # Direct programmes may legitimately use a product/service landing page.
    if network_key == "direct":
        if path not in {"", "/"} or clean_text(parsed.query):
            return True, "verified-direct-programme-page"
        return True, "verified-direct-programme-home"

    if "aliexpress." in host or advertiser_key == "aliexpress":
        exact = re.search(r"/(?:item|i)/\d{8,}(?:\.html)?", path) is not None
        return (
            (True, "verified-aliexpress-item")
            if exact
            else (False, "not-an-aliexpress-item-page")
        )

    if "alibaba." in host or advertiser_key == "alibaba":
        exact = (
            "/product-detail/" in path
            and re.search(r"\d{8,}", path + "?" + query) is not None
        )
        return (
            (True, "verified-alibaba-product-detail")
            if exact
            else (False, "not-an-alibaba-product-detail-page")
        )

    if "amazon." in host:
        exact = re.search(
            r"/(?:dp|gp/product|gp/aw/d)/[a-z0-9]{10}(?:[/?]|$)",
            path,
            re.I,
        ) is not None
        return (
            (True, "verified-amazon-product")
            if exact
            else (False, "not-an-amazon-product-page")
        )

    if "ebay." in host:
        exact = re.search(r"/itm/(?:[^/]+/)?\d{8,}", path) is not None
        return (
            (True, "verified-ebay-item")
            if exact
            else (False, "not-an-ebay-item-page")
        )

    if "walmart." in host:
        exact = re.search(r"/ip/(?:[^/]+/)?\d{6,}", path) is not None
        return (
            (True, "verified-walmart-product")
            if exact
            else (False, "not-a-walmart-product-page")
        )

    if "etsy." in host:
        exact = re.search(r"/listing/\d{6,}", path) is not None
        return (
            (True, "verified-etsy-listing")
            if exact
            else (False, "not-an-etsy-listing-page")
        )

    if "temu." in host:
        parsed_query = urllib.parse.parse_qs(parsed.query)
        exact = (
            path.endswith("/goods.html")
            and bool(parsed_query.get("goods_id") or parsed_query.get("goodsid"))
        )
        return (
            (True, "verified-temu-product")
            if exact
            else (False, "not-a-temu-product-page")
        )

    if "shein." in host:
        exact = re.search(r"-p-\d+(?:\.html)?$", path) is not None
        return (
            (True, "verified-shein-product")
            if exact
            else (False, "not-a-shein-product-page")
        )

    if "bestbuy." in host:
        exact = re.search(r"/site/.+/\d+\.p(?:[/?]|$)", path) is not None
        return (
            (True, "verified-bestbuy-product")
            if exact
            else (False, "not-a-bestbuy-product-page")
        )

    if "target." in host:
        exact = re.search(r"/p/.+/-/a-\d+", path) is not None
        return (
            (True, "verified-target-product")
            if exact
            else (False, "not-a-target-product-page")
        )

    if "newegg." in host:
        exact = re.search(r"/p/[a-z0-9-]+(?:[/?]|$)", path) is not None
        return (
            (True, "verified-newegg-product")
            if exact
            else (False, "not-a-newegg-product-page")
        )

    # Shopify and many independent stores use /products/<handle>.
    if "/products/" in path:
        return generic_exact_product_page(url)

    return generic_exact_product_page(url)


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
        return exc.geturl() or url, f"http-{exc.code}"
    except (urllib.error.URLError, TimeoutError, socket.timeout, ValueError) as exc:
        return url, f"resolve-error:{type(exc).__name__}"


def verified_destination(
    advertiser: str,
    network: str,
    item: dict[str, Any],
) -> tuple[str, str]:
    candidates: list[str] = []
    product_url = clean_text(item.get("productUrl"))
    affiliate_url = clean_text(item.get("url"))

    if product_url:
        candidates.append(product_url)
    candidates.extend(iter_nested_urls(affiliate_url))

    seen: set[str] = set()
    for candidate in candidates:
        if candidate in seen:
            continue
        seen.add(candidate)
        ok, reason = classify_product_destination(
            advertiser,
            network,
            candidate,
        )
        if ok:
            return candidate, reason

    # Tracking links from any network are resolved and checked.
    if valid_http_url(affiliate_url):
        final_url, status = resolve_url(affiliate_url)
        ok, reason = classify_product_destination(
            advertiser,
            network,
            final_url,
        )
        if ok:
            return final_url, reason
        return "", f"{reason};{status}"

    return "", "no-exact-product-destination"


def validate_item(slug: str, item: dict[str, Any]) -> dict[str, Any]:
    content_ok, content_reason = content_policy(slug, item)
    if not content_ok:
        return {
            "keep": False,
            "reason": content_reason,
            "destination": "",
        }

    advertiser = clean_text(item.get("advertiser"))
    network = clean_text(item.get("network"))
    destination, destination_reason = verified_destination(
        advertiser,
        network,
        item,
    )
    if not destination:
        return {
            "keep": False,
            "reason": destination_reason,
            "destination": "",
        }

    final_content_ok, final_content_reason = content_policy(
        slug,
        item,
        destination,
    )
    if not final_content_ok:
        return {
            "keep": False,
            "reason": final_content_reason,
            "destination": destination,
        }

    return {
        "keep": True,
        "reason": destination_reason,
        "destination": destination,
    }


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def counts_by(
    products_by_trend: dict[str, list[dict]],
    field: str,
) -> Counter:
    counts: Counter = Counter()
    for products in products_by_trend.values():
        for item in products:
            counts[clean_text(item.get(field)) or "Unknown"] += 1
    return counts


def renumber(products: list[dict]) -> None:
    for position, item in enumerate(products, start=1):
        item["rank"] = position
        item["rankingLabel"] = (
            "Best match" if position == 1 else f"Rank #{position}"
        )


def write_js(data: dict[str, Any]) -> None:
    products_by_trend = data.get("productsByTrend", {})
    metadata = {
        "generatedAt": data.get("generatedAt"),
        "version": data.get("version"),
        "rankingMode": data.get("rankingMode"),
        "linkValidationVersion": VERSION,
        "linkValidationGeneratedAt": data.get(
            "linkValidation",
            {},
        ).get("generatedAt"),
        "publicTrendSlugs": data.get("publicTrendSlugs", []),
    }

    MATCHED_JS.parent.mkdir(parents=True, exist_ok=True)
    MATCHED_JS.write_text(
        "window.TRENDPILOT_MATCHED_PRODUCTS = "
        + json.dumps(
            products_by_trend,
            ensure_ascii=False,
            separators=(",", ":"),
        )
        + ";\nwindow.TRENDPILOT_MATCHED_PRODUCTS_META = "
        + json.dumps(
            metadata,
            ensure_ascii=False,
            separators=(",", ":"),
        )
        + ";\n",
        encoding="utf-8",
    )


def main() -> int:
    if not MATCHED_JSON.exists():
        raise SystemExit(f"Missing {MATCHED_JSON.relative_to(ROOT)}")

    data = load_json(MATCHED_JSON)
    products_by_trend = data.get("productsByTrend", {})
    if not isinstance(products_by_trend, dict):
        raise SystemExit(
            "matched-products.json has no productsByTrend object"
        )

    before_advertisers = counts_by(products_by_trend, "advertiser")
    kept_reasons: Counter = Counter()
    removed_reasons: Counter = Counter()
    records: list[dict[str, Any]] = []
    reviewed = kept = removed = 0

    for slug, products in products_by_trend.items():
        if not isinstance(products, list):
            products_by_trend[slug] = []
            continue

        clean_products: list[dict] = []
        for item in products:
            if not isinstance(item, dict):
                continue

            reviewed += 1
            result = validate_item(slug, item)
            reason = result["reason"]
            records.append({
                "trend": slug,
                "id": clean_text(item.get("id")),
                "name": clean_text(item.get("name")),
                "network": clean_text(item.get("network")),
                "advertiser": clean_text(item.get("advertiser")),
                "affiliateUrl": clean_text(item.get("url")),
                "verifiedProductUrl": result["destination"],
                "kept": bool(result["keep"]),
                "reason": reason,
            })

            if result["keep"]:
                item["productUrl"] = (
                    result["destination"]
                    or clean_text(item.get("productUrl"))
                )
                item["publicationValidation"] = {
                    "status": "verified-exact-product",
                    "checkedBy": f"product-link-guard-{VERSION}",
                }
                clean_products.append(item)
                kept += 1
                kept_reasons[reason] += 1
            else:
                removed += 1
                removed_reasons[reason] += 1

        clean_products.sort(
            key=lambda item: (
                float(item.get("matchScore") or 0),
                float(item.get("offerQuality") or 0),
                float(item.get("discount") or 0),
            ),
            reverse=True,
        )
        renumber(clean_products)
        products_by_trend[slug] = clean_products

    generated_at = datetime.now(timezone.utc).replace(
        microsecond=0,
    ).isoformat()
    public_slugs = sorted(
        slug
        for slug, products in products_by_trend.items()
        if products
    )

    data["productsByTrend"] = products_by_trend
    data["publicTrendSlugs"] = public_slugs
    data["linkValidation"] = {
        "version": VERSION,
        "generatedAt": generated_at,
        "policy": (
            "multi-network-publish-only-useful-exact-reachable-products"
        ),
    }
    write_json(MATCHED_JSON, data)
    write_js(data)

    after_advertisers = counts_by(products_by_trend, "advertiser")
    after_networks = counts_by(products_by_trend, "network")

    if MATCHER_REPORT.exists():
        report = load_json(MATCHER_REPORT)
        report["publishedMatchesByAdvertiserBeforeLinkGuard"] = dict(
            before_advertisers
        )
        report["publishedMatchesByAdvertiser"] = dict(after_advertisers)
        report["publishedMatchesByNetwork"] = dict(after_networks)
        report["publicTrendSlugs"] = public_slugs
        report["linkGuard"] = {
            "version": VERSION,
            "generatedAt": generated_at,
            "offersReviewed": reviewed,
            "offersKept": kept,
            "offersRemoved": removed,
            "keptByReason": dict(kept_reasons),
            "removedByReason": dict(removed_reasons),
        }
        write_json(MATCHER_REPORT, report)

    validation_report = {
        "version": VERSION,
        "generatedAt": generated_at,
        "policy": (
            "The public site receives only useful named offers with images, "
            "strong relevance and a verified product/detail destination. "
            "The affiliate network does not receive ranking preference."
        ),
        "counters": {
            "offersReviewed": reviewed,
            "offersKept": kept,
            "offersRemoved": removed,
            "publicTrends": len(public_slugs),
        },
        "keptByReason": dict(kept_reasons),
        "removedByReason": dict(removed_reasons),
        "publishedMatchesByAdvertiserBefore": dict(before_advertisers),
        "publishedMatchesByAdvertiserAfter": dict(after_advertisers),
        "publishedMatchesByNetworkAfter": dict(after_networks),
        "publicTrendSlugs": public_slugs,
        "records": records,
    }
    write_json(VALIDATION_REPORT, validation_report)

    print(f"Offers reviewed: {reviewed}")
    print(f"Offers kept: {kept}")
    print(f"Offers removed: {removed}")
    print(f"Public trends: {len(public_slugs)}")
    print(
        "Published networks: "
        + json.dumps(dict(after_networks), ensure_ascii=False)
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
