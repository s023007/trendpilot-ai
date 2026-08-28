from pathlib import Path

root = Path('.')
api = root / 'api/save-search.php'
text = api.read_text(encoding='utf-8')

text = text.replace("'buy_cta'=>$ar?'الذهاب إلى البائع لإكمال الشراء ←':'Continue to seller →'", "'buy_cta'=>$ar?'فتح التذاكر على موقع البائع ←':'Open tickets on seller site →'")

old = "<table role=\"presentation\" width=\"100%\"><tr><td align=\"center\" style=\"background:#ffcf4a;border-radius:14px\"><a href=\"'.$ret.'\" style=\"display:block;padding:16px;color:#16120a;text-decoration:none;font-size:18px;font-weight:900\">'.h($s['cta']).'</a></td></tr></table><div style=\"height:10px\"></div><table role=\"presentation\" width=\"100%\"><tr><td align=\"center\" style=\"border:2px solid #18345b;border-radius:14px\"><a href=\"'.$buy.'\" style=\"display:block;padding:14px;color:#18345b;text-decoration:none;font-size:16px;font-weight:800\">'.h($s['buy_cta']).'</a></td></tr></table>"
new = "<table role=\"presentation\" width=\"100%\"><tr><td align=\"center\" style=\"background:#ffcf4a;border-radius:14px\"><a href=\"'.$buy.'\" style=\"display:block;padding:16px;color:#16120a;text-decoration:none;font-size:18px;font-weight:900\">'.h($s['buy_cta']).'</a></td></tr></table><div style=\"height:10px\"></div><table role=\"presentation\" width=\"100%\"><tr><td align=\"center\" style=\"border:2px solid #18345b;border-radius:14px\"><a href=\"'.$ret.'\" style=\"display:block;padding:14px;color:#18345b;text-decoration:none;font-size:16px;font-weight:800\">'.h($s['cta']).'</a></td></tr></table>"
if old in text:
    text = text.replace(old, new)

api.write_text(text, encoding='utf-8')

bridge = root / 'js/email-buy-root-bridge.js'
bridge.parent.mkdir(parents=True, exist_ok=True)
bridge.write_text("""(()=>{try{const p=new URLSearchParams(location.search);if(p.get('return')!=='email-buy')return;const lead=(p.get('lead')||'').trim();if(!/^[a-f0-9]{16}$/i.test(lead))return;location.replace('https://api.trendpilotchoice.com/go.php?lead='+encodeURIComponent(lead));}catch(_){}})();\n""", encoding='utf-8')

home = root / 'index.html'
h = home.read_text(encoding='utf-8')
tag = '<script src="/js/email-buy-root-bridge.js?v=2.0.0"></script>'
if tag not in h:
    h = h.replace('</body>', tag + '\n</body>')
    home.write_text(h, encoding='utf-8')

print('Patched future email CTA, made seller action primary, and added legacy root email-buy bridge.')
