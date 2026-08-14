#!/usr/bin/env python3
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PRODUCTS = ROOT / "data/v20-8/products"
OUT = ROOT / "data/v20-9"
REPORT = OUT / "final-role-fix-report.json"
QUALITY = OUT / "quality-report.json"
MANIFEST = ROOT / "data/v20-8/manifest.json"
VERSION = "20.9.2"

PHONE_BAG = re.compile(
    r"\b(?:cell\s+phone|mobile\s+phone|smartphone|iphone|galaxy)\s+(?:bag|pouch|wallet|crossbody\s+bag)\b|"
    r"\b(?:bag|pouch|wallet|crossbody\s+bag)\b[^,;]{0,55}\b(?:for|fits?|compatible\s+with)\b[^,;]{0,55}\b(?:iphone|galaxy|smartphone|cell\s+phone|mobile\s+phone)\b",
    re.I,
)
LAPTOP_BAG = re.compile(
    r"\b(?:laptop|notebook\s+computer|macbook|thinkpad)\s+(?:bag|case|sleeve|briefcase)\b|"
    r"\b(?:bag|case|sleeve|briefcase)\b[^,;]{0,65}\b(?:for|fits?|compatible\s+with)\b[^,;]{0,65}\b(?:laptop|notebook\s+computer|macbook|thinkpad)\b",
    re.I,
)
AUTOMOTIVE_FILTER_REPLACEMENT = re.compile(
    r"\b(?:air|oil|fuel|cabin)\s+filter\s+replacement\b|\breplacement\s+(?:air|oil|fuel|cabin)\s+filter\b",
    re.I,
)
AUTOMOTIVE_CONTEXT = re.compile(
    r"\b(?:car|vehicle|automotive|engine|toyota|honda|ford|bmw|mercedes|audi|volkswagen|vw|nissan|hyundai|kia|mazda|lexus|chevrolet|jeep|subaru|volvo|porsche)\b",
    re.I,
)


def label(slug: str) -> str:
    return slug.replace("-", " ").title()


def rewrite_search(row: dict) -> None:
    row["s"] = " ".join(dict.fromkeys(
        (f"{row.get('s','')} {row.get('t','')} {row.get('ty','')} {row.get('fa','')} {str(row.get('ro','main')).replace('_',' ')}")
        .lower().split()
    ))


def main() -> None:
    fixes: list[dict] = []
    for path in sorted(PRODUCTS.glob("*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(data, dict):
            raise SystemExit(f"Expected object bucket: {path}")
        dirty = False
        for rid, row in data.items():
            if row.get("ro") != "main":
                continue
            title = str(row.get("t") or "")
            target = None
            if PHONE_BAG.search(title):
                target = ("phone-accessories", "phone", "accessory", "phone-bag-grammar")
            elif LAPTOP_BAG.search(title):
                target = ("laptop-accessories", "laptop", "accessory", "laptop-bag-grammar")
            elif AUTOMOTIVE_FILTER_REPLACEMENT.search(title) and AUTOMOTIVE_CONTEXT.search(title):
                target = ("automotive-parts", "automotive", "replacement_part", "automotive-filter-replacement")
            if not target:
                continue
            ty, family, role, rule = target
            before = {"type": row.get("ty"), "family": row.get("fa"), "role": row.get("ro")}
            row["ty"] = ty
            row["tyl"] = label(ty)
            row["fa"] = family
            row["ro"] = role
            rewrite_search(row)
            fixes.append({"id": rid, "title": title, "seller": row.get("se"), "rule": rule, "before": before, "after": {"type": ty, "family": family, "role": role}})
            dirty = True
        if dirty:
            path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    OUT.mkdir(parents=True, exist_ok=True)
    report = {"version": VERSION, "fixes": len(fixes), "rows": fixes}
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    if QUALITY.exists():
        q = json.loads(QUALITY.read_text(encoding="utf-8"))
        q["finalRoleAnomalyFixVersion"] = VERSION
        q["finalRoleAnomalyFixes"] = len(fixes)
        QUALITY.write_text(json.dumps(q, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    if MANIFEST.exists():
        m = json.loads(MANIFEST.read_text(encoding="utf-8"))
        m.setdefault("truthCleanup", {}).update({
            "finalRoleAnomalyFixVersion": VERSION,
            "finalRoleAnomalyGrammarOnly": True,
            "finalRoleAnomalyFixes": len(fixes),
        })
        MANIFEST.write_text(json.dumps(m, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
