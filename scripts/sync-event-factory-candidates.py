#!/usr/bin/env python3
import json, pathlib, datetime as dt
ROOT=pathlib.Path(__file__).resolve().parents[1]
REG=ROOT/'data/event-factory/events.json'
RADAR=ROOT/'data/runtime/ticket-travel-opportunities.json'
if not RADAR.exists():
    raise SystemExit('Radar output not found: data/runtime/ticket-travel-opportunities.json')
reg=json.loads(REG.read_text())
radar=json.loads(RADAR.read_text())
ready_ids={str(x.get('source_event_id') or '') for x in reg.get('events',[])}
ready_titles={str(x.get('event_name') or '').lower() for x in reg.get('events',[])}
old={str(x.get('event_id')):x for x in reg.get('candidate_queue',[]) if x.get('event_id')}
rows=[]
for x in radar.get('top_recommendations',[])[:30]:
    eid=str(x.get('event_id') or '')
    title=str(x.get('title') or '').strip()
    if not eid or not title: continue
    if eid in ready_ids: continue
    # Avoid obvious duplicates of already-published fixtures.
    low=title.lower()
    if any(name and name in low for name in ready_titles): continue
    item=old.get(eid,{})
    item.update({
        'event_id':eid,
        'title':title,
        'date':str(x.get('event_date') or '')[:10],
        'score':x.get('total_score'),
        'tier':'A' if (x.get('total_score') or 0)>=28 else 'B',
        'markets':x.get('target_markets') or [],
        'source_url':x.get('source_url'),
        'source_group':x.get('source_group'),
        'status':item.get('status') or 'needs-ticket-and-image-verification',
        'last_seen_at':radar.get('generated_at') or dt.datetime.now(dt.timezone.utc).isoformat()
    })
    rows.append(item)
rows.sort(key=lambda x:(-(x.get('score') or 0),x.get('date') or '9999'))
reg['candidate_queue']=rows[:30]
reg['candidate_sync']={'source':'data/runtime/ticket-travel-opportunities.json','synced_at':dt.datetime.now(dt.timezone.utc).isoformat(),'count':len(reg['candidate_queue'])}
REG.write_text(json.dumps(reg,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(reg['candidate_sync'],ensure_ascii=False,indent=2))
