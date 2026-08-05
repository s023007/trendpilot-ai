#!/usr/bin/env python3
"""Install TrendPilot V13.2 calm mobile UI and reliable result counting."""
from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path
from xml.sax.saxutils import escape as xml_escape

ROOT = Path(__file__).resolve().parents[1]
BASE = "https://trendpilot-ai.netlify.app"
VERSION = "13.2.0"
STYLE = f'<link rel="stylesheet" href="/css/style-v13-2.css?v={VERSION}">'
SCRIPTS = f'''<script defer src="/js/site-config.js?v={VERSION}"></script>
<script defer src="/js/program-status.js?v={VERSION}"></script>
<script defer src="/js/matched-products.js?v={VERSION}"></script>
<script defer src="/js/affiliate-links.js?v={VERSION}"></script>
<script defer src="/js/coupons-data.js?v={VERSION}"></script>
<script defer src="/js/site-v13-2.js?v={VERSION}"></script>'''
SEARCH_ICON = '''<svg aria-hidden="true" viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.4-3.4"></path></svg>'''

HEADER = '''<a class="tp-skip" href="#main">Skip to content</a>
<header class="tp-header" data-v13-header><div class="tp-shell tp-nav"><a class="tp-brand" href="/" aria-label="TrendPilot AI home"><img src="/images/logo-v4.svg" alt="" width="42" height="42"><span>TrendPilot <em>AI</em></span></a><nav class="tp-links" data-tp-nav aria-label="Primary navigation"><strong class="tp-menu-title">Explore TrendPilot</strong><button class="tp-menu-close" data-tp-menu-close type="button" aria-label="Close menu">×</button><span class="tp-menu-section-title">Decide</span><a href="/find/">Find products</a><a href="/deals/">Deals & coupons</a><a href="/compare/">Compare <span class="tp-count" data-compare-count hidden>0</span></a><a href="/price-watch/">Saved products <span class="tp-count" data-saved-count hidden>0</span></a><span class="tp-menu-section-title">Explore</span><a href="/products/">Electronics Lab</a><a href="/software/">Software Finder</a><a href="/rare-used/">Rare Finds</a><a href="/guides/">Buying Guides</a><a href="/sourcing/">For Business</a><a class="tp-nav-cta" href="/find/">Search the catalogue</a></nav><button class="tp-menu-button" data-tp-menu-button type="button" aria-expanded="false" aria-label="Open menu"><span></span><span></span><span></span></button></div><button class="tp-nav-backdrop" data-tp-nav-backdrop type="button" aria-label="Close menu"></button></header>'''
FOOTER = '''<section class="tp-newsletter"><div class="tp-shell tp-newsletter-inner"><div><span class="tp-kicker">Useful alerts, not noise</span><h2>Price drops and practical buying ideas in your inbox.</h2><p>Get occasional TrendPilot updates when we have something worth checking.</p></div><div><form name="trendpilot-updates" method="POST" data-netlify="true"><input type="hidden" name="form-name" value="trendpilot-updates"><label class="tp-sr-only" for="tp-email">Email address</label><input id="tp-email" name="email" type="email" autocomplete="email" required placeholder="Your email address"><button class="tp-btn tp-btn-primary" type="submit">Join</button></form><small>Unsubscribe any time. We do not sell email addresses.</small></div></div></section><footer class="tp-footer" data-v13-footer><div class="tp-shell tp-footer-grid"><div><a class="tp-brand" href="/"><img src="/images/logo-v4.svg" alt="" width="42" height="42"><span>TrendPilot <em>AI</em></span></a><p>A calmer shopping decision engine for exact discovery, honest deal evidence and same-type comparison.</p></div><div><h2>Decide</h2><a href="/find/">Find products</a><a href="/compare/">Compare</a><a href="/deals/">Deals & coupons</a><a href="/price-watch/">Saved products</a></div><div><h2>Explore</h2><a href="/products/">Electronics Lab</a><a href="/software/">Software Finder</a><a href="/rare-used/">Rare Finds</a><a href="/sourcing/">Business Sourcing</a></div><div><h2>Trust</h2><a href="/editorial-methodology.html">How we rank</a><a href="/affiliate-disclosure.html">Affiliate disclosure</a><a href="/privacy.html">Privacy</a><a href="/terms.html">Terms</a><a href="/contact.html">Contact</a></div></div><div class="tp-shell tp-footer-bottom"><span>© <span data-year></span> TrendPilot AI.</span><span>Prices, stock, delivery and coupon terms can change. Confirm them before payment.</span></div></footer>'''

BOTTOM_NAV = '''<nav class="tp-bottom-nav" aria-label="Mobile navigation"><a data-bottom-link href="/"><b>⌂</b><span>Home</span></a><a data-bottom-link href="/find/"><b>⌕</b><span>Search</span></a><a data-bottom-link href="/deals/"><b>↓</b><span>Deals</span></a><a data-bottom-link href="/compare/"><b>⇄</b><span>Compare</span><i class="tp-count" data-compare-count hidden>0</i></a></nav>'''



def head(title: str, description: str, canonical: str) -> str:
    return f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#f7f5ef"><meta name="robots" content="index,follow,max-image-preview:large"><title>{title}</title><meta name="description" content="{description}"><link rel="canonical" href="{BASE}{canonical}"><meta property="og:site_name" content="TrendPilot AI"><meta property="og:type" content="website"><meta property="og:title" content="{title}"><meta property="og:description" content="{description}"><meta property="og:url" content="{BASE}{canonical}"><link rel="icon" href="/images/favicon-v4.svg" type="image/svg+xml"><link rel="manifest" href="/manifest.webmanifest">{STYLE}</head>'''


def page(title: str, description: str, canonical: str, attrs: str, main: str) -> str:
    return f'''{head(title, description, canonical)}<body {attrs}>{HEADER}<main id="main">{main}</main>{FOOTER}{BOTTOM_NAV}{SCRIPTS}</body></html>'''


def search_form(form_attr: str, input_attr: str, placeholder: str, button_text: str = "Search") -> str:
    return f'''<form class="tp-search" data-tp-search {form_attr} role="search"><div class="tp-search-row"><label class="tp-search-scope"><span class="tp-sr-only">Search category</span><select data-tp-search-scope {"data-tp-finder-scope" if "finder" in form_attr else ""}><option value="">All</option><option value="clothing">Clothing</option><option value="electronics">Electronics</option><option value="home">Home</option><option value="school">School & office</option><option value="sports">Sports</option><option value="beauty">Beauty</option><option value="kids">Kids</option><option value="software">Software</option><option value="business">Business</option></select></label><label class="tp-search-input">{SEARCH_ICON}<span class="tp-sr-only">Search products</span><input {input_attr} name="q" type="search" required autocomplete="off" placeholder="{placeholder}"></label><button class="tp-btn tp-btn-primary tp-search-submit" type="submit" aria-label="{button_text}"><span>{button_text}</span>{SEARCH_ICON}</button></div><div class="tp-search-suggestions" data-tp-search-suggestions hidden><h3>Popular ways to search</h3><div class="tp-suggestion-grid"><button type="button" data-search-fill="men's cotton T-shirts"><b>Clothing</b><small>Men's cotton T-shirts</small></button><button type="button" data-search-fill="laptop for teaching"><b>Computers</b><small>Laptop for teaching</small></button><button type="button" data-search-fill="wireless CarPlay adapter"><b>Car tech</b><small>Wireless CarPlay</small></button><button type="button" data-search-fill="school supplies"><b>School</b><small>School supplies</small></button><button type="button" data-search-fill="video editing software"><b>Software</b><small>Video editors</small></button><button type="button" data-search-fill="rare discontinued tools"><b>Rare finds</b><small>Discontinued tools</small></button></div></div></form>'''


def home_html() -> str:
    search = search_form('data-tp-home-search', '', "Search a product, need, model or problem", "Search")
    main = f'''
<section class="tp-home-hero"><div class="tp-shell"><div><span class="tp-eyebrow">Shopping Decision Engine</span><h1>Find the right product. <em>Compare with confidence.</em></h1><p>Exact matches first, useful alternatives separately, and the buying evidence kept visible.</p>{search}<div class="tp-quick-links"><span>Try:</span><a class="tp-chip" href="/find/?q=men%27s+T-shirts&scope=clothing">Men's T-shirts</a><a class="tp-chip" href="/find/?q=school+supplies&scope=school">School supplies</a><a class="tp-chip" href="/find/?q=wireless+CarPlay&scope=electronics">Wireless CarPlay</a></div><div class="tp-hero-stats"><div><strong data-catalog-count>Live catalogue</strong><span>Unique product records</span></div><div><strong data-store-count>Connected sellers</strong><span>Seller context stays visible</span></div><div><strong>Exact first</strong><span>No unrelated filler results</span></div></div></div><aside class="tp-hero-panel"><span>QUICK START</span><h2>What would help you today?</h2><div class="tp-decision-mini"><a href="/find/"><b>Find an exact product</b><span>Search by type or need →</span></a><a href="/compare/"><b>Compare selected products</b><span>Price, delivery and evidence →</span></a><a href="/deals/"><b>Check current savings</b><span>Deals before raw coupons →</span></a><a href="/price-watch/"><b>Open saved products</b><span>Targets on this device →</span></a></div></aside></div></section>
<section class="tp-section tp-section-white"><div class="tp-shell"><div class="tp-section-head"><div><span class="tp-kicker">Start here</span><h2>Four clear ways to make a better buying decision.</h2></div><p>Every page has one job, so the site feels useful rather than repetitive.</p></div><div class="tp-action-grid"><a class="tp-action-card" href="/find/"><i>⌕</i><h3>Find</h3><p>Search exact product families and audiences.</p></a><a class="tp-action-card" href="/compare/"><i>⇄</i><h3>Compare</h3><p>Keep same-type options side by side.</p></a><a class="tp-action-card" href="/deals/"><i>↓</i><h3>Check deals</h3><p>Separate price drops from coupon conditions.</p></a><a class="tp-action-card" href="/price-watch/"><i>♡</i><h3>Save</h3><p>Build a watch list and target prices.</p></a></div></div></section>
<section class="tp-section tp-section-soft"><div class="tp-shell"><div class="tp-section-head"><div><span class="tp-kicker">Current catalogue</span><h2>Products ready to inspect and compare.</h2></div><p>Compact cards show the facts without long feed descriptions.</p></div><div class="tp-product-grid" data-tp-home-products><div class="tp-empty">Loading current products…</div></div><div style="text-align:center;margin-top:22px"><a class="tp-btn tp-btn-light" href="/find/">Search the full catalogue</a></div></div></section>
<section class="tp-section tp-section-warm"><div class="tp-shell"><div class="tp-section-head"><div><span class="tp-kicker">Specialist tools</span><h2>Use the right tool for the category.</h2></div><p>Compatibility, licences and supplier terms need different questions.</p></div><div class="tp-tool-grid"><a class="tp-tool-card" href="/products/"><span>Electronics Lab</span><h3>Check compatibility first</h3><p>Model, connection, region and use.</p><b>Open the lab →</b></a><a class="tp-tool-card" href="/software/"><span>Software Finder</span><h3>Choose by the task</h3><p>Platform, licence and renewal evidence.</p><b>Find software →</b></a><a class="tp-tool-card" href="/sourcing/"><span>Business Sourcing</span><h3>Compare supplier terms</h3><p>MOQ, sample, customisation and lead time.</p><b>Source products →</b></a></div></div></section>
<section class="tp-section tp-section-white"><div class="tp-shell"><div class="tp-section-head"><div><span class="tp-kicker">Savings preview</span><h2>Current product-linked savings.</h2></div><p>We do not call a seller markdown verified history until enough price data exists.</p></div><div class="tp-product-grid" data-tp-home-deals><div class="tp-empty">Loading current savings…</div></div><div style="text-align:center;margin-top:22px"><a class="tp-btn tp-btn-light" href="/deals/">Open Deals & Coupons</a></div></div></section>
<section class="tp-section tp-section-night"><div class="tp-shell"><div class="tp-section-head"><div><span class="tp-eyebrow">Transparent ranking</span><h2>Useful evidence comes before commission.</h2></div><p style="color:#c5d0cb">Affiliate links may earn revenue, but organic ordering uses relevance and available buying evidence.</p></div><div class="tp-trust-grid"><div><strong>Exact intent</strong><span>Requested type and audience first</span></div><div><strong>Total-cost evidence</strong><span>Shipping stays visible when supplied</span></div><div><strong>Seller context</strong><span>Merchant information is not hidden</span></div><div><strong>Missing data</strong><span>Unknown fields remain unknown</span></div></div></div></section>'''
    return page("TrendPilot AI — Find, Compare and Save", "Find exact products, compare compatible options and review honest deal evidence before opening the seller.", "/", 'data-tp-page="home"', main)



def finder_html() -> str:
    search = search_form('data-tp-finder-form', 'data-tp-finder-input', "Search T-shirts, school supplies, laptops or a model", "Search")
    main = f'''
<section class="tp-finder-hero"><div class="tp-shell"><span class="tp-eyebrow">Exact product discovery</span><h1>What are you looking for?</h1><p>Choose a category or type naturally. TrendPilot counts only products it actually matched—not every candidate it checked.</p>{search}<div class="tp-quick-links"><span>Try:</span><button class="tp-chip" data-search-suggestion="men's T-shirts" data-search-scope="clothing" type="button">Men's T-shirts</button><button class="tp-chip" data-search-suggestion="men's shorts" data-search-scope="clothing" type="button">Men's shorts</button><button class="tp-chip" data-search-suggestion="school supplies" data-search-scope="school" type="button">School supplies</button><button class="tp-chip" data-search-suggestion="wireless CarPlay adapter" data-search-scope="electronics" type="button">Wireless CarPlay</button></div></div></section>
<div class="tp-shell tp-finder-layout"><aside class="tp-filter-panel" data-tp-filter-panel><div class="tp-filter-head"><div class="tp-filter-title-row"><h2>Refine results</h2><span class="tp-active-filter-count" data-tp-active-filter-count hidden>0</span></div><button class="tp-btn tp-btn-light tp-btn-small tp-filter-toggle" data-tp-filter-toggle type="button" aria-expanded="false">More filters</button></div><div class="tp-filter-primary"><div class="tp-filter-group"><label for="tp-group">Category</label><select id="tp-group" data-filter-group><option value="">All categories</option></select></div><div class="tp-filter-group"><label for="tp-family">Product type</label><select id="tp-family" data-filter-family><option value="">All specific types</option></select></div><div class="tp-filter-group"><label for="tp-audience">For whom</label><select id="tp-audience" data-filter-audience><option value="">Any audience</option><option value="men">Men</option><option value="women">Women</option><option value="kids">Kids</option><option value="unisex">Unisex</option></select></div></div><div class="tp-filter-more"><div class="tp-filter-group"><label for="tp-merchant">Seller</label><select id="tp-merchant" data-filter-merchant><option value="">All sellers</option></select></div><div class="tp-filter-group"><label for="tp-price">Price</label><select id="tp-price" data-filter-price><option value="">Any price</option><option value="0-10">Under $10</option><option value="10-25">$10–25</option><option value="25-50">$25–50</option><option value="50-100">$50–100</option><option value="100+">Over $100</option></select></div><div class="tp-filter-group"><label for="tp-sort">Sort</label><select id="tp-sort" data-filter-sort><option value="smart">Best match</option><option value="rating">Rating evidence</option><option value="delivery">Delivery evidence</option><option value="quality">Data completeness</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option></select></div></div><div class="tp-filter-checks"><label class="tp-check"><input data-filter-coupon type="checkbox">Matched coupon</label><label class="tp-check"><input data-filter-rare type="checkbox">Rare used only</label></div><div class="tp-filter-actions"><p class="tp-filter-note">Unknown audience is never silently treated as Men, Women or Kids.</p><button class="tp-filter-reset" data-reset-filters type="button">Clear</button></div></aside><section class="tp-main-col"><div class="tp-results-head"><div><h2 data-tp-results-title>Checking exact results…</h2><p data-tp-finder-status>Scanning the most relevant catalogue pages.</p></div><span class="tp-results-count" data-tp-results-count>Checking</span></div><div class="tp-result-tabs" data-tp-result-tabs></div><div class="tp-product-grid" data-tp-product-grid><div class="tp-empty">Loading products…</div></div><button class="tp-btn tp-btn-light tp-load-more" data-tp-load-more type="button" hidden>Show more</button></section></div>'''
    return page("Find Exact Products — TrendPilot AI", "Search exact product families and audiences and compare compatible products without unrelated filler results.", "/find/", 'data-tp-page="finder"', main)



def compare_html() -> str:
    main = '''<section class="tp-content-hero"><div class="tp-shell"><span class="tp-eyebrow">Same-type comparison</span><h1>Compare the evidence that changes the decision.</h1><p>Add up to three products from the same family. TrendPilot keeps price, shipping, delivery, rating, material and missing evidence visible.</p></div></section><section class="tp-content-wrap"><div class="tp-shell" data-tp-compare-page></div></section>'''
    return page("Compare Products — TrendPilot AI", "Compare two or three compatible products by total cost, seller, delivery, rating and product evidence.", "/compare/", 'data-tp-page="compare"', main)


def watch_html() -> str:
    main = '''<section class="tp-content-hero"><div class="tp-shell"><span class="tp-eyebrow">Personal watch list</span><h1>Save products and set the price you want.</h1><p>Your current V13 watch list is stored on this device. Account-based automatic notifications will be added after the search and catalogue are stable.</p></div></section><section class="tp-content-wrap"><div class="tp-shell" data-tp-saved-page></div></section>'''
    return page("Price Watch — TrendPilot AI", "Save products and target prices in your TrendPilot watch list.", "/price-watch/", 'data-tp-page="price-watch"', main)


def deals_html() -> str:
    main = '''<section class="tp-content-hero"><div class="tp-shell"><span class="tp-eyebrow">Deals & Coupons</span><h1>Useful savings first. Coupon clutter second.</h1><p>Product-linked price evidence appears before general codes. Coupon records are filtered by language and country so long foreign text does not dominate the page.</p></div></section><section class="tp-section tp-section-soft"><div class="tp-shell"><div class="tp-section-head"><div><span class="tp-kicker">Product-linked savings</span><h2>Current seller price-drop evidence.</h2></div><p>This is not yet a 90-day verified price history. The label stays honest until enough history is collected.</p></div><div class="tp-product-grid" data-tp-deal-products><div class="tp-empty">Loading product savings…</div></div></div></section><section class="tp-section tp-section-white"><div class="tp-shell"><div class="tp-section-head"><div><span class="tp-kicker">Coupon Center</span><h2>Codes that fit your region and language.</h2></div><p>Worldwide English records are shown first. You can widen the filters when needed.</p></div><div class="tp-deal-toolbar"><input data-coupon-search type="search" placeholder="Search merchant or code"><select data-coupon-country><option value="GLOBAL">Worldwide / unspecified</option><option value="OM">Oman</option><option value="ALL">All countries</option></select><select data-coupon-language><option value="en">English</option><option value="all">All languages</option></select></div><div class="tp-coupon-grid" data-tp-coupon-grid><div class="tp-empty">Loading coupons…</div></div><button class="tp-btn tp-btn-light tp-coupon-toggle" data-coupon-toggle type="button" hidden>Show all coupons</button><p class="tp-coupon-disclosure">Always confirm eligibility, minimum order, country and expiry on the seller page before payment.</p></div></section>'''
    return page("Deals & Coupons — TrendPilot AI", "Review product-linked savings and filter current coupon records by country and language.", "/deals/", 'data-tp-page="deals"', main)



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
    text = re.sub(r'<section class="tp-newsletter".*?</section>', '', text, count=1, flags=re.I | re.S)
    text = re.sub(r'<footer class="tp-footer".*?</footer>', '', text, count=1, flags=re.I | re.S)
    text = re.sub(r'<nav class="tp-bottom-nav".*?</nav>', '', text, count=1, flags=re.I | re.S)
    text = re.sub(r'\s*<link[^>]+href=["\']/css/style-v(?:11|12|13(?:-2)?)\.css[^"\']*["\'][^>]*>\s*', '\n', text, flags=re.I)
    managed = r'(?:site-v(?:11|12|13(?:-2)?)|site-config|program-status|matched-products|affiliate-links|coupons-data)\.js'
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
    elif '/css/style-v13-2.css' not in text:
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
    text = re.sub(r'</body>', FOOTER + BOTTOM_NAV + SCRIPTS + '</body>', text, count=1, flags=re.I) if re.search(r'</body>', text, re.I) else text + FOOTER + BOTTOM_NAV + SCRIPTS + '</body>'
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
    print(f"TrendPilot V13.2 installed: pages={len(key_paths)}, legacy_refreshed={changed}, review_repaired={int(review)}, catalog_refresh_hook={int(refresh_hook)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
