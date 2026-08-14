(() => {
  "use strict";
  const V="20.8.0",d=document,$=(s,r=d)=>r.querySelector(s),C=v=>String(v??"").replace(/\s+/g," ").trim(),L=v=>C(v).toLowerCase(),E=v=>C(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const P=new URLSearchParams(location.search),q=C(P.get("q")),forced=P.get("universal")==="1";
  const known=/^(?:phone|phones|smartphone|smartphones|laptop|laptops|perfume|perfumes|fragrance|fragrances|headphones|headphone|earbuds|smartwatch|watch|power bank|power banks|dog food|air conditioner|3d filament|cookware|lighting|lights|tools|tool)$/i;
  if(!q||(!forced&&known.test(q)))return;
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
  function card(r){
    const price=r.p?`${r.cu==="USD"?"US$":E(r.cu+" ")}${Number(r.p).toLocaleString(undefined,{maximumFractionDigits:2})}`:"Check current price";
    const rare=r.r>=60?`<span class="tp80-mini-rare">Rare ${r.r}</span>`:"",href=r.seo||r.u||"#",cta=r.seo?"View rare find":(r.x?"View exact product":"Search seller");
    return `<article class="tp78-card tp80-universal-card"><div class="tp78-media">${r.im?`<img src="${E(r.im)}" alt="${E(r.t)}" width="360" height="360" loading="lazy">`:"<span>No image</span>"}</div><div class="tp78-body"><div class="tp78-top"><b>${E(r.b||r.tyl||"Product")}</b><span>${E(r.se)}</span></div><h3>${E(r.t)}</h3><strong class="tp78-price">${E(price)}</strong>${rare}<p class="tp80-universal-meta">${E(r.tyl)} · ${E((r.ro||"main").replaceAll("_"," "))}</p><div class="tp78-actions"><a class="tp78-primary" href="${E(href)}" ${r.seo?"":'target="_blank" rel="sponsored nofollow noopener"'}>${cta} →</a></div></div></article>`;
  }
  async function logDemand(){const body=JSON.stringify({q,source:document.referrer||"",path:location.pathname+location.search});try{await fetch("/.netlify/functions/discovery-demand-v20-8",{method:"POST",headers:{"content-type":"application/json"},body,keepalive:true})}catch(e){try{localStorage.setItem("tp-v20-8-missed:"+L(q),new Date().toISOString())}catch(_){}}}
  async function boot(){
    const grid=$("[data-v2078-product-grid]");if(!grid)return;const rows=await search();
    if(!rows.length){await logDemand();grid.innerHTML=`<div class="tp80-no-result"><h2>We couldn't verify this product yet.</h2><p>TrendPilot recorded the search so future catalogue updates can look for it. Try a model, MPN, SKU or part number for a more exact match.</p><a href="/rare-used/">Explore Rare Finds</a></div>`;return}
    const head=$("[data-v2078-results-title]");if(head)head.textContent=`Universal results for “${q}”`;
    const sub=$("[data-v2078-results-sub]");if(sub)sub.textContent="Long-tail catalogue search across all product types. Product role and seller evidence stay visible.";
    const count=$("[data-v2078-results-count]");if(count)count.textContent=`${rows.length} found`;
    grid.innerHTML=rows.map(card).join("");const more=$("[data-v2078-load-more]");if(more)more.hidden=true;
  }
  setTimeout(boot,forced?150:1000);
})();