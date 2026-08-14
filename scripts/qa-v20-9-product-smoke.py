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
USED_EVIDENCE=re.compile(r'\b(?:used|refurbished|renewed|pre[-\s]?owned|second[-\s]?hand|open[-\s]?box)\b',re.I)


def load_rows():
    rows=[]
    for p in sorted(P8.glob('*.json')):
        x=json.loads(p.read_text())
        rows.extend(x.values() if isinstance(x,dict) else x)
    return rows


def used_is_supported(r):
    text=f"{r.get('t','')} {r.get('co','')}"
    return bool(USED_EVIDENCE.search(text))


def main():
    rows=load_rows()
    assert len(rows)==52031
    by_type=collections.Counter(r.get('ty') for r in rows)
    by_family=collections.Counter(r.get('fa') for r in rows)
    by_role=collections.Counter(r.get('ro') for r in rows)
    assert not any(str(r.get('se') or '').strip().lower() in BLOCK for r in rows)

    # Coverage is intentionally broad but thresholds remain conservative enough to verify real catalogue presence,
    # not to force uncertain products into a category simply to make a test pass.
    required_types={
        'tablet':40,'camera':40,'printer':30,'furniture':100,'furniture-desks':20,
        'vacuum-cleaner':20,'kitchen-appliances':40,'automotive-parts':40,
        'pet-toys':10,'skincare':10,'makeup':10,'footwear':60,'bags':40,
        'fitness-equipment':10,'toys':30,'medical':40,'industrial-components':20,
        'phone-accessories':40,'tablet-accessories':10,'power-tool-parts':100,
    }
    missing={k:(by_type.get(k,0),v) for k,v in required_types.items() if by_type.get(k,0)<v}
    assert not missing, f'Expected searchable type coverage missing: {missing}'

    for core in ('phone','tablet','laptop','smartwatch','headphones'):
        bad=[r for r in rows if r.get('ty')==core and r.get('ro') not in {'main','used'}]
        assert not bad, f'{core} still contains accessory/part roles: {len(bad)}'

    # A used/refurbished accessory is still an accessory product type, but "used" is the shopper role that should win.
    # Likewise a refurbished motherboard/spare part remains a parts type while its role truthfully says used.
    used_typed_specials=0
    for r in rows:
        ty=str(r.get('ty') or '')
        role=r.get('ro')
        if ty.endswith('-accessories') or ty in {'phone-accessories','tablet-accessories','laptop-accessories','smartwatch-accessories','headphone-accessories','camera-accessories','computer-accessories','car-accessories'}:
            assert role in {'accessory','used'}, (ty,role,r.get('t'))
            if role=='used':
                used_typed_specials+=1
                assert used_is_supported(r), ('used accessory lacks used evidence',ty,r.get('t'),r.get('co'))
        if ty.endswith('-parts') or ty in {'replacement-parts'}:
            assert role in {'replacement_part','used'}, (ty,role,r.get('t'))
            if role=='used':
                used_typed_specials+=1
                assert used_is_supported(r), ('used replacement part lacks used evidence',ty,r.get('t'),r.get('co'))

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
        'usedTypedAccessoriesOrParts':used_typed_specials,
        'runtimeBuckets':rt['productBuckets'],'largestRuntimeBucketBytes':rt['maxProductBucketBytes']
    },indent=2))

if __name__=='__main__':
    main()
