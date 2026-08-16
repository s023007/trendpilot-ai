#!/usr/bin/env python3
from __future__ import annotations
import json,re
from collections import defaultdict
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
SRC=ROOT/'data/v20-9/products'
OUT=ROOT/'data/v20-9'
BLOCK={'temu','joom','filamentpro','filamentpro eu cps','filamentpro-eu-cps'}

FOOT_POS=re.compile(r'\b(?:shoe|shoes|sneaker|sneakers|boot|boots|sandal|sandals|slipper|slippers|loafer|loafers|heel|heels|moccasin|moccasins|oxford|oxfords|cleat|cleats|footwear|clog|clogs|flip[- ]?flops?|ballet shoes?|running shoes?|walking shoes?|work boots?|hiking boots?)\b',re.I)
FOOT_NEG=re.compile(r'\b(?:shoe covers?|shoe racks?|shoe bags?|shoe boxes?|shoelaces?|shoe laces?|insoles?|outsoles?|shoe horns?|shoe brushes?|shoe trees?|shoe stretchers?|shoe dryers?|shoe machines?|shoe making|shoe repair|shoe glue|shoe charms?|shoe clips?|shoe buckles?|shoe decorations?|shoe accessories|brake shoes?|snow blowers?|skid plates?|skid shoes?|guide shoes?|sliding shoes?|sanding shoes?|machine shoes?|elevator shoes?|rail shoes?|crawler shoes?|horseshoes?|horse shoes?|cv boots?|dust boots?|rack boots?|steering boots?|shift boots?|gear boots?|trunk boots?|boot gas|boot struts?|boot lids?|boot release|boot locks?|boot liners?|boot mats?|boot seals?|ball joint boots?|tie rod boots?|shock boots?|connector boots?|cable boots?|flooring installation|epoxy shoes?|temperature control iron)\b',re.I)
COSTUME=re.compile(r'\b(?:cosplay|costume|halloween costume|carnival outfit|full outfit)\b',re.I)


def clean(v): return ' '.join(str(v or '').split()).strip()
def seller(row): return clean(row.get('se') or row.get('seller'))
def title(row): return clean(row.get('t') or row.get('title'))
def role(row): return clean(row.get('ro') or row.get('role') or 'main').lower()
def blocked(name): return name.lower() in BLOCK

def footwear(row):
    t=title(row)
    if not t or role(row) not in {'main','used'}: return False
    if not FOOT_POS.search(t): return False
    if FOOT_NEG.search(t) or COSTUME.search(t): return False
    return True

def rank(row):
    return (
        int(row.get('r') or 0),
        1 if row.get('x') else 0,
        1 if clean(row.get('im')) else 0,
        1 if row.get('p') else 0,
        -len(title(row))
    )

foot=defaultdict(list)
browse=defaultdict(list)
seen_ids=set(); total=0
for p in sorted(SRC.glob('*.json')):
    try: data=json.loads(p.read_text(encoding='utf-8'))
    except Exception: continue
    if not isinstance(data,dict): continue
    for key,row in data.items():
        if not isinstance(row,dict): continue
        total+=1
        rid=clean(row.get('id') or key)
        s=seller(row); t=title(row)
        if not rid or not s or not t or blocked(s): continue
        if rid in seen_ids: continue
        seen_ids.add(rid)
        if footwear(row): foot[s].append((rank(row),rid,t))
        if role(row) in {'main','used'}:
            browse[s].append((rank(row),rid,t))


def payload(source,per_seller,kind):
    sellers={}
    counts={}
    for s,rows in sorted(source.items(),key=lambda kv:kv[0].lower()):
        rows.sort(key=lambda x:x[0],reverse=True)
        ids=[]; used=set()
        for _,rid,_ in rows:
            if rid in used: continue
            used.add(rid); ids.append(rid)
            if len(ids)>=per_seller: break
        if ids:
            sellers[s]=ids
            counts[s]=len(rows)
    return {
        'version':'21.13.0',
        'kind':kind,
        'generated_from':'data/v20-9/products/*.json',
        'records_scanned':total,
        'seller_count':len(sellers),
        'counts':counts,
        'sellers':sellers
    }

foot_payload=payload(foot,120,'strict-footwear')
browse_payload=payload(browse,36,'balanced-browse')
(OUT/'footwear-seller-samples.json').write_text(json.dumps(foot_payload,separators=(',',':'),ensure_ascii=False),encoding='utf-8')
(OUT/'seller-browse-samples.json').write_text(json.dumps(browse_payload,separators=(',',':'),ensure_ascii=False),encoding='utf-8')
print(json.dumps({
    'footwear_sellers':foot_payload['counts'],
    'browse_sellers':browse_payload['counts'],
    'footwear_total':sum(foot_payload['counts'].values()),
    'records_scanned':total
},indent=2,ensure_ascii=False))
if len(foot_payload['sellers'])<2:
    raise SystemExit('Strict footwear index unexpectedly has fewer than two sellers')
