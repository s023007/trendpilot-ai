#!/usr/bin/env python3
from __future__ import annotations

import collections
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
PRODUCTS=ROOT/'data/v20-8/products'
OUT_DIR=ROOT/'data/v20-9'
ROLE_OUT=OUT_DIR/'family-roles.json'
FAMILY_OUT=OUT_DIR/'families.json'
ROLES=('main','used','accessory','replacement_part')


def interleave(role_map: dict[str,list[str]], limit: int=1600) -> list[str]:
    # Do not let a very large main-product family starve accessories, replacement parts or used listings.
    # Round-robin keeps generic family retrieval usable for every explicit shopper role.
    pools={role:list(role_map.get(role,[])) for role in ROLES}
    out=[]
    i=0
    while len(out)<limit:
        added=False
        for role in ROLES:
            pool=pools[role]
            if i<len(pool):
                out.append(pool[i]);added=True
                if len(out)>=limit:break
        if not added:break
        i+=1
    return out


def main():
    rows=[]
    for path in sorted(PRODUCTS.glob('*.json')):
        data=json.loads(path.read_text(encoding='utf-8'))
        rows.extend(data.values() if isinstance(data,dict) else data)
    if len(rows)<50000:
        raise SystemExit(f'Unexpected product count: {len(rows)}')

    rows.sort(key=lambda r:(bool(r.get('x')),bool(r.get('im')),bool(r.get('p')),int(r.get('r') or 0)),reverse=True)
    index=collections.defaultdict(lambda:collections.defaultdict(list))
    for r in rows:
        fam=str(r.get('fa') or r.get('ty') or 'unclassified')
        role=str(r.get('ro') or 'main')
        if role not in ROLES: role='main'
        if len(index[fam][role])<1400:
            index[fam][role].append(r['id'])

    role_payload={fam:{role:ids for role,ids in roles.items() if ids} for fam,roles in index.items()}
    balanced={fam:interleave(roles) for fam,roles in role_payload.items()}
    OUT_DIR.mkdir(parents=True,exist_ok=True)
    ROLE_OUT.write_text(json.dumps(role_payload,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    FAMILY_OUT.write_text(json.dumps(balanced,ensure_ascii=False,separators=(',',':')),encoding='utf-8')

    counts={role:sum(len(roles.get(role,[])) for roles in role_payload.values()) for role in ROLES}
    coverage={role:sum(1 for roles in role_payload.values() if roles.get(role)) for role in ROLES}
    print(json.dumps({
        'families':len(role_payload),
        'roleIndexedIds':counts,
        'familiesWithRole':coverage,
        'roleFileBytes':ROLE_OUT.stat().st_size,
        'balancedFamilyFileBytes':FAMILY_OUT.stat().st_size,
    },indent=2))

if __name__=='__main__':
    main()
