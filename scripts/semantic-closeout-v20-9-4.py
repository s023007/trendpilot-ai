#!/usr/bin/env python3
from __future__ import annotations

import collections
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PRODUCTS = ROOT / 'data/v20-8/products'
Q = ROOT / 'data/v20-9/quality-report.json'
SUMMARY = ROOT / 'data/v20-8/taxonomy-summary.json'
MANIFEST = ROOT / 'data/v20-8/manifest.json'
REPORT = ROOT / 'data/v20-9/semantic-closeout.json'
VERSION = '20.9.4'

# These are narrow corrections learned from the deployed Android shopper journey.
# They intentionally target explicit product nouns/grammar rather than broad tokens.
RULES = [
    ('phone-display-part', 'phone-parts', 'phone', 'replacement_part', re.compile(
        r'\b(?:lcd|oled|amoled|touch\s*screen|digitizer)\b[^,;]{0,55}\b(?:display|screen|assembly)?\b[^,;]{0,65}\b(?:for|compatible\s+with|fits?)\b[^,;]{0,80}\b(?:iphone|samsung|galaxy|redmi|xiaomi|huawei|honor|oppo|vivo|realme|phone)\b|'
        r'\b(?:mobile\s+phone|smartphone)\b[^,;]{0,55}\b(?:lcd\s+display|oled\s+display|display\s+assembly|screen\s+assembly|digitizer|touch\s*screen)\b|'
        r'\b(?:lcd\s+display|oled\s+display|display\s+assembly|screen\s+assembly|digitizer|touch\s*screen)\b[^,;]{0,80}\b(?:iphone|samsung|galaxy|redmi|xiaomi|huawei|honor|oppo|vivo|realme)\b', re.I)),
    ('phone-power-case', 'phone-accessories', 'phone', 'accessory', re.compile(
        r'\b(?:power\s*bank|powerbank|battery|charging)\s+case\b[^,;]{0,80}\b(?:iphone|phone|galaxy|samsung|pixel|redmi|huawei|honor|oppo|vivo)\b|'
        r'\bcase\b[^,;]{0,30}\b(?:with\s+)?(?:power\s*bank|powerbank|battery)\b[^,;]{0,70}\b(?:iphone|phone|galaxy|samsung)\b', re.I)),
    ('phone-repair-tool', 'tools', 'tools', 'main', re.compile(
        r'\b(?:phone|mobile\s+phone|smartphone)\b[^,;]{0,70}\b(?:screen\s+removal|repair\s+tool|repair\s+station|heating\s+station|separator\s+machine|opening\s+tool|circuit\s+repair)\b|'
        r'\b(?:heating\s+station|separator\s+machine|screen\s+separator|repair\s+station)\b[^,;]{0,80}\b(?:phone|mobile\s+phone|smartphone)\b', re.I)),
    ('laptop-privacy-filter', 'laptop-accessories', 'laptop', 'accessory', re.compile(
        r'\bprivacy\s+(?:screen\s+)?filter\b[^,;]{0,70}\b(?:laptop|laptops|notebook|notebooks)\b|'
        r'\b(?:laptop|laptops|notebook|notebooks)\b[^,;]{0,70}\bprivacy\s+(?:screen\s+)?filter\b', re.I)),
    ('laptop-motherboard', 'laptop-parts', 'laptop', 'replacement_part', re.compile(
        r'\b(?:motherboard|mainboard|system\s+board)\b[^,;]{0,90}\b(?:laptop|notebook|thinkpad|ideapad|thinkbook|macbook|vivobook|zenbook|probook|elitebook|latitude|inspiron|aspire|legion)\b|'
        r'\b(?:laptop|notebook|thinkpad|ideapad|thinkbook|macbook|vivobook|zenbook|probook|elitebook|latitude|inspiron|aspire|legion)\b[^,;]{0,90}\b(?:motherboard|mainboard|system\s+board)\b', re.I)),
    ('laptop-screen-part', 'laptop-parts', 'laptop', 'replacement_part', re.compile(
        r'\b(?:lcd|oled|display|screen|touch\s*screen)\b[^,;]{0,50}\b(?:for|replacement\s+for|compatible\s+with)\b[^,;]{0,90}\b(?:laptop|notebook|thinkpad|ideapad|thinkbook|macbook|vivobook|zenbook|probook|elitebook|latitude|inspiron|aspire|legion)\b', re.I)),
    ('perfume-vending-machine', 'industrial-components', 'industrial', 'main', re.compile(
        r'\b(?:perfume|fragrance)\b[^,;]{0,70}\b(?:vending\s+machine|dispensing\s+machine|filling\s+machine|packaging\s+machine)\b|'
        r'\b(?:vending\s+machine|dispensing\s+machine|filling\s+machine|packaging\s+machine)\b[^,;]{0,70}\b(?:perfume|fragrance)\b', re.I)),
    ('tool-battery-power-adapter', 'power-tool-accessories', 'tools', 'accessory', re.compile(
        r'\b(?:makita|dewalt|milwaukee|bosch|m18)\b[^,;]{0,100}\b(?:battery\s+adapter|adapter\s+converter|converter\s+charger|usb\s+c\s+power\s*bank)\b', re.I)),
    ('car-jump-starter', 'car-jump-starter', 'automotive', 'main', re.compile(
        r'\b(?:car\s+)?jump\s*starter\b|\bjumpstart(?:er)?\b', re.I)),
]


def label(slug: str) -> str:
    return slug.replace('-', ' ').title()


def main() -> None:
    changed = []
    rows = []
    for path in sorted(PRODUCTS.glob('*.json')):
        data = json.loads(path.read_text(encoding='utf-8'))
        dirty = False
        for rid, row in data.items():
            title = str(row.get('t') or '')
            for reason, ty, fa, role, pattern in RULES:
                if not pattern.search(title):
                    continue
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
                break
            rows.append(row)
        if dirty:
            path.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')

    types = collections.Counter(str(r.get('ty') or 'unclassified') for r in rows)
    roles = collections.Counter(str(r.get('ro') or 'main') for r in rows)
    families = collections.Counter(str(r.get('fa') or r.get('ty') or 'unclassified') for r in rows)
    reasons = collections.Counter(x['reason'] for x in changed)

    # Hard guard: the exact false-positive grammars must not remain in a main row of the wrong family.
    violations = []
    for r in rows:
        title = str(r.get('t') or '')
        ty, fa, role = str(r.get('ty') or ''), str(r.get('fa') or ''), str(r.get('ro') or 'main')
        for reason, target_ty, target_fa, target_role, pattern in RULES:
            if pattern.search(title) and role != 'used' and (ty, fa, role) != (target_ty, target_fa, target_role):
                violations.append({'id': r.get('id'), 'title': title, 'reason': reason, 'actual': [ty, fa, role]})
                break

    payload = {
        'version': VERSION,
        'records': len(rows),
        'corrected': len(changed),
        'violations': len(violations),
        'byReason': reasons.most_common(),
        'samples': changed[:100],
        'violationSamples': violations[:25],
    }
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    if Q.exists():
        q = json.loads(Q.read_text(encoding='utf-8'))
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
        s.setdefault('qualityGateV20_9', {}).update({
            'semanticCloseoutVersion': VERSION,
            'semanticCorrections': len(changed),
            'semanticCloseoutViolations': len(violations),
        })
        SUMMARY.write_text(json.dumps(s, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    if MANIFEST.exists():
        m = json.loads(MANIFEST.read_text(encoding='utf-8'))
        m.setdefault('truthCleanup', {}).update({
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
