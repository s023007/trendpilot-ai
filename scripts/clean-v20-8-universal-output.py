#!/usr/bin/env python3
import collections, html, json, re, shutil, unicodedata
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]; OUT=ROOT/'data/v20-8'; SITE='https://trendpilotchoice.com'
def clean(v):return re.sub(r'\s+',' ',str(v or '')).strip()
def norm(v):return re.sub(r'\s+',' ',re.sub(r'[^a-z0-9.-]+',' ',unicodedata.normalize('NFKD',clean(v)).encode('ascii','ignore').decode().lower())).strip()
def label(v):return clean(v).replace('-',' ').title()
def esc(v):return html.escape(clean(v),quote=True)

def safe_brand(title,brand):
    b,t=norm(brand),norm(title)
    return brand if b and re.search(r'(?<![a-z0-9])'+re.escape(b)+r'(?![a-z0-9])',t) else ''

def corrected_type(title,role,old):
    t=norm(title)
    if role=='replacement_part':
        rules=[('power-tool-parts',r'\b(?:drill|saw|grinder|router|sander|power tool|carbon brush|armature|chuck|motor brush)\b'),('air-conditioning-parts',r'\b(?:air conditioner|air conditioning|ac unit|hvac|compressor)\b'),('automotive-parts',r'\b(?:car|vehicle|automotive|atv|utv|winch|caliper|brake|engine|transmission)\b'),('printer-parts',r'\b(?:printer|printhead|toner|inkjet|laserjet)\b'),('phone-parts',r'\b(?:iphone|smartphone|mobile phone|cell phone|galaxy|pixel|redmi|oneplus)\b'),('computer-parts',r'\b(?:laptop|notebook|thinkpad|ideapad|macbook|computer|pc)\b'),('appliance-parts',r'\b(?:washing machine|dryer|vacuum|refrigerator|fridge|dishwasher|coffee machine|appliance)\b')]
        for ty,pat in rules:
            if re.search(pat,t,re.I):return ty
        return 'replacement-parts'
    rules=[('phone',r'\b(?:smartphone|mobile phone|cell phone|iphone|galaxy|pixel|oneplus|redmi|poco|oppo|vivo|realme)\b'),('laptop',r'\b(?:laptop|chromebook|thinkpad|ideapad|thinkbook|macbook|vivobook|zenbook|probook|elitebook|latitude|inspiron|xps)\b'),('perfume',r'\b(?:perfume|fragrance|cologne|eau de parfum|eau de toilette|parfum|edp|edt)\b'),('headphones',r'\b(?:headphones?|headsets?|earbuds?|earphones?|airpods?|tws)\b'),('smartwatch',r'\b(?:smart ?watch|fitness watch|gps watch|apple watch)\b'),('power-bank',r'\b(?:power ?bank|portable charger|external battery)\b'),('medical',r'\b(?:medical|surgical|patient|diagnostic|hospital|clinical|dental)\b'),('diecast-collectibles',r'\b(?:diecast|scale model|model car|model aircraft|collectible)\b'),('3d-printing',r'\b(?:3d printer|3d filament|pla filament|petg filament|abs filament|tpu filament)\b'),('lighting',r'\b(?:lamp|lighting|light fixture|led strip|bulb|ceiling light|wall light|desk lamp|floor lamp)\b'),('cookware',r'\b(?:cookware|frying pan|saucepan|stockpot|casserole|wok|skillet|cooking pot)\b'),('air-conditioning',r'\b(?:air conditioner|portable ac|mini split|ductless ac|split ac)\b'),('tools',r'\b(?:drill|saw|wrench|screwdriver|pliers|multimeter|oscilloscope|soldering iron|grinder|router|ratchet|tool set)\b')]
    for ty,pat in rules:
        if re.search(pat,t,re.I):return ty
    return old or 'unclassified'

def fix(row):
    row['brand']=safe_brand(row.get('title') or row.get('t'),row.get('brand') or row.get('b'))
    if 'b' in row:row['b']=row['brand']
    role=row.get('role') or row.get('ro');old=row.get('type') or row.get('ty')
    ty=corrected_type(row.get('title') or row.get('t'),role,old);row['type']=ty;row['typeLabel']=label(ty)
    if 'ty' in row:row['ty']=ty;row['tyl']=label(ty)
    return row

def signature(row):
    t=norm(row.get('title'));mods=re.findall(r'\b(?=[a-z0-9.-]{4,}\b)(?=[a-z0-9.-]*[a-z])(?=[a-z0-9.-]*\d)[a-z0-9.-]+\b',t);mods=[x for x in mods if x not in {'4pcs','2pcs','3pcs','5pcs','12v','24v','110v','220v'}]
    if len(mods)>=2:return row.get('type','')+'|'+'|'.join(sorted(set(mods))[:6])
    words=[x for x in re.findall(r'[a-z0-9]+',t) if len(x)>3 and x not in {'replacement','parts','accessories','accessory','power','motor','original','tools','product','compatible'}]
    return row.get('type','')+'|'+' '.join(words[:8])

def description(row):
    names={'used-scarce':'used, refurbished or open-box evidence','replacement-part':'specific replacement-part evidence','collector':'collector or limited-edition evidence','discontinued':'discontinued or legacy wording','specialist':'specialist product evidence','low-seller-coverage':'low seller coverage','model-specific':'model or part-number specificity'}
    bits=[names[x] for x in row.get('signals',[]) if x in names][:3] or ['low-coverage catalogue evidence']
    return 'TrendPilot flagged this item as hard to find because it has '+', '.join(bits)+'.'

def seo_html(row):
    canonical=SITE+row['seoUrl'];desc=description(row);price=float(row.get('price') or 0);currency=row.get('currency') or 'USD';ld={'@context':'https://schema.org','@type':'Product','name':row['title'],'image':[row['image']],'description':desc}
    if row.get('brand'):ld['brand']={'@type':'Brand','name':row['brand']}
    if price and row.get('exact'):ld['offers']={'@type':'Offer','priceCurrency':currency,'price':round(price,2),'url':row['url'],'seller':{'@type':'Organization','name':row['seller']}}
    ptxt=(('$' if currency=='USD' else currency+' ')+f'{price:,.2f}'.replace('.00','')) if price and row.get('exact') else 'Check current price';signals=''.join(f'<span>{esc(x.replace("-"," ").title())}</span>' for x in row.get('signals',[])[:5])
    ldjson=json.dumps(ld,ensure_ascii=False).replace('</','<\\/')
    return f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>{esc(row['title'])} — Rare Find | TrendPilot AI</title><meta name="description" content="{esc(desc)}"><meta name="robots" content="index,follow,max-image-preview:large"><link rel="canonical" href="{esc(canonical)}"><meta property="og:type" content="product"><meta property="og:site_name" content="TrendPilot AI"><meta property="og:title" content="{esc(row['title'])}"><meta property="og:description" content="{esc(desc)}"><meta property="og:image" content="{esc(row['image'])}"><meta property="og:url" content="{esc(canonical)}"><meta name="twitter:card" content="summary_large_image"><link rel="stylesheet" href="/css/v20-8-universal.css?v=20.8.0"><script type="application/ld+json">{ldjson}</script></head><body class="tp80-rare-detail"><header class="tp80-minihead"><a href="/"><img src="/images/logo-v4.svg" alt="" width="42" height="42"><b>TrendPilot <em>AI</em></b></a><a href="/find/">Search</a></header><main><nav class="tp80-breadcrumb"><a href="/">Home</a> / <a href="/rare-used/">Rare Finds</a> / <span>{esc(row['typeLabel'])}</span></nav><section class="tp80-detail-hero"><div class="tp80-detail-media"><img src="{esc(row['image'])}" alt="{esc(row['title'])}" width="800" height="800"></div><div class="tp80-detail-copy"><span class="tp80-rare-score">Rare score {int(row['rareScore'])}/100</span><p class="tp80-brand">{esc(row.get('brand') or row['seller'])}</p><h1>{esc(row['title'])}</h1><p class="tp80-price">{esc(ptxt)}</p><div class="tp80-signals">{signals}</div><p>{esc(desc)}</p><div class="tp80-facts"><span><b>Seller</b>{esc(row['seller'])}</span><span><b>Type</b>{esc(row['typeLabel'])}</span><span><b>Condition</b>{esc(row.get('condition') or 'Check seller')}</span></div><a class="tp80-primary" href="{esc(row['url'])}" target="_blank" rel="sponsored nofollow noopener">View seller listing ↗</a><p class="tp80-note">Confirm price, stock, condition and delivery with the seller.</p></div></section><section class="tp80-info"><h2>Why this is a rare find</h2><p>{esc(desc)} Rarity is a discovery signal, not a guarantee of value.</p><a href="/find/?q={esc(row['title'].replace(' ','+'))}&universal=1">Search for similar products</a></section></main></body></html>'''

# Clean compact universal buckets and recalculate public type counts.
type_counts=collections.Counter();records=0
for p in sorted((OUT/'products').glob('*.json')):
    data=json.loads(p.read_text(encoding='utf-8'))
    for k,row in data.items():data[k]=fix(row);type_counts[data[k].get('ty') or data[k].get('type') or 'unclassified']+=1;records+=1
    p.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')),encoding='utf-8')

# Clean + dedupe Rare Finds.
rare_path=OUT/'rare-index.json';rows=[fix(x) for x in json.loads(rare_path.read_text(encoding='utf-8'))];seen=set();out=[];seller_type=collections.Counter()
for row in rows:
    key=(row.get('seller'),signature(row))
    if key in seen:continue
    seen.add(key);cap=(row.get('seller'),row.get('type'));seller_type[cap]+=1
    if seller_type[cap]>24:continue
    out.append(row)
    if len(out)>=500:break
rare_path.write_text(json.dumps(out,ensure_ascii=False,separators=(',',':')),encoding='utf-8')

# Rebuild only the clean, high-evidence indexable Rare pages.
seo_root=ROOT/'rare-used/finds';shutil.rmtree(seo_root,ignore_errors=True);seo_root.mkdir(parents=True,exist_ok=True);seo_rows=[];seller_cap=collections.Counter();type_cap=collections.Counter()
for row in out:
    if not row.get('seoUrl') or not row.get('exact') or not row.get('image') or not row.get('url') or float(row.get('quality') or 0)<70 or int(row.get('rareScore') or 0)<65:continue
    if seller_cap[row.get('seller')]>=30 or type_cap[row.get('type')]>=24:continue
    seller_cap[row.get('seller')]+=1;type_cap[row.get('type')]+=1;fd=ROOT/row['seoUrl'].strip('/');fd.mkdir(parents=True,exist_ok=True);(fd/'index.html').write_text(seo_html(row),encoding='utf-8');seo_rows.append(row)
    if len(seo_rows)>=120:break

sm=['<?xml version="1.0" encoding="UTF-8"?>','<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',f'<url><loc>{SITE}/rare-used/</loc><changefreq>weekly</changefreq></url>']+[f'<url><loc>{html.escape(SITE+x["seoUrl"])}</loc><changefreq>weekly</changefreq></url>' for x in seo_rows]+['</urlset>'];(ROOT/'sitemap-v20-8.xml').write_text('\n'.join(sm)+'\n',encoding='utf-8')
summary_path=OUT/'taxonomy-summary.json';summary=json.loads(summary_path.read_text());summary['types']=[{'slug':k,'label':label(k),'count':v} for k,v in type_counts.most_common()];summary['rarePublished']=len(out);summary['seoRarePages']=len(seo_rows);summary['truthCleanup']={'brandMustAppearInTitle':True,'replacementTypeUsesTitleEvidence':True,'nearDuplicateRareFamiliesCollapsed':True};summary_path.write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8')
manifest_path=OUT/'manifest.json';manifest=json.loads(manifest_path.read_text());manifest['rarePublished']=len(out);manifest['seoPages']=len(seo_rows);manifest['truthCleanup']=summary['truthCleanup'];manifest_path.write_text(json.dumps(manifest,indent=2),encoding='utf-8')
print(json.dumps({'recordsChecked':records,'rarePublishedAfterTruthCleanup':len(out),'seoRarePagesAfterTruthCleanup':len(seo_rows),'universalTypesAfterTruthCleanup':len(type_counts),'brandTruth':True,'taxonomyTruth':True,'deduped':True},indent=2))
