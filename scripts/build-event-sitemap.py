#!/usr/bin/env python3
import json
import pathlib
from xml.sax.saxutils import escape, quoteattr

ROOT=pathlib.Path(__file__).resolve().parents[1]
REG=ROOT/'data/event-factory/events.json'
OUT=ROOT/'events/sitemap.xml'
URLS=ROOT/'data/event-factory/public-urls.json'
ORIGIN='https://trendpilotchoice.com'

reg=json.loads(REG.read_text())
locales=reg.get('default_locales',[])
ready=[x for x in reg.get('events',[]) if x.get('status')=='ready']

rows=[]
public=[]
for e in ready:
    slug=e['slug']
    root=f'{ORIGIN}/events/{slug}/'
    variants={'x-default':root}
    for loc in locales:
        hreflang={'ar':'ar','en-gb':'en-GB','de-de':'de-DE','fr-fr':'fr-FR','es-es':'es-ES'}.get(loc,loc)
        variants[hreflang]=f'{ORIGIN}/events/{slug}/{loc}/'
    for lang,url in variants.items():
        public.append(url)
        alts=''.join(f'<xhtml:link rel="alternate" hreflang={quoteattr(hl)} href={quoteattr(href)}/>' for hl,href in variants.items())
        rows.append(f'<url><loc>{escape(url)}</loc><lastmod>{escape(e["date"])}</lastmod>{alts}</url>')
public.append(f'{ORIGIN}/tickets/')
xml='<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n'+'\n'.join(rows)+'\n</urlset>\n'
OUT.write_text(xml)
URLS.write_text(json.dumps({'version':reg.get('version'),'urls':sorted(set(public))},indent=2)+'\n')
print('event sitemap URLs:',len(rows),'public URLs:',len(set(public)))
