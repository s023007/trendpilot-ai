(() => {
  "use strict";
  const V="21.12.0",d=document,$=(s,r=d)=>r.querySelector(s),$$=(s,r=d)=>[...r.querySelectorAll(s)],E=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  let rows=[],filter="all",query="";
  const clean=v=>String(v??"").replace(/\s+/g," ").trim();
  const low=v=>clean(v).toLowerCase();
  const cleanTitle=v=>String(v??"")
    .replace(/^\s*(?:\[(?:free\s+shipping|hot\s+sale|new\s+arrival|best\s+seller)\]\s*|(?:free\s+shipping|hot\s+sale|new\s+arrival|best\s+seller)\s*[:\-–—]?\s*)+/i,"")
    .replace(/\bfor\s+for\b/ig,"for")
    .replace(/^\s*\/+/,"")
    .replace(/\s+/g," ").trim();
  const money=r=>`${r.currency==="USD"?"US$":E((r.currency||"")+" ")}${Number(r.price).toLocaleString(undefined,{maximumFractionDigits:2})}`;
  const internalDest=r=>`/rare-used/view/?id=${encodeURIComponent(r.id||"")}`;
  function rarity(score){score=Number(score||0);if(score>=90)return`Exceptional find`;if(score>=80)return`Very rare`;if(score>=65)return`Hard to find`;return`Specialist find`}
  function priceInfo(r){if(!r.price)return{label:"Check current price"};return{label:money(r)}}
  const friendlySignal=s=>({"used-scarce":"Used & scarce","replacement-part":"Replacement part","collector":"Collector item","discontinued":"Discontinued","specialist":"Specialist"}[String(s)]||"");
  function modelCodes(title){
    const out=[],seen=new Set();
    for(const token of clean(title).match(/\b(?:[A-Z]{1,8}[A-Z0-9-]*\d[A-Z0-9-]*|\d{5,}-\d{2,})\b/gi)||[]){
      const x=token.toUpperCase();if(x.length<3||x.length>24||seen.has(x))continue;seen.add(x);out.push(x);if(out.length===3)break;
    }
    return out;
  }
  function humanSummary(r){
    const title=cleanTitle(r.title),signals=new Set(r.signals||[]),codes=modelCodes(title),models=codes.length?` for ${codes.join(", ")}`:"";
    if(r.role==="replacement_part"||signals.has("replacement-part"))return `Specialist replacement component${models}. Verify the exact part or model number before ordering.`;
    if(signals.has("used-scarce"))return `Scarce used or pre-owned item. Check condition, included parts and seller photos before buying.`;
    if(signals.has("collector"))return `Collector-focused item that may be difficult to replace. Check authenticity, condition and completeness.`;
    if(signals.has("discontinued"))return `Older or discontinued item${models}. Confirm the exact version and compatibility before buying.`;
    if(signals.has("specialist"))return `Specialist product${models}. Check the exact use, model and compatibility in the seller listing.`;
    return `Hard-to-find ${clean(r.typeLabel||r.type||"product").toLowerCase()}. Confirm the exact model, condition and compatibility before buying.`;
  }
  function card(r){const pi=priceInfo(r),dest=internalDest(r),title=cleanTitle(r.title),summary=humanSummary(r),signals=(r.signals||[]).map(friendlySignal).filter(Boolean).slice(0,3);return `<article class="tp80-rare-card" data-rare-id="${E(r.id)}"><a class="tp80-rare-image" href="${E(dest)}" aria-label="View ${E(title)} details on TrendPilot"><img src="${E(r.image)}" alt="${E(title)}" width="520" height="520" loading="lazy"></a><div class="tp80-rare-card-copy"><span class="tp80-rare-score">${E(rarity(r.rareScore))}</span><p class="tp80-brand">${E(r.brand||r.seller)}</p><h2><a href="${E(dest)}">${E(title)}</a></h2><p class="tp80-rare-summary">${E(summary)}</p><p class="tp80-card-price">${E(pi.label)}</p><p class="tp80-rare-meta">${E(r.typeLabel||r.type)} · ${E(r.seller)}</p>${signals.length?`<div class="tp80-signals">${signals.map(s=>`<span>${E(s)}</span>`).join("")}</div>`:""}<a class="tp80-primary" href="${E(dest)}">View details →</a></div></article>`}
  function matchesSearch(r){if(!query)return true;const terms=low(query).split(/\s+/).filter(Boolean);const blob=low(`${cleanTitle(r.title)} ${humanSummary(r)} ${r.brand||""} ${r.seller||""} ${r.typeLabel||r.type||""} ${(r.signals||[]).join(" ")}`);return terms.every(t=>blob.includes(t))}
  function currentRows(){return rows.filter(r=>(filter==="all"||(r.signals||[]).includes(filter))&&matchesSearch(r))}
  function draw(){const list=currentRows(),grid=$("[data-rare-grid]"),stats=$("[data-rare-stats]");if(!grid||!stats)return;if(list.length){grid.innerHTML=list.slice(0,72).map(card).join("");stats.textContent=query?`${list.length} Rare Find${list.length===1?"":"s"} for “${query}”`:`${list.length} Rare Find${list.length===1?"":"s"}`;}else{grid.innerHTML=`<div class="tp80-no-result"><h2>No Rare Finds match${query?` “${E(query)}”`:" this group"}.</h2><p>Try another product, brand or model.</p>${query?`<a class="tp80-primary" href="/find/?q=${encodeURIComponent(query)}&engine=v2064">Search all products instead</a>`:""}</div>`;stats.textContent="No matching Rare Finds";}}
  function bindSearch(){const form=$("[data-rare-search]"),input=$("[data-rare-query]");const params=new URLSearchParams(location.search);query=clean(params.get("q"));if(input&&query)input.value=query;form?.addEventListener("submit",e=>{e.preventDefault();query=clean(input?.value);const u=new URL(location.href);if(query)u.searchParams.set("q",query);else u.searchParams.delete("q");history.replaceState(null,"",u);draw();});input?.addEventListener("search",()=>{query=clean(input.value);draw();});}
  async function boot(){bindSearch();try{const r=await fetch(`/data/v20-8/rare-index.json?v=20.8.9`,{cache:"no-cache"});if(!r.ok)throw new Error("rare index unavailable");rows=(await r.json()).filter(x=>Number(x.rareScore||0)>=60);draw()}catch(e){$("[data-rare-grid]").innerHTML="<p>Rare Finds is updating. Please try again shortly.</p>"}$$('[data-rare-filter]').forEach(b=>b.addEventListener('click',()=>{filter=b.dataset.rareFilter;$$('[data-rare-filter]').forEach(x=>x.classList.toggle('active',x===b));draw()}))}
  d.readyState==="loading"?d.addEventListener("DOMContentLoaded",boot,{once:true}):boot();
})();
