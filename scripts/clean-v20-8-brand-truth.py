#!/usr/bin/env python3
import json,re,unicodedata
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'data/v20-8'
GENERIC={'alibaba','aliexpress','geekbuying','diecast','poco','tiktok shop us','sunsky-online ww','sunsky online ww','pandahall','mfi medical','karaca eu','fragranceshop.com','govee many geos','harfington many geos'}
def c(v):return re.sub(r'\s+',' ',str(v or '')).strip()
def n(v):return re.sub(r'\s+',' ',re.sub(r'[^a-z0-9]+',' ',unicodedata.normalize('NFKD',c(v)).encode('ascii','ignore').decode().lower())).strip()
def explicit_brand(title,current,seller):
    t=c(title);b=c(current);bn=n(b);sn=n(seller)
    if b and bn not in GENERIC and bn!=sn and re.search(r'(?<![a-z0-9])'+re.escape(bn)+r'(?![a-z0-9])',n(t)):return b
    m=re.search(r'\bby\s+([A-Z][A-Za-z0-9& .\'-]{2,35})\s*$',t)
    if m:
        x=c(m.group(1)).strip(' .,-');
        if n(x) not in GENERIC:return x
    return ''
# Compact universal buckets
for p in (OUT/'products').glob('*.json'):
    data=json.loads(p.read_text(encoding='utf-8'))
    for row in data.values():row['b']=explicit_brand(row.get('t'),row.get('b'),row.get('se'))
    p.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
# Rare index + map for static pages
rp=OUT/'rare-index.json';rows=json.loads(rp.read_text(encoding='utf-8'));by_url={}
for row in rows:
    row['brand']=explicit_brand(row.get('title'),row.get('brand'),row.get('seller'))
    if row.get('seoUrl'):by_url[row['seoUrl']]=row
rp.write_text(json.dumps(rows,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
# Patch structured Product data and visible brand line on generated Rare pages.
for url,row in by_url.items():
    p=ROOT/url.strip('/')/'index.html'
    if not p.exists():continue
    text=p.read_text(encoding='utf-8')
    m=re.search(r'(<script type="application/ld\+json">)(.*?)(</script>)',text,re.S)
    if m:
        try:
            obj=json.loads(m.group(2));brand=row.get('brand')
            if brand:obj['brand']={'@type':'Brand','name':brand}
            else:obj.pop('brand',None)
            text=text[:m.start(2)]+json.dumps(obj,ensure_ascii=False).replace('</','<\\/')+text[m.end(2):]
        except Exception:pass
    visible=row.get('brand') or row.get('seller') or row.get('typeLabel') or 'Product'
    text=re.sub(r'<p class="tp80-brand">.*?</p>',f'<p class="tp80-brand">{visible}</p>',text,count=1,flags=re.S)
    p.write_text(text,encoding='utf-8')
print(json.dumps({'brandTruthGuard':True,'rareRows':len(rows),'seoPagesChecked':len(by_url)},indent=2))
