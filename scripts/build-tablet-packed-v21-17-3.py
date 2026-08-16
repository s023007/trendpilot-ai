from pathlib import Path
import json, re

ROOT=Path('.')
PRODUCTS=ROOT/'data/v20-9/products'
OUT=ROOT/'data/v20-9/tablet-seller-samples.json'
BLOCKED={'temu','joom','filamentpro eu cps','filamentpro'}

# Consumer-tablet discovery is intentionally title-driven. Historic family/type labels
# contain some false classifications, so a row must look like a complete device in its
# public title and not merely mention a tablet that another product fits or controls.
DIRECT_DEVICE=re.compile(
    r'\b(?:tablet\s+pc|android\s+tablet|windows\s+tablet|chromebook\s+tablet|'
    r'ipad(?:\s+(?:pro|air|mini))?(?:\s+\d{1,2}(?:\.\d)?(?:-inch|\s*inch)?)?|'
    r'galaxy\s+tab\s*[a-z0-9+.-]*|surface\s+pro\s*\d*|'
    r'(?:lenovo|xiaomi|redmi|honor|huawei|samsung|oneplus|oppo|vivo|realme)\s+(?:tab|pad)\s*[a-z0-9+.-]*)\b',
    re.I
)
GENERIC_TABLET=re.compile(r'\btablets?\b',re.I)
DEVICE_SIGNAL=re.compile(
    r'\b(?:\d{1,2}(?:\.\d)?\s*(?:inch|inches|\")|\d+\s*gb\s*(?:ram|rom|storage)?|'
    r'\d+\s*(?:gb|tb)\s+(?:ssd|storage)|android\s*\d{1,2}|wi-?fi|4g|5g|lte|'
    r'snapdragon|mediatek|helio|unisoc|dimensity|octa[- ]?core|quad[- ]?core|'
    r'\d{3,5}\s*mah|touchscreen|ips\s+display|fhd|full\s+hd)\b',re.I
)
FALSE_CONTEXT=re.compile(
    r'\b(?:graphic(?:s)?\s+tablet|drawing\s+tablet|pen\s+tablet|signature\s+(?:pad|tablet)|'
    r'writing\s+(?:pad|tablet)|lcd\s+writing|digitizer|drawing\s+pad|graphics?\s+pad|'
    r'tablet\s+monitor|pen\s+display|digital\s+pen\s+design|handwriting\s+pad|animation\s+tablet|'
    r'osu\s+tablet|screen\s+repair|screen\s+remover|separator\s+pad|heating\s+(?:stage|pad)|'
    r'industrial\s+(?:tablet|panel)|control\s+panel|tablet\s+(?:holder|mount|stand|bracket)|'
    r'(?:holder|mount|stand|bracket)\s+(?:for\s+)?tablets?|tablet\s+accessor)\b',re.I
)
ACCESSORY=re.compile(
    r'\b(?:cases?|covers?|folios?|screen\s+protectors?|tempered\s+glass|protective\s+films?|'
    r'stands?|holders?|mounts?|brackets?|keyboard\s+cases?|sleeves?|bags?|stylus|'
    r'pens?\s+(?:for|compatible)|replacement|repair|digitizer|touch\s+screens?|touch\s+panels?|'
    r'glass\s+panels?|lcd\s+(?:screen|display)|display\s+assembly|batter(?:y|ies)|chargers?|'
    r'cables?|cords?|adapters?|docks?|controllers?|gamepads?|motherboards?|mainboards?|'
    r'flex\s+cables?|ribbon\s+cables?|connectors?|housings?|shells?|parts?|spares?|'
    r'gift\s+sets?|fragrances?|perfumes?|car\s+mounts?|wall\s+mounts?)\b',re.I
)
FIT_LANGUAGE=re.compile(r'\b(?:for|fits?|compatible\s+with|replacement\s+for|designed\s+for|used\s+for|suitable\s+for)\b',re.I)


def clean(v):
    return re.sub(r'\s+',' ',str(v or '')).strip()

def candidate(r):
    seller=clean(r.get('se')).lower()
    if seller in BLOCKED: return False
    role=clean(r.get('ro') or 'main').lower()
    if role not in {'main','used'}: return False
    title=clean(r.get('t'))
    if not title: return False
    if FALSE_CONTEXT.search(title) or ACCESSORY.search(title): return False

    direct=bool(DIRECT_DEVICE.search(title))
    generic=bool(GENERIC_TABLET.search(title))
    if not direct and not (generic and DEVICE_SIGNAL.search(title)): return False

    # Accessory listings often say "for iPad/Tablet". A genuine device can contain
    # "for" elsewhere, but if fit-language appears immediately before the device phrase,
    # reject it unless the title also carries strong complete-device specification evidence.
    if re.search(r'\b(?:for|fits?|compatible\s+with|replacement\s+for)\s+(?:the\s+)?(?:apple\s+)?(?:ipad|tablet|galaxy\s+tab|surface\s+pro)\b',title,re.I):
        if not (DEVICE_SIGNAL.search(title) and re.search(r'\b(?:tablet\s+pc|android\s+tablet|windows\s+tablet|chromebook\s+tablet)\b',title,re.I)):
            return False
    return True

def rank(r):
    title=clean(r.get('t'))
    score=float(r.get('r') or 0)
    if re.search(r'\b(?:ipad|galaxy\s+tab|surface\s+pro|chromebook\s+tablet)\b',title,re.I): score+=60
    if re.search(r'\b(?:tablet\s+pc|android\s+tablet|windows\s+tablet)\b',title,re.I): score+=50
    if DEVICE_SIGNAL.search(title): score+=30
    if r.get('im'): score+=5
    if r.get('x'): score+=5
    return score

records={}
for p in sorted(PRODUCTS.glob('*.json')):
    try: data=json.loads(p.read_text(encoding='utf-8'))
    except Exception: continue
    if not isinstance(data,dict): continue
    for pid,r in data.items():
        if isinstance(r,dict) and candidate(r): records[pid]=r

by={}
for pid,r in records.items(): by.setdefault(clean(r.get('se')) or 'Seller',[]).append(pid)
for seller,ids in by.items(): ids.sort(key=lambda pid:(-rank(records[pid]), clean(records[pid].get('t')).lower(),pid))

CAP=180
sellers={seller:ids[:CAP] for seller,ids in sorted(by.items()) if ids}
kept={pid:records[pid] for ids in sellers.values() for pid in ids}

suspect=[]
for pid,r in kept.items():
    price=float(r.get('p') or 0)
    seller=clean(r.get('se')).lower(); title=clean(r.get('t'))
    if 'lenovo' in seller and 0<price<=5 and re.search(r'\b(?:tablet|chromebook|laptop|notebook|computer)\b',title,re.I):
        suspect.append({'id':pid,'seller':r.get('se'),'title':title,'price':price})

payload={
    'version':'21.17.3',
    'kind':'strict-consumer-tablets',
    'count':len(kept),
    'sellerCount':len(sellers),
    'sellers':sellers,
    'records':kept,
    'qa':{'lenovoPlaceholderPrices':suspect}
}
OUT.parent.mkdir(parents=True,exist_ok=True)
OUT.write_text(json.dumps(payload,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print(json.dumps({'records':len(kept),'sellers':{k:len(v) for k,v in sellers.items()},'lenovoPlaceholderPrices':suspect},ensure_ascii=False,indent=2))
if len(kept)<5: raise SystemExit('Too few strict consumer tablet records')
