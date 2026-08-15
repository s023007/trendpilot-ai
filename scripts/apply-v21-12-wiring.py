#!/usr/bin/env python3
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
replacements={
  'index.html':{
    '/js/smart-suggestions-v20-7-7.js?v=21.5.0':'/js/smart-suggestions-v20-7-7.js?v=21.12.0',
    '/css/trendpilot-v21-2-1-final.css?v=21.2.2':'/css/trendpilot-v21-2-1-final.css?v=21.12.0',
  },
  'find/index.html':{
    '/js/smart-suggestions-v20-7-7.js?v=21.5.0':'/js/smart-suggestions-v20-7-7.js?v=21.12.0',
    '/js/query-normalizer-v21-3.js?v=21.6.1':'/js/query-normalizer-v21-3.js?v=21.12.0',
    '/css/trendpilot-v21-2-1-final.css?v=21.2.2':'/css/trendpilot-v21-2-1-final.css?v=21.12.0',
  },
  'tickets/index.html':{
    '/css/trendpilot-v21-2-1-final.css?v=21.2.2':'/css/trendpilot-v21-2-1-final.css?v=21.12.0',
  },
  'ticket/index.html':{
    '/css/trendpilot-v21-2-1-final.css?v=21.2.2':'/css/trendpilot-v21-2-1-final.css?v=21.12.0',
  },
}
for rel,repls in replacements.items():
    p=ROOT/rel
    if not p.exists():
        print('missing',rel);continue
    s=p.read_text(encoding='utf-8');old=s
    for a,b in repls.items():s=s.replace(a,b)
    if s!=old:
        p.write_text(s,encoding='utf-8');print('updated',rel)
    else:print('current',rel)
