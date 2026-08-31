from pathlib import Path
import re


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    s = p.read_text(encoding='utf-8')
    n = s.count(old)
    if n != 1:
        raise SystemExit(f'Fail closed: {path}: expected exactly 1 occurrence, got {n}: {old[:100]!r}')
    p.write_text(s.replace(old, new), encoding='utf-8')
    print('patched', path)


# Exact seller destinations for Dutch paid El Clasico traffic.
nl = 'events/el-clasico-2026/nl-nl/index.html'
replace_once(nl,
             'https://seatpick.com/ar/entradas-fc-barcelona-vs-real-madrid',
             'https://seatpick.com/fc-barcelona-vs-real-madrid-camp-nou-stadium-tickets/event/510975')
replace_once(nl,
             'https://www.fanpass.es/real-madrid-entradas/',
             'https://www.fanpass.es/entradas-fc-barcelona-vs-real-madrid')

# Dutch modal + server-side tracking for the no-email seller path.
js = 'events/manchester-derby-2026/save-search.js'
p = Path(js)
s = p.read_text(encoding='utf-8')
old = "quick:'✓ يستغرق 5 ثوانٍ'}};"
new = "quick:'✓ يستغرق 5 ثوانٍ'},nl:{title:p=>`Bewaar deze ticketdeal${p?` · ${p}`:''}`,body:'We mailen deze aanbieding zodat je er later makkelijk naar terug kunt.',email:'Vul je e-mailadres in',save:'Ontvang aanbod →',skip:'Doorgaan zonder e-mail',updates:'Waarschuw me als de prijs verandert',required:'Verplicht',sending:'Aanbieding openen…',error:'Opslaan lukt nu niet. Je kunt nog steeds doorgaan naar de aanbieder.',needAlert:'Selecteer de prijswaarschuwing om door te gaan.',privacy:'Geen spam. Afmelden kan altijd.',quick:'✓ Duurt 5 seconden'}};"
if s.count(old) != 1:
    raise SystemExit('Fail closed: save-search cfg marker changed')
s = s.replace(old, new)
old = "const GO='https://api.trendpilotchoice.com/go.php?lead=';"
new = "const GO='https://api.trendpilotchoice.com/go.php?lead=';\nconst OUTBOUND='https://api.trendpilotchoice.com/seller-outbound.php';"
if s.count(old) != 1:
    raise SystemExit('Fail closed: GO marker changed')
s = s.replace(old, new)
old = "const lang=document.documentElement.lang&&document.documentElement.lang.startsWith('ar')?'ar':'en',t=cfg[lang];let pending=null;"
new = "const docLang=(document.documentElement.lang||'en').toLowerCase();const lang=docLang.startsWith('ar')?'ar':docLang.startsWith('nl')?'nl':'en',t=cfg[lang];let pending=null;"
if s.count(old) != 1:
    raise SystemExit('Fail closed: language selector marker changed')
s = s.replace(old, new)
old = "function go(){if(!pending)return;const href=pending.href;pending=null;window.open(href,'_blank','noopener')}"
new = "function makeEventId(){const b=new Uint8Array(8);crypto.getRandomValues(b);return[...b].map(x=>x.toString(16).padStart(2,'0')).join('')}\nfunction trackSellerOutbound(link){try{const {seller,price}=meta(link),payload={event_id:makeEventId(),seller,price,offer_url:link.href,page_url:location.href,tracking:params()},body=JSON.stringify(payload);fire('SELLER_OUTBOUND',{seller,price});if(navigator.sendBeacon){const blob=new Blob([body],{type:'text/plain;charset=UTF-8'});if(navigator.sendBeacon(OUTBOUND,blob))return}fetch(OUTBOUND,{method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8','Accept':'application/json'},body,keepalive:true}).catch(()=>{})}catch(_){}}\nfunction go(){if(!pending)return;const link=pending,href=link.href;trackSellerOutbound(link);pending=null;window.open(href,'_blank','noopener')}"
if s.count(old) != 1:
    raise SystemExit('Fail closed: go marker changed')
s = s.replace(old, new)
old = 'aria-label="Close">×</button>'
new = 'aria-label="${lang===\'nl\'?\'Sluiten\':lang===\'ar\'?\'إغلاق\':\'Close\'}">×</button>'
if s.count(old) != 1:
    raise SystemExit('Fail closed: close-label marker changed')
s = s.replace(old, new)
p.write_text(s, encoding='utf-8')
print('patched', js)

# Dutch email language for all six paid match funnels.
php = 'api/save-search.php'
p = Path(php)
s = p.read_text(encoding='utf-8')
old = "function campaign_spec(string $id,string $lang):array{$ar=$lang==='ar';$s=["
new = "function campaign_spec(string $id,string $lang):array{$ar=$lang==='ar';$nl=$lang==='nl';$s=["
if s.count(old) != 1:
    raise SystemExit('Fail closed: campaign_spec start changed')
s = s.replace(old, new)
old = ";return $s[$id]??$s['generic_offer'];}\nfunction render_email"
nl_specs = """;$out=$s[$id]??$s['generic_offer'];if($nl){$n=[
'manchester_derby_2026'=>['return_base'=>'https://trendpilotchoice.com/events/manchester-derby-2026/nl-nl/','badge'=>'TICKETALERT • MANCHESTER DERBY','subject'=>'Je Manchester Derby-aanbod is opgeslagen','headline'=>'Je ticketaanbod is opgeslagen','intro'=>'We hebben deze aanbieding bewaard zodat je prijs en stoelen snel opnieuw kunt bekijken.','cta'=>'Bekijk prijs en stoelen →','buy_cta'=>'Bekijk beschikbare stoelen →','point1'=>'Wedstrijd: Manchester United vs Manchester City','point2'=>'Old Trafford • 13 september 2026','point3'=>'Controleer altijd de definitieve prijs en stoelvoorwaarden bij de aanbieder'],
'el_clasico_2026'=>['return_base'=>'https://trendpilotchoice.com/events/el-clasico-2026/nl-nl/','badge'=>'TICKETALERT • EL CLÁSICO','subject'=>'Je El Clásico-aanbod is opgeslagen','headline'=>'Je El Clásico-aanbod is opgeslagen','intro'=>'We hebben deze aanbieding bewaard zodat je prijs en stoelen snel opnieuw kunt bekijken.','cta'=>'Bekijk prijs en stoelen →','buy_cta'=>'Bekijk beschikbare stoelen →','point1'=>'Wedstrijd: FC Barcelona vs Real Madrid','point2'=>'Spotify Camp Nou • 25 oktober 2026 • aftrap nog te bevestigen','point3'=>'Controleer altijd de definitieve prijs en stoelvoorwaarden bij de aanbieder'],
'liverpool_manunited_2026'=>['return_base'=>'https://trendpilotchoice.com/events/liverpool-v-manchester-united-2026/nl-nl/','badge'=>'TICKETALERT • LIVERPOOL–MAN UNITED','subject'=>'Je ticketaanbod is opgeslagen','headline'=>'Je ticketaanbod is opgeslagen','intro'=>'We hebben deze aanbieding bewaard zodat je snel kunt terugkeren.','cta'=>'Bekijk prijs en stoelen →','buy_cta'=>'Bekijk beschikbare stoelen →','point1'=>'Wedstrijd: Liverpool vs Manchester United','point2'=>'Anfield • 21 november 2026','point3'=>'Controleer stoel en eindtotaal vóór betaling'],
'madrid_derby_2026'=>['return_base'=>'https://trendpilotchoice.com/events/madrid-derby-2026/nl-nl/','badge'=>'TICKETALERT • MADRID DERBY','subject'=>'Je ticketaanbod is opgeslagen','headline'=>'Je ticketaanbod is opgeslagen','intro'=>'We hebben deze aanbieding bewaard zodat je snel kunt terugkeren.','cta'=>'Bekijk prijs en stoelen →','buy_cta'=>'Bekijk beschikbare stoelen →','point1'=>'Wedstrijd: Atlético Madrid vs Real Madrid','point2'=>'Riyadh Air Metropolitano • 20 september 2026','point3'=>'Controleer stoel en eindtotaal vóór betaling'],
'north_london_derby_2026'=>['return_base'=>'https://trendpilotchoice.com/events/north-london-derby-2026/nl-nl/','badge'=>'TICKETALERT • NORTH LONDON DERBY','subject'=>'Je ticketaanbod is opgeslagen','headline'=>'Je ticketaanbod is opgeslagen','intro'=>'We hebben deze aanbieding bewaard zodat je snel kunt terugkeren.','cta'=>'Bekijk prijs en stoelen →','buy_cta'=>'Bekijk beschikbare stoelen →','point1'=>'Wedstrijd: Tottenham Hotspur vs Arsenal','point2'=>'Tottenham Hotspur Stadium • 5 december 2026','point3'=>'Controleer stoel en eindtotaal vóór betaling'],
'arsenal_mancity_2026'=>['return_base'=>'https://trendpilotchoice.com/events/arsenal-v-manchester-city-2026/nl-nl/','badge'=>'TICKETALERT • ARSENAL–MAN CITY','subject'=>'Je ticketaanbod is opgeslagen','headline'=>'Je ticketaanbod is opgeslagen','intro'=>'We hebben deze aanbieding bewaard zodat je snel kunt terugkeren.','cta'=>'Bekijk prijs en stoelen →','buy_cta'=>'Bekijk beschikbare stoelen →','point1'=>'Wedstrijd: Arsenal vs Manchester City','point2'=>'Emirates Stadium • 28 november 2026','point3'=>'Controleer stoel en eindtotaal vóór betaling']];if(isset($n[$id]))$out=array_merge($out,$n[$id]);}return $out;}
function render_email"""
if s.count(old) != 1:
    raise SystemExit('Fail closed: campaign_spec end changed')
s = s.replace(old, nl_specs)
p.write_text(s, encoding='utf-8')
print('patched', php)

# Netherlands-aware global locale router.
router = Path('events/_factory/locale-router-v1.js')
r = router.read_text(encoding='utf-8')
old = "    if (['GB','IE'].includes(c)) return 'en-gb';"
new = "    if (c === 'NL') return 'nl-nl';\n    if (['GB','IE'].includes(c)) return 'en-gb';"
if r.count(old) != 1:
    raise SystemExit('Fail closed: country router marker changed')
r = r.replace(old, new)
old = "      if (l.startsWith('en')) return 'en-gb';"
new = "      if (l.startsWith('nl')) return 'nl-nl';\n      if (l.startsWith('en')) return 'en-gb';"
if r.count(old) != 1:
    raise SystemExit('Fail closed: browser router marker changed')
r = r.replace(old, new)
router.write_text(r, encoding='utf-8')

# Any paid event with an NL page must route Dutch users immediately and use the new JS.
paid = [
    'manchester-derby-2026', 'liverpool-v-manchester-united-2026', 'el-clasico-2026',
    'madrid-derby-2026', 'north-london-derby-2026', 'arsenal-v-manchester-city-2026'
]
for slug in paid:
    event = Path('events') / slug
    dutch = event / 'nl-nl' / 'index.html'
    root = event / 'index.html'
    if not dutch.exists():
        continue
    if not root.exists():
        raise SystemExit(f'Fail closed: {slug} Dutch page has no root router')
    x = root.read_text(encoding='utf-8')
    m = re.search(r'window\.__TP_EVENT_LOCALES__=\[([^\]]*)\]', x)
    if not m:
        raise SystemExit(f'Fail closed: {slug} locale list missing')
    if 'nl-nl' not in m.group(1):
        items = m.group(1).rstrip()
        repl = 'window.__TP_EVENT_LOCALES__=[' + items + ((',' if items else '') + '"nl-nl"') + ']'
        x = x[:m.start()] + repl + x[m.end():]
    if "startsWith('nl')" not in x:
        pattern = r"<script>try\{location\.replace\(\(navigator\.language\|\|'en'\).*?</script>"
        repl = "<script>try{const l=(navigator.language||'en').toLowerCase();location.replace(l.startsWith('ar')?'./ar/':l.startsWith('nl')?'./nl-nl/':'./en-gb/')}catch(e){location.replace('./en-gb/')}</script>"
        x, n = re.subn(pattern, repl, x, count=1)
        if n != 1:
            raise SystemExit(f'Fail closed: {slug} immediate redirect format unexpected')
    root.write_text(x, encoding='utf-8')
    y = dutch.read_text(encoding='utf-8')
    y, n = re.subn(r'save-search\.js\?v=[0-9.]+', 'save-search.js?v=1.0.2', y)
    if n < 1:
        raise SystemExit(f'Fail closed: {slug} Dutch page missing save-search.js')
    dutch.write_text(y, encoding='utf-8')
    print('routed/cache-busted', slug)
