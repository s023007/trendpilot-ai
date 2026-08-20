#!/usr/bin/env python3
import json, pathlib
ROOT=pathlib.Path(__file__).resolve().parents[1]
REG=ROOT/'data/event-factory/events.json'
INBOX=ROOT/'data/event-factory/inbox'
reg=json.loads(REG.read_text())
events=reg.setdefault('events',[])
by_slug={x.get('slug'):i for i,x in enumerate(events)}
changed=[]
for path in sorted(INBOX.glob('*.json')) if INBOX.exists() else []:
    item=json.loads(path.read_text())
    slug=item.get('slug')
    if not slug: raise SystemExit(f'{path}: missing slug')
    if slug in by_slug:
        idx=by_slug[slug]
        if events[idx]!=item:
            events[idx]=item; changed.append({'slug':slug,'action':'updated','source':str(path.relative_to(ROOT))})
    else:
        by_slug[slug]=len(events); events.append(item); changed.append({'slug':slug,'action':'added','source':str(path.relative_to(ROOT))})
if changed:
    REG.write_text(json.dumps(reg,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'changed':changed,'event_count':len(events)},ensure_ascii=False,indent=2))
