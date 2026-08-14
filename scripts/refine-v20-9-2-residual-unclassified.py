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
VERSION='20.9.2'

RULES=[
    # V20.9.2 closeout: conservative residual rules for explicit nouns that remained
    # unclassified after the all-product gate. Specific/part/accessory rules stay
    # before broad family rules so finished products are not mixed with parts.
    ('automotive-parts','automotive',r'\b(?:brake\s+pads?|brake\s+disc|brake\s+rotor|spark\s+plugs?|fuel\s+injector|wheel\s+bearing|control\s+arm|tie\s+rod|shock\s+absorber|strut\s+assembly|oxygen\s+sensor|o2\s+sensor|carburetor|engine\s+mount|timing\s+belt|serpentine\s+belt)\b',r'\b(?:toy|model|keychain|poster|sticker)\b'),
    ('car-electronics','automotive',r'\b(?:car\s+stereo|car\s+radio|carplay|android\s+auto|obd\s*2|obdii|automotive\s+scanner|car\s+diagnostic\s+scanner|parking\s+sensor|reverse\s+sensor|car\s+gps|vehicle\s+gps)\b',r'\b(?:case|cover|holder|mount\s+for)\b'),
    ('car-accessories','automotive',r'\b(?:car|vehicle|automotive)\b[^,;]{0,45}\b(?:seat\s+cover|floor\s+mat|sun\s*shade|organizer|phone\s+mount|phone\s+holder|charger|vacuum|cleaning\s+brush|trash\s+can|cup\s+holder)\b|\b(?:steering\s+wheel\s+cover|car\s+seat\s+cover|car\s+floor\s+mats?|car\s+sun\s*shade|car\s+organizer|car\s+phone\s+(?:mount|holder)|car\s+charger)\b',r'\b(?:baby\s+car\s+seat|infant\s+car\s+seat)\b'),
    ('pet-feeders','pets',r'\b(?:automatic\s+(?:pet|dog|cat)\s+feeder|(?:pet|dog|cat)\s+(?:food\s+)?feeder|(?:pet|dog|cat)\s+(?:food|water)\s+bowl|(?:pet|dog|cat)\s+water\s+fountain)\b',''),
    ('pet-collars-leashes','pets',r'\b(?:(?:pet|dog|cat)\s+(?:collar|leash|lead|harness)|(?:collar|leash|harness)\s+for\s+(?:dogs?|cats?|pets?))\b',''),
    ('pet-beds','pets',r'\b(?:(?:pet|dog|cat)\s+(?:bed|sofa|hammock)|(?:bed|sofa|hammock)\s+for\s+(?:dogs?|cats?|pets?))\b',''),
    ('pet-litter','pets',r'\b(?:cat\s+litter|litter\s+box|self[- ]cleaning\s+litter\s+box|cat\s+toilet)\b',''),
    ('pet-grooming','pets',r'\b(?:pet|dog|cat)\b[^,;]{0,45}\b(?:grooming\s+brush|grooming\s+comb|deshedding\s+tool|hair\s+remover|nail\s+clipper|grooming\s+kit)\b|\b(?:grooming\s+brush|deshedding\s+tool)\b[^,;]{0,35}\b(?:dog|cat|pet)\b',''),
    ('lighting','lighting',r'\b(?:led\s+(?:strip\s+)?lights?|night\s+light|wall\s+lamp|desk\s+lamp|floor\s+lamp|table\s+lamp|ceiling\s+light|pendant\s+light|solar\s+(?:garden\s+)?lights?|garden\s+lights?|motion\s+sensor\s+light|ring\s+light|light\s+bulbs?|under[- ]cabinet\s+light)\b',r'\b(?:car\s+headlight|headlight|tail\s+light|indicator\s+light|warning\s+light|bike\s+light|bicycle\s+light|toy\s+light)\b'),
    ('baby-products','baby',r'\b(?:baby\s+(?:bath|bib|bibs|pacifier|teether|feeding\s+set|feeding\s+bowl|feeding\s+spoon|blanket|swaddle|sleeping\s+bag|play\s+mat|changing\s+mat|safety\s+gate|walker|bouncer|high\s+chair)|infant\s+(?:bib|pacifier|teether|feeding\s+set|blanket|swaddle|walker|bouncer|high\s+chair))\b',''),
    ('garden-supplies','home',r'\b(?:gardening\s+tool|garden\s+tool|plant\s+pot|flower\s+pot|garden\s+planter|watering\s+can|garden\s+hose|pruning\s+shears?|garden\s+gloves?|garden\s+sprinkler|hose\s+nozzle|plant\s+support|plant\s+stand|seed\s+starter|garden\s+edging|weed\s+puller|watering\s+wand|garden\s+sprayer)\b',''),
    ('kitchen-tools','kitchen',r'\b(?:chef(?:\'s)?\s+knife|paring\s+knife|bread\s+knife|steak\s+knife|santoku\s+knife|boning\s+knife|kitchen\s+cleaver|kitchen\s+scissors|kitchen\s+shears|spatula|whisk|kitchen\s+tongs?|colander|kitchen\s+grater|cheese\s+grater|vegetable\s+peeler|garlic\s+press|potato\s+masher)\b',r'\b(?:toy|miniature|dollhouse|keychain|pendant)\b'),
    ('hair-care','beauty',r'\b(?:lace\s+front\s+wig|human\s+hair\s+wig|synthetic\s+wig|hair\s+extensions?|hair\s+bundles?|clip[- ]in\s+hair|ponytail\s+extension|hair\s+weft)\b',''),
    ('jewelry-craft','jewelry-craft',r'\b(?:wedding\s+ring|engagement\s+ring|sterling\s+silver\s+ring|silver\s+ring|gold\s+ring|fashion\s+ring|finger\s+ring|adjustable\s+ring|cocktail\s+ring|signet\s+ring|women(?:\'s)?\s+ring|men(?:\'s)?\s+ring)\b',r'\b(?:ring\s+light|o[- ]?ring|piston\s+ring|key\s+ring|ring\s+toss|napkin\s+ring|towel\s+ring|phone\s+ring)\b'),
    ('bags','bags',r'\b(?:duffel\s+bag|duffle\s+bag|gym\s+bag|weekender\s+bag|messenger\s+bag|waist\s+bag|fanny\s+pack|makeup\s+bag|cosmetic\s+bag|toiletry\s+bag|beach\s+bag|shopping\s+tote|canvas\s+tote)\b',r'\b(?:tool\s+bag|vacuum\s+bag|dust\s+bag|filter\s+bag|trash\s+bag|garbage\s+bag|pet\s+waste\s+bag)\b'),
    ('toys-remote-control','toys',r'\b(?:remote\s+control\s+(?:car|truck|boat|toy)|rc\s+(?:car|truck|boat|helicopter|toy)|radio\s+controlled\s+(?:car|truck|boat|toy))\b',''),
    ('pet-toys','pets',r'\b(?:pet\s+toy|dog\s+toy|cat\s+toy|interactive\s+cat\s+toy|chew\s+toy\s+for\s+dogs?)\b',''),
    ('toys','toys',r'\b(?:toy|toys)\b',r'\b(?:(?:pet|dog|cat)\s+toys?|toys?\s+for\s+(?:pets?|dogs?|cats?)|toy\s+(?:storage|organizer|box|chest|bag|shelf|rack)|storage\s+for\s+toys?|toy\s+display)\b'),
    ('keyboard','computer',r'\bkeyboard\b',r'\b(?:tray|holder|stand|cover|case|skin|sticker|keycap|wrist\s+rest)\b'),
    ('mouse','computer',r'\b(?:usb|wireless|bluetooth|compact|ergonomic|gaming|optical|multi[- ]device)[^,;]{0,35}\bmouse\b|\bmouse\b[^,;]{0,35}\b(?:usb|wireless|bluetooth|compact|ergonomic|gaming|optical)\b',r'\b(?:mouse\s*pad|mousepad|mouse\s*mat|mouse\s*trap|toy\s*mouse)\b'),
    ('computer-accessories','computer',r'\b(?:monitor\s+(?:arm|mount|stand)|dual\s+monitor\s+(?:arm|mount|stand)|triple\s+monitor\s+(?:arm|mount|stand)|keyboard\s+tray)\b',''),
    ('monitor','computer',r'\b(?:gaming|computer|portable|pc|ultrawide)\s+monitor\b|\bmonitor\b[^,;]{0,45}\b(?:ips|oled|qhd|uhd|4k|1080p|refresh\s+rate|hz\b|vesa)\b',r'\b(?:mount|arm|stand|baby|blood\s+pressure|tire\s+pressure|fitness|exercise|camera\s+monitor)\b'),
    ('tablet','tablet',r'\btablet\b[^,;]{0,70}\b(?:4g|5g|lte|cellular|android|wi[- ]?fi|wifi|gb\b|octa[- ]?core|touchscreen|touch\s+screen|screen\s+unlocked)\b|\b(?:4g|5g|lte|cellular|android)\b[^,;]{0,70}\btablet\b',r'\b(?:cleaner|cleaning|magnesium|supplement|vitamin|chlorine|bromine|medicine|pill|pocket)\b'),
    ('speaker','speaker',r'\b(?:bluetooth|wireless|portable|waterproof|shower|stereo|bone\s+conduction)\b[^,;]{0,55}\bspeaker\b|\bspeaker\b[^,;]{0,55}\b(?:bluetooth|wireless|portable|waterproof|rechargeable|stereo)\b',r'\b(?:built[- ]in\s+speaker|camera\s+with\s+speaker|projector\s+with\s+speaker|speaker\s+ringer|speaker\s+buzzer)\b'),
    ('phone-parts','phone',r'\b(?:speaker\s+ringer|ringer\s+buzzer|speaker\s+buzzer|earpiece\s+speaker)\b[^,;]{0,45}\b(?:iphone|honor|galaxy|redmi|oppo|vivo|huawei|phone)\b|\bfor\s+(?:iphone|honor|galaxy|redmi|oppo|vivo|huawei)[^,;]{0,45}\b(?:speaker\s+ringer|ringer\s+buzzer|earpiece\s+speaker)\b',''),
    ('camera','camera',r'\b(?:security\s+camera|thermal\s+(?:imaging\s+)?camera|dash\s*cam|dash\s+camera|action\s+camera|trail\s+camera|solar\s+security\s+camera|ptz\s+camera|backup\s+camera|rear\s+view\s+camera)\b',r'\b(?:detector|toy\s+camera|camera\s+toy|pretend\s+play)\b'),
    ('projector','projector',r'\bprojector\b[^,;]{0,80}\b(?:ansi|android|wifi|wi[- ]?fi|1080p|4k|home\s+cinema|video|bt\s*5|bluetooth)\b|\b(?:ansi|android|wifi|wi[- ]?fi|1080p|4k|home\s+cinema|video)\b[^,;]{0,80}\bprojector\b',r'\b(?:projector\s+light|snowflake|starry|galaxy\s+light|holiday\s+decoration|night\s+light)\b'),
    ('eyewear','apparel',r'\b(?:sunglasses|sun\s+glasses|polarized\s+sunglasses|reading\s+glasses|eyeglasses)\b',''),
    ('luggage','bags',r'\b(?:luggage|suitcase|travel\s+suitcase|carry[- ]?on\s+suitcase|spinner\s+luggage|rolling\s+luggage)\b',r'\b(?:luggage\s+tag|luggage\s+cover|luggage\s+strap|luggage\s+scale)\b'),
    ('hair-care','beauty',r'\b(?:shampoo|conditioner|hair\s+mask|hair\s+serum|hair\s+oil)\b',r'\b(?:carpet\s+shampoo|pet\s+shampoo|dog\s+shampoo|cat\s+shampoo)\b'),
    ('pet-grooming','pets',r'\b(?:pet|dog|cat)\b[^,;]{0,40}\bshampoo\b|\bshampoo\b[^,;]{0,40}\b(?:pet|dog|cat)\b',''),
    ('massagers','beauty',r'\b(?:massage\s+gun|neck\s+massager|back\s+massager|foot\s+massager|handheld\s+massager|electric\s+massager|massage\s+pillow)\b',''),
    ('nail-care','beauty',r'\b(?:nail\s+polish|nail\s+art|gel\s+nail|nail\s+lamp|manicure|pedicure|nail\s+drill|nail\s+file)\b',''),
    ('home-appliances','home-appliances',r'\b(?:sewing\s+machine|portable\s+sewing\s+machine|mini\s+sewing\s+machine)\b',''),
    ('climate-appliances','home-appliances',r'\b(?:space\s+heater|portable\s+heater|electric\s+heater|ceramic\s+heater|room\s+heater)\b',r'\b(?:car\s+heater|aquarium\s+heater|water\s+heater)\b'),
    ('bedding','home',r'\b(?:throw\s+blanket|weighted\s+blanket|fleece\s+blanket|bed\s+blanket|electric\s+blanket)\b',''),
    ('camping','sports',r'\b(?:camping\s+tent|camping\s+chair|camping\s+stove|camping\s+table|sleeping\s+bag|camping\s+cot|camping\s+lantern)\b',''),
    ('toys','toys',r'\b(?:plush\s+toy|stuffed\s+toy|interactive\s+toy|educational\s+toy|sensory\s+toy|fidget\s+toy|toy\s+for\s+(?:kids|children|boys|girls)|kids?\s+toy)\b',r'\b(?:pet\s+toy|dog\s+toy|cat\s+toy)\b'),
    ('pet-toys','pets',r'\b(?:pet\s+toy|dog\s+toy|cat\s+toy|interactive\s+cat\s+toy|chew\s+toy\s+for\s+dogs?)\b',''),
    ('drinkware','kitchen',r'\b(?:travel\s+mug|coffee\s+mug|insulated\s+tumbler|water\s+bottle|stainless\s+steel\s+tumbler|vacuum\s+flask)\b',''),
    ('coffee-tea','kitchen',r'\b(?:coffee\s+beans?|ground\s+coffee|coffee\s+grounds|tea\s+bags?|loose\s+leaf\s+tea|instant\s+coffee)\b',''),
    ('garden-supplies','home',r'\b(?:gardening\s+tool|garden\s+tool|plant\s+pot|flower\s+pot|garden\s+planter|watering\s+can|garden\s+hose)\b',''),
]
COMPILED=[(ty,fa,re.compile(pos,re.I),re.compile(neg,re.I) if neg else None) for ty,fa,pos,neg in RULES]
ROLE_BY_TYPE={'computer-accessories':'accessory','phone-parts':'replacement_part','car-accessories':'accessory','automotive-parts':'replacement_part'}


def label(slug:str)->str:
    return slug.replace('-',' ').title()


def main():
    changed=[]
    all_rows=[]
    total=0
    before_unclassified=0
    for path in sorted(PRODUCTS.glob('*.json')):
        data=json.loads(path.read_text(encoding='utf-8'))
        if not isinstance(data,dict):
            raise SystemExit(f'Expected dict bucket: {path}')
        dirty=False
        for rid,r in data.items():
            total+=1
            if r.get('ty')=='unclassified':
                before_unclassified+=1
                title=str(r.get('t') or '')
                for ty,fa,pos,neg in COMPILED:
                    if not pos.search(title) or (neg and neg.search(title)):
                        continue
                    old_role=str(r.get('ro') or 'main')
                    r['ty']=ty
                    r['tyl']=label(ty)
                    r['fa']=fa
                    if ty in ROLE_BY_TYPE and old_role!='used':
                        r['ro']=ROLE_BY_TYPE[ty]
                    r['s']=' '.join(dict.fromkeys((str(r.get('s') or '')+' '+title+' '+ty+' '+fa+' '+str(r.get('ro') or 'main')).lower().split()))
                    changed.append({'id':rid,'title':title,'to':ty,'role':r.get('ro'),'seller':r.get('se')})
                    dirty=True
                    break
            all_rows.append(r)
        if dirty:
            path.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')),encoding='utf-8')

    type_counts=collections.Counter(str(r.get('ty') or 'unclassified') for r in all_rows)
    role_counts=collections.Counter(str(r.get('ro') or 'main') for r in all_rows)
    family_counts=collections.Counter(str(r.get('fa') or r.get('ty') or 'unclassified') for r in all_rows)
    after_unclassified=type_counts['unclassified']
    counts=collections.Counter(x['to'] for x in changed)
    OUT.mkdir(parents=True,exist_ok=True)
    report={
        'version':VERSION,
        'records':total,
        'unclassifiedBeforeResidual':before_unclassified,
        'unclassifiedAfterResidual':after_unclassified,
        'classifiedByResidual':len(changed),
        'unclassifiedAfterResidualPct':round(100*after_unclassified/max(1,total),2),
        'byType':counts.most_common(),
        'samples':changed[:200],
    }
    REPORT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

    if QUALITY.exists():
        q=json.loads(QUALITY.read_text(encoding='utf-8'))
        base_before=int(q.get('unclassifiedBefore') or before_unclassified)
        q['unclassifiedAfter']=after_unclassified
        q['unclassifiedReduction']=base_before-after_unclassified
        q['unclassifiedAfterPct']=round(100*after_unclassified/max(1,total),2)
        q['types']=type_counts.most_common()
        q['roles']=role_counts.most_common()
        q['families']=family_counts.most_common()
        q['familyCount']=len(family_counts)
        q['residualPassVersion']=VERSION
        q['residualClassified']=len(changed)
        q['residualBreakdown']=[{'type':ty,'count':n} for ty,n in counts.most_common()]
        QUALITY.write_text(json.dumps(q,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

    if SUMMARY.exists():
        s=json.loads(SUMMARY.read_text(encoding='utf-8'))
        s['types']=[{'slug':k,'label':label(k),'count':v} for k,v in type_counts.most_common()]
        s['roles']=dict(role_counts)
        s['families']=[{'slug':k,'label':label(k),'count':v} for k,v in family_counts.most_common()]
        gate=s.setdefault('qualityGateV20_9',{})
        gate['unclassifiedAfter']=after_unclassified
        gate['unclassifiedAfterPct']=round(100*after_unclassified/max(1,total),2)
        gate['residualPassVersion']=VERSION
        gate['residualClassified']=len(changed)
        SUMMARY.write_text(json.dumps(s,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

    if MANIFEST.exists():
        m=json.loads(MANIFEST.read_text(encoding='utf-8'))
        m.setdefault('truthCleanup',{}).update({
            'residualUnclassifiedPassVersion':VERSION,
            'residualUnclassifiedHighConfidenceOnly':True,
            'residualUnclassifiedRemaining':after_unclassified,
        })
        MANIFEST.write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

    print(json.dumps({
        'version':VERSION,
        'records':total,
        'unclassifiedBeforeResidual':before_unclassified,
        'classifiedByResidual':len(changed),
        'unclassifiedAfterResidual':after_unclassified,
        'unclassifiedAfterResidualPct':report['unclassifiedAfterResidualPct'],
        'familiesAfterResidual':len(family_counts),
        'byType':counts.most_common(),
    },indent=2))

if __name__=='__main__':
    main()
