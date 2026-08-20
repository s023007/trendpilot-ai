#!/usr/bin/env python3
import json, pathlib, re
ROOT=pathlib.Path(__file__).resolve().parents[1]
EVENTS=ROOT/'events'
MARK='data-tp-event-locale-router="1"'
changed=[]
for index in EVENTS.rglob('index.html'):
    rel=index.relative_to(EVENTS)
    parts=rel.parts
    if not parts or parts[0]=='_factory':
        continue
    # Localized pages already live in a locale directory and must not redirect.
    if any(p in {'ar','en-gb','de-de','fr-fr','es-es'} for p in parts[:-1]):
        continue
    folder=index.parent
    available=[loc for loc in ('ar','en-gb','de-de','fr-fr','es-es') if (folder/loc/'index.html').exists()]
    if not available:
        continue
    text=index.read_text(encoding='utf-8')
    if MARK in text:
        continue
    config=json.dumps(available,ensure_ascii=False,separators=(',',':'))
    inject=f'<script {MARK}>window.__TP_EVENT_LOCALES__={config};</script><script src="/events/_factory/locale-router-v1.js?v=1.0.0" defer></script>'
    if '</head>' not in text:
        continue
    text=text.replace('</head>',inject+'</head>',1)
    index.write_text(text,encoding='utf-8')
    changed.append(str(index.relative_to(ROOT)))
print(json.dumps({'locale_router_pages':len(changed),'changed':changed},ensure_ascii=False,indent=2))
