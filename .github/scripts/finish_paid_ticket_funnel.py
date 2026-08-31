from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]


def text(path):
    return (ROOT / path).read_text(encoding='utf-8')


def write(path, value):
    (ROOT / path).write_text(value, encoding='utf-8')
    print('updated', path)


def replace_if_old(path, old, new):
    s = text(path)
    if new in s:
        return
    if old not in s:
        raise SystemExit(f'Fail closed: marker missing in {path}: {old[:100]!r}')
    write(path, s.replace(old, new, 1))


# 1) Paid Dutch El Clasico page: exact fixture destinations only.
nl_page = 'events/el-clasico-2026/nl-nl/index.html'
replace_if_old(nl_page,
    'https://seatpick.com/ar/entradas-fc-barcelona-vs-real-madrid',
    'https://seatpick.com/fc-barcelona-vs-real-madrid-camp-nou-stadium-tickets/event/510975')
replace_if_old(nl_page,
    'https://www.fanpass.es/real-madrid-entradas/',
    'https://www.fanpass.es/entradas-fc-barcelona-vs-real-madrid')

# 2) Localize save modal to Dutch and record every direct seller outbound click.
js_path = 'events/manchester-derby-2026/save-search.js'
s = text(js_path)
if "nl:{title:p=>`Bewaar deze ticketdeal" not in s:
    marker = "quick:'✓ يستغرق 5 ثوانٍ'}};"
    replacement = "quick:'✓ يستغرق 5 ثوانٍ'},nl:{title:p=>`Bewaar deze ticketdeal${p?` · ${p}`:''}`,body:'We mailen deze aanbieding zodat je er later makkelijk naar terug kunt.',email:'Vul je e-mailadres in',save:'Ontvang aanbod →',skip:'Doorgaan zonder e-mail',updates:'Waarschuw me als de prijs verandert',required:'Verplicht',sending:'Aanbieding openen…',error:'Opslaan lukt nu niet. Je kunt nog steeds doorgaan naar de aanbieder.',needAlert:'Selecteer de prijswaarschuwing om door te gaan.',privacy:'Geen spam. Afmelden kan altijd.',quick:'✓ Duurt 5 seconden'}};"
    if marker not in s: raise SystemExit('Fail closed: JS cfg marker changed')
    s = s.replace(marker, replacement, 1)
if "const OUTBOUND='https://api.trendpilotchoice.com/seller-outbound.php';" not in s:
    marker = "const GO='https://api.trendpilotchoice.com/go.php?lead=';"
    if marker not in s: raise SystemExit('Fail closed: JS GO marker changed')
    s = s.replace(marker, marker + "\nconst OUTBOUND='https://api.trendpilotchoice.com/seller-outbound.php';", 1)
old_lang = "const lang=document.documentElement.lang&&document.documentElement.lang.startsWith('ar')?'ar':'en',t=cfg[lang];let pending=null;"
new_lang = "const docLang=(document.documentElement.lang||'en').toLowerCase();const lang=docLang.startsWith('ar')?'ar':docLang.startsWith('nl')?'nl':'en',t=cfg[lang];let pending=null;"
if old_lang in s: s = s.replace(old_lang, new_lang, 1)
if "function trackSellerOutbound" not in s:
    old_go = "function go(){if(!pending)return;const href=pending.href;pending=null;window.open(href,'_blank','noopener')}"
    new_go = "function makeEventId(){const b=new Uint8Array(8);crypto.getRandomValues(b);return[...b].map(x=>x.toString(16).padStart(2,'0')).join('')}\nfunction trackSellerOutbound(link){try{const {seller,price}=meta(link),payload={event_id:makeEventId(),seller,price,offer_url:link.href,page_url:location.href,tracking:params()},body=JSON.stringify(payload);fire('SELLER_OUTBOUND',{seller,price});if(navigator.sendBeacon){const blob=new Blob([body],{type:'text/plain;charset=UTF-8'});if(navigator.sendBeacon(OUTBOUND,blob))return}fetch(OUTBOUND,{method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8','Accept':'application/json'},body,keepalive:true}).catch(()=>{})}catch(_){}}\nfunction go(){if(!pending)return;const link=pending,href=link.href;trackSellerOutbound(link);pending=null;window.open(href,'_blank','noopener')}"
    if old_go not in s: raise SystemExit('Fail closed: JS go marker changed')
    s = s.replace(old_go, new_go, 1)
old_close = 'aria-label="Close">×</button>'
new_close = 'aria-label="${lang===\'nl\'?\'Sluiten\':lang===\'ar\'?\'إغلاق\':\'Close\'}">×</button>'
if old_close in s: s = s.replace(old_close, new_close, 1)
write(js_path, s)

# 3) Dutch email return path and email copy.
php_path = 'api/save-search.php'
s = text(php_path)
old_start = "function campaign_spec(string $id,string $lang):array{$ar=$lang==='ar';$s=["
new_start = "function campaign_spec(string $id,string $lang):array{$ar=$lang==='ar';$nl=$lang==='nl';$s=["
if old_start in s: s = s.replace(old_start, new_start, 1)
if "$nl=$lang==='nl'" not in s.replace(' ', ''):
    raise SystemExit('Fail closed: could not add Dutch PHP branch')
if "Je El Clásico-aanbod is opgeslagen" not in s:
    end = ";return $s[$id]??$s['generic_offer'];}\nfunction render_email"
    if end not in s: raise SystemExit('Fail closed: PHP campaign_spec end changed')
    nl_specs = """;$out=$s[$id]??$s['generic_offer'];if($nl){$n=[
'manchester_derby_2026'=>['return_base'=>'https://trendpilotchoice.com/events/manchester-derby-2026/nl-nl/','badge'=>'TICKETALERT • MANCHESTER DERBY','subject'=>'Je Manchester Derby-aanbod is opgeslagen','headline'=>'Je ticketaanbod is opgeslagen','intro'=>'We hebben deze aanbieding bewaard zodat je prijs en stoelen snel opnieuw kunt bekijken.','cta'=>'Bekijk prijs en stoelen →','buy_cta'=>'Bekijk beschikbare stoelen →','point1'=>'Wedstrijd: Manchester United vs Manchester City','point2'=>'Old Trafford • 13 september 2026','point3'=>'Controleer altijd de definitieve prijs en stoelvoorwaarden bij de aanbieder'],
'el_clasico_2026'=>['return_base'=>'https://trendpilotchoice.com/events/el-clasico-2026/nl-nl/','badge'=>'TICKETALERT • EL CLÁSICO','subject'=>'Je El Clásico-aanbod is opgeslagen','headline'=>'Je El Clásico-aanbod is opgeslagen','intro'=>'We hebben deze aanbieding bewaard zodat je prijs en stoelen snel opnieuw kunt bekijken.','cta'=>'Bekijk prijs en stoelen →','buy_cta'=>'Bekijk beschikbare stoelen →','point1'=>'Wedstrijd: FC Barcelona vs Real Madrid','point2'=>'Spotify Camp Nou • 25 oktober 2026 • aftrap nog te bevestigen','point3'=>'Controleer altijd de definitieve prijs en stoelvoorwaarden bij de aanbieder'],
'liverpool_manunited_2026'=>['return_base'=>'https://trendpilotchoice.com/events/liverpool-v-manchester-united-2026/nl-nl/','badge'=>'TICKETALERT • LIVERPOOL–MAN UNITED','subject'=>'Je ticketaanbod is opgeslagen','headline'=>'Je ticketaanbod is opgeslagen','intro'=>'We hebben deze aanbieding bewaard zodat je snel kunt terugkeren.','cta'=>'Bekijk prijs en stoelen →','buy_cta'=>'Bekijk beschikbare stoelen →','point1'=>'Wedstrijd: Liverpool vs Manchester United','point2'=>'Anfield • 21 november 2026','point3'=>'Controleer stoel en eindtotaal vóór betaling'],
'madrid_derby_2026'=>['return_base'=>'https://trendpilotchoice.com/events/madrid-derby-2026/nl-nl/','badge'=>'TICKETALERT • MADRID DERBY','subject'=>'Je ticketaanbod is opgeslagen','headline'=>'Je ticketaanbod is opgeslagen','intro'=>'We hebben deze aanbieding bewaard zodat je snel kunt terugkeren.','cta'=>'Bekijk prijs en stoelen →','buy_cta'=>'Bekijk beschikbare stoelen →','point1'=>'Wedstrijd: Atlético Madrid vs Real Madrid','point2'=>'Riyadh Air Metropolitano • 20 september 2026','point3'=>'Controleer stoel en eindtotaal vóór betaling'],
'north_london_derby_2026'=>['return_base'=>'https://trendpilotchoice.com/events/north-london-derby-2026/nl-nl/','badge'=>'TICKETALERT • NORTH LONDON DERBY','subject'=>'Je ticketaanbod is opgeslagen','headline'=>'Je ticketaanbod is opgeslagen','intro'=>'We hebben deze aanbieding bewaard zodat je snel kunt terugkeren.','cta'=>'Bekijk prijs en stoelen →','buy_cta'=>'Bekijk beschikbare stoelen →','point1'=>'Wedstrijd: Tottenham Hotspur vs Arsenal','point2'=>'Tottenham Hotspur Stadium • 5 december 2026','point3'=>'Controleer stoel en eindtotaal vóór betaling'],
'arsenal_mancity_2026'=>['return_base'=>'https://trendpilotchoice.com/events/arsenal-v-manchester-city-2026/nl-nl/','badge'=>'TICKETALERT • ARSENAL–MAN CITY','subject'=>'Je ticketaanbod is opgeslagen','headline'=>'Je ticketaanbod is opgeslagen','intro'=>'We hebben deze aanbieding bewaard zodat je snel kunt terugkeren.','cta'=>'Bekijk prijs en stoelen →','buy_cta'=>'Bekijk beschikbare stoelen →','point1'=>'Wedstrijd: Arsenal vs Manchester City','point2'=>'Emirates Stadium • 28 november 2026','point3'=>'Controleer stoel en eindtotaal vóór betaling']];if(isset($n[$id]))$out=array_merge($out,$n[$id]);}return $out;}
function render_email"""
    s = s.replace(end, nl_specs, 1)
write(php_path, s)

# 4) Country/browser routing must prefer Dutch when an NL page exists.
router_path = 'events/_factory/locale-router-v1.js'
r = text(router_path)
if "if (c === 'NL') return 'nl-nl';" not in r:
    marker = "    if (['GB','IE'].includes(c)) return 'en-gb';"
    if marker not in r: raise SystemExit('Fail closed: router country marker changed')
    r = r.replace(marker, "    if (c === 'NL') return 'nl-nl';\n" + marker, 1)
if "if (l.startsWith('nl')) return 'nl-nl';" not in r:
    marker = "      if (l.startsWith('en')) return 'en-gb';"
    if marker not in r: raise SystemExit('Fail closed: router browser marker changed')
    r = r.replace(marker, "      if (l.startsWith('nl')) return 'nl-nl';\n" + marker, 1)
write(router_path, r)

paid = ['manchester-derby-2026','liverpool-v-manchester-united-2026','el-clasico-2026','madrid-derby-2026','north-london-derby-2026','arsenal-v-manchester-city-2026']
for slug in paid:
    event = ROOT / 'events' / slug
    dutch = event / 'nl-nl' / 'index.html'
    root = event / 'index.html'
    if not dutch.exists():
        continue
    if not root.exists(): raise SystemExit(f'Fail closed: {slug} Dutch page has no root router')
    x = root.read_text(encoding='utf-8')
    m = re.search(r'window\.__TP_EVENT_LOCALES__=\[([^\]]*)\]', x)
    if not m: raise SystemExit(f'Fail closed: {slug} locale list missing')
    if 'nl-nl' not in m.group(1):
        items = m.group(1).rstrip()
        repl = 'window.__TP_EVENT_LOCALES__=[' + items + ((',' if items else '') + '"nl-nl"') + ']'
        x = x[:m.start()] + repl + x[m.end():]
    if "startsWith('nl')" not in x:
        pattern = r"<script>try\{location\.replace\(\(navigator\.language\|\|'en'\).*?</script>"
        repl = "<script>try{const l=(navigator.language||'en').toLowerCase();location.replace(l.startsWith('ar')?'./ar/':l.startsWith('nl')?'./nl-nl/':'./en-gb/')}catch(e){location.replace('./en-gb/')}</script>"
        x, n = re.subn(pattern, repl, x, count=1)
        if n != 1: raise SystemExit(f'Fail closed: {slug} immediate redirect format unexpected')
    root.write_text(x, encoding='utf-8')
    y = dutch.read_text(encoding='utf-8')
    y, n = re.subn(r'save-search\.js\?v=[0-9.]+', 'save-search.js?v=1.0.2', y)
    if n < 1: raise SystemExit(f'Fail closed: {slug} Dutch page missing save-search.js')
    dutch.write_text(y, encoding='utf-8')

print('DONE: paid ticket funnel completed')
