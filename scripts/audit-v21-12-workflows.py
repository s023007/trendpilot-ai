#!/usr/bin/env python3
from __future__ import annotations
import json,re
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
WF=ROOT/'.github/workflows'
OUT=ROOT/'artifacts/v21-12'
OUT.mkdir(parents=True,exist_ok=True)
rows=[]
for p in sorted(WF.glob('*')):
    if p.suffix.lower() not in {'.yml','.yaml'}: continue
    text=p.read_text(encoding='utf-8',errors='replace')
    name=''
    m=re.search(r'(?m)^name:\s*(.+?)\s*$',text)
    if m:name=m.group(1).strip(' "\'')
    row={
      'path':str(p.relative_to(ROOT)),'name':name,
      'push':bool(re.search(r'(?m)^\s{0,4}push\s*:',text)),
      'pull_request':bool(re.search(r'(?m)^\s{0,4}pull_request\s*:',text)),
      'schedule':bool(re.search(r'(?m)^\s{0,4}schedule\s*:',text)),
      'workflow_run':bool(re.search(r'(?m)^\s{0,4}workflow_run\s*:',text)),
      'workflow_dispatch':bool(re.search(r'(?m)^\s{0,4}workflow_dispatch\s*:',text)),
      'contents_write':bool(re.search(r'(?ms)permissions:.*?contents:\s*write',text)),
      'git_push':bool(re.search(r'\bgit\s+push\b',text)),
      'git_commit':bool(re.search(r'\bgit\s+commit\b',text)),
      'destructive':bool(re.search(r'\brm\s+-rf\b|\bgit\s+reset\s+--hard\b|Restore TrendPilot|restore .*package|overwrite',text,re.I)),
      'legacy_installer':bool(re.search(r'install-trendpilot-v(?:[0-9]|1[0-9]|20)',p.name,re.I)),
      'v21':('v21' in p.name.lower()),
    }
    row['auto']=row['push'] or row['pull_request'] or row['schedule'] or row['workflow_run']
    row['risk_score']=sum([row['auto']*3,row['contents_write']*2,row['git_push']*3,row['git_commit']*2,row['destructive']*4,row['legacy_installer']*2])
    rows.append(row)
report={
  'total':len(rows),
  'automatic':sum(r['auto'] for r in rows),
  'automatic_writers':sum(r['auto'] and (r['contents_write'] or r['git_push']) for r in rows),
  'legacy_installers':sum(r['legacy_installer'] for r in rows),
  'high_risk':[r for r in rows if r['risk_score']>=7],
  'rows':rows,
}
(OUT/'workflow-audit.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps({k:v for k,v in report.items() if k!='rows'},indent=2))
