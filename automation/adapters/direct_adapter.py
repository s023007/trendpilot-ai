from __future__ import annotations

from pathlib import Path
from typing import Iterator

from .common import (
    canonical_key,
    load_affiliate_links,
    now_iso,
    offer_key,
    quality_score,
    safe_url,
    text,
)


def iter_offers(source: dict, root: Path, allowed_schemes: set[str]) -> Iterator[dict]:
    links = load_affiliate_links(root)
    direct = source.get("directOffer") or {}
    affiliate_key = text(direct.get("affiliateKey"))
    link = links.get(affiliate_key, {}) if affiliate_key else {}
    affiliate_url = safe_url(
        direct.get("affiliateUrl") or link.get("affiliateUrl"),
        allowed_schemes,
    )
    if not affiliate_url:
        return

    name = text(direct.get("name") or source.get("advertiser") or affiliate_key)
    category = text(direct.get("category"))
    source_id = text(source.get("id"))
    product_id = text(direct.get("productId") or affiliate_key or source_id)

    offer = {
        "schemaVersion": "1.0",
        "offerKey": offer_key(source_id, product_id, affiliate_url),
        "canonicalKey": canonical_key(name, direct.get("brand"), category),
        "sourceId": source_id,
        "sourceType": "direct",
        "network": text(source.get("network") or "Direct"),
        "advertiser": text(source.get("advertiser") or name),
        "programme": text(source.get("programme") or name),
        "productId": product_id,
        "merchantId": "",
        "name": name,
        "description": text(direct.get("description")),
        "category": category,
        "brand": text(direct.get("brand")),
        "affiliateUrl": affiliate_url,
        "productUrl": safe_url(
            direct.get("productUrl") or link.get("productUrl"),
            allowed_schemes,
        ),
        "imageUrl": safe_url(direct.get("imageUrl"), allowed_schemes),
        "price": direct.get("price"),
        "oldPrice": direct.get("oldPrice"),
        "currency": text(direct.get("currency") or "USD"),
        "commissionRate": direct.get("commissionRate"),
        "commissionValue": direct.get("commissionValue"),
        "commissionType": text(direct.get("commissionType") or "programme"),
        "discountPercent": direct.get("discountPercent"),
        "available": True,
        "countries": source.get("countries", ["GLOBAL"]),
        "updatedAt": now_iso(),
        "tags": direct.get("tags", []),
        "rules": source.get("rules", {}),
        "offerType": "direct",
        "affiliateKey": affiliate_key,
    }
    offer["qualityScore"] = quality_score(offer)
    yield offer
