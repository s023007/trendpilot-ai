from pathlib import Path
import re

ROOT=Path('.')
NEW_GEO='<script src="/js/visitor-context-v21-17.js?v=21.17.0"></script><script defer src="/js/tiktok-us-geo-v21-17.js?v=21.17.0"></script>'


def write(path,text):
    p=ROOT/path
    old=p.read_text(encoding='utf-8')
    if text!=old:
        p.write_text(text,encoding='utf-8')
        print('updated',path)


def need_replace(s,old,new,label):
    if new in s:
        return s
    if old not in s:
        raise SystemExit(f'{label}: expected source text not found')
    return s.replace(old,new,1)

# Sitewide: do not block HTML parsing on the geo edge request. Load a tiny static
# bootstrap synchronously; it performs the visitor-context request asynchronously.
for p in ROOT.rglob('*.html'):
    if any(x in p.parts for x in ('.git','node_modules','artifacts','coverage')):
        continue
    try:s=p.read_text(encoding='utf-8')
    except Exception:continue
    old=s
    s=re.sub(r'<script[^>]*src=["\']/geo-bootstrap\.js\?v=21\.16\.0["\'][^>]*></script>','',s,flags=re.I)
    s=re.sub(r'<script[^>]*src=["\']/js/tiktok-us-geo-v21-16\.js\?v=21\.16\.0["\'][^>]*></script>','',s,flags=re.I)
    if 'visitor-context-v21-17.js?v=21.17.0' not in s and '</head>' in s.lower():
        i=s.lower().rfind('</head>');s=s[:i]+NEW_GEO+s[i:]
    s=re.sub(r'/js/universal-discovery-v20-9-1\.js\?v=[^"\']+', '/js/universal-discovery-v20-9-1.js?v=21.17.0', s)
    s=re.sub(r'/js/packed-browse-v21-13-8\.js\?v=[^"\']+', '/js/packed-browse-v21-13-8.js?v=21.17.0', s)
    s=re.sub(r'/js/compare-v20-9\.js\?v=[^"\']+', '/js/compare-v20-9.js?v=21.17.0', s)
    s=re.sub(r'/js/deals-revenue-v21-14\.js\?v=[^"\']+', '/js/deals-revenue-v21-14.js?v=21.17.0', s)
    if s!=old:p.write_text(s,encoding='utf-8');print('updated',p.as_posix())

# Universal finder: wait for the async region decision, never offer TikTok Shop US
# outside the US, and suppress known Lenovo $1/$5 placeholder prices.
p=ROOT/'js/universal-discovery-v20-9-1.js';s=p.read_text(encoding='utf-8')
s=s.replace('const RUNTIME_VERSION = "21.13.0";','const RUNTIME_VERSION = "21.17.0";')
marker='  const loader = {groups:[],cursor:0,seen:new Set(),busy:false,done:false};\n'
insert='''  const loader = {groups:[],cursor:0,seen:new Set(),busy:false,done:false};
  const waitForGeo = async()=>{try{const p=window.__TP_GEO_READY__;if(p&&typeof p.then==="function")await p}catch{}};
  const sellerAllowed = seller => window.__TP_ALLOW_TIKTOK_US__===true || !/^TikTok\\s*Shop\\s*US$/i.test(C(seller));
  function usablePrice(r){
    const value=Number(r&&r.p)||0;if(!value)return 0;
    const seller=L(r&&r.se),role=L((r&&r.ro)||"main"),text=L([r&&r.fa,r&&r.ty,r&&r.tyl,r&&r.t].join(" "));
    if(seller.includes("lenovo")&&role!=="accessory"&&role!=="replacement_part"&&value<=5&&/\\b(?:laptop|tablet|chromebook|notebook|computer)\\b/i.test(text))return 0;
    return value;
  }
'''
if 'function usablePrice(r)' not in s:s=need_replace(s,marker,insert,'universal helper insert')
s=s.replace('Object.keys(samples||{}).filter(s=>!BLOCK.has(L(s)))','Object.keys(samples||{}).filter(s=>!BLOCK.has(L(s))&&sellerAllowed(s))')
s=s.replace('Object.keys(samples).filter(s=>!BLOCK.has(L(s)))','Object.keys(samples).filter(s=>!BLOCK.has(L(s))&&sellerAllowed(s))')
s=s.replace('if(r.x)n+=10;if(r.im)n+=5;if(r.p)n+=2;return n;','if(r.x)n+=10;if(r.im)n+=5;if(usablePrice(r))n+=2;return n;')
s=s.replace('if(!r||BLOCK.has(L(r.se))||!roleOK(r)||!semanticOK(r))return false;','if(!r||BLOCK.has(L(r.se))||!sellerAllowed(r.se)||!roleOK(r)||!semanticOK(r))return false;')
s=s.replace('const money=r=>`${r.cu==="USD"?"US$":E((r.cu||"")+" ")}${Number(r.p).toLocaleString(undefined,{maximumFractionDigits:2})}`;','const money=(r,v=usablePrice(r))=>`${r.cu==="USD"?"US$":E((r.cu||"")+" ")}${Number(v).toLocaleString(undefined,{maximumFractionDigits:2})}`;')
s=s.replace('const price=r.p?money(r):"Check current price",href=', 'const pv=usablePrice(r),price=pv?money(r,pv):"Check current price",href=')
s=s.replace('const price=Number(r.p)||0;if(state.min&&(price<state.min||!price))return false;if(state.max&&(price>state.max||!price))return false;', 'const price=usablePrice(r);if(state.min&&(price<state.min||!price))return false;if(state.max&&(price>state.max||!price))return false;')
s=s.replace('state.filtered.sort((a,b)=>(a.p||Infinity)-(b.p||Infinity));else if(state.sort==="price-high")state.filtered.sort((a,b)=>(b.p||0)-(a.p||0));else if(state.sort==="best-value")state.filtered.sort((a,b)=>(Number(b.x)-Number(a.x))||((a.p||Infinity)-(b.p||Infinity))||(b._score-a._score));', 'state.filtered.sort((a,b)=>(usablePrice(a)||Infinity)-(usablePrice(b)||Infinity));else if(state.sort==="price-high")state.filtered.sort((a,b)=>usablePrice(b)-usablePrice(a));else if(state.sort==="best-value")state.filtered.sort((a,b)=>(Number(b.x)-Number(a.x))||((usablePrice(a)||Infinity)-(usablePrice(b)||Infinity))||(b._score-a._score));')
s=s.replace('  async function boot(){\n    window.__TP_FAST_SEARCH_START__=performance.now();', '  async function boot(){\n    await waitForGeo();\n    window.__TP_FAST_SEARCH_START__=performance.now();')
write(Path('js/universal-discovery-v20-9-1.js'),s)

# Packed finder (Shoes / Popular Products).
p=ROOT/'js/packed-browse-v21-13-8.js';s=p.read_text(encoding='utf-8')
s=s.replace('const VERSION = "21.16.0";','const VERSION = "21.17.0";')
marker='  const sellerAllowed = s => window.__TP_ALLOW_TIKTOK_US__ === true || !/^TikTok\\s*Shop\\s*US$/i.test(C(s));\n'
insert='''  const sellerAllowed = s => window.__TP_ALLOW_TIKTOK_US__ === true || !/^TikTok\\s*Shop\\s*US$/i.test(C(s));
  const waitForGeo = async()=>{try{const p=window.__TP_GEO_READY__;if(p&&typeof p.then==="function")await p}catch{}};
  function usablePrice(r){
    const value=Number(r&&r.p)||0;if(!value)return 0;
    const seller=C(r&&r.se).toLowerCase(),role=C((r&&r.ro)||"main").toLowerCase(),text=C([r&&r.fa,r&&r.ty,r&&r.tyl,r&&r.t].join(" ")).toLowerCase();
    if(seller.includes("lenovo")&&role!=="accessory"&&role!=="replacement_part"&&value<=5&&/\\b(?:laptop|tablet|chromebook|notebook|computer)\\b/i.test(text))return 0;
    return value;
  }
'''
if 'function usablePrice(r)' not in s:s=need_replace(s,marker,insert,'packed helper insert')
s=s.replace('const money = r => `${r.cu === "USD" ? "US$" : E((r.cu || "") + " ")}${Number(r.p).toLocaleString(undefined,{maximumFractionDigits:2})}`;', 'const money = (r,v=usablePrice(r)) => `${r.cu === "USD" ? "US$" : E((r.cu || "") + " ")}${Number(v).toLocaleString(undefined,{maximumFractionDigits:2})}`;')
s=s.replace('const price=r.p?money(r):"Check current price";', 'const pv=usablePrice(r),price=pv?money(r,pv):"Check current price";')
s=s.replace('const p=Number(r.p)||0;\n      if(state.min', 'const p=usablePrice(r);\n      if(state.min')
s=s.replace('(Number(a.p)||Infinity)-(Number(b.p)||Infinity)', '(usablePrice(a)||Infinity)-(usablePrice(b)||Infinity)')
s=s.replace('(Number(b.p)||0)-(Number(a.p)||0)', 'usablePrice(b)-usablePrice(a)')
s=s.replace('((Number(a.p)||Infinity)-(Number(b.p)||Infinity))', '((usablePrice(a)||Infinity)-(usablePrice(b)||Infinity))')
s=s.replace('  async function boot(){\n    bindNavigation();', '  async function boot(){\n    await waitForGeo();\n    bindNavigation();')
write(Path('js/packed-browse-v21-13-8.js'),s)

# Comparison page: same regional wait and price sanity.
p=ROOT/'js/compare-v20-9.js';s=p.read_text(encoding='utf-8')
s=s.replace('const V="21.16.0"','const V="21.17.0"')
marker='  const sellerAllowed=r=>window.__TP_ALLOW_TIKTOK_US__===true||!/^TikTok\\s*Shop\\s*US$/i.test(C(r?.se));\n'
insert='''  const sellerAllowed=r=>window.__TP_ALLOW_TIKTOK_US__===true||!/^TikTok\\s*Shop\\s*US$/i.test(C(r?.se));
  const waitForGeo=async()=>{try{const p=window.__TP_GEO_READY__;if(p&&typeof p.then==="function")await p}catch{}};
  function usablePrice(r){const value=Number(r?.p)||0;if(!value)return 0;const seller=C(r?.se).toLowerCase(),role=C(r?.ro||"main").toLowerCase(),text=C([r?.fa,r?.ty,r?.tyl,r?.t].join(" ")).toLowerCase();if(seller.includes("lenovo")&&role!=="accessory"&&role!=="replacement_part"&&value<=5&&/\\b(?:laptop|tablet|chromebook|notebook|computer)\\b/i.test(text))return 0;return value}
'''
if 'function usablePrice(r)' not in s:s=need_replace(s,marker,insert,'compare helper insert')
s=s.replace('const money=r=>`${r.cu==="USD"?"US$":C(r.cu||"USD")+" "}${Number(r.p).toLocaleString(undefined,{maximumFractionDigits:2})}`;', 'const money=(r,v=usablePrice(r))=>`${r.cu==="USD"?"US$":C(r.cu||"USD")+" "}${Number(v).toLocaleString(undefined,{maximumFractionDigits:2})}`;')
s=s.replace('const priceProof=r=>!r.p?"Check with seller":r.x?"Price for this listing":"Price from seller";', 'const priceProof=r=>!usablePrice(r)?"Check with seller":r.x?"Price for this listing":"Price from seller";')
s=s.replace('${r.p?E(money(r)):"Check current price"}', '${usablePrice(r)?E(money(r)):"Check current price"}')
s=s.replace('  async function boot(){\n    const host=', '  async function boot(){\n    await waitForGeo();\n    const host=')
write(Path('js/compare-v20-9.js'),s)

# Savings Hub: do not turn a Lenovo placeholder price into a deal or a huge discount.
p=ROOT/'js/deals-revenue-v21-14.js';s=p.read_text(encoding='utf-8')
old='''      const price=Number(p.price),old=Number(p.oldPrice),disc=Number(p.discount);
      out.push({...p,_key:key,_group:group,_price:Number.isFinite(price)?price:0,_old:Number.isFinite(old)?old:0,_disc:Number.isFinite(disc)?disc:0});'''
new='''      const rawPrice=Number(p.price),old=Number(p.oldPrice),disc=Number(p.discount),seller=low(p.advertiser||p.seller),priceText=low([p.name,p.category,p._group].join(' '));
      const price=(seller.includes('lenovo')&&rawPrice>0&&rawPrice<=5&&/\\b(?:laptop|tablet|chromebook|notebook|computer)\\b/i.test(priceText))?0:rawPrice;
      out.push({...p,_key:key,_group:group,_price:Number.isFinite(price)?price:0,_old:price>0&&Number.isFinite(old)&&old>price?old:0,_disc:price>0&&Number.isFinite(disc)?disc:0});'''
if old in s:s=s.replace(old,new,1)
elif new not in s:raise SystemExit('deals price guard: expected source text not found')
write(Path('js/deals-revenue-v21-14.js'),s)

# Dynamic /product pages use the same non-blocking visitor context.
p=ROOT/'netlify/functions/product-preview-v20-9-6-mobile-polish.cjs';s=p.read_text(encoding='utf-8')
s=s.replace("  if(!/geo-bootstrap\\.js/i.test(body)) body=body.replace(/<\\/head>/i,'<script src=\"/geo-bootstrap.js?v=21.16.0\"></script><script defer src=\"/js/tiktok-us-geo-v21-16.js?v=21.16.0\"></script></head>');", "  if(!/visitor-context-v21-17\\.js/i.test(body)) body=body.replace(/<\\/head>/i,'<script src=\"/js/visitor-context-v21-17.js?v=21.17.0\"></script><script defer src=\"/js/tiktok-us-geo-v21-17.js?v=21.17.0\"></script></head>');")
s=s.replace('"x-trendpilot-tiktok-geo":"21.16.0"','"x-trendpilot-tiktok-geo":"21.17.0","x-trendpilot-browser-compat":"21.17.0"')
write(Path('netlify/functions/product-preview-v20-9-6-mobile-polish.cjs'),s)

print('V21.17 patch complete')
