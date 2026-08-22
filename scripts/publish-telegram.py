#!/usr/bin/env python3
import html
import json
import os
import sys
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path

FEED_URL = os.getenv("TRENDPILOT_FEED_URL", "https://trendpilotchoice.com/feed.xml")
BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
CHANNEL = os.getenv("TELEGRAM_CHANNEL", "@TrendPilotChoice").strip()
STATE_PATH = Path(os.getenv("TELEGRAM_STATE_PATH", "data/runtime/telegram-growth-state.json"))
LAST_PATH = Path(os.getenv("TELEGRAM_LAST_PATH", "data/runtime/telegram-growth-last.json"))
USER_AGENT = "TrendPilotChoice-TelegramPublisher/1.0"


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
        description = strip_html(text(item, "description"))
        category = text(item, "category") or "TrendPilot Choice"
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
            "description": description,
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
        "utm_source": "telegram",
        "utm_medium": "social",
        "utm_campaign": "telegram-auto",
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


def telegram_api(method, payload):
    if not BOT_TOKEN:
        raise RuntimeError("TELEGRAM_BOT_TOKEN is missing")
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/{method}"
    body = urllib.parse.urlencode(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        headers={
            "User-Agent": USER_AGENT,
            "Content-Type": "application/x-www-form-urlencoded",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    if not data.get("ok"):
        raise RuntimeError(f"Telegram API error: {data}")
    return data.get("result") or {}


def build_caption(item, target, max_len=1000):
    title = html.escape(trim(item["title"], 240))
    desc = html.escape(trim(item.get("description") or item.get("category") or "", 420))
    link = html.escape(target, quote=True)
    parts = [f"<b>{title}</b>"]
    if desc:
        parts.append(desc)
    parts.append(f'<a href="{link}">Read the full guide on TrendPilot Choice →</a>')
    caption = "\n\n".join(parts)
    if len(caption) > max_len:
        desc = html.escape(trim(item.get("description") or "", 220))
        parts = [f"<b>{title}</b>"]
        if desc:
            parts.append(desc)
        parts.append(f'<a href="{link}">Read the full guide on TrendPilot Choice →</a>')
        caption = "\n\n".join(parts)
    return caption[:max_len]


def publish(item):
    target = with_utm(item["link"])
    caption = build_caption(item, target)

    if item.get("image"):
        try:
            result = telegram_api(
                "sendPhoto",
                {
                    "chat_id": CHANNEL,
                    "photo": item["image"],
                    "caption": caption,
                    "parse_mode": "HTML",
                },
            )
            return result, target, "photo"
        except Exception:
            pass

    message = build_caption(item, target, max_len=3500)
    result = telegram_api(
        "sendMessage",
        {
            "chat_id": CHANNEL,
            "text": message,
            "parse_mode": "HTML",
            "disable_web_page_preview": "false",
        },
    )
    return result, target, "message"


def main():
    generated_at = datetime.now(timezone.utc).isoformat()
    state = load_state()
    seen = set(state.get("published_guids") or [])
    items = parse_feed()
    selected = next((item for item in items if item["guid"] not in seen), None)

    result = {
        "generated_at": generated_at,
        "channel": CHANNEL,
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
        created, target, mode = publish(selected)
        seen.add(selected["guid"])
        state["published_guids"] = list(seen)[-1000:]
        state["updated_at"] = generated_at
        save_json(STATE_PATH, state)
        result.update({
            "status": "published",
            "message_id": created.get("message_id"),
            "target_url": target,
            "mode": mode,
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
