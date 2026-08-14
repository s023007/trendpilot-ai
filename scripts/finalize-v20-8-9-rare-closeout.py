#!/usr/bin/env python3
from __future__ import annotations

import json
import re
from pathlib import Path
from collections import Counter

ROOT = Path(__file__).resolve().parents[1]
RARE = ROOT / "data/v20-8/rare-index.json"
MANIFEST = ROOT / "data/v20-8/manifest.json"
PRODUCT_DIR = ROOT / "data/v20-8/products"
VERSION = "20.8.9"

PROMO_PREFIX = re.compile(
    r"^\s*(?:\[(?:free\s+shipping|hot\s+sale|new\s+arrival|best\s+seller)\]\s*|"
    r"(?:free\s+shipping|hot\s+sale|new\s+arrival|best\s+seller)\s*[:\-–—]?\s*)+",
    re.I,
)

MODEL_TOKEN = re.compile(r"\b[A-Za-z0-9][A-Za-z0-9._/-]{2,}[A-Za-z0-9]\b")
MEASUREMENT = re.compile(r"^(?:\d+(?:\.\d+)?(?:mm|cm|m|in|inch|gb|tb|mb|mah|v|a|w|hz|kg|g|pcs?))$", re.I)

DOLL_FIGURE = re.compile(r"\b(?:doll|figure|figurine|action\s+figure|collectible\s+figure)\b", re.I)
ACCESSORY_WORDS = re.compile(r"\b(?:outfit|clothes?|clothing|dress|costume|shoes?|boots?|hat|cap|bag|handbag|purse|wig|stand|display\s+stand|accessor(?:y|ies))\b", re.I)
NO_DOLL = re.compile(r"\b(?:no\s+doll|doll\s+not\s+included|without\s+doll|no\s+figure|figure\s+not\s+included)\b", re.I)
DIECAST = re.compile(r"\b(?:die[\s-]?cast|1\s*[:/]\s*\d{2,3}\s*(?:scale)?|scale\s+model\s+(?:car|aircraft|plane|truck|vehicle)|model\s+(?:car|aircraft|plane)\b)\b", re.I)
DESK = re.compile(r"\b(?:standing\s+desk|height[-\s]?adjustable\s+desk|computer\s+desk|office\s+desk|work\s*station\s+desk|desk\s+frame)\b", re.I)
FITNESS = re.compile(r"\b(?:exercise\s+bike|fitness\s+bike|stationary\s+bike|treadmill|rowing\s+machine|elliptical|exercise\s+machine)\b", re.I)
CARBON_BRUSH = re.compile(r"\bcarbon\s+brush(?:es)?\b", re.I)
POWER_TOOL_CONTEXT = re.compile(r"\b(?:trimmer|drill|grinder|saw|mower|brush\s+cutter|power\s+tool|carburetor|gear\s+assembly|cylinder\s+assy|piston\s+ring)\b", re.I)

USED = re.compile(r"\b(?:second[-\s]?hand|pre[-\s]?owned|used|refurbished|renewed)\b", re.I)
DISCONTINUED = re.compile(r"\b(?:discontinued|obsolete|out\s+of\s+production|new\s+old\s+stock|\bNOS\b|legacy\s+part)\b", re.I)
LIMITED_COLLECTOR = re.compile(r"\b(?:vintage|limited\s+edition|collector(?:'s)?\s+edition|collectible\s+(?:model|car|aircraft|figure)|die[\s-]?cast|rare\s+edition)\b", re.I)
REPLACEMENT = re.compile(r"\b(?:replacement|spare\s+part|repair\s+part|replacement\s+part|replacement\s+parts)\b", re.I)
SPECIALIST = re.compile(r"\b(?:industrial|laboratory|lab\s+equipment|medical|diagnostic|optical|microscope|camera\s+lens|machine\s+part|control\s+board|receiver\s+board|module|caliper\s+tool)\b", re.I)
DUST_COLLECTOR = re.compile(r"\bdust\s+collector\b", re.I)

TYPE_LABELS = {
    "collectible-figure-accessories": "Collectible Figure Accessories",
    "collectible-figures": "Collectible Figures",
    "diecast-collectibles": "Diecast Collectibles",
    "furniture-desks": "Furniture & Desks",
    "fitness-equipment": "Fitness Equipment",
    "power-tool-parts": "Power Tool Parts",
}


def clean_title(value: str) -> str:
    title = re.sub(r"\s+", " ", str(value or "")).strip()
    title = PROMO_PREFIX.sub("", title).strip(" -–—:|")
    return title or "Product"


def strong_model_specific(title: str) -> bool:
    for token in MODEL_TOKEN.findall(title):
        plain = token.strip("._/-")
        if not plain or MEASUREMENT.match(plain):
            continue
        if not (re.search(r"[A-Za-z]", plain) and re.search(r"\d", plain)):
            continue
        if len(plain) < 4:
            continue
        # Ignore common capacity/spec tokens that are not product identifiers.
        if re.fullmatch(r"\d+(?:GB|TB|MB|MAH|W|V|A)", plain, re.I):
            continue
        return True
    return False


def normalize_type_role(row: dict) -> tuple[str, str, str]:
    title = row["title"]
    lower = title.lower()
    old_type = str(row.get("type") or "other")
    role = str(row.get("role") or "main")

    # A dress-up set for a doll/figure is the accessory, not the collectible itself.
    if DOLL_FIGURE.search(title) and (NO_DOLL.search(title) or ACCESSORY_WORDS.search(title)):
        return "collectible-figure-accessories", TYPE_LABELS["collectible-figure-accessories"], "accessory"

    if DIECAST.search(title):
        return "diecast-collectibles", TYPE_LABELS["diecast-collectibles"], "main"

    if DESK.search(title):
        return "furniture-desks", TYPE_LABELS["furniture-desks"], "main"

    if FITNESS.search(title):
        return "fitness-equipment", TYPE_LABELS["fitness-equipment"], "main"

    if CARBON_BRUSH.search(title) or (REPLACEMENT.search(title) and POWER_TOOL_CONTEXT.search(title)):
        return "power-tool-parts", TYPE_LABELS["power-tool-parts"], "replacement_part"

    # Generic "collector" language must not turn a dust-collection machine into a collectible.
    if old_type == "diecast-collectibles" and not DIECAST.search(title):
        if DUST_COLLECTOR.search(title):
            old_type = "tools"
        elif DOLL_FIGURE.search(title):
            old_type = "collectible-figures"

    label = str(row.get("typeLabel") or old_type.replace("-", " ").title())
    if old_type in TYPE_LABELS:
        label = TYPE_LABELS[old_type]
    return old_type, label, role


def normalize_row(source: dict) -> dict:
    row = dict(source)
    row["title"] = clean_title(row.get("title"))
    row["type"], row["typeLabel"], row["role"] = normalize_type_role(row)

    title = row["title"]
    model_specific = strong_model_specific(title)
    is_used = str(row.get("condition") or "").lower() in {"used", "refurbished"} or bool(USED.search(title))
    is_discontinued = bool(DISCONTINUED.search(title))
    is_accessory = row["role"] == "accessory"
    is_replacement = row["role"] == "replacement_part" or bool(REPLACEMENT.search(title))
    is_collector = (bool(LIMITED_COLLECTOR.search(title)) or bool(DIECAST.search(title))) and not is_accessory and not DUST_COLLECTOR.search(title)
    is_specialist = bool(SPECIALIST.search(title)) and not is_accessory

    # Rebuild rarity evidence instead of trusting inherited noisy signals.
    signals: list[str] = []
    if is_used:
        signals.append("used-scarce")
    if is_discontinued:
        signals.append("discontinued")
    if is_collector:
        signals.append("collector")
    if is_replacement:
        signals.append("replacement-part")
    if is_specialist:
        signals.append("specialist")
    if model_specific:
        signals.append("model-specific")
    row["signals"] = signals

    # Conservative score. 90+ is reserved for genuinely strong combined evidence.
    score = 24
    if is_used:
        score += 22
    if is_discontinued:
        score += 26
    if is_collector:
        score += 18
    if is_replacement and model_specific:
        score += 20
    elif is_replacement:
        score += 7
    if is_specialist and model_specific:
        score += 10
    elif is_specialist:
        score += 4
    if model_specific and not (is_replacement or is_specialist or is_collector or is_used or is_discontinued):
        score += 5
    if row.get("exact") and (is_used or is_discontinued or is_collector or (is_replacement and model_specific) or (is_specialist and model_specific)):
        score += 4
    row["rareScore"] = min(96, score)

    # Keep brands only when the title itself supports them. Existing brand truth cleanup stays intact.
    brand = str(row.get("brand") or "").strip()
    if brand and brand.lower() not in title.lower():
        row["brand"] = ""
    return row


def is_publishable_rare(row: dict) -> bool:
    signals = set(row.get("signals") or [])
    if row.get("role") == "accessory" and not ({"used-scarce", "discontinued"} & signals):
        return False
    strong = bool(
        {"used-scarce", "discontinued", "collector"} & signals
        or ({"replacement-part", "model-specific"} <= signals)
        or ({"specialist", "model-specific"} <= signals)
    )
    return strong and int(row.get("rareScore") or 0) >= 60


def process_product_buckets() -> int:
    changed = 0
    if not PRODUCT_DIR.exists():
        return 0
    for path in sorted(PRODUCT_DIR.glob("*.json")):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            continue
        if not isinstance(data, list):
            continue
        updated = [normalize_row(x) if isinstance(x, dict) else x for x in data]
        if updated != data:
            path.write_text(json.dumps(updated, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
            changed += 1
    return changed


def main() -> None:
    if not RARE.exists():
        raise SystemExit(f"Missing {RARE}")
    original = json.loads(RARE.read_text(encoding="utf-8"))
    if not isinstance(original, list):
        raise SystemExit("rare-index.json is not a list")

    normalized = [normalize_row(x) for x in original if isinstance(x, dict)]
    published = [x for x in normalized if is_publishable_rare(x)]
    published.sort(key=lambda x: (-int(x.get("rareScore") or 0), -float(x.get("quality") or 0), x.get("title", "").lower()))

    # Collapse duplicate catalogue families by normalized title + seller, retaining the strongest evidence row.
    seen: set[tuple[str, str]] = set()
    deduped: list[dict] = []
    for row in published:
        family = re.sub(r"\b(?:new|original|genuine|hot|sale)\b", "", row.get("title", ""), flags=re.I)
        family = re.sub(r"[^a-z0-9]+", " ", family.lower()).strip()
        key = (family[:150], str(row.get("sellerSlug") or row.get("seller") or "").lower())
        if key in seen:
            continue
        seen.add(key)
        deduped.append(row)

    RARE.write_text(json.dumps(deduped, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    bucket_files = process_product_buckets()

    if MANIFEST.exists():
        manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
        manifest["version"] = VERSION
        manifest["rarePublished"] = len(deduped)
        manifest.setdefault("truthCleanup", {})
        manifest["truthCleanup"].update({
            "rareCloseoutVersion": VERSION,
            "promoPrefixesRemoved": True,
            "accessoryRoleWinsOverCollectibleKeyword": True,
            "rareScoreRequiresRarityEvidence": True,
            "genericCollectorTokenRejected": True,
            "priceEvidenceSingleSourceOfTruth": True,
        })
        MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    counts = Counter(x.get("role", "") for x in deduped)
    print(json.dumps({
        "version": VERSION,
        "rare_before": len(original),
        "rare_after": len(deduped),
        "removed": len(original) - len(deduped),
        "product_bucket_files_normalized": bucket_files,
        "roles": counts,
    }, ensure_ascii=False, indent=2, default=lambda x: dict(x)))


if __name__ == "__main__":
    main()
