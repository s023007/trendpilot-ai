#!/usr/bin/env python3
import email.utils
import html
import json
import os
import re
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
TREND_GEOS = [x.strip().upper() for x in os.getenv("TELEGRAM_TREND_GEOS", "US,GB,CA,AU,IN,AE").split(",") if x.strip()]
USER_AGENT = "TrendPilotChoice-TelegramPublisher/2.0"

BOILERPLATE = (
    "Skip to content",
    "Clear comparisons. Real products. Fewer buying mistakes.",
    "Search the catalogue",
    "TrendPilot Choice",
)

STOP_WORDS = {
    "the", "and", "for", "with", "from", "this", "that", "your", "you", "are",
    "best", "guide", "buying", "2026", "a", "an", "to", "of", "in", "on", "is",
}

HIGH_INTENT = {
    "best": 5, "review": 5, "buying": 5, "comparison": 5, "compare": 5,
    "price": 4, "deal": 4, "discount": 4, "vs": 4, "adapter": 2, "phone": 2,
    "laptop": 2, "headphones": 2, "carplay": 3, "wireless": 2, "smartwatch": 2,
}


def fetch_bytes(url):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=25) as resp:
        return resp.read(), resp.headers.get_content_type()


def text(el, name):
    child = el.find(name)
    return (child.text or "").strip() if child is not None and child.text else ""


def strip_html(value):
    value = html.unescape(value or "")
    value = re.sub(r"<[^>]+>", " ", value)
    return " ".join(value.split())


def clean_description(value, title=""):
    value = strip_html(value)
    for phrase in BOILERPLATE:
        value = value.replace(phrase, " ")
    if title:
        value = value.replace(title, " ")
    value = re.sub(r"\s+", " ", value).strip(" -–—|")
    sentences = re.split(r"(?<=[.!?])\s+", value)
    useful = []
    seen = set()
    for sentence in sentences:
        sentence = sentence.strip()
        key = sentence.lower()
        if not sentence or len(sentence) < 20 or key in seen:
            continue
        if any(p.lower() in key for p in ("skip to content", "search the catalogue")):
            continue
        seen.add(key)
        useful.append(sentence)
        if len(" ".join(useful)) >= 260 or len(useful) >= 2:
            break
    return " ".join(useful).strip()


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
        raw_description = text(item, "description")
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
            "description": clean_description(raw_description, title),
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
    return {"published_guids": [], "published_count": 0}


def save_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def slug_token(value, limit=60):
    value = re.sub(r"[^a-zA-Z0-9]+", "-", value or "").strip("-").lower()
    return value[:limit] or "post"


def with_utm(url, title=""):
    parsed = urllib.parse.urlsplit(url)
    q = urllib.parse.parse_qsl(parsed.query, keep_blank_values=True)
    keys = {k for k, _ in q}
    additions = {
        "utm_source": "telegram",
        "utm_medium": "social",
        "utm_campaign": "telegram-growth",
        "utm_content": slug_token(title),
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


def normalize_words(value):
    return {
        w for w in re.findall(r"[a-z0-9]+", (value or "").lower())
        if len(w) >= 3 and w not in STOP_WORDS
    }


def fetch_google_trends():
    trends = []
    for geo in TREND_GEOS:
        url = f"https://trends.google.com/trending/rss?geo={urllib.parse.quote(geo)}"
        try:
            body, _ = fetch_bytes(url)
            root = ET.fromstring(body)
            for item in root.findall(".//item"):
                title = text(item, "title")
                if title:
                    trends.append({"geo": geo, "query": title, "words": normalize_words(title)})
        except Exception:
            continue
    return trends


def parse_pubdate(value):
    try:
        dt = email.utils.parsedate_to_datetime(value)
        if dt is None:
            return None
        return dt.astimezone(timezone.utc)
    except Exception:
        return None


def search_score(item, trends):
    blob = f'{item["title"]} {item.get("description","")} {item.get("category","")}'.lower()
    score = 0
    for key, weight in HIGH_INTENT.items():
        if re.search(rf"\b{re.escape(key)}\b", blob):
            score += weight
    item_words = normalize_words(blob)
    trend_matches = []
    for trend in trends:
        overlap = item_words & trend["words"]
        if len(overlap) >= 2 or (len(trend["words"]) == 1 and overlap):
            strength = len(overlap)
            score += 20 + (strength * 6)
            trend_matches.append({"geo": trend["geo"], "query": trend["query"]})
    pub = parse_pubdate(item.get("pubDate") or "")
    if pub:
        age_days = max(0, (datetime.now(timezone.utc) - pub).days)
        score += max(0, 10 - min(age_days, 10))
    return score, trend_matches[:5]


def select_item(items, seen, trends):
    unseen = [item for item in items if item["guid"] not in seen]
    if not unseen:
        return None, 0, []
    ranked = []
    for idx, item in enumerate(unseen):
        score, matches = search_score(item, trends)
        ranked.append((score, -idx, item, matches))
    ranked.sort(key=lambda x: (x[0], x[1]), reverse=True)
    score, _, item, matches = ranked[0]
    return item, score, matches


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


def topic_label(title):
    t = (title or "").lower()
    if "carplay" in t:
        return "wireless CarPlay adapter"
    if "iphone" in t:
        return "iPhone"
    if "phone" in t:
        return "phone"
    if "laptop" in t:
        return "laptop"
    if "headphone" in t or "earbud" in t:
        return "headphones"
    if "perfume" in t or "fragrance" in t:
        return "fragrance"
    if "watch" in t:
        return "smartwatch"
    cleaned = re.sub(r"\b(best|buying|guide|review|2026|comparison)\b", " ", title or "", flags=re.I)
    return trim(" ".join(cleaned.split()), 70) or "this product"


def build_hook(item):
    t = (item.get("title") or "").lower()
    topic = topic_label(item.get("title") or "")
    if "carplay" in t:
        return "🚗 Going wireless sounds easy — but one compatibility mistake can make the adapter useless."
    if "phone" in t or "iphone" in t:
        return f"📱 Before you spend on a {topic}, there’s one question that matters more than the spec sheet."
    if "laptop" in t:
        return "💻 A cheap laptop can become expensive fast if you choose the wrong compromise."
    if "headphone" in t or "earbud" in t:
        return "🎧 Great sound on paper means nothing if comfort, battery and connection let you down."
    if "perfume" in t or "fragrance" in t:
        return "✨ The best fragrance isn’t the loudest one — it’s the one people remember."
    return f"⚠️ Before you spend money on {topic}, check what actually matters — not just the headline price."


def build_tags(item):
    blob = f'{item.get("title","")} {item.get("category","")}'.lower()
    tags = []
    candidates = [
        ("carplay", "#CarPlay"), ("wireless", "#Wireless"), ("adapter", "#CarTech"),
        ("iphone", "#iPhone"), ("phone", "#Smartphone"), ("laptop", "#Laptop"),
        ("headphone", "#Headphones"), ("earbud", "#Earbuds"), ("perfume", "#Fragrance"),
        ("smartwatch", "#Smartwatch"), ("deal", "#Deals"), ("comparison", "#Comparison"),
    ]
    for needle, tag in candidates:
        if needle in blob and tag not in tags:
            tags.append(tag)
        if len(tags) >= 3:
            break
    if not tags:
        tags = ["#BuyingGuide", "#TrendPilotChoice"]
    elif "#TrendPilotChoice" not in tags and len(tags) < 3:
        tags.append("#TrendPilotChoice")
    return " ".join(tags[:3])


def build_question(item):
    t = (item.get("title") or "").lower()
    if "carplay" in t:
        return "💬 What matters most to you: compatibility, fast reconnect, or price?"
    if "phone" in t or "iphone" in t:
        return "💬 Which matters more to you: camera, battery, or price?"
    if "laptop" in t:
        return "💬 Your priority: battery, performance, portability, or price?"
    if "headphone" in t or "earbud" in t:
        return "💬 What wins for you: sound, comfort, ANC, or battery?"
    return "💬 What would make you choose it — or skip it?"


def build_caption(item, target, max_len=980):
    title = html.escape(trim(item["title"], 180))
    hook = html.escape(build_hook(item))
    summary = html.escape(trim(item.get("description") or item.get("category") or "", 240))
    question = html.escape(build_question(item))
    tags = build_tags(item)
    parts = [
        f"<b>{hook}</b>",
        f"🎯 <b>{title}</b>",
    ]
    if summary:
        parts.append(f"✅ <b>Quick take:</b> {summary}")
    parts.append(question)
    parts.append("👍 Useful? React.  🔥 Want more like this?")
    parts.append(tags)
    caption = "\n\n".join(parts)
    if len(caption) > max_len:
        summary = html.escape(trim(item.get("description") or "", 120))
        parts = [f"<b>{hook}</b>", f"🎯 <b>{title}</b>"]
        if summary:
            parts.append(f"✅ <b>Quick take:</b> {summary}")
        parts.extend([question, "👍 Useful? React.  🔥 Want more like this?", tags])
        caption = "\n\n".join(parts)
    return caption[:max_len]


def inline_keyboard(target):
    return json.dumps({
        "inline_keyboard": [[
            {"text": "🔎 See the full guide", "url": target}
        ]]
    }, ensure_ascii=False)


def maybe_send_poll(item, published_count):
    if published_count % 3 != 0:
        return None
    t = (item.get("title") or "").lower()
    if "carplay" in t:
        question = "What matters most in a wireless CarPlay adapter?"
        options = ["Compatibility", "Fast reconnect", "Price", "Warranty/returns"]
    elif "phone" in t or "iphone" in t:
        question = "What matters most when you choose a phone?"
        options = ["Camera", "Battery", "Performance", "Price"]
    else:
        question = "What matters most when you buy tech?"
        options = ["Reliability", "Features", "Price", "Reviews"]
    return telegram_api("sendPoll", {
        "chat_id": CHANNEL,
        "question": question,
        "options": json.dumps(options, ensure_ascii=False),
        "is_anonymous": "true",
        "allows_multiple_answers": "false",
    })


def publish(item, published_count):
    target = with_utm(item["link"], item.get("title") or "")
    caption = build_caption(item, target)
    payload_common = {
        "chat_id": CHANNEL,
        "parse_mode": "HTML",
        "reply_markup": inline_keyboard(target),
    }

    if item.get("image"):
        try:
            result = telegram_api(
                "sendPhoto",
                {
                    **payload_common,
                    "photo": item["image"],
                    "caption": caption,
                },
            )
            poll = maybe_send_poll(item, published_count + 1)
            return result, target, "photo", poll
        except Exception:
            pass

    result = telegram_api(
        "sendMessage",
        {
            **payload_common,
            "text": caption,
            "disable_web_page_preview": "false",
        },
    )
    poll = maybe_send_poll(item, published_count + 1)
    return result, target, "message", poll


def main():
    generated_at = datetime.now(timezone.utc).isoformat()
    state = load_state()
    seen = set(state.get("published_guids") or [])
    published_count = int(state.get("published_count") or 0)
    items = parse_feed()
    trends = fetch_google_trends()
    selected, selected_score, trend_matches = select_item(items, seen, trends)

    result = {
        "generated_at": generated_at,
        "channel": CHANNEL,
        "feed_url": FEED_URL,
        "feed_items": len(items),
        "trend_queries_loaded": len(trends),
        "trend_geos": TREND_GEOS,
        "status": "no-new-item",
        "selected": selected,
        "selected_search_score": selected_score,
        "trend_matches": trend_matches,
    }

    if selected is None:
        save_json(LAST_PATH, result)
        print(json.dumps(result, ensure_ascii=False))
        return 0

    try:
        created, target, mode, poll = publish(selected, published_count)
        seen.add(selected["guid"])
        state["published_guids"] = list(seen)[-1000:]
        state["published_count"] = published_count + 1
        state["updated_at"] = generated_at
        save_json(STATE_PATH, state)
        result.update({
            "status": "published",
            "message_id": created.get("message_id"),
            "target_url": target,
            "mode": mode,
            "poll_message_id": (poll or {}).get("message_id") if poll else None,
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
