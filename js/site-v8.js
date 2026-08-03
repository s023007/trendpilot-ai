(() => {
  "use strict";

  const cfg = window.TRENDPILOT_SITE_CONFIG || {};
  const clean = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
  const lower = (value) => clean(value).toLowerCase();
  const esc = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;"
  }[char]));
  const validUrl = (value) => /^https?:\/\//i.test(clean(value));
  const words = (value) => lower(value)
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/[^a-z0-9+.#%\- ]+/g, " ")
    .split(/\s+/)
    .map((token) => token.replace(/^[.\-+]+|[.\-+]+$/g, ""))
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));

  const STOP_WORDS = new Set([
    "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "in", "is",
    "it", "of", "on", "or", "the", "to", "with", "without", "new", "best", "latest",
    "sale", "hot", "official", "original", "product", "products", "item", "items"
  ]);

  const selected = new Map();
  const shardCache = new Map();
  const catalogueState = {
    manifest: null,
    loadedProducts: [],
    lastResults: [],
    lastQuery: "",
    searchSerial: 0,
  };

  function advertiserName(offer) {
    const value = clean(offer?.advertiser || offer?.network || "Current seller");
    return lower(value) === "true" ? "Geekbuying" : value;
  }

  function price(offer) {
    const amount = Number(offer?.price);
    if (!Number.isFinite(amount) || amount <= 0) return "Check current price";
    return `${clean(offer.currency) || "USD"} ${amount.toFixed(2)}`;
  }

  function productKey(offer) {
    return clean(offer?.id || offer?.__key || offer?.canonicalKey || offer?.productUrl || offer?.url || offer?.name);
  }

  function normalizeOffer(offer) {
    const copy = { ...offer };
    copy.id = productKey(copy);
    copy.advertiser = advertiserName(copy);
    copy.url = clean(copy.url || copy.affiliateUrl || copy.productUrl);
    copy.image = clean(copy.image || copy.imageUrl);
    copy.description = clean(copy.description || copy.summary);
    copy.group = clean(copy.group || inferGroup(copy));
    copy.family = clean(copy.family || inferFamily(copy, copy.group));
    copy.quality = Number(copy.quality ?? copy.offerQuality ?? copy.qualityScore ?? copy.matchScore ?? 0) || 0;
    return copy;
  }

  function inferGroup(offer) {
    const hay = lower([offer?.name, offer?.description, offer?.category, offer?.brand].join(" "));
    const tests = [
      ["footwear", /\b(shoe|shoes|sneaker|sneakers|trainer|trainers|boot|boots|sandal|sandals|slipper|slippers|heel|heels|loafer|loafers|footwear)\b/],
      ["pet-supplies", /\b(pet|pets|dog|dogs|cat|cats|puppy|puppies|kitten|kittens|aquarium)\b/],
      ["automotive", /\b(carplay|android auto|car radio|head unit|dash ?cam|vehicle|automotive|car stereo)\b/],
      ["phones-tablets", /\b(smartphone|mobile phone|iphone|tablet|phone case)\b/],
      ["computers", /\b(laptop|computer|keyboard|mouse|monitor|ssd|usb hub|graphics card)\b/],
      ["audio", /\b(headphone|headphones|earbud|earbuds|speaker|speakers|microphone|headset|audio)\b/],
      ["cameras", /\b(camera|cameras|webcam|gimbal|tripod|lens)\b/],
      ["projectors-tv", /\b(projector|projectors|television|smart tv|streaming box|tv box)\b/],
      ["printing-3d", /\b(thermal printer|label printer|3d print|filament|pla|petg|printer)\b/],
      ["software", /\b(video editor|filmora|capcut|pdf editor|software|voice ai)\b/],
      ["business-sourcing", /\b(supplier|suppliers|wholesale|manufacturer|factory|private label|custom logo|bulk order)\b/],
    ];
    return tests.find(([, pattern]) => pattern.test(hay))?.[0] || clean(offer?.category) || "other";
  }

  function inferFamily(offer, group) {
    const hay = lower([offer?.name, offer?.description, offer?.category, offer?.brand].join(" "));
    const rules = [
      ["wireless-carplay-adapter", ["wireless carplay", "carplay adapter", "carplay dongle"]],
      ["car-head-unit", ["head unit", "car radio", "multimedia player", "car stereo"]],
      ["pet-feeder", ["pet feeder", "automatic feeder", "food dispenser", "feeding bowl", "cat feeder", "dog feeder"]],
      ["pet-water-fountain", ["pet fountain", "water fountain", "water dispenser", "cat fountain", "dog fountain"]],
      ["pet-grooming", ["pet grooming", "grooming brush", "pet clipper", "deshedding"]],
      ["pet-toy", ["pet toy", "dog toy", "cat toy", "chew toy"]],
      ["sneakers", ["sneaker", "trainer", "running shoe", "sports shoe"]],
      ["boots", ["boot", "ankle boot", "snow boot", "work boot"]],
      ["sandals", ["sandal", "slipper", "flip flop", "slides"]],
      ["formal-shoes", ["loafer", "formal shoe", "dress shoe", "oxford shoe", "heel"]],
      ["thermal-printer", ["thermal printer", "label printer", "receipt printer"]],
      ["portable-projector", ["portable projector", "mini projector", "home projector"]],
      ["video-editor", ["video editor", "filmora", "capcut", "video editing"]],
      ["3d-filament", ["filament", "pla", "petg", "abs filament"]],
    ];
    const hit = rules.find(([, phrases]) => phrases.some((phrase) => hay.includes(phrase)));
    if (hit) return hit[0];
    const signature = words(`${offer?.brand || ""} ${offer?.name || ""}`).slice(0, 3).join("-");
    return signature ? `${group}:${signature}` : group;
  }

  /* ----------------------------------------------------------------------- */
  /* Mobile navigation                                                        */
  /* ----------------------------------------------------------------------- */

  function initMenu() {
    const button = document.querySelector("[data-menu-button], #menuButton");
    const nav = document.querySelector("[data-primary-nav], #mainNav");
    let backdrop = document.querySelector("[data-menu-backdrop]");
    if (!button || !nav) return;

    if (!backdrop) {
      backdrop = document.createElement("button");
      backdrop.type = "button";
      backdrop.className = "nav-backdrop";
      backdrop.setAttribute("data-menu-backdrop", "");
      backdrop.setAttribute("aria-label", "Close menu");
      nav.after(backdrop);
    }

    const originalParent = nav.parentNode;
    const originalNext = nav.nextSibling;
    const backdropParent = backdrop.parentNode;
    const backdropNext = backdrop.nextSibling;
    const media = window.matchMedia("(max-width: 860px)");

    const moveForViewport = () => {
      if (media.matches) {
        if (nav.parentNode !== document.body) document.body.appendChild(nav);
        if (backdrop.parentNode !== document.body) document.body.appendChild(backdrop);
      } else {
        close();
        if (nav.parentNode !== originalParent) originalParent.insertBefore(nav, originalNext);
        if (backdrop.parentNode !== backdropParent) backdropParent.insertBefore(backdrop, backdropNext);
      }
    };

    const close = () => {
      nav.classList.remove("open");
      backdrop.classList.remove("open");
      document.body.classList.remove("menu-open");
      button.setAttribute("aria-expanded", "false");
      button.setAttribute("aria-label", "Open menu");
    };

    const open = () => {
      moveForViewport();
      nav.classList.add("open");
      backdrop.classList.add("open");
      document.body.classList.add("menu-open");
      button.setAttribute("aria-expanded", "true");
      button.setAttribute("aria-label", "Close menu");
      const firstLink = nav.querySelector("a");
      window.setTimeout(() => firstLink?.focus({ preventScroll: true }), 80);
    };

    button.addEventListener("click", () => nav.classList.contains("open") ? close() : open());
    nav.addEventListener("click", (event) => {
      if (event.target.closest("[data-menu-close]") || event.target.closest("a")) close();
    });
    backdrop.addEventListener("click", close);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") close();
    });
    media.addEventListener?.("change", moveForViewport);
    moveForViewport();
  }

  /* ----------------------------------------------------------------------- */
  /* Product sources and catalogue                                            */
  /* ----------------------------------------------------------------------- */

  function programmeMap() {
    const rows = window.TRENDPILOT_PROGRAM_STATUS?.programs || [];
    const map = new Map();
    rows
      .filter((row) => row.status === "active" && row.public !== false)
      .forEach((row) => map.set(lower(row.advertiser || row.name), row));
    return map;
  }

  function fallbackOffers() {
    const matches = window.TRENDPILOT_MATCHED_PRODUCTS || {};
    const programs = programmeMap();
    const seen = new Set();
    return Object.values(matches)
      .flat()
      .filter(Boolean)
      .map(normalizeOffer)
      .filter((offer) => {
        const key = productKey(offer);
        if (!key || seen.has(key) || !clean(offer.name) || !validUrl(offer.url)) return false;
        if (programs.size && !programs.has(lower(offer.advertiser))) return false;
        seen.add(key);
        return true;
      });
  }

  async function loadManifest() {
    if (catalogueState.manifest) return catalogueState.manifest;
    try {
      const response = await fetch(`/data/search-catalog/manifest.json?v=${encodeURIComponent(cfg.version || "8")}`, {
        cache: "no-store"
      });
      if (!response.ok) throw new Error(`Catalogue manifest ${response.status}`);
      catalogueState.manifest = await response.json();
      return catalogueState.manifest;
    } catch (error) {
      console.warn("TrendPilot search catalogue is unavailable; using published matches.", error);
      const fallback = fallbackOffers();
      catalogueState.manifest = {
        version: "fallback",
        sourceMode: "published-matches",
        productCount: fallback.length,
        groups: [],
        tokenRoutes: {},
        featured: fallback.slice(0, 12),
      };
      catalogueState.loadedProducts = fallback;
      return catalogueState.manifest;
    }
  }

  async function loadShard(group) {
    if (shardCache.has(group)) return shardCache.get(group);
    const manifest = await loadManifest();
    const row = (manifest.groups || []).find((entry) => entry.id === group);
    if (!row) return [];
    const promise = fetch(`${row.file}?v=${encodeURIComponent(manifest.generatedAt || manifest.version || "8")}`, {
      cache: "force-cache"
    })
      .then((response) => {
        if (!response.ok) throw new Error(`Catalogue shard ${group}: ${response.status}`);
        return response.json();
      })
      .then((payload) => (payload.products || []).map(normalizeOffer))
      .catch((error) => {
        console.warn(error);
        return [];
      });
    shardCache.set(group, promise);
    return promise;
  }

  function queryPlan(query, manifest) {
    const normalized = lower(query);
    const queryWords = words(normalized);
    const groups = new Set();
    const expanded = new Set(queryWords);
    const broadCategoryTerms = new Set([
      "shoe", "shoes", "footwear", "pet", "pets", "pet supplies",
      "automotive", "car electronics", "phone", "phones", "tablet", "tablets",
      "computer", "computers", "audio", "camera", "cameras", "projector", "projectors",
      "smart home", "home", "kitchen", "beauty", "clothing", "apparel", "bags",
      "tools", "toys", "games", "sports", "outdoors", "printer", "printers",
      "software", "supplier", "suppliers", "wholesale", "manufacturer"
    ]);
    let exactGroupRoute = false;

    for (const group of manifest.groups || []) {
      for (const alias of group.aliases || []) {
        const aliasText = lower(alias);
        if (!aliasText) continue;
        if (normalized === aliasText || normalized.includes(aliasText)) {
          groups.add(group.id);
          if (normalized === aliasText && broadCategoryTerms.has(aliasText)) exactGroupRoute = true;
          words(aliasText).forEach((token) => expanded.add(token));
        }
      }
    }

    for (const token of queryWords) {
      for (const group of manifest.tokenRoutes?.[token] || []) groups.add(group);
    }

    // Product phrases people commonly type but feeds describe differently.
    const synonymSets = [
      ["shoe", "shoes", "footwear", "sneaker", "sneakers", "trainer", "trainers"],
      ["pet", "dog", "cat", "puppy", "kitten"],
      ["carplay", "car radio", "head unit", "android auto"],
      ["earbuds", "earphones", "headphones", "tws"],
      ["video editor", "video editing", "filmora", "capcut"],
      ["supplier", "manufacturer", "factory", "wholesale"],
      ["printer", "thermal printer", "label printer"],
    ];
    for (const set of synonymSets) {
      if (set.some((item) => normalized.includes(item))) {
        set.flatMap(words).forEach((token) => expanded.add(token));
      }
    }

    if (!groups.size) {
      const generic = (manifest.groups || []).find((entry) => entry.id === "other");
      if (generic) groups.add(generic.id);
    }

    return {
      normalized,
      originalTokens: queryWords,
      expandedTokens: [...expanded],
      groups: [...groups].slice(0, 4),
      exactGroupRoute,
    };
  }

  function editDistanceAtMostOne(a, b) {
    if (a === b) return true;
    if (Math.abs(a.length - b.length) > 1) return false;
    let i = 0;
    let j = 0;
    let edits = 0;
    while (i < a.length && j < b.length) {
      if (a[i] === b[j]) {
        i += 1;
        j += 1;
        continue;
      }
      edits += 1;
      if (edits > 1) return false;
      if (a.length > b.length) i += 1;
      else if (b.length > a.length) j += 1;
      else {
        i += 1;
        j += 1;
      }
    }
    return edits + (i < a.length || j < b.length ? 1 : 0) <= 1;
  }

  function productScore(offer, plan) {
    const name = lower(offer.name);
    const category = lower(`${offer.category || ""} ${offer.group || ""} ${offer.family || ""}`);
    const brand = lower(offer.brand);
    const description = lower(offer.description);
    const productTokens = words(`${name} ${brand} ${category}`);
    let score = 0;
    let originalMatches = 0;

    if (plan.normalized && name.includes(plan.normalized)) {
      score += 120;
      originalMatches += plan.originalTokens.length || 1;
    }

    for (const token of plan.originalTokens) {
      if (name.includes(token)) {
        score += 34;
        originalMatches += 1;
      } else if (brand.includes(token)) {
        score += 22;
        originalMatches += 1;
      } else if (category.includes(token)) {
        score += 18;
        originalMatches += 1;
      } else if (description.includes(token)) {
        score += 7;
        originalMatches += 1;
      } else if (token.length >= 5 && productTokens.some((candidate) => editDistanceAtMostOne(token, candidate))) {
        score += 10;
        originalMatches += 1;
      }
    }

    for (const token of plan.expandedTokens) {
      if (plan.originalTokens.includes(token)) continue;
      if (name.includes(token)) score += 7;
      else if (category.includes(token)) score += 4;
    }

    const routedGroup = plan.groups.includes(offer.group);
    if (!originalMatches && !(plan.exactGroupRoute && routedGroup)) return 0;
    if (plan.exactGroupRoute && routedGroup) score += 16;
    score += Math.min(8, Number(offer.quality || 0) / 12.5);
    if (validUrl(offer.image)) score += 3;
    if (Number(offer.price) > 0) score += 2;
    return score;
  }

  function guideScore(guide, query) {
    const queryTokens = words(query);
    const title = lower(guide.title);
    const hay = lower([guide.title, guide.description, guide.category, guide.keywords].join(" "));
    let score = 0;
    for (const token of queryTokens) {
      if (title.includes(token)) score += 8;
      else if (hay.includes(token)) score += 3;
    }
    return score;
  }

  function diversify(products, limit = 24) {
    const buckets = new Map();
    products.forEach((product) => {
      const key = lower(product.advertiser) || "seller";
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

  async function searchCatalogue(query) {
    const manifest = await loadManifest();
    const plan = queryPlan(query, manifest);
    const shardRows = plan.groups.length
      ? (await Promise.all(plan.groups.map(loadShard))).flat()
      : (manifest.featured || []).map(normalizeOffer);
    const fallback = shardRows.length ? [] : fallbackOffers();
    const seen = new Set();
    const candidates = [...shardRows, ...fallback]
      .map(normalizeOffer)
      .filter((offer) => {
        const key = productKey(offer);
        if (!key || seen.has(key) || !validUrl(offer.url)) return false;
        seen.add(key);
        return true;
      });

    catalogueState.loadedProducts = candidates;
    const scored = candidates
      .map((offer) => ({ ...offer, __score: productScore(offer, plan) }))
      .filter((offer) => offer.__score > 0)
      .sort((a, b) => b.__score - a.__score || b.quality - a.quality);
    return diversify(scored, 30);
  }

  /* ----------------------------------------------------------------------- */
  /* Cards and media                                                          */
  /* ----------------------------------------------------------------------- */

  function imageMarkup(offer, className = "") {
    if (validUrl(offer.image)) {
      return `<img class="${esc(className)}" src="${esc(offer.image)}" alt="${esc(offer.name)}" loading="lazy" decoding="async" referrerpolicy="no-referrer" data-product-image>`;
    }
    return `<span class="offer-fallback">${esc((offer.advertiser || "TP").slice(0, 2).toUpperCase())}</span>`;
  }

  function card(offer, placement, compare = false) {
    const normalized = normalizeOffer(offer);
    const key = productKey(normalized);
    const isSelected = selected.has(key);
    const compatible = isCompatibleWithSelection(normalized);
    const buttonDisabled = selected.size > 0 && !isSelected && !compatible;
    const buttonText = isSelected ? "Selected" : buttonDisabled ? "Different product type" : "Add to compare";
    return `<article class="offer-card" data-offer-key="${esc(key)}" data-product-group="${esc(normalized.group)}" data-product-family="${esc(normalized.family)}">
      <a class="offer-media" href="${esc(normalized.url)}" target="_blank" rel="sponsored nofollow noopener" data-affiliate-outbound data-advertiser="${esc(normalized.advertiser)}" data-product-name="${esc(normalized.name)}" data-placement="${esc(placement)}">
        ${imageMarkup(normalized)}
      </a>
      <div class="offer-body">
        <div class="offer-source"><span>${esc(normalized.advertiser)}</span><em>Available now</em></div>
        <h3>${esc(normalized.name)}</h3>
        <div class="offer-meta"><strong>${esc(price(normalized))}</strong><span>Check delivery and returns</span></div>
        <a class="button button-small button-brand" href="${esc(normalized.url)}" target="_blank" rel="sponsored nofollow noopener" data-affiliate-outbound data-advertiser="${esc(normalized.advertiser)}" data-product-name="${esc(normalized.name)}" data-placement="${esc(placement)}">View product ↗</a>
        ${compare ? `<button class="offer-compare" type="button" data-compare-key="${esc(key)}" aria-pressed="${isSelected}" ${buttonDisabled ? "disabled" : ""}>${esc(buttonText)}</button>` : ""}
      </div>
    </article>`;
  }

  function bindImageFallbacks(root = document) {
    root.querySelectorAll("img[data-product-image]").forEach((image) => {
      if (image.dataset.fallbackBound) return;
      image.dataset.fallbackBound = "true";
      const fail = () => {
        const parent = image.parentElement;
        image.remove();
        if (parent && !parent.querySelector(".offer-fallback")) {
          const fallback = document.createElement("span");
          fallback.className = "offer-fallback";
          fallback.textContent = "Product";
          parent.appendChild(fallback);
        }
      };
      if (image.complete && image.naturalWidth === 0) fail();
      else image.addEventListener("error", fail, { once: true });
    });
  }

  function repairVisualContainers() {
    const selectors = [".article-product-image", ".page-hero-art", ".visual-card-media", ".product-image"];
    document.querySelectorAll(selectors.join(",")).forEach((container) => {
      const image = container.querySelector("img");
      if (image) {
        image.addEventListener("error", () => addVisualFallback(container), { once: true });
        if (image.complete && image.naturalWidth === 0) addVisualFallback(container);
      } else if (!clean(container.textContent)) {
        addVisualFallback(container);
      }
    });
  }

  function addVisualFallback(container) {
    if (container.querySelector(".visual-fallback")) return;
    container.querySelector("img")?.remove();
    const fallback = document.createElement("div");
    fallback.className = "visual-fallback";
    fallback.innerHTML = `<span>↗</span><strong>Product guide</strong><small>Image will appear when a verified product visual is available.</small>`;
    container.appendChild(fallback);
  }

  /* ----------------------------------------------------------------------- */
  /* Existing product grids                                                   */
  /* ----------------------------------------------------------------------- */

  function splitDataset(value) {
    return clean(value).split("|").map(lower).filter(Boolean);
  }

  function passesDataset(offer, element) {
    const hay = lower([offer.name, offer.description, offer.category, offer.brand].join(" "));
    const source = lower(element.dataset.advertiser);
    const any = splitDataset(element.dataset.requiredAny);
    const all = splitDataset(element.dataset.requiredAll);
    const excluded = splitDataset(element.dataset.exclude);
    const min = Number(element.dataset.minScore || 75);
    if (source && lower(offer.advertiser) !== source) return false;
    if (any.length && !any.some((term) => hay.includes(term))) return false;
    if (all.length && !all.every((term) => hay.includes(term))) return false;
    if (excluded.some((term) => hay.includes(term))) return false;
    if ((Number(offer.matchScore || offer.quality) || 0) < min) return false;
    return true;
  }

  function renderOffers() {
    const offers = fallbackOffers();
    document.querySelectorAll("[data-product-grid]").forEach((element) => {
      const limit = Math.max(1, Math.min(12, Number(element.dataset.limit) || 4));
      const placement = clean(element.dataset.placement || "product-options");
      const compare = element.dataset.compareEnabled === "true";
      const rows = offers
        .filter((offer) => passesDataset(offer, element))
        .sort((a, b) => b.quality - a.quality)
        .slice(0, limit);
      element.innerHTML = rows.length
        ? rows.map((offer) => card(offer, placement, compare)).join("")
        : `<div class="offer-empty compact-empty"><strong>No close product match is available right now.</strong><span>Use the product finder to search the wider catalogue.</span><a class="button button-secondary" href="/find/">Search products</a></div>`;
      bindImageFallbacks(element);
    });
  }

  /* ----------------------------------------------------------------------- */
  /* Product finder                                                           */
  /* ----------------------------------------------------------------------- */

  function guideMarkup(guides) {
    if (!guides.length) return "";
    return `<section class="finder-group">
      <div class="finder-group-head"><div><h2>Helpful guides</h2><span>Use these when you are still deciding what fits.</span></div></div>
      <div class="finder-guide-grid">${guides.map((guide) => `<article class="finder-guide">
        <small>${esc(guide.type)} · ${esc(guide.category)}</small>
        <h3>${esc(guide.title)}</h3>
        <p>${esc(guide.description)}</p>
        <a href="${esc(guide.url)}">Open guide →</a>
      </article>`).join("")}</div>
    </section>`;
  }

  function productMarkup(products, heading = "Current product options") {
    if (!products.length) return "";
    return `<section class="finder-group finder-products-group">
      <div class="finder-group-head"><div><h2>${esc(heading)}</h2><span>Select two or three products of the same type to compare.</span></div></div>
      <div class="offer-grid finder-offers">${products.map((offer) => card(offer, "product-finder", true)).join("")}</div>
    </section>`;
  }

  function starterMarkup(manifest) {
    const groups = (manifest.groups || []).filter((group) => group.id !== "other").slice(0, 8);
    const featured = (manifest.featured || []).map(normalizeOffer).slice(0, 6);
    return `<div class="finder-starter">
      <section class="starter-panel">
        <div class="finder-starter-copy"><div><h2>Popular ways to start</h2><p>Choose a category or describe the problem you want to solve.</p></div></div>
        <div class="finder-category-grid">${groups.map((group) => `<button class="finder-category-button" type="button" data-starter-query="${esc(group.aliases?.[0] || group.label)}"><span><strong>${esc(group.label)}</strong><small>${Number(group.count || 0).toLocaleString()} current options</small></span><span>→</span></button>`).join("")}</div>
      </section>
      ${featured.length ? productMarkup(featured, "Fresh catalogue picks") : ""}
    </div>`;
  }

  function setFinderLoading(status, box, query) {
    status.innerHTML = `<strong>Searching for “${esc(query)}”</strong><span>Checking the closest product categories and current listings…</span>`;
    box.innerHTML = `<div class="finder-loading" aria-label="Loading results"><span></span><span></span><span></span></div>`;
  }

  async function renderFinder(query) {
    const box = document.querySelector("[data-finder-results]");
    const status = document.querySelector("[data-finder-status]");
    if (!box || !status) return;
    const currentSerial = ++catalogueState.searchSerial;
    const value = clean(query);

    if (!value) {
      const manifest = await loadManifest();
      if (currentSerial !== catalogueState.searchSerial) return;
      status.innerHTML = `<strong>Start with a product or problem.</strong><span>Search the catalogue or choose a popular category below.</span>`;
      box.innerHTML = starterMarkup(manifest);
      bindStarterButtons();
      bindImageFallbacks(box);
      return;
    }

    setFinderLoading(status, box, value);
    const guideRows = (window.TRENDPILOT_SEARCH_INDEX || [])
      .map((guide) => ({ ...guide, __score: guideScore(guide, value) }))
      .filter((guide) => guide.__score > 0)
      .sort((a, b) => b.__score - a.__score)
      .slice(0, 6);
    const products = await searchCatalogue(value);
    if (currentSerial !== catalogueState.searchSerial) return;

    catalogueState.lastResults = products;
    catalogueState.lastQuery = value;
    status.innerHTML = `<strong>Results for “${esc(value)}”</strong><span>${guideRows.length} guide${guideRows.length === 1 ? "" : "s"} and ${products.length} relevant product option${products.length === 1 ? "" : "s"} found.</span>`;

    if (!guideRows.length && !products.length) {
      box.innerHTML = `<div class="finder-no-results">
        <div><h2>No close catalogue match yet</h2><p>Try a shorter name, a product type such as “running shoes”, or the exact model number. We will not fill the page with unrelated products.</p></div>
        <div class="no-results-actions"><button class="button button-secondary" type="button" data-reset-search>Clear search</button><a class="button button-brand" href="/contact.html">Request this comparison</a></div>
      </div>`;
      box.querySelector("[data-reset-search]")?.addEventListener("click", () => {
        const input = document.querySelector("[data-finder-form] input[name=q]");
        if (input) input.value = "";
        history.replaceState(null, "", location.pathname);
        renderFinder("");
      });
      return;
    }

    box.innerHTML = guideMarkup(guideRows) + productMarkup(products);
    bindImageFallbacks(box);
    updateCompareUI();
  }

  function bindStarterButtons() {
    document.querySelectorAll("[data-starter-query]").forEach((button) => {
      button.addEventListener("click", () => {
        const input = document.querySelector("[data-finder-form] input[name=q]");
        if (!input) return;
        input.value = button.dataset.starterQuery || "";
        input.form?.requestSubmit();
      });
    });
  }

  function initFinder() {
    const form = document.querySelector("[data-finder-form]");
    if (!form) return;
    const input = form.querySelector("input[name=q]");
    const params = new URLSearchParams(location.search);
    input.value = params.get("q") || "";
    renderFinder(input.value);

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const query = clean(input.value);
      history.replaceState(null, "", query ? `?q=${encodeURIComponent(query)}` : location.pathname);
      renderFinder(query);
    });

    document.querySelectorAll("[data-query]").forEach((button) => {
      button.addEventListener("click", () => {
        input.value = button.dataset.query || "";
        form.requestSubmit();
      });
    });
  }

  /* ----------------------------------------------------------------------- */
  /* Comparison                                                               */
  /* ----------------------------------------------------------------------- */

  function tokenSimilarity(a, b) {
    const left = new Set(words(`${a.name} ${a.brand || ""}`));
    const right = new Set(words(`${b.name} ${b.brand || ""}`));
    if (!left.size || !right.size) return 0;
    let overlap = 0;
    left.forEach((token) => {
      if (right.has(token)) overlap += 1;
    });
    return overlap / Math.min(left.size, right.size);
  }

  function productsCompatible(a, b) {
    if (!a || !b) return true;
    if (a.family && b.family && a.family === b.family) return true;
    if (a.group && b.group && a.group === b.group) {
      const genericFamily = (family) => !family || family === a.group || family.startsWith(`${a.group}:`);
      if (genericFamily(a.family) || genericFamily(b.family)) return true;
      return tokenSimilarity(a, b) >= 0.16;
    }
    return false;
  }

  function isCompatibleWithSelection(offer) {
    if (!selected.size) return true;
    return [...selected.values()].every((current) => productsCompatible(current, offer));
  }

  function offerByKey(key) {
    const pools = [catalogueState.lastResults, catalogueState.loadedProducts, fallbackOffers()];
    for (const pool of pools) {
      const found = pool.find((offer) => productKey(offer) === key);
      if (found) return normalizeOffer(found);
    }
    return null;
  }

  function toggleCompare(key) {
    const offer = offerByKey(key);
    if (!offer) return;
    if (selected.has(key)) {
      selected.delete(key);
    } else {
      if (selected.size >= 3) {
        showToast("You can compare up to three products. Remove one first.");
        return;
      }
      if (!isCompatibleWithSelection(offer)) {
        showToast("Choose products of the same type for a useful comparison.");
        return;
      }
      selected.set(key, offer);
    }
    updateCompareUI();
  }

  function compatibleSuggestions() {
    if (!selected.size || selected.size >= 3) return [];
    const first = [...selected.values()][0];
    const selectedKeys = new Set(selected.keys());
    return catalogueState.loadedProducts
      .map(normalizeOffer)
      .filter((offer) => !selectedKeys.has(productKey(offer)) && productsCompatible(first, offer))
      .sort((a, b) => b.quality - a.quality)
      .slice(0, 6);
  }

  function renderCompatibleSuggestions() {
    document.querySelector("[data-compatible-suggestions]")?.remove();
    if (!selected.size || selected.size >= 3) return;
    const suggestions = compatibleSuggestions();
    if (!suggestions.length) return;
    const host = document.querySelector("[data-finder-results]");
    if (!host) return;
    const section = document.createElement("section");
    section.className = "finder-group compatible-suggestions";
    section.setAttribute("data-compatible-suggestions", "");
    section.innerHTML = `<div class="finder-group-head"><div><h2>Add another similar option</h2><span>These products match the type you already selected.</span></div></div><div class="offer-grid finder-offers">${suggestions.map((offer) => card(offer, "compatible-suggestions", true)).join("")}</div>`;
    host.appendChild(section);
    bindImageFallbacks(section);
  }

  function updateCompareUI() {
    document.querySelectorAll("[data-compare-key]").forEach((button) => {
      const key = button.dataset.compareKey;
      const offer = offerByKey(key);
      const active = selected.has(key);
      const compatible = active || !offer || isCompatibleWithSelection(offer);
      button.setAttribute("aria-pressed", String(active));
      button.disabled = !compatible;
      button.textContent = active ? "Selected" : compatible ? "Add to compare" : "Different product type";
    });

    const drawer = document.querySelector("[data-compare-drawer]");
    if (!drawer) return;
    drawer.classList.toggle("open", selected.size > 0);
    drawer.querySelector("[data-compare-count]").textContent = `${selected.size} of 3`;
    drawer.querySelector("[data-compare-selected]").innerHTML = [...selected.values()].map((offer) => `<div class="compare-chip">
      <div>${imageMarkup(offer)}</div>
      <span><strong>${esc(offer.name)}</strong><small>${esc(price(offer))}</small></span>
      <button type="button" aria-label="Remove ${esc(offer.name)}" data-remove-compare="${esc(productKey(offer))}">×</button>
    </div>`).join("");
    drawer.querySelector("[data-compare-open]").disabled = selected.size < 2;
    const hint = drawer.querySelector("[data-compare-hint]") || document.createElement("p");
    hint.setAttribute("data-compare-hint", "");
    hint.className = "compare-hint";
    hint.textContent = selected.size === 1
      ? "Choose one or two more products of the same type."
      : selected.size === 2
        ? "You can compare now or add one more similar product."
        : "Three similar products are ready to compare.";
    if (!hint.parentNode) drawer.insertBefore(hint, drawer.querySelector("[data-compare-open]"));
    renderCompatibleSuggestions();
  }

  function comparisonCard(offer, index) {
    return `<article class="comparison-product-card">
      <div class="comparison-product-image">${imageMarkup(offer)}</div>
      <span class="comparison-number">Option ${index + 1}</span>
      <h3>${esc(offer.name)}</h3>
      <dl>
        <div><dt>Current price</dt><dd>${esc(price(offer))}</dd></div>
        <div><dt>Seller</dt><dd>${esc(offer.advertiser)}</dd></div>
        <div><dt>Product type</dt><dd>${esc(humanGroup(offer.family || offer.group))}</dd></div>
      </dl>
      <p>${esc(clean(offer.description).slice(0, 170) || "Open the product page to confirm the exact model, included items, delivery and return terms.")}</p>
      <a class="button button-brand button-wide" href="${esc(offer.url)}" target="_blank" rel="sponsored nofollow noopener">Check product details ↗</a>
    </article>`;
  }

  function humanGroup(value) {
    return clean(value).replace(/^[^:]+:/, "").replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function openComparison() {
    const dialog = document.querySelector("[data-compare-dialog]");
    const box = document.querySelector("[data-compare-table]");
    if (!dialog || !box || selected.size < 2) return;
    const rows = [...selected.values()];
    box.innerHTML = `<div class="comparison-dialog-head"><span>Side-by-side check</span><h2>Compare selected products</h2><p>Use this as a shortlist. Confirm the exact model, delivery and return terms on the seller page before paying.</p></div><div class="comparison-card-grid">${rows.map(comparisonCard).join("")}</div>`;
    bindImageFallbacks(box);
    dialog.showModal();
  }

  function initCompare() {
    document.addEventListener("click", (event) => {
      const compareButton = event.target.closest("[data-compare-key]");
      if (compareButton) {
        event.preventDefault();
        toggleCompare(compareButton.dataset.compareKey);
        return;
      }
      const removeButton = event.target.closest("[data-remove-compare]");
      if (removeButton) {
        selected.delete(removeButton.dataset.removeCompare);
        updateCompareUI();
      }
    });
    document.querySelector("[data-compare-clear]")?.addEventListener("click", () => {
      selected.clear();
      updateCompareUI();
    });
    document.querySelector("[data-compare-open]")?.addEventListener("click", openComparison);
    document.querySelector("[data-compare-close]")?.addEventListener("click", () => document.querySelector("[data-compare-dialog]")?.close());
    document.querySelector("[data-compare-dialog]")?.addEventListener("click", (event) => {
      if (event.target === event.currentTarget) event.currentTarget.close();
    });
  }

  /* ----------------------------------------------------------------------- */
  /* Links, analytics and small page fixes                                    */
  /* ----------------------------------------------------------------------- */

  function bindAffiliateKeys() {
    const links = window.TRENDPILOT_LINKS || {};
    document.querySelectorAll("[data-affiliate-key]").forEach((anchor) => {
      const record = links[anchor.dataset.affiliateKey];
      if (!record) return;
      const affiliateUrl = clean(record.affiliateUrl);
      anchor.href = affiliateUrl || record.productUrl;
      anchor.target = "_blank";
      anchor.rel = "sponsored nofollow noopener";
      anchor.dataset.linkState = affiliateUrl ? "partner" : "official";
    });
    document.querySelectorAll("[data-pricing-key]").forEach((anchor) => {
      const record = links[anchor.dataset.pricingKey];
      if (!record) return;
      const affiliateUrl = clean(record.affiliateUrl);
      anchor.href = affiliateUrl || record.pricingUrl || record.productUrl;
      anchor.target = "_blank";
      anchor.rel = "sponsored nofollow noopener";
      anchor.dataset.linkState = affiliateUrl ? "partner" : "official";
    });
  }

  function initInlineSearch() {
    document.querySelectorAll(".mini-search").forEach((form) => {
      if (form.tagName !== "FORM") return;
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        const input = form.querySelector("input");
        const query = clean(input?.value);
        location.href = `/find/${query ? `?q=${encodeURIComponent(query)}` : ""}`;
      });
    });
  }

  function initAnalytics() {
    if (!/^G-[A-Z0-9]+$/i.test(clean(cfg.ga4Id))) return;
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function gtag() { window.dataLayer.push(arguments); };
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(cfg.ga4Id)}`;
    document.head.appendChild(script);
    window.gtag("js", new Date());
    window.gtag("config", cfg.ga4Id, { anonymize_ip: true });
  }

  function track(anchor) {
    const data = {
      event: "outbound_product_click",
      page_path: location.pathname,
      advertiser: clean(anchor.dataset.advertiser || "Unknown"),
      product_name: clean(anchor.dataset.productName || anchor.textContent),
      placement: clean(anchor.dataset.placement || "unspecified"),
      destination_host: (() => {
        try { return new URL(anchor.href).hostname; } catch { return ""; }
      })(),
    };
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(data);
    if (typeof window.gtag === "function") window.gtag("event", "outbound_product_click", data);
    if (validUrl(cfg.clickEndpoint) && navigator.sendBeacon) {
      try {
        navigator.sendBeacon(cfg.clickEndpoint, new Blob([JSON.stringify(data)], { type: "application/json" }));
      } catch {}
    }
  }

  function initTracking() {
    document.addEventListener("click", (event) => {
      const anchor = event.target.closest("a[data-affiliate-outbound], a[rel~='sponsored']");
      if (anchor) track(anchor);
    }, { capture: true });
  }

  function showToast(message) {
    let toast = document.querySelector("[data-site-toast]");
    if (!toast) {
      toast = document.createElement("div");
      toast.className = "site-toast v8-toast";
      toast.setAttribute("data-site-toast", "");
      toast.setAttribute("role", "status");
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add("show");
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 2600);
  }

  function simplifyBuyerLanguage() {
    const replacements = new Map([
      ["Affiliate disclosure", "How links work"],
      ["affiliate disclosure", "how links work"],
      ["approved affiliate route", "current product page"],
      ["affiliate route", "product link"],
      ["affiliate feed", "product catalogue"],
      ["affiliate catalogue", "product catalogue"],
      ["affiliate links", "shopping links"],
    ]);
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (node.parentElement?.closest("script, style, code, pre")) return NodeFilter.FILTER_REJECT;
        if (location.pathname.includes("affiliate-disclosure")) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => {
      let value = node.nodeValue;
      replacements.forEach((to, from) => { value = value.split(from).join(to); });
      node.nodeValue = value;
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    initMenu();
    initAnalytics();
    bindAffiliateKeys();
    renderOffers();
    initFinder();
    initCompare();
    initInlineSearch();
    initTracking();
    bindImageFallbacks();
    repairVisualContainers();
    simplifyBuyerLanguage();
    document.querySelectorAll("[data-year], #currentYear").forEach((element) => {
      element.textContent = String(new Date().getFullYear());
    });
  });
})();
