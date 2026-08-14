#!/usr/bin/env python3
from __future__ import annotations

import collections
import json
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data/v20-8/products"
OUT = ROOT / "data/v20-9"
PRODUCTS = OUT / "products"
TERMS = OUT / "terms"
VERSION = "20.9.0"
STOP = {"the","and","for","with","from","this","that","your","our","new","best","sale","hot","price","buy","original","official","wholesale","factory","global","product","products","item","items","pcs","piece","pieces","pack","set","sets","of","to","in","on","by","a","an"}


def tokens(value: object) -> list[str]:
    text = str(value or "").lower()
    return [x for x in re.findall(r"[a-z0-9]+(?:[.+#/-][a-z0-9]+)*", text) if x not in STOP and (len(x) >= 3 or (re.search(r"[a-z]", x) and re.search(r"\d", x)))]


def main() -> None:
    rows: list[dict] = []
    for path in sorted(SOURCE.glob("*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(data, dict):
            rows.extend(x for x in data.values() if isinstance(x, dict))
        elif isinstance(data, list):
            rows.extend(x for x in data if isinstance(x, dict))
    if len(rows) < 50000:
        raise SystemExit(f"Unexpected V20.9 runtime source size: {len(rows)}")

    shutil.rmtree(PRODUCTS, ignore_errors=True)
    shutil.rmtree(TERMS, ignore_errors=True)
    PRODUCTS.mkdir(parents=True, exist_ok=True)
    TERMS.mkdir(parents=True, exist_ok=True)

    # Two-character ID buckets: ~256 compact files instead of loading multi-megabyte one-character buckets on mobile.
    buckets: dict[str, dict[str, dict]] = collections.defaultdict(dict)
    for r in rows:
        rid = str(r.get("id") or "")
        if not re.fullmatch(r"[a-f0-9]{14}", rid):
            continue
        buckets[rid[:2]][rid] = r
    for prefix, data in buckets.items():
        (PRODUCTS / f"{prefix}.json").write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    # Token index remains token-prefix sharded; each result points to stable 14-char IDs.
    row_tokens: dict[str, list[str]] = {}
    freq = collections.Counter()
    for r in rows:
        rid = str(r.get("id") or "")
        ts = list(dict.fromkeys(tokens(r.get("s") or r.get("t"))))[:30]
        row_tokens[rid] = ts
        freq.update(ts)

    order = sorted(rows, key=lambda r: (
        r.get("ro") in {"main", "used"},
        bool(r.get("x")),
        bool(r.get("im")),
        float(r.get("p") or 0),
    ), reverse=True)
    term_ids: dict[str, list[str]] = collections.defaultdict(list)
    for r in order:
        rid = str(r.get("id") or "")
        for token in row_tokens.get(rid, []):
            if freq[token] <= 3000 and len(term_ids[token]) < 1000:
                term_ids[token].append(rid)

    shards: dict[str, dict[str, list[str]]] = collections.defaultdict(dict)
    for token, ids in term_ids.items():
        prefix = (re.sub(r"[^a-z0-9]", "", token)[:2] or "__").ljust(2, "_")
        shards[prefix][token] = ids
    for prefix, data in shards.items():
        (TERMS / f"{prefix}.json").write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    sizes = [p.stat().st_size for p in PRODUCTS.glob("*.json")]
    runtime = {
        "version": VERSION,
        "records": len(rows),
        "productBuckets": len(buckets),
        "termShards": len(shards),
        "maxProductBucketBytes": max(sizes) if sizes else 0,
        "averageProductBucketBytes": round(sum(sizes) / max(1, len(sizes))),
        "mobileBucketStrategy": "two-character stable-ID prefix",
    }
    (OUT / "runtime-manifest.json").write_text(json.dumps(runtime, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(runtime, indent=2))


if __name__ == "__main__":
    main()
