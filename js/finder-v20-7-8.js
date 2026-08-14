(() => {
  "use strict";

  const VERSION = "20.7.8";
  const d = document;
  const $ = (s, r = d) => r.querySelector(s);
  const clean = v => String(v ?? "").replace(/\s+/g, " ").trim();
  const lower = v => clean(v).toLowerCase();
  const esc = v => clean(v).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const validUrl = v => /^https?:\/\//i.test(clean(v));
  const params = new URLSearchParams(location.search);

  const BLOCKED = new Set(["temu","joom","filamentpro","filamentpro eu cps"]);
  const TYPE_FILES = {
    phone: "phone",
    laptop: "laptop",
    perfume: "perfume",
    smartwatch: "smartwatch",
    headphones: "headphones",
    power_bank: "power_bank",
    dog_food: "dog_food",
    air_conditioner: "air_conditioner",
    "3d_filament": "3d_filament",
    cookware: "cookware",
    lighting: "lighting",
    tools: "tools"
  };
  const TYPE_LABELS = {
    phone:"Phone", laptop:"Laptop", perfume:"Fragrance", smartwatch:"Smart watch",
    headphones:"Audio", power_bank:"Power bank", dog_food:"Dog food",
    air_conditioner:"Air conditioner", "3d_filament":"3D filament",
    cookware:"Cookware", lighting:"Lighting", tools:"Tools"
  };
  const TYPE_GROUP = {
    phone:["phones-tablets","smartphones"], laptop:["computers","laptops"], perfume:["beauty-care","perfume"],
    smartwatch:["jewelry-watches","smartwatch"], headphones:["audio","headphones"], power_bank:["phones-tablets","power-banks"],
    dog_food:["pet-supplies","dog-food"], air_conditioner:["home-kitchen","air-conditioner"],
    "3d_filament":["printing-3d","3d-filament"], cookware:["home-kitchen","cookware"],
    lighting:["home-kitchen","lighting"], tools:["tools","tools"]
  };

  const PHONE_FALSE = /\b(?:case|cases|cover|covers|screen protector|tempered glass|sim(?: card)? tray|sim holder|battery|bateria|replacement|repair|charging port|charger|charging cable|usb cable|data cable|flex cable|digitizer|lcd|display assembly|motherboard|back glass|housing|phone holder|phone stand|phone mount|car mount|tripod|selfie stick|strap|lanyard|wallet|game controller|gamepad|joystick|trigger|game handle|cooler|cooling fan|power bank|earbuds?|earphones?|headphones?|headsets?|smart ?watch|tablet|ipad|ssd enclosure|m\.?2 enclosure|adapter|dongle|dock|telescope|telephoto|monocular|binocular|microscope|camera lens|lens kit|packaging|packing box|phone box|empty box|protective film|sticker|skin|keyboard|stylus)\b/i;
  const PHONE_FITMENT = /\b(?:for|fits?|compatible with|replacement for)\s+(?:apple\s+)?(?:iphone|galaxy|samsung|pixel|xiaomi|redmi|oneplus|poco|oppo|vivo|realme|motorola|moto|honor|huawei|nokia|sony|zte)\b/i;
  const PHONE_MODEL = /\b(?:iphone\s*(?:[5-9x]|1[0-9])(?:\s*(?:pro|max|plus|mini|e|s|se))?|samsung\s+galaxy\s+[a-zmfsz]\s*\d+|galaxy\s+(?:s|a|m|f|z)\s*\d+|google\s+pixel\s+\d+|pixel\s+\d+|oneplus\s+\d+[a-z]?(?:\s+pro)?|xiaomi\s+(?:mi\s+)?\d+[a-z]?(?:\s+pro)?|redmi\s+(?:note\s+)?[a-z0-9]+|poco\s+[a-z]\d+|oppo\s+[a-z0-9]+|vivo\s+[a-z0-9]+|realme\s+[a-z0-9]+|motorola\s+(?:moto\s+)?[a-z0-9]+|moto\s+[a-z0-9]+|honor\s+[a-z0-9]+|huawei\s+(?:mate|p|nova)\s*\d+|nokia\s+[a-z0-9.]+|sony\s+xperia\s+[a-z0-9]+|nothing\s+phone\s*\(?\d+\)?|asus\s+(?:rog\s+phone|zenfone)\s*\d+|zte\s+[a-z0-9]+|nubia\s+[a-z0-9]+|infinix\s+[a-z0-9]+|tecno\s+[a-z0-9]+)\b/i;
  const GENERIC_PHONE = /\b(?:smart ?phone|mobile phone|cell phone|android phone|unlocked phone|5g phone)\b/i;
  const PHONE_HW = /\b(?:android\s*\d*|dual sim|single sim|5g|4g|lte|gsm|snapdragon|dimensity|helio|octa[- ]?core|\d+\s*gb\s+ram|\d+\s*gb\s+(?:rom|storage)|\d{3,5}\s*mah)\b/ig;

  const OTHER_FALSE = {
    laptop:/\b(?:laptop (?:case|sleeve|bag|stand|dock|charger|adapter|skin)|docking station|replacement (?:battery|keyboard|screen|hinge)|keyboard cover|screen protector|planner|journal|sticker)\b/i,
    perfume:/\b(?:organizer|display stand|storage rack|bottle holder|empty perfume bottle|empty atomizer|room spray|car perfume|diffuser)\b/i,
    smartwatch:/\b(?:watch (?:band|strap|case|cover|protector|charger|dock|stand)|replacement (?:band|strap|screen))\b/i,
    headphones:/\b(?:headphone case|earbuds? case|replacement (?:earpads?|ear pads?|cable)|headphone stand|headset stand)\b/i
  };

  const state = {
    type:"",
    query:"",
    raw:[],
    filtered:[],
    cursor:0,
    shown:[],
    pageSize:18,
    busy:false,
    metaBuckets:new Map(),
    generic:false
  };

  function sellerAllowed(name){
    const n = lower(name);
    return Boolean(n) && !BLOCKED.has(n);
  }

  function inferType(query){
    const q = lower(query);
    if (/^(?:pho|phon|phone|phones|smartp|smartph|smartpho|smartphon|smartphone|smartphones|mobile phone|mobile phones)$/i.test(q) ||
        /\b(?:iphone|galaxy|pixel|oneplus|xiaomi|redmi|poco|oppo|vivo|realme|motorola|moto|honor|huawei|nokia|xperia|nothing phone|zenfone|nubia|infinix|tecno)\b/i.test(q)) return "phone";
    if (/^(?:lap|lapt|lapto|laptop|laptops|notebook|notebooks)$/i.test(q) ||
        /\b(?:thinkpad|ideapad|thinkbook|chromebook|macbook|vivobook|zenbook|probook|elitebook|latitude|inspiron|xps|legion|surface laptop|lenovo slim)\b/i.test(q)) return "laptop";
    if (/\b(?:perfume|perfumes|fragrance|fragrances|cologne|eau de parfum|eau de toilette|edp|edt)\b/i.test(q)) return "perfume";
    if (/\b(?:smart ?watch|apple watch|wearable watch)\b/i.test(q)) return "smartwatch";
    if (/\b(?:headphones?|headsets?|earbuds?|earphones?|airpods?|tws)\b/i.test(q)) return "headphones";
    if (/\b(?:power ?bank|portable charger|battery pack)\b/i.test(q)) return "power_bank";
    if (/\b(?:dog food|dog treats?|puppy food|canine food)\b/i.test(q)) return "dog_food";
    if (/\b(?:air conditioner|portable ac|mini split|ductless ac)\b/i.test(q)) return "air_conditioner";
    if (/\b(?:3d filament|pla filament|petg filament|abs filament)\b/i.test(q)) return "3d_filament";
    if (/\b(?:cookware|frying pan|saucepan|casserole)\b/i.test(q)) return "cookware";
    if (/\b(?:lighting|led light|lamp|bulb|light strip)\b/i.test(q)) return "lighting";
    if (/\b(?:tools?|drill|saw|multimeter|oscilloscope|screwdriver|wrench)\b/i.test(q)) return "tools";
    return "";
  }

  function suffixFromTpid(tpid){
    const m = clean(tpid).match(/^TP[A-Z]{2,8}-([A-Z0-9]{8,})$/i);
    return m ? m[1].toLowerCase() : "";
  }

  async function metaFor(tpid){
    const suffix = suffixFromTpid(tpid);
    if (!suffix) return null;
    const bucket = suffix.slice(0,2);
    if (!state.metaBuckets.has(bucket)) {
      state.metaBuckets.set(bucket,
        fetch(`/data/shopper-v20-6-8-4/products/${bucket}.json?v=${VERSION}`, {
          cache:"no-store", headers:{accept:"application/json"}
        }).then(r => r.ok ? r.json() : null).catch(() => null)
      );
    }
    const data = await state.metaBuckets.get(bucket);
    return data?.[suffix] || null;
  }

  function rowText(row){
    return clean([row?.search,row?.name,row?.brand,...(Array.isArray(row?.sellers)?row.sellers:[])].join(" "));
  }

  function metaText(meta,row){
    const facts = meta?.facts && typeof meta.facts === "object" ? Object.values(meta.facts).join(" ") : "";
    return clean([meta?.title,meta?.summary,meta?.buyerNote,facts,rowText(row)].join(" "));
  }

  function strictRole(meta,row,type){
    const text = metaText(meta,row);
    if (!text) return false;
    if (type === "phone") {
      if (PHONE_FALSE.test(text) || PHONE_FITMENT.test(text)) return false;
      if (meta?.shopperType && meta.shopperType !== "phone") return false;
      if (meta?.isPhoneHandset === false) return false;
      if (PHONE_MODEL.test(text)) return true;
      if (GENERIC_PHONE.test(text)) return (text.match(PHONE_HW) || []).length >= 2;
      return false;
    }
    const bad = OTHER_FALSE[type];
    if (bad?.test(text)) return false;
    if (meta?.shopperType && state.type && meta.shopperType !== state.type) return false;
    return true;
  }

  function humanName(row){
    const raw = clean(row?.name);
    if (raw && !/^TP[A-Z]{2,8}-[A-Z0-9]{8,}$/i.test(raw)) return raw;
    const brand = clean(row?.brand);
    const s = clean(row?.search).replace(/^TP[A-Z]{2,8}-[A-Z0-9]{8,}\s*/i,"");
    if (s) {
      const stripped = brand && lower(s).startsWith(lower(brand)+" ") ? s.slice(brand.length).trim() : s;
      if (stripped && lower(stripped) !== lower(brand)) return stripped;
    }
    return brand || "Product";
  }

  function compactTitle(value){
    let t = clean(value)
      .replace(/^\[[^\]]{1,28}\]\s*/,"")
      .replace(/\b(?:factory price|hot sale|best price|original authentic|global official version|wholesale price)\b/ig,"")
      .replace(/\s+/g," ")
      .trim();
    if (t.length <= 96) return t;
    return t.slice(0,93).trimEnd()+"…";
  }

  function exactGroup(g){
    return g?.destination_exact === true || /^(?:exact-tracked|exact-direct)$/i.test(clean(g?.primary?.kind));
  }

  function dynamicTikTok(g){
    return /tiktok/i.test(clean(g?.seller)) &&
      (g?.availability === "check-live" || g?.availability_dynamic === true);
  }

  function trustedPrice(groups){
    const values=[];
    for (const g of groups) {
      if (!sellerAllowed(g?.seller) || g?.availability === "unavailable" || dynamicTikTok(g) || !exactGroup(g)) continue;
      for (const v of [g?.minPrice,g?.primary?.price]) {
        const n=Number(v);
        if (n >= 25 && n <= 5000) values.push(n);
      }
    }
    return values.length ? Math.min(...values) : 0;
  }

  function firstExactOffer(groups){
    return groups.find(g =>
      sellerAllowed(g?.seller) &&
      g?.availability !== "unavailable" &&
      !dynamicTikTok(g) &&
      exactGroup(g) &&
      validUrl(g?.primary?.url)
    ) || null;
  }

  function productRoute(meta,row){
    if (clean(meta?.route).startsWith("/product/")) return clean(meta.route);
    const s = suffixFromTpid(row?.tpid);
    return s ? `/product/item--${s}/` : "";
  }

  async function prepare(row,type){
    if (!row || !clean(row.tpid)) return null;
    if (Array.isArray(row.sellers) && row.sellers.length && !row.sellers.some(sellerAllowed)) return null;
    const meta = await metaFor(row.tpid);
    if (!strictRole(meta,row,type)) return null;

    const groups = Array.isArray(meta?.sellerGroups) ? meta.sellerGroups.filter(g => sellerAllowed(g?.seller)) : [];
    const sellers = [...new Set([
      ...groups.filter(g => g?.availability !== "unavailable").map(g => clean(g?.seller)),
      ...(Array.isArray(row.sellers) ? row.sellers.map(clean) : [])
    ].filter(sellerAllowed))];
    const route = productRoute(meta,row);
    if (!route) return null;

    const title = compactTitle(clean(meta?.title) || humanName(row));
    if (!title || /^TP[A-Z]/i.test(title)) return null;
    const image = validUrl(meta?.image) ? clean(meta.image) : (validUrl(row.image) ? clean(row.image) : "");
    const price = trustedPrice(groups);
    const liveTikTok = groups.some(dynamicTikTok);
    const exactOffer = firstExactOffer(groups);
    const brand = clean(meta?.brand || row.brand);
    const sellerCount = Math.max(1, sellers.length || Number(row.sellerCount || 0));
    const variantCount = Math.max(1, Number(row.variantCount || 1));
    const description = clean(meta?.summary) || `${TYPE_LABELS[type] || "Product"} choice — compare details and seller offers before buying.`;

    return {row,meta,title,image,price,route,brand,sellers,sellerCount,variantCount,description,liveTikTok,exactOffer,type};
  }

  async function loadType(type){
    const file = TYPE_FILES[type];
    const r = await fetch(`/data/search-v20-6/comparison-v20-6-4/browse-lite/${file}.json?v=${VERSION}`, {
      cache:"no-store", headers:{accept:"application/json"}
    });
    if (!r.ok) throw new Error(`catalogue ${type}: ${r.status}`);
    const data = await r.json();
    if (!Array.isArray(data?.products)) throw new Error(`catalogue ${type}: invalid`);
    return data.products;
  }

  function queryTokens(q){
    return lower(q).replace(/[^a-z0-9]+/g," ").split(/\s+/).filter(x => x.length > 1 && !["for","the","and","with"].includes(x));
  }

  function rowScore(row,q,type){
    const text=lower(rowText(row)), tokens=queryTokens(q);
    if (!tokens.length || /^(?:phone|phones|laptop|laptops|perfume|perfumes|headphones|smartwatch|power bank|tools)$/i.test(clean(q))) return 100;
    let n=0;
    for (const t of tokens) if (text.includes(t)) n++;
    if (n === tokens.length) return 300+n;
    if (n) return 80+n;
    return type==="phone" && /\b(?:iphone|galaxy|pixel|oneplus|xiaomi|redmi|poco|oppo|vivo|realme|motorola|honor|huawei)\b/i.test(q) ? 0 : 20;
  }

  function baseFilter(rows,q,type){
    return rows
      .filter(r => Array.isArray(r?.sellers) ? r.sellers.some(sellerAllowed) : true)
      .map(r => ({...r,__score:rowScore(r,q,type)}))
      .filter(r => r.__score > 0);
  }

  function currentFilters(){
    return {
      seller:clean($("[data-filter-merchant]")?.value || ""),
      price:clean($("[data-filter-price]")?.value || ""),
      sort:clean($("[data-filter-sort]")?.value || "smart")
    };
  }

  function applyRowFilters(rows){
    const f=currentFilters();
    let out=rows.slice();
    if (f.seller) out=out.filter(r => Array.isArray(r.sellers) && r.sellers.includes(f.seller));
    if (f.price) out=out.filter(r => {
      const p=Number(r.price);
      if (!(p>0)) return false;
      if (f.price==="0-10") return p<10;
      if (f.price==="10-25") return p>=10&&p<25;
      if (f.price==="25-50") return p>=25&&p<50;
      if (f.price==="50-100") return p>=50&&p<100;
      if (f.price==="100+") return p>=100;
      return true;
    });
    if (f.sort==="price-low") out.sort((a,b)=>(Number(a.price)||1e9)-(Number(b.price)||1e9));
    else if (f.sort==="price-high") out.sort((a,b)=>(Number(b.price)||-1)-(Number(a.price)||-1));
    else out.sort((a,b)=>(b.__score||0)-(a.__score||0)||Number(b.sellerCount||0)-Number(a.sellerCount||0)||Number(b.variantCount||0)-Number(a.variantCount||0));
    return out;
  }

  function populateSeller(rows){
    const sel=$("[data-filter-merchant]");
    if (!sel) return;
    const current=clean(sel.value);
    const sellers=[...new Set(rows.flatMap(r => Array.isArray(r.sellers)?r.sellers:[]).map(clean).filter(sellerAllowed))].sort();
    sel.innerHTML='<option value="">All sellers</option>'+sellers.map(s=>`<option value="${esc(s)}">${esc(s)}</option>`).join("");
    if (sellers.includes(current)) sel.value=current;
  }

  function priceText(p){
    return p>0 ? `From US$${p.toLocaleString(undefined,{maximumFractionDigits:2})}` : "Check current price";
  }

  function savedSet(){
    try{return new Set(JSON.parse(localStorage.getItem("trendpilot-v20-saved-tpids")||"[]"));}catch{return new Set();}
  }

  function saveSet(set){
    localStorage.setItem("trendpilot-v20-saved-tpids",JSON.stringify([...set].slice(-100)));
  }

  function legacySnapshot(item){
    const g=TYPE_GROUP[item.type]||["other","other"], offer=item.exactOffer;
    return {
      id:item.row.tpid,clusterKey:item.row.tpid,name:item.title,url:clean(offer?.primary?.url||""),
      image:item.image,images:item.image?[item.image]:[],advertiser:clean(offer?.seller||item.sellers[0]||""),
      group:g[0],family:g[1],audience:"unisex",quality:100,rating:0,reviews:0,sold:0,
      price:item.price||0,oldPrice:0,currency:"USD",shippingPrice:null,delivery:"",
      material:"",condition:"",offerCount:item.sellerCount,storeCount:item.sellerCount,
      variantCount:item.variantCount,offers:[],brand:item.brand,category:TYPE_LABELS[item.type]||"Product",
      description:item.description,specs:item.meta?.facts||{},generatedAt:new Date().toISOString()
    };
  }

  function toggleLegacyStore(key,item,max=100){
    let rows=[];
    try{rows=JSON.parse(localStorage.getItem(key)||"[]");if(!Array.isArray(rows))rows=[];}catch{}
    const id=item.row.tpid, exists=rows.some(x=>x?.id===id);
    if (exists) rows=rows.filter(x=>x?.id!==id);
    else {
      const snap=legacySnapshot(item);
      if (!validUrl(snap.url) || !sellerAllowed(snap.advertiser)) return {ok:false,exists:false};
      rows=[snap,...rows.filter(x=>x?.id!==id)].slice(0,max);
    }
    localStorage.setItem(key,JSON.stringify(rows));
    return {ok:true,exists:!exists};
  }

  function card(item){
    const saved=savedSet().has(item.row.tpid);
    const image=item.image
      ? `<img src="${esc(item.image)}" alt="${esc(item.title)}" loading="lazy" decoding="async" referrerpolicy="no-referrer">`
      : `<span class="tp78-fallback">${esc((item.brand||"TP").slice(0,2).toUpperCase())}</span>`;
    const sellerLabel=item.sellerCount===1?(item.sellers[0]||"1 seller"):`${item.sellerCount} sellers`;
    return `<article class="tp78-card" data-v2078-card="${esc(item.row.tpid)}">
      <a class="tp78-media" href="${esc(item.route)}" aria-label="View ${esc(item.title)}">${image}</a>
      <div class="tp78-body">
        <div class="tp78-top"><span class="tp78-brand">${esc(item.brand||TYPE_LABELS[item.type]||"Product")}</span><span class="tp78-source">${esc(sellerLabel)}</span></div>
        <h3><a href="${esc(item.route)}">${esc(item.title)}</a></h3>
        <div class="tp78-price">${esc(priceText(item.price))}</div>
        <div class="tp78-meta"><span>${esc(sellerLabel)}</span><span>•</span><span>${item.variantCount} variant${item.variantCount===1?"":"s"}</span></div>
        <p class="tp78-description">${esc(item.description)}</p>
        ${item.liveTikTok?'<span class="tp78-live"><i></i>TikTok availability: check live</span>':""}
        <div class="tp78-actions">
          <a class="tp78-view" href="${esc(item.route)}">View product <span aria-hidden="true">→</span></a>
          <a class="tp78-icon" href="${esc(item.route)}#seller-offers" aria-label="Open seller offers">⇄</a>
          <button class="tp78-icon${saved?" is-saved":""}" type="button" data-v2078-save="${esc(item.row.tpid)}" aria-label="${saved?"Remove saved product":"Save product"}">${saved?"♥":"♡"}</button>
        </div>
      </div>
    </article>`;
  }

  function renderCards(){
    const grid=$("[data-v2078-product-grid]");
    if (!grid) return;
    grid.innerHTML=state.shown.length?state.shown.map(card).join(""):`<div class="tp78-empty"><h3>No clean matches found.</h3><p>Try a model name or another product category.</p></div>`;
    const count=$("[data-v2078-results-count]");
    if (count) count.textContent=state.shown.length?`${state.shown.length} shown`:"No matches";
    const more=$("[data-v2078-load-more]");
    if (more) more.hidden=state.cursor>=state.filtered.length;
  }

  async function addBatch(){
    if (state.busy) return;
    state.busy=true;
    const more=$("[data-v2078-load-more]");
    if (more) {more.disabled=true;more.textContent="Loading…";}
    try{
      const added=[];
      while (added.length<state.pageSize && state.cursor<state.filtered.length){
        const chunk=state.filtered.slice(state.cursor,state.cursor+10);
        state.cursor+=chunk.length;
        const prepared=await Promise.all(chunk.map(r=>prepare(r,state.type)));
        for (const item of prepared) {
          if (item) added.push(item);
          if (added.length>=state.pageSize) break;
        }
      }
      state.shown.push(...added);
      renderCards();
    } finally {
      state.busy=false;
      if (more) {more.disabled=false;more.textContent="Show more products";}
    }
  }

  function resetResults(){
    state.filtered=applyRowFilters(state.raw);
    state.cursor=0;state.shown=[];
    const grid=$("[data-v2078-product-grid]");
    if (grid) grid.innerHTML='<div class="tp78-loading">Checking clean product identities…</div>';
    addBatch().catch(showError);
  }

  async function genericSearch(query){
    state.generic=true;
    const r=await fetch(`/api/products-v16-hybrid?q=${encodeURIComponent(query)}&limit=60&test=2078`,{cache:"no-store",headers:{accept:"application/json"}});
    if(!r.ok)throw new Error(`search HTTP ${r.status}`);
    const j=await r.json();
    const rows=j?.products||j?.results||j?.rows||j?.items||[];
    const tokens=queryTokens(query);
    const out=[];
    for(const x of Array.isArray(rows)?rows:[]){
      const title=clean(x?.name||x?.title||x?.productName),seller=clean(x?.advertiser||x?.seller||x?.merchant);
      const url=clean(x?.url||x?.affiliateUrl||x?.productUrl||x?.clickUrl),image=clean(x?.image||x?.imageUrl||x?.thumbnail);
      if(!title||!sellerAllowed(seller)||!validUrl(url))continue;
      const hay=lower(title);
      if(tokens.length&&!tokens.some(t=>hay.includes(t)))continue;
      out.push({title:compactTitle(title),seller,url,image:validUrl(image)?image:"",price:Number(x?.price)||0});
      if(out.length>=36)break;
    }
    const grid=$("[data-v2078-product-grid]");
    grid.innerHTML=out.length?out.map(x=>`<article class="tp78-card">
      <a class="tp78-media" href="${esc(x.url)}" target="_blank" rel="nofollow sponsored noopener">${x.image?`<img src="${esc(x.image)}" alt="${esc(x.title)}" loading="lazy">`:'<span class="tp78-fallback">TP</span>'}</a>
      <div class="tp78-body"><div class="tp78-top"><span class="tp78-brand">${esc(x.seller)}</span><span class="tp78-source">Seller result</span></div>
      <h3><a href="${esc(x.url)}" target="_blank" rel="nofollow sponsored noopener">${esc(x.title)}</a></h3><div class="tp78-price">${esc(x.price>0?`US$${x.price.toLocaleString(undefined,{maximumFractionDigits:2})}`:"Check current price")}</div>
      <p class="tp78-description">Open the seller to confirm the exact product, current price, stock and delivery.</p>
      <div class="tp78-actions"><a class="tp78-view" href="${esc(x.url)}" target="_blank" rel="nofollow sponsored noopener">Check seller <span>↗</span></a><span></span><span></span></div></div></article>`).join(""):`<div class="tp78-empty"><h3>No matching products found.</h3><p>Try a broader product name.</p></div>`;
    const count=$("[data-v2078-results-count]");if(count)count.textContent=out.length?`${out.length} shown`:"No matches";
    const more=$("[data-v2078-load-more]");if(more)more.hidden=true;
  }

  function setHead(type,query){
    const title=$("[data-v2078-results-title]"),status=$("[data-v2078-finder-status]");
    if(title) title.textContent=`${TYPE_LABELS[type]||"Product"} results for “${clean(query)}”`;
    if(status) status.textContent=type==="phone"
      ?"Stable handset-only cards. Accessories, replacement parts and fitment products are excluded before rendering."
      :"Stable product cards are rendered once from the selected catalogue.";
  }

  async function startSearch(query){
    const q=clean(query||"");
    if(!q)return;
    state.query=q;state.type=inferType(q);state.generic=!state.type;state.cursor=0;state.shown=[];state.metaBuckets.clear();
    const input=$("[data-tp-finder-input]");if(input)input.value=q;
    if(state.type){
      setHead(state.type,q);
      const raw=await loadType(state.type);
      state.raw=baseFilter(raw,q,state.type);
      populateSeller(state.raw);
      resetResults();
    }else{
      const title=$("[data-v2078-results-title]"),status=$("[data-v2078-finder-status]");
      if(title)title.textContent=`Search results for “${q}”`;
      if(status)status.textContent="Seller results are shown without guessing missing product identity.";
      await genericSearch(q);
    }
  }

  function navigateSearch(q,scope=""){
    const p=new URLSearchParams();p.set("q",clean(q));p.set("engine","v2064");p.set("ui","2078");if(clean(scope))p.set("scope",clean(scope));
    location.assign(`/find/?${p.toString()}`);
  }

  function showError(error){
    console.error("[TrendPilot V20.7.8 finder]",error);
    const grid=$("[data-v2078-product-grid]");
    if(grid)grid.innerHTML='<div class="tp78-empty"><h3>Products could not be displayed.</h3><p>Please try the search again.</p></div>';
    const count=$("[data-v2078-results-count]");if(count)count.textContent="Try again";
  }

  function toast(text){
    let n=$(".tp78-toast");
    if(!n){n=d.createElement("div");n.className="tp78-toast";d.body.appendChild(n);}
    n.textContent=text;n.classList.add("is-visible");setTimeout(()=>n.classList.remove("is-visible"),1800);
  }

  function initChrome(){
    const nav=$("[data-tp-nav]"),open=$("[data-tp-menu-button]"),close=$("[data-tp-menu-close]"),backdrop=$("[data-tp-nav-backdrop]");
    if(nav&&open){
      const setOpen=v=>{nav.classList.toggle("is-open",v);backdrop?.classList.toggle("is-open",v);d.body.classList.toggle("tp-menu-open",v);open.setAttribute("aria-expanded",String(v));};
      setOpen(false);open.addEventListener("click",()=>setOpen(!nav.classList.contains("is-open")));close?.addEventListener("click",()=>setOpen(false));backdrop?.addEventListener("click",()=>setOpen(false));nav.addEventListener("click",e=>{if(e.target.closest("a"))setOpen(false)});d.addEventListener("keydown",e=>{if(e.key==="Escape")setOpen(false)});
    }
    d.querySelectorAll("[data-year]").forEach(n=>n.textContent=String(new Date().getFullYear()));
    const current=location.pathname.replace(/\/+$/," ").trim()||"/";
    d.querySelectorAll(".tp-bottom-nav a").forEach(a=>{const p=new URL(a.href,location.href).pathname.replace(/\/+$/," ").trim()||"/";if(p===current||(current.startsWith("/find")&&p==="/find")){a.classList.add("active");a.setAttribute("aria-current","page")}});
  }

  function initEvents(){
    const form=$("[data-v2078-finder-form]");
    form?.addEventListener("submit",e=>{e.preventDefault();const q=clean($("[data-tp-finder-input]",form)?.value);if(q)navigateSearch(q,clean($("[data-tp-finder-scope]",form)?.value));});
    d.addEventListener("click",e=>{
      const chip=e.target.closest("[data-search-suggestion],[data-search-fill]");
      if(chip){const q=clean(chip.dataset.searchSuggestion||chip.dataset.searchFill);if(q){e.preventDefault();navigateSearch(q,clean(chip.dataset.searchScope||""));return;}}
      const save=e.target.closest("[data-v2078-save]");
      if(save){
        const id=clean(save.dataset.v2078Save),set=savedSet();
        if(set.has(id)){set.delete(id);save.classList.remove("is-saved");save.textContent="♡";save.setAttribute("aria-label","Save product");toast("Removed from saved products");}
        else{set.add(id);save.classList.add("is-saved");save.textContent="♥";save.setAttribute("aria-label","Remove saved product");toast("Product saved");}
        saveSet(set);return;
      }
    });
    $("[data-v2078-load-more]")?.addEventListener("click",()=>addBatch().catch(showError));
    d.addEventListener("change",e=>{
      if(e.target.matches("[data-filter-merchant],[data-filter-price],[data-filter-sort]")&&!state.generic)resetResults();
    });
    const toggle=$("[data-tp-filter-toggle]"),panel=$("[data-tp-filter-panel]");
    toggle?.addEventListener("click",()=>{const open=panel?.classList.toggle("is-open");toggle.setAttribute("aria-expanded",String(Boolean(open)))});
  }

  function boot(){
    d.body.classList.add("v207-public");
    initChrome();initEvents();
    const q=clean(params.get("q")||"phone");
    startSearch(q).catch(showError);
  }

  if(document.readyState==="loading")d.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
})();