(() => {
  "use strict";
  const V="20.9.5",d=document,$=s=>d.querySelector(s),C=v=>String(v??"").replace(/\s+/g," ").trim(),E=v=>C(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const key="tp-v209-compare";
  const PHONE_BAD=/\b(?:repair(?:ing)?|fixing|holding)\b[^,;]{0,90}\b(?:tool|clamp|fixture|jig|station|machine)\b|\b(?:tool|clamp|fixture|jig|station|machine)\b[^,;]{0,110}\b(?:repair(?:ing)?|fixing|holding)\b|\b(?:motherboard|cpu\s+chip|ic\s+chip|screen\s+separator|heating\s+station|opening\s+tool)\b[^,;]{0,100}\b(?:phone|mobile\s+phone|smartphone)\b/i;
  const roleLabel=v=>({main:"Main product",accessory:"Accessory",replacement_part:"Replacement part",used:"Used / refurbished"}[C(v)]||C(v||"Product").replaceAll("_"," "));
  const familyLabel=v=>C(v||"Product").replaceAll("-"," ").replace(/\b\w/g,m=>m.toUpperCase());
  const money=r=>`${r.cu==="USD"?"US$":C(r.cu||"USD")+" "}${Number(r.p).toLocaleString(undefined,{maximumFractionDigits:2})}`;
  const semanticOK=r=>{const family=C(r?.fa||r?.ty).toLowerCase(),role=C(r?.ro||"main").toLowerCase(),title=C(r?.t);return !(family==="phone"&&role==="main"&&PHONE_BAD.test(title))};
  function read(){try{const x=JSON.parse(localStorage.getItem(key)||"[]");return Array.isArray(x)?x.slice(0,3):[]}catch{return[]}}
  function write(items){try{localStorage.setItem(key,JSON.stringify(items.slice(0,3)))}catch{};document.querySelectorAll('[data-compare-count]').forEach(el=>{el.textContent=String(items.length);el.toggleAttribute('hidden',!items.length)})}
  async function record(id){if(!/^[a-f0-9]{14}$/.test(id))return null;try{const r=await fetch(`/data/v20-9/products/${id.slice(0,2)}.json?v=${V}`,{cache:"force-cache"});if(!r.ok)return null;return(await r.json())?.[id]||null}catch{return null}}
  const priceProof=r=>!r.p?"Confirm with seller":r.x?"Exact-product price":"Seller-feed price";
  function productCard(r){const detail=`/item/?id=${encodeURIComponent(r.id)}`;const seller=r.u?`<a class="tp90-primary" href="${E(r.u)}" target="_blank" rel="sponsored nofollow noopener">${r.x?"Open exact seller product":"Open seller route"} ↗</a>`:`<a class="tp90-primary" href="${E(detail)}">View details</a>`;const ids=(r.ids||[]).filter(Boolean).slice(0,3).join(" · ")||"No strong identifier stored";return `<article class="tp90-product"><a class="tp90-media" href="${E(detail)}">${r.im?`<img src="${E(r.im)}" alt="${E(r.t)}" width="500" height="500" loading="lazy">`:"<span>No image</span>"}</a><div class="tp90-copy"><div class="tp90-type"><span>${E(r.tyl||r.ty)}</span><span>${E(r.se)}</span></div><h2><a href="${E(detail)}">${E(r.t)}</a></h2><p class="tp90-price">${r.p?E(money(r)):"Check current price"}</p><span class="tp90-proof">${E(priceProof(r))}</span><div class="tp90-facts"><div class="tp90-fact"><b>Family</b><span>${E(familyLabel(r.fa||r.ty))}</span></div><div class="tp90-fact"><b>Role</b><span>${E(roleLabel(r.ro))}</span></div><div class="tp90-fact"><b>Condition</b><span>${E(r.co||"Check seller")}</span></div><div class="tp90-fact"><b>Identifiers</b><span>${E(ids)}</span></div><div class="tp90-fact"><b>Destination</b><span>${r.x?"Confirmed exact product":"Broader seller route"}</span></div></div><div class="tp90-actions">${seller}<button class="tp90-secondary" type="button" data-v209-remove="${E(r.id)}">Remove</button></div></div></article>`}
  function remove(id){const items=read().filter(x=>(typeof x==="string"?x:x.id)!==id);write(items);boot()}
  async function boot(){
    const host=$("[data-v209-compare-root]");if(!host)return;
    const saved=read();write(saved);
    if(!saved.length){host.innerHTML='<section class="tp90-empty"><h2>Your comparison is empty.</h2><p>Add products from search or a product detail page. TrendPilot will keep comparisons inside the same product family.</p><a href="/find/">Find products</a></section>';$("[data-v209-compare-count]").textContent="0 products";return}
    host.innerHTML='<section class="tp90-empty"><h2>Loading comparison…</h2></section>';
    const loaded=(await Promise.all(saved.map(x=>record(typeof x==="string"?x:x.id)))).filter(Boolean),rejected=loaded.filter(r=>!semanticOK(r)),records=loaded.filter(semanticOK);
    if(rejected.length){const keep=new Set(records.map(r=>r.id));write(saved.filter(x=>keep.has(typeof x==="string"?x:x.id)))}
    if(!records.length){write([]);host.innerHTML='<section class="tp90-empty"><h2>No valid products remain in this comparison.</h2><p>Accessories, repair tools and incompatible product types are excluded from main-product comparisons.</p><a href="/find/">Find products</a></section>';$("[data-v209-compare-count]").textContent="0 products";return}
    const baseFamily=C(records[0].fa||records[0].ty),compatible=records.filter(r=>C(r.fa||r.ty)===baseFamily),incompatible=records.filter(r=>C(r.fa||r.ty)!==baseFamily);
    let warning="";
    if(rejected.length)warning+='<section class="tp90-warning"><h2>An invalid comparison item was removed.</h2><p>TrendPilot excluded a repair tool or other non-main product that had been incorrectly classified as a phone.</p></section>';
    if(incompatible.length)warning+=`<section class="tp90-warning"><h2>Some saved products belong to a different family.</h2><p>They are not mixed into this comparison. Remove them and choose products from ${E(familyLabel(baseFamily))}.</p></section>`;
    host.innerHTML=warning+`<div class="tp90-grid">${compatible.map(productCard).join("")}</div><section class="tp90-note"><b>Comparison rule:</b> TrendPilot compares products only within the same family and excludes known accessories, parts and repair tools from main-product comparisons. Exact-product prices and seller-feed prices remain visibly different, and a broader seller route is never presented as an exact destination.</section>`;
    $("[data-v209-compare-count]").textContent=`${compatible.length} product${compatible.length===1?"":"s"} · ${familyLabel(baseFamily)}`;
    host.querySelectorAll('[data-v209-remove]').forEach(b=>b.addEventListener('click',()=>remove(b.dataset.v209Remove)));
  }
  $("[data-v209-clear]")?.addEventListener("click",()=>{write([]);boot()});
  if(d.readyState==="loading")d.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
})();
