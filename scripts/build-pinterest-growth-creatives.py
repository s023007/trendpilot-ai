#!/usr/bin/env python3
import io
import json
import os
import re
import textwrap
import urllib.request
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CAMPAIGN = 'data/campaigns/pinterest-growth-f106-v1.json'
CAMPAIGN_FILE = Path(os.environ.get('PINTEREST_GROWTH_CAMPAIGN', DEFAULT_CAMPAIGN))
if not CAMPAIGN_FILE.is_absolute():
    CAMPAIGN_FILE = ROOT / CAMPAIGN_FILE
OUTPUT_DIR = Path(os.environ.get('PIN_CREATIVE_OUTPUT_DIR', '/tmp/pinterest-growth'))

W, H = 1000, 1500
NAVY = '#0D1630'
BLUE = '#315FEA'
TEAL = '#20B88A'
LIGHT = '#F6F8FC'
MID = '#687386'
WHITE = '#FFFFFF'
GOLD = '#B77A00'

FONT_BOLD = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
FONT_REGULAR = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'


def font(path, size):
    try:
        return ImageFont.truetype(path, size=size)
    except Exception:
        return ImageFont.load_default()


def load_campaign():
    with CAMPAIGN_FILE.open('r', encoding='utf-8') as f:
        campaign = json.load(f)
    if campaign.get('channel') != 'pinterest':
        raise RuntimeError('Pinterest creative campaign must target pinterest')
    if not campaign.get('product', {}).get('name'):
        raise RuntimeError('Campaign product.name is required')
    if not isinstance(campaign.get('pins'), list) or len(campaign['pins']) < 3:
        raise RuntimeError('Campaign must contain at least three Pinterest variants')
    return campaign


def download_image(image_url):
    req = urllib.request.Request(image_url, headers={'User-Agent': 'TrendPilotPinterestCreative/2.0'})
    with urllib.request.urlopen(req, timeout=60) as response:
        data = response.read()
    return Image.open(io.BytesIO(data)).convert('RGB')


def load_product_image(product):
    explicit_url = product.get('image_url') or product.get('image')
    if explicit_url:
        return download_image(explicit_url), explicit_url

    product_id = str(product.get('id') or '').strip()
    if not product_id:
        raise RuntimeError('Campaign product requires id or image_url')

    bucket = ROOT / 'data/v20-9/products' / f'{product_id[:2]}.json'
    with bucket.open('r', encoding='utf-8') as f:
        products = json.load(f)
    product_record = products.get(product_id) or {}
    image_url = product_record.get('im')
    if not image_url:
        raise RuntimeError(f'No product image for {product_id}')
    return download_image(image_url), image_url


def rounded(draw, box, radius, fill, outline=None, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def fit_product(image, target_box):
    x0, y0, x1, y1 = target_box
    tw, th = x1 - x0, y1 - y0
    contained = ImageOps.contain(image, (tw, th), Image.Resampling.LANCZOS)
    canvas = Image.new('RGB', (tw, th), WHITE)
    px = (tw - contained.width) // 2
    py = (th - contained.height) // 2
    canvas.paste(contained, (px, py))
    return canvas


def draw_wrapped(draw, text, xy, max_chars, font_obj, fill, spacing=10):
    lines = []
    for paragraph in str(text).split('\n'):
        lines.extend(textwrap.wrap(paragraph, width=max_chars) or [''])
    rendered = '\n'.join(lines)
    draw.multiline_text(xy, rendered, font=font_obj, fill=fill, spacing=spacing)
    return draw.multiline_textbbox(xy, rendered, font=font_obj, spacing=spacing)


def clean_label(value, fallback='BUYING GUIDE'):
    value = re.sub(r'[^A-Za-z0-9 &+?/-]+', ' ', str(value or '')).strip().upper()
    return value[:28] or fallback


def creative_badge(pin):
    if pin.get('badge'):
        return clean_label(pin['badge'])
    intent = str(pin.get('intent') or pin.get('angle') or '').lower()
    rules = [
        ('compatib', 'COMPATIBILITY CHECK'),
        ('before', 'BEFORE YOU BUY'),
        ('trade', 'HONEST WATCH-OUTS'),
        ('compar', 'QUICK COMPARISON'),
        ('problem', 'PROBLEM → SOLUTION'),
        ('battery', 'BATTERY & ENDURANCE'),
        ('who', 'WHO IS IT FOR?'),
        ('best for', 'BEST FOR THIS USE'),
        ('question', 'BUYER QUESTION'),
        ('verdict', 'QUICK VERDICT'),
    ]
    for needle, label in rules:
        if needle in intent:
            return label
    return 'BUYING GUIDE'


def footer_copy(pin):
    return str(
        pin.get('footer')
        or pin.get('search_answer')
        or 'See the useful details, trade-offs and current seller options on TrendPilot.'
    )


def make_creative(pin, product_name, product_image):
    seq = int(pin.get('sequence') or 1)
    canvas = Image.new('RGB', (W, H), LIGHT)
    draw = ImageDraw.Draw(canvas)

    # Quiet branded header that leaves the search question as the hero.
    rounded(draw, (60, 55, 940, 145), 32, WHITE)
    draw.text((92, 78), 'TrendPilot', font=font(FONT_BOLD, 34), fill=NAVY)
    draw.text((284, 84), '• smarter buying, fewer surprises', font=font(FONT_REGULAR, 22), fill=MID)
    draw.text((865, 75), '↗', font=font(FONT_BOLD, 42), fill=TEAL)

    accents = [BLUE, TEAL, GOLD, TEAL, BLUE]
    accent = accents[(seq - 1) % len(accents)]
    rounded(draw, (60, 180, 940, 500), 44, WHITE)
    badge_fill = '#EEF3FF' if accent == BLUE else '#EAF8F3' if accent == TEAL else '#FFF4DB'
    rounded(draw, (90, 215, 485, 272), 28, badge_fill)
    draw.text((112, 229), creative_badge(pin), font=font(FONT_BOLD, 21), fill=accent)
    draw_wrapped(draw, pin['headline'], (92, 310), 26, font(FONT_BOLD, 52), NAVY, spacing=9)

    # Product image stage.
    rounded(draw, (60, 535, 940, 1190), 48, WHITE)
    product_stage = fit_product(product_image, (110, 590, 890, 1110))
    canvas.paste(product_stage, (110, 590))

    # Buyer-intent footer: useful answer first, click second.
    rounded(draw, (60, 1225, 940, 1435), 44, NAVY)
    draw_wrapped(draw, product_name, (94, 1250), 42, font(FONT_BOLD, 28), WHITE, spacing=5)
    draw_wrapped(draw, footer_copy(pin), (94, 1305), 48, font(FONT_REGULAR, 23), '#DDE5F7', spacing=6)
    rounded(draw, (755, 1365, 900, 1415), 24, accent)
    draw.text((785, 1377), 'Explore', font=font(FONT_BOLD, 22), fill=WHITE)

    return canvas


def main():
    campaign = load_campaign()
    product = campaign['product']
    product_image, source_url = load_product_image(product)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    manifest = []
    for pin in sorted(campaign['pins'], key=lambda p: int(p.get('sequence') or 0)):
        if not pin.get('pin_id') or not pin.get('headline'):
            raise RuntimeError('Every pin requires pin_id and headline')
        image = make_creative(pin, product['name'], product_image)
        out = OUTPUT_DIR / f"{pin['pin_id']}.png"
        image.save(out, format='PNG', optimize=True)
        manifest.append({
            'pin_id': pin['pin_id'],
            'creative_id': pin.get('creative_id'),
            'intent': pin.get('intent'),
            'search_query': pin.get('search_query'),
            'headline': pin['headline'],
            'image_alt': pin.get('image_alt') or pin['headline'],
            'path': str(out),
            'size': out.stat().st_size,
        })

    manifest_path = OUTPUT_DIR / 'manifest.json'
    manifest_path.write_text(json.dumps({
        'campaign_id': campaign['campaign_id'],
        'asset_slug': campaign.get('asset_slug') or campaign['campaign_id'],
        'primary_keyword': campaign.get('search', {}).get('primary_keyword'),
        'product_id': product.get('id'),
        'source_image': source_url,
        'creatives': manifest,
    }, indent=2), encoding='utf-8')

    print(json.dumps({
        'ok': True,
        'campaign': campaign['campaign_id'],
        'output_dir': str(OUTPUT_DIR),
        'count': len(manifest),
        'manifest': str(manifest_path),
    }))


if __name__ == '__main__':
    main()
