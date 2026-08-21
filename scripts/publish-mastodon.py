#!/usr/bin/env python3
import hashlib
import json
import mimetypes
import os
import sys
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path

FEED_URL = os.getenv("TRENDPILOT_FEED_URL", "https://trendpilotchoice.com/feed.xml")
BASE_URL = os.getenv("MASTODON_BASE_URL", "https://mastodon.social").rstrip("/")
ACCESS_TOKEN = os.getenv("MASTODON_ACCESS_TOKEN", "").strip()
STATE_PATH = Path(os.getenv("MASTODON_STATE_PATH", "data/runtime/mastodon-growth-state.json"))
LAST_PATH = Path(os.getenv("MASTODON_LAST_PATH", "data/runtime/mastodon-growth-last.json"))
USER_AGENT = "TrendPilotChoice-MastodonPublisher/1.0"


def request_json(url, method="GET", payload=None, headers=None, raw_body=None, content_type=None):
    hdrs = {"User-Agent": USER_AGENT, "Accept": "application/json"}
    if headers:
        hdrs.update(headers)
    body = raw_body
    if payload is not None:
        body = urllib.parse.urlencode(payload, doseq=True).encode("utf-8")
        hdrs.setdefault("Content-Type", "application/x-www-form-urlencoded")
    if content_type:
        hdrs["Content-Type"] = content_type
    req = urllib.request.Request(url, data=body, headers=hdrs, method=method)
    with urllib.request.urlopen(req, timeout=45) as resp:
        data = resp.read()
        return json.loads(data.decode("utf-8")) if data else {}


def fetch_bytes(url):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read(), resp.headers.get_content_type()


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
        if title and link and guid:
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
        "utm_source": "mastodon",
        "utm_medium": "social",
        "utm_campaign": "mastodon-auto",
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


def hashtags(item):
    hay = (item.get("title", "") + " " + item.get("category", "")).lower()
    tags = ["#TrendPilot"]
    if any(x in hay for x in ("football", "tickets", "match", "arsenal", "chelsea", "barcelona", "madrid", "manchester")):
        tags += ["#Football", "#MatchTravel"]
    elif any(x in hay for x in ("carplay", "car", "adapter", "tech")):
        tags += ["#Tech", "#BuyingGuide"]
    else:
        tags += ["#BuyingGuide"]
    return " ".join(tags[:3])


def multipart_file(field_name, filename, data, mime, extra_fields=None):
    boundary = "----TrendPilotBoundary" + hashlib.sha256(data[:1024]).hexdigest()[:16]
    chunks = []
    for key, value in (extra_fields or {}).items():
        chunks.append((f"--{boundary}\r\nContent-Disposition: form-data; name=\"{key}\"\r\n\r\n{value}\r\n").encode("utf-8"))
    chunks.append((
        f"--{boundary}\r\n"
        f"Content-Disposition: form-data; name=\"{field_name}\"; filename=\"{filename}\"\r\n"
        f"Content-Type: {mime}\r\n\r\n"
    ).encode("utf-8"))
    chunks.append(data)
    chunks.append(f"\r\n--{boundary}--\r\n".encode("utf-8"))
    return b"".join(chunks), f"multipart/form-data; boundary={boundary}"


def upload_media(item):
    image_url = item.get("image") or ""
    if not image_url:
        return None
    try:
        data, mime = fetch_bytes(image_url)
        if not data or len(data) > 8_000_000 or not mime.startswith("image/"):
            return None
        ext = mimetypes.guess_extension(mime) or ".jpg"
        body, ctype = multipart_file(
            "file",
            "trendpilot" + ext,
            data,
            mime,
            {"description": trim(item.get("title") or "TrendPilot guide image", 400)},
        )
        uploaded = request_json(
            BASE_URL + "/api/v2/media",
            method="POST",
            headers={"Authorization": "Bearer " + ACCESS_TOKEN},
            raw_body=body,
            content_type=ctype,
        )
        media_id = str(uploaded.get("id") or "")
        if not media_id:
            return None
        for _ in range(5):
            if uploaded.get("url") or uploaded.get("preview_url"):
                break
            time.sleep(2)
            try:
                uploaded = request_json(
                    BASE_URL + "/api/v1/media/" + urllib.parse.quote(media_id),
                    headers={"Authorization": "Bearer " + ACCESS_TOKEN},
                )
            except Exception:
                break
        return media_id
    except Exception:
        return None


def publish(item):
    if not ACCESS_TOKEN:
        raise RuntimeError("MASTODON_ACCESS_TOKEN is missing")
    target = with_utm(item["link"])
    status_text = f"{trim(item['title'], 280)}\n\nFull guide on TrendPilot Choice ↓\n{target}\n\n{hashtags(item)}"
    media_id = upload_media(item)
    payload = {
        "status": trim(status_text, 490),
        "visibility": "public",
        "language": "en",
    }
    if media_id:
        payload["media_ids[]"] = [media_id]
    idempotency = hashlib.sha256((item["guid"] + "|mastodon").encode("utf-8")).hexdigest()
    created = request_json(
        BASE_URL + "/api/v1/statuses",
        method="POST",
        payload=payload,
        headers={
            "Authorization": "Bearer " + ACCESS_TOKEN,
            "Idempotency-Key": idempotency,
        },
    )
    return created, target, bool(media_id)


def main():
    generated_at = datetime.now(timezone.utc).isoformat()
    state = load_state()
    seen = set(state.get("published_guids") or [])
    items = parse_feed()
    selected = next((item for item in items if item["guid"] not in seen), None)
    result = {
        "generated_at": generated_at,
        "base_url": BASE_URL,
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
        created, target, used_media = publish(selected)
        seen.add(selected["guid"])
        state["published_guids"] = list(seen)[-1000:]
        state["updated_at"] = generated_at
        save_json(STATE_PATH, state)
        result.update({
            "status": "published",
            "post_id": created.get("id"),
            "post_url": created.get("url"),
            "target_url": target,
            "media_uploaded": used_media,
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
