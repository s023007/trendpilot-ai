const fs = require("node:fs");
const path = require("node:path");

const DATA_REL = path.join("data","shopper-v20-6","runtime-v20-6-8-3.json");
let CACHE = null;

function esc(v){
  return String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function locate(){
  const cwd = process.cwd();
  const here = __dirname;
  const candidates = [
    path.join(cwd, DATA_REL),
    path.join(cwd, "..", DATA_REL),
    path.join(cwd, "..", "..", DATA_REL),
    path.join(here, "..", "..", DATA_REL),
    path.join(here, "..", "..", "..", DATA_REL),
    path.join("/var/task", DATA_REL)
  ];
  for (const p of candidates){
    try { if (fs.existsSync(p) && fs.statSync(p).isFile()) return p; } catch {}
  }
  throw new Error("TrendPilot shopper runtime data not found");
}
function load(){
  if (CACHE) return CACHE;
  const data = JSON.parse(fs.readFileSync(locate(),"utf8"));
  const byRoute = new Map();
  for (const p of data.products || []){
    byRoute.set(String(p.route||"").replace(/^\/+|\/+$/g,"").toLowerCase(), p);
  }
  CACHE = {data,byRoute};
  return CACHE;
}
function fmtPrice(n,c="USD"){
  if (n === null || n === undefined || !Number.isFinite(Number(n))) return "Check current price";
  try { return new Intl.NumberFormat("en-US",{style:"currency",currency:c||"USD",maximumFractionDigits:2}).format(Number(n)); }
  catch { return `$${Number(n).toFixed(2)}`; }
}
function priceRange(g){
  if (g.priceMin === null || g.priceMin === undefined) return "Check current price";
  if (g.priceMax !== null && g.priceMax !== undefined && Number(g.priceMax) !== Number(g.priceMin)){
    return `${fmtPrice(g.priceMin,g.currency)}–${fmtPrice(g.priceMax,g.currency)}`;
  }
  return fmtPrice(g.priceMin,g.currency);
}
function page404(msg){
  return {statusCode:404,headers:{"content-type":"text/html; charset=utf-8","cache-control":"public, max-age=60"},body:`<!doctype html><meta charset="utf-8"><title>Product not found | TrendPilot AI</title><main style="font-family:system-ui;padding:2rem"><h1>Product not found</h1><p>${esc(msg)}</p><a href="/find/?engine=v2064">Back to search</a></main>`};
}
function specsHtml(p){
  const labels={storage:"Storage",ram:"RAM",battery:"Battery",screen:"Screen"};
  const items=Object.entries(p.specs||{}).filter(([k,v])=>labels[k] && v);
  if (!items.length) return "";
  return `<section class="panel"><div class="eyebrow">PRODUCT PREVIEW</div><h2>Important details</h2><div class="specgrid">${items.map(([k,v])=>`<div class="spec"><span>${labels[k]}</span><strong>${esc(v)}</strong></div>`).join("")}</div></section>`;
}
function variantsHtml(p){
  const vars=p.variants||[];
  if (!vars.length) return "";
  return `<section class="panel"><div class="eyebrow">CONFIGURATIONS</div><h2>Available configurations</h2><p class="muted">Choose the exact configuration before comparing seller listings.</p><div class="variants">${vars.map(v=>`<div class="variant"><strong>${esc(v.label||"Standard configuration")}</strong><span>${v.offerCount||0} offer${v.offerCount===1?"":"s"} · ${v.sellerCount||0} seller${v.sellerCount===1?"":"s"}</span></div>`).join("")}</div></section>`;
}
function sellerHtml(g){
  const details=(g.offers||[]).length>1 ? `<details><summary>View ${g.offers.length} listings</summary><div class="suboffers">${g.offers.map(o=>`<a class="suboffer" href="${esc(o.url)}" target="_blank" rel="sponsored nofollow noopener"><span>${o.businessListing?"Supplier listing":"Seller listing"}</span><strong>${esc(fmtPrice(o.price,o.currency))}</strong></a>`).join("")}</div></details>` : "";
  return `<article class="seller-card">
    <div class="seller-top"><div><h3>${esc(g.seller)}</h3><p>${g.offerCount} offer${g.offerCount===1?"":"s"}${g.businessListing?" · Business/supplier listing":""}</p></div><strong class="seller-price">${esc(priceRange(g))}</strong></div>
    <a class="cta" href="${esc(g.bestUrl)}" target="_blank" rel="sponsored nofollow noopener">${g.offerCount>1?"Visit best offer":"Visit seller"} ↗</a>
    ${details}
  </article>`;
}
function jsonLd(p,canonical){
  const offers=[];
  for (const g of p.sellerGroups||[]){
    for (const o of g.offers||[]){
      if (o.price === null || o.price === undefined) continue;
      offers.push({"@type":"Offer","price":Number(o.price),"priceCurrency":o.currency||"USD","url":o.url,"availability":"https://schema.org/InStock","seller":{"@type":"Organization","name":g.seller}});
    }
  }
  const ld={"@context":"https://schema.org","@type":"Product","name":p.title,"url":canonical};
  if (p.image) ld.image=[p.image];
  if (p.brand) ld.brand={"@type":"Brand","name":p.brand};
  if (offers.length===1) ld.offers=offers[0];
  else if (offers.length>1){
    const prices=offers.map(x=>x.price).filter(Number.isFinite);
    ld.offers={"@type":"AggregateOffer","offerCount":offers.length,"lowPrice":Math.min(...prices),"highPrice":Math.max(...prices),"priceCurrency":offers[0].priceCurrency,"offers":offers.slice(0,20)};
  }
  return JSON.stringify(ld).replace(/</g,"\\u003c");
}
exports.handler = async function(event){
  let store;
  try { store=load(); } catch (e) { return {statusCode:500,headers:{"content-type":"text/plain; charset=utf-8"},body:"Product preview data could not be loaded."}; }
  const q=event.queryStringParameters||{};
  let slug=String(q.slug||"").replace(/^\/+|\/+$/g,"");
  if (!slug){
    const raw=String(event.rawUrl||event.path||"");
    const m=raw.match(/\/product\/([^?#/]+)/i);
    if (m) slug=decodeURIComponent(m[1]);
  }
  let p=store.byRoute.get(slug.toLowerCase());
  if (!p){
    const idm=slug.match(/([a-z0-9]{12,})$/i);
    if (idm){
      const suffix=idm[1].toUpperCase();
      p=(store.data.products||[]).find(x=>String(x.tpid||"").toUpperCase().endsWith(suffix));
    }
  }
  if (!p) return page404(slug||"Unknown product");
  const canonical=`https://trendpilotchoice.com/product/${encodeURIComponent(p.route)}/`;
  const groups=p.sellerGroups||[];
  const sellers=p.sellerCount||groups.length;
  const offers=p.offerCount||groups.reduce((n,g)=>n+(g.offerCount||0),0);
  const title=`${p.title} | TrendPilot AI`;
  const desc=`Compare ${offers} current seller offer${offers===1?"":"s"} from ${sellers} seller${sellers===1?"":"s"} for ${p.title}. Review configurations, key details and seller options.`;
  const heroImage=p.image?`<img src="${esc(p.image)}" alt="${esc(p.title)}" loading="eager" decoding="async">`:`<div class="noimg">TP</div>`;
  const sellerHeading=sellers>1?"Compare seller options":"Seller offer";
  const body=`<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><link rel="canonical" href="${esc(canonical)}">
<meta property="og:type" content="product"><meta property="og:title" content="${esc(p.title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${esc(canonical)}">${p.image?`<meta property="og:image" content="${esc(p.image)}">`:""}
<script type="application/ld+json">${jsonLd(p,canonical)}</script>
<style>
:root{--ink:#0e1b18;--muted:#6f7c78;--blue:#315eea;--line:#d8e0dd;--soft:#eef8f3;--bg:#f7f5ef}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:Inter,ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;padding-bottom:110px}
header{position:sticky;top:0;z-index:10;background:rgba(255,255,255,.96);border-bottom:1px solid #e7ebe9;padding:18px 22px;display:flex;align-items:center;justify-content:space-between}
.logo{font-size:28px;font-weight:850;text-decoration:none;color:var(--ink)}.logo b{color:#25b88a}.search{border:1px solid var(--line);padding:12px 18px;border-radius:18px;color:var(--blue);font-weight:800;text-decoration:none}
main{max-width:900px;margin:auto;padding:28px 22px}.back{display:inline-block;color:var(--blue);font-weight:800;text-decoration:none;margin-bottom:22px}
.hero{display:grid;grid-template-columns:minmax(150px,260px) 1fr;gap:28px;align-items:center;margin-bottom:28px}.hero-media{background:white;border:1px solid var(--line);border-radius:28px;display:grid;place-items:center;min-height:230px;padding:18px}.hero-media img{width:100%;height:220px;object-fit:contain}.noimg{width:90px;height:90px;border-radius:24px;background:var(--blue);color:#fff;display:grid;place-items:center;font-weight:900;font-size:32px}.brand{color:var(--blue);font-weight:850;font-size:20px}.hero h1{font-size:clamp(34px,7vw,62px);line-height:1.02;margin:8px 0 12px;overflow-wrap:anywhere}.hero p{font-size:21px;color:var(--muted);margin:0}
.panel{background:#fff;border:1px solid var(--line);border-radius:28px;padding:28px;margin:22px 0}.eyebrow{color:var(--blue);font-weight:900;letter-spacing:.09em;font-size:14px}.panel h2{font-size:34px;margin:7px 0 10px}.muted{color:var(--muted);font-size:18px;line-height:1.5}
.specgrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:20px}.spec{background:var(--soft);padding:18px;border-radius:20px}.spec span{display:block;color:var(--muted);font-size:13px;font-weight:850;text-transform:uppercase;letter-spacing:.07em}.spec strong{display:block;font-size:24px;margin-top:4px}
.variants{display:grid;gap:12px;margin-top:18px}.variant{border:1px solid var(--line);border-radius:18px;padding:16px 18px;display:flex;align-items:center;justify-content:space-between;gap:18px}.variant strong{font-size:19px}.variant span{color:var(--muted);white-space:nowrap}
.seller-head{display:flex;align-items:center;justify-content:space-between;gap:15px}.pill{background:#e4faf2;border-radius:999px;padding:11px 16px;color:#08765a;font-weight:850}
.sellers{display:grid;gap:14px;margin-top:18px}.seller-card{border:1px solid var(--line);border-radius:22px;padding:20px}.seller-top{display:flex;justify-content:space-between;gap:14px;align-items:flex-start}.seller-card h3{font-size:25px;margin:0}.seller-card p{color:var(--muted);margin:5px 0 0}.seller-price{font-size:24px;text-align:right}.cta{display:inline-block;background:var(--blue);color:#fff;text-decoration:none;font-weight:850;padding:15px 20px;border-radius:16px;margin-top:16px}
details{margin-top:14px}summary{cursor:pointer;color:var(--blue);font-weight:800}.suboffers{display:grid;gap:8px;margin-top:10px}.suboffer{display:flex;justify-content:space-between;gap:12px;text-decoration:none;color:var(--ink);background:#f7f9f8;border:1px solid #e8edeb;border-radius:14px;padding:12px 14px}
.tech{color:var(--muted);font-size:13px;margin:26px 0}.bottom{position:fixed;left:18px;right:18px;bottom:14px;z-index:20;max-width:850px;margin:auto;background:rgba(255,255,255,.96);border:1px solid var(--line);border-radius:26px;padding:14px 18px;display:flex;justify-content:space-around;box-shadow:0 8px 30px rgba(0,0,0,.07)}.bottom a{text-decoration:none;color:#46534f;font-weight:800}.bottom a.active{color:var(--blue)}
@media(max-width:650px){main{padding:20px 16px}.hero{grid-template-columns:112px 1fr;gap:16px}.hero-media{min-height:150px;padding:10px;border-radius:22px}.hero-media img{height:140px}.hero h1{font-size:38px}.hero p{font-size:17px}.panel{padding:20px;border-radius:24px}.panel h2{font-size:29px}.specgrid{grid-template-columns:1fr 1fr}.variant{align-items:flex-start;flex-direction:column;gap:4px}.variant span{white-space:normal}.seller-top{flex-direction:column}.seller-price{text-align:left}.cta{width:100%;text-align:center}.logo{font-size:24px}}
</style><link rel="stylesheet" href="/css/shopper-v20-6-8-4.css?v=20.6.8.4"></head>
<body><header><a class="logo" href="/">TrendPilot <b>AI</b></a><a class="search" href="/find/?engine=v2064">Search</a></header>
<main><a class="back" href="/find/?engine=v2064">← Back to results</a>
<section class="hero"><div class="hero-media">${heroImage}</div><div><div class="brand">${esc(p.brand||"TrendPilot")}</div><h1>${esc(p.title)}</h1><p>${offers} offer${offers===1?"":"s"} from ${sellers} seller${sellers===1?"":"s"} · ${p.variantCount||0} configuration${p.variantCount===1?"":"s"}</p></div></section>
${specsHtml(p)}
${variantsHtml(p)}
<section class="panel"><div class="seller-head"><div><div class="eyebrow">SELLER OFFERS</div><h2>${sellerHeading}</h2></div><span class="pill">${sellers} seller${sellers===1?"":"s"}</span></div><div class="sellers">${groups.map(sellerHtml).join("")}</div></section>
<details class="tech"><summary>Technical identity details</summary><p>TPID ${esc(p.tpid)}. Exact seller listings remain separate TrendPilot offer identities.</p></details></main>
<nav class="bottom"><a href="/">Home</a><a class="active" href="/find/?engine=v2064">Search</a><a href="/deals/">Deals</a><a href="/compare/">Compare</a></nav>
<script defer src="/js/shopper-v20-6-8-4.js?v=20.6.8.4"></script></body></html>`;
  return {statusCode:200,headers:{"content-type":"text/html; charset=utf-8","cache-control":"public, max-age=300, s-maxage=900","x-trendpilot-preview":"20.6.8.3"},body};
};