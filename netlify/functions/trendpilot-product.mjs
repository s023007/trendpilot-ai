import { loadProductData } from './trendpilot-product-data.mjs';

const SITE = 'https://trendpilotchoice.com';
const ENGINE = 'v2064';
const BLOCKED = /^(?:Temu|Joom|FilamentPRO(?: EU CPS)?)$/i;
const clean = v => String(v ?? '').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
const uniq = a => [...new Set(a.filter(Boolean))];
const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const js = v => JSON.stringify(v).replace(/</g,'\\u003c');
const validHttp = v => { try { const u = new URL(clean(v)); return /^https?:$/.test(u.protocol); } catch { return false; } };
const usd = n => Number.isFinite(n) ? `$${Number(n).toLocaleString('en-US',{minimumFractionDigits:Number(n)%1?2:0,maximumFractionDigits:2})}` : 'Check current price';
const plural = (n,one,many) => `${n} ${n===1?one:many}`;
const norm = v => clean(v).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();

function routeFromEvent(event) {
  const q = event?.queryStringParameters || {};
  if (q.slug) return decodeURIComponent(clean(q.slug).replace(/^\/+|\/+$/g,''));
  for (const candidate of [event?.path,event?.rawPath,event?.rawUrl]) {
    const raw = clean(candidate);
    const m = raw.match(/\/product\/([^/?#]+)/i);
    if (m) return decodeURIComponent(m[1]);
  }
  return '';
}

const reliablePrice = o => Boolean(o?.priceReliable !== false && Number.isFinite(o?.price) && o.price > 0 && String(o.currency || 'USD').toUpperCase() === 'USD');

function sellerGroups(rows) {
  const map = new Map();
  for (const o of rows) {
    if (!o?.seller || BLOCKED.test(clean(o.seller)) || !validHttp(o.url)) continue;
    if (!map.has(o.seller)) map.set(o.seller,[]);
    map.get(o.seller).push(o);
  }
  return [...map.entries()].map(([seller,items])=>{
    const prices = items.filter(reliablePrice).map(o=>o.price);
    return {
      seller,items,
      min:prices.length?Math.min(...prices):null,
      max:prices.length?Math.max(...prices):null,
      cpcCapable:items.some(o=>o.cpcCapable),
      cpcConfirmed:items.some(o=>o.cpcConfirmed)
    };
  }).sort((a,b)=>(a.min??Infinity)-(b.min??Infinity)||a.seller.localeCompare(b.seller));
}

function priceRange(rows) {
  const prices = rows.filter(reliablePrice).map(o=>o.price);
  if (!prices.length) return 'Check current seller pricing';
  const lo=Math.min(...prices), hi=Math.max(...prices);
  return lo===hi?`Current listed price ${usd(lo)}`:`Current listed range ${usd(lo)} – ${usd(hi)}`;
}

function extractSpecs(text) {
  const s=clean(text);
  const out=[];
  const ram=s.match(/\b(\d{1,2})\s*GB\s*RAM\b/i);
  const gbTokens=[...s.matchAll(/\b(\d{1,4})\s*GB\b/gi)].map(m=>Number(m[1])).filter(Number.isFinite);
  const inferredRam=!ram&&gbTokens.length>=2?Math.min(...gbTokens.filter(n=>n<=32)):null;
  if(ram)out.push({label:'Memory',value:`${ram[1]}GB RAM`});
  else if(Number.isFinite(inferredRam))out.push({label:'Memory',value:`${inferredRam}GB RAM`});

  const storage=[];
  for(const n of gbTokens)if(n>=32)storage.push(n);
  for(const m of s.matchAll(/\b(\d+(?:\.\d+)?)\s*TB\b(?!\s*RAM)/gi)){storage.push(Number(m[1])*1024)}
  if(storage.length){const n=Math.max(...storage);out.push({label:'Storage',value:n>=1024&&n%1024===0?`${n/1024}TB`:`${n}GB`})}

  const screen=s.match(/\b(\d{1,2}(?:\.\d{1,2})?)\s*(?:inch(?:es)?|in\b|\")/i);
  if(screen)out.push({label:'Screen',value:`${screen[1]} in`});
  const battery=s.match(/\b(\d{3,6})\s*mAh\b/i);
  if(battery)out.push({label:'Capacity',value:`${battery[1]}mAh`});
  const cooling=s.match(/\b(\d{4,6})\s*BTU\b/i);
  if(cooling)out.push({label:'Cooling',value:`${cooling[1]} BTU`});
  const volume=s.match(/\b(\d+(?:\.\d+)?)\s*(ml|oz)\b/i);
  if(volume)out.push({label:'Volume',value:`${volume[1]} ${volume[2].toLowerCase()}`});
  return out;
}

function presentationVariants(p,rows,vars) {
  const allSellers=uniq(rows.map(o=>o.seller));
  const byVid=new Map();
  for(const o of rows){const id=clean(o.tpvid)||'UNSPECIFIED';if(!byVid.has(id))byVid.set(id,[]);byVid.get(id).push(o)}
  const variantMap=new Map(vars.map(v=>[clean(v.tpvid),v]));
  const result=[];
  for(const [tpvid,items] of byVid){
    const source=variantMap.get(tpvid)||{};
    const evidence=[source.label,source.name,p.name,...items.slice(0,5).map(x=>x.name)].filter(Boolean).join(' ');
    const specs=extractSpecs(evidence);
    let label=clean(source.label);
    const generic=!label || /^variant\s*\d+$/i.test(label) || /^TPV-[A-Z0-9]+$/i.test(label) || /^\d+$/i.test(label);
    if(specs.length) label=specs.map(x=>`${x.label==='Screen'?'Screen ':''}${x.value}`).join(' · ');
    else if(generic) label='Seller configuration';
    else {
      const screenOnly=label.match(/^(\d{1,2}(?:\.\d+)?)\s*inches?$/i);
      if(screenOnly) label=`Screen ${screenOnly[1]} in`;
    }
    const sellers=uniq(items.map(o=>o.seller));
    result.push({tpvid,label,sellers,offerCount:items.length,sellerCount:sellers.length,specs});
  }

  // A screen-only group that simply repeats the full TPID seller coverage is not useful as a shopper variant.
  const useful=result.filter(v=>{
    if(result.length<=1)return true;
    if(/^Screen\s+\d/i.test(v.label) && v.sellerCount===allSellers.length && v.offerCount===rows.length)return false;
    return true;
  });
  const genericCount=useful.filter(v=>v.label==='Seller configuration').length;
  let genericIndex=0;
  for(const v of useful)if(v.label==='Seller configuration'&&genericCount>1)v.label=`Seller configuration ${++genericIndex}`;
  return useful.sort((a,b)=>b.sellerCount-a.sellerCount||b.offerCount-a.offerCount||a.label.localeCompare(b.label));
}

function factRows(p,rows,variants) {
  const source=[];
  if(Array.isArray(p.facts)) for(const f of p.facts){const value=Array.isArray(f.values)?f.values.join(' · '):clean(f.value);if(f.label&&value)source.push({label:clean(f.label),value:clean(value)})}
  const inferred=extractSpecs([p.name,...rows.slice(0,8).map(o=>o.name)].join(' '));
  const merged=[]; const seen=new Set();
  for(const f of [...source,...inferred]){const key=norm(f.label+' '+f.value);if(!key||seen.has(key))continue;seen.add(key);merged.push(f)}
  merged.push({label:'Seller availability',value:plural(uniq(rows.map(o=>o.seller)).length,'seller','sellers')});
  merged.push({label:'Seller offers',value:plural(rows.length,'offer','offers')});
  merged.push({label:'Configurations',value:plural(variants.length,'configuration','configurations')});
  return merged.slice(0,8);
}

function schema(p,rows) {
  const priced=rows.filter(reliablePrice);
  const offers=priced.slice(0,20).map(o=>({
    '@type':'Offer',priceCurrency:'USD',price:String(o.price),availability:'https://schema.org/InStock',
    url:`${SITE}/.netlify/functions/trendpilot-outbound?offer=${encodeURIComponent(o.tpoid)}&src=product_schema`,
    seller:{'@type':'Organization',name:o.seller}
  }));
  const obj={
    '@context':'https://schema.org','@type':'Product',name:p.name,sku:p.tpid,
    url:`${SITE}/product/${encodeURIComponent(p.route)}/`,
    description:`Compare seller offers, configurations and current listed pricing for ${p.name} on TrendPilot.`,
    ...(p.image?{image:[p.image]}:{}),
    ...(p.brand?{brand:{'@type':'Brand',name:p.brand}}:{})
  };
  if(offers.length){const prices=priced.map(o=>o.price);obj.offers={'@type':'AggregateOffer',priceCurrency:'USD',lowPrice:String(Math.min(...prices)),highPrice:String(Math.max(...prices)),offerCount:offers.length,offers}}
  return obj;
}

function notFound() {
  return {statusCode:404,headers:{'content-type':'text/html; charset=utf-8','cache-control':'public, max-age=60','x-robots-tag':'noindex'},body:'<!doctype html><html><head><meta name="robots" content="noindex"><title>Product not found — TrendPilot</title></head><body><main><h1>Product not found</h1><p><a href="/find/">Back to TrendPilot search</a></p></main></body></html>'};
}

function unavailable(err) {
  const message=esc(err?.message||'Product Preview is temporarily unavailable.');
  return {statusCode:503,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-robots-tag':'noindex'},body:`<!doctype html><html><head><meta name="robots" content="noindex"><title>Product Preview temporarily unavailable — TrendPilot</title></head><body><main style="max-width:760px;margin:80px auto;padding:24px;font-family:system-ui"><h1>Product Preview is temporarily unavailable.</h1><p>${message}</p><p><a href="/find/?engine=${ENGINE}">Return to product search</a></p></main></body></html>`};
}

export const handler = async event => {
  try {
    const {products,offers,variants} = loadProductData();
    const route=routeFromEvent(event);
    const p=products.find(x=>x.route===route || x.tpid===route);
    if(!p)return notFound();

    const rows=offers.filter(o=>o.tpid===p.tpid && o.seller && !BLOCKED.test(clean(o.seller)) && validHttp(o.url));
    if(!rows.length)return notFound();
    const vars=presentationVariants(p,rows,variants.filter(v=>v.tpid===p.tpid));
    const groups=sellerGroups(rows);
    const sellerCount=groups.length;
    const offerCount=rows.length;
    const canonical=`${SITE}/product/${encodeURIComponent(p.route)}/`;
    const title=`${p.name} — Seller Offers & Product Preview | TrendPilot`;
    const desc=`Preview ${p.name}. See ${plural(offerCount,'seller offer','seller offers')} from ${plural(sellerCount,'seller','sellers')}, current listed pricing, configurations and product details before visiting a seller.`;
    const compareHref=`/find/?engine=${ENGINE}&q=${encodeURIComponent(p.name)}&tpid=${encodeURIComponent(p.tpid)}&compare=1`;
    const facts=factRows(p,rows,vars);
    const related=products.filter(x=>x.tpid!==p.tpid && x.type===p.type && x.route && x.name).slice(0,4);
    const range=priceRange(rows);

    const variantHtml=vars.length?vars.slice(0,12).map(v=>`<article class="tpp82-config"><div><strong>${esc(v.label)}</strong><span>${plural(v.offerCount,'offer','offers')} · ${plural(v.sellerCount,'seller','sellers')}</span></div>${v.specs?.length?`<div class="tpp82-specchips">${v.specs.map(s=>`<span>${esc(s.label)}: ${esc(s.value)}</span>`).join('')}</div>`:''}</article>`).join(''):'<p class="tpp82-muted">No separate configuration evidence is available for this product.</p>';

    const sellersHtml=groups.map(g=>{
      const first=g.items[0];
      const price=g.min==null?'Check current price':g.min===g.max?usd(g.min):`${usd(g.min)} – ${usd(g.max)}`;
      const tracking=g.cpcConfirmed?'CPC tracked offer':g.cpcCapable?'Affiliate/CPC-capable route':'Affiliate seller route';
      const extra=g.items.length>1?`<details class="tpp82-offerlist"><summary>See ${g.items.length} offers from ${esc(g.seller)}</summary>${g.items.map((o,i)=>`<a rel="nofollow sponsored" href="/.netlify/functions/trendpilot-outbound?offer=${encodeURIComponent(o.tpoid)}&src=product_preview_offer_${i+1}"><span>Offer ${i+1}</span><strong>${reliablePrice(o)?esc(usd(o.price)):'Check price'}</strong></a>`).join('')}</details>`:'';
      return `<article class="tpp82-seller"><div class="tpp82-seller-top"><div><strong>${esc(g.seller)}</strong><span>${plural(g.items.length,'offer','offers')} · ${esc(tracking)}</span></div><b>${esc(price)}</b></div><a class="tpp82-primary" rel="nofollow sponsored" href="/.netlify/functions/trendpilot-outbound?offer=${encodeURIComponent(first.tpoid)}&src=product_preview_seller">Visit seller ↗</a>${extra}</article>`;
    }).join('');

    const relatedHtml=related.length?`<section class="tpp82-section"><div class="tpp82-section-head"><div><span class="tpp82-kicker">Related alternatives</span><h2>Other ${esc(String(p.type||'product').replaceAll('_',' '))} choices</h2></div><p>These are alternatives, not the same TPID.</p></div><div class="tpp82-related">${related.map(x=>`<a href="/product/${encodeURIComponent(x.route)}/">${x.image?`<img src="${esc(x.image)}" alt="" loading="lazy">`:''}<span><b>${esc(x.brand||'TrendPilot')}</b><strong>${esc(x.name)}</strong></span></a>`).join('')}</div></section>`:'';

    const factHtml=facts.map(f=>`<div class="tpp82-fact"><span>${esc(f.label)}</span><strong>${esc(f.value)}</strong></div>`).join('');
    const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#f7f5ef"><meta name="robots" content="index,follow,max-image-preview:large"><title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><link rel="canonical" href="${esc(canonical)}"><meta property="og:type" content="product"><meta property="og:site_name" content="TrendPilot AI"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${esc(canonical)}">${p.image?`<meta property="og:image" content="${esc(p.image)}"><meta name="twitter:card" content="summary_large_image">`:'<meta name="twitter:card" content="summary">'}<link rel="icon" href="/images/favicon-v4.svg" type="image/svg+xml"><link rel="stylesheet" href="/css/product-preview-v20-6-8-2.css?v=20.6.8.2"><script type="application/ld+json">${js(schema(p,rows))}</script></head><body data-tp-product-preview="20.6.8.2" data-tpid="${esc(p.tpid)}"><header class="tpp82-header"><a href="/" class="tpp82-brand"><img src="/images/logo-v4.svg" alt="" width="48" height="48"><span>TrendPilot <em>AI</em></span></a><a class="tpp82-search" href="/find/?engine=${ENGINE}">Search products</a></header><main class="tpp82-shell"><a class="tpp82-back" href="/find/?engine=${ENGINE}&q=${encodeURIComponent(p.name)}">← Back to results</a><section class="tpp82-hero"><div class="tpp82-image">${p.image?`<img src="${esc(p.image)}" alt="${esc(p.name)}">`:'<span>TP</span>'}</div><div class="tpp82-hero-copy"><span class="tpp82-kicker">${esc(p.brand||'TrendPilot product')}</span><h1 title="${esc(p.name)}">${esc(p.name)}</h1><p class="tpp82-counts">${plural(offerCount,'offer','offers')} from ${plural(sellerCount,'seller','sellers')} · ${plural(vars.length,'configuration','configurations')}</p><p class="tpp82-price">${esc(range)}</p><div class="tpp82-actions"><a class="tpp82-primary" href="${compareHref}">${sellerCount>1?`Compare ${sellerCount} sellers`:'View seller comparison details'}</a><a class="tpp82-secondary" href="#seller-offers">See seller offers</a></div></div></section><section class="tpp82-section"><div class="tpp82-section-head"><div><span class="tpp82-kicker">Product preview</span><h2>Important details at a glance</h2></div><p>TrendPilot keeps seller listings separate and does not merge different product identities.</p></div><div class="tpp82-facts">${factHtml}</div></section><section class="tpp82-section"><div class="tpp82-section-head"><div><span class="tpp82-kicker">Configurations</span><h2>Variants and configurations</h2></div><p>Configuration labels are shopper-friendly presentation only; TPVID identity remains unchanged.</p></div><div class="tpp82-configs">${variantHtml}</div></section><section class="tpp82-section" id="seller-offers"><div class="tpp82-section-head"><div><span class="tpp82-kicker">Seller offers</span><h2>${plural(offerCount,'offer','offers')} from ${plural(sellerCount,'seller','sellers')}</h2></div><p>Seller buttons use the committed affiliate/tracking destination for that exact TPOID.</p></div><div class="tpp82-sellers">${sellersHtml}</div></section>${relatedHtml}<details class="tpp82-tech"><summary>Technical identity details</summary><dl><div><dt>TPID</dt><dd>${esc(p.tpid)}</dd></div><div><dt>Product type</dt><dd>${esc(p.type||'Not stated')}</dd></div><div><dt>Seller offers</dt><dd>${offerCount}</dd></div><div><dt>Detected TPVID groups</dt><dd>${vars.length}</dd></div></dl></details></main><nav class="tpp82-bottom" aria-label="Quick navigation"><a href="/">Home</a><a class="active" href="/find/?engine=${ENGINE}">Search</a><a href="/deals/">Deals</a><a href="/compare/">Compare</a></nav><script src="/js/product-preview-events-v20-6-8-2.js?v=20.6.8.2" defer></script></body></html>`;

    return {statusCode:200,headers:{'content-type':'text/html; charset=utf-8','cache-control':'public, max-age=300, s-maxage=1800','x-content-type-options':'nosniff'},body:html};
  } catch (err) {
    console.error('trendpilot-product',err);
    return unavailable(err);
  }
};
