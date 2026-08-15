#!/usr/bin/env python3
"""Fetch active TrendPilot coupons from the official Admitad publisher API.

The script uses only Python's standard library. Secrets are read from the
runtime environment and are never written to disk or printed.
"""
from __future__ import annotations

import argparse
import base64
import datetime as dt
import hashlib
import json
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter
from pathlib import Path
from typing import Any, Iterable

ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = ROOT / "config" / "coupon-api.json"
DATA_DIR = ROOT / "data"
JS_DIR = ROOT / "js"
TOKEN_URL = "https://api.admitad.com/token/"
WEBSITES_URL = "https://api.admitad.com/websites/v2/"
COUPONS_URL = "https://api.admitad.com/coupons/website/{website_id}/"
USER_AGENT = "TrendPilotAI-AdmitadCouponEngine/21.12"
PAGE_SIZE = 500
HTTP_TIMEOUT = 120
MAX_RETRIES = 5


def utcnow() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


def iso(value: dt.datetime | None) -> str:
    if value is None:
        return ""
    return value.astimezone(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def clean(value: Any, limit: int | None = None) -> str:
    text = re.sub(r"\s+", " ", str(value or "").replace("\x00", " ")).strip()
    return text[:limit] if limit else text


def slug(value: Any) -> str:
    text = clean(value).lower().replace("&", " and ")
    text = re.sub(r"[^a-z0-9]+", "_", text).strip("_")
    return text or "merchant"


def parse_datetime(value: Any) -> dt.datetime | None:
    text = clean(value)
    if not text:
        return None
    text = text.replace("Z", "+00:00")
    try:
        parsed = dt.datetime.fromisoformat(text)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=dt.timezone.utc)
    return parsed.astimezone(dt.timezone.utc)


def ensure_https(value: Any) -> str:
    text = clean(value)
    if text.startswith("//"):
        return "https:" + text
    if text.startswith("http://") or text.startswith("https://"):
        return text
    return ""


def names(values: Any) -> list[str]:
    if not isinstance(values, list):
        return []
    result: list[str] = []
    seen: set[str] = set()
    for value in values:
        item = clean(value.get("name") if isinstance(value, dict) else value)
        if item and item.casefold() not in seen:
            result.append(item)
            seen.add(item.casefold())
    return result


def load_config() -> dict[str, Any]:
    if not CONFIG_PATH.exists():
        raise SystemExit(f"Missing configuration file: {CONFIG_PATH.relative_to(ROOT)}")
    payload = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise SystemExit("config/coupon-api.json must contain a JSON object.")
    return payload


def request_json(url: str, *, method: str = "GET", headers: dict[str, str] | None = None, data: bytes | None = None) -> Any:
    merged_headers = {"User-Agent": USER_AGENT, "Accept": "application/json", **(headers or {})}
    last_error: Exception | None = None
    for attempt in range(MAX_RETRIES):
        request = urllib.request.Request(url, method=method, headers=merged_headers, data=data)
        try:
            with urllib.request.urlopen(request, timeout=HTTP_TIMEOUT) as response:
                raw = response.read()
            return json.loads(raw.decode("utf-8-sig"))
        except urllib.error.HTTPError as exc:
            body = exc.read(8000).decode("utf-8", errors="replace")
            last_error = RuntimeError(f"HTTP {exc.code} from Admitad API: {clean(body, 800)}")
            if exc.code not in {429, 500, 502, 503, 504} or attempt == MAX_RETRIES - 1:
                raise last_error from exc
            retry_after = exc.headers.get("Retry-After", "")
            wait = int(retry_after) if retry_after.isdigit() else min(2 ** attempt, 20)
            time.sleep(wait)
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
            last_error = exc
            if attempt == MAX_RETRIES - 1:
                raise RuntimeError(f"Admitad API request failed: {exc}") from exc
            time.sleep(min(2 ** attempt, 20))
    raise RuntimeError(f"Admitad API request failed: {last_error}")


def obtain_token(client_id: str, client_secret: str) -> tuple[str, int]:
    basic = base64.b64encode(f"{client_id}:{client_secret}".encode("utf-8")).decode("ascii")
    form = urllib.parse.urlencode({"grant_type":"client_credentials","client_id":client_id,"scope":"websites coupons_for_website"}).encode("utf-8")
    payload = request_json(TOKEN_URL, method="POST", headers={"Authorization":f"Basic {basic}","Content-Type":"application/x-www-form-urlencoded;charset=UTF-8"}, data=form)
    if not isinstance(payload, dict) or not clean(payload.get("access_token")):
        raise RuntimeError("Admitad did not return an access_token.")
    return clean(payload["access_token"]), int(payload.get("expires_in") or 0)


def bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def website_rows(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, list): return [x for x in payload if isinstance(x, dict)]
    if isinstance(payload, dict) and isinstance(payload.get("results"), list): return [x for x in payload["results"] if isinstance(x, dict)]
    return []


def host(value: Any) -> str:
    text=clean(value)
    if not text:return ""
    if "://" not in text:text="https://"+text
    try:h=(urllib.parse.urlparse(text).hostname or "").lower()
    except Exception:return ""
    return h[4:] if h.startswith("www.") else h


def choose_website(rows: list[dict[str, Any]], config: dict[str, Any]) -> dict[str, Any]:
    explicit_id = clean(os.environ.get("ADMITAD_WEBSITE_ID") or config.get("website_id"))
    expected_name = clean(os.environ.get("ADMITAD_WEBSITE_NAME") or config.get("website_name") or "TrendPilot AI")
    url_hint = clean(config.get("website_url_contains") or "trendpilotchoice.com").casefold()
    active = [x for x in rows if clean(x.get("status")).casefold() == "active"] or rows

    if explicit_id:
        for row in active:
            if str(row.get("id")) == explicit_id:
                if url_hint and url_hint not in clean(row.get("site_url")).casefold():
                    raise RuntimeError(f"Safety stop: Admitad ad space {explicit_id} does not match {url_hint}.")
                return row
        raise RuntimeError(f"ADMITAD_WEBSITE_ID={explicit_id} was not found as an active ad space in this Admitad account.")

    hinted = [x for x in active if url_hint and url_hint in clean(x.get("site_url")).casefold()]
    if len(hinted) == 1:return hinted[0]
    exact = [x for x in active if clean(x.get("name")).casefold() == expected_name.casefold()]
    if len(exact) == 1:return exact[0]
    if len(active) == 1:return active[0]
    available = ", ".join(f"{clean(x.get('name'))} (ID {x.get('id')}, {clean(x.get('site_url'))})" for x in active[:12])
    raise RuntimeError(f"Could not uniquely identify the '{expected_name}' ad space. Available active ad spaces: {available or 'none'}")


def fetch_all_coupons(token: str, website_id: int, max_coupons: int) -> tuple[list[dict[str, Any]], int]:
    rows=[];offset=0;pages=0
    while len(rows)<max_coupons:
        query=urllib.parse.urlencode([("limit",str(PAGE_SIZE)),("offset",str(offset)),("order_by","-rating"),("order_by","date_end")])
        payload=request_json(COUPONS_URL.format(website_id=website_id)+"?"+query,headers=bearer(token))
        if not isinstance(payload,dict) or not isinstance(payload.get("results"),list):raise RuntimeError("Unexpected coupons response from Admitad.")
        batch=[x for x in payload["results"] if isinstance(x,dict)];rows.extend(batch);pages+=1
        meta=payload.get("_meta") if isinstance(payload.get("_meta"),dict) else {};total=int(meta.get("count") or 0);offset+=len(batch)
        if not batch or len(batch)<PAGE_SIZE or (total and offset>=total):break
    return rows[:max_coupons],pages


def build_program_lookup(config: dict[str, Any]) -> dict[str, dict[str, str]]:
    lookup={};programs=config.get("programs")
    if not isinstance(programs,dict):return lookup
    for official_name,info in programs.items():
        if not isinstance(info,dict):continue
        entry={"merchant_key":clean(info.get("merchant_key")) or slug(official_name),"category":clean(info.get("category")) or "other"}
        aliases: Iterable[Any]=[official_name,*(info.get("aliases") or [])]
        for alias in aliases:
            if clean(alias):lookup[clean(alias).casefold()]=entry
    return lookup


def blocked_terms(config: dict[str, Any]) -> list[str]:
    return [re.sub(r"[^a-z0-9]+","",clean(x).lower()) for x in (config.get("public_blocklist") or []) if clean(x)]


def is_blocked(value: Any, terms: list[str]) -> bool:
    key=re.sub(r"[^a-z0-9]+","",clean(value).lower())
    return any(t and t in key for t in terms)


def discount_details(text: str) -> dict[str, Any]:
    result={"kind":"deal","value":None,"currency":"","text":clean(text,180)}
    percent=re.search(r"(?<!\d)(\d{1,3}(?:[.,]\d+)?)\s*%",text)
    if percent:result.update(kind="percent",value=float(percent.group(1).replace(",",".")));return result
    if re.search(r"\bfree\s+(?:shipping|delivery)\b",text,re.I):result["kind"]="free_shipping";return result
    if re.search(r"\bbuy\s+\d+\s+get\s+\d+",text,re.I):result["kind"]="bundle";return result
    money=re.search(r"(?:(USD|EUR|GBP|CAD|AUD|AED|OMR)\s*)?([$€£])?\s*(\d+(?:[.,]\d+)?)\s*(?:off|discount)",text,re.I)
    if money:
        currency=(money.group(1) or {"$":"USD","€":"EUR","£":"GBP"}.get(money.group(2) or "","")).upper();result.update(kind="fixed",value=float(money.group(3).replace(",",".")),currency=currency)
    return result


def minimum_order(text: str) -> dict[str, Any]:
    match=re.search(r"(?:orders?|spend|purchase|packs?)\s+(?:above|over|from|of)\s*([€$£]?)\s*(\d+(?:[.,]\d+)?)",text,re.I)
    if not match:return {"value":None,"currency":""}
    return {"value":float(match.group(2).replace(",",".")),"currency":{"$":"USD","€":"EUR","£":"GBP"}.get(match.group(1),"")}


def normalize_coupon(row: dict[str, Any], *, program_lookup: dict[str, dict[str, str]], now: dt.datetime, blocked: list[str]) -> tuple[dict[str, Any] | None, str]:
    if clean(row.get("status")).casefold() not in {"","active"}:return None,"inactive"
    start_at=parse_datetime(row.get("date_start"));end_at=parse_datetime(row.get("date_end"))
    if start_at and start_at>now:return None,"not_started"
    if end_at and end_at<now:return None,"expired"
    campaign=row.get("campaign") if isinstance(row.get("campaign"),dict) else {};campaign_name=clean(campaign.get("name") or "Unknown program",180)
    if is_blocked(campaign_name,blocked):return None,"blocked_seller"
    program=program_lookup.get(campaign_name.casefold(),{});merchant_key=clean(program.get("merchant_key")) or slug(campaign_name);merchant_category=clean(program.get("category")) or "other"
    title=clean(row.get("name") or row.get("short_name") or row.get("description"),280);description=clean(row.get("description"),1600);promocode=clean(row.get("promocode"),160);tracking_url=ensure_https(row.get("goto_link")) or ensure_https(row.get("frameset_link"));image=ensure_https(row.get("image"));raw_discount=clean(row.get("discount"),180);combined=" ".join(x for x in [title,raw_discount,description] if x)
    if not title:return None,"missing_title"
    if not tracking_url:return None,"missing_tracking_url"
    try:rating=float(clean(row.get("rating")))
    except ValueError:rating=0.0
    categories=names(row.get("categories"));types=names(row.get("types"));regions=[clean(x) for x in row.get("regions",[]) if clean(x)] if isinstance(row.get("regions"),list) else [];species=clean(row.get("species")) or ("promocode" if promocode else "action");discount=discount_details(raw_discount or combined);minimum=minimum_order(combined);coupon_source_id=clean(row.get("id"));stable="|".join([merchant_key,coupon_source_id,promocode.casefold(),title.casefold(),iso(end_at)]);public_id=hashlib.sha256(stable.encode("utf-8")).hexdigest()[:20];customer_type=clean(row.get("customer_type"));exclusive=bool(row.get("exclusive"));priority=round(rating*10+(14 if promocode else 5)+(8 if exclusive else 0)+(4 if discount.get("kind")!="deal" else 0),2)
    return {"id":public_id,"source_id":coupon_source_id,"merchant_key":merchant_key,"merchant_name":campaign_name,"merchant_category":merchant_category,"network":"Admitad","campaign_id":campaign.get("id"),"campaign_url":ensure_https(campaign.get("site_url")),"title":title,"description":description,"code":promocode,"auto_apply":not bool(promocode),"exclusive":exclusive,"is_personal":bool(row.get("is_personal")),"is_unique":bool(row.get("is_unique")),"promotion_type":species,"customer_type":customer_type,"discount":discount,"minimum_order":minimum,"rating":rating,"priority_score":priority,"start_at":iso(start_at),"end_at":iso(end_at),"regions":regions,"language":clean(row.get("language")),"categories":categories,"types":types,"image":image,"url":tracking_url,"status":"active","fetched_at":iso(now)},"accepted"


def write_outputs(*,coupons:list[dict[str,Any]],now:dt.datetime,website:dict[str,Any],pages:int,raw_count:int,rejected:Counter[str],token_expires_in:int,public_blocklist:list[str])->None:
    DATA_DIR.mkdir(parents=True,exist_ok=True);JS_DIR.mkdir(parents=True,exist_ok=True);coupons.sort(key=lambda x:(-float(x["priority_score"]),x["merchant_name"].casefold(),x["end_at"] or "9999"));by_merchant=Counter(x["merchant_key"] for x in coupons);by_category=Counter(x["merchant_category"] for x in coupons);with_codes=sum(1 for x in coupons if x["code"])
    public={"version":2,"generated_at":iso(now),"count":len(coupons),"with_codes":with_codes,"automatic_deals":len(coupons)-with_codes,"public_blocklist":public_blocklist,"coupons":coupons}
    report={"version":2,"generated_at":iso(now),"source":"Admitad Publisher API","ad_space":{"id":website.get("id"),"name":clean(website.get("name")),"status":clean(website.get("status")),"site_url":clean(website.get("site_url"))},"api":{"pages_fetched":pages,"raw_records":raw_count,"token_expires_in_seconds":token_expires_in},"active_coupons":len(coupons),"with_codes":with_codes,"automatic_deals":len(coupons)-with_codes,"coupons_by_merchant":dict(sorted(by_merchant.items())),"coupons_by_category":dict(sorted(by_category.items())),"rejected_records":dict(sorted(rejected.items())),"public_blocklist":public_blocklist}
    (DATA_DIR/"coupons.json").write_text(json.dumps(public,ensure_ascii=False,indent=2)+"\n",encoding="utf-8");(DATA_DIR/"coupon-report.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8");(JS_DIR/"coupons-data.js").write_text("window.TREND_PILOT_COUPONS = "+json.dumps(public,ensure_ascii=False,separators=(",",":"))+";\n",encoding="utf-8")


def self_test()->int:
    config=load_config();lookup=build_program_lookup(config);now=dt.datetime(2026,8,4,tzinfo=dt.timezone.utc);sample={"id":3,"status":"active","rating":"4.5","campaign":{"id":8,"name":"Jetpac WW","site_url":"https://example.com/"},"name":"10% OFF on eSIM packs above $10","description":"Only applicable to eSIM packs above $10.","promocode":"JETPACGO","date_start":"2026-01-01T00:00:00","date_end":"2026-12-31T23:59:59","regions":["US","GB"],"discount":"10%","goto_link":"https://ad.admitad.com/g/test/","species":"promocode","categories":[{"id":1,"name":"Travel"}],"types":[{"id":1,"name":"Order discount"}]};coupon,reason=normalize_coupon(sample,program_lookup=lookup,now=now,blocked=blocked_terms(config));assert reason=="accepted" and coupon;assert coupon["merchant_key"]=="jetpac_ww";assert coupon["discount"]["kind"]=="percent";assert coupon["minimum_order"]["value"]==10.0;assert coupon["code"]=="JETPACGO";print("Self-test passed.");return 0


def run()->int:
    client_id=clean(os.environ.get("ADMITAD_CLIENT_ID"));client_secret=clean(os.environ.get("ADMITAD_CLIENT_SECRET"))
    if not client_id or not client_secret:raise SystemExit("Missing ADMITAD_CLIENT_ID or ADMITAD_CLIENT_SECRET repository secret.")
    config=load_config();max_coupons=int(config.get("max_coupons") or 5000);token,expires_in=obtain_token(client_id,client_secret);websites_payload=request_json(WEBSITES_URL,headers=bearer(token));website=choose_website(website_rows(websites_payload),config);website_id=int(website["id"]);raw_rows,pages=fetch_all_coupons(token,website_id,max_coupons);now=utcnow();program_lookup=build_program_lookup(config);blocked=blocked_terms(config);rejected:Counter[str]=Counter();coupons=[];seen=set()
    for row in raw_rows:
        coupon,reason=normalize_coupon(row,program_lookup=program_lookup,now=now,blocked=blocked)
        if coupon is None:rejected[reason]+=1;continue
        if coupon["id"] in seen:rejected["duplicate"]+=1;continue
        seen.add(coupon["id"]);coupons.append(coupon)
    write_outputs(coupons=coupons,now=now,website=website,pages=pages,raw_count=len(raw_rows),rejected=rejected,token_expires_in=expires_in,public_blocklist=[clean(x) for x in config.get("public_blocklist") or []]);print(f"Ad space: {clean(website.get('name'))} (ID {website_id}) {clean(website.get('site_url'))}");print(f"Coupon pages fetched: {pages}");print(f"Raw coupon records: {len(raw_rows)}");print(f"Policy-safe active usable coupons: {len(coupons)}");print("Secrets and access tokens were not written or printed.");return 0


def main()->int:
    parser=argparse.ArgumentParser();parser.add_argument("--self-test",action="store_true");args=parser.parse_args();return self_test() if args.self_test else run()

if __name__=="__main__":raise SystemExit(main())
