#!/usr/bin/env python3
"""Read-only Google Ads Keyword Planner scanner for Diecast geo opportunities.

This script NEVER creates or edits campaigns, ads, budgets, keywords, or bids.
It only calls KeywordPlanIdeaService / GeoTargetConstantService and writes
research files into marketing/google-ads/rare-geo-products/.
"""

from __future__ import annotations

import csv
import json
import math
import os
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

from google.ads.googleads.client import GoogleAdsClient
from google.ads.googleads.errors import GoogleAdsException

CONFIG_PATH = Path(
    os.getenv(
        "DIECAST_SCANNER_CONFIG",
        "marketing/google-ads/rare-geo-products/diecast-us-opportunity-config.json",
    )
)
OUT_DIR = Path("marketing/google-ads/rare-geo-products")
JSON_OUT = OUT_DIR / "diecast-us-opportunity-latest.json"
CSV_OUT = OUT_DIR / "diecast-us-opportunity-latest.csv"
MD_OUT = OUT_DIR / "diecast-us-opportunity-summary.md"
ERROR_OUT = OUT_DIR / "diecast-us-opportunity-error.json"

REQUIRED_SECRETS = [
    "GOOGLE_ADS_DEVELOPER_TOKEN",
    "GOOGLE_ADS_CLIENT_ID",
    "GOOGLE_ADS_CLIENT_SECRET",
    "GOOGLE_ADS_REFRESH_TOKEN",
    "GOOGLE_ADS_CUSTOMER_ID",
    "GOOGLE_ADS_LOGIN_CUSTOMER_ID",
]

BRAND_HINTS = {
    "Ignition Model": ["ignition"],
    "Pop Race": ["pop race"],
    "Mini GT": ["mini gt"],
    "Tarmac Works": ["tarmac"],
    "INNO64": ["inno64", "inno models", "inno model"],
    "Kaido House": ["kaido"],
}

RELEVANCE_TERMS = (
    "diecast",
    "1 64",
    "1/64",
    "model car",
    "ignition",
    "pop race",
    "mini gt",
    "tarmac",
    "inno",
    "kaido",
    "supra",
    "rx7",
    "rwb",
    "skyline",
    "r34",
    "ford gt",
    "jdm",
)


def load_client() -> tuple[GoogleAdsClient, str]:
    missing = [name for name in REQUIRED_SECRETS if not os.getenv(name)]
    if missing:
        raise RuntimeError("Missing required GitHub secrets: " + ", ".join(missing))

    client = GoogleAdsClient.load_from_dict(
        {
            "developer_token": os.environ["GOOGLE_ADS_DEVELOPER_TOKEN"],
            "client_id": os.environ["GOOGLE_ADS_CLIENT_ID"],
            "client_secret": os.environ["GOOGLE_ADS_CLIENT_SECRET"],
            "refresh_token": os.environ["GOOGLE_ADS_REFRESH_TOKEN"],
            "login_customer_id": os.environ["GOOGLE_ADS_LOGIN_CUSTOMER_ID"]
            .replace("-", "")
            .strip(),
            "use_proto_plus": True,
        }
    )
    customer_id = os.environ["GOOGLE_ADS_CUSTOMER_ID"].replace("-", "").strip()
    return client, customer_id


def proto_has(message: Any, field: str) -> bool:
    """Preserve the important distinction between real zero and unavailable."""
    pb = getattr(message, "_pb", message)
    try:
        return bool(pb.HasField(field))
    except (ValueError, AttributeError):
        return True


def optional_number(message: Any, field: str) -> int | None:
    if not proto_has(message, field):
        return None
    value = getattr(message, field, None)
    if value is None:
        return None
    return int(value)


def enum_name(value: Any) -> str:
    try:
        return value.name
    except AttributeError:
        return str(value)


def micros_to_usd(value: int | None) -> float | None:
    return None if value is None else round(value / 1_000_000, 2)


def resolve_state_geo(client: GoogleAdsClient, state: str, country_code: str) -> str:
    service = client.get_service("GeoTargetConstantService")
    request = client.get_type("SuggestGeoTargetConstantsRequest")
    request.locale = "en"
    request.country_code = country_code
    request.location_names.names.append(state)
    response = service.suggest_geo_target_constants(request=request)

    suggestions = list(response.geo_target_constant_suggestions)
    exact = [
        s.geo_target_constant
        for s in suggestions
        if s.geo_target_constant.country_code == country_code
        and s.geo_target_constant.name.lower() == state.lower()
        and str(s.geo_target_constant.target_type).lower() in {"state", "region"}
    ]
    if not exact:
        exact = [
            s.geo_target_constant
            for s in suggestions
            if s.geo_target_constant.country_code == country_code
            and s.geo_target_constant.name.lower() == state.lower()
        ]
    if not exact:
        rendered = [
            f"{s.geo_target_constant.name}/{s.geo_target_constant.target_type}"
            for s in suggestions[:8]
        ]
        raise RuntimeError(f"Could not resolve state '{state}'. Suggestions: {rendered}")
    return exact[0].resource_name


def group_lookup(config: dict[str, Any]) -> dict[str, str]:
    out: dict[str, str] = {}
    for group, keywords in config["keyword_groups"].items():
        for keyword in keywords:
            out[keyword.lower()] = group
    return out


def infer_group(keyword: str, explicit: dict[str, str]) -> str:
    k = keyword.lower().strip()
    if k in explicit:
        return explicit[k]
    for group, hints in BRAND_HINTS.items():
        if any(h in k for h in hints):
            return group
    return "Product intent"


def flatten_keywords(config: dict[str, Any]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for keywords in config["keyword_groups"].values():
        for keyword in keywords:
            key = keyword.lower().strip()
            if key and key not in seen:
                seen.add(key)
                out.append(keyword.strip())
    return out


def monthly_series(metrics: Any) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for item in metrics.monthly_search_volumes:
        month_name = enum_name(item.month)
        rows.append(
            {
                "year": int(item.year),
                "month": month_name,
                "monthly_searches": int(item.monthly_searches or 0),
            }
        )
    month_order = {
        "JANUARY": 1,
        "FEBRUARY": 2,
        "MARCH": 3,
        "APRIL": 4,
        "MAY": 5,
        "JUNE": 6,
        "JULY": 7,
        "AUGUST": 8,
        "SEPTEMBER": 9,
        "OCTOBER": 10,
        "NOVEMBER": 11,
        "DECEMBER": 12,
    }
    rows.sort(key=lambda x: (x["year"], month_order.get(x["month"], 0)))
    return rows


def three_month_change(months: list[dict[str, Any]]) -> float | None:
    if len(months) < 6:
        return None
    values = [float(x["monthly_searches"]) for x in months]
    recent = sum(values[-3:]) / 3
    previous = sum(values[-6:-3]) / 3
    if previous == 0:
        return None if recent == 0 else 100.0
    return round(((recent - previous) / previous) * 100, 1)


def row_from_metrics(
    state: str,
    source: str,
    keyword: str,
    metrics: Any,
    group: str,
    close_variants: Iterable[str] | None = None,
) -> dict[str, Any]:
    comp_index = optional_number(metrics, "competition_index")
    low_micros = optional_number(metrics, "low_top_of_page_bid_micros")
    high_micros = optional_number(metrics, "high_top_of_page_bid_micros")
    months = monthly_series(metrics)
    competition = enum_name(metrics.competition)
    if competition in {"UNSPECIFIED", "UNKNOWN", "0"}:
        competition = "UNKNOWN"
    return {
        "state": state,
        "source": source,
        "keyword": keyword,
        "group": group,
        "avg_monthly_searches": int(metrics.avg_monthly_searches or 0),
        "competition": competition,
        "competition_index": comp_index,
        "low_top_bid_usd": micros_to_usd(low_micros),
        "high_top_bid_usd": micros_to_usd(high_micros),
        "last3_change_pct": three_month_change(months),
        "monthly_search_volumes": months,
        "close_variants": list(close_variants or []),
    }


def historical_rows(
    client: GoogleAdsClient,
    customer_id: str,
    state: str,
    geo_resource: str,
    keywords: list[str],
    language_id: str,
    explicit_groups: dict[str, str],
) -> list[dict[str, Any]]:
    service = client.get_service("KeywordPlanIdeaService")
    request = client.get_type("GenerateKeywordHistoricalMetricsRequest")
    request.customer_id = customer_id
    request.keywords.extend(keywords)
    request.geo_target_constants.append(geo_resource)
    request.language = f"languageConstants/{language_id}"
    request.keyword_plan_network = client.enums.KeywordPlanNetworkEnum.GOOGLE_SEARCH
    response = service.generate_keyword_historical_metrics(request=request)

    rows: list[dict[str, Any]] = []
    for result in response.results:
        rows.append(
            row_from_metrics(
                state=state,
                source="seed",
                keyword=result.text,
                metrics=result.keyword_metrics,
                group=infer_group(result.text, explicit_groups),
                close_variants=result.close_variants,
            )
        )
    return rows


def idea_rows(
    client: GoogleAdsClient,
    customer_id: str,
    state: str,
    geo_resource: str,
    seeds: list[str],
    language_id: str,
    explicit_groups: dict[str, str],
    min_searches: int,
    max_ideas: int,
) -> list[dict[str, Any]]:
    service = client.get_service("KeywordPlanIdeaService")
    request = client.get_type("GenerateKeywordIdeasRequest")
    request.customer_id = customer_id
    request.language = f"languageConstants/{language_id}"
    request.geo_target_constants.append(geo_resource)
    request.keyword_plan_network = client.enums.KeywordPlanNetworkEnum.GOOGLE_SEARCH
    request.keyword_seed.keywords.extend(seeds)

    rows: list[dict[str, Any]] = []
    for result in service.generate_keyword_ideas(request=request):
        text = result.text.strip()
        lowered = text.lower()
        if not any(term in lowered for term in RELEVANCE_TERMS):
            continue
        metrics = result.keyword_idea_metrics
        if int(metrics.avg_monthly_searches or 0) < min_searches:
            continue
        rows.append(
            row_from_metrics(
                state=state,
                source="discovered",
                keyword=text,
                metrics=metrics,
                group=infer_group(text, explicit_groups),
            )
        )

    rows.sort(
        key=lambda x: (
            -x["avg_monthly_searches"],
            999 if x["competition_index"] is None else x["competition_index"],
            999 if x["low_top_bid_usd"] is None else x["low_top_bid_usd"],
        )
    )
    return rows[:max_ideas]


def dedupe(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    # Prefer a direct seed metric over an automatically discovered copy.
    priority = {"seed": 0, "discovered": 1}
    best: dict[tuple[str, str], dict[str, Any]] = {}
    for row in rows:
        key = (row["state"].lower(), row["keyword"].lower())
        current = best.get(key)
        if current is None or priority[row["source"]] < priority[current["source"]]:
            best[key] = row
    return list(best.values())


def add_scores(rows: list[dict[str, Any]]) -> None:
    max_searches = max((r["avg_monthly_searches"] for r in rows), default=0)
    max_volume = math.log1p(max_searches) or 1.0
    for row in rows:
        searches = row["avg_monthly_searches"]
        volume_factor = math.log1p(searches) / max_volume if searches else 0.0

        ci = row["competition_index"]
        competition_factor = 0.55 if ci is None else max(0.05, 1 - (ci / 100))

        low_bid = row["low_top_bid_usd"]
        bid_factor = 0.85 if low_bid is None else min(1.0, 0.50 / max(low_bid, 0.05))

        trend = row["last3_change_pct"]
        if trend is None:
            trend_factor = 0.9
        elif trend >= 0:
            trend_factor = min(1.2, 1 + trend / 500)
        else:
            trend_factor = max(0.6, 1 + trend / 200)

        score = 100 * volume_factor * competition_factor * bid_factor * trend_factor
        row["opportunity_score"] = round(score, 1)
        row["data_confidence"] = "HIGH" if ci is not None else "MEDIUM"


def aggregate_groups(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    grouped: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        if row["avg_monthly_searches"] > 0:
            grouped[(row["state"], row["group"])].append(row)

    out: list[dict[str, Any]] = []
    for (state, group), items in grouped.items():
        ranked = sorted(items, key=lambda x: -x["opportunity_score"])
        top = ranked[:3]
        out.append(
            {
                "state": state,
                "group": group,
                "combined_top3_score": round(sum(x["opportunity_score"] for x in top), 1),
                "top3_searches": sum(x["avg_monthly_searches"] for x in top),
                "best_keyword": top[0]["keyword"],
                "best_keyword_score": top[0]["opportunity_score"],
            }
        )
    out.sort(key=lambda x: (-x["combined_top3_score"], -x["top3_searches"]))
    return out


def write_csv(rows: list[dict[str, Any]]) -> None:
    fields = [
        "state",
        "source",
        "group",
        "keyword",
        "avg_monthly_searches",
        "competition",
        "competition_index",
        "low_top_bid_usd",
        "high_top_bid_usd",
        "last3_change_pct",
        "opportunity_score",
        "data_confidence",
        "close_variants",
    ]
    with CSV_OUT.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=fields)
        writer.writeheader()
        for row in rows:
            data = {k: row.get(k) for k in fields}
            data["close_variants"] = " | ".join(row.get("close_variants", []))
            writer.writerow(data)


def fmt(value: Any) -> str:
    return "—" if value is None or value == "" else str(value)


def write_markdown(rows: list[dict[str, Any]], aggregates: list[dict[str, Any]], meta: dict[str, Any]) -> None:
    top = sorted(rows, key=lambda x: (-x["opportunity_score"], -x["avg_monthly_searches"]))[:30]
    lines = [
        "# Diecast US Google Ads Opportunity Scan",
        "",
        f"Generated: {meta['generated_at']}",
        "",
        "> READ-ONLY research. No campaign, ad, keyword, budget, or bid mutation was performed.",
        "",
        "## Top state × brand/product groups",
        "",
        "| Rank | State | Group | Top-3 searches | Group score | Best keyword |",
        "|---:|---|---|---:|---:|---|",
    ]
    for i, item in enumerate(aggregates[:15], 1):
        lines.append(
            f"| {i} | {item['state']} | {item['group']} | {item['top3_searches']} | "
            f"{item['combined_top3_score']} | {item['best_keyword']} |"
        )

    lines += [
        "",
        "## Top individual opportunities",
        "",
        "| Rank | State | Keyword | Group | Searches | Competition | Index | Low bid | High bid | 3-mo change | Score |",
        "|---:|---|---|---|---:|---|---:|---:|---:|---:|---:|",
    ]
    for i, row in enumerate(top, 1):
        low = "—" if row["low_top_bid_usd"] is None else f"${row['low_top_bid_usd']:.2f}"
        high = "—" if row["high_top_bid_usd"] is None else f"${row['high_top_bid_usd']:.2f}"
        trend = "—" if row["last3_change_pct"] is None else f"{row['last3_change_pct']}%"
        lines.append(
            f"| {i} | {row['state']} | {row['keyword']} | {row['group']} | "
            f"{row['avg_monthly_searches']} | {row['competition']} | {fmt(row['competition_index'])} | "
            f"{low} | {high} | {trend} | {row['opportunity_score']} |"
        )

    lines += [
        "",
        "## Scoring note",
        "",
        "The score is a relative research score for this scan. It rewards search volume, lower confirmed ad competition, "
        "lower low-range top-of-page bids, and stable/rising recent demand. Missing competition data is deliberately "
        "penalized so `UNKNOWN` is never treated as competition index 0.",
        "",
    ]
    MD_OUT.write_text("\n".join(lines), encoding="utf-8")


def write_error(exc: Exception) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    payload: dict[str, Any] = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "error_type": type(exc).__name__,
        "message": str(exc),
    }
    if isinstance(exc, GoogleAdsException):
        payload["request_id"] = exc.request_id
        payload["google_ads_errors"] = [
            {"message": e.message, "error_code": str(e.error_code)} for e in exc.failure.errors
        ]
    ERROR_OUT.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    if ERROR_OUT.exists():
        ERROR_OUT.unlink()

    config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    client, customer_id = load_client()
    explicit_groups = group_lookup(config)
    keywords = flatten_keywords(config)
    language_id = str(config.get("language_constant_id", "1000"))
    country_code = config.get("country_code", "US")

    print("DIECAST GEO OPPORTUNITY SCANNER — READ ONLY")
    print(f"States: {len(config['states'])} | Seed keywords: {len(keywords)}")
    print("No Google Ads mutations are present in this script.")

    all_rows: list[dict[str, Any]] = []
    geo_map: dict[str, str] = {}

    for state in config["states"]:
        print(f"\n=== {state} ===")
        geo_resource = resolve_state_geo(client, state, country_code)
        geo_map[state] = geo_resource
        rows = historical_rows(
            client,
            customer_id,
            state,
            geo_resource,
            keywords,
            language_id,
            explicit_groups,
        )
        print(f"Historical metric rows: {len(rows)}")
        all_rows.extend(rows)

        if config.get("discover_ideas", False):
            ideas = idea_rows(
                client,
                customer_id,
                state,
                geo_resource,
                list(config.get("idea_seeds", [])),
                language_id,
                explicit_groups,
                int(config.get("min_idea_monthly_searches", 10)),
                int(config.get("max_ideas_per_state", 25)),
            )
            print(f"Relevant discovered ideas kept: {len(ideas)}")
            all_rows.extend(ideas)

    rows = dedupe(all_rows)
    add_scores(rows)
    rows.sort(key=lambda x: (-x["opportunity_score"], -x["avg_monthly_searches"], x["state"], x["keyword"]))
    aggregates = aggregate_groups(rows)

    meta = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "mode": "READ_ONLY",
        "country_code": country_code,
        "language_constant_id": language_id,
        "states_scanned": list(config["states"]),
        "seed_keyword_count": len(keywords),
        "result_row_count": len(rows),
        "discover_ideas": bool(config.get("discover_ideas", False)),
        "geo_resources": geo_map,
    }
    payload = {"meta": meta, "group_rankings": aggregates, "rows": rows}

    JSON_OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    write_csv(rows)
    write_markdown(rows, aggregates, meta)

    print("\n=== TOP 15 OPPORTUNITIES ===")
    for i, row in enumerate(rows[:15], 1):
        print(
            f"{i:02d}. {row['state']} | {row['keyword']} | avg={row['avg_monthly_searches']} | "
            f"comp={row['competition']}({row['competition_index']}) | "
            f"bid={row['low_top_bid_usd']}-{row['high_top_bid_usd']} | score={row['opportunity_score']}"
        )
    print("\nREAD-ONLY DIECAST OPPORTUNITY SCAN COMPLETE")
    print(f"Wrote: {JSON_OUT}")
    print(f"Wrote: {CSV_OUT}")
    print(f"Wrote: {MD_OUT}")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        write_error(exc)
        print(f"SCANNER FAILED: {type(exc).__name__}: {exc}", file=sys.stderr)
        if isinstance(exc, GoogleAdsException):
            print(f"Google Ads request ID: {exc.request_id}", file=sys.stderr)
            for error in exc.failure.errors:
                print(f"- {error.error_code}: {error.message}", file=sys.stderr)
        raise
