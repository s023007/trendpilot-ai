#!/usr/bin/env python3
import json
import re
import html as html_lib
from datetime import datetime
from pathlib import Path
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[2] if '.github' in str(Path(__file__)) else Path.cwd()
PAGE = ROOT / 'public/guides/manchester-derby-tickets-saudi-arabia/index.html'
STATE = ROOT / '.github/data/manchester-derby-prices.json'

URLS = {
    'ticombo': 'https://www.ticombo.com/en/discover/event/manchester-united-fc-vs-manchester-city-fc-premier-league-3001252536',
    'sports365': 'https://sportsevents365.com/events/venue/1018/',
    'livefootballtickets': 'https://www.livefootballtickets.com/fixtures/manchester-united-v-manchester-city-tickets-english-premier-league.html',
    'footballticketpad': 'https://www.footballticketpad.com/premier-league/manchester-united-v-manchester-city',
}

DEFAULTS = {
    'ticombo': {'amount': 378.0, 'currency': 'EUR', 'source': URLS['ticombo']},
    'sports365': {'amount': 364.0, 'currency': 'USD', 'source': URLS['sports365']},
    'livefootballtickets': {'amount': 245.0, 'currency': 'GBP', 'source': URLS['livefootballtickets']},
    'footballticketpad': {'amount': 265.73, 'currency': 'GBP', 'source': URLS['footballticketpad']},
    'shortside_lower': {'amount': 357.0, 'currency': 'USD', 'source': 'market-reference'},
    'longside_lower': {'amount': 362.0, 'currency': 'USD', 'source': 'market-reference'},
}

FALLBACK_FX = {'EUR_USD': 1.16727, 'EUR_GBP': 0.85536}


def fetch(url: str, timeout: int = 25) -> str:
    req = Request(url, headers={
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/126 Safari/537.36 TrendPilotPriceBot/1.0',
        'Accept-Language': 'en-GB,en;q=0.9',
        'Cache-Control': 'no-cache',
    })
    with urlopen(req, timeout=timeout) as r:
        return r.read().decode('utf-8', errors='replace')


def plain_text(raw: str) -> str:
    raw = re.sub(r'<script\b[^>]*>.*?</script>', ' ', raw, flags=re.I | re.S)
    raw = re.sub(r'<style\b[^>]*>.*?</style>', ' ', raw, flags=re.I | re.S)
    raw = re.sub(r'<[^>]+>', ' ', raw)
    return re.sub(r'\s+', ' ', html_lib.unescape(raw)).strip()


def get_fx():
    fx = FALLBACK_FX.copy()
    try:
        data = json.loads(fetch('https://api.frankfurter.app/latest?from=EUR&to=USD,GBP', 15))
        rates = data.get('rates', {})
        if rates.get('USD'):
            fx['EUR_USD'] = float(rates['USD'])
        if rates.get('GBP'):
            fx['EUR_GBP'] = float(rates['GBP'])
    except Exception as exc:
        print(f'FX fallback used: {exc}')
    fx['EUR_SAR'] = fx['EUR_USD'] * 3.75
    return fx


def to_eur(amount: float, currency: str, fx: dict) -> float:
    c = currency.upper()
    if c == 'EUR':
        return amount
    if c == 'USD':
        return amount / fx['EUR_USD']
    if c == 'GBP':
        return amount / fx['EUR_GBP']
    raise ValueError(f'Unsupported currency: {currency}')


def display(eur: float, fx: dict):
    e = int(round(eur))
    sar = int(round(eur * fx['EUR_SAR']))
    return e, sar


def parse_sports365(raw: str):
    text = plain_text(raw)
    target = 'Manchester United vs Manchester City'
    idx = text.lower().find(target.lower())
    if idx < 0:
        return None
    window = text[max(0, idx - 500): idx + 1800]
    patterns = [
        (r'From\s*\$\s*([0-9][0-9,.]*)', 'USD'),
        (r'From\s*€\s*([0-9][0-9,.]*)', 'EUR'),
        (r'From\s*£\s*([0-9][0-9,.]*)', 'GBP'),
        (r'From\s*([0-9][0-9,.]*)\s*\$', 'USD'),
        (r'From\s*([0-9][0-9,.]*)\s*€', 'EUR'),
        (r'From\s*([0-9][0-9,.]*)\s*£', 'GBP'),
    ]
    for pat, cur in patterns:
        m = re.search(pat, window, flags=re.I)
        if m:
            return {'amount': float(m.group(1).replace(',', '')), 'currency': cur, 'source': URLS['sports365']}
    return None


def parse_livefootballtickets(raw: str):
    text = plain_text(raw)
    if 'Manchester United vs Manchester City' not in text:
        return None
    m = re.search(r'Tickets\s+(?:available\s+)?from\s*£\s*([0-9][0-9,.]*)', text, flags=re.I)
    if not m:
        return None
    return {'amount': float(m.group(1).replace(',', '')), 'currency': 'GBP', 'source': URLS['livefootballtickets']}


def parse_footballticketpad(raw: str):
    text = plain_text(raw)
    if 'Manchester United' not in text or 'Manchester City' not in text:
        return None
    m = re.search(r'Longside\s+Upper.{0,500}?(?:£|GBP)\s*([0-9][0-9,.]*)', text, flags=re.I)
    if not m:
        m = re.search(r'(?:from|starting\s+at)\s*(?:£|GBP)\s*([0-9][0-9,.]*)', text, flags=re.I)
    if not m:
        return None
    return {'amount': float(m.group(1).replace(',', '')), 'currency': 'GBP', 'source': URLS['footballticketpad']}


def parse_ticombo(raw: str):
    if '3001252536' not in raw and 'Manchester United' not in raw:
        return None
    candidates = []
    key_patterns = [
        r'"(?:lowestPrice|minPrice|minimumPrice|priceFrom|startingPrice)"\s*:\s*"?([0-9]+(?:\.[0-9]+)?)"?',
        r'"(?:lowest_price|min_price|minimum_price|price_from|starting_price)"\s*:\s*"?([0-9]+(?:\.[0-9]+)?)"?',
    ]
    for pat in key_patterns:
        for m in re.finditer(pat, raw, flags=re.I):
            v = float(m.group(1))
            if 80 <= v <= 1500:
                candidates.append(v)
    if not candidates:
        return None
    return {'amount': min(candidates), 'currency': 'EUR', 'source': URLS['ticombo']}


def load_state():
    if STATE.exists():
        try:
            return json.loads(STATE.read_text('utf-8'))
        except Exception:
            pass
    return {'sources': DEFAULTS.copy()}


def safe_source(name, parsed, previous):
    if not parsed:
        return previous.get(name) or DEFAULTS[name]
    amount = float(parsed['amount'])
    prev = previous.get(name) or DEFAULTS[name]
    if prev and prev.get('amount') and prev.get('currency') == parsed.get('currency'):
        ratio = amount / float(prev['amount'])
        if ratio < 0.4 or ratio > 1.6:
            print(f'{name}: rejected implausible parsed price {amount} {parsed["currency"]}')
            return prev
    return parsed


def trend_note(name, current_eur, old_state):
    old = ((old_state.get('normalized_eur') or {}).get(name))
    if not old:
        return ''
    pct = (current_eur - float(old)) / float(old) * 100
    if pct <= -10:
        return f' 🔥 انخفض نحو {abs(pct):.0f}% منذ آخر تحديث.'
    if pct >= 10:
        return f' ارتفع نحو {pct:.0f}% منذ آخر تحديث.'
    return ''


def replace_offer_block(doc: str, seller: str, price_text: str, sar_text: str, note_text: str | None = None):
    seller_re = re.escape(seller)
    pattern = re.compile(
        rf'(<a class="offer[^>]*data-seller="{seller_re}"[^>]*>.*?<div class="price">)(.*?)(</div>\s*<div class="sar">)(.*?)(</div>)(.*?</a>)',
        flags=re.S,
    )
    m = pattern.search(doc)
    if not m:
        print(f'Offer block not found: {seller}')
        return doc
    tail = m.group(6)
    if note_text is not None:
        tail = re.sub(r'(<div class="offer-note">).*?(</div>)', rf'\1{note_text}\2', tail, count=1, flags=re.S)
    return doc[:m.start()] + m.group(1) + price_text + m.group(3) + sar_text + m.group(5) + tail + doc[m.end():]


def replace_check_price(doc: str, seller: str, price_text: str, paragraph: str | None = None):
    seller_re = re.escape(seller)
    pattern = re.compile(
        rf'(<div class="check-card">\s*<div class="check-top"><strong><bdi>{seller_re}</bdi></strong><span class="check-price">)(.*?)(</span></div>\s*<p>)(.*?)(</p>)',
        flags=re.S,
    )
    m = pattern.search(doc)
    if not m:
        return doc
    p = paragraph if paragraph is not None else m.group(4)
    return doc[:m.start()] + m.group(1) + price_text + m.group(3) + p + m.group(5) + doc[m.end():]


def replace_seat(doc: str, seat_id: str, price_text: str, source_text: str):
    pattern = re.compile(
        rf'(<article class="seat" id="{re.escape(seat_id)}">.*?<div class="seat-price">)(.*?)(</div>.*?<div class="seat-source">)(.*?)(</div>)',
        flags=re.S,
    )
    m = pattern.search(doc)
    if not m:
        return doc
    return doc[:m.start()] + m.group(1) + price_text + m.group(3) + source_text + m.group(5) + doc[m.end():]


def main():
    if not PAGE.exists():
        raise SystemExit(f'Missing page: {PAGE}')
    old_state = load_state()
    previous = old_state.get('sources', {})
    fx = get_fx()

    parsed = {}
    for name, url, parser in [
        ('ticombo', URLS['ticombo'], parse_ticombo),
        ('sports365', URLS['sports365'], parse_sports365),
        ('livefootballtickets', URLS['livefootballtickets'], parse_livefootballtickets),
        ('footballticketpad', URLS['footballticketpad'], parse_footballticketpad),
    ]:
        try:
            item = parser(fetch(url))
            parsed[name] = safe_source(name, item, previous)
            print(f'{name}: {parsed[name]}')
        except Exception as exc:
            print(f'{name}: fetch/parse failed: {exc}')
            parsed[name] = previous.get(name) or DEFAULTS[name]

    for name in ('shortside_lower', 'longside_lower'):
        parsed[name] = previous.get(name) or DEFAULTS[name]

    normalized = {name: to_eur(float(v['amount']), v['currency'], fx) for name, v in parsed.items()}
    doc = PAGE.read_text('utf-8')

    tic_e, tic_sar = display(normalized['ticombo'], fx)
    s365_e, s365_sar = display(normalized['sports365'], fx)
    lft_e, lft_sar = display(normalized['livefootballtickets'], fx)
    ftp_e, ftp_sar = display(normalized['footballticketpad'], fx)
    short_low_e, short_low_sar = display(normalized['shortside_lower'], fx)
    long_low_e, long_low_sar = display(normalized['longside_lower'], fx)

    tic_trend = trend_note('ticombo', normalized['ticombo'], old_state)
    s365_trend = trend_note('sports365', normalized['sports365'], old_state)

    doc = replace_offer_block(
        doc, 'Ticombo', f'€{tic_e:,}', f'≈ {tic_sar:,} ر.س',
        'سعر ابتدائي للمباراة نفسها. افحص فئة المقعد والرسوم قبل الدفع.' + tic_trend,
    )
    doc = replace_offer_block(
        doc, 'Sports Events 365', f'€{s365_e:,}', f'≈ {s365_sar:,} ر.س',
        'سعر المباراة نفسها بعد توحيد العملة. قد يعرض موقع البائع عملتك المحلية تلقائيًا حسب بلد الدخول؛ افحص المقعد والرسوم قبل الدفع.' + s365_trend,
    )

    doc = replace_check_price(
        doc, 'LiveFootballTickets', f'من €{lft_e:,}',
        'صفحة مباشرة لنفس المباراة. السعر المعروض هنا موحّد إلى اليورو، وتأكد من شروط نوع التذكرة قبل المقارنة.',
    )
    doc = replace_check_price(
        doc, 'Football Ticket Pad', f'من €{ftp_e:,}',
        'صفحة مباشرة لنفس المباراة. السعر المعروض هنا موحّد إلى اليورو، وافحص فئة المقعد والرسوم النهائية.',
    )
    doc = replace_check_price(
        doc, 'Sports Events 365', f'من €{s365_e:,}',
        'رصدنا المباراة نفسها ونعرض السعر هنا باليورو للمقارنة. موقع البائع قد يحوّل السعر تلقائيًا إلى عملتك المحلية.',
    )

    doc = replace_seat(doc, 'seat-short-upper', f'من €{lft_e:,}', f'≈ {lft_sar:,} ر.س عند آخر تحديث. مرجع مباشر: LiveFootballTickets لنفس المباراة.')
    doc = replace_seat(doc, 'seat-long-upper', f'من €{ftp_e:,}', f'≈ {ftp_sar:,} ر.س عند آخر تحديث. مرجع مباشر: Football Ticket Pad لنفس المباراة.')
    doc = replace_seat(doc, 'seat-short-lower', f'من €{short_low_e:,}', f'≈ {short_low_sar:,} ر.س. مرجع سوق للمباراة؛ افحص الفئة والرسوم داخل موقع البائع.')
    doc = replace_seat(doc, 'seat-long-lower', f'من €{long_low_e:,}', f'≈ {long_low_sar:,} ر.س. مرجع سوق للمباراة؛ افحص الفئة والرسوم داخل موقع البائع.')

    doc = re.sub(r'≈\s*[0-9,]+\s*ر\.س\s*·?\s*ويظهر.*?عملة عُمان', f'≈ {s365_sar:,} ر.س', doc)
    doc = doc.replace('$364 / $432', f'من €{s365_e:,}')
    doc = doc.replace('$364', f'€{s365_e:,}')
    doc = doc.replace('$432', '')

    now = datetime.now(ZoneInfo('Asia/Riyadh'))
    stamp = now.strftime('%d-%m-%Y %H:%M')
    footer_text = (
        f'آخر تحديث تلقائي للأسعار: {stamp} بتوقيت السعودية · جميع الأسعار في الصفحة باليورو وما يعادلها تقريبًا بالريال السعودي · '
        'الأسعار والتوفر متغيرة · صورة Old Trafford: Wikimedia Commons / CC BY-SA'
    )
    doc = re.sub(r'<footer>.*?</footer>', f'<footer>{footer_text}</footer>', doc, count=1, flags=re.S)
    doc = doc.replace("page_version:'v4-visual-qa'", "page_version:'v5-daily-price-refresh'")

    PAGE.write_text(doc, 'utf-8')
    STATE.parent.mkdir(parents=True, exist_ok=True)
    state = {
        'updated_at_riyadh': now.isoformat(timespec='seconds'),
        'fx': fx,
        'sources': parsed,
        'normalized_eur': {k: round(v, 4) for k, v in normalized.items()},
    }
    STATE.write_text(json.dumps(state, ensure_ascii=False, indent=2) + '\n', 'utf-8')
    print(f'Updated {PAGE}')
    print(f'Updated {STATE}')


if __name__ == '__main__':
    main()
