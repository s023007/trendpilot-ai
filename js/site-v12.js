(() => {
  "use strict";

  const d = document;
  const $ = (selector, root = d) => root.querySelector(selector);
  const $$ = (selector, root = d) => Array.from(root.querySelectorAll(selector));
  const clean = (value) => String(value ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  const lower = (value) => clean(value).toLowerCase();
  const esc = (value) => clean(value).replace(/[&<>'"]/g, (char) => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#039;",'"':"&quot;"}[char]));
  const validUrl = (value) => /^https?:\/\//i.test(clean(value));
  const debounce = (fn, wait = 140) => { let timer; return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), wait); }; };
  const uniq = (rows) => [...new Set(rows.filter(Boolean))];
  const STOP = new Set(["a","an","and","are","as","at","be","best","buy","by","for","from","good","in","is","it","latest","me","my","need","new","of","on","or","product","products","the","to","want","with","find","looking","official","online","store","shop","sale","hot"]);
  const words = (value) => lower(value)
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/[^a-z0-9+.#%\- ]+/g, " ")
    .split(/\s+/)
    .map((word) => word.replace(/^[.\-+]+|[.\-+]+$/g, ""))
    .filter((word) => word.length > 1 && !STOP.has(word));

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
    "shorts":"Shorts","skirts":"Skirts","dresses":"Dresses","suits":"Suits","activewear":"Activewear",
    "swimwear":"Swimwear","mens-underwear":"Men's underwear","womens-underwear":"Women's underwear","underwear":"Underwear",
    "sleepwear":"Sleepwear","socks":"Socks","running-shoes":"Running shoes","sneakers":"Sneakers","boots":"Boots",
    "sandals":"Sandals","slippers":"Slippers","formal-shoes":"Formal shoes","phone-cases":"Phone cases","power-banks":"Power banks",
    "smartphones":"Smartphones","tablets":"Tablets","laptops":"Laptops","monitors":"Monitors","earbuds":"Earbuds",
    "headphones":"Headphones","speakers":"Speakers","portable-projector":"Portable projectors","pet-feeder":"Pet feeders",
    "pet-litter-box":"Smart litter boxes","pet-water-fountain":"Pet fountains","pet-grooming":"Pet grooming","pet-toy":"Pet toys",
    "wireless-carplay-adapter":"Wireless CarPlay adapters","car-head-unit":"Car head units","security-camera":"Security cameras",
    "robot-vacuum":"Robot vacuums","smart-lighting":"Smart lighting","thermal-printer":"Thermal printers","3d-filament":"3D filament",
    "video-editor":"Video editors","phone-utility-software":"Phone utility software","bags":"Bags","watches":"Watches","eyewear":"Eyewear"
  };

  // "Clothing" is intentionally strict in V12. Shoes and accessories have their own searches.
  const BROAD_ROUTES = [
    {match:/\b(clothing|clothes|apparel|garments?)\b/i, groups:["apparel"], label:"Clothing"},
    {match:/\bfashion\b/i, groups:["apparel","footwear","bags-accessories","jewelry-watches"], label:"Fashion"},
    {match:/\b(electronic|electronics|tech|technology|gadget|gadgets)\b/i, groups:["phones-tablets","computers","audio","cameras","projectors-tv","smart-home"], label:"Electronics"},
    {match:/\b(home|house|household)\b/i, groups:["home-kitchen","smart-home","tools"], label:"Home"},
    {match:/\b(kid|kids|children|child|baby)\b/i, groups:["baby-kids","toys-games","apparel","footwear"], label:"Kids"},
    {match:/\b(outdoor|outdoors|fitness|sport|sports)\b/i, groups:["sports-outdoors","footwear","apparel"], label:"Sports & outdoors"},
    {match:/\b(car|cars|automotive|vehicle)\b/i, groups:["automotive","phones-tablets","audio"], label:"Car accessories"},
    {match:/\b(office|school|stationery)\b/i, groups:["office-school","computers","printing-3d"], label:"Office & school"}
  ];

  const SYNONYMS = [
    ["clothing","clothes","apparel","garment","wear"], ["shoe","shoes","footwear","sneaker","sneakers","trainer","trainers"],
    ["mobile","phone","phones","smartphone","iphone","android"], ["earbuds","earphones","headphones","headset","tws"],
    ["laptop","notebook","computer","pc"], ["television","tv","projector","streaming"], ["pet","dog","cat","puppy","kitten"],
    ["feeder","feeding","food dispenser","automatic feeder"], ["bag","bags","handbag","backpack","luggage"],
    ["glasses","eyeglasses","frames","eyewear","sunglasses"], ["supplier","manufacturer","factory","wholesale","sourcing"],
    ["video editor","video editing","filmora","capcut"], ["printer","printing","thermal printer","label printer"],
    ["smart light","led strip","lighting","govee"], ["dress","dresses","gown"], ["shirt","shirts","top","tops","blouse","t-shirt"]
  ];

  const GUIDE_MAP = {
    "t-shirts":{title:"Compare T-shirts by fabric, fit and real total cost",intro:"Keep the comparison inside T-shirts. Fabric composition, weight, cut, sizing evidence and returns matter more than the product photo.",checks:["Compare fabric composition and GSM when stated","Use the seller's measurements, not only S/M/L","Check delivery, shipping and return cost before choosing"]},
    "mens-underwear":{title:"Choose men's underwear by fabric, fit and pack value",intro:"Compare the same garment type and pack size, then check stretch, seams, waist construction and returns.",checks:["Compare price per piece, not only pack price","Check fabric and stretch percentage","Confirm hygiene-return restrictions"]},
    apparel:{title:"Choose clothing by exact type, audience and fabric",intro:"Select the audience and specific garment first. TrendPilot then keeps shoes, bikes, pet products and accessories out of the clothing list.",checks:["Choose a specific type such as T-shirts or trousers","Check measurements and fabric composition","Compare delivery, returns and total cost"]},
    footwear:{title:"Fit comes before style",intro:"Use foot length and width, then compare materials, sole type, delivery and return cost.",checks:["Measure both feet","Check the listing's exact size chart","Look for sole and upper material"]},
    "phones-tablets":{title:"Match the device to the job",intro:"Compare operating system, storage, network support and warranty before small feature differences.",checks:["Confirm network bands and region","Check storage and memory","Compare warranty and returns"]},
    computers:{title:"Buy for your real workload",intro:"Processor, memory, screen and upgrade options should match the work you actually do.",checks:["Choose enough RAM for your apps","Check screen size and resolution","Confirm keyboard, warranty and region"]},
    audio:{title:"Comfort and connection matter",intro:"Compare fit, battery, microphone quality and codec support—not only claimed sound quality.",checks:["Check device compatibility","Compare battery with case","Read microphone and comfort evidence"]},
    "pet-supplies":{title:"Choose around the pet's routine",intro:"Safety, capacity, cleaning and reliable power matter more than extra buttons.",checks:["Confirm pet size and food/litter type","Check cleaning access","Look for backup power or safe failure mode"]},
    "home-kitchen":{title:"Check dimensions before features",intro:"Measure the available space, confirm power requirements and compare cleaning and returns.",checks:["Measure the installation space","Confirm voltage and plug","Check parts, cleaning and warranty"]},
    "smart-home":{title:"Compatibility first",intro:"Confirm the app, Wi-Fi standard and smart-home ecosystem before comparing colours or automations.",checks:["Works with your phone and ecosystem","Correct Wi-Fi or hub requirement","Clear update and privacy support"]},
    automotive:{title:"Vehicle compatibility first",intro:"Confirm model year, connector and existing system before ordering any car electronic accessory.",checks:["Match vehicle and model year","Confirm connector and voltage","Check update and return route"]},
    tools:{title:"Choose the tool for the material",intro:"Compare capacity, included accessories, power source and safety—not only maximum headline numbers.",checks:["Correct capacity and material","Battery/voltage matches","Consumables and warranty available"]},
    "beauty-care":{title:"Ingredients and use come first",intro:"Check the intended skin/hair type, ingredients, device voltage and return policy.",checks:["Suitable for your intended use","Check ingredients or device specs","Avoid unclear claims and sellers"]},
    default:{title:"Compare the details that change the decision",intro:"Use product type, compatibility, seller terms, delivery and total price to narrow the list.",checks:["Confirm the exact model or type","Compare total cost, not headline price","Check delivery, warranty and returns"]}
  };

  const catalogue = {manifest:null, cache:new Map(), all:[], results:[], query:"", plan:null, shown:24};
  const selected = new Map();
  let compatibilityKey = "";

  const money = (product) => Number.isFinite(Number(product.price)) && Number(product.price) > 0
    ? `${clean(product.currency) || "USD"} ${Number(product.price).toFixed(2)}` : "Check price";
  const familyLabel = (product) => FAMILY_LABELS[product.family] || clean(product.subtype) || GROUP_LABELS[product.group] || "Product";

  function initChrome() {
    const button = $("[data-tp-menu-button]");
    const nav = $("[data-tp-nav]");
    const close = $("[data-tp-menu-close]");
    const backdrop = $("[data-tp-nav-backdrop]");
    if (button && nav) {
      const setOpen = (open) => {
        nav.classList.toggle("is-open", open);
        backdrop?.classList.toggle("is-open", open);
        d.body.classList.toggle("tp-menu-open", open);
        button.setAttribute("aria-expanded", String(open));
        nav.setAttribute("aria-hidden", String(!open && matchMedia("(max-width: 860px)").matches));
      };
      setOpen(false);
      button.addEventListener("click", () => setOpen(!nav.classList.contains("is-open")));
      close?.addEventListener("click", () => setOpen(false));
      backdrop?.addEventListener("click", () => setOpen(false));
      nav.addEventListener("click", (event) => { if (event.target.closest("a")) setOpen(false); });
      d.addEventListener("keydown", (event) => { if (event.key === "Escape") setOpen(false); });
      addEventListener("resize", debounce(() => { if (innerWidth > 860) setOpen(false); }, 80));
    }
    $$('[data-year]').forEach((node) => { node.textContent = String(new Date().getFullYear()); });
  }

  function normalizeProduct(product) {
    const copy = {...product};
    copy.id = clean(copy.id || copy.canonicalKey || copy.url || copy.name);
    copy.name = clean(copy.name);
    copy.url = clean(copy.url || copy.affiliateUrl || copy.productUrl);
    copy.image = clean(copy.image || copy.imageUrl);
    copy.advertiser = clean(copy.advertiser || copy.network || "Current seller");
    copy.group = clean(copy.group || "other");
    copy.family = clean(copy.family || copy.group);
    copy.audience = clean(copy.audience || "all");
    copy.subtype = clean(copy.subtype || copy.family.replace(/-/g, " "));
    copy.quality = Number(copy.quality || copy.qualityScore || copy.matchScore || 0) || 0;
    copy.rating = Number(copy.rating || 0) || 0;
    copy.reviews = Number(copy.reviews || 0) || 0;
    copy.rareScore = Number(copy.rareScore || 0) || 0;
    return copy;
  }

  async function loadManifest() {
    if (catalogue.manifest) return catalogue.manifest;
    try {
      const response = await fetch(`/data/search-catalog/manifest.json?v=12-${Date.now()}`, {cache:"no-store"});
      if (!response.ok) throw new Error(response.status);
      catalogue.manifest = await response.json();
      return catalogue.manifest;
    } catch (error) {
      const fallback = Object.values(window.TRENDPILOT_MATCHED_PRODUCTS || {}).flat().filter(Boolean).map(normalizeProduct);
      catalogue.all = fallback;
      catalogue.manifest = {version:"fallback", groups:[], tokenRoutes:{}, featured:fallback.slice(0,24), rareUsed:[], productCount:fallback.length};
      return catalogue.manifest;
    }
  }

  async function loadGroup(id) {
    if (catalogue.cache.has(id)) return catalogue.cache.get(id);
    const promise = (async () => {
      const manifest = await loadManifest();
      const row = (manifest.groups || []).find((group) => group.id === id);
      if (!row) return [];
      try {
        const response = await fetch(`${row.file}?v=${encodeURIComponent(manifest.generatedAt || manifest.version || 12)}`, {cache:"force-cache"});
        if (!response.ok) throw new Error(response.status);
        const data = await response.json();
        return (data.products || []).map(normalizeProduct);
      } catch (error) {
        console.warn("TrendPilot group unavailable", id, error);
        return [];
      }
    })();
    catalogue.cache.set(id, promise);
    return promise;
  }

  function planQuery(query, manifest) {
    const q = lower(query);
    const original = words(q);
    const expanded = new Set(original);
    let groups = [];
    let broad = false;
    let broadLabel = "";
    const route = BROAD_ROUTES.find((item) => item.match.test(q));
    if (route) { groups.push(...route.groups); broad = true; broadLabel = route.label; }
    const broadTerms = new Set(["clothing","clothes","apparel","garments","fashion","electronics","electronic","shoes","footwear","pet","pets","home","computers","audio","cameras","tools","sports","outdoors","beauty","baby","kids"]);
    for (const group of manifest.groups || []) {
      for (const alias of group.aliases || []) {
        const normalized = lower(alias);
        if (normalized && (q === normalized || q.includes(normalized))) {
          groups.push(group.id);
          words(normalized).forEach((word) => expanded.add(word));
          if (q === normalized && broadTerms.has(normalized)) broad = true;
        }
      }
    }
    original.forEach((token) => (manifest.tokenRoutes?.[token] || []).forEach((group) => groups.push(group)));
    SYNONYMS.forEach((set) => { if (set.some((term) => q.includes(term))) set.flatMap(words).forEach((word) => expanded.add(word)); });
    if (!groups.length) groups = (manifest.groups || []).filter((group) => !["business-sourcing","software"].includes(group.id)).slice(0,8).map((group) => group.id);
    groups = uniq(groups).filter((group) => (manifest.groups || []).some((row) => row.id === group)).slice(0,8);
    return {q, original, expanded:[...expanded], groups, broad, broadLabel};
  }

  function productText(product) {
    return lower([product.name, product.brand, product.category, product.group, product.family, product.subtype, product.audience, product.description].join(" "));
  }

  function tokenMatch(tokens, term) {
    return tokens.some((token) => token === term || token === `${term}s` || token === `${term}es` || term === `${token}s` || term === `${token}es` || (term.length >= 5 && (token.startsWith(term) || term.startsWith(token))));
  }

  function scoreProduct(product, plan) {
    if (plan.groups.length && !plan.groups.includes(product.group)) return 0;
    const hay = productText(product);
    const name = lower(product.name);
    const category = lower(`${product.category} ${product.group} ${product.family} ${product.subtype} ${product.audience}`);
    const brand = lower(product.brand);
    const nameTokens = words(name);
    const brandTokens = words(brand);
    const categoryTokens = words(category);
    const hayTokens = words(hay);
    let score = 0;
    let hits = 0;
    if (plan.q && plan.q.length > 3 && name.includes(plan.q)) { score += 130; hits += Math.max(1, plan.original.length); }
    for (const token of plan.original) {
      if (tokenMatch(nameTokens, token)) { score += 38; hits += 1; }
      else if (tokenMatch(brandTokens, token)) { score += 26; hits += 1; }
      else if (tokenMatch(categoryTokens, token)) { score += 22; hits += 1; }
      else if (tokenMatch(hayTokens, token)) { score += 7; hits += 1; }
    }
    for (const token of plan.expanded) {
      if (plan.original.includes(token)) continue;
      if (tokenMatch(nameTokens, token)) score += 8;
      else if (tokenMatch(categoryTokens, token)) score += 5;
    }
    if (plan.groups.includes(product.group)) score += plan.broad ? 28 : 12;
    if (plan.broad && plan.groups.includes(product.group)) hits = Math.max(hits, 1);
    if (plan.original.includes("women") && ["men","kids"].includes(product.audience)) return 0;
    if (plan.original.includes("men") && ["women","kids"].includes(product.audience)) return 0;
    if ((plan.original.includes("kids") || plan.original.includes("children")) && ["women","men"].includes(product.audience)) return 0;
    if (!hits) return 0;
    if (product.image) score += 5;
    if (Number(product.price) > 0) score += 3;
    if (product.rating) score += Math.min(8, product.rating);
    score += Math.min(10, product.quality / 10);
    if (plan.original.includes("women") && product.audience === "women") score += 30;
    if (plan.original.includes("men") && product.audience === "men") score += 30;
    if ((plan.original.includes("kids") || plan.original.includes("children")) && product.audience === "kids") score += 30;
    return score;
  }

  function diversify(rows, limit = 90) {
    const buckets = new Map();
    rows.forEach((product) => {
      const key = `${lower(product.group)}|${lower(product.family)}|${lower(product.advertiser)}`;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(product);
    });
    const keys = [...buckets.keys()].sort((a, b) => buckets.get(b).length - buckets.get(a).length);
    const output = [];
    let active = keys;
    while (active.length && output.length < limit) {
      const next = [];
      for (const key of active) {
        const bucket = buckets.get(key);
        if (bucket.length && output.length < limit) output.push(bucket.shift());
        if (bucket.length) next.push(key);
      }
      active = next;
    }
    return output;
  }

  async function runSearch(query) {
    const manifest = await loadManifest();
    const plan = planQuery(query, manifest);
    catalogue.plan = plan;
    catalogue.query = query;
    catalogue.shown = 24;
    let rows = (await Promise.all(plan.groups.map(loadGroup))).flat();
    if (!rows.length) rows = (manifest.featured || []).map(normalizeProduct);
    const seen = new Set();
    rows = rows.filter((product) => {
      const key = product.id || product.url;
      if (!key || seen.has(key) || !product.name || !validUrl(product.url)) return false;
      seen.add(key);
      return true;
    });
    catalogue.all = rows;
    catalogue.results = diversify(rows.map((product) => ({...product, __score:scoreProduct(product, plan)})).filter((product) => product.__score > 0).sort((a, b) => b.__score - a.__score || b.quality - a.quality), 90);
    return catalogue.results;
  }

  function merchantKey(value) {
    return lower(value).replace(/\b(many geos|affiliate program|ww|eu|cps|online)\b/g, " ").replace(/[^a-z0-9]+/g, "").trim();
  }

  function coupons() {
    const source = window.TREND_PILOT_COUPONS || window.TRENDPILOT_COUPONS || {};
    return Array.isArray(source) ? source : (source.coupons || []);
  }

  function couponFor(product) {
    const merchant = merchantKey(product.advertiser);
    const productWords = new Set(words(`${product.name} ${product.category} ${product.family} ${product.brand}`));
    const hints = ["iphone","ipad","scooter","printer","filament","glasses","frames","shoe","laptop","tablet","monitor","camera","headphone","earbud","light","case","dress","shirt","bag","watch","tool","drill"];
    const ranked = coupons().filter((coupon) => coupon.status !== "inactive" && (!coupon.end_at || Date.parse(coupon.end_at) > Date.now() - 86400000)).map((coupon) => {
      const couponMerchant = merchantKey(`${coupon.merchant_name || ""} ${coupon.merchant_key || ""}`);
      if (!couponMerchant || !(couponMerchant.includes(merchant) || merchant.includes(couponMerchant))) return null;
      const text = lower(`${coupon.title || ""} ${coupon.description || ""} ${(coupon.categories || []).join(" ")}`);
      let score = Number(coupon.priority_score || coupon.rating || 0);
      let productSpecific = false;
      for (const hint of hints) {
        if (!text.includes(hint)) continue;
        productSpecific = true;
        if ([...productWords].some((word) => hint.includes(word) || word.includes(hint))) score += 35;
        else score -= 45;
      }
      if (!productSpecific) score += 12;
      if (coupon.code) score += 8;
      if (coupon.exclusive) score += 3;
      return score > 0 ? {...coupon, __score:score} : null;
    }).filter(Boolean).sort((a, b) => b.__score - a.__score);
    return ranked[0] || null;
  }

  const couponLabel = (coupon) => coupon ? clean(coupon.discount?.text || coupon.title || "Current saving") : "";

  function fallbackMarkup(product) {
    const initials = (clean(product.advertiser) || "TP").split(/\s+/).slice(0,2).map((word) => word[0]).join("").toUpperCase();
    return `<span class="tp-product-fallback"><span><b>${esc(initials)}</b><span>Verified image unavailable</span></span></span>`;
  }

  function imageMarkup(product, small = false) {
    const bad = /placeholder|no[-_ ]?image|default[-_ ]?image|transparent|spacer|blank\.(gif|png)|logo(?!.*product)/i;
    if (validUrl(product.image) && !bad.test(product.image)) return `<img src="${esc(product.image)}" alt="${esc(product.name)}" loading="lazy" decoding="async" referrerpolicy="no-referrer" data-tp-product-image${small ? ' data-small="1"' : ""}>`;
    return fallbackMarkup(product);
  }

  function fragment(html) {
    const template = d.createElement("template");
    template.innerHTML = html.trim();
    return template.content.firstElementChild;
  }

  function bindImages(root = d) {
    $$('img[data-tp-product-image]', root).forEach((image) => {
      if (image.dataset.bound) return;
      image.dataset.bound = "1";
      const fail = () => {
        if (image.dataset.failed) return;
        image.dataset.failed = "1";
        const host = image.parentElement;
        if (!host || !image.isConnected) return;
        image.replaceWith(fragment(fallbackMarkup({advertiser:host.closest('[data-product-id]')?.dataset.advertiser || "TP"})));
      };
      image.addEventListener("error", fail, {once:true});
      image.addEventListener("load", () => {
        if (image.naturalWidth < 100 || image.naturalHeight < 100 || image.naturalWidth / image.naturalHeight > 5 || image.naturalHeight / image.naturalWidth > 5) fail();
      }, {once:true});
      if (image.complete && (image.naturalWidth < 100 || image.naturalHeight < 100)) fail();
    });
  }

  function reasonFor(product, plan) {
    const matches = plan.original.filter((token) => productText(product).includes(token));
    const type = familyLabel(product);
    if (matches.length) return `${type} · matches ${matches.slice(0,3).join(", ")}`;
    return `${type} · ${GROUP_LABELS[product.group] || product.category || "Relevant product"}`;
  }

  function evidenceMarkup(product) {
    const rows = [];
    if (product.rating) rows.push(`<span>★ ${esc(product.rating.toFixed(1))}${product.reviews ? ` (${esc(product.reviews)})` : ""}</span>`);
    if (product.delivery) rows.push(`<span>Delivery: ${esc(product.delivery)}</span>`);
    if (product.condition && product.condition !== "new") rows.push(`<span>${esc(product.condition.replace(/-/g," "))}</span>`);
    if (product.material) rows.push(`<span>${esc(product.material)}</span>`);
    return rows.length ? `<div class="tp-product-evidence">${rows.slice(0,3).join("")}</div>` : "";
  }

  function comparisonKey(product) {
    const stableFamily = product.family && product.family !== product.group && !product.family.includes(":");
    if (["apparel","footwear"].includes(product.group)) return stableFamily ? `${product.group}|${product.family}` : "";
    return stableFamily ? `${product.group}|${product.family}` : product.group;
  }

  function cardMarkup(product, placement = "finder", compare = true) {
    const coupon = couponFor(product);
    const selectedNow = selected.has(product.id);
    const key = comparisonKey(product);
    const allowed = Boolean(key) && (!selected.size || selectedNow || key === compatibilityKey);
    const compareTitle = !key ? "Exact product type is not clear enough for a safe comparison" : (allowed ? "Add to same-type comparison" : "Choose products of the same exact type");
    return `<article class="tp-product-card" data-product-id="${esc(product.id)}" data-advertiser="${esc(product.advertiser)}">
      <a class="tp-product-media" href="${esc(product.url)}" target="_blank" rel="sponsored nofollow noopener" data-placement="${esc(placement)}">${imageMarkup(product)}
        <span class="tp-badge-row">${coupon ? '<span class="tp-badge tp-badge-coupon">Saving available</span>' : '<span class="tp-badge tp-badge-match">Relevant match</span>'}${product.rareScore >= 4 ? '<span class="tp-badge tp-badge-rare">Rare used find</span>' : '<span></span>'}</span>
      </a>
      <div class="tp-product-body">
        <div class="tp-product-source"><span>${esc(product.advertiser)}</span><span>${esc(familyLabel(product))}</span></div>
        <h3>${esc(product.name)}</h3>
        <div class="tp-product-price"><strong>${esc(money(product))}</strong>${product.oldPrice ? `<del>${esc((product.currency || "USD") + " " + Number(product.oldPrice).toFixed(2))}</del>` : ""}</div>
        ${evidenceMarkup(product)}
        <p class="tp-product-reason">${esc(reasonFor(product, catalogue.plan || {original:[]}))}</p>
        ${coupon ? `<div class="tp-coupon-line"><strong>${esc(couponLabel(coupon))}</strong>${coupon.code ? `<button type="button" data-copy-code="${esc(coupon.code)}">Copy ${esc(coupon.code)}</button>` : "<span>Auto deal</span>"}</div>` : ""}
        <div class="tp-card-actions${compare ? "" : " tp-card-actions-single"}">
          <a class="tp-btn tp-btn-primary tp-btn-small" href="${esc(product.url)}" target="_blank" rel="sponsored nofollow noopener">View product ↗</a>
          ${compare ? `<button class="tp-compare-toggle" type="button" data-compare-id="${esc(product.id)}" title="${esc(compareTitle)}" aria-label="${selectedNow ? "Remove from" : "Add to"} comparison" aria-pressed="${selectedNow}" ${allowed ? "" : "disabled"}>${selectedNow ? "✓" : "+"}</button>` : ""}
        </div>
      </div>
    </article>`;
  }

  function selectedProduct(id) {
    return catalogue.all.find((product) => product.id === id) || catalogue.results.find((product) => product.id === id);
  }

  function toggleCompare(id) {
    if (selected.has(id)) {
      selected.delete(id);
      if (!selected.size) compatibilityKey = "";
    } else {
      const product = selectedProduct(id);
      if (!product || selected.size >= 3) return;
      const key = comparisonKey(product);
      if (!key || (selected.size && key !== compatibilityKey)) return;
      compatibilityKey = key;
      selected.set(id, product);
    }
    renderFinderProducts();
    renderTray();
  }

  function renderTray() {
    const tray = $("[data-tp-compare-tray]");
    if (!tray) return;
    tray.classList.toggle("is-open", selected.size > 0);
    $("[data-tp-tray-count]", tray).textContent = `${selected.size} of 3 selected · ${selected.size ? familyLabel([...selected.values()][0]) : "same type only"}`;
    const list = $("[data-tp-tray-items]", tray);
    list.innerHTML = [...selected.values()].map((product) => `<div class="tp-tray-item">${imageMarkup(product,true)}<b>${esc(product.name)}</b><button type="button" data-remove-compare="${esc(product.id)}" aria-label="Remove">×</button></div>`).join("");
    const open = $("[data-tp-open-compare]", tray);
    open.disabled = selected.size < 2;
    bindImages(list);
  }

  function compareRows(product) {
    const coupon = couponFor(product);
    const rows = [
      ["Price", money(product)],
      ["Seller", product.advertiser],
      ["Exact type", familyLabel(product)],
      ["Audience", product.audience === "all" ? "Not stated" : product.audience],
      ["Rating", product.rating ? `${product.rating.toFixed(1)} / 5${product.reviews ? ` · ${product.reviews} reviews` : ""}` : "Not provided by feed"],
      ["Delivery", product.delivery || "Confirm on seller page"],
      ["Shipping", Number.isFinite(Number(product.shippingPrice)) ? `${product.currency || "USD"} ${Number(product.shippingPrice).toFixed(2)}` : "Confirm on seller page"],
      ["Material", product.material || "Not provided by feed"],
      ["Condition", product.condition || "Not stated"],
      ["Saving", coupon ? couponLabel(coupon) : "None matched"]
    ];
    return rows.map(([term, value]) => `<div><dt>${esc(term)}</dt><dd>${esc(value)}</dd></div>`).join("");
  }

  function openCompare() {
    if (selected.size < 2) return;
    const modal = $("[data-tp-compare-dialog]");
    const grid = $("[data-tp-compare-grid]", modal);
    grid.innerHTML = [...selected.values()].map((product, index) => {
      const coupon = couponFor(product);
      return `<article class="tp-compare-column"><div class="tp-product-media">${imageMarkup(product)}</div><div class="tp-compare-copy"><span class="tp-kicker">Option ${index + 1}</span><h3>${esc(product.name)}</h3><dl class="tp-specs">${compareRows(product)}</dl>${coupon?.code ? `<div class="tp-coupon-line"><strong>Code: ${esc(coupon.code)}</strong><button type="button" data-copy-code="${esc(coupon.code)}">Copy</button></div>` : ""}<a class="tp-btn tp-btn-primary tp-btn-wide" href="${esc(product.url)}" target="_blank" rel="sponsored nofollow noopener">Check product details ↗</a></div></article>`;
    }).join("");
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    d.body.classList.add("tp-dialog-open");
    bindImages(grid);
  }

  function closeCompare() {
    const modal = $("[data-tp-compare-dialog]");
    modal?.classList.remove("is-open");
    modal?.setAttribute("aria-hidden", "true");
    d.body.classList.remove("tp-dialog-open");
  }

  function activeFilters() {
    return {
      group:$("[data-filter-group]")?.value || "",
      family:$("[data-filter-family]")?.value || "",
      merchant:$("[data-filter-merchant]")?.value || "",
      audience:$("[data-filter-audience]")?.value || "",
      price:$("[data-filter-price]")?.value || "",
      coupon:$("[data-filter-coupon]")?.checked || false,
      rare:$("[data-filter-rare]")?.checked || false,
      sort:$("[data-filter-sort]")?.value || "smart"
    };
  }

  function matchesFilters(product, filters, ignore = new Set()) {
    if (!ignore.has("group") && filters.group && product.group !== filters.group) return false;
    if (!ignore.has("family") && filters.family && product.family !== filters.family) return false;
    if (!ignore.has("merchant") && filters.merchant && product.advertiser !== filters.merchant) return false;
    // "Men only", "Women only" and "Kids only" are exact filters. Unisex and unknown items stay separate.
    if (!ignore.has("audience") && filters.audience && product.audience !== filters.audience) return false;
    if (!ignore.has("coupon") && filters.coupon && !couponFor(product)) return false;
    if (!ignore.has("rare") && filters.rare && product.rareScore < 4) return false;
    if (!ignore.has("price") && filters.price) {
      const amount = Number(product.price) || 0;
      const [low, high] = filters.price.split("-").map(Number);
      if (filters.price === "100+") { if (amount < 100) return false; }
      else if (!amount || amount < low || amount > high) return false;
    }
    return true;
  }

  function deliveryDays(value) {
    const text = lower(value);
    const matches = text.match(/\d+(?:\.\d+)?/g);
    if (!matches?.length) return Number.POSITIVE_INFINITY;
    const amount = Number(matches[0]);
    if (/hour/.test(text)) return amount / 24;
    if (/week/.test(text)) return amount * 7;
    if (/month/.test(text)) return amount * 30;
    return amount;
  }

  function inferredAudience(query) {
    const q = ` ${lower(query).replace(/[^a-z0-9]+/g, " ")} `;
    if (/\b(men|mens|male|man)\b/.test(q)) return "men";
    if (/\b(women|womens|female|woman|ladies)\b/.test(q)) return "women";
    if (/\b(kids|kid|children|child|boys|girls|baby|toddler)\b/.test(q)) return "kids";
    if (/\bunisex\b/.test(q)) return "unisex";
    return "";
  }

  function inferredFamily(query) {
    const q = lower(query);
    const rows = [
      [/\bt[- ]?shirts?\b/,"t-shirts"],[/\bpolo(?: shirts?)?\b/,"polo-shirts"],
      [/\bdress shirts?\b|\bformal shirts?\b/,"dress-shirts"],[/\bcasual shirts?\b/,"casual-shirts"],
      [/\bhoodies?\b|\bsweatshirts?\b/,"hoodies-sweatshirts"],[/\bjackets?\b/,"jackets"],
      [/\bcoats?\b/,"coats"],[/\bblazers?\b/,"blazers"],[/\bsweaters?\b|\bknitwear\b/,"sweaters-knitwear"],
      [/\bjeans?\b/,"jeans"],[/\btrousers?\b|\bpants?\b/,"trousers"],[/\bshorts?\b/,"shorts"],
      [/\bskirts?\b/,"skirts"],[/\bdresses?\b|\bgowns?\b/,"dresses"],[/\bsuits?\b/,"suits"],
      [/\bunderwear\b|\bboxers?\b|\bbriefs?\b/, inferredAudience(query) === "men" ? "mens-underwear" : inferredAudience(query) === "women" ? "womens-underwear" : "underwear"],
      [/\brunning shoes?\b/,"running-shoes"],[/\bsneakers?\b|\btrainers?\b/,"sneakers"]
    ];
    return rows.find(([pattern]) => pattern.test(q))?.[1] || "";
  }

  function filteredResults(options = {}) {
    const filters = activeFilters();
    const ignore = new Set(options.ignore || []);
    const rows = catalogue.results.filter((product) => matchesFilters(product, filters, ignore));
    if (filters.sort === "price-low") rows.sort((a,b) => (Number(a.price) || 1e9) - (Number(b.price) || 1e9));
    else if (filters.sort === "price-high") rows.sort((a,b) => (Number(b.price) || -1) - (Number(a.price) || -1));
    else if (filters.sort === "quality") rows.sort((a,b) => b.quality - a.quality);
    else if (filters.sort === "rating") rows.sort((a,b) => (b.rating || 0) - (a.rating || 0));
    else if (filters.sort === "delivery") rows.sort((a,b) => deliveryDays(a.delivery) - deliveryDays(b.delivery));
    return rows;
  }

  function guideFor() {
    const filters = activeFilters();
    return GUIDE_MAP[filters.family] || GUIDE_MAP[filters.group] || GUIDE_MAP[catalogue.results[0]?.group] || GUIDE_MAP.default;
  }

  function renderGuide() {
    const box = $("[data-tp-smart-guide]");
    if (!box) return;
    const guide = guideFor();
    box.innerHTML = `<div><span class="tp-kicker">Quick buying guide</span><h2>${esc(guide.title)}</h2><p>${esc(guide.intro)}</p></div><ul>${guide.checks.map((check) => `<li>${esc(check)}</li>`).join("")}</ul>`;
  }

  function renderTabs() {
    const host = $("[data-tp-category-tabs]");
    if (!host) return;
    const filters = activeFilters();
    const base = catalogue.results.filter((product) => matchesFilters(product, filters, new Set(["group","family"])));
    const counts = new Map();
    base.forEach((product) => counts.set(product.group, (counts.get(product.group) || 0) + 1));
    const current = filters.group;
    host.innerHTML = `<button type="button" data-tab-group="" aria-pressed="${!current}">All <small>${base.length}</small></button>` + [...counts.entries()].sort((a,b) => b[1] - a[1]).map(([group, count]) => `<button type="button" data-tab-group="${esc(group)}" aria-pressed="${current === group}">${esc(GROUP_LABELS[group] || group)} <small>${count}</small></button>`).join("");
  }

  function populateFilters() {
    const filters = activeFilters();
    const groupRows = catalogue.results.filter((product) => matchesFilters(product, filters, new Set(["group","family"])));
    const groups = uniq(groupRows.map((product) => product.group));
    const groupSelect = $("[data-filter-group]");
    if (groupSelect) {
      const value = groupSelect.value;
      groupSelect.innerHTML = `<option value="">All categories</option>${groups.map((group) => `<option value="${esc(group)}">${esc(GROUP_LABELS[group] || group)}</option>`).join("")}`;
      groupSelect.value = groups.includes(value) ? value : "";
    }

    const familyRows = catalogue.results.filter((product) => matchesFilters(product, {...filters, group:groupSelect?.value || ""}, new Set(["family"])));
    const familyCounts = new Map();
    familyRows.forEach((product) => {
      if (!product.family || product.family.includes(":")) return;
      familyCounts.set(product.family, (familyCounts.get(product.family) || 0) + 1);
    });
    const familySelect = $("[data-filter-family]");
    if (familySelect) {
      const value = familySelect.value;
      const families = [...familyCounts.entries()].sort((a,b) => b[1] - a[1]);
      familySelect.innerHTML = `<option value="">All specific types</option>${families.map(([family,count]) => `<option value="${esc(family)}">${esc(FAMILY_LABELS[family] || family.replace(/-/g," "))} (${count})</option>`).join("")}`;
      familySelect.value = families.some(([family]) => family === value) ? value : "";
    }

    const merchants = uniq(catalogue.results.filter((product) => matchesFilters(product, filters, new Set(["merchant"]))).map((product) => product.advertiser)).sort();
    const merchantSelect = $("[data-filter-merchant]");
    if (merchantSelect) {
      const value = merchantSelect.value;
      merchantSelect.innerHTML = `<option value="">All sellers</option>${merchants.map((merchant) => `<option value="${esc(merchant)}">${esc(merchant)}</option>`).join("")}`;
      merchantSelect.value = merchants.includes(value) ? value : "";
    }
  }

  function updateFilterUi() {
    const filters = activeFilters();
    const count = [filters.group,filters.family,filters.merchant,filters.audience,filters.price,filters.coupon,filters.rare,filters.sort !== "smart"].filter(Boolean).length;
    const badge = $("[data-tp-active-filter-count]");
    if (badge) { badge.textContent = String(count); badge.hidden = count === 0; }
    const toggle = $("[data-tp-filter-toggle]");
    const panel = $("[data-tp-filter-panel]");
    if (toggle && panel) {
      const expanded = panel.classList.contains("is-expanded");
      toggle.setAttribute("aria-expanded", String(expanded));
      toggle.querySelector("span")?.replaceChildren(d.createTextNode(expanded ? "Fewer filters" : "More filters"));
    }
  }

  function renderFinderProducts() {
    const grid = $("[data-tp-product-grid]");
    if (!grid) return;
    const rows = filteredResults();
    const shown = rows.slice(0, catalogue.shown);
    const count = $("[data-tp-results-count]");
    if (count) count.textContent = `${rows.length} relevant options`;
    const title = $("[data-tp-results-title]");
    if (title) title.textContent = catalogue.query ? `Results for “${catalogue.query}”` : "Popular products";
    grid.innerHTML = shown.length ? shown.map((product) => cardMarkup(product)).join("") : `<div class="tp-empty" style="grid-column:1/-1"><h2>No precise match after these filters</h2><p>Clear a filter or choose another exact product type. TrendPilot will not fill the page with shoes, bikes, children's items or accessories when you asked for men's clothing.</p><button class="tp-btn tp-btn-light" type="button" data-reset-filters>Clear filters</button></div>`;
    const more = $("[data-tp-load-more]");
    if (more) more.classList.toggle("tp-hidden", shown.length >= rows.length);
    renderTabs();
    renderGuide();
    updateFilterUi();
    bindImages(grid);
    renderTray();
  }

  async function performFinderSearch(query, push = true) {
    query = clean(query);
    if (!query) return;
    const grid = $("[data-tp-product-grid]");
    if (grid) grid.innerHTML = Array.from({length:6}, () => '<div class="tp-skeleton"></div>').join("");
    const status = $("[data-tp-finder-status]");
    if (status) status.textContent = "Finding close matches across connected product feeds…";
    selected.clear();
    compatibilityKey = "";
    resetFilters(false);
    await runSearch(query);
    const audience = inferredAudience(query);
    const audienceSelect = $("[data-filter-audience]");
    if (audienceSelect && audience) audienceSelect.value = audience;
    populateFilters();
    const family = inferredFamily(query);
    const familySelect = $("[data-filter-family]");
    if (familySelect && family && [...familySelect.options].some((option) => option.value === family)) familySelect.value = family;
    renderFinderProducts();
    if (status) status.textContent = catalogue.results.length ? "Relevant matches are shown first. Choose an audience and exact product type to narrow the list." : "No close matches found.";
    if (push) {
      const url = new URL(location.href);
      url.searchParams.set("q", query);
      history.pushState({}, "", url);
    }
  }

  function resetFilters(render = true) {
    ["[data-filter-group]","[data-filter-family]","[data-filter-merchant]","[data-filter-audience]","[data-filter-price]"].forEach((selector) => { const field = $(selector); if (field) field.value = ""; });
    const coupon = $("[data-filter-coupon]"); if (coupon) coupon.checked = false;
    const rare = $("[data-filter-rare]"); if (rare) rare.checked = false;
    const sort = $("[data-filter-sort]"); if (sort) sort.value = "smart";
    catalogue.shown = 24;
    if (render) { populateFilters(); renderFinderProducts(); }
  }

  function initFinder() {
    const form = $("[data-tp-finder-form]");
    if (!form) return;
    const input = $("[data-tp-finder-input]", form);
    form.addEventListener("submit", (event) => { event.preventDefault(); performFinderSearch(input.value); });
    $$('[data-search-suggestion]').forEach((button) => button.addEventListener("click", () => { input.value = button.dataset.searchSuggestion; performFinderSearch(input.value); }));
    $$('[data-filter-group],[data-filter-family],[data-filter-merchant],[data-filter-audience],[data-filter-price],[data-filter-coupon],[data-filter-rare],[data-filter-sort]').forEach((field) => field.addEventListener("change", () => {
      catalogue.shown = 24;
      if (field.matches("[data-filter-group],[data-filter-audience]")) populateFilters();
      renderFinderProducts();
    }));
    d.addEventListener("click", (event) => {
      const tab = event.target.closest("[data-tab-group]");
      if (tab) { const select = $("[data-filter-group]"); if (select) select.value = tab.dataset.tabGroup; const family = $("[data-filter-family]"); if (family) family.value = ""; catalogue.shown = 24; populateFilters(); renderFinderProducts(); return; }
      const compare = event.target.closest("[data-compare-id]"); if (compare) { toggleCompare(compare.dataset.compareId); return; }
      const remove = event.target.closest("[data-remove-compare]"); if (remove) { toggleCompare(remove.dataset.removeCompare); return; }
      if (event.target.closest("[data-tp-open-compare]")) { openCompare(); return; }
      if (event.target.closest("[data-tp-close-compare]")) { closeCompare(); return; }
      if (event.target.closest("[data-tp-clear-compare]")) { selected.clear(); compatibilityKey = ""; renderFinderProducts(); return; }
      if (event.target.closest("[data-tp-tray-toggle]")) { $("[data-tp-compare-tray]")?.classList.toggle("is-collapsed"); return; }
      if (event.target.closest("[data-tp-load-more]")) { catalogue.shown += 24; renderFinderProducts(); return; }
      if (event.target.closest("[data-reset-filters]")) { resetFilters(); }
    });
    $("[data-tp-filter-toggle]")?.addEventListener("click", () => { $("[data-tp-filter-panel]")?.classList.toggle("is-expanded"); updateFilterUi(); });
    $("[data-tp-compare-dialog]")?.addEventListener("click", (event) => { if (event.target.matches("[data-tp-compare-dialog]")) closeCompare(); });
    d.addEventListener("keydown", (event) => { if (event.key === "Escape") closeCompare(); });
    addEventListener("popstate", () => { const query = new URL(location.href).searchParams.get("q") || "electronics"; input.value = query; performFinderSearch(query, false); });
    const query = new URL(location.href).searchParams.get("q") || "electronics";
    input.value = query;
    performFinderSearch(query, false);
  }

  async function renderHomepageProducts() {
    const host = $("[data-tp-home-products]");
    if (!host) return;
    const manifest = await loadManifest();
    let rows = (manifest.featured || []).map(normalizeProduct).filter((product) => product.name && validUrl(product.url));
    if (rows.length < 8) {
      const groups = (manifest.groups || []).slice(0,4).map((group) => group.id);
      rows = [...rows, ...(await Promise.all(groups.map(loadGroup))).flat()];
    }
    const seen = new Set();
    rows = rows.filter((product) => { if (seen.has(product.id)) return false; seen.add(product.id); return true; }).slice(0,8);
    catalogue.plan = {original:[]};
    host.innerHTML = rows.map((product) => cardMarkup(product, "homepage", false)).join("");
    bindImages(host);
  }

  async function renderRareUsed(rootSelector = "[data-tp-home-rare]") {
    const host = $(rootSelector);
    if (!host) return;
    const manifest = await loadManifest();
    const rows = (manifest.rareUsed || []).map(normalizeProduct).filter((product) => product.name && validUrl(product.url));
    const section = host.closest("[data-tp-rare-section]");
    if (!rows.length) {
      if (rootSelector.includes("home")) { if (section) section.hidden = true; }
      else {
        if (section) section.hidden = false;
        host.innerHTML = '<div class="tp-empty" style="grid-column:1/-1"><h2>No verified rare used finds in the current feeds</h2><p>The page stays selective rather than showing ordinary second-hand items. The coverage report will show this gap for the next source review.</p></div>';
      }
      return;
    }
    if (section) section.hidden = false;
    catalogue.plan = {original:["rare","used"]};
    host.innerHTML = rows.slice(0, rootSelector.includes("home") ? 4 : 48).map((product) => cardMarkup(product, "rare-used", false)).join("");
    bindImages(host);
  }

  function initHomeSearch() {
    $$('[data-tp-home-search]').forEach((form) => form.addEventListener("submit", (event) => {
      event.preventDefault();
      const query = clean($("input", form)?.value);
      if (query) location.href = `/find/?q=${encodeURIComponent(query)}`;
    }));
  }

  function copyCode(button) {
    const code = button.dataset.copyCode;
    if (!code) return;
    navigator.clipboard?.writeText(code).catch(() => {});
    button.textContent = "Copied";
    setTimeout(() => { button.textContent = `Copy ${code}`; }, 1300);
  }

  function renderDeals() {
    const host = $("[data-tp-deal-grid]");
    if (!host) return;
    const search = $("[data-tp-deal-search]");
    const merchant = $("[data-tp-deal-merchant]");
    const all = coupons().filter((coupon) => coupon.status !== "inactive" && (!coupon.end_at || Date.parse(coupon.end_at) > Date.now() - 86400000));
    const merchants = uniq(all.map((coupon) => clean(coupon.merchant_name))).sort();
    merchant.innerHTML = `<option value="">All merchants</option>${merchants.map((name) => `<option>${esc(name)}</option>`).join("")}`;
    const draw = () => {
      const query = lower(search.value);
      const merchantName = merchant.value;
      const rows = all.filter((coupon) => (!merchantName || coupon.merchant_name === merchantName) && (!query || lower(`${coupon.title} ${coupon.description} ${coupon.merchant_name} ${coupon.code}`).includes(query))).sort((a,b) => (b.priority_score || 0) - (a.priority_score || 0)).slice(0,60);
      host.innerHTML = rows.length ? rows.map((coupon) => {
        const url = clean(coupon.url || coupon.campaign_url);
        return `<article class="tp-deal-card"><small>${esc(coupon.merchant_name || "Current merchant")}</small><h3>${esc(coupon.title || couponLabel(coupon))}</h3><p>${esc(coupon.description || "Confirm the saving and terms on the merchant page.")}</p><div class="tp-deal-code">${coupon.code ? `<b>${esc(coupon.code)}</b><button type="button" data-copy-code="${esc(coupon.code)}">Copy</button>` : "<b>Automatic deal</b>"}</div>${validUrl(url) ? `<a class="tp-btn tp-btn-primary tp-btn-small tp-btn-wide" href="${esc(url)}" target="_blank" rel="sponsored nofollow noopener">Open deal ↗</a>` : ""}</article>`;
      }).join("") : '<div class="tp-empty" style="grid-column:1/-1"><h2>No matching saving</h2><p>Try another merchant or product word.</p></div>';
    };
    search.addEventListener("input", debounce(draw));
    merchant.addEventListener("change", draw);
    draw();
  }

  function upgradeEditorial() {
    if (d.body.dataset.tpPage === "home" || d.body.dataset.tpPage === "finder" || d.body.dataset.tpHub) return;
    const main = $("main");
    if (!main) return;
    const h1 = $("h1", main);
    if (!h1) return;
    main.classList.add("tp-editorial-wrap");
    const progress = d.createElement("div");
    progress.className = "tp-article-progress";
    d.body.appendChild(progress);
    const headings = $$("h2", main);
    if (headings.length >= 3) {
      const toc = d.createElement("nav");
      toc.className = "tp-toc";
      toc.innerHTML = "<strong>On this page</strong>" + headings.slice(0,8).map((heading, index) => { if (!heading.id) heading.id = `section-${index + 1}`; return `<a href="#${esc(heading.id)}">${esc(heading.textContent)}</a>`; }).join("");
      h1.after(toc);
    }
    const update = () => {
      const max = d.documentElement.scrollHeight - innerHeight;
      progress.style.width = `${max > 0 ? Math.min(100, scrollY / max * 100) : 0}%`;
    };
    addEventListener("scroll", update, {passive:true});
    update();
    $$('img', main).forEach((image) => image.addEventListener("error", () => image.closest("figure")?.remove() || image.remove(), {once:true}));
    // Legal and editorial wording is preserved exactly in V12.
  }

  function initGlobalEvents() {
    d.addEventListener("click", (event) => { const button = event.target.closest("[data-copy-code]"); if (button) copyCode(button); });
  }

  async function boot() {
    initChrome();
    initGlobalEvents();
    initHomeSearch();
    initFinder();
    renderHomepageProducts();
    renderRareUsed("[data-tp-home-rare]");
    renderRareUsed("[data-tp-rare-products]");
    renderDeals();
    upgradeEditorial();
  }

  if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
