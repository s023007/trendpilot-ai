#!/usr/bin/env python3
import html
import json
import os
import re
import tempfile
import traceback
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path

import pytumblr
from PIL import Image

STATE_PATH = Path('data/runtime/tumblr-growth-state.json')
RESULT_PATH = Path('data/runtime/tumblr-growth-last.json')
FEED_PATH = Path('feed.xml')
TARGET_BLOG = 'trendpilotchoice'
MEDIA_TAG = '{http://search.yahoo.com/mrss/}content'

STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
try:
    state = json.loads(STATE_PATH.read_text(encoding='utf-8'))
except Exception:
    state = {'version': 1, 'published': []}
published = {str(x.get('guid')) for x in state.get('published', []) if x.get('guid')}

result = {
    'generated_at': datetime.now(timezone.utc).isoformat(),
    'status': 'starting',
    'blog': None,
    'selected': None,
    'tumblr_post': None,
    'error': None,
}


def save_result():
    RESULT_PATH.write_text(json.dumps(result, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')


def fail(message):
    result['status'] = 'error'
    result['error'] = str(message)
    save_result()
    raise SystemExit(str(message))


def eligible_internal_destination(url):
    parsed = urllib.parse.urlsplit(str(url or '').strip())
    host = (parsed.hostname or '').lower().rstrip('.')
    path = re.sub(r'/+', '/', parsed.path or '/')
    normalized = path.rstrip('/') or '/'
    if host not in {'trendpilotchoice.com', 'www.trendpilotchoice.com'}:
        return False
    if normalized in {'/', '/find', '/search'}:
        return False
    if normalized.startswith('/find/') or normalized.startswith('/search/'):
        return False
    return True


def clean_teaser(text, title):
    text = html.unescape(re.sub(r'<[^>]+>', ' ', text or ''))
    for pattern in [
        r'\bSkip to content\b',
        r'\bSearch the catalogue\b',
        r'\bClear comparisons\. Real products\. Fewer buying mistakes\.\b',
        r'\bAffiliate links disclosed\b',
        r'\bBuyer checklist included\b',
        r'\bQuick answer\b',
        r'\bQuick verdict\b',
    ]:
        text = re.sub(pattern, ' ', text, flags=re.I)
    text = re.sub(re.escape(title), ' ', text, flags=re.I)
    text = re.sub(r'\bTrendPilot AI\b', ' ', text, flags=re.I)
    text = re.sub(r'\s+', ' ', text).strip(' -—|·')
    if len(text) > 360:
        text = text[:360].rsplit(' ', 1)[0].rstrip(' ,;:-') + '…'
    return text


def tags_for(item):
    category = item['category'].lower()
    title = item['title'].lower()
    tags = ['TrendPilot', 'buying guide', 'smart shopping']
    if 'football' in category or 'match' in title or 'ticket' in title:
        tags += ['football', 'match travel', 'tickets']
    elif 'software' in category or 'filmora' in title or 'video editor' in title:
        tags += ['software', 'video editing', 'creator tools']
    elif 'sourcing' in category or 'supplier' in title or 'alibaba' in title:
        tags += ['business sourcing', 'Alibaba', 'supplier verification']
    elif 'carplay' in title or 'automotive' in category:
        tags += ['wireless carplay', 'car accessories', 'car gadgets']
    else:
        tags += ['product research', 'comparison shopping']
    return list(dict.fromkeys(tags))[:12]


def cta_for(path):
    path = path.lower()
    if path.startswith('/products/'):
        return 'Open the product guide and seller options', 'Check compatibility, current price, stock, shipping and return terms on TrendPilot before continuing to a seller.'
    if path.startswith('/software/'):
        return 'Open the full software review', 'Plans, features and pricing can change. Review the current fit and plan details on TrendPilot before purchasing.'
    if path.startswith('/compare/'):
        return 'Open the full comparison', 'Compare the important differences first, then continue from TrendPilot to the relevant product or seller option.'
    if path.startswith('/sourcing/') or path.startswith('/wholesale/'):
        return 'Open the complete sourcing guide', 'Supplier terms, minimum orders and availability can change. Verify the current evidence and terms before paying.'
    if path.startswith('/events/') or path.startswith('/tickets/'):
        return 'Open tickets and the complete match-travel guide', 'Event schedules, ticket availability and travel prices can change. Confirm the latest details before booking.'
    if path.startswith('/rare-used/'):
        return 'Open the full TrendPilot rare-find page', 'Condition, seller evidence and availability matter more than headline price for scarce products.'
    return 'Open the full TrendPilot guide', 'Review the product and decision details on TrendPilot before continuing to a seller.'


def download_as_jpeg(url):
    if not url:
        return None
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'TrendPilotTumblrPublisher/1.0'})
        with urllib.request.urlopen(req, timeout=30) as response:
            data = response.read(8_000_000)
        if not data:
            return None
        raw = tempfile.NamedTemporaryFile(delete=False, suffix='.img')
        raw.write(data)
        raw.close()
        image = Image.open(raw.name).convert('RGB')
        out = tempfile.NamedTemporaryFile(delete=False, suffix='.jpg')
        out.close()
        image.thumbnail((1600, 1600))
        image.save(out.name, 'JPEG', quality=90, optimize=True, progressive=False)
        Image.open(out.name).verify()
        return out.name
    except Exception:
        return None


required = ['TUMBLR_CONSUMER_KEY', 'TUMBLR_CONSUMER_SECRET', 'TUMBLR_OAUTH_TOKEN', 'TUMBLR_OAUTH_TOKEN_SECRET']
missing = [name for name in required if not os.environ.get(name, '').strip()]
if missing:
    fail('Missing GitHub secrets: ' + ', '.join(missing))
if not FEED_PATH.exists():
    fail('feed.xml is missing')

try:
    client = pytumblr.TumblrRestClient(
        os.environ['TUMBLR_CONSUMER_KEY'],
        os.environ['TUMBLR_CONSUMER_SECRET'],
        os.environ['TUMBLR_OAUTH_TOKEN'],
        os.environ['TUMBLR_OAUTH_TOKEN_SECRET'],
    )
    info = client.info()
    blogs = info.get('user', {}).get('blogs', []) if isinstance(info, dict) else []
    chosen = (
        next((b for b in blogs if str(b.get('name', '')).lower() == TARGET_BLOG), None)
        or next((b for b in blogs if TARGET_BLOG in str(b.get('url', '')).lower()), None)
        or next((b for b in blogs if b.get('primary')), None)
        or (blogs[0] if blogs else None)
    )
    if not chosen:
        fail('No Tumblr blog resolved for the authenticated account')
    blog_name = chosen.get('name') or chosen.get('url')
    result['blog'] = blog_name

    root = ET.parse(FEED_PATH).getroot()
    channel = root.find('channel')
    items = []
    for node in channel.findall('item'):
        title = (node.findtext('title') or '').strip()
        link = (node.findtext('link') or '').strip()
        guid = (node.findtext('guid') or link).strip()
        desc = (node.findtext('description') or '').strip()
        pub_raw = (node.findtext('pubDate') or '').strip()
        category = (node.findtext('category') or 'TrendPilot Guides').strip()
        media_node = node.find(MEDIA_TAG)
        image_url = ((media_node.get('url') if media_node is not None else '') or '').strip()
        try:
            pub_dt = parsedate_to_datetime(pub_raw)
            if pub_dt.tzinfo is None:
                pub_dt = pub_dt.replace(tzinfo=timezone.utc)
        except Exception:
            pub_dt = datetime.min.replace(tzinfo=timezone.utc)
        if title and link and guid and guid not in published and eligible_internal_destination(link):
            items.append((pub_dt, {
                'title': title, 'link': link, 'guid': guid, 'description': desc,
                'category': category, 'image_url': image_url,
            }))

    if not items:
        result['status'] = 'nothing-new'
        save_result()
        raise SystemExit(0)

    items.sort(key=lambda pair: pair[0], reverse=True)
    item = items[0][1]
    result['selected'] = item

    parsed = urllib.parse.urlsplit(item['link'])
    query = dict(urllib.parse.parse_qsl(parsed.query, keep_blank_values=True))
    query.update({'utm_source': 'tumblr', 'utm_medium': 'organic', 'utm_campaign': 'trendpilot_internal_first'})
    tracked_link = urllib.parse.urlunsplit((parsed.scheme, parsed.netloc, parsed.path, urllib.parse.urlencode(query), parsed.fragment))
    teaser = clean_teaser(item['description'], item['title'])
    cta, note = cta_for(parsed.path)
    tags = tags_for(item)
    caption = (
        f'<h2>{html.escape(item["title"])}</h2>'
        f'<p>{html.escape(teaser)}</p>'
        f'<p><a href="{html.escape(tracked_link, quote=True)}"><strong>{html.escape(cta)}</strong></a></p>'
        f'<p><em>{html.escape(note)}</em></p>'
    )

    image_path = download_as_jpeg(item.get('image_url'))
    if image_path:
        response = client.create_photo(
            blog_name, state='queue', tags=tags, format='html',
            caption=caption, link=tracked_link, data=image_path,
        )
        post_type = 'photo'
    else:
        response = client.create_text(
            blog_name, state='queue', tags=tags, format='html',
            title=item['title'], body=caption,
        )
        post_type = 'text'

    post_id = str(response.get('id') or response.get('id_string') or '') if isinstance(response, dict) else ''
    if not post_id:
        fail('Tumblr returned no post id: ' + repr(response))

    verified = False
    queue = client.queue(blog_name, limit=50, offset=0)
    for post in (queue.get('posts', []) if isinstance(queue, dict) else []):
        if str(post.get('id')) == post_id:
            verified = True
            break
    if not verified:
        fail(f'Tumblr post {post_id} was created but did not verify in the queue')

    record = {
        'guid': item['guid'],
        'source_url': item['link'],
        'tracked_url': tracked_link,
        'destination_policy': 'specific-trendpilot-page-first',
        'title': item['title'],
        'category': item['category'],
        'post_id': post_id,
        'post_type': post_type,
        'state': response.get('state') if isinstance(response, dict) else 'queue',
        'queued_at': datetime.now(timezone.utc).isoformat(),
    }
    state.setdefault('published', []).append(record)
    STATE_PATH.write_text(json.dumps(state, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    result.update({'status': 'queued', 'tumblr_post': record, 'error': None})
    save_result()
    print(json.dumps(result, ensure_ascii=False))
except SystemExit:
    raise
except Exception:
    result['status'] = 'error'
    result['error'] = traceback.format_exc()
    save_result()
    raise
