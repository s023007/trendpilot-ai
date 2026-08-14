#!/usr/bin/env python3
from __future__ import annotations
import collections, hashlib, html, json, math, re, shutil, unicodedata
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

ROOT=Path(__file__).resolve().parents[1]; CAT=ROOT/'data/catalog-v19'; OUT=ROOT/'data/v20-8'; SITE='https://trendpilotchoice.com'; V='20.8.2'
BLOCK={'temu','joom','filamentpro','filamentpro eu cps','filamentpro-eu-cps'}
STOP={'the','and','for','with','from','this','that','your','our','new','best','sale','hot','price','buy','original','official','wholesale','factory','global','product','products','item','items','pcs','piece','pieces','pack','set','sets','of','to','in','on','by','a','an'}
USED={'used','refurbished','open-box','open box','renewed','pre-owned','preowned'}
REPL=re.compile(r'\b(?:replacement(?:\s+part)?|spare\s+part|repair\s+part|battery\s+for|filter\s+for|belt\s+for|gasket\s+for|carbon\s+brush|cartridge\s+for|sensor\s+for|screen\s+for|display\s+for|charging\s+port|flex\s+cable|motherboard|pcb\s+board|oem\s+part)\b',re.I)
ACC=re.compile(r'\b(?:case|cover|holder|stand|mount|strap|lanyard|sleeve|pouch|organizer|adapter|charger|charging cable|usb cable|cable|cord|dock|bag|screen protector|tempered glass)\b',re.I)
RARE={'rare':24,'hard to find':24,'hard-to-find':24,'discontinued':24,'obsolete':22,'vintage':8,'limited edition':20,'collector':18,'collectible':18,'new old stock':22,'surplus':16,'legacy':12,'classic':10,'out of production':22,'replacement':12,'spare':10,'oem':10}
SPECIAL=('industrial','laboratory','medical','surgical','dental','aviation','aircraft','cnc','oscilloscope','multimeter','sensor','calibrator','microscope','diagnostic','hydraulic','pneumatic','bearing','gasket','carburetor','relay','solenoid','encoder','servo','diecast','scale model','model car','model aircraft','filament','3d printer','replacement part','carbon brush')
TYPE=[('phone',r'\b(?:smartphone|mobile phone|cell phone|iphone|galaxy|pixel|oneplus|redmi|poco|oppo|vivo|realme)\b'),('laptop',r'\b(?:laptop|notebook computer|chromebook|thinkpad|ideapad|thinkbook|macbook|vivobook|zenbook|probook|elitebook|latitude|inspiron|xps)\b'),('perfume',r'\b(?:perfume|fragrance|cologne|eau de parfum|eau de toilette|parfum|edp|edt)\b'),('headphones',r'\b(?:headphones?|headsets?|earbuds?|earphones?|airpods?|tws)\b'),('smartwatch',r'\b(?:smart ?watch|fitness watch|gps watch|apple watch)\b'),('power-bank',r'\b(?:power ?bank|portable charger|external battery)\b'),('tools',r'\b(?:drill|saw|wrench|screwdriver|pliers|multimeter|oscilloscope|soldering iron|grinder|router|ratchet|tool set)\b'),('medical',r'\b(?:medical|surgical|patient|diagnostic|hospital|clinical|dental)\b'),('diecast-collectibles',r'\b(?:diecast|scale model|model car|model aircraft|collectible)\b'),('3d-printing',r'\b(?:3d printer|3d filament|pla filament|petg filament|abs filament|tpu filament)\b'),('lighting',r'\b(?:lamp|lighting|light fixture|led strip|bulb|ceiling light|wall light|desk lamp|floor lamp)\b'),('cookware',r'\b(?:cookware|frying pan|saucepan|stockpot|casserole|wok|skillet|cooking pot)\b'),('pet-supplies',r'\b(?:dog food|cat food|pet food|dog treat|cat treat|pet supplies)\b'),('jewelry-craft',r'\b(?:beads?|jewelry|jewellery|charms?|pendant|bracelet|necklace|earrings?)\b'),('air-conditioning',r'\b(?:air conditioner|portable ac|mini split|ductless ac|split ac)\b')]
TYPE=[(n,re.compile(p,re.I)) for n,p in TYPE]

def c(v): return re.sub(r'\s+',' ',str(v or '')).strip()
def n(v): return re.sub(r'\s+',' ',re.sub(r'[^a-z0-9.+#/-]+',' ',unicodedata.normalize('NFKD',c(v)).encode('ascii','ignore').decode().lower())).strip()
def slug(v): return (re.sub(r'[^a-z0-9]+','-',n(v).replace('+',' plus ')).strip('-')[:100] or 'product')
def toks(v): return [x for x in re.findall(r'[a-z0-9]+(?:[.-][a-z0-9]+)*',n(v)) if x not in STOP and (len(x)>=3 or (len(x)>=2 and re.search('[a-z]',x) and re.search(r'\d',x)))]
def esc(v): return html.escape(c(v),quote=True)
def placeholder(u): return (not u) or bool(re.search(r'(?:no[-_ ]?(?:photo|image)|placeholder|image[-_ ]?not[-_ ]?available|default[-_ ]?(?:product|image)|blank[-_ ]?image)',u,re.I))

def product_type(rec,title):
    text=n(title)
    # Explicit title evidence beats stale seller taxonomy for specialist parts.
    if re.search(r'\b(?:carbon brush|armature|stator|rotor)\b',text) and re.search(r'\b(?:power tool|drill|saw|sander|grinder|router|motor)\b',text): return 'power-tool-parts'
    if re.search(r'\bair conditioner\b',text) and re.search(r'\b(?:board|receiver|sensor|part|remote|motor|compressor|fan)\b',text): return 'air-conditioning-parts'
    for name,pat in TYPE:
        if pat.search(title): return name
    tax=rec.get('taxonomy') or {}; path=tax.get('canonicalPath') or []
    if isinstance(path,list) and path:
        last=c(path[-1]).lower().replace('_','-')
        if last and last not in {'other','misc','general','products','product'}: return slug(last)
    for v in (tax.get('sourceSubcategory'),tax.get('canonicalCategory'),tax.get('sourceCategory')):
        if c(v) and n(v) not in {'other','misc','general'}: return slug(v)
    return 'unclassified'

def brand_truth(raw,title,seller):
    raw=c(raw); nr=n(raw); nt=n(title); ns=n(seller)
    if raw and nr and nr!=ns and f' {nr} ' in f' {nt} ': return raw
    m=re.search(r'\bby\s+([A-Z][A-Za-z0-9&.-]*(?:\s+[A-Z][A-Za-z0-9&.-]*){0,2})\b',c(title))
    if m:
        cand=c(m.group(1)); nc=n(cand)
        if nc and nc not in {ns,'seller','store','shop','official','factory','manufacturer'}: return cand
    return ''

def role(title,condition):
    if n(condition) in USED: return 'used'
    if REPL.search(title): return 'replacement_part'
    if ACC.search(title): return 'accessory'
    return 'main'

def identity(rec,seller_slug):
    ids=rec.get('identifiers') or {}
    for k in ('gtin','ean','upc','isbn'):
        if n(ids.get(k)): return f'{k}:{n(ids[k])}',True
    brand=n(rec.get('brand')); mpn=n(ids.get('mpn')); model=n(ids.get('model')); conf=n((rec.get('identity') or {}).get('modelConfidence'))
    if brand and mpn: return f'brand-mpn:{brand}:{mpn}',True
    if brand and model and conf=='explicit': return f'brand-model:{brand}:{model}',True
    return f'seller:{seller_slug}:{n(rec.get("productKey"))}',False

def exact_link(rec,slug_,network):
    links=rec.get('links') or {}; u=c(links.get('affiliateUrl') or links.get('destinationUrl'))
    if not u:return False
    try:p=urlparse(u); path=p.path.lower()
    except:return False
    if slug_ in {'alibaba','tiktok-shop-us'}:return False
    if n(network)=='cj':return len(path.strip('/'))>2
    if slug_=='aliexpress':return '/item/' in path or bool(re.search(r'/\d{8,}\.html',path))
    if slug_=='geekbuying':return len(path.strip('/'))>8 and not any(x in path for x in ('/category/','/search','/promotion'))
    return len(path.strip('/'))>8

def price(rec):
    try:
        x=float((rec.get('offer') or {}).get('price')); return x if math.isfinite(x) and x>0 else 0
    except:return 0

def desc(r):
    m={'used-scarce':'used, refurbished or open-box evidence','replacement-part':'specific replacement-part evidence','collector':'collector or limited-edition evidence','discontinued':'discontinued or legacy wording','specialist':'specialist product evidence','low-seller-coverage':'low seller coverage'}
    bits=[m[x] for x in r['signals'] if x in m][:3] or ['low-coverage catalogue evidence']
    return 'TrendPilot flagged this item as hard to find because it has '+', '.join(bits)+'.'

def rarity_label(score):
    score=int(score or 0)
    if score>=90:return f'Exceptional find · {score}'
    if score>=80:return f'Very rare · {score}'
    if score>=65:return f'Hard to find · {score}'
    return f'Specialist find · {score}'

def seo_html(r):
    canonical=SITE+r['seoUrl']; description=desc(r); img=r['image']; offer=None
    if r['price'] and r['exact']:
        offer={'@type':'Offer','priceCurrency':r['currency'],'price':round(r['price'],2),'url':r['url'],'seller':{'@type':'Organization','name':r['seller']}}
    ld={'@context':'https://schema.org','@type':'Product','name':r['title'],'image':[img],'description':description}
    if r['brand']:ld['brand']={'@type':'Brand','name':r['brand']}
    if r['sellerProductId']:ld['sku']=r['sellerProductId']
    if r['mpn']:ld['mpn']=r['mpn']
    if r['gtin']:ld['gtin']=r['gtin']
    if offer:ld['offers']=offer
    signals=''.join(f'<span>{esc(x.replace("-"," ").title())}</span>' for x in r['signals'][:5])
    ptxt=(('$' if r['currency']=='USD' else r['currency']+' ')+f'{r["price"]:,.2f}'.replace('.00','')) if r['price'] and r['exact'] else 'Check current price'
    return f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>{esc(r['title'])} — Rare Find | TrendPilot AI</title><meta name="description" content="{esc(description)}"><meta name="robots" content="index,follow,max-image-preview:large"><link rel="canonical" href="{esc(canonical)}"><meta property="og:type" content="product"><meta property="og:site_name" content="TrendPilot AI"><meta property="og:title" content="{esc(r['title'])}"><meta property="og:description" content="{esc(description)}"><meta property="og:image" content="{esc(img)}"><meta property="og:url" content="{esc(canonical)}"><meta name="twitter:card" content="summary_large_image"><link rel="stylesheet" href="/css/v20-8-universal.css?v={V}"><script type="application/ld+json">{json.dumps(ld,ensure_ascii=False).replace('</','<\\/')}</script></head><body class="tp80-rare-detail"><header class="tp80-minihead"><a href="/"><img src="/images/logo-v4.svg" alt="" width="42" height="42"><b>TrendPilot <em>AI</em></b></a><a href="/find/">Search</a></header><main><nav class="tp80-breadcrumb"><a href="/">Home</a> / <a href="/rare-used/">Rare Finds</a> / <span>{esc(r['typeLabel'])}</span></nav><section class="tp80-detail-hero"><div class="tp80-detail-media"><img src="{esc(img)}" alt="{esc(r['title'])}" width="800" height="800"></div><div class="tp80-detail-copy"><span class="tp80-rare-score">{esc(rarity_label(r['rareScore']))}</span><p class="tp80-brand">{esc(r['brand'] or r['seller'])}</p><h1>{esc(r['title'])}</h1><p class="tp80-price">{esc(ptxt)}</p><div class="tp80-signals">{signals}</div><p>{esc(description)}</p><div class="tp80-facts"><span><b>Seller</b>{esc(r['seller'])}</span><span><b>Type</b>{esc(r['typeLabel'])}</span><span><b>Condition</b>{esc(r['condition'] or 'Check seller')}</span></div><a class="tp80-primary" href="{esc(r['url'])}" target="_blank" rel="sponsored nofollow noopener">View seller listing ↗</a><p class="tp80-note">Confirm price, stock, condition and delivery with the seller.</p></div></section><section class="tp80-info"><h2>Why this is a rare find</h2><p>{esc(description)} Rarity is a discovery signal, not a guarantee of value.</p><a href="/find/?q={esc(r['title'].replace(' ','+'))}&universal=1">Search for similar products</a></section></main></body></html>'''

def main():
    cs=json.loads((CAT/'catalog-set-v1.json').read_text()); approved={x['slug']:x['name'] for x in cs.get('sellers',[]) if n(x.get('slug')) not in BLOCK and n(x.get('name')) not in BLOCK}
    rows=[]; cats=collections.Counter(); ids_count=collections.Counter(); sellers=collections.Counter(); types=collections.Counter(); roles=collections.Counter()
    for sl,pub in approved.items():
        f=CAT/'sellers'/sl/'products.ndjson'
        if not f.exists():continue
        for line in f.open(encoding='utf-8',errors='ignore'):
            try:r=json.loads(line)
            except:continue
            seller=r.get('seller') or {}; sn=c(seller.get('name') or pub); ssl=n(seller.get('slug') or sl)
            if ssl in BLOCK or n(sn) in BLOCK:continue
            title=c((r.get('name') or {}).get('display'))
            if len(title)<4:continue
            tax=r.get('taxonomy') or {}; cond=c((r.get('offer') or {}).get('condition') or ((r.get('specs') or {}).get('sourceFields') or {}).get('condition')); ty=product_type(r,title); ro=role(title,cond); ident,strong=identity(r,sl)
            media=c((r.get('media') or {}).get('imageUrl')); links=r.get('links') or {}; url=c(links.get('affiliateUrl') or links.get('destinationUrl')); net=c(seller.get('network') or (r.get('source') or {}).get('network')); ex=exact_link(r,sl,net); pr=price(r); cur=c((r.get('offer') or {}).get('currency') or 'USD').upper(); idf=r.get('identifiers') or {}; qual=r.get('quality') or {}; qs=float(qual.get('inputQuality') or 0); qs=max(qs,70 if qual.get('sourceQualified') else 0); uid=hashlib.sha1(c(r.get('productKey') or f'{sl}:{title}').encode()).hexdigest()[:14]
            cat=ty; cats[cat]+=1; ids_count[ident]+=1; sellers[sn]+=1; types[ty]+=1; roles[ro]+=1
            rows.append({'id':uid,'title':title,'brand':brand_truth(r.get('brand'),title,sn),'type':ty,'typeLabel':ty.replace('-',' ').title(),'category':cat,'sourceCategory':c(tax.get('sourceCategory')),'sourceSubcategory':c(tax.get('sourceSubcategory')),'seller':sn,'sellerSlug':sl,'network':net,'role':ro,'condition':cond,'price':pr,'currency':cur,'image':'' if placeholder(media) else media,'url':url,'exact':ex,'quality':round(qs,1),'identity':ident,'strongIdentity':strong,'sellerProductId':c(idf.get('sellerProductId')),'mpn':c(idf.get('mpn')),'gtin':c(idf.get('gtin') or idf.get('ean') or idf.get('upc') or idf.get('isbn')),'model':c(idf.get('model'))})
    for r in rows:
        score=12.;sig=[];t=n(r['title']);cond=n(r['condition']);strong_rarity=False
        if cond in USED:
            score+=18;sig.append('used-scarce');strong_rarity=True
        if r['role']=='replacement_part':
            score+=12;sig.append('replacement-part')
        add=0
        for term,val in RARE.items():
            if term in t:
                weight={'rare':15,'hard to find':18,'hard-to-find':18,'discontinued':28,'obsolete':24,'vintage':8,'limited edition':20,'collector':18,'collectible':18,'new old stock':24,'surplus':12,'legacy':12,'classic':8,'out of production':28,'replacement':6,'spare':5,'oem':4}.get(term,val)
                add=max(add,weight)
                if term in {'discontinued','obsolete','out of production','legacy'}:
                    if 'discontinued' not in sig:sig.append('discontinued')
                    strong_rarity=True
                if term in {'limited edition','collector','collectible','new old stock'}:
                    if 'collector' not in sig:sig.append('collector')
                    strong_rarity=True
                if term in {'rare','hard to find','hard-to-find'}:strong_rarity=True
        score+=add
        if any(x in t for x in SPECIAL):score+=8;sig.append('specialist')
        if re.search(r'\b(?=[a-z0-9.-]{4,}\b)(?=[a-z0-9.-]*[a-z])(?=[a-z0-9.-]*\d)[a-z0-9.-]+\b',t):score+=8;sig.append('model-specific')
        tc=len(toks(r['title']));score+=5 if tc>=9 else 3 if tc>=6 else 0
        cn=cats[r['category']];score+=12 if cn<=10 else 8 if cn<=50 else 5 if cn<=200 else 2 if cn<=800 else 0
        same=ids_count[r['identity']]
        if r['strongIdentity'] and same==1:score+=10;sig.append('low-seller-coverage')
        elif r['strongIdentity'] and same==2:score+=6
        else:score+=2
        score+=5 if r['exact'] else 0;score+=3 if r['image'] else 0;score+=1 if r['price'] else 0;score+=4 if r['quality']>=80 else 2 if r['quality']>=70 else 0
        score-=15 if tc<=2 else 0
        if r['role']=='accessory' and not set(sig)&{'used-scarce','collector','discontinued','specialist'}:score-=10
        if not strong_rarity:score=min(score,84)
        if r['role']=='replacement_part' and not strong_rarity:score=min(score,79)
        r['rareScore']=max(0,min(100,round(score)));r['signals']=list(dict.fromkeys(sig or (['hard-to-find'] if score>=60 else [])));r['search']=n(' '.join([r['title'],r['brand'],r['typeLabel'],r['sourceCategory'],r['sourceSubcategory'],r['mpn'],r['gtin'],r['model'],r['sellerProductId']]))
    if OUT.exists():shutil.rmtree(OUT)
    (OUT/'terms').mkdir(parents=True);(OUT/'products').mkdir(parents=True)
    freq=collections.Counter(); rt={}
    for r in rows:rt[r['id']]=list(dict.fromkeys(toks(r['search'])))[:24];freq.update(rt[r['id']])
    ordered=sorted(rows,key=lambda x:(x['rareScore'],x['quality'],x['exact'],bool(x['image'])),reverse=True); pb=collections.defaultdict(dict); term=collections.defaultdict(list)
    for r in ordered:
        pb[r['id'][0]][r['id']]={'id':r['id'],'t':r['title'],'b':r['brand'],'ty':r['type'],'tyl':r['typeLabel'],'se':r['seller'],'p':r['price'],'cu':r['currency'],'im':r['image'],'u':r['url'],'x':r['exact'],'r':r['rareScore'],'sg':r['signals'],'ro':r['role'],'co':r['condition'],'s':r['search'],'ids':[x for x in (r['mpn'],r['gtin'],r['model'],r['sellerProductId']) if x]}
        for tk in rt[r['id']]:
            if freq[tk]<=2500 and len(term[tk])<900:term[tk].append(r['id'])
    for b,z in pb.items():(OUT/'products'/f'{b}.json').write_text(json.dumps(z,ensure_ascii=False,separators=(',',':')))
    sh=collections.defaultdict(dict)
    for tk,v in term.items():sh[re.sub('[^a-z0-9]','',tk)[:2].ljust(2,'_') or '__'][tk]=v
    for p,z in sh.items():(OUT/'terms'/f'{p}.json').write_text(json.dumps(z,ensure_ascii=False,separators=(',',':')))
    rare=sorted([r for r in rows if r['rareScore']>=60 and r['image'] and r['url'] and r['quality']>=65],key=lambda x:(x['rareScore'],x['exact'],x['quality'],bool(x['price'])),reverse=True); rout=[];tc=collections.Counter();sc=collections.Counter();seen_sim=set()
    for r in rare:
        sim=(r['seller'],r['type'],r['role'],' '.join(toks(r['title'])[:7]))
        if sim in seen_sim:continue
        if tc[r['type']]>=90 or sc[r['seller']]>=140:continue
        seen_sim.add(sim);tc[r['type']]+=1;sc[r['seller']]+=1;rout.append(r.copy())
        if len(rout)>=800:break
    seo=ROOT/'rare-used/finds';shutil.rmtree(seo,ignore_errors=True);seo.mkdir(parents=True);cnt=0;tc=collections.Counter();sc=collections.Counter()
    for r in rout:
        if cnt>=120:break
        if not(r['exact'] and r['image'] and r['url'] and r['quality']>=70 and r['rareScore']>=65):continue
        if tc[r['type']]>=24 or sc[r['seller']]>=30:continue
        tc[r['type']]+=1;sc[r['seller']]+=1;r['seoUrl']=f"/rare-used/finds/{slug(r['title'])}-{r['id']}/";fd=seo/(slug(r['title'])+'-'+r['id']);fd.mkdir();(fd/'index.html').write_text(seo_html(r));cnt+=1
    public=[{k:r.get(k) for k in ('id','title','brand','type','typeLabel','category','seller','sellerSlug','role','condition','price','currency','image','url','exact','quality','rareScore','signals','seoUrl') if r.get(k) not in (None,'')} for r in rout]
    (OUT/'rare-index.json').write_text(json.dumps(public,ensure_ascii=False,separators=(',',':')))
    summary={'version':V,'generatedAt':datetime.now(timezone.utc).isoformat(),'records':len(rows),'types':[{'slug':k,'label':k.replace('-',' ').title(),'count':v} for k,v in types.most_common()],'roles':dict(roles),'sellers':[{'name':k,'count':v} for k,v in sellers.most_common()],'rareCandidates':len(rare),'rarePublished':len(public),'seoRarePages':cnt,'termShards':len(sh),'productBuckets':len(pb)}
    (OUT/'taxonomy-summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2));(OUT/'manifest.json').write_text(json.dumps({'version':V,'records':len(rows),'rarePublished':len(public),'seoPages':cnt,'policy':{'blockedSellers':sorted(BLOCK),'universalTaxonomy':True,'searchPages':'noindex','rareSeoPages':'high-evidence exact-destination candidates only'}},indent=2))
    urls=[SITE+'/rare-used/']+[SITE+r['seoUrl'] for r in rout if r.get('seoUrl')];sm=['<?xml version="1.0" encoding="UTF-8"?>','<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']+[f'<url><loc>{html.escape(u)}</loc><changefreq>weekly</changefreq></url>' for u in urls]+['</urlset>'];(ROOT/'sitemap-v20-8.xml').write_text('\n'.join(sm)+'\n')
    rb=ROOT/'robots.txt';txt=rb.read_text();line=f'Sitemap: {SITE}/sitemap-v20-8.xml';rb.write_text(txt.rstrip()+'\n'+(line+'\n' if line not in txt else ''))
    print(json.dumps(summary,ensure_ascii=False,indent=2))
if __name__=='__main__':main()
