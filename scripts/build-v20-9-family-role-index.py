#!/usr/bin/env python3
from __future__ import annotations

import collections
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
PRODUCTS=ROOT/'data/v20-8/products'
OUT=ROOT/'data/v20-9/family-roles.json'
ROLES=('main','used','accessory','replacement_part')


def main():
    rows=[]
    for path in sorted(PRODUCTS.glob('*.json')):
        data=json.loads(path.read_text(encoding='utf-8'))
        rows.extend(data.values() if isinstance(data,dict) else data)
    if len(rows)<50000:
        raise SystemExit(f'Unexpected product count: {len(rows)}')

    # Within each family+role, exact links, images and priced rows are preferred without changing their stored truth.
    rows.sort(key=lambda r:(bool(r.get('x')),bool(r.get('im')),bool(r.get('p')),int(r.get('r') or 0)),reverse=True)
    index=collections.defaultdict(lambda:collections.defaultdict(list))
    for r in rows:
        fam=str(r.get('fa') or r.get('ty') or 'unclassified')
        role=str(r.get('ro') or 'main')
        if role not in ROLES:
            role='main'
        if len(index[fam][role])<1400:
            index[fam][role].append(r['id'])

    payload={fam:{role:ids for role,ids in roles.items() if ids} for fam,roles in index.items()}
    OUT.parent.mkdir(parents=True,exist_ok=True)
    OUT.write_text(json.dumps(payload,ensure_ascii=False,separators=(',',':')),encoding='utf-8')

    counts={role:sum(len(roles.get(role,[])) for roles in payload.values()) for role in ROLES}
    print(json.dumps({'families':len(payload),'roleIndexedIds':counts,'fileBytes':OUT.stat().st_size},indent=2))

if __name__=='__main__':
    main()
