#!/usr/bin/env python3
"""Build TrendPilot's buyer-facing search catalogue.

V12 keeps the existing private feed workflow while making buyer intent strict:

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

MAX_TOTAL = 50_000
MAX_TOKEN_ROUTES = 30_000
MAX_DESCRIPTION = 210
DEFAULT_GROUP_LIMIT = 2_600
GROUP_LIMITS = {
    "apparel": 8_000,
    "footwear": 4_000,
    "bags-accessories": 3_500,
    "jewelry-watches": 2_800,
    "phones-tablets": 3_200,
    "computers": 3_200,
    "home-kitchen": 3_200,
    "beauty-care": 3_000,
}

# Men, women and kids are intentionally not stop words in V12. They are useful
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
    ("t-shirts", ["t-shirt", "t shirt", "tee shirt", "graphic tee"]),
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
    hay = normalise(" ".join([
        clean_text(offer.get("name")), clean_text(offer.get("description")),
        clean_text(offer.get("category")), clean_text(offer.get("brand")),
    ]))
    for family, phrases in FAMILY_RULES:
        if any(has_phrase(hay, phrase) for phrase in phrases):
            if family == "underwear":
                audience = audience_for(offer)
                if audience == "men":
                    return "mens-underwear"
                if audience == "women":
                    return "womens-underwear"
            return family
    meaningful = tokens(f"{offer.get('brand', '')} {offer.get('name', '')}")[:3]
    if meaningful:
        return f"{group}:{'-'.join(meaningful)}"
    return group


def audience_for(offer: dict) -> str:
    primary = normalise(" ".join([
        clean_text(offer.get("name")), clean_text(offer.get("category")),
    ]))
    description = normalise(clean_text(offer.get("description")))
    hay = f"{primary} {description}"
    kids_terms = AUDIENCE_RULES[0][1]
    if any(has_phrase(primary, phrase) for phrase in kids_terms):
        return "kids"
    women = any(has_phrase(hay, phrase) for phrase in dict(AUDIENCE_RULES)["women"])
    men = any(has_phrase(hay, phrase) for phrase in dict(AUDIENCE_RULES)["men"])
    unisex = any(has_phrase(hay, phrase) for phrase in dict(AUDIENCE_RULES)["unisex"])
    if unisex or (women and men):
        return "unisex"
    if women:
        return "women"
    if men:
        return "men"
    return "all"



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
            "version": "12.0.0",
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
    all_records = [record for records in selected_by_group.values() for record in records]
    rare_used = sorted(
        [record for record in all_records if record.get("rareScore", 0) >= 4 and record.get("condition") in {"used", "refurbished", "open-box"}],
        key=lambda item: (item.get("rareScore", 0), item.get("quality", 0)),
        reverse=True,
    )[:120]
    coverage = {
        "version": "12.0.0",
        "generatedAt": generated_at,
        "total": len(all_records),
        "byGroup": dict(Counter(record.get("group", "other") for record in all_records)),
        "byAudience": dict(Counter(record.get("audience", "all") for record in all_records)),
        "topFamilies": dict(Counter(record.get("family", "unknown") for record in all_records).most_common(80)),
        "missing": {
            "image": sum(1 for record in all_records if not record.get("image")),
            "price": sum(1 for record in all_records if not record.get("price")),
            "rating": sum(1 for record in all_records if not record.get("rating")),
            "delivery": sum(1 for record in all_records if not record.get("delivery")),
            "audience": sum(1 for record in all_records if record.get("audience") == "all" and record.get("group") in {"apparel", "footwear"}),
        },
        "rareUsedCount": len(rare_used),
    }
    (OUT_DIR / "coverage-report.json").write_text(json.dumps(coverage, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    manifest = {
        "version": "12.0.0",
        "generatedAt": generated_at,
        "sourceMode": source_mode,
        "productCount": sum(len(records) for records in selected_by_group.values()),
        "sourceOfferCount": len(offers),
        "groups": group_rows,
        "tokenRoutes": token_routes,
        "featured": featured,
        "rareUsed": rare_used,
        "coverageReport": "/data/search-catalog/coverage-report.json",
        "topAdvertisers": dict(advertiser_counts.most_common(16)),
        "topFamilies": dict(family_counts.most_common(24)),
        "searchRules": {
            "strictTextMatch": True,
            "maxGroupsPerQuery": 6,
            "initialResults": 24,
            "maxResults": 90,
            "comparisonLimit": 3,
            "broadCategoryRouting": True,
            "strictAudienceFilters": True,
            "sameFamilyComparison": True,
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
