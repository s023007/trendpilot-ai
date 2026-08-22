#!/usr/bin/env python3
import html
import json
import os
import re
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path

client_id = os.environ.get("WORDPRESS_CLIENT_ID", "").strip()
client_secret = os.environ.get("WORDPRESS_CLIENT_SECRET", "").strip()
username = os.environ.get("WORDPRESS_USERNAME", "").strip()
app_password = os.environ.get("WORDPRESS_APP_PASSWORD", "").strip()
target_site = os.environ.get("WORDPRESS_SITE", "trendpilotchoice.wordpress.com").strip().lower()

state_path = Path("data/runtime/wordpress-growth-state.json")
result_path = Path("data/runtime/wordpress-growth-last.json")
state_path.parent.mkdir(parents=True, exist_ok=True)
try:
    state = json.loads(state_path.read_text())
except Exception:
    state = {"version": 2, "published": []}
published = {str(x.get("guid")) for x in state.get("published", []) if x.get("guid")}

result = {
    "generated_at": datetime.now(timezone.utc).isoformat(),
    "status": "starting",
    "target_site": target_site,
    "site_id": None,
    "site_url": None,
    "selected": None,
    "wordpress_post": None,
    "error": None,
}


def persist_result():
    result_path.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n")


def http_json(req, label, limit=1800):
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            return json.loads(response.read().decode())
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", "replace")[:limit]
        result["status"] = "error"
        result["error"] = f"{label}: HTTP {exc.code}: {body}"
        persist_result()
        raise SystemExit(result["error"])
    except Exception as exc:
        result["status"] = "error"
        result["error"] = f"{label}: {exc}"
        persist_result()
        raise SystemExit(result["error"])


missing = [
    key
    for key, value in {
        "WORDPRESS_CLIENT_ID": client_id,
        "WORDPRESS_CLIENT_SECRET": client_secret,
        "WORDPRESS_USERNAME": username,
        "WORDPRESS_APP_PASSWORD": app_password,
    }.items()
    if not value
]
if missing:
    result["status"] = "error"
    result["error"] = "Missing GitHub secrets/settings: " + ", ".join(missing)
    persist_result()
    raise SystemExit(result["error"])

# Authenticate with WordPress.com.
token_body = urllib.parse.urlencode(
    {
        "client_id": client_id,
        "client_secret": client_secret,
        "grant_type": "password",
        "username": username,
        "password": app_password,
    }
).encode()
token_req = urllib.request.Request(
    "https://public-api.wordpress.com/oauth2/token",
    data=token_body,
    method="POST",
    headers={"Content-Type": "application/x-www-form-urlencoded"},
)
token_data = http_json(token_req, "WordPress token exchange failed", 1200)
token = str(token_data.get("access_token") or "").strip()
if not token:
    result["status"] = "error"
    result["error"] = "WordPress token response did not include access_token"
    persist_result()
    raise SystemExit(result["error"])

# Resolve the actual numeric WordPress.com site ID.
sites_req = urllib.request.Request(
    "https://public-api.wordpress.com/rest/v1.1/me/sites?fields=ID,name,URL,capabilities",
    method="GET",
    headers={"Authorization": f"Bearer {token}"},
)
sites_data = http_json(sites_req, "WordPress site discovery failed")
sites = sites_data.get("sites") or []


def host_of(value):
    value = str(value or "").strip()
    if not value:
        return ""
    if "://" not in value:
        value = "https://" + value
    return (urllib.parse.urlsplit(value).hostname or "").lower().rstrip(".")


target_host = host_of(target_site)
chosen = next((site for site in sites if host_of(site.get("URL")) == target_host), None)
if not chosen:
    result["status"] = "error"
    result["error"] = f"Target WordPress site '{target_site}' was not found among {len(sites)} sites available to this token"
    persist_result()
    raise SystemExit(result["error"])

site_id = chosen.get("ID")
site_url = chosen.get("URL")
capabilities = chosen.get("capabilities") or {}
if not site_id:
    result["status"] = "error"
    result["error"] = f"WordPress returned the target site but no numeric ID for '{target_site}'"
    persist_result()
    raise SystemExit(result["error"])
if capabilities and not capabilities.get("publish_posts", True):
    result["status"] = "error"
    result["error"] = f"The authenticated WordPress account does not have publish_posts permission on '{target_site}'"
    persist_result()
    raise SystemExit(result["error"])

result["site_id"] = str(site_id)
result["site_url"] = site_url

# External syndication must land on a useful TrendPilot page, never on a seller or
# an empty/generic search screen.
def eligible_internal_destination(url):
    parsed = urllib.parse.urlsplit(str(url or "").strip())
    host = (parsed.hostname or "").lower().rstrip(".")
    path = re.sub(r"/+", "/", parsed.path or "/")
    normalized = path.rstrip("/") or "/"
    if host not in {"trendpilotchoice.com", "www.trendpilotchoice.com"}:
        return False
    if normalized in {"/", "/find", "/search"}:
        return False
    if normalized.startswith("/find/") or normalized.startswith("/search/"):
        return False
    return True


MEDIA_TAG = "{http://search.yahoo.com/mrss/}content"
root = ET.parse("feed.xml").getroot()
channel = root.find("channel")
items = []
for node in channel.findall("item"):
    title = (node.findtext("title") or "").strip()
    link = (node.findtext("link") or "").strip()
    guid = (node.findtext("guid") or link).strip()
    desc = (node.findtext("description") or "").strip()
    pub_raw = (node.findtext("pubDate") or "").strip()
    category = (node.findtext("category") or "TrendPilot Guides").strip()
    media_node = node.find(MEDIA_TAG)
    image_url = (media_node.get("url") if media_node is not None else "") or ""
    try:
        pub_dt = parsedate_to_datetime(pub_raw)
        if pub_dt.tzinfo is None:
            pub_dt = pub_dt.replace(tzinfo=timezone.utc)
    except Exception:
        pub_dt = datetime.min.replace(tzinfo=timezone.utc)
    if (
        title
        and link
        and guid
        and guid not in published
        and eligible_internal_destination(link)
    ):
        items.append(
            (
                pub_dt,
                {
                    "title": title,
                    "link": link,
                    "guid": guid,
                    "description": desc,
                    "category": category,
                    "image_url": image_url,
                },
            )
        )

if not items:
    result["status"] = "nothing-new"
    persist_result()
    print(json.dumps(result, ensure_ascii=False))
    raise SystemExit(0)

items.sort(key=lambda pair: pair[0], reverse=True)
item = items[0][1]
result["selected"] = item

# Create a short, clean teaser rather than copying page navigation and metadata.
text = html.unescape(re.sub(r"<[^>]+>", " ", item["description"]))
noise_patterns = [
    r"\bSkip to content\b",
    r"\bSearch the catalogue\b",
    r"\bClear comparisons\. Real products\. Fewer buying mistakes\.\b",
    r"\bAffiliate links disclosed\b",
    r"\bBuyer checklist included\b",
    r"\bQuick answer\b",
    r"\bQuick verdict\b",
]
for pattern in noise_patterns:
    text = re.sub(pattern, " ", text, flags=re.I)
text = re.sub(re.escape(item["title"]), " ", text, flags=re.I)
text = re.sub(r"\bTrendPilot AI\b", " ", text, flags=re.I)
text = re.sub(r"\s+", " ", text).strip(" -—|·")
if len(text) > 380:
    text = text[:380].rsplit(" ", 1)[0].rstrip(" ,;:-") + "…"

parsed = urllib.parse.urlsplit(item["link"])
query = dict(urllib.parse.parse_qsl(parsed.query, keep_blank_values=True))
query.update(
    {
        "utm_source": "wordpress",
        "utm_medium": "referral",
        "utm_campaign": "trendpilot_internal_first",
    }
)
tracked_link = urllib.parse.urlunsplit(
    (parsed.scheme, parsed.netloc, parsed.path, urllib.parse.urlencode(query), parsed.fragment)
)
path = parsed.path.lower()

if path.startswith("/products/"):
    cta = "See the product guide, compatibility checks and seller options"
    note = "Check compatibility, current price, stock, shipping and return terms on TrendPilot before continuing to a seller."
elif path.startswith("/software/"):
    cta = "Open the full software review and buying guidance"
    note = "Plans, features and pricing can change. Review the current fit and plan details on TrendPilot before purchasing."
elif path.startswith("/compare/"):
    cta = "Open the full comparison and choose the better fit"
    note = "Compare the important differences first, then continue from TrendPilot to the relevant product or seller option."
elif path.startswith("/sourcing/") or path.startswith("/wholesale/"):
    cta = "Open the complete sourcing and supplier-check guide"
    note = "Supplier terms, minimum orders and availability can change. Verify the current evidence and terms before paying."
elif path.startswith("/events/") or path.startswith("/tickets/"):
    cta = "Open tickets and the complete match-travel guide"
    note = "Event schedules, ticket availability and travel prices can change. Confirm the latest details before booking."
elif path.startswith("/rare-used/"):
    cta = "Open the full rare-find details and buying checks"
    note = "Used and rare listings can disappear quickly. Confirm condition, seller evidence and current availability before buying."
else:
    cta = "Open the complete TrendPilot guide"
    note = "Review the latest details on TrendPilot before continuing to any seller or booking provider."

image_url = str(item.get("image_url") or "").strip()
image_html = ""
if re.search(r"\.(?:jpe?g|png|webp)(?:\?|$)", image_url, flags=re.I):
    image_html = (
        f'<p><a href="{html.escape(tracked_link, quote=True)}">'
        f'<img src="{html.escape(image_url, quote=True)}" alt="{html.escape(item["title"], quote=True)}" '
        f'style="max-width:100%;height:auto;border-radius:12px"></a></p>'
    )

body = (
    image_html
    + f"<p>{html.escape(text)}</p>"
    + f'<p><strong><a href="{html.escape(tracked_link, quote=True)}">{html.escape(cta)} →</a></strong></p>'
    + f"<p><em>{html.escape(note)}</em></p>"
)

payload = json.dumps(
    {"title": item["title"], "content": body, "status": "publish"}
).encode()
post_req = urllib.request.Request(
    f"https://public-api.wordpress.com/wp/v2/sites/{site_id}/posts",
    data=payload,
    method="POST",
    headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
)
post = http_json(post_req, "WordPress publish failed")

record = {
    "guid": item["guid"],
    "source_url": item["link"],
    "tracked_url": tracked_link,
    "destination_policy": "specific-trendpilot-page-first",
    "title": item["title"],
    "category": item["category"],
    "wordpress_post_id": post.get("id") or post.get("ID"),
    "wordpress_url": post.get("link") or post.get("URL"),
    "published_at": datetime.now(timezone.utc).isoformat(),
}
state["version"] = 2
state.setdefault("published", []).append(record)
state_path.write_text(json.dumps(state, indent=2, ensure_ascii=False) + "\n")
result.update({"status": "published", "wordpress_post": record, "error": None})
persist_result()
print("WORDPRESS_RESULT", json.dumps(result, ensure_ascii=False))
