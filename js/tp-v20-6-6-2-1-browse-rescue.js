(() => {
  "use strict";

  const VERSION="20.6.6.2.1";
  const params=()=>new URLSearchParams(location.search);
  const active=()=>params().get("engine")==="v2064" && !params().get("tpid");
  const $=(s,r=document)=>r.querySelector(s);
  const clean=v=>String(v??"").replace(/\s+/g," ").trim();
  const esc=v=>clean(v).replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#039;",'"':"&quot;"}[c]));
  const validUrl=v=>/^https?:\/\//i.test(clean(v));
  const store=new Map();
  let rendering=false;
  let lastKey="";
  let observer=null;

  const TYPE_RULES=[
    ["dog_food",/\b(dog food|dog treats?|puppy food|canine food)\b/i],
    ["air_conditioner",/\b(air conditioners?|air conditioner|portable ac|mini split|ductless ac|\bac\b)\b/i],
    ["3d_filament",/\b(3d filament|filament|pla filament|petg filament|abs filament)\b/i],
    ["power_bank",/\b(power banks?|powerbank|portable chargers?|battery pack)\b/i],
    ["smartwatch",/\b(smart ?watch|apple watch|wearable watch)\b/i],
    ["headphones",/\b(headphones?|headsets?|earbuds?|earphones?|tws|airpods?|soundcore|jlab)\b/i],
    ["perfume",/\b(perfumes?|fragrances?|cologne|eau de parfum|eau de toilette|edp|edt)\b/i],
    ["laptop",/\b(laptops?|notebooks?|thinkpad|ideapad|thinkbook|chromebook|macbook|legion|lenovo|vivobook)\b/i],
    ["phone",/\b(phones?|smartphones?|iphone|oneplus|xiaomi|redmi|galaxy|samsung|pixel|motorola|moto|oppo|vivo|realme)\b/i],
    ["cookware",/\b(cookware|pots?|pans?|frying pan|saucepan|casserole)\b/i],
    ["lighting",/\b(lighting|lights?|led|lamp|bulb|light strip)\b/i],
    ["tools",/\b(tools?|drill|saw|multimeter|oscilloscope|workshop|screwdriver|wrench)\b/i],
  ];

  function inferType(query){
    const q=clean(query).toLowerCase();
    for(const [type,re] of TYPE_RULES){
      if(re.test(q)) return type;
    }
    return "";
  }

  function tokens(query){
    return clean(query).toLowerCase()
      .replace(/[^a-z0-9]+/g," ")
      .split(/\s+/)
      .filter(x=>x.length>1 && !["for","the","and","with","from","best","buy"].includes(x));
  }

  function score(row,query,type){
    const q=clean(query).toLowerCase();
    const hay=clean(row.search||`${row.brand||""} ${row.name||""}`).toLowerCase();
    if(!q || q===type.replaceAll("_"," ")) return 100;
    const ts=tokens(query);
    if(!ts.length) return 1;
    let n=0;
    for(const t of ts){
      if(hay.includes(t)) n+=1;
    }
    if(n===ts.length) return 200+n;
    if(n) return 50+n;
    return 0;
  }

  async function loadType(type){
    if(store.has(type)) return store.get(type);
    const url=`/data/search-v20-6/comparison-v20-6-4/browse-lite/${encodeURIComponent(type)}.json?v=${VERSION}`;
    const r=await fetch(url,{cache:"no-store",headers:{accept:"application/json"}});
    if(!r.ok) throw new Error(`browse-lite ${type}: ${r.status}`);
    const data=await r.json();
    if(!data || !Array.isArray(data.products)) throw new Error(`invalid browse-lite ${type}`);
    store.set(type,data);
    return data;
  }

  function money(row){
    const p=Number(row.price);
    if(!(p>0)) return "Price at seller";
    const cur=clean(row.currency||"USD").toUpperCase();
    return `From ${cur==="USD"?"US$":cur+" "}${p.toLocaleString(undefined,{maximumFractionDigits:2})}`;
  }

  function exactUrl(row){
    const u=new URL(location.href);
    u.searchParams.set("engine","v2064");
    u.searchParams.set("q",clean(row.name));
    u.searchParams.set("tpid",clean(row.tpid));
    return u.pathname+"?"+u.searchParams.toString();
  }

  function card(row){
    const image=validUrl(row.image)
      ? `<img src="${esc(row.image)}" alt="" loading="lazy" referrerpolicy="no-referrer" style="width:100%;height:100%;object-fit:contain">`
      : `<div style="display:grid;place-items:center;width:100%;height:100%;font-weight:800;font-size:1.35rem">TP</div>`;

    return `<article data-v206621-card="${esc(row.tpid)}" style="display:grid;grid-template-columns:minmax(120px,32%) 1fr;background:#fff;border:1px solid rgba(19,38,35,.12);border-radius:24px;overflow:hidden;min-height:250px">
      <div style="background:#f3f6f5;min-height:250px;padding:18px;display:grid;place-items:center">${image}</div>
      <div style="padding:22px;display:flex;flex-direction:column;justify-content:center;gap:12px">
        ${row.brand?`<div style="font-weight:800;color:#3260d9">${esc(row.brand)}</div>`:""}
        <h3 style="margin:0;font-size:1.25rem;line-height:1.2">${esc(row.name)}</h3>
        <strong style="font-size:1.45rem">${esc(money(row))}</strong>
        <div style="display:flex;gap:8px;flex-wrap:wrap;color:#5c6765">
          <span>${Number(row.sellerCount||0)} seller${Number(row.sellerCount||0)===1?"":"s"}</span>
          <span>•</span>
          <span>${Number(row.variantCount||0)} variant${Number(row.variantCount||0)===1?"":"s"}</span>
        </div>
        <a class="tp-btn tp-btn-primary" href="${esc(exactUrl(row))}" style="width:max-content;max-width:100%">Compare sellers</a>
      </div>
    </article>`;
  }

  function updateSellerFilter(rows){
    const sel=$("[data-filter-merchant]");
    if(!sel) return;
    const current=clean(sel.value);
    const sellers=[...new Set(rows.flatMap(r=>Array.isArray(r.sellers)?r.sellers:[]).map(clean).filter(Boolean))].sort();
    sel.innerHTML='<option value="">All sellers</option>'+sellers.map(s=>`<option value="${esc(s)}">${esc(s)}</option>`).join("");
    if(sellers.includes(current)) sel.value=current;
  }

  function filtered(rows){
    const seller=clean($("[data-filter-merchant]")?.value||"");
    const price=clean($("[data-filter-price]")?.value||"");
    const sort=clean($("[data-filter-sort]")?.value||"smart");
    let out=rows.slice();

    if(seller){
      out=out.filter(r=>Array.isArray(r.sellers)&&r.sellers.includes(seller));
    }

    if(price){
      out=out.filter(r=>{
        const p=Number(r.price);
        if(!(p>0)) return false;
        if(price==="0-10") return p<10;
        if(price==="10-25") return p>=10&&p<25;
        if(price==="25-50") return p>=25&&p<50;
        if(price==="50-100") return p>=50&&p<100;
        if(price==="100+") return p>=100;
        return true;
      });
    }

    if(sort==="price-low") out.sort((a,b)=>(Number(a.price)||1e15)-(Number(b.price)||1e15));
    if(sort==="price-high") out.sort((a,b)=>(Number(b.price)||-1)-(Number(a.price)||-1));
    if(sort==="smart") out.sort((a,b)=>(b.__score||0)-(a.__score||0)||Number(b.sellerCount||0)-Number(a.sellerCount||0));

    return out;
  }

  async function render(query,{replaceHistory=false}={}){
    if(!active() || rendering) return;
    const type=inferType(query);
    if(!type) return;

    rendering=true;
    try{
      const key=`${type}|${clean(query).toLowerCase()}`;
      lastKey=key;

      const data=await loadType(type);
      let rows=data.products.map(r=>({...r,__score:score(r,query,type)}));
      const isBroad=clean(query).toLowerCase()===type.replaceAll("_"," ")
        || ["phone","phones","smartphone","smartphones","headphones","perfume","laptop","tools","lighting","cookware","smartwatch","power bank","dog food","air conditioner","3d filament"].includes(clean(query).toLowerCase());

      const scored=rows.filter(r=>isBroad || r.__score>0);
      if(scored.length) rows=scored;

      updateSellerFilter(rows);
      rows=filtered(rows);

      const grid=$("[data-tp-product-grid]");
      const title=$("[data-tp-results-title]");
      const status=$("[data-tp-finder-status]");
      const count=$("[data-tp-results-count]");
      const tabs=$("[data-tp-result-tabs]");
      const more=$("[data-tp-load-more]");
      if(!grid) return;

      if(replaceHistory){
        const u=new URL(location.href);
        u.searchParams.set("engine","v2064");
        u.searchParams.set("q",clean(query));
        u.searchParams.delete("tpid");
        history.replaceState(null,"",u.pathname+"?"+u.searchParams.toString());
      }

      grid.dataset.v206621Rescue="1";
      grid.innerHTML=rows.slice(0,60).map(card).join("") || '<div class="tp-empty"><h3>No TPID product choices found.</h3><p>Try another product model or category.</p></div>';

      if(title) title.textContent=`Choose a product to compare for “${clean(query)}”`;
      if(status) status.textContent="TPID master products. Select one to compare its seller offers.";
      if(count) count.textContent=`${rows.length} master products`;
      if(tabs) tabs.innerHTML="";
      if(more) more.hidden=true;

      const input=$("[data-tp-finder-input]");
      if(input) input.value=clean(query);

      window.__TP_V206621_LAST_RENDER__={version:VERSION,type,query:clean(query),count:rows.length};
    }catch(error){
      console.error("TrendPilot V20.6.6.2.1 lite browse rescue failed",error);
    }finally{
      rendering=false;
    }
  }

  function currentQuery(){
    return params().get("q") || clean($("[data-tp-finder-input]")?.value||"");
  }

  function boot(){
    if(!active()) return;

    const form=$("[data-tp-finder-form]");
    if(form){
      document.addEventListener("submit",e=>{
        if(!active() || e.target!==form) return;
        const q=clean($("[data-tp-finder-input]")?.value||"");
        if(!inferType(q)) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        render(q,{replaceHistory:true});
      },true);
    }

    document.addEventListener("change",e=>{
      if(!active()) return;
      if(e.target.matches("[data-filter-merchant],[data-filter-price],[data-filter-sort]")){
        render(currentQuery());
      }
    },true);

    render(currentQuery());

    const grid=$("[data-tp-product-grid]");
    if(grid){
      observer=new MutationObserver(()=>{
        if(!active() || rendering) return;
        const text=clean(grid.textContent).toLowerCase();
        const lost=grid.dataset.v206621Rescue!=="1";
        const failed=text.includes("comparison package could not be loaded")
          || text.includes("products could not be displayed");
        if((lost||failed) && inferType(currentQuery())){
          setTimeout(()=>render(currentQuery()),20);
        }
      });
      observer.observe(grid,{childList:true,subtree:true,characterData:true});
    }

    setTimeout(()=>{
      if(active() && inferType(currentQuery())) render(currentQuery());
    },1200);
  }

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",boot,{once:true});
  }else{
    boot();
  }
})();
