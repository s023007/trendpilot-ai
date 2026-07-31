#!/usr/bin/env python3
"""TrendPilot AI v2.1 multi-network affiliate source ingestion.

Every enabled JSON file inside config/sources is loaded automatically. Feed
formats are converted to one normalised offer schema. The full cache is used
inside GitHub Actions only and is not committed to the public repository.
"""
from __future__ import annotations

import importlib
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path

from adapters.common import load_json, normalise, resolve_location, text

ROOT = Path(__file__).resolve().parents[1]
GLOBAL_CONFIG = ROOT / "config" / "affiliate-sources.json"
SOURCE_CONFIG_DIR = ROOT / "config" / "sources"
CACHE_PATH = ROOT / "automation" / "cache" / "offers.jsonl"
REPORT_PATH = ROOT / "data" / "source-ingestion-report.json"
SUMMARY_PATH = ROOT / "data" / "offer-catalog-summary.json"

ADAPTERS = {
    "csv": "adapters.csv_adapter",
    "xml": "adapters.xml_adapter",
    "json": "adapters.json_adapter",
    "direct": "adapters.direct_adapter",
}


def source_configs() -> list[tuple[Path, dict]]:
    output = []
    for path in sorted(SOURCE_CONFIG_DIR.glob("*.json")):
        data = load_json(path, {})
        if isinstance(data, dict):
            output.append((path, data))
    return output


def blocked_offer(offer: dict, global_rules: dict) -> bool:
    haystack = normalise(
        f"{offer.get('name', '')} {offer.get('description', '')} "
        f"{offer.get('category', '')} {' '.join(offer.get('tags', []) or [])}"
    )
    blocked_terms = [
        normalise(item)
        for item in global_rules.get("blockedTerms", [])
        if normalise(item)
    ]
    blocked_categories = [
        normalise(item)
        for item in global_rules.get("blockedCategories", [])
        if normalise(item)
    ]
    if any(term in haystack for term in blocked_terms):
        return True
    category = normalise(offer.get("category"))
    return any(item and item in category for item in blocked_categories)


def public_sample(offer: dict) -> dict:
    result = {
        "name": text(offer.get("name")),
        "network": text(offer.get("network")),
        "advertiser": text(offer.get("advertiser")),
        "programme": text(offer.get("programme")),
        "category": text(offer.get("category")),
        "currency": text(offer.get("currency")),
        "offerType": text(offer.get("offerType")),
        "qualityScore": offer.get("qualityScore"),
    }
    for key in ("price", "oldPrice", "commissionRate", "discountPercent"):
        if offer.get(key) is not None:
            result[key] = offer[key]
    return result


def main() -> int:
    global_config = load_json(GLOBAL_CONFIG, {})
    compliance = global_config.get("compliance", {})
    allowed_schemes = set(compliance.get("allowedSchemes", ["http", "https"]))
    maximum_cache = int(global_config.get("maxOffersInCache", 100000))
    sample_size = int(global_config.get("catalogSampleSize", 20))

    CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)

    source_reports = []
    seen_offer_keys: set[str] = set()
    offers = []
    counters = Counter()

    for path, source in source_configs():
        source_id = text(source.get("id") or path.stem)
        adapter_name = text(source.get("adapter")).lower()
        if not source.get("enabled", False):
            source_reports.append({
                "sourceId": source_id,
                "status": "disabled",
                "adapter": adapter_name,
                "configFile": str(path.relative_to(ROOT)),
            })
            continue

        module_name = ADAPTERS.get(adapter_name)
        if not module_name:
            source_reports.append({
                "sourceId": source_id,
                "status": "unsupported-adapter",
                "adapter": adapter_name,
            })
            continue

        location_kind, locator = resolve_location(source, ROOT)
        if adapter_name != "direct" and not locator:
            source_reports.append({
                "sourceId": source_id,
                "status": "credential-or-location-missing",
                "adapter": adapter_name,
                "locationType": location_kind,
            })
            continue

        source_count = 0
        blocked_count = 0
        invalid_count = 0
        try:
            module = importlib.import_module(module_name)
            for offer in module.iter_offers(source, ROOT, allowed_schemes):
                if not offer:
                    invalid_count += 1
                    continue
                if blocked_offer(offer, compliance):
                    blocked_count += 1
                    counters["complianceBlocked"] += 1
                    continue
                offer_key = text(offer.get("offerKey"))
                if not offer_key or offer_key in seen_offer_keys:
                    counters["duplicatesWithinSources"] += 1
                    continue
                seen_offer_keys.add(offer_key)
                offers.append(offer)
                source_count += 1
                counters["offersAccepted"] += 1
                if len(offers) >= maximum_cache:
                    break

            source_reports.append({
                "sourceId": source_id,
                "status": "processed",
                "adapter": adapter_name,
                "network": text(source.get("network")),
                "advertiser": text(source.get("advertiser")),
                "offersAccepted": source_count,
                "complianceBlocked": blocked_count,
                "invalidRows": invalid_count,
            })
        except Exception as exc:
            print(
                f"Source {source_id} failed: {type(exc).__name__}: {exc}",
                file=sys.stderr,
            )
            source_reports.append({
                "sourceId": source_id,
                "status": "error",
                "adapter": adapter_name,
                "errorType": type(exc).__name__,
            })

        if len(offers) >= maximum_cache:
            counters["cacheLimitReached"] = 1
            break

    with CACHE_PATH.open("w", encoding="utf-8") as handle:
        for offer in offers:
            handle.write(json.dumps(offer, ensure_ascii=False, separators=(",", ":")) + "\n")

    network_counts = Counter(text(item.get("network")) or "Unknown" for item in offers)
    source_counts = Counter(text(item.get("sourceId")) or "unknown" for item in offers)
    advertiser_counts = Counter(text(item.get("advertiser")) or "Unknown" for item in offers)
    category_counts = Counter(text(item.get("category")) or "Uncategorised" for item in offers)
    currency_counts = Counter(text(item.get("currency")) or "Unknown" for item in offers)

    canonical_networks: dict[str, set[str]] = defaultdict(set)
    for offer in offers:
        canonical_networks[text(offer.get("canonicalKey"))].add(text(offer.get("network")))
    cross_network_products = sum(1 for networks in canonical_networks.values() if len(networks) > 1)

    generated_at = __import__("datetime").datetime.now(
        __import__("datetime").timezone.utc
    ).replace(microsecond=0).isoformat()

    report = {
        "version": "0.6.0",
        "generatedAt": generated_at,
        "cache": {
            "path": str(CACHE_PATH.relative_to(ROOT)),
            "committed": False,
            "offerCount": len(offers),
        },
        "sources": source_reports,
        "counters": dict(counters),
        "note": (
            "Private feed URLs are read from GitHub Actions secrets and are never "
            "written to reports or the repository."
        ),
    }
    summary = {
        "version": "0.6.0",
        "generatedAt": generated_at,
        "totalOffers": len(offers),
        "productOffers": sum(1 for item in offers if item.get("offerType") == "product"),
        "directOffers": sum(1 for item in offers if item.get("offerType") == "direct"),
        "withPrice": sum(1 for item in offers if item.get("price") is not None),
        "withCommission": sum(
            1
            for item in offers
            if item.get("commissionRate") is not None
            or item.get("commissionValue") is not None
        ),
        "uniqueCanonicalProducts": len(canonical_networks),
        "crossNetworkProducts": cross_network_products,
        "byNetwork": dict(network_counts.most_common()),
        "bySource": dict(source_counts.most_common()),
        "topAdvertisers": dict(advertiser_counts.most_common(20)),
        "topCategories": dict(category_counts.most_common(25)),
        "currencies": dict(currency_counts.most_common()),
        "sample": [
            public_sample(item)
            for item in sorted(
                offers,
                key=lambda offer: (
                    offer.get("qualityScore", 0),
                    offer.get("commissionRate") or 0,
                    offer.get("discountPercent") or 0,
                ),
                reverse=True,
            )[:sample_size]
        ],
    }

    REPORT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    SUMMARY_PATH.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"Enabled sources processed: {sum(1 for item in source_reports if item['status'] == 'processed')}")
    print(f"Normalised offers: {len(offers)}")
    print(f"Networks: {len(network_counts)}")
    print(f"Cross-network canonical products: {cross_network_products}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
