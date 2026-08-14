#!/usr/bin/env python3
from __future__ import annotations

import collections
import json
import re
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
P8=ROOT/'data/v20-8/products'
Q=ROOT/'data/v20-9/quality-report.json'
F=ROOT/'data/v20-9/families.json'
RT=ROOT/'data/v20-9/runtime-manifest.json'
BLOCK={'temu','joom','filamentpro','filamentpro eu cps','filamentpro-eu-cps'}


def load_rows():
    rows=[]
    for p in sorted(P8.glob('*.json')):
        x=json.loads(p.read_text())
        rows.extend(x.values() if isinstance(x,dict) else x)
    return rows


def main():
    rows=load_rows()
    assert len(rows)==52031
    by_type=collections.Counter(r.get('ty') for r in rows)
    by_family=collections.Counter(r.get('fa') for r in rows)
    by_role=collections.Counter(r.get('ro') for r in rows)
    assert not any(str(r.get('se') or '').strip().lower() in BLOCK for r in rows)

    # Families that a normal shopper can now search outside the old managed electronics set.
    required_types={
        'tablet':40,'camera':40,'printer':30,'furniture':100,'furniture-desks':20,
        'vacuum-cleaner':40,'kitchen-appliances':50,'automotive-parts':50,
        'pet-toys':20,'skincare':20,'makeup':20,'footwear':80,'bags':80,
        'fitness-equipment':30,'toys':50,'medical':40,'industrial-components':40,
        'phone-accessories':40,'tablet-accessories':10,'power-tool-parts':100,
    }
    missing={k:(by_type.get(k,0),v) for k,v in required_types.items() if by_type.get(k,0)<v}
    assert not missing, f'Expected searchable type coverage missing: {missing}'

    for core in ('phone','tablet','laptop','smartwatch','headphones'):
        bad=[r for r in rows if r.get('ty')==core and r.get('ro') not in {'main','used'}]
        assert not bad, f'{core} still contains accessory/part roles: {len(bad)}'

    # Accessory and replacement categories must have the matching role rather than masquerading as main products.
    for r in rows:
        ty=str(r.get('ty') or '')
        if ty.endswith('-accessories') or ty in {'phone-accessories','tablet-accessories','laptop-accessories','smartwatch-accessories','headphone-accessories','camera-accessories','computer-accessories','car-accessories'}:
            assert r.get('ro')=='accessory', (ty,r.get('ro'),r.get('t'))
        if ty.endswith('-parts') or ty in {'replacement-parts'}:
            assert r.get('ro')=='replacement_part', (ty,r.get('ro'),r.get('t'))

    # Regression from the user-visible tablet issue: a tablet bundled WITH a case is still the tablet, not an accessory.
    bundled=[r for r in rows if r.get('ty')=='tablet' and re.search(r'\btablet\b',str(r.get('t') or ''),re.I) and re.search(r'\bwith\b.{0,45}\bcase\b',str(r.get('t') or ''),re.I)]
    assert bundled, 'No bundled-tablet regression examples found'
    assert all(r.get('ro') in {'main','used'} for r in bundled), 'Tablet bundled with case regressed to accessory'

    # Product family metadata must exist broadly enough for same-family comparison.
    assert sum(1 for r in rows if r.get('fa')) >= 50000
    assert len(by_family)>=100
    fam=json.loads(F.read_text())
    for name in ('phone','tablet','laptop','computer','camera','tools','furniture','automotive','pets','beauty','apparel','sports'):
        assert fam.get(name), f'Family index missing {name}'

    q=json.loads(Q.read_text())
    rt=json.loads(RT.read_text())
    assert q['unclassifiedAfter']<=3500
    assert q['immutableCommerceFieldsChanged']==0
    assert rt['productBuckets']==256 and rt['maxProductBucketBytes']<500000
    print(json.dumps({
        'records':len(rows),'types':len(by_type),'families':len(by_family),'roles':dict(by_role),
        'unclassified':by_type.get('unclassified',0),'bundledTabletMainExamples':len(bundled),
        'runtimeBuckets':rt['productBuckets'],'largestRuntimeBucketBytes':rt['maxProductBucketBytes']
    },indent=2))

if __name__=='__main__':
    main()
