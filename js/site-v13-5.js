(() => {
  "use strict";

  const d = document;
  const $ = (s, r = d) => r.querySelector(s);
  const $$ = (s, r = d) => Array.from(r.querySelectorAll(s));
  const clean = (v) => String(v ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  const lower = (v) => clean(v).toLowerCase();
  const esc = (v) => clean(v).replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#039;",'"':"&quot;"}[c]));
  const validUrl = (v) => /^https?:\/\//i.test(clean(v));

  // TP_CJ_EXACT_GUARD_START
  const TP_CJ_GUARD_VERSION = "15.9.2";
  const TP_CJ_APPROVED_IDS = new Set(["2357926", "4295086", "4368684", "4837117", "5893489", "7227612", "7287203", "7563286"]);
  const TP_CJ_APPROVED_NAMES = new Set(["diecast", "diecastcom", "fragranceshop", "fragranceshopcom", "karaca", "karacaeu", "karacaeurope", "mfi", "mfimedical", "nordvpn", "pandahall", "pandahallcom", "thefragranceshop", "thefragranceshopcom", "tripcom", "tripcomglobal", "tiktokshopus"]);
  const TP_CJ_KNOWN_NAMES = new Set(["cjjoinedadvertisers", "diecast", "diecastcom", "diecastmodelswholesale", "diecastmodelswholesalecom", "fragranceshop", "fragranceshopcom", "karaca", "karacaeu", "karacaeurope", "mfi", "mfimedical", "nordvpn", "pandahall", "pandahallcom", "shoptemu", "sportsevents365", "temu", "temucom", "thefragranceshop", "thefragranceshopcom", "ticketnetwork", "ticketnetworkcom", "tripcom", "tripcomglobal", "tiktokshopus", "tiktok", "tiktokshop"]);
  const TP_CJ_TRACKING_HOST_RE = /(?:^|\.)(?:anrdoezrs\.net|apmebf\.com|awltovhc\.com|commission-junction\.com|dpbolvw\.net|emjcd\.com|ftjcfx\.com|jdoqocy\.com|kqzyfj\.com|lduhtrp\.net|qksrv\.net|tkqlhce\.com)$/i;
  const TP_CJ_GENERIC_TITLES = new Set(["browseproducts", "currentoffer", "currentoffers", "officialshop", "officialstore", "seller", "shop", "shopnow", "store", "viewproducts", "visitstore"]);

  function tpCjSellerKey(value) {
    return lower(value).replace(/[^a-z0-9]+/g, "");
  }

  function tpCjValue(p, keys) {
    for (const key of keys) {
      const value = p && p[key];
      if (value !== undefined && value !== null && String(value).trim() !== "") return value;
    }
    return "";
  }

  function tpCjId(p) {
    return String(tpCjValue(p, ["advertiserId","advertiser_id","advertiser-id","advertiserCid","advertiser_cid","cid"]) || "").replace(/\D+/g, "");
  }

  function tpCjSeller(p) {
    return clean(tpCjValue(p, ["advertiser","advertiserName","advertiser_name","advertiser-name","seller","sellerName","seller_name","merchant","merchantName","merchant_name"]));
  }

  function tpCjUrl(p) {
    return clean(tpCjValue(p, ["affiliateUrl","affiliate_url","buyUrl","buy_url","productUrl","product_url","clickUrl","click_url","url","destination","destinationUrl","destination_url"]));
  }

  function tpCjImage(p) {
    return clean(tpCjValue(p, ["image","imageUrl","image_url","imageLink","image_link","thumbnail","thumbnailUrl"]));
  }

  function tpCjTitle(p) {
    return clean(tpCjValue(p, ["title","name","productName","product_name"]));
  }

  function tpCjTrackingUrl(value) {
    if (!validUrl(value)) return false;
    try {
      return TP_CJ_TRACKING_HOST_RE.test(new URL(value).hostname.toLowerCase());
    } catch {
      return false;
    }
  }

  function tpIsCjItem(p) {
    const seller = tpCjSellerKey(tpCjSeller(p));
    const context = lower([
      p && p.network, p && p.networkName, p && p.provider,
      p && p.source, p && p.sourceId, p && p.programme,
      p && p.program, p && p.platform, p && p.affiliateNetwork
    ].map(value => clean(value)).join(" "));
    return Boolean(
      TP_CJ_KNOWN_NAMES.has(seller)
      || TP_CJ_APPROVED_IDS.has(tpCjId(p))
      || context.includes("commission junction")
      || /(^|[^a-z])cj([^a-z]|$)/i.test(context)
      || tpCjTrackingUrl(tpCjUrl(p))
    );
  }

  function tpCjSpecificEvidence(p) {
    const title = tpCjTitle(p);
    const seller = tpCjSeller(p);
    const titleKey = tpCjSellerKey(title);
    const sellerKey = tpCjSellerKey(seller);
    const url = tpCjUrl(p);
    const image = tpCjImage(p);
    if (!title || !validUrl(url) || !validUrl(image)) return false;
    if (TP_CJ_GENERIC_TITLES.has(titleKey)) return false;
    if (titleKey && sellerKey && titleKey === sellerKey) return false;
    return true;
  }

  function tpCjApproved(p) {
    const id = tpCjId(p);
    const seller = tpCjSellerKey(tpCjSeller(p));
    return TP_CJ_APPROVED_IDS.has(id) || TP_CJ_APPROVED_NAMES.has(seller);
  }

  function tpCjPublicAllowed(p) {
    if (!p || !tpIsCjItem(p)) return Boolean(p);
    return tpCjApproved(p) && tpCjSpecificEvidence(p);
  }

  function tpCjOfferAllowed(offer, parent) {
    const row = Object.assign({}, parent || {}, offer || {});
    if (!tpIsCjItem(row)) return true;
    return tpCjApproved(row) && validUrl(tpCjUrl(row));
  }
  // TP_CJ_EXACT_GUARD_END

// TP_PUBLIC_SELLER_GUARD_START
function tpPublicSellerAllowed(p) {
  if (!p) return false;
  const title = clean(p.name || p.title);
  const target = clean(p.url || p.affiliateUrl || p.productUrl);
  const seller = typeof tpCanonicalSellerV15_1 === "function" ? tpCanonicalSellerV15_1(p.advertiser || p.seller || p.merchant || "") : "";
  return Boolean(title && validUrl(target) && seller);
}
// TP_PUBLIC_SELLER_GUARD_END
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
    "business-sourcing":"Business sourcing","other":"More products",
    "health-medical":"Health & medical equipment",
    "arts-crafts":"Arts, crafts & jewelry making"
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
    "printing": ["printing-3d"],
    "medical":["health-medical"],
    "crafts":["arts-crafts"]
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
    "nail-care":"Nail care","grooming":"Grooming","personal-care":"Personal care","other-beauty-care":"Other beauty products",
    "model-cars-collectibles":"Model cars & collectibles",
    "home-kitchen":"Kitchen, dining & home",
    "cookware":"Cookware",
    "dinnerware":"Dinnerware & tableware",
    "cutlery":"Cutlery & flatware",
    "kitchen-appliances":"Kitchen appliances",
    "coffee-tea-machines":"Coffee & tea machines",
    "home-textiles":"Home textiles",
    "home-accessories":"Home accessories",
    "medical-equipment":"Medical equipment",
    "diagnostic-equipment":"Diagnostic equipment",
    "patient-monitoring":"Patient monitoring",
    "exam-room-equipment":"Exam-room equipment",
    "hospital-furniture":"Hospital furniture",
    "emergency-equipment":"Emergency equipment",
    "medical-supplies":"Medical supplies",
    "rehabilitation-equipment":"Rehabilitation equipment",
    "craft-supplies":"Craft supplies",
    "beads":"Beads",
    "jewelry-findings":"Jewelry findings",
    "jewelry-making-tools":"Jewelry-making tools",
    "cords-chains-wires":"Cords, chains & wires",
    "storage-organization":"Storage & organization",
    "finished-jewelry":"Finished jewelry",
    "sewing-diy":"Sewing & DIY",
    "sports-tickets":"Sports tickets & live events",
    "general-marketplace":"General marketplace",
    "computer-accessories":"Computer accessories",
    "camera-accessories":"Camera accessories",
    "car-accessories":"Car accessories",
    "clothing":"Clothing",
    "shoes":"Shoes",
    "jewelry":"Jewelry"
  };

  const GROUP_ROUTES = [
    ["apparel", /\b(clothing|clothes|apparel|garments?|fashion wear)\b/i],
    ["footwear", /\b(shoes?|footwear|sneakers?|trainers?|boots?|sandals?)\b/i],
    ["pet-supplies", /\b(pets?|dogs?|cats?|puppy|kitten|pet feeder|litter box)\b/i],
    ["phones-tablets", /\b(phones?|smartphones?|iphone|android phone|tablets?|ipad)\b/i],
    ["computers", /\b(laptops?|notebooks?|computers?|mini pc|monitors?|keyboard|ssd|thinkpad|ideapad|thinkbook|yoga|legion|lenovo loq|loq)\b/i],
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
    ["business-sourcing", /\b(supplier|manufacturer|wholesale|private label|custom logo|bulk order|factory)\b/i],
    ["health-medical", /\b(medical equipment|medical supplies|clinical equipment|diagnostic equipment|patient monitoring|hospital equipment)\b/i],
    ["arts-crafts", /\b(arts? and crafts?|craft supplies|jewelry making|beads?|jewelry findings|diy crafts?)\b/i],
    ["jewelry-watches", /\b(necklaces?|pendants?|chains?|chokers?|jewelry|jewellery|bracelets?|earrings?|rings?)\b/i]
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
    ["laptops", /\b(laptops?|notebook computers?|thinkpad|ideapad|thinkbook|yoga|legion|lenovo loq|loq)\b/i],
    ["smartphones", /\b(?:smartphones?|mobile phones?|cell phones?|android phones?|unlocked phones?|iphones?|samsung galaxy|google pixel|motorola(?: moto)?|moto g\d*|oneplus|xiaomi|redmi|oppo|vivo|realme|nothing phone)\b/i],
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
    ["phone-utility-software", /\b(dr\.fone|mobiletrans|phone transfer|phone recovery)\b/i],
    ["model-cars-collectibles", /\b(diecast|model cars?|scale models?|collectible cars?)\b/i],
    ["medical-equipment", /\b(medical equipment|clinical equipment|hospital equipment)\b/i],
    ["diagnostic-equipment", /\b(diagnostic equipment|otoscope|ophthalmoscope|stethoscope|ultrasound|ecg|ekg)\b/i],
    ["patient-monitoring", /\b(patient monitor|vital signs|pulse oximeter|spo2|blood pressure monitor)\b/i],
    ["craft-supplies", /\b(craft supplies|arts? and crafts?|diy supplies)\b/i],
    ["beads", /\b(beads?|gemstone beads?|glass beads?)\b/i],
    ["jewelry-findings", /\b(jewelry findings|clasps?|jump rings?|earring hooks?)\b/i],
    ["jewelry-making-tools", /\b(jewelry making tools?|beading tools?|pliers)\b/i],
    ["cookware", /\b(cookware|pots? and pans?|frying pans?|casseroles?)\b/i],
    ["dinnerware", /\b(dinnerware|dinner sets?|tableware|plates? and bowls?)\b/i]
  ];

  const AUDIENCE_LABELS = {men:"Men", women:"Women", kids:"Kids", unisex:"Unisex", all:"Audience not stated"};
  const state = {
    manifest: null, query: "", plan: null, segments: [], segmentState: new Map(), products: [], exact: [], alternatives: [],
    shown: 24, activeTab: "exact", loading: false, scope: "", couponExpanded: false,
    originalQuery: "", queryCorrected: false, selectedSeller: "" // TP_SELECTED_SELLER_V15_9_2
  };
  const compareStore = "trendpilot-v13-compare";
  const savedStore = "trendpilot-v13-saved";
  const targetStore = "trendpilot-v13-targets";
  const productCacheStore = "trendpilot-v13-product-cache";
  const analyticsStore = "trendpilot-v13-events";

  function readStore(key, fallback = []) { try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch { return fallback; } }
  function writeStore(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }

  // TP_CJ_BROWSER_CACHE_CLEANUP
  try {
    const guardKey="trendpilot-cj-guard-version";
    if(localStorage.getItem(guardKey)!==TP_CJ_GUARD_VERSION){
      const cleanArray=(key)=>writeStore(key,readStore(key,[]).map(normalizeProduct).filter(tpCjPublicAllowed));
      cleanArray(savedStore);
      cleanArray(compareStore);
      const cache=readStore(productCacheStore,{});
      const safe={};
      Object.entries(cache).forEach(([id,row])=>{const p=normalizeProduct(row);if(tpCjPublicAllowed(p))safe[id]=row;});
      writeStore(productCacheStore,safe);
      localStorage.setItem(guardKey,TP_CJ_GUARD_VERSION);
    }
  } catch {}
function normalizeProduct(p) {
    const x = {...p};
    x.id = clean(x.id || x.clusterKey || x.url || x.name);
    x.clusterKey = clean(x.clusterKey || x.id);
    x.name = clean(x.name);
    x.url = clean(x.url || x.affiliateUrl || x.productUrl);
    x.image = clean(x.image || x.imageUrl);
    x.advertiser = clean(x.advertiser || x.network || "Current seller");
    { const canonical = typeof tpCanonicalSellerV15_1 === "function" ? tpCanonicalSellerV15_1(x.advertiser) : ""; if (canonical) x.advertiser = canonical; }
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
    x.shippingPrice = x.shippingPrice === undefined || x.shippingPrice === null || x.shippingPrice === "" ? null : Number(x.shippingPrice);
    x.description = clean(x.description);
    x.brand = clean(x.brand);
    x.category = clean(x.category);
    x.material = clean(x.material);
    x.condition = clean(x.condition);
    x.delivery = clean(x.delivery);
    x.videoUrl = clean(x.videoUrl || x.video);
    x.videoSource = clean(x.videoSource || "Product data");
    x.images = uniq([x.image, ...(Array.isArray(x.images) ? x.images.map(clean) : [])]).filter(validUrl).slice(0, 8);
    x.specs = x.specs && typeof x.specs === "object" && !Array.isArray(x.specs) ? x.specs : {};
    x.sold = Number(x.sold || 0) || 0;
    x.variantCount = Number(x.variantCount || 1) || 1;
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
      const rows = Object.values(window.TRENDPILOT_MATCHED_PRODUCTS || {}).flat().filter(Boolean).map(normalizeProduct).filter(tpCjPublicAllowed);
      state.manifest = {version:"fallback", productCount:rows.length, segments:[], featured:rows.slice(0,24), rareUsed:[], dealCandidates:[], tokenRoutes:{}, groups:[]};
      state.products = rows;
      return state.manifest;
    }
  }


  // TP_SELLER_SEARCH_REPAIR_V15_6_4_START
  function tpEnrichCjTaxonomyV15_6_4(product){
    const p=normalizeProduct(product);
    const row={title:p.name||"",category:p.category||"",brand:p.brand||""};

    if(!p.group || p.group==="other"){
      const inferred=tpAdmitadGuessGroupV15_4(row);
      if(inferred) p.group=inferred;
    }

    if(!p.family || p.family==="other" || p.family===p.group){
      const inferredFamily=tpAdmitadGuessFamilyV15_4(row,p.group||"other");
      if(inferredFamily) p.family=inferredFamily;
    }

    const seller=tpCanonicalSellerV15_1(p.advertiser);

    if((!p.group || p.group==="other") && seller){
      const fallbackGroups={
        "Diecast":"toys-games",
        "FragranceShop.com":"beauty-care",
        "Karaca EU":"home-kitchen",
        "MFI Medical":"health-medical",
        "PandaHall":"arts-crafts"
      };
      if(fallbackGroups[seller]) p.group=fallbackGroups[seller];
    }

    if((!p.family || p.family==="other" || p.family===p.group) && seller){
      const fallbackFamilies={
        "Diecast":"model-cars-collectibles",
        "FragranceShop.com":"fragrance",
        "Karaca EU":"cookware",
        "MFI Medical":"medical-equipment",
        "PandaHall":"beads"
      };
      if(fallbackFamilies[seller]) p.family=fallbackFamilies[seller];
    }

    return p;
  }

  function tpSellerScopedRelevantV15_6_4(seller,query){
    const canonical=tpCanonicalSellerV15_1(seller)||clean(seller);
    const raw=lower(query||"");
    const expanded=tpExpandedTermsV15_1(raw);
    const tokens=words(raw);

    const sellerRows=(state.products||[]).filter(p=>{
      const rowSeller=tpCanonicalSellerV15_1(p.advertiser)||clean(p.advertiser);
      return rowSeller===canonical && tpCjPublicAllowed(p) && tpPublicSellerAllowed(p);
    });

    if(!raw || raw==="popular products") return sellerRows;

    return sellerRows.filter(p=>{
      const text=lower(`${p.name||""} ${p.brand||""} ${p.category||""} ${p.group||""} ${p.family||""}`);
      if(text.includes(raw)) return true;
      if(expanded.length && expanded.some(term=>text.includes(term))) return true;
      if(tokens.length && tokens.every(t=>text.includes(t))) return true;
      if(state.plan?.families?.includes(p.family)) return true;
      if(state.plan?.groups?.includes(p.group) && tokens.some(t=>text.includes(t))) return true;
      return false;
    }).sort((a,b)=>score(b,state.plan)-score(a,state.plan));
  }

  function tpSellerSuggestionsV15_6_4(seller){
    const canonical=tpCanonicalSellerV15_1(seller)||clean(seller);
    const counts=new Map();
    const stop=new Set(["the","and","for","with","from","this","that","new","sale","best","top","pcs","set","pack","product","products","item","items","free","shipping","many","global","online","ww","geo","geos"]);

    (state.products||[]).forEach(p=>{
      const rowSeller=tpCanonicalSellerV15_1(p.advertiser)||clean(p.advertiser);
      if(rowSeller!==canonical) return;

      words(`${p.name||""} ${p.category||""}`).forEach(w=>{
        if(w.length<3 || stop.has(w)) return;
        counts.set(w,(counts.get(w)||0)+1);
      });
    });

    return [...counts.entries()]
      .sort((a,b)=>b[1]-a[1])
      .slice(0,3)
      .map(([w])=>w);
  }
  // TP_SELLER_SEARCH_REPAIR_V15_6_4_END


  // TP_CJ_LIVE_SEARCH_V15_7_1_START
  const TP_CJ_LIVE_SELLERS_V15_7_1 = new Set(["Temu","PandaHall","FragranceShop.com","Karaca EU", "TikTok Shop US"]);

  async function tpLoadCjLiveProductsV15_7_1(query, requestedSeller=""){
    const seller=tpCanonicalSellerV15_1(requestedSeller)||clean(requestedSeller);
    if(seller && !TP_CJ_LIVE_SELLERS_V15_7_1.has(seller)) return [];

    const q=clean(query);
    if(q.length<2 || lower(q)==="popular products") return [];

    const params=new URLSearchParams({q});
    if(seller) params.set("seller",seller);

    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),10000);

    try{
      const response=await fetch(`/api/cj-live-products?${params.toString()}`,{
        cache:"no-store",
        signal:controller.signal,
        headers:{"accept":"application/json"}
      });
      if(!response.ok) return [];
      const payload=await response.json();
      if(!payload?.ok || !Array.isArray(payload.products)) return [];

      return payload.products
        .map(normalizeProduct)
        .map(tpEnrichCjTaxonomyV15_6_4)
        .filter(tpCjPublicAllowed)
        .filter(tpPublicSellerAllowed);
    }catch(error){
      if(error?.name!=="AbortError") console.warn("TrendPilot CJ live search unavailable",error);
      return [];
    }finally{
      clearTimeout(timer);
    }
  }
  // TP_CJ_LIVE_SEARCH_V15_7_1_END
  // TP_TIKTOK_LIVE_SELLER_V15_8_9_START
  function tpLiveSellerQueriesV15_8_9(query,seller){
    const q=lower(query||"").trim();
    const canonical=tpCanonicalSellerV15_1(seller)||clean(seller);
    if(canonical==="TikTok Shop US" && /^(?:phone|phones|smartphone|smartphones|mobile phone|mobile phones)$/i.test(q)){
      return ["smartphone","unlocked phone","android phone","mobile phone","cell phone","iphone","samsung galaxy","google pixel","5g phone"];
    }
    return [clean(query)].filter(Boolean);
  }

  function tpPrepareLiveSellerRowsV15_8_9(rows,seller,query){
    const canonical=tpCanonicalSellerV15_1(seller)||clean(seller);
    const q=lower(query||"").trim();
    let out=Array.isArray(rows)?rows.filter(Boolean):[];
    if(canonical==="TikTok Shop US" && /^(?:phone|phones|smartphone|smartphones|mobile phone|mobile phones)$/i.test(q)){
      const accessory=/\b(?:case|cover|screen protector|protector|charger|charging|cable|mount|holder|stand|strap|lanyard|chain|grip|dock|adapter|cleaning|cleaner|cleaning tool|repair kit|replacement|replacement part|charging port|phone port|accessor(?:y|ies)|headphones?|earbuds?|earphones?|headsets?|power bank|battery pack|wallet|suction cup|tripod|smart ?watch(?:es)?|watch(?:es)?|apple watch|galaxy watch|fitness tracker|fitness band|smart band|wristband|bracelet|wearable|smart ring|tablet|tablets|ipad|stylus|buds)\b/i;
      const device=/\b(?:smartphones?|mobile phones?|cell phones?|android phones?|unlocked phones?|iphones?|samsung galaxy(?:\s+[a-z0-9+.-]+)?|google pixel(?:\s+[a-z0-9+.-]+)?|motorola(?:\s+moto)?|moto\s+g\d*|oneplus|xiaomi|redmi|oppo|vivo|realme|nothing phone)\b/i;
      out=out.filter(p=>{
        const text=lower(`${p.name||""} ${p.category||""} ${p.brand||""}`);
        return device.test(text) && !accessory.test(text);
      }).map(p=>Object.assign({},p,{group:"phones-tablets",family:"smartphones"}));
    }
    const seen=new Set();
    return out.filter(p=>{
      const key=clean(p.clusterKey||p.id||p.url||p.name);
      if(!key || seen.has(key))return false;
      seen.add(key);
      return true;
    });
  }

  async function tpLoadSelectedLiveSellerV15_8_9(seller,query=state.query){
    const queries=tpLiveSellerQueriesV15_8_9(query,seller);
    const settled=await Promise.allSettled(queries.map(q=>tpLoadCjLiveProductsV15_7_1(q,seller)));
    const rows=[];
    settled.forEach(result=>{
      if(result.status==="fulfilled" && Array.isArray(result.value))rows.push(...result.value);
    });
    return tpPrepareLiveSellerRowsV15_8_9(rows,seller,query);
  }
  // TP_TIKTOK_LIVE_SELLER_V15_8_9_END

  // TP_V16_2_1_HYBRID_FINDER_START
async function tpLoadHybridProductsV16_2_1(query, requestedSeller="") {
  const q=clean(query);
  const seller=tpCanonicalSellerV15_1(requestedSeller)||clean(requestedSeller);

  if(q.length<2 || lower(q)==="popular products"){
    return {rows:[],meta:null};
  }

  const params=new URLSearchParams({
    q,
    limit:"100",
    test:"1621"
  });

  if(seller)params.set("seller",seller);

  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),12000);

  try{
    const response=await fetch(`/api/products-v16-hybrid?${params.toString()}`,{
      cache:"no-store",
      signal:controller.signal,
      headers:{"accept":"application/json"}
    });

    if(!response.ok)return {rows:[],meta:null};

    const payload=await response.json();

    if(!payload?.ok || !Array.isArray(payload.products)){
      return {rows:[],meta:payload||null};
    }

    const rows=payload.products
      .map(row=>{
        const source={...row};

        source.name=clean(
          source.name ||
          source.title ||
          source.productName ||
          source.product_name
        );

        source.url=clean(
          source.url ||
          source.affiliateUrl ||
          source.affiliate_url ||
          source.destinationUrl ||
          source.destination_url ||
          source.productUrl ||
          source.product_url
        );

        source.image=clean(
          source.image ||
          source.imageUrl ||
          source.image_url
        );

        source.advertiser=clean(
          source.advertiser ||
          source.seller ||
          source.merchant ||
          source.network
        );

        let p=normalizeProduct(source);

        if(typeof tpEnrichCjTaxonomyV15_6_4==="function"){
          p=tpEnrichCjTaxonomyV15_6_4(p);
        }

        p._tpHybridV16_2_1=true;
        p.intentTier=Number(row.intentTier||0)||0;
        p.hybridMatchScore=Number(row.matchScore||0)||0;
        p.hybridFallbackSource=clean(
          row.fallbackSource ||
          (Array.isArray(payload.fallbackSources)
            ? payload.fallbackSources.join(", ")
            : "") ||
          "v16-index"
        );

        return p;
      })
      .filter(tpCjPublicAllowed)
      .filter(tpPublicSellerAllowed);

    return {rows,meta:payload};
  }catch(error){
    if(error?.name!=="AbortError"){
      console.warn("TrendPilot V16.2.1 hybrid finder unavailable",error);
    }
    return {rows:[],meta:null};
  }finally{
    clearTimeout(timer);
  }
}
// TP_V16_2_1_HYBRID_FINDER_END

  // TP_CJ_SEARCH_BRIDGE_START
  let tpCjProductsPromise = null;
  async function loadCjProducts() {
    if (tpCjProductsPromise) return tpCjProductsPromise;
    tpCjProductsPromise = (async () => {
      try {
        const r = await fetch(`/data/cj-products.json?v=14.1.5-${Date.now()}`, {cache:"no-store"});
        if (!r.ok) throw new Error(`CJ products ${r.status}`);
        const data = await r.json();
        return (Array.isArray(data.products) ? data.products : []).map(normalizeProduct).map(tpEnrichCjTaxonomyV15_6_4).filter(tpCjPublicAllowed);
      } catch (error) {
        console.warn("TrendPilot CJ products unavailable", error);
        return [];
      }
    })();
    return tpCjProductsPromise;
  }
  // TP_CJ_SEARCH_BRIDGE_END

  // TP_ADMITAD_LIVE_BRIDGE_V15_4_START
  let tpAdmitadProductsPromiseV15_4 = null;

  function tpAdmitadGuessGroupV15_4(row) {
    const text = lower(`${row.title||""} ${row.category||""} ${row.brand||""}`);
    const routes = [
      ["phones-tablets", /\b(phone|smartphone|iphone|android|tablet|ipad|phone case|screen protector)\b/i],
      ["computers", /\b(laptop|notebook|computer|monitor|keyboard|mouse|ssd|ram|mini pc|thinkpad|ideapad|thinkbook|yoga|legion|lenovo loq|loq)\b/i],
      ["audio", /\b(earbuds?|headphones?|speaker|microphone|headset|tws)\b/i],
      ["cameras", /\b(camera|lens|tripod|gimbal|photography)\b/i],
      ["projectors-tv", /\b(projector|television|smart tv|tv box)\b/i],
      ["smart-home", /\b(smart light|led strip|security camera|doorbell|robot vacuum|smart plug)\b/i],
      ["automotive", /\b(carplay|dash cam|car charger|car holder|automotive|car accessories?)\b/i],
      ["home-kitchen", /\b(kitchen|cookware|frying pan|pot|home|bedding|furniture|vacuum)\b/i],
      ["tools", /\b(tool|drill|saw|screwdriver|multimeter|workshop|tester)\b/i],
      ["office-school", /\b(pen|pencil|notebook|school|office|stationery|paper|printer ink)\b/i],
      ["sports-outdoors", /\b(sport|fitness|gym|camping|cycling|yoga|outdoor)\b/i],
      ["beauty-care", /\b(beauty|makeup|cosmetic|perfume|fragrance|skin care|hair care)\b/i],
      ["baby-kids", /\b(baby|toddler|kids?|children)\b/i],
      ["toys-games", /\b(toy|game|gaming|building blocks)\b/i],
      ["pet-supplies", /\b(pet|dog|cat|aquarium)\b/i],
      ["printing-3d", /\b(3d print|filament|3d printer|thermal printer|label printer)\b/i],
      ["health-medical", /\b(medical|clinical|blood pressure|patient|diagnostic|health)\b/i],
      ["arts-crafts", /\b(craft|bead|jewelry making|sewing|diy)\b/i],
      ["apparel", /\b(dress|shirt|tshirt|t-shirt|hoodie|jacket|clothing|pants|shorts)\b/i],
      ["footwear", /\b(shoes?|sneakers?|boots?|sandals?)\b/i],
      ["bags-accessories", /\b(backpack|handbag|wallet|luggage|bag)\b/i],
      ["jewelry-watches", /\b(necklace|bracelet|ring|earrings?|watch|jewelry|jewellery)\b/i]
    ];
    return (routes.find(([,re])=>re.test(text)) || ["other"])[0];
  }

  function tpAdmitadGuessFamilyV15_4(row, group) {
    const text = lower(`${row.title||""} ${row.category||""} ${row.brand||""}`);
    const routes = [
      ["power-banks", /\b(power banks?|portable chargers?|battery packs?)\b/i],
      ["phone-cases", /\b(phone cases?|mobile covers?|iphone cases?|protective cases?)\b/i],
      ["smartphones", /\b(smartphones?|mobile phones?|iphone)\b/i],
      ["laptops", /\b(laptops?|notebook computers?|thinkpad|ideapad|thinkbook|yoga|legion|lenovo loq|loq)\b/i],
      ["earbuds", /\b(earbuds?|tws|earphones?)\b/i],
      ["headphones", /\b(headphones?|headsets?)\b/i],
      ["portable-projector", /\b(projectors?|mini projector|portable projector)\b/i],
      ["security-camera", /\b(security cameras?|ip cameras?|cctv|video doorbell)\b/i],
      ["robot-vacuum", /\b(robot(?:ic)? vacuums?)\b/i],
      ["smart-lighting", /\b(smart lights?|led strips?|light strips?|smart bulbs?)\b/i],
      ["thermal-printer", /\b(thermal printers?|label printers?|receipt printers?)\b/i],
      ["3d-filament", /\b(filament|pla|petg|abs filament)\b/i],
      ["fragrance", /\b(perfumes?|fragrances?|cologne|eau de parfum|eau de toilette)\b/i],
      ["cookware", /\b(cookware|frying pans?|pots? and pans?)\b/i],
      ["medical-equipment", /\b(medical equipment|clinical equipment)\b/i],
      ["craft-supplies", /\b(craft supplies|beads?|jewelry making)\b/i],
      ["dresses", /\b(dresses?|gowns?)\b/i],
      ["running-shoes", /\b(running shoes?|jogging shoes?)\b/i]
    ];
    return (routes.find(([,re])=>re.test(text)) || [group])[0];
  }

  async function loadAdmitadProductsV15_4() {
    if (tpAdmitadProductsPromiseV15_4) return tpAdmitadProductsPromiseV15_4;
    tpAdmitadProductsPromiseV15_4 = (async () => {
      try {
        const r = await fetch("/data/admitad-products-new-account-v15-3-2.json?v=15.6.0",{cache:"force-cache"});
        if (!r.ok) throw new Error(`Admitad products ${r.status}`);
        const payload = await r.json();
        if (Number(payload.website_id)!==2980568 || payload.domain!=="trendpilotchoice.com") {
          throw new Error("Admitad new-domain catalog safety check failed");
        }
        const rows = Array.isArray(payload.products) ? payload.products : [];
        return rows.map((row,index)=>{
          const group = tpAdmitadGuessGroupV15_4(row);
          const family = tpAdmitadGuessFamilyV15_4(row,group);
          return normalizeProduct({
            id:`admitad-${row.campaign_id||"x"}-${clean(row.source_id)||index}`,
            clusterKey:`admitad-${row.campaign_id||"x"}-${clean(row.source_id)||index}`,
            name:row.title,
            url:row.affiliate_url,
            image:row.image,
            advertiser:row.seller,
            network:"Admitad",
            group,
            family,
            audience:"all",
            brand:row.brand,
            category:row.category,
            price:row.price,
            currency:row.currency||"USD",
            quality:row.image?72:62,
            offerCount:1,
            storeCount:1,
            description:`Product supplied by ${row.seller||"an approved Admitad seller"} through the TrendPilot new-account product feed.`
          });
        }).filter(p=>p.name && validUrl(p.url));
      } catch (error) {
        console.warn("TrendPilot Admitad products unavailable",error);
        return [];
      }
    })();
    return tpAdmitadProductsPromiseV15_4;
  }
  // TP_ADMITAD_LIVE_BRIDGE_V15_4_END


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
    // TP_PHONE_INTENT_V15_8_6
    const plainPhoneQuery=lower(q).trim();
    if(/^(?:phone|phones|smartphone|smartphones|mobile phone|mobile phones|android phone|android phones|iphone|iphones)$/i.test(plainPhoneQuery)) return "smartphones";
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
    const generic=new Set(["men","mens","women","womens","kids","kid","children","child","baby","product","products","item","items","all","popular"]);
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
      "pet-supplies":["pet","pets","supplies"], "health-medical":["medical","health","clinical","equipment","supplies"], "arts-crafts":["art","arts","craft","crafts","bead","beads","supplies"], "printing-3d":["printing","printer","printers","3d"]
    };
    groups.forEach(g=>(groupGeneric[g]||[]).forEach(x=>generic.add(x)));
    if(family) familyMembers(family,state.manifest).forEach(x=>x.split("-").forEach(t=>generic.add(t)));
    return words(q).filter(t=>!generic.has(t));
  }

  // TP_V15_1_FEDERATED_START
  const TP_PRODUCT_SELLERS_V15_1 = ["AliExpress","Alibaba","Geekbuying","FilamentPRO EU CPS","Govee Many GEOs","Harfington Many GEOs","Sunsky-online WW","Lenovo","Diecast","FragranceShop.com","Karaca EU","MFI Medical","PandaHall","TikTok Shop US","Temu"];
  const TP_CPC_SELLERS_V15_1 = new Set(["AliExpress","Alibaba","Geekbuying"]);
  const TP_SELLER_ALIASES_V15_1 = {
    "aliexpress":"AliExpress","ali express":"AliExpress","aliexpress.com":"AliExpress",
    "alibaba":"Alibaba","alibaba.com":"Alibaba",
    "geekbuying":"Geekbuying","geek buying":"Geekbuying","geekbuying ww":"Geekbuying",
    "filamentpro":"FilamentPRO EU CPS","filamentpro eu":"FilamentPRO EU CPS","filamentpro eu cps":"FilamentPRO EU CPS",
    "govee":"Govee Many GEOs","govee many geos":"Govee Many GEOs",
    "harfington":"Harfington Many GEOs","harfington many geos":"Harfington Many GEOs","harrington":"Harfington Many GEOs","harrington many geos":"Harfington Many GEOs",
    "sunsky":"Sunsky-online WW","sunsky online":"Sunsky-online WW","sunsky-online":"Sunsky-online WW","sunsky-online ww":"Sunsky-online WW",
    "lenovo":"Lenovo","lenovo many geos":"Lenovo",
    "diecast":"Diecast","diecast.com":"Diecast","diecast models wholesale":"Diecast",
    "fragranceshop.com":"FragranceShop.com","fragrance shop":"FragranceShop.com","the fragrance shop":"FragranceShop.com",
    "karaca":"Karaca EU","karaca eu":"Karaca EU","karaca europe":"Karaca EU",
    "mfi":"MFI Medical","mfi medical":"MFI Medical","mfimedical":"MFI Medical",
    "pandahall":"PandaHall","panda hall":"PandaHall",
    "tiktok":"TikTok Shop US","tiktok shop":"TikTok Shop US","tiktok shop us":"TikTok Shop US","tiktokshop":"TikTok Shop US",
    "temu":"Temu","temu.com":"Temu","shop temu":"Temu"
  };
  const TP_QUERY_ALIASES_V15_1 = {
    "necklace":["necklace","necklaces","pendant","pendants","chain necklace","chains","choker","chokers","neck jewelry","neck jewellery"],
    "necklaces":["necklace","necklaces","pendant","pendants","chain necklace","chains","choker","chokers","neck jewelry","neck jewellery"],
    "jewelry":["jewelry","jewellery","necklace","pendant","ring","bracelet","earrings","fashion jewelry"],
    "jewellery":["jewelry","jewellery","necklace","pendant","ring","bracelet","earrings","fashion jewellery"],
    "women clothing":["women clothing","women's clothing","womens clothing","womenswear","ladies clothing","women fashion","dresses","tops","blouses","skirts","pants","jackets"],
    "women's clothing":["women clothing","women's clothing","womens clothing","womenswear","ladies clothing","women fashion","dresses","tops","blouses","skirts","pants","jackets"],
    "womens clothing":["women clothing","women's clothing","womens clothing","womenswear","ladies clothing","women fashion","dresses","tops","blouses","skirts","pants","jackets"],
    "phone":["phone","phones","smartphone","smartphones","mobile phone","mobile phones","android phone","iphone"],
    "phones":["phone","phones","smartphone","smartphones","mobile phone","mobile phones","android phone","iphone"],
    "phone case":["phone case","phone cases","mobile case","mobile cover","smartphone case","iphone case","protective case"],
    "phone cases":["phone case","phone cases","mobile case","mobile cover","smartphone case","iphone case","protective case"],
    "perfume":["perfume","perfumes","fragrance","fragrances","cologne","eau de parfum","eau de toilette"],
    "tool":["tool","tools","power tools","hand tools","workshop tools","diy tools"],
    "tools":["tool","tools","power tools","hand tools","workshop tools","diy tools"],
    "laptop":["laptop","laptops","notebook computer","notebook computers","thinkpad","ideapad","thinkbook","yoga","legion","lenovo loq","loq"],
    "printer":["printer","printers","laser printer","inkjet printer","thermal printer","label printer"],
    "hose":["hose","hoses","hose fitting","hose fittings","hydraulic hose","rubber hose","tube","tubing","pipe fitting","connector"]
  };
  const TP_SELLER_SPECIALTY_V15_1 = {
    "FragranceShop.com":["beauty-care"],
    "Karaca EU":["home-kitchen"],
    "MFI Medical":["health-medical"],
    "Diecast":["toys-games"],
    "PandaHall":["arts-crafts","jewelry-watches"],
    "Lenovo":["computers"],
    "Geekbuying":["phones-tablets","computers","audio","cameras","projectors-tv","smart-home","automotive","home-kitchen","tools"],
    "FilamentPRO EU CPS":["printing-3d"],
    "Govee Many GEOs":["smart-home","home-kitchen"],
    "Harfington Many GEOs":[],
    "Sunsky-online WW":["phones-tablets","computers","audio","cameras","projectors-tv","smart-home","automotive","home-kitchen","tools"],
    "TikTok Shop US":[],
    "Temu":[],
    "AliExpress":[],
    "Alibaba":[]
  };
  function tpCanonicalSellerV15_1(value) {
    const raw=lower(value);
    for (const [alias,canonical] of Object.entries(TP_SELLER_ALIASES_V15_1)) {
      if (raw===alias || raw.includes(alias)) return canonical;
    }
    return "";
  }
  function tpExpandedTermsV15_1(q) {
    const raw=lower(q);
    const out=[];
    for (const [phrase,terms] of Object.entries(TP_QUERY_ALIASES_V15_1)) {
      if (raw===phrase || raw.includes(phrase) || phrase.includes(raw)) out.push(...terms);
    }
    return uniq(out.map(lower).filter(Boolean));
  }
  function tpTitleMatchesExpandedV15_1(p,plan) {
    const terms=tpExpandedTermsV15_1(plan?.q||"");
    if (!terms.length) return false;
    const text=lower(`${p.name||""} ${p.brand||""} ${p.category||""} ${p.family||""} ${p.description||""}`);
    return terms.some(term=>aliasBoundaryMatch(text,term));
  }
  let tpSellerCoveragePromiseV15_1=null;
  async function tpLoadSellerCoverageV15_1() {
    if (tpSellerCoveragePromiseV15_1) return tpSellerCoveragePromiseV15_1;
    tpSellerCoveragePromiseV15_1=fetch(`/data/seller-coverage-v15-1.json?v=15.1.1-${Date.now()}`,{cache:"no-store"})
      .then(r=>r.ok?r.json():{sellers:{}})
      .catch(()=>({sellers:{}}));
    return tpSellerCoveragePromiseV15_1;
  }
  function tpPlanRelevantSellerKeysV15_1(seller,index) {
    const all=(index?.sellers?.[seller]?.segmentKeys||[]).filter(Boolean);
    const direct=new Set(state.plan?.segmentKeys||[]);
    let keys=all.filter(key=>direct.has(key));
    if (!keys.length && state.plan?.groups?.length) {
      keys=all.filter(key=>{
        const meta=segmentMeta(key);
        return meta && state.plan.groups.includes(meta.group);
      });
    }
    if (!keys.length && state.plan?.families?.length) {
      keys=all.filter(key=>{
        const meta=segmentMeta(key);
        return meta && state.plan.families.includes(meta.family);
      });
    }
    return keys;
  }
  async function tpLoadBalancedSellerRowsV15_1() {
    const index=await tpLoadSellerCoverageV15_1();
    const jobs=[];
    for (const seller of TP_PRODUCT_SELLERS_V15_1) {
      const keys=tpPlanRelevantSellerKeysV15_1(seller,index).slice(0,2);
      for (const key of keys) jobs.push(loadSegmentPage(key,1));
    }
    return (await Promise.all(jobs)).flat();
  }
  async function tpLoadSellerSpecificV15_1(seller) {
  seller=tpCanonicalSellerV15_1(seller)||seller;
  if (!seller) return;
  const index=await tpLoadSellerCoverageV15_1();
  const sellerKeys=(index?.sellers?.[seller]?.segmentKeys||[]).filter(Boolean);
  const direct=tpPlanRelevantSellerKeysV15_1(seller,index);
  const familySet=new Set(state.plan?.families||[]);
  const groupSet=new Set(state.plan?.groups||[]);
  const familyKeys=sellerKeys.filter(key=>{const meta=segmentMeta(key);return meta&&familySet.has(meta.family);});
  const groupKeys=sellerKeys.filter(key=>{const meta=segmentMeta(key);return meta&&groupSet.has(meta.group);});
  const keys=uniq([...direct,...familyKeys,...groupKeys]).slice(0,24);
  const target=48;
  const maxPagesPerKey=12;
  const maxNewPageLoads=24;
  let newPageLoads=0;
  for (const key of keys) {
    const meta=segmentMeta(key);
    if (!meta) continue;
    const pageLimit=Math.min(meta.pages||1,maxPagesPerKey);
    for (let page=1; page<=pageLimit && newPageLoads<maxNewPageLoads; page++) {
      const before=state.segmentState.get(key);
      const alreadyLoaded=Boolean(before?.loaded?.has(page));
      const rows=await loadSegmentPage(key,page);
      if(!alreadyLoaded)newPageLoads++;
      if (rows.length) mergeProducts(rows);
      const count=state.exact.filter(p=>tpCanonicalSellerV15_1(p.advertiser)===seller).length;
      if (count>=target) return;
    }
    if(newPageLoads>=maxNewPageLoads)break;
  }
}
  function tpDiversifySellersV15_1(rows) {
    const buckets=new Map();
    for (const p of rows) {
      const seller=tpCanonicalSellerV15_1(p.advertiser);
      if (!seller) continue;
      if (!buckets.has(seller)) buckets.set(seller,[]);
      buckets.get(seller).push(p);
    }
    const ordered=[];
    let round=0;
    while (ordered.length<rows.length && round<80) {
      let added=false;
      for (const seller of TP_PRODUCT_SELLERS_V15_1) {
        const row=buckets.get(seller)?.[round];
        if (row) { ordered.push(row); added=true; }
      }
      if (!added) break;
      round++;
    }
    const seen=new Set(ordered.map(p=>p.id));
    return [...ordered,...rows.filter(p=>!seen.has(p.id))];
  }
  // TP_LENOVO_DIRECT_LINK_V15_5_3_START
  function tpSellerNoResultMarkupV15_1(seller,query,plan) {
    if(clean(seller).toLowerCase()==="lenovo"){
      const lenovoAffiliateUrl="https://bednari.com/g/6iia5dppfe179d0dbedccc01b591a8/";
      return `<div class="tp-empty" data-tp-lenovo-direct-link="15.5.3"><h3>Lenovo product feed temporarily unavailable.</h3><p>TrendPilot detected incorrect Lenovo feed data and removed those unrelated listings instead of showing misleading products.</p><a class="tp-btn tp-btn-primary" href="${esc(lenovoAffiliateUrl)}" target="_blank" rel="sponsored noopener">Visit Lenovo</a><button class="tp-btn tp-btn-light" type="button" data-tp-search-all-sellers>Compare with all approved sellers</button></div>`;
    }
    const specialty=TP_SELLER_SPECIALTY_V15_1[seller]||[];
    const mismatch=specialty.length && plan?.groups?.length && !plan.groups.some(g=>specialty.includes(g));
    const reason=mismatch
      ? `${seller} mainly covers other product categories in TrendPilot's connected catalogue.`
      : `No current indexed ${seller} listing closely matches “${query}”. This does not prove the seller never carries it.`;
    return `<div class="tp-empty"><h3>No matching ${esc(seller)} products found.</h3><p>${esc(reason)}</p><button class="tp-btn tp-btn-primary" type="button" data-tp-search-all-sellers>Search all approved sellers</button></div>`;
  }
  // TP_LENOVO_DIRECT_LINK_V15_5_3_END
  // TP_V15_1_FEDERATED_END

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
      const data = await r.json(); return (data.products || []).map(normalizeProduct).filter(tpCjPublicAllowed);
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
    // TP_SMARTPHONE_GUARD_V15_9_2
    if(plan.families?.includes("smartphones")) {
      const tpPhoneText=lower(`${p.name||""} ${p.category||""} ${p.brand||""}`);
      const tpPhoneAccessory=/\b(?:case|cover|screen protector|protector|charger|charging|cable|mount|holder|stand|strap|lanyard|chain|grip|dock|adapter|cleaning|cleaner|cleaning tool|repair kit|replacement|replacement part|charging port|phone port|accessor(?:y|ies)|headphones?|earbuds?|earphones?|headsets?|power bank|battery pack|wallet|suction cup|tripod|smart ?watch(?:es)?|watch(?:es)?|apple watch|galaxy watch|fitness tracker|fitness band|smart band|wristband|bracelet|wearable|smart ring|tablet|tablets|ipad|stylus|buds)\b/i;
      const tpRealPhone=/\b(?:smartphones?|mobile phones?|cell phones?|android phones?|unlocked phones?|iphones?|samsung galaxy(?:\s+[a-z0-9+.-]+)?|google pixel(?:\s+[a-z0-9+.-]+)?|motorola(?:\s+moto)?|moto\s+g\d*|oneplus|xiaomi|redmi|oppo|vivo|realme|nothing phone)\b/i;
      if(tpPhoneAccessory.test(tpPhoneText))return false;
      if(!tpRealPhone.test(tpPhoneText) && p.family!=="smartphones")return false;
    }
    if(plan.families?.includes("laptops") && /\b(bag|sleeve|stand|charger|keyboard cover|skin sticker)\b/i.test(text))return false;
    if(plan.families?.includes("office-printers") && /\b(ink|toner|cartridge|paper|label|printer head)\b/i.test(text))return false;
    if(plan.families?.includes("digital-cameras") && /\b(camera bag|lens cap|tripod|gimbal|battery charger)\b/i.test(text))return false;
    return true;
  }
  function strictProductMatch(p, plan) {
    // TP_HYBRID_EXACT_GATE_V16_2_3
  if(p._tpHybridV16_2_1){
    return Number(p.intentTier||0) >= 4;
  }
    if (plan.groups.length && !plan.groups.includes(p.group)) return false;
    if (plan.families?.length && !plan.families.includes(p.family)) return false;
    if (plan.audience && p.audience !== plan.audience) return false;
    if (!familyTitleGuard(p,plan)) return false;
    if (plan.families?.length || plan.audience) return true;
    const title = lower(`${p.name} ${p.brand || ""} ${p.category || ""} ${p.family || ""}`);
    const titleTokens = words(title);
    if (typeof tpTitleMatchesExpandedV15_1 === "function" && tpTitleMatchesExpandedV15_1(p,plan)) return true;
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
    // TP_HYBRID_SCORE_V16_2_3
    if(p._tpHybridV16_2_1){
      const tier=Math.max(0,Number(p.intentTier||0));
      const hs=Number(p.hybridMatchScore||0);
      n += tier*1000 + Math.max(-900,Math.min(900,hs/8));
    }
    const title = lower(p.name), q = plan.q;
    if (q && title.includes(q)) n += 100;
    plan.intentTokens.forEach(t => { if (title.includes(t)) n += 22; else if (lower(`${p.brand} ${p.category}`).includes(t)) n += 8; });
    if (plan.families?.includes(p.family)) n += 60;
    if (plan.audience && p.audience === plan.audience) n += 40;
    if (typeof tpTitleMatchesExpandedV15_1 === "function" && tpTitleMatchesExpandedV15_1(p,plan)) n += 45;
    if (typeof TP_CPC_SELLERS_V15_1 !== "undefined" && TP_CPC_SELLERS_V15_1.has(tpCanonicalSellerV15_1(p.advertiser)) && n >= 45) n += 2.5;
    return n;
  }
  function mergeProducts(rows) {
  rows = (rows || []).filter(tpCjPublicAllowed);

  const map = new Map(
    state.products
      .filter(tpCjPublicAllowed)
      .map(p => [p.clusterKey || p.id,p])
  );

  rows.forEach(p => {
    const key=p.clusterKey||p.id;
    if(
      !map.has(key) ||
      score(p,state.plan)>score(map.get(key),state.plan)
    ){
      map.set(key,p);
    }
  });

  state.products = [...map.values()].filter(tpCjPublicAllowed);

  // TP_HYBRID_EXACT_POOL_V16_2_3
  const hybridRows=state.products.filter(p=>p._tpHybridV16_2_1);
  const exactSource=hybridRows.length ? hybridRows : state.products;

  const rankedExact=exactSource
    .filter(p=>strictProductMatch(p,state.plan))
    .sort((a,b)=>score(b,state.plan)-score(a,state.plan));

  state.exact=typeof tpDiversifySellersV15_1==="function"
    ? tpDiversifySellersV15_1(rankedExact)
    : rankedExact;

  const exactKeys=new Set(
    rankedExact.map(p=>p.clusterKey||p.id)
  );

  state.alternatives=state.products
    .filter(p=>{
      const key=p.clusterKey||p.id;
      if(exactKeys.has(key))return false;

      if(p._tpHybridV16_2_1){
        return Number(p.intentTier||0)<4;
      }

      return relatedMatch(p,state.plan);
    })
    .sort((a,b)=>score(b,state.plan)-score(a,state.plan));
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
  function snapshot(p) { const keep=["id","clusterKey","name","url","image","images","advertiser","group","family","audience","quality","rating","reviews","sold","price","oldPrice","currency","shippingPrice","delivery","material","condition","offerCount","storeCount","variantCount","offers","brand","category","description","specs","videoUrl","videoSource","rareScore","raritySignals","generatedAt"]; return Object.fromEntries(keep.filter(k=>p[k]!==undefined).map(k=>[k,p[k]])); }
  function detailUrl(p) {
    const params = new URLSearchParams({id:p.id});
    if (state.originalQuery && state.originalQuery !== "popular products") params.set("q", state.originalQuery);
    if (state.scope) params.set("scope", state.scope);
    return `/product/?${params.toString()}`;
  }
  function cacheProduct(p) {
    if (!p?.id) return;
    const cache = readStore(productCacheStore, {});
    cache[p.id] = {...snapshot(p), cachedAt:Date.now()};
    const entries = Object.entries(cache).sort((a,b)=>(b[1]?.cachedAt||0)-(a[1]?.cachedAt||0)).slice(0,80);
    writeStore(productCacheStore, Object.fromEntries(entries));
  }
  function findProduct(id) {
    const row=state.products.find(p=>p.id===id) || readStore(productCacheStore,{})[id] || readStore(savedStore,[]).find(p=>p.id===id) || readStore(compareStore,[]).find(p=>p.id===id);
    return row&&tpCjPublicAllowed(normalizeProduct(row))?row:null;
  }
  function productCard(p, compact=false) {
    const saved=savedIds().has(p.id), compared=compareIds().has(p.id), off=discount(p), total=totalPrice(p), details=detailUrl(p);
    return `<article class="tp-product-card${compact?' tp-product-card-compact':''}" data-product-id="${esc(p.id)}">
      <div class="tp-product-media"><a class="tp-product-detail-link" href="${esc(details)}" data-product-detail-id="${esc(p.id)}" aria-label="View details for ${esc(p.name)}">${imageMarkup(p)}</a>${off?`<span class="tp-deal-badge">Seller −${off}%</span>`:""}<button class="tp-quick-view-trigger" data-quick-view-id="${esc(p.id)}" type="button" aria-label="Quick view ${esc(p.name)}">◉ <span>Quick view</span></button></div>
      <div class="tp-product-content">
        <div class="tp-card-top"><span>${esc(p.advertiser)}</span><b>${esc(familyLabel(p))}</b></div>
        <h3><a class="tp-product-name-link" href="${esc(details)}" data-product-detail-id="${esc(p.id)}">${esc(p.name)}</a></h3>
        <div class="tp-price-row"><strong>${money(p.price,currency(p))}</strong>${p.oldPrice>p.price?`<del>${money(p.oldPrice,currency(p))}</del>`:""}</div>
        <div class="tp-card-evidence">
          ${p.storeCount>1?`<span>${p.storeCount} stores</span>`:`<span>${p.offerCount||1} offer</span>`}
          ${p.rating?`<span>★ ${p.rating.toFixed(1)}${p.reviews?` (${fmt.format(p.reviews)})`:""}</span>`:""}
          ${p.delivery?`<span>${esc(p.delivery)}</span>`:""}
          ${p.shippingPrice!==null?`<span>Total ${money(total,currency(p))}</span>`:""}
        </div>
        <div class="tp-card-actions">
          <a class="tp-btn tp-btn-primary tp-view-offer" href="${esc(p.url)}" target="_blank" rel="nofollow sponsored noopener" data-tp-outbound data-product-id="${esc(p.id)}" data-merchant="${esc(p.advertiser)}">Check price ↗</a>
          <button class="tp-icon-button${compared?' is-active':''}" data-compare-id="${esc(p.id)}" type="button" aria-label="${compared?'Remove from':'Add to'} comparison">⇄</button>
          <button class="tp-icon-button${saved?' is-active':''}" data-save-id="${esc(p.id)}" type="button" aria-label="${saved?'Remove from':'Save to'} price watch">${saved?'♥':'♡'}</button>
        </div>
      </div></article>`;
  }

  function trackEvent(name, detail={}) {
    const safeDetail = Object.fromEntries(Object.entries(detail).filter(([,v])=>["string","number","boolean"].includes(typeof v)).map(([k,v])=>[k,typeof v==="string"?clean(v).slice(0,180):v]));
    const event = {name, ...safeDetail, timestamp:new Date().toISOString(), path:location.pathname};
    const rows = readStore(analyticsStore, []); rows.push(event); writeStore(analyticsStore, rows.slice(-200));
    try { window.dataLayer?.push({event:`trendpilot_${name}`,...safeDetail}); } catch {}
    try { if (typeof window.gtag === "function") window.gtag("event", `trendpilot_${name}`, safeDetail); } catch {}
    try { window.dispatchEvent(new CustomEvent("trendpilot:analytics", {detail:event})); } catch {}
  }

  function confidenceFor(p) {
    const evidence = [Boolean(p.image), Boolean(p.price), Boolean(p.description), Boolean(Object.keys(p.specs||{}).length), Boolean(p.delivery), p.shippingPrice!==null, Boolean(p.rating&&p.reviews), Boolean(p.brand), Boolean(p.offerCount), Boolean(p.url)];
    const score = Math.round(evidence.filter(Boolean).length / evidence.length * 100);
    return {score, label:score>=80?"Strong data":score>=60?"Good data":score>=40?"Partial data":"Limited data"};
  }
  function specText(p) { return lower(`${p.description||""} ${Object.entries(p.specs||{}).map(([k,v])=>`${k} ${v}`).join(" ")}`); }
  function buyerChecks(p) {
    const text=specText(p), checks=[];
    if (!p.shippingPrice && p.shippingPrice!==0) checks.push("Shipping cost is not supplied. Confirm the delivered total before payment.");
    if (!p.delivery) checks.push("Delivery time is not supplied for your destination.");
    if (!p.rating || !p.reviews) checks.push("Independent rating evidence is not available in the current product data.");
    if (p.oldPrice>p.price) checks.push("The crossed-out price is seller-provided and is not yet a verified 90-day price history.");
    if (["apparel","footwear"].includes(p.group)) {
      if (!p.material && !/cotton|polyester|wool|linen|leather|fabric/.test(text)) checks.push("Material or fabric composition is not clearly stated.");
      if (!/size chart|measurement|size guide|cm|inch/.test(text)) checks.push("Check the seller's size chart and garment measurements.");
      if (p.audience==="all") checks.push("The intended audience is not stated clearly in the feed.");
    }
    if (["phones-tablets","computers","audio","cameras","projectors-tv","smart-home","automotive"].includes(p.group)) {
      if (!/compatible|compatibility|works with|support|model|platform/.test(text)) checks.push("Exact model or device compatibility is not confirmed in the supplied data.");
      if (!/warranty|guarantee/.test(text)) checks.push("Warranty information is not stated.");
    }
    if (p.group==="software") {
      if (!/windows|mac|android|ios|iphone|web|platform/.test(text)) checks.push("Supported operating systems are not clearly stated.");
      if (!/annual|year|lifetime|subscription|renew|licen[cs]e/.test(text)) checks.push("Licence duration and renewal terms need confirmation.");
    }
    if (p.group==="business-sourcing") {
      if (!/moq|minimum order/.test(text)) checks.push("Minimum order quantity is not stated.");
      if (!/sample/.test(text)) checks.push("Sample availability is not stated.");
      if (!/lead time|production/.test(text)) checks.push("Production lead time is not stated.");
    }
    if (p.group==="toys-games") {
      if (/console|game|gaming/.test(lower(`${p.name} ${p.family}`)) && !/platform|playstation|xbox|switch|pc|android|ios/.test(text)) checks.push("Game platform or console compatibility is not stated.");
      if (!/age|years old|adult|kids/.test(text)) checks.push("Age suitability is not stated in the current product data.");
    }
    if (!checks.length) checks.push("Confirm the latest price, stock and return terms on the seller page before payment.");
    return uniq(checks).slice(0,6);
  }
  function positiveEvidence(p) {
    const rows=[];
    if (p.price) rows.push(`Current listed price: ${money(p.price,currency(p))}.`);
    if (p.storeCount>1) rows.push(`${p.storeCount} seller offers are grouped for comparison.`);
    if (p.rating&&p.reviews) rows.push(`Rating evidence: ${p.rating.toFixed(1)} from ${fmt.format(p.reviews)} review${p.reviews===1?"":"s"}.`);
    if (p.delivery) rows.push(`Delivery evidence supplied: ${p.delivery}.`);
    if (p.material) rows.push(`Material supplied: ${p.material}.`);
    if (p.brand) rows.push(`Brand or maker supplied: ${p.brand}.`);
    if (Object.keys(p.specs||{}).length) rows.push(`${Object.keys(p.specs).length} specification fields are available.`);
    return rows.length?rows.slice(0,6):["The current feed supplies only basic product identity and seller information."];
  }
  function bestFor(p) {
    const type=familyLabel(p);
    const map={
      "apparel":`Shoppers comparing the exact ${type.toLowerCase()} type, audience and delivered cost.`,
      "footwear":`Shoppers comparing ${type.toLowerCase()}, sizing evidence and return terms.`,
      "toys-games":`Shoppers checking edition, age suitability, platform compatibility and included accessories.`,
      "software":`Buyers comparing platform support, licence duration, device limits and renewal terms.`,
      "business-sourcing":`Business buyers comparing MOQ, sample availability, customisation and production time.`,
      "automotive":`Drivers checking vehicle compatibility before comparing price and delivery.`,
      "beauty-care":`Shoppers comparing the exact beauty product type, shade or use and seller evidence.`,
      "pet-supplies":`Pet owners checking animal size, capacity, power needs and cleaning requirements.`,
      "sports-outdoors":`Shoppers comparing intended use, size or capacity and safety evidence.`,
      "home-kitchen":`Shoppers checking dimensions, power requirements, materials and delivered cost.`
    };
    return map[p.group]||`Shoppers comparing ${type.toLowerCase()} offers, product evidence and total cost.`;
  }
  function matchReasons(p, query="") {
    const reasons=[`Classified as ${familyLabel(p)} in ${GROUP_LABELS[p.group]||"the catalogue"}.`];
    if (p.audience && p.audience!=="all") reasons.push(`Audience classified as ${AUDIENCE_LABELS[p.audience]||p.audience}.`);
    const qwords=words(query); const title=lower(p.name); const hits=qwords.filter(w=>title.includes(w));
    if (hits.length) reasons.push(`The title contains ${hits.slice(0,4).join(", ")}.`);
    if (p.storeCount>1) reasons.push(`Equivalent offers were grouped across ${p.storeCount} stores.`);
    return reasons.slice(0,5);
  }
  function productSpecs(p) {
    const rows=[]; const push=(label,value)=>{const v=clean(value);if(v&&!rows.some(x=>lower(x[0])===lower(label)))rows.push([label,v]);};
    push("Brand",p.brand); push("Product type",familyLabel(p));
    if (p.audience!=="all") push("Audience",AUDIENCE_LABELS[p.audience]||p.audience);
    push("Material",p.material); push("Condition",p.condition); push("Delivery",p.delivery);
    if (p.shippingPrice!==null) push("Shipping",money(p.shippingPrice,currency(p)));
    if (p.rating) push("Rating",`${p.rating.toFixed(1)}${p.reviews?` from ${fmt.format(p.reviews)} reviews`:""}`);
    if (p.sold) push("Recorded sales",fmt.format(p.sold));
    Object.entries(p.specs||{}).forEach(([label,value])=>push(label,value));
    return rows.slice(0,22);
  }
  function videoInfo(url) {
    if (!validUrl(url)) return null;
    try {
      const u=new URL(url), host=u.hostname.toLowerCase(); let id="";
      if (host.includes("youtu.be")) id=u.pathname.split("/").filter(Boolean)[0]||"";
      if (host.includes("youtube.com")) id=u.searchParams.get("v")||u.pathname.match(/\/(?:embed|shorts)\/([^/?]+)/)?.[1]||"";
      if (id) return {type:"embed", embed:`https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}`, url};
      if (host.includes("vimeo.com")) {id=u.pathname.split("/").filter(Boolean).find(x=>/^\d+$/.test(x))||"";if(id)return {type:"embed",embed:`https://player.vimeo.com/video/${id}`,url};}
      if (/\.(mp4|webm|mov)(?:$|\?)/i.test(url)) return {type:"video",url};
    } catch {}
    return {type:"link",url};
  }
  function productCacheLookup(id) { const row=readStore(productCacheStore,{})[id]; return row?normalizeProduct(row):null; }
  async function loadProductById(id) {
    const cached=productCacheLookup(id); if(cached?.name&&cached?.url&&cached?.description) return {product:cached,peers:state.products};
    const m=await loadManifest();
    const cjProducts=await loadCjProducts();
    const featured=[...(m.featured||[]),...(m.dealCandidates||[]),...(m.rareUsed||[])].map(normalizeProduct).filter(tpCjPublicAllowed);
    const direct=featured.find(p=>p.id===id)||state.products.find(p=>p.id===id)||cjProducts.find(p=>p.id===id);
    const base=clean(m.productIndexBase||"/data/search-catalog/product-index").replace(/\/$/,"");
    if (id && base) {
      try {
        const indexResponse=await fetch(`${base}/${encodeURIComponent(id.slice(0,2))}.json?v=13-5`,{cache:"no-store"});
        if (indexResponse.ok) {
          const index=await indexResponse.json(); const entry=index.products?.[id];
          if (Array.isArray(entry)&&entry[0]) {
            const shardResponse=await fetch(entry[0],{cache:"no-store"});
            if (shardResponse.ok) {
              const shard=await shardResponse.json(); const peers=(shard.products||[]).map(normalizeProduct).filter(tpCjPublicAllowed); const product=normalizeProduct(peers[Number(entry[1])]||peers.find(p=>p.id===id));
              if (product?.id && tpCjPublicAllowed(product)) {product.generatedAt=shard.generatedAt||m.generatedAt; cacheProduct(product); return {product,peers};}
            }
          }
        }
      } catch (error) { console.warn("TrendPilot product lookup failed",error); }
    }
    if (direct && tpCjPublicAllowed(direct)) {direct.generatedAt=m.generatedAt;cacheProduct(direct);return {product:direct,peers:featured};}
    return {product:null,peers:[]};
  }
  function offerRows(p) {
    const rows=(Array.isArray(p.offers)&&p.offers.length?p.offers:[{advertiser:p.advertiser,url:p.url,price:p.price,oldPrice:p.oldPrice,currency:p.currency,shippingPrice:p.shippingPrice,delivery:p.delivery,condition:p.condition}]);
    return rows.filter(o=>tpCjOfferAllowed(o,p)).map(o=>({advertiser:clean(o.advertiser||p.advertiser||"Seller"),url:clean(o.url||p.url),price:Number(o.price||0)||0,oldPrice:Number(o.oldPrice||0)||0,currency:clean(o.currency||p.currency||"USD"),shippingPrice:o.shippingPrice===undefined||o.shippingPrice===null||o.shippingPrice===""?null:Number(o.shippingPrice),delivery:clean(o.delivery),condition:clean(o.condition)})).filter(o=>validUrl(o.url));
  }
  function offersTable(p) {
    const rows=offerRows(p); if(!rows.length)return '<div class="tp-empty"><h3>No active seller link is available.</h3></div>';
    const totals=rows.map(o=>o.price+(Number.isFinite(o.shippingPrice)?o.shippingPrice:0)); const min=Math.min(...totals.filter(x=>x>0));
    return `<div class="tp-offers-table" role="table"><div class="tp-offers-row tp-offers-head" role="row"><span>Seller</span><span>Price</span><span>Shipping</span><span>Total</span><span>Delivery</span><span></span></div>${rows.map((o,i)=>{const total=totals[i];return `<div class="tp-offers-row" role="row"><strong>${esc(o.advertiser)}</strong><span>${money(o.price,o.currency)}</span><span>${o.shippingPrice===null?"Not stated":money(o.shippingPrice,o.currency)}</span><span>${total?money(total,o.currency):"Not supplied"}${total===min&&rows.length>1?'<b class="tp-best-badge">Lowest total</b>':""}</span><span>${esc(o.delivery||"Not stated")}</span><a class="tp-btn tp-btn-primary tp-btn-small" href="${esc(o.url)}" target="_blank" rel="nofollow sponsored noopener" data-tp-outbound data-product-id="${esc(p.id)}" data-merchant="${esc(o.advertiser)}">Check price ↗</a></div>`}).join("")}</div>`;
  }
  function injectProductStructuredData(p) {
    $("#tp-product-jsonld")?.remove(); const offers=offerRows(p).filter(o=>o.price).slice(0,10).map(o=>({"@type":"Offer",url:o.url,price:o.price,priceCurrency:o.currency,availability:"https://schema.org/InStock",seller:{"@type":"Organization",name:o.advertiser}}));
    const data={"@context":"https://schema.org","@type":"Product",name:p.name,description:p.description||`Compare ${familyLabel(p)} product evidence and seller offers.`,image:p.images?.length?p.images:(p.image?[p.image]:undefined),brand:p.brand?{"@type":"Brand",name:p.brand}:undefined,offers:offers.length===1?offers[0]:(offers.length?offers:undefined)};
    if(p.rating&&p.reviews)data.aggregateRating={"@type":"AggregateRating",ratingValue:p.rating,reviewCount:p.reviews};
    Object.keys(data).forEach(k=>data[k]===undefined&&delete data[k]); const script=d.createElement("script");script.id="tp-product-jsonld";script.type="application/ld+json";script.textContent=JSON.stringify(data);d.head.appendChild(script);
  }
  function updateProductMeta(p) {
    d.title=`${p.name} — Prices, checks and offers | TrendPilot AI`;
    const desc=`Review price, seller offers, available specifications and buyer checks for ${p.name}.`.slice(0,155);
    let meta=$("meta[name='description']");if(!meta){meta=d.createElement("meta");meta.name="description";d.head.appendChild(meta);}meta.content=desc;
    let canonical=$("link[rel='canonical']");if(!canonical){canonical=d.createElement("link");canonical.rel="canonical";d.head.appendChild(canonical);}canonical.href=`${location.origin}/product/?id=${encodeURIComponent(p.id)}`;
  }
  function mediaGallery(p) {
    const images=p.images?.length?p.images:(p.image?[p.image]:[]); if(!images.length)return `<div class="tp-detail-main-image">${imageMarkup(p)}</div>`;
    return `<div class="tp-detail-main-image"><img src="${esc(images[0])}" alt="${esc(p.name)}" data-tp-image></div>${images.length>1?`<div class="tp-detail-thumbs">${images.slice(0,6).map((url,i)=>`<button type="button" data-gallery-image="${esc(url)}" aria-label="Show image ${i+1}"><img src="${esc(url)}" alt="" loading="lazy" data-tp-image></button>`).join("")}</div>`:""}`;
  }
  function videoBlock(p) {
    const info=videoInfo(p.videoUrl); if(!info)return "";
    if(info.type==="link")return `<section class="tp-detail-section"><div class="tp-detail-section-head"><span>Product video</span><h2>Video supplied with the product data</h2></div><a class="tp-btn tp-btn-light" href="${esc(info.url)}" target="_blank" rel="noopener nofollow">Open video ↗</a></section>`;
    return `<section class="tp-detail-section"><div class="tp-detail-section-head"><span>Product video</span><h2>See the product in use</h2><p>Video source: ${esc(p.videoSource||"Product data")}. It is not played automatically.</p></div><div class="tp-video-shell" data-video-shell data-video-type="${esc(info.type)}" data-video-url="${esc(info.type==="embed"?info.embed:info.url)}"><button class="tp-video-play" data-video-play type="button">▶ Watch video</button></div></section>`;
  }
  function detailTemplate(p,peers,query) {
    const confidence=confidenceFor(p),checks=buyerChecks(p),positives=positiveEvidence(p),specs=productSpecs(p),reasons=matchReasons(p,query);
    const alternatives=peers.filter(x=>x.id!==p.id&&x.family===p.family&&(!p.audience||p.audience==="all"||x.audience===p.audience||x.audience==="all")).slice(0,4);
    state.products=uniqProducts([...state.products,p,...alternatives]);
    const bestAlt=alternatives[0];
    return `<div class="tp-shell tp-product-breadcrumb"><a href="/">Home</a><span>›</span><a href="/find/?q=${encodeURIComponent(familyLabel(p))}">${esc(GROUP_LABELS[p.group]||"Products")}</a><span>›</span><b>${esc(familyLabel(p))}</b></div>
    <section class="tp-product-detail-hero"><div class="tp-shell tp-product-detail-grid"><div class="tp-detail-media">${mediaGallery(p)}</div><div class="tp-detail-summary"><span class="tp-kicker">${esc(familyLabel(p))}</span><h1>${esc(p.name)}</h1><div class="tp-detail-meta"><span>${esc(p.advertiser)}</span>${p.brand?`<span>${esc(p.brand)}</span>`:""}<span>${confidence.label} · ${confidence.score}%</span></div><div class="tp-detail-price"><strong>${money(p.price,currency(p))}</strong>${p.oldPrice>p.price?`<del>${money(p.oldPrice,currency(p))}</del>`:""}</div><p class="tp-best-for"><b>Best for:</b> ${esc(bestFor(p))}</p><div class="tp-detail-actions"><a class="tp-btn tp-btn-primary" href="${esc(p.url)}" target="_blank" rel="nofollow sponsored noopener" data-tp-outbound data-product-id="${esc(p.id)}" data-merchant="${esc(p.advertiser)}">Check price at ${esc(p.advertiser)} ↗</a><button class="tp-btn tp-btn-light" data-compare-id="${esc(p.id)}" type="button">⇄ Compare</button><button class="tp-btn tp-btn-light" data-save-id="${esc(p.id)}" type="button">♡ Save</button></div><p class="tp-affiliate-note">TrendPilot may earn a commission if you buy through a seller link. Organic product ranking is not determined by commission.</p><div class="tp-last-checked">Catalogue checked: ${esc((p.generatedAt||state.manifest?.generatedAt||"Recently").replace("T"," ").replace("Z"," UTC"))}</div></div></div></section>
    <div class="tp-shell tp-product-detail-content"><section class="tp-decision-panel"><div><span>TrendPilot decision brief</span><h2>Useful evidence before the seller page</h2></div><div class="tp-decision-columns"><article><h3>Evidence available</h3><ul>${positives.map(x=>`<li>${esc(x)}</li>`).join("")}</ul></article><article class="tp-check-panel"><h3>Check before buying</h3><ul>${checks.map(x=>`<li>${esc(x)}</li>`).join("")}</ul></article><article><h3>Why this matched</h3><ul>${reasons.map(x=>`<li>${esc(x)}</li>`).join("")}</ul></article></div></section>
    <section class="tp-detail-section"><div class="tp-detail-section-head"><span>Seller offers</span><h2>Compare the delivered evidence</h2><p>Prices, stock and delivery can change. Confirm them on the seller page.</p></div>${offersTable(p)}</section>
    <section class="tp-detail-section"><div class="tp-detail-section-head"><span>Specifications</span><h2>What the current product data tells us</h2></div>${specs.length?`<dl class="tp-spec-grid">${specs.map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>`:`<div class="tp-empty"><h3>Detailed specifications were not supplied.</h3><p>Use the buyer checks above before opening the seller.</p></div>`}</section>
    ${videoBlock(p)}
    ${alternatives.length?`<section class="tp-detail-section"><div class="tp-detail-section-head"><span>Same-type alternatives</span><h2>Compare before deciding</h2>${bestAlt?`<button class="tp-btn tp-btn-light" data-compare-pair="${esc(p.id)},${esc(bestAlt.id)}" type="button">Compare with the best alternative</button>`:""}</div><div class="tp-product-grid">${alternatives.map(x=>productCard(x,true)).join("")}</div></section>`:""}</div>`;
  }
  async function renderProductDetail() {
    const host=$("[data-tp-product-detail]"); if(!host)return;
    const params=new URLSearchParams(location.search), id=clean(params.get("id")), query=clean(params.get("q"));
    if(!id){host.innerHTML='<div class="tp-shell tp-empty tp-empty-large"><h1>Select a product first.</h1><p>Open a product from search results to see its decision page.</p><a class="tp-btn tp-btn-primary" href="/find/">Find products</a></div>';return;}
    host.innerHTML='<div class="tp-shell tp-product-loading"><span></span><p>Loading product evidence…</p></div>';
    const {product,peers}=await loadProductById(id);
    if(!product || !tpCjPublicAllowed(product)){host.innerHTML='<div class="tp-shell tp-empty tp-empty-large"><h1>This product could not be loaded.</h1><p>The feed may have refreshed or the offer may no longer be available.</p><a class="tp-btn tp-btn-primary" href="/find/">Search the current catalogue</a></div>';return;}
    product.generatedAt=product.generatedAt||state.manifest?.generatedAt; cacheProduct(product); updateProductMeta(product); injectProductStructuredData(product); host.innerHTML=detailTemplate(product,peers,query); bindImages(host); trackEvent("product_view",{productId:product.id,merchant:product.advertiser,family:product.family});
  }
  let quickPreviousFocus=null;
  function ensureQuickViewModal() {
    let modal=$("[data-tp-quick-view]");if(modal)return modal;
    modal=d.createElement("div");modal.className="tp-quick-view";modal.hidden=true;modal.dataset.tpQuickView="";modal.innerHTML='<button class="tp-quick-backdrop" data-quick-close type="button" aria-label="Close quick view"></button><section class="tp-quick-dialog" role="dialog" aria-modal="true" aria-labelledby="tp-quick-title"><button class="tp-quick-close" data-quick-close type="button" aria-label="Close quick view">×</button><div data-quick-content></div></section>';d.body.appendChild(modal);return modal;
  }
  function closeQuickView() {const modal=$("[data-tp-quick-view]");if(!modal)return;modal.classList.remove("is-open");d.body.classList.remove("tp-modal-open");setTimeout(()=>{modal.hidden=true;},180);quickPreviousFocus?.focus?.();}
  async function openQuickView(id) {
    quickPreviousFocus=d.activeElement;const modal=ensureQuickViewModal(),content=$("[data-quick-content]",modal);modal.hidden=false;requestAnimationFrame(()=>modal.classList.add("is-open"));d.body.classList.add("tp-modal-open");content.innerHTML='<div class="tp-product-loading"><span></span><p>Loading quick view…</p></div>';
    let p=findProduct(id);if(!p){p=(await loadProductById(id)).product;}if(!p){content.innerHTML='<div class="tp-empty"><h3>Product unavailable</h3></div>';return;}p=normalizeProduct(p);if(!tpCjPublicAllowed(p)){content.innerHTML='<div class="tp-empty"><h3>Product unavailable</h3></div>';return;}cacheProduct(p);state.products=uniqProducts([...state.products,p]);const checks=buyerChecks(p).slice(0,2),confidence=confidenceFor(p);
    content.innerHTML=`<div class="tp-quick-grid"><div class="tp-quick-media">${imageMarkup(p)}</div><div class="tp-quick-copy"><span class="tp-kicker">${esc(familyLabel(p))}</span><h2 id="tp-quick-title">${esc(p.name)}</h2><div class="tp-detail-price"><strong>${money(p.price,currency(p))}</strong>${p.oldPrice>p.price?`<del>${money(p.oldPrice,currency(p))}</del>`:""}</div><p><b>${confidence.label}:</b> ${confidence.score}% of key product evidence is available.</p><ul class="tp-quick-checks">${checks.map(x=>`<li>${esc(x)}</li>`).join("")}</ul><div class="tp-detail-actions"><a class="tp-btn tp-btn-light" href="${esc(detailUrl(p))}" data-product-detail-id="${esc(p.id)}">Full details</a><a class="tp-btn tp-btn-primary" href="${esc(p.url)}" target="_blank" rel="nofollow sponsored noopener" data-tp-outbound data-product-id="${esc(p.id)}" data-merchant="${esc(p.advertiser)}">Check price ↗</a></div><p class="tp-affiliate-note">Seller link · commission may be earned.</p></div></div>`;bindImages(content);$("[data-quick-close]",modal)?.focus();trackEvent("quick_view_open",{productId:p.id,merchant:p.advertiser,family:p.family});
  }
  function addComparePair(ids) {
    let rows=readStore(compareStore,[]);for(const id of ids){const p=findProduct(id);if(p&&!rows.some(x=>x.id===id))rows.push(snapshot(normalizeProduct(p)));}writeStore(compareStore,rows.slice(-3));updateHeaderCounts();toast("Two same-type products added to comparison");setTimeout(()=>{location.href="/compare/";},350);
  }

  function activeProducts() { return state.activeTab === "related" ? state.alternatives : state.exact; }
  function filters() {
    return {
      group:$('[data-filter-group]')?.value||"", family:$('[data-filter-family]')?.value||"", audience:$('[data-filter-audience]')?.value||"",
      merchant:($('[data-filter-merchant]')?clean($('[data-filter-merchant]').value):(state.selectedSeller||"")), price:$('[data-filter-price]')?.value||"", sort:$('[data-filter-sort]')?.value||"smart",
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
    let out=rows.filter(p=>{if(!tpCjPublicAllowed(p))return false;if(!tpCjPublicAllowed(p))return false;if(!tpCjPublicAllowed(p))return false;if(!tpCjPublicAllowed(p))return false;if(!tpPublicSellerAllowed(p))return false;
      if(f.group&&p.group!==f.group&&!(relatedRows&&state.plan?.family==="makeup"&&p.group==="bags-accessories"))return false;
      if(selectedFamilies.length&&!relatedRows&&!selectedFamilies.includes(p.family))return false; if(f.audience&&p.audience!==f.audience)return false;
      if(f.merchant){
        const wantedSeller=tpCanonicalSellerV15_1(f.merchant)||clean(f.merchant);
        const rowSeller=tpCanonicalSellerV15_1(p.advertiser)||clean(p.advertiser);
        if(rowSeller!==wantedSeller)return false;
      } if(f.coupon&&!couponFor(p))return false; if(f.rare&&!(p.rareScore>=4&&["used","refurbished","open-box"].includes(p.condition)))return false;
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
    const rows=state.products.filter(tpCjPublicAllowed);
    const group=$('[data-filter-group]'), family=$('[data-filter-family]'), audience=$('[data-filter-audience]'), merchant=$('[data-filter-merchant]');
    if(group){const current=group.value; group.innerHTML='<option value="">All categories</option>'+uniq(rows.map(p=>p.group)).sort().map(v=>`<option value="${esc(v)}">${esc(GROUP_LABELS[v]||v)}</option>`).join(""); group.value=current|| (state.plan.groups.length===1?state.plan.groups[0]:"");}
    if(family){const current=family.value; const g=group?.value; const vals=uniq(rows.filter(p=>!g||p.group===g).map(p=>p.family)).filter(v=>!v.includes(":")).sort(); const parent=state.plan.family&&state.plan.families?.length>1&&(!g||state.plan.groups.includes(g))?`<option value="${esc(state.plan.family)}">${esc(familyLabelValue(state.plan.family))}</option>`:""; family.innerHTML='<option value="">All specific types</option>'+parent+vals.map(v=>`<option value="${esc(v)}">${esc(familyLabelValue(v))}</option>`).join(""); family.value=current||state.plan.family||"";}
    if(audience)audience.value=audience.value||state.plan.audience||"";
    // TP_CJ_DROPDOWN_13_8_13
    if(merchant){
      const current=state.selectedSeller||tpCanonicalSellerV15_1(merchant.value)||merchant.value;
      const matchedRows=uniqProducts([...(state.exact||[]),...(state.alternatives||[])]);
      const counts=new Map(TP_PRODUCT_SELLERS_V15_1.map(name=>[name,0]));
      matchedRows.forEach(p=>{
        const seller=tpCanonicalSellerV15_1(p.advertiser);
        if(counts.has(seller))counts.set(seller,counts.get(seller)+1);
      });
      merchant.innerHTML='<option value="">All sellers</option>'+TP_PRODUCT_SELLERS_V15_1.map(v=>`<option value="${esc(v)}">${esc(v)}${counts.get(v)?` (${counts.get(v)})`:""}</option>`).join("");
      merchant.value=TP_PRODUCT_SELLERS_V15_1.includes(current)?current:"";
    }

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
    const rows=filterProducts(activeProducts());
    const noun=state.activeTab==="exact"?"exact matches":"related alternatives";
    const selectedSeller=tpCanonicalSellerV15_1(filters().merchant)||filters().merchant;
    let renderRows=rows;

    if(!renderRows.length && selectedSeller && state.activeTab==="exact" && selectedSeller!=="Lenovo"){
      renderRows=tpSellerScopedRelevantV15_6_4(selectedSeller,state.query);
    }

    const visible=renderRows.slice(0,state.shown);

    if(visible.length){
      grid.innerHTML=visible.map(p=>productCard(p)).join("");
    }else if(selectedSeller&&state.activeTab==="exact"){
      const hints=tpSellerSuggestionsV15_6_4(selectedSeller);
      const base=tpSellerNoResultMarkupV15_1(selectedSeller,state.query,state.plan);
      grid.innerHTML=hints.length
        ? base.replace("</div>",`<p class="tp-seller-hints">Try this seller with: <strong>${hints.map(esc).join(", ")}</strong></p></div>`)
        : base;
    }else{
      grid.innerHTML=`<div class="tp-empty"><h3>No ${noun} found.</h3><p>${state.activeTab==="exact"?"Try a more specific product name, change the category, or open Related alternatives. TrendPilot will not invent a match from an unrelated description.":"No useful alternatives are available for this search yet."}</p></div>`;
    }
    bindImages(grid);
    const count=$('[data-tp-results-count]'), status=$('[data-tp-finder-status]'), title=$('[data-tp-results-title]');
    if(title)title.textContent=`${state.activeTab==="exact"?"Exact matches":"Related alternatives"} for “${state.query}”`;
    if(count)count.textContent=selectedSeller&&renderRows!==rows?`${fmt.format(renderRows.length)} seller matches`:resultCountLabel();
    if(status){
      const scan=scannedCandidateCount();
      const progress=candidatePagesExhausted()?"Catalogue check complete.":"More relevant catalogue pages can still be checked.";
      const correction=state.queryCorrected?`Corrected “${state.originalQuery}” to “${state.query}”. `:"";
      const hybridStatusV16_2_1=state.hybridMeta
        ? (state.hybridMeta.fallbackUsed
            ? " Wider live/catalogue sources were added."
            : " V16 hybrid index active.")
        : "";
      status.textContent=`${correction}Showing ${fmt.format(visible.length)} of ${fmt.format(renderRows.length)} ${selectedSeller&&renderRows!==rows?"seller matches":noun}. ${fmt.format(scan)} candidates checked. ${progress}${hybridStatusV16_2_1}`;
    }
    const more=$('[data-tp-load-more]'); if(more){
      const moreLoaded=renderRows.length>state.shown;
      const moreRemote=state.activeTab==="exact"&&!state.hybridMeta&&!candidatePagesExhausted();
      more.hidden=!(moreLoaded||moreRemote);
      more.textContent=state.loading?"Checking more products…":moreLoaded?`Show ${Math.min(24,renderRows.length-state.shown)} more`:"Check more catalogue pages";
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
  // TP_PRESERVE_SELLER_V15_6_5
  const merchantBeforeSearch=$('[data-filter-merchant]');
  const preservedSeller=state.selectedSeller||tpCanonicalSellerV15_1(merchantBeforeSearch?.value)||merchantBeforeSearch?.value||"";
  state.selectedSeller=preservedSeller;
  const normalized=normalizeQuery(query);
  state.originalQuery=normalized.original; state.query=normalized.query; state.queryCorrected=normalized.corrected;
  state.scope=scope||""; state.shown=24; state.activeTab="exact"; state.products=[]; state.exact=[]; state.alternatives=[]; state.segmentState.clear(); state.loading=true;
  const cjLiveQueryV15_7_1=state.query;

    // V16.2.1: hybrid owns all-seller live fallback.
    // Keep direct CJ only for an explicitly selected CJ seller.
    const cjLivePromiseV15_7_1=(preservedSeller && TP_CJ_LIVE_SELLERS_V15_7_1.has(preservedSeller))
      ? tpLoadSelectedLiveSellerV15_8_9(preservedSeller,cjLiveQueryV15_7_1)
      : Promise.resolve([]);

    const hybridPromiseV16_2_1=tpLoadHybridProductsV16_2_1(
      state.query,
      preservedSeller
    );
  resetFilterControls();
  const grid=$('[data-tp-product-grid]');
  if(grid)grid.innerHTML='<div class="tp-empty"><h3>Checking matching products…</h3><p>TrendPilot is loading the most relevant catalogue records.</p></div>';
  try {
    const m=await loadManifest(); state.plan=makePlan(state.query,m,state.scope); state.segments=state.plan.segmentKeys.map(segmentMeta).filter(Boolean);
    if(push){const params=new URLSearchParams({q:state.query});if(state.scope)params.set("scope",state.scope);history.replaceState(null,"",`/find/?${params.toString()}`);}
    const input=$('[data-tp-finder-input]');if(input)input.value=state.query;
    const scopeSelect=$('[data-tp-finder-scope]');if(scopeSelect)scopeSelect.value=state.scope;
    const results=await Promise.allSettled([
      hybridPromiseV16_2_1,
      state.manifest.version==="fallback"?Promise.resolve(state.products):loadInitialSegments(),
      loadCjProducts(),
      typeof tpLoadBalancedSellerRowsV15_1==="function"?tpLoadBalancedSellerRowsV15_1():Promise.resolve([]),
      loadAdmitadProductsV15_4()
    ]);

    const hybridPayload=results[0].status==="fulfilled"
      ? results[0].value
      : {rows:[],meta:null};

    const rows=results[1].status==="fulfilled"?results[1].value:[];
    const cjRows=results[2].status==="fulfilled"?results[2].value:[];
    const balancedRows=results[3].status==="fulfilled"?results[3].value:[];
    const admitadRows=results[4].status==="fulfilled"?results[4].value:[];

    state.hybridMeta=hybridPayload?.meta||null;

    mergeProducts([
      ...(hybridPayload?.rows||[]),
      ...rows,
      ...cjRows,
      ...balancedRows,
      ...admitadRows
    ]);

    if(state.exact.length<24 && !state.hybridMeta){
      await Promise.race([
        ensureMinimumExact(24),
        new Promise(resolve=>setTimeout(resolve,6500))
      ]);
    }
    populateFilters();
    if(preservedSeller){
      const merchantAfterSearch=$('[data-filter-merchant]');
      if(merchantAfterSearch && [...merchantAfterSearch.options].some(o=>o.value===preservedSeller)){
        merchantAfterSearch.value=preservedSeller;
      }
    }
    renderFinder();

    cjLivePromiseV15_7_1.then(liveRows=>{
      if(cjLiveQueryV15_7_1!==state.query || !Array.isArray(liveRows) || !liveRows.length) return;
      mergeProducts(liveRows);
      populateFilters();
      if(preservedSeller){
        const liveMerchant=$('[data-filter-merchant]');
        if(liveMerchant && [...liveMerchant.options].some(o=>o.value===preservedSeller)){
          liveMerchant.value=preservedSeller;
        }
      }
      renderFinder();
    }).catch(()=>{});
  } catch(error) {
    console.error("TrendPilot product search failed safely",error);
    if(!state.plan){state.plan={q:state.query,groups:[],family:"",families:[],audience:"",segmentKeys:[],alternativeKeys:[],intentTokens:[],exactIntent:false};}
    try { populateFilters(); renderFinder(); } catch(renderError) {
      console.error("TrendPilot finder fallback failed",renderError);
      if(grid)grid.innerHTML='<div class="tp-empty"><h3>Products could not be displayed.</h3><p>Refresh once or try another search. No unrelated products were substituted.</p></div>';
    }
    const status=$('[data-tp-finder-status]');if(status)status.textContent="The catalogue could not finish loading. Try again or change the search.";
  } finally {
    state.loading=false;
  }
}
  async function showMore(){
    let rows=filterProducts(activeProducts());
    if(rows.length>state.shown){state.shown+=24;renderFinder();return;}
    if(state.activeTab!=="exact"||state.hybridMeta||candidatePagesExhausted()||state.loading)return;
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
    const host=$('[data-tp-compare-page]');if(!host)return; const rows=readStore(compareStore,[]).map(normalizeProduct).filter(tpCjPublicAllowed); state.products=uniqProducts([...state.products,...rows]);
    if(!rows.length){host.innerHTML=`<div class="tp-empty tp-empty-large"><h2>Your comparison is empty.</h2><p>Find products, then add two or three options of the same exact type.</p><a class="tp-btn tp-btn-primary" href="/find/">Find products</a></div>`;return;}
    const labels=comparisonRows(rows[0]).map(r=>r[0]);
    host.innerHTML=`<div class="tp-compare-products">${rows.map(p=>`<article><a href="${esc(detailUrl(p))}" data-product-detail-id="${esc(p.id)}">${imageMarkup(p)}</a><h2><a href="${esc(detailUrl(p))}" data-product-detail-id="${esc(p.id)}">${esc(p.name)}</a></h2><strong>${money(p.price,currency(p))}</strong><div><a class="tp-btn tp-btn-primary tp-btn-small" href="${esc(p.url)}" target="_blank" rel="nofollow sponsored noopener" data-tp-outbound data-product-id="${esc(p.id)}" data-merchant="${esc(p.advertiser)}">Check price ↗</a><button data-remove-compare="${esc(p.id)}" type="button">Remove</button></div></article>`).join("")}</div><div class="tp-compare-table">${labels.map((label,i)=>`<div class="tp-compare-row"><b>${esc(label)}</b>${rows.map(p=>`<span>${esc(comparisonRows(p)[i][1])}</span>`).join("")}</div>`).join("")}</div><div class="tp-decision-summary"><span>TrendPilot decision view</span><h2>${esc(decisionText(rows))}</h2><p>Recommendation uses only the supplied feed evidence. Missing fields remain visible instead of being guessed.</p></div>`; bindImages(host);
  }
  function decisionText(rows){
    const priced=rows.filter(p=>p.price>0); if(!priced.length)return "Compare the evidence—prices are not yet supplied.";
    const cheapest=[...priced].sort((a,b)=>totalPrice(a)-totalPrice(b))[0],best=[...rows].sort((a,b)=>(b.rating||0)-(a.rating||0)||b.quality-a.quality)[0];
    if(cheapest.id===best.id)return `${cheapest.name} currently combines the lowest supplied total and strongest available evidence.`;
    return `${cheapest.name} has the lowest supplied total; ${best.name} has the strongest rating/data evidence.`;
  }

  function renderSaved(){
    const host=$('[data-tp-saved-page]');if(!host)return; const rows=readStore(savedStore,[]).map(normalizeProduct).filter(tpCjPublicAllowed),targets=readStore(targetStore,{}); state.products=uniqProducts([...state.products,...rows]);
    if(!rows.length){host.innerHTML=`<div class="tp-empty tp-empty-large"><h2>No products are being watched.</h2><p>Save a product from search results to build your personal watch list.</p><a class="tp-btn tp-btn-primary" href="/find/">Find products</a></div>`;return;}
    host.innerHTML=`<div class="tp-watch-grid">${rows.map(p=>`<article class="tp-watch-card" data-product-id="${esc(p.id)}"><a class="tp-watch-image" href="${esc(detailUrl(p))}" data-product-detail-id="${esc(p.id)}">${imageMarkup(p)}</a><div><span>${esc(familyLabel(p))}</span><h2><a class="tp-product-name-link" href="${esc(detailUrl(p))}" data-product-detail-id="${esc(p.id)}">${esc(p.name)}</a></h2><strong>${money(p.price,currency(p))}</strong><label>Notify target<input data-target-id="${esc(p.id)}" type="number" min="0" step="0.01" value="${esc(targets[p.id]||'')}" placeholder="Target price"></label><div><a href="${esc(p.url)}" target="_blank" rel="nofollow sponsored noopener" data-tp-outbound data-product-id="${esc(p.id)}" data-merchant="${esc(p.advertiser)}">Check price ↗</a><button data-save-id="${esc(p.id)}" type="button">Remove</button></div></div></article>`).join("")}</div><p class="tp-watch-note">This version stores your watch list and target prices on this device. Automated email alerts require the next account/notification phase.</p>`;bindImages(host);
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
      const deals=(m.dealCandidates||[]).map(normalizeProduct).filter(tpCjPublicAllowed).slice(0,60); state.products=uniqProducts([...state.products,...deals]);
      if(productHost){productHost.innerHTML=deals.length?deals.slice(0,12).map(p=>productCard(p,true)).join(""):`<div class="tp-empty"><h3>No seller price-drop records are available yet.</h3><p>TrendPilot will not invent a verified deal without price evidence.</p></div>`;bindImages(productHost);}
      renderCouponGrid();
    });
  }

  function uniqProducts(rows){const m=new Map();rows.forEach(p=>m.set(p.id,p));return [...m.values()];}

  function renderHome(){
    loadManifest().then(m=>{
      const featured=(m.featured||[]).map(normalizeProduct).filter(tpCjPublicAllowed),deals=(m.dealCandidates||[]).map(normalizeProduct).filter(tpCjPublicAllowed),rare=(m.rareUsed||[]).map(normalizeProduct).filter(tpCjPublicAllowed);
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
    $$('[data-filter-group],[data-filter-family],[data-filter-audience],[data-filter-merchant],[data-filter-price],[data-filter-sort],[data-filter-coupon],[data-filter-rare]').forEach(x=>x.addEventListener('change',async()=>{
      if(x.matches('[data-filter-group]'))populateFilters();
      if(x.matches('[data-filter-merchant]')){
        const selected=tpCanonicalSellerV15_1(x.value)||clean(x.value);
        state.selectedSeller=selected;
        if(selected){
        state.loading=true;
        renderFinder();

        const hybridSellerResultV16_2_1=await tpLoadHybridProductsV16_2_1(
          state.query,
          selected
        );

        if(hybridSellerResultV16_2_1?.rows?.length){
          state.hybridMeta=hybridSellerResultV16_2_1.meta||state.hybridMeta;
          mergeProducts(hybridSellerResultV16_2_1.rows);
        }else if(TP_CJ_LIVE_SELLERS_V15_7_1.has(selected)){
          const liveRows=await tpLoadSelectedLiveSellerV15_8_9(selected,state.query);
          if(liveRows.length)mergeProducts(liveRows);
        }else if(typeof tpLoadSellerSpecificV15_1==="function"){
          await tpLoadSellerSpecificV15_1(selected);
        }

        state.loading=false;
        populateFilters();
        const merchant=$('[data-filter-merchant]');
        if(merchant)merchant.value=selected;
            }else{
          state.selectedSeller="";
          state.shown=24;
          await performSearch(state.query,false,state.scope);
          return;
        }
      }
      state.shown=24;
      renderFinder();
    }));
    $('[data-reset-filters]')?.addEventListener('click',()=>{state.selectedSeller='';$$('[data-filter-panel] select').forEach(x=>x.value='');$$('[data-filter-panel] input[type="checkbox"]').forEach(x=>x.checked=false);state.shown=24;renderFinder();});
    $('[data-tp-filter-toggle]')?.addEventListener('click',e=>{const p=$('[data-tp-filter-panel]');p?.classList.toggle('is-expanded');e.currentTarget.setAttribute('aria-expanded',String(p?.classList.contains('is-expanded')));});
    const params=new URLSearchParams(location.search);performSearch(params.get('q')||"popular products",false,params.get('scope')||'');
  }

  function initEvents(){
    d.addEventListener('click',e=>{
      const allSellers=e.target.closest('[data-tp-search-all-sellers]');if(allSellers){state.selectedSeller='';const merchant=$('[data-filter-merchant]');if(merchant)merchant.value="";state.shown=24;performSearch(state.query,false,state.scope);return;}
      const quick=e.target.closest('[data-quick-view-id]');if(quick){e.preventDefault();openQuickView(quick.dataset.quickViewId);return;}
      const close=e.target.closest('[data-quick-close]');if(close){e.preventDefault();closeQuickView();return;}
      const detail=e.target.closest('[data-product-detail-id]');if(detail){const p=findProduct(detail.dataset.productDetailId);if(p)cacheProduct(normalizeProduct(p));trackEvent("product_detail_click",{productId:detail.dataset.productDetailId});return;}
      const outbound=e.target.closest('[data-tp-outbound]');if(outbound){trackEvent("outbound_click",{productId:outbound.dataset.productId||"",merchant:outbound.dataset.merchant||""});return;}
      const gallery=e.target.closest('[data-gallery-image]');if(gallery){const main=$('.tp-detail-main-image img');if(main){main.src=gallery.dataset.galleryImage;$$('[data-gallery-image]').forEach(x=>x.classList.toggle('is-active',x===gallery));}return;}
      const video=e.target.closest('[data-video-play]');if(video){const shell=video.closest('[data-video-shell]'),url=shell?.dataset.videoUrl,type=shell?.dataset.videoType;if(shell&&url){shell.innerHTML=type==='embed'?`<iframe src="${esc(url)}" title="Product video" loading="lazy" allow="accelerometer; encrypted-media; picture-in-picture" allowfullscreen></iframe>`:`<video controls playsinline src="${esc(url)}"></video>`;trackEvent("product_video_play",{});}return;}
      const pair=e.target.closest('[data-compare-pair]');if(pair){addComparePair(pair.dataset.comparePair.split(',').filter(Boolean));return;}
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
    d.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('[data-tp-quick-view]')?.hidden)closeQuickView();});
  }

  if(typeof globalThis!=="undefined")globalThis.__TREND_PILOT_SEARCH_TEST__={normalizeQuery,inferFamily,inferAudience,inferGroups,familyMembers,makePlan,strictProductMatch,familyTitleGuard,confidenceFor,buyerChecks,videoInfo,state};

  async function boot(){
    initChrome();initEvents();initForms();initSearchSuggestions();initFinder();renderStoredCompare();renderSaved();renderDeals();renderProductDetail();
    if(d.body.matches('[data-tp-page="home"]'))renderHome();
  }
  if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',boot);else boot();
})();
