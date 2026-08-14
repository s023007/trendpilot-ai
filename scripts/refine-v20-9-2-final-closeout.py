#!/usr/bin/env python3
from __future__ import annotations

import collections
import json
import re
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
PRODUCTS=ROOT/'data/v20-8/products'
OUT=ROOT/'data/v20-9'
REPORT=OUT/'residual-report.json'
QUALITY=OUT/'quality-report.json'
SUMMARY=ROOT/'data/v20-8/taxonomy-summary.json'
MANIFEST=ROOT/'data/v20-8/manifest.json'
BASE_RESIDUAL=3388
VERSION='20.9.2'

RULES=[
    ('pet-supplies','pets',r'\b(?:cat\s+(?:tree|tower|scratching\s+post|scratcher|condo)|dog\s+(?:crate|kennel|playpen)|pet\s+(?:crate|playpen|pen|stroller)|(?:crate|kennel|playpen)\s+for\s+(?:dogs?|cats?|pets?))\b',''),
    ('baby-products','baby',r'\b(?:baby\s+(?:bottle|feeding\s+bottle|carrier|wrap|sling|monitor|gate|nest|crib|bassinet|diaper\s+bag|nappy\s+bag|proofing\s+kit)|infant\s+(?:bottle|carrier|monitor|bassinet)|diaper\s+bag|nappy\s+bag)\b',r'\b(?:doll|toy|replacement|spare)\b'),
    ('bags','bags',r'\b(?:shoulder\s+bag|crossbody\s+bag|handbag|tote\s+bag|travel\s+bag|drawstring\s+bag|laptop\s+bag|school\s+bag|overnight\s+bag)\b',r'\b(?:camera\s+bag|tool\s+bag|garbage\s+bag|trash\s+bag|vacuum\s+bag|pet\s+waste|dog\s+waste)\b'),
    ('kitchen-tools','kitchen',r'\b(?:kitchen\s+scale|digital\s+kitchen\s+scale|food\s+thermometer|meat\s+thermometer|kitchen\s+timer|measuring\s+cups?|measuring\s+spoons?|cutting\s+board|chopping\s+board|knife\s+sharpener|can\s+opener|bottle\s+opener|pizza\s+cutter)\b',r'\b(?:toy|miniature|keychain)\b'),
    ('kitchen-appliances','kitchen',r'\b(?:coffee\s+maker|coffee\s+grinder|espresso\s+machine|milk\s+frother|electric\s+kettle|toaster|sandwich\s+maker|waffle\s+maker|hand\s+mixer|stand\s+mixer|food\s+processor|portable\s+blender|countertop\s+blender|juicer|rice\s+cooker|air\s+fryer)\b',r'\b(?:replacement|spare\s+part|filter\s+for|cover\s+for|case\s+for)\b'),
    ('camping','sports',r'\b(?:camping\s+(?:hammock|mat|sleeping\s+pad|cookware|fan|shower|backpack|light|gear|utensils?|kettle)|outdoor\s+camping\s+(?:tent|chair|table|stove|hammock)|portable\s+camping\s+(?:stove|shower|fan|light|table))\b',''),
    ('car-accessories','automotive',r'\b(?:car\s+(?:cover|mat|mats|carpet|pillow|cushion|cleaning\s+kit|wash\s+kit|detailing\s+brush|storage\s+box|storage\s+bag|seat\s+organizer|trunk\s+organizer|vacuum|cup\s+holder|trash\s+bag)|vehicle\s+(?:cover|floor\s+mats?|organizer))\b',r'\b(?:baby|infant|toy|model)\b'),
    ('garden-supplies','home',r'\b(?:garden\s+(?:trellis|stakes?|netting|decor|decoration|furniture\s+cover)|plant\s+(?:clips?|ties?|labels?|stakes?|trellis)|greenhouse\s+cover|bird\s+feeder)\b',''),
    ('home-organization','home',r'\b(?:storage\s+(?:basket|baskets|bin|bins|box|boxes)|drawer\s+organizer|closet\s+organizer|wardrobe\s+organizer|shoe\s+rack|coat\s+rack|laundry\s+hamper|laundry\s+basket|under[- ]bed\s+storage)\b',r'\b(?:tool\s+box|car\s+storage|food\s+storage)\b'),
    ('lighting','lighting',r'\b(?:flashlight|flash\s+light|torch\s+light|led\s+torch|rechargeable\s+torch|headlamp|head\s+lamp|work\s+light|inspection\s+light)\b',r'\b(?:car|vehicle|bike|bicycle|motorcycle|toy)\b'),
    ('makeup-tools','beauty',r'\b(?:makeup\s+brush(?:es)?|makeup\s+sponge|beauty\s+sponge|cosmetic\s+mirror|makeup\s+mirror|eyelash\s+curler|makeup\s+applicator)\b',''),
]
COMPILED=[(ty,fa,re.compile(pos,re.I),re.compile(neg,re.I) if neg else None) for ty,fa,pos,neg in RULES]


def label(slug:str)->str:
    return slug.replace('-',' ').title()


def load(path:Path, default):
    return json.loads(path.read_text(encoding='utf-8')) if path.exists() else default


def main():
    changed=[]
    all_rows=[]
    for path in sorted(PRODUCTS.glob('*.json')):
        data=json.loads(path.read_text(encoding='utf-8'))
        dirty=False
        for rid,row in data.items():
            if row.get('ty')=='unclassified':
                title=str(row.get('t') or '')
                for ty,fa,pos,neg in COMPILED:
                    if not pos.search(title) or (neg and neg.search(title)):
                        continue
                    row['ty']=ty; row['tyl']=label(ty); row['fa']=fa
                    if ty=='car-accessories' and row.get('ro')!='used': row['ro']='accessory'
                    row['s']=' '.join(dict.fromkeys((str(row.get('s') or '')+' '+title+' '+ty+' '+fa+' '+str(row.get('ro') or 'main')).lower().split()))
                    changed.append({'id':rid,'title':title,'to':ty,'role':row.get('ro'),'seller':row.get('se')})
                    dirty=True
                    break
            all_rows.append(row)
        if dirty:
            path.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')),encoding='utf-8')

    types=collections.Counter(str(r.get('ty') or 'unclassified') for r in all_rows)
    roles=collections.Counter(str(r.get('ro') or 'main') for r in all_rows)
    families=collections.Counter(str(r.get('fa') or r.get('ty') or 'unclassified') for r in all_rows)
    after=types['unclassified']
    pass_counts=collections.Counter(x['to'] for x in changed)

    report=load(REPORT,{})
    merged=collections.Counter(dict(report.get('byType') or [])); merged.update(pass_counts)
    report.update({
        'version':VERSION,'records':len(all_rows),'unclassifiedBeforeResidual':BASE_RESIDUAL,
        'unclassifiedAfterResidual':after,'classifiedByResidual':BASE_RESIDUAL-after,
        'unclassifiedAfterResidualPct':round(100*after/max(1,len(all_rows)),2),
        'byType':merged.most_common(),'samples':(report.get('samples') or [])[:150]+changed[:50],
        'finalCloseoutClassified':len(changed),
    })
    REPORT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

    q=load(QUALITY,{})
    q.update({'unclassifiedAfter':after,'unclassifiedReduction':int(q.get('unclassifiedBefore') or 0)-after,
              'unclassifiedAfterPct':round(100*after/max(1,len(all_rows)),2),'types':types.most_common(),
              'roles':roles.most_common(),'families':families.most_common(),'familyCount':len(families),
              'residualPassVersion':VERSION,'residualClassified':BASE_RESIDUAL-after,
              'residualBreakdown':[{'type':ty,'count':n} for ty,n in merged.most_common()],
              'finalCloseoutClassified':len(changed)})
    QUALITY.write_text(json.dumps(q,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

    s=load(SUMMARY,{})
    s['types']=[{'slug':k,'label':label(k),'count':v} for k,v in types.most_common()]
    s['roles']=dict(roles); s['families']=[{'slug':k,'label':label(k),'count':v} for k,v in families.most_common()]
    gate=s.setdefault('qualityGateV20_9',{})
    gate.update({'unclassifiedAfter':after,'unclassifiedAfterPct':round(100*after/max(1,len(all_rows)),2),
                 'residualPassVersion':VERSION,'residualClassified':BASE_RESIDUAL-after,
                 'finalCloseoutClassified':len(changed)})
    SUMMARY.write_text(json.dumps(s,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

    m=load(MANIFEST,{})
    m.setdefault('truthCleanup',{}).update({'residualUnclassifiedPassVersion':VERSION,
        'residualUnclassifiedHighConfidenceOnly':True,'residualUnclassifiedRemaining':after,
        'finalResidualCloseoutClassified':len(changed)})
    MANIFEST.write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'version':VERSION,'records':len(all_rows),'classifiedThisCloseout':len(changed),
        'classifiedByResidualTotal':BASE_RESIDUAL-after,'unclassifiedAfterResidual':after,
        'unclassifiedAfterResidualPct':round(100*after/max(1,len(all_rows)),2),'byType':pass_counts.most_common()},indent=2))

if __name__=='__main__': main()
