#!/usr/bin/env python3
from pathlib import Path
from urllib.parse import quote_plus

ROOT = Path(__file__).resolve().parents[1]
PRODUCTS = ROOT / 'products'

CATEGORIES = [
    {
        'slug': 'phones-tablets', 'name': 'Phones & tablets', 'icon': 'P', 'scope': 'phones',
        'description': 'Browse phones, tablets and mobile devices by the job you need them to do, then narrow to a brand, model or code when you are ready.',
        'intents': [('Phones', 'phone'), ('Tablets', 'tablet'), ('Android phones', 'android phone'), ('iPhone', 'iphone')],
        'tips': ['Start with the main device, not cases or straps.', 'Use the exact model when compatibility matters.', 'Compare storage, condition, seller and current price before leaving TrendPilot.'],
    },
    {
        'slug': 'computers-laptops', 'name': 'Computers & laptops', 'icon': 'L', 'scope': 'computers',
        'description': 'Start with the type of computer you need, then compare practical differences such as processor class, memory, storage, portability and seller terms.',
        'intents': [('Laptops', 'laptop'), ('Business laptops', 'business laptop'), ('Gaming laptops', 'gaming laptop'), ('Mini PCs', 'mini pc')],
        'tips': ['Choose the use case before the brand.', 'Check RAM, storage and processor generation together.', 'Confirm keyboard layout, warranty and power-plug details before payment.'],
    },
    {
        'slug': 'audio', 'name': 'Audio', 'icon': 'A', 'scope': 'audio',
        'description': 'Browse headphones, earbuds and audio gear by how and where you listen, then inspect the exact product page or search result before choosing a seller.',
        'intents': [('Headphones', 'headphones'), ('Wireless earbuds', 'wireless earbuds'), ('Noise cancelling', 'noise cancelling headphones'), ('Portable audio', 'portable speaker')],
        'tips': ['Match the product to travel, work, gaming or exercise.', 'Check codec, battery and microphone needs before price.', 'Keep replacement pads, cases and cables separate from the main device.'],
    },
    {
        'slug': 'cameras', 'name': 'Cameras', 'icon': 'C', 'scope': 'cameras',
        'description': 'Browse cameras and imaging products by shooting goal first, then narrow to the exact body, lens or specialist device you need.',
        'intents': [('Digital cameras', 'digital camera'), ('Action cameras', 'action camera'), ('Security cameras', 'security camera'), ('Camera lenses', 'camera lens')],
        'tips': ['Separate camera bodies from lenses and accessories.', 'Check mount, sensor and recording requirements.', 'Confirm whether a listing is new, used, refurbished or body-only.'],
    },
    {
        'slug': 'home-kitchen', 'name': 'Home & kitchen', 'icon': 'H', 'scope': 'home',
        'description': 'Explore appliances, cookware and practical home products by the task they solve, then compare size, capacity, power and seller terms.',
        'intents': [('Air fryers', 'air fryer'), ('Cookware', 'cookware'), ('Coffee gear', 'coffee maker'), ('Smart home', 'smart home')],
        'tips': ['Check dimensions before comparing discounts.', 'Confirm voltage and plug type for electrical products.', 'For cookware, compare material, size and compatibility with your hob.'],
    },
    {
        'slug': 'fashion', 'name': 'Fashion', 'icon': 'F', 'scope': 'apparel',
        'description': 'Browse clothing, footwear and everyday style by product type first so you can narrow the choice without guessing the perfect search phrase.',
        'intents': [('Clothing', 'clothing'), ('Shoes', 'shoes'), ('Bags', 'bags'), ('Everyday accessories', 'fashion accessories')],
        'tips': ['Start with product type and intended use.', 'Check size charts and return terms before price alone.', 'Use material, fit and measurements to compare similar-looking products.'],
    },
    {
        'slug': 'beauty-fragrance', 'name': 'Beauty & fragrance', 'icon': 'B', 'scope': 'beauty',
        'description': 'Browse skincare, cosmetics and fragrance by the result or product type you want, then inspect the exact item and seller before buying.',
        'intents': [('Fragrance', 'perfume'), ('Skincare', 'skincare'), ('Makeup', 'makeup'), ('Hair care', 'hair care')],
        'tips': ['Use exact product names for fragrance sizes and concentrations.', 'Check ingredients and pack size rather than image alone.', 'Compare seller authenticity signals and return terms where available.'],
    },
    {
        'slug': 'automotive', 'name': 'Automotive', 'icon': 'V', 'scope': 'automotive',
        'description': 'Explore car technology, accessories and parts by the job they solve, then verify compatibility before continuing to a seller.',
        'intents': [('Car accessories', 'car accessories'), ('Wireless CarPlay', 'wireless carplay adapter'), ('Car chargers', 'car charger'), ('Dash cameras', 'dash cam')],
        'tips': ['Compatibility comes before price.', 'Check connector, vehicle system and installation method.', 'Open a TrendPilot guide when a product depends on model-specific fit.'],
    },
    {
        'slug': 'sports-outdoors', 'name': 'Sports & outdoors', 'icon': 'S', 'scope': 'sports',
        'description': 'Browse fitness, recreation and outdoor products by activity first, then narrow to the size, specification or equipment type that fits your use.',
        'intents': [('Fitness equipment', 'fitness equipment'), ('Running', 'running gear'), ('Camping', 'camping gear'), ('Cycling', 'cycling accessories')],
        'tips': ['Choose by activity and frequency of use.', 'Check dimensions, weight limits and sizing carefully.', 'Separate replacement parts and accessories from the main equipment.'],
    },
    {
        'slug': 'pet-supplies', 'name': 'Pet supplies', 'icon': 'D', 'scope': 'pets',
        'description': 'Browse food, care, beds, toys and practical pet products by animal and need, then narrow to the exact product before buying.',
        'intents': [('Dog supplies', 'dog supplies'), ('Cat supplies', 'cat supplies'), ('Pet food', 'pet food'), ('Pet beds', 'pet bed')],
        'tips': ['Start with animal, size and need.', 'For food, check formulation, pack size and suitability.', 'Keep feeders, preparation machines and accessories separate from the food itself.'],
    },
    {
        'slug': 'tools-workshop', 'name': 'Tools & workshop', 'icon': 'T', 'scope': 'tools',
        'description': 'Browse tools, workshop equipment and parts by the job you need to complete, then narrow to size, power system or exact model.',
        'intents': [('Power tools', 'power tools'), ('Hand tools', 'hand tools'), ('Workshop equipment', 'workshop equipment'), ('Tool parts', 'replacement tool parts')],
        'tips': ['Identify the job before the tool family.', 'Check battery platform, voltage and included accessories.', 'For parts, use exact model or part number whenever possible.'],
    },
    {
        'slug': '3d-printing', 'name': '3D printing', 'icon': '3', 'scope': 'printing',
        'description': 'Browse printers, filament and related materials separately so the main machine is not mixed with consumables or replacement parts.',
        'intents': [('3D printers', '3d printer'), ('PLA filament', 'pla filament'), ('PETG filament', 'petg filament'), ('Printer parts', '3d printer parts')],
        'tips': ['Keep printers, filament and parts as separate buying decisions.', 'Check filament diameter and material compatibility.', 'For printers, compare build volume, enclosure and supported materials.'],
    },
]

STYLE = '''<style>
.tp-cat-hero{padding:42px 0 28px}.tp-cat-hero h1{max-width:760px}.tp-cat-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}.tp-cat-choice{display:block;padding:22px;border:1px solid rgba(255,255,255,.11);border-radius:18px;background:rgba(255,255,255,.04);text-decoration:none;color:inherit}.tp-cat-choice b{display:block;font-size:1.08rem;margin-bottom:6px}.tp-cat-choice span{opacity:.76}.tp-cat-tips{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.tp-cat-tip{padding:20px;border-radius:18px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.09)}@media(max-width:800px){.tp-cat-grid,.tp-cat-tips{grid-template-columns:1fr 1fr}}@media(max-width:520px){.tp-cat-grid,.tp-cat-tips{grid-template-columns:1fr}.tp-cat-hero{padding-top:26px}}
</style>'''

HEADER = '''<header class="tp-header" data-v13-header><div class="tp-shell tp-nav"><a class="tp-brand" href="/" aria-label="TrendPilot AI home"><img src="/images/logo-v4.svg" alt="" width="42" height="42"><span>TrendPilot <em>AI</em></span></a><nav class="tp-links" data-tp-nav aria-label="Primary navigation"><strong class="tp-menu-title">Explore TrendPilot</strong><button class="tp-menu-close" data-tp-menu-close type="button" aria-label="Close menu">×</button><a href="/products/">Products & categories</a><a href="/price-watch/">Saved products</a><a href="/rare-used/">Rare Finds</a><a href="/tickets/">Tickets & experiences</a><a href="/guides/">Buying Guides</a><a href="/sourcing/">Business & wholesale</a></nav><button class="tp-menu-button" data-tp-menu-button type="button" aria-expanded="false" aria-label="Open menu"><span></span><span></span><span></span></button></div><button class="tp-nav-backdrop" data-tp-nav-backdrop type="button" aria-label="Close menu"></button></header>'''

FOOTER = '''<footer class="tp-footer" data-v13-footer><div class="tp-shell tp-footer-grid"><div><a class="tp-brand" href="/"><img src="/images/logo-v4.svg" alt="" width="42" height="42"><span>TrendPilot <em>AI</em></span></a><p>Browse products, compare seller options and check important details before buying.</p></div><div><h2>Shop</h2><a href="/products/">Products & categories</a><a href="/find/">Search products</a><a href="/compare/">Compare</a><a href="/deals/">Deals & coupons</a></div><div><h2>Explore</h2><a href="/software/">Software</a><a href="/rare-used/">Rare Finds</a><a href="/tickets/">Tickets & experiences</a><a href="/sourcing/">Business sourcing</a></div><div><h2>Help & trust</h2><a href="/editorial-methodology.html">How we rank</a><a href="/affiliate-disclosure.html">Affiliate disclosure</a><a href="/privacy.html">Privacy</a><a href="/contact.html">Contact</a></div></div><div class="tp-shell tp-footer-bottom"><span>© <span data-year></span> TrendPilot AI.</span><span>Prices, stock and delivery can change. Confirm them before payment.</span></div></footer><nav class="tp-bottom-nav" aria-label="Mobile navigation"><a data-bottom-link href="/"><b>⌂</b><span>Home</span></a><a data-bottom-link href="/products/"><b>▦</b><span>Browse</span></a><a data-bottom-link href="/deals/"><b>↓</b><span>Deals</span></a><a data-bottom-link href="/compare/"><b>⇄</b><span>Compare</span></a></nav><script defer src="/js/site-v13-5.js?v=13.8.9"></script><script defer src="/js/smart-search-v14.js?v=21.12.0"></script><script defer src="/js/seller-handoff-v21-15.js?v=21.15.0"></script>'''


def search_url(query, scope):
    return f'/find/?q={quote_plus(query)}&scope={quote_plus(scope)}&engine=v2064'


def render(cat):
    choices = ''.join(
        f'<a class="tp-cat-choice" href="{search_url(q, cat["scope"])}"><b>{label}</b><span>Open a focused TrendPilot product view →</span></a>'
        for label, q in cat['intents']
    )
    tips = ''.join(f'<div class="tp-cat-tip">{tip}</div>' for tip in cat['tips'])
    canonical = f'https://trendpilotchoice.com/products/{cat["slug"]}/'
    return f'''<!doctype html><html lang="en"><head><meta name="color-scheme" content="dark"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#0d1630"><meta name="robots" content="index,follow,max-image-preview:large"><title>{cat['name']} — TrendPilot AI</title><meta name="description" content="{cat['description']}"><link rel="canonical" href="{canonical}"><meta property="og:site_name" content="TrendPilot AI"><meta property="og:type" content="website"><meta property="og:title" content="{cat['name']} — TrendPilot AI"><meta property="og:description" content="{cat['description']}"><meta property="og:url" content="{canonical}"><link rel="icon" href="/images/favicon-v4.svg" type="image/svg+xml"><link rel="stylesheet" href="/css/style-v13-2.css?v=13.2.0"><link rel="stylesheet" href="/css/style-v13-5.css?v=13.5.0"><link rel="stylesheet" href="/css/decision-v14.css?v=14.0.0"><link rel="stylesheet" href="/css/v20-7-shopper-experience.css?v=20.9.0"><link rel="stylesheet" href="/css/trendpilot-calm-dark-v21.css?v=21.0.0"><link rel="stylesheet" href="/css/trendpilot-graphite-navy-v21-1.css?v=21.2.0"><link rel="stylesheet" href="/css/trendpilot-v21-2-1-final.css?v=21.12.0">{STYLE}</head><body data-tp-page="product-category"><a class="tp-skip" href="#main">Skip to content</a>{HEADER}<main id="main"><section class="v207-home-hero tp-cat-hero"><div class="tp-shell"><span class="v207-eyebrow">{cat['name']}</span><h1>Start with the product type. <span>Use search only when it helps.</span></h1><p>{cat['description']}</p><div class="tp-quick-links"><a class="tp-chip" href="/products/">← All departments</a></div></div></section><section class="v207-section white"><div class="tp-shell"><div class="v207-section-head"><div><span class="v207-eyebrow">Popular starting points</span><h2>Choose the route closest to what you want.</h2></div><p>You can begin here without knowing the exact model name. Each route keeps you inside TrendPilot until you are ready to compare seller options.</p></div><div class="tp-cat-grid">{choices}</div></div></section><section class="v207-section soft"><div class="tp-shell"><div class="v207-section-head"><div><span class="v207-eyebrow">Before you buy</span><h2>Three checks that reduce bad clicks.</h2></div><p>Product fit comes before seller handoff.</p></div><div class="tp-cat-tips">{tips}</div></div></section><section class="v207-section dark"><div class="tp-shell tp-tool-layout"><div class="tp-tool-copy"><span class="v207-eyebrow">Search helper</span><h2>Know the exact brand, model or code?</h2><p>Use the search tool now. The product details stay on TrendPilot first, and the seller is the final step.</p></div><form class="tp-tool-form" action="/find/" method="get"><label>Product, brand, model or code<input name="q" type="search" required placeholder="Type what you are looking for..."></label><input type="hidden" name="scope" value="{cat['scope']}"><input type="hidden" name="engine" value="v2064"><button class="tp-btn tp-btn-primary" type="submit">Find this product</button></form></div></section></main>{FOOTER}</body></html>'''


def patch_hub():
    hub = PRODUCTS / 'index.html'
    if not hub.exists():
        return False
    text = hub.read_text(encoding='utf-8')
    changed = False
    replacements = {
        '/find/?q=phone&scope=phones&engine=v2064': '/products/phones-tablets/',
        '/find/?q=laptop&scope=computers&engine=v2064': '/products/computers-laptops/',
        '/find/?q=headphones&scope=audio&engine=v2064': '/products/audio/',
        '/find/?q=camera&scope=cameras&engine=v2064': '/products/cameras/',
        '/find/?q=home&scope=home&engine=v2064': '/products/home-kitchen/',
        '/find/?q=clothing&scope=apparel&engine=v2064': '/products/fashion/',
        '/find/?q=beauty&scope=beauty&engine=v2064': '/products/beauty-fragrance/',
        '/find/?q=car+accessories&scope=automotive&engine=v2064': '/products/automotive/',
        '/find/?q=sports&scope=sports&engine=v2064': '/products/sports-outdoors/',
        '/find/?q=pet+supplies&scope=pets&engine=v2064': '/products/pet-supplies/',
        '/find/?q=tools&scope=tools&engine=v2064': '/products/tools-workshop/',
        '/find/?q=3d+printer&scope=printing&engine=v2064': '/products/3d-printing/',
    }
    for old, new in replacements.items():
        if old in text:
            text = text.replace(old, new)
            changed = True
    if changed:
        hub.write_text(text, encoding='utf-8')
    return changed


def main():
    PRODUCTS.mkdir(exist_ok=True)
    made = []
    for cat in CATEGORIES:
        target = PRODUCTS / cat['slug'] / 'index.html'
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(render(cat), encoding='utf-8')
        made.append(str(target.relative_to(ROOT)))
    patched = patch_hub()
    print('Generated category hubs:')
    for path in made:
        print('-', path)
    print('Patched products/index.html:', patched)


if __name__ == '__main__':
    main()
