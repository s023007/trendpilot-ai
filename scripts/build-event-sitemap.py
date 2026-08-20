#!/usr/bin/env python3
import json
import pathlib
from xml.sax.saxutils import escape, quoteattr

ROOT=pathlib.Path(__file__).resolve().parents[1]
REG=ROOT/'data/event-factory/events.json'
NETWORK=ROOT/'data/event-factory/growth-network.json'
OUT=ROOT/'events/sitemap.xml'
URLS=ROOT/'data/event-factory/public-urls.json'
ORIGIN='https://trendpilotchoice.com'

reg=json.loads(REG.read_text(encoding='utf-8'))
locales=reg.get('default_locales',[])
ready=[x for x in reg.get('events',[]) if x.get('status')=='ready']

rows=[]
public=[]
seen=set()

def add_simple(url,lastmod=None):
    if url in seen:
        return
    seen.add(url); public.append(url)
    lm=f'<lastmod>{escape(lastmod)}</lastmod>' if lastmod else ''
    rows.append(f'<url><loc>{escape(url)}</loc>{lm}</url>')

for e in ready:
    slug=e['slug']
    root=f'{ORIGIN}/events/{slug}/'
    variants={'x-default':root}
    for loc in locales:
        hreflang={'ar':'ar','en-gb':'en-GB','de-de':'de-DE','fr-fr':'fr-FR','es-es':'es-ES'}.get(loc,loc)
        variants[hreflang]=f'{ORIGIN}/events/{slug}/{loc}/'
    alts=''.join(f'<xhtml:link rel="alternate" hreflang={quoteattr(hl)} href={quoteattr(href)}/>' for hl,href in variants.items())
    for _,url in variants.items():
        if url in seen: continue
        seen.add(url); public.append(url)
        rows.append(f'<url><loc>{escape(url)}</loc><lastmod>{escape(e["date"])}</lastmod>{alts}</url>')

if NETWORK.exists():
    network=json.loads(NETWORK.read_text(encoding='utf-8'))
    for url in network.get('urls',[]):
        add_simple(url)

add_simple(f'{ORIGIN}/tickets/')

xml='<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n'+'\n'.join(rows)+'\n</urlset>\n'
OUT.write_text(xml,encoding='utf-8')
URLS.write_text(json.dumps({'version':reg.get('version'),'count':len(public),'urls':sorted(public)},indent=2)+'\n',encoding='utf-8')
print('event network sitemap URLs:',len(rows),'public URLs:',len(public))
