#!/usr/bin/env python3
"""Install TrendPilot V13.5 product decision pages without changing the calm V13.2 visual system."""
from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VERSION = "13.5.0"
BASE = "https://trendpilot-ai.netlify.app"
STYLE_TAG = f'<link rel="stylesheet" href="/css/style-v13-5.css?v={VERSION}">'
SCRIPT_TAG = f'<script defer src="/js/site-v13-5.js?v={VERSION}"></script>'

HEADER = '''<a class="tp-skip" href="#main">Skip to content</a>
<header class="tp-header" data-v13-header><div class="tp-shell tp-nav"><a class="tp-brand" href="/" aria-label="TrendPilot AI home"><img src="/images/logo-v4.svg" alt="" width="42" height="42"><span>TrendPilot <em>AI</em></span></a><nav class="tp-links" data-tp-nav aria-label="Primary navigation"><strong class="tp-menu-title">Explore TrendPilot</strong><button class="tp-menu-close" data-tp-menu-close type="button" aria-label="Close menu">×</button><span class="tp-menu-section-title">Decide</span><a href="/find/">Find products</a><a href="/deals/">Deals & coupons</a><a href="/compare/">Compare <span class="tp-count" data-compare-count hidden>0</span></a><a href="/price-watch/">Saved products <span class="tp-count" data-saved-count hidden>0</span></a><span class="tp-menu-section-title">Explore</span><a href="/products/">Electronics Lab</a><a href="/software/">Software Finder</a><a href="/rare-used/">Rare Finds</a><a href="/guides/">Buying Guides</a><a href="/sourcing/">For Business</a><a class="tp-nav-cta" href="/find/">Search the catalogue</a></nav><button class="tp-menu-button" data-tp-menu-button type="button" aria-expanded="false" aria-label="Open menu"><span></span><span></span><span></span></button></div><button class="tp-nav-backdrop" data-tp-nav-backdrop type="button" aria-label="Close menu"></button></header>'''
FOOTER = '''<section class="tp-newsletter"><div class="tp-shell tp-newsletter-inner"><div><span class="tp-kicker">Useful alerts, not noise</span><h2>Price drops and practical buying ideas in your inbox.</h2><p>Get occasional TrendPilot updates when we have something worth checking.</p></div><div><form name="trendpilot-updates" method="POST" data-netlify="true"><input type="hidden" name="form-name" value="trendpilot-updates"><label class="tp-sr-only" for="tp-email">Email address</label><input id="tp-email" name="email" type="email" autocomplete="email" required placeholder="Your email address"><button class="tp-btn tp-btn-primary" type="submit">Join</button></form><small>Unsubscribe any time. We do not sell email addresses.</small></div></div></section><footer class="tp-footer" data-v13-footer><div class="tp-shell tp-footer-grid"><div><a class="tp-brand" href="/"><img src="/images/logo-v4.svg" alt="" width="42" height="42"><span>TrendPilot <em>AI</em></span></a><p>A calmer shopping decision engine for exact discovery, honest deal evidence and same-type comparison.</p></div><div><h2>Decide</h2><a href="/find/">Find products</a><a href="/compare/">Compare</a><a href="/deals/">Deals & coupons</a><a href="/price-watch/">Saved products</a></div><div><h2>Explore</h2><a href="/products/">Electronics Lab</a><a href="/software/">Software Finder</a><a href="/rare-used/">Rare Finds</a><a href="/sourcing/">Business Sourcing</a></div><div><h2>Trust</h2><a href="/editorial-methodology.html">How we rank</a><a href="/affiliate-disclosure.html">Affiliate disclosure</a><a href="/privacy.html">Privacy</a><a href="/terms.html">Terms</a><a href="/contact.html">Contact</a></div></div><div class="tp-shell tp-footer-bottom"><span>© <span data-year></span> TrendPilot AI.</span><span>Prices, stock, delivery and coupon terms can change. Confirm them before payment.</span></div></footer>'''
BOTTOM_NAV = '''<nav class="tp-bottom-nav" aria-label="Mobile navigation"><a data-bottom-link href="/"><b>⌂</b><span>Home</span></a><a data-bottom-link href="/find/"><b>⌕</b><span>Search</span></a><a data-bottom-link href="/deals/"><b>↓</b><span>Deals</span></a><a data-bottom-link href="/compare/"><b>⇄</b><span>Compare</span><i class="tp-count" data-compare-count hidden>0</i></a></nav>'''
SCRIPTS = f'''<script defer src="/js/site-config.js?v={VERSION}"></script>
<script defer src="/js/program-status.js?v={VERSION}"></script>
<script defer src="/js/matched-products.js?v={VERSION}"></script>
<script defer src="/js/affiliate-links.js?v={VERSION}"></script>
<script defer src="/js/coupons-data.js?v={VERSION}"></script>
{SCRIPT_TAG}'''


def product_page() -> str:
    title = "Product details, seller offers and buyer checks — TrendPilot AI"
    description = "Review a product's available specifications, seller offers, buyer checks and same-type alternatives before opening the seller."
    return f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#f7f5ef"><meta name="robots" content="index,follow,max-image-preview:large"><title>{title}</title><meta name="description" content="{description}"><link rel="canonical" href="{BASE}/product/"><meta property="og:site_name" content="TrendPilot AI"><meta property="og:type" content="product"><meta property="og:title" content="{title}"><meta property="og:description" content="{description}"><link rel="icon" href="/images/favicon-v4.svg" type="image/svg+xml"><link rel="manifest" href="/manifest.webmanifest"><link rel="stylesheet" href="/css/style-v13-2.css?v={VERSION}">{STYLE_TAG}</head><body data-tp-page="product-detail">{HEADER}<main id="main" data-tp-product-detail><div class="tp-shell tp-product-loading"><span></span><p>Loading product evidence…</p></div></main>{FOOTER}{BOTTOM_NAV}{SCRIPTS}</body></html>'''


def write_product_page() -> Path:
    path = ROOT / "product" / "index.html"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(product_page(), encoding="utf-8")
    return path


def patch_html() -> tuple[int, int, int]:
    changed = scripts = styles = 0
    script_pattern = re.compile(r'\s*<script[^>]+src=["\']/js/site-v13(?:-2|-3|-4|-5)?\.js[^"\']*["\'][^>]*>\s*</script>\s*', re.I)
    style_pattern = re.compile(r'\s*<link[^>]+href=["\']/css/style-v13-5\.css[^"\']*["\'][^>]*>\s*', re.I)
    for path in ROOT.rglob("*.html"):
        rel = path.relative_to(ROOT)
        if any(part.startswith(".") or part in {"node_modules", "automation", "tests"} for part in rel.parts):
            continue
        original = path.read_text(encoding="utf-8", errors="ignore")
        text = style_pattern.sub("\n", original)
        if re.search(r'</head>', text, re.I):
            text = re.sub(r'</head>', STYLE_TAG + "\n</head>", text, count=1, flags=re.I)
            styles += 1
        text, count = script_pattern.subn("\n" + SCRIPT_TAG + "\n", text)
        scripts += count
        if count == 0 and re.search(r'</body>', text, re.I):
            text = re.sub(r'</body>', SCRIPT_TAG + "\n</body>", text, count=1, flags=re.I)
            scripts += 1
        if text != original:
            path.write_text(text, encoding="utf-8")
            changed += 1
    return changed, scripts, styles


def ensure_refresh_hook() -> bool:
    path = ROOT / "automation" / "build_search_catalog.py"
    if not path.exists():
        return False
    text = path.read_text(encoding="utf-8", errors="ignore")
    marker = "TREND_PILOT_V13_REFRESH_HOOK"
    if marker in text:
        return False
    hook = '''
# TREND_PILOT_V13_REFRESH_HOOK
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
        _tp_v13_subprocess.run(_tp_v13_command, cwd=_tp_v13_root, check=True)

    _tp_v13_atexit.register(_tp_v13_rebuild_exact_catalogue)
# TREND_PILOT_V13_REFRESH_HOOK_END
'''
    guards = list(re.finditer(r'^if __name__\s*==\s*["\']__main__["\']\s*:\s*$', text, flags=re.M))
    if not guards:
        raise RuntimeError("Cannot patch automation/build_search_catalog.py safely: main guard missing")
    pos = guards[-1].start()
    path.write_text(text[:pos] + hook + "\n" + text[pos:], encoding="utf-8")
    return True


def build_catalog() -> dict:
    builder = ROOT / "automation" / "build_decision_catalog.py"
    subprocess.run([sys.executable, str(builder), "--allow-fallback"], cwd=ROOT, check=True)
    manifest_path = ROOT / "data" / "search-catalog" / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if manifest.get("version") != VERSION:
        raise RuntimeError(f"Unexpected catalogue version: {manifest.get('version')}")
    if not manifest.get("productIndexBase"):
        raise RuntimeError("Product lookup index was not generated")
    return manifest


def main() -> int:
    write_product_page()
    changed, scripts, styles = patch_html()
    hook = ensure_refresh_hook()
    manifest = build_catalog()
    print(
        "TrendPilot V13.5 installed: "
        f"pages_updated={changed}, script_tags={scripts}, style_tags={styles}, refresh_hook_added={int(hook)}, "
        f"products={manifest.get('productCount',0):,}, index_files={manifest.get('productIndexFiles',0)}, "
        "product_page=1, quick_view=1, outbound_clicks=qualified"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
