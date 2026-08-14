#!/usr/bin/env python3
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
BUILDER=ROOT/'scripts/build-v20-8-universal-discovery.py'
CSS=ROOT/'css/v20-8-universal.css'
FIND=ROOT/'find/index.html'
RARE=ROOT/'rare-used/index.html'

b=BUILDER.read_text(encoding='utf-8')
b=b.replace("V='20.8.0'","V='20.8.1'")
if "'carbon brush'" not in b.split('SPECIAL=',1)[1].split('\n',1)[0]:
    b=b.replace("'replacement part')","'replacement part','carbon brush')")

start=b.find("    for r in rows:\n        score=")
end=b.find("    if OUT.exists():shutil.rmtree(OUT)",start)
if start<0 or end<0:
    raise SystemExit('Could not locate rarity scoring section')

score='''    for r in rows:\n        score=12.;sig=[];t=n(r['title']);cond=n(r['condition']);strong_rarity=False\n        if cond in USED:\n            score+=18;sig.append('used-scarce');strong_rarity=True\n        if r['role']=='replacement_part':\n            score+=12;sig.append('replacement-part')\n        add=0\n        for term,val in RARE.items():\n            if term in t:\n                weight={'rare':15,'hard to find':18,'hard-to-find':18,'discontinued':28,'obsolete':24,'vintage':22,'limited edition':20,'collector':18,'collectible':18,'new old stock':24,'surplus':12,'legacy':12,'classic':8,'out of production':28,'replacement':6,'spare':5,'oem':4}.get(term,val)\n                add=max(add,weight)\n                if term in {'discontinued','obsolete','out of production','legacy'}:\n                    if 'discontinued' not in sig:sig.append('discontinued')\n                    strong_rarity=True\n                if term in {'limited edition','collector','collectible','vintage','classic','new old stock'}:\n                    if 'collector' not in sig:sig.append('collector')\n                    strong_rarity=True\n                if term in {'rare','hard to find','hard-to-find'}:strong_rarity=True\n        score+=add\n        if any(x in t for x in SPECIAL):score+=8;sig.append('specialist')\n        if re.search(r'\\b(?=[a-z0-9.-]{4,}\\b)(?=[a-z0-9.-]*[a-z])(?=[a-z0-9.-]*\\d)[a-z0-9.-]+\\b',t):score+=8;sig.append('model-specific')\n        tc=len(toks(r['title']));score+=5 if tc>=9 else 3 if tc>=6 else 0\n        cn=cats[r['category']];score+=12 if cn<=10 else 8 if cn<=50 else 5 if cn<=200 else 2 if cn<=800 else 0\n        same=ids_count[r['identity']]\n        if r['strongIdentity'] and same==1:score+=10;sig.append('low-seller-coverage')\n        elif r['strongIdentity'] and same==2:score+=6\n        else:score+=2\n        score+=5 if r['exact'] else 0;score+=3 if r['image'] else 0;score+=1 if r['price'] else 0;score+=4 if r['quality']>=80 else 2 if r['quality']>=70 else 0\n        score-=15 if tc<=2 else 0\n        if r['role']=='accessory' and not set(sig)&{'used-scarce','collector','discontinued','specialist'}:score-=10\n        if not strong_rarity:score=min(score,84)\n        if r['role']=='replacement_part' and not strong_rarity:score=min(score,79)\n        r['rareScore']=max(0,min(100,round(score)));r['signals']=list(dict.fromkeys(sig or (['hard-to-find'] if score>=60 else [])));r['search']=n(' '.join([r['title'],r['brand'],r['typeLabel'],r['sourceCategory'],r['sourceSubcategory'],r['mpn'],r['gtin'],r['model'],r['sellerProductId']]))\n'''
b=b[:start]+score+b[end:]

if 'def rarity_label(score):' not in b:
    helper="""def rarity_label(score):\n    score=int(score or 0)\n    if score>=90:return f'Exceptional find · {score}'\n    if score>=80:return f'Very rare · {score}'\n    if score>=65:return f'Hard to find · {score}'\n    return f'Specialist find · {score}'\n\n"""
    b=b.replace('def seo_html(r):\n',helper+'def seo_html(r):\n')
b=b.replace("Rare score {r['rareScore']}/100","{esc(rarity_label(r['rareScore']))}")
BUILDER.write_text(b,encoding='utf-8')

css=CSS.read_text(encoding='utf-8')
if 'V20.8.1 truth calibration' not in css:
    css+='''\n/* V20.8.1 truth calibration */\n.tp80-price-proof{display:inline-flex;width:max-content;margin:5px 0 2px;padding:5px 9px;border-radius:999px;font-size:11px;font-weight:900}.tp80-price-proof.verified{background:#e7f8f1;color:#08765a}.tp80-price-proof.feed{background:#fff4dc;color:#8a5800}.tp80-price-proof.check{background:#f2f4f7;color:#667085}.tp80-route-note{display:block;margin-top:8px;color:#667085;line-height:1.4}.tp78-primary.seller-search{background:#fff;color:#3157e8;border:1px solid #b9c7f8}.tp78-primary.exact{background:#3157e8;color:#fff}.tp80-universal-card .tp80-mini-rare{margin-top:6px}\n'''
CSS.write_text(css,encoding='utf-8')

for page in (FIND,RARE):
    txt=page.read_text(encoding='utf-8').replace('v=20.8.0','v=20.8.1')
    page.write_text(txt,encoding='utf-8')

print('V20.8.1 builder calibration applied')
