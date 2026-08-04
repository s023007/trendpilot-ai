#!/usr/bin/env python3
"""Install TrendPilot V11 global commerce experience into the repository."""
from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path
from xml.sax.saxutils import escape as xml_escape

ROOT = Path(__file__).resolve().parents[1]
BASE = "https://trendpilot-ai.netlify.app"
STYLE = '<link rel="stylesheet" href="/css/style-v11.css?v=11.0.0">'
DEPS = """<script defer src="/js/site-config.js?v=11.0.0"></script>
<script defer src="/js/program-status.js?v=11.0.0"></script>
<script defer src="/js/matched-products.js?v=11.0.0"></script>
<script defer src="/js/affiliate-links.js?v=11.0.0"></script>
<script defer src="/js/coupons-data.js?v=11.0.0"></script>
<script defer src="/js/site-v11.js?v=11.0.0"></script>"""

HEADER = '''<a class="tp-skip" href="#main">Skip to content</a>
<div class="tp-utility" data-v11-header><div class="tp-shell"><span>Live product feeds, clearer comparisons and current savings.</span><a href="/deals/"><strong>Check current deals →</strong></a></div></div>
<header class="tp-header" data-v11-header><div class="tp-shell tp-nav"><a class="tp-brand" href="/" aria-label="TrendPilot AI home"><img src="/images/logo-v4.svg" alt="" width="44" height="44"><span>TrendPilot <em>AI</em></span></a><nav class="tp-links" data-tp-nav aria-label="Primary navigation"><button class="tp-menu-close" data-tp-menu-close type="button" aria-label="Close menu">×</button><a href="/find/">Find products</a><a href="/compare/">Comparisons</a><a href="/products/">Electronics</a><a href="/software/">Software</a><a href="/deals/">Deals</a><a href="/sourcing/">For business</a><a class="tp-nav-cta" href="/find/">Search now</a></nav><button class="tp-menu-button" data-tp-menu-button type="button" aria-expanded="false" aria-label="Open menu"><span></span><span></span><span></span></button></div><button class="tp-nav-backdrop" data-tp-nav-backdrop type="button" aria-label="Close menu"></button></header>'''

FOOTER = '''<footer class="tp-footer" data-v11-footer><div class="tp-shell tp-footer-grid"><div><a class="tp-brand" href="/"><img src="/images/logo-v4.svg" alt="" width="42" height="42"><span>TrendPilot <em>AI</em></span></a><p>Find relevant products, compare the same type and check current savings before opening the seller page.</p></div><div><h2>Shop smarter</h2><a href="/find/">Find products</a><a href="/compare/">Comparisons</a><a href="/deals/">Deals</a><a href="/products/">Electronics</a></div><div><h2>Explore</h2><a href="/software/">Software</a><a href="/sourcing/">For business</a><a href="/about.html">About</a><a href="/contact.html">Contact</a></div><div><h2>Trust</h2><a href="/editorial-methodology.html">How we review</a><a href="/affiliate-disclosure.html">How product links work</a><a href="/privacy.html">Privacy</a><a href="/terms.html">Terms</a></div></div><div class="tp-shell tp-footer-bottom"><span>© <span data-year></span> TrendPilot AI.</span><span>Prices, stock, delivery and coupon terms can change. Confirm them before payment.</span></div></footer>'''

SEARCH_ICON = '''<svg aria-hidden="true" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.4-3.4"></path></svg>'''


def head(title: str, description: str, canonical: str) -> str:
    return f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#071a39"><meta name="robots" content="index,follow,max-image-preview:large"><title>{title}</title><meta name="description" content="{description}"><link rel="canonical" href="{BASE}{canonical}"><meta property="og:site_name" content="TrendPilot AI"><meta property="og:type" content="website"><meta property="og:title" content="{title}"><meta property="og:description" content="{description}"><meta property="og:url" content="{BASE}{canonical}"><link rel="icon" href="/images/favicon-v4.svg" type="image/svg+xml"><link rel="manifest" href="/manifest.webmanifest">{STYLE}</head>'''


def page(title: str, description: str, canonical: str, body_attrs: str, main: str) -> str:
    return f'''{head(title, description, canonical)}<body {body_attrs}>{HEADER}<main id="main">{main}</main>{FOOTER}{DEPS}</body></html>'''


def home_html() -> str:
    main = f'''
<section class="tp-home-hero"><div class="tp-shell"><div><span class="tp-eyebrow">Product finder built around your question</span><h1>Find the right product <em>without the tab chaos.</em></h1><p>Search a product, category or problem. TrendPilot brings relevant live listings together, lets you compare the same type, and shows matching savings when available.</p><form class="tp-search" data-tp-home-search role="search"><label>{SEARCH_ICON}<span class="tp-sr-only">Search products</span><input type="search" required placeholder="Try clothing, electronics, pet feeder or a model name" autocomplete="off"></label><button class="tp-btn tp-btn-primary" type="submit">Find products</button></form><div class="tp-quick-links"><span>Popular:</span><a class="tp-chip" href="/find/?q=clothing">Clothing</a><a class="tp-chip" href="/find/?q=electronics">Electronics</a><a class="tp-chip" href="/find/?q=running+shoes">Running shoes</a><a class="tp-chip" href="/find/?q=smart+home">Smart home</a></div><div class="tp-hero-proof"><div><strong>Relevant first</strong><span>Broad searches route to the right product groups.</span></div><div><strong>Same-type compare</strong><span>No shoes mixed with phones in your shortlist.</span></div><div><strong>Savings matched</strong><span>Coupon and deal checks sit beside the product.</span></div></div></div><div class="tp-hero-stage" aria-hidden="true"><div class="tp-stage-panel"><div class="tp-stage-bar"><span>Smart shortlist</span><span class="tp-stage-dots"><i></i><i></i><i></i></span></div><div class="tp-stage-card"><div class="tp-stage-image">👟</div><div><small>BEST MATCH</small><strong>Running shoes for daily training</strong><span>Fit · cushioning · return terms</span><div class="tp-stage-price"><b>$36.24</b><em>Saving found</em></div></div></div><div class="tp-stage-card"><div class="tp-stage-image">💻</div><div><small>WORK & STUDY</small><strong>Laptops matched to your workload</strong><span>Processor · memory · warranty</span><div class="tp-stage-price"><b>Compare 3</b><em>Live listings</em></div></div></div><div class="tp-stage-card"><div class="tp-stage-image">💡</div><div><small>SMART HOME</small><strong>Lighting that works with your setup</strong><span>App · Wi-Fi · ecosystem</span><div class="tp-stage-price"><b>Check fit</b><em>Current offers</em></div></div></div></div><div class="tp-floating-note"><b>Buyer shortcut</b><strong>Search → narrow → compare</strong><span>Open the seller only when the choice is clearer.</span></div></div></div></section>
<section class="tp-section tp-section-white"><div class="tp-shell"><div class="tp-section-head"><div><span class="tp-kicker">Start by category</span><h2>Find a useful shortlist, not a wall of products.</h2></div><p>Each category opens a focused search with filters that match how people actually choose.</p></div><div class="tp-category-grid">
<a class="tp-category-card" href="/find/?q=electronics"><strong>Electronics that fit your setup</strong><p>Phones, computers, audio, cameras, TV and smart-home devices.</p><b>Explore electronics →</b><span class="tp-category-art" style="--art:linear-gradient(145deg,#dfe6ff,#dff9f0)"></span></a>
<a class="tp-category-card" href="/find/?q=clothing"><strong>Clothing by audience, type and price</strong><p>Dresses, tops, outerwear, jeans, activewear, shoes and accessories.</p><b>Explore fashion →</b><span class="tp-category-art" style="--art:linear-gradient(145deg,#ffe4ed,#ece5ff)"></span></a>
<a class="tp-category-card" href="/find/?q=home+kitchen"><strong>Home & kitchen</strong><p>Dimensions, power, cleaning and delivery.</p><b>Search →</b><span class="tp-category-art"></span></a>
<a class="tp-category-card" href="/find/?q=pet+supplies"><strong>Pet supplies</strong><p>Routine, capacity, safety and cleaning.</p><b>Search →</b><span class="tp-category-art" style="--art:linear-gradient(145deg,#fff0cc,#e5fbf4)"></span></a>
<a class="tp-category-card" href="/find/?q=tools"><strong>Tools & workshop</strong><p>Capacity, materials, accessories and warranty.</p><b>Search →</b><span class="tp-category-art" style="--art:linear-gradient(145deg,#e2efff,#fff0d7)"></span></a>
<a class="tp-category-card" href="/find/?q=beauty+personal+care"><strong>Beauty & care</strong><p>Use, ingredients, device specs and seller clarity.</p><b>Search →</b><span class="tp-category-art" style="--art:linear-gradient(145deg,#ffe5f2,#e9e4ff)"></span></a></div></div></section>
<section class="tp-section tp-section-soft"><div class="tp-shell"><div class="tp-section-head"><div><span class="tp-kicker">Live product options</span><h2>Popular products from connected feeds.</h2></div><p>Images are checked in the browser. Broken or tiny feed images are replaced instead of leaving blank space.</p></div><div class="tp-product-grid" data-tp-home-products><div class="tp-skeleton"></div><div class="tp-skeleton"></div><div class="tp-skeleton"></div></div><div style="text-align:center;margin-top:28px"><a class="tp-btn tp-btn-light" href="/find/">Search the full catalogue</a></div></div></section>
<section class="tp-section tp-section-white"><div class="tp-shell"><div class="tp-section-head"><div><span class="tp-kicker">A shorter path to a decision</span><h2>Three steps, then the seller page.</h2></div></div><div class="tp-how-grid"><article class="tp-how-card"><i>1</i><h3>Describe what you need</h3><p>Use a category, exact model or problem. Broad terms such as clothing now open multiple relevant groups.</p></article><article class="tp-how-card"><i>2</i><h3>Narrow the result</h3><p>Filter by product type, audience, seller, price and whether a saving is available.</p></article><article class="tp-how-card"><i>3</i><h3>Compare compatible options</h3><p>Select two or three products of the same type and check price, seller, subtype and saving side by side.</p></article></div></div></section>
<section class="tp-section tp-section-night"><div class="tp-shell"><div class="tp-section-head"><div><span class="tp-kicker" style="color:#73dcb8">Built for repeat visits</span><h2>Useful before the click, honest after it.</h2></div><p style="color:#aebbd1">TrendPilot does not rank a product higher only because a link pays. Stock, coupon and seller terms still need confirmation.</p></div><div class="tp-trust-strip"><div><strong>Clear product type</strong><span>Comparison stays inside a compatible group.</span></div><div><strong>Current feed data</strong><span>Automated catalogue refresh remains connected.</span></div><div><strong>Coupon context</strong><span>Product-specific codes are not shown on unrelated items.</span></div><div><strong>Buyer-facing language</strong><span>Commercial details stay in the trust pages.</span></div></div></div></section>'''
    return page("TrendPilot AI — Find and Compare Products", "Search live product feeds, compare compatible options and check current savings before buying.", "/", 'data-tp-page="home"', main)


def finder_html() -> str:
    main = f'''
<section class="tp-finder-hero"><div class="tp-shell"><span class="tp-eyebrow">Live product finder</span><h1>What are you trying to buy?</h1><p>Search a product, category or problem. Relevant groups load first; filters and a short buying guide help you narrow the list.</p><form class="tp-search" data-tp-finder-form role="search"><label>{SEARCH_ICON}<span class="tp-sr-only">Search products</span><input data-tp-finder-input type="search" required placeholder="Search clothing, electronics, pet feeder or a model" autocomplete="off"></label><button class="tp-btn tp-btn-primary" type="submit">Search</button></form><div class="tp-quick-links"><span>Try:</span><button class="tp-chip" data-search-suggestion="clothing" type="button">Clothing</button><button class="tp-chip" data-search-suggestion="electronics" type="button">Electronics</button><button class="tp-chip" data-search-suggestion="running shoes" type="button">Running shoes</button><button class="tp-chip" data-search-suggestion="pet feeder" type="button">Pet feeder</button><button class="tp-chip" data-search-suggestion="wireless CarPlay adapter" type="button">Wireless CarPlay</button></div></div></section>
<div class="tp-shell tp-finder-layout"><aside class="tp-filter-panel" data-tp-filter-panel><h2>Refine results</h2><button class="tp-btn tp-btn-light tp-btn-small tp-filter-toggle" data-tp-filter-toggle type="button">Show all filters</button><div class="tp-filter-group"><label for="tp-group">Product type</label><select id="tp-group" data-filter-group><option value="">All categories</option></select></div><div class="tp-filter-group"><label for="tp-audience">For whom</label><select id="tp-audience" data-filter-audience><option value="">Any audience</option><option value="women">Women</option><option value="men">Men</option><option value="kids">Kids</option><option value="unisex">Unisex</option></select></div><div class="tp-filter-group"><label for="tp-merchant">Seller</label><select id="tp-merchant" data-filter-merchant><option value="">All sellers</option></select></div><div class="tp-filter-group"><label for="tp-price">Price</label><select id="tp-price" data-filter-price><option value="">Any price</option><option value="0-10">Under $10</option><option value="10-25">$10–25</option><option value="25-50">$25–50</option><option value="50-100">$50–100</option><option value="100+">Over $100</option></select></div><div class="tp-filter-group"><label for="tp-sort">Sort</label><select id="tp-sort" data-filter-sort><option value="smart">Best match</option><option value="quality">Feed quality</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option></select></div><label class="tp-check"><input data-filter-coupon type="checkbox">Has matched saving</label><button class="tp-filter-reset" data-reset-filters type="button">Clear filters</button></aside><section><div class="tp-results-head"><div><h2 data-tp-results-title>Finding products…</h2><p data-tp-finder-status>Loading connected product feeds.</p></div><span class="tp-results-count" data-tp-results-count>Loading</span></div><div class="tp-category-tabs" data-tp-category-tabs></div><section class="tp-smart-guide" data-tp-smart-guide></section><div class="tp-product-grid" data-tp-product-grid><div class="tp-skeleton"></div><div class="tp-skeleton"></div><div class="tp-skeleton"></div></div><button class="tp-btn tp-btn-light tp-load-more tp-hidden" data-tp-load-more type="button">Show more relevant products</button></section></div>
<div class="tp-compare-tray" data-tp-compare-tray aria-live="polite"><div class="tp-tray-head"><div><strong>Comparison shortlist</strong><span data-tp-tray-count>0 of 3 selected</span></div><button data-tp-clear-compare type="button">Clear</button></div><div class="tp-tray-items" data-tp-tray-items></div><div class="tp-tray-actions"><button class="tp-btn tp-btn-primary tp-btn-wide" data-tp-open-compare type="button" disabled>Compare selected products</button><button class="tp-tray-toggle" data-tp-tray-toggle type="button" aria-label="Collapse shortlist">⌄</button></div></div>
<div class="tp-compare-dialog" data-tp-compare-dialog aria-hidden="true" role="dialog" aria-modal="true" aria-label="Product comparison"><div class="tp-dialog-panel"><button class="tp-dialog-close" data-tp-close-compare type="button" aria-label="Close comparison">×</button><h2>Compare the same product type</h2><div class="tp-compare-grid" data-tp-compare-grid></div><p class="tp-dialog-note">Open each seller page to confirm the exact model, included items, delivery, warranty and final coupon eligibility.</p></div></div>'''
    return page("Find Products — TrendPilot AI", "Search live product feeds, filter relevant results and compare two or three compatible products.", "/find/", 'data-tp-page="finder"', main)


HUBS = {
    "products": {
        "title":"Electronics that fit the way you use them.","desc":"Search live product feeds by setup, compatibility, price and seller—not only by a long feature list.","icon":"💻",
        "cards":[("Phones & tablets","Network, storage, region and warranty.","phones+tablets"),("Computers","Workload, memory, screen and upgrade options.","laptops+computers"),("Audio","Comfort, battery, microphone and connection.","audio+headphones"),("Cameras","Use, stabilisation, lens and accessories.","cameras"),("TV & projectors","Room, brightness, ports and streaming.","projectors+tv"),("Smart home","App, Wi-Fi, ecosystem and updates.","smart+home")]
    },
    "software": {
        "title":"Software chosen by workflow, not marketing claims.","desc":"Compare the task, device support, export limits, pricing model and learning curve before choosing.","icon":"✦",
        "cards":[("Video editing","Timeline, captions, export and device performance.","video+editor"),("PDF tools","Edit, convert, OCR, signatures and platform support.","pdf+editor"),("Phone utilities","Backup, recovery, transfer and compatibility.","phone+software"),("Creative tools","Templates, media, AI limits and licensing.","creative+software"),("Business tools","Team access, integrations and recurring cost.","business+software"),("Current software deals","Check connected coupons and offers.","software+deal")]
    },
    "sourcing": {
        "title":"Find products for business without mixing retail and wholesale decisions.","desc":"Use supplier, minimum order, customisation and fulfilment as separate decision points.","icon":"🏭",
        "cards":[("Find suppliers","Search manufacturers, factories and wholesalers.","supplier+manufacturer"),("Private label","Custom logo, packaging and minimum order.","private+label+supplier"),("Electronics sourcing","Components, devices and accessories in bulk.","wholesale+electronics"),("Home products","Home, kitchen and décor suppliers.","wholesale+home"),("Beauty sourcing","Packaging, ingredients and private-label options.","beauty+supplier"),("Tools & parts","MRO, workshop and replacement parts.","tools+supplier")]
    },
    "compare": {
        "title":"Build a comparison around the product, not the store.","desc":"Search first, select two or three compatible options, then compare price, seller, subtype and matched saving.","icon":"⚖️",
        "cards":[("Compare clothing","Audience, type, fit evidence and price.","clothing"),("Compare shoes","Use, fit, material and return terms.","shoes"),("Compare electronics","Compatibility, performance and warranty.","electronics"),("Compare pet products","Routine, safety, capacity and cleaning.","pet+supplies"),("Compare smart home","Ecosystem, app and connection.","smart+home"),("Compare tools","Capacity, material and included parts.","tools")]
    },
}


def hub_html(slug: str) -> str:
    h = HUBS[slug]
    cards = "".join(f'<a class="tp-hub-card" href="/find/?q={q}"><span>Focused search</span><h3>{t}</h3><p>{p}</p><b>Find and compare →</b></a>' for t,p,q in h["cards"])
    main = f'''<section class="tp-page-hero"><div class="tp-shell"><div><span class="tp-eyebrow">Buyer-first decision hub</span><h1>{h["title"]}</h1><p>{h["desc"]}</p><a class="tp-btn tp-btn-primary" href="/find/">Search live products</a></div><div class="tp-page-art" aria-hidden="true"><span>{h["icon"]}</span></div></div></section><section class="tp-section tp-section-soft"><div class="tp-shell"><div class="tp-section-head"><div><span class="tp-kicker">Choose a starting point</span><h2>Open a focused product search.</h2></div><p>These are search paths, not store-vs-store pages. The seller is shown inside each product result.</p></div><div class="tp-hub-grid">{cards}</div></div></section><section class="tp-section tp-section-white"><div class="tp-shell tp-feature-band"><div><h2>Why the comparison starts after search</h2><p>A useful comparison needs compatible products. TrendPilot now checks the product group—and uses the exact family when at least three close options exist.</p></div><div class="tp-feature-points"><div><strong>1. Search</strong><br>Find relevant options across connected feeds.</div><div><strong>2. Filter</strong><br>Narrow by type, audience, seller, price or saving.</div><div><strong>3. Compare</strong><br>Select up to three compatible products.</div></div></div></section>'''
    titles={"products":"Electronics — TrendPilot AI","software":"Software — TrendPilot AI","sourcing":"Business Sourcing — TrendPilot AI","compare":"Product Comparisons — TrendPilot AI"}
    return page(titles[slug], h["desc"], f"/{slug}/", f'data-tp-hub="{slug}"', main)


def deals_html() -> str:
    main = '''<section class="tp-page-hero"><div class="tp-shell"><div><span class="tp-eyebrow">Current savings</span><h1>Find a coupon that belongs with the product.</h1><p>Search current codes and automatic offers from connected programmes. Restrictions, countries and minimum order values may apply.</p><a class="tp-btn tp-btn-primary" href="/find/">Find the product first</a></div><div class="tp-page-art" aria-hidden="true"><span>🏷️</span></div></div></section><section class="tp-section tp-section-soft"><div class="tp-shell"><div class="tp-section-head"><div><span class="tp-kicker">Live coupon data</span><h2>Current codes and deals.</h2></div><p>Product cards also show a matched saving when the merchant and product context are close enough.</p></div><div class="tp-deal-toolbar"><input data-tp-deal-search type="search" placeholder="Search merchant, product or discount"><select data-tp-deal-merchant><option value="">All merchants</option></select></div><div class="tp-deal-grid" data-tp-deal-grid><div class="tp-skeleton"></div><div class="tp-skeleton"></div><div class="tp-skeleton"></div></div></div></section>'''
    return page("Current Coupons and Deals — TrendPilot AI", "Search current coupon codes and automatic savings from merchants connected to TrendPilot AI.", "/deals/", 'data-tp-hub="deals"', main)


def write_key_pages() -> None:
    files = {ROOT / "index.html": home_html(), ROOT / "find" / "index.html": finder_html(), ROOT / "deals" / "index.html": deals_html()}
    for slug in HUBS:
        files[ROOT / slug / "index.html"] = hub_html(slug)
    for path, text in files.items():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")


def inject_legacy(path: Path) -> bool:
    text = path.read_text(encoding="utf-8", errors="ignore")
    if 'data-tp-page=' in text or 'data-tp-hub=' in text or 'data-v11-header' in text:
        return False
    original = text
    text = re.sub(r'\s*<link[^>]+href=["\']/css/style-v11\.css[^"\']*["\'][^>]*>\s*', '\n', text, flags=re.I)
    text = re.sub(r'\s*<script[^>]+src=["\']/js/site-v11\.js[^"\']*["\'][^>]*>\s*</script>\s*', '\n', text, flags=re.I)
    if re.search(r'</head>', text, re.I):
        text = re.sub(r'</head>', STYLE + '\n</head>', text, count=1, flags=re.I)
    else:
        text = STYLE + text
    body_match = re.search(r'<body([^>]*)>', text, re.I)
    if body_match:
        attrs = body_match.group(1)
        if re.search(r'class=["\']', attrs, re.I):
            attrs = re.sub(r'class=(["\'])', r'class=\1tp-v11-legacy ', attrs, count=1, flags=re.I)
        else:
            attrs += ' class="tp-v11-legacy"'
        replacement = '<body' + attrs + '>' + HEADER
        text = text[:body_match.start()] + replacement + text[body_match.end():]
    else:
        text = '<body class="tp-v11-legacy">' + HEADER + text
    scripts = DEPS
    if re.search(r'</body>', text, re.I):
        text = re.sub(r'</body>', FOOTER + scripts + '</body>', text, count=1, flags=re.I)
    else:
        text += FOOTER + scripts + '</body>'
    if text != original:
        path.write_text(text, encoding="utf-8")
        return True
    return False


def update_sitemap() -> None:
    urls = {"/", "/find/", "/compare/", "/products/", "/software/", "/sourcing/", "/deals/"}
    for path in ROOT.rglob("*.html"):
        rel = path.relative_to(ROOT)
        if any(part.startswith('.') for part in rel.parts) or "node_modules" in rel.parts:
            continue
        if rel.name == "index.html":
            url = "/" + "/".join(rel.parts[:-1])
            if url != "/": url += "/"
        else:
            url = "/" + "/".join(rel.parts)
        urls.add(url.replace("//", "/"))
    rows = []
    priorities = {"/":"1.0","/find/":"0.95","/products/":"0.85","/compare/":"0.85","/deals/":"0.85"}
    for url in sorted(urls):
        rows.append(f"  <url><loc>{xml_escape(BASE + url)}</loc><changefreq>{'daily' if url in {'/','/find/','/deals/'} else 'weekly'}</changefreq><priority>{priorities.get(url,'0.65')}</priority></url>")
    (ROOT / "sitemap.xml").write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + '\n'.join(rows) + '\n</urlset>\n', encoding="utf-8")


def build_catalog() -> None:
    builder = ROOT / "automation" / "build_search_catalog.py"
    private_cache = ROOT / "automation" / "cache" / "offers.jsonl"
    existing_manifest = ROOT / "data" / "search-catalog" / "manifest.json"
    fallback = ROOT / "data" / "matched-products.json"
    if not builder.exists():
        print("Search builder missing; skipped immediate catalogue build.")
        return
    try:
        if private_cache.exists() and private_cache.stat().st_size > 0:
            subprocess.run([sys.executable, str(builder)], cwd=ROOT, check=True)
        elif existing_manifest.exists():
            print("Existing full catalogue preserved. The product-update workflow will rebuild it with V11 taxonomy.")
        elif fallback.exists():
            subprocess.run([sys.executable, str(builder), "--allow-fallback"], cwd=ROOT, check=True)
    except subprocess.CalledProcessError as exc:
        print(f"Catalogue build deferred to Update Products workflow: {exc}")


def main() -> int:
    write_key_pages()
    changed = 0
    key_paths = {ROOT / "index.html", ROOT / "find" / "index.html", ROOT / "deals" / "index.html", *(ROOT / slug / "index.html" for slug in HUBS)}
    for path in ROOT.rglob("*.html"):
        if path in key_paths or any(part.startswith('.') for part in path.relative_to(ROOT).parts):
            continue
        changed += int(inject_legacy(path))
    update_sitemap()
    build_catalog()
    print(f"TrendPilot V11 installed: key_pages={len(key_paths)}, legacy_pages_upgraded={changed}, sitemap=rebuilt")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
