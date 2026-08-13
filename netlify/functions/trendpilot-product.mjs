import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR=path.dirname(fileURLToPath(import.meta.url));
const products=JSON.parse(fs.readFileSync(path.join(DIR,'_product-data','products.json'),'utf8'));
const offers=JSON.parse(fs.readFileSync(path.join(DIR,'_product-data','offers.json'),'utf8'));
const variants=JSON.parse(fs.readFileSync(path.join(DIR,'_product-data','variants.json'),'utf8'));
const byRoute=new Map(products.map(p=>[p.route,p]));
const byTpid=new Map(products.map(p=>[p.tpid,p]));
const offersByTpid=new Map(); for(const o of offers){if(!offersByTpid.has(o.tpid))offersByTpid.set(o.tpid,[]);offersByTpid.get(o.tpid).push(o)}
const variantsByTpid=new Map(); for(const v of variants){if(!variantsByTpid.has(v.tpid))variantsByTpid.set(v.tpid,[]);variantsByTpid.get(v.tpid).push(v)}
const SITE='https://trendpilotchoice.com';
const esc=(v)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const js=(v)=>JSON.stringify(v).replace(/</g,'\\u003c');
const money=(v)=>Number.isFinite(v)?`$${Number(v).toLocaleString('en-US',{minimumFractionDigits:Number(v)%1?2:0,maximumFractionDigits:2})}`:'Check current price';
const uniq=(a)=>[...new Set(a.filter(Boolean))];
function routeFromEvent(event){
  const q=event?.queryStringParameters||{};
  if(q.slug) return decodeURIComponent(String(q.slug).replace(/^\/+|\/+$/g,''));
  const raw=String(event?.path||'');
  const m=raw.match(/\/product\/([^/?#]+)/i); return m?decodeURIComponent(m[1]):'';
}
const knownPrice=(o)=>Number.isFinite(o.price)&&o.price>0&&o.currency==='USD';
function groupedSellers(rows){
  const map=new Map();
  for(const o of rows){if(!map.has(o.seller))map.set(o.seller,[]);map.get(o.seller).push(o)}
  return [...map.entries()].map(([seller,items])=>{
    const prices=items.filter(knownPrice).map(o=>o.price);
    return {seller,items,min:prices.length?Math.min(...prices):null,max:prices.length?Math.max(...prices):null,cpcCapable:items.some(o=>o.cpcCapable)};
  }).sort((a,b)=>(a.min??Infinity)-(b.min??Infinity)||a.seller.localeCompare(b.seller));
}
function jsonLd(p,rows){
  const priced=rows.filter(knownPrice);
  const base={
    '@context':'https://schema.org','@type':'Product',name:p.name,sku:p.tpid,url:`${SITE}/product/${encodeURIComponent(p.route)}/`,
    ...(p.image?{image:[p.image]}:{}),...(p.brand?{brand:{'@type':'Brand',name:p.brand}}:{}),
    description:`Compare current seller offers and variants for ${p.name} on TrendPilot.`
  };
  if(priced.length){
    const lows=Math.min(...priced.map(o=>o.price)), highs=Math.max(...priced.map(o=>o.price));
    base.offers={
      '@type':'AggregateOffer',priceCurrency:'USD',lowPrice:String(lows),highPrice:String(highs),offerCount:priced.length,
      offers:priced.slice(0,12).map(o=>({'@type':'Offer',priceCurrency:'USD',price:String(o.price),url:`${SITE}/.netlify/functions/trendpilot-outbound?offer=${encodeURIComponent(o.tpoid)}&src=product_schema`,seller:{'@type':'Organization',name:o.seller}}))
    };
  }
  return base;
}
function page404(){return {statusCode:404,headers:{'content-type':'text/html; charset=utf-8','cache-control':'public, max-age=60'},body:'<!doctype html><meta name="robots" content="noindex"><title>Product not found — TrendPilot</title><h1>Product not found</h1><p><a href="/find/">Back to search</a></p>'}}
export const handler=async(event)=>{
  const route=routeFromEvent(event); const p=byRoute.get(route)||byTpid.get(route); if(!p)return page404();
  const rows=offersByTpid.get(p.tpid)||[]; const vars=variantsByTpid.get(p.tpid)||[]; const groups=groupedSellers(rows);
  const canonical=`${SITE}/product/${encodeURIComponent(p.route)}/`;
  const title=`${p.name} — Prices, Variants & Seller Offers | TrendPilot`;
  const desc=`Preview ${p.name}, see ${p.sellerCount} seller${p.sellerCount===1?'':'s'}, ${p.variantCount} variant${p.variantCount===1?'':'s'}, and compare current seller offers on TrendPilot.`;
  const compare=`/find/?engine=v2064&q=${encodeURIComponent(p.name)}`;
  const priceLine=Number.isFinite(p.priceMin)?(p.priceMax&&p.priceMax!==p.priceMin?`Listed from ${money(p.priceMin)} to ${money(p.priceMax)}`:`Listed from ${money(p.priceMin)}`):'Check current seller pricing';
  const facts=(p.facts||[]).map(f=>`<div class="fact"><span>${esc(f.label)}</span><strong>${esc((f.values||[]).join(' · '))}</strong></div>`).join('');
  const variantCards=vars.slice(0,18).map(v=>{
    const count=uniq(rows.filter(o=>!v.tpvid||o.tpvid===v.tpvid).map(o=>o.seller)).length;
    return `<a class="variant" href="${compare}&tpvid=${encodeURIComponent(v.tpvid)}"><strong>${esc(v.label||'Detected variant')}</strong><span>${count||1} seller${count===1?'':'s'}</span></a>`;
  }).join('');
  const sellerCards=groups.map(g=>{
    const first=g.items.find(knownPrice)||g.items[0];
    const cta=`/.netlify/functions/trendpilot-outbound?offer=${encodeURIComponent(first.tpoid)}&src=product_preview`;
    const range=Number.isFinite(g.min)?(g.max&&g.max!==g.min?`${money(g.min)}–${money(g.max)}`:money(g.min)):'Check current price';
    return `<article class="seller-card"><div><h3>${esc(g.seller)}</h3><p>${g.items.length} offer${g.items.length===1?'':'s'} · ${esc(range)}</p></div><a class="seller-cta" rel="sponsored nofollow noopener" href="${cta}">View seller offer ↗</a></article>`;
  }).join('');
  const related=products.filter(x=>x.tpid!==p.tpid&&x.type&&x.type===p.type&&x.image).sort((a,b)=>Math.abs((a.priceMin??999999)-(p.priceMin??999999))-Math.abs((b.priceMin??999999)-(p.priceMin??999999))).slice(0,4);
  const relatedCards=related.map(r=>`<a class="related-card" href="/product/${encodeURIComponent(r.route)}/"><img src="${esc(r.image)}" alt="${esc(r.name)}" loading="lazy"><span><strong>${esc(r.name)}</strong><small>${r.sellerCount} seller${r.sellerCount===1?'':'s'}${Number.isFinite(r.priceMin)?` · from ${money(r.priceMin)}`:''}</small></span></a>`).join('');
  const firstOffer=groups[0]?.items?.[0]||null;
  const heroActions=p.sellerCount>1
    ? `<a class="primary" href="${compare}">Compare ${p.sellerCount} sellers</a>${firstOffer?`<a class="secondary" rel="sponsored nofollow noopener" href="/.netlify/functions/trendpilot-outbound?offer=${encodeURIComponent(firstOffer.tpoid)}&src=product_hero">View seller offer ↗</a>`:''}`
    : firstOffer
      ? `<a class="primary" rel="sponsored nofollow noopener" href="/.netlify/functions/trendpilot-outbound?offer=${encodeURIComponent(firstOffer.tpoid)}&src=product_hero">View seller offer ↗</a><a class="secondary" href="${compare}">View comparison details</a>`
      : `<a class="primary" href="${compare}">View comparison details</a>`;
  const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><link rel="canonical" href="${esc(canonical)}"><meta name="robots" content="${p.seoIndexable?'index,follow,max-image-preview:large':'noindex,follow'}"><meta property="og:type" content="product"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${esc(canonical)}">${p.image?`<meta property="og:image" content="${esc(p.image)}">`:''}<meta name="twitter:card" content="summary_large_image"><link rel="stylesheet" href="/css/product-preview-v20-6-8.css?v=20.6.8"><script type="application/ld+json">${js(jsonLd(p,rows))}</script></head><body><header class="tp-header"><a href="/" class="logo"><span class="mark">↗</span><b>TrendPilot <em>AI</em></b></a><a class="search-link" href="${compare}">Search</a></header><main><a class="back" href="${compare}">← Back to comparison results</a><section class="hero"><div class="image-shell">${p.image?`<img src="${esc(p.image)}" alt="${esc(p.name)}" fetchpriority="high">`:'<div class="no-image">TP</div>'}</div><div class="hero-copy">${p.brand?`<div class="brand">${esc(p.brand)}</div>`:''}<h1>${esc(p.name)}</h1><p class="sub">${p.sellerCount} seller${p.sellerCount===1?'':'s'} · ${p.variantCount||1} variant${p.variantCount===1?'':'s'}</p><div class="price">${esc(priceLine)}</div><div class="hero-actions">${heroActions}</div></div></section>${facts?`<section class="panel"><div class="section-head"><h2>Product overview</h2><p>Important details detected from the existing TrendPilot product and variant records.</p></div><div class="facts">${facts}</div></section>`:''}${variantCards?`<section class="panel"><div class="section-head"><h2>Variants</h2><p>Variants remain separate TPVIDs. Selecting one returns to exact comparison for that variant.</p></div><div class="variants">${variantCards}</div></section>`:''}<section class="panel"><div class="section-head"><h2>Seller offers</h2><p>${groups.length>1?'Compare sellers for this product.':'One current actionable seller is available for this product.'}</p></div><div class="seller-list">${sellerCards||'<p>No current actionable seller offer.</p>'}</div></section>${relatedCards?`<section class="panel"><div class="section-head"><h2>Related alternatives</h2><p>Separate products of the same type — never merged with this TPID.</p></div><div class="related">${relatedCards}</div></section>`:''}<section class="trust"><h2>How TrendPilot handles this product</h2><p>TrendPilot keeps seller listings and variants separate. Some seller links are affiliate links. Price and availability can change at the seller.</p><details><summary>Technical identity</summary><code>${esc(p.tpid)}</code></details><p><a href="/affiliate-disclosure.html">Affiliate disclosure</a></p></section></main><script src="/js/product-preview-events-v20-6-8.js?v=20.6.8" defer></script></body></html>`;
  return {statusCode:200,headers:{'content-type':'text/html; charset=utf-8','cache-control':'public, max-age=300, s-maxage=1800','x-robots-tag':p.seoIndexable?'index, follow':'noindex, follow'},body:html};
};
