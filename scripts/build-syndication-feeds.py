#!/usr/bin/env python3
from __future__ import annotations

import html
import json
import re
from datetime import datetime, timezone
from email.utils import format_datetime
from html.parser import HTMLParser
from pathlib import Path
from xml.sax.saxutils import escape

ROOT = Path(__file__).resolve().parents[1]
ORIGIN = "https://trendpilotchoice.com"
NOW = datetime.now(timezone.utc)


class DocParser(HTMLParser):
    SKIP = {"script", "style", "nav", "header", "footer", "noscript", "svg"}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.in_title = False
        self.skip_depth = 0
        self.title_bits = []
        self.text_bits = []
        self.meta = {}

    def handle_starttag(self, tag, attrs):
        tag = tag.lower()
        attrs = {str(k).lower(): str(v) for k, v in attrs if k and v is not None}
        if tag == "title":
            self.in_title = True
        if tag in self.SKIP:
            self.skip_depth += 1
        if tag == "meta":
            key = (attrs.get("name") or attrs.get("property") or "").lower()
            value = attrs.get("content", "").strip()
            if key and value:
                self.meta[key] = value

    def handle_endtag(self, tag):
        tag = tag.lower()
        if tag == "title":
            self.in_title = False
        if tag in self.SKIP and self.skip_depth:
            self.skip_depth -= 1

    def handle_data(self, data):
        data = " ".join(data.split())
        if not data:
            return
        if self.in_title:
            self.title_bits.append(data)
        if not self.skip_depth:
            self.text_bits.append(data)


def compact(value):
    return " ".join(html.unescape(value or "").split()).strip()


def parse_date(value):
    value = (value or "").strip()
    try:
        if len(value) == 10:
            return datetime.fromisoformat(value + "T12:00:00+00:00")
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return (dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)).astimezone(timezone.utc)
    except Exception:
        return NOW


def page_url(path):
    rel = path.relative_to(ROOT).as_posix()
    if rel.endswith("/index.html"):
        rel = rel[:-10]
    elif rel == "index.html":
        rel = ""
    return f"{ORIGIN}/{rel}" if rel else ORIGIN + "/"


def category_for(url):
    if "/events/" in url:
        return "Football & Match Travel"
    if "/software/" in url or "/compare/" in url:
        return "Software & Comparisons"
    if "/sourcing/" in url:
        return "Business Sourcing"
    if "/products/" in url:
        return "Buying Guides"
    return "TrendPilot Guides"


def summary(meta_desc, body):
    desc = compact(meta_desc)
    body = compact(body)
    combined = compact(desc + " " + body)
    if len(combined) < 320:
        combined += " TrendPilot focuses on practical buying or booking decisions, current routes, limitations and the next useful action for the visitor."
    if len(combined) > 650:
        combined = combined[:647].rsplit(" ", 1)[0] + "…"
    return compact(combined)


def read_page(path, fallback_date):
    if not path.exists():
        return None
    raw = path.read_text(encoding="utf-8", errors="ignore")
    p = DocParser()
    p.feed(raw)
    title = compact(" ".join(p.title_bits))
    title = re.sub(r"\s*[|—-]\s*TrendPilot(?: AI)?\s*$", "", title, flags=re.I).strip()
    if not title:
        title = path.parent.name.replace("-", " ").title()
    date_match = re.search(r'"dateModified"\s*:\s*"([^"]+)"', raw) or re.search(r'"datePublished"\s*:\s*"([^"]+)"', raw)
    image = (p.meta.get("og:image") or p.meta.get("twitter:image") or "").replace("https://trendpilot-ai.netlify.app", ORIGIN)
    url = page_url(path)
    return {
        "title": title,
        "url": url,
        "summary": summary(p.meta.get("description") or p.meta.get("og:description") or "", " ".join(p.text_bits)),
        "image": image,
        "published": parse_date(date_match.group(1) if date_match else fallback_date.isoformat()),
        "category": category_for(url),
    }


def candidate_paths():
    paths = [ROOT / p for p in [
        "products/wireless-carplay-adapters/index.html",
        "software/filmora-review/index.html",
        "software/best-video-editor-for-beginners/index.html",
        "compare/filmora-vs-capcut/index.html",
        "sourcing/alibaba-vs-aliexpress/index.html",
        "sourcing/find-verified-alibaba-suppliers/index.html",
        "sourcing/how-to-find-verified-suppliers/index.html",
        "events/discover/index.html",
    ]]
    registry_path = ROOT / "data/event-factory/events.json"
    if registry_path.exists():
        registry = json.loads(registry_path.read_text(encoding="utf-8"))
        for event in registry.get("events", []):
            if event.get("status") == "ready" and event.get("slug"):
                paths.append(ROOT / f"events/{event['slug']}/index.html")
    for pattern in ("events/teams/*/index.html", "events/venues/*/index.html", "events/leagues/*/index.html"):
        paths.extend(sorted(ROOT.glob(pattern)))
    out, seen = [], set()
    for path in paths:
        key = path.as_posix()
        if key not in seen:
            seen.add(key)
            out.append(path)
    return out


def build_items():
    fallback = NOW
    growth_path = ROOT / "data/event-factory/growth-network.json"
    if growth_path.exists():
        try:
            fallback = parse_date(json.loads(growth_path.read_text(encoding="utf-8")).get("generated_at"))
        except Exception:
            pass
    items = [read_page(path, fallback) for path in candidate_paths()]
    return [item for item in items if item][:40]


def rss(items, title, description, self_url):
    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:media="http://search.yahoo.com/mrss/">',
        '<channel>',
        f'<title>{escape(title)}</title>',
        f'<link>{ORIGIN}/</link>',
        f'<description>{escape(description)}</description>',
        '<language>en</language>',
        f'<lastBuildDate>{format_datetime(NOW)}</lastBuildDate>',
        f'<atom:link href="{escape(self_url)}" rel="self" type="application/rss+xml" />',
    ]
    for item in items:
        url = escape(item["url"])
        lines += [
            '<item>',
            f'<title>{escape(item["title"])}</title>',
            f'<link>{url}</link>',
            f'<guid isPermaLink="true">{url}</guid>',
            f'<pubDate>{format_datetime(item["published"])}</pubDate>',
            '<dc:creator>TrendPilot Editorial</dc:creator>',
            f'<category>{escape(item["category"])}</category>',
            f'<description>{escape(item["summary"])}</description>',
            f'<content:encoded><![CDATA[<p>{html.escape(item["summary"])}</p><p><a href="{html.escape(item["url"], quote=True)}">Open the full TrendPilot guide</a></p>]]></content:encoded>',
        ]
        if item.get("image"):
            lines.append(f'<media:content url="{escape(item["image"])}" medium="image" />')
        lines.append('</item>')
    lines += ['</channel>', '</rss>']
    return "\n".join(lines) + "\n"


def atom(items):
    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<feed xmlns="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">',
        '<title>TrendPilot Guides &amp; Match Travel</title>',
        f'<id>{ORIGIN}/</id>',
        f'<link href="{ORIGIN}/" />',
        f'<link href="{ORIGIN}/atom.xml" rel="self" type="application/atom+xml" />',
        f'<updated>{NOW.isoformat().replace("+00:00", "Z")}</updated>',
        '<author><name>TrendPilot Editorial</name></author>',
    ]
    for item in items:
        lines += [
            '<entry>',
            f'<title>{escape(item["title"])}</title>',
            f'<id>{escape(item["url"])}</id>',
            f'<link href="{escape(item["url"])}" />',
            f'<updated>{item["published"].isoformat().replace("+00:00", "Z")}</updated>',
            f'<published>{item["published"].isoformat().replace("+00:00", "Z")}</published>',
            f'<category term="{escape(item["category"])}" />',
            f'<summary>{escape(item["summary"])}</summary>',
        ]
        if item.get("image"):
            lines.append(f'<media:content url="{escape(item["image"])}" medium="image" />')
        lines.append('</entry>')
    lines.append('</feed>')
    return "\n".join(lines) + "\n"


def json_feed(items):
    payload = {
        "version": "https://jsonfeed.org/version/1.1",
        "title": "TrendPilot Guides & Match Travel",
        "home_page_url": ORIGIN + "/",
        "feed_url": ORIGIN + "/feed.json",
        "description": "Practical buying guides, comparison help, football tickets and match-travel planning from TrendPilot.",
        "authors": [{"name": "TrendPilot Editorial", "url": ORIGIN + "/about.html"}],
        "items": [],
    }
    for item in items:
        row = {
            "id": item["url"], "url": item["url"], "title": item["title"],
            "summary": item["summary"], "content_text": item["summary"],
            "date_published": item["published"].isoformat().replace("+00:00", "Z"),
            "tags": [item["category"]],
        }
        if item.get("image"):
            row["image"] = item["image"]
        payload["items"].append(row)
    return json.dumps(payload, ensure_ascii=False, indent=2) + "\n"


def video_feed():
    runtime_path = ROOT / "data/runtime/event-short-video-factory.json"
    registry_path = ROOT / "data/event-factory/events.json"
    events, videos = {}, []
    if registry_path.exists():
        reg = json.loads(registry_path.read_text(encoding="utf-8"))
        events = {e.get("slug"): e for e in reg.get("events", []) if e.get("slug")}
    if runtime_path.exists():
        runtime = json.loads(runtime_path.read_text(encoding="utf-8"))
        videos = [v for v in runtime.get("videos", []) if v.get("status") == "rendered" and v.get("public_url")]
    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">',
        '<channel>', '<title>TrendPilot Match Videos</title>', f'<link>{ORIGIN}/events/discover/</link>',
        '<description>Short vertical football match and travel guides from TrendPilot.</description>', '<language>en</language>',
        f'<lastBuildDate>{format_datetime(NOW)}</lastBuildDate>',
        f'<atom:link href="{ORIGIN}/feeds/videos.xml" rel="self" type="application/rss+xml" />',
    ]
    for v in videos:
        event = events.get(v.get("event"), {})
        name = event.get("event_name") or str(v.get("event", "Match guide")).replace("-", " ").title()
        event_url = f'{ORIGIN}/events/{v.get("event")}/'
        video_url = v["public_url"]
        text = f'{name}: a short TrendPilot match and travel guide. Open the full page for ticket-route notes, fixture timing, hotel and travel planning.'
        lines += [
            '<item>', f'<title>{escape(name)} — short match &amp; travel guide</title>', f'<link>{escape(event_url)}</link>',
            f'<guid isPermaLink="false">{escape(video_url)}</guid>', f'<pubDate>{format_datetime(NOW)}</pubDate>',
            f'<description>{escape(text)}</description>',
            f'<enclosure url="{escape(video_url)}" type="video/mp4" length="{int(v.get("bytes") or 0)}" />',
            f'<media:content url="{escape(video_url)}" medium="video" type="video/mp4" />', '</item>'
        ]
    lines += ['</channel>', '</rss>']
    return "\n".join(lines) + "\n"


def main():
    items = build_items()
    if len(items) < 20:
        raise SystemExit(f"Need at least 20 quality syndication items; found {len(items)}")
    feeds = ROOT / "feeds"
    feeds.mkdir(parents=True, exist_ok=True)
    (ROOT / "feed.xml").write_text(rss(items, "TrendPilot Guides & Match Travel", "Practical buying guides, comparison help, football tickets and match-travel planning from TrendPilot.", ORIGIN + "/feed.xml"), encoding="utf-8")
    (ROOT / "atom.xml").write_text(atom(items), encoding="utf-8")
    (ROOT / "feed.json").write_text(json_feed(items), encoding="utf-8")
    event_items = [x for x in items if "/events/" in x["url"]]
    (feeds / "events.xml").write_text(rss(event_items, "TrendPilot Football Match & Travel Guides", "Football ticket routes, stadium guides, team pages and match-travel planning from TrendPilot.", ORIGIN + "/feeds/events.xml"), encoding="utf-8")
    (feeds / "videos.xml").write_text(video_feed(), encoding="utf-8")
    manifest = {
        "generated_at": NOW.isoformat(), "item_count": len(items), "event_item_count": len(event_items),
        "feeds": {"rss": ORIGIN + "/feed.xml", "atom": ORIGIN + "/atom.xml", "json": ORIGIN + "/feed.json", "events": ORIGIN + "/feeds/events.xml", "videos": ORIGIN + "/feeds/videos.xml"},
        "quality": {"minimum_items": 20, "creator_present": True, "media_supported": True, "links_return_to_trendpilot": True}
    }
    out = ROOT / "data/runtime/syndication-feed-manifest.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
