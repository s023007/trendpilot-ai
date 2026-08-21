#!/usr/bin/env python3
import json
import os
import sys
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path

FEED_URL = os.getenv("TRENDPILOT_FEED_URL", "https://trendpilotchoice.com/feed.xml")
TOKEN = os.getenv("RAINDROP_ACCESS_TOKEN", "").strip()
COLLECTION_TITLE = os.getenv("RAINDROP_COLLECTION_TITLE", "Football Match & Travel Guides").strip()
STATE_PATH = Path(os.getenv("RAINDROP_STATE_PATH", "data/runtime/raindrop-growth-state.json"))
LAST_PATH = Path(os.getenv("RAINDROP_LAST_PATH", "data/runtime/raindrop-growth-last.json"))
API_BASE = "https://api.raindrop.io/rest/v1"
USER_AGENT = "TrendPilotChoice-RaindropPublisher/1.0"


def fetch_bytes(url):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read()


def request_json(url, method="GET", payload=None):
    headers = {"User-Agent": USER_AGENT, "Authorization": "Bearer " + TOKEN}
    body = None
    if payload is not None:
        body = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=30) as resp:
        raw = resp.read()
        return json.loads(raw.decode("utf-8")) if raw else {}


def text(el, name):
    child = el.find(name)
    return (child.text or "").strip() if child is not None and child.text else ""


def strip_html(value):
    out = []
    inside = False
    for ch in value or "":
        if ch == "<":
            inside = True
            out.append(" ")
        elif ch == ">":
            inside = False
        elif not inside:
            out.append(ch)
    return " ".join("".join(out).split())


def parse_feed():
    root = ET.fromstring(fetch_bytes(FEED_URL))
    channel = root.find("channel")
    if channel is None:
        raise RuntimeError("TrendPilot RSS channel not found")
    items = []
    for item in channel.findall("item"):
        title = text(item, "title")
        link = text(item, "link")
        guid = text(item, "guid") or link
        description = strip_html(text(item, "description"))
        category = text(item, "category") or "Football & Match Travel"
        if not title or not link or not guid:
            continue
        if "/events/" not in urllib.parse.urlsplit(link).path:
            continue
        items.append({"title": title, "link": link, "guid": guid, "description": description, "category": category})
    return items


def load_state():
    if STATE_PATH.exists():
        try:
            return json.loads(STATE_PATH.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {"published_guids": []}


def save_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def with_utm(url):
    parsed = urllib.parse.urlsplit(url)
    q = urllib.parse.parse_qsl(parsed.query, keep_blank_values=True)
    keys = {k for k, _ in q}
    additions = {
        "utm_source": "raindrop",
        "utm_medium": "referral",
        "utm_campaign": "football-match-travel",
    }
    for k, v in additions.items():
        if k not in keys:
            q.append((k, v))
    return urllib.parse.urlunsplit((parsed.scheme, parsed.netloc, parsed.path, urllib.parse.urlencode(q), parsed.fragment))


def trim(value, limit):
    value = " ".join((value or "").split())
    if len(value) <= limit:
        return value
    return value[: max(0, limit - 1)].rstrip() + "…"


def find_collection():
    if not TOKEN:
        raise RuntimeError("RAINDROP_ACCESS_TOKEN is missing")
    collections = []
    for endpoint in ("collections", "collections/childrens"):
        data = request_json(f"{API_BASE}/{endpoint}")
        collections.extend(data.get("items") or [])
    exact = [c for c in collections if str(c.get("title", "")).strip().lower() == COLLECTION_TITLE.lower()]
    if not exact:
        names = " | ".join(str(c.get("title", "")) for c in collections[:50])
        raise RuntimeError(f"Raindrop collection '{COLLECTION_TITLE}' not found. Existing: {names}")
    return exact[0]


def publish(item, collection_id):
    target = with_utm(item["link"])
    payload = {
        "link": target,
        "title": trim(item["title"], 220),
        "excerpt": trim(item["description"] or item["category"], 500),
        "collection": {"$id": int(collection_id)},
        "tags": ["TrendPilot", "Football", "Match Travel"],
        "pleaseParse": {},
    }
    created = request_json(f"{API_BASE}/raindrop", method="POST", payload=payload)
    return created.get("item") or created, target


def main():
    generated_at = datetime.now(timezone.utc).isoformat()
    state = load_state()
    seen = set(state.get("published_guids") or [])
    items = parse_feed()
    selected = next((item for item in items if item["guid"] not in seen), None)
    result = {
        "generated_at": generated_at,
        "collection_title": COLLECTION_TITLE,
        "feed_url": FEED_URL,
        "eligible_feed_items": len(items),
        "status": "no-new-item",
        "selected": selected,
    }
    if selected is None:
        save_json(LAST_PATH, result)
        print(json.dumps(result, ensure_ascii=False))
        return 0
    try:
        collection = find_collection()
        created, target = publish(selected, collection.get("_id"))
        seen.add(selected["guid"])
        state["published_guids"] = list(seen)[-500:]
        state["updated_at"] = generated_at
        save_json(STATE_PATH, state)
        result.update({
            "status": "published",
            "collection_id": collection.get("_id"),
            "collection_public": collection.get("public"),
            "raindrop_id": created.get("_id") if isinstance(created, dict) else None,
            "raindrop_title": created.get("title") if isinstance(created, dict) else selected["title"],
            "target_url": target,
        })
        save_json(LAST_PATH, result)
        print(json.dumps(result, ensure_ascii=False))
        return 0
    except Exception as exc:
        result.update({"status": "error", "error": str(exc)[:1800]})
        save_json(LAST_PATH, result)
        print(json.dumps(result, ensure_ascii=False), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
