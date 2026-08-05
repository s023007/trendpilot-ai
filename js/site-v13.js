(() => {
  "use strict";

  const d = document;
  const $ = (s, r = d) => r.querySelector(s);
  const $$ = (s, r = d) => Array.from(r.querySelectorAll(s));
  const clean = (v) => String(v ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  const lower = (v) => clean(v).toLowerCase();
  const esc = (v) => clean(v).replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#039;",'"':"&quot;"}[c]));
  const validUrl = (v) => /^https?:\/\//i.test(clean(v));
  const uniq = (arr) => [...new Set(arr.filter(Boolean))];
  const debounce = (fn, wait = 120) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), wait); }; };
  const fmt = new Intl.NumberFormat(undefined, {maximumFractionDigits: 0});
  const STOP = new Set(["a","an","and","are","as","at","be","best","buy","by","for","from","good","in","is","it","latest","me","my","need","new","of","on","or","product","products","the","to","want","with","find","looking","official","online","store","shop","sale","hot"]);
  const words = (v) => lower(v).replace(/[\u2010-\u2015]/g, "-").replace(/[^a-z0-9+.#%\- ]+/g, " ").split(/\s+/).map(w => w.replace(/^[.\-+]+|[.\-+]+$/g, "")).filter(w => w.length > 1 && !STOP.has(w));

  const GROUP_LABELS = {
    "apparel":"Clothing","footwear":"Shoes","bags-accessories":"Bags & accessories","jewelry-watches":"Jewelry & eyewear",
    "beauty-care":"Beauty","baby-kids":"Baby & kids","pet-supplies":"Pet supplies","phones-tablets":"Phones & tablets",
    "computers":"Computers","audio":"Audio","cameras":"Cameras","projectors-tv":"TV & projectors","smart-home":"Smart home",
    "automotive":"Car electronics","home-kitchen":"Home & kitchen","tools":"Tools","office-school":"Office & school",
    "toys-games":"Toys & games","sports-outdoors":"Sports & outdoors","printing-3d":"Printing & 3D","software":"Software",
    "business-sourcing":"Business sourcing","other":"More products"
  };
  const FAMILY_LABELS = {
    "t-shirts":"T-shirts","polo-shirts":"Polo shirts","dress-shirts":"Formal shirts","casual-shirts":"Casual shirts",
    "tops-blouses":"Tops & blouses","hoodies-sweatshirts":"Hoodies & sweatshirts","jackets":"Jackets","coats":"Coats",
    "blazers":"Blazers","sweaters-knitwear":"Sweaters & knitwear","jeans":"Jeans","trousers":"Trousers & pants",
    "shorts":"Shorts","skirts":"Skirts","dresses":"Dresses","suits":"Suits","activewear":"Activewear","swimwear":"Swimwear",
    "mens-underwear":"Men's underwear","womens-underwear":"Women's underwear","underwear":"Underwear","sleepwear":"Sleepwear","socks":"Socks",
    "running-shoes":"Running shoes","sneakers":"Sneakers","boots":"Boots","sandals":"Sandals","slippers":"Slippers","formal-shoes":"Formal shoes",
    "phone-cases":"Phone cases","power-banks":"Power banks","smartphones":"Smartphones","tablets":"Tablets","laptops":"Laptops","monitors":"Monitors",
    "earbuds":"Earbuds","headphones":"Headphones","speakers":"Speakers","portable-projector":"Portable projectors","pet-feeder":"Pet feeders",
    "pet-litter-box":"Smart litter boxes","pet-water-fountain":"Pet fountains","pet-grooming":"Pet grooming","pet-toy":"Pet toys",
    "wireless-carplay-adapter":"Wireless CarPlay adapters","car-head-unit":"Car head units","security-camera":"Security cameras",
    "robot-vacuum":"Robot vacuums","smart-lighting":"Smart lighting","thermal-printer":"Thermal printers","3d-filament":"3D filament",
    "video-editor":"Video editors","phone-utility-software":"Phone utility software","bags":"Bags","watches":"Watches","eyewear":"Eyewear"
  };

  const GROUP_ROUTES = [
    ["apparel", /\b(clothing|clothes|apparel|garments?|fashion wear)\b/i],
    ["footwear", /\b(shoes?|footwear|sneakers?|trainers?|boots?|sandals?)\b/i],
    ["pet-supplies", /\b(pets?|dogs?|cats?|puppy|kitten|pet feeder|litter box)\b/i],
    ["phones-tablets", /\b(phones?|smartphones?|iphone|android phone|tablets?|ipad)\b/i],
    ["computers", /\b(laptops?|notebooks?|computers?|mini pc|monitors?|keyboard|ssd)\b/i],
    ["audio", /\b(audio|headphones?|earbuds?|earphones?|speakers?|microphone|headset|tws)\b/i],
    ["cameras", /\b(cameras?|photography|gimbal|tripod|lens)\b/i],
    ["projectors-tv", /\b(projectors?|television|smart tv|streaming box|tv box)\b/i],
    ["smart-home", /\b(smart home|security camera|robot vacuum|smart plug|smart light|led strip)\b/i],
    ["automotive", /\b(carplay|android auto|car radio|head unit|dash cam|automotive|car accessories?)\b/i],
    ["home-kitchen", /\b(home|kitchen|cookware|furniture|household|bedding|cleaning)\b/i],
    ["tools", /\b(tools?|drill|saw|workshop|multimeter|oscilloscope|test equipment)\b/i],
    ["sports-outdoors", /\b(sports?|fitness|gym|camping|cycling|outdoors?|yoga|hiking)\b/i],
    ["beauty-care", /\b(beauty|skincare|skin care|makeup|hair care|personal care)\b/i],
    ["software", /\b(software|video editor|pdf editor|license|subscription|filmora|dr\.fone|mobiletrans)\b/i],
    ["business-sourcing", /\b(supplier|manufacturer|wholesale|private label|custom logo|bulk order|factory)\b/i]
  ];
  const FAMILY_ROUTES = [
    ["wireless-carplay-adapter", /\b(wireless carplay|carplay adapter|carplay dongle)\b/i],
    ["pet-feeder", /\b(pet feeder|automatic feeder|food dispenser|cat feeder|dog feeder)\b/i],
    ["pet-litter-box", /\b(litter box|cat toilet|self cleaning litter)\b/i],
    ["running-shoes", /\b(running shoes?|jogging shoes?|trail running shoes?)\b/i],
    ["t-shirts", /\b(t[- ]?shirts?|tshirts?|tee(?: shirts?)?|crew[- ]?neck tees?|graphic tees?|cotton tees?)\b/i],
    ["polo-shirts", /\b(polo shirts?|polo tees?)\b/i],
    ["dress-shirts", /\b(dress shirts?|formal shirts?|business shirts?)\b/i],
    ["casual-shirts", /\b(casual shirts?|button[- ]?down shirts?|long sleeve shirts?|short sleeve shirts?)\b/i],
    ["hoodies-sweatshirts", /\b(hoodies?|sweatshirts?)\b/i],
    ["jackets", /\b(jackets?|windbreakers?|bomber jackets?)\b/i],
    ["coats", /\b(coats?|overcoats?|trench coats?|parkas?)\b/i],
    ["jeans", /\b(jeans?|denim jeans?)\b/i],
    ["trousers", /\b(trousers?|dress pants?|chinos?|cargo pants?|pants)\b/i],
    ["shorts", /\b(shorts?|bermuda shorts?)\b/i],
    ["dresses", /\b(dresses?|gowns?|abaya)\b/i],
    ["mens-underwear", /\b(men'?s underwear|boxers?|boxer briefs?)\b/i],
    ["womens-underwear", /\b(women'?s underwear|lingerie|bras?|panties)\b/i],
    ["laptops", /\b(laptops?|notebook computers?)\b/i],
    ["smartphones", /\b(smartphones?|mobile phones?|iphone)\b/i],
    ["tablets", /\b(tablets?|ipad)\b/i],
    ["power-banks", /\b(power banks?|portable battery chargers?)\b/i],
    ["earbuds", /\b(earbuds?|tws|in[- ]ear headphones?|earphones?)\b/i],
    ["headphones", /\b(headphones?|headsets?|over[- ]ear)\b/i],
    ["portable-projector", /\b(portable projectors?|mini projectors?|home projectors?)\b/i],
    ["security-camera", /\b(security cameras?|ip cameras?|cctv|baby monitor)\b/i],
    ["robot-vacuum", /\b(robot(?:ic)? vacuums?)\b/i],
    ["smart-lighting", /\b(smart lights?|led strips?|light strips?|smart bulbs?)\b/i],
    ["thermal-printer", /\b(thermal printers?|label printers?|receipt printers?)\b/i],
    ["video-editor", /\b(video editors?|video editing|filmora|capcut)\b/i],
    ["phone-utility-software", /\b(dr\.fone|mobiletrans|phone transfer|phone recovery)\b/i]
  ];

  const AUDIENCE_LABELS = {men:"Men", women:"Women", kids:"Kids", unisex:"Unisex", all:"Audience not stated"};
  const state = {
    manifest: null, query: "", plan: null, segments: [], segmentState: new Map(), products: [], exact: [], alternatives: [],
    shown: 24, activeTab: "exact", loading: false
  };
  const compareStore = "trendpilot-v13-compare";
  const savedStore = "trendpilot-v13-saved";
  const targetStore = "trendpilot-v13-targets";

  function readStore(key, fallback = []) { try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch { return fallback; } }
  function writeStore(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }
  function normalizeProduct(p) {
    const x = {...p};
    x.id = clean(x.id || x.clusterKey || x.url || x.name);
    x.clusterKey = clean(x.clusterKey || x.id);
    x.name = clean(x.name);
    x.url = clean(x.url || x.affiliateUrl || x.productUrl);
    x.image = clean(x.image || x.imageUrl);
    x.advertiser = clean(x.advertiser || x.network || "Current seller");
    x.group = clean(x.group || "other");
    x.family = clean(x.family || x.group);
    x.audience = clean(x.audience || "all");
    x.quality = Number(x.quality || x.qualityScore || 0) || 0;
    x.rating = Number(x.rating || 0) || 0;
    x.reviews = Number(x.reviews || 0) || 0;
    x.offerCount = Number(x.offerCount || (Array.isArray(x.offers) ? x.offers.length : 1)) || 1;
    x.storeCount = Number(x.storeCount || x.offerCount) || 1;
    x.price = Number(x.price || 0) || 0;
    x.oldPrice = Number(x.oldPrice || 0) || 0;
    x.shippingPrice = x.shippingPrice === undefined ? null : Number(x.shippingPrice);
    return x;
  }

  async function loadManifest() {
    if (state.manifest) return state.manifest;
    try {
      const r = await fetch(`/data/search-catalog/manifest.json?v=13-${Date.now()}`, {cache:"no-store"});
      if (!r.ok) throw new Error(`manifest ${r.status}`);
      const m = await r.json();
      if (!Array.isArray(m.segments)) throw new Error("V13 segments missing");
      state.manifest = m;
      return m;
    } catch (e) {
      console.error("TrendPilot V13 catalogue unavailable", e);
      const rows = Object.values(window.TRENDPILOT_MATCHED_PRODUCTS || {}).flat().filter(Boolean).map(normalizeProduct);
      state.manifest = {version:"fallback", productCount:rows.length, segments:[], featured:rows.slice(0,24), rareUsed:[], dealCandidates:[], tokenRoutes:{}, groups:[]};
      state.products = rows;
      return state.manifest;
    }
  }

  function initChrome() {
    const nav = $("[data-tp-nav]"), open = $("[data-tp-menu-button]"), close = $("[data-tp-menu-close]"), backdrop = $("[data-tp-nav-backdrop]");
    if (nav && open) {
      const setOpen = (value) => {
        nav.classList.toggle("is-open", value); backdrop?.classList.toggle("is-open", value); d.body.classList.toggle("tp-menu-open", value);
        open.setAttribute("aria-expanded", String(value));
      };
      setOpen(false);
      open.addEventListener("click", () => setOpen(!nav.classList.contains("is-open")));
      close?.addEventListener("click", () => setOpen(false)); backdrop?.addEventListener("click", () => setOpen(false));
      nav.addEventListener("click", e => { if (e.target.closest("a")) setOpen(false); });
      d.addEventListener("keydown", e => { if (e.key === "Escape") setOpen(false); });
    }
    $$('[data-year]').forEach(n => n.textContent = String(new Date().getFullYear()));
    updateHeaderCounts();
  }

  function inferAudience(q) {
    if (/\b(kids?|children|child|boys?|girls?|toddler|baby|infant)\b/i.test(q)) return "kids";
    if (/\b(women'?s|womens|women|woman|female|ladies)\b/i.test(q)) return "women";
    if (/\b(men'?s|mens|men|man|male|gentlemen)\b/i.test(q)) return "men";
    if (/\bunisex\b/i.test(q)) return "unisex";
    return "";
  }
  function inferFamily(q) { return (FAMILY_ROUTES.find(([, re]) => re.test(q)) || [""])[0]; }
  function inferGroups(q, manifest) {
    if (/\b(electronics?|tech|technology|gadgets?)\b/i.test(q)) return ["phones-tablets","computers","audio","cameras","projectors-tv","smart-home","automotive"];
    if (/\b(fashion)\b/i.test(q)) return ["apparel","footwear","bags-accessories","jewelry-watches"];
    const direct = GROUP_ROUTES.filter(([, re]) => re.test(q)).map(([g]) => g);
    if (direct.length) return uniq(direct);
    const routes = [];
    words(q).forEach(t => (manifest.tokenRoutes?.[t] || []).forEach(key => routes.push(key.split("|")[0])));
    return uniq(routes).slice(0,6);
  }
  function makePlan(q, manifest) {
    const audience = inferAudience(q), family = inferFamily(q), groups = inferGroups(q, manifest);
    if (family && !groups.length) {
      const hit = manifest.segments.find(s => s.family === family);
      if (hit) groups.push(hit.group);
    }
    let segmentKeys = [];
    const allSegments = manifest.segments || [];
    if (family) {
      segmentKeys = allSegments.filter(s => s.family === family && (!groups.length || groups.includes(s.group)) && (!audience || s.audience === audience)).map(s => s.key);
    } else if (groups.length) {
      segmentKeys = allSegments.filter(s => groups.includes(s.group) && (!audience || s.audience === audience)).map(s => s.key);
    } else {
      words(q).forEach(t => segmentKeys.push(...(manifest.tokenRoutes?.[t] || [])));
      segmentKeys = uniq(segmentKeys).slice(0,18);
    }
    if (!segmentKeys.length) segmentKeys = allSegments.slice(0,18).map(s => s.key);
    const alternativeKeys = family ? allSegments.filter(s => (!groups.length || groups.includes(s.group)) && s.family !== family && (!audience || [audience,"unisex"].includes(s.audience))).slice(0,12).map(s => s.key) : [];
    const intentTokens = words(q).filter(t => !["men","mens","women","womens","kids","kid","children","child","tshirt","tshirts","shirt","shirts","tee","tees"].includes(t));
    return {q:lower(q), groups, family, audience, segmentKeys:uniq(segmentKeys), alternativeKeys:uniq(alternativeKeys), intentTokens, exactIntent:Boolean(family || audience || groups.length)};
  }

  function segmentMeta(key) { return state.manifest?.segments?.find(s => s.key === key); }
  async function loadSegmentPage(key, page) {
    const meta = segmentMeta(key); if (!meta || page < 1 || page > meta.pages) return [];
    const st = state.segmentState.get(key) || {loaded:new Set(), next:1, done:false};
    if (st.loaded.has(page)) return [];
    st.loaded.add(page); st.next = Math.max(st.next, page + 1); st.done = st.next > meta.pages; state.segmentState.set(key, st);
    try {
      const file = meta.files?.[page - 1]; if (!file) return [];
      const r = await fetch(`${file}?v=${encodeURIComponent(state.manifest.generatedAt || 13)}`, {cache:"force-cache"});
      if (!r.ok) throw new Error(`${r.status}`);
      const data = await r.json(); return (data.products || []).map(normalizeProduct);
    } catch (e) { console.warn("Segment page unavailable", key, page, e); return []; }
  }
  async function loadInitialSegments() {
    const keys = state.plan.segmentKeys;
    const specific = Boolean(state.plan.family || state.plan.audience);
    const maxKeys = specific ? Math.min(keys.length, 8) : Math.min(keys.length, 12);
    const pagesPerKey = specific && keys.length <= 2 ? 2 : 1;
    const jobs = [];
    for (const key of keys.slice(0,maxKeys)) for (let p=1;p<=pagesPerKey;p++) jobs.push(loadSegmentPage(key,p));
    for (const key of (state.plan.alternativeKeys || []).slice(0,6)) jobs.push(loadSegmentPage(key,1));
    return (await Promise.all(jobs)).flat();
  }
  async function loadNextSegmentPages() {
    const jobs = [];
    for (const key of state.plan.segmentKeys) {
      const st = state.segmentState.get(key) || {next:1,done:false,loaded:new Set()};
      if (!st.done) jobs.push(loadSegmentPage(key, st.next));
      if (jobs.length >= 6) break;
    }
    return (await Promise.all(jobs)).flat();
  }

  function strictProductMatch(p, plan) {
    if (plan.groups.length && !plan.groups.includes(p.group)) return false;
    if (plan.family && p.family !== plan.family) return false;
    if (plan.audience && p.audience !== plan.audience) return false;
    if (plan.family || plan.audience) return true;
    const title = lower(`${p.name} ${p.brand || ""} ${p.category || ""} ${p.family || ""}`);
    const tokens = words(title);
    return plan.intentTokens.length ? plan.intentTokens.every(t => tokens.some(x => x === t || x.startsWith(t) || t.startsWith(x))) : true;
  }
  function relatedMatch(p, plan) {
    if (plan.groups.length && !plan.groups.includes(p.group)) return false;
    if (plan.audience && ![plan.audience,"unisex"].includes(p.audience)) return false;
    if (plan.family && p.family === plan.family) return false;
    return true;
  }
  function score(p, plan) {
    let n = p.quality / 10 + (p.image ? 6 : 0) + (p.price ? 4 : 0) + Math.min(8,p.rating) + Math.min(8,Math.log10(p.reviews + 1) * 2);
    const title = lower(p.name), q = plan.q;
    if (q && title.includes(q)) n += 100;
    plan.intentTokens.forEach(t => { if (title.includes(t)) n += 22; else if (lower(`${p.brand} ${p.category}`).includes(t)) n += 8; });
    if (plan.family && p.family === plan.family) n += 60;
    if (plan.audience && p.audience === plan.audience) n += 40;
    return n;
  }
  function mergeProducts(rows) {
    const map = new Map(state.products.map(p => [p.clusterKey || p.id,p]));
    rows.forEach(p => { const key=p.clusterKey||p.id; if (!map.has(key) || score(p,state.plan)>score(map.get(key),state.plan)) map.set(key,p); });
    state.products = [...map.values()];
    state.exact = state.products.filter(p => strictProductMatch(p,state.plan)).sort((a,b)=>score(b,state.plan)-score(a,state.plan));
    state.alternatives = state.products.filter(p => relatedMatch(p,state.plan)).sort((a,b)=>score(b,state.plan)-score(a,state.plan));
  }

  function currency(p) { return clean(p.currency || "USD"); }
  function money(value, code="USD") { if (!Number(value)) return "Price not supplied"; try { return new Intl.NumberFormat(undefined,{style:"currency",currency:code,maximumFractionDigits:2}).format(value); } catch { return `${code} ${Number(value).toFixed(2)}`; } }
  function totalPrice(p) { return p.price + (Number.isFinite(p.shippingPrice) ? p.shippingPrice : 0); }
  function discount(p) { return p.oldPrice > p.price && p.price > 0 ? Math.round((p.oldPrice-p.price)/p.oldPrice*100) : 0; }
  function familyLabel(p) { return FAMILY_LABELS[p.family] || clean(p.family).split(":").pop().replace(/-/g," ") || GROUP_LABELS[p.group] || "Product"; }
  function imageMarkup(p) {
    if (validUrl(p.image) && !/placeholder|no[-_ ]?image|spacer|transparent|blank/i.test(p.image)) return `<img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy" decoding="async" referrerpolicy="no-referrer" data-tp-image>`;
    return `<span class="tp-product-fallback"><b>${esc((p.advertiser||"TP").slice(0,2).toUpperCase())}</b><span>Image unavailable</span></span>`;
  }
  function bindImages(root=d) {
    $$('img[data-tp-image]',root).forEach(img => {
      if (img.dataset.bound) return; img.dataset.bound="1";
      const fail=()=>{ const host=img.parentElement; if(host) img.replaceWith(Object.assign(d.createElement("span"),{className:"tp-product-fallback",innerHTML:"<b>TP</b><span>Image unavailable</span>"})); };
      img.addEventListener("error",fail,{once:true}); img.addEventListener("load",()=>{if(img.naturalWidth<100||img.naturalHeight<100)fail();},{once:true});
    });
  }
  function savedIds() { return new Set(readStore(savedStore,[]).map(p=>p.id)); }
  function compareIds() { return new Set(readStore(compareStore,[]).map(p=>p.id)); }
  function snapshot(p) { const keep=["id","clusterKey","name","url","image","advertiser","group","family","audience","quality","rating","reviews","price","oldPrice","currency","shippingPrice","delivery","material","condition","offerCount","storeCount","offers"]; return Object.fromEntries(keep.filter(k=>p[k]!==undefined).map(k=>[k,p[k]])); }
  function productCard(p, compact=false) {
    const saved=savedIds().has(p.id), compared=compareIds().has(p.id), off=discount(p), total=totalPrice(p);
    return `<article class="tp-product-card${compact?' tp-product-card-compact':''}" data-product-id="${esc(p.id)}">
      <div class="tp-product-media">${imageMarkup(p)}${off?`<span class="tp-deal-badge">Seller −${off}%</span>`:""}</div>
      <div class="tp-product-content">
        <div class="tp-card-top"><span>${esc(p.advertiser)}</span><b>${esc(familyLabel(p))}</b></div>
        <h3>${esc(p.name)}</h3>
        <div class="tp-price-row"><strong>${money(p.price,currency(p))}</strong>${p.oldPrice>p.price?`<del>${money(p.oldPrice,currency(p))}</del>`:""}</div>
        <div class="tp-card-evidence">
          ${p.storeCount>1?`<span>${p.storeCount} stores</span>`:`<span>${p.offerCount||1} offer</span>`}
          ${p.rating?`<span>★ ${p.rating.toFixed(1)}${p.reviews?` (${fmt.format(p.reviews)})`:""}</span>`:""}
          ${p.delivery?`<span>${esc(p.delivery)}</span>`:""}
          ${p.shippingPrice!==null?`<span>Total ${money(total,currency(p))}</span>`:""}
        </div>
        <div class="tp-card-actions">
          <a class="tp-btn tp-btn-primary tp-view-offer" href="${esc(p.url)}" target="_blank" rel="nofollow sponsored noopener">View product ↗</a>
          <button class="tp-icon-button${compared?' is-active':''}" data-compare-id="${esc(p.id)}" type="button" aria-label="${compared?'Remove from':'Add to'} comparison">⇄</button>
          <button class="tp-icon-button${saved?' is-active':''}" data-save-id="${esc(p.id)}" type="button" aria-label="${saved?'Remove from':'Save to'} price watch">${saved?'♥':'♡'}</button>
        </div>
      </div></article>`;
  }

  function activeProducts() { return state.activeTab === "related" ? state.alternatives : state.exact; }
  function filters() {
    return {
      group:$('[data-filter-group]')?.value||"", family:$('[data-filter-family]')?.value||"", audience:$('[data-filter-audience]')?.value||"",
      merchant:$('[data-filter-merchant]')?.value||"", price:$('[data-filter-price]')?.value||"", sort:$('[data-filter-sort]')?.value||"smart",
      coupon:$('[data-filter-coupon]')?.checked||false, rare:$('[data-filter-rare]')?.checked||false
    };
  }
  function couponFor(p) {
    const rows=Array.isArray(window.TREND_PILOT_COUPONS)?window.TREND_PILOT_COUPONS:(window.TREND_PILOT_COUPONS?.coupons||window.TRENDPILOT_COUPONS?.coupons||[]);
    const merchant=lower(p.advertiser).replace(/\b(ww|eu|cps|online|affiliate program)\b/g," ").replace(/[^a-z0-9]+/g,"");
    return rows.find(c=>{const cm=lower(`${c.merchant_name||""} ${c.merchant_key||""}`).replace(/[^a-z0-9]+/g,""); return cm&&(cm.includes(merchant)||merchant.includes(cm))&&c.status!=="inactive";})||null;
  }
  function filterProducts(rows) {
    const f=filters();
    let out=rows.filter(p=>{
      if(f.group&&p.group!==f.group)return false; if(f.family&&p.family!==f.family)return false; if(f.audience&&p.audience!==f.audience)return false;
      if(f.merchant&&p.advertiser!==f.merchant)return false; if(f.coupon&&!couponFor(p))return false; if(f.rare&&!(p.rareScore>=4&&["used","refurbished","open-box"].includes(p.condition)))return false;
      if(f.price){const [lo,hi]=f.price.split("-"); if(f.price.endsWith("+")&&p.price<Number(lo.replace("+","")))return false; if(hi&&!(p.price>=Number(lo)&&p.price<Number(hi)))return false;}
      return true;
    });
    if(f.sort==="price-low")out.sort((a,b)=>(a.price||1e12)-(b.price||1e12));
    if(f.sort==="price-high")out.sort((a,b)=>(b.price||0)-(a.price||0));
    if(f.sort==="rating")out.sort((a,b)=>b.rating-a.rating||b.reviews-a.reviews);
    if(f.sort==="delivery")out.sort((a,b)=>Number(Boolean(b.delivery))-Number(Boolean(a.delivery))||score(b,state.plan)-score(a,state.plan));
    if(f.sort==="quality")out.sort((a,b)=>b.quality-a.quality);
    return out;
  }

  function populateFilters() {
    const rows=state.products;
    const group=$('[data-filter-group]'), family=$('[data-filter-family]'), audience=$('[data-filter-audience]'), merchant=$('[data-filter-merchant]');
    if(group){const current=group.value; group.innerHTML='<option value="">All categories</option>'+uniq(rows.map(p=>p.group)).sort().map(v=>`<option value="${esc(v)}">${esc(GROUP_LABELS[v]||v)}</option>`).join(""); group.value=state.plan.groups.length===1?state.plan.groups[0]:current;}
    if(family){const current=family.value; const g=group?.value; const vals=uniq(rows.filter(p=>!g||p.group===g).map(p=>p.family)).sort(); family.innerHTML='<option value="">All specific types</option>'+vals.map(v=>`<option value="${esc(v)}">${esc(FAMILY_LABELS[v]||v.split(":").pop().replace(/-/g," "))}</option>`).join(""); family.value=state.plan.family||current;}
    if(audience&&state.plan.audience)audience.value=state.plan.audience;
    if(merchant){const current=merchant.value; merchant.innerHTML='<option value="">All sellers</option>'+uniq(rows.map(p=>p.advertiser)).sort().map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join(""); merchant.value=current;}
    updateFilterCount();
  }
  function updateFilterCount(){const f=filters(); const n=Object.entries(f).filter(([k,v])=>k!=="sort"&&Boolean(v)).length; const node=$('[data-tp-active-filter-count]'); if(node){node.textContent=n;node.hidden=!n;}}

  function totalPotential() {
    return state.plan.segmentKeys.reduce((n,key)=>n+(segmentMeta(key)?.count||0),0);
  }
  function renderFinder() {
    const grid=$('[data-tp-product-grid]'); if(!grid)return;
    const rows=filterProducts(activeProducts()); const visible=rows.slice(0,state.shown);
    grid.innerHTML=visible.length?visible.map(p=>productCard(p)).join(""):`<div class="tp-empty"><h3>No exact matches in the loaded catalogue.</h3><p>Try a broader product name, clear one filter, or check Related alternatives separately. Unrelated products are not inserted to fill the page.</p></div>`;
    bindImages(grid);
    const count=$('[data-tp-results-count]'), status=$('[data-tp-finder-status]'), title=$('[data-tp-results-title]');
    const potential=state.activeTab==="exact"?totalPotential():state.alternatives.length;
    if(title)title.textContent=`${state.activeTab==="exact"?"Exact matches":"Related alternatives"} for “${state.query}”`;
    if(count)count.textContent=potential?`${fmt.format(potential)} catalogue options`:`${fmt.format(rows.length)} loaded`;
    if(status)status.textContent=`Showing ${fmt.format(visible.length)} of ${fmt.format(rows.length)} loaded ${state.activeTab==="exact"?"exact matches":"alternatives"}. More catalogue pages load only when needed.`;
    const more=$('[data-tp-load-more]'); if(more){const moreLoaded=rows.length>state.shown; const moreRemote=state.plan.segmentKeys.some(k=>!(state.segmentState.get(k)?.done)); more.hidden=!(moreLoaded||moreRemote); more.textContent=state.loading?"Loading…":moreLoaded?"Show 24 more":"Load more exact catalogue results";}
    renderTabs(); updateFilterCount();
  }
  function renderTabs(){const host=$('[data-tp-result-tabs]');if(!host)return; host.innerHTML=`<button class="${state.activeTab==='exact'?'is-active':''}" data-result-tab="exact" type="button">Exact matches <span>${fmt.format(totalPotential())}</span></button><button class="${state.activeTab==='related'?'is-active':''}" data-result-tab="related" type="button">Related alternatives <span>${fmt.format(state.alternatives.length)}</span></button>`;}

  async function performSearch(query,push=true){
    state.query=clean(query)||"popular products"; state.shown=24; state.activeTab="exact"; state.products=[]; state.exact=[]; state.alternatives=[]; state.segmentState.clear();
    const m=await loadManifest(); state.plan=makePlan(state.query,m); state.segments=state.plan.segmentKeys.map(segmentMeta).filter(Boolean);
    if(push)history.replaceState(null,"",`/find/?q=${encodeURIComponent(state.query)}`);
    const input=$('[data-tp-finder-input]');if(input)input.value=state.query;
    const rows=state.manifest.version==="fallback"?state.products:await loadInitialSegments(); mergeProducts(rows); populateFilters(); renderFinder();
  }
  async function showMore(){
    const rows=filterProducts(activeProducts());
    if(rows.length>state.shown){state.shown+=24;renderFinder();return;}
    if(state.loading)return; state.loading=true;renderFinder();
    const next=await loadNextSegmentPages(); mergeProducts(next); state.shown+=24; state.loading=false; populateFilters(); renderFinder();
  }

  function toggleCompare(id){
    const p=state.products.find(x=>x.id===id)||[...(state.manifest?.featured||[]),...(state.manifest?.dealCandidates||[])].map(normalizeProduct).find(x=>x.id===id); if(!p)return;
    let rows=readStore(compareStore,[]); const exists=rows.some(x=>x.id===id);
    if(exists)rows=rows.filter(x=>x.id!==id); else {
      if(rows.length&&rows[0].family!==p.family){toast(`Compare ${familyLabel(p)} with the same product type. Clear the current comparison first.`);return;}
      rows.push(snapshot(p)); if(rows.length>3)rows.shift();
    }
    writeStore(compareStore,rows); updateHeaderCounts(); renderFinder(); renderStoredCompare();
  }
  function toggleSave(id){
    const pool=[...state.products,...(state.manifest?.featured||[]).map(normalizeProduct),...(state.manifest?.dealCandidates||[]).map(normalizeProduct),...(state.manifest?.rareUsed||[]).map(normalizeProduct)]; const p=pool.find(x=>x.id===id);if(!p)return;
    let rows=readStore(savedStore,[]); const exists=rows.some(x=>x.id===id); rows=exists?rows.filter(x=>x.id!==id):[snapshot(p),...rows].slice(0,100); writeStore(savedStore,rows); updateHeaderCounts(); renderFinder(); renderSaved(); toast(exists?"Removed from Price Watch":"Saved to Price Watch");
  }
  function updateHeaderCounts(){const c=readStore(compareStore,[]).length,s=readStore(savedStore,[]).length;$$('[data-compare-count]').forEach(n=>{n.textContent=c;n.hidden=!c;});$$('[data-saved-count]').forEach(n=>{n.textContent=s;n.hidden=!s;});}
  function toast(text){let n=$('.tp-toast');if(!n){n=d.createElement('div');n.className='tp-toast';d.body.append(n);}n.textContent=text;n.classList.add('is-visible');setTimeout(()=>n.classList.remove('is-visible'),2400);}

  function comparisonRows(p){return [
    ["Seller",p.advertiser||"Not provided"],["Price",money(p.price,currency(p))],["Shipping",p.shippingPrice===null?"Not provided":money(p.shippingPrice,currency(p))],
    ["Total delivered",p.shippingPrice===null?"Not confirmed":money(totalPrice(p),currency(p))],["Delivery",p.delivery||"Not provided"],["Rating",p.rating?`${p.rating.toFixed(1)} / 5${p.reviews?` (${fmt.format(p.reviews)} reviews)`:""}`:"Not provided"],
    ["Material",p.material||"Not provided"],["Audience",AUDIENCE_LABELS[p.audience]||p.audience],["Offers",`${p.offerCount||1} from ${p.storeCount||1} store(s)`],["Condition",p.condition||"Not stated"]
  ];}
  function renderStoredCompare(){
    const host=$('[data-tp-compare-page]');if(!host)return; const rows=readStore(compareStore,[]).map(normalizeProduct);
    if(!rows.length){host.innerHTML=`<div class="tp-empty tp-empty-large"><h2>Your comparison is empty.</h2><p>Find products, then add two or three options of the same exact type.</p><a class="tp-btn tp-btn-primary" href="/find/">Find products</a></div>`;return;}
    const labels=comparisonRows(rows[0]).map(r=>r[0]);
    host.innerHTML=`<div class="tp-compare-products">${rows.map(p=>`<article>${imageMarkup(p)}<h2>${esc(p.name)}</h2><strong>${money(p.price,currency(p))}</strong><button data-remove-compare="${esc(p.id)}" type="button">Remove</button></article>`).join("")}</div><div class="tp-compare-table">${labels.map((label,i)=>`<div class="tp-compare-row"><b>${esc(label)}</b>${rows.map(p=>`<span>${esc(comparisonRows(p)[i][1])}</span>`).join("")}</div>`).join("")}</div><div class="tp-decision-summary"><span>TrendPilot decision view</span><h2>${esc(decisionText(rows))}</h2><p>Recommendation uses only the supplied feed evidence. Missing fields remain visible instead of being guessed.</p></div>`; bindImages(host);
  }
  function decisionText(rows){
    const priced=rows.filter(p=>p.price>0); if(!priced.length)return "Compare the evidence—prices are not yet supplied.";
    const cheapest=[...priced].sort((a,b)=>totalPrice(a)-totalPrice(b))[0],best=[...rows].sort((a,b)=>(b.rating||0)-(a.rating||0)||b.quality-a.quality)[0];
    if(cheapest.id===best.id)return `${cheapest.name} currently combines the lowest supplied total and strongest available evidence.`;
    return `${cheapest.name} has the lowest supplied total; ${best.name} has the strongest rating/data evidence.`;
  }

  function renderSaved(){
    const host=$('[data-tp-saved-page]');if(!host)return; const rows=readStore(savedStore,[]).map(normalizeProduct),targets=readStore(targetStore,{});
    if(!rows.length){host.innerHTML=`<div class="tp-empty tp-empty-large"><h2>No products are being watched.</h2><p>Save a product from search results to build your personal watch list.</p><a class="tp-btn tp-btn-primary" href="/find/">Find products</a></div>`;return;}
    host.innerHTML=`<div class="tp-watch-grid">${rows.map(p=>`<article class="tp-watch-card" data-product-id="${esc(p.id)}"><div class="tp-watch-image">${imageMarkup(p)}</div><div><span>${esc(familyLabel(p))}</span><h2>${esc(p.name)}</h2><strong>${money(p.price,currency(p))}</strong><label>Notify target<input data-target-id="${esc(p.id)}" type="number" min="0" step="0.01" value="${esc(targets[p.id]||'')}" placeholder="Target price"></label><div><a href="${esc(p.url)}" target="_blank" rel="nofollow sponsored noopener">View product ↗</a><button data-save-id="${esc(p.id)}" type="button">Remove</button></div></div></article>`).join("")}</div><p class="tp-watch-note">This version stores your watch list and target prices on this device. Automated email alerts require the next account/notification phase.</p>`;bindImages(host);
  }

  function coupons(){const s=window.TREND_PILOT_COUPONS||window.TRENDPILOT_COUPONS||{};return Array.isArray(s)?s:(s.coupons||[]);}
  function renderDeals(){
    const productHost=$('[data-tp-deal-products]'),couponHost=$('[data-tp-coupon-grid]'); if(!productHost&&!couponHost)return;
    loadManifest().then(m=>{
      const deals=(m.dealCandidates||[]).map(normalizeProduct).slice(0,60); state.products=uniqProducts([...state.products,...deals]);
      if(productHost){productHost.innerHTML=deals.length?deals.slice(0,12).map(p=>productCard(p,true)).join(""):`<div class="tp-empty"><h3>No seller price-drop records are available yet.</h3><p>TrendPilot will not invent a verified deal without price evidence.</p></div>`;bindImages(productHost);}
      const rows=coupons().filter(c=>c.status!=="inactive");
      if(couponHost){couponHost.innerHTML=rows.length?rows.slice(0,40).map(c=>`<article class="tp-coupon-card"><div><span>${esc(c.merchant_name||c.merchant_key||"Merchant")}</span><b>${esc(c.end_at?`Ends ${clean(c.end_at).slice(0,10)}`:"Terms may change")}</b></div><h3>${esc(c.title||c.discount?.text||"Current saving")}</h3><p>${esc(clean(c.description).slice(0,180)||"Check eligibility, country and minimum order before payment.")}</p><div class="tp-code-row"><code>${esc(c.code||"Automatic offer")}</code>${c.code?`<button data-copy-code="${esc(c.code)}" type="button">Copy</button>`:""}</div></article>`).join(""):`<div class="tp-empty"><h3>No current coupon records.</h3></div>`;}
    });
  }
  function uniqProducts(rows){const m=new Map();rows.forEach(p=>m.set(p.id,p));return [...m.values()];}

  function renderHome(){
    loadManifest().then(m=>{
      const featured=(m.featured||[]).map(normalizeProduct),deals=(m.dealCandidates||[]).map(normalizeProduct),rare=(m.rareUsed||[]).map(normalizeProduct);
      state.products=uniqProducts([...state.products,...featured,...deals,...rare]);
      const f=$('[data-tp-home-products]');if(f){f.innerHTML=featured.length?featured.slice(0,6).map(p=>productCard(p,true)).join(""):'<div class="tp-empty">Product data is refreshing.</div>';bindImages(f);}
      const de=$('[data-tp-home-deals]');if(de){de.innerHTML=deals.length?deals.slice(0,4).map(p=>productCard(p,true)).join(""):'<div class="tp-empty">No price-drop evidence yet.</div>';bindImages(de);}
      const ra=$('[data-tp-home-rare]');if(ra){ra.innerHTML=rare.length?rare.slice(0,4).map(p=>productCard(p,true)).join(""):'<div class="tp-empty">Rare-used coverage is still being evaluated.</div>';bindImages(ra);}
      $$('[data-catalog-count]').forEach(n=>n.textContent=fmt.format(m.productCount||0));
      $$('[data-store-count]').forEach(n=>n.textContent=fmt.format(Object.keys(m.topAdvertisers||{}).length));
    });
  }

  function initForms(){
    $$('[data-tp-home-search],[data-tp-tool-form]').forEach(form=>form.addEventListener('submit',e=>{e.preventDefault();const input=$('input[type="search"],input[name="q"]',form);const parts=$$('input,select',form).map(x=>clean(x.value)).filter(Boolean);const q=parts.join(' ');if(q)location.href=`/find/?q=${encodeURIComponent(q)}`;}));
  }
  function initFinder(){
    const form=$('[data-tp-finder-form]');if(!form)return;
    form.addEventListener('submit',e=>{e.preventDefault();performSearch($('[data-tp-finder-input]')?.value||'products');});
    $$('[data-search-suggestion]').forEach(b=>b.addEventListener('click',()=>performSearch(b.dataset.searchSuggestion)));
    $('[data-tp-load-more]')?.addEventListener('click',showMore);
    $$('[data-filter-group],[data-filter-family],[data-filter-audience],[data-filter-merchant],[data-filter-price],[data-filter-sort],[data-filter-coupon],[data-filter-rare]').forEach(x=>x.addEventListener('change',()=>{if(x.matches('[data-filter-group]'))populateFilters();state.shown=24;renderFinder();}));
    $('[data-reset-filters]')?.addEventListener('click',()=>{$$('[data-filter-panel] select').forEach(x=>x.value='');$$('[data-filter-panel] input[type="checkbox"]').forEach(x=>x.checked=false);state.shown=24;renderFinder();});
    $('[data-tp-filter-toggle]')?.addEventListener('click',e=>{const p=$('[data-tp-filter-panel]');p?.classList.toggle('is-expanded');e.currentTarget.setAttribute('aria-expanded',String(p?.classList.contains('is-expanded')));});
    const q=new URLSearchParams(location.search).get('q')||"popular products";performSearch(q,false);
  }

  function initEvents(){
    d.addEventListener('click',e=>{
      const c=e.target.closest('[data-compare-id]');if(c){toggleCompare(c.dataset.compareId);return;}
      const s=e.target.closest('[data-save-id]');if(s){toggleSave(s.dataset.saveId);return;}
      const r=e.target.closest('[data-remove-compare]');if(r){let rows=readStore(compareStore,[]).filter(x=>x.id!==r.dataset.removeCompare);writeStore(compareStore,rows);updateHeaderCounts();renderStoredCompare();return;}
      const t=e.target.closest('[data-result-tab]');if(t){state.activeTab=t.dataset.resultTab;state.shown=24;renderFinder();return;}
      const copy=e.target.closest('[data-copy-code]');if(copy){navigator.clipboard?.writeText(copy.dataset.copyCode);copy.textContent='Copied';return;}
    });
    d.addEventListener('change',e=>{const input=e.target.closest('[data-target-id]');if(input){const map=readStore(targetStore,{});map[input.dataset.targetId]=input.value;writeStore(targetStore,map);}});
  }

  async function boot(){
    initChrome();initEvents();initForms();initFinder();renderStoredCompare();renderSaved();renderDeals();
    if(d.body.matches('[data-tp-page="home"]'))renderHome();
  }
  if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',boot);else boot();
})();
