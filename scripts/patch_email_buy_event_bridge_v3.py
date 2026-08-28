from pathlib import Path
p=Path('api/save-search.php')
s=p.read_text(encoding='utf-8')
old="$buyUrl='https://api.trendpilotchoice.com/go.php?lead='.rawurlencode($leadId);"
new="$buyUrl=$spec['return_base'].'?return=email-buy&lead='.rawurlencode($leadId).'&seller='.rawurlencode($seller);"
if old not in s:
    raise SystemExit('buyUrl pattern not found')
s=s.replace(old,new,1)
p.write_text(s,encoding='utf-8')
print('patched email primary CTA to event bridge')
