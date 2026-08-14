from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FIND = ROOT / "find/index.html"
FINDER = ROOT / "js/finder-v20-7-9.js"
PRODUCT = ROOT / "netlify/functions/product-preview-v20-6-8-3.cjs"

for p in (FIND, FINDER, PRODUCT):
    if not p.exists():
        raise SystemExit(f"Missing required file: {p}")

BUYER_JS = r'''(() => {
  "use strict";
  const V="20.7.11",d=document,$=(s,r=d)=>r.querySelector(s),$$=(s,r=d)=>[...r.querySelectorAll(s)];
  const clean=v=>String(v??"").replace(/\s+/g," ").trim();
  const num=v=>{const n=Number(v);return Number.isFinite(n)?n:0};
  const query=clean(new URLSearchParams(location.search).get("q")).toLowerCase();
  const type=(()=>{if(/(?:phone|iphone|galaxy|pixel|xiaomi|redmi|oneplus|poco)/.test(query))return"phone";if(/(?:laptop|thinkpad|ideapad|chromebook|macbook|notebook)/.test(query))return"laptop";if(/(?:perfume|fragrance|cologne|parfum)/.test(query))return"perfume";if(/(?:headphone|earbud|headset|audio)/.test(query))return"headphones";if(/(?:power ?bank|portable charger)/.test(query))return"power_bank";return"default"})();
  const cfg={
    phone:{max:1500,step:25,presets:[[0,150,"Under $150"],[150,300,"$150–300"],[300,600,"$300–600"],[600,1500,"$600+"]]},
    laptop:{max:3000,step:50,presets:[[0,500,"Under $500"],[500,1000,"$500–1,000"],[1000,1500,"$1,000–1,500"],[1500,3000,"$1,500+"]]},
    perfume:{max:500,step:10,presets:[[0,50,"Under $50"],[50,100,"$50–100"],[100,200,"$100–200"],[200,500,"$200+"]]},
    headphones:{max:600,step:10,presets:[[0,50,"Under $50"],[50,150,"$50–150"],[150,300,"$150–300"],[300,600,"$300+"]]},
    power_bank:{max:250,step:5,presets:[[0,25,"Under $25"],[25,50,"$25–50"],[50,100,"$50–100"],[100,250,"$100+"]]},
    default:{max:1000,step:10,presets:[[0,50,"Under $50"],[50,150,"$50–150"],[150,300,"$150–300"],[300,1000,"$300+"]]}
  }[type];
  let min=0,max=0,verifiedOnly=false,applying=false;

  function priceOf(card){const t=clean($(".tp78-price",card)?.textContent),m=t.match(/(?:US\$|\$)\s*([0-9][0-9,]*(?:\.\d+)?)/i);return m?num(m[1].replace(/,/g,"")):0}
  function sellerCount(card){const m=clean($(".tp78-meta",card)?.textContent).match(/(\d+)\s+sellers?/i);return m?num(m[1]):1}
  function variantCount(card){const m=clean($(".tp78-meta",card)?.textContent).match(/(\d+)\s+variants?/i);return m?num(m[1]):1}
  function ensureUI(){
    const host=$("[data-budget-tools]");if(!host||host.dataset.ready==="1")return;host.dataset.ready="1";
    host.innerHTML=`<div class="tp-budget-title"><strong>Your budget</strong><button type="button" data-budget-clear>Clear</button></div>
      <div class="tp-budget-numbers"><label>Min $<input data-budget-min type="number" min="0" max="${cfg.max}" step="${cfg.step}" placeholder="0"></label><span>to</span><label>Max $<input data-budget-max type="number" min="0" max="${cfg.max}" step="${cfg.step}" placeholder="${cfg.max}"></label></div>
      <div class="tp-budget-sliders"><input data-budget-range-min type="range" min="0" max="${cfg.max}" step="${cfg.step}" value="0" aria-label="Minimum price"><input data-budget-range-max type="range" min="0" max="${cfg.max}" step="${cfg.step}" value="${cfg.max}" aria-label="Maximum price"></div>
      <div class="tp-budget-presets">${cfg.presets.map(([a,b,l])=>`<button type="button" data-budget-preset="${a}-${b}">${l}</button>`).join("")}</div>
      <label class="tp-verified-only"><input data-verified-only type="checkbox"><span><strong>Verified prices only</strong><small>Hide products without an exact current price.</small></span></label>
      <div class="tp-budget-status" data-budget-status>Products without a verified price stay visible until you set a budget or choose verified prices only.</div>`;
  }
  function sync(source){
    const nmin=$("[data-budget-min]"),nmax=$("[data-budget-max]"),rmin=$("[data-budget-range-min]"),rmax=$("[data-budget-range-max]");if(!nmin||!nmax||!rmin||!rmax)return;
    if(source==="rmin"||source==="rmax"){let a=num(rmin.value),b=num(rmax.value);if(a>b){if(source==="rmin")b=a;else a=b}rmin.value=a;rmax.value=b;nmin.value=a||"";nmax.value=b===cfg.max?"":b;min=a;max=b===cfg.max?0:b}
    else{let a=Math.max(0,num(nmin.value)),b=Math.max(0,num(nmax.value));if(b&&a>b)b=a;a=Math.min(a,cfg.max);b=b?Math.min(b,cfg.max):cfg.max;rmin.value=a;rmax.value=b;min=a;max=b===cfg.max?0:b}
    $$("[data-budget-preset]").forEach(x=>x.classList.remove("active"));apply();
  }
  function decorate(card){const p=priceOf(card),pe=$(".tp78-price",card);if(!pe)return;let badge=$(".tp-price-confidence",card);if(!badge){badge=d.createElement("span");badge.className="tp-price-confidence";pe.insertAdjacentElement("afterend",badge)}if(p>0){badge.className="tp-price-confidence verified";badge.textContent="✓ Verified price"}else{badge.className="tp-price-confidence check";badge.textContent="Price checked at seller"}}
  function bestValue(cards){
    const vals=cards.map(priceOf).filter(Boolean),lo=vals.length?Math.min(...vals):0,hi=vals.length?Math.max(...vals):0,value=p=>p&&hi>lo?1-(p-lo)/(hi-lo):p?0.6:0;
    return cards.sort((a,b)=>{const pa=priceOf(a),pb=priceOf(b),qa=(pa?60:0)+value(pa)*25+Math.min(sellerCount(a),3)*5+Math.min(variantCount(a),4)*2,qb=(pb?60:0)+value(pb)*25+Math.min(sellerCount(b),3)*5+Math.min(variantCount(b),4)*2;return qb-qa});
  }
  function apply(){
    if(applying)return;applying=true;const grid=$("[data-v2078-product-grid]");if(!grid){applying=false;return}
    const cards=$$(".tp78-card",grid);let shown=0,verified=0,unknown=0;
    cards.forEach((c,i)=>{if(!c.dataset.buyerOrder)c.dataset.buyerOrder=String(i+1);decorate(c);const p=priceOf(c);p?verified++:unknown++;const budget=min>0||max>0,okBudget=!budget||(p>0&&p>=min&&(!max||p<=max)),okVerified=!verifiedOnly||p>0;c.hidden=!(okBudget&&okVerified);if(!c.hidden)shown++});
    const sort=$("[data-filter-sort]")?.value||"smart",visible=cards.filter(c=>!c.hidden);
    if(sort==="best-value")bestValue(visible).forEach(c=>grid.appendChild(c));else cards.slice().sort((a,b)=>num(a.dataset.buyerOrder)-num(b.dataset.buyerOrder)).forEach(c=>grid.appendChild(c));
    const s=$("[data-budget-status]");if(s)s.textContent=[`${shown} shown`,`${verified} with verified price`,unknown?`${unknown} check-at-seller`:""].filter(Boolean).join(" · ");
    const count=$("[data-v2078-results-count]");if(count&&cards.length)count.textContent=`${shown} matching`;applying=false;
  }
  function events(){
    d.addEventListener("input",e=>{if(e.target.matches("[data-budget-range-min]"))sync("rmin");else if(e.target.matches("[data-budget-range-max]"))sync("rmax");else if(e.target.matches("[data-budget-min],[data-budget-max]"))sync("numbers")});
    d.addEventListener("change",e=>{if(e.target.matches("[data-verified-only]")){verifiedOnly=e.target.checked;apply()}else if(e.target.matches("[data-filter-sort]"))setTimeout(apply,30)});
    d.addEventListener("click",e=>{const p=e.target.closest("[data-budget-preset]");if(p){const [a,b]=p.dataset.budgetPreset.split("-").map(num);min=a;max=b>=cfg.max?0:b;$("[data-budget-min]").value=a||"";$("[data-budget-max]").value=max||"";$("[data-budget-range-min]").value=a;$("[data-budget-range-max]").value=b;$$("[data-budget-preset]").forEach(x=>x.classList.toggle("active",x===p));apply();return}if(e.target.closest("[data-budget-clear]")){min=max=0;verifiedOnly=false;$("[data-budget-min]").value="";$("[data-budget-max]").value="";$("[data-budget-range-min]").value=0;$("[data-budget-range-max]").value=cfg.max;$("[data-verified-only]").checked=false;$$("[data-budget-preset]").forEach(x=>x.classList.remove("active"));apply()}});
  }
  function boot(){ensureUI();events();const grid=$("[data-v2078-product-grid]");if(grid){let timer=0;new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(apply,70)}).observe(grid,{childList:true});setTimeout(apply,160);setTimeout(apply,700)}}
  d.readyState==="loading"?d.addEventListener("DOMContentLoaded",boot,{once:true}):boot();
  window.__TP_V20711_BUYER_DECISION__={version:V};
})();'''

BUYER_CSS = r'''.tp-budget-shell{display:grid;gap:12px}.tp-budget-title{display:flex;align-items:center;justify-content:space-between;gap:10px}.tp-budget-title strong{font-size:17px}.tp-budget-title button{border:0;background:transparent;color:#3157e8;font-weight:850;cursor:pointer}.tp-budget-numbers{display:grid;grid-template-columns:1fr auto 1fr;gap:8px;align-items:end}.tp-budget-numbers label{font-size:12px;font-weight:850;color:#667085}.tp-budget-numbers input{width:100%;margin-top:5px;border:1px solid #d9e0eb;border-radius:12px;padding:10px 11px;font:inherit;color:#101828;background:#fff}.tp-budget-numbers>span{padding-bottom:11px;color:#98a2b3}.tp-budget-sliders{display:grid;gap:4px}.tp-budget-sliders input{width:100%;accent-color:#3157e8}.tp-budget-presets{display:flex;flex-wrap:wrap;gap:7px}.tp-budget-presets button{border:1px solid #d9e0eb;border-radius:999px;padding:8px 11px;background:#fff;color:#344054;font-weight:800;cursor:pointer}.tp-budget-presets button.active{background:#3157e8;color:#fff;border-color:#3157e8}.tp-verified-only{display:flex;gap:10px;align-items:flex-start;padding:12px;border:1px solid #dfe5ee;border-radius:14px;background:#f8fafc;cursor:pointer}.tp-verified-only input{margin-top:3px;accent-color:#0a8f6a}.tp-verified-only span{display:grid;gap:2px}.tp-verified-only strong{font-size:14px}.tp-verified-only small{color:#667085;line-height:1.35}.tp-budget-status{font-size:12px;line-height:1.4;color:#667085}.tp-price-confidence{display:inline-flex;align-items:center;width:max-content;margin:4px 0 0;padding:4px 8px;border-radius:999px;font-size:11px;font-weight:850}.tp-price-confidence.verified{background:#e8f8f1;color:#08765a}.tp-price-confidence.check{background:#f2f4f7;color:#667085}.tp78-card[hidden]{display:none!important}@media(max-width:650px){.tp-budget-presets{gap:6px}.tp-budget-presets button{padding:7px 9px;font-size:12px}}'''

(ROOT / "js/buyer-decision-v20-7-11.js").write_text(BUYER_JS + "\n", encoding="utf-8")
(ROOT / "css/buyer-decision-v20-7-11.css").write_text(BUYER_CSS + "\n", encoding="utf-8")

html = FIND.read_text(encoding="utf-8").replace("v=20.7.10", "v=20.7.11")
if "buyer-decision-v20-7-11.css" not in html:
    html = html.replace("</head>", '  <link rel="stylesheet" href="/css/buyer-decision-v20-7-11.css?v=20.7.11">\n</head>')
old_price = '<div class="tp-filter-group"><label for="tp-price">Price</label><select id="tp-price" data-filter-price><option value="">Any verified price</option><option value="0-10">Under $10</option><option value="10-25">$10–25</option><option value="25-50">$25–50</option><option value="50-100">$50–100</option><option value="100+">Over $100</option></select></div>'
new_price = '<div class="tp-filter-group"><label>Price & budget</label><div class="tp-budget-shell" data-budget-tools></div><select id="tp-price" data-filter-price hidden><option value="">Any price</option></select></div>'
if old_price in html:
    html = html.replace(old_price, new_price)
elif "data-budget-tools" not in html:
    raise SystemExit("Could not locate current price filter markup")
if 'value="best-value"' not in html:
    html = html.replace('<option value="smart">Best match</option>', '<option value="smart">Best match</option><option value="best-value">Best value</option>')
if "buyer-decision-v20-7-11.js" not in html:
    html = html.replace("</body>", '<script defer src="/js/buyer-decision-v20-7-11.js?v=20.7.11"></script>\n</body>')
FIND.write_text(html, encoding="utf-8")

f = FINDER.read_text(encoding="utf-8").replace('const V="20.7.10"', 'const V="20.7.11"')
FINDER.write_text(f, encoding="utf-8")

src = PRODUCT.read_text(encoding="utf-8").replace('const VERSION = "20.7.10";', 'const VERSION = "20.7.11";')
old = '''function sellerHtml(g){
  const offers=activeOffers(g),url=bestUrl(g),hasExact=offers.some(o=>exactEvidence(o,g));
  if(!url) return "";
  const details=offers.length>1?`<details><summary>View ${offers.length} listings</summary><div class="suboffers">${offers.slice(0,12).map(o=>`<a class="suboffer" href="${esc(o.url)}" target="_blank" rel="sponsored nofollow noopener"><span>${o.businessListing?"Supplier listing":"Seller listing"}</span><strong>${esc(exactEvidence(o,g)&&Number.isFinite(Number(o.price))?fmtPrice(o.price,o.currency):"Check price")}</strong></a>`).join("")}</div></details>`:"";
  const routeNote=hasExact?"Exact-product destination evidence is available for at least one listing.":"This opens a broader seller or marketplace route. Confirm the exact item before buying.";
  return `<article class="seller-card"><div class="seller-top"><div><h3>${esc(g.seller)}</h3><p>${offers.length} active listing${offers.length===1?"":"s"}${g.businessListing?" · Business/supplier listing":""}</p></div><strong class="seller-price">${esc(groupPrice(g))}</strong></div><a class="cta" href="${esc(url)}" target="_blank" rel="sponsored nofollow noopener">${hasExact?"Visit exact product":"Browse seller"} ↗</a><p class="route-note">${esc(routeNote)}</p>${details}</article>`;
}'''
new = '''function sellerHtml(g){
  const offers=activeOffers(g),url=bestUrl(g),hasExact=offers.some(o=>exactEvidence(o,g)),trusted=trustedOffers(g);
  if(!url) return "";
  const visible=offers.slice(0,3),extra=offers.slice(3);
  const listing=o=>`<a class="suboffer" href="${esc(o.url)}" target="_blank" rel="sponsored nofollow noopener"><span>${o.businessListing?"Supplier listing":"Seller listing"}</span><strong>${esc(exactEvidence(o,g)&&Number.isFinite(Number(o.price))?fmtPrice(o.price,o.currency):"Check price")}</strong></a>`;
  const details=offers.length?`<div class="offer-list">${visible.map(listing).join("")}${extra.length?`<details class="more-offers"><summary>Show ${extra.length} more listing${extra.length===1?"":"s"}</summary><div class="suboffers">${extra.slice(0,17).map(listing).join("")}</div></details>`:""}</div>`:"";
  const trustedPrice=trusted.length?Math.min(...trusted.map(o=>Number(o.price))):0,cur=trusted[0]?.currency||g?.currency||"USD";
  const ctaLabel=hasExact?(trustedPrice?`Buy at ${fmtPrice(trustedPrice,cur)}`:"View exact product"):`Search on ${clean(g.seller)}`;
  const confidence=trustedPrice?"Verified exact price":hasExact?"Exact product · price at seller":"Marketplace search route";
  const routeNote=hasExact?"This button opens an exact-product destination when available.":"This opens a broader seller or marketplace search. Confirm the exact item before buying.";
  return `<article class="seller-card"><div class="seller-top"><div><h3>${esc(g.seller)}</h3><p>${offers.length} active listing${offers.length===1?"":"s"}${g.businessListing?" · Business/supplier listing":""}</p></div><strong class="seller-price">${esc(groupPrice(g))}</strong></div><span class="confidence ${trustedPrice?"verified":""}">${esc(confidence)}</span><a class="cta" href="${esc(url)}" target="_blank" rel="sponsored nofollow noopener">${esc(ctaLabel)} ↗</a><p class="route-note">${esc(routeNote)}</p>${details}</article>`;
}'''
if old in src:
    src = src.replace(old, new)
elif "const visible=offers.slice(0,3)" not in src:
    raise SystemExit("Current sellerHtml block not recognized")

if "function decisionHtml(groups)" not in src:
    marker = "function jsonLd(p,canonical,title,image,groups){"
    decision = '''function decisionHtml(groups){
  const trusted=[];for(const g of groups)for(const o of trustedOffers(g))trusted.push({...o,seller:g.seller});
  if(!trusted.length)return `<section class="decision"><div><strong>Price status</strong><span>No exact verified price yet</span></div><p>TrendPilot will not guess a price. Open a seller route to confirm the current amount.</p></section>`;
  const prices=trusted.map(o=>Number(o.price)),lo=Math.min(...prices),hi=Math.max(...prices),cur=trusted[0]?.currency||"USD",sellerCount=new Set(trusted.map(x=>x.seller)).size,label=lo===hi?fmtPrice(lo,cur):`${fmtPrice(lo,cur)}–${fmtPrice(hi,cur)}`;
  return `<section class="decision"><div><strong>Verified price${trusted.length===1?"":" range"}</strong><span>${esc(label)}</span></div><p>${trusted.length} exact priced offer${trusted.length===1?"":"s"} across ${sellerCount} seller${sellerCount===1?"":"s"}. Final stock and delivery are confirmed at the seller.</p></section>`;
}
'''
    src = src.replace(marker, decision + marker)

if "${decisionHtml(groups)}" not in src:
    src = src.replace("${variantsHtml(p)}\n<section class=\"panel\" id=\"seller-offers\">", "${variantsHtml(p)}\n${decisionHtml(groups)}\n<section class=\"panel\" id=\"seller-offers\">")

src = src.replace('.seller-card h3{font-size:22px;margin:0}.seller-card p{color:var(--muted);margin:4px 0 0}.seller-price{font-size:20px;text-align:right}.cta{', '.seller-card h3{font-size:22px;margin:0}.seller-card p{color:var(--muted);margin:4px 0 0}.seller-price{font-size:20px;text-align:right}.confidence{display:inline-flex;margin-top:10px;padding:5px 9px;border-radius:999px;background:#f2f4f7;color:#667085;font-size:12px;font-weight:850}.confidence.verified{background:#e8f8f1;color:#08765a}.decision{background:linear-gradient(135deg,#edf8f3,#eef3ff);border:1px solid #dbe7e2;border-radius:22px;padding:18px 20px;margin:16px 0}.decision>div{display:flex;justify-content:space-between;gap:14px;align-items:center}.decision strong{font-size:15px}.decision span{font-size:20px;font-weight:900;color:#08765a}.decision p{margin:7px 0 0;color:#667085;line-height:1.45}.cta{')
src = src.replace('details{margin-top:12px}summary{cursor:pointer;color:var(--blue);font-weight:800}.suboffers{', '.offer-list{display:grid;gap:7px;margin-top:12px}.more-offers{margin-top:2px}details{margin-top:12px}summary{cursor:pointer;color:var(--blue);font-weight:800}.suboffers{')
src = src.replace('.seller-top{flex-direction:column}.seller-price{text-align:left}.cta{width:100%}', '.seller-top{flex-direction:column}.seller-price{text-align:left}.decision>div{align-items:flex-start;flex-direction:column;gap:5px}.decision span{font-size:18px}.cta{width:100%}')
PRODUCT.write_text(src, encoding="utf-8")

print("V20.7.11 buyer decision tools installed")
