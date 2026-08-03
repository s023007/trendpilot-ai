#!/usr/bin/env python3
"""Build a buyer-facing, category-sharded search catalogue.

The private feed cache is created by automation/source_ingestion.py inside GitHub
Actions. This script converts that private cache into compact public search
shards without exposing feed URLs, commissions, credentials or internal rules.

When the private cache is unavailable (for example during the one-time V8
installer), --allow-fallback builds a small starter catalogue from the already
published matched-products.json file. The next normal Update Products run then
replaces it with the wider catalogue.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
from collections import Counter, defaultdict, deque
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
CACHE_PATH = ROOT / "automation" / "cache" / "offers.jsonl"
FALLBACK_PATH = ROOT / "data" / "matched-products.json"
PROGRAM_STATUS_PATH = ROOT / "config" / "affiliate-program-status.json"
OUT_DIR = ROOT / "data" / "search-catalog"
MANIFEST_PATH = OUT_DIR / "manifest.json"

MAX_TOTAL = 28_000
MAX_PER_GROUP = 2_200
MAX_TOKEN_ROUTES = 22_000
MAX_DESCRIPTION = 180

STOP_WORDS = {
    "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "in",
    "is", "it", "of", "on", "or", "the", "to", "with", "without", "new",
    "original", "official", "latest", "best", "sale", "hot", "free", "2024",
    "2025", "2026", "2027", "pcs", "pc", "piece", "pieces", "set", "kit",
    "black", "white", "red", "blue", "green", "pink", "gold", "silver",
    "size", "sizes", "cm", "mm", "inch", "inches", "men", "women", "kids",
}

GROUPS: dict[str, dict] = {
    "footwear": {
        "label": "Shoes & footwear",
        "aliases": ["shoe", "shoes", "footwear", "sneaker", "sneakers", "trainer", "trainers", "boot", "boots", "sandals", "slippers", "heels", "loafer", "loafers"],
        "patterns": [r"\bshoe(s)?\b", r"\bsneaker(s)?\b", r"\btrainer(s)?\b", r"\bboot(s)?\b", r"\bsandal(s)?\b", r"\bslipper(s)?\b", r"\bheel(s)?\b", r"\bloafer(s)?\b", r"\bfootwear\b"],
    },
    "pet-supplies": {
        "label": "Pet supplies",
        "aliases": ["pet", "pets", "dog", "dogs", "cat", "cats", "puppy", "kitten", "pet feeder", "pet fountain"],
        "patterns": [r"\bpet(s)?\b", r"\bdog(s)?\b", r"\bcat(s)?\b", r"\bpupp(y|ies)\b", r"\bkitten(s)?\b", r"\baquarium\b"],
    },
    "automotive": {
        "label": "Car electronics & accessories",
        "aliases": ["car", "cars", "automotive", "carplay", "android auto", "head unit", "car radio", "dash cam"],
        "patterns": [r"\bcarplay\b", r"\bandroid auto\b", r"\bcar radio\b", r"\bhead unit\b", r"\bdash ?cam\b", r"\bvehicle\b", r"\bautomotive\b", r"\bcar\b"],
    },
    "phones-tablets": {
        "label": "Phones & tablets",
        "aliases": ["phone", "phones", "smartphone", "tablet", "iphone", "android phone", "mobile phone"],
        "patterns": [r"\bsmartphone\b", r"\bmobile phone\b", r"\biphone\b", r"\btablet\b", r"\bphone case\b", r"\bphone\b"],
    },
    "computers": {
        "label": "Computers & accessories",
        "aliases": ["computer", "computers", "laptop", "keyboard", "mouse", "monitor", "ssd", "usb hub"],
        "patterns": [r"\blaptop\b", r"\bcomputer\b", r"\bkeyboard\b", r"\bmouse\b", r"\bmonitor\b", r"\bssd\b", r"\busb hub\b", r"\bgraphics card\b"],
    },
    "audio": {
        "label": "Audio & headphones",
        "aliases": ["audio", "headphones", "earbuds", "speaker", "microphone", "headset"],
        "patterns": [r"\bheadphone(s)?\b", r"\bearbud(s)?\b", r"\bspeaker(s)?\b", r"\bmicrophone\b", r"\bheadset\b", r"\baudio\b"],
    },
    "cameras": {
        "label": "Cameras & video gear",
        "aliases": ["camera", "cameras", "action camera", "webcam", "gimbal", "tripod"],
        "patterns": [r"\bcamera(s)?\b", r"\bwebcam\b", r"\bgimbal\b", r"\btripod\b", r"\blens\b"],
    },
    "projectors-tv": {
        "label": "Projectors & TV",
        "aliases": ["projector", "projectors", "portable projector", "tv", "television", "streaming box"],
        "patterns": [r"\bprojector(s)?\b", r"\btelevision\b", r"\bsmart tv\b", r"\bstreaming box\b", r"\btv box\b"],
    },
    "smart-home": {
        "label": "Smart home",
        "aliases": ["smart home", "security camera", "robot vacuum", "smart plug", "doorbell"],
        "patterns": [r"\bsmart home\b", r"\bsecurity camera\b", r"\brobot vacuum\b", r"\bsmart plug\b", r"\bvideo doorbell\b", r"\bhome automation\b"],
    },
    "home-kitchen": {
        "label": "Home & kitchen",
        "aliases": ["home", "kitchen", "cookware", "storage", "furniture", "appliance"],
        "patterns": [r"\bkitchen\b", r"\bcookware\b", r"\bfurniture\b", r"\bhome storage\b", r"\bhome appliance\b", r"\bhousehold\b"],
    },
    "beauty-care": {
        "label": "Beauty & personal care",
        "aliases": ["beauty", "skin care", "skincare", "hair", "makeup", "personal care"],
        "patterns": [r"\bbeauty\b", r"\bskin ?care\b", r"\bmake ?up\b", r"\bhair dryer\b", r"\bhair clipper\b", r"\bpersonal care\b"],
    },
    "apparel": {
        "label": "Clothing & apparel",
        "aliases": ["clothing", "clothes", "apparel", "dress", "shirt", "jacket", "costume"],
        "patterns": [r"\bclothing\b", r"\bapparel\b", r"\bdress\b", r"\bshirt\b", r"\bjacket\b", r"\bcostume\b", r"\bhoodie\b", r"\btrousers\b", r"\bpants\b"],
    },
    "bags-accessories": {
        "label": "Bags & accessories",
        "aliases": ["bag", "bags", "backpack", "wallet", "watch", "jewelry", "sunglasses"],
        "patterns": [r"\bbackpack\b", r"\bhandbag\b", r"\bwallet\b", r"\bwatch\b", r"\bjewel(l)?ery\b", r"\bsunglasses\b", r"\bbag\b"],
    },
    "tools": {
        "label": "Tools & workshop",
        "aliases": ["tool", "tools", "drill", "saw", "power tool", "workshop"],
        "patterns": [r"\bpower tool\b", r"\bdrill\b", r"\bsaw\b", r"\bworkshop\b", r"\btool(s)?\b", r"\bwrench\b", r"\bscrewdriver\b"],
    },
    "toys-games": {
        "label": "Toys & games",
        "aliases": ["toy", "toys", "game", "games", "console", "controller", "puzzle"],
        "patterns": [r"\btoy(s)?\b", r"\bgame console\b", r"\bcontroller\b", r"\bpuzzle\b", r"\bboard game\b", r"\bgaming\b"],
    },
    "sports-outdoors": {
        "label": "Sports & outdoors",
        "aliases": ["sport", "sports", "fitness", "gym", "camping", "cycling", "outdoor"],
        "patterns": [r"\bfitness\b", r"\bgym\b", r"\bcamping\b", r"\bcycling\b", r"\boutdoor\b", r"\bsport(s)?\b", r"\byoga\b"],
    },
    "printing-3d": {
        "label": "Printing & 3D printing",
        "aliases": ["printer", "printers", "thermal printer", "3d printer", "filament", "pla", "petg"],
        "patterns": [r"\bthermal printer\b", r"\blabel printer\b", r"\b3d print(er|ing)\b", r"\bfilament\b", r"\bpla\b", r"\bpetg\b", r"\bprinter\b"],
    },
    "software": {
        "label": "Software & digital tools",
        "aliases": ["software", "video editor", "filmora", "capcut", "pdf editor", "voice ai"],
        "patterns": [r"\bvideo editor\b", r"\bfilmora\b", r"\bcapcut\b", r"\bpdf editor\b", r"\bsoftware\b", r"\bvoice ai\b"],
    },
    "business-sourcing": {
        "label": "Business sourcing",
        "aliases": ["supplier", "suppliers", "wholesale", "manufacturer", "factory", "private label", "custom logo", "bulk order"],
        "patterns": [r"\bsupplier(s)?\b", r"\bwholesale\b", r"\bmanufacturer\b", r"\bfactory\b", r"\bprivate label\b", r"\bcustom logo\b", r"\bbulk order\b"],
    },
    "other": {
        "label": "More products",
        "aliases": ["other", "more products"],
        "patterns": [],
    },
}

COMPILED_PATTERNS = {
    group: [re.compile(pattern, re.I) for pattern in meta["patterns"]]
    for group, meta in GROUPS.items()
}

FAMILY_RULES: list[tuple[str, list[str]]] = [
    ("wireless-carplay-adapter", ["wireless carplay", "carplay adapter", "carplay dongle"]),
    ("car-head-unit", ["head unit", "car radio", "multimedia player", "android auto radio", "car stereo"]),
    ("pet-feeder", ["pet feeder", "automatic feeder", "food dispenser", "feeding bowl", "cat feeder", "dog feeder"]),
    ("pet-water-fountain", ["pet fountain", "water fountain", "water dispenser", "cat fountain", "dog fountain"]),
    ("pet-grooming", ["pet grooming", "grooming brush", "pet clipper", "deshedding"]),
    ("pet-toy", ["pet toy", "dog toy", "cat toy", "chew toy"]),
    ("sneakers", ["sneaker", "trainer", "running shoe", "sports shoe"]),
    ("boots", ["boot", "ankle boot", "snow boot", "work boot"]),
    ("sandals", ["sandal", "slipper", "flip flop", "slides"]),
    ("formal-shoes", ["loafer", "formal shoe", "dress shoe", "oxford shoe", "heel"]),
    ("thermal-printer", ["thermal printer", "label printer", "receipt printer"]),
    ("portable-projector", ["portable projector", "mini projector", "home projector"]),
    ("video-editor", ["video editor", "filmora", "capcut", "video editing"]),
    ("3d-filament", ["filament", "pla", "petg", "abs filament"]),
    ("earbuds", ["earbud", "tws", "in-ear headphone"]),
    ("headphones", ["headphone", "headset", "over-ear"]),
    ("robot-vacuum", ["robot vacuum", "robotic vacuum"]),
    ("security-camera", ["security camera", "ip camera", "cctv", "baby monitor"]),
]


def clean_text(value: object) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def normalise(value: object) -> str:
    value = clean_text(value).lower()
    value = re.sub(r"[\u2010-\u2015]", "-", value)
    value = re.sub(r"[^a-z0-9+.#%\- ]+", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def tokens(value: object) -> list[str]:
    output: list[str] = []
    for token in normalise(value).split():
        token = token.strip(".-+")
        if len(token) < 2 or token in STOP_WORDS or token.isdigit():
            continue
        if token not in output:
            output.append(token)
    return output


def valid_public_url(value: object) -> bool:
    try:
        parsed = urlparse(clean_text(value))
    except ValueError:
        return False
    return parsed.scheme in {"http", "https"} and bool(parsed.netloc)


def load_active_advertisers() -> set[str]:
    try:
        data = json.loads(PROGRAM_STATUS_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return set()
    active = set()
    for row in data.get("programs", []):
        if row.get("status") == "active" and row.get("public", True) is not False:
            name = normalise(row.get("advertiser") or row.get("name"))
            if name:
                active.add(name)
    return active


def read_private_cache() -> list[dict]:
    if not CACHE_PATH.exists():
        return []
    rows: list[dict] = []
    with CACHE_PATH.open("r", encoding="utf-8", errors="replace") as handle:
        for line in handle:
            try:
                row = json.loads(line)
            except json.JSONDecodeError:
                continue
            if isinstance(row, dict):
                rows.append(row)
    return rows


def read_fallback_matches() -> list[dict]:
    if not FALLBACK_PATH.exists():
        return []
    try:
        data = json.loads(FALLBACK_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return []
    products = data.get("productsByTrend", data if isinstance(data, dict) else {})
    output: list[dict] = []
    if not isinstance(products, dict):
        return output
    for trend_slug, rows in products.items():
        if not isinstance(rows, list):
            continue
        for row in rows:
            if not isinstance(row, dict):
                continue
            output.append({
                "offerKey": row.get("id") or row.get("offerKey") or row.get("canonicalKey"),
                "canonicalKey": row.get("canonicalKey") or row.get("id"),
                "name": row.get("name"),
                "description": row.get("description") or row.get("summary"),
                "category": row.get("category") or row.get("trendCategory") or trend_slug,
                "brand": row.get("brand"),
                "affiliateUrl": row.get("url") or row.get("affiliateUrl"),
                "productUrl": row.get("productUrl"),
                "imageUrl": row.get("image") or row.get("imageUrl"),
                "price": row.get("price"),
                "oldPrice": row.get("oldPrice"),
                "currency": row.get("currency") or "USD",
                "advertiser": row.get("advertiser") or row.get("network") or "Current seller",
                "network": row.get("network"),
                "available": True,
                "qualityScore": row.get("offerQuality") or row.get("qualityScore") or row.get("matchScore") or 70,
                "offerType": "product",
            })
    return output


def group_for(offer: dict) -> str:
    hay = normalise(" ".join([
        clean_text(offer.get("name")),
        clean_text(offer.get("description")),
        clean_text(offer.get("category")),
        clean_text(offer.get("brand")),
        " ".join(clean_text(item) for item in offer.get("tags", []) or []),
    ]))
    for group in GROUPS:
        if group == "other":
            continue
        if any(pattern.search(hay) for pattern in COMPILED_PATTERNS[group]):
            return group
    return "other"


def family_for(offer: dict, group: str) -> str:
    hay = normalise(" ".join([
        clean_text(offer.get("name")),
        clean_text(offer.get("description")),
        clean_text(offer.get("category")),
        clean_text(offer.get("brand")),
    ]))
    for family, phrases in FAMILY_RULES:
        if any(normalise(phrase) in hay for phrase in phrases):
            return family
    meaningful = tokens(f"{offer.get('brand', '')} {offer.get('name', '')}")[:3]
    if meaningful:
        return f"{group}:{'-'.join(meaningful)}"
    return group


def stable_id(offer: dict) -> str:
    value = clean_text(offer.get("canonicalKey") or offer.get("offerKey") or offer.get("productId") or offer.get("affiliateUrl") or offer.get("name"))
    return hashlib.sha1(value.encode("utf-8", errors="ignore")).hexdigest()[:18]


def number(value: object) -> float | None:
    try:
        result = float(value)
    except (TypeError, ValueError):
        return None
    return result if math.isfinite(result) else None


def public_record(offer: dict, group: str) -> dict:
    description = clean_text(offer.get("description"))
    name = clean_text(offer.get("name"))
    advertiser = clean_text(offer.get("advertiser") or offer.get("network") or "Current seller")
    url = clean_text(offer.get("affiliateUrl") or offer.get("url") or offer.get("productUrl"))
    image = clean_text(offer.get("imageUrl") or offer.get("image"))
    price = number(offer.get("price"))
    quality = number(offer.get("qualityScore")) or number(offer.get("offerQuality")) or number(offer.get("matchScore")) or 0
    record = {
        "id": stable_id(offer),
        "name": name,
        "url": url,
        "advertiser": advertiser,
        "category": clean_text(offer.get("category")) or GROUPS[group]["label"],
        "group": group,
        "family": family_for(offer, group),
        "quality": round(max(0, min(100, quality)), 1),
    }
    if valid_public_url(image):
        record["image"] = image
    if price is not None and price > 0:
        record["price"] = round(price, 2)
        record["currency"] = clean_text(offer.get("currency")) or "USD"
    brand = clean_text(offer.get("brand"))
    if brand:
        record["brand"] = brand
    if description:
        record["description"] = description[:MAX_DESCRIPTION]
    return record


def offer_rank(offer: dict) -> tuple:
    quality = number(offer.get("qualityScore")) or number(offer.get("offerQuality")) or number(offer.get("matchScore")) or 0
    image = 1 if valid_public_url(offer.get("imageUrl") or offer.get("image")) else 0
    price = 1 if (number(offer.get("price")) or 0) > 0 else 0
    desc = min(1, len(clean_text(offer.get("description"))) / 80)
    available = 1 if offer.get("available", True) else 0
    return (available, image, price, round(quality, 2), desc)


def balanced_select(rows: Iterable[dict], limit: int) -> list[dict]:
    by_advertiser: dict[str, deque] = defaultdict(deque)
    for row in sorted(rows, key=offer_rank, reverse=True):
        by_advertiser[normalise(row.get("advertiser") or row.get("network") or "unknown")].append(row)
    advertisers = sorted(by_advertiser, key=lambda key: (-len(by_advertiser[key]), key))
    selected: list[dict] = []
    # Weighted round robin: larger catalogues contribute more, but no source can
    # crowd every other source off the first result pages.
    while len(selected) < limit and advertisers:
        next_round = []
        for advertiser in advertisers:
            bucket = by_advertiser[advertiser]
            take = 2 if len(bucket) > 800 else 1
            for _ in range(take):
                if bucket and len(selected) < limit:
                    selected.append(bucket.popleft())
            if bucket:
                next_round.append(advertiser)
        advertisers = next_round
    return selected


def compact_token_routes(records_by_group: dict[str, list[dict]]) -> dict[str, list[str]]:
    counts: dict[str, Counter] = defaultdict(Counter)
    global_counts = Counter()
    for group, records in records_by_group.items():
        for record in records:
            text = " ".join([
                record.get("name", ""), record.get("category", ""),
                record.get("brand", ""), record.get("family", ""),
            ])
            for token in tokens(text):
                counts[token][group] += 1
                global_counts[token] += 1
    routes: dict[str, list[str]] = {}
    for token, _ in global_counts.most_common(MAX_TOKEN_ROUTES):
        if global_counts[token] < 2:
            continue
        routes[token] = [group for group, _ in counts[token].most_common(3)]
    return routes


def build_catalog(offers: list[dict], source_mode: str) -> dict:
    active = load_active_advertisers()
    deduped: dict[str, dict] = {}
    rejected = Counter()
    for offer in offers:
        if offer.get("offerType", "product") != "product":
            rejected["notProduct"] += 1
            continue
        if offer.get("available", True) is False:
            rejected["unavailable"] += 1
            continue
        name = clean_text(offer.get("name"))
        url = clean_text(offer.get("affiliateUrl") or offer.get("url") or offer.get("productUrl"))
        advertiser = normalise(offer.get("advertiser") or offer.get("network"))
        if not name or not valid_public_url(url):
            rejected["missingCoreFields"] += 1
            continue
        if active and advertiser not in active:
            rejected["inactiveAdvertiser"] += 1
            continue
        key = clean_text(offer.get("canonicalKey") or offer.get("offerKey") or url).lower()
        current = deduped.get(key)
        if current is None or offer_rank(offer) > offer_rank(current):
            deduped[key] = offer

    grouped: dict[str, list[dict]] = defaultdict(list)
    for offer in deduped.values():
        grouped[group_for(offer)].append(offer)

    selected_by_group: dict[str, list[dict]] = {}
    total = 0
    for group in GROUPS:
        rows = grouped.get(group, [])
        if not rows:
            continue
        remaining = max(0, MAX_TOTAL - total)
        if remaining == 0:
            break
        limit = min(MAX_PER_GROUP, remaining)
        chosen = balanced_select(rows, limit)
        selected_by_group[group] = [public_record(row, group) for row in chosen]
        total += len(chosen)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for old in OUT_DIR.glob("*.json"):
        old.unlink()

    generated_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    group_rows = []
    featured: list[dict] = []
    advertiser_counts = Counter()
    for group, records in selected_by_group.items():
        filename = f"{group}.json"
        payload = {
            "version": "8.0.0",
            "generatedAt": generated_at,
            "group": group,
            "label": GROUPS[group]["label"],
            "products": records,
        }
        (OUT_DIR / filename).write_text(
            json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n",
            encoding="utf-8",
        )
        group_rows.append({
            "id": group,
            "label": GROUPS[group]["label"],
            "file": f"/data/search-catalog/{filename}",
            "count": len(records),
            "aliases": GROUPS[group]["aliases"],
        })
        featured.extend(records[:2])
        advertiser_counts.update(record["advertiser"] for record in records)

    # Keep the first screen useful before a search, but diversify its sources.
    featured = balanced_public_records(featured, 18)
    token_routes = compact_token_routes(selected_by_group)
    manifest = {
        "version": "8.0.0",
        "generatedAt": generated_at,
        "sourceMode": source_mode,
        "productCount": sum(len(records) for records in selected_by_group.values()),
        "sourceOfferCount": len(offers),
        "groups": group_rows,
        "tokenRoutes": token_routes,
        "featured": featured,
        "topAdvertisers": dict(advertiser_counts.most_common(12)),
        "searchRules": {
            "strictTextMatch": True,
            "maxGroupsPerQuery": 4,
            "maxResults": 30,
            "comparisonLimit": 3,
        },
        "rejected": dict(rejected),
    }
    MANIFEST_PATH.write_text(
        json.dumps(manifest, ensure_ascii=False, separators=(",", ":")) + "\n",
        encoding="utf-8",
    )
    return manifest


def balanced_public_records(records: list[dict], limit: int) -> list[dict]:
    buckets: dict[str, deque] = defaultdict(deque)
    for record in sorted(records, key=lambda item: item.get("quality", 0), reverse=True):
        buckets[normalise(record.get("advertiser"))].append(record)
    keys = list(buckets)
    output = []
    while keys and len(output) < limit:
        next_keys = []
        for key in keys:
            if buckets[key] and len(output) < limit:
                output.append(buckets[key].popleft())
            if buckets[key]:
                next_keys.append(key)
        keys = next_keys
    return output


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--allow-fallback", action="store_true")
    args = parser.parse_args()

    offers = read_private_cache()
    source_mode = "private-feed-cache"
    if not offers and args.allow_fallback:
        offers = read_fallback_matches()
        source_mode = "published-match-fallback"
    if not offers:
        raise SystemExit(
            "No private offer cache exists. Run source_ingestion.py first, or use --allow-fallback."
        )

    manifest = build_catalog(offers, source_mode)
    print(f"Buyer search catalogue: {manifest['productCount']:,} products")
    print(f"Catalogue groups: {len(manifest['groups'])}")
    print(f"Search token routes: {len(manifest['tokenRoutes']):,}")
    print(f"Source mode: {manifest['sourceMode']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
