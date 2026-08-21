#!/usr/bin/env python3
import base64
import json
import os
import sys
import urllib.parse
import urllib.request
import urllib.error
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path

FEED_URL = os.getenv("TRENDPILOT_FEED_URL", "https://trendpilotchoice.com/feed.xml")
USERNAME = os.getenv("BIBSONOMY_USERNAME", "").strip()
API_KEY = os.getenv("BIBSONOMY_API_KEY", "").strip()
STATE_PATH = Path(os.getenv("BIBSONOMY_STATE_PATH", "data/runtime/bibsonomy-growth-state.json"))
LAST_PATH = Path(os.getenv("BIBSONOMY_LAST_PATH", "data/runtime/bibsonomy-growth-last.json"))
API_BASE = "https://www.bibsonomy.org/api"
USER_AGENT = "TrendPilotChoice-BibSonomyPublisher/1.0"


def fetch_bytes(url):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read()


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
        items.append({
            "title": title,
            "link": link,
            "guid": guid,
            "description": description,
            "category": category,
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


def trim(value, limit):
    value = " ".join((value or "").split())
    if len(value) <= limit:
        return value
    return value[: max(0, limit - 1)].rstrip() + "…"


def with_utm(url):
    parsed = urllib.parse.urlsplit(url)
    q = urllib.parse.parse_qsl(parsed.query, keep_blank_values=True)
    keys = {k for k, _ in q}
    additions = {
        "utm_source": "bibsonomy",
        "utm_medium": "referral",
        "utm_campaign": "football-match-travel",
    }
    for k, v in additions.items():
        if k not in keys:
            q.append((k, v))
    return urllib.parse.urlunsplit((parsed.scheme, parsed.netloc, parsed.path, urllib.parse.urlencode(q), parsed.fragment))


def build_xml(item, target):
    root = ET.Element("bibsonomy")
    post = ET.SubElement(root, "post", {"description": trim(item.get("description") or item.get("category") or "TrendPilot match and travel guide", 900)})
    ET.SubElement(post, "user", {"name": USERNAME})
    for tag in ["TrendPilot", "Football", "MatchTravel", "TravelGuide", "Tickets"]:
        ET.SubElement(post, "tag", {"name": tag})
    ET.SubElement(post, "group", {"name": "public"})
    ET.SubElement(post, "bookmark", {"url": target, "title": trim(item["title"], 240)})
    return ET.tostring(root, encoding="utf-8", xml_declaration=True)


def publish(item):
    if not USERNAME:
        raise RuntimeError("BIBSONOMY_USERNAME is missing")
    if not API_KEY:
        raise RuntimeError("BIBSONOMY_API_KEY is missing")
    target = with_utm(item["link"])
    payload = build_xml(item, target)
    auth = base64.b64encode(f"{USERNAME}:{API_KEY}".encode("utf-8")).decode("ascii")
    url = f"{API_BASE}/users/{urllib.parse.quote(USERNAME, safe='')}/posts"
    req = urllib.request.Request(
        url,
        data=payload,
        method="POST",
        headers={
            "Authorization": "Basic " + auth,
            "Content-Type": "application/xml; charset=UTF-8",
            "Accept": "application/xml",
            "User-Agent": USER_AGENT,
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = resp.read().decode("utf-8", errors="replace").strip()
            status = getattr(resp, "status", None)
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"BibSonomy HTTP {exc.code}: {body[:1200]}") from exc
    if status not in (200, 201):
        raise RuntimeError(f"BibSonomy unexpected HTTP status {status}: {body[:1200]}")
    return target, status, body


def main():
    generated_at = datetime.now(timezone.utc).isoformat()
    state = load_state()
    seen = set(state.get("published_guids") or [])
    items = parse_feed()
    selected = next((item for item in items if item["guid"] not in seen), None)
    result = {
        "generated_at": generated_at,
        "username": USERNAME or None,
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
        target, http_status, response_body = publish(selected)
        seen.add(selected["guid"])
        state["published_guids"] = list(seen)[-500:]
        state["updated_at"] = generated_at
        save_json(STATE_PATH, state)
        result.update({
            "status": "published",
            "http_status": http_status,
            "target_url": target,
            "api_response": response_body[:1200],
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
