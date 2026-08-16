(() => {
  "use strict";

  const VERSION = "21.17.0";
  const d = document;
  const $ = (s, r = d) => r.querySelector(s);
  const $$ = (s, r = d) => [...r.querySelectorAll(s)];
  const C = v => String(v ?? "").replace(/\s+/g, " ").trim();
  const E = v => C(v).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const params = new URLSearchParams(location.search);
  const q = C(params.get("q"));
  const ql = q.toLowerCase();
  const FOOT = /^(?:shoe|shoes|sneaker|sneakers|boot|boots|sandal|sandals|slipper|slippers|footwear|loafer|loafers|heel|heels)$/i;
  const BROAD = /^(?:popular products?|popular|products?|best sellers?|bestsellers?|trending products?|trending)$/i;
  const mode = FOOT.test(ql) ? "footwear" : BROAD.test(ql) ? "broad" : "";
  if (!mode) return;

  window.__TP_PACKED_BROWSE_ACTIVE__ = true;
  window.__TP_PACKED_BROWSE__ = {version: VERSION, mode, ready: false};

  const dataUrl = mode === "footwear"
    ? `/data/v20-9/footwear-seller-samples.json?v=21.13.7`
    : `/data/v20-9/seller-browse-samples.json?v=21.13.7`;

  const state = { data:null, rows:[], sellers:[], seller:"", sort:"smart", min:0, max:0, page:24 };
  const sellerAllowed = s => window.__TP_ALLOW_TIKTOK_US__ === true || !/^TikTok\s*Shop\s*US$/i.test(C(s));
  const waitForGeo = async()=>{try{const p=window.__TP_GEO_READY__;if(p&&typeof p.then==="function")await p}catch{}};
  function usablePrice(r){
    const value=Number(r&&r.p)||0;if(!value)return 0;
    const seller=C(r&&r.se).toLowerCase(),role=C((r&&r.ro)||"main").toLowerCase(),text=C([r&&r.fa,r&&r.ty,r&&r.tyl,r&&r.t].join(" ")).toLowerCase();
    if(seller.includes("lenovo")&&role!=="accessory"&&role!=="replacement_part"&&value<=5&&/\b(?:laptop|tablet|chromebook|notebook|computer)\b/i.test(text))return 0;
    return value;
  }

  function compareItems(){
    try { const x = JSON.parse(localStorage.getItem("tp-v209-compare") || "[]"); return Array.isArray(x) ? x : []; }
    catch { return []; }
  }
  function setCompare(items){
    try { localStorage.setItem("tp-v209-compare", JSON.stringify(items.slice(0,3))); } catch {}
    $$('[data-compare-count]').forEach(el => { el.textContent = String(items.length); el.toggleAttribute("hidden", !items.length); });
  }
  function addCompare(r,b){
    const items=compareItems();
    if(items.some(x=>(typeof x==="string"?x:x.id)===r.id)){ location.href="/compare/"; return; }
    const first=items[0], ff=typeof first==="object"?C(first.fa):"";
    if(ff&&C(r.fa)&&ff!==C(r.fa)){ b.textContent="Choose the same family"; setTimeout(()=>b.textContent="Compare",1200); return; }
    if(items.length>=3){ b.textContent="Comparison is full"; setTimeout(()=>b.textContent="Compare",1200); return; }
    items.push({id:r.id,fa:C(r.fa),t:C(r.t),ty:C(r.ty)}); setCompare(items); b.textContent="Added ✓";
  }
  const money = (r,v=usablePrice(r)) => `${r.cu === "USD" ? "US$" : E((r.cu || "") + " ")}${Number(v).toLocaleString(undefined,{maximumFractionDigits:2})}`;

  function card(r){
    const href=`/item/?id=${encodeURIComponent(r.id)}&q=${encodeURIComponent(q)}`;
    const pv=usablePrice(r),price=pv?money(r,pv):"Check current price";
    const label=mode==="footwear"?"Footwear":E(r.b||r.tyl||r.ty||"Product");
    return `<article class="tp78-card tp90-search-card" data-v209-card data-v209-seller="${E(r.se)}" data-v209-role="${E(r.ro||"main")}" data-v209-family="${E(r.fa||r.ty||"")}">
      <a class="tp78-media" href="${E(href)}" aria-label="View ${E(r.t)} details">${r.im?`<img src="${E(r.im)}" alt="${E(r.t)}" width="360" height="360" loading="lazy" decoding="async" onerror="this.remove()">`:`<span class="tp78-fallback">TP</span>`}</a>
      <div class="tp78-body"><div class="tp78-top"><b>${label}</b><span>${E(r.se)}</span></div><h3><a href="${E(href)}">${E(r.t)}</a></h3><strong class="tp78-price">${E(price)}</strong><div class="tp78-actions"><a class="tp78-primary internal-detail" href="${E(href)}">View details →</a><button class="tp78-secondary" type="button" data-packed-compare="${E(r.id)}">Compare</button></div></div>
    </article>`;
  }

  function allFiltered(){
    let rows=state.rows.filter(r=>{
      if(state.seller && C(r.se)!==state.seller) return false;
      const p=usablePrice(r);
      if(state.min && (!p || p<state.min)) return false;
      if(state.max && (!p || p>state.max)) return false;
      return true;
    });
    rows=rows.slice();
    if(state.sort==="price-low") rows.sort((a,b)=>(usablePrice(a)||Infinity)-(usablePrice(b)||Infinity));
    else if(state.sort==="price-high") rows.sort((a,b)=>usablePrice(b)-usablePrice(a));
    else if(state.sort==="best-value") rows.sort((a,b)=>(Number(b.x)-Number(a.x))||((usablePrice(a)||Infinity)-(usablePrice(b)||Infinity))||((Number(b.r)||0)-(Number(a.r)||0)));
    else rows.sort((a,b)=>(Number(b.r)||0)-(Number(a.r)||0));
    return rows;
  }

  function balanced(rows,limit){
    if(state.seller || state.sellers.length<2) return rows.slice(0,limit);
    const by={};
    for(const s of state.sellers) by[s]=rows.filter(r=>C(r.se)===s);
    const out=[]; let round=0;
    while(out.length<limit){
      let added=0;
      for(const s of state.sellers){ const r=by[s]?.[round]; if(r){out.push(r);added++;if(out.length>=limit)break;} }
      if(!added) break; round++;
    }
    return out;
  }

  function draw(){
    const grid=$("[data-v2078-product-grid]"); if(!grid) return;
    const filtered=allFiltered(); const shown=balanced(filtered,state.page);
    grid.innerHTML=shown.length?shown.map(card).join(""):`<div class="tp80-no-result"><h2>No products match these filters.</h2><p>Try All sellers or remove the price filter.</p></div>`;
    const count=$("[data-v2078-results-count]"); if(count) count.textContent=`${filtered.length} matching`;
    const more=$("[data-v2078-load-more]");
    if(more){ more.hidden=filtered.length<=shown.length; more.disabled=false; more.textContent=filtered.length>shown.length?`Show more products (${filtered.length-shown.length} more)`:"Show more products"; }
    $$('[data-packed-compare]').forEach(b=>b.addEventListener("click",()=>{ const r=state.rows.find(x=>x.id===b.dataset.packedCompare); if(r)addCompare(r,b); }));
    setCompare(compareItems());
  }

  function buildBudget(){
    const host=$("[data-budget-tools]"); if(!host) return;
    host.innerHTML=`<div class="tp-budget-title"><strong>Price range</strong><button type="button" data-packed-budget-clear>Clear</button></div><div class="tp-budget-numbers"><label>Min $<input data-packed-min type="number" min="0" step="1" placeholder="0"></label><span>to</span><label>Max $<input data-packed-max type="number" min="0" step="1" placeholder="Any"></label></div>`;
    host.addEventListener("input",e=>{ if(e.target.matches("[data-packed-min]"))state.min=Math.max(0,Number(e.target.value)||0); if(e.target.matches("[data-packed-max]"))state.max=Math.max(0,Number(e.target.value)||0); state.page=24;draw(); });
    host.addEventListener("click",e=>{ if(!e.target.closest("[data-packed-budget-clear]"))return; state.min=state.max=0; const a=$("[data-packed-min]"),b=$("[data-packed-max]"); if(a)a.value="";if(b)b.value="";state.page=24;draw(); });
  }

  function bindControls(){
    const seller=$("[data-filter-merchant]");
    if(seller){
      seller.innerHTML='<option value="">All sellers</option>'+state.sellers.map(s=>`<option value="${E(s)}">${E(s)}</option>`).join("");
      seller.addEventListener("change",()=>{state.seller=seller.value;state.page=24;draw();});
    }
    const sort=$("[data-filter-sort]");
    if(sort){state.sort=sort.value||"smart";sort.addEventListener("change",()=>{state.sort=sort.value||"smart";state.page=24;draw();});}
    const more=$("[data-v2078-load-more]");
    more?.addEventListener("click",()=>{state.page+=24;draw();});
    buildBudget();
  }

  function bindNavigation(){
    const form=$("[data-v2078-finder-form]"),input=$("[data-tp-finder-input]"),scope=$("[data-tp-finder-scope]");
    if(input) input.value=q;
    const go=(value,sc="")=>{ const x=C(value); if(!x)return; const n=new URLSearchParams({q:x,engine:"v2064",universal:"1",ui:"2138"}); if(C(sc))n.set("scope",C(sc)); location.assign(`/find/?${n}`); };
    form?.addEventListener("submit",e=>{e.preventDefault();go(input?.value,scope?.value);});
    $$('[data-search-suggestion]').forEach(b=>b.addEventListener("click",()=>go(b.dataset.searchSuggestion,b.dataset.searchScope||scope?.value||"")));
    const nav=$("[data-tp-nav]"),open=$("[data-tp-menu-button]"),close=$("[data-tp-menu-close]"),back=$("[data-tp-nav-backdrop]");
    if(nav&&open){const set=v=>{nav.classList.toggle("is-open",v);back?.classList.toggle("is-open",v);d.body.classList.toggle("tp-menu-open",v);open.setAttribute("aria-expanded",String(v));};open.addEventListener("click",()=>set(!nav.classList.contains("is-open")));close?.addEventListener("click",()=>set(false));back?.addEventListener("click",()=>set(false));d.addEventListener("keydown",e=>{if(e.key==="Escape")set(false);});}
    $$('[data-year]').forEach(x=>x.textContent=new Date().getFullYear());
  }

  async function boot(){
    await waitForGeo();
    bindNavigation();
    const grid=$("[data-v2078-product-grid]");
    if(grid)grid.innerHTML='<div class="tp78-empty"><h3>Finding the best matches…</h3><p>Loading verified products from available sellers.</p></div>';
    try{
      const response=await fetch(dataUrl,{cache:"reload"}); if(!response.ok)throw new Error(`HTTP ${response.status}`);
      const data=await response.json(); state.data=data;
      state.sellers=Object.keys(data.sellers||{}).filter(sellerAllowed).sort((a,b)=>a.localeCompare(b));
      const rows=[]; const seen=new Set();
      for(const seller of state.sellers){
        for(const id of data.sellers[seller]||[]){ const r=data.records?.[id]; if(!r||seen.has(id)||!sellerAllowed(r.se))continue;seen.add(id);rows.push(r); }
      }
      state.rows=rows;
      bindControls();
      const head=$("[data-v2078-results-title]"); if(head)head.textContent=`Results for “${q}”`;
      const sub=$("[data-v2078-results-sub]");
      if(sub) sub.textContent=mode==="footwear"?"Showing verified wearable footwear only. Sellers appear only when the catalogue contains matching footwear available for your region.":"Popular products are balanced across sellers represented in the current catalogue sample and available for your region.";
      window.__TP_PACKED_BROWSE__.ready=true; window.__TP_PACKED_BROWSE__.sellerCount=state.sellers.length; window.__TP_PACKED_BROWSE__.recordCount=state.rows.length; window.__TP_PACKED_BROWSE__.country=String(window.__TP_VISITOR_COUNTRY__||'ZZ');
      draw();
    } catch(err){
      window.__TP_PACKED_BROWSE__.error=String(err?.message||err);
      if(grid)grid.innerHTML='<div class="tp80-no-result"><h2>Products could not be loaded.</h2><p>Please retry the search. The catalogue data is temporarily unavailable.</p></div>';
      const count=$("[data-v2078-results-count]");if(count)count.textContent="0 matching";
    }
  }

  if(d.readyState==="loading")d.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
})();
