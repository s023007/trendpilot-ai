#!/usr/bin/env python3
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
B=ROOT/'scripts/build-v20-8-universal-discovery.py'
U=ROOT/'js/universal-discovery-v20-8.js'
R=ROOT/'js/rare-finds-v20-8.js'
F=ROOT/'find/index.html'
H=ROOT/'rare-used/index.html'

b=B.read_text(encoding='utf-8')
b=b.replace("from urllib.parse import urlparse","from urllib.parse import urlparse, parse_qs, unquote")
b=b.replace("V='20.8.3'","V='20.8.4'")
start=b.find('def exact_link(rec,slug_,network):\n')
end=b.find('def price(rec):\n',start)
if start<0 or end<0: raise SystemExit('Could not locate exact_link function')
new='''def nested_urls(raw,max_depth=4):\n    out=[];seen=set();queue=[c(raw)]\n    keys={'ulp','url','target','target_url','dest','destination','destination_url','dl_target_url','redirect','redirect_url','u'}\n    while queue and len(out)<40:\n        cur=queue.pop(0)\n        for _ in range(3):\n            dec=unquote(cur)\n            if dec==cur:break\n            cur=dec\n        if not cur or cur in seen:continue\n        seen.add(cur);out.append(cur)\n        try:\n            p=urlparse(cur);qs=parse_qs(p.query)\n        except:continue\n        if len(out)>max_depth*10:break\n        for k,vals in qs.items():\n            if k.lower() in keys:\n                for v in vals:\n                    if v:queue.append(v)\n    return out\n\ndef exact_link(rec,slug_,network):\n    links=rec.get('links') or {}; raw=c(links.get('affiliateUrl') or links.get('destinationUrl'))\n    if not raw:return False\n    candidates=nested_urls(raw)\n    if slug_=='tiktok-shop-us':return False\n    if slug_=='alibaba':return False\n    if slug_=='aliexpress':\n        for u in candidates:\n            try:p=urlparse(u);host=p.netloc.lower();path=p.path.lower()\n            except:continue\n            if 'aliexpress.' in host and ('/item/' in path or bool(re.search(r'/\\d{8,}\\.html',path))):return True\n        return False\n    if slug_=='geekbuying':\n        for u in candidates:\n            try:p=urlparse(u);host=p.netloc.lower();path=p.path.lower()\n            except:continue\n            if 'geekbuying.' in host and len(path.strip('/'))>8 and not any(x in path for x in ('/category/','/search','/promotion')):return True\n        return False\n    if n(network)=='cj':\n        # CJ wrappers are only exact when an embedded destination looks product-specific.\n        for u in candidates[1:] or candidates:\n            try:p=urlparse(u);path=p.path.lower()\n            except:continue\n            if len(path.strip('/'))>6 and not any(x in path for x in ('/search','/category','/collections','/products')):return True\n        return False\n    for u in candidates:\n        try:p=urlparse(u);path=p.path.lower()\n        except:continue\n        if len(path.strip('/'))>8 and not any(x in path for x in ('/search','/category','/collections')):return True\n    return False\n\n'''
b=b[:start]+new+b[end:]
B.write_text(b,encoding='utf-8')

for p in (U,R):p.write_text(p.read_text(encoding='utf-8').replace('20.8.3','20.8.4'),encoding='utf-8')
for p in (F,H):p.write_text(p.read_text(encoding='utf-8').replace('v=20.8.3','v=20.8.4'),encoding='utf-8')
print('V20.8.4 nested destination truth applied')
