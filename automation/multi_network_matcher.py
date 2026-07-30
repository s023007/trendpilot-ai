#!/usr/bin/env python3
"""TrendPilot AI v0.6.2 multi-network offer matcher.

Ranks offers by relevance, audience breadth, commercial value and data quality.
The logic is network-agnostic and works with any normalised affiliate source.
"""
from __future__ import annotations

import json
import math
import re
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from product_quality import validate_offer

ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = ROOT / "config" / "product-matcher.json"
CACHE_PATH = ROOT / "automation" / "cache" / "offers.jsonl"
DISCOVERED_TRENDS_PATH = ROOT / "data" / "discovered-trends.json"
REVIEW_PATH = ROOT / "data" / "trend-review.json"
AFFILIATE_LINKS_PATH = ROOT / "js" / "affiliate-links.js"


def text(value: object) -> str:
    return str(value or "").strip()


def normalise(value: object) -> str:
    value = text(value).lower()
    value = re.sub(r"[\u2010-\u2015]", "-", value)
    value = re.sub(r"[^a-z0-9%$€£+ ]+", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def has_term(haystack: object, term: object) -> bool:
    hay = normalise(haystack)
    needle = normalise(term)
    if not hay or not needle:
        return False
    return re.search(rf"(?:^| ){re.escape(needle)}(?:$| )", hay) is not None


def load_json(path: Path, fallback: dict) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return fallback


def active_affiliate_slugs() -> set[str]:
    if not AFFILIATE_LINKS_PATH.exists():
        return set()
    content = AFFILIATE_LINKS_PATH.read_text(encoding="utf-8", errors="replace")
    active = set()
    for slug, block in re.findall(r'"([^"]+)"\s*:\s*\{(.*?)\}', content, re.S):
        match = re.search(r'"affiliateUrl"\s*:\s*"([^"]*)"', block)
        if match and match.group(1).strip():
            active.add(slug)
    return active


def profile_from_trend(trend: dict, visibility: str) -> Optional[dict]:
    match = trend.get("productMatch") or {}
    include_terms = [text(item) for item in match.get("includeTerms", []) if text(item)]
    slug = text(trend.get("slug"))
    direct_products = [text(item) for item in trend.get("products", []) if text(item)]
    if not slug or (not include_terms and not direct_products):
        return None
    return {
        "slug": slug,
        "title": text(trend.get("title") or slug),
        "includeTerms": include_terms,
        "preferredCategories": match.get("preferredCategories", []),
        "excludeTerms": match.get("excludeTerms", []),
        "minimumPrice": match.get("minimumPrice"),
        "maximumPrice": match.get("maximumPrice"),
        "minimumMatchedTerms": int(match.get("minimumMatchedTerms") or 1),
        "requiredTitleTerms": match.get("requiredTitleTerms", []),
        "minimumRequiredTitleTerms": int(match.get("minimumRequiredTitleTerms") or 0),
        "excludeTitleTerms": match.get("excludeTitleTerms", []),
        "excludeCategoryTerms": match.get("excludeCategoryTerms", []),
        "allowAccessoryProducts": bool(match.get("allowAccessoryProducts", False)),
        "visibility": visibility,
        "directProducts": direct_products,
    }


def load_config() -> dict:
    config = load_json(CONFIG_PATH, {})
    for profile in config.get("trendProfiles", []):
        profile.setdefault("visibility", "public")
        profile.setdefault("minimumMatchedTerms", 1)
        profile.setdefault("requiredTitleTerms", [])
        profile.setdefault("minimumRequiredTitleTerms", 0)
        profile.setdefault("excludeTitleTerms", [])
        profile.setdefault("excludeCategoryTerms", [])
        profile.setdefault("allowAccessoryProducts", False)

    existing = {profile.get("slug") for profile in config.get("trendProfiles", [])}
    for path, key, visibility in (
        (DISCOVERED_TRENDS_PATH, "trends", "public"),
        (REVIEW_PATH, "reviewQueue", "review"),
    ):
        data = load_json(path, {key: []})
        for trend in data.get(key, []):
            profile = profile_from_trend(trend, visibility)
            if profile and profile["slug"] not in existing:
                config.setdefault("trendProfiles", []).append(profile)
                existing.add(profile["slug"])
    return config


def read_offers() -> list[dict]:
    offers = []
    if not CACHE_PATH.exists():
        return offers
    with CACHE_PATH.open("r", encoding="utf-8") as handle:
        for line in handle:
            try:
                offers.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    return offers


def blocked(offer: dict, config: dict) -> bool:
    haystack = normalise(
        f"{offer.get('name', '')} {offer.get('description', '')} "
        f"{offer.get('category', '')}"
    )
    terms = [normalise(item) for item in config.get("compliance", {}).get("blockedTerms", [])]
    return any(term and term in haystack for term in terms)


def _number(value: object, default: float = 0.0) -> float:
    try:
        result = float(value)
    except (TypeError, ValueError):
        return default
    return result if math.isfinite(result) else default


def _regex_hits(value: object, patterns: list[object]) -> list[str]:
    haystack = normalise(value)
    hits: list[str] = []
    for raw_pattern in patterns or []:
        pattern = text(raw_pattern)
        if not pattern:
            continue
        try:
            if re.search(pattern, haystack, re.I):
                hits.append(pattern)
        except re.error:
            # A bad optional ranking pattern must never stop the daily workflow.
            continue
    return hits


def _price_fit_bonus(price: object, profile: dict, settings: dict) -> float:
    rules = profile.get("rankingRules", {}) or {}
    if price is None:
        return 0.0
    numeric_price = _number(price, -1.0)
    if numeric_price < 0:
        return 0.0

    preferred_min = rules.get("preferredPriceMin")
    preferred_max = rules.get("preferredPriceMax")
    maximum_bonus = _number(
        rules.get("maximumPriceFitBonus"),
        _number(settings.get("maximumPriceFitBonus"), 8.0),
    )
    if preferred_min is None or preferred_max is None:
        return min(maximum_bonus, _number(settings.get("defaultPriceFitBonus"), 2.0))

    low = _number(preferred_min, 0.0)
    high = max(low, _number(preferred_max, low))
    if low <= numeric_price <= high:
        return maximum_bonus

    distance = low - numeric_price if numeric_price < low else numeric_price - high
    default_tolerance = max(high - low, high * 0.65, 1.0)
    tolerance = max(1.0, _number(rules.get("priceTolerance"), default_tolerance))
    return round(max(0.0, maximum_bonus * (1.0 - distance / tolerance)), 3)


def _audience_adjustment(offer: dict, profile: dict, settings: dict) -> tuple[float, float, dict]:
    """Reward broad-use products and demote narrow fitment products.

    Rules are profile-driven, so future product categories and affiliate networks
    can define their own broad/narrow signals without changing Python code.
    """
    rules = profile.get("rankingRules", {}) or {}
    title = text(offer.get("name"))

    broad_terms = [text(item) for item in rules.get("broadAudienceTerms", []) if text(item)]
    narrow_terms = [text(item) for item in rules.get("narrowAudienceTerms", []) if text(item)]
    broad_hits = [term for term in broad_terms if has_term(title, term)]
    narrow_hits = [term for term in narrow_terms if has_term(title, term)]
    pattern_hits = _regex_hits(title, rules.get("narrowAudiencePatterns", []))

    bonus_per_term = _number(
        rules.get("broadAudienceBonusPerTerm"),
        _number(settings.get("broadAudienceBonusPerTerm"), 3.5),
    )
    maximum_bonus = _number(
        rules.get("maximumBroadAudienceBonus"),
        _number(settings.get("maximumBroadAudienceBonus"), 10.0),
    )
    term_penalty = _number(
        rules.get("narrowAudiencePenaltyPerTerm"),
        _number(settings.get("narrowAudiencePenaltyPerTerm"), 4.0),
    )
    pattern_penalty = _number(
        rules.get("narrowAudiencePenaltyPerPattern"),
        _number(settings.get("narrowAudiencePenaltyPerPattern"), 7.0),
    )
    maximum_penalty = _number(
        rules.get("maximumNarrowAudiencePenalty"),
        _number(settings.get("maximumNarrowAudiencePenalty"), 24.0),
    )

    bonus = min(maximum_bonus, len(broad_hits) * bonus_per_term)
    penalty = min(maximum_penalty, len(narrow_hits) * term_penalty + len(pattern_hits) * pattern_penalty)

    # A profile may explicitly prefer products suitable for a wider audience.
    if bool(rules.get("preferGeneralProducts", False)) and (narrow_hits or pattern_hits) and not broad_hits:
        penalty = min(maximum_penalty, penalty + _number(rules.get("generalProductMissPenalty"), 3.0))

    details = {
        "broadTerms": broad_hits,
        "narrowTerms": narrow_hits,
        "narrowPatterns": pattern_hits,
    }
    return round(bonus, 3), round(penalty, 3), details


def score_offer(offer: dict, profile: dict, config: dict) -> Optional[dict]:
    if offer.get("offerType") == "direct":
        return None
    if not offer.get("available", True):
        return None

    haystack = normalise(
        f"{offer.get('name', '')} {offer.get('description', '')} "
        f"{offer.get('category', '')} {' '.join(offer.get('tags', []) or [])}"
    )
    includes = [term for term in profile.get("includeTerms", []) if text(term)]
    matched = [term for term in includes if has_term(haystack, term)]
    if len(matched) < int(profile.get("minimumMatchedTerms") or 1):
        return None
    if any(has_term(haystack, term) for term in profile.get("excludeTerms", [])):
        return None

    valid_product, _ = validate_offer(
        offer,
        profile,
        config.get("productValidation", {}),
    )
    if not valid_product:
        return None

    price = offer.get("price")
    if price is not None:
        minimum_price = profile.get("minimumPrice")
        maximum_price = profile.get("maximumPrice")
        if minimum_price is not None and _number(price) < _number(minimum_price):
            return None
        if maximum_price is not None and _number(price) > _number(maximum_price):
            return None

    settings = config.get("rankingSettings", {}) or {}
    title_matches = [term for term in includes if has_term(offer.get("name", ""), term)]

    relevance = _number(settings.get("baseRelevanceScore"), 12.0)
    relevance += min(
        _number(settings.get("maximumMatchedTermPoints"), 34.0),
        len(matched) * _number(settings.get("matchedTermPoints"), 11.0),
    )
    relevance += min(
        _number(settings.get("maximumTitleTermPoints"), 18.0),
        len(title_matches) * _number(settings.get("titleTermPoints"), 7.0),
    )

    category = normalise(offer.get("category"))
    preferred = [normalise(item) for item in profile.get("preferredCategories", []) if normalise(item)]
    if category and category in preferred:
        relevance += _number(settings.get("exactCategoryBonus"), 12.0)
    elif category and any(item in category or category in item for item in preferred):
        relevance += _number(settings.get("partialCategoryBonus"), 7.0)

    quality = min(
        _number(settings.get("maximumQualityPoints"), 7.0),
        _number(offer.get("qualityScore")) / max(1.0, _number(settings.get("qualityDivisor"), 15.0)),
    )
    commission = min(
        _number(settings.get("maximumCommissionPoints"), 8.0),
        _number(offer.get("commissionRate")) * _number(settings.get("commissionMultiplier"), 0.5),
    )
    discount = min(
        _number(settings.get("maximumDiscountPoints"), 5.0),
        _number(offer.get("discountPercent")) * _number(settings.get("discountMultiplier"), 0.08),
    )
    price_fit = _price_fit_bonus(price, profile, settings)
    commercial = quality + commission + discount + price_fit

    broad_bonus, narrow_penalty, audience_details = _audience_adjustment(offer, profile, settings)
    raw_score = relevance + commercial + broad_bonus - narrow_penalty

    weights = config.get("networkWeights", {})
    weighted_score = raw_score * _number(weights.get(text(offer.get("network"))), 1.0)

    # Compress only the very top end. This prevents dozens of products from
    # receiving an indistinguishable score of 100 while preserving the existing
    # review thresholds for genuinely strong matches.
    compression_start = _number(settings.get("highScoreCompressionStart"), 75.0)
    compression_ratio = _number(settings.get("highScoreCompressionRatio"), 0.45)
    if weighted_score > compression_start:
        weighted_score = compression_start + (weighted_score - compression_start) * compression_ratio
    maximum_final = _number(settings.get("maximumFinalScore"), 99.5)
    final_score = round(max(0.0, min(maximum_final, weighted_score)), 2)

    # These component scores make future ranking audits easier while the public
    # page continues to display only the final match score.
    return {
        "score": final_score,
        "relevance": round(relevance, 2),
        "commercial": round(commercial, 2),
        "audienceBonus": round(broad_bonus, 2),
        "specificityPenalty": round(narrow_penalty, 2),
        "priceFit": round(price_fit, 2),
        "matchedTerms": matched,
        "titleMatchedTerms": title_matches,
        "audienceDetails": audience_details,
    }

def public_offer(offer: dict, scoring: dict) -> dict:
    result = {
        "id": text(offer.get("productId") or offer.get("offerKey")),
        "name": text(offer.get("name")),
        "url": text(offer.get("affiliateUrl")),
        "productUrl": text(offer.get("productUrl")),
        "category": text(offer.get("category")),
        "currency": text(offer.get("currency") or "USD"),
        "image": text(offer.get("imageUrl")),
        "source": text(offer.get("sourceId")),
        "network": text(offer.get("network")),
        "advertiser": text(offer.get("advertiser")),
        "programme": text(offer.get("programme")),
        "canonicalKey": text(offer.get("canonicalKey")),
        "offerQuality": offer.get("qualityScore"),
        "matchScore": scoring["score"],
        "rankingSignals": {
            "relevance": scoring["relevance"],
            "commercial": scoring["commercial"],
            "audienceBonus": scoring["audienceBonus"],
            "specificityPenalty": scoring["specificityPenalty"],
            "priceFit": scoring["priceFit"],
        },
    }
    for source_key, public_key in (
        ("price", "price"),
        ("oldPrice", "oldPrice"),
        ("commissionRate", "commissionRate"),
        ("commissionValue", "commissionValue"),
        ("discountPercent", "discount"),
    ):
        if offer.get(source_key) is not None:
            result[public_key] = round(float(offer[source_key]), 2)
    return result


def sort_and_deduplicate(items: list[dict], maximum: int) -> list[dict]:
    best: dict[str, dict] = {}
    for item in items:
        key = text(item.get("canonicalKey")) or text(item.get("id")) or text(item.get("url"))
        previous = best.get(key)
        current_signals = item.get("rankingSignals", {}) or {}
        previous_signals = (previous.get("rankingSignals", {}) or {}) if previous else {}
        current_rank = (
            item.get("matchScore", 0),
            -current_signals.get("specificityPenalty", 0),
            current_signals.get("audienceBonus", 0),
            current_signals.get("commercial", 0),
            item.get("offerQuality", 0),
            item.get("commissionRate", 0),
            -(item.get("price") or 10**12),
        )
        previous_rank = (
            previous.get("matchScore", 0),
            -previous_signals.get("specificityPenalty", 0),
            previous_signals.get("audienceBonus", 0),
            previous_signals.get("commercial", 0),
            previous.get("offerQuality", 0),
            previous.get("commissionRate", 0),
            -(previous.get("price") or 10**12),
        ) if previous else None
        if previous is None or current_rank > previous_rank:
            best[key] = item

    output = list(best.values())
    output.sort(
        key=lambda item: (
            item.get("matchScore", 0),
            -(item.get("rankingSignals", {}) or {}).get("specificityPenalty", 0),
            (item.get("rankingSignals", {}) or {}).get("audienceBonus", 0),
            (item.get("rankingSignals", {}) or {}).get("commercial", 0),
            item.get("offerQuality", 0),
            item.get("commissionRate", 0),
            -(item.get("price") or 10**12),
        ),
        reverse=True,
    )
    return output[:maximum]


def update_review_evidence(review_matches: dict[str, list], config: dict) -> tuple[int, int]:
    review_data = load_json(REVIEW_PATH, {"version": "0.6.2", "reviewQueue": []})
    settings = config.get("reviewSettings", {})
    active_direct = active_affiliate_slugs()
    assessed = 0
    ready = 0

    minimum_trend_score = int(settings.get("minimumTrendScore", 72))
    minimum_product_matches = int(settings.get("minimumProductMatches", 3))
    minimum_best_score = float(settings.get("minimumBestMatchScore", 75))
    minimum_strong_matches = int(settings.get("minimumStrongMatches", 3))
    minimum_affiliate_routes = int(settings.get("minimumAffiliateRouteMatches", 3))
    preview_products = int(settings.get("previewProducts", 3))

    for candidate in review_data.get("reviewQueue", []):
        slug = text(candidate.get("slug"))
        products = review_matches.get(slug, [])
        best_score = max((float(item.get("matchScore") or 0) for item in products), default=0)
        strong_products = [
            item for item in products
            if float(item.get("matchScore") or 0) >= minimum_best_score
        ]
        affiliate_route_products = [item for item in products if text(item.get("url"))]
        networks = sorted({text(item.get("network")) for item in products if text(item.get("network"))})
        advertisers = sorted({text(item.get("advertiser")) for item in products if text(item.get("advertiser"))})
        direct_products = [text(item) for item in candidate.get("products", []) if text(item)]
        active_direct_products = [item for item in direct_products if item in active_direct]
        trend_score = int(candidate.get("score") or 0)

        checks = {
            "trendScorePassed": trend_score >= minimum_trend_score,
            "productMatchCountPassed": len(products) >= minimum_product_matches,
            "bestMatchScorePassed": best_score >= minimum_best_score,
            "strongMatchCountPassed": len(strong_products) >= minimum_strong_matches,
            "affiliateRouteCountPassed": len(affiliate_route_products) >= minimum_affiliate_routes,
            "activeDirectRoute": bool(active_direct_products),
        }
        product_route_ready = all(
            checks[key]
            for key in (
                "productMatchCountPassed",
                "bestMatchScorePassed",
                "strongMatchCountPassed",
                "affiliateRouteCountPassed",
            )
        )
        direct_route_ready = checks["activeDirectRoute"]
        is_ready = checks["trendScorePassed"] and (product_route_ready or direct_route_ready)

        hold_reasons = []
        if not checks["trendScorePassed"]:
            hold_reasons.append(f"trend-score-below-{minimum_trend_score}")
        if not direct_route_ready:
            if not checks["productMatchCountPassed"]:
                hold_reasons.append(f"fewer-than-{minimum_product_matches}-product-matches")
            if not checks["bestMatchScorePassed"]:
                hold_reasons.append(f"best-match-below-{minimum_best_score:g}")
            if not checks["strongMatchCountPassed"]:
                hold_reasons.append(f"fewer-than-{minimum_strong_matches}-strong-matches")
            if not checks["affiliateRouteCountPassed"]:
                hold_reasons.append(f"fewer-than-{minimum_affiliate_routes}-affiliate-routes")

        candidate["productEvidence"] = {
            "matchCount": len(products),
            "bestMatchScore": round(best_score, 2),
            "strongMatchCount": len(strong_products),
            "affiliateRouteCount": len(affiliate_route_products),
            "networks": networks,
            "advertisers": advertisers,
            "activeDirectProducts": active_direct_products,
            "approvalThresholds": {
                "minimumTrendScore": minimum_trend_score,
                "minimumProductMatches": minimum_product_matches,
                "minimumBestMatchScore": minimum_best_score,
                "minimumStrongMatches": minimum_strong_matches,
                "minimumAffiliateRouteMatches": minimum_affiliate_routes,
            },
            "approvalChecks": checks,
            "holdReasons": hold_reasons,
            "topProducts": products[:preview_products],
        }
        candidate["readyForApproval"] = is_ready
        candidate["reviewStatus"] = "ready-for-approval" if is_ready else "needs-more-evidence"
        assessed += 1
        ready += int(is_ready)

    review_data["version"] = "0.6.2"
    review_data["productEvidenceUpdatedAt"] = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    REVIEW_PATH.write_text(json.dumps(review_data, ensure_ascii=False, indent=2), encoding="utf-8")
    return assessed, ready


def main() -> int:
    config = load_config()
    offers = read_offers()
    top_per_trend = int(config.get("sourceSettings", {}).get("topProductsPerTrend", 8))
    minimum_score = float(config.get("sourceSettings", {}).get("minimumScore", 40))

    raw_matches: dict[str, list] = defaultdict(list)
    counters = Counter()
    matches_by_network = Counter()

    for offer in offers:
        counters["offersRead"] += 1
        if blocked(offer, config):
            counters["complianceBlocked"] += 1
            continue

        for profile in config.get("trendProfiles", []):
            scoring = score_offer(offer, profile, config)
            if scoring is None or scoring["score"] < minimum_score:
                continue
            item = public_offer(offer, scoring)
            raw_matches[profile["slug"]].append(item)
            counters["candidateMatches"] += 1

    final_matches = {
        profile["slug"]: sort_and_deduplicate(
            raw_matches.get(profile["slug"], []),
            top_per_trend,
        )
        for profile in config.get("trendProfiles", [])
    }

    for products in final_matches.values():
        for item in products:
            matches_by_network[text(item.get("network")) or "Unknown"] += 1

    public_slugs = {
        profile["slug"]
        for profile in config.get("trendProfiles", [])
        if profile.get("visibility", "public") == "public"
    }
    review_slugs = {
        profile["slug"]
        for profile in config.get("trendProfiles", [])
        if profile.get("visibility") == "review"
    }
    public_matches = {slug: final_matches.get(slug, []) for slug in public_slugs}
    review_matches = {slug: final_matches.get(slug, []) for slug in review_slugs}
    assessed, ready = update_review_evidence(review_matches, config)

    generated_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    output = {
        "version": "0.6.2",
        "generatedAt": generated_at,
        "productsByTrend": public_matches,
    }
    report = {
        "version": "0.6.2",
        "generatedAt": generated_at,
        "catalogueOffersRead": len(offers),
        "counters": dict(counters),
        "matchesPerTrend": {slug: len(items) for slug, items in public_matches.items()},
        "matchesByNetwork": dict(matches_by_network),
        "reviewEvidence": {
            "candidatesAssessed": assessed,
            "readyForApproval": ready,
            "matchesPerCandidate": {slug: len(items) for slug, items in review_matches.items()},
        },
        "note": (
            "Equivalent products are deduplicated across networks. The strongest "
            "compliant offer is selected by match, commission, discount and data quality."
        ),
    }

    data_path = ROOT / "data" / "matched-products.json"
    report_path = ROOT / "data" / "product-matcher-report.json"
    js_path = ROOT / "js" / "matched-products.js"
    data_path.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    js_path.write_text(
        "window.TRENDPILOT_MATCHED_PRODUCTS = "
        + json.dumps(public_matches, ensure_ascii=False, separators=(",", ":"))
        + ";\nwindow.TRENDPILOT_MATCHED_PRODUCTS_META = "
        + json.dumps({"generatedAt": generated_at, "version": "0.6.2"}, ensure_ascii=False)
        + ";\n",
        encoding="utf-8",
    )

    print(f"Catalogue offers read: {len(offers)}")
    print(f"Candidate matches: {counters['candidateMatches']}")
    print(f"Review candidates assessed: {assessed}")
    print(f"Ready for approval: {ready}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
