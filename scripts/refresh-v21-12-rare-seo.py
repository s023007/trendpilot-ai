#!/usr/bin/env python3
from __future__ import annotations

import html
import json
import re
from pathlib import Path
from urllib.parse import quote_plus

ROOT = Path(__file__).resolve().parents[1]
RARE = ROOT / "data/v20-8/rare-index.json"
OUT = ROOT / "rare-used/finds"
VERSION = "21.12.0"


def esc(v) -> str:
    return html.escape(str(v or ""), quote=True)


def clean(v) -> str:
    return re.sub(r"\s+", " ", str(v or "")).strip()


def clean_title(v) -> str:
    s = clean(v)
    s = re.sub(r"^\s*(?:\[(?:free\s+shipping|hot\s+sale|new\s+arrival|best\s+seller)\]\s*|(?:free\s+shipping|hot\s+sale|new\s+arrival|best\s+seller)\s*[:\-–—]?\s*)+", "", s, flags=re.I)
    s = re.sub(r"\bfor\s+for\b", "for", s, flags=re.I)
    return re.sub(r"^\s*/+", "", s).strip()


def codes(title: str) -> list[str]:
    found = re.findall(r"\b(?:[A-Z]{1,8}[A-Z0-9-]*\d[A-Z0-9-]*|\d{5,}-\d{2,})\b", title, flags=re.I)
    out: list[str] = []
    for token in found:
        token = token.upper()
        if 3 <= len(token) <= 24 and token not in out:
            out.append(token)
        if len(out) >= 4:
            break
    return out


def summary(r: dict) -> str:
    title = clean_title(r.get("title"))
    sig = set(map(str, r.get("signals") or []))
    c = codes(title)
    model = f" Models or part numbers mentioned: {', '.join(c)}." if c else ""
    if r.get("role") == "replacement_part" or "replacement-part" in sig:
        return f"This is a specialist replacement component, not the complete device.{model} Use it only when the identifiers match the equipment you are repairing."
    if "used-scarce" in sig:
        return "This is a scarce used or pre-owned listing. Check condition, included parts and seller photos before buying."
    if "collector" in sig:
        return "This is a collector-focused item that may be difficult to replace through normal retail channels. Check authenticity, condition and completeness."
    if "discontinued" in sig:
        return f"This appears to be an older or discontinued item.{model} Confirm the exact version and compatibility before buying."
    if "specialist" in sig:
        return f"This is a specialist product intended for a specific use or model.{model} Check the exact seller listing before ordering."
    return f"This is a hard-to-find {clean(r.get('typeLabel') or r.get('type') or 'product').lower()}.{model} Confirm the exact model, condition and compatibility before buying."


def why_rare(r: dict) -> str:
    sig = set(map(str, r.get("signals") or []))
    if "used-scarce" in sig:
        return "It is included because the listing is scarce and used or pre-owned rather than ordinary current retail stock."
    if "replacement-part" in sig:
        return "It is model-specific replacement stock, which is often harder to locate than complete current-generation products."
    if "collector" in sig:
        return "It is intended for collectors or a niche audience, so comparable listings can be limited."
    if "discontinued" in sig:
        return "It is linked to an older or discontinued product line, so availability may be limited."
    return "It is a specialist or unusually specific listing that is less common than ordinary catalogue products."


def rarity(score) -> str:
    score = int(score or 0)
    if score >= 90: return "Exceptional find"
    if score >= 80: return "Very rare"
    if score >= 65: return "Hard to find"
    return "Specialist find"


def money(r: dict) -> str:
    try:
        p = float(r.get("price") or 0)
    except Exception:
        p = 0
    if p <= 0:
        return "Check current price"
    cur = str(r.get("currency") or "USD")
    return f"US${p:,.2f}" if cur == "USD" else f"{cur} {p:,.2f}"


def seller_cta(r: dict) -> tuple[str, str]:
    seller = clean(r.get("seller") or "Seller")
    url = clean(r.get("url"))
    if not url:
        return "", "A seller link is not currently available."
    if r.get("exact"):
        label = f"View product on {seller} ↗"
        note = "This listing has product-specific destination evidence. Confirm stock and the final checkout price with the seller."
    elif str(r.get("sellerSlug") or "") == "tiktok-shop-us":
        label = "Check TikTok availability ↗"
        note = "Availability can vary by buyer location, account eligibility and stock."
    else:
        label = f"Search {seller} for this product ↗"
        note = "This destination may be broader than the exact product. Match the model or part number before buying."
    return f'<a class="tp80-primary tp80-seller-exit" href="{esc(url)}" target="_blank" rel="sponsored nofollow noopener">{esc(label)}</a>', note


def render(r: dict) -> str:
    title = clean_title(r.get("title"))
    description = summary(r)
    canonical = f"https://trendpilotchoice.com{r['seoUrl']}"
    image = clean(r.get("image"))
    seller = clean(r.get("seller"))
    cta, exit_note = seller_cta(r)
    signal_names = {
        "used-scarce": "Used & scarce",
        "replacement-part": "Replacement part",
        "collector": "Collector item",
        "discontinued": "Discontinued",
        "specialist": "Specialist",
        "model-specific": "Model specific",
    }
    signals = "".join(f'<span>{esc(signal_names.get(str(x), str(x).replace("-", " ").title()))}</span>' for x in (r.get("signals") or [])[:5])
    ld = {
        "@context": "https://schema.org", "@type": "Product", "name": title,
        "image": [image] if image else [], "description": description,
    }
    if r.get("brand"):
        ld["brand"] = {"@type": "Brand", "name": clean(r["brand"])}
    if r.get("exact") and r.get("price") and r.get("url"):
        ld["offers"] = {"@type": "Offer", "priceCurrency": r.get("currency") or "USD", "price": r.get("price"), "url": r.get("url"), "seller": {"@type": "Organization", "name": seller}}
    structured = json.dumps(ld, ensure_ascii=False).replace("</", "<\\/")
    similar = f"/find/?q={quote_plus(title)}&engine=v2064"
    return f'''<!doctype html><html lang="en"><head><meta name="color-scheme" content="dark"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#0d1630"><meta name="robots" content="index,follow,max-image-preview:large"><title>{esc(title)} — Rare Find | TrendPilot AI</title><meta name="description" content="{esc(description)}"><link rel="canonical" href="{esc(canonical)}"><meta property="og:type" content="product"><meta property="og:site_name" content="TrendPilot AI"><meta property="og:title" content="{esc(title)}"><meta property="og:description" content="{esc(description)}"><meta property="og:image" content="{esc(image)}"><meta property="og:url" content="{esc(canonical)}"><meta name="twitter:card" content="summary_large_image"><link rel="icon" href="/images/favicon-v4.svg" type="image/svg+xml"><link rel="stylesheet" href="/css/v20-8-universal.css?v=20.8.9"><link rel="stylesheet" href="/css/v20-8-9-rare-closeout.css?v=20.8.9"><link rel="stylesheet" href="/css/trendpilot-calm-dark-v21.css?v=21.0.0"><link rel="stylesheet" href="/css/trendpilot-graphite-navy-v21-1.css?v=21.2.0"><link rel="stylesheet" href="/css/trendpilot-v21-2-1-final.css?v={VERSION}"><script type="application/ld+json">{structured}</script></head><body class="tp80-rare-detail"><header class="tp80-minihead"><a href="/"><img src="/images/logo-v4.svg" alt="" width="42" height="42"><b>TrendPilot <em>AI</em></b></a><a href="/rare-used/">← Back to Rare Finds</a></header><main><nav class="tp80-breadcrumb"><a href="/">Home</a> / <a href="/rare-used/">Rare Finds</a> / <span>{esc(r.get('typeLabel') or r.get('type'))}</span></nav><section class="tp80-detail-hero"><div class="tp80-detail-media"><img src="{esc(image)}" alt="{esc(title)}" width="800" height="800"></div><div class="tp80-detail-copy"><span class="tp80-rare-score">{esc(rarity(r.get('rareScore')))}</span><p class="tp80-brand">{esc(r.get('brand') or seller)}</p><h1>{esc(title)}</h1><p class="tp80-detail-summary">{esc(description)}</p><div class="tp80-price-block"><p class="tp80-price">{esc(money(r))}</p></div><div class="tp80-signals">{signals}</div><div class="tp80-facts"><span><b>Seller</b>{esc(seller)}</span><span><b>Category</b>{esc(r.get('typeLabel') or r.get('type'))}</span><span><b>Condition</b>{esc(r.get('condition') or 'Check seller')}</span></div>{cta}<p class="tp80-note">{esc(exit_note)}</p></div></section><section class="tp80-info tp80-plain-explain"><h2>What is this product?</h2><p>{esc(description)}</p><h3>Why it is in Rare Finds</h3><p>{esc(why_rare(r))}</p></section><section class="tp80-info"><h2>Before you buy</h2><p>Confirm the exact model or part number, condition, current price, stock, delivery and return terms with the seller. Replacement components should only be bought when their identifiers match your device.</p><a href="{esc(similar)}">Find similar products</a></section></main><nav class="tp80-bottom"><a href="/">Home</a><a href="/find/">Search</a><a class="active" href="/rare-used/">Rare Finds</a><a href="/compare/">Compare</a></nav></body></html>'''


def main() -> None:
    rows = json.loads(RARE.read_text(encoding="utf-8"))
    written = 0
    missing = 0
    for r in rows:
        seo = str(r.get("seoUrl") or "")
        if not seo.startswith("/rare-used/finds/"):
            continue
        slug = seo.rstrip("/").split("/")[-1]
        target = OUT / slug / "index.html"
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(render(r), encoding="utf-8")
        written += 1
        if not r.get("image") or not r.get("seller"):
            missing += 1
    print(json.dumps({"version": VERSION, "rare_rows": len(rows), "seo_pages_written": written, "rows_missing_image_or_seller": missing}, indent=2))


if __name__ == "__main__":
    main()
