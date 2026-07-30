#!/usr/bin/env python3
"""TrendPilot AI v0.6.0 confirmed-route discovery and review queue.

New public signals are never published immediately. They first enter a review
queue, receive product-match evidence, and can then be approved explicitly in
config/trend-approvals.json.

No API keys or private affiliate-feed URLs are written to public output files.
"""
from __future__ import annotations

import concurrent.futures
import email.utils
import html
import json
import math
import re
import time
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from difflib import SequenceMatcher
from pathlib import Path
from typing import Iterable, Optional

ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = ROOT / "config" / "trend-discovery.json"
APPROVALS_PATH = ROOT / "config" / "trend-approvals.json"
DATA_PATH = ROOT / "data" / "discovered-trends.json"
REVIEW_PATH = ROOT / "data" / "trend-review.json"
REPORT_PATH = ROOT / "data" / "trend-discovery-report.json"
REJECTIONS_PATH = ROOT / "data" / "trend-rejections.json"
JS_PATH = ROOT / "js" / "discovered-trends.js"
STATIC_TRENDS_PATH = ROOT / "js" / "trends-data.js"
AFFILIATE_LINKS_PATH = ROOT / "js" / "affiliate-links.js"


def now_utc() -> datetime:
    return datetime.now(timezone.utc).replace(microsecond=0)


def clean_text(value: object) -> str:
    value = html.unescape(str(value or ""))
    value = re.sub(r"<[^>]+>", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def normalise(value: object) -> str:
    value = clean_text(value).lower()
    value = re.sub(r"[\u2010-\u2015]", "-", value)
    value = re.sub(r"[^a-z0-9+\- ]+", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def has_term(haystack: object, term: object) -> bool:
    hay = normalise(haystack)
    needle = normalise(term)
    if not hay or not needle:
        return False
    return re.search(rf"(?:^| ){re.escape(needle)}(?:$| )", hay) is not None


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", normalise(value)).strip("-")
    return slug[:72] or "discovered-trend"


def local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1].lower()


def parse_date(value: object) -> Optional[datetime]:
    raw = clean_text(value)
    if not raw:
        return None
    try:
        parsed = email.utils.parsedate_to_datetime(raw)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)
    except (TypeError, ValueError, OverflowError):
        pass
    try:
        parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)
    except ValueError:
        return None


def load_json(path: Path, fallback: dict) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return copy_json(fallback)


def copy_json(value: dict) -> dict:
    return json.loads(json.dumps(value))


def http_get(url: str, timeout: int, accept: str = "*/*") -> bytes:
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "TrendPilotAI-TrendDiscovery/0.6.0 (+https://s023007.github.io/trendpilot-ai/)",
            "Accept": accept,
            "Accept-Language": "en-GB,en;q=0.9",
        },
    )
    last_error: Optional[Exception] = None
    for attempt in range(3):
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                return response.read(6_000_000)
        except Exception as exc:
            last_error = exc
            if attempt < 2:
                time.sleep(1.5 * (attempt + 1))
    if last_error:
        raise last_error
    raise RuntimeError("Unable to retrieve source.")


def element_text(element: ET.Element, candidates: Iterable[str]) -> str:
    wanted = {item.lower() for item in candidates}
    for child in element.iter():
        if local_name(child.tag) in wanted and clean_text(child.text):
            return clean_text(child.text)
    return ""


def element_texts(element: ET.Element, candidates: Iterable[str]) -> list[str]:
    wanted = {item.lower() for item in candidates}
    values: list[str] = []
    seen: set[str] = set()
    for child in element.iter():
        if local_name(child.tag) not in wanted:
            continue
        value = clean_text(child.text or child.attrib.get("term") or child.attrib.get("label"))
        key = normalise(value)
        if value and key not in seen:
            seen.add(key)
            values.append(value)
    return values


def element_link(element: ET.Element) -> str:
    for child in element.iter():
        if local_name(child.tag) != "link":
            continue
        href = clean_text(child.attrib.get("href"))
        if href:
            return href
        text = clean_text(child.text)
        if text:
            return text
    return ""


def parse_rss(payload: bytes, source: dict) -> list[dict]:
    root = ET.fromstring(payload)
    entries = [el for el in root.iter() if local_name(el.tag) in {"item", "entry"}]
    signals: list[dict] = []
    for entry in entries:
        title = element_text(entry, ["title"])
        if not title:
            continue
        signals.append(
            {
                "title": title,
                "summary": element_text(entry, ["description", "summary", "content", "news_item_title"]),
                "tags": element_texts(entry, ["category", "subject", "tag"]),
                "url": element_link(entry) or source["url"],
                "publishedAt": parse_date(element_text(entry, ["pubdate", "published", "updated"])),
                "traffic": element_text(entry, ["approx_traffic", "traffic"]),
                "sourceId": source["id"],
                "sourceLabel": source["label"],
                "sourceWeight": float(source.get("weight", 25)),
                "sourceType": source.get("type", "rss"),
            }
        )
    return signals


def fetch_hacker_news(source: dict, timeout: int) -> list[dict]:
    ids = json.loads(http_get(source["url"], timeout, "application/json"))
    ids = ids[: int(source.get("maxItems", 35))]
    base = "https://hacker-news.firebaseio.com/v0/item/{}.json"

    def load_item(item_id: int) -> Optional[dict]:
        try:
            item = json.loads(http_get(base.format(item_id), timeout, "application/json"))
        except Exception:
            return None
        if not item or item.get("type") != "story" or item.get("dead") or item.get("deleted"):
            return None
        points = int(item.get("score") or 0)
        if points < int(source.get("minimumPoints", 35)):
            return None
        return {
            "title": clean_text(item.get("title")),
            "summary": clean_text(item.get("text")),
            "url": clean_text(item.get("url")) or f"https://news.ycombinator.com/item?id={item_id}",
            "publishedAt": datetime.fromtimestamp(int(item.get("time") or 0), timezone.utc),
            "points": points,
            "comments": int(item.get("descendants") or 0),
            "sourceId": source["id"],
            "sourceLabel": source["label"],
            "sourceWeight": float(source.get("weight", 25)),
            "sourceType": "hacker_news",
        }

    signals: list[dict] = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        for item in executor.map(load_item, ids):
            if item:
                signals.append(item)
    return signals


def traffic_value(value: object) -> int:
    raw = clean_text(value).upper().replace(",", "")
    match = re.search(r"(\d+(?:\.\d+)?)\s*([KMB]?)", raw)
    if not match:
        return 0
    number = float(match.group(1))
    multiplier = {"": 1, "K": 1_000, "M": 1_000_000, "B": 1_000_000_000}[match.group(2)]
    return int(number * multiplier)


def static_titles_and_slugs() -> tuple[set[str], set[str]]:
    if not STATIC_TRENDS_PATH.exists():
        return set(), set()
    content = STATIC_TRENDS_PATH.read_text(encoding="utf-8", errors="replace")
    titles = {normalise(item) for item in re.findall(r'"title"\s*:\s*"([^"]+)"', content)}
    slugs = set(re.findall(r'"slug"\s*:\s*"([^"]+)"', content))
    return titles, slugs


def active_affiliate_slugs() -> set[str]:
    """Return only direct products with a real affiliate URL configured."""
    if not AFFILIATE_LINKS_PATH.exists():
        return set()

    content = AFFILIATE_LINKS_PATH.read_text(encoding="utf-8", errors="replace")
    active: set[str] = set()
    block_pattern = re.compile(r'"([^"]+)"\s*:\s*\{(.*?)\}', re.S)
    for slug, block in block_pattern.findall(content):
        url_match = re.search(r'"affiliateUrl"\s*:\s*"([^"]*)"', block)
        if url_match and clean_text(url_match.group(1)):
            active.add(clean_text(slug))
    return active


def is_project_only_signal(signal: dict, project_terms: list[str]) -> bool:
    text = normalise(
        f"{signal.get('title', '')} {signal.get('summary', '')} "
        f"{' '.join(signal.get('tags', []) or [])}"
    )
    return any(has_term(text, term) for term in project_terms)


def apply_confirmed_route(match: dict, active_direct_products: set[str]) -> dict:
    """Keep only routes that can currently be monetised.

    Potential network names are not active affiliate routes. A candidate must
    have product-feed search terms or a configured direct affiliate URL.
    Direct affiliate links take priority when both routes are available.
    """
    category = match["category"]
    configured = unique_strings(
        match.get("directProducts", category.get("directProducts", []))
    )
    active_direct = [slug for slug in configured if slug in active_direct_products]
    match["directProducts"] = active_direct
    match["confirmedRoute"] = (
        "direct-affiliate" if active_direct
        else "product-feed" if match.get("productTerms")
        else None
    )
    return match


def candidate_has_confirmed_route(candidate: dict, active_direct_products: set[str]) -> bool:
    product_match = candidate.get("productMatch") or {}
    include_terms = [
        clean_text(item)
        for item in product_match.get("includeTerms", [])
        if clean_text(item)
    ]
    direct_products = [
        clean_text(item)
        for item in candidate.get("products", [])
        if clean_text(item) in active_direct_products
    ]
    return bool(include_terms or direct_products)


def candidate_is_safe(candidate: dict, blocked_terms: list[str]) -> bool:
    text = normalise(
        f"{candidate.get('title', '')} {candidate.get('summary', '')} "
        f"{candidate.get('whyNow', '')}"
    )
    return not any(has_term(text, term) for term in blocked_terms)


def title_similarity(a: str, b: str) -> float:
    na, nb = normalise(a), normalise(b)
    if not na or not nb:
        return 0.0
    if na == nb:
        return 1.0
    seq = SequenceMatcher(None, na, nb).ratio()
    ta, tb = set(na.split()), set(nb.split())
    union = ta | tb
    jaccard = len(ta & tb) / len(union) if union else 0.0
    return max(seq, jaccard)


def category_match(signal: dict, categories: list[dict], ambiguous_terms: set[str]) -> Optional[dict]:
    title = normalise(signal.get("title"))
    full_text = normalise(
        f"{signal.get('title', '')} {signal.get('summary', '')} "
        f"{' '.join(signal.get('tags', []) or [])}"
    )
    best: Optional[dict] = None

    for category in categories:
        matched = [term for term in category.get("terms", []) if has_term(full_text, term)]
        if not matched:
            continue
        specific = [term for term in matched if normalise(term) not in ambiguous_terms]
        if not specific:
            continue

        title_matches = [term for term in specific if has_term(title, term)]
        longest = max((len(normalise(term).split()) for term in specific), default=0)
        quality = len(specific) * 18 + len(title_matches) * 10 + longest * 4

        product_terms: list[str] = []
        term_map = category.get("termProductMap", {})
        for term in specific:
            mapped = term_map.get(term, [])
            if isinstance(mapped, str):
                mapped = [mapped]
            for product_term in mapped:
                product_term = clean_text(product_term)
                if product_term and normalise(product_term) not in {normalise(x) for x in product_terms}:
                    product_terms.append(product_term)

        if not product_terms:
            for product_term in category.get("productTerms", []):
                if has_term(full_text, product_term):
                    product_terms.append(clean_text(product_term))

        candidate = {
            "category": category,
            "matchedTerms": specific,
            "titleMatches": title_matches,
            "productTerms": product_terms,
            "matchQuality": quality,
        }
        if best is None or candidate["matchQuality"] > best["matchQuality"]:
            best = candidate
    return best


def software_category_match(
    signal: dict,
    categories: list[dict],
    descriptor_terms: list[str],
) -> Optional[dict]:
    """Classify commercial software signals without accepting generic news.

    This fallback is limited to Product Hunt and Hacker News. It requires both
    a software descriptor and a category-specific term, so generic words such
    as "AI", "app" or "platform" cannot create a candidate alone.
    """
    source_id = clean_text(signal.get("sourceId"))
    if source_id not in {"product-hunt", "hacker-news"}:
        return None

    title = normalise(signal.get("title"))
    full_text = normalise(
        f"{signal.get('title', '')} {signal.get('summary', '')} "
        f"{' '.join(signal.get('tags', []) or [])}"
    )
    descriptor_hits = [term for term in descriptor_terms if has_term(full_text, term)]
    if not descriptor_hits:
        return None

    best: Optional[dict] = None
    for category in categories:
        matched = [term for term in category.get("terms", []) if has_term(full_text, term)]
        if not matched:
            continue

        title_matches = [term for term in matched if has_term(title, term)]
        quality = 24 + len(matched) * 14 + len(title_matches) * 8 + min(12, len(descriptor_hits) * 3)

        product_terms: list[str] = []
        term_map = category.get("termProductMap", {})
        for term in matched:
            mapped = term_map.get(term, [])
            if isinstance(mapped, str):
                mapped = [mapped]
            for product_term in mapped:
                product_term = clean_text(product_term)
                if product_term and normalise(product_term) not in {normalise(x) for x in product_terms}:
                    product_terms.append(product_term)

        direct_products: list[str] = []
        for rule in category.get("directProductRules", []):
            if any(has_term(full_text, term) for term in rule.get("terms", [])):
                direct_products.extend(rule.get("products", []))
        direct_products = unique_strings(direct_products)

        candidate = {
            "category": category,
            "matchedTerms": unique_strings([*matched, *descriptor_hits]),
            "titleMatches": title_matches,
            "productTerms": product_terms,
            "directProducts": direct_products,
            "matchQuality": quality,
            "routeType": "software",
        }
        if best is None or candidate["matchQuality"] > best["matchQuality"]:
            best = candidate
    return best


def rejection_entry(signal: dict, reason: str, details: Optional[dict] = None) -> dict:
    entry = {
        "title": clean_text(signal.get("title")),
        "sourceId": clean_text(signal.get("sourceId")),
        "sourceLabel": clean_text(signal.get("sourceLabel")),
        "reason": reason,
    }
    if details:
        entry["details"] = details
    return entry


def top_unclassified_terms(rejections: list[dict], limit: int = 30) -> list[dict]:
    stopwords = {
        "the", "a", "an", "and", "or", "to", "of", "for", "in", "on", "with",
        "is", "are", "from", "at", "by", "new", "how", "why", "what", "who",
        "this", "that", "your", "you", "its", "it", "as", "after", "before",
        "today", "live", "latest", "official", "best",
    }
    counts: dict[str, int] = {}
    for item in rejections:
        if item.get("reason") != "no-commercial-taxonomy-match":
            continue
        for token in normalise(item.get("title")).split():
            if len(token) < 3 or token in stopwords or token.isdigit():
                continue
            counts[token] = counts.get(token, 0) + 1
    ranked = sorted(counts.items(), key=lambda pair: (-pair[1], pair[0]))[:limit]
    return [{"term": term, "count": count} for term, count in ranked]


def is_hard_blocked(signal: dict, blocked_terms: list[str]) -> bool:
    text = normalise(f"{signal.get('title', '')} {signal.get('summary', '')}")
    return any(has_term(text, term) for term in blocked_terms)


def signal_strength(signal: dict, match: dict, config: dict) -> tuple[bool, list[str]]:
    evidence = config.get("evidenceRules", {})
    reasons: list[str] = []
    traffic = traffic_value(signal.get("traffic"))
    points = int(signal.get("points") or 0)
    source_id = str(signal.get("sourceId") or "")

    if traffic >= int(evidence.get("strongGoogleTraffic", 5000)):
        reasons.append(f"search traffic {traffic}")
    if points >= int(evidence.get("strongHackerNewsPoints", 80)):
        reasons.append(f"Hacker News points {points}")
    if source_id == "product-hunt" and match.get("titleMatches"):
        reasons.append("precise Product Hunt title match")
    if (
        source_id == "product-hunt"
        and match.get("routeType") == "software"
        and len(match.get("matchedTerms", [])) >= 2
    ):
        reasons.append("commercial Product Hunt software signal")
    if (
        source_id == "hacker-news"
        and match.get("routeType") == "software"
        and points >= int(evidence.get("strongHackerNewsPoints", 80))
    ):
        reasons.append("high-engagement commercial software signal")
    if len(match.get("titleMatches", [])) >= 2:
        reasons.append("multiple precise title matches")
    return bool(reasons), reasons


def commercial_score(signal: dict, match: dict, config: dict, current: datetime) -> dict:
    category = match["category"]
    text = normalise(f"{signal.get('title', '')} {signal.get('summary', '')}")
    score = float(signal.get("sourceWeight", 25))
    score += min(32, len(match["matchedTerms"]) * 12)
    score += min(14, len(match["titleMatches"]) * 7)

    buyer_hits = sum(1 for term in config.get("buyerIntentTerms", []) if has_term(text, term))
    score += min(12, buyer_hits * 3)

    traffic = traffic_value(signal.get("traffic"))
    if traffic:
        score += min(18, max(3, math.log10(max(traffic, 10)) * 3.1))
    points = int(signal.get("points") or 0)
    if points:
        score += min(14, math.log2(max(points, 2)) * 1.6)

    published = signal.get("publishedAt")
    age_hours = 24.0
    if isinstance(published, datetime):
        age_hours = max(0.0, (current - published).total_seconds() / 3600)
    score += max(0.0, 10.0 - min(10.0, age_hours / 7.2))

    if match["productTerms"]:
        score += 6
    direct_products = match.get("directProducts", category.get("directProducts", []))
    if direct_products:
        score += 5
    final = int(max(0, min(98, round(score))))

    momentum = int(max(50, min(98, final + (4 if traffic >= 10000 else 0))))
    buyer_intent = int(
        max(
            45,
            min(
                97,
                56
                + buyer_hits * 6
                + len(match["productTerms"]) * 5
                + len(direct_products) * 5,
            ),
        )
    )
    competition = int(max(42, min(86, 80 - len(match["matchedTerms"]) * 4)))
    content_depth = int(max(62, min(96, 70 + len(match["matchedTerms"]) * 6 + buyer_hits * 2)))
    return {
        "score": final,
        "momentum": momentum,
        "buyerIntent": buyer_intent,
        "competition": competition,
        "contentDepth": content_depth,
    }


def cluster_records(records: list[dict]) -> list[list[dict]]:
    clusters: list[list[dict]] = []
    for record in records:
        placed = False
        for cluster in clusters:
            if record["match"]["category"]["name"] != cluster[0]["match"]["category"]["name"]:
                continue
            if title_similarity(record["signal"]["title"], cluster[0]["signal"]["title"]) >= 0.84:
                cluster.append(record)
                placed = True
                break
        if not placed:
            clusters.append([record])
    return clusters


def unique_strings(items: Iterable[object]) -> list[str]:
    output: list[str] = []
    seen: set[str] = set()
    for item in items:
        value = clean_text(item)
        key = normalise(value)
        if value and key not in seen:
            seen.add(key)
            output.append(value)
    return output


def build_candidate(cluster: list[dict], current: datetime) -> dict:
    primary = max(cluster, key=lambda item: item["metrics"]["score"])
    signal = primary["signal"]
    match = primary["match"]
    category = match["category"]
    metrics = primary["metrics"]
    title = clean_text(signal["title"])
    if title.islower() or title.isupper():
        title = title.title()

    all_sources = []
    strength_reasons: list[str] = []
    all_matched_terms: list[str] = []
    all_product_terms: list[str] = []
    for item in cluster:
        all_sources.append(
            {
                "id": item["signal"].get("sourceId"),
                "label": item["signal"].get("sourceLabel"),
                "url": item["signal"].get("url"),
                "observedAt": (
                    item["signal"]["publishedAt"].isoformat()
                    if isinstance(item["signal"].get("publishedAt"), datetime)
                    else current.isoformat()
                ),
            }
        )
        strength_reasons.extend(item["strengthReasons"])
        all_matched_terms.extend(item["match"]["matchedTerms"])
        all_product_terms.extend(item["match"]["productTerms"])

    distinct_sources = {str(item.get("id")) for item in all_sources if item.get("id")}
    product_terms = unique_strings(all_product_terms)
    matched_terms = unique_strings(all_matched_terms)
    source_label = clean_text(signal.get("sourceLabel"))
    observed = signal.get("publishedAt") if isinstance(signal.get("publishedAt"), datetime) else current
    score = metrics["score"]
    stage = "Emerging" if score < 76 else "Rising" if score < 88 else "Rising fast"
    status_class = "early" if score < 76 else "rising" if score < 88 else "hot"

    direct_products = unique_strings(
        match.get("directProducts", category.get("directProducts", []))
    )
    product_match = None
    if product_terms:
        product_match = {
            "includeTerms": product_terms,
            "preferredCategories": category.get("preferredCategories", []),
            "excludeTerms": category.get("excludeTerms", []),
            "minimumPrice": category.get("minimumPrice"),
            "maximumPrice": category.get("maximumPrice"),
            "minimumMatchedTerms": 1,
        }

    keywords = unique_strings([title, *matched_terms, *product_terms])[:8]
    return {
        "slug": slugify(title),
        "title": title,
        "category": category["name"],
        "icon": category.get("icon", "↗"),
        "stage": stage,
        "statusClass": status_class,
        "score": score,
        "momentum": metrics["momentum"],
        "buyerIntent": metrics["buyerIntent"],
        "competition": metrics["competition"],
        "affiliateCoverage": int(category.get("affiliateCoverage", 60)),
        "contentDepth": metrics["contentDepth"],
        "confidence": "High" if score >= 86 else "Medium-high" if score >= 76 else "Medium",
        "summary": (
            f"Fresh public signals indicate growing attention around {title}. "
            f"The candidate is being held for review before it can appear publicly."
        ),
        "whyNow": (
            f"Detected from {source_label}. It passed strict safety and commercial relevance filters, "
            f"but publication still requires product evidence and explicit approval."
        ),
        "sourceLabel": source_label,
        "sourceUrl": clean_text(signal.get("url")),
        "sourceEvidence": all_sources,
        "corroborationCount": len(distinct_sources),
        "strongSignal": any(item["strong"] for item in cluster),
        "strengthReasons": unique_strings(strength_reasons),
        "observedAt": observed.strftime("%d %B %Y"),
        "discoveredAt": current.isoformat(),
        "keywords": keywords,
        "angles": [
            f"Best {title} options for practical buyers",
            f"What to check before choosing {title}",
            f"{title}: features, price and alternatives",
        ],
        "products": direct_products,
        "networkOpportunities": category.get("networks", ["Admitad"]),
        "monetisationNote": (
            "This candidate remains in review until a clear affiliate route is confirmed "
            "and its slug is explicitly approved. Software-only candidates may require "
            "a direct SaaS programme rather than an AliExpress product."
        ),
        "productMatch": product_match,
        "automatic": True,
        "sourceId": signal.get("sourceId"),
        "reviewStatus": "pending-product-evidence",
        "readyForApproval": False,
        "quality": {
            "matchedTerms": matched_terms,
            "productTerms": product_terms,
            "preciseTitleMatches": unique_strings(primary["match"]["titleMatches"]),
        },
    }


def load_recent_items(path: Path, list_key: str, current: datetime, hours: int) -> list[dict]:
    data = load_json(path, {list_key: []})
    threshold = current - timedelta(hours=hours)
    retained: list[dict] = []
    for item in data.get(list_key, []):
        discovered = parse_date(item.get("discoveredAt", ""))
        if discovered and discovered >= threshold:
            retained.append(item)
    return retained


def merge_candidates(current_candidates: list[dict], previous_candidates: list[dict]) -> list[dict]:
    merged: dict[str, dict] = {}
    for item in previous_candidates:
        slug = clean_text(item.get("slug"))
        if slug:
            merged[slug] = item
    for item in current_candidates:
        slug = clean_text(item.get("slug"))
        if not slug:
            continue
        previous = merged.get(slug, {})
        for key in ("productEvidence", "readyForApproval", "reviewStatus"):
            if key in previous:
                item[key] = previous[key]
        merged[slug] = item
    return list(merged.values())


def main() -> int:
    config = load_json(CONFIG_PATH, {})
    approvals = load_json(
        APPROVALS_PATH,
        {"approvedSlugs": [], "rejectedSlugs": ["traffic-enforcement-camera"]},
    )
    current = now_utc()
    timeout = int(config.get("requestTimeoutSeconds", 35))
    blocked_terms = [normalise(term) for term in config.get("blockedTerms", [])]
    ambiguous_terms = {normalise(term) for term in config.get("ambiguousTerms", [])}
    software_descriptors = config.get("softwareDescriptorTerms", [])
    project_only_terms = config.get("projectOnlyTerms", [])
    active_direct_products = active_affiliate_slugs()

    source_report: list[dict] = []
    raw_signals: list[dict] = []
    for source in config.get("sources", []):
        if not source.get("enabled", True):
            continue
        try:
            if source.get("type") == "hacker_news":
                signals = fetch_hacker_news(source, timeout)
            else:
                payload = http_get(
                    source["url"],
                    timeout,
                    "application/rss+xml,application/atom+xml,application/xml,text/xml,*/*",
                )
                signals = parse_rss(payload, source)
            raw_signals.extend(signals)
            source_report.append({"label": source["label"], "status": "processed", "signals": len(signals)})
        except Exception as exc:
            source_report.append(
                {"label": source["label"], "status": "error", "errorType": type(exc).__name__}
            )

    counters = {
        "rawSignals": len(raw_signals),
        "blockedSignals": 0,
        "nonCommercialSignals": 0,
        "softwareCommercialSignals": 0,
        "ambiguousSignals": 0,
        "lowScoreSignals": 0,
        "insufficientEvidence": 0,
        "unmonetisableSignals": 0,
        "noConfirmedAffiliateRoute": 0,
        "projectOnlyWithoutAffiliateRoute": 0,
        "purgedStaleCandidates": 0,
        "reviewCandidates": 0,
        "readyForApproval": 0,
        "publishedApprovedTrends": 0,
        "approvalHeldForEvidence": 0,
    }

    enriched: list[dict] = []
    rejections: list[dict] = []
    for signal in raw_signals:
        if is_hard_blocked(signal, blocked_terms):
            counters["blockedSignals"] += 1
            rejections.append(rejection_entry(signal, "blocked-sensitive-or-unsafe"))
            continue

        match = category_match(signal, config.get("categories", []), ambiguous_terms)
        if not match:
            match = software_category_match(
                signal,
                config.get("softwareCategories", []),
                software_descriptors,
            )
            if match:
                counters["softwareCommercialSignals"] += 1

        if not match:
            counters["nonCommercialSignals"] += 1
            rejections.append(rejection_entry(signal, "no-commercial-taxonomy-match"))
            continue

        if match["matchQuality"] < int(config.get("minimumMatchQuality", 22)):
            counters["ambiguousSignals"] += 1
            rejections.append(
                rejection_entry(
                    signal,
                    "ambiguous-commercial-match",
                    {"matchQuality": match["matchQuality"]},
                )
            )
            continue

        match = apply_confirmed_route(match, active_direct_products)
        if not match.get("confirmedRoute"):
            counters["unmonetisableSignals"] += 1
            counters["noConfirmedAffiliateRoute"] += 1
            project_only = is_project_only_signal(signal, project_only_terms)
            if project_only:
                counters["projectOnlyWithoutAffiliateRoute"] += 1
            rejections.append(
                rejection_entry(
                    signal,
                    (
                        "project-without-active-affiliate-route"
                        if project_only
                        else "no-confirmed-affiliate-route"
                    ),
                    {
                        "potentialNetworks": match["category"].get("networks", []),
                        "activeDirectProducts": [],
                        "productTerms": match.get("productTerms", []),
                    },
                )
            )
            continue

        metrics = commercial_score(signal, match, config, current)
        if metrics["score"] < int(config.get("minimumReviewScore", 64)):
            counters["lowScoreSignals"] += 1
            rejections.append(
                rejection_entry(
                    signal,
                    "commercial-score-below-review-threshold",
                    {"score": metrics["score"]},
                )
            )
            continue
        strong, reasons = signal_strength(signal, match, config)
        enriched.append(
            {
                "signal": signal,
                "match": match,
                "metrics": metrics,
                "strong": strong,
                "strengthReasons": reasons,
            }
        )

    review_candidates: list[dict] = []
    for cluster in cluster_records(enriched):
        distinct_sources = {
            str(item["signal"].get("sourceId"))
            for item in cluster
            if item["signal"].get("sourceId")
        }
        has_strong = any(item["strong"] for item in cluster)
        minimum_sources = int(config.get("evidenceRules", {}).get("minimumDistinctSources", 2))
        if not has_strong and len(distinct_sources) < minimum_sources:
            counters["insufficientEvidence"] += len(cluster)
            for item in cluster:
                rejections.append(
                    rejection_entry(
                        item["signal"],
                        "insufficient-source-evidence",
                        {
                            "distinctSources": len(distinct_sources),
                            "strongSignal": has_strong,
                        },
                    )
                )
            continue
        review_candidates.append(build_candidate(cluster, current))

    static_titles, static_slugs = static_titles_and_slugs()
    review_candidates = [
        item
        for item in review_candidates
        if item["slug"] not in static_slugs and normalise(item["title"]) not in static_titles
    ]

    previous_review = load_recent_items(
        REVIEW_PATH,
        "reviewQueue",
        current,
        int(config.get("reviewRetentionHours", 168)),
    )
    previous_public = load_recent_items(
        DATA_PATH,
        "trends",
        current,
        int(config.get("publishedRetentionHours", 336)),
    )
    merged = merge_candidates(review_candidates, [*previous_review, *previous_public])

    before_purge = len(merged)
    merged = [
        item
        for item in merged
        if candidate_is_safe(item, blocked_terms)
        and candidate_has_confirmed_route(item, active_direct_products)
    ]
    counters["purgedStaleCandidates"] = before_purge - len(merged)

    approved_slugs = {clean_text(item) for item in approvals.get("approvedSlugs", []) if clean_text(item)}
    rejected_slugs = {clean_text(item) for item in approvals.get("rejectedSlugs", []) if clean_text(item)}
    merged = [item for item in merged if item.get("slug") not in rejected_slugs]

    merged.sort(
        key=lambda item: (
            bool(item.get("readyForApproval")),
            int(item.get("score") or 0),
            item.get("discoveredAt", ""),
        ),
        reverse=True,
    )
    merged = merged[: int(config.get("maxReviewCandidates", 15))]

    published: list[dict] = []
    pending: list[dict] = []
    for item in merged:
        slug = clean_text(item.get("slug"))
        if slug in approved_slugs and item.get("readyForApproval"):
            public_item = copy_json(item)
            public_item["reviewStatus"] = "approved"
            published.append(public_item)
        else:
            if slug in approved_slugs and not item.get("readyForApproval"):
                item["reviewStatus"] = "approval-held-for-evidence"
                counters["approvalHeldForEvidence"] += 1
            pending.append(item)

    published = published[: int(config.get("maxPublishedTrends", 8))]
    counters["reviewCandidates"] = len(pending)
    counters["readyForApproval"] = sum(1 for item in pending if item.get("readyForApproval"))
    counters["publishedApprovedTrends"] = len(published)

    output = {
        "version": config.get("version", "0.6.0"),
        "generatedAt": current.isoformat(),
        "publicationMode": "manual-review",
        "trends": published,
    }
    review_output = {
        "version": config.get("version", "0.6.0"),
        "generatedAt": current.isoformat(),
        "reviewQueue": pending,
        "instructions": (
            "Review candidates here. Only add a ready candidate slug to "
            "config/trend-approvals.json approvedSlugs, then run the workflow again."
        ),
    }
    rejection_output = {
        "version": config.get("version", "0.6.0"),
        "generatedAt": current.isoformat(),
        "samples": rejections[: int(config.get("maxRejectionSamples", 60))],
        "topUnclassifiedTerms": top_unclassified_terms(rejections),
        "note": (
            "This diagnostic file contains public signal titles and rejection reasons only. "
            "It helps improve the taxonomy without publishing weak trends."
        ),
    }
    report = {
        "version": config.get("version", "0.6.0"),
        "generatedAt": current.isoformat(),
        "publicationMode": "manual-review",
        "sources": source_report,
        "counters": counters,
        "note": (
            "New trends are held for review. Sensitive, ambiguous and weakly evidenced signals "
            "are blocked before publication."
        ),
    }

    DATA_PATH.parent.mkdir(parents=True, exist_ok=True)
    JS_PATH.parent.mkdir(parents=True, exist_ok=True)
    DATA_PATH.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
    REVIEW_PATH.write_text(json.dumps(review_output, ensure_ascii=False, indent=2), encoding="utf-8")
    REPORT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    REJECTIONS_PATH.write_text(
        json.dumps(rejection_output, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    JS_PATH.write_text(
        "window.TRENDPILOT_DISCOVERED_TRENDS = "
        + json.dumps(published, ensure_ascii=False, separators=(",", ":"))
        + ";\n"
        + "window.TRENDPILOT_DISCOVERY_META = "
        + json.dumps(
            {
                "generatedAt": current.isoformat(),
                "version": config.get("version", "0.6.0"),
                "publicationMode": "manual-review",
            },
            ensure_ascii=False,
        )
        + ";\n",
        encoding="utf-8",
    )

    print(f"Raw signals: {len(raw_signals)}")
    print(f"Commercial software signals: {counters['softwareCommercialSignals']}")
    print(f"Candidates held for review: {len(pending)}")
    print(f"Ready for approval: {counters['readyForApproval']}")
    print(f"Published approved trends: {len(published)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
