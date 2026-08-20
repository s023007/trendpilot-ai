#!/usr/bin/env python3
import json, pathlib, datetime as dt
ROOT=pathlib.Path(__file__).resolve().parents[1]
REG=ROOT/'data/event-factory/events.json'
OUT=ROOT/'data/event-factory/promotion-queue.json'
reg=json.loads(REG.read_text())
items=[]
for e in reg.get('events',[]):
    if e.get('status')!='ready': continue
    p=ROOT/'events'/e['slug']/'distribution.json'
    if not p.exists(): continue
    pack=json.loads(p.read_text())
    for i,pin in enumerate(pack.get('pinterest',[]),1):
        items.append({'priority':1,'channel':'pinterest','event':e['slug'],'asset_role':f'pin-{i}','title':pin.get('title'),'target_url':pin.get('url'),'status':'ready-for-creative'})
    yt=pack.get('youtube_short') or {}
    if yt: items.append({'priority':2,'channel':'youtube-shorts','event':e['slug'],'hook':yt.get('hook'),'target_url':yt.get('url'),'status':'ready-for-video'})
    tr=pack.get('tiktok_reel') or {}
    if tr:
        items.append({'priority':3,'channel':'instagram-reels','event':e['slug'],'hook':tr.get('hook'),'target_url':tr.get('url'),'status':'ready-for-video'})
        items.append({'priority':3,'channel':'tiktok','event':e['slug'],'hook':tr.get('hook'),'target_url':tr.get('url'),'status':'ready-for-video'})
    for ch in ('facebook','x'):
        x=pack.get(ch) or {}
        if x: items.append({'priority':4,'channel':ch,'event':e['slug'],'copy':x.get('copy'),'target_url':x.get('url'),'status':'ready-for-post'})
    if pack.get('reddit_quora_angle'):
        items.append({'priority':5,'channel':'reddit-quora','event':e['slug'],'angle':pack['reddit_quora_angle'],'status':'manual-value-first','note':'Answer a real question or discussion; never mass-post or spam links.'})
    if pack.get('email_subject'):
        items.append({'priority':6,'channel':'email-telegram-whatsapp','event':e['slug'],'subject':pack['email_subject'],'target_url':f'https://trendpilotchoice.com/events/{e["slug"]}/','status':'ready-for-owned-audience'})
items.sort(key=lambda x:(x['priority'],x['event'],x['channel']))
OUT.write_text(json.dumps({'generated_at':dt.datetime.now(dt.timezone.utc).isoformat(),'publishing_mode':'queue-only','note':'This file prepares channel-specific promotion. It does not publish to external accounts without an authorized publisher/API connection.','items':items},ensure_ascii=False,indent=2)+'\n')
print('promotion queue items:',len(items))
