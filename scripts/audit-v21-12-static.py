#!/usr/bin/env python3
from __future__ import annotations
import json,re
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'artifacts/v21-12-static';OUT.mkdir(parents=True,exist_ok=True)
CORE=[
'index.html','find/index.html','item/index.html','compare/index.html','deals/index.html','rare-used/index.html','rare-used/view/index.html',
'tickets/index.html','ticket/index.html','price-watch/index.html','products/index.html','guides/index.html','sourcing/index.html','wholesale/index.html','software/index.html',
'about.html','editorial-methodology.html','how-we-test.html','affiliate-disclosure.html','privacy.html','terms.html','contact.html','corrections.html','404.html'
]
TRUST={'about.html','editorial-methodology.html','how-we-test.html','affiliate-disclosure.html','privacy.html','terms.html','contact.html','corrections.html'}
BLOCK=re.compile(r'\b(?:Temu|Joom|FilamentPRO)\b',re.I)
OLD_DOMAIN='trendpilot-ai.netlify.app'
checks={};failures=[];warnings=[]
def ck(name,ok,detail=''):
    checks[name]=bool(ok)
    if not ok: failures.append({'name':name,'detail':str(detail)})
def warn(name,detail=''):warnings.append({'name':name,'detail':str(detail)})

missing=[p for p in CORE if not (ROOT/p).exists()];ck('core_pages_exist',not missing,missing)
refs=[];internal_html=[]
for rel in CORE:
    p=ROOT/rel
    if not p.exists():continue
    s=p.read_text(encoding='utf-8',errors='replace')
    ck(f'{rel}_single_html',s.lower().count('<html')==1,s.lower().count('<html'))
    ck(f'{rel}_single_body',s.lower().count('<body')==1,s.lower().count('<body'))
    if rel!='404.html': ck(f'{rel}_no_old_domain',OLD_DOMAIN not in s,OLD_DOMAIN if OLD_DOMAIN in s else '')
    visible=re.sub(r'<script.*?</script>','',s,flags=re.I|re.S)
    ck(f'{rel}_no_blocked_seller_copy',not BLOCK.search(visible),BLOCK.search(visible).group(0) if BLOCK.search(visible) else '')
    if rel in TRUST:
        ck(f'{rel}_v21_trust_shell','data-tp-page="trust"' in s and 'trendpilot-v21-2-1-final.css?v=21.12.0' in s)
        ck(f'{rel}_single_header',len(re.findall(r'<header\b',s,re.I))==1,len(re.findall(r'<header\b',s,re.I)))
        ck(f'{rel}_single_footer',len(re.findall(r'<footer\b',s,re.I))==1,len(re.findall(r'<footer\b',s,re.I)))
    for m in re.finditer(r'(?:src|href)=["\'](/[^"\'#?]+)',s,re.I):
        path=m.group(1)
        if path.startswith(('/api/','/product/','/item/','/find/','/rare-used/finds/','/ticket/')):continue
        suffix=Path(path).suffix.lower()
        if suffix in {'.js','.css','.svg','.png','.jpg','.jpeg','.webp','.ico','.webmanifest','.json'}:refs.append((rel,path))
        elif suffix in {'','.html'}:internal_html.append((rel,path))
missing_refs=[(rel,path) for rel,path in refs if not (ROOT/path.lstrip('/')).exists()]
ck('core_static_asset_references_exist',not missing_refs,missing_refs[:30])

def local_page(path:str)->Path|None:
    raw=path.lstrip('/')
    if not raw:return ROOT/'index.html'
    p=ROOT/raw
    if p.is_dir():return p/'index.html'
    if p.suffix:return p
    return p/'index.html'
missing_pages=[]
for rel,path in internal_html:
    target=local_page(path)
    if target is not None and not target.exists():missing_pages.append((rel,path,str(target.relative_to(ROOT))))
ck('core_internal_page_targets_exist',not missing_pages,missing_pages[:40])

home=(ROOT/'index.html').read_text(encoding='utf-8');find=(ROOT/'find/index.html').read_text(encoding='utf-8');rare=(ROOT/'rare-used/index.html').read_text(encoding='utf-8');rare_view=(ROOT/'rare-used/view/index.html').read_text(encoding='utf-8');ws=(ROOT/'wholesale/index.html').read_text(encoding='utf-8')
ck('home_uses_v21_12_autocomplete','smart-suggestions-v20-7-7.js?v=21.12.0' in home)
ck('find_uses_v21_12_autocomplete','smart-suggestions-v20-7-7.js?v=21.12.0' in find)
ck('find_uses_v21_12_query_normalizer','query-normalizer-v21-3.js?v=21.12.0' in find)
ck('rare_uses_v21_12_runtime','rare-finds-v20-8.js?v=21.12.0' in rare)
ck('rare_detail_uses_v21_12_runtime','rare-find-detail-v20-8-7.js?v=21.12.0' in rare_view)
ck('wholesale_uses_v21_12_runtime','wholesale-v14.js?v=21.12.0' in ws)

for rel,action in [('products/index.html','/find/'),('software/index.html','/find/'),('sourcing/index.html','/wholesale/')]:
    s=(ROOT/rel).read_text(encoding='utf-8')
    ck(f'{rel}_form_action',bool(re.search(rf'<form[^>]*data-tp-tool-form[^>]*action=["\']{re.escape(action)}["\']',s,re.I)),action)
    ck(f'{rel}_form_get',bool(re.search(r'<form[^>]*data-tp-tool-form[^>]*method=["\']get["\']',s,re.I)),'method=get')

def load_json(rel):
    p=ROOT/rel
    if not p.exists():warn(f'{rel}_missing','not present');return None
    try:return json.loads(p.read_text(encoding='utf-8'))
    except Exception as e:failures.append({'name':f'{rel}_json','detail':str(e)});return None

sellers=load_json('data/admitad-approved-sellers.json')
if sellers is not None:
    names=' '.join(str(x.get('name') or '') for x in sellers.get('sellers',[]))
    ck('data/admitad-approved-sellers.json_no_blocked_public_seller',not BLOCK.search(names),BLOCK.search(names).group(0) if BLOCK.search(names) else '')
    ck('data/admitad-approved-sellers.json_no_unnamed_public_seller',all(str(x.get('name') or '').strip() for x in sellers.get('sellers',[])))
coupons=load_json('data/coupons.json')
if coupons is not None:
    names=' '.join(f"{x.get('merchant_name','')} {x.get('merchant_key','')}" for x in coupons.get('coupons',[]))
    ck('data/coupons.json_no_blocked_public_seller',not BLOCK.search(names),BLOCK.search(names).group(0) if BLOCK.search(names) else '')
    ck('data/coupons.json_count_matches',coupons.get('count')==len(coupons.get('coupons',[])),{'count':coupons.get('count'),'rows':len(coupons.get('coupons',[]))})
report_path=ROOT/'data/coupon-report.json'
if report_path.exists():
    cr=json.loads(report_path.read_text(encoding='utf-8'))
    ck('coupon_report_current_ad_space',int(cr.get('ad_space',{}).get('id') or 0)==2980568,cr.get('ad_space'))
    ck('coupon_report_current_domain','trendpilotchoice.com' in str(cr.get('ad_space',{}).get('site_url') or '').lower(),cr.get('ad_space'))
wholesale=load_json('data/wholesale-index.json')
if wholesale is not None:
    names=' '.join(f"{x.get('platform','')} {x.get('seller','')}" for x in wholesale.get('products',[]))
    ck('data/wholesale-index.json_no_blocked_public_seller',not BLOCK.search(names),BLOCK.search(names).group(0) if BLOCK.search(names) else '')

active=['js/smart-suggestions-v20-7-7.js','js/query-normalizer-v21-3.js','js/universal-discovery-v20-9-1.js','js/rare-finds-v20-8.js','js/rare-find-detail-v20-8-7.js','js/ticket-decision-v14.js','js/ticket-detail-v14.js','js/wholesale-v14.js','js/compare-v20-9.js','js/item-detail-v20-9.js','netlify/functions/products-v20-suggest.mjs']
for rel in active:ck(f'{rel}_exists',(ROOT/rel).exists())
for rel in ['js/universal-discovery-v20-9-1.js','js/wholesale-v14.js','netlify/functions/products-v20-suggest.mjs']:
    text=(ROOT/rel).read_text(encoding='utf-8',errors='replace')
    ck(f'{rel}_blocked_guard',all(x in text.lower() for x in ['temu','joom','filamentpro']))
ck('autocomplete_has_shoes',"['shoes'" in (ROOT/'js/smart-suggestions-v20-7-7.js').read_text(encoding='utf-8'))
ck('query_normalizer_has_apparel','return "apparel"' in (ROOT/'js/query-normalizer-v21-3.js').read_text(encoding='utf-8'))
ck('rare_cards_use_maintained_view','const internalDest=r=>`/rare-used/view/?id=' in (ROOT/'js/rare-finds-v20-8.js').read_text(encoding='utf-8'))
ck('ticket_inventory_truthful',json.loads((ROOT/'data/ticket-inventory.json').read_text(encoding='utf-8')).get('listings')==[],'live listings should remain empty unless a live source exists')

seo=list((ROOT/'rare-used/finds').glob('*/index.html')) if (ROOT/'rare-used/finds').exists() else []
ck('rare_static_seo_pages_exist',len(seo)>0,len(seo))
if seo:
    sample=seo[::25]
    if seo[-1] not in sample:sample.append(seo[-1])
    bad=[]
    for p in sample:
        s=p.read_text(encoding='utf-8',errors='replace')
        if 'What is this product?' not in s or 'trendpilot-v21-2-1-final.css?v=21.12.0' not in s:bad.append(str(p.relative_to(ROOT)))
    ck('rare_static_seo_sample_current',not bad,bad[:20])

writers=[];manual_writers=[]
for p in (ROOT/'.github/workflows').glob('*.yml'):
    s=p.read_text(encoding='utf-8',errors='replace')
    auto=bool(re.search(r'(?m)^\s{0,4}(?:push|schedule|workflow_run|pull_request)\s*:',s));writer='contents: write' in s or bool(re.search(r'\bgit\s+push\b',s))
    if writer and auto:writers.append(p.name)
    elif writer:manual_writers.append(p.name)
allowed={'trendpilot-admitad-new-account-live-sync.yml','update-admitad-coupons-api.yml'}
ck('automatic_writers_are_known',set(writers).issubset(allowed),writers)
ck('obsolete_manual_writers_absent',not manual_writers,manual_writers)

report={'version':'21.12.2','checks':checks,'failures':failures,'warnings':warnings,'automatic_writers':writers,'manual_writers':manual_writers,'core_pages':CORE,'static_refs_checked':len(refs),'internal_pages_checked':len(internal_html),'rare_seo_pages':len(seo),'passed':not failures and all(checks.values())}
(OUT/'report.json').write_text(json.dumps(report,indent=2,ensure_ascii=False),encoding='utf-8')
print(json.dumps({'passed':report['passed'],'checks':len(checks),'failures':failures,'warnings':warnings,'automatic_writers':writers,'manual_writers':manual_writers,'rare_seo_pages':len(seo)},indent=2,ensure_ascii=False))
raise SystemExit(0 if report['passed'] else 1)
