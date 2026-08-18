#!/usr/bin/env python3
import io
import json
import os
import textwrap
import urllib.request
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[1]
CAMPAIGN_FILE = Path(os.environ.get('PINTEREST_GROWTH_CAMPAIGN', ROOT / 'data/campaigns/pinterest-growth-f106-v1.json'))
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
        return json.load(f)


def load_product_image(product_id):
    bucket = ROOT / 'data/v20-9/products' / f'{product_id[:2]}.json'
    with bucket.open('r', encoding='utf-8') as f:
        products = json.load(f)
    product = products.get(product_id) or {}
    image_url = product.get('im')
    if not image_url:
        raise RuntimeError(f'No product image for {product_id}')
    req = urllib.request.Request(image_url, headers={'User-Agent': 'TrendPilotPinterestCreative/1.0'})
    with urllib.request.urlopen(req, timeout=60) as response:
        data = response.read()
    image = Image.open(io.BytesIO(data)).convert('RGB')
    return image, image_url


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
    draw.multiline_text(xy, '\n'.join(lines), font=font_obj, fill=fill, spacing=spacing)
    bbox = draw.multiline_textbbox(xy, '\n'.join(lines), font=font_obj, spacing=spacing)
    return bbox


def creative_badge(sequence):
    return {
        1: 'WHO IS IT FOR?',
        2: '3 THINGS TO KNOW',
        3: 'HONEST WATCH-OUTS',
        4: 'BATTERY & ENDURANCE',
        5: 'FRIENDLY VERDICT',
    }.get(sequence, 'TREND PILOT PICK')


def make_creative(pin, product_name, product_image):
    seq = int(pin['sequence'])
    canvas = Image.new('RGB', (W, H), LIGHT)
    draw = ImageDraw.Draw(canvas)

    # Quiet branded header.
    rounded(draw, (60, 55, 940, 145), 32, WHITE)
    draw.text((92, 78), 'TrendPilot', font=font(FONT_BOLD, 34), fill=NAVY)
    draw.text((284, 84), '• choose with confidence', font=font(FONT_REGULAR, 24), fill=MID)
    draw.text((865, 75), '↗', font=font(FONT_BOLD, 42), fill=TEAL)

    # Headline card changes subtly by creative to avoid near-duplicate visual treatment.
    accent = [BLUE, TEAL, GOLD, TEAL, BLUE][(seq - 1) % 5]
    rounded(draw, (60, 180, 940, 500), 44, WHITE)
    rounded(draw, (90, 215, 430, 272), 28, '#EEF3FF' if accent == BLUE else '#EAF8F3' if accent == TEAL else '#FFF4DB')
    draw.text((112, 229), creative_badge(seq), font=font(FONT_BOLD, 22), fill=accent)
    draw_wrapped(draw, pin['headline'], (92, 310), 26, font(FONT_BOLD, 52), NAVY, spacing=9)

    # Product image stage.
    rounded(draw, (60, 535, 940, 1190), 48, WHITE)
    product_stage = fit_product(product_image, (110, 590, 890, 1110))
    canvas.paste(product_stage, (110, 590))

    # Simple buyer-intent footer rather than a hard sell.
    if seq == 1:
        footer = 'See who it fits — and who should skip it.'
    elif seq == 2:
        footer = 'Useful strengths, without hiding the trade-offs.'
    elif seq == 3:
        footer = 'Know the compromises before you spend.'
    elif seq == 4:
        footer = 'For long days, travel, field work and camping.'
    else:
        footer = 'A calmer way to decide if it feels right for you.'

    rounded(draw, (60, 1225, 940, 1435), 44, NAVY)
    draw.text((94, 1262), 'FOSSiBOT F106 Pro', font=font(FONT_BOLD, 30), fill=WHITE)
    draw_wrapped(draw, footer, (94, 1310), 47, font(FONT_REGULAR, 25), '#DDE5F7', spacing=7)
    rounded(draw, (735, 1270, 900, 1370), 34, accent)
    draw.text((772, 1298), 'Explore', font=font(FONT_BOLD, 27), fill=WHITE)

    return canvas


def main():
    campaign = load_campaign()
    product_id = campaign['product']['id']
    product_image, source_url = load_product_image(product_id)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    manifest = []
    for pin in sorted(campaign['pins'], key=lambda p: p['sequence']):
        image = make_creative(pin, campaign['product']['name'], product_image)
        out = OUTPUT_DIR / f"{pin['pin_id']}.png"
        image.save(out, format='PNG', optimize=True)
        manifest.append({
            'pin_id': pin['pin_id'],
            'creative_id': pin['creative_id'],
            'headline': pin['headline'],
            'path': str(out),
            'size': out.stat().st_size,
        })

    manifest_path = OUTPUT_DIR / 'manifest.json'
    manifest_path.write_text(json.dumps({
        'campaign_id': campaign['campaign_id'],
        'product_id': product_id,
        'source_image': source_url,
        'creatives': manifest,
    }, indent=2), encoding='utf-8')

    print(json.dumps({'ok': True, 'output_dir': str(OUTPUT_DIR), 'count': len(manifest), 'manifest': str(manifest_path)}))


if __name__ == '__main__':
    main()
