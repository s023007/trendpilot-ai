(()=>{
  'use strict';
  const qs=new URLSearchParams(location.search);
  const engine=(qs.get('engine')||'').toLowerCase();
  if(!['v2064','v2067'].includes(engine)) return;

  const clean=v=>String(v??'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
  const esc=v=>clean(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const norm=v=>clean(v).toLowerCase().replace(/[\u2010-\u2015]/g,'-').replace(/[^a-z0-9+.#% -]+/g,' ').replace(/\s+/g,' ').trim();
  const money=(n,c='USD')=>Number.isFinite(Number(n))?new Intl.NumberFormat('en-US',{style:'currency',currency:c||'USD',maximumFractionDigits:2}).format(Number(n)):'';
  const root=()=>document.querySelector('.tp-main-col');
  const input=()=>document.querySelector('[data-tp-finder-input]');
  let DATA=null;

  function indexData(data){
    const byId=new Map(), offers=new Map(), variants=new Map();
    data.products.forEach(p=>byId.set(p.tpid,p));
    data.offers.forEach(o=>{if(!offers.has(o.tpid))offers.set(o.tpid,[]);offers.get(o.tpid).push(o)});
    data.variants.forEach(v=>{if(!variants.has(v.tpid))variants.set(v.tpid,[]);variants.get(v.tpid).push(v)});
    return {byId,offers,variants};
  }
  function score(p,q){
    const n=norm(p.name), b=norm(p.brand), qq=norm(q);
    if(!qq) return 0;
    if(n===qq) return 10000;
    if(`${b} ${n}`.trim()===qq) return 9800;
    let s=0;
    if(n.startsWith(qq)) s+=5000;
    if(n.includes(qq)) s+=3500;
    const toks=qq.split(' ').filter(x=>x.length>1);
    const hits=toks.filter(t=>n.includes(t)||b.includes(t)).length;
    s+=hits*600;
    if(hits===toks.length && toks.length) s+=1500;
    if(p.sellerCount>1) s+=120;
    return s;
  }
  function queryType(q){
    const n=norm(q);
    if(/\b(phone|smartphone|iphone|redmi|oneplus|galaxy|pixel)\b/.test(n)) return 'phone';
    if(/\b(laptop|thinkpad|ideapad|chromebook|notebook)\b/.test(n)) return 'laptop';
    if(/\b(headphones?|headsets?|earbuds?|earphones?|tws)\b/.test(n)) return 'headphones';
    if(/\b(perfume|fragrance|cologne|eau de)\b/.test(n)) return 'perfume';
    if(/\b(power ?bank)\b/.test(n)) return 'power_bank';
    if(/\b(dog food|dog treats?)\b/.test(n)) return 'dog_food';
    if(/\b(air conditioner|portable ac|mini split)\b/.test(n)) return 'air_conditioner';
    return '';
  }
  function findProducts(q){
    const typ=queryType(q), nq=norm(q);
    let rows=DATA.products.map(p=>({p,s:score(p,q)})).filter(x=>x.s>0);
    if(typ) rows=rows.filter(x=>x.p.type===typ);
    if(['phone','laptop','headphones','perfume','power bank','dog food','air conditioner'].includes(nq)){
      const t=queryType(nq); rows=DATA.products.filter(p=>p.type===t).map(p=>({p,s:(p.sellerCount>1?100:0)+(p.brand?10:0)}));
    }
    return rows.sort((a,b)=>b.s-a.s||b.p.sellerCount-a.p.sellerCount||a.p.name.localeCompare(b.p.name)).map(x=>x.p);
  }
  function exactProduct(q){
    const nq=norm(q);
    const exact=DATA.products.filter(p=>norm(p.name)===nq||norm(`${p.brand} ${p.name}`)===nq);
    if(exact.length) return exact.sort((a,b)=>b.sellerCount-a.sellerCount)[0];
    const ranked=findProducts(q);
    return ranked[0]&&score(ranked[0],q)>=7000?ranked[0]:null;
  }
  function image(p){return /^https?:\/\//i.test(clean(p.image))?`<img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy">`:'<div class="tp67-placeholder">TP</div>'}
  function priceText(p){return p.fromPrice!=null?`From ${money(p.fromPrice,p.currency)}`:'Check current price'}
  function card(p){
    const action=p.sellerCount>1?`Compare ${p.sellerCount} sellers`:(p.variantCount>1?'View offer & variants':'View seller offer');
    return `<article class="tp67-product-card" data-tpid="${esc(p.tpid)}">
      <div class="tp67-product-image">${image(p)}</div>
      <div class="tp67-product-body">
        <div class="tp67-brand">${esc(p.brand||'Product')}</div>
        <h3>${esc(p.name)}</h3><div class="tp67-price">${esc(priceText(p))}</div>
        <div class="tp67-meta"><span>${p.sellerCount} seller${p.sellerCount===1?'':'s'}</span><span>${p.variantCount} variant${p.variantCount===1?'':'s'}</span></div>
        <button class="tp67-btn" type="button" data-tpid-open="${esc(p.tpid)}">${esc(action)}</button>
      </div></article>`;
  }
  function browse(q){
    const r=root(); if(!r)return;
    const rows=findProducts(q);
    const shown=rows.slice(0,80);
    r.innerHTML=`<div class="tp67-head"><div><h2>Choose a product to compare for “${esc(q)}”</h2><p>Products are grouped by TrendPilot product identity. Seller listings are not mixed together.</p></div><span>${rows.length} master products</span></div>
      <div class="tp67-grid">${shown.map(card).join('')||'<div class="tp67-empty">No verified product identity matched this query.</div>'}</div>
      ${rows.length>shown.length?`<button class="tp67-more" type="button" data-tp67-more>Show more (${rows.length-shown.length})</button>`:''}`;
    r.querySelectorAll('[data-tpid-open]').forEach(b=>b.addEventListener('click',()=>comparison(b.dataset.tpidOpen)));
    const more=r.querySelector('[data-tp67-more]');
    if(more)more.addEventListener('click',()=>{r.querySelector('.tp67-grid').innerHTML=rows.map(card).join('');more.remove();r.querySelectorAll('[data-tpid-open]').forEach(b=>b.addEventListener('click',()=>comparison(b.dataset.tpidOpen)));});
  }
  function offerCard(o){
    const price=o.priceReliable&&o.price!=null?money(o.price,o.currency):'Check current price';
    const note=o.priceReliable?'':'Price hidden because the source price is incomplete or unreliable.';
    return `<div class="tp67-offer-card"><div class="tp67-offer-top"><strong>${esc(o.seller)}</strong><b>${esc(price)}</b></div>${note?`<small>${esc(note)}</small>`:''}<a href="${esc(o.url)}" target="_blank" rel="nofollow sponsored noopener">Check seller ↗</a></div>`;
  }
  function comparison(tpid){
    const r=root(); if(!r)return;
    const p=IDX.byId.get(tpid); if(!p){browse(qs.get('q')||'');return;}
    const all=(IDX.offers.get(tpid)||[]).filter(o=>/^https?:\/\//i.test(o.url));
    const vars=IDX.variants.get(tpid)||[];
    const byVariant=new Map();
    all.forEach(o=>{const v=o.tpvid||'UNSPECIFIED';if(!byVariant.has(v))byVariant.set(v,[]);byVariant.get(v).push(o)});
    const sellerSet=[...new Set(all.map(o=>o.seller))];
    const variantRows=vars.length?vars:[{tpvid:'UNSPECIFIED',label:'Base / unspecified variant',sellerCount:sellerSet.length}];
    const first=variantRows.sort((a,b)=>b.sellerCount-a.sellerCount||b.offerCount-a.offerCount)[0];
    r.innerHTML=`<div class="tp67-compare-head"><button type="button" class="tp67-back">← Back to results</button><div class="tp67-title-row"><div class="tp67-compare-image">${image(p)}</div><div><div class="tp67-brand">${esc(p.brand||'Product')}</div><h2>${esc(p.name)}</h2><p><strong>${sellerSet.length}</strong> seller${sellerSet.length===1?'':'s'} across <strong>${variantRows.length}</strong> variant${variantRows.length===1?'':'s'}.</p></div></div></div>
      <section class="tp67-variants"><h3>Variants</h3><p class="tp67-help">Select a variant to compare only offers that belong to that exact TPVID. “All variants” shows every seller offer for this TPID without pretending different variants are identical.</p>
        <div class="tp67-variant-chips"><button class="active" data-variant="ALL">All variants · ${sellerSet.length} sellers</button>${variantRows.map(v=>`<button data-variant="${esc(v.tpvid)}">${esc(v.label)} · ${v.sellerCount} seller${v.sellerCount===1?'':'s'}</button>`).join('')}</div></section>
      <section class="tp67-offers"><div class="tp67-offers-head"><h3>Seller offers</h3><span data-tp67-offer-count>${sellerSet.length} sellers</span></div><div class="tp67-offer-grid" data-tp67-offers>${all.map(offerCard).join('')}</div></section>
      <details class="tp67-tech"><summary>Technical identity details</summary><div>TPID: ${esc(p.tpid)}</div>${first?.tpvid?`<div>Example TPVID: ${esc(first.tpvid)}</div>`:''}</details>`;
    r.querySelector('.tp67-back').addEventListener('click',()=>browse(qs.get('q')||p.type||p.name));
    r.querySelectorAll('[data-variant]').forEach(btn=>btn.addEventListener('click',()=>{
      r.querySelectorAll('[data-variant]').forEach(x=>x.classList.toggle('active',x===btn));
      const vid=btn.dataset.variant; const rows=vid==='ALL'?all:(byVariant.get(vid)||[]);
      const sellers=[...new Set(rows.map(o=>o.seller))];
      r.querySelector('[data-tp67-offers]').innerHTML=rows.map(offerCard).join('')||'<div class="tp67-empty">No actionable seller offer is available for this exact variant.</div>';
      r.querySelector('[data-tp67-offer-count]').textContent=`${sellers.length} seller${sellers.length===1?'':'s'}`;
    }));
    history.replaceState(null,'',`${location.pathname}?engine=v2064&q=${encodeURIComponent(p.name)}&tpid=${encodeURIComponent(p.tpid)}`);
  }
  async function init(){
    const r=root(); if(!r)return;
    try{
      const res=await fetch('/data/search-v20-6/stable-v20-6-7.json?v=20.6.7.1',{cache:'no-store'});
      if(!res.ok) throw new Error(`HTTP ${res.status}`);
      DATA=await res.json(); IDX=indexData(DATA);
      const q=clean(qs.get('q')||input()?.value||''); const direct=clean(qs.get('tpid')||'');
      if(direct&&IDX.byId.has(direct)) comparison(direct);
      else {
        const p=exactProduct(q);
        if(p && norm(p.name)===norm(q)) comparison(p.tpid); else browse(q);
      }
    }catch(err){
      r.innerHTML=`<div class="tp67-empty"><h2>Comparison data could not be loaded.</h2><p>${esc(err.message||err)}</p><p>Use <code>?engine=legacy</code> only as a temporary fallback.</p></div>`;
    }
  }
  let IDX=null;
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(init,0),{once:true}); else setTimeout(init,0);
})();
