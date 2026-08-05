#!/usr/bin/env python3
"""Install TrendPilot V13 Shopping Decision Engine into the current repository."""
from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path
from xml.sax.saxutils import escape as xml_escape

ROOT = Path(__file__).resolve().parents[1]
BASE = "https://trendpilot-ai.netlify.app"
VERSION = "13.0.0"
STYLE = f'<link rel="stylesheet" href="/css/style-v13.css?v={VERSION}">'
SCRIPTS = f'''<script defer src="/js/site-config.js?v={VERSION}"></script>
<script defer src="/js/program-status.js?v={VERSION}"></script>
<script defer src="/js/matched-products.js?v={VERSION}"></script>
<script defer src="/js/affiliate-links.js?v={VERSION}"></script>
<script defer src="/js/coupons-data.js?v={VERSION}"></script>
<script defer src="/js/site-v13.js?v={VERSION}"></script>'''
SEARCH_ICON = '''<svg aria-hidden="true" viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.4-3.4"></path></svg>'''

HEADER = '''<a class="tp-skip" href="#main">Skip to content</a>
<div class="tp-utility" data-v13-header><div class="tp-shell"><span>Exact matches, total-cost evidence and same-type comparison.</span><a href="/deals/">Check current savings →</a></div></div>
<header class="tp-header" data-v13-header><div class="tp-shell tp-nav"><a class="tp-brand" href="/" aria-label="TrendPilot AI home"><img src="/images/logo-v4.svg" alt="" width="42" height="42"><span>TrendPilot <em>AI</em></span></a><nav class="tp-links" data-tp-nav aria-label="Primary navigation"><button class="tp-menu-close" data-tp-menu-close type="button" aria-label="Close menu">×</button><a href="/find/">Find</a><a href="/deals/">Deals</a><a href="/compare/">Compare <span class="tp-count" data-compare-count hidden>0</span></a><a href="/price-watch/">Saved <span class="tp-count" data-saved-count hidden>0</span></a><a href="/rare-used/">Rare finds</a><a href="/guides/">Guides</a><a href="/sourcing/">For business</a><a class="tp-nav-cta" href="/find/">Search now</a></nav><button class="tp-menu-button" data-tp-menu-button type="button" aria-expanded="false" aria-label="Open menu"><span></span><span></span><span></span></button></div><button class="tp-nav-backdrop" data-tp-nav-backdrop type="button" aria-label="Close menu"></button></header>'''

FOOTER = '''<footer class="tp-footer" data-v13-footer><div class="tp-shell tp-footer-grid"><div><a class="tp-brand" href="/"><img src="/images/logo-v4.svg" alt="" width="42" height="42"><span>TrendPilot <em>AI</em></span></a><p>A shopping decision engine for finding the right product, checking the real buying evidence and comparing compatible options.</p></div><div><h2>Decide</h2><a href="/find/">Find products</a><a href="/compare/">Compare products</a><a href="/deals/">Savings center</a><a href="/price-watch/">Price Watch</a></div><div><h2>Explore</h2><a href="/products/">Electronics Lab</a><a href="/software/">Software Finder</a><a href="/rare-used/">Rare Finds Radar</a><a href="/sourcing/">Business Sourcing</a></div><div><h2>Trust</h2><a href="/editorial-methodology.html">How we rank</a><a href="/affiliate-disclosure.html">Affiliate disclosure</a><a href="/privacy.html">Privacy</a><a href="/terms.html">Terms</a><a href="/contact.html">Contact</a></div></div><div class="tp-shell tp-footer-bottom"><span>© <span data-year></span> TrendPilot AI.</span><span>Prices, stock, delivery and coupon terms can change. Confirm them before payment.</span></div></footer>'''


def head(title: str, description: str, canonical: str) -> str:
    return f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#061a3a"><meta name="robots" content="index,follow,max-image-preview:large"><title>{title}</title><meta name="description" content="{description}"><link rel="canonical" href="{BASE}{canonical}"><meta property="og:site_name" content="TrendPilot AI"><meta property="og:type" content="website"><meta property="og:title" content="{title}"><meta property="og:description" content="{description}"><meta property="og:url" content="{BASE}{canonical}"><link rel="icon" href="/images/favicon-v4.svg" type="image/svg+xml"><link rel="manifest" href="/manifest.webmanifest">{STYLE}</head>'''


def page(title: str, description: str, canonical: str, attrs: str, main: str) -> str:
    return f'''{head(title, description, canonical)}<body {attrs}>{HEADER}<main id="main">{main}</main>{FOOTER}{SCRIPTS}</body></html>'''


def home_html() -> str:
    main = f'''
<section class="tp-home-hero"><div class="tp-shell"><div><span class="tp-eyebrow">Shopping Decision Engine</span><h1>Find the right product — <em>not just another product.</em></h1><p>Search by product, problem or model. TrendPilot separates exact matches from alternatives, compares the same type and shows the buying evidence before you open the seller.</p><form class="tp-search" data-tp-home-search role="search"><label>{SEARCH_ICON}<span class="tp-sr-only">Search products</span><input name="q" type="search" required placeholder="Try men's cotton T-shirts, a teaching laptop, or Wireless CarPlay"></label><button class="tp-btn tp-btn-primary" type="submit">Find exact matches</button></form><div class="tp-quick-links"><span>Try:</span><a class="tp-chip" href="/find/?q=men%27s+cotton+T-shirts">Men's cotton T-shirts</a><a class="tp-chip" href="/find/?q=laptop+for+teaching">Laptop for teaching</a><a class="tp-chip" href="/find/?q=wireless+CarPlay+adapter">Wireless CarPlay</a></div><div class="tp-hero-stats"><div><strong data-catalog-count>Live catalogue</strong><span>Unique products grouped from connected offers</span></div><div><strong data-store-count>Connected sellers</strong><span>Seller evidence stays visible</span></div><div><strong>Exact first</strong><span>Alternatives never silently replace the requested type</span></div></div></div><aside class="tp-hero-panel"><span>DECISION SHORTCUTS</span><h2>What do you need to do?</h2><div class="tp-decision-mini"><a href="/find/"><b>Find a product</b><span>Exact intent and filters →</span></a><a href="/compare/"><b>Compare compatible options</b><span>Total cost and evidence →</span></a><a href="/deals/"><b>Check whether a saving is credible</b><span>Price and coupon context →</span></a><a href="/price-watch/"><b>Watch a product</b><span>Save a target price →</span></a><a href="/rare-used/"><b>Find scarce used items</b><span>Rare, discontinued, specialist →</span></a></div></aside></div></section>
<section class="tp-section tp-section-white"><div class="tp-shell"><div class="tp-section-head"><div><span class="tp-kicker">Start with the decision</span><h2>Five useful actions, one search engine.</h2></div><p>The homepage guides the buyer; it does not repeat a full search page or fill the screen with random products.</p></div><div class="tp-action-grid"><a class="tp-action-card" href="/find/"><i>⌕</i><h3>Find exact matches</h3><p>Product type, audience and intent stay strict.</p></a><a class="tp-action-card" href="/compare/"><i>⇄</i><h3>Compare products</h3><p>Same-family evidence side by side.</p></a><a class="tp-action-card" href="/deals/"><i>↓</i><h3>Verify a saving</h3><p>Seller markdown and coupon terms are separated.</p></a><a class="tp-action-card" href="/price-watch/"><i>♡</i><h3>Track a price</h3><p>Save products and target prices on your device.</p></a><a class="tp-action-card" href="/rare-used/"><i>◈</i><h3>Rare Finds Radar</h3><p>Scarce and specialist used products only.</p></a></div></div></section>
<section class="tp-section tp-section-soft"><div class="tp-shell"><div class="tp-section-head"><div><span class="tp-kicker">Decision tools</span><h2>Different pages now perform different jobs.</h2></div><p>No repeated Electronics search box or duplicated homepage explanation.</p></div><div class="tp-tool-grid"><a class="tp-tool-card" href="/products/"><span>Electronics Lab</span><h3>Match compatibility and use</h3><p>Device, ecosystem, connection, region and budget.</p><b>Open the lab →</b></a><a class="tp-tool-card" href="/software/"><span>Software Finder</span><h3>Choose by workflow</h3><p>Task, platform, licence model and renewal cost.</p><b>Find software →</b></a><a class="tp-tool-card" href="/sourcing/"><span>Business Sourcing</span><h3>Compare suppliers</h3><p>MOQ, sample, customisation and production terms.</p><b>Source for business →</b></a></div></div></section>
<section class="tp-section tp-section-white"><div class="tp-shell"><div class="tp-section-head"><div><span class="tp-kicker">Live catalogue</span><h2>Products people can start comparing now.</h2></div><p>Cards are compact on mobile and show evidence instead of long feed descriptions.</p></div><div class="tp-product-grid" data-tp-home-products><div class="tp-empty">Loading current products…</div></div><div style="text-align:center;margin-top:24px"><a class="tp-btn tp-btn-light" href="/find/">Search the full catalogue</a></div></div></section>
<section class="tp-section tp-section-soft"><div class="tp-shell"><div class="tp-section-head"><div><span class="tp-kicker">Savings Center preview</span><h2>Current seller price-drop evidence.</h2></div><p>TrendPilot does not call a markdown “verified history” until enough price history has been collected.</p></div><div class="tp-product-grid" data-tp-home-deals><div class="tp-empty">Loading current savings…</div></div><div style="text-align:center;margin-top:24px"><a class="tp-btn tp-btn-light" href="/deals/">Open Savings Center</a></div></div></section>
<section class="tp-section tp-section-white"><div class="tp-shell"><div class="tp-section-head"><div><span class="tp-kicker">Rare Finds Radar</span><h2>Hard-to-find products worth watching.</h2></div><p>Used alone is not enough; rarity and specialist context are required.</p></div><div class="tp-product-grid" data-tp-home-rare><div class="tp-empty">Checking rare-used coverage…</div></div></div></section>
<section class="tp-section tp-section-night"><div class="tp-shell"><div class="tp-section-head"><div><span class="tp-kicker" style="color:#6fe0bc">Transparent ranking</span><h2>Useful evidence comes before affiliate commission.</h2></div><p style="color:#b7c4da">Sponsored placements can be labelled separately later. Organic ranking uses relevance, product type, data quality, seller evidence and total-cost information.</p></div><div class="tp-trust-grid"><div><strong>Exact intent</strong><span>Requested family and audience remain strict.</span></div><div><strong>Missing means missing</strong><span>Unavailable fields are not invented.</span></div><div><strong>Seller visible</strong><span>Merchant and number of offers stay clear.</span></div><div><strong>Coverage measured</strong><span>Feed gaps are reported before adding another source.</span></div></div></div></section>'''
    return page("TrendPilot AI — Find, Compare and Decide", "Find exact product matches, compare compatible options, evaluate current savings and save products to watch.", "/", 'data-tp-page="home"', main)


def finder_html() -> str:
    main = f'''
<section class="tp-finder-hero"><div class="tp-shell"><span class="tp-eyebrow">Exact product discovery</span><h1>What are you trying to buy?</h1><p>TrendPilot loads the exact product family and audience first. Related alternatives appear in a separate tab and never pad the requested results.</p><form class="tp-search" data-tp-finder-form role="search"><label>{SEARCH_ICON}<span class="tp-sr-only">Search products</span><input data-tp-finder-input type="search" required placeholder="Search men's T-shirts, laptops, pet feeders or a model"></label><button class="tp-btn tp-btn-primary" type="submit">Search</button></form><div class="tp-quick-links"><span>Try:</span><button class="tp-chip" data-search-suggestion="men's T-shirts" type="button">Men's T-shirts</button><button class="tp-chip" data-search-suggestion="men's shorts" type="button">Men's shorts</button><button class="tp-chip" data-search-suggestion="laptops" type="button">Laptops</button><button class="tp-chip" data-search-suggestion="wireless CarPlay adapter" type="button">Wireless CarPlay</button></div></div></section>
<div class="tp-shell tp-finder-layout"><aside class="tp-filter-panel" data-tp-filter-panel><div class="tp-filter-head"><div class="tp-filter-title-row"><h2>Refine results</h2><span class="tp-active-filter-count" data-tp-active-filter-count hidden>0</span></div><button class="tp-btn tp-btn-light tp-btn-small tp-filter-toggle" data-tp-filter-toggle type="button" aria-expanded="false">More filters</button></div><div class="tp-filter-primary"><div class="tp-filter-group"><label for="tp-group">Category</label><select id="tp-group" data-filter-group><option value="">All categories</option></select></div><div class="tp-filter-group"><label for="tp-family">Specific product type</label><select id="tp-family" data-filter-family><option value="">All specific types</option></select></div><div class="tp-filter-group"><label for="tp-audience">For whom</label><select id="tp-audience" data-filter-audience><option value="">Any audience</option><option value="men">Men</option><option value="women">Women</option><option value="kids">Kids</option><option value="unisex">Unisex</option></select></div></div><div class="tp-filter-more"><div class="tp-filter-group"><label for="tp-merchant">Seller</label><select id="tp-merchant" data-filter-merchant><option value="">All sellers</option></select></div><div class="tp-filter-group"><label for="tp-price">Price</label><select id="tp-price" data-filter-price><option value="">Any price</option><option value="0-10">Under $10</option><option value="10-25">$10–25</option><option value="25-50">$25–50</option><option value="50-100">$50–100</option><option value="100+">Over $100</option></select></div><div class="tp-filter-group"><label for="tp-sort">Sort</label><select id="tp-sort" data-filter-sort><option value="smart">Best match</option><option value="rating">Rating evidence</option><option value="delivery">Delivery evidence</option><option value="quality">Data completeness</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option></select></div></div><div class="tp-filter-checks"><label class="tp-check"><input data-filter-coupon type="checkbox">Matched coupon</label><label class="tp-check"><input data-filter-rare type="checkbox">Rare used only</label></div><div class="tp-filter-actions"><p class="tp-filter-note">Unknown audience is not silently treated as Men, Women or Kids.</p><button class="tp-filter-reset" data-reset-filters type="button">Clear</button></div></aside><section class="tp-main-col"><div class="tp-results-head"><div><h2 data-tp-results-title>Loading exact results…</h2><p data-tp-finder-status>Opening the most relevant catalogue segments.</p></div><span class="tp-results-count" data-tp-results-count>Loading</span></div><div class="tp-result-tabs" data-tp-result-tabs></div><div class="tp-product-grid" data-tp-product-grid><div class="tp-empty">Loading products…</div></div><button class="tp-btn tp-btn-light tp-load-more" data-tp-load-more type="button" hidden>Show 24 more</button></section></div>'''
    return page("Find Exact Products — TrendPilot AI", "Search exact product families and audiences, load thousands of catalogue options progressively and compare compatible products.", "/find/", 'data-tp-page="finder"', main)


def compare_html() -> str:
    main = '''<section class="tp-content-hero"><div class="tp-shell"><span class="tp-eyebrow">Same-type comparison</span><h1>Compare the evidence that changes the decision.</h1><p>Add up to three products from the same family. TrendPilot keeps price, shipping, delivery, rating, material and missing evidence visible.</p></div></section><section class="tp-content-wrap"><div class="tp-shell" data-tp-compare-page></div></section>'''
    return page("Compare Products — TrendPilot AI", "Compare two or three compatible products by total cost, seller, delivery, rating and product evidence.", "/compare/", 'data-tp-page="compare"', main)


def watch_html() -> str:
    main = '''<section class="tp-content-hero"><div class="tp-shell"><span class="tp-eyebrow">Personal watch list</span><h1>Save products and set the price you want.</h1><p>Your current V13 watch list is stored on this device. Account-based automatic notifications will be added after the search and catalogue are stable.</p></div></section><section class="tp-content-wrap"><div class="tp-shell" data-tp-saved-page></div></section>'''
    return page("Price Watch — TrendPilot AI", "Save products and target prices in your TrendPilot watch list.", "/price-watch/", 'data-tp-page="price-watch"', main)


def deals_html() -> str:
    main = '''<section class="tp-content-hero"><div class="tp-shell"><span class="tp-eyebrow">Savings Center</span><h1>Separate seller markdowns from coupon terms.</h1><p>Product savings appear first. General coupon records remain secondary and clearly show that eligibility, country and minimum order still need confirmation.</p></div></section><section class="tp-section tp-section-soft"><div class="tp-shell"><div class="tp-section-head"><div><span class="tp-kicker">Product-linked savings</span><h2>Current seller price-drop evidence.</h2></div><p>This is not yet a 90-day verified price history. TrendPilot labels the evidence honestly until enough history is collected.</p></div><div class="tp-product-grid" data-tp-deal-products><div class="tp-empty">Loading product savings…</div></div></div></section><section class="tp-section tp-section-white"><div class="tp-shell"><div class="tp-section-head"><div><span class="tp-kicker">Coupon Center</span><h2>Current codes and automatic offers.</h2></div><p>Codes are not mixed into unrelated product cards unless merchant context matches.</p></div><div class="tp-coupon-grid" data-tp-coupon-grid><div class="tp-empty">Loading coupons…</div></div></div></section>'''
    return page("Savings Center — TrendPilot AI", "Review product-linked savings and current merchant coupon terms without mixing unrelated offers.", "/deals/", 'data-tp-page="deals"', main)


def rare_html() -> str:
    main = '''<section class="tp-content-hero"><div class="tp-shell"><span class="tp-eyebrow">Rare Finds Radar</span><h1>Scarce used products and specialist tools.</h1><p>Ordinary used listings are excluded. Published items need used, refurbished or open-box condition plus a rarity signal such as discontinued, vintage, specialist, surplus or hard-to-find.</p></div></section><section class="tp-section tp-section-soft"><div class="tp-shell"><div class="tp-rare-intro"><div><span class="tp-kicker">Selection rules</span><h2>Rare and useful — not merely second-hand.</h2><p>The section stays honest when current feeds do not contain enough evidence.</p></div><div class="tp-rare-signals"><span>Condition: used, refurbished or open-box</span><span>Rarity: discontinued, vintage, replacement or specialist</span><span>Evidence: usable listing and current destination URL</span></div></div><div class="tp-product-grid" data-tp-home-rare style="margin-top:22px"><div class="tp-empty">Checking rare-used catalogue…</div></div></div></section>'''
    return page("Rare Used Products — TrendPilot AI", "Find carefully selected rare, discontinued and specialist used products instead of ordinary second-hand listings.", "/rare-used/", 'data-tp-page="home"', main)


def electronics_html() -> str:
    main = '''<section class="tp-section tp-section-white"><div class="tp-shell tp-tool-layout"><div class="tp-tool-copy"><span class="tp-kicker">Electronics Lab</span><h1>Start with compatibility and use.</h1><p>This page is not another generic search page. Describe the device, ecosystem, connection or workload; the tool sends a precise buying intent to the catalogue.</p><div class="tp-guide-grid"><article class="tp-guide-card"><span>Compatibility</span><h2>Model and region first</h2><p>Network bands, voltage, ports, operating system and vehicle year can decide whether a product works.</p></article><article class="tp-guide-card"><span>Total cost</span><h2>Include delivery</h2><p>Compare the supplied shipping evidence and not only the headline price.</p></article><article class="tp-guide-card"><span>Risk</span><h2>Missing data remains visible</h2><p>Unknown warranty or compatibility is a question to check, not a feature to guess.</p></article></div></div><form class="tp-tool-form" data-tp-tool-form><label>What product or device?<input name="q" type="search" placeholder="Wireless CarPlay adapter, laptop, projector" required></label><label>Main use<input type="text" placeholder="Teaching, gaming, travel, smart home"></label><label>Compatibility or model<input type="text" placeholder="Toyota Camry 2020, Windows 11, iPhone"></label><label>Budget<input type="text" placeholder="Under $300"></label><button class="tp-btn tp-btn-primary" type="submit">Find compatible options</button></form></div></section>'''
    return page("Electronics Lab — TrendPilot AI", "Find electronics by compatibility, use, ecosystem, model and budget.", "/products/", 'data-tp-page="electronics-lab"', main)


def software_html() -> str:
    main = '''<section class="tp-section tp-section-white"><div class="tp-shell tp-tool-layout"><div class="tp-tool-copy"><span class="tp-kicker">Software Finder</span><h1>Choose software by the job it must complete.</h1><p>Compare platform support, licence model, device count, renewal cost, trial and refund evidence instead of repeating marketing claims.</p><div class="tp-guide-grid"><article class="tp-guide-card"><span>Cost</span><h2>Year one vs renewal</h2><p>A low first-year price can hide a much higher recurring cost.</p></article><article class="tp-guide-card"><span>Fit</span><h2>Exact workflow</h2><p>Phone transfer, PDF editing and video export are different decisions.</p></article><article class="tp-guide-card"><span>Fallback</span><h2>Consider free alternatives</h2><p>Paid software should solve a need that the free option cannot.</p></article></div></div><form class="tp-tool-form" data-tp-tool-form><label>What do you need to do?<input name="q" type="search" placeholder="Transfer WhatsApp, edit PDF, create video" required></label><label>Platform<select><option>Windows</option><option>Mac</option><option>Android</option><option>iPhone / iPad</option><option>Web</option></select></label><label>Licence preference<select><option>Any licence</option><option>One-time purchase</option><option>Annual subscription</option><option>Free trial required</option></select></label><label>Number of devices<input type="text" placeholder="1, 3, team"></label><button class="tp-btn tp-btn-primary" type="submit">Find software for this task</button></form></div></section>'''
    return page("Software Finder — TrendPilot AI", "Find software by workflow, platform, licence model, device count and renewal evidence.", "/software/", 'data-tp-page="software-finder"', main)


def sourcing_html() -> str:
    main = '''<section class="tp-section tp-section-white"><div class="tp-shell tp-tool-layout"><div class="tp-tool-copy"><span class="tp-kicker">Business Sourcing</span><h1>Retail and supplier decisions stay separate.</h1><p>Search manufacturers and wholesale offers by product, MOQ, sample, private label, customisation and production terms.</p><div class="tp-guide-grid"><article class="tp-guide-card"><span>MOQ</span><h2>Compare the real entry cost</h2><p>Unit price without minimum order and sample cost is incomplete.</p></article><article class="tp-guide-card"><span>Customisation</span><h2>Logo, packaging and label</h2><p>Record what can be changed and at what quantity.</p></article><article class="tp-guide-card"><span>Lead time</span><h2>Production before shipping</h2><p>Manufacturing time and delivery time are different fields.</p></article></div></div><form class="tp-tool-form" data-tp-tool-form><label>Product to source<input name="q" type="search" placeholder="Private-label power bank, pet feeder, packaging" required></label><label>Target quantity<input type="text" placeholder="100, 500, 1,000 units"></label><label>Customisation<select><option>Any</option><option>Custom logo</option><option>Private label</option><option>Custom packaging</option></select></label><label>Supplier requirement<input type="text" placeholder="Sample available, certification, region"></label><button class="tp-btn tp-btn-primary" type="submit">Find supplier offers</button></form></div></section>'''
    return page("Business Sourcing — TrendPilot AI", "Find wholesale and private-label suppliers by MOQ, sample, customisation and production requirements.", "/sourcing/", 'data-tp-page="business-sourcing"', main)


def guides_html() -> str:
    cards = [
        ("Clothing", "How to compare men's T-shirts", "Fabric, GSM, fit, measurements, returns and total delivered cost."),
        ("Electronics", "Check compatibility before price", "Model, region, voltage, ports, network bands and software support."),
        ("Deals", "How to recognise a real discount", "Separate seller markdown, coupon, shipping and historical evidence."),
        ("Used", "Used vs refurbished vs open-box", "Condition, missing parts, warranty, seller and return risk."),
        ("Software", "Annual subscription vs lifetime licence", "Renewal, device count, feature limits, trial and refunds."),
        ("Sourcing", "What to verify before an Alibaba order", "MOQ, sample, customisation, production, protection and shipping."),
    ]
    html = ''.join(f'<article class="tp-guide-card"><span>{a}</span><h2>{b}</h2><p>{c}</p></article>' for a,b,c in cards)
    main = f'''<section class="tp-content-hero"><div class="tp-shell"><span class="tp-eyebrow">Decision guides</span><h1>Short guidance for the exact buying decision.</h1><p>These are practical checks, not repeated category introductions or generic AI articles.</p></div></section><section class="tp-section tp-section-soft"><div class="tp-shell"><div class="tp-guide-grid">{html}</div></div></section>'''
    return page("Buying Guides — TrendPilot AI", "Practical buying guides for product fit, compatibility, price evidence, software licences and sourcing.", "/guides/", 'data-tp-page="guides"', main)


def write_pages() -> set[Path]:
    files = {
        ROOT / "index.html": home_html(),
        ROOT / "find" / "index.html": finder_html(),
        ROOT / "compare" / "index.html": compare_html(),
        ROOT / "price-watch" / "index.html": watch_html(),
        ROOT / "deals" / "index.html": deals_html(),
        ROOT / "rare-used" / "index.html": rare_html(),
        ROOT / "products" / "index.html": electronics_html(),
        ROOT / "software" / "index.html": software_html(),
        ROOT / "sourcing" / "index.html": sourcing_html(),
        ROOT / "guides" / "index.html": guides_html(),
    }
    for path, text in files.items():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")
    return set(files)


def strip_managed_chrome(text: str) -> str:
    text = re.sub(r'<a class="tp-skip".*?</header>', '', text, count=1, flags=re.I | re.S)
    text = re.sub(r'<div class="tp-utility"[^>]*data-v(?:11|12|13)-header.*?</header>', '', text, count=1, flags=re.I | re.S)
    text = re.sub(r'<footer class="tp-footer".*?</footer>', '', text, count=1, flags=re.I | re.S)
    text = re.sub(r'\s*<link[^>]+href=["\']/css/style-v(?:11|12|13)\.css[^"\']*["\'][^>]*>\s*', '\n', text, flags=re.I)
    managed = r'(?:site-v(?:11|12|13)|site-config|program-status|matched-products|affiliate-links|coupons-data)\.js'
    text = re.sub(rf'\s*<script[^>]+src=["\']/js/{managed}[^"\']*["\'][^>]*>\s*</script>\s*', '\n', text, flags=re.I)
    return re.sub(r'\n[ \t]*\n(?:[ \t]*\n)+', '\n\n', text)


def repair_review() -> bool:
    path = ROOT / "review.html"
    if not path.exists():
        return False
    original = path.read_text(encoding="utf-8", errors="ignore")
    text = strip_managed_chrome(original)
    if not re.search(r'<meta[^>]+name=["\']robots["\']', text, re.I):
        text = re.sub(r'</head>', '<meta name="robots" content="noindex,nofollow">\n' + STYLE + '\n</head>', text, count=1, flags=re.I)
    elif '/css/style-v13.css' not in text:
        text = re.sub(r'</head>', STYLE + '\n</head>', text, count=1, flags=re.I)
    if text != original:
        path.write_text(text, encoding="utf-8")
        return True
    return False


def refresh_legacy(path: Path) -> bool:
    original = path.read_text(encoding="utf-8", errors="ignore")
    if 'data-tp-page=' in original:
        return False
    text = strip_managed_chrome(original)
    text = re.sub(r'</head>', STYLE + '\n</head>', text, count=1, flags=re.I) if re.search(r'</head>', text, re.I) else STYLE + text
    match = re.search(r'<body([^>]*)>', text, re.I)
    if match:
        attrs = match.group(1)
        if "tp-v13-legacy" not in attrs:
            attrs = re.sub(r'class=(["\'])', r'class=\1tp-v13-legacy ', attrs, count=1, flags=re.I) if re.search(r'class=["\']', attrs, re.I) else attrs + ' class="tp-v13-legacy"'
        text = text[:match.start()] + '<body' + attrs + '>' + HEADER + text[match.end():]
    else:
        text = '<body class="tp-v13-legacy">' + HEADER + text
    text = re.sub(r'</body>', FOOTER + SCRIPTS + '</body>', text, count=1, flags=re.I) if re.search(r'</body>', text, re.I) else text + FOOTER + SCRIPTS + '</body>'
    if text != original:
        path.write_text(text, encoding="utf-8")
        return True
    return False



def patch_catalog_refresh() -> bool:
    """Keep the existing Update Products workflow untouched.

    GitHub's workflow token can commit normal repository files, but changing a
    file under .github/workflows from inside the same workflow can make the push
    fail. Instead, hook the already-executed legacy catalogue builder so every
    normal feed refresh finishes by rebuilding the V13 exact catalogue.
    """
    path = ROOT / "automation" / "build_search_catalog.py"
    if not path.exists():
        return False
    text = path.read_text(encoding="utf-8", errors="ignore")
    marker = "TREND_PILOT_V13_REFRESH_HOOK"
    if marker in text:
        return False

    hook = '''
# TREND_PILOT_V13_REFRESH_HOOK
# Run after the existing buyer catalogue builder, so the final public output
# always uses the V13 exact family/audience shards without editing workflows.
if __name__ == "__main__":
    import atexit as _tp_v13_atexit
    import subprocess as _tp_v13_subprocess
    import sys as _tp_v13_sys
    from pathlib import Path as _TpV13Path

    def _tp_v13_rebuild_exact_catalogue() -> None:
        _tp_v13_root = _TpV13Path(__file__).resolve().parents[1]
        _tp_v13_builder = _tp_v13_root / "automation" / "build_decision_catalog.py"
        if not _tp_v13_builder.exists():
            raise RuntimeError("TrendPilot V13 catalogue builder is missing")
        _tp_v13_command = [_tp_v13_sys.executable, str(_tp_v13_builder)]
        if "--allow-fallback" in _tp_v13_sys.argv:
            _tp_v13_command.append("--allow-fallback")
        _tp_v13_subprocess.run(
            _tp_v13_command,
            cwd=_tp_v13_root,
            check=True,
        )

    _tp_v13_atexit.register(_tp_v13_rebuild_exact_catalogue)
# TREND_PILOT_V13_REFRESH_HOOK_END
'''

    guards = list(re.finditer(r'^if __name__\s*==\s*["\']__main__["\']\s*:\s*$', text, flags=re.M))
    if not guards:
        raise RuntimeError("Cannot safely patch automation/build_search_catalog.py: main guard not found")
    pos = guards[-1].start()
    text = text[:pos] + hook + "\n" + text[pos:]
    path.write_text(text, encoding="utf-8")
    return True


def build_catalog() -> None:
    builder = ROOT / "automation" / "build_decision_catalog.py"
    subprocess.run([sys.executable, str(builder), "--allow-fallback"], cwd=ROOT, check=True)
    manifest = ROOT / "data" / "search-catalog" / "manifest.json"
    if not manifest.exists() or '"version":"13.0.0"' not in manifest.read_text(encoding="utf-8", errors="ignore"):
        raise RuntimeError("V13 catalogue manifest was not produced.")


def update_sitemap() -> None:
    urls = {"/", "/find/", "/compare/", "/price-watch/", "/products/", "/software/", "/sourcing/", "/deals/", "/rare-used/", "/guides/"}
    excluded = {"review.html", "404.html"}
    for path in ROOT.rglob("*.html"):
        rel = path.relative_to(ROOT)
        if rel.name in excluded or any(part.startswith('.') or part in {"node_modules", "automation", "tests"} for part in rel.parts):
            continue
        url = "/" + "/".join(rel.parts[:-1]) + ("/" if rel.name == "index.html" and rel.parts[:-1] else "") if rel.name == "index.html" else "/" + "/".join(rel.parts)
        urls.add(url or "/")
    priorities = {"/":"1.0","/find/":"0.95","/compare/":"0.9","/deals/":"0.9","/rare-used/":"0.85","/guides/":"0.85"}
    rows = [f'  <url><loc>{xml_escape(BASE + u)}</loc><changefreq>{"daily" if u in {"/","/find/","/deals/","/rare-used/"} else "weekly"}</changefreq><priority>{priorities.get(u,"0.65")}</priority></url>' for u in sorted(urls)]
    (ROOT / "sitemap.xml").write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + '\n'.join(rows) + '\n</urlset>\n', encoding="utf-8")


def main() -> int:
    key_paths = write_pages()
    review = repair_review()
    changed = 0
    for path in ROOT.rglob("*.html"):
        rel = path.relative_to(ROOT)
        if path in key_paths or rel.name == "review.html" or any(part.startswith('.') for part in rel.parts):
            continue
        changed += int(refresh_legacy(path))
    refresh_hook = patch_catalog_refresh()
    build_catalog()
    update_sitemap()
    print(f"TrendPilot V13 installed: pages={len(key_paths)}, legacy_refreshed={changed}, review_repaired={int(review)}, catalog_refresh_hook={int(refresh_hook)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
