(() => {
  "use strict";

  const doc = document;
  const $ = (selector, root = doc) => root.querySelector(selector);
  const $$ = (selector, root = doc) => Array.from(root.querySelectorAll(selector));
  const clean = (value) => String(value ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  const lower = (value) => clean(value).toLowerCase();
  const esc = (value) => clean(value).replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char]));
  const debounce = (fn, wait = 70) => {
    let timer = 0;
    return (...args) => {
      clearTimeout(timer);
      timer = window.setTimeout(() => fn(...args), wait);
    };
  };

  const STOP_WORDS = new Set([
    "a", "an", "and", "are", "best", "buy", "for", "from", "in", "is", "me", "my", "of", "on", "or", "product", "products", "the", "to", "with", "want", "need", "looking", "find", "good", "new", "sale", "deal", "discount", "offer", "official", "current", "online", "shop", "store", "ww", "many", "geos"
  ]);
  const GENERIC_COUPON_WORDS = new Set([
    ...STOP_WORDS, "coupon", "code", "promo", "promotion", "save", "saving", "off", "orders", "above", "over", "free", "shipping", "delivery", "sitewide", "storewide", "homepage", "home", "page", "customer", "customers", "buyer", "buyers", "first", "exclusive", "clearance", "summer", "winter", "special", "all", "items", "category", "categories"
  ]);
  const PRODUCT_HINTS = [
    "air fryer", "iphone", "phone case", "scooter", "printer", "filament", "glasses", "eyeglasses", "frames", "laptop", "tablet", "monitor", "projector", "carplay", "pet feeder", "dog feeder", "cat feeder", "shoe", "shoes", "sneaker", "tool kit", "drill", "camera", "headphone", "earbud", "smart light", "led strip"
  ];

  const MERCHANT_ALIASES = [
    ["aliexpress", /ali\s*express|aliexpress/i],
    ["alibaba", /alibaba/i],
    ["joom", /\bjoom\b/i],
    ["wondershare", /wondershare|filmora|pdfelement|dr\.fone|recoverit|uniconverter/i],
    ["lenovo", /\blenovo\b/i],
    ["govee", /\bgovee\b/i],
    ["sunsky", /sunsky/i],
    ["geekbuying", /geek\s*buying|geekbuying/i],
    ["harfington", /harfington/i],
    ["glasseslit", /glasseslit/i],
    ["jetpac", /jetpac/i],
    ["ticombo", /ticombo/i],
    ["filamentpro", /filament\s*pro|filamentpro/i],
  ];

  const INTENTS = [
    {
      id: "carplay",
      match: /wireless\s*carplay|carplay\s*(adapter|dongle|converter)|make\s*carplay\s*wireless/i,
      include: /carplay/i,
      require: /(adapter|dongle|wireless|converter)/i,
      exclude: /(head unit|car radio|navigation screen|android radio|dash camera|rear camera)/i,
      title: "Check compatibility before price",
      intro: "Compare adapters only after confirming that wired CarPlay already works in the car.",
      checks: ["Wired CarPlay works", "USB-A or USB-C matches", "Firmware and returns are clear"],
    },
    {
      id: "pet-feeder",
      match: /(dog|cat|pet)\s*(feeding|feeder)|automatic\s*(feeding|feeder)|food\s*dispenser/i,
      include: /(pet|dog|cat).{0,20}(feeder|feeding|food dispenser|bowl)|automatic.{0,15}(feeder|food dispenser)|timed feeder|portion feeder/i,
      exclude: /(spoon|jar opener|can opener|lid|scoop|groom|toy|leash|collar|waste bag|poop)/i,
      title: "Choose the feeder by routine",
      intro: "Capacity, portion control, backup power and cleaning matter more than the number of buttons.",
      checks: ["Correct food type", "Enough capacity", "Easy cleaning and backup power"],
    },
    {
      id: "running-shoes",
      match: /running\s*(shoe|shoes|sneaker|sneakers)|trail\s*(shoe|shoes)/i,
      include: /(running|trail|jogging).{0,25}(shoe|shoes|sneaker|trainer)|(shoe|shoes|sneaker|trainer).{0,25}(running|trail|jogging)/i,
      exclude: /(keychain|doll|phone case|shoe rack|shoe cover)/i,
      title: "Match shoes to the route",
      intro: "Compare road, treadmill and trail models separately so the price difference means something.",
      checks: ["Right terrain", "Correct foot length", "Cushioning and return route"],
    },
    {
      id: "footwear",
      match: /shoe|shoes|sneaker|sneakers|trainer|trainers|footwear|boot|boots|sandal|sandals|slipper|slippers|loafer|loafers/i,
      include: /(shoe|shoes|sneaker|sneakers|trainer|trainers|footwear|boot|boots|sandal|sandals|slipper|slippers|loafer|loafers|heel|heels)/i,
      exclude: /(keychain|doll|phone case|shoe rack|shoe cover|miniature)/i,
      title: "Compare shoes made for the same use",
      intro: "Start with walking, running, work, casual or formal use, then compare fit and materials.",
      checks: ["Same intended use", "Seller size chart", "Delivered price and returns"],
    },
    {
      id: "laptop",
      match: /laptop|notebook\s*computer|portable\s*computer/i,
      include: /(laptop|notebook|thinkpad|ideapad|yoga|legion|chromebook)/i,
      exclude: /(case|sleeve|bag|charger only|keyboard cover|sticker|screen protector)/i,
      title: "Compare the exact laptop configuration",
      intro: "Processor, memory, storage, display and regional warranty must match before comparing price.",
      checks: ["Exact CPU and RAM", "Storage and display", "Keyboard, warranty and charger region"],
    },
    {
      id: "lighting",
      match: /smart\s*light|led\s*strip|room\s*lighting|rgb\s*light|outdoor\s*lights?/i,
      include: /(light|lighting|lamp|led|rgb|neon)/i,
      exclude: /(replacement cable|connector only|empty housing)/i,
      title: "Choose lighting by room and control method",
      intro: "Compare brightness, coverage, app support and installation—not colour effects alone.",
      checks: ["Indoor or outdoor rating", "Coverage and brightness", "App, voice and installation support"],
    },
    {
      id: "eyewear",
      match: /glasses|eyeglasses|spectacles|prescription\s*glasses|frames/i,
      include: /(glasses|eyeglasses|spectacles|frames|eyewear|sunglasses)/i,
      exclude: /(case only|cloth only|repair kit only)/i,
      title: "Check measurements before choosing frames",
      intro: "Frame width, bridge, lens size and prescription options are more useful than style alone.",
      checks: ["Correct frame measurements", "Lens and prescription options", "Return and remake policy"],
    },
    {
      id: "3d-printing",
      match: /3d\s*print|filament|pla\b|petg\b|abs\s*filament/i,
      include: /(filament|pla|petg|abs|3d print|3d printer)/i,
      exclude: /(pen refill unrelated|decorative model only)/i,
      title: "Match filament to the printer and job",
      intro: "Diameter, material, colour consistency and recommended temperatures must match your printer.",
      checks: ["Correct diameter", "Material suits the job", "Temperature and spool weight"],
    },
    {
      id: "tools",
      match: /hand\s*tool|power\s*tool|repair\s*tool|drill|screwdriver|socket\s*set|polishing\s*pad|crimping\s*tool/i,
      include: /(tool|drill|screwdriver|socket|wrench|plier|crimp|polish|repair|carving)/i,
      exclude: /(toy tool|keychain)/i,
      title: "Compare tools by task and specification",
      intro: "Size, material, compatible system and included pieces should match the repair job.",
      checks: ["Correct size and standard", "Material and included pieces", "Warranty and replacement route"],
    },
    {
      id: "esim",
      match: /e\s*sim|esim|travel\s*data|roaming\s*data/i,
      include: /(esim|e-sim|travel data|roaming|data pack)/i,
      title: "Compare travel data by destination",
      intro: "Coverage, usable data, validity and hotspot rules matter more than the headline discount.",
      checks: ["Destination is covered", "Enough data and validity", "Hotspot and top-up rules"],
    },
    {
      id: "video-editor",
      match: /filmora|capcut|video\s*editor|video\s*editing/i,
      include: /(filmora|capcut|video editor|video editing|wondershare)/i,
      title: "Test the same short project",
      intro: "Compare the workflow on your real device, including export quality, limits and renewal cost.",
      checks: ["Runs well on your device", "Required tools are included", "Export and renewal limits are clear"],
    },
    {
      id: "tickets",
      match: /concert\s*ticket|football\s*ticket|event\s*ticket|match\s*ticket|festival\s*ticket/i,
      include: /(ticket|concert|match|festival|event)/i,
      title: "Compare tickets for the exact event",
      intro: "Date, venue, seat details, delivery method and buyer protection must all match.",
      checks: ["Exact event and date", "Seat or section is clear", "Delivery and buyer protection"],
    },
  ];

  function merchantKey(value) {
    const text = lower(value).replace(/[_-]+/g, " ");
    const hit = MERCHANT_ALIASES.find(([, pattern]) => pattern.test(text));
    return hit ? hit[0] : text.replace(/\b(affiliate|program|programme|many geos|ww)\b/g, " ").replace(/\s+/g, " ").trim();
  }

  function userRegion() {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    const zones = {
      "Asia/Muscat": "OM", "Asia/Dubai": "AE", "Asia/Riyadh": "SA", "Asia/Qatar": "QA",
      "Asia/Kuwait": "KW", "Asia/Bahrain": "BH", "Europe/London": "GB"
    };
    if (zones[zone]) return zones[zone];
    const locales = [...(navigator.languages || []), navigator.language].filter(Boolean);
    for (const locale of locales) {
      const match = String(locale).match(/[-_]([A-Za-z]{2})\b/);
      if (match) return match[1].toUpperCase();
    }
    return "";
  }

  function wordList(value, generic = false) {
    const stop = generic ? GENERIC_COUPON_WORDS : STOP_WORDS;
    return lower(value)
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .split(/\s+/)
      .filter((word) => word.length > 2 && !stop.has(word));
  }

  function activeCoupons() {
    const root = window.TREND_PILOT_COUPONS || {};
    const rows = Array.isArray(root.coupons) ? root.coupons : [];
    const now = Date.now();
    const region = userRegion();
    return rows.filter((coupon) => {
      if (!coupon || coupon.status === "inactive") return false;
      const start = coupon.start_at ? Date.parse(coupon.start_at) : 0;
      const end = coupon.end_at ? Date.parse(coupon.end_at) : 0;
      if (Number.isFinite(start) && start > now) return false;
      if (Number.isFinite(end) && end > 0 && end < now) return false;
      const regions = Array.isArray(coupon.regions) ? coupon.regions.map((item) => String(item).toUpperCase()) : [];
      if (region && regions.length && !regions.includes(region)) return false;
      return true;
    });
  }

  function realCode(coupon) {
    const code = clean(coupon?.code);
    if (!code || /^(not required|no code|none|n\/a|не нужен)$/i.test(code)) return "";
    return code;
  }

  function couponLabel(coupon) {
    const discount = clean(coupon?.discount?.text);
    const title = clean(coupon?.title);
    const description = clean(coupon?.description);
    if (/free shipping|free delivery/i.test(`${title} ${description}`)) return "Free delivery";
    const explicit = title.match(/(?:\$|€|£)\s?\d+(?:\.\d+)?\s*off|\d+(?:\.\d+)?%\s*off|save\s*(?:\$|€|£)?\s?\d+(?:\.\d+)?/i);
    if (explicit) return clean(explicit[0]);
    if (/\b\d+\s+(?:items?|products?)\s+(?:for|at)\s+(?:\$|€|£)/i.test(title)) return "Special price";
    const meaningfulDiscount = discount && !/^(?:0|1)%$/.test(discount)
      && /(off|discount|save|saving|clearance|promo|code|coupon)/i.test(`${title} ${description}`);
    if (meaningfulDiscount) return /off/i.test(discount) ? discount : `${discount} off`;
    return realCode(coupon) ? "Promo code" : "Current deal";
  }

  function couponExpiry(coupon) {
    if (!coupon?.end_at) return "No published end date";
    const value = new Date(coupon.end_at);
    if (Number.isNaN(value.getTime())) return "Check current terms";
    return `Ends ${new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" }).format(value)}`;
  }

  function couponSpecificMismatch(coupon, productText) {
    const hay = lower(`${coupon.title || ""} ${coupon.description || ""}`);
    const product = lower(productText);
    const hints = PRODUCT_HINTS.filter((hint) => hay.includes(hint));
    return hints.length > 0 && !hints.some((hint) => product.includes(hint));
  }

  function couponScore(coupon, merchant, productText = "") {
    if (merchantKey(coupon.merchant_key || coupon.merchant_name) !== merchantKey(merchant)) return -Infinity;
    if (couponSpecificMismatch(coupon, productText)) return -Infinity;
    const couponWords = new Set(wordList(`${coupon.title || ""} ${coupon.description || ""}`, true));
    const productWords = new Set(wordList(productText));
    let overlap = 0;
    couponWords.forEach((word) => { if (productWords.has(word)) overlap += 1; });
    const broad = /(sitewide|storewide|home page|homepage|all products|all items|first order|new buyer|new customer|free shipping|free delivery|up to)/i.test(`${coupon.title || ""} ${coupon.description || ""}`);
    const specificWords = couponWords.size;
    if (productText && specificWords >= 3 && !broad && overlap === 0) return -Infinity;
    let score = Number(coupon.priority_score || 0) + Number(coupon.rating || 0) * 2;
    score += overlap * 18;
    if (broad) score += 10;
    if (realCode(coupon)) score += 8;
    if (coupon.exclusive) score += 5;
    return score;
  }

  function bestCoupon(merchant, productText = "") {
    return activeCoupons()
      .map((coupon) => ({ coupon, score: couponScore(coupon, merchant, productText) }))
      .filter((row) => Number.isFinite(row.score))
      .sort((a, b) => b.score - a.score)[0]?.coupon || null;
  }

  async function copyCode(code, button) {
    try {
      await navigator.clipboard.writeText(code);
    } catch (_) {
      const input = doc.createElement("textarea");
      input.value = code;
      input.style.position = "fixed";
      input.style.opacity = "0";
      doc.body.appendChild(input);
      input.select();
      doc.execCommand("copy");
      input.remove();
    }
    const original = button.textContent;
    button.textContent = "Copied";
    button.classList.add("is-copied");
    window.setTimeout(() => {
      button.textContent = original;
      button.classList.remove("is-copied");
    }, 1800);
  }

  function savingMarkup(coupon, compact = true) {
    const code = realCode(coupon);
    const title = clean(coupon.title).slice(0, compact ? 86 : 150);
    return `<aside class="v10-saving ${compact ? "is-compact" : ""}" data-v10-saving>
      <div class="v10-saving-copy">
        <span>${code ? "Coupon available" : "Deal available"}</span>
        <strong>${esc(couponLabel(coupon))}</strong>
        <small>${esc(title)} · ${esc(couponExpiry(coupon))}</small>
      </div>
      <div class="v10-saving-actions">
        ${code ? `<button type="button" data-v10-copy-code="${esc(code)}"><b>${esc(code)}</b><span>Copy</span></button>` : ""}
        ${coupon.url ? `<a href="${esc(coupon.url)}" target="_blank" rel="sponsored nofollow noopener">Check deal ↗</a>` : ""}
      </div>
    </aside>`;
  }

  function offerCardMerchant(card) {
    return clean($(".offer-source span", card)?.textContent || $("[data-advertiser]", card)?.dataset.advertiser || "");
  }

  function enhanceOfferCards(root = doc) {
    $$(".offer-card", root).forEach((card) => {
      const merchant = offerCardMerchant(card);
      const title = clean($("h3", card)?.textContent);
      if (!merchant || !title) return;
      const signature = `${merchantKey(merchant)}|${lower(title)}|${window.TREND_PILOT_COUPONS?.generated_at || ""}`;
      if (card.dataset.v10CouponSignature === signature) return;
      card.dataset.v10CouponSignature = signature;
      $("[data-v10-saving]", card)?.remove();
      const coupon = bestCoupon(merchant, title);
      if (!coupon) return;
      const body = $(".offer-body", card);
      const target = $(".button", body) || $(".offer-compare", body);
      if (!body || !target) return;
      target.insertAdjacentHTML("beforebegin", savingMarkup(coupon, true));
      card.classList.add("has-v10-saving");
    });
  }

  function comparisonMerchant(card) {
    const rows = $$("dl > div", card);
    const seller = rows.find((row) => /seller/i.test(clean($("dt", row)?.textContent)));
    return clean($("dd", seller)?.textContent);
  }

  function enhanceComparison(root = doc) {
    $$(".comparison-product-card", root).forEach((card) => {
      const merchant = comparisonMerchant(card);
      const title = clean($("h3", card)?.textContent);
      const signature = `${merchantKey(merchant)}|${lower(title)}|${window.TREND_PILOT_COUPONS?.generated_at || ""}`;
      if (card.dataset.v10CouponSignature === signature) return;
      card.dataset.v10CouponSignature = signature;
      $("[data-v10-saving]", card)?.remove();
      const coupon = bestCoupon(merchant, title);
      if (!coupon) return;
      const cta = $("a.button", card);
      if (cta) cta.insertAdjacentHTML("beforebegin", savingMarkup(coupon, false));
    });
  }

  function intentFor(query) {
    return INTENTS.find((intent) => intent.match.test(query)) || null;
  }

  function finderQuery() {
    return clean($("[data-finder-input]")?.value || new URLSearchParams(location.search).get("q") || "");
  }

  function cardSearchScore(card, query, intent) {
    const title = clean($("h3", card)?.textContent);
    const text = clean(card.textContent);
    if (intent?.exclude?.test(text)) return -1000;
    if (intent?.include && !intent.include.test(text)) return -500;
    if (intent?.require && !intent.require.test(text)) return -400;
    const queryWords = new Set(wordList(query));
    const titleWords = new Set(wordList(title));
    const textWords = new Set(wordList(text));
    let score = intent ? 45 : 0;
    queryWords.forEach((word) => {
      if (titleWords.has(word)) score += 20;
      else if (textWords.has(word)) score += 7;
    });
    if (title && lower(title).includes(lower(query))) score += 35;
    if (card.querySelector("[data-v10-saving]")) score += 3;
    return score;
  }

  function guideMarkup(intent, query) {
    const data = intent || {
      title: "Compare products that solve the same problem",
      intro: "Use the search as a shortlist, then compare the exact variant, total cost and return route.",
      checks: ["Same product purpose", "Required specifications", "Delivered price and returns"],
    };
    return `<section class="v10-decision-guide" data-v10-decision-guide data-query="${esc(query)}">
      <div><span>Quick decision guide</span><h2>${esc(data.title)}</h2><p>${esc(data.intro)}</p></div>
      <ol>${data.checks.map((item) => `<li><i aria-hidden="true">✓</i><span>${esc(item)}</span></li>`).join("")}</ol>
    </section>`;
  }

  function familyName(value) {
    return clean(value).replace(/^[^:]+:/, "").replace(/[-_]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function buildFamilySwitcher(group, cards) {
    $("[data-v10-family-switcher]", group)?.remove();
    const counts = new Map();
    cards.filter((card) => !card.dataset.v10BaseHidden).forEach((card) => {
      const family = card.dataset.productFamily || card.dataset.productGroup || "other";
      counts.set(family, (counts.get(family) || 0) + 1);
    });
    const families = [...counts.entries()].filter(([, count]) => count >= 2).sort((a, b) => b[1] - a[1]).slice(0, 5);
    if (families.length < 2) return;
    const head = $(".finder-group-head", group);
    if (!head) return;
    const switcher = doc.createElement("div");
    switcher.className = "v10-family-switcher";
    switcher.dataset.v10FamilySwitcher = "true";
    switcher.innerHTML = `<span>Compare by type:</span><button class="active" type="button" data-family="all">All relevant</button>${families.map(([family, count]) => `<button type="button" data-family="${esc(family)}">${esc(familyName(family))} <small>${count}</small></button>`).join("")}`;
    head.insertAdjacentElement("afterend", switcher);
    switcher.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-family]");
      if (!button) return;
      $$("button", switcher).forEach((item) => item.classList.toggle("active", item === button));
      const family = button.dataset.family;
      cards.forEach((card) => {
        const baseHidden = card.dataset.v10BaseHidden === "true";
        const cardFamily = card.dataset.productFamily || card.dataset.productGroup || "other";
        card.hidden = baseHidden || (family !== "all" && cardFamily !== family);
      });
    });
  }

  function enhanceFinder() {
    if (!location.pathname.includes("/find")) return;
    const results = $("[data-finder-results]");
    const group = $(".finder-products-group", results);
    const status = $("[data-finder-status]");
    const query = finderQuery();
    if (!results || !group || !query) return;
    const signature = `${lower(query)}|${$$('.offer-card', group).length}|${window.TREND_PILOT_COUPONS?.generated_at || ""}`;
    if (group.dataset.v10FinderSignature === signature) return;
    group.dataset.v10FinderSignature = signature;

    $("[data-v9-quick-guide]", results)?.remove();
    $("[data-v10-decision-guide]", results)?.remove();
    const intent = intentFor(query);
    group.insertAdjacentHTML("beforebegin", guideMarkup(intent, query));

    const cards = $$(".offer-card", group);
    const ranked = cards.map((card, index) => ({ card, index, score: cardSearchScore(card, query, intent) }));
    const strict = Boolean(intent);
    ranked.forEach(({ card, score }) => {
      const hidden = strict ? score < 0 : false;
      card.dataset.v10BaseHidden = String(hidden);
      card.hidden = hidden;
    });
    const visible = ranked.filter((row) => row.card.dataset.v10BaseHidden !== "true");
    visible.sort((a, b) => b.score - a.score || a.index - b.index).forEach(({ card }) => $(".finder-offers", group)?.appendChild(card));
    buildFamilySwitcher(group, cards);

    const line = $("span", status) || status;
    if (line) {
      const guideCount = $$(".finder-guide, .finder-guide-card", results).length;
      const deals = visible.filter(({ card }) => card.querySelector("[data-v10-saving]")).length;
      line.textContent = `${guideCount ? `${guideCount} detailed guide${guideCount === 1 ? "" : "s"}, ` : ""}1 quick guide and ${visible.length} close product option${visible.length === 1 ? "" : "s"}${deals ? ` · ${deals} with a current saving` : ""}.`;
    }

    let notice = $("[data-v10-low-results]", results);
    if (visible.length < 2) {
      if (!notice) {
        notice = doc.createElement("div");
        notice.className = "v10-low-results";
        notice.dataset.v10LowResults = "true";
        notice.innerHTML = `<strong>Not enough close options for a fair comparison yet.</strong><span>Try the exact model, use or product type. Unrelated listings stay hidden.</span>`;
        group.insertAdjacentElement("afterend", notice);
      }
    } else {
      notice?.remove();
    }
  }

  function enhanceDrawer() {
    const drawer = $("[data-compare-drawer]");
    if (!drawer) return;
    drawer.setAttribute("role", "region");
    drawer.setAttribute("aria-label", "Selected products for comparison");
    const toggle = $("[data-v9-drawer-toggle]", drawer);
    if (toggle) {
      toggle.textContent = drawer.classList.contains("is-minimized") ? "Show" : "Minimize";
      toggle.setAttribute("aria-label", "Minimize selected products");
    }
    const count = Number(clean($("[data-compare-count]", drawer)?.textContent).split(" ")[0]) || 0;
    doc.body.classList.toggle("v10-compare-open", drawer.classList.contains("open"));
    drawer.classList.toggle("v10-has-many", count >= 2);
  }

  function replaceBuyerCopy() {
    if (/affiliate-disclosure|terms|privacy/.test(location.pathname)) return;
    const main = $("main");
    if (!main || main.dataset.v10BuyerCopy === "true") return;
    main.dataset.v10BuyerCopy = "true";
    const replacements = [
      [/affiliate\s+route/gi, "approved product link"],
      [/affiliate\s+link/gi, "product link"],
      [/affiliate\s+offer/gi, "current offer"],
      [/affiliate\s+products?/gi, "current products"],
    ];
    const walker = doc.createTreeWalker(main, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => {
      if (node.parentElement?.closest("script,style,code,pre")) return;
      let value = node.nodeValue;
      replacements.forEach(([pattern, text]) => { value = value.replace(pattern, text); });
      node.nodeValue = value;
    });
  }

  function ensureDealsNavigation() {
    const nav = $(".primary-nav");
    if (nav && !$("a[href='/deals/']", nav)) {
      const action = $(".nav-action", nav);
      const link = doc.createElement("a");
      link.href = "/deals/";
      link.textContent = "Deals";
      if (location.pathname.startsWith("/deals")) {
        link.className = "active";
        link.setAttribute("aria-current", "page");
      }
      nav.insertBefore(link, action || null);
    }
  }

  function uniqueDeals() {
    const seen = new Set();
    return activeCoupons()
      .sort((a, b) => Number(b.priority_score || 0) - Number(a.priority_score || 0))
      .filter((coupon) => {
        const key = `${merchantKey(coupon.merchant_key || coupon.merchant_name)}|${realCode(coupon) || lower(coupon.title)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }

  function dealCardMarkup(coupon) {
    const code = realCode(coupon);
    const merchant = clean(coupon.merchant_name || coupon.merchant_key);
    return `<article class="v10-deal-card" data-merchant="${esc(merchantKey(merchant))}" data-search="${esc(lower(`${merchant} ${coupon.title || ""} ${coupon.description || ""} ${(coupon.categories || []).join(" ")}`))}">
      <div class="v10-deal-head"><span>${esc(merchant)}</span><b>${esc(couponLabel(coupon))}</b></div>
      <h2>${esc(clean(coupon.title).slice(0, 130))}</h2>
      <p>${esc(clean(coupon.description).slice(0, 190) || "Open the current offer to confirm the applicable products and final terms.")}</p>
      <div class="v10-deal-meta"><span>${esc(couponExpiry(coupon))}</span>${coupon.minimum_order?.value ? `<span>Minimum ${esc(`${coupon.minimum_order.currency || ""} ${coupon.minimum_order.value}`)}</span>` : ""}</div>
      <div class="v10-deal-actions">
        ${code ? `<button type="button" data-v10-copy-code="${esc(code)}"><span>${esc(code)}</span><b>Copy code</b></button>` : `<span class="v10-auto-deal">No code needed</span>`}
        ${coupon.url ? `<a class="button button-brand" href="${esc(coupon.url)}" target="_blank" rel="sponsored nofollow noopener">Open deal ↗</a>` : ""}
      </div>
    </article>`;
  }

  function renderDealsPage() {
    const host = $("[data-v10-deals]");
    if (!host || host.dataset.v10DealsReady === "true") return;
    host.dataset.v10DealsReady = "true";
    const deals = uniqueDeals();
    const merchantSelect = $("[data-v10-deal-merchant]");
    const search = $("[data-v10-deal-search]");
    const status = $("[data-v10-deal-status]");
    const merchants = [...new Map(deals.map((coupon) => [merchantKey(coupon.merchant_key || coupon.merchant_name), clean(coupon.merchant_name || coupon.merchant_key)])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
    if (merchantSelect && merchantSelect.options.length <= 1) {
      merchants.forEach(([key, name]) => merchantSelect.add(new Option(name, key)));
    }
    const draw = () => {
      const merchant = merchantSelect?.value || "";
      const term = lower(search?.value || "");
      const rows = deals.filter((coupon) => {
        const key = merchantKey(coupon.merchant_key || coupon.merchant_name);
        const text = lower(`${coupon.merchant_name || ""} ${coupon.title || ""} ${coupon.description || ""} ${(coupon.categories || []).join(" ")}`);
        return (!merchant || merchant === key) && (!term || text.includes(term));
      }).slice(0, 60);
      host.innerHTML = rows.length ? rows.map(dealCardMarkup).join("") : `<div class="v10-deals-empty"><h2>No matching live saving</h2><p>Try another merchant or a shorter search.</p></div>`;
      if (status) status.textContent = `${rows.length} current saving${rows.length === 1 ? "" : "s"} shown · checked ${new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" }).format(new Date(window.TREND_PILOT_COUPONS?.generated_at || Date.now()))}`;
    };
    merchantSelect?.addEventListener("change", draw);
    search?.addEventListener("input", debounce(draw, 120));
    draw();
  }

  function renderHomeDeals() {
    if (location.pathname !== "/" && location.pathname !== "/index.html") return;
    if ($("[data-v10-home-deals]")) return;
    const main = $("main");
    const rows = uniqueDeals();
    const distinct = [];
    const merchants = new Set();
    for (const coupon of rows) {
      const key = merchantKey(coupon.merchant_key || coupon.merchant_name);
      if (merchants.has(key)) continue;
      merchants.add(key);
      distinct.push(coupon);
      if (distinct.length >= 4) break;
    }
    if (!main || !distinct.length) return;
    const section = doc.createElement("section");
    section.className = "section v10-home-deals";
    section.dataset.v10HomeDeals = "true";
    section.innerHTML = `<div class="shell"><div class="section-head"><div><span class="kicker">Current savings</span><h2>Check the saving before you choose.</h2></div><p>Coupons and deals are matched to the relevant merchant. Product, country and minimum-order terms still apply.</p></div><div class="v10-home-deal-grid">${distinct.map((coupon) => `<a href="${esc(coupon.url)}" target="_blank" rel="sponsored nofollow noopener"><span>${esc(clean(coupon.merchant_name || coupon.merchant_key))}</span><strong>${esc(couponLabel(coupon))}</strong><small>${esc(clean(coupon.title).slice(0, 82))}</small><b>Check deal →</b></a>`).join("")}</div><div class="section-cta"><a class="button button-secondary" href="/deals/">See all current deals</a></div></div>`;
    const business = $(".business-callout", main)?.closest("section");
    if (business) main.insertBefore(section, business);
    else main.appendChild(section);
  }

  function bindActions() {
    doc.addEventListener("click", (event) => {
      const copy = event.target.closest("[data-v10-copy-code]");
      if (copy) {
        event.preventDefault();
        copyCode(copy.dataset.v10CopyCode || "", copy);
      }
    });
  }

  const refresh = debounce(() => {
    ensureDealsNavigation();
    replaceBuyerCopy();
    enhanceOfferCards();
    enhanceComparison();
    enhanceDrawer();
    enhanceFinder();
    renderDealsPage();
    renderHomeDeals();
  }, 60);

  function boot() {
    bindActions();
    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
    addEventListener("popstate", refresh);
    addEventListener("resize", debounce(enhanceDrawer, 100), { passive: true });
  }

  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
