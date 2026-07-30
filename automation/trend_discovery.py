#!/usr/bin/env python3
"""TrendPilot AI v0.5 automatic trend discovery.

Public, no-key sources:
- Google Trends RSS feeds selected in config/trend-discovery.json
- Product Hunt's official RSS feed
- Hacker News' official Firebase API

The engine publishes only commercially relevant and policy-safe signals. It does
not invent trends when sources fail; recent previously discovered signals are
retained for a short configured window.
"""
from __future__ import annotations

import concurrent.futures
import email.utils
import html
import json
import math
import re
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from difflib import SequenceMatcher
from pathlib import Path
from typing import Iterable, Optional

ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = ROOT / "config" / "trend-discovery.json"
DATA_PATH = ROOT / "data" / "discovered-trends.json"
REPORT_PATH = ROOT / "data" / "trend-discovery-report.json"
JS_PATH = ROOT / "js" / "discovered-trends.js"
STATIC_TRENDS_PATH = ROOT / "js" / "trends-data.js"


def now_utc() -> datetime:
    return datetime.now(timezone.utc).replace(microsecond=0)


def clean_text(value: object) -> str:
    value = html.unescape(str(value or ""))
    value = re.sub(r"<[^>]+>", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def normalise(value: object) -> str:
    value = clean_text(value).lower()
    value = re.sub(r"[^a-z0-9+\- ]+", " ", value)
    return re.sub(r"\s+", " ", value).strip()




def has_term(haystack: str, term: str) -> bool:
    haystack = normalise(haystack)
    term = normalise(term)
    if not haystack or not term:
        return False
    return re.search(rf"(?:^| ){re.escape(term)}(?:$| )", haystack) is not None


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", normalise(value)).strip("-")
    return slug[:72] or "discovered-trend"


def local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1].lower()


def parse_date(value: str) -> Optional[datetime]:
    value = clean_text(value)
    if not value:
        return None
    try:
        parsed = email.utils.parsedate_to_datetime(value)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)
    except (TypeError, ValueError, OverflowError):
        pass
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)
    except ValueError:
        return None


def http_get(url: str, timeout: int, accept: str = "*/*") -> bytes:
    request = urllib.request.Request(url, headers={
        "User-Agent": "TrendPilotAI-TrendDiscovery/0.5 (+https://s023007.github.io/trendpilot-ai/)",
        "Accept": accept,
        "Accept-Language": "en-GB,en;q=0.9",
    })
    last_error = None
    for attempt in range(3):
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                return response.read(6_000_000)
        except Exception as exc:  # network errors are recorded in the report
            last_error = exc
            if attempt < 2:
                time.sleep(1.5 * (attempt + 1))
    raise last_error  # type: ignore[misc]


def element_text(element: ET.Element, candidates: Iterable[str]) -> str:
    wanted = {item.lower() for item in candidates}
    for child in element.iter():
        if local_name(child.tag) in wanted and clean_text(child.text):
            return clean_text(child.text)
    return ""


def element_link(element: ET.Element) -> str:
    for child in element.iter():
        if local_name(child.tag) != "link":
            continue
        href = clean_text(child.attrib.get("href"))
        if href:
            return href
        if clean_text(child.text):
            return clean_text(child.text)
    return ""


def parse_rss(payload: bytes, source: dict) -> list[dict]:
    root = ET.fromstring(payload)
    entries = [el for el in root.iter() if local_name(el.tag) in {"item", "entry"}]
    signals = []
    for entry in entries:
        title = element_text(entry, ["title"])
        if not title:
            continue
        summary = element_text(entry, ["description", "summary", "content", "news_item_title"])
        link = element_link(entry) or source["url"]
        published = element_text(entry, ["pubdate", "published", "updated"])
        traffic = element_text(entry, ["approx_traffic", "traffic"])
        signals.append({
            "title": title,
            "summary": summary,
            "url": link,
            "publishedAt": parse_date(published),
            "traffic": traffic,
            "sourceId": source["id"],
            "sourceLabel": source["label"],
            "sourceWeight": float(source.get("weight", 25)),
            "sourceType": "rss",
        })
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

    signals = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        for item in executor.map(load_item, ids):
            if item:
                signals.append(item)
    return signals


def traffic_value(value: str) -> int:
    raw = clean_text(value).upper().replace(",", "")
    match = re.search(r"(\d+(?:\.\d+)?)\s*([KMB]?)", raw)
    if not match:
        return 0
    number = float(match.group(1))
    multiplier = {"": 1, "K": 1_000, "M": 1_000_000, "B": 1_000_000_000}[match.group(2)]
    return int(number * multiplier)


def category_match(signal: dict, categories: list[dict]) -> tuple[Optional[dict], list[str]]:
    haystack = normalise(f"{signal.get('title', '')} {signal.get('summary', '')}")
    best = None
    best_terms: list[str] = []
    for category in categories:
        matched = [term for term in category.get("terms", []) if has_term(haystack, term)]
        if len(matched) > len(best_terms):
            best, best_terms = category, matched
    return best, best_terms


def similar(a: str, b: str) -> bool:
    na, nb = normalise(a), normalise(b)
    if not na or not nb:
        return False
    if na == nb or na in nb or nb in na:
        return True
    return SequenceMatcher(None, na, nb).ratio() >= 0.76


def static_titles_and_slugs() -> tuple[set[str], set[str]]:
    if not STATIC_TRENDS_PATH.exists():
        return set(), set()
    content = STATIC_TRENDS_PATH.read_text(encoding="utf-8", errors="replace")
    return (
        {normalise(item) for item in re.findall(r'"title"\s*:\s*"([^"]+)"', content)},
        set(re.findall(r'"slug"\s*:\s*"([^"]+)"', content)),
    )


def commercial_score(signal: dict, category: dict, matched_terms: list[str], config: dict, current: datetime) -> dict:
    text = normalise(f"{signal.get('title', '')} {signal.get('summary', '')}")
    score = float(signal.get("sourceWeight", 25))
    score += min(28, len(matched_terms) * 11)
    buyer_hits = sum(1 for term in config.get("buyerIntentTerms", []) if has_term(text, term))
    score += min(16, buyer_hits * 4)

    traffic = traffic_value(signal.get("traffic", ""))
    if traffic:
        score += min(18, max(3, math.log10(max(traffic, 10)) * 3.2))
    points = int(signal.get("points") or 0)
    if points:
        score += min(14, math.log2(max(points, 2)) * 1.6)

    published = signal.get("publishedAt")
    age_hours = 24.0
    if isinstance(published, datetime):
        age_hours = max(0, (current - published).total_seconds() / 3600)
    score += max(0, 10 - min(10, age_hours / 7.2))
    score += max(0, (float(category.get("affiliateCoverage", 60)) - 55) / 8)
    final = int(max(0, min(98, round(score))))

    momentum = int(max(55, min(98, final + (4 if traffic >= 10000 else 0))))
    buyer_intent = int(max(52, min(97, 60 + buyer_hits * 7 + len(category.get("directProducts", [])) * 4 + min(12, len(category.get("productTerms", []))))))
    competition = int(max(42, min(82, 78 - len(matched_terms) * 4 + (8 if len(normalise(signal.get("title", "")).split()) <= 2 else 0))))
    content_depth = int(max(65, min(96, 72 + len(matched_terms) * 6 + buyer_hits * 2)))
    return {"score": final, "momentum": momentum, "buyerIntent": buyer_intent, "competition": competition, "contentDepth": content_depth}


def title_case_signal(title: str) -> str:
    title = clean_text(title)
    if title.isupper() or title.islower():
        return title.title()
    return title


def build_trend(signal: dict, category: dict, matched_terms: list[str], metrics: dict, current: datetime) -> dict:
    title = title_case_signal(signal["title"])
    slug = slugify(title)
    score = metrics["score"]
    stage = "Emerging" if score < 72 else "Rising" if score < 86 else "Rising fast"
    status_class = "early" if score < 72 else "rising" if score < 86 else "hot"
    traffic = clean_text(signal.get("traffic"))
    points = int(signal.get("points") or 0)
    evidence = f" Approximate search traffic: {traffic}." if traffic else (f" Hacker News score: {points}." if points else "")
    source_label = clean_text(signal.get("sourceLabel"))
    summary = f"Fresh public signals show growing attention around {title}. TrendPilot retained it because the topic maps to the commercially relevant {category['name']} category."
    why_now = f"Detected automatically from {source_label}.{evidence} The signal passed the commercial-intent, recency and safety filters before publication."
    keywords = []
    for item in [title, *matched_terms, *category.get("productTerms", [])[:4]]:
        item = clean_text(item)
        if item and normalise(item) not in {normalise(x) for x in keywords}:
            keywords.append(item)
    angles = [
        f"Best {title} options for practical buyers",
        f"What to check before choosing {title}",
        f"{title}: price, features and alternatives",
    ]
    product_terms = list(dict.fromkeys(category.get("productTerms", [])))
    product_match = None
    if product_terms:
        product_match = {
            "includeTerms": product_terms,
            "preferredCategories": category.get("preferredCategories", []),
            "excludeTerms": category.get("excludeTerms", []),
            "minimumPrice": category.get("minimumPrice"),
            "maximumPrice": category.get("maximumPrice"),
        }
    observed = signal.get("publishedAt") if isinstance(signal.get("publishedAt"), datetime) else current
    return {
        "slug": slug,
        "title": title,
        "category": category["name"],
        "icon": category.get("icon", "↗"),
        "stage": stage,
        "statusClass": status_class,
        "score": score,
        "momentum": metrics["momentum"],
        "buyerIntent": metrics["buyerIntent"],
        "competition": metrics["competition"],
        "affiliateCoverage": int(category.get("affiliateCoverage", 65)),
        "contentDepth": metrics["contentDepth"],
        "confidence": "High" if score >= 82 else "Medium-high" if score >= 70 else "Medium",
        "summary": summary,
        "whyNow": why_now,
        "sourceLabel": source_label,
        "sourceUrl": clean_text(signal.get("url")),
        "observedAt": observed.strftime("%d %B %Y"),
        "discoveredAt": current.isoformat(),
        "keywords": keywords[:8],
        "angles": angles,
        "products": category.get("directProducts", []),
        "networkOpportunities": category.get("networks", ["Admitad"]),
        "monetisationNote": "TrendPilot first publishes a useful opportunity page, then attaches only approved and relevant affiliate offers.",
        "productMatch": product_match,
        "automatic": True,
        "sourceId": signal.get("sourceId"),
    }


def load_previous(current: datetime, retention_hours: int) -> list[dict]:
    if not DATA_PATH.exists():
        return []
    try:
        data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return []
    retained = []
    threshold = current - timedelta(hours=retention_hours)
    for trend in data.get("trends", []):
        discovered = parse_date(trend.get("discoveredAt", ""))
        if discovered and discovered >= threshold:
            retained.append(trend)
    return retained


def main() -> int:
    config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    current = now_utc()
    timeout = int(config.get("requestTimeoutSeconds", 35))
    blocked = [normalise(term) for term in config.get("blockedTerms", [])]
    source_report = []
    raw_signals: list[dict] = []

    for source in config.get("sources", []):
        if not source.get("enabled", True):
            continue
        try:
            if source.get("type") == "hacker_news":
                signals = fetch_hacker_news(source, timeout)
            else:
                payload = http_get(source["url"], timeout, "application/rss+xml,application/atom+xml,application/xml,text/xml,*/*")
                signals = parse_rss(payload, source)
            raw_signals.extend(signals)
            source_report.append({"label": source["label"], "status": "processed", "signals": len(signals)})
        except Exception as exc:
            source_report.append({"label": source["label"], "status": "error", "errorType": type(exc).__name__})

    static_titles, static_slugs = static_titles_and_slugs()
    candidates = []
    blocked_count = 0
    irrelevant_count = 0
    for signal in raw_signals:
        haystack = normalise(f"{signal.get('title', '')} {signal.get('summary', '')}")
        if any(term and has_term(haystack, term) for term in blocked):
            blocked_count += 1
            continue
        category, matched_terms = category_match(signal, config.get("categories", []))
        if not category or not matched_terms:
            irrelevant_count += 1
            continue
        metrics = commercial_score(signal, category, matched_terms, config, current)
        if metrics["score"] < int(config.get("minimumOpportunityScore", 60)):
            irrelevant_count += 1
            continue
        trend = build_trend(signal, category, matched_terms, metrics, current)
        if trend["slug"] in static_slugs or normalise(trend["title"]) in static_titles:
            continue
        candidates.append(trend)

    candidates.sort(key=lambda t: (t["score"], t["momentum"], t["buyerIntent"]), reverse=True)
    deduped: list[dict] = []
    for trend in candidates:
        duplicate = next((item for item in deduped if similar(item["title"], trend["title"])), None)
        if duplicate:
            # Preserve the stronger signal and mention corroborating sources.
            if trend["score"] > duplicate["score"]:
                deduped.remove(duplicate)
                deduped.append(trend)
            continue
        deduped.append(trend)

    previous = load_previous(current, int(config.get("retentionHours", 72)))
    for trend in previous:
        if trend.get("slug") not in {item.get("slug") for item in deduped}:
            deduped.append(trend)

    deduped.sort(key=lambda t: (t.get("score", 0), t.get("discoveredAt", "")), reverse=True)
    published = deduped[: int(config.get("maxPublishedTrends", 12))]

    output = {"version": config["version"], "generatedAt": current.isoformat(), "trends": published}
    report = {
        "version": config["version"],
        "generatedAt": current.isoformat(),
        "sources": source_report,
        "counters": {
            "rawSignals": len(raw_signals),
            "blockedSignals": blocked_count,
            "nonCommercialSignals": irrelevant_count,
            "publishedTrends": len(published),
            "retainedPreviousTrends": sum(1 for item in published if item.get("discoveredAt") != current.isoformat()),
        },
        "note": "Only public source links and filtered trend metadata are published. No API key is stored in the repository.",
    }
    DATA_PATH.parent.mkdir(parents=True, exist_ok=True)
    JS_PATH.parent.mkdir(parents=True, exist_ok=True)
    DATA_PATH.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
    REPORT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    JS_PATH.write_text(
        "window.TRENDPILOT_DISCOVERED_TRENDS = " + json.dumps(published, ensure_ascii=False, separators=(",", ":")) + ";\n" +
        "window.TRENDPILOT_DISCOVERY_META = " + json.dumps({"generatedAt": current.isoformat(), "version": config["version"]}, ensure_ascii=False) + ";\n",
        encoding="utf-8",
    )
    print(f"Raw signals: {len(raw_signals)}")
    print(f"Published automatic trends: {len(published)}")
    for trend in published:
        print(f"- {trend['title']} ({trend['category']}, {trend['score']})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
