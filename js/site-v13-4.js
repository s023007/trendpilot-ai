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

  const QUERY_WORD_CORRECTIONS = new Map([
    ["makup","makeup"],["makep","makeup"],["makeupp","makeup"],["cosmatic","cosmetic"],["cosmatics","cosmetics"],
    ["tshrit","tshirt"],["tshit","tshirt"],["tshrt","tshirt"],["t-shirtss","tshirts"],["cloths","clothes"],["cloting","clothing"],
    ["lapotp","laptop"],["laptob","laptop"],["computor","computer"],["moniter","monitor"],["keybord","keyboard"],
    ["headfone","headphone"],["headfones","headphones"],["earbudds","earbuds"],["speeker","speaker"],
    ["carply","carplay"],["carpaly","carplay"],["wirless","wireless"],["automative","automotive"],
    ["staionery","stationery"],["stationary","stationery"],["notbook","notebook"],["calculater","calculator"],
    ["sportwear","sportswear"],["fitnes","fitness"],["campin","camping"],["bicyle","bicycle"],
    ["skincar","skincare"],["perfumees","perfumes"],["lipstik","lipstick"],["masacra","mascara"],
    ["kichen","kitchen"],["furnture","furniture"],["cookwear","cookware"],["vaccum","vacuum"],
    ["babby","baby"],["stroler","stroller"],["diapper","diaper"],["educatonal","educational"],
    ["sofware","software"],["subscribtion","subscription"],["antivrus","antivirus"],["vedio","video"],
    ["wholsale","wholesale"],["manufacter","manufacturer"],["suplier","supplier"],["packging","packaging"],
    ["accesories","accessories"],["jewelery","jewelry"],["backpak","backpack"],["watche","watch"],
    ["petts","pets"],["aquariam","aquarium"],["groming","grooming"],["leesh","leash"],
    ["dril","drill"],["multimter","multimeter"],["osciloscope","oscilloscope"],["sodering","soldering"],
    ["camra","camera"],["projecor","projector"],["smartfone","smartphone"],["pritner","printer"]
  ]);
  function normalizeQuery(raw) {
    const original = clean(raw);
    let value = lower(original).replace(/[\u2010-\u2015]/g,"-");
    value = value.replace(/\bmake[ -]?up\b/g,"makeup").replace(/\bt[ -]?shirts?\b/g,m=>/s$/.test(m)?"tshirts":"tshirt");
    const corrected = value.split(/(\s+)/).map(part=>QUERY_WORD_CORRECTIONS.get(part)||part).join("").replace(/\s+/g," ").trim();
    return {original, query: corrected || "popular products", corrected: Boolean(original) && lower(original) !== corrected};
  }

  const GROUP_LABELS = {
    "apparel":"Clothing","footwear":"Shoes","bags-accessories":"Bags & accessories","jewelry-watches":"Jewelry & eyewear",
    "beauty-care":"Beauty","baby-kids":"Baby & kids","pet-supplies":"Pet supplies","phones-tablets":"Phones & tablets",
    "computers":"Computers","audio":"Audio","cameras":"Cameras","projectors-tv":"TV & projectors","smart-home":"Smart home",
    "automotive":"Car electronics","home-kitchen":"Home & kitchen","tools":"Tools","office-school":"Office & school",
    "toys-games":"Toys & games","sports-outdoors":"Sports & outdoors","printing-3d":"Printing & 3D","software":"Software",
    "business-sourcing":"Business sourcing","other":"More products"
  };
  const SCOPE_GROUPS = {
    "": [], "all": [],
    "clothing": ["apparel","footwear","bags-accessories","jewelry-watches"],
    "electronics": ["phones-tablets","computers","audio","cameras","projectors-tv","smart-home","automotive"],
    "home": ["home-kitchen","tools","smart-home"], "school": ["office-school"], "sports": ["sports-outdoors"],
    "beauty": ["beauty-care"], "kids": ["baby-kids","toys-games","apparel","footwear","bags-accessories","office-school"], "software": ["software"],
    "business": ["business-sourcing"], "pets": ["pet-supplies"], "automotive": ["automotive"],
    "tools": ["tools"], "toys": ["toys-games"], "bags": ["bags-accessories"],
    "jewelry": ["jewelry-watches"], "audio": ["audio"], "cameras": ["cameras"],
    "phones": ["phones-tablets"], "computers": ["computers"], "smart-home": ["smart-home"],
    "printing": ["printing-3d"]
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
    "video-editor":"Video editors","phone-utility-software":"Phone utility software","bags":"Bags","watches":"Watches","eyewear":"Eyewear",
    "makeup":"Makeup (all)","face-makeup":"Face makeup","eye-makeup":"Eye makeup","lip-makeup":"Lip makeup",
    "brow-makeup":"Brow makeup","makeup-tools":"Makeup tools","makeup-sets":"Makeup sets","other-makeup":"Other makeup",
    "skin-care":"Skin care","hair-care":"Hair care","hair-styling-tools":"Hair styling tools","fragrance":"Fragrance",
    "nail-care":"Nail care","grooming":"Grooming","personal-care":"Personal care","other-beauty-care":"Other beauty products"
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
    ["beauty-care", /\b(beauty|make[- ]?up|cosmetics?|lipsticks?|lip gloss|mascara|eyeshadow|eyeliner|foundation|concealer|blush|skincare|skin care|hair care|perfume|fragrance|nail polish|personal care)\b/i],
    ["software", /\b(software|video editor|pdf editor|license|subscription|filmora|dr\.fone|mobiletrans)\b/i],
    ["business-sourcing", /\b(supplier|manufacturer|wholesale|private label|custom logo|bulk order|factory)\b/i]
  ];
  const FAMILY_ROUTES = [
    ["wireless-carplay-adapter", /\b(wireless carplay|carplay adapter|carplay dongle)\b/i],
    ["pet-feeder", /\b(pet feeder|automatic feeder|food dispenser|cat feeder|dog feeder)\b/i],
    ["pet-litter-box", /\b(litter box|cat toilet|self cleaning litter)\b/i],
    ["running-shoes", /\b(running shoes?|jogging shoes?|trail running shoes?)\b/i],
    ["makeup-tools", /\b(make[- ]?up brushes?|cosmetic brushes?|brush sets?|make[- ]?up sponges?|beauty blenders?|powder puffs?|eyelash curlers?)\b/i],
    ["brow-makeup", /\b(eyebrow pencils?|brow pencils?|brow gels?|brow powders?|brow pomades?|eyebrow pens?)\b/i],
    ["lip-makeup", /\b(lipsticks?|lip sticks?|lip gloss(?:es)?|lip tints?|lip liners?|liquid lips?|lip stains?)\b/i],
    ["eye-makeup", /\b(mascaras?|eyeshadows?|eye shadows?|eyeliners?|eye liners?|false eyelashes|false lashes|lash extensions?|eye palettes?)\b/i],
    ["face-makeup", /\b(foundations?|concealers?|blush(?:es)?|bronzers?|highlighters?|contours?|face powders?|setting powders?|pressed powders?|loose powders?|make[- ]?up primers?|bb creams?|cc creams?)\b/i],
    ["makeup-sets", /\b(make[- ]?up sets?|cosmetic sets?|make[- ]?up kits?|make[- ]?up palettes?|cosmetic palettes?)\b/i],
    ["hair-care", /\b(hair care|shampoos?|conditioners?|hair oils?|hair masks?|hair serums?)\b/i],
    ["skin-care", /\b(skin ?care|moisturi[sz]ers?|face serums?|facial serums?|skin serums?|facial cleansers?|face creams?|sunscreens?|toners?|face masks?|sheet masks?)\b/i],
    ["hair-styling-tools", /\b(hair dryers?|hair straighteners?|hair curlers?|curling irons?|hair clippers?|hot air brushes?)\b/i],
    ["fragrance", /\b(perfumes?|fragrances?|eau de parfum|eau de toilette|colognes?|body mists?)\b/i],
    ["nail-care", /\b(nail polish(?:es)?|gel polish(?:es)?|manicure|pedicure|nail art|nail lamps?|nail drills?|press on nails)\b/i],
    ["grooming", /\b(electric shavers?|shavers?|trimmers?|beard trimmers?|epilators?|hair removal|razors?)\b/i],
    ["personal-care", /\b(personal care|deodorants?|oral care|electric toothbrushes?|body lotions?|body wash)\b/i],
    ["makeup", /\b(make[- ]?up|cosmetics?)\b/i],
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
    shown: 24, activeTab: "exact", loading: false, scope: "", couponExpanded: false,
    originalQuery: "", queryCorrected: false
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
    const path=location.pathname.replace(/\/+$|^$/g,'/')||'/';$$('[data-bottom-link]').forEach(a=>{const href=new URL(a.href,location.origin).pathname.replace(/\/+$|^$/g,'/')||'/';a.classList.toggle('is-active',href===path||(href!=='/'&&path.startsWith(href)));});
  }

  function inferAudience(q) {
    if (/\b(kids?|children|child|boys?|girls?|toddler|baby|infant)\b/i.test(q)) return "kids";
    if (/\b(women'?s|womens|women|woman|female|ladies)\b/i.test(q)) return "women";
    if (/\b(men'?s|mens|men|man|male|gentlemen)\b/i.test(q)) return "men";
    if (/\bunisex\b/i.test(q)) return "unisex";
    return "";
  }
  function aliasBoundaryMatch(text, alias) {
    const a=lower(alias).replace(/[\^$.*+?()[\]{}|]/g,"\\$&").replace(/\s+/g,"\\s+");
    return new RegExp(`(^|[^a-z0-9])${a}([^a-z0-9]|$)`,"i").test(lower(text));
  }
  function inferFamily(q, manifest=state.manifest) {
    const staticHit=(FAMILY_ROUTES.find(([, re]) => re.test(q)) || [""])[0];
    if(staticHit)return staticHit;
    const aliases=manifest?.familyAliases||{};
    const entries=Object.entries(aliases).sort((a,b)=>b[0].length-a[0].length);
    const hit=entries.find(([alias])=>aliasBoundaryMatch(q,alias));
    return hit?.[1]||"";
  }
  function familyMembers(family, manifest) {
    if (!family) return [];
    const members=manifest?.familyTaxonomy?.[family]?.members;
    return Array.isArray(members)&&members.length?[...members]:[family];
  }
  function familyLabelValue(value) {
    return state.manifest?.familyLabels?.[value] || state.manifest?.familyTaxonomy?.[value]?.label || FAMILY_LABELS[value] || clean(value).split(":").pop().replace(/-/g," ") || "Product";
  }
  function inferGroups(q, manifest) {
    if (/\b(electronics?|tech|technology|gadgets?)\b/i.test(q)) return ["phones-tablets","computers","audio","cameras","projectors-tv","smart-home","automotive"];
    if (/\b(fashion)\b/i.test(q)) return ["apparel","footwear","bags-accessories","jewelry-watches"];
    const direct = GROUP_ROUTES.filter(([, re]) => re.test(q)).map(([g]) => g);
    const manifestDirect=(manifest?.groups||[]).filter(g=>(g.aliases||[]).some(alias=>aliasBoundaryMatch(q,alias))||aliasBoundaryMatch(q,g.label||"")).map(g=>g.id);
    if (direct.length || manifestDirect.length) return uniq([...direct,...manifestDirect]);
    const routes = [];
    words(q).forEach(t => (manifest.tokenRoutes?.[t] || []).forEach(key => routes.push(key.split("|")[0])));
    return uniq(routes).slice(0,6);
  }
  function genericIntentTokens(q, groups, family) {
    const generic=new Set(["men","mens","women","womens","kids","kid","children","child","baby","product","products","item","items","all"]);
    const groupGeneric={
      "apparel":["tshirt","tshirts","shirt","shirts","tee","tees","clothing","clothes","apparel","fashion"],
      "footwear":["shoe","shoes","footwear"], "bags-accessories":["bag","bags","accessories"],
      "jewelry-watches":["jewelry","jewellery","watch","watches","accessories"],
      "phones-tablets":["phone","phones","mobile","tablet","tablets","electronics"],
      "computers":["computer","computers","pc","electronics"], "audio":["audio","sound","electronics"],
      "cameras":["camera","cameras","photo","photography","electronics"],
      "projectors-tv":["projector","projectors","tv","television","electronics"],
      "smart-home":["smart","home","electronics"], "automotive":["car","cars","automotive","vehicle","electronics"],
      "home-kitchen":["home","kitchen","household"], "tools":["tool","tools","diy"],
      "office-school":["school","office","supplies","stationery"], "sports-outdoors":["sport","sports","outdoor","outdoors"],
      "beauty-care":["beauty","cosmetic","cosmetics","makeup","care"],
      "baby-kids":["baby","kids","children"], "toys-games":["toy","toys","game","games"],
      "software":["software","app","apps","digital"], "business-sourcing":["business","sourcing","supplier","wholesale"],
      "pet-supplies":["pet","pets","supplies"], "printing-3d":["printing","printer","printers","3d"]
    };
    groups.forEach(g=>(groupGeneric[g]||[]).forEach(x=>generic.add(x)));
    if(family) familyMembers(family,state.manifest).forEach(x=>x.split("-").forEach(t=>generic.add(t)));
    return words(q).filter(t=>!generic.has(t));
  }
  function makePlan(q, manifest, scope = "") {
    const inferredAudience = inferAudience(q);
    const audience = inferredAudience || (scope==="kids" ? "kids" : "");
    const family = inferFamily(q,manifest), families=familyMembers(family,manifest);
    const scopedGroups = SCOPE_GROUPS[scope] || manifest?.scopeGroups?.[scope] || [];
    const groups = scopedGroups.length ? [...scopedGroups] : inferGroups(q, manifest);
    if (families.length) {
      const familyGroups=uniq((manifest.segments||[]).filter(s=>families.includes(s.family)).map(s=>s.group));
      if(!groups.length)groups.push(...familyGroups);
      else familyGroups.forEach(g=>{if(!groups.includes(g))groups.push(g);});
    }
    let segmentKeys = [];
    const allSegments = manifest.segments || [];
    if (families.length) {
      segmentKeys = allSegments.filter(s => families.includes(s.family) && (!groups.length || groups.includes(s.group)) && (!audience || s.audience === audience)).map(s => s.key);
    } else if (groups.length) {
      segmentKeys = allSegments.filter(s => groups.includes(s.group) && (!audience || s.audience === audience)).map(s => s.key);
    } else {
      words(q).forEach(t => segmentKeys.push(...(manifest.tokenRoutes?.[t] || [])));
      segmentKeys = uniq(segmentKeys).slice(0,18);
    }
    if (!segmentKeys.length && groups.length) segmentKeys=allSegments.filter(s=>groups.includes(s.group)).slice(0,24).map(s=>s.key);
    if (!segmentKeys.length) segmentKeys = allSegments.slice(0,18).map(s => s.key);
    let relatedGroups=[...groups];
    if(family==="makeup") relatedGroups=uniq([...relatedGroups,"bags-accessories"]);
    const alternativeKeys = families.length ? allSegments.filter(s => relatedGroups.includes(s.group) && !families.includes(s.family) && (!audience || [audience,"unisex"].includes(s.audience))).slice(0,16).map(s => s.key) : [];
    const intentTokens = genericIntentTokens(q,groups,family);
    return {q:lower(q), groups, family, families, audience, segmentKeys:uniq(segmentKeys), alternativeKeys:uniq(alternativeKeys), intentTokens, exactIntent:Boolean(families.length || audience || groups.length)};
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

  function candidatePagesExhausted() {
    return state.plan.segmentKeys.every(key => {
      const meta = segmentMeta(key);
      const st = state.segmentState.get(key);
      return !meta || Boolean(st?.done);
    });
  }
  function scannedCandidateCount() {
    return state.plan.segmentKeys.reduce((total,key) => {
      const meta=segmentMeta(key), st=state.segmentState.get(key);
      const loaded=st?.loaded?.size || 0;
      return total + Math.min(meta?.count || 0, loaded * (state.manifest?.searchRules?.pageSize || 240));
    },0);
  }
  async function ensureMinimumExact(minimum = 24) {
    let rounds = 0;
    while (state.exact.length < minimum && !candidatePagesExhausted() && rounds < 30) {
      const next = await loadNextSegmentPages();
      if (!next.length) break;
      mergeProducts(next);
      rounds += 1;
    }
  }

  function familyTitleGuard(p, plan) {
    const text=lower(`${p.name} ${p.category||""}`);
    if(plan.families?.includes("t-shirts")) {
      if(/\b(dress|formal|business|office|button[- ]?(?:up|down)|collared) shirts?\b/i.test(text))return false;
      return /\b(t[- ]?shirts?|tshirts?|tee shirts?|graphic tees?|cotton tees?|crew[- ]?neck tees?)\b/i.test(text) || p.family==="t-shirts";
    }
    if(plan.family==="makeup" || plan.families?.some(f=>/makeup/.test(f))) {
      if(/\b(t[- ]?shirts?|shirts?|hoodies?|dresses?|posters?|stickers?|wall art|phone cases?|makeup bags?|cosmetic bags?)\b/i.test(text))return false;
    }
    if(plan.families?.includes("smartphones") && /\b(case|cover|screen protector|charger|cable|mount|holder)\b/i.test(text))return false;
    if(plan.families?.includes("laptops") && /\b(bag|sleeve|stand|charger|keyboard cover|skin sticker)\b/i.test(text))return false;
    if(plan.families?.includes("office-printers") && /\b(ink|toner|cartridge|paper|label|printer head)\b/i.test(text))return false;
    if(plan.families?.includes("digital-cameras") && /\b(camera bag|lens cap|tripod|gimbal|battery charger)\b/i.test(text))return false;
    return true;
  }
  function strictProductMatch(p, plan) {
    if (plan.groups.length && !plan.groups.includes(p.group)) return false;
    if (plan.families?.length && !plan.families.includes(p.family)) return false;
    if (plan.audience && p.audience !== plan.audience) return false;
    if (!familyTitleGuard(p,plan)) return false;
    if (plan.families?.length || plan.audience) return true;
    const title = lower(`${p.name} ${p.brand || ""} ${p.category || ""} ${p.family || ""}`);
    const titleTokens = words(title);
    return plan.intentTokens.length ? plan.intentTokens.every(t => titleTokens.some(x => x === t || x.startsWith(t) || t.startsWith(x))) : true;
  }
  function relatedMatch(p, plan) {
    if (plan.audience && ![plan.audience,"unisex"].includes(p.audience)) return false;
    if (plan.groups.length && !plan.groups.includes(p.group) && !(plan.family==="makeup"&&p.group==="bags-accessories")) return false;
    if (plan.families?.length && plan.families.includes(p.family)) return false;
    return true;
  }
  function score(p, plan) {
    let n = p.quality / 10 + (p.image ? 6 : 0) + (p.price ? 4 : 0) + Math.min(8,p.rating) + Math.min(8,Math.log10(p.reviews + 1) * 2);
    const title = lower(p.name), q = plan.q;
    if (q && title.includes(q)) n += 100;
    plan.intentTokens.forEach(t => { if (title.includes(t)) n += 22; else if (lower(`${p.brand} ${p.category}`).includes(t)) n += 8; });
    if (plan.families?.includes(p.family)) n += 60;
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
  function familyLabel(p) { return familyLabelValue(p.family) || GROUP_LABELS[p.group] || "Product"; }
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
    const f=filters(); const selectedFamilies=familyMembers(f.family,state.manifest); const relatedRows=rows===state.alternatives;
    let out=rows.filter(p=>{
      if(f.group&&p.group!==f.group&&!(relatedRows&&state.plan?.family==="makeup"&&p.group==="bags-accessories"))return false;
      if(selectedFamilies.length&&!relatedRows&&!selectedFamilies.includes(p.family))return false; if(f.audience&&p.audience!==f.audience)return false;
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
  function resetFilterControls(){
    ['[data-filter-group]','[data-filter-family]','[data-filter-audience]','[data-filter-merchant]','[data-filter-price]'].forEach(sel=>{const n=$(sel);if(n)n.value="";});
    ['[data-filter-coupon]','[data-filter-rare]'].forEach(sel=>{const n=$(sel);if(n)n.checked=false;});
    const sort=$('[data-filter-sort]');if(sort)sort.value="smart";
  }
  function populateFilters() {
    const rows=state.products;
    const group=$('[data-filter-group]'), family=$('[data-filter-family]'), audience=$('[data-filter-audience]'), merchant=$('[data-filter-merchant]');
    if(group){const current=group.value; group.innerHTML='<option value="">All categories</option>'+uniq(rows.map(p=>p.group)).sort().map(v=>`<option value="${esc(v)}">${esc(GROUP_LABELS[v]||v)}</option>`).join(""); group.value=current|| (state.plan.groups.length===1?state.plan.groups[0]:"");}
    if(family){const current=family.value; const g=group?.value; const vals=uniq(rows.filter(p=>!g||p.group===g).map(p=>p.family)).filter(v=>!v.includes(":")).sort(); const parent=state.plan.family&&state.plan.families?.length>1&&(!g||state.plan.groups.includes(g))?`<option value="${esc(state.plan.family)}">${esc(familyLabelValue(state.plan.family))}</option>`:""; family.innerHTML='<option value="">All specific types</option>'+parent+vals.map(v=>`<option value="${esc(v)}">${esc(familyLabelValue(v))}</option>`).join(""); family.value=current||state.plan.family||"";}
    if(audience)audience.value=audience.value||state.plan.audience||"";
    if(merchant){const current=merchant.value;const manifestSellers=[...(state.manifest?.advertisers||[]),...Object.keys(state.manifest?.topAdvertisers||{})];const sellers=uniq([...manifestSellers,...rows.map(p=>p.advertiser)]).filter(Boolean).sort();merchant.innerHTML='<option value="">All sellers</option>'+sellers.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join("");merchant.value=sellers.includes(current)?current:"";}
    updateFilterCount();
  }
  function updateFilterCount(){const f=filters(); const n=Object.entries(f).filter(([k,v])=>k!=="sort"&&Boolean(v)).length; const node=$('[data-tp-active-filter-count]'); if(node){node.textContent=n;node.hidden=!n;}}

  function resultCountLabel() {
    const found = filterProducts(activeProducts()).length;
    if (state.activeTab === "related") return `${fmt.format(found)} related`;
    return candidatePagesExhausted() ? `${fmt.format(found)} exact matches` : `${fmt.format(found)}+ exact matches`;
  }
  function renderFinder() {
    const grid=$('[data-tp-product-grid]'); if(!grid)return;
    const rows=filterProducts(activeProducts()); const visible=rows.slice(0,state.shown);
    const noun=state.activeTab==="exact"?"exact matches":"related alternatives";
    grid.innerHTML=visible.length?visible.map(p=>productCard(p)).join(""):`<div class="tp-empty"><h3>No ${noun} found.</h3><p>${state.activeTab==="exact"?"Try a more specific product name, change the category, or open Related alternatives. TrendPilot will not invent a match from an unrelated description.":"No useful alternatives are available for this search yet."}</p></div>`;
    bindImages(grid);
    const count=$('[data-tp-results-count]'), status=$('[data-tp-finder-status]'), title=$('[data-tp-results-title]');
    if(title)title.textContent=`${state.activeTab==="exact"?"Exact matches":"Related alternatives"} for “${state.query}”`;
    if(count)count.textContent=resultCountLabel();
    if(status){
      const scan=scannedCandidateCount();
      const progress=candidatePagesExhausted()?"Catalogue check complete.":"More relevant catalogue pages can still be checked.";
      const correction=state.queryCorrected?`Corrected “${state.originalQuery}” to “${state.query}”. `:"";
      status.textContent=`${correction}Showing ${fmt.format(visible.length)} of ${fmt.format(rows.length)} ${noun}. ${fmt.format(scan)} candidates checked. ${progress}`;
    }
    const more=$('[data-tp-load-more]'); if(more){
      const moreLoaded=rows.length>state.shown;
      const moreRemote=state.activeTab==="exact"&&!candidatePagesExhausted();
      more.hidden=!(moreLoaded||moreRemote);
      more.textContent=state.loading?"Checking more products…":moreLoaded?`Show ${Math.min(24,rows.length-state.shown)} more`:"Check more catalogue pages";
    }
    renderTabs(); updateFilterCount();
  }
  function renderTabs(){
    const host=$('[data-tp-result-tabs]');if(!host)return;
    const exactSuffix=candidatePagesExhausted()?"":"+";
    const exactCount=filterProducts(state.exact).length, relatedCount=filterProducts(state.alternatives).length;
    host.innerHTML=`<button class="${state.activeTab==='exact'?'is-active':''}" data-result-tab="exact" type="button">Exact matches <span>${fmt.format(exactCount)}${exactSuffix}</span></button><button class="${state.activeTab==='related'?'is-active':''}" data-result-tab="related" type="button">Related alternatives <span>${fmt.format(relatedCount)}</span></button>`;
  }

  async function performSearch(query,push=true,scope=""){
    const normalized=normalizeQuery(query);
    state.originalQuery=normalized.original; state.query=normalized.query; state.queryCorrected=normalized.corrected;
    state.scope=scope||""; state.shown=24; state.activeTab="exact"; state.products=[]; state.exact=[]; state.alternatives=[]; state.segmentState.clear();
    resetFilterControls();
    const m=await loadManifest(); state.plan=makePlan(state.query,m,state.scope); state.segments=state.plan.segmentKeys.map(segmentMeta).filter(Boolean);
    if(push){const params=new URLSearchParams({q:state.query});if(state.scope)params.set("scope",state.scope);history.replaceState(null,"",`/find/?${params.toString()}`);}
    const input=$('[data-tp-finder-input]');if(input)input.value=state.query;
    const scopeSelect=$('[data-tp-finder-scope]');if(scopeSelect)scopeSelect.value=state.scope;
    const rows=state.manifest.version==="fallback"?state.products:await loadInitialSegments(); mergeProducts(rows);
    await ensureMinimumExact(24);
    populateFilters(); renderFinder();
  }
  async function showMore(){
    let rows=filterProducts(activeProducts());
    if(rows.length>state.shown){state.shown+=24;renderFinder();return;}
    if(state.activeTab!=="exact"||candidatePagesExhausted()||state.loading)return;
    state.loading=true;renderFinder();
    const target=state.exact.length+24;
    await ensureMinimumExact(target);
    state.shown+=24; state.loading=false; populateFilters(); renderFinder();
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
  function couponLanguage(c){
    const declared=lower(c.language||c.lang||c.locale||"").slice(0,2); if(declared)return declared;
    const text=lower(`${c.title||""} ${c.description||""}`);
    if(/\b(artículos|sólo|beneficios|entrega|envío|gratis)\b/.test(text))return "es";
    if(/\b(articoli|spedizione|consegna|gratuit[ae])\b/.test(text))return "it";
    if(/\b(zniżk|dostaw|kupon)\b/.test(text))return "pl";
    return "en";
  }
  function couponCountries(c){
    const raw=c.countries||c.country_codes||c.countryCodes||c.country||c.regions||[];
    const list=Array.isArray(raw)?raw:String(raw||"").split(/[,;| ]+/);
    return uniq(list.map(x=>clean(x).toUpperCase()).filter(Boolean));
  }
  function couponRows(){
    const search=lower($('[data-coupon-search]')?.value||"");
    const country=clean($('[data-coupon-country]')?.value||"GLOBAL").toUpperCase();
    const language=clean($('[data-coupon-language]')?.value||"en").toLowerCase();
    return coupons().filter(c=>c.status!=="inactive").filter(c=>{
      const text=lower(`${c.merchant_name||c.merchant_key||""} ${c.title||""} ${c.description||""} ${c.code||""}`);
      if(search&&!text.includes(search))return false;
      if(language!=="all"&&couponLanguage(c)!==language)return false;
      const countries=couponCountries(c);
      if(country==="ALL")return true;
      if(country==="GLOBAL")return !countries.length||countries.some(x=>["WW","WORLDWIDE","GLOBAL","ALL"].includes(x));
      return !countries.length||countries.includes(country)||countries.some(x=>["WW","WORLDWIDE","GLOBAL","ALL"].includes(x));
    });
  }
  function renderCouponGrid(){
    const host=$('[data-tp-coupon-grid]');if(!host)return;
    const rows=couponRows(); const limit=state.couponExpanded?80:12; const visible=rows.slice(0,limit);
    host.innerHTML=visible.length?visible.map(c=>{
      const countries=couponCountries(c); const lang=couponLanguage(c).toUpperCase();
      const title=clean(c.title||c.discount?.text||"Current saving");
      const desc=clean(c.description)||"Check eligibility, country and minimum order before payment.";
      return `<article class="tp-coupon-card"><div><span>${esc(c.merchant_name||c.merchant_key||"Merchant")}</span><b>${esc(c.end_at?`Ends ${clean(c.end_at).slice(0,10)}`:"Terms may change")}</b></div><h3>${esc(title)}</h3><p>${esc(desc)}</p><div class="tp-coupon-meta"><span>${esc(lang)}</span><span>${esc(countries.length?countries.slice(0,6).join(", "):"Worldwide / not stated")}</span></div><div class="tp-code-row"><code>${esc(c.code||"Automatic offer")}</code>${c.code?`<button data-copy-code="${esc(c.code)}" type="button">Copy</button>`:""}</div></article>`;
    }).join(""):`<div class="tp-empty"><h3>No matching coupon records.</h3><p>Change the country or language filter. Product-linked savings remain above.</p></div>`;
    const toggle=$('[data-coupon-toggle]');if(toggle){toggle.hidden=rows.length<=12;toggle.textContent=state.couponExpanded?"Show fewer coupons":`Show all ${rows.length} coupons`;}
  }
  function renderDeals(){
    const productHost=$('[data-tp-deal-products]'); if(!productHost&&!$('[data-tp-coupon-grid]'))return;
    loadManifest().then(m=>{
      const deals=(m.dealCandidates||[]).map(normalizeProduct).slice(0,60); state.products=uniqProducts([...state.products,...deals]);
      if(productHost){productHost.innerHTML=deals.length?deals.slice(0,12).map(p=>productCard(p,true)).join(""):`<div class="tp-empty"><h3>No seller price-drop records are available yet.</h3><p>TrendPilot will not invent a verified deal without price evidence.</p></div>`;bindImages(productHost);}
      renderCouponGrid();
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

  function initSearchSuggestions(){
    $$('[data-tp-search]').forEach(form=>{
      const box=$('[data-tp-search-suggestions]',form),input=$('input[type="search"]',form); if(!box||!input)return;
      const open=()=>{box.hidden=false;}; const close=()=>{box.hidden=true;};
      input.addEventListener('focus',open); input.addEventListener('input',open);
      form.addEventListener('focusin',open);
      $$('[data-search-fill]',box).forEach(x=>x.addEventListener('click',()=>{input.value=x.dataset.searchFill||x.textContent.trim();close();input.focus();}));
      d.addEventListener('pointerdown',e=>{if(!form.contains(e.target))close();});
      d.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
    });
  }
  function initForms(){
    $$('[data-tp-home-search],[data-tp-tool-form]').forEach(form=>form.addEventListener('submit',e=>{
      e.preventDefault();const input=$('input[type="search"],input[name="q"]',form);const scope=$('[data-tp-search-scope]',form)?.value||"";
      const parts=form.matches('[data-tp-tool-form]')?$$('input,select',form).map(x=>clean(x.value)).filter(Boolean):[clean(input?.value)].filter(Boolean);
      const q=parts.join(' ')||scope;if(q){const params=new URLSearchParams({q});if(scope)params.set('scope',scope);location.href=`/find/?${params.toString()}`;}
    }));
  }
  function initFinder(){
    const form=$('[data-tp-finder-form]');if(!form)return;
    form.addEventListener('submit',e=>{e.preventDefault();const scope=$('[data-tp-finder-scope]')?.value||'';performSearch($('[data-tp-finder-input]')?.value||scope||'popular products',true,scope);});
    $$('[data-search-suggestion]').forEach(b=>b.addEventListener('click',()=>performSearch(b.dataset.searchSuggestion,true,b.dataset.searchScope||'')));
    $('[data-tp-load-more]')?.addEventListener('click',showMore);
    $$('[data-filter-group],[data-filter-family],[data-filter-audience],[data-filter-merchant],[data-filter-price],[data-filter-sort],[data-filter-coupon],[data-filter-rare]').forEach(x=>x.addEventListener('change',()=>{if(x.matches('[data-filter-group]'))populateFilters();state.shown=24;renderFinder();}));
    $('[data-reset-filters]')?.addEventListener('click',()=>{$$('[data-filter-panel] select').forEach(x=>x.value='');$$('[data-filter-panel] input[type="checkbox"]').forEach(x=>x.checked=false);state.shown=24;renderFinder();});
    $('[data-tp-filter-toggle]')?.addEventListener('click',e=>{const p=$('[data-tp-filter-panel]');p?.classList.toggle('is-expanded');e.currentTarget.setAttribute('aria-expanded',String(p?.classList.contains('is-expanded')));});
    const params=new URLSearchParams(location.search);performSearch(params.get('q')||"popular products",false,params.get('scope')||'');
  }

  function initEvents(){
    d.addEventListener('click',e=>{
      const c=e.target.closest('[data-compare-id]');if(c){toggleCompare(c.dataset.compareId);return;}
      const s=e.target.closest('[data-save-id]');if(s){toggleSave(s.dataset.saveId);return;}
      const r=e.target.closest('[data-remove-compare]');if(r){let rows=readStore(compareStore,[]).filter(x=>x.id!==r.dataset.removeCompare);writeStore(compareStore,rows);updateHeaderCounts();renderStoredCompare();return;}
      const t=e.target.closest('[data-result-tab]');if(t){state.activeTab=t.dataset.resultTab;state.shown=24;renderFinder();return;}
      const copy=e.target.closest('[data-copy-code]');if(copy){navigator.clipboard?.writeText(copy.dataset.copyCode);copy.textContent='Copied';return;}
      const couponToggle=e.target.closest('[data-coupon-toggle]');if(couponToggle){state.couponExpanded=!state.couponExpanded;renderCouponGrid();return;}
    });
    d.addEventListener('change',e=>{const input=e.target.closest('[data-target-id]');if(input){const map=readStore(targetStore,{});map[input.dataset.targetId]=input.value;writeStore(targetStore,map);}});
    const rerenderCoupons=debounce(()=>{state.couponExpanded=false;renderCouponGrid();},120);
    $$('[data-coupon-search],[data-coupon-country],[data-coupon-language]').forEach(x=>{x.addEventListener(x.tagName==='INPUT'?'input':'change',rerenderCoupons);});
  }

  if(typeof globalThis!=="undefined")globalThis.__TREND_PILOT_SEARCH_TEST__={normalizeQuery,inferFamily,inferAudience,inferGroups,familyMembers,makePlan,strictProductMatch,familyTitleGuard,state};

  async function boot(){
    initChrome();initEvents();initForms();initSearchSuggestions();initFinder();renderStoredCompare();renderSaved();renderDeals();
    if(d.body.matches('[data-tp-page="home"]'))renderHome();
  }
  if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',boot);else boot();
})();
