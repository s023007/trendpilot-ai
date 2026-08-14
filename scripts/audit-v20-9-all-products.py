#!/usr/bin/env python3
from __future__ import annotations

import collections
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PRODUCT_DIR = ROOT / "data/v20-8/products"
OUT = ROOT / "data/v20-9"

STOP = {
    "the","and","for","with","from","this","that","your","our","new","best","sale","hot","price","buy",
    "original","official","wholesale","factory","global","product","products","item","items","pcs","piece","pieces",
    "pack","set","sets","of","to","in","on","by","a","an","compatible","replacement","accessories","accessory"
}

PROBES = [
    ("tablet", r"\b(?:tablet|ipad|galaxy tab|surface pro|android tablet)\b"),
    ("monitor", r"\b(?:monitor|display monitor|gaming monitor|computer monitor)\b"),
    ("keyboard", r"\b(?:keyboard|keypad)\b"),
    ("mouse", r"\b(?:mouse|trackball)\b"),
    ("speaker", r"\b(?:speaker|soundbar|subwoofer)\b"),
    ("microphone", r"\b(?:microphone|mic\b|wireless mic)\b"),
    ("camera", r"\b(?:camera|webcam|dash cam|action cam|digital camera|security camera)\b"),
    ("camera-lens", r"\b(?:camera lens|telephoto lens|wide angle lens|prime lens|zoom lens)\b"),
    ("projector", r"\b(?:projector|projection)\b"),
    ("television", r"\b(?:television|smart tv|oled tv|qled tv|led tv)\b"),
    ("printer", r"\b(?:printer|thermal printer|label printer|inkjet|laser printer)\b"),
    ("router-networking", r"\b(?:router|wifi router|wi-fi router|mesh wifi|access point|network switch|ethernet switch)\b"),
    ("storage", r"\b(?:ssd|solid state drive|hard drive|hdd|nvme|flash drive|usb drive|memory card|microsd|micro sd)\b"),
    ("computer-memory", r"\b(?:ram\b|ddr[345]|memory module|sodimm|so-dimm)\b"),
    ("computer-components", r"\b(?:graphics card|gpu\b|motherboard|cpu\b|processor|power supply|psu\b|pc case|computer case)\b"),
    ("charging", r"\b(?:charger|charging cable|usb cable|power adapter|wall adapter|car charger|wireless charger)\b"),
    ("phone-accessory", r"\b(?:phone case|iphone case|galaxy case|phone cover|screen protector|tempered glass|phone stand|phone mount|phone strap|phone lanyard)\b"),
    ("watch-accessory", r"\b(?:watch band|watch strap|watch case|watch charger|watch protector|smartwatch band|smartwatch strap)\b"),
    ("headphone-accessory", r"\b(?:ear pads|ear cushions|headphone stand|earbud case|airpods case|earphone case|replacement cable)\b"),
    ("power-tool", r"\b(?:drill|grinder|circular saw|jigsaw|impact wrench|impact driver|rotary hammer|sander|power tool)\b"),
    ("hand-tool", r"\b(?:screwdriver|wrench|pliers|socket set|ratchet|hammer|hand tool|tool kit|tool set)\b"),
    ("measurement-tool", r"\b(?:multimeter|oscilloscope|caliper|micrometer|laser measure|thermometer|meter tester)\b"),
    ("3d-printing", r"\b(?:3d printer|3d printing|filament|pla\b|petg\b|tpu\b|abs filament|resin printer|print bed|build plate)\b"),
    ("furniture", r"\b(?:desk|chair|table|sofa|couch|cabinet|shelf|bookshelf|bed frame|nightstand|wardrobe)\b"),
    ("cookware", r"\b(?:frying pan|saucepan|stockpot|casserole|wok|skillet|cookware|cooking pot)\b"),
    ("kitchen-appliance", r"\b(?:air fryer|blender|mixer|coffee maker|espresso machine|kettle|toaster|rice cooker|food processor)\b"),
    ("lighting", r"\b(?:lamp|lighting|light fixture|led strip|bulb|ceiling light|wall light|desk lamp|floor lamp)\b"),
    ("vacuum-cleaner", r"\b(?:vacuum cleaner|robot vacuum|cordless vacuum|handheld vacuum)\b"),
    ("air-conditioning", r"\b(?:air conditioner|portable ac|mini split|ductless ac|split ac)\b"),
    ("automotive-part", r"\b(?:brake pad|brake disc|rotor|spark plug|oil filter|air filter|fuel pump|car sensor|ignition coil|car relay|car part|automotive part)\b"),
    ("car-accessory", r"\b(?:car mount|car holder|car organizer|seat cover|steering wheel cover|floor mat|car charger|dash cam)\b"),
    ("pet-food", r"\b(?:dog food|cat food|pet food|puppy food|kitten food|dog treats|cat treats)\b"),
    ("pet-supplies", r"\b(?:pet bed|dog bed|cat bed|pet toy|dog toy|cat toy|leash|collar|pet bowl|dog bowl|cat litter)\b"),
    ("beauty", r"\b(?:makeup|cosmetic|skincare|skin care|serum|foundation|lipstick|mascara|eyeliner|hair dryer|hair straightener)\b"),
    ("perfume", r"\b(?:perfume|fragrance|cologne|eau de parfum|eau de toilette|parfum|edp\b|edt\b)\b"),
    ("apparel", r"\b(?:dress|shirt|t-shirt|t shirt|jacket|coat|hoodie|sweater|pants|trousers|jeans|shorts|skirt)\b"),
    ("footwear", r"\b(?:shoes|sneakers|boots|sandals|slippers|loafers)\b"),
    ("jewelry", r"\b(?:necklace|bracelet|earrings|ring\b|pendant|jewelry|jewellery|beads|charms)\b"),
    ("baby", r"\b(?:stroller|baby carrier|baby monitor|crib|baby bottle|diaper|nappy|car seat)\b"),
    ("medical", r"\b(?:medical|surgical|diagnostic|hospital|clinical|dental|patient monitor|blood pressure monitor|oximeter)\b"),
    ("industrial", r"\b(?:industrial|cnc|hydraulic|pneumatic|servo motor|encoder|solenoid|bearing|relay|contactor|plc\b)\b"),
]
PROBES = [(name, re.compile(pat, re.I)) for name, pat in PROBES]

DEVICE = r"(?:phone|smartphone|iphone|galaxy|tablet|ipad|laptop|macbook|thinkpad|smartwatch|smart watch|apple watch|headphones?|headsets?|earbuds?|earphones?|airpods?|camera|printer|projector)"
ACC = r"(?:case|cover|holder|stand|mount|strap|lanyard|sleeve|screen protector|tempered glass|charger|charging cable|usb cable|dock|ear pads?|ear cushions?|watch band|watch strap|lens cap)"
STRONG_ACCESSORY = re.compile(
    rf"\b(?:{DEVICE})\s+(?:{ACC})\b|\b(?:{ACC})\s+(?:for|fits?|compatible\s+with|made\s+for|for\s+use\s+with)\s+(?:[^,;]{{0,32}}\b)?(?:{DEVICE})\b",
    re.I,
)
STRONG_REPLACEMENT = re.compile(
    r"\b(?:replacement(?:\s+parts?)?|spare\s+parts?|repair\s+parts?|oem\s+part|carbon\s+brush(?:es)?|armature|stator|"
    r"replacement\s+filter|replacement\s+battery|screen\s+replacement|display\s+replacement|charging\s+port|flex\s+cable|"
    r"replacement\s+motherboard|replacement\s+pcb|gear\s+assembly\s+replacement|cylinder\s+assy\s+replacement|piston\s+ring\s+replacement|carburetor\s+replacement)\b",
    re.I,
)


def words(text: str) -> list[str]:
    return [w for w in re.findall(r"[a-z0-9]+(?:[-.][a-z0-9]+)*", str(text or "").lower()) if len(w) >= 3 and w not in STOP]


def load_rows() -> list[dict]:
    rows = []
    for path in sorted(PRODUCT_DIR.glob("*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(data, dict):
            rows.extend(x for x in data.values() if isinstance(x, dict))
        elif isinstance(data, list):
            rows.extend(x for x in data if isinstance(x, dict))
    return rows


def sample(rows: list[dict], limit: int = 40) -> list[dict]:
    out = []
    seen = set()
    for r in rows:
        key = (r.get("se"), r.get("t"))
        if key in seen:
            continue
        seen.add(key)
        out.append({k: r.get(k) for k in ("id","t","ty","ro","fa","se","p","cu","x")})
        if len(out) >= limit:
            break
    return out


def main() -> None:
    rows = load_rows()
    un = [r for r in rows if r.get("ty") == "unclassified"]
    type_counts = collections.Counter(str(r.get("ty") or "") for r in rows)
    role_counts = collections.Counter(str(r.get("ro") or "") for r in rows)
    seller_counts = collections.Counter(str(r.get("se") or "") for r in rows)

    un_tokens = collections.Counter()
    un_bigrams = collections.Counter()
    for r in un:
        ws = words(r.get("t", ""))
        un_tokens.update(ws)
        un_bigrams.update(" ".join(x) for x in zip(ws, ws[1:]))

    probe_hits = {}
    for name, pat in PROBES:
        hit = [r for r in un if pat.search(str(r.get("t") or ""))]
        if hit:
            probe_hits[name] = {"count": len(hit), "samples": sample(hit, 12)}

    # Grammar-aware anomaly checks. Words such as "bag", "case", "cover" or "motherboard" alone are products in their own right;
    # they are not treated as anomalies unless the title explicitly says they are for/compatible with another product or replacement parts.
    main_accessory = [r for r in rows if r.get("ro") == "main" and STRONG_ACCESSORY.search(str(r.get("t") or ""))]
    main_replacement = [r for r in rows if r.get("ro") == "main" and STRONG_REPLACEMENT.search(str(r.get("t") or ""))]
    phone_nonmain = [r for r in rows if r.get("ty") == "phone" and r.get("ro") not in {"main","used"}]
    tablet_nonmain = [r for r in rows if r.get("ty") == "tablet" and r.get("ro") not in {"main","used"}]
    laptop_nonmain = [r for r in rows if r.get("ty") == "laptop" and r.get("ro") not in {"main","used"}]
    smartwatch_nonmain = [r for r in rows if r.get("ty") == "smartwatch" and r.get("ro") not in {"main","used"}]
    headphones_nonmain = [r for r in rows if r.get("ty") == "headphones" and r.get("ro") not in {"main","used"}]

    report = {
        "version": "20.9-diagnostic-2",
        "records": len(rows),
        "unclassified": len(un),
        "unclassifiedPct": round(100 * len(un) / max(1, len(rows)), 2),
        "types": type_counts.most_common(),
        "roles": role_counts.most_common(),
        "sellers": seller_counts.most_common(),
        "unclassifiedTopTokens": un_tokens.most_common(120),
        "unclassifiedTopBigrams": un_bigrams.most_common(120),
        "unclassifiedProbeHits": probe_hits,
        "roleAnomalies": {
            "mainWithStrongAccessoryGrammar": {"count": len(main_accessory), "samples": sample(main_accessory, 50)},
            "mainWithStrongReplacementGrammar": {"count": len(main_replacement), "samples": sample(main_replacement, 50)},
            "phoneNonMain": {"count": len(phone_nonmain), "samples": sample(phone_nonmain, 30)},
            "tabletNonMain": {"count": len(tablet_nonmain), "samples": sample(tablet_nonmain, 30)},
            "laptopNonMain": {"count": len(laptop_nonmain), "samples": sample(laptop_nonmain, 30)},
            "smartwatchNonMain": {"count": len(smartwatch_nonmain), "samples": sample(smartwatch_nonmain, 30)},
            "headphonesNonMain": {"count": len(headphones_nonmain), "samples": sample(headphones_nonmain, 30)},
        },
    }
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "diagnostic.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "records": len(rows),
        "unclassified": len(un),
        "unclassifiedPct": report["unclassifiedPct"],
        "probeFamilies": len(probe_hits),
        "mainWithStrongAccessoryGrammar": len(main_accessory),
        "mainWithStrongReplacementGrammar": len(main_replacement),
        "coreNonMain": {
            "phone":len(phone_nonmain),"tablet":len(tablet_nonmain),"laptop":len(laptop_nonmain),
            "smartwatch":len(smartwatch_nonmain),"headphones":len(headphones_nonmain)
        },
        "remainingTopTokens": un_tokens.most_common(20),
    }, indent=2))


if __name__ == "__main__":
    main()
