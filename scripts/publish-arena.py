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
TOKEN = os.getenv("ARENA_ACCESS_TOKEN", "").strip()
CHANNEL_SLUG = os.getenv("ARENA_CHANNEL_SLUG", "football-match-travel-guides").strip()
STATE_PATH = Path(os.getenv("ARENA_STATE_PATH", "data/runtime/arena-growth-state.json"))
LAST_PATH = Path(os.getenv("ARENA_LAST_PATH", "data/runtime/arena-growth-last.json"))
API_URL = "https://api.are.na/v3/blocks"
USER_AGENT = "TrendPilotChoice-ArenaPublisher/1.0"


def fetch_bytes(url):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read()


def request_json(url, method="GET", payload=None, headers=None):
    hdrs = {"User-Agent": USER_AGENT}
    if headers:
        hdrs.update(headers)
    body = None
    if payload is not None:
        body = json.dumps(payload).encode("utf-8")
        hdrs.setdefault("Content-Type", "application/json")
    req = urllib.request.Request(url, data=body, headers=hdrs, method=method)
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = resp.read()
        return json.loads(data.decode("utf-8")) if data else {}


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
    media_ns = "{http://search.yahoo.com/mrss/}"
    items = []
    for item in channel.findall("item"):
        title = text(item, "title")
        link = text(item, "link")
        guid = text(item, "guid") or link
        description = strip_html(text(item, "description"))
        category = text(item, "category") or "Football & Match Travel"
        image = ""
        media = item.find(media_ns + "content")
        if media is not None:
            image = (media.attrib.get("url") or "").strip()
        if not image:
            enclosure = item.find("enclosure")
            if enclosure is not None and (enclosure.attrib.get("type") or "").startswith("image/"):
                image = (enclosure.attrib.get("url") or "").strip()
        if not title or not link or not guid:
            continue
        if "/events/" not in urllib.parse.urlsplit(link).path:
            continue
        items.append({
            "title": title,
            "link": link,
            "guid": guid,
            "description": description,
            "category": category,
            "image": image,
        })
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
        "utm_source": "arena",
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


def publish(item):
    if not TOKEN:
        raise RuntimeError("ARENA_ACCESS_TOKEN is missing")
    target = with_utm(item["link"])
    payload = {
        "value": target,
        "title": trim(item["title"], 220),
        "description": trim(item["description"] or item["category"], 500),
        "original_source_url": item["link"],
        "original_source_title": "TrendPilot Choice",
        "channels": [{"id": CHANNEL_SLUG}],
        "metadata": {
            "source": "trendpilot",
            "campaign": "football_match_travel",
        },
    }
    if item.get("image"):
        payload["cover_url"] = item["image"]
    created = request_json(
        API_URL,
        method="POST",
        headers={"Authorization": "Bearer " + TOKEN},
        payload=payload,
    )
    data = created.get("data") if isinstance(created, dict) else None
    block = data if isinstance(data, dict) else created
    return block, target


def main():
    generated_at = datetime.now(timezone.utc).isoformat()
    state = load_state()
    seen = set(state.get("published_guids") or [])
    items = parse_feed()
    selected = next((item for item in items if item["guid"] not in seen), None)
    result = {
        "generated_at": generated_at,
        "channel_slug": CHANNEL_SLUG,
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
        block, target = publish(selected)
        seen.add(selected["guid"])
        state["published_guids"] = list(seen)[-500:]
        state["updated_at"] = generated_at
        save_json(STATE_PATH, state)
        result.update({
            "status": "published",
            "block_id": block.get("id") if isinstance(block, dict) else None,
            "block_title": block.get("title") if isinstance(block, dict) else selected["title"],
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
