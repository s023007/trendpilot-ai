from pathlib import Path

php_path = Path('api/save-search.php')
js_path = Path('events/manchester-derby-2026/save-search.js')

php = php_path.read_text(encoding='utf-8')
old_php = "$buyUrl=$spec['return_base'].'?return=email-buy&lead='.rawurlencode($leadId).'&seller='.rawurlencode($seller).'&offer='.rawurlencode($offerUrl).'#prices';"
new_php = "$buyUrl='https://api.trendpilotchoice.com/go.php?lead='.rawurlencode($leadId);"
if old_php not in php:
    raise SystemExit('Expected buyUrl pattern not found in api/save-search.php')
php = php.replace(old_php, new_php, 1)
php_path.write_text(php, encoding='utf-8')

js = js_path.read_text(encoding='utf-8')
old_js = "if(p.get('return')==='email'){fire('EMAIL_RETURN',{lead_id:p.get('lead')||'',seller:p.get('seller')||''});setTimeout(()=>document.getElementById('prices')?.scrollIntoView({behavior:'smooth'}),250)}"
new_js = "if(p.get('return')==='email-buy'){const lead=p.get('lead')||'';if(/^[a-f0-9]{16}$/i.test(lead)){fire('EMAIL_BUY_RETURN',{lead_id:lead,seller:p.get('seller')||''});location.replace('https://api.trendpilotchoice.com/go.php?lead='+encodeURIComponent(lead));return}}if(p.get('return')==='email'){fire('EMAIL_RETURN',{lead_id:p.get('lead')||'',seller:p.get('seller')||''});setTimeout(()=>document.getElementById('prices')?.scrollIntoView({behavior:'smooth'}),250)}"
if old_js not in js:
    raise SystemExit('Expected email return handler not found in save-search.js')
js = js.replace(old_js, new_js, 1)
js_path.write_text(js, encoding='utf-8')

print('Patched direct email affiliate handoff and backward-compatible email-buy redirect.')
