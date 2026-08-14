#!/usr/bin/env python3
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
BUILDER = ROOT / "scripts/build-v20-8-universal-discovery.py"
UNIVERSAL = ROOT / "js/universal-discovery-v20-8.js"
RARE_JS = ROOT / "js/rare-finds-v20-8.js"
CSS = ROOT / "css/v20-8-universal.css"
FIND = ROOT / "find/index.html"
RARE_HUB = ROOT / "rare-used/index.html"

for p in (BUILDER, UNIVERSAL, RARE_JS, CSS, FIND, RARE_HUB):
    if not p.exists():
        raise SystemExit(f"Missing required file: {p}")

UNIVERSAL_JS = r'''(() => {
  "use strict";
  const V="20.8.1",d=document,$=(s,r=d)=>r.querySelector(s),C=v=>String(v??"").replace(/\s+/g," ").trim(),L=v=>C(v).toLowerCase(),E=v=>C(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const P=new URLSearchParams(location.search),q=C(P.get("q")),forced=P.get("universal")==="1";
  const MANAGED=[
    /^(?:pho|phon|phone|phones|smartp|smartph|smartpho|smartphon|smartphone|smartphones|mobile phone|mobile phones|cell phone|cell phones)$/i,
    /\b(?:iphone|samsung galaxy|galaxy\s+[a-zmfsz]?\d+|google pixel|pixel\s+\d+|oneplus|xiaomi|redmi|poco|oppo|vivo|realme|motorola|moto|honor|huawei|nokia|xperia|nothing phone|zenfone|nubia|infinix|tecno)\b/i,
    /^(?:lap|lapt|lapto|laptop|laptops|notebook|notebooks)$/i,
    /\b(?:thinkpad|ideapad|thinkbook|chromebook|macbook|vivobook|zenbook|probook|elitebook|latitude|inspiron|xps|legion|surface laptop|lenovo slim)\b/i,
    /^(?:per|perf|perfu|perfum|perfume|perfumes|frag|fragr|fragra|fragrance|fragrances)$/i,
    /\b(?:cologne|eau de parfum|eau de toilette|edp|edt)\b/i,
    /\b(?:headphones?|headsets?|earbuds?|earphones?|airpods?|tws)\b/i,
    /\b(?:smart ?watch|apple watch|wearable watch|fitness watch)\b/i,
    /\b(?:power ?banks?|powerbank|portable charger|external battery)\b/i,
    /\b(?:dog food|puppy food|dog treats?|canine food)\b/i,
    /\b(?:air conditioner|portable ac|mini split|ductless ac|split ac)\b/i,
    /\b(?:3d filament|pla filament|petg filament|abs filament|tpu filament)\b/i,
    /\b(?:cookware|frying pan|saucepan|casserole|wok|skillet)\b/i,
    /\b(?:lighting|led strip|desk lamp|floor lamp|ceiling light)\b/i,
    /\b(?:tools?|drill|saw|multimeter|oscilloscope|screwdriver|wrench)\b/i
  ];
  const managed=v=>MANAGED.some(r=>r.test(C(v)));
  if(!q||(!forced&&managed(q)))return;
  const stop=new Set(["the","and","for","with","from","this","that","your","our","new","best","buy","original","official","product","products","item","items","of","to","in","on","by","a","an"]);
  const toks=L(q).replace(/[^a-z0-9.+#/-]+/g," ").split(/\s+/).filter(t=>t&&!stop.has(t)&&(t.length>=3||(/[a-z]/.test(t)&&/\d/.test(t))));
  const cache=new Map();
  async function j(url){if(!cache.has(url))cache.set(url,fetch(url,{cache:"force-cache"}).then(r=>r.ok?r.json():null).catch(()=>null));return cache.get(url)}
  function prefix(t){return(t.replace(/[^a-z0-9]/g,"").slice(0,2)||"__").padEnd(2,"_")}
  async function idsFor(t){const x=await j(`/data/v20-8/terms/${prefix(t)}.json?v=${V}`);if(!x)return[];if(x[t])return x[t];if(t.length>=3){let out=[];for(const[k,v]of Object.entries(x)){if(k.startsWith(t)){out.push(...v);if(out.length>1200)break}}return[...new Set(out)]}return[]}
  const intersect=(a,b)=>{const s=new Set(b);return a.filter(x=>s.has(x))};
  async function search(){
    if(!toks.length)return[];const groups=[];
    for(const t of toks.slice(0,6)){const ids=await idsFor(t);if(ids.length)groups.push(ids)}
    if(!groups.length)return[];groups.sort((a,b)=>a.length-b.length);let ids=groups[0].slice();
    for(const g of groups.slice(1)){const z=intersect(ids,g);if(z.length)ids=z}
    ids=ids.slice(0,120);const by={};for(const id of ids)(by[id[0]]??=[]).push(id);const rows=[];
    for(const[b,list]of Object.entries(by)){const bucket=await j(`/data/v20-8/products/${b}.json?v=${V}`)||{};for(const id of list)if(bucket[id])rows.push(bucket[id])}
    return rows.map(r=>{const s=L(r.s||"");let score=(r.r||0)/5;for(const t of toks)if(s.includes(t))score+=12;if(L(r.t)===L(q))score+=50;if((r.ids||[]).some(x=>L(x)===L(q)))score+=70;return{...r,_score:score}}).sort((a,b)=>b._score-a._score).slice(0,60);
  }
  function money(r){return `${r.cu==="USD"?"US$":E(r.cu+" ")}${Number(r.p).toLocaleString(undefined,{maximumFractionDigits:2})}`}
  function priceInfo(r){
    if(!r.p)return{label:"Check current price",proof:"Price checked at seller",kind:"check"};
    if(r.x)return{label:money(r),proof:"✓ Exact price",kind:"verified"};
    return{label:money(r),proof:"Seller-feed price",kind:"feed"};
  }
  function rarity(score){score=Number(score||0);if(score>=90)return`Exceptional find · ${score}`;if(score>=80)return`Very rare · ${score}`;if(score>=65)return`Hard to find · ${score}`;if(score>=58)return`Specialist find · ${score}`;return""}
  function card(r){
    const pi=priceInfo(r),rare=rarity(r.r),rareHtml=rare?`<span class="tp80-mini-rare">${E(rare)}</span>`:"",href=r.seo||r.u||"#",cta=r.seo?"View rare find":(r.x?"View exact product":"Search seller");
    return `<article class="tp78-card tp80-universal-card"><div class="tp78-media">${r.im?`<img src="${E(r.im)}" alt="${E(r.t)}" width="360" height="360" loading="lazy">`:"<span>No image</span>"}</div><div class="tp78-body"><div class="tp78-top"><b>${E(r.b||r.tyl||"Product")}</b><span>${E(r.se)}</span></div><h3>${E(r.t)}</h3><strong class="tp78-price">${E(pi.label)}</strong><span class="tp80-price-proof ${pi.kind}">${E(pi.proof)}</span>${rareHtml}<p class="tp80-universal-meta">${E(r.tyl)} · ${E((r.ro||"main").replaceAll("_"," "))}</p><div class="tp78-actions"><a class="tp78-primary ${r.x?"exact":"seller-search"}" href="${E(href)}" ${r.seo?"":'target="_blank" rel="sponsored nofollow noopener"'}>${cta} →</a></div>${!r.x&&r.p?'<small class="tp80-route-note">Price came from seller catalogue data; this button opens a seller search route, not a confirmed exact-product page.</small>':""}</div></article>`;
  }
  async function logDemand(){const body=JSON.stringify({q,source:document.referrer||"",path:location.pathname+location.search});try{await fetch("/.netlify/functions/discovery-demand-v20-8",{method:"POST",headers:{"content-type":"application/json"},body,keepalive:true})}catch(e){try{localStorage.setItem("tp-v20-8-missed:"+L(q),new Date().toISOString())}catch(_){}}}
  async function boot(){
    const grid=$("[data-v2078-product-grid]");if(!grid)return;const rows=await search();
    if(!rows.length){await logDemand();grid.innerHTML=`<div class="tp80-no-result"><h2>We couldn't verify this product yet.</h2><p>TrendPilot recorded the search so future catalogue updates can look for it. Try a model, MPN, SKU or part number for a more exact match.</p><a href="/rare-used/">Explore Rare Finds</a></div>`;return}
    const head=$("[data-v2078-results-title]");if(head)head.textContent=`Universal results for “${q}”`;
    const sub=$("[data-v2078-results-sub]");if(sub)sub.textContent="Long-tail catalogue search across all product types. Exact-product prices and seller-feed prices are kept separate.";
    const count=$("[data-v2078-results-count]");if(count)count.textContent=`${rows.length} matching`;
    grid.innerHTML=rows.map(card).join("");const more=$("[data-v2078-load-more]");if(more)more.hidden=true;
  }
  setTimeout(boot,forced?150:450);
})();'''

RARE_JS_TEXT = r'''(() => {
  "use strict";
  const V="20.8.1",d=document,$=(s,r=d)=>r.querySelector(s),$$=(s,r=d)=>[...r.querySelectorAll(s)],E=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  let rows=[],filter="all";
  const money=r=>`${r.currency==="USD"?"US$":E(r.currency+" ")}${Number(r.price).toLocaleString(undefined,{maximumFractionDigits:2})}`;
  function rarity(score){score=Number(score||0);if(score>=90)return`Exceptional find · ${score}`;if(score>=80)return`Very rare · ${score}`;if(score>=65)return`Hard to find · ${score}`;return`Specialist find · ${score}`}
  function priceInfo(r){if(!r.price)return{label:"Check current price",proof:"Price checked at seller",kind:"check"};if(r.exact)return{label:money(r),proof:"✓ Exact price",kind:"verified"};return{label:money(r),proof:"Seller-feed price",kind:"feed"}}
  function card(r){const pi=priceInfo(r),dest=r.seoUrl||r.url;return `<article class="tp80-rare-card"><a class="tp80-rare-image" href="${E(dest)}"><img src="${E(r.image)}" alt="${E(r.title)}" width="520" height="520" loading="lazy"></a><div><span class="tp80-rare-score">${E(rarity(r.rareScore))}</span><p class="tp80-brand">${E(r.brand||r.seller)}</p><h2><a href="${E(dest)}">${E(r.title)}</a></h2><p class="tp80-card-price">${E(pi.label)}</p><span class="tp80-price-proof ${pi.kind}">${E(pi.proof)}</span><p>${E(r.typeLabel)} · ${E(r.seller)}</p><div class="tp80-signals">${(r.signals||[]).slice(0,3).map(s=>`<span>${E(s.replaceAll("-"," "))}</span>`).join("")}</div></div></article>`}
  function draw(){const list=filter==="all"?rows:rows.filter(r=>(r.signals||[]).includes(filter));$("[data-rare-grid]").innerHTML=list.slice(0,72).map(card).join("")||"<p>No current verified items in this rarity group.</p>";$("[data-rare-stats]").textContent=`${list.length} rare finds · ${new Set(list.map(x=>x.type)).size} product types · ${new Set(list.map(x=>x.seller)).size} sellers`}
  async function boot(){try{const r=await fetch(`/data/v20-8/rare-index.json?v=${V}`,{cache:"force-cache"});rows=await r.json();draw()}catch(e){$("[data-rare-grid]").innerHTML="<p>Rare Finds is updating. Please try again shortly.</p>"}$$('[data-rare-filter]').forEach(b=>b.addEventListener('click',()=>{filter=b.dataset.rareFilter;$$('[data-rare-filter]').forEach(x=>x.classList.toggle('active',x===b));draw()}))}
  d.readyState==="loading"?d.addEventListener("DOMContentLoaded",boot,{once:true}):boot();
})();'''

UNIVERSAL.write_text(UNIVERSAL_JS + "\n", encoding="utf-8")
RARE_JS.write_text(RARE_JS_TEXT + "\n", encoding="utf-8")

builder = BUILDER.read_text(encoding="utf-8")
builder = builder.replace("V='20.8.0'", "V='20.8.1'")
if "'carbon brush'" not in builder.split("SPECIAL=",1)[1].split("\n",1)[0]:
    builder = builder.replace("'replacement part')", "'replacement part','carbon brush')")

start = builder.find("    for r in rows:\n        score=8.;sig=[];t=n(r['title']);cond=n(r['condition'])")
end_marker = "        r['rareScore']=max(0,min(100,round(score)));r['signals']=list(dict.fromkeys(sig or (['hard-to-find'] if score>=60 else [])));r['search']=n(' '.join([r['title'],r['brand'],r['typeLabel'],r['sourceCategory'],r['sourceSubcategory'],r['mpn'],r['gtin'],r['model'],r['sellerProductId']]))\n"
end = builder.find(end_marker, start)
if start < 0 or end < 0:
    raise SystemExit("Could not locate V20.8 rarity scoring block")
end += len(end_marker)
score_block = '''    for r in rows:\n        score=12.;sig=[];t=n(r['title']);cond=n(r['condition']);strong_rarity=False\n        if cond in USED:\n            score+=18;sig.append('used-scarce');strong_rarity=True\n        if r['role']=='replacement_part':\n            score+=12;sig.append('replacement-part')\n        add=0\n        for term,val in RARE.items():\n            if term in t:\n                weight={'rare':15,'hard to find':18,'hard-to-find':18,'discontinued':28,'obsolete':24,'vintage':22,'limited edition':20,'collector':18,'collectible':18,'new old stock':24,'surplus':12,'legacy':12,'classic':8,'out of production':28,'replacement':6,'spare':5,'oem':4}.get(term,val)\n                add=max(add,weight)\n                if term in {'discontinued','obsolete','out of production','legacy'}:\n                    if 'discontinued' not in sig:sig.append('discontinued')\n                    strong_rarity=True\n                if term in {'limited edition','collector','collectible','vintage','classic','new old stock'}:\n                    if 'collector' not in sig:sig.append('collector')\n                    strong_rarity=True\n                if term in {'rare','hard to find','hard-to-find'}:\n                    strong_rarity=True\n        score+=add\n        if any(x in t for x in SPECIAL):\n            score+=8;sig.append('specialist')\n        if re.search(r'\\b(?=[a-z0-9.-]{4,}\\b)(?=[a-z0-9.-]*[a-z])(?=[a-z0-9.-]*\\d)[a-z0-9.-]+\\b',t):\n            score+=8;sig.append('model-specific')\n        tc=len(toks(r['title']));score+=5 if tc>=9 else 3 if tc>=6 else 0\n        cn=cats[r['category']];score+=12 if cn<=10 else 8 if cn<=50 else 5 if cn<=200 else 2 if cn<=800 else 0\n        same=ids_count[r['identity']]\n        if r['strongIdentity'] and same==1:\n            score+=10;sig.append('low-seller-coverage')\n        elif r['strongIdentity'] and same==2:\n            score+=6\n        else:\n            score+=2\n        score+=5 if r['exact'] else 0;score+=3 if r['image'] else 0;score+=1 if r['price'] else 0;score+=4 if r['quality']>=80 else 2 if r['quality']>=70 else 0\n        score-=15 if tc<=2 else 0\n        if r['role']=='accessory' and not set(sig)&{'used-scarce','collector','discontinued','specialist'}:score-=10\n        if not strong_rarity:score=min(score,84)\n        if r['role']=='replacement_part' and not strong_rarity:score=min(score,79)\n        r['rareScore']=max(0,min(100,round(score)));r['signals']=list(dict.fromkeys(sig or (['hard-to-find'] if score>=60 else [])));r['search']=n(' '.join([r['title'],r['brand'],r['typeLabel'],r['sourceCategory'],r['sourceSubcategory'],r['mpn'],r['gtin'],r['model'],r['sellerProductId']]))\n'''
builder = builder[:start] + score_block + builder[end:]

# Friendlier rarity labels on static Rare SEO pages.
if "def rarity_label" not in builder:
    insert = "def rarity_label(score):\n    score=int(score or 0)\n    if score>=90:return f'Exceptional find · {score}'\n    if score>=80:return f'Very rare · {score}'\n    if score>=65:return f'Hard to find · {score}'\n    return f'Specialist find · {score}'\n\n"
    builder = builder.replace("def seo_html(r):\n", insert + "def seo_html(r):\n")
builder = builder.replace("Rare score {r['rareScore']}/100", "{esc(rarity_label(r['rareScore']))}")
BUILDER.write_text(builder, encoding="utf-8")

css = CSS.read_text(encoding="utf-8")
extra_css = '''\n/* V20.8.1 truth calibration */\n.tp80-price-proof{display:inline-flex;width:max-content;margin:5px 0 2px;padding:5px 9px;border-radius:999px;font-size:11px;font-weight:900}.tp80-price-proof.verified{background:#e7f8f1;color:#08765a}.tp80-price-proof.feed{background:#fff4dc;color:#8a5800}.tp80-price-proof.check{background:#f2f4f7;color:#667085}.tp80-route-note{display:block;margin-top:8px;color:#667085;line-height:1.4}.tp78-primary.seller-search{background:#fff;color:#3157e8;border:1px solid #b9c7f8}.tp78-primary.exact{background:#3157e8;color:#fff}.tp80-universal-card .tp80-mini-rare{margin-top:6px}\n'''
if "V20.8.1 truth calibration" not in css:
    css += extra_css
CSS.write_text(css, encoding="utf-8")

for page in (FIND, RARE_HUB):
    text = page.read_text(encoding="utf-8").replace("v=20.8.0", "v=20.8.1")
    page.write_text(text, encoding="utf-8")

print("V20.8.1 truth calibration applied")
