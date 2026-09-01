#!/usr/bin/env python3
"""Read-only multi-seller Google Ads rare-search opportunity engine.

Purpose:
- Compare keyword demand, competition and bid ranges by geo.
- Rank opportunities across active affiliate sellers/categories.
- Produce JSON/CSV/Markdown research outputs.

Safety:
- This script performs Google Ads READ-ONLY planning calls only.
- It never creates/edits campaigns, ads, budgets, keywords or bids.
"""

from __future__ import annotations

import csv
import json
import math
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from google.ads.googleads.client import GoogleAdsClient
from google.ads.googleads.errors import GoogleAdsException

CONFIG_PATH = Path(
    os.getenv(
        "RARE_SEARCH_ENGINE_CONFIG",
        "marketing/google-ads/rare-search-opportunities/engine-config.json",
    )
)
OUT_DIR = Path("marketing/google-ads/rare-search-opportunities")
JSON_OUT = OUT_DIR / "latest.json"
CSV_OUT = OUT_DIR / "latest.csv"
MD_OUT = OUT_DIR / "summary.md"
ERROR_OUT = OUT_DIR / "error.json"

REQUIRED = [
    "GOOGLE_ADS_DEVELOPER_TOKEN",
    "GOOGLE_ADS_CLIENT_ID",
    "GOOGLE_ADS_CLIENT_SECRET",
    "GOOGLE_ADS_REFRESH_TOKEN",
    "GOOGLE_ADS_CUSTOMER_ID",
    "GOOGLE_ADS_LOGIN_CUSTOMER_ID",
]


def load_config() -> dict[str, Any]:
    return json.loads(CONFIG_PATH.read_text(encoding="utf-8"))


def load_client() -> tuple[GoogleAdsClient, str]:
    missing = [x for x in REQUIRED if not os.getenv(x)]
    if missing:
        raise RuntimeError("Missing required GitHub secrets: " + ", ".join(missing))
    client = GoogleAdsClient.load_from_dict(
        {
            "developer_token": os.environ["GOOGLE_ADS_DEVELOPER_TOKEN"],
            "client_id": os.environ["GOOGLE_ADS_CLIENT_ID"],
            "client_secret": os.environ["GOOGLE_ADS_CLIENT_SECRET"],
            "refresh_token": os.environ["GOOGLE_ADS_REFRESH_TOKEN"],
            "login_customer_id": os.environ["GOOGLE_ADS_LOGIN_CUSTOMER_ID"].replace("-", "").strip(),
            "use_proto_plus": True,
        }
    )
    cid = os.environ["GOOGLE_ADS_CUSTOMER_ID"].replace("-", "").strip()
    return client, cid


def enum_name(value: Any) -> str:
    try:
        return value.name
    except AttributeError:
        return str(value)


def proto_has(message: Any, field: str) -> bool:
    pb = getattr(message, "_pb", message)
    try:
        return bool(pb.HasField(field))
    except (ValueError, AttributeError):
        return True


def optional_int(message: Any, field: str) -> int | None:
    if not proto_has(message, field):
        return None
    value = getattr(message, field, None)
    return None if value is None else int(value)


def usd(micros: int | None) -> float | None:
    return None if micros is None else round(micros / 1_000_000, 2)


def resolve_geo(client: GoogleAdsClient, name: str, country_code: str) -> str:
    service = client.get_service("GeoTargetConstantService")
    request = client.get_type("SuggestGeoTargetConstantsRequest")
    request.locale = "en"
    request.country_code = country_code
    request.location_names.names.append(name)
    response = service.suggest_geo_target_constants(request=request)
    candidates = [s.geo_target_constant for s in response.geo_target_constant_suggestions]
    exact = [
        g for g in candidates
        if g.country_code == country_code and g.name.lower() == name.lower()
    ]
    if not exact:
        raise RuntimeError(f"Could not resolve geo: {name}")
    # Prefer state/region for US state names.
    exact.sort(key=lambda g: 0 if str(g.target_type).lower() in {"state", "region"} else 1)
    return exact[0].resource_name


def batches(items: list[str], size: int) -> list[list[str]]:
    return [items[i:i + size] for i in range(0, len(items), size)]


def historical_metrics(
    client: GoogleAdsClient,
    customer_id: str,
    geo_resource: str,
    keywords: list[str],
    language_id: str,
) -> list[Any]:
    service = client.get_service("KeywordPlanIdeaService")
    request = client.get_type("GenerateKeywordHistoricalMetricsRequest")
    request.customer_id = customer_id
    request.keywords.extend(keywords)
    request.geo_target_constants.append(geo_resource)
    request.language = f"languageConstants/{language_id}"
    request.keyword_plan_network = client.enums.KeywordPlanNetworkEnum.GOOGLE_SEARCH
    return list(service.generate_keyword_historical_metrics(request=request).results)


def metric_row(family: dict[str, Any], geo: str, result: Any) -> dict[str, Any]:
    m = result.keyword_metrics
    competition = enum_name(m.competition)
    if competition in {"UNSPECIFIED", "UNKNOWN", "0"}:
        competition = "UNKNOWN"
    return {
        "family_id": family["id"],
        "seller": family["seller"],
        "network": family.get("network"),
        "category": family["category"],
        "geo": geo,
        "keyword": result.text,
        "avg_monthly_searches": int(m.avg_monthly_searches or 0),
        "competition": competition,
        "competition_index": optional_int(m, "competition_index"),
        "low_top_bid_usd": usd(optional_int(m, "low_top_of_page_bid_micros")),
        "high_top_bid_usd": usd(optional_int(m, "high_top_of_page_bid_micros")),
        "close_variants": list(result.close_variants),
        "commission_note": family.get("commission_note", ""),
        "shipping_note": family.get("shipping_note", ""),
        "policy_guard": family.get("policy_guard", ""),
    }


def score_rows(rows: list[dict[str, Any]], config: dict[str, Any]) -> None:
    weights = config.get("scoring", {})
    sw = float(weights.get("search_weight", 45))
    cw = float(weights.get("competition_weight", 25))
    bw = float(weights.get("bid_weight", 15))
    iw = float(weights.get("intent_weight", 15))
    intent_map = weights.get("intent_multipliers", {})

    max_search = max((r["avg_monthly_searches"] for r in rows), default=1)
    max_log = max(math.log1p(max_search), 1.0)

    for r in rows:
        volume = math.log1p(r["avg_monthly_searches"]) / max_log if r["avg_monthly_searches"] else 0.0
        ci = r["competition_index"]
        comp = 0.55 if ci is None else max(0.0, 1.0 - ci / 100.0)
        high = r["high_top_bid_usd"]
        if high is None:
            bid = 0.65
        else:
            bid = max(0.05, min(1.0, 0.75 / max(high, 0.05)))
        intent = min(1.5, float(intent_map.get(r["category"], 1.0))) / 1.5

        raw = sw * volume + cw * comp + bw * bid + iw * intent
        r["opportunity_score"] = round(raw, 1)
        r["data_confidence"] = "HIGH" if ci is not None else "MEDIUM"


def eligible(r: dict[str, Any], config: dict[str, Any]) -> bool:
    min_search = int(config.get("min_monthly_searches", 10))
    max_ci = int(config.get("max_competition_index", 35))
    max_high = float(config.get("max_high_top_bid_usd", 2.5))
    if r["avg_monthly_searches"] < min_search:
        return False
    if r["competition_index"] is not None and r["competition_index"] > max_ci:
        return False
    if r["high_top_bid_usd"] is not None and r["high_top_bid_usd"] > max_high:
        return False
    return True


def write_outputs(rows: list[dict[str, Any]], config: dict[str, Any]) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    rows.sort(key=lambda r: (-r["opportunity_score"], -r["avg_monthly_searches"], r["seller"], r["geo"]))
    filtered = [r for r in rows if eligible(r, config)]

    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "mode": "READ_ONLY",
        "config_version": config.get("version"),
        "rows_scanned": len(rows),
        "eligible_rows": len(filtered),
        "top_opportunities": filtered[:250],
        "all_rows": rows,
    }
    JSON_OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    fields = [
        "opportunity_score", "seller", "category", "geo", "keyword",
        "avg_monthly_searches", "competition", "competition_index",
        "low_top_bid_usd", "high_top_bid_usd", "data_confidence",
        "commission_note", "shipping_note", "policy_guard"
    ]
    with CSV_OUT.open("w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
        w.writeheader()
        w.writerows(filtered if filtered else rows)

    lines = [
        "# Rare Search Opportunity Engine",
        "",
        f"Generated: {payload['generated_at']}",
        f"Rows scanned: **{len(rows)}**",
        f"Eligible rows: **{len(filtered)}**",
        "",
        "## Top opportunities",
        "",
        "| Score | Seller | Category | Geo | Keyword | Searches | Competition | CI | Low bid | High bid |",
        "|---:|---|---|---|---|---:|---|---:|---:|---:|",
    ]
    for r in filtered[:40]:
        lines.append(
            f"| {r['opportunity_score']} | {r['seller']} | {r['category']} | {r['geo']} | "
            f"{r['keyword']} | {r['avg_monthly_searches']} | {r['competition']} | "
            f"{'' if r['competition_index'] is None else r['competition_index']} | "
            f"{'' if r['low_top_bid_usd'] is None else '$'+str(r['low_top_bid_usd'])} | "
            f"{'' if r['high_top_bid_usd'] is None else '$'+str(r['high_top_bid_usd'])} |"
        )
    if not filtered:
        lines.append("| - | - | - | - | No rows passed the current filters | - | - | - | - | - |")
    lines += [
        "",
        "## Safety",
        "",
        "This workflow uses Google Ads planning/read-only services only. No campaign mutation is performed.",
        "Each opportunity must still pass the advertiser's current paid-search terms and Google Ads policy review before launch.",
    ]
    MD_OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    config = load_config()
    client, cid = load_client()
    all_rows: list[dict[str, Any]] = []
    geo_cache: dict[str, str] = {}
    country = config.get("country_code", "US")
    language = str(config.get("language_constant_id", "1000"))
    batch_size = int(config.get("batch_size", 50))

    print("RARE SEARCH OPPORTUNITY ENGINE — READ ONLY")
    print(f"Families: {len(config['families'])}")

    for family in config["families"]:
        geos = config["geo_sets"][family["geo_set"]]
        keywords = list(dict.fromkeys(k.strip() for k in family["keywords"] if k.strip()))
        print(f"\n=== {family['seller']} | {family['category']} | {len(keywords)} keywords ===")
        for geo in geos:
            if geo not in geo_cache:
                geo_cache[geo] = resolve_geo(client, geo, country)
            for chunk in batches(keywords, batch_size):
                for result in historical_metrics(client, cid, geo_cache[geo], chunk, language):
                    all_rows.append(metric_row(family, geo, result))

    score_rows(all_rows, config)
    write_outputs(all_rows, config)
    if ERROR_OUT.exists():
        ERROR_OUT.unlink()
    print(f"\nDONE: {len(all_rows)} keyword/geo rows")
    print(f"CSV: {CSV_OUT}")
    print("No Google Ads mutation performed.")


if __name__ == "__main__":
    try:
        main()
    except GoogleAdsException as exc:
        OUT_DIR.mkdir(parents=True, exist_ok=True)
        errors = []
        for error in exc.failure.errors:
            errors.append({
                "code": str(error.error_code),
                "message": error.message,
            })
        payload = {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "status": "FAILED",
            "request_id": exc.request_id,
            "errors": errors,
            "note": "If the message says Keyword Planner is not allowed with Explorer Access, wait for Google Ads API Basic Access approval and rerun the workflow.",
        }
        ERROR_OUT.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        print(f"Google Ads API error. Request ID: {exc.request_id}", file=sys.stderr)
        for e in errors:
            print(f"- {e['code']}: {e['message']}", file=sys.stderr)
        sys.exit(1)
    except Exception as exc:
        OUT_DIR.mkdir(parents=True, exist_ok=True)
        ERROR_OUT.write_text(
            json.dumps({
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "status": "FAILED",
                "error": f"{type(exc).__name__}: {exc}",
            }, indent=2),
            encoding="utf-8",
        )
        raise
