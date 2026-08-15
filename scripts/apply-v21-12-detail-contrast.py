#!/usr/bin/env python3
from pathlib import Path
p=Path('css/trendpilot-v21-2-1-final.css')
s=p.read_text(encoding='utf-8')
marker='/* V21.12 ticket-detail + trust-form closeout */'
if marker not in s:
    s += '''\n\n/* V21.12 ticket-detail + trust-form closeout */\nbody[data-tp-page="ticket-detail"] .tp-ticket-v141-detail,\nbody[data-tp-page="ticket-detail"] .tp-ticket-v141-empty{background:#f8fafc!important;background-image:none!important;color:#0f172a!important}\nbody[data-tp-page="ticket-detail"] .tp-ticket-v141-detail h1,\nbody[data-tp-page="ticket-detail"] .tp-ticket-v141-detail h2,\nbody[data-tp-page="ticket-detail"] .tp-ticket-v141-detail b,\nbody[data-tp-page="ticket-detail"] .tp-ticket-v141-detail strong{color:#0f172a!important;opacity:1!important}\nbody[data-tp-page="ticket-detail"] .tp-ticket-v141-detail p,\nbody[data-tp-page="ticket-detail"] .tp-ticket-v141-detail small{color:#526174!important;opacity:1!important}\nbody[data-tp-page="ticket-detail"] .tp-ticket-v141-actions a.primary{color:#fff!important}\nbody[data-tp-page="trust"] .tp-trust-page input,\nbody[data-tp-page="trust"] .tp-trust-page select,\nbody[data-tp-page="trust"] .tp-trust-page textarea{box-sizing:border-box;width:100%;margin-top:6px;padding:12px 14px;border:1px solid #cbd5e1;border-radius:12px;background:#fff;color:#0f172a;font:inherit;line-height:1.4}\nbody[data-tp-page="trust"] .tp-trust-page textarea{min-height:150px;resize:vertical}\nbody[data-tp-page="trust"] .tp-trust-page input:focus,\nbody[data-tp-page="trust"] .tp-trust-page select:focus,\nbody[data-tp-page="trust"] .tp-trust-page textarea:focus{outline:3px solid rgba(59,130,246,.22);border-color:#3b82f6}\n'''
    p.write_text(s,encoding='utf-8')
    print('Applied V21.12 detail contrast closeout.')
else:
    print('Detail contrast closeout already present.')
