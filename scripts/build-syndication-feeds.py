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

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.in_title = False
        self.skip_depth = 0
        self.title_bits: list[str] = []
        self.text_bits: list[str] = []
        self.meta: dict[str, str] = {}

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


def compact(text: str) -> str:
    return " ".join(html.unescape(text or "").split()).strip()


def safe_summary(meta_desc: str, body_text: str) -> str:
    desc = compact(meta_desc)
    body = compact(body_text)
    if desc and body.lower().startswith(desc.lower()):
        body = body[len(desc):].strip()
    combined = compact((desc + " " + body).strip())
    if len(combined) < 320:
        combined = compact(combined + " TrendPilot focuses on practical buying or booking decisions, current routes, limitations and the next useful action for the visitor.")
    if len(combined) > 650:
        combined = combined[:647].rsplit(" ", 1)[0] + "…"
    return combined


def parse_date(raw: str) -> datetime:
    raw = (raw or "").strip()
    if not raw:
        return NOW
    try:
        if len(raw) == 10:
            return datetime.fromisoformat(raw + "T12:00:00+00:00")
        dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except Exception:
        return NOW


def page_url(path: Path) -> str:
    rel = path.relative_to(ROOT).as_posix()
    if rel.endswith("/index.html"):
        rel = rel[:-10]
    elif rel == "index.html":
        rel = ""
    return f"{ORIGIN}/{rel}" if rel else ORIGIN + "/"


def category_for(url: str) -> str:
    if "/events/" in url:
        return "Football & Match Travel"
    if "/software/" in url or "/compare/" in url:
        return "Software & Comparisons"
    if "/sourcing/" in url:
        return "Business Sourcing"
    if "/products/" in url:
        return "Buying Guides"
    return "TrendPilot Guides"


def load_page(path: Path, fallback_date: datetime) -> dict | None:
    if not path.exists() or not path.is_file():
        return None
    raw = path.read_text(encoding="utf-8", errors="ignore")
    parser = DocParser()
    parser.feed(raw)
    title = compact(" ".join(parser.title_bits))
    title = re.sub(r"\s*[|—-]\s*TrendPilot(?: AI)?\s*$", "", title, flags=re.I).strip() or path.parent.name.replace("-", " ").title()
    meta_desc = parser.meta.get("description") or parser.meta.get("og:description") or ""
    image = parser.meta.get("og:image") or parser.meta.get("twitter:image") or ""
    image = image.replace("https://trendpilot-ai.netlify.app", ORIGIN)
    date_match = re.search(r'"dateModified"\s*:\s*"([^"]+)"', raw)
    if not date_match:
        date_match = re.search(r'"datePublished"\s*:\s*"([^"]+)"', raw)
    published = parse_date(date_match.group(1) if date_match else fallback_date.isoformat())
    url = page_url(path)
    body = " ".join(parser.text_bits)
    summary = safe_summary(meta_desc, body)
    return {
        "title": title,
        "url": url,
        "summary": summary,
        "image": image,
        "published": published,
        "category": category_for(url),
    }


def candidate_paths() -> list[Path]:
    fixed = [
        "products/wireless-carplay-adapters/index.html",
        "software/filmora-review/index.html",
        "software/best-video-editor-for-beginners/index.html",
        "compare/filmora-vs-capcut/index.html",
        "sourcing/alibaba-vs-aliexpress/index.html",
        "sourcing/find-verified-alibaba-suppliers/index.html",
        "sourcing/how-to-find-verified-suppliers/index.html",
        "events/discover/index.html",
    ]
    paths = [ROOT / p for p in fixed]

    registry_path = ROOT / "data/event-factory/events.json"
    ready: list[str] = []
    if registry_path.exists():
        registry = json.loads(registry_path.read_text(encoding="utf-8"))
        ready = [e.get("slug") for e in registry.get("events", []) if e.get("status") == "ready" and e.get("slug")]
    for slug in ready:
        paths.append(ROOT / f"events/{slug}/index.html")

    for pattern in (
        "events/teams/*/index.html",
        "events/venues/*/index.html",
        "events/leagues/*/index.html",
    ):
        paths.extend(sorted(ROOT.glob(pattern)))

    seen = set()
    ordered = []
    for p in paths:
        key = p.as_posix()
        if key not in seen:
            seen.add(key)
            ordered.append(p)
    return ordered


def build_items() -> list[dict]:
    fallback = NOW
    growth_path = ROOT / "data/event-factory/growth-network.json"
    if growth_path.exists():
        try:
            growth = json.loads(growth_path.read_text(encoding="utf-8"))
            fallback = parse_date(growth.get("generated_at", ""))
        except Exception:
            pass

    items = []
    for path in candidate_paths():
        item = load_page(path, fallback)
        if item:
            items.append(item)
    # Keep a substantial but compact feed. Flipboard recommends at least 20 recent items.
    items = items[:40]
    return items


def rss(items: list[dict], title: str, description: str, self_url: str) -> str:
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
        summary = escape(item["summary"])
        url = escape(item["url"])
        title_esc = escape(item["title"])
        lines += [
            '<item>',
            f'<title>{title_esc}</title>',
            f'<link>{url}</link>',
            f'<guid isPermaLink="true">{url}</guid>',
            f'<pubDate>{format_datetime(item["published"])}</pubDate>',
            '<dc:creator>TrendPilot Editorial</dc:creator>',
            f'<category>{escape(item["category"])}</category>',
            f'<description>{summary}</description>',
            f'<content:encoded><![CDATA[<p>{html.escape(item["summary"])}</p><p><a href="{html.escape(item["url"], quote=True)}">Open the full TrendPilot guide</a></p>]]></content:encoded>',
        ]
        if item.get("image"):
            lines.append(f'<media:content url="{escape(item["image"])}" medium="image" />')
        lines.append('</item>')
    lines += ['</channel>', '</rss>']
    return "\n".join(lines) + "\n"


def atom(items: list[dict]) -> str:
    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<feed xmlns="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">',
        '<title>TrendPilot Guides & Match Travel</title>',
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
    lines += ['</feed>']
    return "\n".join(lines) + "\n"


def json_feed(items: list[dict]) -> str:
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
            "id": item["url"],
            "url": item["url"],
            "title": item["title"],
            "summary": item["summary"],
            "content_text": item["summary"],
            "date_published": item["published"].isoformat().replace("+00:00", "Z"),
            "tags": [item["category"]],
        }
        if item.get("image"):
            row["image"] = item["image"]
        payload["items"].append(row)
    return json.dumps(payload, ensure_ascii=False, indent=2) + "\n"


def video_feed() -> str:
    runtime_path = ROOT / "data/runtime/event-short-video-factory.json"
    registry_path = ROOT / "data/event-factory/events.json"
    videos = []
    events = {}
    if registry_path.exists():
        reg = json.loads(registry_path.read_text(encoding="utf-8"))
        events = {e.get("slug"): e for e in reg.get("events", []) if e.get("slug")}
    if runtime_path.exists():
        runtime = json.loads(runtime_path.read_text(encoding="utf-8"))
        videos = [v for v in runtime.get("videos", []) if v.get("status") == "rendered" and v.get("public_url")]

    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">',
        '<channel>',
        '<title>TrendPilot Match Videos</title>',
        f'<link>{ORIGIN}/events/discover/</link>',
        '<description>Short vertical football match and travel guides from TrendPilot.</description>',
        '<language>en</language>',
        f'<lastBuildDate>{format_datetime(NOW)}</lastBuildDate>',
        f'<atom:link href="{ORIGIN}/feeds/videos.xml" rel="self" type="application/rss+xml" />',
    ]
    for v in videos:
        event = events.get(v.get("event"), {})
        name = event.get("event_name") or v.get("event", "Match guide").replace("-", " ").title()
        event_url = f'{ORIGIN}/events/{v.get("event")}/'
        video_url = v["public_url"]
        summary = f'{name}: a short TrendPilot match and travel guide. Open the full page for ticket-route notes, fixture timing, hotel and travel planning.'
        lines += [
            '<item>',
            f'<title>{escape(name)} — short match &amp; travel guide</title>',
            f'<link>{escape(event_url)}</link>',
            f'<guid isPermaLink="false">{escape(video_url)}</guid>',
            f'<pubDate>{format_datetime(NOW)}</pubDate>',
            f'<description>{escape(summary)}</description>',
            f'<enclosure url="{escape(video_url)}" type="video/mp4" length="{int(v.get("bytes") or 0)}" />',
            f'<media:content url="{escape(video_url)}" medium="video" type="video/mp4" />',
            '</item>',
        ]
    lines += ['</channel>', '</rss>']
    return "\n".join(lines) + "\n"


def main() -> None:
    items = build_items()
    if len(items) < 20:
        raise SystemExit(f"Need at least 20 quality syndication items; found {len(items)}")

    feeds = ROOT / "feeds"
    feeds.mkdir(parents=True, exist_ok=True)

    (ROOT / "feed.xml").write_text(
        rss(
            items,
            "TrendPilot Guides & Match Travel",
            "Practical buying guides, comparison help, football tickets and match-travel planning from TrendPilot.",
            ORIGIN + "/feed.xml",
        ),
        encoding="utf-8",
    )
    (ROOT / "atom.xml").write_text(atom(items), encoding="utf-8")
    (ROOT / "feed.json").write_text(json_feed(items), encoding="utf-8")

    event_items = [x for x in items if "/events/" in x["url"]]
    (feeds / "events.xml").write_text(
        rss(
            event_items,
            "TrendPilot Football Match & Travel Guides",
            "Football ticket routes, stadium guides, team pages and match-travel planning from TrendPilot.",
            ORIGIN + "/feeds/events.xml",
        ),
        encoding="utf-8",
    )
    (feeds / "videos.xml").write_text(video_feed(), encoding="utf-8")

    manifest = {
        "generated_at": NOW.isoformat(),
        "item_count": len(items),
        "event_item_count": len(event_items),
        "feeds": {
            "rss": ORIGIN + "/feed.xml",
            "atom": ORIGIN + "/atom.xml",
            "json": ORIGIN + "/feed.json",
            "events": ORIGIN + "/feeds/events.xml",
            "videos": ORIGIN + "/feeds/videos.xml",
        },
        "quality": {
            "minimum_items": 20,
            "creator_present": True,
            "media_supported": True,
            "links_return_to_trendpilot": True,
        },
    }
    (ROOT / "data/runtime/syndication-feed-manifest.json").parent.mkdir(parents=True, exist_ok=True)
    (ROOT / "data/runtime/syndication-feed-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
