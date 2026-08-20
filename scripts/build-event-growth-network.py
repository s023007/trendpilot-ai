#!/usr/bin/env python3
import datetime as dt
import html
import json
import pathlib
import re
from urllib.parse import quote_plus

ROOT = pathlib.Path(__file__).resolve().parents[1]
REG = ROOT / 'data/event-factory/events.json'
OUT = ROOT / 'data/event-factory/growth-network.json'
ORIGIN = 'https://trendpilotchoice.com'
CSS = '/events/_factory/premium-v1.css?v=1.0.0'

LOCALES = ['ar', 'en-gb', 'de-de', 'fr-fr', 'es-es']
HL = {'ar':'ar','en-gb':'en-GB','de-de':'de-DE','fr-fr':'fr-FR','es-es':'es-ES'}
LANG = {'ar':('ar','rtl'),'en-gb':('en','ltr'),'de-de':('de','ltr'),'fr-fr':('fr','ltr'),'es-es':('es','ltr')}
LABEL = {'ar':'العربية','en-gb':'UK','de-de':'DE','fr-fr':'FR','es-es':'ES'}

UI = {
'ar': {
    'tickets':'التذاكر','guides':'أدلة المباريات','travel':'السفر','hotels':'الفنادق',
    'browse':'استعرض خيارات التذاكر','open':'افتح دليل المباراة','plan':'خطط للرحلة',
    'verified':'نضيف فقط المباريات التي تمر بفحص التاريخ ومسار التذكرة والصور.',
    'league_title':'{league}: تذاكر المباريات وأدلة السفر',
    'league_intro':'اكتشف أهم مباريات {league}، ثم ثبّت التذكرة ورتّب الرحلة والفندق حول الموعد.',
    'team_title':'{team}: التذاكر والمباريات القادمة',
    'team_intro':'صفحة تجمع أدلة {team} الموثقة وخيارات التذاكر والسفر في مكان واحد.',
    'venue_title':'فنادق قريبة من {venue} + دليل يوم المباراة',
    'venue_intro':'اختر الفندق بعد تثبيت موعد المباراة، واترك وقتًا كافيًا للوصول إلى {venue}.',
    'from_title':'السفر من {market} إلى {city} لحضور {event}',
    'from_intro':'رتّب الرحلة بالترتيب الصحيح: التذكرة أولًا، ثم الرحلة، ثم الفندق حول موعد المباراة.',
    'flight':'قارن رحلات {origin} → {city}','hotel':'قارن فنادق {city}','ticket':'شاهد خيارات التذاكر',
    'steps':['ثبّت التذكرة','قارن الرحلات','اختر الفندق حول موعد المباراة'],
    'events':'مباريات موثقة','next':'خطوتك التالية','why':'لماذا هذه الصفحة؟',
    'disclosure':'TrendPilot دليل مستقل وقد يحصل على عمولة من حجوزات مؤهلة دون تكلفة إضافية عليك.'
},
'en-gb': {
    'tickets':'Tickets','guides':'Match guides','travel':'Travel','hotels':'Hotels',
    'browse':'Browse ticket options','open':'Open match guide','plan':'Plan the trip',
    'verified':'We only publish match guides after date, ticket-route and image checks pass.',
    'league_title':'{league} tickets, match guides & travel planning',
    'league_intro':'Find high-intent {league} match guides, then secure the ticket and build travel around the fixture.',
    'team_title':'{team} tickets and match-weekend guides',
    'team_intro':'A focused hub for verified {team} event guides, ticket routes and travel planning.',
    'venue_title':'Hotels near {venue} + matchday planning',
    'venue_intro':'Choose the hotel after confirming the fixture and leave enough buffer to reach {venue}.',
    'from_title':'Travel from {market} to {city} for {event}',
    'from_intro':'Build the trip in the right order: ticket first, flights next, hotel around the fixture.',
    'flight':'Compare {origin} → {city} flights','hotel':'Compare {city} hotels','ticket':'Check ticket options',
    'steps':['Secure the ticket','Compare flights','Choose the hotel around the fixture'],
    'events':'Verified match guides','next':'Next step','why':'Why this page?',
    'disclosure':'TrendPilot is an independent guide and may earn a commission from eligible bookings at no extra cost to you.'
},
'de-de': {
    'tickets':'Tickets','guides':'Spielguides','travel':'Reise','hotels':'Hotels',
    'browse':'Ticketoptionen ansehen','open':'Spielguide öffnen','plan':'Reise planen',
    'verified':'Wir veröffentlichen Guides erst nach Prüfung von Termin, Ticketroute und Bildern.',
    'league_title':'{league}: Tickets, Spielguides und Reiseplanung',
    'league_intro':'Finde ausgewählte {league}-Spiele, sichere zuerst das Ticket und plane die Reise danach.',
    'team_title':'{team}: Tickets und Spielreisen',
    'team_intro':'Verifizierte {team}-Guides, Ticketwege und Reiseplanung an einem Ort.',
    'venue_title':'Hotels nahe {venue} + Spieltagsplanung',
    'venue_intro':'Buche das Hotel erst nach Bestätigung des Spieltermins und plane genug Zeit für {venue} ein.',
    'from_title':'Von {market} nach {city} zu {event}',
    'from_intro':'Ticket zuerst, dann Flug und Hotel rund um den Spieltermin planen.',
    'flight':'Flüge {origin} → {city} vergleichen','hotel':'Hotels in {city} vergleichen','ticket':'Ticketoptionen ansehen',
    'steps':['Ticket sichern','Flüge vergleichen','Hotel um das Spiel planen'],
    'events':'Verifizierte Spielguides','next':'Nächster Schritt','why':'Warum diese Seite?',
    'disclosure':'TrendPilot ist ein unabhängiger Guide und kann bei qualifizierten Buchungen eine Provision erhalten.'
},
'fr-fr': {
    'tickets':'Billets','guides':'Guides de match','travel':'Voyage','hotels':'Hôtels',
    'browse':'Voir les billets','open':'Ouvrir le guide','plan':'Organiser le voyage',
    'verified':'Nous publions les guides après vérification de la date, du lien billet et des images.',
    'league_title':'{league} : billets, guides et voyage',
    'league_intro':'Trouvez les grands matchs de {league}, puis sécurisez le billet avant d’organiser le séjour.',
    'team_title':'{team} : billets et week-ends match',
    'team_intro':'Les guides {team} vérifiés, les billets et la planification du voyage au même endroit.',
    'venue_title':'Hôtels près de {venue} + préparation du match',
    'venue_intro':'Choisissez l’hôtel après confirmation du match et gardez une marge pour rejoindre {venue}.',
    'from_title':'Voyager de {market} à {city} pour {event}',
    'from_intro':'Billet d’abord, vols ensuite, puis hôtel autour du match.',
    'flight':'Comparer les vols {origin} → {city}','hotel':'Comparer les hôtels à {city}','ticket':'Voir les billets',
    'steps':['Sécuriser le billet','Comparer les vols','Choisir l’hôtel autour du match'],
    'events':'Guides vérifiés','next':'Étape suivante','why':'Pourquoi cette page ?',
    'disclosure':'TrendPilot est un guide indépendant et peut percevoir une commission sur certaines réservations.'
},
'es-es': {
    'tickets':'Entradas','guides':'Guías de partidos','travel':'Viaje','hotels':'Hoteles',
    'browse':'Ver opciones de entradas','open':'Abrir la guía','plan':'Organizar el viaje',
    'verified':'Publicamos guías solo después de verificar fecha, ruta de entradas e imágenes.',
    'league_title':'{league}: entradas, guías y viaje',
    'league_intro':'Encuentra grandes partidos de {league}, asegura primero la entrada y organiza el viaje después.',
    'team_title':'{team}: entradas y viajes de partido',
    'team_intro':'Guías verificadas de {team}, entradas y planificación del viaje en un solo lugar.',
    'venue_title':'Hoteles cerca de {venue} + plan de partido',
    'venue_intro':'Elige el hotel después de confirmar el partido y deja margen para llegar a {venue}.',
    'from_title':'Viajar de {market} a {city} para {event}',
    'from_intro':'Primero la entrada, después los vuelos y el hotel alrededor del partido.',
    'flight':'Comparar vuelos {origin} → {city}','hotel':'Comparar hoteles en {city}','ticket':'Ver opciones de entradas',
    'steps':['Asegura la entrada','Compara vuelos','Elige hotel alrededor del partido'],
    'events':'Guías verificadas','next':'Siguiente paso','why':'¿Por qué esta página?',
    'disclosure':'TrendPilot es una guía independiente y puede recibir una comisión por reservas válidas.'
}
}

LEAGUES = [
    {'slug':'premier-league','name':'Premier League', 'aliases':['premier league']},
    {'slug':'la-liga','name':'La Liga', 'aliases':['la liga']},
    {'slug':'champions-league','name':'UEFA Champions League', 'aliases':['champions league','uefa champions league']},
    {'slug':'serie-a','name':'Serie A', 'aliases':['serie a']},
    {'slug':'bundesliga','name':'Bundesliga', 'aliases':['bundesliga']},
    {'slug':'ligue-1','name':'Ligue 1', 'aliases':['ligue 1']},
    {'slug':'saudi-pro-league','name':'Saudi Pro League', 'aliases':['saudi pro league']},
]
MARKET_SLUG = {'om':'oman','ae':'uae','sa':'saudi-arabia','qa':'qatar','kw':'kuwait','bh':'bahrain'}

def esc(v):
    return html.escape(str(v or ''), quote=True)

def slugify(v):
    s = re.sub(r'[^a-z0-9]+','-',str(v).lower()).strip('-')
    return s or 'item'

def write(path, content):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding='utf-8')

def image_for(e, role='hero'):
    for x in e.get('images',[]):
        if x.get('role') == role and x.get('url'):
            return x
    return (e.get('images') or [{}])[0]

def lang_nav(base, active, locales=LOCALES):
    parts = []
    for loc in locales:
        href = f'{base}/{loc}/'
        parts.append(f'<a class="{"active" if loc==active else ""}" href="{esc(href)}">{esc(LABEL[loc])}</a>')
    return ''.join(parts)

def alternates(base, locales=LOCALES):
    x=[f'<link rel="alternate" hreflang="x-default" href="{esc(ORIGIN+base+"/")}">']
    for loc in locales:
        x.append(f'<link rel="alternate" hreflang="{HL[loc]}" href="{esc(ORIGIN+base+"/"+loc+"/")}">')
    return ''.join(x)

def page_shell(locale, title, desc, canonical, h1, lead, body, image=None, nav_base=None):
    lang, direction = LANG[locale]
    ogimg = image.get('url') if image else ''
    nav = lang_nav(nav_base, locale) if nav_base else ''
    fig = ''
    if image and image.get('url'):
        hist = ' — historical image' if image.get('historical') else ''
        fig = f'''<figure class="hero-media"><img src="{esc(image.get("url"))}" alt="{esc(h1)}" loading="eager" decoding="async" referrerpolicy="no-referrer"><figcaption>{esc(image.get("credit"))} · {esc(image.get("license"))}{hist}</figcaption></figure>'''
    alt = alternates(nav_base) if nav_base else ''
    og = f'<meta property="og:image" content="{esc(ogimg)}">' if ogimg else ''
    return f'''<!doctype html><html lang="{lang}" dir="{direction}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="robots" content="index,follow,max-image-preview:large"><title>{esc(title)}</title><meta name="description" content="{esc(desc)}"><link rel="canonical" href="{esc(canonical)}">{alt}<meta property="og:type" content="article"><meta property="og:title" content="{esc(h1)}"><meta property="og:description" content="{esc(desc)}"><meta property="og:url" content="{esc(canonical)}">{og}<meta name="twitter:card" content="summary_large_image"><link rel="stylesheet" href="{CSS}"><style>.grid{{display:grid;gap:14px}}.grid.cards{{grid-template-columns:repeat(auto-fit,minmax(240px,1fr))}}.network-card{{display:block;text-decoration:none;color:inherit;padding:18px;border:1px solid rgba(255,255,255,.12);border-radius:18px;background:rgba(255,255,255,.035)}}.network-card strong{{display:block;font-size:1.05rem;margin:7px 0}}.network-card span,.network-card p{{color:#b9c8dc}}@media(max-width:700px){{.grid.cards{{grid-template-columns:1fr}}}}</style></head><body><header class="sitebar"><div class="shell sitebar-inner"><a class="brand" href="/">Trend<span>Pilot</span></a><nav class="languages" aria-label="Language">{nav}</nav></div></header><main class="shell page"><section class="hero card"><div class="hero-copy"><div class="eyebrow">TrendPilot · {esc(UI[locale]['guides'])}</div><h1>{esc(h1)}</h1><p class="lead">{esc(lead)}</p></div>{fig}</section>{body}</main><footer class="footer"><div class="shell">{esc(UI[locale]['disclosure'])}</div></footer></body></html>'''

def event_card(e, locale):
    m = e.get('marketing',{}).get(locale) or e.get('marketing',{}).get('en-gb') or {}
    desc = m.get('lead') or f"{e.get('event_name')} · {e.get('city')}"
    return f'''<a class="network-card" href="/events/{esc(e['slug'])}/{locale}/"><span>{esc(e.get('date'))} · {esc(e.get('city'))}</span><strong>{esc(e.get('event_name'))}</strong><p>{esc(desc)}</p><em>{esc(UI[locale]['open'])} →</em></a>'''

def league_match(e, league):
    comp=(e.get('competition') or '').lower()
    return any(a in comp for a in league['aliases'])

def make_root_from_en(base):
    root=ROOT/base.lstrip('/')/'index.html'
    en=ROOT/base.lstrip('/')/'en-gb'/'index.html'
    root.write_text(en.read_text(encoding='utf-8').replace(f'{ORIGIN}{base}/en-gb/',f'{ORIGIN}{base}/',1),encoding='utf-8')

def build_league_pages(ready):
    urls=[]; count=0
    for league in LEAGUES:
        matched=[e for e in ready if league_match(e,league)]
        base=f'/events/leagues/{league["slug"]}'
        hero=image_for(matched[0]) if matched else None
        for locale in LOCALES:
            ui=UI[locale]
            h1=ui['league_title'].format(league=league['name'])
            lead=ui['league_intro'].format(league=league['name'])
            cards=''.join(event_card(e,locale) for e in matched) or f'<div class="network-card"><strong>{esc(ui["verified"])}</strong><p>{esc(league["name"])}</p></div>'
            q=quote_plus(league['name'])
            body=f'''<section class="card"><span class="kicker">{esc(ui["events"])}</span><div class="grid cards">{cards}</div></section><section class="final card"><span class="kicker">{esc(ui["next"])}</span><h2>{esc(ui["browse"])}</h2><p>{esc(ui["verified"])}</p><a class="btn btn-primary" href="/tickets/?q={q}&type=sports">{esc(ui["browse"])}</a></section>'''
            canonical=f'{ORIGIN}{base}/{locale}/'
            content=page_shell(locale,f'{league["name"]} tickets & guides | TrendPilot',lead,canonical,h1,lead,body,hero,base)
            write(ROOT/base.lstrip('/')/locale/'index.html',content)
            urls.append(canonical); count+=1
        make_root_from_en(base)
        urls.append(f'{ORIGIN}{base}/'); count+=1
    return urls,count

def build_team_pages(ready):
    urls=[]; count=0
    teams={}
    for e in ready:
        for t in (e.get('home'),e.get('away')):
            if t: teams.setdefault(t,[]).append(e)
    for team, events in sorted(teams.items()):
        base=f'/events/teams/{slugify(team)}'
        hero=image_for(events[0])
        for locale in LOCALES:
            ui=UI[locale]
            h1=ui['team_title'].format(team=team)
            lead=ui['team_intro'].format(team=team)
            cards=''.join(event_card(e,locale) for e in events)
            q=quote_plus(team)
            body=f'''<section class="card"><span class="kicker">{esc(ui["events"])}</span><div class="grid cards">{cards}</div></section><section class="final card"><h2>{esc(ui["browse"])}</h2><a class="btn btn-primary" href="/tickets/?q={q}&type=sports">{esc(ui["browse"])}</a></section>'''
            canonical=f'{ORIGIN}{base}/{locale}/'
            write(ROOT/base.lstrip('/')/locale/'index.html',page_shell(locale,f'{team} tickets & guides | TrendPilot',lead,canonical,h1,lead,body,hero,base))
            urls.append(canonical); count+=1
        make_root_from_en(base)
        urls.append(f'{ORIGIN}{base}/'); count+=1
    return urls,count

def build_venue_pages(ready):
    urls=[]; count=0; venues={}
    for e in ready:
        if e.get('venue'): venues.setdefault(e['venue'],[]).append(e)
    for venue, events in sorted(venues.items()):
        e=events[0]
        base=f'/events/venues/{slugify(venue)}-hotels'
        img=image_for(e,'venue') or image_for(e)
        hotel=e.get('travel',{}).get('hotel_url') or f'/tickets/?q={quote_plus(e.get("city",""))}'
        for locale in LOCALES:
            ui=UI[locale]
            h1=ui['venue_title'].format(venue=venue)
            lead=ui['venue_intro'].format(venue=venue)
            cards=''.join(event_card(x,locale) for x in events)
            body=f'''<section class="card"><span class="kicker">{esc(ui["events"])}</span><div class="grid cards">{cards}</div></section><section class="trip card"><span class="kicker">{esc(ui["hotels"])}</span><h2>{esc(ui["hotel"].format(city=e.get("city")))}</h2><p>{esc(ui["verified"])}</p><a class="btn btn-primary" href="{esc(hotel)}" target="_blank" rel="sponsored nofollow noopener">{esc(ui["hotel"].format(city=e.get("city")))}</a></section>'''
            canonical=f'{ORIGIN}{base}/{locale}/'
            write(ROOT/base.lstrip('/')/locale/'index.html',page_shell(locale,f'Hotels near {venue} | TrendPilot',lead,canonical,h1,lead,body,img,base))
            urls.append(canonical); count+=1
        make_root_from_en(base)
        urls.append(f'{ORIGIN}{base}/'); count+=1
    return urls,count

def trip_url(e, origin):
    base=e.get('travel',{}).get('trip_click_base') or ''
    city_slug=slugify(e.get('city'))
    origin_slug=slugify(origin.get('city_en'))
    target=f'https://www.trip.com/flights/{origin_slug}-to-{city_slug}/airfares-{origin.get("code","").lower()}-{e.get("destination_airport","").lower()}/'
    return base + quote_plus(target) if base else target

def build_origin_pages(ready):
    urls=[]; count=0
    for e in ready:
        origins=e.get('travel',{}).get('origins',{})
        for code, origin in origins.items():
            mslug=MARKET_SLUG.get(code,slugify(origin.get('name_ar') or code))
            base=f'/events/{e["slug"]}/from-{mslug}'
            flight=trip_url(e,origin)
            hotel=e.get('travel',{}).get('hotel_url') or '#'
            ticket=e.get('ticket',{}).get('url') or f'/tickets/?q={quote_plus(e.get("event_name",""))}&type=sports'
            hero=image_for(e)
            for locale in ('ar','en-gb'):
                ui=UI[locale]
                market=origin.get('name_ar') if locale=='ar' else origin.get('city_en')
                origin_name=origin.get('city_ar') if locale=='ar' else origin.get('city_en')
                h1=ui['from_title'].format(market=market,city=e.get('city'),event=e.get('event_name'))
                lead=ui['from_intro']
                steps=''.join(f'<div><b>{i}</b><span>{esc(x)}</span></div>' for i,x in enumerate(ui['steps'],1))
                body=f'''<section class="trip card"><span class="kicker">{esc(ui["plan"])}</span><h2>{esc(origin_name)} → {esc(e.get("city"))}</h2><div class="trip-actions"><a class="btn btn-secondary" href="{esc(flight)}" target="_blank" rel="sponsored nofollow noopener">{esc(ui["flight"].format(origin=origin_name,city=e.get("city")))}</a><a class="btn btn-secondary" href="{esc(hotel)}" target="_blank" rel="sponsored nofollow noopener">{esc(ui["hotel"].format(city=e.get("city")))}</a></div><div class="steps">{steps}</div></section><section class="final card"><span class="kicker">{esc(ui["next"])}</span><h2>{esc(ui["ticket"])}</h2><a class="btn btn-primary" href="{esc(ticket)}" target="_blank" rel="sponsored nofollow noopener">{esc(ui["ticket"])}</a></section>'''
                canonical=f'{ORIGIN}{base}/' if locale=='ar' else f'{ORIGIN}{base}/en-gb/'
                content=page_shell(locale,f'{e.get("event_name")} from {market} | TrendPilot',lead,canonical,h1,lead,body,hero,None)
                target=ROOT/base.lstrip('/')/('index.html' if locale=='ar' else 'en-gb/index.html')
                write(target,content)
                urls.append(canonical); count+=1
    return urls,count

def build_index(ready):
    base='/events/discover'
    urls=[]; count=0
    for locale in LOCALES:
        ui=UI[locale]
        league_cards=''.join(f'<a class="network-card" href="/events/leagues/{x["slug"]}/{locale}/"><strong>{esc(x["name"])}</strong><span>{esc(ui["browse"])} →</span></a>' for x in LEAGUES)
        event_cards=''.join(event_card(e,locale) for e in ready[:8])
        h1 = 'اكتشف المباريات التي تستحق أن تبني حولها رحلة.' if locale=='ar' else 'Discover matches worth building a trip around.'
        lead = 'من التذكرة إلى الرحلة والفندق، اجمع قرار المباراة كله في مكان واحد.' if locale=='ar' else 'From ticket choice to flights and hotels, build the match weekend in one place.'
        body=f'''<section class="card"><span class="kicker">{esc(ui["guides"])}</span><div class="grid cards">{event_cards}</div></section><section class="card"><span class="kicker">{esc(ui["tickets"])}</span><div class="grid cards">{league_cards}</div></section>'''
        canonical=f'{ORIGIN}{base}/{locale}/'
        write(ROOT/base.lstrip('/')/locale/'index.html',page_shell(locale,'Football tickets, match guides & travel | TrendPilot',lead,canonical,h1,lead,body,image_for(ready[0]) if ready else None,base))
        urls.append(canonical); count+=1
    make_root_from_en(base)
    urls.append(f'{ORIGIN}{base}/'); count+=1
    return urls,count

def main():
    reg=json.loads(REG.read_text(encoding='utf-8'))
    ready=[e for e in reg.get('events',[]) if e.get('status')=='ready']
    all_urls=[]; counts={}
    for name, fn in [('league_hubs',build_league_pages),('team_hubs',build_team_pages),('venue_hotel_guides',build_venue_pages),('origin_intent_pages',build_origin_pages),('discover_hub',build_index)]:
        urls,n=fn(ready); all_urls.extend(urls); counts[name]=n
    result={
        'generated_at':dt.datetime.now(dt.timezone.utc).isoformat(),
        'version':1,
        'ready_events':len(ready),
        'counts':counts,
        'total_urls':len(sorted(set(all_urls))),
        'urls':sorted(set(all_urls)),
        'guardrail':'Growth pages are generated only from ready Event Factory records. Candidate fixtures remain unpublished until ticket, date and image QA passes.'
    }
    OUT.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(result,ensure_ascii=False,indent=2))

if __name__=='__main__':
    main()
