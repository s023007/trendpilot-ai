(() => {
  'use strict';
  const d=document,$=(s,r=d)=>r.querySelector(s),$$=(s,r=d)=>[...r.querySelectorAll(s)];
  const clean=v=>String(v??'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
  const low=v=>clean(v).toLowerCase();
  const esc=v=>clean(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const blocked=/\b(?:Temu|Joom|FilamentPRO)\b/i;
  const money=(n,c='USD')=>{n=Number(n);if(!Number.isFinite(n)||n<=0)return'';try{return new Intl.NumberFormat(undefined,{style:'currency',currency:c||'USD',maximumFractionDigits:2}).format(n)}catch{return`${c||''} ${n.toFixed(2)}`.trim()}};
  const fmtDate=v=>{if(!v)return'';const dt=new Date(v);if(Number.isNaN(dt.getTime()))return'';return dt.toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'})};
  const MARKET=/\b(?:AliExpress|Alibaba)\b/i;
  const CATS={
    all:{label:'All deals',re:/.*/},phones:{label:'Phones',re:/\b(phone|smartphone|iphone|galaxy|pixel|xiaomi|redmi|honor)\b/i},
    shoes:{label:'Shoes',re:/\b(shoe|shoes|sneaker|sneakers|boot|boots|sandal|sandals|slipper|slippers|footwear|loafer|clog)\b/i},
    toys:{label:'Toys',re:/\b(toy|toys|game|games|doll|lego|puzzle|rc car|plush|kids)\b/i},
    home:{label:'Home',re:/\b(home|kitchen|cookware|vacuum|furniture|lighting|lamp|storage)\b/i},
    beauty:{label:'Beauty',re:/\b(beauty|makeup|skincare|perfume|fragrance|cosmetic|hair)\b/i},
    tools:{label:'Tools',re:/\b(tool|tools|drill|saw|wrench|multimeter|solder|hardware)\b/i},
    fashion:{label:'Fashion',re:/\b(shirt|dress|jacket|jeans|clothing|fashion|apparel|bag|watch|jewelry)\b/i},
    electronics:{label:'Electronics',re:/\b(laptop|computer|headphone|earbud|speaker|monitor|camera|projector|tablet|electronic)\b/i}
  };
  const state={q:'',cat:'all',shownDeals:12,shownCoupons:8,sort:'best',browse:[]};

  function flattenProducts(){
    const src=window.TRENDPILOT_MATCHED_PRODUCTS||{},out=[],seen=new Set();
    for(const [group,list] of Object.entries(src))for(const p of Array.isArray(list)?list:[]){
      if(!p||blocked.test(clean(p.advertiser||p.seller)))continue;
      const key=clean(p.canonicalKey||p.id||p.url);if(!key||seen.has(key))continue;seen.add(key);
      const rawPrice=Number(p.price),old=Number(p.oldPrice),disc=Number(p.discount),seller=low(p.advertiser||p.seller),priceText=low([p.name,p.category,p._group].join(' '));
      const price=(seller.includes('lenovo')&&rawPrice>0&&rawPrice<=5&&/\b(?:laptop|tablet|chromebook|notebook|computer)\b/i.test(priceText))?0:rawPrice;
      out.push({...p,_key:key,_group:group,_price:Number.isFinite(price)?price:0,_old:price>0&&Number.isFinite(old)&&old>price?old:0,_disc:price>0&&Number.isFinite(disc)?disc:0});
    }
    return out;
  }
  const products=flattenProducts();
  const coupons=(window.TREND_PILOT_COUPONS?.coupons||[]).filter(c=>c&&c.status!=='inactive'&&!blocked.test(clean(c.merchant_name)));
  const productBlob=p=>low([p.name,p.category,p.advertiser,p.programme,p._group].join(' '));
  const browseBlob=p=>low([p.t,p.se,p.ty,p.tyl,p.fa,p.s].join(' '));
  const couponBlob=c=>low([c.title,c.description,c.merchant_name,c.code,(c.categories||[]).join(' '),(c.types||[]).join(' ')].join(' '));
  const terms=q=>low(q).split(/\s+/).filter(x=>x.length>1);
  const textMatch=(blob,q)=>{const ts=terms(q);return !ts.length||ts.every(t=>blob.includes(t))};
  const categoryMatch=blob=>state.cat==='all'||(CATS[state.cat]||CATS.all).re.test(blob);
  function secureImage(value){let u=clean(value);if(!/^https?:\/\//i.test(u))return'';if(/^http:\/\//i.test(u))u='https://'+u.slice(7);return u}
  function couponImage(c){return secureImage(c.image||c.logo||c.merchant_logo||c.campaign_image||'')}
  function merchantMark(name){const a=clean(name).replace(/\b(?:WW|Global|Many GEOs)\b/gi,'').trim().split(/\s+/).filter(Boolean);return(a.slice(0,2).map(x=>x[0]).join('')||'TP').toUpperCase()}
  function couponMedia(c){const img=couponImage(c),mark=merchantMark(c.merchant_name);return `<div class="tp214-coupon-media"><div class="tp214-coupon-fallback"><b>${esc(mark)}</b><span>${esc(c.merchant_name||'Coupon')}</span></div>${img?`<img data-coupon-img loading="lazy" src="${esc(img)}" alt="${esc(c.merchant_name||'Seller')} coupon artwork">`:''}</div>`}
  function bindCouponImages(){$$('[data-coupon-img]').forEach(img=>{if(img.dataset.bound)return;img.dataset.bound='1';img.addEventListener('error',()=>{img.hidden=true},{once:true})})}
  function dealScore(p){return (textMatch(productBlob(p),state.q)?70:0)+(p._disc||0)*1.5+Number(p.offerQuality||0)*.25+Number(p.matchScore||0)*.15+(p.publicationValidation?.status==='verified-exact-product'?12:0)}
  function dealRows(){let rows=products.filter(p=>categoryMatch(productBlob(p))&&textMatch(productBlob(p),state.q));if(state.sort==='discount')rows.sort((a,b)=>b._disc-a._disc||dealScore(b)-dealScore(a));else if(state.sort==='low')rows.sort((a,b)=>(a._price||1e9)-(b._price||1e9));else rows.sort((a,b)=>dealScore(b)-dealScore(a));return rows}
  function browseRows(){if(!state.q&&state.cat==='all')return[];return state.browse.filter(p=>!blocked.test(clean(p.se))&&categoryMatch(browseBlob(p))&&textMatch(browseBlob(p),state.q)).slice(0,12)}
  function countryOk(c){const sel=$('[data-coupon-country]')?.value||'GLOBAL',regions=Array.isArray(c.regions)?c.regions:[];if(sel==='ALL')return true;if(sel==='OM')return !regions.length||regions.includes('OM');return !regions.length||regions.length>=80||regions.includes('OM')}
  function langOk(c){const sel=$('[data-coupon-language]')?.value||'en';return sel==='all'||low(c.language||'en')===sel}
  function couponScore(c,direct){const end=c.end_at?new Date(c.end_at).getTime():Infinity,days=(end-Date.now())/86400000;let s=Number(c.priority_score||0)+(direct?80:0)+(c.code&&!/not required|не нужен/i.test(c.code)?12:0)+(couponImage(c)?4:0);if(state.sort==='ending'&&Number.isFinite(days)&&days>=0)s+=Math.max(0,80-days);return s}
  function couponRows(){
    const base=coupons.filter(c=>countryOk(c)&&langOk(c)),q=state.q;
    const direct=base.filter(c=>textMatch(couponBlob(c),q)&&categoryMatch(couponBlob(c))).map(c=>({...c,_direct:true}));
    if(!q&&state.cat==='all')return direct.sort((a,b)=>couponScore(b,true)-couponScore(a,true));
    const merchants=new Set([...dealRows().slice(0,80).map(p=>clean(p.advertiser)),...browseRows().map(p=>clean(p.se))].filter(Boolean));
    const fallback=base.filter(c=>!direct.some(x=>x.id===c.id)&&(MARKET.test(c.merchant_name)||[...merchants].some(m=>low(c.merchant_name).includes(low(m))))).map(c=>({...c,_direct:false}));
    return [...direct,...fallback].sort((a,b)=>couponScore(b,b._direct)-couponScore(a,a._direct));
  }
  function dealCard(p){const seller=clean(p.advertiser||p.seller||'Seller'),price=money(p._price,p.currency),old=p._old>p._price?money(p._old,p.currency):'',disc=p._disc>0?`${Math.round(p._disc)}% saving`:'Current price';return `<article class="tp214-deal"><div class="tp214-media">${p.image?`<img loading="lazy" src="${esc(p.image)}" alt="">`:''}<span class="tp214-badge">${esc(disc)}</span></div><div class="tp214-body"><div class="tp214-meta"><strong>${esc(seller)}</strong><span>${esc(p.category||'Product')}</span></div><h3>${esc(p.name)}</h3><div class="tp214-price"><b>${esc(price||'Check price')}</b>${old?`<s>${esc(old)}</s>`:''}</div><div class="tp214-actions"><a class="primary" href="/deal/?id=${encodeURIComponent(p._key)}">View deal</a><a href="/compare/?add=${encodeURIComponent(p.id||p._key)}">Compare</a></div></div></article>`}
  function browseCard(p){const title=clean(p.t),seller=clean(p.se||'Seller'),price=money(p.p,p.cu||'USD');return `<article class="tp214-deal"><div class="tp214-media">${p.im?`<img loading="lazy" src="${esc(p.im)}" alt="">`:''}<span class="tp214-badge">Catalogue match</span></div><div class="tp214-body"><div class="tp214-meta"><strong>${esc(seller)}</strong><span>${esc(p.tyl||p.ty||'Product')}</span></div><h3>${esc(title)}</h3><div class="tp214-price"><b>${esc(price||'Check price')}</b></div><div class="tp214-actions"><a class="primary" href="/find/?q=${encodeURIComponent(title)}">See product options</a></div></div></article>`}
  function couponCard(c){const realCode=clean(c.code)&&!/not required|не нужен/i.test(clean(c.code)),discount=clean(c.discount?.text)||clean(c.title).match(/(?:\$|€|£)?\s*\d+(?:\.\d+)?\s*%?/i)?.[0]||'Offer',min=Number(c.minimum_order?.value)>0?`Minimum ${money(c.minimum_order.value,c.minimum_order.currency||'USD')}`:'No minimum shown',end=fmtDate(c.end_at),hint=c._direct?'Matches your search':'Marketplace coupon — check eligibility';return `<article class="tp214-coupon">${couponMedia(c)}<div class="tp214-coupon-top"><strong>${esc(c.merchant_name)}</strong><span>${esc(hint)}</span></div><h3>${esc(discount)} — ${esc(c.title)}</h3><p>${esc(min)}${end?` · Ends ${esc(end)}`:''}</p><div class="tp214-code"><code>${esc(realCode?c.code:'No code needed')}</code>${realCode?`<button type="button" data-copy-code="${esc(c.code)}">Copy</button>`:''}</div><div class="tp214-actions"><a class="primary" href="/coupon/?id=${encodeURIComponent(c.id)}">View coupon</a></div><small class="tp214-note">Terms, country eligibility and final price must be confirmed at checkout.</small></article>`}
  function render(){
    const dr=dealRows(),br=browseRows(),cr=couponRows(),dg=$('[data-tp-deal-products]'),cg=$('[data-tp-coupon-grid]');
    if(dg){let html='';if(dr.length)html=`<div class="tp214-grid">${dr.slice(0,state.shownDeals).map(dealCard).join('')}</div>`;if(!dr.length&&br.length)html=`<div class="tp214-empty" style="margin-bottom:16px"><b>No dedicated discount card yet, but we found catalogue matches.</b><p>Open a product match inside TrendPilot, then compare seller options.</p></div><div class="tp214-grid">${br.map(browseCard).join('')}</div>`;if(!dr.length&&!br.length)html=`<div class="tp214-empty"><b>No dedicated deal card found for “${esc(state.q||CATS[state.cat]?.label||'this search')}”.</b><p>Search the complete catalogue instead of ending here.</p><a class="tp-btn tp-btn-primary" href="/find/?q=${encodeURIComponent(state.q||CATS[state.cat]?.label||'popular products')}">Search all products</a></div>`;dg.innerHTML=html}
    const more=$('[data-deals-more]');if(more){more.hidden=dr.length<=state.shownDeals;more.textContent=`Show more deals (${Math.min(12,Math.max(0,dr.length-state.shownDeals))})`}
    if(cg)cg.innerHTML=cr.length?`<div class="tp214-coupon-grid">${cr.slice(0,state.shownCoupons).map(couponCard).join('')}</div>`:`<div class="tp214-empty"><b>No dedicated coupon matches this product yet.</b><p>Try All countries / All languages, or use the product matches above.</p></div>`;
    const ct=$('[data-coupon-toggle]');if(ct){ct.hidden=cr.length<=state.shownCoupons;ct.textContent=`Show more coupons (${Math.min(12,Math.max(0,cr.length-state.shownCoupons))})`}
    const s1=$('[data-stat-deals]'),s2=$('[data-stat-coupons]'),s3=$('[data-stat-sellers]');if(s1)s1.textContent=String(dr.length||br.length);if(s2)s2.textContent=String(cr.length);if(s3)s3.textContent=String(new Set([...dr.map(x=>clean(x.advertiser)),...br.map(x=>clean(x.se)),...cr.map(x=>clean(x.merchant_name))].filter(Boolean)).size);
    const title=$('[data-deals-context]');if(title)title.textContent=state.q?`Savings for “${state.q}”`:state.cat!=='all'?`${CATS[state.cat].label} savings`:'Best current savings';
    bindCouponImages();
  }
  function applySearch(value){state.q=clean(value);state.shownDeals=12;state.shownCoupons=8;const u=new URL(location.href);if(state.q)u.searchParams.set('q',state.q);else u.searchParams.delete('q');history.replaceState(null,'',u);render()}
  async function loadBrowse(){try{const r=await fetch('/data/v20-9/seller-browse-samples.json?v=21.13.7',{cache:'force-cache'});if(!r.ok)return;const data=await r.json(),rows=Object.values(data.records||{});state.browse=rows;render()}catch{}}
  function bind(){
    const input=$('[data-deals-search]'),params=new URLSearchParams(location.search);state.q=clean(params.get('q'));if(input)input.value=state.q;
    $('[data-deals-form]')?.addEventListener('submit',e=>{e.preventDefault();applySearch(input?.value||'')});
    $$('[data-deals-cat]').forEach(b=>b.addEventListener('click',()=>{state.cat=b.dataset.dealsCat||'all';state.shownDeals=12;state.shownCoupons=8;$$('[data-deals-cat]').forEach(x=>x.classList.toggle('is-active',x===b));render()}));
    $('[data-deals-sort]')?.addEventListener('change',e=>{state.sort=e.target.value||'best';render()});
    $('[data-coupon-country]')?.addEventListener('change',()=>{state.shownCoupons=8;render()});$('[data-coupon-language]')?.addEventListener('change',()=>{state.shownCoupons=8;render()});
    $('[data-deals-more]')?.addEventListener('click',()=>{state.shownDeals+=12;render()});$('[data-coupon-toggle]')?.addEventListener('click',()=>{state.shownCoupons+=12;render()});
    d.addEventListener('click',async e=>{const b=e.target.closest('[data-copy-code]');if(!b)return;try{await navigator.clipboard.writeText(b.dataset.copyCode||'');const old=b.textContent;b.textContent='Copied';setTimeout(()=>b.textContent=old,1300)}catch{}});
    render();loadBrowse();
  }
  d.readyState==='loading'?d.addEventListener('DOMContentLoaded',bind,{once:true}):bind();
})();