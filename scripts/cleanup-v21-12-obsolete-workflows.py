#!/usr/bin/env python3
from pathlib import Path
import re

ROOT=Path(__file__).resolve().parents[1]
WF=ROOT/'.github/workflows'
REMOVE=[
'install-trendpilot-v13-8-7-cj-joined-sellers-guard.yml',
'install-trendpilot-v13-8-8-cj-exact-seven-guard.yml',
'install-trendpilot-v13-8-9-cj-exact-seven-hotfix.yml',
'update-products.yml',
'trendpilot-v20-7-10-seller-diversity-product-page-polish.yml',
'trendpilot-v20-7-11-buyer-decision-tools.yml',
'trendpilot-v20-8-1-truth-calibration.yml',
'trendpilot-v20-8-2-metadata-truth.yml',
'trendpilot-v20-8-3-rarity-semantics.yml',
'trendpilot-v20-8-4-nested-destination-truth.yml',
'trendpilot-v20-8-7-rare-routing-qa.yml',
'trendpilot-v20-8-8-internal-first-qa.yml',
'trendpilot-v20-8-9-rare-final-closeout.yml',
'trendpilot-v20-8-universal-discovery-rare-finds.yml',
'trendpilot-v20-9-2-final-rc-verify.yml',
'trendpilot-v20-9-2-final-role-closeout.yml',
'trendpilot-v20-9-2-finalize-branch.yml',
'trendpilot-v20-9-2-residual-candidate.yml',
'trendpilot-v20-9-3-live-shopper-e2e.yml',
'trendpilot-v20-9-all-product-diagnostic.yml',
'trendpilot-v20-9-finalize-branch.yml',
'trendpilot-v20-9-quality-gate-candidate.yml',
'trendpilot-v20-9-release-candidate.yml',
'trendpilot-v21-1-final-mobile-pass.yml',
'trendpilot-v21-1-graphite-navy-rollout.yml',
'trendpilot-v21-1-mobile-verify.yml',
'trendpilot-v21-1-visual-acceptance.yml',
'trendpilot-v21-10-phone-purity-e2e.yml',
'trendpilot-v21-2-1-final-acceptance.yml',
'trendpilot-v21-2-ui-cleanup.yml',
'trendpilot-v21-3-1-search-validation.yml',
'trendpilot-v21-3-2-macbook-quality.yml',
'trendpilot-v21-3-3-macbook-truth.yml',
'trendpilot-v21-3-search-stability.yml',
'trendpilot-v21-calm-dark-sitewide.yml',
'trendpilot-v21-palette-lab.yml',
'trendpilot-v21-public-contrast-hotfix.yml',
'trendpilot-v21-12-rollout.yml',
]
removed=[]
for name in REMOVE:
    p=WF/name
    if p.exists():
        p.unlink();removed.append(name)

# Keep CJ fetcher as an emergency/manual data utility, but stop its legacy daily writer chain.
cj=WF/'install-trendpilot-v13-8-5-cj-conflict-safe.yml'
if cj.exists():
    s=cj.read_text(encoding='utf-8')
    s=re.sub(r'on:\n\s+workflow_dispatch:\n\s+schedule:\n(?:\s+#.*\n)?\s+- cron: "[^"]+"', 'on:\n  workflow_dispatch:', s, count=1)
    s=re.sub(r'\n\s+- name: Start the main TrendPilot catalogue update\n.*?echo "The main product update was started so CJ sellers can appear in search\."\n?', '\n', s, count=1, flags=re.S)
    cj.write_text(s,encoding='utf-8')

print('Removed obsolete automatic workflows:',len(removed))
for x in removed: print('-',x)
print('CJ V13.8.5 retained as manual-only emergency data utility.')
