(() => {
  "use strict";

  const V = "20.9.0";
  const d = document;
  const $ = (s, r = d) => r.querySelector(s);
  const $$ = (s, r = d) => [...r.querySelectorAll(s)];
  const C = v => String(v ?? "").replace(/\s+/g, " ").trim();
  const L = v => C(v).toLowerCase();
  const E = v => C(v).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const params = new URLSearchParams(location.search);
  const q = C(params.get("q"));
  const forced = params.get("universal") === "1";
  const BLOCK = new Set(["temu", "joom", "filamentpro", "filamentpro eu cps", "filamentpro-eu-cps"]);
  const STOP = new Set(["the","and","for","with","from","this","that","your","our","new","best","buy","original","official","product","products","item","items","of","to","in","on","by","a","an"]);
  const cache = new Map();
  let rows = [];
  let visible = [];
  let pageSize = 24;

  const MANAGED = [
    /^(?:pho|phon|phone|phones|smartp|smartph|smartpho|smartphon|smartphone|smartphones|mobile phone|mobile phones|cell phone|cell phones)$/i,
    /\b(?:iphone|samsung galaxy|galaxy\s+[a-zmfsz]?\d+|google pixel|pixel\s+\d+|oneplus|xiaomi|redmi|poco|oppo|vivo|realme|motorola|moto|honor|huawei|nokia|xperia|nothing phone|zenfone|nubia|infinix|tecno)\b/i,
    /^(?:lap|lapt|lapto|laptop|laptops|notebook|notebooks)$/i,
    /\b(?:thinkpad|ideapad|thinkbook|chromebook|macbook|vivobook|zenbook|probook|elitebook|latitude|inspiron|xps|legion|surface laptop|lenovo slim)\b/i,
    /^(?:per|perf|perfu|perfum|perfume|perfumes|frag|fragr|fragra|fragrance|fragrances)$/i,
    /\b(?:cologne|eau de parfum|eau de toilette|edp|edt)\b/i,
    /\b(?:headphones?|headsets?|earbuds?|earphones?|airpods?|tws)\b/i,
    /\b(?:smart ?watch|apple watch|wearable watch|fitness watch)\b/i,
    /\b(?:power ?banks?|powerbank|portable charger|external battery)\b/i,
    /\b(?:dog food|puppy food|dog treats?|canine food)\b/i,
    /\b(?:air conditioner|portable ac|mini split|ductless ac|split ac)\b/i,
    /\b(?:3d filament|pla filament|petg filament|abs filament|tpu filament)\b/i,
    /\b(?:cookware|frying pan|saucepan|casserole|wok|skillet)\b/i,
    /\b(?:lighting|led strip|desk lamp|floor lamp|ceiling light)\b/i,
    /\b(?:tools?|drill|saw|multimeter|oscilloscope|screwdriver|wrench)\b/i
  ];

  const managed = value => MANAGED.some(r => r.test(C(value)));
  const roleIntent = value => {
    const x = L(value);
    if (/\b(?:used|refurbished|renewed|pre[- ]?owned|second[- ]?hand|open[- ]?box)\b/i.test(x)) return "used";
    if (/\b(?:replacement|spare|repair|parts?|carbon brush|armature|stator|rotor|carburetor|screen replacement|replacement battery|replacement filter)\b/i.test(x)) return "replacement_part";
    if (/\b(?:accessor(?:y|ies)|case|cover|holder|stand|mount|strap|lanyard|sleeve|screen protector|tempered glass|watch band|watch strap|ear pads?|ear cushions?|charging cable|usb cable|charger|dock)\b/i.test(x)) return "accessory";
    return "main";
  };

  const intent = roleIntent(q);
  if (!q || (!forced && managed(q) && intent === "main")) return;

  function familyFor(value) {
    const x = L(value);
    const rules = [
      ["phone", /\b(?:phone|smartphone|iphone|galaxy|pixel|redmi|oneplus|phone case|phone holder|phone charger)\b/i],
      ["tablet", /\b(?:tablet|ipad|galaxy tab|surface pro)\b/i],
      ["laptop", /\b(?:laptop|chromebook|notebook computer|thinkpad|ideapad|macbook|laptop charger|laptop stand)\b/i],
      ["computer", /\b(?:computer|pc\b|desktop|monitor|keyboard|mouse|ssd|hard drive|nvme|ram\b|graphics card|gpu\b|motherboard)\b/i],
      ["camera", /\b(?:camera|webcam|camera lens|dash cam|action cam|tripod)\b/i],
      ["printer", /\b(?:printer|label printer|thermal printer|laser printer|inkjet)\b/i],
      ["projector", /\bprojector\b/i],
      ["television", /\b(?:television|smart tv|oled tv|qled tv|led tv)\b/i],
      ["speaker", /\b(?:speaker|soundbar|subwoofer)\b/i],
      ["microphone", /\b(?:microphone|wireless mic|usb mic|lavalier mic)\b/i],
      ["headphones", /\b(?:headphone|headset|earbud|earphone|airpods|tws)\b/i],
      ["smartwatch", /\b(?:smartwatch|smart watch|apple watch|watch band|watch strap)\b/i],
      ["power-bank", /\b(?:power bank|powerbank|portable charger|external battery)\b/i],
      ["3d-printing", /\b(?:3d print|3d printer|filament|pla\b|petg\b|tpu\b|resin printer)\b/i],
      ["tools", /\b(?:tool|drill|saw|grinder|screwdriver|wrench|pliers|multimeter|oscilloscope|caliper|soldering)\b/i],
      ["industrial", /\b(?:industrial|cnc|hydraulic|pneumatic|servo|encoder|solenoid|contactor|plc)\b/i],
      ["home-appliances", /\b(?:vacuum|air fryer|coffee maker|espresso machine|blender|kettle|toaster|rice cooker|humidifier|air purifier|fan\b)\b/i],
      ["air-conditioning", /\b(?:air conditioner|portable ac|mini split|ductless ac|split ac)\b/i],
      ["kitchen", /\b(?:cookware|pan\b|saucepan|wok|skillet|kitchen knife|cutting board|kitchen utensil)\b/i],
      ["furniture", /\b(?:furniture|desk\b|chair\b|sofa|couch|table\b|cabinet|bookshelf|wardrobe|nightstand|bed frame)\b/i],
      ["home", /\b(?:home decor|bedding|blanket|pillow|curtain|organizer|storage box|cleaning brush|night light)\b/i],
      ["automotive", /\b(?:car\b|automotive|vehicle|brake|spark plug|ignition coil|fuel pump|car charger|car mount|carplay|head unit)\b/i],
      ["pets", /\b(?:pet\b|dog\b|cat\b|puppy|kitten|leash|collar|litter)\b/i],
      ["beauty", /\b(?:beauty|skincare|skin care|makeup|serum|lipstick|mascara|hair dryer|hair straightener|nail care|grooming)\b/i],
      ["perfume", /\b(?:perfume|fragrance|cologne|parfum|eau de parfum|eau de toilette)\b/i],
      ["apparel", /\b(?:dress|shirt|t-shirt|hoodie|sweater|jacket|coat|jeans|trousers|pants|skirt|shorts|shoes|sneakers|boots|sandals|hat\b|cap\b)\b/i],
      ["bags", /\b(?:bag\b|handbag|backpack|wallet|cardholder)\b/i],
      ["sports", /\b(?:fitness|gym\b|exercise|treadmill|exercise bike|rowing machine|resistance band|camping|cycling)\b/i],
      ["baby", /\b(?:baby|stroller|infant|diaper|nappy)\b/i],
      ["toys", /\b(?:toy|doll|action figure|building blocks|plush)\b/i],
      ["office", /\b(?:stationery|notebook|pen\b|pencil|office supplies)\b/i],
      ["arts-crafts", /\b(?:diamond painting|diamond art|painting kit|art supplies|craft kit|diy craft)\b/i],
      ["jewelry-craft", /\b(?:jewelry|jewellery|necklace|bracelet|earring|pendant|beads|charms|ring\b)\b/i],
      ["medical", /\b(?:medical|surgical|diagnostic|blood pressure|oximeter|dental|patient monitor)\b/i]
    ];
    for (const [family, re] of rules) if (re.test(x)) return family;
    return "";
  }

  const family = familyFor(q);
  const tokens = L(q).replace(/[^a-z0-9.+#/-]+/g, " ").split(/\s+/).filter(t => t && !STOP.has(t) && (t.length >= 3 || (/[a-z]/.test(t) && /\d/.test(t))));
  const fetchJSON = url => {
    if (!cache.has(url)) cache.set(url, fetch(url, {cache:"force-cache"}).then(r => r.ok ? r.json() : null).catch(() => null));
    return cache.get(url);
  };
  const termPrefix = t => (t.replace(/[^a-z0-9]/g, "").slice(0, 2) || "__").padEnd(2, "_");

  async function idsForToken(t) {
    const shard = await fetchJSON(`/data/v20-9/terms/${termPrefix(t)}.json?v=${V}`);
    if (!shard) return [];
    if (shard[t]) return shard[t];
    if (t.length >= 3) {
      const out = [];
      for (const [key, ids] of Object.entries(shard)) {
        if (!key.startsWith(t)) continue;
        out.push(...ids);
        if (out.length >= 1200) break;
      }
      return [...new Set(out)];
    }
    return [];
  }

  const intersect = (a, b) => {
    const s = new Set(b);
    return a.filter(x => s.has(x));
  };
  const unique = values => [...new Set(values)];

  async function candidateIds() {
    const groups = [];
    for (const t of tokens.slice(0, 7)) {
      const ids = await idsForToken(t);
      if (ids.length) groups.push(ids);
    }
    let textIds = [];
    if (groups.length) {
      groups.sort((a,b) => a.length - b.length);
      textIds = groups[0].slice();
      for (const g of groups.slice(1)) {
        const z = intersect(textIds, g);
        if (z.length) textIds = z;
      }
      if (!textIds.length) textIds = unique(groups.flat()).slice(0, 240);
    }

    let familyIds = [];
    if (family) {
      const families = await fetchJSON(`/data/v20-9/families.json?v=${V}`);
      familyIds = families?.[family] || [];
    }

    let ids = textIds;
    if (familyIds.length && textIds.length) {
      const strict = intersect(textIds, familyIds);
      ids = strict.length >= 8 ? strict : unique([...strict, ...textIds, ...familyIds]);
    } else if (familyIds.length) {
      ids = familyIds;
    }
    return unique(ids).slice(0, 360);
  }

  async function loadRows(ids) {
    const grouped = {};
    for (const id of ids) (grouped[id.slice(0,2)] ??= []).push(id);
    const out = [];
    await Promise.all(Object.entries(grouped).map(async ([prefix, list]) => {
      const bucket = await fetchJSON(`/data/v20-9/products/${prefix}.json?v=${V}`) || {};
      for (const id of list) if (bucket[id]) out.push(bucket[id]);
    }));
    return out;
  }

  const roleName = r => ({main:"Main product",accessory:"Accessory",replacement_part:"Replacement part",used:"Used / refurbished"}[r] || C(r || "Product").replaceAll("_", " "));
  const money = r => `${r.cu === "USD" ? "US$" : E((r.cu || "") + " ")}${Number(r.p).toLocaleString(undefined,{maximumFractionDigits:2})}`;
  function priceInfo(r) {
    if (!r.p) return {label:"Check current price", proof:"Confirm with seller", kind:"check"};
    if (r.x) return {label:money(r), proof:"✓ Exact-product price", kind:"verified"};
    return {label:money(r), proof:"Seller-feed price", kind:"feed"};
  }

  function scoreRow(r) {
    const title = L(r.t);
    const search = L(r.s);
    const type = L(r.ty);
    const fam = L(r.fa);
    const role = C(r.ro || "main");
    let score = Number(r.r || 0) / 12;
    if (title === L(q)) score += 100;
    if (title.includes(L(q))) score += 42;
    if ((r.ids || []).some(x => L(x) === L(q))) score += 110;
    for (const t of tokens) {
      if (title.includes(t)) score += 15;
      else if (search.includes(t)) score += 7;
    }
    if (family && (fam === family || type === family)) score += 34;
    if (intent === "main") {
      if (role === "main") score += 32;
      else if (role === "used") score += 20;
      else score -= 42;
    } else if (intent === "used") {
      score += role === "used" ? 45 : -22;
    } else if (intent === role) {
      score += 48;
    } else {
      score -= 26;
    }
    if (r.x) score += 9;
    if (r.im) score += 5;
    if (r.p) score += 2;
    return score;
  }

  function roleAppropriate(r) {
    const role = C(r.ro || "main");
    if (intent === "main" && family) return role === "main" || role === "used";
    if (intent === "used") return role === "used";
    if (intent === "accessory") return role === "accessory";
    if (intent === "replacement_part") return role === "replacement_part";
    return true;
  }

  function compareItems() {
    try {
      const raw = JSON.parse(localStorage.getItem("tp-v209-compare") || "[]");
      return Array.isArray(raw) ? raw : [];
    } catch { return []; }
  }
  function setCompareItems(items) {
    try { localStorage.setItem("tp-v209-compare", JSON.stringify(items.slice(0,3))); } catch {}
    $$('[data-compare-count]').forEach(el => {
      el.textContent = String(items.length);
      el.toggleAttribute("hidden", !items.length);
    });
  }
  function addCompare(r, button) {
    const items = compareItems();
    if (items.some(x => (typeof x === "string" ? x : x.id) === r.id)) {
      location.href = "/compare/";
      return;
    }
    const first = items[0];
    const firstFamily = typeof first === "object" ? C(first.fa) : "";
    if (firstFamily && C(r.fa) && firstFamily !== C(r.fa)) {
      button.textContent = "Choose same family";
      setTimeout(() => button.textContent = "Compare", 1400);
      return;
    }
    if (items.length >= 3) {
      button.textContent = "Compare list is full";
      setTimeout(() => button.textContent = "Compare", 1400);
      return;
    }
    items.push({id:r.id, fa:C(r.fa), t:C(r.t), ty:C(r.ty)});
    setCompareItems(items);
    button.textContent = "Added ✓";
  }

  function card(r) {
    const pi = priceInfo(r);
    const href = `/item/?id=${encodeURIComponent(r.id)}&q=${encodeURIComponent(q)}`;
    const role = roleName(r.ro);
    return `<article class="tp78-card tp80-universal-card" data-v209-card data-v209-seller="${E(r.se)}" data-v209-role="${E(r.ro || "main")}" data-v209-family="${E(r.fa || r.ty)}">
      <a class="tp78-media" href="${E(href)}" aria-label="View ${E(r.t)} details">${r.im ? `<img src="${E(r.im)}" alt="${E(r.t)}" width="360" height="360" loading="lazy">` : "<span>No image</span>"}</a>
      <div class="tp78-body">
        <div class="tp78-top"><b>${E(r.b || r.tyl || "Product")}</b><span>${E(r.se)}</span></div>
        <h3><a href="${E(href)}">${E(r.t)}</a></h3>
        <strong class="tp78-price">${E(pi.label)}</strong><span class="tp80-price-proof ${pi.kind}">${E(pi.proof)}</span>
        <p class="tp80-universal-meta">${E(r.tyl || r.ty)} · ${E(role)}</p>
        <div class="tp78-actions"><a class="tp78-primary internal-detail" href="${E(href)}">View details →</a><button class="tp78-secondary" type="button" data-v209-compare="${E(r.id)}">Compare</button></div>
        ${!r.x && r.p ? '<small class="tp80-route-note">Seller catalogue price. The TrendPilot detail page shows whether the seller route is exact or broader.</small>' : ""}
      </div>
    </article>`;
  }

  function sellerKey() { return `tp-v209-seller:${L(q)}`; }
  function applyControls() {
    const sellerSelect = $("[data-filter-merchant]");
    const sortSelect = $("[data-filter-sort]");
    const sellerValue = C(sellerSelect?.value);
    visible = rows.filter(r => !sellerValue || C(r.se) === sellerValue);
    const sort = C(sortSelect?.value || "smart");
    if (sort === "price-low") visible.sort((a,b) => (a.p || Infinity) - (b.p || Infinity));
    else if (sort === "price-high") visible.sort((a,b) => (b.p || 0) - (a.p || 0));
    else if (sort === "best-value") visible.sort((a,b) => (Number(b.x)-Number(a.x)) || ((a.p || Infinity)-(b.p || Infinity)) || (b._score-a._score));
    else visible.sort((a,b) => b._score - a._score);
    pageSize = 24;
    draw();
  }

  function populateSellerFilter() {
    const select = $("[data-filter-merchant]");
    if (!select) return;
    const sellers = [...new Set(rows.map(r => C(r.se)).filter(Boolean))].sort((a,b) => a.localeCompare(b));
    const saved = (() => { try { return sessionStorage.getItem(sellerKey()) || ""; } catch { return ""; } })();
    select.innerHTML = `<option value="">All sellers</option>` + sellers.map(s => `<option value="${E(s)}">${E(s)}</option>`).join("");
    if (saved && sellers.includes(saved)) select.value = saved;
    if (!select.dataset.v209Bound) {
      select.dataset.v209Bound = "1";
      select.addEventListener("change", () => {
        try { sessionStorage.setItem(sellerKey(), select.value); } catch {}
        applyControls();
      });
    }
    const sort = $("[data-filter-sort]");
    if (sort && !sort.dataset.v209Bound) {
      sort.dataset.v209Bound = "1";
      sort.addEventListener("change", applyControls);
    }
  }

  function bindCards() {
    $$('[data-v209-compare]').forEach(button => button.addEventListener("click", () => {
      const r = rows.find(x => x.id === button.dataset.v209Compare);
      if (r) addCompare(r, button);
    }));
  }

  function draw() {
    const grid = $("[data-v2078-product-grid]");
    if (!grid) return;
    const page = visible.slice(0, pageSize);
    grid.innerHTML = page.length ? page.map(card).join("") : `<div class="tp80-no-result"><h2>No products match this seller/filter combination.</h2><p>Try All sellers or a more specific product name, model, MPN or part number.</p></div>`;
    const count = $("[data-v2078-results-count]");
    if (count) count.textContent = `${visible.length} matching`;
    const more = $("[data-v2078-load-more]");
    if (more) {
      more.hidden = pageSize >= visible.length;
      more.textContent = `Show more products (${Math.max(0, visible.length-pageSize)} remaining)`;
      if (!more.dataset.v209Bound) {
        more.dataset.v209Bound = "1";
        more.addEventListener("click", () => { pageSize += 24; draw(); });
      }
    }
    bindCards();
    setCompareItems(compareItems());
  }

  async function logDemand() {
    const body = JSON.stringify({q, source:document.referrer || "", path:location.pathname + location.search});
    try { await fetch("/.netlify/functions/discovery-demand-v20-8", {method:"POST",headers:{"content-type":"application/json"},body,keepalive:true}); }
    catch { try { localStorage.setItem("tp-v20-9-missed:" + L(q), new Date().toISOString()); } catch {} }
  }

  async function boot() {
    const grid = $("[data-v2078-product-grid]");
    if (!grid) return;
    grid.innerHTML = `<div class="tp78-empty"><h3>Searching the full catalogue…</h3><p>Checking product family, role, identifiers and seller evidence.</p></div>`;
    const ids = await candidateIds();
    let found = await loadRows(ids);
    found = found.filter(r => !BLOCK.has(L(r.se)) && roleAppropriate(r));
    found = found.map(r => ({...r, _score:scoreRow(r)})).filter(r => r._score > -10).sort((a,b) => b._score-a._score);

    if (!found.length) {
      await logDemand();
      grid.innerHTML = `<div class="tp80-no-result"><h2>We couldn't verify this product yet.</h2><p>Try a model, MPN, SKU, part number or a more specific product phrase. TrendPilot recorded this search for future catalogue updates.</p><a href="/rare-used/">Explore Rare Finds</a></div>`;
      const count = $("[data-v2078-results-count]"); if (count) count.textContent = "0 matching";
      return;
    }

    rows = found.slice(0, 180);
    const head = $("[data-v2078-results-title]");
    if (head) head.textContent = `Results for “${q}”`;
    const sub = $("[data-v2078-results-sub]");
    if (sub) sub.textContent = intent === "main" ? "Main products are shown first; accessories and replacement parts are kept out of generic product searches." : `Showing ${roleName(intent).toLowerCase()} results matched to the requested product family.`;
    populateSellerFilter();
    applyControls();
  }

  setTimeout(boot, forced ? 120 : 420);
})();
