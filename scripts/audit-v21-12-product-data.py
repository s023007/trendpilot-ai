#!/usr/bin/env python3
from __future__ import annotations
import json,re
from collections import Counter,defaultdict
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
SRC=ROOT/'data/v20-9/products'
OUT=ROOT/'artifacts/v21-12-product-data';OUT.mkdir(parents=True,exist_ok=True)
BLOCK=re.compile(r'(?:joom|temu|filamentpro)',re.I)
PHONE_BAD=re.compile(r'\b(?:case|cover|protector|tempered glass|holder|mount|stand|strap|lanyard|charger|charging cable|usb cable|replacement|repair|spare part|screen|digitizer|battery for|tool kit)\b',re.I)
SHOE_BAD=re.compile(r'\b(?:shock absorber|strut|suspension|steering|control arm|stabilizer|bushing|wheel bearing|engine mount|brake|car parts?)\b',re.I)
SHOE_GOOD=re.compile(r'\b(?:shoe|shoes|sneaker|sneakers|boot|boots|sandal|sandals|slipper|slippers|loafer|loafers|heel|heels)\b',re.I)
checks={};failures=[];warnings=[]
def ck(n,ok,d=''):
    checks[n]=bool(ok)
    if not ok:failures.append({'name':n,'detail':str(d)})

def seller(row):return str(row.get('se') or row.get('seller') or '').strip()
def title(row):return str(row.get('t') or row.get('title') or '').strip()
files=sorted(SRC.glob('*.json'))
ck('product_shards_exist',len(files)>0,len(files))
seen={};dupes=[];mismatch=[];blocked=[];negative=[];empty_title=[];empty_seller=[];roles=Counter();families=Counter();sellers=Counter();total=0;phone_main=0;phone_bad=0;apparel_main=0;apparel_good=0;apparel_bad=0;exact=0;exact_missing_url=0
for p in files:
    try:data=json.loads(p.read_text(encoding='utf-8'))
    except Exception as e:failures.append({'name':'invalid_json','detail':f'{p.name}: {e}'});continue
    if not isinstance(data,dict):failures.append({'name':'non_object_shard','detail':p.name});continue
    for key,row in data.items():
        total+=1
        if not isinstance(row,dict):continue
        rid=str(row.get('id') or '')
        if rid and rid!=str(key):mismatch.append((p.name,key,rid))
        if key in seen:dupes.append((key,seen[key],p.name))
        else:seen[key]=p.name
        s=seller(row);t=title(row);ro=str(row.get('ro') or row.get('role') or '');fa=str(row.get('fa') or row.get('family') or row.get('ty') or '')
        roles[ro]+=1;families[fa]+=1;sellers[s]+=1
        if BLOCK.search(s):blocked.append((key,s,t[:100]))
        if not t:empty_title.append(key)
        if not s:empty_seller.append(key)
        try:
            if row.get('p') is not None and float(row.get('p') or 0)<0:negative.append((key,row.get('p')))
        except Exception:pass
        if bool(row.get('x')):
            exact+=1
            if not str(row.get('u') or row.get('url') or '').strip():exact_missing_url+=1
        if fa=='phone' and ro in {'','main'}:
            phone_main+=1
            if PHONE_BAD.search(t):phone_bad+=1
        if fa in {'apparel','shoes','footwear'} and ro in {'','main'}:
            apparel_main+=1
            if SHOE_GOOD.search(t):apparel_good+=1
            if SHOE_BAD.search(t):apparel_bad+=1

ck('product_ids_unique',not dupes,dupes[:20])
ck('product_id_matches_key',not mismatch,mismatch[:20])
ck('public_product_shards_no_blocked_sellers',not blocked,blocked[:20])
ck('public_product_prices_nonnegative',not negative,negative[:20])
ck('public_products_have_titles',len(empty_title)==0,len(empty_title))
ck('public_products_have_sellers',len(empty_seller)==0,len(empty_seller))
ck('exact_records_have_destination',exact_missing_url==0,{'exact':exact,'missing_url':exact_missing_url})
phone_ratio=(phone_bad/phone_main) if phone_main else 0
apparel_bad_ratio=(apparel_bad/apparel_main) if apparel_main else 0
if phone_ratio>0.05:warnings.append({'name':'phone_main_accessory_grammar','detail':{'main':phone_main,'bad':phone_bad,'ratio':phone_ratio}})
if apparel_bad_ratio>0.10:warnings.append({'name':'apparel_family_non_footwear_noise','detail':{'main':apparel_main,'footwear_terms':apparel_good,'automotive_noise':apparel_bad,'ratio':apparel_bad_ratio}})
report={'version':'21.12.0','total_records':total,'shards':len(files),'checks':checks,'failures':failures,'warnings':warnings,'blocked_count':len(blocked),'duplicate_count':len(dupes),'roles':roles,'families':families,'sellers':sellers,'phone_main':phone_main,'phone_bad_grammar':phone_bad,'apparel_main':apparel_main,'apparel_footwear_terms':apparel_good,'apparel_automotive_noise':apparel_bad,'exact_records':exact,'passed':not failures and all(checks.values())}
# JSON-convert Counters
for k in ['roles','families','sellers']:report[k]=dict(report[k])
(OUT/'report.json').write_text(json.dumps(report,indent=2,ensure_ascii=False),encoding='utf-8')
print(json.dumps({k:report[k] for k in ['passed','total_records','shards','blocked_count','duplicate_count','phone_main','phone_bad_grammar','apparel_main','apparel_footwear_terms','apparel_automotive_noise','exact_records','failures','warnings']},indent=2,ensure_ascii=False))
raise SystemExit(0 if report['passed'] else 1)
