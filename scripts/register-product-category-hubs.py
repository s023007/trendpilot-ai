#!/usr/bin/env python3
from datetime import date
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
SITEMAP = ROOT / 'sitemap.xml'
SLUGS = [
    'phones-tablets', 'computers-laptops', 'audio', 'cameras', 'home-kitchen',
    'fashion', 'beauty-fragrance', 'automotive', 'sports-outdoors',
    'pet-supplies', 'tools-workshop', '3d-printing',
]

text = SITEMAP.read_text(encoding='utf-8')

# Generic search is a utility, not a landing page we want search engines to prioritise.
text = re.sub(
    r'\s*<url>\s*<loc>https://trendpilotchoice\.com/find/</loc>.*?</url>\s*',
    '\n',
    text,
    flags=re.S,
)

stamp = date.today().isoformat()
missing = []
for slug in SLUGS:
    url = f'https://trendpilotchoice.com/products/{slug}/'
    if f'<loc>{url}</loc>' not in text:
        missing.append(f'  <url><loc>{url}</loc><lastmod>{stamp}</lastmod></url>')

if missing:
    block = '\n'.join(missing) + '\n'
    text = text.replace('</urlset>', block + '</urlset>')

SITEMAP.write_text(text, encoding='utf-8')
print(f'Registered {len(missing)} new product category URLs; removed generic /find/ sitemap entry if present.')
