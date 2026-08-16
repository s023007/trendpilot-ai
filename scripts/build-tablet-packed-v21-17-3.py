from pathlib import Path
import json, re

ROOT=Path('.')
PRODUCTS=ROOT/'data/v20-9/products'
OUT=ROOT/'data/v20-9/tablet-seller-samples.json'
BLOCKED={'temu','joom','filamentpro eu cps','filamentpro'}

# A tablet result must look like a complete consumer tablet in the TITLE itself.
# Do not trust old family/type labels alone; some historic rows were misclassified as tablet.
CONSUMER=re.compile(
    r'\b(?:tablet(?:\s+pc)?|ipad(?:\s+(?:pro|air|mini))?|galaxy\s+tab|surface\s+pro|chromebook\s+tablet|android\s+tablet|windows\s+tablet|(?:lenovo|xiaomi|redmi|honor|huawei|samsung)\s+(?:tab|pad)\s*[a-z0-9-]*)\b',
    re.I
)
FALSE_CONTEXT=re.compile(
    r'\b(?:graphic(?:s)?\s+tablet|drawing\s+tablet|pen\s+tablet|signature\s+(?:pad|tablet)|writing\s+(?:pad|tablet)|lcd\s+writing|digitizer|drawing\s+pad|graphics?\s+pad|tablet\s+monitor|pen\s+display|digital\s+pen\s+design|handwriting\s+pad|animation\s+tablet|osu\s+tablet|screen\s+repair|screen\s+remover|separator\s+pad|heating\s+(?:stage|pad)|industrial\s+(?:tablet|panel)|control\s+panel)\b',
    re.I
)
ACCESSORY=re.compile(
    r'\b(?:cases?|covers?|folios?|screen\s+protectors?|tempered\s+glass|protective\s+films?|stands?|holders?|mounts?|keyboard\s+cases?|sleeves?|bags?|stylus|pens?\s+(?:for|compatible)|replacement|repair|digitizer|touch\s+screens?|touch\s+panels?|glass\s+panels?|lcd\s+(?:screen|display)|display\s+assembly|batter(?:y|ies)\s+for|chargers?\s+for|cables?|cords?|adapters?|docks?|motherboards?|mainboards?|flex\s+cables?|ribbon\s+cables?|connectors?|housings?|shells?)\b',
    re.I
)
NON_DEVICE_TYPE=re.compile(r'(?:stylus|accessor|replacement|parts?|graphic|drawing|digitizer|pen-tablet|tablet-accessor)',re.I)


def clean(v):
    return re.sub(r'\s+',' ',str(v or '')).strip()

def candidate(r):
    seller=clean(r.get('se')).lower()
    if seller in BLOCKED: return False
    role=clean(r.get('ro') or 'main').lower()
    if role not in {'main','used'}: return False
    title=clean(r.get('t'))
    if not title or not CONSUMER.search(title): return False
    typ=clean(r.get('ty') or r.get('type')).lower()
    label=clean(r.get('tyl') or r.get('typeLabel')).lower()
    blob=f'{title} {typ} {label}'
    if FALSE_CONTEXT.search(blob): return False
    if ACCESSORY.search(title): return False
    if NON_DEVICE_TYPE.search(f'{typ} {label}'): return False
    return True

def rank(r):
    title=clean(r.get('t'))
    family=clean(r.get('fa')).lower(); typ=clean(r.get('ty') or r.get('type')).lower()
    score=float(r.get('r') or 0)
    if family=='tablet' or typ=='tablet': score+=80
    if re.search(r'\b(?:ipad|galaxy\s+tab|surface\s+pro|chromebook\s+tablet)\b',title,re.I): score+=45
    if re.search(r'\b(?:tablet\s+pc|android\s+tablet|windows\s+tablet)\b',title,re.I): score+=35
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

# Keep enough depth for Show more while retaining a compact, fast mobile payload.
CAP=180
sellers={seller:ids[:CAP] for seller,ids in sorted(by.items()) if ids}
kept={pid:records[pid] for ids in sellers.values() for pid in ids}

# Report known placeholder-price rows so QA can prove they remain in source data but are never presented as a real shopper price.
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
