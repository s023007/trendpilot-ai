#!/usr/bin/env python3
import html
import re
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path

SRC = Path("feed.xml")
OUT = Path("smartnews.xml")
SITE = "https://trendpilotchoice.com"
LOGO = SITE + "/images/smartnews-logo.png"
USER_AGENT = "TrendPilotChoice-SmartNewsFeed/1.0"
MAX_BYTES = 900_000
MAX_ITEMS = 30

NS = {
    "content": "http://purl.org/rss/1.0/modules/content/",
    "dc": "http://purl.org/dc/elements/1.1/",
    "media": "http://search.yahoo.com/mrss/",
}


def esc(v):
    return html.escape(v or "", quote=True)


def cdata(v):
    return (v or "").replace("]]>", "]]]]><![CDATA[>")


def strip_html(v):
    v = re.sub(r"<[^>]+>", " ", v or "")
    v = html.unescape(v)
    return " ".join(v.split())


def clean_text(v):
    v = strip_html(v)
    noise = [
        "Skip to content", "Clear comparisons. Real products. Fewer buying mistakes.",
        "Search the catalogue", "Quick answer", "Buyer checklist included",
        "Affiliate links disclosed", "Our editorial rule",
    ]
    for n in noise:
        v = v.replace(n, " ")
    return " ".join(v.split())


def short_summary(v, title):
    v = clean_text(v)
    if title and v.lower().startswith(title.lower()):
        v = v[len(title):].lstrip(" —:-|")
    if title:
        v = re.sub(re.escape(title), " ", v, flags=re.I)
    v = " ".join(v.split())
    if len(v) <= 150:
        return v
    cut = v[:151]
    pos = max(cut.rfind(". "), cut.rfind("! "), cut.rfind("? "))
    if pos >= 70:
        return cut[:pos + 1].strip()
    return v[:147].rstrip(" ,;:-") + "..."


def canonical_url(url):
    p = urllib.parse.urlsplit(url)
    pairs = [(k, v) for k, v in urllib.parse.parse_qsl(p.query, keep_blank_values=True)
             if not k.lower().startswith("utm_")]
    return urllib.parse.urlunsplit((p.scheme, p.netloc, p.path, urllib.parse.urlencode(pairs), ""))


def fetch_html(url):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=25) as resp:
        return resp.read().decode(resp.headers.get_content_charset() or "utf-8", errors="replace")


def article_body(url):
    try:
        page = fetch_html(url)
    except Exception:
        return ""
    page = re.sub(r"<!--.*?-->", "", page, flags=re.S)
    match = re.search(r"<main\b[^>]*>(.*?)</main>", page, flags=re.I | re.S)
    if not match:
        match = re.search(r"<article\b[^>]*>(.*?)</article>", page, flags=re.I | re.S)
    body = match.group(1) if match else ""
    if not body:
        return ""
    body = re.sub(r"<(script|style|nav|footer|form|aside)\b[^>]*>.*?</\1>", "", body, flags=re.I | re.S)
    body = re.sub(r"\s+", " ", body).strip()
    return body


def get_text(el, tag):
    child = el.find(tag)
    return (child.text or "").strip() if child is not None and child.text else ""


def first_image(item):
    media = item.find("media:content", NS)
    if media is not None and media.attrib.get("url"):
        return media.attrib["url"].strip()
    thumb = item.find("media:thumbnail", NS)
    if thumb is not None and thumb.attrib.get("url"):
        return thumb.attrib["url"].strip()
    enc = item.find("enclosure")
    if enc is not None and (enc.attrib.get("type") or "").startswith("image/"):
        return (enc.attrib.get("url") or "").strip()
    return ""


def build():
    root = ET.parse(SRC).getroot()
    channel = root.find("channel")
    if channel is None:
        raise RuntimeError("feed.xml has no channel")

    now = datetime.now(timezone.utc).strftime("%a, %d %b %Y %H:%M:%S +0000")
    parts = [
        '<?xml version="1.0" encoding="utf-8"?>',
        '<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" '
        'xmlns:dc="http://purl.org/dc/elements/1.1/" '
        'xmlns:media="http://search.yahoo.com/mrss/" '
        'xmlns:snf="http://www.smartnews.be/snf">',
        '<channel>',
        '<title>TrendPilot Choice</title>',
        f'<link>{SITE}/</link>',
        '<description>Smarter buying choices</description>',
        f'<pubDate>{now}</pubDate>',
        '<language>en</language>',
        '<copyright>© TrendPilot Choice</copyright>',
        '<ttl>15</ttl>',
        f'<snf:logo><url>{esc(LOGO)}</url></snf:logo>',
    ]

    count = 0
    for item in channel.findall("item"):
        if count >= MAX_ITEMS:
            break
        title = get_text(item, "title")
        link = canonical_url(get_text(item, "link"))
        guid = get_text(item, "guid") or link
        pub = get_text(item, "pubDate")
        creator = get_text(item, f"{{{NS['dc']}}}creator") or "TrendPilot Editorial"
        category = get_text(item, "category") or "TrendPilot"
        description = get_text(item, "description")
        image = first_image(item)
        if not title or not link or not pub or not image:
            continue

        body = article_body(link)
        if not body:
            encoded = item.find("content:encoded", NS)
            body = (encoded.text or "").strip() if encoded is not None and encoded.text else ""
        if image and image not in body:
            body = f'<figure><img src="{esc(image)}" alt="{esc(title)}"></figure>' + body
        if not body:
            continue

        summary = short_summary(description, title)
        block = [
            '<item>',
            f'<title><![CDATA[{cdata(title)}]]></title>',
            f'<link>{esc(link)}</link>',
            f'<guid isPermaLink="true">{esc(guid)}</guid>',
            f'<description><![CDATA[{cdata(summary)}]]></description>',
            f'<pubDate>{esc(pub)}</pubDate>',
            f'<content:encoded><![CDATA[{cdata(body)}]]></content:encoded>',
            f'<category><![CDATA[{cdata(category)}]]></category>',
            f'<dc:creator><![CDATA[{cdata(creator)}]]></dc:creator>',
            f'<media:thumbnail url="{esc(image)}"/>',
            '<media:status>active</media:status>',
            '</item>',
        ]
        candidate = "\n".join(parts + block + ['</channel>', '</rss>', ''])
        if len(candidate.encode("utf-8")) > MAX_BYTES:
            break
        parts.extend(block)
        count += 1

    if count == 0:
        raise RuntimeError("No valid SmartNews items generated")
    parts.extend(['</channel>', '</rss>', ''])
    OUT.write_text("\n".join(parts), encoding="utf-8")
    print(f"Generated {OUT} with {count} items, {OUT.stat().st_size} bytes")


if __name__ == "__main__":
    build()
