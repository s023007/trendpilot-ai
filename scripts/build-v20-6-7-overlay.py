from __future__ import annotations
import json, re, math, hashlib
from pathlib import Path
from collections import defaultdict

ROOT = Path('.')
SRC = ROOT / 'data/search-v20-6'
OUT = SRC / 'stable-v20-6-7.json'
BLOCKED = {'temu','joom','filamentpro eu cps','filamentpro'}
ID_TPID = re.compile(r'^TP[A-Z]{2,4}-[A-Z0-9]+$', re.I)
ID_TPVID = re.compile(r'^TPV-[A-Z0-9]+$', re.I)
ID_TPOID = re.compile(r'^TPO-[A-Z0-9]+$', re.I)

# Stable identity anchors already proven by the committed TPID registry.
# These anchors repair presentation labels only; they do NOT regroup identity.
CANONICAL_ANCHORS = {
    'TPPH-D8C434EDE8F517': {'name':'OnePlus 7T','brand':'OnePlus','type':'phone'},
    'TPLP-935FFB3DC985AB': {'name':'ThinkPad X1 Carbon','brand':'Lenovo','type':'laptop'},
    'TPHP-E27D7DCEF2AE43': {'name':'Lenovo 100 Mono USB Headset','brand':'Lenovo','type':'headphones'},
    'TPPF-C5712B5061F9E5': {'name':'Al Haramain Badar Perfume for Unisex - Pure Perfume 0.5 oz','brand':'Al Haramain','type':'perfume'},
}

def txt(v):
    if v is None: return ''
    if isinstance(v, (str,int,float)): return str(v).strip()
    return ''

def first(d, keys):
    for k in keys:
        if k in d:
            v = d.get(k)
            if v is not None and txt(v): return v
    return None

def first_id(d, regex, keys):
    for k in keys:
        v = txt(d.get(k))
        if regex.match(v): return v.upper()
    for v in d.values():
        if isinstance(v, str) and regex.match(v.strip()): return v.strip().upper()
    return ''

def num(v):
    if v is None or isinstance(v,bool): return None
    if isinstance(v,(int,float)):
        x=float(v); return x if math.isfinite(x) else None
    s=txt(v).replace(',','')
    m=re.search(r'(?<!\d)(\d+(?:\.\d+)?)', s)
    if not m: return None
    try: return float(m.group(1))
    except: return None

def boolish(v):
    if isinstance(v,bool): return v
    s=txt(v).lower()
    if s in {'true','1','yes','y','pass','reliable','valid'}: return True
    if s in {'false','0','no','n','fail','unreliable','invalid','suppressed'}: return False
    return None

def norm_type(v):
    s=txt(v).lower().replace('-','_').replace(' ','_')
    aliases={
      'smartphones':'phone','smartphone':'phone','phones':'phone','mobile_phone':'phone',
      'laptops':'laptop','notebook':'laptop','notebooks':'laptop',
      'headphone':'headphones','earbuds':'headphones','earphone':'headphones','earphones':'headphones','headset':'headphones',
      'fragrance':'perfume','fragrances':'perfume','perfumes':'perfume',
      'powerbank':'power_bank','powerbanks':'power_bank','power_banks':'power_bank',
      'airconditioner':'air_conditioner','air_conditioners':'air_conditioner','air_conditioning':'air_conditioner',
      'dogfood':'dog_food','pet_food':'dog_food','dog_treats':'dog_food',
      'smartwatches':'smartwatch','smart_watch':'smartwatch',
      '3d_filament':'3d_filament','filament':'3d_filament'
    }
    return aliases.get(s,s)

def seller_key(s): return re.sub(r'[^a-z0-9]+',' ',txt(s).lower()).strip()
def blocked(s):
    k=seller_key(s)
    return any(b in k for b in BLOCKED)

def valid_url(v): return bool(re.match(r'^https?://', txt(v), re.I))
def richest(cur,new):
    if not cur: return new
    score=lambda x: sum(bool(txt(x.get(k))) for k in ['name','canonicalName','brand','image','url','type','seller']) + len(json.dumps(x,ensure_ascii=False))*.00001
    return new if score(new)>score(cur) else cur

raw_records=[]
parse_errors=[]
for p in sorted(SRC.rglob('*')):
    if p.name=='stable-v20-6-7.json' or not p.is_file(): continue
    if p.suffix.lower()=='.json':
        try:
            raw_records.append((p,json.loads(p.read_text(encoding='utf-8'))))
        except Exception as e: parse_errors.append((str(p),str(e)))
    elif p.suffix.lower() in {'.ndjson','.jsonl'}:
        rows=[]
        try:
            for i,line in enumerate(p.read_text(encoding='utf-8',errors='ignore').splitlines(),1):
                line=line.strip()
                if not line: continue
                try: rows.append(json.loads(line))
                except Exception as e: parse_errors.append((f'{p}:{i}',str(e)))
            raw_records.append((p,rows))
        except Exception as e: parse_errors.append((str(p),str(e)))

products={}; offers=[]; variants={}
seen_offer_fingerprints=set()

def walk(obj, inherited=None, source=''):
    inherited=dict(inherited or {})
    if isinstance(obj, list):
        for x in obj: walk(x,inherited,source)
        return
    if not isinstance(obj, dict): return

    tpid=first_id(obj,ID_TPID,['tpid','TPID','masterProductId','master_product_id','productId','product_id','id']) or inherited.get('tpid','')
    tpvid=first_id(obj,ID_TPVID,['tpvid','TPVID','variantId','variant_id','id']) or inherited.get('tpvid','')
    tpoid=first_id(obj,ID_TPOID,['tpoid','TPOID','offerId','offer_id','listingId','listing_id','id'])
    name=txt(first(obj,['canonicalName','canonical_name','displayName','display_name','model','name','title','productName','product_name']))
    brand=txt(first(obj,['canonicalBrand','canonical_brand','brand','manufacturer']))
    ptype=norm_type(first(obj,['productType','product_type','type','category','kind']) or inherited.get('type',''))
    seller=txt(first(obj,['seller','advertiser','advertiserName','advertiser_name','merchant','merchantName','merchant_name','store']))
    url=txt(first(obj,['affiliateUrl','affiliate_url','buyUrl','buy_url','productUrl','product_url','clickUrl','click_url','url','destinationUrl','destination_url']))
    image=txt(first(obj,['image','imageUrl','image_url','imageLink','image_link','thumbnail','thumbnailUrl','thumbnail_url']))
    currency=txt(first(obj,['currency','currencyCode','currency_code'])) or 'USD'
    price=num(first(obj,['price','salePrice','sale_price','currentPrice','current_price','minPrice','min_price','amount']))

    ctx={'tpid':tpid,'tpvid':tpvid,'type':ptype or inherited.get('type','')}

    if tpid and not blocked(seller):
        rec={'tpid':tpid,'name':name,'brand':brand,'type':ptype,'image':image,'source':source}
        if name or brand or ptype or image:
            products[tpid]=richest(products.get(tpid),rec)

    if tpid and tpvid:
        vr={'tpid':tpid,'tpvid':tpvid,'name':name,'type':ptype,'source':source}
        variants[(tpid,tpvid)]=richest(variants.get((tpid,tpvid)),vr)

    looks_offer=bool(tpid and (tpoid or seller or valid_url(url)) and (seller or valid_url(url)))
    if looks_offer and not blocked(seller):
        reliability=True
        for k in ['priceReliable','price_reliable','reliablePrice','reliable_price','priceValid','price_valid']:
            if k in obj:
                b=boolish(obj.get(k));
                if b is False: reliability=False
        for k in ['priceSuppressed','price_suppressed','suppressPrice','suppress_price','unreliablePrice','unreliable_price']:
            if k in obj:
                b=boolish(obj.get(k));
                if b is True: reliability=False
        fp=tpoid or hashlib.sha1(f'{tpid}|{tpvid}|{seller}|{url}|{name}'.encode()).hexdigest()[:20]
        if fp not in seen_offer_fingerprints:
            seen_offer_fingerprints.add(fp)
            offers.append({'tpid':tpid,'tpvid':tpvid,'tpoid':tpoid or ('TPOX-'+fp.upper()),'name':name,'seller':seller,'url':url,'image':image,'price':price,'currency':currency,'type':ptype,'priceReliable':reliability,'source':source})

    for v in obj.values():
        if isinstance(v,(dict,list)): walk(v,ctx,source)

for p,obj in raw_records: walk(obj,{},str(p))

# If the committed comparison package is compact/nested, the generic walker above recovers parent TPID/TPVID context.
# Now consolidate only actionable seller offers.
actionable=[]
for o in offers:
    if not o['seller'] or not valid_url(o['url']):
        continue
    if blocked(o['seller']): continue
    p=products.get(o['tpid'],{})
    typ=norm_type(o.get('type') or p.get('type'))
    price=o.get('price')
    reliable=bool(o.get('priceReliable',True))
    reason=''
    if price is None or price<=0: reliable=False; reason='missing-or-nonpositive'
    elif price<=1.01: reliable=False; reason='placeholder-one-dollar'
    elif seller_key(o['seller']).startswith('lenovo') and price<10: reliable=False; reason='lenovo-placeholder'
    elif typ=='phone' and price<15: reliable=False; reason='implausible-phone-floor'
    elif typ=='laptop' and price<25: reliable=False; reason='implausible-laptop-floor'
    elif typ=='air_conditioner' and price<40: reliable=False; reason='implausible-ac-floor'
    elif typ=='smartwatch' and price<5: reliable=False; reason='implausible-watch-floor'
    elif typ=='headphones' and price<2: reliable=False; reason='implausible-headphone-floor'
    if not reliable and not reason: reason='source-marked-unreliable'
    o['type']=typ; o['priceReliable']=reliable; o['priceSuppressionReason']=reason
    actionable.append(o)

by_tpid=defaultdict(list)
for o in actionable: by_tpid[o['tpid']].append(o)

def specs_from(text):
    s=txt(text)
    bits=[]
    for pat in [r'\b(?:8|16|32|64|128|256|512|1024)\s*GB\b', r'\b(?:1|2|3|4|6|8|12|16|24|32|64)\s*GB\s*RAM\b', r'\bGen\s*\d+\b', r'\b\d+(?:\.\d+)?\s*(?:inch|inches|\")\b']:
        for m in re.findall(pat,s,re.I):
            v=re.sub(r'\s+',' ',m).strip()
            if v.lower() not in [x.lower() for x in bits]: bits.append(v)
    return bits[:4]

result_products=[]; result_variants=[]; result_offers=[]
suppressed_prices=[]
for tpid, rows in by_tpid.items():
    if not rows: continue
    p=products.get(tpid,{})
    anchor=CANONICAL_ANCHORS.get(tpid,{})
    name=txt(anchor.get('name')) or txt(p.get('name')) or txt(rows[0].get('name')) or tpid
    if ID_TPID.match(name): name=txt(anchor.get('name')) or txt(rows[0].get('name')) or 'TrendPilot product'
    brand=txt(anchor.get('brand')) or txt(p.get('brand'))
    typ=norm_type(anchor.get('type') or p.get('type') or rows[0].get('type'))
    img=txt(p.get('image')) or next((txt(x.get('image')) for x in rows if valid_url(x.get('image'))),'')
    sellers=sorted({txt(x['seller']) for x in rows if x['seller']})
    tpvids=sorted({x['tpvid'] for x in rows if x['tpvid']})
    reliable_prices=[x['price'] for x in rows if x.get('priceReliable') and x.get('price') is not None]
    result_products.append({
      'tpid':tpid,'name':name,'brand':brand,'type':typ,'image':img,
      'sellerCount':len(sellers),'sellers':sellers,'variantCount':max(1,len(tpvids)),
      'fromPrice':min(reliable_prices) if reliable_prices else None,'currency':'USD',
      'offerCount':len(rows)
    })
    grouped=defaultdict(list)
    for x in rows: grouped[x.get('tpvid') or 'UNSPECIFIED'].append(x)
    for vid,vrows in grouped.items():
        evidence=' '.join([name]+[txt(x.get('name')) for x in vrows[:4]])
        specs=specs_from(evidence)
        label=' · '.join(specs) if specs else ('Base / unspecified variant' if vid=='UNSPECIFIED' else f'Variant {len(result_variants)+1}')
        vsellers=sorted({x['seller'] for x in vrows if x['seller']})
        result_variants.append({'tpid':tpid,'tpvid':vid,'label':label,'sellerCount':len(vsellers),'sellers':vsellers,'offerCount':len(vrows)})
    for x in rows:
        result_offers.append(x)
        if not x.get('priceReliable') and x.get('price') is not None:
            suppressed_prices.append({'tpid':tpid,'seller':x['seller'],'price':x['price'],'reason':x['priceSuppressionReason'],'name':x.get('name','')})

# Sort deterministic; multi-seller and named canonical models first.
result_products.sort(key=lambda x:(-x['sellerCount'], x['type'], x['brand'].lower(), x['name'].lower(), x['tpid']))
result_variants.sort(key=lambda x:(x['tpid'],x['label'],x['tpvid']))
result_offers.sort(key=lambda x:(x['tpid'],x.get('tpvid',''),x['seller'].lower(),x['tpoid']))

prod_ids={p['tpid'] for p in result_products}
result_variants=[v for v in result_variants if v['tpid'] in prod_ids]
result_offers=[o for o in result_offers if o['tpid'] in prod_ids]

# Strong contract checks.
failures=[]
if len(result_products)<10000: failures.append(f'too-few-products={len(result_products)}')
if len(result_offers)<10000: failures.append(f'too-few-offers={len(result_offers)}')
if any(blocked(o['seller']) for o in result_offers): failures.append('blocked-seller-leak')
if any(p['sellerCount'] != len({o['seller'] for o in result_offers if o['tpid']==p['tpid']}) for p in result_products): failures.append('seller-count-mismatch')
if any(o.get('priceReliable') and o.get('price') is not None and o['price']<=1.01 for o in result_offers): failures.append('visible-one-dollar-price')

def find_product(name):
    n=re.sub(r'[^a-z0-9]+',' ',name.lower()).strip()
    exact=[p for p in result_products if re.sub(r'[^a-z0-9]+',' ',p['name'].lower()).strip()==n]
    return exact[0] if exact else None

by_product_id={p['tpid']:p for p in result_products}
one=by_product_id.get('TPPH-D8C434EDE8F517') or find_product('OnePlus 7T')
if not one: failures.append('missing-OnePlus-7T-TPID')
else:
    ss={o['seller'] for o in result_offers if o['tpid']==one['tpid']}
    if len(ss)<2: failures.append(f'OnePlus-7T-sellers={sorted(ss)}')
think=by_product_id.get('TPLP-935FFB3DC985AB') or find_product('ThinkPad X1 Carbon')
if not think: failures.append('missing-ThinkPad-X1-Carbon-TPID')
mono=by_product_id.get('TPHP-E27D7DCEF2AE43') or find_product('Lenovo 100 Mono USB Headset')
if mono:
    bad=[o for o in result_offers if o['tpid']==mono['tpid'] and o.get('priceReliable') and (o.get('price') or 0)<10]
    if bad: failures.append('Lenovo-headset-placeholder-visible')

payload={
  'version':'20.6.7.1','mode':'stable-comparison-overlay','generatedFrom':'committed V20.6 package',
  'products':result_products,'variants':result_variants,'offers':result_offers,
  'stats':{
    'products':len(result_products),'offers':len(result_offers),'variants':len(result_variants),
    'multiSellerProducts':sum(p['sellerCount']>1 for p in result_products),
    'singleSellerProducts':sum(p['sellerCount']==1 for p in result_products),
    'productsWithImage':sum(valid_url(p['image']) for p in result_products),
    'suppressedPrices':len(suppressed_prices),
    'parseErrors':len(parse_errors)
  },
  'suppressedPriceSamples':suppressed_prices[:50],
  'failures':failures
}
OUT.write_text(json.dumps(payload,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
Path('.tmp-v2067/build-summary.json').write_text(json.dumps(payload['stats']|{'failures':failures},indent=2),encoding='utf-8')
print(json.dumps(payload['stats']|{'failures':failures},indent=2))
if failures:
    raise SystemExit('V20.6.7 overlay contract failed: '+ '; '.join(failures))
