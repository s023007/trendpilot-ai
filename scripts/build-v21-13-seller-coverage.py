#!/usr/bin/env python3
from __future__ import annotations
import json,re
from collections import defaultdict
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
SRC=ROOT/'data/v20-9/products'
OUT=ROOT/'data/v20-9'
BLOCK={'temu','joom','filamentpro','filamentpro eu cps','filamentpro-eu-cps'}
FOOTWEAR_EXCLUDED_SELLERS={'mfi medical'}

# Generic shoes/footwear must mean a product a shopper can actually wear.
INHERENT_FOOT=re.compile(r'\b(?:sneaker|sneakers|sandal|sandals|slipper|slippers|loafer|loafers|moccasin|moccasins|cleat|cleats|clog|clogs|flip[- ]?flops?)\b',re.I)
SHOE_CONTEXT=re.compile(r'(?:\b(?:men|mens|men\x27s|women|womens|women\x27s|girl|girls|boy|boys|kid|kids|children|childrens|baby|toddler|unisex|casual|sport|sports|running|walking|hiking|work|safety|dress|formal|leather|canvas|fashion|athletic|tennis|basketball|soccer|football|golf|dance|ballet|winter|snow|platform|flat|beach|summer|breathable|slip resistant|non-slip|wide fit|wide foot)\b.{0,35}\bshoes?\b)|(?:\bshoes?\b.{0,35}\b(?:men|mens|women|womens|girl|girls|boy|boys|kid|kids|children|baby|toddler|unisex|casual|sport|sports|running|walking|hiking|work|safety|dress|formal|leather|canvas|fashion|athletic|tennis|basketball|soccer|football|golf|dance|ballet|winter|snow|platform|flat|beach|summer|breathable|slip resistant|non-slip|wide fit|wide foot|size|sole|toe)\b)',re.I)
BOOT_CONTEXT=re.compile(r'(?:\b(?:men|mens|women|womens|girl|girls|boy|boys|kid|kids|children|baby|toddler|unisex|work|safety|hiking|winter|snow|ankle|knee|combat|fashion|leather|rain|riding|cowboy|cowgirl|western|motorcycle)\b.{0,30}\bboots?\b)|(?:\bboots?\b.{0,30}\b(?:men|mens|women|womens|girl|girls|boy|boys|kid|kids|children|baby|toddler|unisex|work|safety|hiking|winter|snow|ankle|knee|combat|fashion|leather|rain|riding|cowboy|cowgirl|western|size|sole|toe)\b)',re.I)
HEEL_CONTEXT=re.compile(r'\b(?:high[- ]?heels?|heeled\s+(?:shoes?|sandals?|boots?))\b',re.I)
OXFORD_CONTEXT=re.compile(r'\boxford\s+shoes?\b|\bshoes?\s+oxford\b',re.I)

# Known false semantic uses of shoe/boot/clog/sneaker words. Keep this deliberately phrase-oriented
# so real party shoes, cowboy boots, winter boots etc. are not discarded just because of one word.
FOOT_NEG=re.compile(
    r'(?:'
    r'\b(?:cold shoe|hot shoe|shoe mount|camera shoe|flash shoe)\b|'
    r'\b(?:camera|camcorder|tripod|flash light|flashlight|photography|photo studio|backdrop|background|tv box|mini pc|dual boot|android|usb|wifi|led ring)\b|'
    r'\b(?:phone|iphone|airpods?|earphones?|headphones?|watchband|watch band|bracelet)\b|'
    r'\b(?:protective cases?|phone cases?|silicone case|plastic case|charging cover|back cover)\b|'
    r'\b(?:bottle openers?|wine rack|wine cabinet|cake topper|cup cake topper|cups? with straws?|boot cups?)\b|'
    r'\b(?:shoe pendant|skate shoe pendant|shoe charms?|shoe clips?|shoe buckles?|shoe decorations?|shoe accessories)\b|'
    r'\b(?:jewelry|jewellery|home craft)\b|'
    r'\b(?:boot cut|bootcut)\b|'
    r'\b(?:christmas|xmas)\b.{0,50}\b(?:boot|boots|shoe|shoes)\b|'
    r'\b(?:boot|boots|shoe|shoes)\b.{0,50}\b(?:ornament|ornaments|decoration|decorations|plush pendant)\b|'
    r'\b(?:anti-clog|clog remover|pipe blockage|drain filter|sink strainer|garbage disposal|utility tub)\b|'
    r'\b(?:shoe covers?|shoe racks?|shoe bags?|shoe boxes?|shoelaces?|shoe laces?|insoles?|outsoles?|shoe horns?|shoe brushes?|shoe trees?|shoe stretchers?|shoe dryers?)\b|'
    r'\b(?:shoe machines?|shoe beating machine|shoe molding|shoe making|shoe lasts?|shoe repair|shoe glue|pneumatic hammer|handheld pneumatic hammer|tire maintenance)\b|'
    r'\b(?:brake shoes?|snow blowers?|skid plates?|skid shoes?|guide shoes?|sliding shoes?|sanding shoes?|machine shoes?|elevator shoes?|rail shoes?|crawler shoes?|horseshoes?|horse shoes?)\b|'
    r'\b(?:cv boots?|dust boots?|rack boots?|steering boots?|shift boots?|gear boots?|trunk boots?|boot gas|boot struts?|boot lids?|boot release|boot locks?|boot liners?|boot mats?|boot seals?|ball joint boots?|tie rod boots?|shock boots?|connector boots?|cable boots?)\b|'
    r'\b(?:flooring installation|epoxy shoes?|temperature control iron)\b|'
    r'\b(?:heel wedges?|heel lifts?|orthotics?|orthopedic inserts?|post[- ]?op|postoperative|walker boots?|walking boot braces?|medical boots?|ankle braces?|foot braces?|cast shoes?|fracture boots?|pressure relief boots?|fall management|patient|therapy|pain relief|single patient use)\b'
    r')',re.I)
COSTUME=re.compile(r'\b(?:cosplay|costume|halloween costume|carnival outfit|full outfit)\b',re.I)

# A conservative list used as a release guard. Anything matching this is never allowed into the
# generic shoe index even if an upstream category incorrectly calls it footwear.
RELEASE_BAD=re.compile(r'\b(?:cosplay|costume|cold shoe|hot shoe|boot cut|bootcut|bottle opener|wine rack|shoe pendant|shoe charm|anti-clog|clog remover|snow blower|skid plate|brake shoe|phone case|airpods|shoe machine|shoe molding|flooring installation|epoxy shoe|medical boot|walking boot brace|christmas|xmas)\b',re.I)

PACK_FIELDS=('id','t','im','p','cu','se','b','ty','tyl','fa','ro','r','x','ids','s')

def clean(v): return ' '.join(str(v or '').split()).strip()
def seller(row): return clean(row.get('se') or row.get('seller'))
def title(row): return clean(row.get('t') or row.get('title'))
def role(row): return clean(row.get('ro') or row.get('role') or 'main').lower()
def blocked(name): return name.lower() in BLOCK

def footwear(row):
    t=title(row); s=seller(row).lower()
    if s in FOOTWEAR_EXCLUDED_SELLERS: return False
    if not t or role(row) not in {'main','used'}: return False
    if FOOT_NEG.search(t) or COSTUME.search(t): return False
    return bool(INHERENT_FOOT.search(t) or SHOE_CONTEXT.search(t) or BOOT_CONTEXT.search(t) or HEEL_CONTEXT.search(t) or OXFORD_CONTEXT.search(t))

def rank(row):
    return (int(row.get('r') or 0),1 if row.get('x') else 0,1 if clean(row.get('im')) else 0,1 if row.get('p') else 0,-len(title(row)))

def pack(row,rid):
    out={}
    for k in PACK_FIELDS:
        if k in row and row[k] not in (None,'',[],{}): out[k]=row[k]
    out['id']=rid
    if 'se' not in out: out['se']=seller(row)
    if 't' not in out: out['t']=title(row)
    if 'ro' not in out: out['ro']=role(row)
    return out

foot=defaultdict(list); browse=defaultdict(list)
seen_ids=set(); total=0
for p in sorted(SRC.glob('*.json')):
    try: data=json.loads(p.read_text(encoding='utf-8'))
    except Exception: continue
    if not isinstance(data,dict): continue
    for key,row in data.items():
        if not isinstance(row,dict): continue
        total+=1; rid=clean(row.get('id') or key); s=seller(row); t=title(row)
        if not rid or not s or not t or blocked(s) or rid in seen_ids: continue
        seen_ids.add(rid); packed=pack(row,rid)
        if footwear(row): foot[s].append((rank(row),rid,packed))
        if role(row) in {'main','used'}: browse[s].append((rank(row),rid,packed))

def payload(source,per_seller,kind):
    sellers={}; counts={}; records={}
    for s,rows in sorted(source.items(),key=lambda kv:kv[0].lower()):
        rows.sort(key=lambda x:x[0],reverse=True); ids=[]; used=set()
        for _,rid,row in rows:
            if rid in used: continue
            used.add(rid); ids.append(rid); records[rid]=row
            if len(ids)>=per_seller: break
        if ids: sellers[s]=ids; counts[s]=len(rows)
    return {'version':'21.13.6','kind':kind,'generated_from':'data/v20-9/products/*.json','records_scanned':total,'seller_count':len(sellers),'packed_record_count':len(records),'counts':counts,'sellers':sellers,'records':records}

foot_payload=payload(foot,120,'strict-consumer-footwear-packed')
browse_payload=payload(browse,36,'balanced-browse-packed')

bad_packed=[(rid,row.get('se'),row.get('t')) for rid,row in foot_payload['records'].items() if RELEASE_BAD.search(clean(row.get('t')))]
if bad_packed:
    raise SystemExit('Release guard rejected footwear false positives: '+repr(bad_packed[:20]))

(OUT/'footwear-seller-samples.json').write_text(json.dumps(foot_payload,separators=(',',':'),ensure_ascii=False),encoding='utf-8')
(OUT/'seller-browse-samples.json').write_text(json.dumps(browse_payload,separators=(',',':'),ensure_ascii=False),encoding='utf-8')
print(json.dumps({'footwear_sellers':foot_payload['counts'],'footwear_packed_records':foot_payload['packed_record_count'],'browse_sellers':browse_payload['counts'],'browse_packed_records':browse_payload['packed_record_count'],'records_scanned':total},indent=2,ensure_ascii=False))
if 'TikTok Shop US' not in foot_payload['sellers']: raise SystemExit('Strict footwear index lost the known genuine TikTok footwear inventory')
if foot_payload['packed_record_count']<100: raise SystemExit('Strict footwear packed index is unexpectedly small')
if browse_payload['packed_record_count']<250: raise SystemExit('Balanced browse packed index is unexpectedly small')
