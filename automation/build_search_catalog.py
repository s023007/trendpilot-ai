#!/usr/bin/env python3
"""Build TrendPilot's buyer-facing search catalogue.

V11 keeps the existing private feed workflow, but improves three things that
matter to shoppers:

* broad searches such as "clothing" or "electronics" route to useful groups;
* apparel, accessories, home and electronics are classified more completely;
* every public record carries a stable comparison type, audience and subtype.

Private feed URLs, commissions and credentials never enter the public output.
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

MAX_TOTAL = 44_000
MAX_TOKEN_ROUTES = 30_000
MAX_DESCRIPTION = 210
DEFAULT_GROUP_LIMIT = 2_600
GROUP_LIMITS = {
    "apparel": 4_800,
    "footwear": 3_400,
    "bags-accessories": 3_200,
    "jewelry-watches": 2_800,
    "phones-tablets": 3_200,
    "computers": 3_200,
    "home-kitchen": 3_200,
    "beauty-care": 3_000,
}

# Men, women and kids are intentionally not stop words in V11. They are useful
# buyer filters and were previously discarded.
STOP_WORDS = {
    "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "in",
    "is", "it", "of", "on", "or", "the", "to", "with", "without", "new",
    "original", "official", "latest", "best", "sale", "hot", "free", "2024",
    "2025", "2026", "2027", "pcs", "pc", "piece", "pieces", "set", "kit",
    "black", "white", "red", "blue", "green", "pink", "gold", "silver",
    "size", "sizes", "cm", "mm", "inch", "inches",
}

GROUPS: dict[str, dict] = {
    "footwear": {
        "label": "Shoes & footwear",
        "aliases": ["shoe", "shoes", "footwear", "sneaker", "sneakers", "trainer", "trainers", "boot", "boots", "sandals", "slippers", "heels", "loafer", "loafers", "running shoes"],
        "patterns": [r"\bshoe(s)?\b", r"\bsneaker(s)?\b", r"\btrainer(s)?\b", r"\bboot(s)?\b", r"\bsandal(s)?\b", r"\bslipper(s)?\b", r"\bheel(s)?\b", r"\bloafer(s)?\b", r"\bfootwear\b", r"\bflip[- ]?flop(s)?\b"],
    },
    "apparel": {
        "label": "Clothing & apparel",
        "aliases": ["clothing", "clothes", "apparel", "fashion", "dress", "shirt", "t-shirt", "jacket", "coat", "hoodie", "jeans", "trousers", "pants", "skirt", "shorts", "activewear", "swimwear", "underwear", "lingerie", "kids clothing", "women clothing", "men clothing"],
        "patterns": [
            r"\bclothing\b", r"\bclothes\b", r"\bapparel\b", r"\bfashion\b",
            r"\bdress(es)?\b", r"\bshirt(s)?\b", r"\bt[- ]?shirt(s)?\b",
            r"\bblouse(s)?\b", r"\btop(s)?\b", r"\btunic(s)?\b",
            r"\bjacket(s)?\b", r"\bcoat(s)?\b", r"\bhoodie(s)?\b",
            r"\bsweater(s)?\b", r"\bcardigan(s)?\b", r"\bknitwear\b",
            r"\bjean(s)?\b", r"\bdenim\b", r"\btrouser(s)?\b", r"\bpants?\b",
            r"\bskirt(s)?\b", r"\bshorts?\b", r"\blegging(s)?\b",
            r"\btracksuit(s)?\b", r"\bactivewear\b", r"\bsportswear\b",
            r"\bswimwear\b", r"\bswimsuit(s)?\b", r"\bbikini(s)?\b",
            r"\bunderwear\b", r"\blingerie\b", r"\bbra(s)?\b", r"\bpanties\b",
            r"\bpajama(s)?\b", r"\bpyjama(s)?\b", r"\bsleepwear\b",
            r"\bsuit(s)?\b", r"\bblazer(s)?\b", r"\bvest(s)?\b",
            r"\bcostume(s)?\b", r"\buniform(s)?\b", r"\bromper(s)?\b", r"\bjumpsuit(s)?\b",
        ],
    },
    "bags-accessories": {
        "label": "Bags & fashion accessories",
        "aliases": ["bag", "bags", "handbag", "backpack", "wallet", "belt", "scarf", "hat", "cap", "fashion accessories", "luggage"],
        "patterns": [r"\bbackpack(s)?\b", r"\bhandbag(s)?\b", r"\bshoulder bag(s)?\b", r"\btote bag(s)?\b", r"\bwallet(s)?\b", r"\bbelt(s)?\b", r"\bscarf|scarves\b", r"\bhat(s)?\b", r"\bcap(s)?\b", r"\bluggage\b", r"\bsuitcase(s)?\b", r"\bbag(s)?\b"],
    },
    "jewelry-watches": {
        "label": "Jewelry, watches & eyewear",
        "aliases": ["jewelry", "jewellery", "watch", "watches", "necklace", "bracelet", "ring", "earrings", "sunglasses", "eyeglasses", "glasses"],
        "patterns": [r"\bjewel(l)?ery\b", r"\bwatch(es)?\b", r"\bnecklace(s)?\b", r"\bbracelet(s)?\b", r"\bring(s)?\b", r"\bearring(s)?\b", r"\bsunglasses\b", r"\beyeglasses\b", r"\bglasses\b", r"\bframes?\b"],
    },
    "beauty-care": {
        "label": "Beauty & personal care",
        "aliases": ["beauty", "skin care", "skincare", "hair care", "makeup", "personal care", "nail", "grooming"],
        "patterns": [r"\bbeauty\b", r"\bskin ?care\b", r"\bmake ?up\b", r"\bcosmetic(s)?\b", r"\bhair dryer\b", r"\bhair care\b", r"\bhair clipper\b", r"\bshaver\b", r"\bpersonal care\b", r"\bnail(s)?\b", r"\bmanicure\b", r"\bmassage(r)?\b"],
    },
    "baby-kids": {
        "label": "Baby & kids",
        "aliases": ["baby", "babies", "kids", "children", "toddler", "stroller", "baby care"],
        "patterns": [r"\bbaby\b", r"\binfant\b", r"\btoddler\b", r"\bstroller\b", r"\bpushchair\b", r"\bfeeding bottle\b", r"\bbaby carrier\b", r"\bchildren'?s\b", r"\bkids'?\b"],
    },
    "pet-supplies": {
        "label": "Pet supplies",
        "aliases": ["pet", "pets", "dog", "dogs", "cat", "cats", "puppy", "kitten", "pet feeder", "pet fountain", "pet grooming"],
        "patterns": [r"\bpet(s)?\b", r"\bdog(s)?\b", r"\bcat(s)?\b", r"\bpupp(y|ies)\b", r"\bkitten(s)?\b", r"\baquarium\b"],
    },
    "phones-tablets": {
        "label": "Phones & tablets",
        "aliases": ["phone", "phones", "smartphone", "tablet", "iphone", "android phone", "mobile phone", "phone accessory"],
        "patterns": [r"\bsmartphone\b", r"\bmobile phone\b", r"\biphone\b", r"\btablet\b", r"\bphone case\b", r"\bphone charger\b", r"\bphone\b"],
    },
    "computers": {
        "label": "Computers & accessories",
        "aliases": ["computer", "computers", "laptop", "keyboard", "mouse", "monitor", "ssd", "usb hub", "mini pc", "computer accessory"],
        "patterns": [r"\blaptop\b", r"\bcomputer\b", r"\bmini pc\b", r"\bkeyboard\b", r"\bmouse\b", r"\bmonitor\b", r"\bssd\b", r"\busb hub\b", r"\bgraphics card\b", r"\bmotherboard\b", r"\bwebcam\b"],
    },
    "audio": {
        "label": "Audio & headphones",
        "aliases": ["audio", "headphones", "earbuds", "earphones", "speaker", "microphone", "headset", "tws"],
        "patterns": [r"\bheadphone(s)?\b", r"\bearbud(s)?\b", r"\bearphone(s)?\b", r"\btws\b", r"\bspeaker(s)?\b", r"\bmicrophone\b", r"\bheadset\b", r"\baudio\b"],
    },
    "cameras": {
        "label": "Cameras & video gear",
        "aliases": ["camera", "cameras", "action camera", "webcam", "gimbal", "tripod", "lens", "photo gear"],
        "patterns": [r"\bcamera(s)?\b", r"\bwebcam\b", r"\bgimbal\b", r"\btripod\b", r"\blens(es)?\b", r"\bphotography\b"],
    },
    "projectors-tv": {
        "label": "Projectors, TV & streaming",
        "aliases": ["projector", "projectors", "portable projector", "tv", "television", "streaming box", "tv box"],
        "patterns": [r"\bprojector(s)?\b", r"\btelevision\b", r"\bsmart tv\b", r"\bstreaming box\b", r"\btv box\b"],
    },
    "smart-home": {
        "label": "Smart home & lighting",
        "aliases": ["smart home", "security camera", "robot vacuum", "smart plug", "doorbell", "smart light", "led strip"],
        "patterns": [r"\bsmart home\b", r"\bsecurity camera\b", r"\brobot(ic)? vacuum\b", r"\bsmart plug\b", r"\bvideo doorbell\b", r"\bhome automation\b", r"\bsmart light\b", r"\bled strip\b"],
    },
    "automotive": {
        "label": "Car electronics & accessories",
        "aliases": ["car", "cars", "automotive", "carplay", "android auto", "head unit", "car radio", "dash cam", "car accessory"],
        "patterns": [r"\bcarplay\b", r"\bandroid auto\b", r"\bcar radio\b", r"\bhead unit\b", r"\bdash ?cam\b", r"\bvehicle\b", r"\bautomotive\b", r"\bcar charger\b", r"\bcar accessory\b"],
    },
    "home-kitchen": {
        "label": "Home & kitchen",
        "aliases": ["home", "kitchen", "cookware", "storage", "furniture", "appliance", "home decor", "bedding", "cleaning"],
        "patterns": [r"\bkitchen\b", r"\bcookware\b", r"\bfurniture\b", r"\bhome storage\b", r"\bhome appliance\b", r"\bhousehold\b", r"\bhome decor\b", r"\bbedding\b", r"\bcurtain(s)?\b", r"\bcleaning\b", r"\bair fryer\b", r"\bcoffee maker\b"],
    },
    "tools": {
        "label": "Tools & workshop",
        "aliases": ["tool", "tools", "drill", "saw", "power tool", "workshop", "repair tools", "hand tools"],
        "patterns": [r"\bpower tool\b", r"\bdrill\b", r"\bsaw\b", r"\bworkshop\b", r"\btool(s)?\b", r"\bwrench\b", r"\bscrewdriver\b", r"\bplier(s)?\b", r"\bcrimp(ing)?\b", r"\bsocket set\b"],
    },
    "office-school": {
        "label": "Office, school & stationery",
        "aliases": ["office", "school", "stationery", "pen", "notebook", "desk", "office supplies", "school supplies"],
        "patterns": [r"\boffice supplies\b", r"\bschool supplies\b", r"\bstationery\b", r"\bnotebook\b", r"\bpen(s)?\b", r"\bpencil(s)?\b", r"\bdesk organizer\b", r"\bfiling\b"],
    },
    "toys-games": {
        "label": "Toys & games",
        "aliases": ["toy", "toys", "game", "games", "console", "controller", "puzzle", "gaming"],
        "patterns": [r"\btoy(s)?\b", r"\bgame console\b", r"\bcontroller\b", r"\bpuzzle\b", r"\bboard game\b", r"\bgaming\b"],
    },
    "sports-outdoors": {
        "label": "Sports & outdoors",
        "aliases": ["sport", "sports", "fitness", "gym", "camping", "cycling", "outdoor", "yoga", "hiking"],
        "patterns": [r"\bfitness\b", r"\bgym\b", r"\bcamping\b", r"\bcycling\b", r"\boutdoor\b", r"\bsport(s)?\b", r"\byoga\b", r"\bhiking\b", r"\bfishing\b"],
    },
    "printing-3d": {
        "label": "Printing & 3D printing",
        "aliases": ["printer", "printers", "thermal printer", "3d printer", "filament", "pla", "petg", "label printer"],
        "patterns": [r"\bthermal printer\b", r"\blabel printer\b", r"\b3d print(er|ing)\b", r"\bfilament\b", r"\bpla\b", r"\bpetg\b", r"\bprinter\b"],
    },
    "software": {
        "label": "Software & digital tools",
        "aliases": ["software", "video editor", "filmora", "capcut", "pdf editor", "voice ai", "creator software"],
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
    ("dresses", ["dress", "gown"]),
    ("tops-shirts", ["t-shirt", "t shirt", "shirt", "blouse", "top", "tunic"]),
    ("outerwear", ["jacket", "coat", "blazer", "cardigan", "hoodie"]),
    ("knitwear", ["sweater", "knitwear", "pullover"]),
    ("jeans-trousers", ["jeans", "denim pants", "trousers", "pants"]),
    ("skirts-shorts", ["skirt", "shorts"]),
    ("activewear", ["activewear", "sportswear", "tracksuit", "leggings", "yoga pants"]),
    ("swimwear", ["swimwear", "swimsuit", "bikini", "swim shorts"]),
    ("underwear-lingerie", ["underwear", "lingerie", "bra", "panties", "boxers"]),
    ("sleepwear", ["pajama", "pyjama", "sleepwear", "nightdress"]),
    ("bags", ["handbag", "shoulder bag", "tote bag", "backpack", "wallet"]),
    ("watches", ["smart watch", "smartwatch", "wristwatch", "watch"]),
    ("eyewear", ["eyeglasses", "glasses", "sunglasses", "frames"]),
    ("earbuds", ["earbud", "tws", "in-ear headphone", "earphone"]),
    ("headphones", ["headphone", "headset", "over-ear"]),
    ("speakers", ["bluetooth speaker", "portable speaker", "soundbar"]),
    ("laptops", ["laptop", "notebook computer"]),
    ("tablets", ["tablet", "ipad"]),
    ("smartphones", ["smartphone", "mobile phone", "iphone"]),
    ("monitors", ["computer monitor", "gaming monitor", "portable monitor"]),
    ("portable-projector", ["portable projector", "mini projector", "home projector"]),
    ("security-camera", ["security camera", "ip camera", "cctv", "baby monitor"]),
    ("robot-vacuum", ["robot vacuum", "robotic vacuum"]),
    ("smart-lighting", ["smart light", "led strip", "light strip", "smart bulb"]),
    ("thermal-printer", ["thermal printer", "label printer", "receipt printer"]),
    ("3d-filament", ["filament", "pla", "petg", "abs filament"]),
    ("video-editor", ["video editor", "filmora", "capcut", "video editing"]),
]

AUDIENCE_RULES: list[tuple[str, list[str]]] = [
    ("women", ["women", "woman", "female", "ladies", "girl"]),
    ("men", ["men", "man", "male", "gentlemen", "boy"]),
    ("kids", ["kids", "kid", "children", "child", "toddler", "baby", "infant"]),
    ("unisex", ["unisex"]),
]

BAD_IMAGE_HINTS = (
    "placeholder", "no-image", "no_image", "default-image", "default_image",
    "transparent.gif", "spacer.gif", "pixel.gif", "1x1", "logo-only",
)


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


def has_phrase(haystack: str, phrase: str) -> bool:
    """Match a normalized phrase without treating 'men' as part of 'women' or 'top' as part of 'laptop'."""
    normalized = normalise(phrase)
    if not normalized:
        return False
    expression = re.escape(normalized).replace(r"\ ", r"\s+")
    if normalized[-1:].isalpha() and not normalized.endswith("s"):
        expression += r"(?:s|es)?"
    return re.search(rf"(?<![a-z0-9]){expression}(?![a-z0-9])", haystack) is not None


def valid_public_url(value: object) -> bool:
    try:
        parsed = urlparse(clean_text(value))
    except ValueError:
        return False
    return parsed.scheme in {"http", "https"} and bool(parsed.netloc)


def valid_image_url(value: object) -> bool:
    url = clean_text(value)
    if not valid_public_url(url):
        return False
    lowered = url.lower()
    return not any(hint in lowered for hint in BAD_IMAGE_HINTS)


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
        clean_text(offer.get("name")), clean_text(offer.get("description")),
        clean_text(offer.get("category")), clean_text(offer.get("brand")),
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
        clean_text(offer.get("name")), clean_text(offer.get("description")),
        clean_text(offer.get("category")), clean_text(offer.get("brand")),
    ]))
    for family, phrases in FAMILY_RULES:
        if any(has_phrase(hay, phrase) for phrase in phrases):
            return family
    meaningful = tokens(f"{offer.get('brand', '')} {offer.get('name', '')}")[:3]
    if meaningful:
        return f"{group}:{'-'.join(meaningful)}"
    return group


def audience_for(offer: dict) -> str:
    hay = normalise(" ".join([
        clean_text(offer.get("name")), clean_text(offer.get("description")),
        clean_text(offer.get("category")),
    ]))
    hits = [audience for audience, phrases in AUDIENCE_RULES if any(has_phrase(hay, phrase) for phrase in phrases)]
    if "women" in hits and "men" in hits:
        return "unisex"
    return hits[0] if hits else "all"


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
    family = family_for(offer, group)
    record = {
        "id": stable_id(offer),
        "name": name,
        "url": url,
        "advertiser": advertiser,
        "category": clean_text(offer.get("category")) or GROUPS[group]["label"],
        "group": group,
        "family": family,
        "subtype": family.split(":", 1)[-1].replace("-", " "),
        "audience": audience_for(offer),
        "quality": round(max(0, min(100, quality)), 1),
    }
    if valid_image_url(image):
        record["image"] = image
    if price is not None and price > 0:
        record["price"] = round(price, 2)
        record["currency"] = clean_text(offer.get("currency")) or "USD"
    old_price = number(offer.get("oldPrice"))
    if old_price is not None and price is not None and old_price > price > 0:
        record["oldPrice"] = round(old_price, 2)
    brand = clean_text(offer.get("brand"))
    if brand:
        record["brand"] = brand
    if description:
        record["description"] = description[:MAX_DESCRIPTION]
    return record


def offer_rank(offer: dict) -> tuple:
    quality = number(offer.get("qualityScore")) or number(offer.get("offerQuality")) or number(offer.get("matchScore")) or 0
    image = 1 if valid_image_url(offer.get("imageUrl") or offer.get("image")) else 0
    price = 1 if (number(offer.get("price")) or 0) > 0 else 0
    desc = min(1, len(clean_text(offer.get("description"))) / 100)
    available = 1 if offer.get("available", True) else 0
    return (available, image, price, round(quality, 2), desc)


def balanced_select(rows: Iterable[dict], limit: int, group: str) -> list[dict]:
    """Balance advertisers and comparison families on the first pages."""
    buckets: dict[tuple[str, str], deque] = defaultdict(deque)
    for row in sorted(rows, key=offer_rank, reverse=True):
        advertiser = normalise(row.get("advertiser") or row.get("network") or "unknown")
        family = family_for(row, group)
        buckets[(advertiser, family)].append(row)
    keys = sorted(buckets, key=lambda key: (-len(buckets[key]), key[0], key[1]))
    selected: list[dict] = []
    while len(selected) < limit and keys:
        next_round = []
        for key in keys:
            bucket = buckets[key]
            if bucket and len(selected) < limit:
                selected.append(bucket.popleft())
            if bucket:
                next_round.append(key)
        keys = next_round
    return selected


def compact_token_routes(records_by_group: dict[str, list[dict]]) -> dict[str, list[str]]:
    counts: dict[str, Counter] = defaultdict(Counter)
    global_counts = Counter()
    for group, records in records_by_group.items():
        for record in records:
            text = " ".join([
                record.get("name", ""), record.get("category", ""),
                record.get("brand", ""), record.get("family", ""),
                record.get("audience", ""),
            ])
            for token in tokens(text):
                counts[token][group] += 1
                global_counts[token] += 1
    routes: dict[str, list[str]] = {}
    for token, _ in global_counts.most_common(MAX_TOKEN_ROUTES):
        if global_counts[token] < 2:
            continue
        routes[token] = [group for group, _ in counts[token].most_common(5)]
    return routes


def balanced_public_records(records: list[dict], limit: int) -> list[dict]:
    buckets: dict[tuple[str, str], deque] = defaultdict(deque)
    for record in sorted(records, key=lambda item: item.get("quality", 0), reverse=True):
        key = (normalise(record.get("advertiser")), normalise(record.get("family")))
        buckets[key].append(record)
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
        limit = min(GROUP_LIMITS.get(group, DEFAULT_GROUP_LIMIT), remaining)
        chosen = balanced_select(rows, limit, group)
        selected_by_group[group] = [public_record(row, group) for row in chosen]
        total += len(chosen)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for old in OUT_DIR.glob("*.json"):
        old.unlink()

    generated_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    group_rows = []
    featured: list[dict] = []
    advertiser_counts = Counter()
    family_counts = Counter()
    for group, records in selected_by_group.items():
        filename = f"{group}.json"
        payload = {
            "version": "11.0.0",
            "generatedAt": generated_at,
            "group": group,
            "label": GROUPS[group]["label"],
            "products": records,
        }
        (OUT_DIR / filename).write_text(
            json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n",
            encoding="utf-8",
        )
        family_summary = Counter(record.get("family", group) for record in records)
        group_rows.append({
            "id": group,
            "label": GROUPS[group]["label"],
            "file": f"/data/search-catalog/{filename}",
            "count": len(records),
            "aliases": GROUPS[group]["aliases"],
            "topFamilies": [name for name, _ in family_summary.most_common(8)],
        })
        featured.extend(records[:3])
        advertiser_counts.update(record["advertiser"] for record in records)
        family_counts.update(record.get("family", group) for record in records)

    featured = balanced_public_records(featured, 30)
    token_routes = compact_token_routes(selected_by_group)
    manifest = {
        "version": "11.0.0",
        "generatedAt": generated_at,
        "sourceMode": source_mode,
        "productCount": sum(len(records) for records in selected_by_group.values()),
        "sourceOfferCount": len(offers),
        "groups": group_rows,
        "tokenRoutes": token_routes,
        "featured": featured,
        "topAdvertisers": dict(advertiser_counts.most_common(16)),
        "topFamilies": dict(family_counts.most_common(24)),
        "searchRules": {
            "strictTextMatch": True,
            "maxGroupsPerQuery": 6,
            "initialResults": 24,
            "maxResults": 72,
            "comparisonLimit": 3,
            "broadCategoryRouting": True,
        },
        "rejected": dict(rejected),
    }
    MANIFEST_PATH.write_text(
        json.dumps(manifest, ensure_ascii=False, separators=(",", ":")) + "\n",
        encoding="utf-8",
    )
    return manifest


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
        raise SystemExit("No private offer cache exists. Run source_ingestion.py first, or use --allow-fallback.")
    manifest = build_catalog(offers, source_mode)
    print(f"Buyer search catalogue: {manifest['productCount']:,} products")
    print(f"Catalogue groups: {len(manifest['groups'])}")
    print(f"Search token routes: {len(manifest['tokenRoutes']):,}")
    print(f"Source mode: {manifest['sourceMode']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
