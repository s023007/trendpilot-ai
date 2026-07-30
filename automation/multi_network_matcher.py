#!/usr/bin/env python3
"""TrendPilot AI v0.7.2 product-first multi-network matcher.

The product is evaluated first. The affiliate network, advertiser and source do
not receive ranking preference. Compatible offers from Admitad, CJ, Amazon,
Awin, Impact, PartnerStack, direct programmes or future sources are compared
using the same rules.

Ranking priority:
1. Product relevance to the trend.
2. Product/data quality and available customer signals.
3. Commercial value, price fit and discount.
4. Audience breadth and specificity.
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

VERSION = "0.7.2"
BUILD_ID = "2026-07-31-product-first-published-split"

ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = ROOT / "config" / "product-matcher.json"
CACHE_PATH = ROOT / "automation" / "cache" / "offers.jsonl"
DISCOVERED_TRENDS_PATH = ROOT / "data" / "discovered-trends.json"
REVIEW_PATH = ROOT / "data" / "trend-review.json"
AFFILIATE_LINKS_PATH = ROOT / "js" / "affiliate-links.js"

STOP_WORDS = {
    "a", "an", "and", "or", "the", "for", "with", "of", "to", "in", "on",
    "by", "from", "new", "hot", "best", "sale", "official", "original",
    "product", "products", "item", "items", "pcs", "piece", "pieces",
}

# These words describe selling language rather than product identity.
IDENTITY_NOISE = STOP_WORDS | {
    "free", "shipping", "choice", "wholesale", "discount", "updated",
    "2024", "2025", "2026",
}


def text(value: object) -> str:
    return str(value or "").strip()


def normalise(value: object) -> str:
    value = text(value).lower()
    value = re.sub(r"[\u2010-\u2015]", "-", value)
    value = re.sub(r"[^a-z0-9%$€£+ ]+", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def _stem(token: str) -> str:
    """Small English normaliser for product titles.

    It is intentionally conservative: model numbers and short tokens are kept
    unchanged, while common plural endings are reduced.
    """
    token = token.strip().lower()
    if len(token) <= 3 or any(char.isdigit() for char in token):
        return token
    if token.endswith("ies") and len(token) > 4:
        return token[:-3] + "y"
    if token.endswith("sses"):
        return token[:-2]
    if token.endswith("es") and len(token) > 4:
        return token[:-2]
    if token.endswith("s") and not token.endswith(("ss", "us")):
        return token[:-1]
    return token


def token_list(value: object, *, remove_stop_words: bool = False) -> list[str]:
    tokens = [_stem(item) for item in normalise(value).split()]
    if remove_stop_words:
        tokens = [item for item in tokens if item and item not in STOP_WORDS]
    return [item for item in tokens if item]


def token_set(value: object, *, remove_stop_words: bool = False) -> set[str]:
    return set(token_list(value, remove_stop_words=remove_stop_words))


def has_term(haystack: object, term: object) -> bool:
    hay = normalise(haystack)
    needle = normalise(term)
    if not hay or not needle:
        return False
    return re.search(rf"(?:^| ){re.escape(needle)}(?:$| )", hay) is not None


def term_similarity(haystack: object, term: object) -> float:
    """Return a product-aware match score from 0 to 1.

    Exact phrases remain strongest. Token matching lets the same product match
    even when Alibaba, AliExpress, Amazon or another feed writes the title in a
    different word order.
    """
    hay = normalise(haystack)
    needle = normalise(term)
    if not hay or not needle:
        return 0.0

    if has_term(hay, needle):
        return 1.0

    hay_tokens = token_set(hay, remove_stop_words=True)
    term_tokens = token_set(needle, remove_stop_words=True)
    if not hay_tokens or not term_tokens:
        return 0.0

    overlap = len(hay_tokens & term_tokens)
    coverage = overlap / len(term_tokens)

    if len(term_tokens) == 1:
        return 1.0 if overlap == 1 else 0.0
    if coverage == 1.0:
        return 0.94
    if overlap >= 2 and coverage >= 0.75:
        return 0.84
    if overlap >= 2 and coverage >= 0.60:
        return 0.74
    return 0.0


def term_matches(haystack: object, term: object, threshold: float = 0.72) -> bool:
    return term_similarity(haystack, term) >= threshold


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


def _trend_terms(trend: dict, match: dict) -> list[str]:
    terms: list[str] = []
    for value in (
        match.get("includeTerms", []),
        match.get("requiredTitleTerms", []),
        trend.get("keywords", []),
    ):
        for item in value or []:
            clean = text(item)
            if clean and clean not in terms:
                terms.append(clean)

    title = text(trend.get("title"))
    if title and title not in terms:
        terms.append(title)
    return terms


def profile_from_trend(trend: dict, visibility: str) -> Optional[dict]:
    match = trend.get("productMatch") or {}
    include_terms = _trend_terms(trend, match)
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
        "rankingRules": match.get("rankingRules", {}),
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
        profile.setdefault("rankingRules", {})

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
                record = json.loads(line)
            except json.JSONDecodeError:
                continue
            if isinstance(record, dict):
                offers.append(record)
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


def _first_number(offer: dict, names: tuple[str, ...], default: float = 0.0) -> float:
    for name in names:
        value = offer.get(name)
        if value not in (None, ""):
            return _number(value, default)
    return default


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


def _audience_adjustment(
    offer: dict,
    profile: dict,
    settings: dict,
) -> tuple[float, float, dict]:
    rules = profile.get("rankingRules", {}) or {}
    title = text(offer.get("name"))

    broad_terms = [text(item) for item in rules.get("broadAudienceTerms", []) if text(item)]
    narrow_terms = [text(item) for item in rules.get("narrowAudienceTerms", []) if text(item)]
    broad_hits = [term for term in broad_terms if term_matches(title, term, 0.72)]
    narrow_hits = [term for term in narrow_terms if term_matches(title, term, 0.90)]
    pattern_hits = _regex_hits(title, rules.get("narrowAudiencePatterns", []))

    bonus_per_term = _number(
        rules.get("broadAudienceBonusPerTerm"),
        _number(settings.get("broadAudienceBonusPerTerm"), 3.0),
    )
    maximum_bonus = _number(
        rules.get("maximumBroadAudienceBonus"),
        _number(settings.get("maximumBroadAudienceBonus"), 8.0),
    )
    term_penalty = _number(
        rules.get("narrowAudiencePenaltyPerTerm"),
        _number(settings.get("narrowAudiencePenaltyPerTerm"), 3.5),
    )
    pattern_penalty = _number(
        rules.get("narrowAudiencePenaltyPerPattern"),
        _number(settings.get("narrowAudiencePenaltyPerPattern"), 6.0),
    )
    maximum_penalty = _number(
        rules.get("maximumNarrowAudiencePenalty"),
        _number(settings.get("maximumNarrowAudiencePenalty"), 22.0),
    )

    bonus = min(maximum_bonus, len(broad_hits) * bonus_per_term)
    penalty = min(
        maximum_penalty,
        len(narrow_hits) * term_penalty + len(pattern_hits) * pattern_penalty,
    )

    if bool(rules.get("preferGeneralProducts", False)) and (narrow_hits or pattern_hits) and not broad_hits:
        penalty = min(
            maximum_penalty,
            penalty + _number(rules.get("generalProductMissPenalty"), 3.0),
        )

    return (
        round(bonus, 3),
        round(penalty, 3),
        {
            "broadTerms": broad_hits,
            "narrowTerms": narrow_hits,
            "narrowPatterns": pattern_hits,
        },
    )


def _quality_signals(offer: dict, settings: dict) -> dict:
    quality_score = max(0.0, min(100.0, _number(offer.get("qualityScore"))))
    quality_points = min(
        _number(settings.get("maximumQualityPoints"), 10.0),
        quality_score / max(1.0, _number(settings.get("qualityDivisor"), 10.0)),
    )

    rating = _first_number(
        offer,
        ("rating", "ratingValue", "reviewScore", "averageRating", "stars"),
        0.0,
    )
    if rating > 5 and rating <= 100:
        rating = rating / 20
    rating = max(0.0, min(5.0, rating))
    rating_points = (rating / 5.0) * _number(
        settings.get("maximumRatingPoints"),
        6.0,
    )

    review_count = _first_number(
        offer,
        ("reviewCount", "reviews", "ratingCount", "feedbackCount"),
        0.0,
    )
    sold_count = _first_number(
        offer,
        ("soldCount", "orders", "sales", "salesCount"),
        0.0,
    )
    popularity_raw = max(review_count, sold_count)
    popularity_points = min(
        _number(settings.get("maximumPopularityPoints"), 6.0),
        math.log10(popularity_raw + 1.0) * _number(
            settings.get("popularityLogMultiplier"),
            1.8,
        ),
    ) if popularity_raw > 0 else 0.0

    return {
        "qualityScore": round(quality_score, 2),
        "qualityPoints": round(quality_points, 3),
        "customerRating": round(rating, 2),
        "ratingPoints": round(rating_points, 3),
        "reviewCount": int(review_count) if review_count > 0 else 0,
        "soldCount": int(sold_count) if sold_count > 0 else 0,
        "popularityPoints": round(popularity_points, 3),
    }


def _product_identity(item: dict) -> str:
    """Create a source-neutral identity for obvious duplicate listings."""
    name_tokens = [
        token
        for token in token_list(item.get("name"), remove_stop_words=True)
        if token not in IDENTITY_NOISE
    ]
    if len(name_tokens) < 3:
        return (
            text(item.get("canonicalKey"))
            or text(item.get("id"))
            or text(item.get("url"))
        )

    # Keeping up to 18 sorted tokens makes word order irrelevant while avoiding
    # aggressive grouping of unrelated products.
    signature = " ".join(sorted(set(name_tokens))[:18])
    return f"product:{signature}"


def score_offer(offer: dict, profile: dict, config: dict) -> Optional[dict]:
    if offer.get("offerType") == "direct":
        return None
    if not offer.get("available", True):
        return None

    title = text(offer.get("name"))
    description = text(offer.get("description"))
    category = text(offer.get("category"))
    tags = " ".join(offer.get("tags", []) or [])
    haystack = f"{title} {description} {category} {tags}"

    includes = [term for term in profile.get("includeTerms", []) if text(term)]
    if not includes:
        includes = [text(profile.get("title"))] if text(profile.get("title")) else []

    match_strengths = {
        term: term_similarity(haystack, term)
        for term in includes
    }
    matched = [
        term for term, strength in match_strengths.items()
        if strength >= 0.72
    ]
    if len(matched) < int(profile.get("minimumMatchedTerms") or 1):
        return None

    if any(term_matches(haystack, term, 0.90) for term in profile.get("excludeTerms", [])):
        return None

    required_terms = [
        term for term in profile.get("requiredTitleTerms", [])
        if text(term)
    ]
    required_title_matches = [
        term for term in required_terms
        if term_matches(title, term, 0.72)
    ]
    minimum_required = int(profile.get("minimumRequiredTitleTerms") or 0)
    if minimum_required and len(required_title_matches) < minimum_required:
        return None

    # We already perform product-aware title matching above. The shared validator
    # still enforces URLs, blocked accessories and exclusion rules, but it must
    # not repeat the old exact-title gate.
    validation_profile = dict(profile)
    validation_profile["requiredTitleTerms"] = []
    validation_profile["minimumRequiredTitleTerms"] = 0
    valid_product, _ = validate_offer(
        offer,
        validation_profile,
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
    title_strengths = {
        term: term_similarity(title, term)
        for term in includes
    }
    title_matches = [
        term for term, strength in title_strengths.items()
        if strength >= 0.72
    ]

    # Product identity and title relevance dominate. Category is supporting
    # evidence only, so a broad Alibaba/Amazon category cannot lose merely
    # because another feed calls the same product "Car Electronics".
    relevance = _number(settings.get("baseRelevanceScore"), 10.0)
    relevance += min(
        _number(settings.get("maximumMatchedTermPoints"), 34.0),
        sum(match_strengths[term] for term in matched)
        * _number(settings.get("matchedTermPoints"), 11.0),
    )
    relevance += min(
        _number(settings.get("maximumTitleTermPoints"), 24.0),
        sum(title_strengths[term] for term in title_matches)
        * _number(settings.get("titleTermPoints"), 8.0),
    )

    trend_title_similarity = term_similarity(title, profile.get("title"))
    relevance += trend_title_similarity * _number(
        settings.get("trendTitleSimilarityPoints"),
        12.0,
    )

    normal_category = normalise(category)
    preferred = [
        normalise(item)
        for item in profile.get("preferredCategories", [])
        if normalise(item)
    ]
    category_bonus = 0.0
    if normal_category and normal_category in preferred:
        category_bonus = _number(settings.get("exactCategoryBonus"), 4.0)
    elif normal_category and any(
        item in normal_category or normal_category in item
        for item in preferred
    ):
        category_bonus = _number(settings.get("partialCategoryBonus"), 2.0)
    relevance += category_bonus

    quality = _quality_signals(offer, settings)
    commission = min(
        _number(settings.get("maximumCommissionPoints"), 7.0),
        _number(offer.get("commissionRate"))
        * _number(settings.get("commissionMultiplier"), 0.5),
    )
    discount = min(
        _number(settings.get("maximumDiscountPoints"), 5.0),
        _number(offer.get("discountPercent"))
        * _number(settings.get("discountMultiplier"), 0.08),
    )
    price_fit = _price_fit_bonus(price, profile, settings)
    commercial = (
        quality["qualityPoints"]
        + quality["ratingPoints"]
        + quality["popularityPoints"]
        + commission
        + discount
        + price_fit
    )

    broad_bonus, narrow_penalty, audience_details = _audience_adjustment(
        offer,
        profile,
        settings,
    )
    raw_score = relevance + commercial + broad_bonus - narrow_penalty

    # Deliberately no network or advertiser multiplier. Every connected source
    # competes using the same product-first score.
    compression_start = _number(
        settings.get("highScoreCompressionStart"),
        82.0,
    )
    compression_ratio = _number(
        settings.get("highScoreCompressionRatio"),
        0.55,
    )
    final_score = raw_score
    if final_score > compression_start:
        final_score = (
            compression_start
            + (final_score - compression_start) * compression_ratio
        )
    maximum_final = _number(settings.get("maximumFinalScore"), 99.5)
    final_score = round(max(0.0, min(maximum_final, final_score)), 2)

    product_relevance = round(
        max(0.0, min(100.0, relevance * 1.45)),
        2,
    )

    return {
        "score": final_score,
        "productRelevance": product_relevance,
        "relevance": round(relevance, 2),
        "categoryBonus": round(category_bonus, 2),
        "commercial": round(commercial, 2),
        "audienceBonus": round(broad_bonus, 2),
        "specificityPenalty": round(narrow_penalty, 2),
        "priceFit": round(price_fit, 2),
        "commissionPoints": round(commission, 2),
        "discountPoints": round(discount, 2),
        "matchedTerms": matched,
        "titleMatchedTerms": title_matches,
        "requiredTitleMatches": required_title_matches,
        "audienceDetails": audience_details,
        **quality,
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
        "offerQuality": scoring["qualityScore"],
        "customerRating": scoring["customerRating"],
        "reviewCount": scoring["reviewCount"],
        "soldCount": scoring["soldCount"],
        "matchScore": scoring["score"],
        "productRelevance": scoring["productRelevance"],
        "rankingSignals": {
            "productRelevance": scoring["productRelevance"],
            "relevance": scoring["relevance"],
            "categoryBonus": scoring["categoryBonus"],
            "quality": scoring["qualityPoints"],
            "customerRating": scoring["customerRating"],
            "ratingPoints": scoring["ratingPoints"],
            "popularity": scoring["popularityPoints"],
            "commercial": scoring["commercial"],
            "commission": scoring["commissionPoints"],
            "discount": scoring["discountPoints"],
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
            try:
                result[public_key] = round(float(offer[source_key]), 2)
            except (TypeError, ValueError):
                pass
    return result


def _rank_tuple(item: dict) -> tuple:
    signals = item.get("rankingSignals", {}) or {}
    return (
        _number(item.get("matchScore")),
        _number(item.get("productRelevance")),
        _number(item.get("customerRating")),
        _number(signals.get("popularity")),
        _number(item.get("offerQuality")),
        -_number(signals.get("specificityPenalty")),
        _number(signals.get("commercial")),
        _number(item.get("commissionRate")),
        -_number(item.get("price"), 10**12),
    )


def sort_and_deduplicate(items: list[dict], maximum: int) -> list[dict]:
    # First choose the best route for products that are clearly equivalent.
    best: dict[str, dict] = {}
    for item in items:
        key = _product_identity(item)
        previous = best.get(key)
        if previous is None or _rank_tuple(item) > _rank_tuple(previous):
            best[key] = item

    output = sorted(best.values(), key=_rank_tuple, reverse=True)[:maximum]
    for position, item in enumerate(output, start=1):
        item["rank"] = position
        item["rankingLabel"] = (
            "Best match"
            if position == 1
            else f"Rank #{position}"
        )
    return output


def update_review_evidence(
    review_matches: dict[str, list],
    config: dict,
) -> tuple[int, int]:
    review_data = load_json(
        REVIEW_PATH,
        {"version": VERSION, "reviewQueue": []},
    )
    settings = config.get("reviewSettings", {})
    active_direct = active_affiliate_slugs()
    assessed = 0
    ready = 0

    minimum_trend_score = int(settings.get("minimumTrendScore", 72))
    minimum_product_matches = int(settings.get("minimumProductMatches", 3))
    minimum_best_score = float(settings.get("minimumBestMatchScore", 75))
    minimum_strong_matches = int(settings.get("minimumStrongMatches", 3))
    minimum_affiliate_routes = int(
        settings.get("minimumAffiliateRouteMatches", 3)
    )
    preview_products = int(settings.get("previewProducts", 3))

    for candidate in review_data.get("reviewQueue", []):
        slug = text(candidate.get("slug"))
        products = review_matches.get(slug, [])
        best_score = max(
            (float(item.get("matchScore") or 0) for item in products),
            default=0,
        )
        strong_products = [
            item
            for item in products
            if float(item.get("matchScore") or 0) >= minimum_best_score
        ]
        affiliate_route_products = [
            item for item in products if text(item.get("url"))
        ]
        networks = sorted({
            text(item.get("network"))
            for item in products
            if text(item.get("network"))
        })
        advertisers = sorted({
            text(item.get("advertiser"))
            for item in products
            if text(item.get("advertiser"))
        })
        direct_products = [
            text(item) for item in candidate.get("products", []) if text(item)
        ]
        active_direct_products = [
            item for item in direct_products if item in active_direct
        ]
        trend_score = int(candidate.get("score") or 0)

        checks = {
            "trendScorePassed": trend_score >= minimum_trend_score,
            "productMatchCountPassed": len(products) >= minimum_product_matches,
            "bestMatchScorePassed": best_score >= minimum_best_score,
            "strongMatchCountPassed": len(strong_products) >= minimum_strong_matches,
            "affiliateRouteCountPassed": (
                len(affiliate_route_products) >= minimum_affiliate_routes
            ),
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
        is_ready = (
            checks["trendScorePassed"]
            and (product_route_ready or direct_route_ready)
        )

        hold_reasons = []
        if not checks["trendScorePassed"]:
            hold_reasons.append(
                f"trend-score-below-{minimum_trend_score}"
            )
        if not direct_route_ready:
            if not checks["productMatchCountPassed"]:
                hold_reasons.append(
                    f"fewer-than-{minimum_product_matches}-product-matches"
                )
            if not checks["bestMatchScorePassed"]:
                hold_reasons.append(
                    f"best-match-below-{minimum_best_score:g}"
                )
            if not checks["strongMatchCountPassed"]:
                hold_reasons.append(
                    f"fewer-than-{minimum_strong_matches}-strong-matches"
                )
            if not checks["affiliateRouteCountPassed"]:
                hold_reasons.append(
                    f"fewer-than-{minimum_affiliate_routes}-affiliate-routes"
                )

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
        candidate["reviewStatus"] = (
            "ready-for-approval"
            if is_ready
            else "needs-more-evidence"
        )
        assessed += 1
        ready += int(is_ready)

    review_data["version"] = VERSION
    review_data["productEvidenceUpdatedAt"] = (
        datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    )
    REVIEW_PATH.write_text(
        json.dumps(review_data, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return assessed, ready


def main() -> int:
    config = load_config()
    offers = read_offers()
    top_per_trend = int(
        config.get("sourceSettings", {}).get("topProductsPerTrend", 8)
    )
    minimum_score = float(
        config.get("sourceSettings", {}).get("minimumScore", 40)
    )

    raw_matches: dict[str, list] = defaultdict(list)
    counters = Counter()
    candidate_matches_by_network = Counter()
    candidate_matches_by_advertiser = Counter()
    final_matches_by_network = Counter()
    final_matches_by_advertiser = Counter()

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
            candidate_matches_by_network[
                text(item.get("network")) or "Unknown"
            ] += 1
            candidate_matches_by_advertiser[
                text(item.get("advertiser")) or "Unknown"
            ] += 1

    final_matches = {
        profile["slug"]: sort_and_deduplicate(
            raw_matches.get(profile["slug"], []),
            top_per_trend,
        )
        for profile in config.get("trendProfiles", [])
    }

    for products in final_matches.values():
        for item in products:
            final_matches_by_network[
                text(item.get("network")) or "Unknown"
            ] += 1
            final_matches_by_advertiser[
                text(item.get("advertiser")) or "Unknown"
            ] += 1

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
    public_matches = {
        slug: final_matches.get(slug, [])
        for slug in public_slugs
    }
    review_matches = {
        slug: final_matches.get(slug, [])
        for slug in review_slugs
    }
    assessed, ready = update_review_evidence(review_matches, config)

    published_matches_by_network = Counter()
    published_matches_by_advertiser = Counter()
    review_matches_by_network = Counter()
    review_matches_by_advertiser = Counter()

    for products in public_matches.values():
        for item in products:
            published_matches_by_network[
                text(item.get("network")) or "Unknown"
            ] += 1
            published_matches_by_advertiser[
                text(item.get("advertiser")) or "Unknown"
            ] += 1

    for products in review_matches.values():
        for item in products:
            review_matches_by_network[
                text(item.get("network")) or "Unknown"
            ] += 1
            review_matches_by_advertiser[
                text(item.get("advertiser")) or "Unknown"
            ] += 1

    generated_at = (
        datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    )
    output = {
        "version": VERSION,
        "buildId": BUILD_ID,
        "generatedAt": generated_at,
        "rankingMode": "product-first-network-neutral",
        "productsByTrend": public_matches,
    }
    report = {
        "version": VERSION,
        "buildId": BUILD_ID,
        "generatedAt": generated_at,
        "rankingMode": "product-first-network-neutral",
        "catalogueOffersRead": len(offers),
        "counters": dict(counters),
        "matchesPerTrend": {
            slug: len(items)
            for slug, items in public_matches.items()
        },
        "candidateMatchesByNetwork": dict(candidate_matches_by_network),
        "candidateMatchesByAdvertiser": dict(
            candidate_matches_by_advertiser
        ),
        # Backward-compatible fields now represent published website results only.
        "matchesByNetwork": dict(published_matches_by_network),
        "matchesByAdvertiser": dict(published_matches_by_advertiser),
        "publishedMatchesByNetwork": dict(published_matches_by_network),
        "publishedMatchesByAdvertiser": dict(published_matches_by_advertiser),
        "reviewMatchesByNetwork": dict(review_matches_by_network),
        "reviewMatchesByAdvertiser": dict(review_matches_by_advertiser),
        "allFinalMatchesByNetwork": dict(final_matches_by_network),
        "allFinalMatchesByAdvertiser": dict(final_matches_by_advertiser),
        "reviewEvidence": {
            "candidatesAssessed": assessed,
            "readyForApproval": ready,
            "matchesPerCandidate": {
                slug: len(items)
                for slug, items in review_matches.items()
            },
        },
        "note": (
            "Products are ranked without network preference. Product relevance "
            "comes first, followed by quality/customer signals, commercial value, "
            "price fit and audience breadth. Equivalent listings are compared and "
            "the strongest compliant affiliate route is kept. Published and review-only "
            "matches are reported separately."
        ),
    }

    data_path = ROOT / "data" / "matched-products.json"
    report_path = ROOT / "data" / "product-matcher-report.json"
    js_path = ROOT / "js" / "matched-products.js"

    data_path.write_text(
        json.dumps(output, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    report_path.write_text(
        json.dumps(report, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    js_path.write_text(
        "window.TRENDPILOT_MATCHED_PRODUCTS = "
        + json.dumps(
            public_matches,
            ensure_ascii=False,
            separators=(",", ":"),
        )
        + ";\nwindow.TRENDPILOT_MATCHED_PRODUCTS_META = "
        + json.dumps(
            {
                "generatedAt": generated_at,
                "version": VERSION,
                "rankingMode": "product-first-network-neutral",
            },
            ensure_ascii=False,
        )
        + ";\n",
        encoding="utf-8",
    )

    print(f"Catalogue offers read: {len(offers)}")
    print(f"Candidate matches: {counters['candidateMatches']}")
    print(
        "Candidate advertisers: "
        + json.dumps(dict(candidate_matches_by_advertiser), ensure_ascii=False)
    )
    print(
        "Published advertisers: "
        + json.dumps(dict(published_matches_by_advertiser), ensure_ascii=False)
    )
    print(
        "Review advertisers: "
        + json.dumps(dict(review_matches_by_advertiser), ensure_ascii=False)
    )
    print(f"Review candidates assessed: {assessed}")
    print(f"Ready for approval: {ready}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
