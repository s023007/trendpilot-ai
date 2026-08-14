#!/usr/bin/env python3
from __future__ import annotations

import collections
import json
import re
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
PRODUCTS=ROOT/'data/v20-8/products'
REPORT=ROOT/'data/v20-9/residual-report.json'
VERSION='20.9.2'

RULES=[
    # Clear computer input devices. Exclusions prevent stands/trays/covers from becoming the device itself.
    ('keyboard','computer',r'\bkeyboard\b',r'\b(?:tray|holder|stand|cover|case|skin|sticker|keycap|wrist\s+rest)\b'),
    ('mouse','computer',r'\b(?:usb|wireless|bluetooth|compact|ergonomic|gaming|optical|multi[- ]device)[^,;]{0,35}\bmouse\b|\bmouse\b[^,;]{0,35}\b(?:usb|wireless|bluetooth|compact|ergonomic|gaming|optical)\b',r'\b(?:mouse\s*pad|mousepad|mouse\s*mat|mouse\s*trap|toy\s*mouse)\b'),
    ('computer-accessories','computer',r'\b(?:monitor\s+(?:arm|mount|stand)|dual\s+monitor\s+(?:arm|mount|stand)|triple\s+monitor\s+(?:arm|mount|stand)|keyboard\s+tray)\b',''),
    ('monitor','computer',r'\b(?:gaming|computer|portable|pc|ultrawide)\s+monitor\b|\bmonitor\b[^,;]{0,45}\b(?:ips|oled|qhd|uhd|4k|1080p|refresh\s+rate|hz\b|vesa)\b',r'\b(?:mount|arm|stand|baby|blood\s+pressure|tire\s+pressure|fitness|exercise|camera\s+monitor)\b'),
    # Tablets need device evidence so medicine/cleaner "tablets" remain excluded.
    ('tablet','tablet',r'\btablet\b[^,;]{0,70}\b(?:4g|5g|lte|cellular|android|wi[- ]?fi|wifi|gb\b|octa[- ]?core|touchscreen|touch\s+screen|screen\s+unlocked)\b|\b(?:4g|5g|lte|cellular|android)\b[^,;]{0,70}\btablet\b',r'\b(?:cleaner|cleaning|magnesium|supplement|vitamin|chlorine|bromine|medicine|pill|pocket)\b'),
    # Audio.
    ('speaker','speaker',r'\b(?:bluetooth|wireless|portable|waterproof|shower|stereo|bone\s+conduction)\b[^,;]{0,55}\bspeaker\b|\bspeaker\b[^,;]{0,55}\b(?:bluetooth|wireless|portable|waterproof|rechargeable|stereo)\b',r'\b(?:built[- ]in\s+speaker|camera\s+with\s+speaker|projector\s+with\s+speaker|speaker\s+ringer|speaker\s+buzzer)\b'),
    ('phone-parts','phone',r'\b(?:speaker\s+ringer|ringer\s+buzzer|speaker\s+buzzer|earpiece\s+speaker)\b[^,;]{0,45}\b(?:iphone|honor|galaxy|redmi|oppo|vivo|huawei|phone)\b|\bfor\s+(?:iphone|honor|galaxy|redmi|oppo|vivo|huawei)[^,;]{0,45}\b(?:speaker\s+ringer|ringer\s+buzzer|earpiece\s+speaker)\b',''),
    # Cameras and imaging. Toy cameras and detectors are deliberately excluded.
    ('camera','camera',r'\b(?:security\s+camera|thermal\s+(?:imaging\s+)?camera|dash\s*cam|dash\s+camera|action\s+camera|trail\s+camera|solar\s+security\s+camera|ptz\s+camera|backup\s+camera|rear\s+view\s+camera)\b',r'\b(?:detector|toy\s+camera|camera\s+toy|pretend\s+play)\b'),
    ('projector','projector',r'\bprojector\b[^,;]{0,80}\b(?:ansi|android|wifi|wi[- ]?fi|1080p|4k|home\s+cinema|video|bt\s*5|bluetooth)\b|\b(?:ansi|android|wifi|wi[- ]?fi|1080p|4k|home\s+cinema|video)\b[^,;]{0,80}\bprojector\b',r'\b(?:projector\s+light|snowflake|starry|galaxy\s+light|holiday\s+decoration|night\s+light)\b'),
    # Fashion / travel.
    ('eyewear','apparel',r'\b(?:sunglasses|sun\s+glasses|polarized\s+sunglasses|reading\s+glasses|eyeglasses)\b',''),
    ('luggage','bags',r'\b(?:luggage|suitcase|travel\s+suitcase|carry[- ]?on\s+suitcase|spinner\s+luggage|rolling\s+luggage)\b',r'\b(?:luggage\s+tag|luggage\s+cover|luggage\s+strap|luggage\s+scale)\b'),
    # Personal care.
    ('hair-care','beauty',r'\b(?:shampoo|conditioner|hair\s+mask|hair\s+serum|hair\s+oil)\b',r'\b(?:carpet\s+shampoo|pet\s+shampoo|dog\s+shampoo|cat\s+shampoo)\b'),
    ('pet-grooming','pets',r'\b(?:pet|dog|cat)\b[^,;]{0,40}\bshampoo\b|\bshampoo\b[^,;]{0,40}\b(?:pet|dog|cat)\b',''),
    ('massagers','beauty',r'\b(?:massage\s+gun|neck\s+massager|back\s+massager|foot\s+massager|handheld\s+massager|electric\s+massager|massage\s+pillow)\b',''),
    ('nail-care','beauty',r'\b(?:nail\s+polish|nail\s+art|gel\s+nail|nail\s+lamp|manicure|pedicure|nail\s+drill|nail\s+file)\b',''),
    # Home / hobbies.
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

ROLE_BY_TYPE={
    'computer-accessories':'accessory','phone-parts':'replacement_part'
}

def label(slug:str)->str:
    return slug.replace('-',' ').title()

def main():
    changed=[]
    total=0
    before_unclassified=0
    for path in sorted(PRODUCTS.glob('*.json')):
        data=json.loads(path.read_text(encoding='utf-8'))
        if not isinstance(data,dict):
            raise SystemExit(f'Expected dict bucket: {path}')
        dirty=False
        for rid,r in data.items():
            total+=1
            if r.get('ty')!='unclassified':
                continue
            before_unclassified+=1
            title=str(r.get('t') or '')
            for ty,fa,pos,neg in COMPILED:
                if not pos.search(title) or (neg and neg.search(title)):
                    continue
                old_role=str(r.get('ro') or 'main')
                r['ty']=ty;r['tyl']=label(ty);r['fa']=fa
                if ty in ROLE_BY_TYPE and old_role!='used':
                    r['ro']=ROLE_BY_TYPE[ty]
                # Search metadata only; commerce identity/evidence fields remain untouched.
                r['s']=' '.join(dict.fromkeys((str(r.get('s') or '')+' '+title+' '+ty+' '+fa+' '+str(r.get('ro') or 'main')).lower().split()))
                changed.append({'id':rid,'title':title,'to':ty,'role':r.get('ro'),'seller':r.get('se')})
                dirty=True
                break
        if dirty:
            path.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')),encoding='utf-8')

    after=before_unclassified-len(changed)
    counts=collections.Counter(x['to'] for x in changed)
    REPORT.parent.mkdir(parents=True,exist_ok=True)
    report={
        'version':VERSION,'records':total,'unclassifiedBeforeResidual':before_unclassified,
        'unclassifiedAfterResidual':after,'classifiedByResidual':len(changed),
        'byType':counts.most_common(),'samples':changed[:160]
    }
    REPORT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({k:v for k,v in report.items() if k!='samples'},indent=2))

if __name__=='__main__':
    main()
