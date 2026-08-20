#!/usr/bin/env python3
import argparse
import datetime as dt
import html
import json
import pathlib
import re
from urllib.parse import quote, urlencode

ROOT = pathlib.Path(__file__).resolve().parents[1]
REGISTRY = ROOT / 'data/event-factory/events.json'
REPORT = ROOT / 'data/event-factory/build-report.json'
TICKETS = ROOT / 'tickets/index.html'
CSS = '/events/_factory/premium-v1.css?v=1.0.0'
ORIGIN = 'https://trendpilotchoice.com'

UI = {
    'ar': {
        'lang':'ar','dir':'rtl','label':'العربية','date':'الموعد','time':'البداية','venue':'الملعب',
        'why':'لماذا تستحق الرحلة؟','ticket_kicker':'التذكرة أولًا','ticket_exact':'ثبّت المقعد الذي يناسبك قبل أن ترتّب بقية الرحلة.',
        'ticket_comp':'ابدأ بخيارات التذاكر المتاحة ثم ثبّت المباراة قبل الدفع.',
        'cta_exact':'شاهد المقاعد والأسعار','cta_comp':'شاهد خيارات التذاكر','benefits':['الفئات والمقاعد','حماية المشتري','طريقة التسليم'],
        'trip_kicker':'رتّب الرحلة','trip_title':'من الخليج إلى {city} — في خطوات بسيطة.','trip_intro':'اختر بلدك لنعرض لك نقطة الانطلاق المناسبة.',
        'from_where':'من أين ستسافر؟','plan_for':'الخطة المناسبة لـ {market}','hotel':'قارن فنادق {city}','flight':'قارن رحلات {origin} → {city}',
        'steps':['ثبّت التذكرة','صل قبل المباراة بيوم','رتّب الفندق والعودة حول الموعد'],
        'more_kicker':'يمكنك أن تشاهد أيضًا','more_title':'مباريات أخرى تستحق أن تبني حولها رحلة.','more_intro':'إن كنت تبحث عن تجربة كروية كبيرة أخرى، ابدأ من هذه الخيارات.',
        'team_options':'شاهد الخيارات المتاحة →','guide':'شاهد الدليل →','next':'الخطوة التالية','final_exact':'وجدت المقعد والسعر المناسبين؟ ابدأ بالتذكرة.',
        'final_comp':'وجدت خيار التذكرة المناسب؟ أكّد المباراة ثم رتّب الرحلة.','final_body':'ثم رتّب الرحلة والفندق حول موعد المباراة.',
        'faq1':'هل الرابط يفتح المباراة نفسها؟','faq2':'هل يمكن أن يتغير الموعد؟','faq2a':'نعم. أعد التحقق من توقيت المباراة قبل شراء سفر غير قابل للاسترداد.',
        'disclosure':'TrendPilot دليل مستقل وقد يحصل على عمولة من حجوزات مؤهلة دون تكلفة إضافية عليك.',
        'competition_note':'الرابط قد يفتح صفحة أوسع للبطولة لدى البائع. اختر المباراة نفسها وتحقق من التاريخ والمقعد قبل الدفع.',
        'exact_note':'الرابط موجّه إلى الحدث نفسه لدى البائع. قارن الفئة والمقعد وطريقة التسليم قبل الدفع.'
    },
    'en-gb': {
        'lang':'en','dir':'ltr','label':'UK','date':'Date','time':'Kick-off','venue':'Venue',
        'why':'Why make the trip?','ticket_kicker':'Tickets first','ticket_exact':'Secure the seat that suits you before building the rest of the trip.',
        'ticket_comp':'Start with current ticket options, then confirm the exact fixture before paying.',
        'cta_exact':'View seats and prices','cta_comp':'Check ticket options','benefits':['Seat/category','Buyer protection','Delivery method'],
        'trip_kicker':'Plan the trip','trip_title':'Build the trip to {city} in a few simple steps.','trip_intro':'Compare the route, hotel and match timing before locking anything non-refundable.',
        'from_where':'Where are you travelling from?','plan_for':'Travel plan for {market}','hotel':'Compare {city} hotels','flight':'Compare {origin} → {city} flights',
        'steps':['Secure the ticket','Arrive at least a day early','Build hotel and return travel around the fixture'],
        'more_kicker':'You may also like','more_title':'Other matches worth building a trip around.','more_intro':'If you want another big live-sport weekend, start with these.',
        'team_options':'See available options →','guide':'Open the guide →','next':'Next step','final_exact':'Found the right seat and price? Start with the ticket.',
        'final_comp':'Found a ticket option that works? Confirm the fixture before paying.','final_body':'Then build flights and hotel around the match.',
        'faq1':'Does the link open this exact match?','faq2':'Can the fixture time change?','faq2a':'Yes. Recheck the fixture before booking tight or non-refundable travel.',
        'disclosure':'TrendPilot is an independent guide and may earn a commission from eligible bookings at no extra cost to you.',
        'competition_note':'The seller link may open a broader competition listing. Select the exact fixture and confirm the date before paying.',
        'exact_note':'The link is verified to the event itself. Check seat/category, delivery and buyer terms before paying.'
    },
    'de-de': {
        'lang':'de','dir':'ltr','label':'DE','date':'Datum','time':'Anstoß','venue':'Stadion','why':'Warum lohnt sich die Reise?',
        'ticket_kicker':'Zuerst das Ticket','ticket_exact':'Sichere zuerst den passenden Platz und plane die Reise danach.',
        'ticket_comp':'Prüfe zuerst die Ticketoptionen und bestätige vor der Zahlung das genaue Spiel.',
        'cta_exact':'Sitzplätze und Preise ansehen','cta_comp':'Ticketoptionen ansehen','benefits':['Kategorie & Sitzplatz','Käuferschutz','Zustellung'],
        'trip_kicker':'Reise planen','trip_title':'Plane deine Reise nach {city} in wenigen Schritten.','trip_intro':'Stimme Anreise, Hotel und Spieltermin aufeinander ab.',
        'from_where':'Wo startest du?','plan_for':'Reiseplan für {market}','hotel':'Hotels in {city} vergleichen','flight':'Flüge {origin} → {city} vergleichen',
        'steps':['Ticket sichern','Mindestens einen Tag vorher anreisen','Hotel und Rückreise um das Spiel planen'],
        'more_kicker':'Das könnte dir auch gefallen','more_title':'Weitere Spiele, die eine Reise wert sind.','more_intro':'Für dein nächstes großes Fußballwochenende.',
        'team_options':'Verfügbare Optionen →','guide':'Guide öffnen →','next':'Nächster Schritt','final_exact':'Passenden Platz gefunden? Starte mit dem Ticket.',
        'final_comp':'Passende Ticketoption gefunden? Bestätige zuerst das genaue Spiel.','final_body':'Plane danach Hotel und Anreise rund um den Termin.',
        'faq1':'Öffnet der Link genau dieses Spiel?','faq2':'Kann sich die Anstoßzeit ändern?','faq2a':'Ja. Prüfe den Termin vor nicht stornierbaren Reisebuchungen erneut.',
        'disclosure':'TrendPilot ist ein unabhängiger Guide und kann bei qualifizierten Buchungen eine Provision erhalten — ohne Mehrkosten für dich.',
        'competition_note':'Der Link kann zu einer allgemeinen Wettbewerbsseite führen. Wähle das genaue Spiel und prüfe Datum und Sitzplatz vor der Zahlung.',
        'exact_note':'Der Link ist für das konkrete Event verifiziert. Prüfe Sitzplatz, Zustellung und Käuferschutz vor der Zahlung.'
    },
    'fr-fr': {
        'lang':'fr','dir':'ltr','label':'FR','date':'Date','time':'Coup d’envoi','venue':'Stade','why':'Pourquoi faire le voyage ?',
        'ticket_kicker':'Le billet d’abord','ticket_exact':'Choisissez d’abord la bonne place, puis construisez le reste du séjour autour du match.',
        'ticket_comp':'Commencez par les options de billets et confirmez le match exact avant de payer.',
        'cta_exact':'Voir les places et les prix','cta_comp':'Voir les options de billets','benefits':['Catégorie et place','Protection acheteur','Mode de livraison'],
        'trip_kicker':'Organiser le voyage','trip_title':'Préparez votre séjour à {city} en quelques étapes.','trip_intro':'Alignez le transport, l’hôtel et l’horaire du match avant les réservations non remboursables.',
        'from_where':'D’où partez-vous ?','plan_for':'Plan de voyage pour {market}','hotel':'Comparer les hôtels à {city}','flight':'Comparer les vols {origin} → {city}',
        'steps':['Sécuriser le billet','Arriver au moins la veille','Organiser hôtel et retour autour du match'],
        'more_kicker':'Vous aimerez peut-être aussi','more_title':'D’autres grands matchs qui valent le voyage.','more_intro':'Pour une autre grande expérience de football en direct.',
        'team_options':'Voir les options →','guide':'Ouvrir le guide →','next':'Étape suivante','final_exact':'Vous avez trouvé la bonne place ? Commencez par le billet.',
        'final_comp':'Vous avez trouvé une option ? Confirmez le match exact avant de payer.','final_body':'Organisez ensuite transport et hôtel autour du match.',
        'faq1':'Le lien ouvre-t-il exactement ce match ?','faq2':'L’horaire peut-il changer ?','faq2a':'Oui. Vérifiez de nouveau avant de réserver un voyage non remboursable.',
        'disclosure':'TrendPilot est un guide indépendant et peut percevoir une commission sur certaines réservations, sans coût supplémentaire pour vous.',
        'competition_note':'Le lien vendeur peut ouvrir une page plus large de la compétition. Sélectionnez le match exact et vérifiez la date avant de payer.',
        'exact_note':'Le lien est vérifié pour cet événement. Vérifiez la place, la livraison et les conditions acheteur avant de payer.'
    },
    'es-es': {
        'lang':'es','dir':'ltr','label':'ES','date':'Fecha','time':'Hora','venue':'Estadio','why':'¿Por qué merece el viaje?',
        'ticket_kicker':'Primero la entrada','ticket_exact':'Asegura primero el asiento adecuado y organiza el resto del viaje alrededor del partido.',
        'ticket_comp':'Empieza por las opciones de entradas y confirma el partido exacto antes de pagar.',
        'cta_exact':'Ver asientos y precios','cta_comp':'Ver opciones de entradas','benefits':['Categoría y asiento','Protección del comprador','Entrega'],
        'trip_kicker':'Organiza el viaje','trip_title':'Prepara tu viaje a {city} en pocos pasos.','trip_intro':'Coordina transporte, hotel y horario antes de reservar opciones no reembolsables.',
        'from_where':'¿Desde dónde viajas?','plan_for':'Plan de viaje para {market}','hotel':'Comparar hoteles en {city}','flight':'Comparar vuelos {origin} → {city}',
        'steps':['Asegura la entrada','Llega al menos un día antes','Organiza hotel y vuelta alrededor del partido'],
        'more_kicker':'También te puede gustar','more_title':'Otros grandes partidos que merecen un viaje.','more_intro':'Si buscas otra gran experiencia de fútbol en directo, empieza aquí.',
        'team_options':'Ver opciones disponibles →','guide':'Abrir la guía →','next':'Siguiente paso','final_exact':'¿Encontraste el asiento adecuado? Empieza por la entrada.',
        'final_comp':'¿Encontraste una opción? Confirma el partido exacto antes de pagar.','final_body':'Después organiza vuelo y hotel alrededor del encuentro.',
        'faq1':'¿El enlace abre este partido exacto?','faq2':'¿Puede cambiar el horario?','faq2a':'Sí. Comprueba de nuevo antes de reservar un viaje no reembolsable.',
        'disclosure':'TrendPilot es una guía independiente y puede recibir una comisión por reservas válidas, sin coste adicional para ti.',
        'competition_note':'El enlace del vendedor puede abrir una página general de la competición. Elige el partido exacto y verifica la fecha antes de pagar.',
        'exact_note':'El enlace está verificado para el evento. Comprueba asiento, entrega y protección del comprador antes de pagar.'
    }
}

MONTHS_AR = {1:'يناير',2:'فبراير',3:'مارس',4:'أبريل',5:'مايو',6:'يونيو',7:'يوليو',8:'أغسطس',9:'سبتمبر',10:'أكتوبر',11:'نوفمبر',12:'ديسمبر'}
MONTHS = {'en-gb':['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
          'de-de':['','Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'],
          'fr-fr':['','janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'],
          'es-es':['','ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']}


def esc(v): return html.escape(str(v or ''), quote=True)

def date_label(value, locale):
    d=dt.date.fromisoformat(value)
    if locale=='ar': return f'{d.day} {MONTHS_AR[d.month]} {d.year}'
    return f'{d.day} {MONTHS[locale][d.month]} {d.year}'

def ticket_copy(event, ui):
    exact=event['ticket']['mode']=='exact' and event['ticket'].get('verified')
    return {
        'exact':exact,
        'title':ui['ticket_exact'] if exact else ui['ticket_comp'],
        'cta':ui['cta_exact'] if exact else ui['cta_comp'],
        'note':ui['exact_note'] if exact else ui['competition_note']
    }

def market_options(event, locale):
    origins=event.get('travel',{}).get('origins',{})
    if locale=='ar':
        return ''.join(f'<option value="{esc(k)}">{esc(v.get("name_ar") or v.get("city_ar"))}</option>' for k,v in origins.items())
    return ''.join(f'<option value="{esc(k)}">{esc(v.get("city_en"))}</option>' for k,v in origins.items())

def image_html(image, css_class, alt):
    fallbacks='|'.join(image.get('fallbacks') or [])
    hist=' — historical image' if image.get('historical') else ''
    caption=f"{image.get('credit','')} · {image.get('license','')}{hist}"
    return f'''<figure class="{css_class}"><img src="{esc(image['url'])}" data-fallbacks="{esc(fallbacks)}" alt="{esc(alt)}" loading="{'eager' if css_class=='hero-media' else 'lazy'}" decoding="async" {'fetchpriority="high"' if css_class=='hero-media' else ''} referrerpolicy="no-referrer" onerror="tpImageFallback(this)"><figcaption>{esc(caption)}</figcaption></figure>'''

def locale_marketing(event, locale):
    custom=(event.get('marketing') or {}).get(locale) or {}
    home=event['home']; away=event['away']; venue=event['venue']; city=event['city']
    if custom: return custom
    if locale=='de-de':
        return {'hero':f'{home} gegen {away} live — ein Fußballwochenende statt nur 90 Minuten.', 'lead':f'{home} vs {away} in {venue}. Sichere das Ticket zuerst und plane {city} danach.', 'experience_title':f'{city} lebt dieses Spiel — und du kannst mittendrin sein.', 'experience_body':'Die Atmosphäre beginnt lange vor dem Anpfiff: Anreise, Stadion, Fans und die Spannung eines großen Spiels.'}
    if locale=='fr-fr':
        return {'hero':f'{home} contre {away} en tribune — bien plus que 90 minutes.', 'lead':f'{home} vs {away} à {venue}. Commencez par le billet, puis construisez le séjour à {city}.', 'experience_title':f'{city} vit le match — et vous pouvez être au cœur de l’ambiance.', 'experience_body':'L’expérience commence avant le coup d’envoi : arrivée au stade, supporters, tension et grands moments du match.'}
    if locale=='es-es':
        return {'hero':f'{home} contra {away} desde la grada — mucho más que 90 minutos.', 'lead':f'{home} vs {away} en {venue}. Empieza por la entrada y organiza después tu estancia en {city}.', 'experience_title':f'{city} vive el partido — y tú puedes estar dentro del ambiente.', 'experience_body':'La experiencia empieza mucho antes del pitido inicial: llegada al estadio, afición, tensión y cada gran momento del partido.'}
    return {'hero':f'{home} vs {away} from the stands — build a match weekend around it.', 'lead':f'Start with the ticket route for {home} vs {away} at {venue}, then build the {city} trip around the fixture.', 'experience_title':f'{city} lives the match — and you can be inside the atmosphere.', 'experience_body':'The experience starts before kick-off: the route to the stadium, the crowd, the tension and the moments that make live sport worth the trip.'}

def languages_nav(slug, locale, available):
    labels={'ar':'العربية','en-gb':'UK','de-de':'DE','fr-fr':'FR','es-es':'ES'}
    return ''.join(f'<a class="{"active" if x==locale else ""}" href="/events/{slug}/{x}/">{labels[x]}</a>' for x in available)

def cross_sell(event, locale, ready_events, ui):
    cards=[]
    for other in ready_events:
        if other['slug']==event['slug']: continue
        href=f"/events/{other['slug']}/{locale}/"
        cards.append(f'<a class="recommend featured" href="{href}"><span>{esc(date_label(other["date"],locale))} · {esc(other["city"])}</span><strong>{esc(other["event_name"])}</strong><em>{esc(ui["guide"])}</em></a>')
        if len(cards)>=1: break
    for team in (event['home'],event['away']):
        cards.append(f'<a class="recommend" href="/tickets/?{urlencode({"q":team,"type":"sports"})}"><span>{esc(ui["more_kicker"])}</span><strong>{esc(team)}</strong><em>{esc(ui["team_options"])}</em></a>')
    return ''.join(cards[:3])

def route_js(event, locale):
    origins=event.get('travel',{}).get('origins',{})
    base=event.get('travel',{}).get('trip_click_base','')
    dest=event.get('destination_airport','')
    city=event['city']
    data={}
    for k,v in origins.items():
        origin=v.get('city_ar') if locale=='ar' else v.get('city_en')
        route=f"https://www.trip.com/flights/{v.get('city_en','').lower().replace(' ','-')}-to-{city.lower().replace(' ','-')}/airfares-{v.get('code','').lower()}-{dest.lower()}/"
        data[k]={'market':v.get('name_ar') if locale=='ar' else v.get('city_en'),'origin':origin,'url':base+quote(route,safe='')}
    return json.dumps(data,ensure_ascii=False)

def render_page(event, locale, ready_events, canonical_path):
    ui=UI[locale]; m=locale_marketing(event,locale); tc=ticket_copy(event,ui)
    images=event['images']; hero=next(x for x in images if x['role']=='hero'); venue=next(x for x in images if x['role']=='venue')
    date=date_label(event['date'],locale); time=event.get('time') or ('يحدد لاحقًا' if locale=='ar' else 'TBA')
    canonical=f'{ORIGIN}{canonical_path}'
    alternates=''.join(f'<link rel="alternate" hreflang="{UI[l]["lang"] if l=="ar" else l}" href="{ORIGIN}/events/{event["slug"]}/{l}/">' for l in UI)
    competition=event['competition']; city=event['city']; venue_name=event['venue']; exact=tc['exact']
    faq_a=(ui['exact_note'] if exact else ui['competition_note'])
    schema={"@context":"https://schema.org","@type":"SportsEvent","name":event['event_name'],"startDate":event['date']+(f'T{event["time"]}:00' if event.get('time') else ''),"eventStatus":"https://schema.org/EventScheduled","eventAttendanceMode":"https://schema.org/OfflineEventAttendanceMode","location":{"@type":"Place","name":venue_name,"address":{"@type":"PostalAddress","addressLocality":city,"addressCountry":event['country']}},"homeTeam":{"@type":"SportsTeam","name":event['home']},"awayTeam":{"@type":"SportsTeam","name":event['away']},"url":canonical}
    flight_label=ui['flight'].format(origin='{origin}',city=city)
    trip_title=ui['trip_title'].format(city=city)
    more=cross_sell(event,locale,ready_events,ui)
    ticket_url=event['ticket']['url']; hotel_url=event['travel']['hotel_url']
    image_alt=f"{event['event_name']} — {city}"
    return f'''<!doctype html><html lang="{ui['lang']}" dir="{ui['dir']}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="robots" content="index,follow,max-image-preview:large"><meta name="theme-color" content="#06101c"><title>{esc(event['event_name'])} {esc(date)} — Tickets & Travel | TrendPilot</title><meta name="description" content="{esc(m['lead'])}"><link rel="canonical" href="{canonical}">{alternates}<meta property="og:type" content="article"><meta property="og:title" content="{esc(m['hero'])}"><meta property="og:description" content="{esc(m['lead'])}"><meta property="og:url" content="{canonical}"><meta property="og:image" content="{esc(hero['url'])}"><meta name="twitter:card" content="summary_large_image"><link rel="preconnect" href="https://upload.wikimedia.org" crossorigin><link rel="stylesheet" href="{CSS}"><script>window.tpImageFallback=function(img){{const a=(img.dataset.fallbacks||'').split('|').filter(Boolean),i=Number(img.dataset.fallbackIndex||0);if(i<a.length){{img.dataset.fallbackIndex=String(i+1);img.src=a[i];return}}img.onerror=null;img.closest('figure').hidden=true}};</script><script type="application/ld+json">{json.dumps(schema,ensure_ascii=False)}</script></head><body><header class="sitebar"><div class="shell sitebar-inner"><a class="brand" href="/">Trend<span>Pilot</span></a><nav class="languages" aria-label="Language">{languages_nav(event['slug'],locale,list(UI))}</nav></div></header><main class="shell page"><section class="hero card"><div class="hero-copy"><div class="eyebrow">{esc(competition)} · {esc(venue_name)} · {esc(date)}</div><h1>{esc(m['hero'])}</h1><p class="lead">{esc(m['lead'])}</p><a class="btn btn-primary" href="{esc(ticket_url)}" target="_blank" rel="sponsored nofollow noopener">{esc(tc['cta'])}</a><div class="trust"><span>✓ {esc(tc['note'])}</span><span>✓ {esc(event['ticket']['seller'])}</span><span>✓ TrendPilot</span></div></div>{image_html(hero,'hero-media',image_alt)}<div class="facts"><div><span>{esc(ui['date'])}</span><strong>{esc(date)}</strong></div><div><span>{esc(ui['time'])}</span><strong>{esc(time)}</strong></div><div><span>{esc(ui['venue'])}</span><strong>{esc(venue_name)}</strong></div></div></section><section class="experience card"><div class="section-copy"><span class="kicker">{esc(ui['why'])}</span><h2>{esc(m['experience_title'])}</h2><p>{esc(m['experience_body'])}</p><div class="pills"><span>{esc(competition)}</span><span>{esc(venue_name)}</span><span>{esc(city)}</span></div></div>{image_html(venue,'venue-media',venue_name)}</section><section class="ticket card"><span class="kicker">{esc(ui['ticket_kicker'])}</span><h2>{esc(tc['title'])}</h2><p>{esc(tc['note'])}</p><div class="benefits"><div>🎟️ <strong>{esc(ui['benefits'][0])}</strong></div><div>🛡️ <strong>{esc(ui['benefits'][1])}</strong></div><div>📱 <strong>{esc(ui['benefits'][2])}</strong></div></div><a class="btn btn-primary" href="{esc(ticket_url)}" target="_blank" rel="sponsored nofollow noopener">{esc(tc['cta'])}</a><p class="fineprint">{esc(ui['competition_note'] if not exact else ui['exact_note'])}</p></section><section class="trip card"><span class="kicker">{esc(ui['trip_kicker'])}</span><h2>{esc(trip_title)}</h2><p>{esc(ui['trip_intro'])}</p><div class="select-row"><label for="market">{esc(ui['from_where'])}</label><select id="market">{market_options(event,locale)}</select></div><div class="route-box"><strong id="plan-title"></strong><span id="plan-copy"></span></div><div class="trip-actions"><a id="flight-link" class="btn btn-secondary" href="#" target="_blank" rel="sponsored nofollow noopener"></a><a class="btn btn-secondary" href="{esc(hotel_url)}" target="_blank" rel="sponsored nofollow noopener">{esc(ui['hotel'].format(city=city))}</a></div><div class="steps">{''.join(f'<div><b>{i+1}</b><span>{esc(x)}</span></div>' for i,x in enumerate(ui['steps']))}</div></section><section class="more card"><span class="kicker">{esc(ui['more_kicker'])}</span><h2>{esc(ui['more_title'])}</h2><p>{esc(ui['more_intro'])}</p><div class="recommend-grid">{more}</div></section><section class="final card"><span class="kicker">{esc(ui['next'])}</span><h2>{esc(ui['final_exact'] if exact else ui['final_comp'])}</h2><p>{esc(ui['final_body'])}</p><a class="btn btn-primary" href="{esc(ticket_url)}" target="_blank" rel="sponsored nofollow noopener">{esc(tc['cta'])}</a><div class="faq-row"><details><summary>{esc(ui['faq1'])}</summary><p>{esc(faq_a)}</p></details><details><summary>{esc(ui['faq2'])}</summary><p>{esc(ui['faq2a'])}</p></details></div></section></main><div class="sticky-buy"><a class="btn btn-primary" href="{esc(ticket_url)}" target="_blank" rel="sponsored nofollow noopener">{esc(tc['cta'])}</a></div><footer class="footer"><div class="shell">{esc(ui['disclosure'])}</div></footer><script>(()=>{{const d={route_js(event,locale)},s=document.getElementById('market'),a=document.getElementById('flight-link'),t=document.getElementById('plan-title'),p=document.getElementById('plan-copy');function r(){{const x=d[s.value]||Object.values(d)[0];if(!x)return;t.textContent={json.dumps(ui['plan_for'],ensure_ascii=False)}.replace('{{market}}',x.market);p.textContent={json.dumps(ui['trip_intro'],ensure_ascii=False)};a.href=x.url;a.textContent={json.dumps(flight_label,ensure_ascii=False)}.replace('{{origin}}',x.origin)}}s.addEventListener('change',r);r()}})();</script></body></html>'''

def render_root(event):
    locale='en-gb'; page=render_page(event,locale,READY,f'/events/{event["slug"]}/')
    # Root is the x-default/global page. Language links point to dedicated pages; JS only suggests, never forces.
    insert=f'''<div id="locale-suggest" hidden style="position:fixed;left:12px;right:12px;bottom:74px;z-index:45;background:#102039;border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:10px;text-align:center"><a href="#" style="color:#fff;font-weight:800;text-decoration:none"></a></div><script>(()=>{{const base='/events/{event['slug']}',tz=Intl.DateTimeFormat().resolvedOptions().timeZone||'',lang=(navigator.language||'en').toLowerCase(),m={{'Asia/Muscat':'ar','Asia/Dubai':'ar','Asia/Riyadh':'ar','Asia/Qatar':'ar','Asia/Kuwait':'ar','Asia/Bahrain':'ar','Europe/Berlin':'de-de','Europe/Paris':'fr-fr','Europe/Madrid':'es-es','Europe/London':'en-gb'}},l={{ar:'ar',de:'de-de',fr:'fr-fr',es:'es-es',en:'en-gb'}},x=m[tz]||l[lang.split('-')[0]];if(x&&x!='en-gb'){{const b=document.getElementById('locale-suggest'),a=b.querySelector('a');a.href=base+'/'+x+'/';a.textContent=x=='ar'?'فتح النسخة العربية':'Open local version';b.hidden=false}}}})();</script>'''
    return page.replace('</body>',insert+'</body>')

def distribution_pack(event):
    base=f'{ORIGIN}/events/{event["slug"]}/'
    def tracked(source,medium='social',campaign='event'):
        return base+'?'+urlencode({'utm_source':source,'utm_medium':medium,'utm_campaign':f'{event["slug"]}-{campaign}'})
    return {
        'slug':event['slug'],'event':event['event_name'],'date':event['date'],'tier':event['tier'],
        'pinterest':[{'title':f'{event["event_name"]}: tickets + {event["city"]} match-weekend guide','url':tracked('pinterest','social','pin-guide')},{'title':f'How to plan a trip for {event["event_name"]}','url':tracked('pinterest','social','pin-travel')},{'title':f'{event["venue"]} matchday: what to book first','url':tracked('pinterest','social','pin-venue')}],
        'youtube_short':{'hook':f'Would you travel to see {event["event_name"]} live? Start with the seat — then build the trip.','url':tracked('youtube','video','short')},
        'tiktok_reel':{'hook':f'{event["event_name"]} live in {event["city"]}: ticket first, hotel second, travel around the fixture.','url':tracked('tiktok','video','reel')},
        'facebook':{'copy':f'Planning {event["event_name"]}? We put tickets, match timing, hotel and travel planning in one guide.','url':tracked('facebook')},
        'x':{'copy':f'{event["event_name"]} — ticket route, venue and travel plan in one page.','url':tracked('x')},
        'reddit_quora_angle':f'Practical match-weekend planning for {event["event_name"]}: when to secure tickets, where to stay and how much schedule buffer to leave.',
        'email_subject':f'{event["event_name"]}: build the trip around the match, not the other way around'
    }

def update_ticket_hub(ready):
    if not TICKETS.exists(): return False
    text=TICKETS.read_text()
    cards=[]
    for e in ready:
        time=' · kick-off TBA' if not e.get('time') else ''
        cards.append(f'<a href="/events/{e["slug"]}/" style="display:block;text-decoration:none;color:inherit"><div class="tp-ticket-v141-feature" style="height:100%"><span>{esc(e["date"])} · {esc(e["city"])}{time}</span><h2>{esc(e["event_name"])}</h2><p>Tickets, venue, hotel and travel planning in one match-weekend guide.</p><strong>Open the guide →</strong></div></a>')
    block='<!-- EVENT_FACTORY_START --><section aria-labelledby="featured-trips"><div class="tp-shell"><h2 id="featured-trips" style="margin:0 0 14px">Featured match-weekend guides</h2><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px;margin-bottom:22px">'+''.join(cards)+'</div></div></section><!-- EVENT_FACTORY_END -->'
    if '<!-- EVENT_FACTORY_START -->' in text:
        new=re.sub(r'<!-- EVENT_FACTORY_START -->.*?<!-- EVENT_FACTORY_END -->',block,text,flags=re.S)
    else:
        new=re.sub(r'<section aria-labelledby="featured-trips">.*?</section>',block,text,count=1,flags=re.S)
    if new!=text:
        TICKETS.write_text(new)
        return True
    return False

def validate(event, policy):
    errors=[]
    if not event.get('date'): errors.append('missing date')
    if not event.get('ticket',{}).get('url') or not event.get('ticket',{}).get('verified'): errors.append('ticket route not verified')
    if not event.get('travel',{}).get('hotel_url'): errors.append('missing hotel route')
    if len(event.get('images') or [])<2: errors.append('needs two images')
    roles={x.get('role') for x in event.get('images') or []}
    if not {'hero','venue'}.issubset(roles): errors.append('hero/venue images required')
    if event.get('tier')=='A' and policy.get('tier_a_requires_custom_copy'):
        for loc in ('ar','en-gb'):
            if not (event.get('marketing') or {}).get(loc): errors.append(f'missing tier-A custom copy: {loc}')
    if event.get('ticket',{}).get('mode')=='exact' and not event.get('ticket',{}).get('verified'): errors.append('unverified exact ticket claim')
    return errors

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--force',action='store_true'); args=ap.parse_args()
    registry=json.loads(REGISTRY.read_text())
    policy=registry.get('publish_policy',{})
    global READY
    READY=[e for e in registry.get('events',[]) if e.get('status') in policy.get('auto_publish_statuses',['ready'])]
    result={'generated_at':dt.datetime.now(dt.timezone.utc).isoformat(),'version':registry.get('version'),'published':[],'skipped':[],'candidate_queue':registry.get('candidate_queue',[]),'ticket_hub_updated':False}
    for e in READY:
        errors=validate(e,policy)
        if errors:
            result['skipped'].append({'slug':e.get('slug'),'errors':errors}); continue
        base=ROOT/'events'/e['slug']; base.mkdir(parents=True,exist_ok=True)
        created=[]
        # Preserve hand-polished pages unless --force. New events are generated in every locale automatically.
        for loc in registry.get('default_locales',list(UI)):
            out=base/loc/'index.html'
            if out.exists() and not args.force: continue
            out.parent.mkdir(parents=True,exist_ok=True)
            out.write_text(render_page(e,loc,READY,f'/events/{e["slug"]}/{loc}/'))
            created.append(str(out.relative_to(ROOT)))
        root=base/'index.html'
        if not root.exists() or args.force:
            root.write_text(render_root(e)); created.append(str(root.relative_to(ROOT)))
        (base/'distribution.json').write_text(json.dumps(distribution_pack(e),ensure_ascii=False,indent=2)+'\n')
        (base/'factory-manifest.json').write_text(json.dumps({'factory_version':registry.get('version'),'slug':e['slug'],'tier':e['tier'],'locales':registry.get('default_locales'),'ticket_mode':e['ticket']['mode'],'ticket_verified':e['ticket']['verified'],'images':len(e['images'])},ensure_ascii=False,indent=2)+'\n')
        result['published'].append({'slug':e['slug'],'created':created,'distribution':f'events/{e["slug"]}/distribution.json'})
    result['ticket_hub_updated']=update_ticket_hub([e for e in READY if not validate(e,policy)])
    REPORT.parent.mkdir(parents=True,exist_ok=True); REPORT.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(result,ensure_ascii=False,indent=2))
    if result['skipped']:
        raise SystemExit('Event Factory validation failed for one or more ready events.')

if __name__=='__main__': main()
