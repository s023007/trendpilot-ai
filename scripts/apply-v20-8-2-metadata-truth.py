#!/usr/bin/env python3
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
BUILDER=ROOT/'scripts/build-v20-8-universal-discovery.py'
UNIVERSAL=ROOT/'js/universal-discovery-v20-8.js'
RARE_JS=ROOT/'js/rare-finds-v20-8.js'
FIND=ROOT/'find/index.html'
RARE_HUB=ROOT/'rare-used/index.html'

b=BUILDER.read_text(encoding='utf-8')
b=b.replace("V='20.8.1'","V='20.8.2'")
old_repl="REPL=re.compile(r'\\b(?:replacement|spare part|repair part|replacement part|battery for|filter for|belt for|gasket for|brush for|carbon brush|cartridge for|sensor for|screen for|display for|charging port|flex cable|motherboard|pcb board|oem part|compatible with|fits?)\\b',re.I)"
new_repl="REPL=re.compile(r'\\b(?:replacement(?:\\s+part)?|spare\\s+part|repair\\s+part|battery\\s+for|filter\\s+for|belt\\s+for|gasket\\s+for|carbon\\s+brush|cartridge\\s+for|sensor\\s+for|screen\\s+for|display\\s+for|charging\\s+port|flex\\s+cable|motherboard|pcb\\s+board|oem\\s+part)\\b',re.I)"
if old_repl in b:b=b.replace(old_repl,new_repl)
elif 'compatible with|fits?' in b:raise SystemExit('Could not safely replace REPL grammar')

start=b.find('def product_type(rec,title):\n')
end=b.find('def role(title,condition):\n',start)
if start<0 or end<0:raise SystemExit('Could not locate product_type block')
replacement='''def product_type(rec,title):\n    text=n(title)\n    # Explicit title evidence beats stale seller taxonomy for specialist parts.\n    if re.search(r'\\b(?:carbon brush|armature|stator|rotor)\\b',text) and re.search(r'\\b(?:power tool|drill|saw|sander|grinder|router|motor)\\b',text): return 'power-tool-parts'\n    if re.search(r'\\bair conditioner\\b',text) and re.search(r'\\b(?:board|receiver|sensor|part|remote|motor|compressor|fan)\\b',text): return 'air-conditioning-parts'\n    for name,pat in TYPE:\n        if pat.search(title): return name\n    tax=rec.get('taxonomy') or {}; path=tax.get('canonicalPath') or []\n    if isinstance(path,list) and path:\n        last=c(path[-1]).lower().replace('_','-')\n        if last and last not in {'other','misc','general','products','product'}: return slug(last)\n    for v in (tax.get('sourceSubcategory'),tax.get('canonicalCategory'),tax.get('sourceCategory')):\n        if c(v) and n(v) not in {'other','misc','general'}: return slug(v)\n    return 'unclassified'\n\ndef brand_truth(raw,title,seller):\n    raw=c(raw); nr=n(raw); nt=n(title); ns=n(seller)\n    if raw and nr and nr!=ns and f' {nr} ' in f' {nt} ': return raw\n    m=re.search(r'\\bby\\s+([A-Z][A-Za-z0-9&.-]*(?:\\s+[A-Z][A-Za-z0-9&.-]*){0,2})\\b',c(title))\n    if m:\n        cand=c(m.group(1)); nc=n(cand)\n        if nc and nc not in {ns,'seller','store','shop','official','factory','manufacturer'}: return cand\n    return ''\n\n'''
b=b[:start]+replacement+b[end:]
b=b.replace("'brand':c(r.get('brand'))","'brand':brand_truth(r.get('brand'),title,sn)")

# Vintage/classic language is often a style descriptor, not evidence that an item itself is old or collectible.
b=b.replace("'vintage':22","'vintage':8")
b=b.replace("{'limited edition','collector','collectible','vintage','classic','new old stock'}","{'limited edition','collector','collectible','new old stock'}")

old="rare=sorted([r for r in rows if r['rareScore']>=60 and r['image'] and r['url'] and r['quality']>=65],key=lambda x:(x['rareScore'],x['exact'],x['quality'],bool(x['price'])),reverse=True); rout=[];tc=collections.Counter();sc=collections.Counter()\n    for r in rare:\n        if tc[r['type']]>=90 or sc[r['seller']]>=140:continue\n        tc[r['type']]+=1;sc[r['seller']]+=1;rout.append(r.copy())"
new="rare=sorted([r for r in rows if r['rareScore']>=60 and r['image'] and r['url'] and r['quality']>=65],key=lambda x:(x['rareScore'],x['exact'],x['quality'],bool(x['price'])),reverse=True); rout=[];tc=collections.Counter();sc=collections.Counter();seen_sim=set()\n    for r in rare:\n        sim=(r['seller'],r['type'],r['role'],' '.join(toks(r['title'])[:7]))\n        if sim in seen_sim:continue\n        if tc[r['type']]>=90 or sc[r['seller']]>=140:continue\n        seen_sim.add(sim);tc[r['type']]+=1;sc[r['seller']]+=1;rout.append(r.copy())"
if old in b:b=b.replace(old,new)
elif 'seen_sim=set()' not in b:raise SystemExit('Could not locate rare publication loop')
BUILDER.write_text(b,encoding='utf-8')

for p in (UNIVERSAL,RARE_JS):
    txt=p.read_text(encoding='utf-8').replace('20.8.1','20.8.2')
    p.write_text(txt,encoding='utf-8')
for p in (FIND,RARE_HUB):
    txt=p.read_text(encoding='utf-8').replace('v=20.8.1','v=20.8.2')
    p.write_text(txt,encoding='utf-8')

print('V20.8.2 metadata truth normalization applied')
