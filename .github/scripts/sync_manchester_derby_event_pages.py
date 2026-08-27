#!/usr/bin/env python3
import json,re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
STATE=ROOT/'.github/data/manchester-derby-prices.json'
PAGES=[ROOT/'events/manchester-derby-2026/ar/index.html',ROOT/'events/manchester-derby-2026/en-gb/index.html']

def eur(amount,currency,fx):
    if currency=='EUR': return amount
    if currency=='USD': return amount/fx['EUR_USD']
    if currency=='GBP': return amount/fx['EUR_GBP']
    return amount

def replace_attr(doc,attr,key,text):
    pat=rf'(<[^>]+{attr}="{re.escape(key)}"[^>]*>)(.*?)(</[^>]+>)'
    return re.sub(pat,lambda m:m.group(1)+text+m.group(3),doc,count=1,flags=re.S)

def main():
    state=json.loads(STATE.read_text('utf-8')); fx=state['fx']; src=state['sources']
    native={k:f"{'€' if v['currency']=='EUR' else '$' if v['currency']=='USD' else '£'}{v['amount']:,.2f}".replace('.00','') for k,v in src.items() if k in ('ticombo','sports365','livefootballtickets','footballticketpad')}
    sar={k:int(round(eur(float(v['amount']),v['currency'],fx)*fx['EUR_SAR'])) for k,v in src.items() if k in native}
    gbp={k:int(round(eur(float(v['amount']),v['currency'],fx)*fx['EUR_GBP'])) for k,v in src.items() if k in native}
    for page in PAGES:
        doc=page.read_text('utf-8')
        for k,v in native.items(): doc=replace_attr(doc,'data-price',k,v)
        if '/ar/' in str(page):
            for k,v in sar.items(): doc=replace_attr(doc,'data-convert',k,f'≈ {v:,} ر.س')
            stamp='آخر تحديث: '+state.get('updated_at_riyadh','')[:10]
        else:
            for k,v in gbp.items():
                label='Lowest in our latest check' if k=='livefootballtickets' else f'≈ £{v:,}'
                doc=replace_attr(doc,'data-convert',k,label)
            stamp='Last refreshed: '+state.get('updated_at_riyadh','')[:10]
        doc=re.sub(r'(<span class="updated">)(.*?)(</span>)',lambda m:m.group(1)+stamp+m.group(3),doc,count=1,flags=re.S)
        page.write_text(doc,'utf-8')
        print('Synced',page)
if __name__=='__main__': main()
