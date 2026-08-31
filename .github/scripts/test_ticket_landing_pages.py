from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]
NL = ROOT / 'events/el-clasico-2026/nl-nl/index.html'
ROOT_PAGE = ROOT / 'events/el-clasico-2026/index.html'
SAVE_JS = ROOT / 'events/manchester-derby-2026/save-search.js'
SAVE_PHP = ROOT / 'api/save-search.php'
ROUTER_JS = ROOT / 'events/_factory/locale-router-v1.js'
OUTBOUND_API = ROOT / 'api/seller-outbound.php'
AUDIT_YML = ROOT / '.github/workflows/ticket-email-funnel-readonly.yml'
UPLOAD_YML = ROOT / '.github/workflows/upload-google-ads-conversions-hourly.yml'
DEPLOY_YML = ROOT / '.github/workflows/deploy-email-system.yml'
PAID_EVENTS = [
    'manchester-derby-2026',
    'liverpool-v-manchester-united-2026',
    'el-clasico-2026',
    'madrid-derby-2026',
    'north-london-derby-2026',
    'arsenal-v-manchester-city-2026',
]
BACKEND_CAMPAIGNS = [
    'manchester_derby_2026',
    'liverpool_manunited_2026',
    'el_clasico_2026',
    'madrid_derby_2026',
    'north_london_derby_2026',
    'arsenal_mancity_2026',
]


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def main() -> None:
    html = NL.read_text(encoding='utf-8')
    root_html = ROOT_PAGE.read_text(encoding='utf-8')
    save_js = SAVE_JS.read_text(encoding='utf-8')
    save_php = SAVE_PHP.read_text(encoding='utf-8')
    router_js = ROUTER_JS.read_text(encoding='utf-8')

    # Locale + SEO contract for the paid Dutch page.
    require('<html lang="nl-NL"' in html, 'Dutch landing page must declare nl-NL')
    require('rel="canonical" href="https://trendpilotchoice.com/events/el-clasico-2026/nl-nl/"' in html,
            'Dutch canonical URL missing or wrong')
    require('hreflang="nl-NL"' in html, 'Dutch hreflang missing')
    require('save-search.js' in html, 'Purchase-intent/save tracking script missing')

    # Seller links must match the exact fixture and must not force an unrelated locale.
    require('seatpick.com/ar/' not in html, 'Dutch page must not send users to SeatPick Arabic locale')
    require('https://seatpick.com/fc-barcelona-vs-real-madrid-camp-nou-stadium-tickets/event/510975' in html,
            'SeatPick must use the verified exact-event URL')
    require('https://www.fanpass.es/real-madrid-entradas/' not in html,
            'Generic Real Madrid Fanpass page is not acceptable for paid El Clasico traffic')
    require('https://www.fanpass.es/entradas-fc-barcelona-vs-real-madrid' in html,
            'Fanpass must use the verified exact-fixture URL')

    seller_links = re.findall(r'<a class="price-link"[^>]+>', html)
    require(len(seller_links) >= 3, 'Expected at least three seller CTAs')
    for link in seller_links:
        require('rel="nofollow noopener"' in link, f'Unsafe seller link attributes: {link}')

    # Shared modal must be truly localized for a Dutch paid visitor.
    require('nl:{' in save_js or 'nl: {' in save_js, 'Dutch save-offer modal copy is missing')
    require("startsWith('nl')" in save_js, 'Dutch browser/page language is not selected in save-search.js')
    require('Doorgaan zonder e-mail' in save_js, 'Dutch no-email CTA is missing')

    # The email itself must remain Dutch after a Dutch visitor submits the form.
    require("$nl=$lang==='nl'" in save_php.replace(' ', ''), 'save-search.php has no Dutch locale branch')
    require('/events/el-clasico-2026/nl-nl/' in save_php, 'Dutch email return URL is missing')
    require('Je El Clásico-aanbod is opgeslagen' in save_php, 'Dutch El Clasico email subject/headline is missing')
    require('Bekijk prijs en stoelen' in save_php, 'Dutch email CTA is missing')

    # The no-email path is a real conversion signal and must be logged server-side.
    require(OUTBOUND_API.exists(), 'Server-side seller outbound endpoint is missing')
    require('seller-outbound.php' in save_js, 'save-search.js does not call seller outbound tracking')
    require('trackSellerOutbound' in save_js, 'No explicit seller outbound tracking function found')
    outbound_php = OUTBOUND_API.read_text(encoding='utf-8')
    require('seller-outbound.jsonl' in outbound_php, 'Seller outbound endpoint does not persist its event log')
    require('gclid' in outbound_php, 'Seller outbound endpoint does not preserve Google click attribution')
    require('lead_id' in outbound_php, 'Seller outbound event lacks a dedupe/conversion identifier')

    # Deployment, Google Ads conversion upload and read-only audit must all include direct seller clicks.
    deploy = DEPLOY_YML.read_text(encoding='utf-8')
    upload = UPLOAD_YML.read_text(encoding='utf-8')
    audit = AUDIT_YML.read_text(encoding='utf-8')
    require('api/seller-outbound.php' in deploy, 'API deployment does not include seller-outbound.php')
    require('seller-outbound.jsonl' in upload, 'Google Ads conversion uploader does not read direct seller clicks')
    require('seller-outbound.jsonl' in audit, 'Read-only funnel audit does not count direct seller clicks')
    for campaign in BACKEND_CAMPAIGNS:
        require(campaign in audit, f'Read-only audit omits backend campaign id {campaign}')
    require("'el-clasico-2026'" not in audit, 'Audit still uses page slugs instead of backend campaign IDs')

    # Locale router must understand Netherlands both from country and browser language.
    require("'NL'" in router_js, 'Global locale router does not map Netherlands to nl-nl')
    require("startsWith('nl')" in router_js, 'Global locale router does not understand Dutch browser locale')
    require('"nl-nl"' in root_html or "'nl-nl'" in root_html, 'El Clasico root router does not advertise nl-nl')
    require("startsWith('nl')" in root_html, 'El Clasico immediate root redirect bypasses Dutch visitors')

    for slug in PAID_EVENTS:
        event = ROOT / 'events' / slug
        dutch = event / 'nl-nl' / 'index.html'
        root = event / 'index.html'
        if dutch.exists():
            require(root.exists(), f'{slug}: Dutch page exists but event root router is missing')
            routed = root.read_text(encoding='utf-8')
            require('nl-nl' in routed, f'{slug}: Dutch page exists but root router omits nl-nl')
            require("startsWith('nl')" in routed, f'{slug}: immediate root redirect bypasses Dutch visitors')

    print('PASS paid-ticket QA: Dutch page, exact sellers, localized funnel, outbound conversions, correct audit IDs, routing')


if __name__ == '__main__':
    main()
