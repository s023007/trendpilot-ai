const fs = require("node:fs");
const path = require("node:path");

const VERSION = "20.7.10";
const DATA_REL = path.join("data","shopper-v20-6","runtime-v20-6-8-3.json");
const BLOCKED_SELLERS = new Set(["temu","joom","filamentpro","filamentpro eu cps"]);
let CACHE = null;

function esc(v){
  return String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function clean(v){ return String(v ?? "").replace(/\s+/g," ").trim(); }
function lower(v){ return clean(v).toLowerCase(); }
function validHttp(v){ return /^https?:\/\//i.test(clean(v)); }
function locate(){
  const cwd=process.cwd(), here=__dirname;
  const candidates=[
    path.join(cwd,DATA_REL),path.join(cwd,"..",DATA_REL),path.join(cwd,"..","..",DATA_REL),
    path.join(here,"..","..",DATA_REL),path.join(here,"..","..","..",DATA_REL),path.join("/var/task",DATA_REL)
  ];
  for(const p of candidates){ try{ if(fs.existsSync(p)&&fs.statSync(p).isFile()) return p; }catch{} }
  throw new Error("TrendPilot shopper runtime data not found");
}
function load(){
  if(CACHE) return CACHE;
  const data=JSON.parse(fs.readFileSync(locate(),"utf8")), byRoute=new Map();
  for(const p of data.products||[]) byRoute.set(String(p.route||"").replace(/^\/+|\/+$/g,"").toLowerCase(),p);
  CACHE={data,byRoute}; return CACHE;
}
function fmtPrice(n,c="USD"){
  if(n===null||n===undefined||!Number.isFinite(Number(n))) return "Check current price";
  try{return new Intl.NumberFormat("en-US",{style:"currency",currency:c||"USD",maximumFractionDigits:2}).format(Number(n))}
  catch{return `$${Number(n).toFixed(2)}`}
}
function cleanTitle(value,brand=""){
  let t=clean(value)
    .replace(/^\[[^\]]{1,32}\]\s*/,"")
    .replace(/\b(?:special price|factory price|factory direct|hot sale|hot sell|best price|wholesale price|wholesale|dropshipping|drop shipping|original authentic|original product|global official version|official version|new arrival|promotion price|promotional price)\b/ig," ")
    .replace(/\bsmart\s+cell\s+phones?\b/ig,"Smartphone")
    .replace(/\bmobile\s+phones?\b/ig,"Smartphone")
    .replace(/\bcell\s+phones?\b/ig,"Smartphone")
    .replace(/\s+/g," ")
    .replace(/\s+([,.;:])/g,"$1")
    .trim();
  const b=clean(brand);
  if(b){
    const re=new RegExp(`(?:\\b${b.replace(/[.*+?^${}()|[\\]\\]/g,"\\$&")}\\b\\s*){2,}`,"ig");
    t=t.replace(re,`${b} `).trim();
  }
  if(t.length>100) t=t.slice(0,97).replace(/\s+\S*$/," ").trimEnd()+"…";
  return t||"Product";
}
function isPlaceholderImage(v){
  const s=lower(v);
  return !validHttp(v)||/(?:no[-_ ]?(?:photo|image)|placeholder|image[-_ ]?not[-_ ]?available|default[-_ ]?(?:product|image)|blank[-_ ]?image|missing[-_ ]?image)/i.test(s);
}
function bestImage(p){
  const candidates=[p?.image,p?.imageUrl,p?.thumbnail];
  for(const g of p?.sellerGroups||[]) for(const o of g?.offers||[]) candidates.push(o?.image,o?.imageUrl,o?.thumbnail,o?.picture);
  return clean(candidates.find(v=>validHttp(v)&&!isPlaceholderImage(v))||"");
}
function sellerAllowed(name){ const n=lower(name); return !!n && !BLOCKED_SELLERS.has(n) && !n.includes("filamentpro"); }
function unavailable(x){
  return x?.availability==="unavailable" || /(?:unavailable|out of stock|expired|removed|discontinued)/i.test(clean(x?.status||x?.availability));
}
function dynamicTikTok(x,seller=""){
  return /tiktok/i.test(clean(seller||x?.seller)) && (x?.availability==="check-live"||x?.availability_dynamic===true||/check[- ]?live|dynamic/i.test(clean(x?.status||x?.availability)));
}
function exactEvidence(o,g){
  return o?.destinationExact===true || o?.destination_exact===true || o?.exact===true ||
    g?.destinationExact===true || g?.destination_exact===true ||
    /^(?:exact-tracked|exact-direct)$/i.test(clean(o?.kind||o?.destinationKind||g?.kind||g?.primary?.kind));
}
function activeGroups(p){
  return (p?.sellerGroups||[]).filter(g=>sellerAllowed(g?.seller)&&!unavailable(g)&&!dynamicTikTok(g,g?.seller));
}
function activeOffers(g){
  return (g?.offers||[]).filter(o=>validHttp(o?.url)&&!unavailable(o)&&!dynamicTikTok(o,g?.seller));
}
function trustedOffers(g){
  return activeOffers(g).filter(o=>exactEvidence(o,g)&&Number.isFinite(Number(o?.price))&&Number(o.price)>0);
}
function groupPrice(g){
  const trusted=trustedOffers(g),a=trusted.map(o=>Number(o.price));
  if(!a.length) return "Check current price";
  const lo=Math.min(...a),hi=Math.max(...a),cur=trusted[0]?.currency||g?.currency||"USD";
  return hi!==lo?`${fmtPrice(lo,cur)}–${fmtPrice(hi,cur)}`:fmtPrice(lo,cur);
}
function bestUrl(g){
  const exact=activeOffers(g).find(o=>exactEvidence(o,g));
  const any=activeOffers(g)[0];
  const u=clean(exact?.url||any?.url||g?.bestUrl||g?.primary?.url);
  return validHttp(u)?u:"";
}
function specsHtml(p){
  const labels={storage:"Storage",ram:"RAM",battery:"Battery",screen:"Screen"};
  const items=Object.entries(p.specs||{}).filter(([k,v])=>labels[k]&&clean(v));
  if(!items.length) return "";
  return `<section class="panel"><div class="eyebrow">PRODUCT PREVIEW</div><h2>Important details</h2><div class="specgrid">${items.map(([k,v])=>`<div class="spec"><span>${labels[k]}</span><strong>${esc(v)}</strong></div>`).join("")}</div></section>`;
}
function aboutHtml(p){
  const summary=clean(p?.summary),note=clean(p?.buyerNote);
  if(!summary&&!note) return "";
  return `<section class="panel about"><div class="eyebrow">ABOUT THIS PRODUCT</div><h2>What this product is</h2>${summary?`<p class="about-copy">${esc(summary)}</p>`:""}${note?`<p class="buyer-note"><strong>Before you buy:</strong> ${esc(note)}</p>`:""}</section>`;
}
function variantsHtml(p){
  const vars=p.variants||[]; if(!vars.length) return "";
  return `<section class="panel"><div class="eyebrow">CONFIGURATIONS</div><h2>Available configurations</h2><p class="muted">Choose the exact configuration before comparing seller listings.</p><div class="variants">${vars.map(v=>`<div class="variant"><strong>${esc(v.label||"Standard configuration")}</strong><span>${v.offerCount||0} offer${v.offerCount===1?"":"s"} · ${v.sellerCount||0} seller${v.sellerCount===1?"":"s"}</span></div>`).join("")}</div></section>`;
}
function sellerHtml(g){
  const offers=activeOffers(g),url=bestUrl(g),hasExact=offers.some(o=>exactEvidence(o,g));
  if(!url) return "";
  const details=offers.length>1?`<details><summary>View ${offers.length} listings</summary><div class="suboffers">${offers.slice(0,12).map(o=>`<a class="suboffer" href="${esc(o.url)}" target="_blank" rel="sponsored nofollow noopener"><span>${o.businessListing?"Supplier listing":"Seller listing"}</span><strong>${esc(exactEvidence(o,g)&&Number.isFinite(Number(o.price))?fmtPrice(o.price,o.currency):"Check price")}</strong></a>`).join("")}</div></details>`:"";
  const routeNote=hasExact?"Exact-product destination evidence is available for at least one listing.":"This opens a broader seller or marketplace route. Confirm the exact item before buying.";
  return `<article class="seller-card"><div class="seller-top"><div><h3>${esc(g.seller)}</h3><p>${offers.length} active listing${offers.length===1?"":"s"}${g.businessListing?" · Business/supplier listing":""}</p></div><strong class="seller-price">${esc(groupPrice(g))}</strong></div><a class="cta" href="${esc(url)}" target="_blank" rel="sponsored nofollow noopener">${hasExact?"Visit exact product":"Browse seller"} ↗</a><p class="route-note">${esc(routeNote)}</p>${details}</article>`;
}
function jsonLd(p,canonical,title,image,groups){
  const offers=[];
  for(const g of groups) for(const o of trustedOffers(g)){
    offers.push({"@type":"Offer","price":Number(o.price),"priceCurrency":o.currency||"USD","url":o.url,"seller":{"@type":"Organization","name":g.seller}});
  }
  const ld={"@context":"https://schema.org","@type":"Product","name":title,"url":canonical};
  if(image) ld.image=[image];
  if(p.brand) ld.brand={"@type":"Brand","name":p.brand};
  if(offers.length===1) ld.offers=offers[0];
  else if(offers.length>1){
    const prices=offers.map(x=>x.price).filter(Number.isFinite);
    ld.offers={"@type":"AggregateOffer","offerCount":offers.length,"lowPrice":Math.min(...prices),"highPrice":Math.max(...prices),"priceCurrency":offers[0].priceCurrency,"offers":offers.slice(0,20)};
  }
  return JSON.stringify(ld).replace(/</g,"\\u003c");
}
function page404(msg){
  return {statusCode:404,headers:{"content-type":"text/html; charset=utf-8","cache-control":"public, max-age=60"},body:`<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex,follow"><title>Product not found | TrendPilot AI</title><main style="font-family:system-ui;padding:2rem"><h1>Product not found</h1><p>${esc(msg)}</p><a href="/find/">Back to search</a></main>`};
}

exports.handler=async function(event){
  let store; try{store=load()}catch{return {statusCode:500,headers:{"content-type":"text/plain; charset=utf-8"},body:"Product preview data could not be loaded."}}
  const q=event.queryStringParameters||{}; let slug=String(q.slug||"").replace(/^\/+|\/+$/g,"");
  if(!slug){const raw=String(event.rawUrl||event.path||"");const m=raw.match(/\/product\/([^?#/]+)/i);if(m)slug=decodeURIComponent(m[1])}
  let p=store.byRoute.get(slug.toLowerCase());
  if(!p){const idm=slug.match(/([a-z0-9]{12,})$/i);if(idm){const suffix=idm[1].toUpperCase();p=(store.data.products||[]).find(x=>String(x.tpid||"").toUpperCase().endsWith(suffix))}}
  if(!p) return page404(slug||"Unknown product");

  const canonical=`https://trendpilotchoice.com/product/${encodeURIComponent(p.route)}/`;
  const groups=activeGroups(p), sellers=groups.length, offers=groups.reduce((n,g)=>n+activeOffers(g).length,0);
  const titleClean=cleanTitle(p.title,p.brand), image=bestImage(p);
  const title=`${titleClean} | TrendPilot AI`;
  const desc=`Compare available seller options for ${titleClean}. Review configurations, key details, route evidence and current seller availability before buying.`;
  const heroImage=image?`<img src="${esc(image)}" alt="${esc(titleClean)}" loading="eager" decoding="async" width="420" height="420" referrerpolicy="no-referrer">`:`<div class="noimg"><img src="/images/logo-v4.svg" alt="" width="52" height="52"><span>Image unavailable</span></div>`;
  const robots=sellers?"index,follow,max-image-preview:large":"noindex,follow,max-image-preview:large";
  const sellerHeading=sellers>1?"Compare seller options":"Seller option";

  const body=`<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#ffffff"><meta name="color-scheme" content="light">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><meta name="robots" content="${robots}"><link rel="canonical" href="${esc(canonical)}">
<meta property="og:type" content="product"><meta property="og:site_name" content="TrendPilot AI"><meta property="og:title" content="${esc(titleClean)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${esc(canonical)}">${image?`<meta property="og:image" content="${esc(image)}">`:""}
<link rel="icon" href="/images/favicon-v4.svg" type="image/svg+xml"><script type="application/ld+json">${jsonLd(p,canonical,titleClean,image,groups)}</script>
<style>
:root{--ink:#101828;--muted:#667085;--blue:#3157e8;--line:#e1e6ef;--soft:#f4f8f6;--bg:#f7f6f1}
*{box-sizing:border-box}html{background:var(--bg)}body{margin:0;background:var(--bg);color:var(--ink);font-family:Inter,ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;padding-bottom:calc(108px + env(safe-area-inset-bottom,0px))}
header{position:sticky;top:0;z-index:30;background:rgba(255,255,255,.97);border-bottom:1px solid #e7ebe9;padding:14px 18px;display:flex;align-items:center;justify-content:space-between;backdrop-filter:blur(12px)}
.logo{display:flex;align-items:center;gap:10px;color:var(--ink);font-size:25px;font-weight:900;text-decoration:none;letter-spacing:-.035em}.logo img{width:42px;height:42px}.logo em{font-style:normal;color:#22b793}.search{border:1px solid var(--line);padding:10px 16px;border-radius:16px;color:var(--blue);font-weight:850;text-decoration:none}
main{max-width:940px;margin:auto;padding:24px 20px 120px}.back{display:inline-flex;align-items:center;gap:6px;color:var(--blue);font-weight:850;text-decoration:none;margin-bottom:18px}
.hero{display:grid;grid-template-columns:minmax(220px,300px) minmax(0,1fr);gap:30px;align-items:center;margin-bottom:24px}.hero-media{background:#fff;border:1px solid var(--line);border-radius:26px;display:grid;place-items:center;min-height:280px;padding:18px;overflow:hidden}.hero-media>img{display:block;width:100%;height:250px;object-fit:contain;object-position:center}.noimg{display:grid;place-items:center;gap:10px;color:#667085;text-align:center;font-weight:800}.noimg img{width:54px;height:54px}.brand{color:var(--blue);font-weight:900;font-size:18px}.hero h1{font-size:clamp(34px,5vw,54px);line-height:1.02;letter-spacing:-.045em;margin:7px 0 12px;overflow-wrap:normal;word-break:normal}.hero p{font-size:18px;line-height:1.4;color:var(--muted);margin:0}
.panel{background:#fff;border:1px solid var(--line);border-radius:24px;padding:24px;margin:18px 0}.eyebrow{color:var(--blue);font-weight:900;letter-spacing:.09em;font-size:12px}.panel h2{font-size:30px;letter-spacing:-.03em;margin:7px 0 10px}.muted,.about-copy{color:var(--muted);font-size:17px;line-height:1.55}.buyer-note{margin:18px 0 0;padding:14px 16px;border-radius:16px;background:#f7f9fc;color:#475467;line-height:1.5}
.specgrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px;margin-top:18px}.spec{background:#eaf7f1;padding:16px;border-radius:18px}.spec span{display:block;color:var(--muted);font-size:12px;font-weight:850;text-transform:uppercase;letter-spacing:.07em}.spec strong{display:block;font-size:22px;margin-top:4px}
.variants{display:grid;gap:10px;margin-top:16px}.variant{border:1px solid var(--line);border-radius:16px;padding:14px 16px;display:flex;align-items:center;justify-content:space-between;gap:16px}.variant strong{font-size:17px}.variant span{color:var(--muted)}
.seller-head{display:flex;align-items:center;justify-content:space-between;gap:14px}.pill{background:#e4faf2;border-radius:999px;padding:9px 13px;color:#08765a;font-weight:850;font-size:13px}.sellers{display:grid;gap:12px;margin-top:16px}.seller-card{border:1px solid var(--line);border-radius:19px;padding:17px}.seller-top{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.seller-card h3{font-size:22px;margin:0}.seller-card p{color:var(--muted);margin:4px 0 0}.seller-price{font-size:20px;text-align:right}.cta{display:inline-flex;align-items:center;justify-content:center;background:var(--blue);color:#fff;text-decoration:none;font-weight:850;padding:13px 18px;border-radius:14px;margin-top:14px}.route-note{font-size:13px;line-height:1.4!important;margin-top:10px!important}
details{margin-top:12px}summary{cursor:pointer;color:var(--blue);font-weight:800}.suboffers{display:grid;gap:7px;margin-top:9px}.suboffer{display:flex;justify-content:space-between;gap:12px;text-decoration:none;color:var(--ink);background:#f7f9f8;border:1px solid #e8edeb;border-radius:13px;padding:11px 12px}.tech{color:var(--muted);font-size:12px;margin:24px 0}
.bottom{position:fixed;left:14px;right:14px;bottom:max(8px,env(safe-area-inset-bottom,0px));z-index:40;max-width:850px;margin:auto;background:rgba(255,255,255,.97);border:1px solid var(--line);border-radius:22px;padding:8px;display:flex;justify-content:space-around;box-shadow:0 8px 30px rgba(0,0,0,.08);backdrop-filter:blur(14px)}.bottom a{min-height:52px;display:flex;align-items:center;justify-content:center;text-decoration:none;color:#475467;font-weight:850;font-size:14px;padding:0 10px;border-radius:15px}.bottom a.active{color:var(--blue);background:#eef3ff}
@media(max-width:650px){header{padding:12px 15px}.logo{font-size:21px}.logo img{width:38px;height:38px}.search{padding:9px 13px}main{padding:18px 15px 112px}.hero{grid-template-columns:1fr;gap:16px}.hero-media{width:min(230px,72vw);min-height:220px;margin:auto;padding:13px;border-radius:22px}.hero-media>img{height:194px}.hero-copy{text-align:left}.brand{font-size:16px}.hero h1{font-size:clamp(29px,8vw,37px);line-height:1.04;margin-top:5px;letter-spacing:-.035em}.hero p{font-size:15px}.panel{padding:18px;border-radius:21px;margin:14px 0}.panel h2{font-size:25px}.muted,.about-copy{font-size:15px}.specgrid{grid-template-columns:1fr 1fr}.spec strong{font-size:19px}.variant{align-items:flex-start;flex-direction:column;gap:4px}.seller-head{align-items:flex-start}.seller-top{flex-direction:column}.seller-price{text-align:left}.cta{width:100%}.bottom{left:10px;right:10px}.bottom a{font-size:13px;padding:0 7px}.suboffer{font-size:13px}}
@media(max-width:380px){.specgrid{grid-template-columns:1fr}.hero h1{font-size:29px}.bottom a{font-size:12px}}
</style></head>
<body><header><a class="logo" href="/"><img src="/images/logo-v4.svg" alt=""><span>TrendPilot <em>AI</em></span></a><a class="search" href="/find/">Search</a></header>
<main><a class="back" href="/find/">← Back to results</a>
<section class="hero"><div class="hero-media">${heroImage}</div><div class="hero-copy"><div class="brand">${esc(p.brand||"TrendPilot")}</div><h1>${esc(titleClean)}</h1><p>${offers} active listing${offers===1?"":"s"} from ${sellers} seller${sellers===1?"":"s"} · ${p.variantCount||0} configuration${p.variantCount===1?"":"s"}</p></div></section>
${specsHtml(p)}
${aboutHtml(p)}
${variantsHtml(p)}
<section class="panel" id="seller-offers"><div class="seller-head"><div><div class="eyebrow">SELLER OFFERS</div><h2>${sellerHeading}</h2></div><span class="pill">${sellers} seller${sellers===1?"":"s"}</span></div><div class="sellers">${groups.length?groups.map(sellerHtml).join(""):'<div class="buyer-note">No currently verified seller route is available. Search again for alternative products.</div>'}</div></section>
<details class="tech"><summary>Technical identity details</summary><p>TPID ${esc(p.tpid)}. Seller listings remain separate TrendPilot offer identities.</p></details></main>
<nav class="bottom"><a href="/">Home</a><a class="active" href="/find/">Search</a><a href="/deals/">Deals</a><a href="/compare/">Compare</a></nav>
</body></html>`;
  return {statusCode:200,headers:{"content-type":"text/html; charset=utf-8","cache-control":"public, max-age=120, s-maxage=300","x-trendpilot-preview":VERSION},body};
};