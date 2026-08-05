#!/usr/bin/env python3
"""Build TrendPilot V13.4 decision catalogue with canonical taxonomy and strict intent shards.

V13.4 keeps private feeds private while producing exact-match, paginated decision shards:

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
    "beauty-care": 14_000,
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
        "aliases": ["beauty", "makeup", "make-up", "cosmetics", "skin care", "skincare", "hair care", "fragrance", "perfume", "nail care", "grooming", "personal care"],
        "patterns": [
            r"\bbeauty\b", r"\bmake[- ]?up\b", r"\bcosmetic(s)?\b",
            r"\blip ?stick(s)?\b", r"\blip ?gloss(es)?\b", r"\blip ?tint(s)?\b", r"\blip ?liner(s)?\b",
            r"\bmascara(s)?\b", r"\beye ?shadow(s)?\b", r"\beye ?liner(s)?\b", r"\beyebrow(s)?\b", r"\bbrow (pencil|gel|powder|pomade)\b",
            r"\bfoundation(s)?\b", r"\bconcealer(s)?\b", r"\bblush(es)?\b", r"\bbronzer(s)?\b", r"\bhighlighter(s)?\b", r"\bcontour(ing)?\b", r"\bface powder\b", r"\bmakeup primer\b",
            r"\bmakeup brush(es)?\b", r"\bcosmetic brush(es)?\b", r"\bmakeup sponge(s)?\b", r"\bbeauty blender(s)?\b", r"\beyelash curler(s)?\b",
            r"\bskin ?care\b", r"\bmoisturi[sz]er(s)?\b", r"\bface serum(s)?\b", r"\bfacial cleanser(s)?\b", r"\bsunscreen(s)?\b", r"\btoner(s)?\b",
            r"\bshampoo(s)?\b", r"\bconditioner(s)?\b", r"\bhair (care|mask|serum|oil|dryer|clipper)\b",
            r"\bperfume(s)?\b", r"\bfragrance(s)?\b", r"\beau de parfum\b", r"\bcologne(s)?\b",
            r"\bnail polish(es)?\b", r"\bgel polish(es)?\b", r"\bmanicure\b", r"\bnail art\b", r"\bnail lamp\b",
            r"\bshaver(s)?\b", r"\btrimmer(s)?\b", r"\bepilator(s)?\b", r"\bhair removal\b", r"\bpersonal care\b"
        ],
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
    ("bags", ["handbag", "shoulder bag", "tote bag", "backpack", "wallet", "makeup bag", "cosmetic bag", "toiletry bag"]),
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


# Canonical V13.4 families.  These are deliberately finite so supplier title
# fragments can never become public filter values.
BEAUTY_FAMILY_RULES: list[tuple[str, list[str]]] = [
    ("makeup-tools", ["makeup brush", "cosmetic brush", "brush set", "makeup sponge", "beauty blender", "powder puff", "eyelash curler", "makeup applicator"]),
    ("brow-makeup", ["eyebrow pencil", "brow pencil", "brow gel", "brow powder", "brow pomade", "eyebrow pen"]),
    ("lip-makeup", ["lipstick", "lip stick", "lip gloss", "lip tint", "lip liner", "liquid lip", "lip stain"]),
    ("eye-makeup", ["mascara", "eyeshadow", "eye shadow", "eyeliner", "eye liner", "false eyelashes", "false lashes", "lash extension", "eye palette"]),
    ("face-makeup", ["foundation", "concealer", "blush", "bronzer", "highlighter", "contour", "face powder", "setting powder", "pressed powder", "loose powder", "makeup primer", "bb cream", "cc cream"]),
    ("makeup-sets", ["makeup set", "cosmetic set", "makeup kit", "makeup palette", "cosmetic palette"]),
    ("hair-care", ["hair care", "shampoo", "conditioner", "hair oil", "hair mask", "hair serum", "hair treatment"]),
    ("skin-care", ["skin care", "skincare", "moisturizer", "moisturiser", "face serum", "facial serum", "skin serum", "facial cleanser", "face cleanser", "face cream", "sunscreen", "sun cream", "toner", "acne treatment", "face mask", "sheet mask", "eye cream"]),
    ("hair-styling-tools", ["hair dryer", "hair straightener", "hair curler", "curling iron", "hair clipper", "hot air brush"]),
    ("fragrance", ["perfume", "fragrance", "eau de parfum", "eau de toilette", "cologne", "body mist"]),
    ("nail-care", ["nail polish", "gel polish", "manicure", "pedicure", "nail art", "nail lamp", "nail drill", "artificial nails", "press on nails"]),
    ("grooming", ["electric shaver", "shaver", "trimmer", "beard trimmer", "epilator", "hair removal", "razor"]),
    ("personal-care", ["personal care", "deodorant", "oral care", "electric toothbrush", "body lotion", "body wash"]),
    ("other-makeup", ["makeup", "make up", "make-up", "cosmetic", "cosmetics"]),
]

APPAREL_FAMILY_RULES: list[tuple[str, list[str]]] = [
    ("dress-shirts", ["dress shirt", "formal shirt", "business shirt", "office shirt", "collared shirt"]),
    ("casual-shirts", ["casual shirt", "button up shirt", "button-up shirt", "button down shirt", "button-down shirt", "long sleeve shirt", "short sleeve shirt"]),
    ("polo-shirts", ["polo shirt", "polo tee"]),
    ("t-shirts", ["t-shirt", "t shirt", "tshirt", "tee shirt", "tee", "graphic tee", "cotton tee", "crew neck tee", "crewneck tee", "short sleeve tee", "jersey tee"]),
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
]


# V13.4 canonical family rules for every searchable department.  A product can
# only expose one of these finite values in filters; supplier title fragments
# never become public product types.
GROUP_FAMILY_RULES: dict[str, list[tuple[str, list[str]]]] = {
    "apparel": APPAREL_FAMILY_RULES,
    "beauty-care": BEAUTY_FAMILY_RULES,
    "footwear": [
        ("running-shoes", ["running shoe", "jogging shoe", "trail running shoe", "marathon shoe"]),
        ("sneakers", ["sneaker", "trainer", "casual shoe", "fashion shoe"]),
        ("sports-shoes", ["football boot", "soccer boot", "basketball shoe", "tennis shoe", "court shoe"]),
        ("work-safety-shoes", ["safety shoe", "work boot", "steel toe", "protective footwear"]),
        ("formal-shoes", ["formal shoe", "dress shoe", "oxford shoe", "derby shoe", "loafer", "high heel", "pump shoe"]),
        ("boots", ["ankle boot", "snow boot", "hiking boot", "boot"]),
        ("sandals", ["sandal", "flip flop", "slides"]),
        ("slippers", ["slipper", "house shoe"]),
        ("kids-shoes", ["kids shoe", "children shoe", "boys shoe", "girls shoe", "baby shoe"]),
    ],
    "bags-accessories": [
        ("backpacks", ["backpack", "rucksack", "school bag"]),
        ("handbags", ["handbag", "shoulder bag", "tote bag", "crossbody bag", "clutch bag"]),
        ("wallets-cardholders", ["wallet", "card holder", "cardholder", "coin purse"]),
        ("luggage", ["suitcase", "luggage", "travel bag", "duffel bag"]),
        ("belts", ["belt", "waist belt"]),
        ("hats-caps", ["baseball cap", "cap", "hat", "beanie"]),
        ("scarves-gloves", ["scarf", "shawl", "glove", "mittens"]),
        ("makeup-bags", ["makeup bag", "cosmetic bag", "toiletry bag", "beauty case"]),
        ("travel-organizers", ["packing cube", "travel organizer", "passport holder", "luggage organizer"]),
    ],
    "jewelry-watches": [
        ("smartwatches", ["smart watch", "smartwatch", "fitness watch"]),
        ("watches", ["wristwatch", "mechanical watch", "quartz watch", "watch"]),
        ("necklaces", ["necklace", "pendant", "chain necklace"]),
        ("bracelets", ["bracelet", "bangle"]),
        ("rings", ["ring", "wedding band"]),
        ("earrings", ["earring", "stud earrings", "hoop earrings"]),
        ("eyewear", ["sunglasses", "eyeglasses", "glasses", "spectacle frame", "optical frame"]),
    ],
    "baby-kids": [
        ("strollers", ["stroller", "pushchair", "pram"]),
        ("baby-carriers", ["baby carrier", "baby sling", "hip seat"]),
        ("baby-feeding", ["feeding bottle", "baby bottle", "breast pump", "baby feeding", "sippy cup"]),
        ("diapers-changing", ["diaper", "nappy", "changing mat", "diaper bag"]),
        ("nursery-sleep", ["crib", "cot", "bassinet", "baby bed", "nursery bedding"]),
        ("baby-monitors", ["baby monitor", "video baby monitor"]),
        ("baby-care", ["baby care", "baby bath", "baby grooming", "bottle warmer", "sterilizer"]),
        ("high-chairs", ["high chair", "feeding chair", "booster seat"]),
    ],
    "pet-supplies": [
        ("pet-feeder", ["pet feeder", "automatic feeder", "cat feeder", "dog feeder", "food dispenser"]),
        ("pet-litter-box", ["litter box", "cat toilet", "self cleaning litter"]),
        ("pet-water-fountain", ["pet fountain", "cat fountain", "dog fountain", "water dispenser"]),
        ("pet-grooming", ["pet grooming", "grooming brush", "pet clipper", "deshedding"]),
        ("pet-toy", ["pet toy", "dog toy", "cat toy", "chew toy"]),
        ("pet-beds", ["pet bed", "dog bed", "cat bed", "pet mat"]),
        ("pet-carriers", ["pet carrier", "cat carrier", "dog carrier", "pet backpack"]),
        ("collars-leashes", ["pet collar", "dog collar", "cat collar", "leash", "harness"]),
        ("aquarium-supplies", ["aquarium", "fish tank", "aquarium filter", "aquarium light"]),
    ],
    "phones-tablets": [
        ("phone-cases", ["phone case", "iphone case", "mobile case", "protective case"]),
        ("screen-protectors", ["screen protector", "tempered glass", "phone film"]),
        ("phone-chargers-cables", ["phone charger", "usb c charger", "lightning cable", "charging cable", "wall charger"]),
        ("power-banks", ["power bank", "portable battery charger", "portable charger"]),
        ("phone-mounts-stands", ["phone holder", "phone mount", "phone stand", "car phone mount"]),
        ("stylus-pens", ["stylus", "tablet pen", "digital pen"]),
        ("tablets", ["tablet", "ipad", "android tablet"]),
        ("smartphones", ["smartphone", "mobile phone", "iphone", "android phone"]),
    ],
    "computers": [
        ("laptops", ["laptop", "notebook computer", "chromebook"]),
        ("desktops", ["desktop computer", "gaming pc", "all in one pc"]),
        ("mini-pcs", ["mini pc", "micro pc"]),
        ("monitors", ["computer monitor", "gaming monitor", "portable monitor"]),
        ("keyboards", ["keyboard", "mechanical keyboard"]),
        ("mice", ["computer mouse", "gaming mouse", "wireless mouse"]),
        ("storage-drives", ["ssd", "hard drive", "external drive", "nvme", "usb flash drive"]),
        ("memory-ram", ["ram memory", "ddr4", "ddr5", "memory module"]),
        ("graphics-cards", ["graphics card", "gpu", "video card"]),
        ("motherboards", ["motherboard", "mainboard"]),
        ("webcams", ["webcam", "web camera"]),
        ("docks-hubs", ["usb hub", "docking station", "laptop dock"]),
        ("networking", ["wifi router", "wireless router", "network switch", "wifi adapter", "mesh wifi"]),
    ],
    "audio": [
        ("earbuds", ["earbud", "tws", "in ear headphone", "earphone"]),
        ("headphones", ["headphone", "headset", "over ear", "on ear"]),
        ("speakers", ["bluetooth speaker", "portable speaker", "smart speaker"]),
        ("soundbars", ["soundbar", "tv speaker bar"]),
        ("microphones", ["microphone", "wireless mic", "lavalier mic", "usb microphone"]),
        ("audio-interfaces", ["audio interface", "sound card", "mixer console", "audio mixer"]),
    ],
    "cameras": [
        ("digital-cameras", ["digital camera", "mirrorless camera", "dslr camera"]),
        ("action-cameras", ["action camera", "sports camera", "body camera"]),
        ("camera-lenses", ["camera lens", "zoom lens", "prime lens"]),
        ("tripods", ["tripod", "monopod"]),
        ("gimbals-stabilizers", ["gimbal", "camera stabilizer"]),
        ("photo-lighting", ["ring light", "photo light", "studio light", "softbox"]),
        ("camera-bags", ["camera bag", "lens bag", "camera backpack"]),
    ],
    "projectors-tv": [
        ("portable-projector", ["portable projector", "mini projector"]),
        ("home-projectors", ["home projector", "cinema projector", "4k projector"]),
        ("televisions", ["smart tv", "television", "led tv", "oled tv"]),
        ("streaming-devices", ["streaming box", "tv box", "media player", "streaming stick"]),
        ("projector-screens", ["projector screen", "projection screen"]),
        ("tv-accessories", ["tv mount", "tv bracket", "remote control for tv", "tv antenna"]),
    ],
    "smart-home": [
        ("security-camera", ["security camera", "ip camera", "cctv", "indoor camera", "outdoor camera"]),
        ("robot-vacuum", ["robot vacuum", "robotic vacuum"]),
        ("smart-lighting", ["smart light", "smart bulb", "led strip", "light strip"]),
        ("smart-plugs", ["smart plug", "wifi socket", "smart outlet"]),
        ("video-doorbells", ["video doorbell", "smart doorbell"]),
        ("smart-locks", ["smart lock", "fingerprint door lock", "keyless lock", "wifi door lock", "smart wifi door lock", "door lock"]),
        ("smart-sensors", ["motion sensor", "door sensor", "temperature sensor", "water leak sensor"]),
        ("smart-home-hubs", ["smart home hub", "zigbee hub", "matter hub", "home automation hub"]),
    ],
    "automotive": [
        ("wireless-carplay-adapter", ["wireless carplay", "carplay adapter", "carplay dongle"]),
        ("car-head-unit", ["head unit", "car radio", "android auto radio", "car stereo", "multimedia player"]),
        ("dash-cams", ["dash cam", "dashboard camera", "car dvr"]),
        ("car-chargers", ["car charger", "vehicle charger"]),
        ("car-diagnostics", ["obd2", "obd scanner", "car diagnostic", "code reader"]),
        ("car-audio", ["car speaker", "car amplifier", "subwoofer for car"]),
        ("car-mounts", ["car phone mount", "dashboard holder", "windshield holder"]),
        ("car-care", ["car vacuum", "car wash", "car cleaning", "polisher", "tire inflator"]),
    ],
    "home-kitchen": [
        ("cookware", ["cookware", "frying pan", "cooking pot", "bakeware"]),
        ("kitchen-appliances", ["air fryer", "blender", "mixer", "food processor", "electric kettle", "toaster"]),
        ("coffee-tea", ["coffee maker", "espresso machine", "coffee grinder", "tea maker"]),
        ("food-storage", ["food container", "lunch box", "vacuum sealer", "kitchen storage"]),
        ("furniture", ["sofa", "chair", "table", "desk", "cabinet", "shelf", "furniture"]),
        ("bedding", ["bed sheet", "duvet", "pillow", "blanket", "mattress", "bedding"]),
        ("curtains-window", ["curtain", "blind", "window shade"]),
        ("home-decor", ["home decor", "wall art", "vase", "decorative lamp", "clock"]),
        ("cleaning", ["cleaning tool", "mop", "vacuum cleaner", "steam cleaner", "cleaning brush"]),
        ("home-lighting", ["ceiling light", "table lamp", "floor lamp", "wall light"]),
        ("bathroom", ["bathroom accessory", "shower head", "towel rack", "bath mat"]),
        ("home-organization", ["storage box", "organizer", "closet storage", "shoe rack"]),
    ],
    "tools": [
        ("drills", ["electric drill", "cordless drill", "impact drill"]),
        ("saws", ["circular saw", "jigsaw", "chain saw", "reciprocating saw", "hand saw"]),
        ("hand-tools", ["screwdriver", "wrench", "plier", "socket set", "hammer", "hand tool"]),
        ("measuring-tools", ["laser measure", "caliper", "level tool", "measuring tape", "distance meter"]),
        ("multimeters", ["multimeter", "clamp meter", "voltage tester"]),
        ("oscilloscopes", ["oscilloscope", "signal generator", "logic analyzer"]),
        ("soldering", ["soldering iron", "soldering station", "hot air station"]),
        ("power-tools", ["angle grinder", "rotary tool", "impact wrench", "power tool"]),
        ("tool-storage", ["tool box", "tool bag", "tool cabinet"]),
        ("safety-equipment", ["safety helmet", "safety glasses", "work gloves", "hearing protection"]),
        ("lab-equipment", ["laboratory equipment", "microscope", "bench power supply", "test equipment"]),
    ],
    "office-school": [
        ("pens-pencils", ["pen", "pencil", "marker", "highlighter pen", "crayon"]),
        ("notebooks-paper", ["notebook", "exercise book", "writing pad", "paper", "sticky note"]),
        ("school-bags", ["school bag", "school backpack", "student backpack", "pencil case"]),
        ("art-supplies", ["art supplies", "paint brush", "watercolor", "acrylic paint", "sketchbook"]),
        ("calculators", ["calculator", "scientific calculator", "graphing calculator"]),
        ("desk-organizers", ["desk organizer", "pen holder", "document tray"]),
        ("printer-supplies", ["printer paper", "ink cartridge", "toner cartridge", "label roll"]),
        ("office-furniture", ["office chair", "office desk", "filing cabinet"]),
        ("filing-labels", ["file folder", "binder", "filing", "label sticker", "laminating pouch"]),
        ("presentation-supplies", ["whiteboard", "presentation board", "projector pointer", "flip chart"]),
        ("learning-aids", ["learning toy", "flash card", "educational chart", "math manipulative"]),
    ],
    "toys-games": [
        ("building-toys", ["building blocks", "construction toy", "brick set"]),
        ("dolls-figures", ["doll", "action figure", "collectible figure"]),
        ("puzzles", ["jigsaw puzzle", "puzzle", "brain teaser"]),
        ("board-games", ["board game", "card game", "chess set"]),
        ("remote-control-toys", ["remote control car", "rc car", "rc drone", "remote control toy"]),
        ("educational-toys", ["educational toy", "stem toy", "science kit", "learning toy"]),
        ("outdoor-toys", ["outdoor toy", "scooter for kids", "play tent", "water toy"]),
        ("gaming-accessories", ["game controller", "gaming accessory", "gaming steering wheel", "controller"]),
        ("game-consoles", ["game console", "handheld console", "retro console"]),
    ],
    "sports-outdoors": [
        ("fitness-equipment", ["exercise bike", "treadmill", "dumbbell", "resistance band", "fitness equipment", "home gym"]),
        ("yoga-pilates", ["yoga mat", "yoga block", "pilates", "yoga equipment"]),
        ("cycling", ["bicycle", "cycling helmet", "bike light", "bike accessory", "cycling"]),
        ("camping", ["camping tent", "sleeping bag", "camping stove", "camping chair"]),
        ("hiking", ["hiking pole", "hiking backpack", "trekking", "hiking gear"]),
        ("fishing", ["fishing rod", "fishing reel", "fishing lure", "fishing tackle"]),
        ("team-sports", ["football", "soccer ball", "basketball", "volleyball", "team sport"]),
        ("racket-sports", ["tennis racket", "badminton racket", "padel racket", "table tennis"]),
        ("water-sports", ["swimming goggles", "snorkel", "paddle board", "kayak accessory"]),
        ("running-gear", ["running belt", "hydration vest", "running accessory", "sports watch"]),
        ("sports-protection", ["knee pad", "elbow pad", "sports helmet", "protective gear"]),
    ],
    "printing-3d": [
        ("3d-filament", ["3d filament", "pla filament", "petg filament", "abs filament", "resin for 3d printer", "pla", "petg filament"]),
        ("thermal-printer", ["thermal printer", "label printer", "receipt printer"]),
        ("3d-printers", ["3d printer", "resin printer"]),
        ("office-printers", ["inkjet printer", "laser printer", "office printer"]),
        ("printer-ink-toner", ["ink cartridge", "toner cartridge", "printer ink"]),
        ("labels-paper", ["thermal label", "label roll", "photo paper", "printer paper"]),
        ("printer-parts", ["printer head", "3d printer part", "extruder", "nozzle for 3d printer"]),
    ],
    "software": [
        ("video-editor", ["video editor", "video editing", "filmora", "capcut"]),
        ("photo-design-software", ["photo editor", "graphic design software", "image editor", "design tool"]),
        ("pdf-tools", ["pdf editor", "pdf converter", "pdf software"]),
        ("office-productivity", ["office software", "spreadsheet software", "word processor", "productivity suite"]),
        ("antivirus-security", ["antivirus", "internet security", "malware protection", "security software"]),
        ("backup-recovery", ["backup software", "data recovery", "file recovery", "disk recovery"]),
        ("phone-utility-software", ["dr fone", "dr.fone", "mobiletrans", "phone transfer", "phone recovery"]),
        ("ai-tools", ["ai software", "artificial intelligence tool", "ai assistant", "generative ai"]),
        ("business-software", ["crm software", "accounting software", "project management software", "erp software"]),
        ("education-software", ["education software", "learning software", "language learning", "online course platform"]),
        ("developer-tools", ["developer tool", "code editor", "ide software", "web development software"]),
        ("vpn", ["vpn", "virtual private network"]),
        ("cloud-storage", ["cloud storage", "online backup", "file sync"]),
    ],
    "business-sourcing": [
        ("private-label", ["private label", "white label", "custom brand"]),
        ("wholesale-products", ["wholesale", "bulk order", "reseller opportunity"]),
        ("custom-logo", ["custom logo", "logo printing", "customized product"]),
        ("packaging", ["custom packaging", "packaging box", "product packaging"]),
        ("manufacturing-equipment", ["manufacturing machine", "production line", "industrial machine"]),
        ("samples-prototyping", ["product sample", "prototype", "sample order"]),
        ("raw-materials", ["raw material", "fabric roll", "industrial material", "component supplier"]),
        ("shipping-logistics", ["freight service", "shipping service", "logistics service", "cargo service"]),
        ("supplier-services", ["supplier service", "sourcing agent", "inspection service", "factory audit"]),
    ],
}

# Every generated family alias is published in the manifest so the browser can
# understand future product phrases without hard-coding a second taxonomy.
FAMILY_ALIASES: dict[str, str] = {}
for _group, _rules in GROUP_FAMILY_RULES.items():
    for _family, _phrases in _rules:
        for _phrase in _phrases:
            FAMILY_ALIASES[normalise(_phrase) if 'normalise' in globals() else _phrase.lower()] = _family


FAMILY_TAXONOMY: dict[str, dict] = {
    "makeup": {
        "label": "Makeup (all)",
        "members": ["face-makeup", "eye-makeup", "lip-makeup", "brow-makeup", "makeup-tools", "makeup-sets", "other-makeup"],
    },
    "beauty": {
        "label": "Beauty & personal care (all)",
        "members": ["face-makeup", "eye-makeup", "lip-makeup", "brow-makeup", "makeup-tools", "makeup-sets", "other-makeup", "skin-care", "hair-care", "hair-styling-tools", "fragrance", "nail-care", "grooming", "personal-care", "other-beauty-care"],
    },
    "clothing-all": {"label": "Clothing (all)", "members": [family for family, _ in APPAREL_FAMILY_RULES]},
    "electronics-all": {"label": "Electronics (all)", "members": [family for group in ("phones-tablets", "computers", "audio", "cameras", "projectors-tv", "smart-home", "automotive") for family, _ in GROUP_FAMILY_RULES[group]]},
    "school-office-all": {"label": "School & office (all)", "members": [family for family, _ in GROUP_FAMILY_RULES["office-school"]]},
    "sports-all": {"label": "Sports & outdoors (all)", "members": [family for family, _ in GROUP_FAMILY_RULES["sports-outdoors"]]},
    "kids-all": {"label": "Baby, kids & toys (all)", "members": [family for group in ("baby-kids", "toys-games") for family, _ in GROUP_FAMILY_RULES[group]]},
    "software-all": {"label": "Software (all)", "members": [family for family, _ in GROUP_FAMILY_RULES["software"]]},
    "business-all": {"label": "Business sourcing (all)", "members": [family for family, _ in GROUP_FAMILY_RULES["business-sourcing"]]},
}

CANONICAL_FAMILY_LABELS: dict[str, str] = {
    "face-makeup": "Face makeup", "eye-makeup": "Eye makeup", "lip-makeup": "Lip makeup",
    "brow-makeup": "Brow makeup", "makeup-tools": "Makeup tools", "makeup-sets": "Makeup sets",
    "other-makeup": "Other makeup", "skin-care": "Skin care", "hair-care": "Hair care",
    "hair-styling-tools": "Hair styling tools", "fragrance": "Fragrance", "nail-care": "Nail care",
    "grooming": "Grooming", "personal-care": "Personal care", "other-beauty-care": "Other beauty products",
}

# Human labels for all canonical families. Explicit labels above win; the rest
# use clean title casing and remain stable across feed refreshes.
for _rules in GROUP_FAMILY_RULES.values():
    for _family, _phrases in _rules:
        CANONICAL_FAMILY_LABELS.setdefault(_family, _family.replace("-", " ").title())

OTHER_FAMILIES = {group: f"other-{group}" for group in GROUPS if group != "other"}
OTHER_FAMILIES["other"] = "other"

# V13.4.1: every emitted fallback family must have a stable public label.
# The V13.4 validator correctly rejected an unlabelled top-level ``other``
# family when a feed contained a product outside the known departments.
for _group_id, _other_family in OTHER_FAMILIES.items():
    _label = "Other products" if _other_family == "other" else f"Other {GROUPS[_group_id]['label'].lower()} products"
    CANONICAL_FAMILY_LABELS.setdefault(_other_family, _label)

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
    """Rehydrate the current public catalogue when the private cache is absent.

    V13+ stores products in segment shards. Reading those shards lets a search
    taxonomy hotfix reclassify the full live catalogue immediately, without
    waiting for a network feed download and without exposing feed URLs.
    """
    manifest_path = OUT_DIR / "manifest.json"
    if not manifest_path.exists():
        return []
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return []

    public_rows: list[dict] = []
    seen: set[str] = set()

    def append_row(row: dict, fallback_category: str = "") -> None:
        if not isinstance(row, dict):
            return
        identity = clean_text(row.get("id") or row.get("url") or row.get("name"))
        if not identity or identity in seen:
            return
        seen.add(identity)
        public_rows.append({
            "offerKey": row.get("id") or row.get("url"),
            "canonicalKey": row.get("clusterKey") or row.get("id"),
            "name": row.get("name"),
            "description": row.get("description"),
            "category": row.get("category") or fallback_category,
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
            "gender": row.get("audience"),
            "available": True,
            "offerType": "product",
        })

    segments = manifest.get("segments", [])
    if isinstance(segments, list) and segments:
        for segment in segments:
            if not isinstance(segment, dict):
                continue
            fallback = clean_text(segment.get("family") or segment.get("group"))
            for file_value in segment.get("files", []) or []:
                local = ROOT / clean_text(file_value).lstrip("/")
                if not local.exists():
                    continue
                try:
                    payload = json.loads(local.read_text(encoding="utf-8"))
                except (OSError, json.JSONDecodeError):
                    continue
                for row in payload.get("products", []) or []:
                    append_row(row, fallback)
        return public_rows

    # V11/V12 group-file migration path.
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
        for row in payload.get("products", []) or []:
            append_row(row, clean_text(group.get("label")))
    return public_rows


def group_for(offer: dict) -> str:
    name = normalise(offer.get("name"))
    category = normalise(offer.get("category"))
    tags = normalise(" ".join(clean_text(item) for item in offer.get("tags", []) or []))
    description = normalise(offer.get("description"))
    primary = " ".join(part for part in (name, category, tags) if part)

    sourcing_terms = ("private label", "wholesale", "manufacturer", "factory", "supplier", "custom logo", "bulk order", "reseller opportunity", "moq")
    if any(has_phrase(primary, term) for term in sourcing_terms):
        return "business-sourcing"

    software_terms = ("software", "annual plan", "lifetime plan", "subscription", "license key", "licence key", "digital download", "toolkit for windows", "toolkit for mac", "filmora", "dr fone", "mobiletrans")
    hardware_terms = ("laptop", "smartphone", "tablet", "phone case", "charger", "monitor", "keyboard", "mouse", "projector")
    if any(has_phrase(primary, term) for term in software_terms) and not any(has_phrase(name, term) for term in hardware_terms):
        return "software"

    # Conflict guards: specific purpose beats a generic accessory word.
    # These routes keep school bags, camera bags, pet carriers and baby bags in
    # the department buyers expect, while ordinary handbags remain fashion.
    if any(has_phrase(primary, term) for term in ("school bag", "school backpack", "student backpack", "pencil case", "scientific calculator", "graphing calculator")):
        return "office-school"
    if any(has_phrase(primary, term) for term in ("camera bag", "camera backpack", "lens bag")):
        return "cameras"
    if any(has_phrase(primary, term) for term in ("pet carrier", "cat carrier", "dog carrier", "pet backpack", "pet bed", "dog bed", "cat bed")):
        return "pet-supplies"
    if any(has_phrase(primary, term) for term in ("diaper bag", "baby carrier", "baby monitor", "baby bottle")):
        return "baby-kids"
    if any(has_phrase(primary, term) for term in ("smartwatch", "smart watch", "wristwatch", "mechanical watch", "quartz watch")):
        return "jewelry-watches"
    if any(has_phrase(primary, term) for term in ("smart lock", "wifi door lock", "fingerprint door lock", "keyless lock")):
        return "smart-home"

    # Conflict guards: a lipstick print T-shirt is clothing; a cosmetic bag is
    # a bag. Beauty words cannot steal a clearly named physical product family.
    apparel_terms = ("t-shirt", "t shirt", "tshirt", "tee shirt", "shirt", "hoodie", "jacket", "trousers", "pants", "shorts", "skirt", "blouse", "sweater", "coat", "jeans")
    bag_terms = ("makeup bag", "cosmetic bag", "toiletry bag", "handbag", "backpack", "wallet", "tote bag")
    footwear_terms = ("shoe", "sneaker", "trainer", "boot", "sandal", "slipper")
    beauty_terms = tuple(phrase for _, phrases in BEAUTY_FAMILY_RULES for phrase in phrases) + ("beauty",)
    if any(has_phrase(primary, term) for term in apparel_terms):
        return "apparel"
    if any(has_phrase(primary, term) for term in bag_terms):
        return "bags-accessories"
    if any(has_phrase(primary, term) for term in footwear_terms):
        return "footwear"
    if any(has_phrase(primary, term) for term in beauty_terms):
        return "beauty-care"

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
    if "apparel" in scores and "baby-kids" in scores:
        baby_equipment = ("stroller", "pushchair", "feeding bottle", "baby carrier", "diaper", "nappy", "crib", "cot", "high chair")
        if not any(has_phrase(primary, term) for term in baby_equipment):
            scores["apparel"] += 30

    priority = ["business-sourcing", "software", "pet-supplies", "footwear", "apparel", "beauty-care", "phones-tablets", "computers", "audio", "cameras", "projectors-tv", "smart-home", "automotive", "printing-3d", "sports-outdoors", "home-kitchen", "tools", "bags-accessories", "jewelry-watches", "baby-kids", "office-school", "toys-games"]
    return max(scores, key=lambda group: (scores[group], -priority.index(group) if group in priority else -999))



def family_for(offer: dict, group: str) -> str:
    """Return a finite canonical family from title/category evidence.

    Supplier phrases never become filter values. Description can only support a
    family when the primary fields already name a generic item in that group.
    """
    primary = normalise(" ".join([
        clean_text(offer.get("name")), clean_text(offer.get("category")),
        clean_text(offer.get("productType")), clean_text(offer.get("subcategory")),
    ]))
    secondary = normalise(" ".join([clean_text(offer.get("description")), clean_text(offer.get("brand"))]))

    rules = GROUP_FAMILY_RULES.get(group, FAMILY_RULES)
    for family, phrases in rules:
        if any(has_phrase(primary, phrase) for phrase in phrases):
            if family == "underwear":
                audience = audience_for(offer)
                if audience == "men":
                    return "mens-underwear"
                if audience == "women":
                    return "womens-underwear"
            return family

    generic_primary = {
        group_id: tuple(meta.get("aliases", [])) + (normalise(meta.get("label", "")), "product", "item")
        for group_id, meta in GROUPS.items()
        if group_id != "other"
    }
    if any(has_phrase(primary, term) for term in generic_primary.get(group, ())):
        for family, phrases in rules:
            if any(has_phrase(secondary, phrase) for phrase in phrases):
                return family

    return OTHER_FAMILIES.get(group, "other")


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
                "version": "13.4.1",
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
        "makeupAll": sum(1 for r in records if r.get("family") in FAMILY_TAXONOMY["makeup"]["members"]),
        "laptops": family_counts.get("laptops", 0),
        "schoolSupplies": sum(group_counts.get(g, 0) for g in ("office-school",)),
        "sports": group_counts.get("sports-outdoors", 0),
        "software": group_counts.get("software", 0),
        "business": group_counts.get("business-sourcing", 0),
    }

    scope_groups = {
        "clothing": ("apparel", "footwear", "bags-accessories", "jewelry-watches"),
        "electronics": ("phones-tablets", "computers", "audio", "cameras", "projectors-tv", "smart-home", "automotive"),
        "home": ("home-kitchen", "tools", "smart-home"),
        "school": ("office-school",),
        "sports": ("sports-outdoors",),
        "beauty": ("beauty-care",),
        "kids": ("baby-kids", "toys-games", "apparel", "footwear", "bags-accessories", "office-school"),
        "software": ("software",),
        "business": ("business-sourcing",),
        "pets": ("pet-supplies",),
        "automotive": ("automotive",),
        "tools": ("tools",),
        "toys": ("toys-games",),
        "bags": ("bags-accessories",),
        "jewelry": ("jewelry-watches",),
        "audio": ("audio",),
        "cameras": ("cameras",),
        "phones": ("phones-tablets",),
        "computers": ("computers",),
        "smart-home": ("smart-home",),
        "printing": ("printing-3d",),
    }
    search_coverage = {}
    for scope, scope_group_ids in scope_groups.items():
        scope_records = [r for r in records if r.get("group") in scope_group_ids]
        scope_family_counts = Counter(r.get("family", "other") for r in scope_records)
        search_coverage[scope] = {
            "uniqueProducts": len(scope_records),
            "families": dict(scope_family_counts.most_common(80)),
            "advertisers": sorted({r.get("advertiser", "Unknown") for r in scope_records}),
            "missingImage": sum(1 for r in scope_records if not r.get("image")),
            "missingPrice": sum(1 for r in scope_records if not r.get("price")),
        }

    coverage = {
        "version": "13.4.1", "generatedAt": generated_at, "sourceMode": source_mode,
        "sourceOffers": len(offers), "dedupedOffers": len(deduped),
        "acceptedBeforeClustering": len(raw_records), "uniqueProducts": len(records),
        "segments": len(segment_rows), "byGroup": dict(group_counts),
        "byAudience": dict(audience_counts), "topFamilies": dict(family_counts.most_common(200)),
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
        "searchCoverage": search_coverage,
        "rejected": dict(rejected), "rareUsedCount": len(rare_used), "dealCandidateCount": len(deal_candidates),
    }
    (OUT_DIR / "coverage-report.json").write_text(
        json.dumps(coverage, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8"
    )

    manifest = {
        "version": "13.4.1", "generatedAt": generated_at, "sourceMode": source_mode,
        "productCount": len(records), "offerCount": len(raw_records), "sourceOfferCount": len(offers),
        "groups": group_rows, "segments": segment_rows,
        "familyTaxonomy": FAMILY_TAXONOMY,
        "familyLabels": CANONICAL_FAMILY_LABELS,
        "familyAliases": FAMILY_ALIASES,
        "scopeGroups": {scope: list(groups) for scope, groups in scope_groups.items()},
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
            "canonicalFamiliesOnly": True, "queryCorrection": True, "virtualFamilyExpansion": True,
            "allDepartmentsCanonical": True, "scopeCoverageReport": True, "fallbackFamilyLabelGuard": True,
        },
        "rejected": dict(rejected),
    }
    MANIFEST_PATH.write_text(
        json.dumps(manifest, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8"
    )
    if not records:
        raise RuntimeError("V13.4 catalogue build produced zero products.")
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
    print(f"TrendPilot V13.4.1 decision catalogue: {manifest['productCount']:,} unique products / {manifest['offerCount']:,} offers")
    print(f"Exact segments: {len(manifest['segments']):,}")
    print(f"Search token routes: {len(manifest['tokenRoutes']):,}")
    print(f"Source mode: {manifest['sourceMode']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
