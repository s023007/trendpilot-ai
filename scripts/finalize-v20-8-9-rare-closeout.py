#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import shutil
from pathlib import Path
from collections import Counter

ROOT = Path(__file__).resolve().parents[1]
RARE = ROOT / "data/v20-8/rare-index.json"
MANIFEST = ROOT / "data/v20-8/manifest.json"
FINDS_DIR = ROOT / "rare-used/finds"
SITEMAP = ROOT / "sitemap-v20-8.xml"
VERSION = "20.8.9"

PROMO_PREFIX = re.compile(
    r"^\s*(?:\[(?:free\s+shipping|hot\s+sale|new\s+arrival|best\s+seller)\]\s*|"
    r"(?:free\s+shipping|hot\s+sale|new\s+arrival|best\s+seller)\s*[:\-–—]?\s*)+", re.I)
DOLL_FIGURE = re.compile(r"\b(?:doll|figure|figurine|action\s+figure|collectible\s+figure)\b", re.I)
ACCESSORY_WORDS = re.compile(r"\b(?:outfit|clothes?|clothing|dress|costume|shoes?|boots?|hat|cap|bag|handbag|purse|wig|stand|display\s+stand|accessor(?:y|ies))\b", re.I)
NO_DOLL = re.compile(r"\b(?:no\s+doll|doll\s+not\s+included|without\s+doll|no\s+figure|figure\s+not\s+included)\b", re.I)
DIECAST = re.compile(r"\b(?:die[\s-]?cast|1\s*[:/]\s*\d{2,3}\s*(?:scale)?|scale\s+model\s+(?:car|aircraft|plane|truck|vehicle)|model\s+(?:car|aircraft|plane))\b", re.I)
DESK = re.compile(r"\b(?:standing\s+desk|height[-\s]?adjustable\s+desk|computer\s+desk|office\s+desk|desk\s+frame)\b", re.I)
FITNESS = re.compile(r"\b(?:exercise\s+bike|fitness\s+bike|stationary\s+bike|treadmill|rowing\s+machine|elliptical|exercise\s+machine)\b", re.I)
CARBON_BRUSH = re.compile(r"\bcarbon\s+brush(?:es)?\b", re.I)
POWER_TOOL_CONTEXT = re.compile(r"\b(?:trimmer|drill|grinder|saw|mower|brush\s+cutter|power\s+tool|carburetor|gear\s+assembly|cylinder\s+assy|piston\s+ring)\b", re.I)
USED = re.compile(r"\b(?:second[-\s]?hand|pre[-\s]?owned|used|refurbished|renewed)\b", re.I)
DISCONTINUED = re.compile(r"\b(?:discontinued|obsolete|out\s+of\s+production|new\s+old\s+stock|\bNOS\b|legacy\s+part)\b", re.I)
LIMITED_COLLECTOR = re.compile(r"\b(?:vintage|limited\s+edition|collector(?:'s)?\s+edition|collectible\s+(?:model|car|aircraft|figure)|die[\s-]?cast|rare\s+edition)\b", re.I)
REPLACEMENT = re.compile(r"\b(?:replacement|spare\s+part|repair\s+part|replacement\s+parts?)\b", re.I)
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
    return PROMO_PREFIX.sub("", title).strip(" -–—:|") or "Product"


def normalize_type_role(row: dict) -> tuple[str, str, str]:
    title = row["title"]
    old_type = str(row.get("type") or "other")
    role = str(row.get("role") or "main")
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
    if old_type == "diecast-collectibles" and not DIECAST.search(title):
        if DUST_COLLECTOR.search(title):
            old_type = "tools"
        elif DOLL_FIGURE.search(title):
            old_type = "collectible-figures"
    label = TYPE_LABELS.get(old_type, str(row.get("typeLabel") or old_type.replace("-", " ").title()))
    return old_type, label, role


def normalize_row(source: dict) -> dict:
    row = dict(source)
    old_signals = {str(x) for x in (row.get("signals") or [])}
    row["title"] = clean_title(row.get("title"))
    row["type"], row["typeLabel"], row["role"] = normalize_type_role(row)
    title = row["title"]

    is_accessory = row["role"] == "accessory"
    model_specific = "model-specific" in old_signals
    is_used = "used-scarce" in old_signals or str(row.get("condition") or "").lower() in {"used", "refurbished"} or bool(USED.search(title))
    is_discontinued = "discontinued" in old_signals or bool(DISCONTINUED.search(title))
    is_replacement = "replacement-part" in old_signals or row["role"] == "replacement_part" or bool(REPLACEMENT.search(title))
    is_collector = ("collector" in old_signals or bool(LIMITED_COLLECTOR.search(title)) or bool(DIECAST.search(title))) and not is_accessory and not DUST_COLLECTOR.search(title)
    is_specialist = ("specialist" in old_signals or bool(SPECIALIST.search(title))) and not is_accessory

    if DESK.search(title) or FITNESS.search(title):
        is_collector = is_specialist = is_replacement = is_discontinued = False
        model_specific = False
    if is_accessory:
        is_collector = is_specialist = is_replacement = False
        if NO_DOLL.search(title):
            model_specific = False

    signals: list[str] = []
    if is_used: signals.append("used-scarce")
    if is_discontinued: signals.append("discontinued")
    if is_collector: signals.append("collector")
    if is_replacement: signals.append("replacement-part")
    if is_specialist: signals.append("specialist")
    if model_specific: signals.append("model-specific")
    row["signals"] = signals

    score = 30
    if is_used: score += 20
    if is_discontinued: score += 24
    if is_collector: score += 20
    if is_replacement and model_specific: score += 26
    elif is_replacement: score += 7
    if is_specialist and model_specific: score += 18
    elif is_specialist: score += 4
    if model_specific and (is_used or is_discontinued or is_collector) and not (is_replacement or is_specialist): score += 8
    if row.get("exact") and (is_used or is_discontinued or is_collector or (is_replacement and model_specific) or (is_specialist and model_specific)): score += 4
    row["rareScore"] = min(96, score)

    brand = str(row.get("brand") or "").strip()
    if brand and brand.lower() not in title.lower():
        row["brand"] = ""
    return row


def is_publishable_rare(row: dict) -> bool:
    signals = set(row.get("signals") or [])
    title = str(row.get("title") or "").lower()
    if ("acgam" in title and "desk" in title) or ("robore" in title and "exercise bike" in title):
        return False
    if row.get("type") in {"furniture-desks", "fitness-equipment"} and not ({"used-scarce", "discontinued"} & signals):
        return False
    if row.get("role") == "accessory" and not ({"used-scarce", "discontinued"} & signals):
        return False
    strong = bool(
        {"used-scarce", "discontinued", "collector"} & signals
        or ({"replacement-part", "model-specific"} <= signals)
        or ({"specialist", "model-specific"} <= signals)
    )
    return strong and int(row.get("rareScore") or 0) >= 60


def prune_static_seo(rows: list[dict]) -> int:
    """Keep static Rare SEO only for products that survive final closeout."""
    allowed_paths = {str(r.get("seoUrl") or "") for r in rows if r.get("seoUrl")}
    removed = 0
    if FINDS_DIR.exists():
        for child in FINDS_DIR.iterdir():
            if not child.is_dir():
                continue
            public = f"/rare-used/finds/{child.name}/"
            if public not in allowed_paths:
                shutil.rmtree(child)
                removed += 1

    live_urls: list[str] = []
    for url in sorted(allowed_paths):
        slug = url.rstrip("/").split("/")[-1]
        if (FINDS_DIR / slug / "index.html").exists():
            live_urls.append(url)

    xml = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    xml.append('<url><loc>https://trendpilotchoice.com/rare-used/</loc><changefreq>weekly</changefreq></url>')
    for url in live_urls:
        xml.append(f'<url><loc>https://trendpilotchoice.com{url}</loc><changefreq>weekly</changefreq></url>')
    xml.append('</urlset>')
    SITEMAP.write_text("\n".join(xml) + "\n", encoding="utf-8")
    return removed


def main() -> None:
    if not RARE.exists():
        raise SystemExit(f"Missing {RARE}")
    original = json.loads(RARE.read_text(encoding="utf-8"))
    if not isinstance(original, list):
        raise SystemExit("rare-index.json is not a list")

    normalized = [normalize_row(x) for x in original if isinstance(x, dict)]
    published = [x for x in normalized if is_publishable_rare(x)]
    published.sort(key=lambda x: (-int(x.get("rareScore") or 0), -float(x.get("quality") or 0), x.get("title", "").lower()))

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
    seo_removed = prune_static_seo(deduped)
    live_seo = sum(1 for r in deduped if r.get("seoUrl") and (FINDS_DIR / str(r["seoUrl"]).rstrip("/").split("/")[-1] / "index.html").exists())

    if MANIFEST.exists():
        manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
        manifest["version"] = VERSION
        manifest["rarePublished"] = len(deduped)
        manifest["seoPages"] = live_seo
        manifest.setdefault("truthCleanup", {}).update({
            "rareCloseoutVersion": VERSION,
            "promoPrefixesRemoved": True,
            "accessoryRoleWinsOverCollectibleKeyword": True,
            "rareScoreRequiresRarityEvidence": True,
            "genericCollectorTokenRejected": True,
            "priceEvidenceSingleSourceOfTruth": True,
            "staleRareSeoPagesPruned": True,
        })
        MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(json.dumps({
        "version": VERSION,
        "rare_before": len(original),
        "rare_after": len(deduped),
        "removed": len(original)-len(deduped),
        "roles": dict(Counter(x.get("role", "") for x in deduped)),
        "types": len({x.get("type") for x in deduped}),
        "sellers": len({x.get("seller") for x in deduped}),
        "seo_pages": live_seo,
        "stale_seo_directories_removed": seo_removed,
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
