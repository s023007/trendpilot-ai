from __future__ import annotations

import hashlib
import html
import json
import math
import os
import re
import urllib.parse
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable, Mapping, Optional


def text(value: object) -> str:
    return html.unescape(str(value or "")).strip()


def normalise(value: object) -> str:
    value = text(value).lower()
    value = re.sub(r"[\u2010-\u2015]", "-", value)
    value = re.sub(r"[^a-z0-9%$€£+.\- ]+", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def has_term(haystack: object, term: object) -> bool:
    hay = normalise(haystack)
    needle = normalise(term)
    if not hay or not needle:
        return False
    return re.search(rf"(?:^| ){re.escape(needle)}(?:$| )", hay) is not None


def parse_number(value: object) -> Optional[float]:
    raw = text(value).replace(",", "").replace("%", "")
    match = re.search(r"-?\d+(?:\.\d+)?", raw)
    if not match:
        return None
    try:
        number = float(match.group(0))
        return number if math.isfinite(number) else None
    except ValueError:
        return None


def parse_param(param: str, key: str) -> str:
    match = re.search(rf"(?:^|;){re.escape(key)}\|([^|;]*)\|", param or "", re.I)
    return match.group(1).strip() if match else ""


def safe_url(value: object, allowed_schemes: set[str]) -> str:
    raw = text(value)
    if not raw:
        return ""
    try:
        parsed = urllib.parse.urlparse(raw)
    except ValueError:
        return ""
    if parsed.scheme.lower() not in allowed_schemes or not parsed.netloc:
        return ""
    return raw


def first_value(row: Mapping[str, object], aliases: Iterable[str]) -> str:
    lower_lookup = {str(key).lower(): key for key in row.keys()}
    for alias in aliases:
        real_key = lower_lookup.get(str(alias).lower())
        if real_key is not None and text(row.get(real_key)):
            return text(row.get(real_key))
    return ""


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def load_json(path: Path, fallback: object) -> object:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return json.loads(json.dumps(fallback))


def load_affiliate_links(root: Path) -> dict[str, dict]:
    path = root / "js" / "affiliate-links.js"
    if not path.exists():
        return {}
    content = path.read_text(encoding="utf-8", errors="replace")
    start = content.find("{")
    marker = content.find("};", start)
    if start < 0 or marker < 0:
        return {}
    raw = content[start : marker + 1]
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {}


def resolve_location(source: dict, root: Path) -> tuple[str, str]:
    location = source.get("location") or {}
    kind = text(location.get("type"))

    if kind == "local_file":
        value = text(location.get("path"))
        return kind, str(root / value) if value else ""

    if kind == "environment_url":
        variable = text(location.get("environmentVariable"))
        return kind, os.environ.get(variable, "").strip()

    if kind == "secret_map":
        variable = text(location.get("environmentVariable") or "AFFILIATE_SOURCE_URLS_JSON")
        secret_key = text(location.get("secretKey") or source.get("id"))
        raw = os.environ.get(variable, "").strip()
        if not raw:
            return kind, ""
        try:
            mapping = json.loads(raw)
        except json.JSONDecodeError:
            return kind, ""
        return kind, text(mapping.get(secret_key))

    if kind == "public_url":
        return kind, text(location.get("url"))

    if kind == "direct":
        return kind, "direct"

    return kind, ""


def significant_tokens(value: object) -> list[str]:
    stop = {
        "for", "with", "and", "the", "new", "original", "official", "2024",
        "2025", "2026", "2027", "pcs", "piece", "pieces", "set", "kit",
        "black", "white", "red", "blue", "green", "pink", "gold", "silver",
    }
    output: list[str] = []
    for token in normalise(value).split():
        if token in stop or len(token) < 2:
            continue
        if token not in output:
            output.append(token)
    return output


def canonical_key(name: object, brand: object = "", category: object = "") -> str:
    tokens = significant_tokens(f"{brand} {name}")
    if not tokens:
        tokens = significant_tokens(category)
    stable = " ".join(tokens[:14])
    return hashlib.sha1(stable.encode("utf-8")).hexdigest()[:20]


def offer_key(source_id: str, product_id: object, affiliate_url: object) -> str:
    stable = f"{source_id}|{text(product_id) or text(affiliate_url)}"
    return hashlib.sha1(stable.encode("utf-8")).hexdigest()[:24]


def availability_value(value: object) -> bool:
    raw = normalise(value)
    if not raw:
        return True
    return raw not in {
        "0", "false", "no", "out of stock", "unavailable",
        "discontinued", "sold out", "inactive",
    }


def quality_score(offer: dict) -> float:
    score = 20.0
    if offer.get("affiliateUrl"):
        score += 22
    if offer.get("name"):
        score += 12
    if offer.get("imageUrl"):
        score += 8
    if offer.get("price") is not None:
        score += 8
    if offer.get("commissionRate") is not None or offer.get("commissionValue") is not None:
        score += 9
    if offer.get("category"):
        score += 5
    if offer.get("advertiser"):
        score += 4
    if offer.get("available", True):
        score += 5
    if offer.get("discountPercent") is not None:
        score += min(7, max(0, float(offer["discountPercent"])) / 10)
    return round(min(100.0, score), 2)


def build_offer_from_row(
    row: Mapping[str, object],
    source: dict,
    allowed_schemes: set[str],
) -> Optional[dict]:
    field_map = source.get("fieldMap") or {}

    def mapped(name: str) -> str:
        aliases = field_map.get(name, [])
        if isinstance(aliases, str):
            aliases = [aliases]
        return first_value(row, aliases)

    param = mapped("param")
    param_fields = source.get("paramFields") or {}

    def param_value(name: str) -> str:
        key = text(param_fields.get(name))
        return parse_param(param, key) if key else ""

    affiliate_url = safe_url(mapped("affiliateUrl") or mapped("url"), allowed_schemes)
    name = mapped("name") or mapped("title")
    if not affiliate_url or not name:
        return None

    price = parse_number(mapped("price"))
    old_price = parse_number(mapped("oldPrice"))
    commission_rate = parse_number(mapped("commissionRate") or param_value("commissionRate"))
    commission_value = parse_number(mapped("commissionValue") or param_value("commissionValue"))
    discount = parse_number(mapped("discountPercent") or param_value("discountPercent"))
    if discount is None and price is not None and old_price and old_price > price:
        discount = max(0.0, min(100.0, (old_price - price) / old_price * 100.0))

    product_id = mapped("productId") or mapped("id") or affiliate_url
    category = mapped("category")
    brand = mapped("brand")
    advertiser = mapped("advertiser") or text(source.get("advertiser"))
    network = text(source.get("network") or "Direct")
    source_id = text(source.get("id"))
    programme = text(source.get("programme") or advertiser)
    currency = mapped("currency") or text(source.get("defaultCurrency") or "USD")

    tags = []
    raw_tags = mapped("tags")
    if raw_tags:
        separator = text(source.get("tagSeparator") or ",")
        tags = [text(item) for item in raw_tags.split(separator) if text(item)]

    offer = {
        "schemaVersion": "1.0",
        "offerKey": offer_key(source_id, product_id, affiliate_url),
        "canonicalKey": canonical_key(name, brand, category),
        "sourceId": source_id,
        "sourceType": text(source.get("adapter")),
        "network": network,
        "advertiser": advertiser,
        "programme": programme,
        "productId": text(product_id),
        "merchantId": mapped("merchantId") or param_value("merchantId"),
        "name": text(name),
        "description": mapped("description"),
        "category": category,
        "brand": brand,
        "affiliateUrl": affiliate_url,
        "productUrl": safe_url(mapped("productUrl"), allowed_schemes),
        "imageUrl": safe_url(mapped("imageUrl") or mapped("image"), allowed_schemes),
        "price": price,
        "oldPrice": old_price,
        "currency": currency,
        "commissionRate": commission_rate,
        "commissionValue": commission_value,
        "commissionType": mapped("commissionType") or text(source.get("commissionType")),
        "discountPercent": discount,
        "available": availability_value(mapped("availability")),
        "countries": source.get("countries", ["GLOBAL"]),
        "updatedAt": mapped("updatedAt") or now_iso(),
        "tags": tags,
        "rules": source.get("rules", {}),
        "offerType": "product",
    }
    offer["qualityScore"] = quality_score(offer)
    return offer
