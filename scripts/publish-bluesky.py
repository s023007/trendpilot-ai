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
HANDLE = os.getenv("BLUESKY_HANDLE", "trendpilotchoice.bsky.social").strip()
APP_PASSWORD = os.getenv("BLUESKY_APP_PASSWORD", "").strip()
STATE_PATH = Path(os.getenv("BLUESKY_STATE_PATH", "data/runtime/bluesky-growth-state.json"))
LAST_PATH = Path(os.getenv("BLUESKY_LAST_PATH", "data/runtime/bluesky-growth-last.json"))
USER_AGENT = "TrendPilotChoice-BlueskyPublisher/1.0"


def request_json(url, method="GET", payload=None, headers=None, raw_body=None):
    hdrs = {"User-Agent": USER_AGENT}
    if headers:
        hdrs.update(headers)
    body = raw_body
    if payload is not None:
        body = json.dumps(payload).encode("utf-8")
        hdrs.setdefault("Content-Type", "application/json")
    req = urllib.request.Request(url, data=body, headers=hdrs, method=method)
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = resp.read()
        return json.loads(data.decode("utf-8")) if data else {}


def fetch_bytes(url):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read(), resp.headers.get_content_type()


def text(el, name):
    child = el.find(name)
    return (child.text or "").strip() if child is not None and child.text else ""


def parse_feed():
    xml_bytes, _ = fetch_bytes(FEED_URL)
    root = ET.fromstring(xml_bytes)
    channel = root.find("channel")
    if channel is None:
        raise RuntimeError("TrendPilot RSS channel not found")
    media_ns = "{http://search.yahoo.com/mrss/}"
    items = []
    for item in channel.findall("item"):
        title = text(item, "title")
        link = text(item, "link")
        guid = text(item, "guid") or link
        description = text(item, "description")
        category = text(item, "category") or "TrendPilot"
        image = ""
        media = item.find(media_ns + "content")
        if media is not None:
            image = (media.attrib.get("url") or "").strip()
        if not image:
            enclosure = item.find("enclosure")
            if enclosure is not None and (enclosure.attrib.get("type") or "").startswith("image/"):
                image = (enclosure.attrib.get("url") or "").strip()
        pub = text(item, "pubDate")
        if not title or not link or not guid:
            continue
        items.append({
            "title": title,
            "link": link,
            "guid": guid,
            "description": strip_html(description),
            "category": category,
            "image": image,
            "pubDate": pub,
        })
    return items


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
        "utm_source": "bluesky",
        "utm_medium": "social",
        "utm_campaign": "bluesky-auto",
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


def create_session():
    if not APP_PASSWORD:
        raise RuntimeError("BLUESKY_APP_PASSWORD is missing")
    session = request_json(
        "https://bsky.social/xrpc/com.atproto.server.createSession",
        method="POST",
        payload={"identifier": HANDLE, "password": APP_PASSWORD},
    )
    pds = "https://bsky.social"
    for svc in (session.get("didDoc") or {}).get("service", []) or []:
        if svc.get("id") == "#atproto_pds" and svc.get("serviceEndpoint"):
            pds = str(svc["serviceEndpoint"]).rstrip("/")
            break
    return session, pds


def upload_thumb(pds, token, image_url):
    if not image_url:
        return None
    try:
        data, content_type = fetch_bytes(image_url)
        if not data or len(data) > 950_000 or not content_type.startswith("image/"):
            return None
        result = request_json(
            pds + "/xrpc/com.atproto.repo.uploadBlob",
            method="POST",
            headers={"Authorization": "Bearer " + token, "Content-Type": content_type},
            raw_body=data,
        )
        return result.get("blob")
    except Exception:
        return None


def publish(item):
    session, pds = create_session()
    token = session["accessJwt"]
    did = session["did"]
    target = with_utm(item["link"])
    post_text = trim(item["title"], 230) + "\n\nFull guide on TrendPilot Choice ↓"
    external = {
        "uri": target,
        "title": trim(item["title"], 180),
        "description": trim(item["description"] or item["category"], 280),
    }
    thumb = upload_thumb(pds, token, item.get("image") or "")
    if thumb:
        external["thumb"] = thumb
    record = {
        "$type": "app.bsky.feed.post",
        "text": post_text,
        "createdAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "embed": {"$type": "app.bsky.embed.external", "external": external},
    }
    created = request_json(
        pds + "/xrpc/com.atproto.repo.createRecord",
        method="POST",
        headers={"Authorization": "Bearer " + token},
        payload={"repo": did, "collection": "app.bsky.feed.post", "record": record},
    )
    return created, target, bool(thumb)


def main():
    generated_at = datetime.now(timezone.utc).isoformat()
    state = load_state()
    seen = set(state.get("published_guids") or [])
    items = parse_feed()
    selected = next((item for item in items if item["guid"] not in seen), None)
    result = {
        "generated_at": generated_at,
        "handle": HANDLE,
        "feed_url": FEED_URL,
        "feed_items": len(items),
        "status": "no-new-item",
        "selected": selected,
    }
    if selected is None:
        save_json(LAST_PATH, result)
        print(json.dumps(result, ensure_ascii=False))
        return 0
    try:
        created, target, used_thumb = publish(selected)
        seen.add(selected["guid"])
        state["published_guids"] = list(seen)[-1000:]
        state["updated_at"] = generated_at
        save_json(STATE_PATH, state)
        result.update({
            "status": "published",
            "post_uri": created.get("uri"),
            "post_cid": created.get("cid"),
            "target_url": target,
            "thumbnail_uploaded": used_thumb,
        })
        save_json(LAST_PATH, result)
        print(json.dumps(result, ensure_ascii=False))
        return 0
    except Exception as exc:
        result.update({"status": "error", "error": str(exc)[:1500]})
        save_json(LAST_PATH, result)
        print(json.dumps(result, ensure_ascii=False), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
