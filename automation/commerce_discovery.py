#!/usr/bin/env python3
"""TrendPilot AI v0.6.1 commerce-first discovery.

Builds review candidates from the normalised multi-network offer catalogue.
It does not publish candidates automatically.
"""
from __future__ import annotations

import json
import math
import re
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

from adapters.common import has_term, load_json, normalise, text
from product_quality import validate_offer

ROOT = Path(__file__).resolve().parents[1]
CACHE_PATH = ROOT / "automation" / "cache" / "offers.jsonl"
CONFIG_PATH = ROOT / "config" / "commerce-taxonomy.json"
REVIEW_PATH = ROOT / "data" / "trend-review.json"
OUTPUT_PATH = ROOT / "data" / "commerce-candidates.json"
REPORT_PATH = ROOT / "data" / "commerce-discovery-report.json"
STATIC_PATH = ROOT / "js" / "trends-data.js"
PUBLIC_DISCOVERED_PATH = ROOT / "data" / "discovered-trends.json"


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def read_offers() -> list[dict]:
    offers = []
    if not CACHE_PATH.exists():
        return offers
    with CACHE_PATH.open("r", encoding="utf-8") as handle:
        for line in handle:
            try:
                offer = json.loads(line)
            except json.JSONDecodeError:
                continue
            if offer.get("available", True):
                offers.append(offer)
    return offers


def static_slugs() -> set[str]:
    output: set[str] = set()
    if STATIC_PATH.exists():
        output.update(re.findall(r'"slug"\s*:\s*"([^"]+)"', STATIC_PATH.read_text(encoding="utf-8")))
    public = load_json(PUBLIC_DISCOVERED_PATH, {"trends": []})
    output.update(text(item.get("slug")) for item in public.get("trends", []) if text(item.get("slug")))
    return output


def offer_matches(offer: dict, family: dict, global_rules: dict | None = None) -> bool:
    haystack = normalise(
        f"{offer.get('name', '')} {offer.get('description', '')} "
        f"{offer.get('category', '')} {' '.join(offer.get('tags', []) or [])}"
    )
    includes = family.get("includeTerms", [])
    excludes = family.get("excludeTerms", [])
    minimum_terms = int(family.get("minimumMatchedTerms") or 1)
    matched = [term for term in includes if has_term(haystack, term)]
    if len(matched) < minimum_terms:
        return False
    if any(has_term(haystack, term) for term in excludes):
        return False

    valid_product, _ = validate_offer(offer, family, global_rules or {})
    if not valid_product:
        return False

    price = offer.get("price")
    if price is not None:
        minimum_price = family.get("minimumPrice")
        maximum_price = family.get("maximumPrice")
        if minimum_price is not None and float(price) < float(minimum_price):
            return False
        if maximum_price is not None and float(price) > float(maximum_price):
            return False
    return True


def score_family(offers: list[dict], family: dict) -> tuple[int, dict]:
    canonical = {text(item.get("canonicalKey")) for item in offers if text(item.get("canonicalKey"))}
    networks = {text(item.get("network")) for item in offers if text(item.get("network"))}
    sources = {text(item.get("sourceId")) for item in offers if text(item.get("sourceId"))}
    advertisers = {text(item.get("advertiser")) for item in offers if text(item.get("advertiser"))}
    product_offers = [item for item in offers if item.get("offerType") == "product"]
    direct_offers = [item for item in offers if item.get("offerType") == "direct"]

    discounts = [
        float(item["discountPercent"])
        for item in offers
        if item.get("discountPercent") is not None
    ]
    commissions = [
        float(item["commissionRate"])
        for item in offers
        if item.get("commissionRate") is not None
    ]
    qualities = [float(item.get("qualityScore") or 0) for item in offers]

    score = 38.0
    score += min(23.0, math.log2(max(2, len(canonical) + 1)) * 5.2)
    score += min(12.0, len(networks) * 4.0)
    score += min(8.0, len(advertisers) * 1.6)
    score += min(7.0, (sum(discounts) / len(discounts)) / 10.0) if discounts else 0
    score += min(7.0, (sum(commissions) / len(commissions))) if commissions else 0
    score += min(5.0, (sum(qualities) / len(qualities)) / 20.0) if qualities else 0
    if direct_offers:
        score += 4
    score = int(max(0, min(96, round(score))))

    evidence = {
        "offerCount": len(offers),
        "uniqueProducts": len(canonical),
        "productOffers": len(product_offers),
        "directOffers": len(direct_offers),
        "networks": sorted(networks),
        "sources": sorted(sources),
        "advertisers": sorted(advertisers),
        "averageDiscount": round(sum(discounts) / len(discounts), 2) if discounts else None,
        "averageCommissionRate": round(sum(commissions) / len(commissions), 2) if commissions else None,
        "averageQuality": round(sum(qualities) / len(qualities), 2) if qualities else None,
    }
    return score, evidence


def candidate_from_family(family: dict, matches: list[dict], score: int, evidence: dict) -> dict:
    title = text(family.get("title"))
    top_offers = sorted(
        matches,
        key=lambda item: (
            item.get("qualityScore", 0),
            item.get("commissionRate") or 0,
            item.get("discountPercent") or 0,
        ),
        reverse=True,
    )[:3]
    direct_keys = [
        text(item.get("affiliateKey"))
        for item in top_offers
        if item.get("offerType") == "direct" and text(item.get("affiliateKey"))
    ]

    return {
        "slug": text(family.get("slug")),
        "title": title,
        "category": text(family.get("category")),
        "icon": text(family.get("icon") or "◈"),
        "stage": "Emerging" if score < 76 else "Rising" if score < 88 else "Rising fast",
        "statusClass": "early" if score < 76 else "rising" if score < 88 else "hot",
        "score": score,
        "momentum": min(97, score + 4),
        "buyerIntent": int(family.get("buyerIntent") or min(96, score + 6)),
        "competition": int(family.get("competition") or max(44, 82 - evidence["uniqueProducts"] // 2)),
        "affiliateCoverage": min(98, 58 + len(evidence["networks"]) * 10 + min(20, evidence["uniqueProducts"])),
        "contentDepth": int(family.get("contentDepth") or min(96, 72 + evidence["uniqueProducts"])),
        "confidence": "High" if score >= 86 else "Medium-high" if score >= 76 else "Medium",
        "summary": (
            f"The affiliate catalogue currently contains {evidence['uniqueProducts']} "
            f"relevant products across {max(1, len(evidence['networks']))} network(s), "
            f"creating a measurable commerce opportunity around {title}."
        ),
        "whyNow": (
            "Detected from active affiliate feeds and direct programmes. The candidate "
            "is held for manual review before it can appear publicly."
        ),
        "sourceLabel": "TrendPilot multi-network commerce catalogue",
        "sourceUrl": "",
        "sourceEvidence": {
            **evidence,
            "topOffers": [
                {
                    "name": text(item.get("name")),
                    "network": text(item.get("network")),
                    "advertiser": text(item.get("advertiser")),
                    "category": text(item.get("category")),
                    "price": item.get("price"),
                    "currency": text(item.get("currency")),
                    "commissionRate": item.get("commissionRate"),
                }
                for item in top_offers
            ],
        },
        "corroborationCount": len(evidence["sources"]),
        "strongSignal": evidence["uniqueProducts"] >= int(family.get("minimumUniqueProducts") or 5),
        "strengthReasons": [
            f"{evidence['uniqueProducts']} unique product matches",
            f"{len(evidence['networks'])} active affiliate network(s)",
            f"{len(evidence['advertisers'])} advertiser(s)",
        ],
        "observedAt": datetime.now(timezone.utc).strftime("%d %B %Y"),
        "discoveredAt": now_iso(),
        "keywords": [title, *family.get("includeTerms", [])][:8],
        "angles": family.get("angles", [
            f"Best {title} options by price and features",
            f"How to choose {title}",
            f"{title}: comparison and buying guide",
        ]),
        "products": sorted(set(direct_keys)),
        "networkOpportunities": evidence["networks"],
        "monetisationNote": (
            "TrendPilot will compare compliant offers across all connected sources and "
            "publish only the strongest approved affiliate route."
        ),
        "productMatch": {
            "includeTerms": family.get("includeTerms", []),
            "preferredCategories": family.get("preferredCategories", []),
            "excludeTerms": family.get("excludeTerms", []),
            "minimumPrice": family.get("minimumPrice"),
            "maximumPrice": family.get("maximumPrice"),
            "minimumMatchedTerms": int(family.get("minimumMatchedTerms") or 1),
            "requiredTitleTerms": family.get("requiredTitleTerms", []),
            "minimumRequiredTitleTerms": int(family.get("minimumRequiredTitleTerms") or 0),
            "excludeTitleTerms": family.get("excludeTitleTerms", []),
            "excludeCategoryTerms": family.get("excludeCategoryTerms", []),
            "allowAccessoryProducts": bool(family.get("allowAccessoryProducts", False)),
        },
        "automatic": True,
        "origin": "commerce-catalog",
        "reviewStatus": "pending-product-evidence",
        "readyForApproval": False,
        "commerceEvidence": evidence,
    }


def main() -> int:
    config = load_json(CONFIG_PATH, {})
    offers = read_offers()
    product_validation = config.get("productValidation", {})
    existing_slugs = static_slugs()
    candidates = []
    counters = defaultdict(int)

    for family in config.get("families", []):
        if not family.get("enabled", True):
            continue
        slug = text(family.get("slug"))
        if not slug or slug in existing_slugs:
            counters["existingTrendSkipped"] += 1
            continue

        matches = [offer for offer in offers if offer_matches(offer, family, product_validation)]
        score, evidence = score_family(matches, family)

        minimum_products = int(family.get("minimumUniqueProducts") or 5)
        minimum_offers = int(family.get("minimumOffers") or minimum_products)
        minimum_score = int(family.get("minimumScore") or config.get("minimumCandidateScore", 70))

        if evidence["uniqueProducts"] < minimum_products or evidence["offerCount"] < minimum_offers:
            counters["insufficientCatalogueEvidence"] += 1
            continue
        if score < minimum_score:
            counters["lowCommerceScore"] += 1
            continue

        candidates.append(candidate_from_family(family, matches, score, evidence))

    candidates.sort(key=lambda item: item.get("score", 0), reverse=True)
    candidates = candidates[: int(config.get("maxCandidates", 10))]

    review = load_json(REVIEW_PATH, {"version": "0.6.1", "reviewQueue": []})
    retained = [
        item
        for item in review.get("reviewQueue", [])
        if item.get("origin") != "commerce-catalog"
    ]
    merged = retained + candidates
    merged.sort(key=lambda item: item.get("score", 0), reverse=True)
    merged = merged[: int(config.get("maxReviewQueue", 15))]
    review.update({
        "version": "0.6.1",
        "generatedAt": now_iso(),
        "reviewQueue": merged,
        "instructions": (
            "Candidates from public signals and the multi-network commerce catalogue "
            "are held here. Approve only entries with readyForApproval: true."
        ),
    })

    output = {
        "version": "0.6.1",
        "generatedAt": now_iso(),
        "candidates": candidates,
    }
    report = {
        "version": "0.6.1",
        "generatedAt": now_iso(),
        "catalogueOffersRead": len(offers),
        "counters": {
            **dict(counters),
            "commerceCandidates": len(candidates),
            "reviewQueueTotal": len(merged),
        },
        "matchesPerCandidate": {
            item["slug"]: item.get("commerceEvidence", {}).get("uniqueProducts", 0)
            for item in candidates
        },
        "note": (
            "Commerce candidates are based on active affiliate inventory, not a "
            "promise of demand or earnings. Manual approval remains required."
        ),
    }

    REVIEW_PATH.write_text(json.dumps(review, ensure_ascii=False, indent=2), encoding="utf-8")
    OUTPUT_PATH.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
    REPORT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"Catalogue offers read: {len(offers)}")
    print(f"Commerce candidates: {len(candidates)}")
    print(f"Combined review queue: {len(merged)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
