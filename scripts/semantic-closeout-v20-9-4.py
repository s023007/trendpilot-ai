#!/usr/bin/env python3
from __future__ import annotations

import collections
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PRODUCTS = ROOT / 'data/v20-8/products'
Q = ROOT / 'data/v20-9/quality-report.json'
RESIDUAL = ROOT / 'data/v20-9/residual-report.json'
SUMMARY = ROOT / 'data/v20-8/taxonomy-summary.json'
MANIFEST = ROOT / 'data/v20-8/manifest.json'
REPORT = ROOT / 'data/v20-9/semantic-closeout.json'
VERSION = '20.9.4'

# Ordered, narrow corrections learned from the deployed Android shopper journey.
# First matching rule wins. High-risk ambiguous grammar is deliberately excluded.
RULES = [
    ('smartwatch-main', 'smartwatch', 'smartwatch', 'main', re.compile(
        r'^(?!.*\b(?:watch\s+band|watch\s+strap|watch\s+case|watch\s+cover|watch\s+charger|charging\s+cable|screen\s+protector)\b).*\b(?:smart\s*watch|smartwatch)\b', re.I)),
    ('phone-power-case', 'phone-accessories', 'phone', 'accessory', re.compile(
        r'\b(?:power\s*bank|powerbank|battery)\s+case\b[^,;]{0,90}\b(?:iphone|phone|galaxy|samsung|pixel|redmi|xiaomi|huawei|honor|oppo|vivo|realme)\b|'
        r'\bcase\b[^,;]{0,35}\b(?:with\s+)?(?:power\s*bank|powerbank|battery)\b[^,;]{0,80}\b(?:iphone|phone|galaxy|samsung)\b', re.I)),
    ('phone-screen-protector', 'phone-accessories', 'phone', 'accessory', re.compile(
        r'\b(?:screen\s+protector|tempered\s+glass|screen\s+guard|protective\s+film)\b[^,;]{0,90}\b(?:iphone|phone|galaxy|samsung|pixel|redmi|xiaomi|huawei|honor|oppo|vivo|realme)\b|'
        r'\b(?:iphone|galaxy|samsung|pixel|redmi|xiaomi|huawei|honor|oppo|vivo|realme)\b[^,;]{0,90}\b(?:screen\s+protector|tempered\s+glass|screen\s+guard|protective\s+film)\b', re.I)),
    ('phone-display-part', 'phone-parts', 'phone', 'replacement_part', re.compile(
        r'^(?!.*\b(?:smart\s*watch|smartwatch|earbuds?|earphones?|headphones?|power\s*bank|powerbank|portable\s+(?:lcd\s+)?monitor|gaming\s+monitor|unlocked\s+(?:mobile\s+)?phone|cell\s+phone|quad\s+core|\d+\s*gb\s+ram|\d+\s*gb\s+rom)\b)'
        r'(?=.*\b(?:iphone|samsung|galaxy|redmi|xiaomi|huawei|honor|oppo|vivo|realme|motorola|nokia|blackberry)\b)'
        r'.*\b(?:lcd\s+(?:screen|display|panel)|oled\s+(?:screen|display|panel)|amoled\s+(?:screen|display|panel)|display\s+assembly|screen\s+assembly|digitizer(?:\s+assembly)?|touch\s*screen\s+(?:digitizer|assembly)|lcds?\b)\b'
        r'.*\b(?:replacement|replace|repair|assembly|digitizer|with\s+frame|for\s+(?:iphone|samsung|galaxy|redmi|xiaomi|huawei|honor|oppo|vivo|realme|motorola|nokia|blackberry))\b', re.I)),
    ('phone-repair-tool', 'tools', 'tools', 'main', re.compile(
        r'\b(?:phone|mobile\s+phone|smartphone)\b[^,;]{0,75}\b(?:screen\s+removal|repair\s+tool|repair\s+station|heating\s+station|separator\s+machine|opening\s+tool|circuit\s+repair)\b|'
        r'\b(?:heating\s+station|separator\s+machine|screen\s+separator|repair\s+station)\b[^,;]{0,85}\b(?:phone|mobile\s+phone|smartphone)\b', re.I)),
    ('laptop-privacy-filter', 'laptop-accessories', 'laptop', 'accessory', re.compile(
        r'\bprivacy\s+(?:screen\s+)?filter\b[^,;]{0,80}\b(?:laptop|laptops|notebook|notebooks|macbook)\b|'
        r'\b(?:laptop|laptops|notebook|notebooks|macbook)\b[^,;]{0,80}\bprivacy\s+(?:screen\s+)?filter\b|'
        r'\banti[- ]?spy\b[^,;]{0,60}\b(?:laptop|macbook)\b', re.I)),
    ('laptop-screen-protector', 'laptop-accessories', 'laptop', 'accessory', re.compile(
        r'\b(?:laptop|notebook|macbook)\b[^,;]{0,65}\b(?:screen\s+protector|screen\s+guard|protective\s+film|anti[- ]glare\s+(?:film|protector))\b|'
        r'\b(?:screen\s+protector|screen\s+guard|protective\s+film|anti[- ]glare\s+(?:film|protector))\b[^,;]{0,65}\b(?:laptop|notebook|macbook)\b', re.I)),
    ('portable-monitor', 'monitor', 'computer', 'main', re.compile(
        r'\bportable\s+(?:lcd\s+|oled\s+|touch\s*screen\s+)?monitor\b|'
        r'\bportable\s+(?:touch\s*screen|display)\b[^,;]{0,45}\b(?:monitor|1080p|4k)\b', re.I)),
    ('laptop-motherboard', 'laptop-parts', 'laptop', 'replacement_part', re.compile(
        r'^(?!.*\b(?:\d+\s*gb\s+ram|\d+\s*gb\s+(?:ssd|rom)|windows?\s*(?:10|11)|win\s*(?:10|11))\b)'
        r'(?:.*\b(?:motherboard|mainboard|system\s+board)\b[^,;]{0,95}\b(?:laptop|notebook|thinkpad|ideapad|thinkbook|macbook|vivobook|zenbook|probook|elitebook|latitude|inspiron|aspire|legion)\b|'
        r'.*\b(?:laptop|notebook|thinkpad|ideapad|thinkbook|macbook|vivobook|zenbook|probook|elitebook|latitude|inspiron|aspire|legion)\b[^,;]{0,95}\b(?:motherboard|mainboard|system\s+board)\b)', re.I)),
    ('laptop-screen-part', 'laptop-parts', 'laptop', 'replacement_part', re.compile(
        r'^(?!.*\b(?:privacy|anti[- ]?spy|screen\s+protector|screen\s+guard|protective\s+film|portable\s+monitor|displayport|hdmi\s+(?:adapter|cable)|usb[- ]?c\s+monitor)\b)'
        r'(?:.*\b(?:lcd\s+screen|oled\s+screen|display\s+assembly|screen\s+assembly|replacement\s+screen|laptop\s+screen)\b[^,;]{0,75}\b(?:for|compatible\s+with)?\s*(?:laptop|notebook|thinkpad|ideapad|thinkbook|macbook|vivobook|zenbook|probook|elitebook|latitude|inspiron|aspire|legion)\b|'
        r'.*\b(?:laptop|notebook|thinkpad|ideapad|thinkbook|macbook|vivobook|zenbook|probook|elitebook|latitude|inspiron|aspire|legion)\b[^,;]{0,75}\b(?:lcd\s+screen|oled\s+screen|display\s+assembly|screen\s+assembly|replacement\s+screen)\b)', re.I)),
    ('perfume-vending-machine', 'industrial-components', 'industrial', 'main', re.compile(
        r'\b(?:perfume|fragrance)\b[^,;]{0,75}\b(?:vending\s+machine|dispensing\s+machine|filling\s+machine|packaging\s+machine)\b|'
        r'\b(?:vending\s+machine|dispensing\s+machine|filling\s+machine|packaging\s+machine)\b[^,;]{0,75}\b(?:perfume|fragrance)\b', re.I)),
    ('tool-battery-power-adapter', 'power-tool-accessories', 'tools', 'accessory', re.compile(
        r'\b(?:makita|dewalt|milwaukee|bosch|m18)\b[^,;]{0,105}\b(?:battery\s+adapter|adapter\s+converter|converter\s+charger|usb\s+c\s+power\s*bank)\b', re.I)),
    ('car-jump-starter', 'car-jump-starter', 'automotive', 'main', re.compile(
        r'\b(?:car\s+)?jump\s*starter\b|\bjumpstart(?:er)?\b', re.I)),
]


def label(slug: str) -> str:
    return slug.replace('-', ' ').title()


def first_rule(title: str):
    for rule in RULES:
        if rule[4].search(title):
            return rule
    return None


def main() -> None:
    changed = []
    rows = []
    for path in sorted(PRODUCTS.glob('*.json')):
        data = json.loads(path.read_text(encoding='utf-8'))
        dirty = False
        for rid, row in data.items():
            title = str(row.get('t') or '')
            rule = first_rule(title)
            if rule:
                reason, ty, fa, role, _ = rule
                before = (str(row.get('ty') or ''), str(row.get('fa') or ''), str(row.get('ro') or 'main'))
                after = (ty, fa, role if str(row.get('ro') or '') != 'used' else 'used')
                if before != after:
                    row['ty'] = ty
                    row['tyl'] = label(ty)
                    row['fa'] = fa
                    row['ro'] = after[2]
                    row['s'] = ' '.join(dict.fromkeys((str(row.get('s') or '') + ' ' + title + ' ' + ty + ' ' + fa + ' ' + row['ro']).lower().split()))
                    changed.append({'id': rid, 'title': title, 'reason': reason, 'before': before, 'after': after, 'seller': row.get('se')})
                    dirty = True
            rows.append(row)
        if dirty:
            path.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')

    types = collections.Counter(str(r.get('ty') or 'unclassified') for r in rows)
    roles = collections.Counter(str(r.get('ro') or 'main') for r in rows)
    families = collections.Counter(str(r.get('fa') or r.get('ty') or 'unclassified') for r in rows)
    reasons = collections.Counter(x['reason'] for x in changed)
    unclassified_after = int(types.get('unclassified', 0))
    unclassified_pct = round(100 * unclassified_after / max(1, len(rows)), 2)

    # Hard guard uses the same first-match contract as the correction pass.
    violations = []
    for r in rows:
        title = str(r.get('t') or '')
        rule = first_rule(title)
        if not rule:
            continue
        reason, target_ty, target_fa, target_role, _ = rule
        ty, fa, role = str(r.get('ty') or ''), str(r.get('fa') or ''), str(r.get('ro') or 'main')
        expected_role = role if role == 'used' else target_role
        if role != 'used' and (ty, fa, role) != (target_ty, target_fa, expected_role):
            violations.append({'id': r.get('id'), 'title': title, 'reason': reason, 'actual': [ty, fa, role]})

    payload = {
        'version': VERSION,
        'records': len(rows),
        'corrected': len(changed),
        'violations': len(violations),
        'unclassifiedAfter': unclassified_after,
        'unclassifiedAfterPct': unclassified_pct,
        'byReason': reasons.most_common(),
        'samples': changed[:100],
        'violationSamples': violations[:25],
    }
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    residual_before = None
    if RESIDUAL.exists():
        residual = json.loads(RESIDUAL.read_text(encoding='utf-8'))
        residual_before = int(residual.get('unclassifiedBeforeResidual') or unclassified_after)
        residual['unclassifiedAfterResidual'] = unclassified_after
        residual['classifiedByResidual'] = max(0, residual_before - unclassified_after)
        residual['unclassifiedAfterResidualPct'] = unclassified_pct
        residual['semanticCloseoutVersion'] = VERSION
        residual['semanticCorrections'] = len(changed)
        residual['semanticCloseoutViolations'] = len(violations)
        RESIDUAL.write_text(json.dumps(residual, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    if Q.exists():
        q = json.loads(Q.read_text(encoding='utf-8'))
        unclassified_before = int(q.get('unclassifiedBefore') or unclassified_after)
        q['unclassifiedAfter'] = unclassified_after
        q['unclassifiedReduction'] = max(0, unclassified_before - unclassified_after)
        q['unclassifiedAfterPct'] = unclassified_pct
        if residual_before is not None:
            q['residualClassified'] = max(0, residual_before - unclassified_after)
        q['types'] = types.most_common()
        q['roles'] = roles.most_common()
        q['families'] = families.most_common()
        q['familyCount'] = len(families)
        q['semanticCloseoutVersion'] = VERSION
        q['semanticCorrections'] = len(changed)
        q['semanticCloseoutViolations'] = len(violations)
        Q.write_text(json.dumps(q, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    if SUMMARY.exists():
        s = json.loads(SUMMARY.read_text(encoding='utf-8'))
        s['types'] = [{'slug': k, 'label': label(k), 'count': v} for k, v in types.most_common()]
        s['roles'] = dict(roles)
        s['families'] = [{'slug': k, 'label': label(k), 'count': v} for k, v in families.most_common()]
        gate = s.setdefault('qualityGateV20_9', {})
        gate.update({
            'unclassifiedAfter': unclassified_after,
            'unclassifiedAfterPct': unclassified_pct,
            'semanticCloseoutVersion': VERSION,
            'semanticCorrections': len(changed),
            'semanticCloseoutViolations': len(violations),
        })
        if residual_before is not None:
            gate['residualClassified'] = max(0, residual_before - unclassified_after)
        SUMMARY.write_text(json.dumps(s, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    if MANIFEST.exists():
        m = json.loads(MANIFEST.read_text(encoding='utf-8'))
        m.setdefault('truthCleanup', {}).update({
            'residualUnclassifiedRemaining': unclassified_after,
            'semanticCloseoutVersion': VERSION,
            'semanticCorrections': len(changed),
            'semanticCloseoutViolations': len(violations),
        })
        MANIFEST.write_text(json.dumps(m, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    print(json.dumps(payload, ensure_ascii=False, indent=2))
    if violations:
        raise SystemExit(f'V20.9.4 semantic closeout failed with {len(violations)} violation(s)')


if __name__ == '__main__':
    main()
