#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'data/v20-9/contract-debug.json'


def load(path):
    return json.loads((ROOT/path).read_text(encoding='utf-8'))


def main():
    q=load(Path('data/v20-9/quality-report.json'))
    r=load(Path('data/v20-9/residual-report.json'))
    d=load(Path('data/v20-9/diagnostic.json'))
    rt=load(Path('data/v20-9/runtime-manifest.json'))
    fam=load(Path('data/v20-9/families.json'))
    roles=load(Path('data/v20-9/family-roles.json'))
    m=load(Path('data/v20-8/manifest.json'))
    s=load(Path('data/v20-8/taxonomy-summary.json'))
    rare=load(Path('data/v20-8/rare-index.json'))

    checks={}
    values={
        'q_records':q.get('records'),'r_records':r.get('records'),'d_records':d.get('records'),'rt_records':rt.get('records'),
        'unclassified_before':q.get('unclassifiedBefore'),'residual_before':r.get('unclassifiedBeforeResidual'),
        'residual_version_q':q.get('residualPassVersion'),'residual_classified_q':q.get('residualClassified'),
        'residual_classified_r':r.get('classifiedByResidual'),'unclassified_q':q.get('unclassifiedAfter'),
        'unclassified_r':r.get('unclassifiedAfterResidual'),'unclassified_d':d.get('unclassified'),
        'blocked':q.get('blockedSellerLeaks'),'immutable':q.get('immutableCommerceFieldsChanged'),
        'runtime_buckets':rt.get('productBuckets'),'runtime_max':rt.get('maxProductBucketBytes'),
        'family_strategy':rt.get('familyStrategy'),'family_len':len(fam),'role_family_len':len(roles),
        'manifest_version':m.get('version'),'summary_version':s.get('version'),
        'manifest_residual':m.get('truthCleanup',{}).get('residualUnclassifiedPassVersion'),
        'manifest_rare':m.get('truthCleanup',{}).get('rareCloseoutVersion'),
        'manifest_rare_count':m.get('rarePublished'),'rare_len':len(rare),
    }
    def add(name,ok): checks[name]=bool(ok)
    add('records_all_52031',q.get('records')==r.get('records')==d.get('records')==rt.get('records')==52031)
    add('unclassified_before_9355',q.get('unclassifiedBefore')==9355)
    add('residual_before_3388',r.get('unclassifiedBeforeResidual')==3388)
    add('residual_version',q.get('residualPassVersion')=='20.9.2')
    add('residual_counts_match',q.get('residualClassified')==r.get('classifiedByResidual'))
    add('final_unclassified_counts_match',q.get('unclassifiedAfter')==r.get('unclassifiedAfterResidual')==d.get('unclassified'))
    add('final_unclassified_le_2500',int(q.get('unclassifiedAfter') or 999999)<=2500)
    add('blocked_zero',q.get('blockedSellerLeaks')==0)
    add('immutable_zero',q.get('immutableCommerceFieldsChanged')==0)
    add('runtime_256',rt.get('productBuckets')==256)
    add('runtime_under_500k',int(rt.get('maxProductBucketBytes') or 999999999)<500000)
    add('role_balanced',rt.get('familyStrategy')=='role-balanced')
    add('family_counts_ge_150',len(fam)>=150 and len(roles)>=150)
    add('manifest_version_2090',m.get('version')=='20.9.0')
    add('summary_version_2090',s.get('version')=='20.9.0')
    add('manifest_residual_2092',m.get('truthCleanup',{}).get('residualUnclassifiedPassVersion')=='20.9.2')
    add('rare_closeout_2089',m.get('truthCleanup',{}).get('rareCloseoutVersion')=='20.8.9')
    add('rare_count_match',m.get('rarePublished')==len(rare))
    add('rare_range',60<=len(rare)<=90)
    core=[]
    for k in ('phoneNonMain','tabletNonMain','laptopNonMain','smartwatchNonMain','headphonesNonMain'):
        qv=q.get('semanticProbes',{}).get(k)
        dv=d.get('roleAnomalies',{}).get(k,{}).get('count')
        values[f'q_{k}']=qv; values[f'd_{k}']=dv
        core.append(qv==0 and dv==0)
    add('core_role_purity',all(core))
    coverage=[]
    for family,role in (('phone','main'),('phone','accessory'),('phone','replacement_part'),('tablet','main'),('tablet','accessory'),('laptop','main'),('laptop','accessory'),('camera','main'),('camera','accessory'),('tools','main'),('tools','replacement_part'),('automotive','accessory'),('automotive','replacement_part')):
        ok=bool(roles.get(family,{}).get(role))
        values[f'coverage_{family}_{role}']=len(roles.get(family,{}).get(role,[]))
        coverage.append(ok)
    add('required_family_role_coverage',all(coverage))

    failed=[k for k,v in checks.items() if not v]
    payload={'passed':not failed,'failed':failed,'checks':checks,'values':values}
    OUT.parent.mkdir(parents=True,exist_ok=True)
    OUT.write_text(json.dumps(payload,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(payload,ensure_ascii=False,indent=2))

if __name__=='__main__': main()
