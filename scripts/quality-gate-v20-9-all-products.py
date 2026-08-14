#!/usr/bin/env python3
from __future__ import annotations

import collections
import json
import re
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT8 = ROOT / "data/v20-8"
OUT9 = ROOT / "data/v20-9"
PRODUCT_DIR = OUT8 / "products"
TERMS_DIR = OUT8 / "terms"
VERSION = "20.9.0"

BLOCKED = {"temu", "joom", "filamentpro", "filamentpro eu cps", "filamentpro-eu-cps"}
STOP = {
    "the","and","for","with","from","this","that","your","our","new","best","sale","hot","price","buy",
    "original","official","wholesale","factory","global","product","products","item","items","pcs","piece","pieces",
    "pack","set","sets","of","to","in","on","by","a","an"
}
PROMO_PREFIX = re.compile(
    r"^\s*(?:\[(?:free\s+shipping|hot\s+sale|new\s+arrival|best\s+seller|factory\s+price)\]\s*|"
    r"(?:free\s+shipping|hot\s+sale|new\s+arrival|best\s+seller|factory\s+price|wholesale\s+price)\s*[:\-–—]?\s*)+",
    re.I,
)
USED = re.compile(r"\b(?:used|refurbished|renewed|pre[-\s]?owned|second[-\s]?hand|open[-\s]?box)\b", re.I)
REPLACEMENT = re.compile(
    r"\b(?:replacement(?:\s+parts?)?|spare\s+parts?|repair\s+parts?|oem\s+part|carbon\s+brush(?:es)?|armature|stator|"
    r"replacement\s+filter|replacement\s+battery|screen\s+replacement|display\s+replacement|charging\s+port|flex\s+cable|"
    r"motherboard\s+replacement|pcb\s+board|gear\s+assembly|cylinder\s+assy|piston\s+ring|carburetor)\b",
    re.I,
)

ALIASES = {
    "smartphones": "phone",
    "laptops": "laptop",
    "smartwatches": "smartwatch",
    "power-banks": "power-bank",
    "fragrance": "perfume",
    "tablets": "tablet",
    "monitors": "monitor",
    "keyboards": "keyboard",
    "mice": "mouse",
    "speakers": "speaker",
    "microphones": "microphone",
    "digital-cameras": "camera",
    "action-cameras": "camera",
    "webcams": "webcam",
    "camera-lenses": "camera-lens",
    "portable-projector": "projector",
    "home-projectors": "projector",
    "office-printers": "printer",
    "thermal-printer": "printer",
    "phone-cases": "phone-accessories",
    "phone-mounts-stands": "phone-accessories",
    "phone-chargers-cables": "phone-accessories",
    "screen-protectors": "phone-accessories",
    "phones-accessories": "phone-accessories",
    "memory-ram": "computer-memory",
    "storage-drives": "computer-storage",
    "graphics-cards": "graphics-card",
    "motherboards": "motherboard",
    "hand-tools": "hand-tools",
    "multimeters": "measuring-tools",
    "measuring-tools": "measuring-tools",
    "drills": "power-tools",
    "saws": "power-tools",
    "robot-vacuum": "vacuum-cleaner",
    "kitchen-appliances": "kitchen-appliances",
    "hair-styling-tools": "hair-care",
    "skin-care": "skincare",
    "face-makeup": "makeup",
    "eye-makeup": "makeup",
    "lip-makeup": "makeup",
    "other-makeup": "makeup",
    "other-beauty-care": "beauty-care",
    "pet-toy": "pet-toys",
    "pet-beds": "pet-beds",
    "collars-leashes": "pet-collars-leashes",
    "pet-feeder": "pet-feeders",
    "pet-water-fountain": "pet-feeders",
    "pet-litter-box": "pet-litter",
    "pet-grooming": "pet-grooming",
    "dolls-figures": "toys-figures",
    "remote-control-toys": "toys-remote-control",
    "other-footwear": "footwear",
    "boots": "footwear",
    "sneakers": "footwear",
    "slippers": "footwear",
    "handbags": "bags",
    "backpacks": "bags",
    "wallets-cardholders": "wallets",
    "hats-caps": "headwear",
    "t-shirts": "shirts-tops",
    "casual-shirts": "shirts-tops",
    "polo-shirts": "shirts-tops",
    "tops-blouses": "shirts-tops",
    "hoodies-sweatshirts": "sweaters-hoodies",
    "sweaters-knitwear": "sweaters-hoodies",
    "jackets": "jackets-coats",
    "coats": "jackets-coats",
    "trousers": "pants-jeans",
    "jeans": "pants-jeans",
}

# Existing specific types that are already meaningful should not be flattened merely for family grouping.
GENERIC_TYPES = {
    "", "unclassified", "product", "other", "consumer-electronics", "wholesale-products", "other-business-sourcing",
    "other-home-kitchen", "other-sports-outdoors", "other-cameras", "other-audio", "other-apparel", "other-phones-tablets",
    "other-computers", "other-software", "other-pet-supplies", "other-automotive", "other-projectors-tv", "other-smart-home",
    "other-beauty-care", "other-tools", "other-toys-games", "other-bags-accessories", "other-printing-3d", "other-jewelry-watches",
}

PART_TYPES = {
    "replacement-parts", "power-tool-parts", "phone-parts", "computer-parts", "automotive-parts", "air-conditioning-parts",
    "printer-parts", "appliance-parts", "chassis-parts"
}
ACCESSORY_TYPES = {
    "phone-accessories", "tablet-accessories", "laptop-accessories", "smartwatch-accessories", "headphone-accessories",
    "camera-accessories", "computer-accessories", "car-accessories", "gaming-accessories", "3d-printing-accessories"
}
MAIN_TYPE_HINTS = {
    "phone", "tablet", "laptop", "desktop-computers", "monitor", "keyboard", "mouse", "speaker", "microphone", "camera",
    "webcam", "camera-lens", "projector", "television", "printer", "router-networking", "computer-storage", "computer-memory",
    "graphics-card", "motherboard", "headphones", "smartwatch", "power-bank", "game-console", "game-controller", "power-tools",
    "hand-tools", "measuring-tools", "3d-printing", "vacuum-cleaner", "fans", "air-conditioning", "climate-appliances",
    "kitchen-appliances", "cookware", "kitchen-tools", "furniture-desks", "furniture-chairs", "furniture", "home-organization",
    "bedding", "curtains-window", "home-decor", "lighting", "cleaning", "pet-food", "pet-beds", "pet-toys", "pet-collars-leashes",
    "pet-feeders", "pet-litter", "pet-grooming", "beauty-care", "skincare", "makeup", "hair-care", "nail-care", "perfume",
    "dresses", "shirts-tops", "sweaters-hoodies", "jackets-coats", "pants-jeans", "skirts", "shorts", "footwear", "bags",
    "wallets", "headwear", "fitness-equipment", "camping", "cycling", "sports-equipment", "baby-products", "strollers",
    "toys", "toys-figures", "toys-remote-control", "stationery", "arts-crafts", "jewelry-craft", "medical", "industrial-components"
}


def clean(value: object) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def norm(value: object) -> str:
    text = unicodedata.normalize("NFKD", clean(value)).encode("ascii", "ignore").decode().lower()
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9.+#/-]+", " ", text)).strip()


def label(value: str) -> str:
    return clean(value).replace("-", " ").title()


def clean_title(value: object) -> str:
    title = clean(value)
    title = PROMO_PREFIX.sub("", title).strip(" -–—:|")
    title = re.sub(r"\b(?:factory\s+price|wholesale\s+price|hot\s+sale|best\s+price)\b\s*[:\-–—]?", "", title, flags=re.I)
    return re.sub(r"\s+", " ", title).strip(" -–—:|") or "Product"


def words(value: object) -> list[str]:
    return [x for x in re.findall(r"[a-z0-9]+(?:[.-][a-z0-9]+)*", norm(value)) if x not in STOP and (len(x) >= 3 or (re.search(r"[a-z]", x) and re.search(r"\d", x)))]


def has(pattern: str, text: str) -> bool:
    return bool(re.search(pattern, text, re.I))


def accessory_pair(text: str, target: str, accessory: str) -> bool:
    # Only strong constructions: "phone case", "case for phone", "case compatible with phone".
    # This intentionally does NOT treat "tablet with shockproof case" as a tablet accessory.
    return bool(
        re.search(rf"\b(?:{target})\s+(?:{accessory})\b", text, re.I)
        or re.search(rf"\b(?:{accessory})\s+(?:for|fits?|compatible\s+with|made\s+for|for use with)\s+(?:[^,;]{{0,28}}\b)?(?:{target})\b", text, re.I)
    )


def infer_type(title: str, old_type: str, old_role: str) -> str:
    t = norm(title)
    old = ALIASES.get(old_type, old_type)

    phone = r"(?:phone|smartphone|iphone(?:\s*(?:[5-9x]|1[0-9]))?|galaxy\s+(?:s|a|m|f|z)\s*\d+|pixel\s*\d+|oneplus|redmi|poco|oppo|vivo|realme|motorola|moto|honor|huawei|nokia|xperia)"
    tablet = r"(?:tablet|ipad|galaxy\s+tab|surface\s+pro)"
    laptop = r"(?:laptop|chromebook|notebook\s+(?:pc|computer)|thinkpad|ideapad|thinkbook|macbook|vivobook|zenbook|probook|elitebook|latitude|inspiron|xps|legion|surface\s+laptop)"
    watch = r"(?:smart\s*watch|apple\s+watch|galaxy\s+watch|fitness\s+watch|gps\s+watch)"
    audio = r"(?:headphones?|headsets?|earbuds?|earphones?|airpods?|tws)"
    camera = r"(?:camera|webcam|dash\s*cam|action\s*cam)"

    # Replacement parts first: a part should never masquerade as the finished product.
    if REPLACEMENT.search(t):
        if has(phone, t): return "phone-parts"
        if has(laptop + r"|computer|desktop|pc\b", t): return "computer-parts"
        if has(r"printer|printhead|laserjet|inkjet", t): return "printer-parts"
        if has(r"air\s+conditioner|air\s+conditioning|hvac|compressor", t): return "air-conditioning-parts"
        if has(r"drill|saw|grinder|sander|router|trimmer|mower|power\s+tool|carbon\s+brush|armature|stator", t): return "power-tool-parts"
        if has(r"car|vehicle|automotive|atv|utv|engine|transmission|brake|caliper", t): return "automotive-parts"
        if has(r"washing\s+machine|dryer|vacuum|refrigerator|fridge|dishwasher|coffee\s+machine|appliance", t): return "appliance-parts"
        return "replacement-parts"

    # Device accessories. These use strong grammatical constructions to avoid the old "device with case" false positive.
    if accessory_pair(t, phone, r"case|cover|holder|stand|mount|strap|lanyard|screen\s+protector|tempered\s+glass|charger|charging\s+cable|usb\s+cable|dock|adapter|stylus"):
        return "phone-accessories"
    if accessory_pair(t, tablet, r"case|cover|holder|stand|mount|screen\s+protector|keyboard|stylus|charger|dock|sleeve"):
        return "tablet-accessories"
    if accessory_pair(t, laptop, r"case|cover|sleeve|bag|stand|dock|docking\s+station|charger|adapter|cooling\s+pad|keyboard\s+cover|screen\s+protector"):
        return "laptop-accessories"
    if accessory_pair(t, watch, r"band|strap|case|cover|protector|charger|charging\s+dock|stand"):
        return "smartwatch-accessories"
    if accessory_pair(t, audio, r"case|cover|ear\s*pads?|ear\s*cushions?|replacement\s+cable|stand|ear\s*tips?|charging\s+case"):
        return "headphone-accessories"
    if accessory_pair(t, camera, r"bag|case|cover|strap|tripod|mount|holder|lens\s+cap|cage|battery|charger"):
        return "camera-accessories"

    # Core electronics.
    if has(r"\b(?:smartphone|mobile\s+phone|cell\s+phone|feature\s+phone|unlocked\s+phone|gsm\s+phone|5g\s+phone|4g\s+phone)\b", t) or has(r"\biphone\s*(?:[5-9x]|1[0-9])\b|\bgalaxy\s+(?:s|a|m|f|z)\s*\d+\b|\bpixel\s*\d+\b", t):
        return "phone"
    if has(r"\b(?:drawing|graphics|handwriting)\s+tablet\b", t): return "drawing-tablet"
    if has(r"\b(?:cleaner|effervescent|dishwasher)\s+tablet\b|\btablet\s+toy\b|\blearning\s+tablet\s+toy\b", t):
        pass
    elif has(r"\bipad\b|\bgalaxy\s+tab\b|\bsurface\s+pro\b", t) or (has(r"\btablet\b", t) and has(r"\bandroid\b|\btablet\s+pc\b|\bwifi\b|\bwi-fi\b|\bdual\s+camera\b|\bocta[- ]?core\b|\b\d+\s*gb\b|\bkids\s+tablet\b", t)):
        return "tablet"
    if has(laptop, t): return "laptop"
    if has(r"\b(?:desktop\s+computer|desktop\s+pc|mini\s+pc|all[- ]in[- ]one\s+pc)\b", t): return "desktop-computers"
    if has(r"\b(?:gaming\s+monitor|computer\s+monitor|portable\s+monitor|pc\s+monitor|monitor\s+for\s+(?:pc|computer|laptop)|\d{2,3}(?:\.\d+)?[- ]?inch\s+monitor)\b", t) and not has(r"baby|blood\s+pressure|tire\s+pressure|fitness|stepper|exercise", t): return "monitor"
    if has(r"\b(?:mechanical\s+keyboard|gaming\s+keyboard|wireless\s+keyboard|bluetooth\s+keyboard|computer\s+keyboard|keyboard\s*&\s*mouse|keyboard\s+and\s+mouse)\b", t): return "keyboard"
    if has(r"\b(?:gaming\s+mouse|wireless\s+mouse|bluetooth\s+mouse|computer\s+mouse|ergonomic\s+mouse|trackball)\b", t) and not has(r"mouse\s+pad|mousepad|mouse\s+mat", t): return "mouse"
    if has(r"\b(?:mouse\s+pad|mousepad|mouse\s+mat|desk\s+mat)\b", t): return "computer-accessories"
    if has(r"\b(?:nvme\s+ssd|ssd\b|solid\s+state\s+drive|hard\s+drive|hdd\b|flash\s+drive|usb\s+drive|memory\s+card|micro\s*sd)\b", t): return "computer-storage"
    if has(r"\b(?:ddr[345]|sodimm|so-dimm|memory\s+module|ram\s+(?:memory|module)|\d+gb\s+ram)\b", t): return "computer-memory"
    if has(r"\b(?:graphics\s+card|geforce\s+rtx|radeon\s+rx|gpu\s+card)\b", t): return "graphics-card"
    if has(r"\b(?:motherboard|mainboard)\b", t): return "motherboard"
    if has(r"\b(?:label\s+printer|thermal\s+printer|laser\s+printer|inkjet\s+printer|photo\s+printer|office\s+printer)\b", t): return "printer"
    if has(r"\b(?:home\s+projector|portable\s+projector|mini\s+projector|4k\s+projector|1080p\s+projector|video\s+projector)\b", t): return "projector"
    if has(r"\b(?:smart\s+tv|oled\s+tv|qled\s+tv|led\s+tv|television)\b", t): return "television"
    if has(r"\b(?:security\s+camera|digital\s+camera|action\s+camera|dash\s*cam|trail\s+camera|instant\s+camera|mirrorless\s+camera|dslr\s+camera)\b", t): return "camera"
    if has(r"\b(?:webcam|web\s+camera)\b", t): return "webcam"
    if has(r"\b(?:camera\s+lens|telephoto\s+lens|wide[- ]angle\s+lens|prime\s+lens|zoom\s+lens)\b", t): return "camera-lens"
    if has(r"\b(?:soundbar|bluetooth\s+speaker|wireless\s+speaker|portable\s+speaker|bookshelf\s+speaker|subwoofer)\b", t): return "speaker"
    if has(r"\b(?:microphone|wireless\s+mic\b|usb\s+mic\b|lavalier\s+mic\b)\b", t): return "microphone"
    if has(audio, t): return "headphones"
    if has(watch, t): return "smartwatch"
    if has(r"\b(?:power\s*bank|portable\s+charger|external\s+battery)\b", t): return "power-bank"
    if has(r"\b(?:wifi\s+router|wi-fi\s+router|wireless\s+router|mesh\s+wifi|mesh\s+wi-fi|network\s+switch|ethernet\s+switch|wireless\s+access\s+point)\b", t): return "router-networking"
    if has(r"\b(?:game\s+console|gaming\s+console|playstation\s*[345]|xbox\s+(?:series|one)|nintendo\s+switch)\b", t): return "game-console"
    if has(r"\b(?:game\s+controller|gaming\s+controller|gamepad|joystick)\b", t): return "game-controller"

    # Tools, workshop, industrial, printing.
    if has(r"\b(?:3d\s+printer|resin\s+printer|3d\s+printing|pla\s+filament|petg\s+filament|tpu\s+filament|abs\s+filament|filament\s+1\.75)\b", t): return "3d-printing"
    if has(r"\b(?:cordless\s+drill|hammer\s+drill|impact\s+driver|impact\s+wrench|angle\s+grinder|circular\s+saw|jigsaw|rotary\s+hammer|power\s+tool|electric\s+sander)\b", t): return "power-tools"
    if has(r"\b(?:screwdriver\s+set|socket\s+set|ratchet\s+set|pliers\b|hand\s+tool|tool\s+kit|tool\s+set|wrench\s+set)\b", t): return "hand-tools"
    if has(r"\b(?:multimeter|oscilloscope|digital\s+caliper|vernier\s+caliper|micrometer|laser\s+measure|measuring\s+tool|voltage\s+tester|clamp\s+meter)\b", t): return "measuring-tools"
    if has(r"\b(?:soldering\s+iron|soldering\s+station|hot\s+air\s+rework)\b", t): return "soldering"
    if has(r"\b(?:industrial|cnc\b|hydraulic|pneumatic|servo\s+motor|encoder|solenoid|contactor|plc\b|linear\s+bearing)\b", t): return "industrial-components"

    # Home, kitchen and furniture.
    if has(r"\b(?:robot\s+vacuum|vacuum\s+cleaner|cordless\s+vacuum|handheld\s+vacuum|car\s+vacuum)\b", t): return "vacuum-cleaner"
    if has(r"\b(?:portable\s+fan|desk\s+fan|tower\s+fan|handheld\s+fan|cooling\s+fan|ceiling\s+fan)\b", t): return "fans"
    if has(r"\b(?:air\s+conditioner|portable\s+ac|mini\s+split|ductless\s+ac|split\s+ac|window\s+ac)\b", t): return "air-conditioning"
    if has(r"\b(?:humidifier|air\s+purifier|space\s+heater|dehumidifier)\b", t): return "climate-appliances"
    if has(r"\b(?:air\s+fryer|coffee\s+maker|espresso\s+machine|coffee\s+machine|blender|food\s+processor|electric\s+kettle|toaster|rice\s+cooker|stand\s+mixer|hand\s+mixer|sewing\s+machine)\b", t): return "kitchen-appliances" if not has(r"sewing\s+machine", t) else "home-appliances"
    if has(r"\b(?:cookware|frying\s+pan|saucepan|stockpot|casserole|wok|skillet|cooking\s+pot|pots?\s+and\s+pans?)\b", t): return "cookware"
    if has(r"\b(?:cutting\s+board|kitchen\s+knife|knife\s+set|peeler|can\s+opener|kitchen\s+utensil)\b", t): return "kitchen-tools"
    if has(r"\b(?:standing\s+desk|computer\s+desk|office\s+desk|writing\s+desk|gaming\s+desk|desk\s+table)\b", t): return "furniture-desks"
    if has(r"\b(?:office\s+chair|gaming\s+chair|dining\s+chair|accent\s+chair|ergonomic\s+chair)\b", t): return "furniture-chairs"
    if has(r"\b(?:sofa|couch|bookshelf|bookcase|cabinet|wardrobe|nightstand|bed\s+frame|coffee\s+table|dining\s+table)\b", t): return "furniture"
    if has(r"\b(?:storage\s+organizer|desk\s+organizer|storage\s+box|closet\s+organizer|drawer\s+organizer|home\s+organization)\b", t): return "home-organization"
    if has(r"\b(?:throw\s+blanket|weighted\s+blanket|duvet|comforter|bed\s+sheet|bedsheet|pillow|pillowcase|bedding)\b", t): return "bedding"
    if has(r"\b(?:curtain|window\s+curtain|shower\s+curtain)\b", t): return "curtains-window"
    if has(r"\b(?:wall\s+art|home\s+decor|home\s+decoration|decorative\s+ornament|poster\s+print)\b", t): return "home-decor"
    if has(r"\b(?:lamp|lighting|light\s+fixture|led\s+strip|light\s+bulb|ceiling\s+light|wall\s+light|desk\s+lamp|floor\s+lamp|night\s+light)\b", t): return "lighting"
    if has(r"\b(?:cleaning\s+brush|cleaning\s+tool|cleaning\s+kit|mop\b|duster|scrub\s+brush)\b", t): return "cleaning"

    # Automotive.
    if has(r"\b(?:brake\s+pad|brake\s+disc|brake\s+rotor|spark\s+plug|ignition\s+coil|fuel\s+pump|oil\s+filter|air\s+filter|wheel\s+bearing|car\s+sensor|automotive\s+relay|car\s+relay|vehicle\s+relay)\b", t): return "automotive-parts"
    if has(r"\b(?:car\s+charger|car\s+mount|car\s+holder|car\s+organizer|seat\s+cover|steering\s+wheel\s+cover|car\s+floor\s+mat|car\s+interior\s+accessor)\b", t): return "car-accessories"
    if has(r"\b(?:car\s+stereo|car\s+radio|carplay|android\s+auto|head\s+unit)\b", t): return "car-electronics"

    # Pets and baby.
    if has(r"\b(?:dog\s+food|cat\s+food|pet\s+food|puppy\s+food|kitten\s+food|dog\s+treats?|cat\s+treats?)\b", t): return "pet-food"
    if has(r"\b(?:pet\s+bed|dog\s+bed|cat\s+bed)\b", t): return "pet-beds"
    if has(r"\b(?:pet\s+toy|dog\s+toy|cat\s+toy|chew\s+toy)\b", t): return "pet-toys"
    if has(r"\b(?:dog\s+collar|cat\s+collar|pet\s+collar|dog\s+leash|pet\s+leash|harness\s+for\s+(?:dog|cat))\b", t): return "pet-collars-leashes"
    if has(r"\b(?:pet\s+feeder|automatic\s+feeder|pet\s+water\s+fountain|dog\s+bowl|cat\s+bowl)\b", t): return "pet-feeders"
    if has(r"\b(?:cat\s+litter|litter\s+box)\b", t): return "pet-litter"
    if has(r"\b(?:pet\s+grooming|dog\s+grooming|cat\s+grooming|pet\s+hair\s+remover)\b", t): return "pet-grooming"
    if has(r"\b(?:baby\s+stroller|stroller)\b", t): return "strollers"
    if has(r"\b(?:baby\s+carrier|baby\s+monitor|baby\s+bottle|baby\s+crib|infant\s+car\s+seat|baby\s+car\s+seat|diaper|nappy)\b", t): return "baby-products"

    # Beauty and personal care.
    if has(r"\b(?:perfume|fragrance|cologne|eau\s+de\s+parfum|eau\s+de\s+toilette|parfum|edp\b|edt\b)\b", t): return "perfume"
    if has(r"\b(?:skin\s+care|skincare|face\s+serum|facial\s+serum|moisturizer|sunscreen|face\s+cream)\b", t): return "skincare"
    if has(r"\b(?:makeup|foundation|lipstick|mascara|eyeliner|concealer|blush|makeup\s+brush)\b", t): return "makeup"
    if has(r"\b(?:hair\s+dryer|hair\s+straightener|curling\s+iron|hair\s+clipper|hair\s+trimmer|hair\s+care)\b", t): return "hair-care"
    if has(r"\b(?:nail\s+care|nail\s+polish|gel\s+nail|nail\s+lamp|manicure|pedicure)\b", t): return "nail-care"
    if has(r"\b(?:electric\s+shaver|beard\s+trimmer|grooming\s+kit|body\s+groomer)\b", t): return "grooming"

    # Apparel, footwear and bags.
    if has(r"\b(?:dress|dresses)\b", t): return "dresses"
    if has(r"\b(?:t[- ]?shirt|shirt|blouse|polo\s+shirt|tank\s+top)\b", t): return "shirts-tops"
    if has(r"\b(?:hoodie|sweatshirt|sweater|cardigan|knitwear)\b", t): return "sweaters-hoodies"
    if has(r"\b(?:jacket|coat|blazer)\b", t): return "jackets-coats"
    if has(r"\b(?:jeans|trousers|pants)\b", t): return "pants-jeans"
    if has(r"\bskirt\b", t): return "skirts"
    if has(r"\bshorts\b", t): return "shorts"
    if has(r"\b(?:shoes|sneakers|boots|sandals|slippers|loafers)\b", t): return "footwear"
    if has(r"\b(?:handbag|shoulder\s+bag|crossbody\s+bag|travel\s+bag|tote\s+bag|backpack)\b", t): return "bags"
    if has(r"\b(?:wallet|cardholder|card\s+holder)\b", t): return "wallets"
    if has(r"\b(?:hat|cap|beanie)\b", t): return "headwear"

    # Sports, toys, stationery, arts, medical.
    if has(r"\b(?:treadmill|exercise\s+bike|stationary\s+bike|rowing\s+machine|elliptical|resistance\s+bands?|ab\s+trainer|mini\s+stepper|fitness\s+equipment|home\s+gym)\b", t): return "fitness-equipment"
    if has(r"\b(?:camping\s+tent|sleeping\s+bag|camping\s+chair|camping\s+stove|camping\s+gear)\b", t): return "camping"
    if has(r"\b(?:bike\s+helmet|cycling\s+helmet|bicycle\s+light|bike\s+bag|cycling\s+gear)\b", t): return "cycling"
    if has(r"\b(?:plush\s+toy|building\s+blocks|educational\s+toy|kids?\s+toy|toy\s+for\s+kids|action\s+figure|doll\b)\b", t): return "toys"
    if has(r"\b(?:remote\s+control\s+car|rc\s+car|remote\s+control\s+toy)\b", t): return "toys-remote-control"
    if has(r"\b(?:pen\s+set|pencil\s+set|notebook|stationery|office\s+stationery|sticky\s+notes)\b", t): return "stationery"
    if has(r"\b(?:diamond\s+painting|diamond\s+art|painting\s+kit|art\s+supplies|craft\s+kit|diy\s+craft)\b", t): return "arts-crafts"
    if has(r"\b(?:necklace|bracelet|earrings?|pendant|jewelry|jewellery|beads?|charms?)\b", t): return "jewelry-craft"
    if has(r"\b(?:blood\s+pressure\s+monitor|pulse\s+oximeter|medical|surgical|diagnostic|hospital|clinical|dental|patient\s+monitor)\b", t): return "medical"

    # Preserve meaningful existing taxonomy when title rules do not provide stronger evidence.
    return old or "unclassified"


def infer_family(product_type: str) -> str:
    ty = ALIASES.get(product_type, product_type)
    family_map = {
        "phone-parts": "phone", "phone-accessories": "phone",
        "tablet-accessories": "tablet", "drawing-tablet": "tablet",
        "laptop-accessories": "laptop", "computer-parts": "computer", "computer-accessories": "computer",
        "desktop-computers": "computer", "monitor": "computer", "keyboard": "computer", "mouse": "computer",
        "computer-storage": "computer", "computer-memory": "computer", "graphics-card": "computer", "motherboard": "computer",
        "smartwatch-accessories": "smartwatch", "headphone-accessories": "headphones", "camera-accessories": "camera",
        "camera-lens": "camera", "webcam": "camera", "printer-parts": "printer", "power-tool-parts": "tools",
        "hand-tools": "tools", "measuring-tools": "tools", "soldering": "tools", "replacement-parts": "parts",
        "automotive-parts": "automotive", "car-accessories": "automotive", "car-electronics": "automotive",
        "air-conditioning-parts": "air-conditioning", "appliance-parts": "home-appliances",
        "furniture-desks": "furniture", "furniture-chairs": "furniture", "home-organization": "home",
        "bedding": "home", "curtains-window": "home", "home-decor": "home", "cleaning": "home",
        "vacuum-cleaner": "home-appliances", "fans": "home-appliances", "climate-appliances": "home-appliances",
        "kitchen-appliances": "home-appliances", "home-appliances": "home-appliances", "cookware": "kitchen", "kitchen-tools": "kitchen",
        "pet-food": "pets", "pet-beds": "pets", "pet-toys": "pets", "pet-collars-leashes": "pets", "pet-feeders": "pets",
        "pet-litter": "pets", "pet-grooming": "pets", "beauty-care": "beauty", "skincare": "beauty", "makeup": "beauty",
        "hair-care": "beauty", "nail-care": "beauty", "grooming": "beauty", "shirts-tops": "apparel",
        "sweaters-hoodies": "apparel", "jackets-coats": "apparel", "pants-jeans": "apparel", "dresses": "apparel",
        "skirts": "apparel", "shorts": "apparel", "footwear": "apparel", "bags": "bags", "wallets": "bags", "headwear": "apparel",
        "fitness-equipment": "sports", "camping": "sports", "cycling": "sports", "sports-equipment": "sports",
        "strollers": "baby", "baby-products": "baby", "toys": "toys", "toys-figures": "toys", "toys-remote-control": "toys",
        "stationery": "office", "arts-crafts": "arts-crafts", "jewelry-craft": "jewelry-craft", "industrial-components": "industrial",
        "3d-printing": "3d-printing", "3d-printing-accessories": "3d-printing",
    }
    return family_map.get(ty, ty or "unclassified")


def infer_role(title: str, product_type: str, old_role: str, condition: str) -> str:
    t = norm(title)
    if USED.search(t) or norm(condition) in {"used", "refurbished", "renewed", "pre-owned", "preowned", "open-box", "open box"}:
        return "used"
    if product_type in PART_TYPES or product_type.endswith("-parts"):
        return "replacement_part"
    if product_type in ACCESSORY_TYPES or product_type.endswith("-accessories"):
        return "accessory"
    if REPLACEMENT.search(t):
        return "replacement_part"
    if product_type in MAIN_TYPE_HINTS:
        return "main"
    # Preserve a prior accessory classification only when the title still contains explicit accessory grammar.
    if old_role == "accessory" and has(r"\b(?:accessor(?:y|ies)|case\s+for|cover\s+for|holder\s+for|stand\s+for|mount\s+for|strap\s+for|charger\s+for|cable\s+for|compatible\s+with)\b", t):
        return "accessory"
    if old_role == "replacement_part" and REPLACEMENT.search(t):
        return "replacement_part"
    return "main"


def load_rows() -> tuple[list[dict], dict[str, list[dict]]]:
    rows: list[dict] = []
    buckets: dict[str, list[dict]] = {}
    for path in sorted(PRODUCT_DIR.glob("*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        values = list(data.values()) if isinstance(data, dict) else list(data)
        buckets[path.name] = values
        rows.extend(values)
    return rows, buckets


def main() -> None:
    rows, _ = load_rows()
    before_types = collections.Counter(clean(r.get("ty")) or "unclassified" for r in rows)
    before_roles = collections.Counter(clean(r.get("ro")) or "main" for r in rows)
    before_unclassified = before_types["unclassified"]
    immutable_before = {r.get("id"): (r.get("u"), r.get("x"), r.get("p"), r.get("cu"), tuple(r.get("ids") or []), r.get("se")) for r in rows}

    type_changes = collections.Counter()
    role_changes = collections.Counter()
    title_cleanups = 0
    blocked_leaks = 0

    for r in rows:
        old_title = clean(r.get("t"))
        new_title = clean_title(old_title)
        if new_title != old_title:
            title_cleanups += 1
            r["t"] = new_title
        old_type = clean(r.get("ty")) or "unclassified"
        old_role = clean(r.get("ro")) or "main"
        new_type = infer_type(new_title, old_type, old_role)
        new_type = ALIASES.get(new_type, new_type)
        new_role = infer_role(new_title, new_type, old_role, clean(r.get("co")))
        family = infer_family(new_type)
        if new_type != old_type:
            type_changes[(old_type, new_type)] += 1
        if new_role != old_role:
            role_changes[(old_role, new_role)] += 1
        r["ty"] = new_type
        r["tyl"] = label(new_type)
        r["ro"] = new_role
        r["fa"] = family
        base_search = clean(r.get("s"))
        r["s"] = norm(" ".join([new_title, base_search, new_type, family, new_role.replace("_", " ")]))
        if norm(r.get("se")) in BLOCKED:
            blocked_leaks += 1

    # Write product buckets by stable ID prefix. Product identity, price, link and exactness are never regenerated here.
    product_map = collections.defaultdict(dict)
    for r in rows:
        product_map[str(r.get("id") or "_")[0]][r["id"]] = r
    for path in PRODUCT_DIR.glob("*.json"):
        path.unlink()
    for bucket, data in product_map.items():
        (PRODUCT_DIR / f"{bucket}.json").write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    # Rebuild term shards from corrected title/type/family metadata.
    if TERMS_DIR.exists():
        for path in TERMS_DIR.glob("*.json"):
            path.unlink()
    else:
        TERMS_DIR.mkdir(parents=True)
    row_tokens = {r["id"]: list(dict.fromkeys(words(r.get("s"))))[:28] for r in rows}
    freq = collections.Counter()
    for x in row_tokens.values(): freq.update(x)
    ordered = sorted(rows, key=lambda r: (int(r.get("r") or 0), float(r.get("x") is True), bool(r.get("im")), float(r.get("p") or 0)), reverse=True)
    terms = collections.defaultdict(list)
    for r in ordered:
        for token in row_tokens[r["id"]]:
            if freq[token] <= 2500 and len(terms[token]) < 900:
                terms[token].append(r["id"])
    shards = collections.defaultdict(dict)
    for token, ids in terms.items():
        prefix = (re.sub(r"[^a-z0-9]", "", token)[:2] or "__").ljust(2, "_")
        shards[prefix][token] = ids
    for prefix, data in shards.items():
        (TERMS_DIR / f"{prefix}.json").write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    after_types = collections.Counter(r.get("ty") or "unclassified" for r in rows)
    after_roles = collections.Counter(r.get("ro") or "main" for r in rows)
    families = collections.Counter(r.get("fa") or "unclassified" for r in rows)
    after_unclassified = after_types["unclassified"]

    # Family index lets generic non-managed queries use product-family evidence without stuffing high-frequency terms into every shard.
    family_ids = collections.defaultdict(list)
    for r in sorted(rows, key=lambda r: (r.get("ro") in {"main", "used"}, bool(r.get("x")), bool(r.get("im")), float(r.get("p") or 0)), reverse=True):
        fam = r.get("fa") or "unclassified"
        if len(family_ids[fam]) < 1600:
            family_ids[fam].append(r["id"])
    OUT9.mkdir(parents=True, exist_ok=True)
    (OUT9 / "families.json").write_text(json.dumps(family_ids, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    immutable_after = {r.get("id"): (r.get("u"), r.get("x"), r.get("p"), r.get("cu"), tuple(r.get("ids") or []), r.get("se")) for r in rows}
    immutable_changed = sum(1 for k, v in immutable_before.items() if immutable_after.get(k) != v)

    # High-value semantic regression probes.
    def count_bad(ty: str) -> int:
        return sum(1 for r in rows if r.get("ty") == ty and r.get("ro") not in {"main", "used"})
    semantic = {
        "phoneNonMain": count_bad("phone"),
        "tabletNonMain": count_bad("tablet"),
        "laptopNonMain": count_bad("laptop"),
        "smartwatchNonMain": count_bad("smartwatch"),
        "headphonesNonMain": count_bad("headphones"),
        "ordinaryTabletWithIncludedCaseKeptMain": sum(1 for r in rows if r.get("ty") == "tablet" and "tablet" in norm(r.get("t")) and " with " in f" {norm(r.get('t'))} " and " case" in norm(r.get("t")) and r.get("ro") in {"main", "used"}),
    }

    report = {
        "version": VERSION,
        "records": len(rows),
        "unclassifiedBefore": before_unclassified,
        "unclassifiedAfter": after_unclassified,
        "unclassifiedReduction": before_unclassified - after_unclassified,
        "unclassifiedAfterPct": round(100 * after_unclassified / max(1, len(rows)), 2),
        "typeChanges": [{"from": a, "to": b, "count": n} for (a, b), n in type_changes.most_common()],
        "roleChanges": [{"from": a, "to": b, "count": n} for (a, b), n in role_changes.most_common()],
        "titleCleanups": title_cleanups,
        "types": after_types.most_common(),
        "roles": after_roles.most_common(),
        "families": families.most_common(),
        "familyCount": len(families),
        "termShards": len(shards),
        "blockedSellerLeaks": blocked_leaks,
        "immutableCommerceFieldsChanged": immutable_changed,
        "semanticProbes": semantic,
    }
    (OUT9 / "quality-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    summary_path = OUT8 / "taxonomy-summary.json"
    summary = json.loads(summary_path.read_text(encoding="utf-8"))
    summary["version"] = VERSION
    summary["types"] = [{"slug": k, "label": label(k), "count": v} for k, v in after_types.most_common()]
    summary["roles"] = dict(after_roles)
    summary["families"] = [{"slug": k, "label": label(k), "count": v} for k, v in families.most_common()]
    summary["qualityGateV20_9"] = {
        "unclassifiedBefore": before_unclassified,
        "unclassifiedAfter": after_unclassified,
        "typeCorrections": sum(type_changes.values()),
        "roleCorrections": sum(role_changes.values()),
        "titleCleanups": title_cleanups,
        "immutableCommerceFieldsChanged": immutable_changed,
    }
    summary_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    manifest_path = OUT8 / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    manifest["version"] = VERSION
    manifest["records"] = len(rows)
    manifest.setdefault("truthCleanup", {}).update({
        "allProductQualityGateVersion": VERSION,
        "canonicalProductFamilies": True,
        "mainAccessoryReplacementRoleGate": True,
        "genericQueryMainProductGuard": True,
        "marketingTitlePrefixesRemoved": True,
        "commerceEvidenceFieldsImmutable": True,
    })
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(json.dumps({
        "version": VERSION,
        "records": len(rows),
        "unclassifiedBefore": before_unclassified,
        "unclassifiedAfter": after_unclassified,
        "unclassifiedAfterPct": report["unclassifiedAfterPct"],
        "typeCorrections": sum(type_changes.values()),
        "roleCorrections": sum(role_changes.values()),
        "families": len(families),
        "blockedSellerLeaks": blocked_leaks,
        "immutableCommerceFieldsChanged": immutable_changed,
        "semanticProbes": semantic,
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
