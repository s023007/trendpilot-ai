#!/usr/bin/env python3
"""Build TrendPilot V13 decision catalogue with strict intent shards.

V13 keeps private feeds private while producing exact-match, paginated decision shards:

* clothing searches contain clothing, not shoes, accessories or unrelated products;
* audience and product-family classification support precise same-type comparison;
* optional delivery, rating, condition and rarity evidence is preserved when feeds provide it;
* a coverage report exposes catalogue gaps without publishing private feed details.

Private feed URLs, commissions and credentials never enter the public output.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
import shutil
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
SHARD_DIR = OUT_DIR / "shards"

MAX_TOTAL = 120_000
SHARD_SIZE = 240
MIN_EXACT_TITLE_SCORE = 1
MAX_TOKEN_ROUTES = 30_000
MAX_DESCRIPTION = 210
DEFAULT_GROUP_LIMIT = 8_000
GROUP_LIMITS = {
    "apparel": 40_000,
    "footwear": 14_000,
    "bags-accessories": 10_000,
    "jewelry-watches": 8_000,
    "phones-tablets": 10_000,
    "computers": 10_000,
    "home-kitchen": 10_000,
    "beauty-care": 8_000,
}

# Men, women and kids are intentionally not stop words in V13. They are useful
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
            r"\bclothing\b", r"\bclothes\b", r"\bapparel\b",
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
        "patterns": [r"\bstroller\b", r"\bpushchair\b", r"\bfeeding bottle\b", r"\bbaby carrier\b", r"\bdiaper(s)?\b", r"\bnapp(y|ies)\b", r"\bcrib\b", r"\bcot\b", r"\bhigh chair\b", r"\bbaby monitor\b"],
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
        "aliases": ["tool", "tools", "drill", "saw", "power tool", "workshop", "repair tools", "hand tools", "test equipment", "oscilloscope", "multimeter", "measurement instrument", "laboratory equipment"],
        "patterns": [r"\bpower tool\b", r"\bdrill\b", r"\bsaw\b", r"\bworkshop\b", r"\btool(s)?\b", r"\bwrench\b", r"\bscrewdriver\b", r"\bplier(s)?\b", r"\bcrimp(ing)?\b", r"\bsocket set\b", r"\btest equipment\b", r"\boscilloscope\b", r"\bmultimeter\b", r"\bmeasurement instrument\b", r"\blaboratory equipment\b", r"\belectronic test(er|ing)?\b"],
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
        "patterns": [r"\bvideo editor\b", r"\bfilmora\b", r"\bcapcut\b", r"\bpdf editor\b", r"\bsoftware\b", r"\bvoice ai\b", r"\bannual plan\b", r"\blifetime plan\b", r"\bsubscription\b", r"\blicen[cs]e key\b", r"\bdigital download\b", r"\btoolkit for (windows|mac)\b"],
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
    ("pet-litter-box", ["litter box", "cat toilet", "self cleaning litter"]),
    ("pet-water-fountain", ["pet fountain", "water fountain", "water dispenser", "cat fountain", "dog fountain"]),
    ("pet-grooming", ["pet grooming", "grooming brush", "pet clipper", "deshedding"]),
    ("pet-toy", ["pet toy", "dog toy", "cat toy", "chew toy"]),
    ("running-shoes", ["running shoe", "jogging shoe", "marathon shoe", "trail running shoe"]),
    ("sneakers", ["sneaker", "trainer", "sports shoe", "casual shoe"]),
    ("boots", ["boot", "ankle boot", "snow boot", "work boot"]),
    ("sandals", ["sandal", "flip flop", "slides"]),
    ("slippers", ["slipper", "house shoe"]),
    ("formal-shoes", ["loafer", "formal shoe", "dress shoe", "oxford shoe", "derby shoe", "heel"]),
    ("t-shirts", ["t-shirt", "t shirt", "tshirt", "tee", "tee shirt", "crew neck tee", "crewneck tee", "short sleeve tee", "short-sleeve tee", "cotton tee", "graphic tee", "jersey tee"]),
    ("polo-shirts", ["polo shirt", "polo tee"]),
    ("dress-shirts", ["dress shirt", "formal shirt", "business shirt"]),
    ("casual-shirts", ["casual shirt", "button shirt", "button-down shirt", "long sleeve shirt", "short sleeve shirt"]),
    ("tops-blouses", ["blouse", "crop top", "tank top", "camisole", "tunic"]),
    ("hoodies-sweatshirts", ["hoodie", "sweatshirt"]),
    ("jackets", ["jacket", "bomber jacket", "denim jacket", "windbreaker"]),
    ("coats", ["coat", "overcoat", "trench coat", "parka"]),
    ("blazers", ["blazer"]),
    ("sweaters-knitwear", ["sweater", "knitwear", "pullover", "cardigan"]),
    ("jeans", ["jeans", "denim jeans"]),
    ("trousers", ["trousers", "dress pants", "chino", "cargo pants", "pants"]),
    ("shorts", ["shorts", "bermuda shorts"]),
    ("skirts", ["skirt"]),
    ("dresses", ["dress", "gown", "abaya"]),
    ("suits", ["two piece suit", "three piece suit", "business suit", "suit set"]),
    ("activewear", ["activewear", "sportswear", "tracksuit", "leggings", "yoga pants", "gym wear"]),
    ("swimwear", ["swimwear", "swimsuit", "bikini", "swim shorts", "swimming trunks"]),
    ("mens-underwear", ["boxers", "boxer briefs", "mens underwear", "men underwear"]),
    ("womens-underwear", ["lingerie", "bra", "panties", "womens underwear", "women underwear"]),
    ("underwear", ["underwear", "briefs"]),
    ("sleepwear", ["pajama", "pyjama", "sleepwear", "nightdress", "nightgown"]),
    ("socks", ["socks", "ankle socks", "crew socks"]),
    ("bags", ["handbag", "shoulder bag", "tote bag", "backpack", "wallet"]),
    ("watches", ["smart watch", "smartwatch", "wristwatch", "watch"]),
    ("eyewear", ["eyeglasses", "glasses", "sunglasses", "frames"]),
    ("phone-cases", ["phone case", "iphone case", "mobile case", "case for iphone", "case for samsung", "silicone case for iphone"]),
    ("power-banks", ["power bank", "portable battery charger"]),
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
    ("phone-utility-software", ["dr.fone", "mobiletrans", "phone transfer", "phone recovery"]),
]

AUDIENCE_RULES: list[tuple[str, list[str]]] = [
    ("kids", ["kids", "kid", "children", "child", "toddler", "baby", "infant", "girls", "girl", "boys", "boy"]),
    ("women", ["women", "woman", "female", "ladies", "womens"]),
    ("men", ["men", "man", "male", "gentlemen", "mens"]),
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
                "rating": row.get("rating") or row.get("productRating") or row.get("starRating"),
                "reviewCount": row.get("reviewCount", row.get("reviews", row.get("ratingCount"))),
                "soldCount": row.get("soldCount", row.get("orders", row.get("salesCount"))),
                "delivery": row.get("delivery") or row.get("deliveryText") or row.get("shippingTime"),
                "shippingPrice": row.get("shippingPrice", row.get("shippingCost", row.get("deliveryPrice"))),
                "condition": row.get("condition") or row.get("itemCondition"),
                "material": row.get("material") or row.get("fabric") or row.get("materials"),
                "offerType": "product",
            })
    return output




def read_existing_catalog() -> list[dict]:
    """Rehydrate public V11/V12 catalogue files when the private cache is unavailable.

    This makes an installation immediately usable. The next feed refresh will replace
    these records with a full private-cache build.
    """
    manifest_path = OUT_DIR / "manifest.json"
    if not manifest_path.exists():
        return []
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return []
    rows: list[dict] = []
    for group in manifest.get("groups", []):
        file_value = clean_text(group.get("file"))
        if not file_value:
            continue
        local = ROOT / file_value.lstrip("/")
        if not local.exists():
            continue
        try:
            payload = json.loads(local.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        for row in payload.get("products", []):
            if not isinstance(row, dict):
                continue
            rows.append({
                "offerKey": row.get("id") or row.get("url"),
                "canonicalKey": row.get("clusterKey") or row.get("id"),
                "name": row.get("name"),
                "description": row.get("description"),
                "category": row.get("category") or group.get("label"),
                "brand": row.get("brand"),
                "affiliateUrl": row.get("url"),
                "imageUrl": row.get("image"),
                "price": row.get("price"),
                "oldPrice": row.get("oldPrice"),
                "currency": row.get("currency"),
                "advertiser": row.get("advertiser"),
                "qualityScore": row.get("quality"),
                "rating": row.get("rating"),
                "reviewCount": row.get("reviews"),
                "delivery": row.get("delivery"),
                "shippingPrice": row.get("shippingPrice"),
                "condition": row.get("condition"),
                "material": row.get("material"),
                "available": True,
                "offerType": "product",
            })
    return rows

def group_for(offer: dict) -> str:
    name = normalise(offer.get("name"))
    category = normalise(offer.get("category"))
    tags = normalise(" ".join(clean_text(item) for item in offer.get("tags", []) or []))
    description = normalise(offer.get("description"))
    primary = " ".join(part for part in (name, category, tags) if part)

    # Wholesale/private-label offers are a different buyer decision from retail products.
    sourcing_terms = ("private label", "wholesale", "manufacturer", "factory", "supplier", "custom logo", "bulk order", "reseller opportunity", "moq")
    if any(has_phrase(primary, term) for term in sourcing_terms):
        return "business-sourcing"

    software_terms = ("software", "annual plan", "lifetime plan", "subscription", "license key", "licence key", "digital download", "toolkit for windows", "toolkit for mac", "filmora", "dr fone", "mobiletrans")
    hardware_terms = ("laptop", "smartphone", "tablet", "phone case", "charger", "monitor", "keyboard", "mouse", "projector")
    if any(has_phrase(primary, term) for term in software_terms) and not any(has_phrase(name, term) for term in hardware_terms):
        return "software"

    scores: dict[str, float] = {}
    title_required = {"apparel", "footwear", "bags-accessories", "jewelry-watches", "baby-kids", "pet-supplies", "software", "business-sourcing"}
    for group, patterns in COMPILED_PATTERNS.items():
        if group == "other":
            continue
        primary_hits = sum(1 for pattern in patterns if pattern.search(primary))
        secondary_hits = sum(1 for pattern in patterns if pattern.search(description))
        if group in title_required and primary_hits == 0:
            continue
        score = primary_hits * 12 + min(secondary_hits, 3)
        label = normalise(GROUPS[group]["label"])
        if label and label in category:
            score += 6
        if group == "projectors-tv" and any(term in primary for term in ("projector box", "electronics box", "meter panel", "enclosure")):
            score -= 20
        if group == "apparel" and not any(pattern.search(name + " " + category) for pattern in COMPILED_PATTERNS[group]):
            score -= 20
        if score > 0:
            scores[group] = score

    if not scores:
        return "other"

    # Children’s clothing remains apparel, with audience=kids; baby equipment stays baby-kids.
    if "apparel" in scores and "baby-kids" in scores:
        baby_equipment = ("stroller", "pushchair", "feeding bottle", "baby carrier", "diaper", "nappy", "crib", "cot", "high chair")
        if not any(has_phrase(primary, term) for term in baby_equipment):
            scores["apparel"] += 30

    priority = ["business-sourcing", "software", "pet-supplies", "footwear", "apparel", "phones-tablets", "computers", "audio", "cameras", "projectors-tv", "smart-home", "automotive", "printing-3d", "sports-outdoors", "home-kitchen", "tools", "beauty-care", "bags-accessories", "jewelry-watches", "baby-kids", "office-school", "toys-games"]
    return max(scores, key=lambda group: (scores[group], -priority.index(group) if group in priority else -999))



def family_for(offer: dict, group: str) -> str:
    """Classify from title/category first; description cannot force an exact family."""
    primary = normalise(" ".join([
        clean_text(offer.get("name")), clean_text(offer.get("category")),
        clean_text(offer.get("productType")), clean_text(offer.get("subcategory")),
    ]))
    secondary = normalise(" ".join([
        clean_text(offer.get("description")), clean_text(offer.get("brand")),
    ]))
    for family, phrases in FAMILY_RULES:
        if any(has_phrase(primary, phrase) for phrase in phrases):
            if family == "underwear":
                audience = audience_for(offer)
                if audience == "men":
                    return "mens-underwear"
                if audience == "women":
                    return "womens-underwear"
            return family

    # Secondary text may only resolve a family when the title/category already
    # contains a generic product word from the same group. This prevents a word
    # buried in marketing copy from changing the product type.
    generic_primary = {
        "apparel": ("clothing", "apparel", "garment", "wear", "shirt", "top", "bottom"),
        "footwear": ("shoe", "footwear"),
        "phones-tablets": ("phone", "tablet", "mobile"),
        "computers": ("computer", "pc", "device"),
        "audio": ("audio", "sound"),
        "pet-supplies": ("pet", "dog", "cat"),
    }
    if any(has_phrase(primary, term) for term in generic_primary.get(group, ())):
        for family, phrases in FAMILY_RULES:
            if any(has_phrase(secondary, phrase) for phrase in phrases):
                return family

    meaningful = tokens(f"{offer.get('brand', '')} {offer.get('name', '')}")[:4]
    if meaningful:
        return f"{group}:{'-'.join(meaningful)}"
    return group


def audience_for(offer: dict) -> str:
    """Audience is strict and comes from explicit fields/title/category only."""
    explicit = normalise(first_value(offer, "audience", "gender", "targetGender", "ageGroup", "department"))
    primary = normalise(" ".join([
        explicit, clean_text(offer.get("name")), clean_text(offer.get("category")),
        clean_text(offer.get("productType")), clean_text(offer.get("subcategory")),
    ]))
    signals = {
        label: any(has_phrase(primary, phrase) for phrase in phrases)
        for label, phrases in AUDIENCE_RULES
    }
    if signals["kids"]:
        return "kids"
    if signals["unisex"] or (signals["women"] and signals["men"]):
        return "unisex"
    if signals["women"]:
        return "women"
    if signals["men"]:
        return "men"
    return "all"


def cluster_key_for(offer: dict, family: str) -> str:
    """Group obvious size/colour variants without collapsing different models."""
    title = normalise(offer.get("name"))
    title = re.sub(r"\b(?:size|sz)\s*[a-z0-9./-]+\b", " ", title)
    title = re.sub(r"\b(?:xxxs|xxs|xs|s|m|l|xl|xxl|xxxl|small|medium|large)\b", " ", title)
    title = re.sub(r"\b(?:black|white|red|blue|green|pink|purple|yellow|orange|grey|gray|navy|beige|brown|gold|silver)\b", " ", title)
    title = re.sub(r"\b\d+\s*(?:pcs?|pieces?|pack|pairs?)\b", " ", title)
    title = re.sub(r"\b(?:new arrival|hot sale|best seller|free shipping|dropshipping)\b", " ", title)
    title = re.sub(r"\s+", " ", title).strip()
    brand = normalise(offer.get("brand"))
    value = f"{brand}|{family}|{title[:180]}"
    return hashlib.sha1(value.encode("utf-8", errors="ignore")).hexdigest()[:20]

def stable_id(offer: dict) -> str:
    value = clean_text(offer.get("canonicalKey") or offer.get("offerKey") or offer.get("productId") or offer.get("affiliateUrl") or offer.get("name"))
    return hashlib.sha1(value.encode("utf-8", errors="ignore")).hexdigest()[:18]


def number(value: object) -> float | None:
    try:
        result = float(value)
    except (TypeError, ValueError):
        return None
    return result if math.isfinite(result) else None


def first_value(offer: dict, *keys: str) -> object:
    for key in keys:
        value = offer.get(key)
        if value not in (None, "", [], {}):
            return value
    return None


def integer(value: object) -> int | None:
    try:
        return int(float(str(value).replace(",", "").strip()))
    except (TypeError, ValueError):
        return None


def condition_for(offer: dict) -> str:
    raw = normalise(first_value(offer, "condition", "productCondition", "itemCondition", "state"))
    title = normalise(offer.get("name"))
    text = f"{raw} {title}"
    if any(has_phrase(text, term) for term in ("refurbished", "renewed", "remanufactured")):
        return "refurbished"
    if any(has_phrase(text, term) for term in ("pre owned", "pre-owned", "used", "second hand", "second-hand")):
        return "used"
    if any(has_phrase(text, term) for term in ("open box", "open-box")):
        return "open-box"
    return "new" if "new" in raw else ""


def rarity_for(offer: dict, condition: str) -> tuple[int, list[str]]:
    text = normalise(" ".join([clean_text(offer.get("name")), clean_text(offer.get("description")), clean_text(offer.get("category"))]))
    signals = []
    mapping = {
        "rare": "rare", "hard to find": "hard-to-find", "discontinued": "discontinued",
        "vintage": "vintage", "collectible": "collectible", "limited edition": "limited-edition",
        "obsolete": "obsolete", "replacement part": "replacement-part", "industrial": "specialist-tool",
        "antique": "antique", "surplus": "surplus",
    }
    for phrase, label in mapping.items():
        if has_phrase(text, phrase):
            signals.append(label)
    score = len(signals) * 2 + (2 if condition in {"used", "refurbished", "open-box"} else 0)
    return score, signals


def delivery_text_for(offer: dict) -> str:
    direct = clean_text(first_value(offer, "deliveryText", "delivery", "shippingTime", "deliveryTime", "estimatedDelivery"))
    if direct:
        return direct[:80]
    low = integer(first_value(offer, "deliveryMinDays", "minDeliveryDays", "shippingMinDays"))
    high = integer(first_value(offer, "deliveryMaxDays", "maxDeliveryDays", "shippingMaxDays"))
    if low is not None and high is not None:
        return f"{low}-{high} days"
    if high is not None:
        return f"Up to {high} days"
    if low is not None:
        return f"From {low} days"
    return ""


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
        "clusterKey": cluster_key_for(offer, family),
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
    rating = number(first_value(offer, "rating", "productRating", "starRating", "reviewRating"))
    if rating is not None and 0 < rating <= 5:
        record["rating"] = round(rating, 2)
    reviews = integer(first_value(offer, "reviewCount", "reviews", "ratingCount", "feedbackCount"))
    if reviews is not None and reviews >= 0:
        record["reviews"] = reviews
    sold = integer(first_value(offer, "soldCount", "orders", "salesCount"))
    if sold is not None and sold >= 0:
        record["sold"] = sold
    delivery = delivery_text_for(offer)
    if delivery:
        record["delivery"] = delivery
    shipping = number(first_value(offer, "shippingPrice", "shippingCost", "deliveryPrice"))
    if shipping is not None and shipping >= 0:
        record["shippingPrice"] = round(shipping, 2)
    condition = condition_for(offer)
    if condition:
        record["condition"] = condition
    rare_score, rarity_signals = rarity_for(offer, condition)
    if rare_score:
        record["rareScore"] = rare_score
        record["raritySignals"] = rarity_signals
    material = clean_text(first_value(offer, "material", "fabric", "materials"))
    if material:
        record["material"] = material[:80]
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


def record_rank(record: dict) -> tuple:
    return (
        1 if record.get("image") else 0,
        1 if record.get("price") else 0,
        1 if record.get("delivery") else 0,
        1 if record.get("rating") else 0,
        float(record.get("quality", 0)),
        float(record.get("rating", 0)),
        int(record.get("reviews", 0)),
    )


def cluster_public_records(records: list[dict]) -> list[dict]:
    """Collapse obvious variants and expose merchant offers under one product card."""
    clusters: dict[str, list[dict]] = defaultdict(list)
    for record in records:
        clusters[record.get("clusterKey") or record["id"]].append(record)
    output: list[dict] = []
    for key, rows in clusters.items():
        rows = sorted(rows, key=record_rank, reverse=True)
        base = dict(rows[0])
        offers = []
        seen = set()
        for row in rows:
            offer_key = (normalise(row.get("advertiser")), clean_text(row.get("url")), row.get("price"))
            if offer_key in seen:
                continue
            seen.add(offer_key)
            offer = {
                "advertiser": row.get("advertiser"),
                "url": row.get("url"),
            }
            for field in ("price", "oldPrice", "currency", "shippingPrice", "delivery", "condition"):
                if row.get(field) not in (None, ""):
                    offer[field] = row[field]
            offers.append(offer)
            if len(offers) >= 16:
                break
        priced = [row for row in rows if isinstance(row.get("price"), (int, float)) and row.get("price", 0) > 0]
        if priced:
            cheapest = min(priced, key=lambda row: (row.get("price", 0) + row.get("shippingPrice", 0), -row.get("quality", 0)))
            for field in ("price", "oldPrice", "currency", "shippingPrice", "delivery", "advertiser", "url"):
                if cheapest.get(field) not in (None, ""):
                    base[field] = cheapest[field]
        base["offers"] = offers
        base["offerCount"] = len(offers)
        base["storeCount"] = len({normalise(offer.get("advertiser")) for offer in offers if offer.get("advertiser")})
        base["variantCount"] = len(rows)
        output.append(base)
    return output


def segment_token_routes(segments: dict[str, list[dict]]) -> dict[str, list[str]]:
    token_counts: dict[str, Counter] = defaultdict(Counter)
    global_counts = Counter()
    for key, records in segments.items():
        for record in records:
            text = " ".join([
                record.get("name", ""), record.get("brand", ""), record.get("category", ""),
                record.get("family", ""), record.get("audience", ""),
            ])
            for token in tokens(text):
                token_counts[token][key] += 1
                global_counts[token] += 1
    routes = {}
    for token, count in global_counts.most_common(MAX_TOKEN_ROUTES):
        if count < 2:
            continue
        routes[token] = [key for key, _ in token_counts[token].most_common(12)]
    return routes


def build_catalog(offers: list[dict], source_mode: str) -> dict:
    active = load_active_advertisers()
    deduped: dict[str, dict] = {}
    rejected = Counter()
    rejected_by_advertiser: dict[str, Counter] = defaultdict(Counter)
    source_by_advertiser = Counter()

    for offer in offers:
        advertiser_name = clean_text(offer.get("advertiser") or offer.get("network") or "Unknown")
        advertiser = normalise(advertiser_name)
        source_by_advertiser[advertiser_name] += 1
        reason = ""
        if offer.get("offerType", "product") != "product":
            reason = "notProduct"
        elif offer.get("available", True) is False:
            reason = "unavailable"
        else:
            name = clean_text(offer.get("name"))
            url = clean_text(offer.get("affiliateUrl") or offer.get("url") or offer.get("productUrl"))
            if not name or not valid_public_url(url):
                reason = "missingCoreFields"
            elif active and advertiser not in active:
                reason = "inactiveAdvertiser"
        if reason:
            rejected[reason] += 1
            rejected_by_advertiser[advertiser_name][reason] += 1
            continue
        key = clean_text(offer.get("canonicalKey") or offer.get("offerKey") or offer.get("productId") or offer.get("affiliateUrl") or offer.get("url")).lower()
        current = deduped.get(key)
        if current is None or offer_rank(offer) > offer_rank(current):
            deduped[key] = offer

    grouped: dict[str, list[dict]] = defaultdict(list)
    for offer in deduped.values():
        grouped[group_for(offer)].append(offer)

    raw_records: list[dict] = []
    selected_source_counts = Counter()
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
        for row in chosen:
            raw_records.append(public_record(row, group))
            selected_source_counts[clean_text(row.get("advertiser") or row.get("network") or "Unknown")] += 1
        total += len(chosen)

    records = cluster_public_records(raw_records)
    records.sort(key=record_rank, reverse=True)

    # Each product lives in one exact segment. Broad searches merge segments in the browser.
    segments: dict[str, list[dict]] = defaultdict(list)
    for record in records:
        group = record.get("group", "other")
        family = record.get("family", group)
        audience = record.get("audience", "all")
        key = f"{group}|{family}|{audience}"
        segments[key].append(record)

    if OUT_DIR.exists():
        for child in OUT_DIR.iterdir():
            if child.is_dir():
                shutil.rmtree(child)
            elif child.name != ".gitkeep":
                child.unlink()
    SHARD_DIR.mkdir(parents=True, exist_ok=True)

    generated_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    segment_rows = []
    group_counts = Counter()
    family_counts = Counter()
    audience_counts = Counter()
    advertiser_counts = Counter()

    for key, segment_records in sorted(segments.items()):
        group, family, audience = key.split("|", 2)
        segment_records.sort(key=record_rank, reverse=True)
        safe_family = re.sub(r"[^a-z0-9._-]+", "-", family)[:120] or "other"
        safe_audience = re.sub(r"[^a-z0-9._-]+", "-", audience) or "all"
        target_dir = SHARD_DIR / group / safe_family / safe_audience
        target_dir.mkdir(parents=True, exist_ok=True)
        files = []
        for page_number, offset in enumerate(range(0, len(segment_records), SHARD_SIZE), start=1):
            page_records = segment_records[offset:offset + SHARD_SIZE]
            relative = f"/data/search-catalog/shards/{group}/{safe_family}/{safe_audience}/{page_number:03d}.json"
            payload = {
                "version": "13.0.0",
                "generatedAt": generated_at,
                "segment": key,
                "page": page_number,
                "pageSize": SHARD_SIZE,
                "total": len(segment_records),
                "products": page_records,
            }
            (target_dir / f"{page_number:03d}.json").write_text(
                json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n",
                encoding="utf-8",
            )
            files.append(relative)
        segment_rows.append({
            "key": key, "group": group, "family": family, "audience": audience,
            "count": len(segment_records), "pages": len(files), "files": files,
        })
        group_counts[group] += len(segment_records)
        family_counts[family] += len(segment_records)
        audience_counts[audience] += len(segment_records)
        advertiser_counts.update(record.get("advertiser", "Unknown") for record in segment_records)

    group_rows = []
    for group, count in group_counts.most_common():
        meta = GROUPS.get(group, GROUPS["other"])
        top_families = [
            family for family, _ in Counter(
                record.get("family", group) for record in records if record.get("group") == group
            ).most_common(12)
        ]
        group_rows.append({
            "id": group, "label": meta["label"], "count": count,
            "aliases": meta["aliases"], "topFamilies": top_families,
        })

    featured = balanced_public_records(records, 36)
    rare_used = sorted(
        [record for record in records if record.get("rareScore", 0) >= 4 and record.get("condition") in {"used", "refurbished", "open-box"}],
        key=lambda item: (item.get("rareScore", 0), record_rank(item)), reverse=True,
    )[:160]
    deal_candidates = sorted(
        [record for record in records if record.get("oldPrice", 0) > record.get("price", 0) > 0],
        key=lambda item: ((item.get("oldPrice", 0) - item.get("price", 0)) / item.get("oldPrice", 1), record_rank(item)),
        reverse=True,
    )[:200]

    coverage_by_advertiser = {}
    for advertiser, source_count in source_by_advertiser.most_common():
        accepted = selected_source_counts.get(advertiser, 0)
        coverage_by_advertiser[advertiser] = {
            "source": source_count,
            "acceptedBeforeClustering": accepted,
            "acceptanceRate": round(accepted / source_count * 100, 1) if source_count else 0,
            "rejected": dict(rejected_by_advertiser.get(advertiser, {})),
        }

    exact_examples = {
        "mensTshirts": sum(1 for r in records if r.get("group") == "apparel" and r.get("family") == "t-shirts" and r.get("audience") == "men"),
        "womensTshirts": sum(1 for r in records if r.get("group") == "apparel" and r.get("family") == "t-shirts" and r.get("audience") == "women"),
        "kidsTshirts": sum(1 for r in records if r.get("group") == "apparel" and r.get("family") == "t-shirts" and r.get("audience") == "kids"),
        "mensShorts": sum(1 for r in records if r.get("group") == "apparel" and r.get("family") == "shorts" and r.get("audience") == "men"),
    }

    coverage = {
        "version": "13.0.0", "generatedAt": generated_at, "sourceMode": source_mode,
        "sourceOffers": len(offers), "dedupedOffers": len(deduped),
        "acceptedBeforeClustering": len(raw_records), "uniqueProducts": len(records),
        "segments": len(segment_rows), "byGroup": dict(group_counts),
        "byAudience": dict(audience_counts), "topFamilies": dict(family_counts.most_common(120)),
        "exactExamples": exact_examples,
        "missing": {
            "image": sum(1 for r in records if not r.get("image")),
            "price": sum(1 for r in records if not r.get("price")),
            "rating": sum(1 for r in records if not r.get("rating")),
            "reviews": sum(1 for r in records if not r.get("reviews")),
            "delivery": sum(1 for r in records if not r.get("delivery")),
            "shippingPrice": sum(1 for r in records if r.get("shippingPrice") is None),
            "material": sum(1 for r in records if r.get("group") == "apparel" and not r.get("material")),
            "audience": sum(1 for r in records if r.get("audience") == "all" and r.get("group") in {"apparel", "footwear"}),
        },
        "byAdvertiser": coverage_by_advertiser,
        "rejected": dict(rejected), "rareUsedCount": len(rare_used), "dealCandidateCount": len(deal_candidates),
    }
    (OUT_DIR / "coverage-report.json").write_text(
        json.dumps(coverage, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8"
    )

    manifest = {
        "version": "13.0.0", "generatedAt": generated_at, "sourceMode": source_mode,
        "productCount": len(records), "offerCount": len(raw_records), "sourceOfferCount": len(offers),
        "groups": group_rows, "segments": segment_rows,
        "tokenRoutes": segment_token_routes(segments),
        "featured": featured, "rareUsed": rare_used, "dealCandidates": deal_candidates,
        "coverageReport": "/data/search-catalog/coverage-report.json",
        "topAdvertisers": dict(advertiser_counts.most_common(24)),
        "topFamilies": dict(family_counts.most_common(40)),
        "searchRules": {
            "architecture": "exact-segment-shards", "strictTitleFamily": True,
            "strictAudience": True, "descriptionCannotForceFamily": True,
            "pageSize": SHARD_SIZE, "initialResults": 24, "maxResults": None,
            "comparisonLimit": 3, "sameFamilyComparison": True,
            "separateExactAndAlternatives": True, "variantClustering": True,
        },
        "rejected": dict(rejected),
    }
    MANIFEST_PATH.write_text(
        json.dumps(manifest, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8"
    )
    if not records:
        raise RuntimeError("V13 catalogue build produced zero products.")
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
            offers = read_existing_catalog()
            source_mode = "existing-catalog-migration"
    if not offers:
        raise SystemExit("No product source exists. Run source_ingestion.py first or use --allow-fallback with published data.")
    manifest = build_catalog(offers, source_mode)
    print(f"TrendPilot V13 decision catalogue: {manifest['productCount']:,} unique products / {manifest['offerCount']:,} offers")
    print(f"Exact segments: {len(manifest['segments']):,}")
    print(f"Search token routes: {len(manifest['tokenRoutes']):,}")
    print(f"Source mode: {manifest['sourceMode']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
