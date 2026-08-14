#!/usr/bin/env python3
import json,re,unicodedata
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]; OUT=ROOT/'data/v20-8'

def clean(v):return re.sub(r'\s+',' ',str(v or '')).strip()
def norm(v):return re.sub(r'\s+',' ',re.sub(r'[^a-z0-9.-]+',' ',unicodedata.normalize('NFKD',clean(v)).encode('ascii','ignore').decode().lower())).strip()
def label(v):return clean(v).replace('-',' ').title()

def safe_brand(title,brand):
    b=norm(brand);t=norm(title)
    if not b:return ''
    # Never trust inherited brand metadata unless it is visible in the actual listing title.
    return brand if re.search(r'(?<![a-z0-9])'+re.escape(b)+r'(?![a-z0-9])',t) else ''

def corrected_type(title,role,old):
    t=norm(title)
    if role=='replacement_part':
        if re.search(r'\b(?:drill|saw|grinder|router|sander|power tool|carbon brush|armature|chuck|motor brush)\b',t):return 'power-tool-parts'
        if re.search(r'\b(?:air conditioner|air conditioning|ac unit|hvac|compressor)\b',t):return 'air-conditioning-parts'
        if re.search(r'\b(?:car|vehicle|automotive|atv|utv|winch|caliper|brake|engine|transmission)\b',t):return 'automotive-parts'
        if re.search(r'\b(?:printer|printhead|toner|inkjet|laserjet)\b',t):return 'printer-parts'
        if re.search(r'\b(?:iphone|smartphone|mobile phone|cell phone|galaxy|pixel|redmi|oneplus)\b',t):return 'phone-parts'
        if re.search(r'\b(?:laptop|notebook|thinkpad|ideapad|macbook|computer|pc)\b',t):return 'computer-parts'
        if re.search(r'\b(?:washing machine|dryer|vacuum|refrigerator|fridge|dishwasher|coffee machine|appliance)\b',t):return 'appliance-parts'
        return 'replacement-parts'
    rules=[
      ('phone',r'\b(?:smartphone|mobile phone|cell phone|iphone|galaxy|pixel|oneplus|redmi|poco|oppo|vivo|realme)\b'),
      ('laptop',r'\b(?:laptop|chromebook|thinkpad|ideapad|thinkbook|macbook|vivobook|zenbook|probook|elitebook|latitude|inspiron|xps)\b'),
      ('perfume',r'\b(?:perfume|fragrance|cologne|eau de parfum|eau de toilette|parfum|edp|edt)\b'),
      ('headphones',r'\b(?:headphones?|headsets?|earbuds?|earphones?|airpods?|tws)\b'),
      ('smartwatch',r'\b(?:smart ?watch|fitness watch|gps watch|apple watch)\b'),
      ('power-bank',r'\b(?:power ?bank|portable charger|external battery)\b'),
      ('medical',r'\b(?:medical|surgical|patient|diagnostic|hospital|clinical|dental)\b'),
      ('diecast-collectibles',r'\b(?:diecast|scale model|model car|model aircraft|collectible)\b'),
      ('3d-printing',r'\b(?:3d printer|3d filament|pla filament|petg filament|abs filament|tpu filament)\b'),
      ('lighting',r'\b(?:lamp|lighting|light fixture|led strip|bulb|ceiling light|wall light|desk lamp|floor lamp)\b'),
      ('cookware',r'\b(?:cookware|frying pan|saucepan|stockpot|casserole|wok|skillet|cooking pot)\b'),
      ('air-conditioning',r'\b(?:air conditioner|portable ac|mini split|ductless ac|split ac)\b'),
      ('tools',r'\b(?:drill|saw|wrench|screwdriver|pliers|multimeter|oscilloscope|soldering iron|grinder|router|ratchet|tool set)\b'),
    ]
    for ty,pat in rules:
        if re.search(pat,t,re.I):return ty
    return old or 'unclassified'

def model_signature(row):
    t=norm(row.get('title'))
    models=re.findall(r'\b(?=[a-z0-9.-]{4,}\b)(?=[a-z0-9.-]*[a-z])(?=[a-z0-9.-]*\d)[a-z0-9.-]+\b',t)
    models=[x for x in models if x not in {'4pcs','2pcs','3pcs','5pcs','12v','24v','110v','220v'}]
    if len(models)>=2:return row.get('type','')+'|'+ '|'.join(sorted(set(models))[:6])
    words=[x for x in re.findall(r'[a-z0-9]+',t) if len(x)>3 and x not in {'replacement','parts','accessories','accessory','power','motor','original','tools','product','compatible'}]
    return row.get('type','')+'|'+' '.join(words[:8])

def fix(row):
    row['brand']=safe_brand(row.get('title'),row.get('brand'))
    row['type']=corrected_type(row.get('title'),row.get('role'),row.get('type'))
    row['typeLabel']=label(row['type'])
    return row

# Correct universal product buckets used by long-tail search.
for p in sorted((OUT/'products').glob('*.json')):
    data=json.loads(p.read_text(encoding='utf-8'))
    for k,row in data.items():data[k]=fix(row)
    p.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')),encoding='utf-8')

# Correct and deduplicate Rare Finds so one model family does not dominate the page.
rare_path=OUT/'rare-index.json'; rows=[fix(x) for x in json.loads(rare_path.read_text(encoding='utf-8'))]
seen=set();out=[];seller_type={}
for row in rows:
    sig=model_signature(row)
    key=(row.get('seller'),sig)
    if key in seen:continue
    seen.add(key)
    cap=(row.get('seller'),row.get('type'));seller_type[cap]=seller_type.get(cap,0)+1
    if seller_type[cap]>24:continue
    out.append(row)
    if len(out)>=500:break
rare_path.write_text(json.dumps(out,ensure_ascii=False,separators=(',',':')),encoding='utf-8')

m=OUT/'manifest.json';manifest=json.loads(m.read_text());manifest['rarePublished']=len(out);manifest['truthCleanup']={'brandMustAppearInTitle':True,'replacementTypeUsesTitleEvidence':True,'nearDuplicateRareFamiliesCollapsed':True};m.write_text(json.dumps(manifest,indent=2),encoding='utf-8')
print(json.dumps({'rarePublishedAfterTruthCleanup':len(out),'brandTruth':True,'taxonomyTruth':True,'deduped':True},indent=2))
