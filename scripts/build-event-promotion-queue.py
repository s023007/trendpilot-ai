#!/usr/bin/env python3
import json, pathlib, datetime as dt
ROOT=pathlib.Path(__file__).resolve().parents[1]
REG=ROOT/'data/event-factory/events.json'
CREATIVES=ROOT/'data/event-factory/social-creatives.json'
NETWORK=ROOT/'data/event-factory/growth-network.json'
OUT=ROOT/'data/event-factory/promotion-queue.json'
reg=json.loads(REG.read_text(encoding='utf-8'))
creative_map={}
if CREATIVES.exists():
    c=json.loads(CREATIVES.read_text(encoding='utf-8'))
    for row in c.get('events',[]):
        creative_map[row.get('event')]={a.get('role'):a for a in row.get('assets',[])}
items=[]
for e in reg.get('events',[]):
    if e.get('status')!='ready': continue
    p=ROOT/'events'/e['slug']/'distribution.json'
    if not p.exists(): continue
    pack=json.loads(p.read_text(encoding='utf-8'))
    cmap=creative_map.get(e['slug'],{})
    for i,pin in enumerate(pack.get('pinterest',[]),1):
        role=f'pin-{i}'
        asset=cmap.get(role,{})
        items.append({
            'priority':1,'channel':'pinterest','event':e['slug'],'asset_role':role,
            'title':pin.get('title'),'target_url':pin.get('url'),
            'image_url':asset.get('url'),'image_path':asset.get('path'),
            'status':'ready-to-publish' if asset.get('url') else 'ready-for-creative'
        })
    yt=pack.get('youtube_short') or {}
    if yt:
        items.append({'priority':2,'channel':'youtube-shorts','event':e['slug'],'hook':yt.get('hook'),'target_url':yt.get('url'),'visual_source':(cmap.get('pin-1') or {}).get('url'),'status':'ready-for-video-production'})
    tr=pack.get('tiktok_reel') or {}
    if tr:
        common={'event':e['slug'],'hook':tr.get('hook'),'target_url':tr.get('url'),'visual_source':(cmap.get('pin-2') or {}).get('url'),'status':'ready-for-video-production'}
        items.append({'priority':3,'channel':'instagram-reels',**common})
        items.append({'priority':3,'channel':'tiktok',**common})
    for ch in ('facebook','x'):
        x=pack.get(ch) or {}
        if x:
            items.append({'priority':4,'channel':ch,'event':e['slug'],'copy':x.get('copy'),'target_url':x.get('url'),'image_url':(cmap.get('pin-1') or {}).get('url'),'status':'ready-for-post'})
    if pack.get('reddit_quora_angle'):
        items.append({'priority':5,'channel':'reddit-quora','event':e['slug'],'angle':pack['reddit_quora_angle'],'status':'manual-value-first','note':'Answer a real question or discussion; never mass-post or spam links.'})
    if pack.get('email_subject'):
        items.append({'priority':6,'channel':'email-telegram-whatsapp','event':e['slug'],'subject':pack['email_subject'],'target_url':f'https://trendpilotchoice.com/events/{e["slug"]}/','status':'ready-for-owned-audience'})

if NETWORK.exists():
    network=json.loads(NETWORK.read_text(encoding='utf-8'))
    for url in network.get('urls',[]):
        items.append({'priority':0,'channel':'search-discovery','target_url':url,'status':'sitemap+indexnow'})

items.sort(key=lambda x:(x['priority'],x.get('event',''),x['channel'],x.get('asset_role',''),x.get('target_url','')))
OUT.write_text(json.dumps({
    'generated_at':dt.datetime.now(dt.timezone.utc).isoformat(),
    'publishing_mode':'search-auto + pinterest-auto when authorized; other channels are asset-ready queues',
    'note':'Search discovery is automatic. Pinterest items with image_url are eligible for the daily Buffer publisher. Video channels remain queued until a video asset/publisher is connected.',
    'items':items
},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('promotion queue items:',len(items))
