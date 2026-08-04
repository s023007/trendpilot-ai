(() => {
  "use strict";

  const d = document;
  const $ = (s, r = d) => r.querySelector(s);
  const $$ = (s, r = d) => Array.from(r.querySelectorAll(s));
  const clean = (v) => String(v ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  const lower = (v) => clean(v).toLowerCase();
  const esc = (v) => clean(v).replace(/[&<>'"]/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#039;",'"':"&quot;"}[c]));
  const validUrl = (v) => /^https?:\/\//i.test(clean(v));
  const money = (p) => Number.isFinite(Number(p.price)) && Number(p.price) > 0 ? `${clean(p.currency) || "USD"} ${Number(p.price).toFixed(2)}` : "Check price";
  const debounce = (fn, wait = 120) => { let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); }; };
  const STOP = new Set(["a","an","and","are","as","at","be","best","buy","by","for","from","good","in","is","it","latest","me","my","need","new","of","on","or","product","products","the","to","want","with","find","looking","official","online","store","shop","sale","hot"]);
  const words = (v) => lower(v).replace(/[\u2010-\u2015]/g,"-").replace(/[^a-z0-9+.#%\- ]+/g," ").split(/\s+/).map(x => x.replace(/^[.\-+]+|[.\-+]+$/g,"")).filter(x => x.length > 1 && !STOP.has(x));
  const uniq = (arr) => [...new Set(arr.filter(Boolean))];
  const safeId = (v) => lower(v).replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"") || "item";

  const GROUP_LABELS = {
    "apparel":"Clothing","footwear":"Shoes","bags-accessories":"Bags & accessories","jewelry-watches":"Jewelry & eyewear",
    "beauty-care":"Beauty","baby-kids":"Baby & kids","pet-supplies":"Pet supplies","phones-tablets":"Phones & tablets",
    "computers":"Computers","audio":"Audio","cameras":"Cameras","projectors-tv":"TV & projectors","smart-home":"Smart home",
    "automotive":"Car electronics","home-kitchen":"Home & kitchen","tools":"Tools","office-school":"Office & school",
    "toys-games":"Toys & games","sports-outdoors":"Sports & outdoors","printing-3d":"Printing & 3D","software":"Software",
    "business-sourcing":"Business sourcing","other":"More products"
  };
  const BROAD_ROUTES = [
    {match:/\b(clothing|clothes|apparel|fashion)\b/i,groups:["apparel","footwear","bags-accessories","jewelry-watches"],label:"Fashion"},
    {match:/\b(electronic|electronics|tech|technology|gadget|gadgets)\b/i,groups:["phones-tablets","computers","audio","cameras","projectors-tv","smart-home"],label:"Electronics"},
    {match:/\b(home|house|household)\b/i,groups:["home-kitchen","smart-home","tools"],label:"Home"},
    {match:/\b(kid|kids|children|child|baby)\b/i,groups:["baby-kids","toys-games","apparel","footwear"],label:"Kids"},
    {match:/\b(outdoor|outdoors|fitness|sport|sports)\b/i,groups:["sports-outdoors","footwear","apparel"],label:"Sports & outdoors"},
    {match:/\b(car|cars|automotive|vehicle)\b/i,groups:["automotive","phones-tablets","audio"],label:"Car accessories"},
    {match:/\b(office|school|stationery)\b/i,groups:["office-school","computers","printing-3d"],label:"Office & school"},
  ];
  const SYNONYMS = [
    ["clothing","clothes","apparel","fashion","wear"],["shoe","shoes","footwear","sneaker","sneakers","trainer","trainers"],
    ["mobile","phone","phones","smartphone","iphone","android"],["earbuds","earphones","headphones","headset","tws"],
    ["laptop","notebook","computer","pc"],["television","tv","projector","streaming"],["pet","dog","cat","puppy","kitten"],
    ["feeder","feeding","food dispenser","automatic feeder"],["bag","bags","handbag","backpack","luggage"],
    ["glasses","eyeglasses","frames","eyewear","sunglasses"],["supplier","manufacturer","factory","wholesale","sourcing"],
    ["video editor","video editing","filmora","capcut"],["printer","printing","thermal printer","label printer"],
    ["smart light","led strip","lighting","govee"],["dress","dresses","gown"],["shirt","shirts","top","tops","blouse","t-shirt"],
  ];
  const GUIDE_MAP = {
    apparel:{title:"Choose clothing by fit, fabric and use",intro:"Start with who it is for and where it will be worn. Then compare material, sizing evidence and return terms.",checks:["Check the seller's size chart, not only S/M/L","Prefer listings with fabric composition","Confirm returns before choosing a fitted item"]},
    footwear:{title:"Fit comes before style",intro:"Use foot length and width, then compare materials, sole type and return cost.",checks:["Measure both feet","Check the listing's exact size chart","Look for sole and upper material"]},
    "phones-tablets":{title:"Match the device to the job",intro:"Compare operating system, storage, network support and warranty before small feature differences.",checks:["Confirm network bands and region","Check storage and memory","Compare warranty and returns"]},
    computers:{title:"Buy for your real workload",intro:"Processor, memory, screen and upgrade options should match the work you actually do.",checks:["Choose enough RAM for your apps","Check screen size and resolution","Confirm keyboard, warranty and region"]},
    audio:{title:"Comfort and connection matter",intro:"Compare fit, battery, microphone quality and codec support—not only claimed sound quality.",checks:["Check device compatibility","Compare battery with case","Read microphone and comfort evidence"]},
    "pet-supplies":{title:"Choose around the pet's routine",intro:"Safety, capacity, cleaning and reliable power matter more than extra buttons.",checks:["Confirm pet size and food type","Check cleaning access","Look for backup power or safe failure mode"]},
    "home-kitchen":{title:"Check dimensions before features",intro:"Measure the available space, confirm power requirements and compare cleaning and returns.",checks:["Measure the installation space","Confirm voltage and plug","Check parts, cleaning and warranty"]},
    "smart-home":{title:"Compatibility first",intro:"Confirm the app, Wi-Fi standard and smart-home ecosystem before comparing colours or automations.",checks:["Works with your phone and ecosystem","Correct Wi-Fi or hub requirement","Clear update and privacy support"]},
    automotive:{title:"Vehicle compatibility first",intro:"Confirm model year, connector and existing system before ordering any car electronic accessory.",checks:["Match vehicle and model year","Confirm connector and voltage","Check update and return route"]},
    tools:{title:"Choose the tool for the material",intro:"Compare capacity, included accessories, power source and safety—not only maximum headline numbers.",checks:["Correct capacity and material","Battery/voltage matches","Consumables and warranty available"]},
    "beauty-care":{title:"Ingredients and use come first",intro:"Check the intended skin/hair type, ingredients, device voltage and return policy.",checks:["Suitable for your intended use","Check ingredients or device specs","Avoid unclear claims and sellers"]},
    default:{title:"Compare the details that change the decision",intro:"Use product type, size, compatibility, seller terms and total delivered price to narrow the list.",checks:["Confirm the exact model","Compare total cost, not headline price","Check delivery, warranty and returns"]}
  };

  const catalogue = {manifest:null,cache:new Map(),all:[],results:[],query:"",plan:null,shown:24};
  const selected = new Map();
  let compatibilityKey = "";

  function initChrome(){
    const button = $("[data-tp-menu-button]"); const nav = $("[data-tp-nav]"); const close = $("[data-tp-menu-close]"); const backdrop = $("[data-tp-nav-backdrop]");
    if(button && nav){
      const set = (open) => {nav.classList.toggle("is-open",open);backdrop?.classList.toggle("is-open",open);d.body.classList.toggle("tp-menu-open",open);button.setAttribute("aria-expanded",String(open));};
      button.addEventListener("click",()=>set(!nav.classList.contains("is-open")));close?.addEventListener("click",()=>set(false));backdrop?.addEventListener("click",()=>set(false));nav.addEventListener("click",e=>{if(e.target.closest("a"))set(false)});d.addEventListener("keydown",e=>{if(e.key==="Escape")set(false)});
    }
    $$('[data-year]').forEach(el=>el.textContent=String(new Date().getFullYear()));
  }

  function normalizeProduct(p){
    const copy={...p}; copy.id=clean(copy.id||copy.canonicalKey||copy.url||copy.name); copy.name=clean(copy.name); copy.url=clean(copy.url||copy.affiliateUrl||copy.productUrl); copy.image=clean(copy.image||copy.imageUrl); copy.advertiser=clean(copy.advertiser||copy.network||"Current seller"); copy.group=clean(copy.group||"other"); copy.family=clean(copy.family||copy.group); copy.audience=clean(copy.audience||"all"); copy.subtype=clean(copy.subtype||copy.family.replace(/-/g," ")); copy.quality=Number(copy.quality||copy.qualityScore||copy.matchScore||0)||0; return copy;
  }
  async function loadManifest(){
    if(catalogue.manifest)return catalogue.manifest;
    try{const r=await fetch(`/data/search-catalog/manifest.json?v=11-${Date.now()}`,{cache:"no-store"});if(!r.ok)throw new Error(r.status);catalogue.manifest=await r.json();return catalogue.manifest;}catch(err){
      const fallback=Object.values(window.TRENDPILOT_MATCHED_PRODUCTS||{}).flat().filter(Boolean).map(normalizeProduct); catalogue.all=fallback; catalogue.manifest={version:"fallback",groups:[],tokenRoutes:{},featured:fallback.slice(0,24),productCount:fallback.length}; return catalogue.manifest;
    }
  }
  async function loadGroup(id){
    if(catalogue.cache.has(id))return catalogue.cache.get(id);
    const promise=(async()=>{const manifest=await loadManifest();const row=(manifest.groups||[]).find(g=>g.id===id);if(!row)return[];try{const r=await fetch(`${row.file}?v=${encodeURIComponent(manifest.generatedAt||manifest.version||11)}`,{cache:"force-cache"});if(!r.ok)throw new Error(r.status);const data=await r.json();return(data.products||[]).map(normalizeProduct);}catch(e){console.warn("TrendPilot group unavailable",id,e);return[];}})();
    catalogue.cache.set(id,promise);return promise;
  }
  function planQuery(query,manifest){
    const q=lower(query);const original=words(q);const expanded=new Set(original);let groups=[];let broad=false;let broadLabel="";
    const route=BROAD_ROUTES.find(r=>r.match.test(q));if(route){groups.push(...route.groups);broad=true;broadLabel=route.label;}
    const broadTerms=new Set(["clothing","clothes","apparel","fashion","electronics","electronic","shoes","footwear","pet","pets","pet supplies","home","home and kitchen","computers","audio","cameras","tools","sports","outdoors","beauty","baby","kids"]);
    for(const group of manifest.groups||[]){for(const alias of group.aliases||[]){const a=lower(alias);if(a&&(q===a||q.includes(a))){groups.push(group.id);words(a).forEach(x=>expanded.add(x));if(q===a&&broadTerms.has(a))broad=true;}}}
    original.forEach(t=>(manifest.tokenRoutes?.[t]||[]).forEach(g=>groups.push(g)));
    SYNONYMS.forEach(set=>{if(set.some(s=>q.includes(s))){set.flatMap(words).forEach(x=>expanded.add(x));}});
    if(!groups.length){groups=(manifest.groups||[]).filter(g=>g.id!=="business-sourcing"&&g.id!=="software").slice(0,6).map(g=>g.id);}
    groups=uniq(groups).filter(g=>(manifest.groups||[]).some(row=>row.id===g)).slice(0,6);
    return{q,original,expanded:[...expanded],groups,broad,broadLabel};
  }
  function productText(p){return lower([p.name,p.brand,p.category,p.group,p.family,p.subtype,p.audience,p.description].join(" "));}
  function tokenMatch(textTokens,term){
    return textTokens.some(token=>token===term||token===`${term}s`||token===`${term}es`||term===`${token}s`||term===`${token}es`||(term.length>=5&&(token.startsWith(term)||term.startsWith(token))));
  }
  function scoreProduct(p,plan){
    const hay=productText(p),name=lower(p.name),cat=lower(`${p.category} ${p.group} ${p.family} ${p.subtype} ${p.audience}`),brand=lower(p.brand);
    const nameTokens=words(name),brandTokens=words(brand),catTokens=words(cat),hayTokens=words(hay);let score=0,hits=0;
    if(plan.q&&plan.q.length>3&&name.includes(plan.q)){score+=130;hits+=Math.max(1,plan.original.length)}
    for(const t of plan.original){if(tokenMatch(nameTokens,t)){score+=38;hits++}else if(tokenMatch(brandTokens,t)){score+=26;hits++}else if(tokenMatch(catTokens,t)){score+=22;hits++}else if(tokenMatch(hayTokens,t)){score+=7;hits++}}
    for(const t of plan.expanded){if(plan.original.includes(t))continue;if(tokenMatch(nameTokens,t))score+=8;else if(tokenMatch(catTokens,t))score+=5}
    if(plan.groups.includes(p.group))score+=plan.broad?24:12;
    if(plan.broad&&plan.groups.includes(p.group))hits=Math.max(hits,1);
    if(plan.original.includes("women")&&["men","kids"].includes(p.audience))return 0;
    if(plan.original.includes("men")&&["women","kids"].includes(p.audience))return 0;
    if((plan.original.includes("kids")||plan.original.includes("children"))&&["women","men"].includes(p.audience))return 0;
    if(!hits)return 0;
    if(p.image)score+=5;if(Number(p.price)>0)score+=3;score+=Math.min(10,p.quality/10);
    if(plan.original.includes("women")&&p.audience==="women")score+=30;if(plan.original.includes("men")&&p.audience==="men")score+=30;if((plan.original.includes("kids")||plan.original.includes("children"))&&p.audience==="kids")score+=30;
    return score;
  }
  function diversify(rows,limit=90){
    const buckets=new Map();rows.forEach(p=>{const k=`${lower(p.group)}|${lower(p.advertiser)}`;if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push(p)});const keys=[...buckets.keys()].sort((a,b)=>buckets.get(a).length-buckets.get(b).length);const out=[];let active=keys;while(active.length&&out.length<limit){const next=[];for(const k of active){const b=buckets.get(k);if(b.length&&out.length<limit)out.push(b.shift());if(b.length)next.push(k)}active=next}return out;
  }
  async function runSearch(query){
    const manifest=await loadManifest();const plan=planQuery(query,manifest);catalogue.plan=plan;catalogue.query=query;catalogue.shown=24;
    let rows=(await Promise.all(plan.groups.map(loadGroup))).flat();if(!rows.length)rows=(manifest.featured||[]).map(normalizeProduct);
    const seen=new Set();rows=rows.filter(p=>{const key=p.id||p.url;if(!key||seen.has(key)||!p.name||!validUrl(p.url))return false;seen.add(key);return true});catalogue.all=rows;
    catalogue.results=diversify(rows.map(p=>({...p,__score:scoreProduct(p,plan)})).filter(p=>p.__score>0).sort((a,b)=>b.__score-a.__score||b.quality-a.quality),90);
    return catalogue.results;
  }

  function merchantKey(v){return lower(v).replace(/\b(many geos|affiliate program|ww|eu|cps|online)\b/g," ").replace(/[^a-z0-9]+/g,"").trim();}
  function coupons(){const x=window.TREND_PILOT_COUPONS||window.TRENDPILOT_COUPONS||{};return Array.isArray(x)?x:(x.coupons||[]);}
  function couponFor(p){
    const m=merchantKey(p.advertiser);const pwords=new Set(words(`${p.name} ${p.category} ${p.family} ${p.brand}`));const hints=["iphone","ipad","scooter","printer","filament","glasses","frames","shoe","laptop","tablet","monitor","camera","headphone","earbud","light","case","dress","shirt","bag","watch","tool","drill"];
    const ranked=coupons().filter(c=>c.status!=="inactive"&&(!c.end_at||Date.parse(c.end_at)>Date.now()-86400000)).map(c=>{
      const cm=merchantKey(`${c.merchant_name||""} ${c.merchant_key||""}`);if(!cm||!(cm.includes(m)||m.includes(cm)))return null;const text=lower(`${c.title||""} ${c.description||""} ${(c.categories||[]).join(" ")}`);let score=Number(c.priority_score||c.rating||0);let productSpecific=false;for(const h of hints){if(text.includes(h)){productSpecific=true;if([...pwords].some(w=>h.includes(w)||w.includes(h)))score+=35;else score-=45}}if(!productSpecific)score+=12;if(c.code)score+=8;if(c.exclusive)score+=3;return score>0?{...c,__score:score}:null}).filter(Boolean).sort((a,b)=>b.__score-a.__score);return ranked[0]||null;
  }
  function couponLabel(c){if(!c)return"";return clean(c.discount?.text||c.title||"Current saving");}

  function imageMarkup(p,small=false){
    const bad=/placeholder|no[-_ ]?image|default[-_ ]?image|transparent|spacer|blank\.(gif|png)|logo(?!.*product)/i;
    if(validUrl(p.image)&&!bad.test(p.image))return `<img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy" decoding="async" referrerpolicy="no-referrer" data-tp-product-image${small?' data-small="1"':''}>`;
    return fallbackMarkup(p);
  }
  function fallbackMarkup(p){const initials=(clean(p.advertiser)||"TP").split(/\s+/).slice(0,2).map(x=>x[0]).join("").toUpperCase();return `<span class="tp-product-fallback"><span><b>${esc(initials)}</b><span>Verified image unavailable</span></span></span>`;}
  function bindImages(root=d){
    $$('img[data-tp-product-image]',root).forEach(img=>{if(img.dataset.bound)return;img.dataset.bound="1";const fail=()=>{const host=img.parentElement;if(!host)return;img.replaceWith(fragment(fallbackMarkup({advertiser:host.closest('[data-product-id]')?.dataset.advertiser||"TP"})));};img.addEventListener("error",fail,{once:true});img.addEventListener("load",()=>{if(img.naturalWidth<100||img.naturalHeight<100||img.naturalWidth/img.naturalHeight>5||img.naturalHeight/img.naturalWidth>5)fail()},{once:true});if(img.complete&&(img.naturalWidth<100||img.naturalHeight<100))fail();});
  }
  function fragment(html){const t=d.createElement("template");t.innerHTML=html.trim();return t.content.firstElementChild;}
  function reasonFor(p,plan){
    const matches=plan.original.filter(t=>productText(p).includes(t));if(matches.length)return `Matches ${matches.slice(0,3).join(", ")} · ${GROUP_LABELS[p.group]||p.category||"product"}`;
    return `${GROUP_LABELS[p.group]||p.category||"Relevant category"} · ${clean(p.subtype)||"current option"}`;
  }
  function cardMarkup(p,placement="finder",compare=true){
    const c=couponFor(p),isSel=selected.has(p.id),allowed=!selected.size||isSel||comparisonKey(p)===compatibilityKey;
    return `<article class="tp-product-card" data-product-id="${esc(p.id)}" data-advertiser="${esc(p.advertiser)}">
      <a class="tp-product-media" href="${esc(p.url)}" target="_blank" rel="sponsored nofollow noopener" data-placement="${esc(placement)}">${imageMarkup(p)}
        <span class="tp-badge-row">${c?`<span class="tp-badge tp-badge-coupon">Saving available</span>`:`<span class="tp-badge tp-badge-match">Relevant match</span>`}<span></span></span>
      </a><div class="tp-product-body"><div class="tp-product-source"><span>${esc(p.advertiser)}</span><span>Available now</span></div>
      <h3>${esc(p.name)}</h3><div class="tp-product-price"><strong>${esc(money(p))}</strong>${p.oldPrice?`<del>${esc((p.currency||"USD")+" "+Number(p.oldPrice).toFixed(2))}</del>`:""}</div>
      <p class="tp-product-reason">${esc(reasonFor(p,catalogue.plan||{original:[]}))}</p>
      ${c?`<div class="tp-coupon-line"><strong>${esc(couponLabel(c))}</strong>${c.code?`<button type="button" data-copy-code="${esc(c.code)}">Copy ${esc(c.code)}</button>`:`<span>Auto deal</span>`}</div>`:""}
      <div class="tp-card-actions${compare?'':' tp-card-actions-single'}"><a class="tp-btn tp-btn-primary tp-btn-small" href="${esc(p.url)}" target="_blank" rel="sponsored nofollow noopener">View product ↗</a>${compare?`<button class="tp-compare-toggle" type="button" data-compare-id="${esc(p.id)}" aria-label="${isSel?'Remove from':'Add to'} comparison" aria-pressed="${isSel}" ${allowed?'':'disabled'}>${isSel?'✓':'+'}</button>`:''}</div></div></article>`;
  }
  function comparisonKey(p){
    const sameFamily=catalogue.results.filter(x=>x.family===p.family).length;if(p.family&&p.family!==p.group&&sameFamily>=3)return `${p.group}|${p.family}`;return p.group;
  }
  function selectedProduct(id){return catalogue.all.find(p=>p.id===id)||catalogue.results.find(p=>p.id===id);}
  function toggleCompare(id){
    if(selected.has(id)){selected.delete(id);if(!selected.size)compatibilityKey="";}else{const p=selectedProduct(id);if(!p||selected.size>=3)return;const key=comparisonKey(p);if(selected.size&&key!==compatibilityKey)return;compatibilityKey=key;selected.set(id,p);}renderFinderProducts();renderTray();
  }
  function renderTray(){
    const tray=$("[data-tp-compare-tray]");if(!tray)return;tray.classList.toggle("is-open",selected.size>0);$("[data-tp-tray-count]",tray).textContent=`${selected.size} of 3 selected`;const list=$("[data-tp-tray-items]",tray);list.innerHTML=[...selected.values()].map(p=>`<div class="tp-tray-item">${imageMarkup(p,true)}<b>${esc(p.name)}</b><button type="button" data-remove-compare="${esc(p.id)}" aria-label="Remove">×</button></div>`).join("");const open=$("[data-tp-open-compare]",tray);open.disabled=selected.size<2;bindImages(list);
  }
  function openCompare(){
    if(selected.size<2)return;const modal=$("[data-tp-compare-dialog]");const grid=$("[data-tp-compare-grid]",modal);grid.innerHTML=[...selected.values()].map((p,i)=>{const c=couponFor(p);return `<article class="tp-compare-column"><div class="tp-product-media">${imageMarkup(p)}</div><div class="tp-compare-copy"><span class="tp-kicker">Option ${i+1}</span><h3>${esc(p.name)}</h3><dl class="tp-specs"><div><dt>Price</dt><dd>${esc(money(p))}</dd></div><div><dt>Seller</dt><dd>${esc(p.advertiser)}</dd></div><div><dt>Type</dt><dd>${esc(p.subtype||GROUP_LABELS[p.group]||p.group)}</dd></div><div><dt>Saving</dt><dd>${esc(c?couponLabel(c):"None matched")}</dd></div></dl>${c?.code?`<div class="tp-coupon-line"><strong>Code: ${esc(c.code)}</strong><button type="button" data-copy-code="${esc(c.code)}">Copy</button></div>`:""}<a class="tp-btn tp-btn-primary tp-btn-wide" href="${esc(p.url)}" target="_blank" rel="sponsored nofollow noopener">Check product details ↗</a></div></article>`}).join("");modal.classList.add("is-open");modal.setAttribute("aria-hidden","false");d.body.classList.add("tp-dialog-open");bindImages(grid);
  }
  function closeCompare(){const modal=$("[data-tp-compare-dialog]");modal?.classList.remove("is-open");modal?.setAttribute("aria-hidden","true");d.body.classList.remove("tp-dialog-open");}

  function activeFilters(){return{group:$("[data-filter-group]")?.value||"",merchant:$("[data-filter-merchant]")?.value||"",audience:$("[data-filter-audience]")?.value||"",price:$("[data-filter-price]")?.value||"",coupon:$("[data-filter-coupon]")?.checked||false,sort:$("[data-filter-sort]")?.value||"smart"};}
  function filteredResults(){
    const f=activeFilters();let rows=catalogue.results.filter(p=>{if(f.group&&p.group!==f.group)return false;if(f.merchant&&p.advertiser!==f.merchant)return false;if(f.audience&&p.audience!==f.audience&&p.audience!=="all"&&p.audience!=="unisex")return false;if(f.coupon&&!couponFor(p))return false;if(f.price){const n=Number(p.price)||0;const[a,b]=f.price.split("-").map(Number);if(f.price==="100+"){if(n<100)return false}else if(!n||n<a||n>b)return false}return true});
    if(f.sort==="price-low")rows.sort((a,b)=>(Number(a.price)||1e9)-(Number(b.price)||1e9));else if(f.sort==="price-high")rows.sort((a,b)=>(Number(b.price)||-1)-(Number(a.price)||-1));else if(f.sort==="quality")rows.sort((a,b)=>b.quality-a.quality);return rows;
  }
  function guideFor(){const group=activeFilters().group||catalogue.results[0]?.group||"default";return GUIDE_MAP[group]||GUIDE_MAP.default;}
  function renderGuide(){const box=$("[data-tp-smart-guide]");if(!box)return;const g=guideFor();box.innerHTML=`<div><span class="tp-kicker">Quick buying guide</span><h2>${esc(g.title)}</h2><p>${esc(g.intro)}</p></div><ul>${g.checks.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>`;}
  function renderTabs(){const host=$("[data-tp-category-tabs]");if(!host)return;const counts=new Map();catalogue.results.forEach(p=>counts.set(p.group,(counts.get(p.group)||0)+1));const current=activeFilters().group;host.innerHTML=`<button type="button" data-tab-group="" aria-pressed="${!current}">All <small>${catalogue.results.length}</small></button>`+[...counts.entries()].sort((a,b)=>b[1]-a[1]).map(([g,n])=>`<button type="button" data-tab-group="${esc(g)}" aria-pressed="${current===g}">${esc(GROUP_LABELS[g]||g)} <small>${n}</small></button>`).join("");
  }
  function populateFilters(){
    const groups=uniq(catalogue.results.map(p=>p.group));
    const merchants=uniq(catalogue.results.map(p=>p.advertiser)).sort();
    const gs=$("[data-filter-group]");
    const ms=$("[data-filter-merchant]");
    if(gs){
      const val=gs.value;
      gs.innerHTML=`<option value="">All categories</option>${groups.map(g=>`<option value="${esc(g)}">${esc(GROUP_LABELS[g]||g)}</option>`).join("")}`;
      gs.value=groups.includes(val)?val:"";
    }
    if(ms){
      const val=ms.value;
      ms.innerHTML=`<option value="">All sellers</option>${merchants.map(m=>`<option value="${esc(m)}">${esc(m)}</option>`).join("")}`;
      ms.value=merchants.includes(val)?val:"";
    }
  }
  function renderFinderProducts(){
    const grid=$("[data-tp-product-grid]");if(!grid)return;const rows=filteredResults();const shown=rows.slice(0,catalogue.shown);const count=$("[data-tp-results-count]");if(count)count.textContent=`${rows.length} relevant options`;const title=$("[data-tp-results-title]");if(title)title.textContent=catalogue.query?`Results for “${catalogue.query}”`:"Popular products";
    grid.innerHTML=shown.length?shown.map(p=>cardMarkup(p)).join(""):`<div class="tp-empty" style="grid-column:1/-1"><h2>No close match after these filters</h2><p>Clear a filter or search with a product type, model or problem. We avoid filling the page with unrelated listings.</p><button class="tp-btn tp-btn-light" type="button" data-reset-filters>Clear filters</button></div>`;
    const more=$("[data-tp-load-more]");if(more)more.classList.toggle("tp-hidden",shown.length>=rows.length);renderTabs();renderGuide();bindImages(grid);renderTray();
  }
  async function performFinderSearch(query,push=true){
    query=clean(query);if(!query)return;const grid=$("[data-tp-product-grid]");if(grid)grid.innerHTML=Array.from({length:6},()=>`<div class="tp-skeleton"></div>`).join("");const status=$("[data-tp-finder-status]");if(status)status.textContent="Finding close matches across connected product feeds…";
    selected.clear();compatibilityKey="";await runSearch(query);populateFilters();renderFinderProducts();if(status)status.textContent=catalogue.results.length?`Showing relevant matches first. Use filters to narrow the list.`:"No close matches found.";if(push){const u=new URL(location.href);u.searchParams.set("q",query);history.pushState({},"",u)};
  }
  function initFinder(){
    const form=$("[data-tp-finder-form]");if(!form)return;const input=$("[data-tp-finder-input]",form);form.addEventListener("submit",e=>{e.preventDefault();performFinderSearch(input.value)});$$('[data-search-suggestion]').forEach(el=>el.addEventListener("click",()=>{input.value=el.dataset.searchSuggestion;performFinderSearch(input.value)}));
    $$('[data-filter-group],[data-filter-merchant],[data-filter-audience],[data-filter-price],[data-filter-coupon],[data-filter-sort]').forEach(el=>el.addEventListener("change",()=>{catalogue.shown=24;renderFinderProducts()}));
    d.addEventListener("click",e=>{const tab=e.target.closest("[data-tab-group]");if(tab){const select=$("[data-filter-group]");if(select)select.value=tab.dataset.tabGroup;catalogue.shown=24;renderFinderProducts();return}const cmp=e.target.closest("[data-compare-id]");if(cmp){toggleCompare(cmp.dataset.compareId);return}const rm=e.target.closest("[data-remove-compare]");if(rm){toggleCompare(rm.dataset.removeCompare);return}if(e.target.closest("[data-tp-open-compare]")){openCompare();return}if(e.target.closest("[data-tp-close-compare]")){closeCompare();return}if(e.target.closest("[data-tp-clear-compare]")){selected.clear();compatibilityKey="";renderFinderProducts();return}if(e.target.closest("[data-tp-tray-toggle]")){$("[data-tp-compare-tray]")?.classList.toggle("is-collapsed");return}if(e.target.closest("[data-tp-load-more]")){catalogue.shown+=24;renderFinderProducts();return}if(e.target.closest("[data-reset-filters]")){resetFilters();return}});
    $("[data-tp-filter-toggle]")?.addEventListener("click",()=>$("[data-tp-filter-panel]")?.classList.toggle("is-expanded"));
    $("[data-tp-compare-dialog]")?.addEventListener("click",e=>{if(e.target.matches("[data-tp-compare-dialog]"))closeCompare()});d.addEventListener("keydown",e=>{if(e.key==="Escape")closeCompare()});
    const query=new URL(location.href).searchParams.get("q")||"electronics";input.value=query;performFinderSearch(query,false);
  }
  function resetFilters(){['[data-filter-group]','[data-filter-merchant]','[data-filter-audience]','[data-filter-price]'].forEach(s=>{const x=$(s);if(x)x.value=""});const c=$("[data-filter-coupon]");if(c)c.checked=false;const sort=$("[data-filter-sort]");if(sort)sort.value="smart";catalogue.shown=24;renderFinderProducts();}

  async function renderHomepageProducts(){
    const host=$("[data-tp-home-products]");if(!host)return;const manifest=await loadManifest();let rows=(manifest.featured||[]).map(normalizeProduct).filter(p=>p.name&&validUrl(p.url));if(rows.length<8){const groups=(manifest.groups||[]).slice(0,4).map(g=>g.id);rows=[...rows,...(await Promise.all(groups.map(loadGroup))).flat()];}const seen=new Set();rows=rows.filter(p=>{if(seen.has(p.id))return false;seen.add(p.id);return true}).slice(0,8);catalogue.plan={original:[]};host.innerHTML=rows.map(p=>cardMarkup(p,"homepage",false)).join("");bindImages(host);
  }
  function initHomeSearch(){
    $$('[data-tp-home-search]').forEach(form=>form.addEventListener("submit",e=>{e.preventDefault();const q=clean($("input",form)?.value);if(q)location.href=`/find/?q=${encodeURIComponent(q)}`}));
  }

  function copyCode(button){const code=button.dataset.copyCode;if(!code)return;navigator.clipboard?.writeText(code).catch(()=>{});button.textContent="Copied";setTimeout(()=>button.textContent=`Copy ${code}`,1300);}
  function renderDeals(){
    const host=$("[data-tp-deal-grid]");if(!host)return;const search=$("[data-tp-deal-search]");const merchant=$("[data-tp-deal-merchant]");const all=coupons().filter(c=>c.status!=="inactive"&&(!c.end_at||Date.parse(c.end_at)>Date.now()-86400000));const merchants=uniq(all.map(c=>clean(c.merchant_name))).sort();merchant.innerHTML=`<option value="">All merchants</option>${merchants.map(m=>`<option>${esc(m)}</option>`).join("")}`;
    const draw=()=>{const q=lower(search.value),m=merchant.value;const rows=all.filter(c=>(!m||c.merchant_name===m)&&(!q||lower(`${c.title} ${c.description} ${c.merchant_name} ${c.code}`).includes(q))).sort((a,b)=>(b.priority_score||0)-(a.priority_score||0)).slice(0,60);host.innerHTML=rows.length?rows.map(c=>`<article class="tp-deal-card"><small>${esc(c.merchant_name||"Current merchant")}</small><h3>${esc(c.title||couponLabel(c))}</h3><p>${esc(c.description||"Confirm the saving and terms on the merchant page.")}</p><div class="tp-deal-code">${c.code?`<b>${esc(c.code)}</b><button type="button" data-copy-code="${esc(c.code)}">Copy</button>`:`<b>Automatic deal</b>`}</div><a class="tp-btn tp-btn-primary tp-btn-small tp-btn-wide" href="${esc(c.url||c.campaign_url||'#')}" target="_blank" rel="sponsored nofollow noopener">Open deal ↗</a></article>`).join(""):`<div class="tp-empty" style="grid-column:1/-1"><h2>No matching saving</h2><p>Try another merchant or product word.</p></div>`;};search.addEventListener("input",debounce(draw));merchant.addEventListener("change",draw);draw();
  }

  function upgradeEditorial(){
    if(d.body.dataset.tpPage==="home"||d.body.dataset.tpPage==="finder"||d.body.dataset.tpHub)return;const main=$("main");if(!main)return;
    const h1=$("h1",main);if(!h1)return;main.classList.add("tp-editorial-wrap");const progress=d.createElement("div");progress.className="tp-article-progress";d.body.appendChild(progress);const headings=$$("h2",main);if(headings.length>=3){const toc=d.createElement("nav");toc.className="tp-toc";toc.innerHTML="<strong>On this page</strong>"+headings.slice(0,8).map((h,i)=>{if(!h.id)h.id=`section-${i+1}`;return `<a href="#${esc(h.id)}">${esc(h.textContent)}</a>`}).join("");h1.after(toc)}
    const update=()=>{const max=d.documentElement.scrollHeight-innerHeight;progress.style.width=`${max>0?Math.min(100,scrollY/max*100):0}%`};addEventListener("scroll",update,{passive:true});update();
    $$('img',main).forEach(img=>{img.addEventListener("error",()=>img.closest("figure")?.remove()||img.remove(),{once:true})});
    const replacements=[[/(affiliate disclosure|affiliate links?|affiliate programme|affiliate program)/ig,"How product links work"],[/research before recommendation/ig,"Choose with clearer evidence"],[/commission/ig,"commercial relationship"]];
    const walker=d.createTreeWalker(main,NodeFilter.SHOW_TEXT);const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);nodes.forEach(n=>{if(n.parentElement?.closest("script,style,code,pre"))return;let t=n.nodeValue;replacements.forEach(([a,b])=>t=t.replace(a,b));n.nodeValue=t});
  }

  function initGlobalEvents(){d.addEventListener("click",e=>{const btn=e.target.closest("[data-copy-code]");if(btn)copyCode(btn)});}

  async function boot(){initChrome();initGlobalEvents();initHomeSearch();initFinder();renderHomepageProducts();renderDeals();upgradeEditorial();}
  if(d.readyState==="loading")d.addEventListener("DOMContentLoaded",boot);else boot();
})();
