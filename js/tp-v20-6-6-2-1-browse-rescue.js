(() => {
  "use strict";

  const VERSION = "20.7.5";
  const params = () => new URLSearchParams(location.search);
  const active = () => params().get("engine") === "v2064" && !params().get("tpid");
  const $ = (s, r = document) => r.querySelector(s);
  const clean = v => String(v ?? "").replace(/\s+/g, " ").trim();
  const lower = v => clean(v).toLowerCase();
  const esc = v => clean(v).replace(/[&<>'"]/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;","'":"&#039;",'"':"&quot;"
  }[c]));
  const validUrl = v => /^https?:\/\//i.test(clean(v));

  const store = new Map();
  let rendering = false;
  let observer = null;

  const TYPE_RULES = [
    ["dog_food", /\b(dog food|dog treats?|puppy food|canine food)\b/i],
    ["air_conditioner", /\b(air conditioners?|air conditioner|portable ac|mini split|ductless ac|\bac\b)\b/i],
    ["3d_filament", /\b(3d filament|filament|pla filament|petg filament|abs filament)\b/i],
    ["power_bank", /\b(power banks?|powerbank|portable chargers?|battery pack)\b/i],
    ["smartwatch", /\b(smart ?watch|apple watch|wearable watch)\b/i],
    ["headphones", /\b(headphones?|headsets?|earbuds?|earphones?|tws|airpods?|soundcore|jlab)\b/i],
    ["perfume", /\b(perfumes?|fragrances?|cologne|eau de parfum|eau de toilette|edp|edt)\b/i],
    ["laptop", /\b(laptops?|notebooks?|thinkpad|ideapad|thinkbook|chromebook|macbook|legion|vivobook|yoga|lenovo slim)\b/i],
    ["phone", /\b(phones?|smartphones?|iphone|oneplus|xiaomi|redmi|galaxy|samsung|pixel|motorola|moto|oppo|vivo|realme|poco|honor|huawei|nokia|sony|zte)\b/i],
    ["cookware", /\b(cookware|pots?|pans?|frying pan|saucepan|casserole)\b/i],
    ["lighting", /\b(lighting|lights?|led|lamp|bulb|light strip)\b/i],
    ["tools", /\b(tools?|drill|saw|multimeter|oscilloscope|workshop|screwdriver|wrench)\b/i],
  ];

  const PREFIX_TYPES = [
    ["perfume", /^(?:per|perf|perfu|perfum|perfume|perfumes|frag|fragr|fragra|fragranc|fragrance)$/i],
    ["laptop", /^(?:lap|lapt|lapto|laptop|laptops|note|noteb|notebo|noteboo|notebook)$/i],
    ["phone", /^(?:pho|phon|phone|phones|smartp|smartph|smartpho|smartphon|smartphone)$/i],
    ["smartwatch", /^(?:wat|watc|watch|smartw|smartwa|smartwat|smartwatc|smartwatch)$/i],
    ["headphones", /^(?:hea|head|headp|headph|headpho|headphon|headphone|headphones|earb|earbu|earbud|earbuds)$/i],
  ];

  const CANONICAL_QUERY = {
    phone: "phone",
    laptop: "laptop",
    perfume: "perfume",
    smartwatch: "smartwatch",
    headphones: "headphones",
    power_bank: "power bank",
    dog_food: "dog food",
    air_conditioner: "air conditioner",
    "3d_filament": "3d filament",
    cookware: "cookware",
    lighting: "lighting",
    tools: "tools",
  };

  function inferType(query) {
    const q = lower(query);
    for (const [type, re] of PREFIX_TYPES) {
      if (re.test(q)) return type;
    }
    for (const [type, re] of TYPE_RULES) {
      if (re.test(q)) return type;
    }
    return "";
  }

  function isPartialBroad(query, type) {
    const q = lower(query);
    return PREFIX_TYPES.some(([t, re]) => t === type && re.test(q));
  }

  function tokens(query) {
    return lower(query)
      .replace(/[^a-z0-9]+/g, " ")
      .split(/\s+/)
      .filter(x => x.length > 1 && !["for","the","and","with","from","best","buy"].includes(x));
  }

  function rowText(row) {
    return lower([
      row?.search,
      row?.brand,
      row?.name,
      ...(Array.isArray(row?.sellers) ? row.sellers : [])
    ].join(" "));
  }

  const PHONE_FALSE = /\b(?:phone\s+case|mobile\s+case|protective\s+case|cover\s+for|screen\s+protector|tempered\s+glass|sim\s*(?:card\s*)?tray|ssd\s+enclosure|m\.?2\s+enclosure|game\s*controller|gamepad|joystick|game\s+handle|trigger\s+for\s+pubg|phone\s+cooler|cooling\s+fan|phone\s+holder|phone\s+stand|phone\s+mount|tripod|selfie\s+stick|phone\s+strap|lanyard|wallet\s+case|replacement\s+(?:battery|screen|display|camera|housing|part)|battery\s+(?:for|compatible\s+with)|charging\s+port|flex\s+cable|digitizer|back\s+glass|motherboard|phone\s+accessor(?:y|ies))\b/i;
  const PHONE_POSITIVE = /\b(?:iphone\s*(?:[5-9x]|1[0-9])|galaxy\s+[a-zmfsz]?\s*\d+|pixel\s+\d+|oneplus(?:\s+\d+[a-z]?)?|xiaomi\s+(?:redmi\s+)?[a-z0-9]+|redmi\s+(?:note\s+)?[a-z0-9]+|poco\s+[a-z0-9]+|motorola\s+(?:moto\s+)?[a-z0-9]+|moto\s+[a-z0-9]+|oppo\s+[a-z0-9]+|vivo\s+[a-z0-9]+|realme\s+[a-z0-9]+|honor\s+[a-z0-9]+|huawei\s+(?:mate|p|nova)\s*\d+|nokia\s+[a-z0-9.]+|sony\s+xperia\s+[a-z0-9]+|zte\s+[a-z0-9]+|smartphones?|mobile\s+phone|cell\s+phone|android\s+phone|5g\s+phone)\b/i;

  const LAPTOP_FALSE = /\b(?:adhd|cleaning\s+planner|daily\s+planner|household\s+planner|notebook\s+planner|journal|sticker|laptop\s+(?:case|sleeve|bag|stand|dock|charger|adapter|skin)|docking\s+station|replacement\s+(?:battery|keyboard|screen|hinge)|keyboard\s+cover|screen\s+protector)\b/i;
  const LAPTOP_POSITIVE = /\b(?:laptop|chromebook|thinkpad|ideapad|thinkbook|macbook|vivobook|zenbook|probook|elitebook|latitude|inspiron|xps|legion|lenovo\s+slim|yoga\s+\d|surface\s+laptop|notebook\s+(?:pc|computer))\b/i;

  const PERFUME_FALSE = /\b(?:perfume\s+organizer|organizer|display\s+stand|storage\s+rack|bottle\s+holder|empty\s+perfume\s+bottle|atomizer\s+empty|hair\s+perfume|room\s+spray|car\s+perfume|diffuser)\b/i;
  const PERFUME_POSITIVE = /\b(?:perfume|fragrance|cologne|eau\s+de\s+parfum|eau\s+de\s+toilette|parfum|edp|edt)\b/i;

  const WATCH_FALSE = /\b(?:watch\s+(?:band|strap|case|cover|protector|charger|dock|stand)|replacement\s+(?:band|strap|screen))\b/i;
  const AUDIO_FALSE = /\b(?:headphone\s+case|earbuds?\s+case|replacement\s+(?:earpads?|ear\s*pads?|cable)|headphone\s+stand|headset\s+stand)\b/i;

  function roleAllowed(row, type) {
    const text = rowText(row);

    if (type === "phone") {
      if (PHONE_FALSE.test(text)) return false;
      return PHONE_POSITIVE.test(text) || /\b(?:apple|samsung|xiaomi|oneplus|google|motorola|oppo|vivo|realme|poco|honor|huawei|nokia|sony|zte)\b/i.test(text);
    }

    if (type === "laptop") {
      if (LAPTOP_FALSE.test(text)) return false;
      return LAPTOP_POSITIVE.test(text);
    }

    if (type === "perfume") {
      if (PERFUME_FALSE.test(text)) return false;
      return PERFUME_POSITIVE.test(text);
    }

    if (type === "smartwatch") return !WATCH_FALSE.test(text);
    if (type === "headphones") return !AUDIO_FALSE.test(text);

    return true;
  }

  function score(row, query, type) {
    const q = lower(query);
    const hay = rowText(row);

    if (!q || q === CANONICAL_QUERY[type] || isPartialBroad(q, type)) return 100;

    const ts = tokens(query);
    if (!ts.length) return 1;

    let n = 0;
    for (const t of ts) {
      if (hay.includes(t)) n += 1;
    }

    if (n === ts.length) return 200 + n;
    if (n) return 50 + n;
    return 0;
  }

  async function loadType(type) {
    if (store.has(type)) return store.get(type);
    const url = `/data/search-v20-6/comparison-v20-6-4/browse-lite/${encodeURIComponent(type)}.json?v=20.7.5`;
    const r = await fetch(url, {cache:"no-store", headers:{accept:"application/json"}});
    if (!r.ok) throw new Error(`browse-lite ${type}: ${r.status}`);
    const data = await r.json();
    if (!data || !Array.isArray(data.products)) throw new Error(`invalid browse-lite ${type}`);
    store.set(type, data);
    return data;
  }

  function money(row) {
    const p = Number(row.price);
    if (!(p > 0)) return "Check current price";
    const cur = clean(row.currency || "USD").toUpperCase();
    return `From ${cur === "USD" ? "US$" : cur + " "}${p.toLocaleString(undefined, {maximumFractionDigits:2})}`;
  }

  function exactUrl(row) {
    const u = new URL(location.href);
    u.searchParams.set("engine", "v2064");
    u.searchParams.set("q", clean(row.name));
    u.searchParams.set("tpid", clean(row.tpid));
    u.searchParams.set("ui", "2075");
    return u.pathname + "?" + u.searchParams.toString();
  }

  function humanName(row) {
    const raw = clean(row.name);
    if (raw && !/^TP[A-Z]{2,8}-[A-Z0-9]{8,}$/i.test(raw)) return raw;

    const s = clean(row.search).replace(/^TP[A-Z]{2,8}-[A-Z0-9]{8,}\s*/i, "");
    const brand = clean(row.brand);
    if (s) {
      const stripped = brand && s.toLowerCase().startsWith(brand.toLowerCase() + " ")
        ? s.slice(brand.length).trim()
        : s;
      if (stripped && lower(stripped) !== lower(brand)) return stripped;
    }
    return brand || "Product";
  }

  function card(row, type) {
    const title = humanName(row);
    const image = validUrl(row.image)
      ? `<img src="${esc(row.image)}" alt="" loading="lazy" referrerpolicy="no-referrer" style="display:block;width:100%;height:100%;max-height:150px;object-fit:contain">`
      : `<div style="display:grid;place-items:center;width:100%;height:100%;min-height:120px;font-weight:850;font-size:1.2rem;color:#3157e8">TP</div>`;

    const sellerCount = Number(row.sellerCount || 0);
    const variantCount = Number(row.variantCount || 0);
    const explanation = type === "phone"
      ? "Phone choice — compare model, storage, condition and seller offer."
      : type === "laptop"
        ? "Laptop choice — compare processor, RAM, storage, display and seller offer."
        : type === "perfume"
          ? "Fragrance choice — confirm size, concentration and seller details."
          : "Compare specifications, current price, stock and delivery.";

    return `<article data-v206621-card="${esc(row.tpid)}" data-v2075-type="${esc(type)}" style="display:grid;grid-template-columns:112px minmax(0,1fr);background:#fff;border:1px solid #e3e8f2;border-radius:22px;overflow:hidden;min-height:150px;box-shadow:0 10px 28px rgba(16,24,40,.06)">
      <div style="background:#f7f9fc;min-height:150px;padding:10px;display:grid;place-items:center">${image}</div>
      <div style="padding:13px;display:flex;flex-direction:column;justify-content:flex-start;gap:7px;min-width:0">
        ${row.brand ? `<div style="font-weight:850;color:#3157e8;font-size:.83rem">${esc(row.brand)}</div>` : ""}
        <h3 style="margin:0;font-size:1.04rem;line-height:1.28;letter-spacing:-.015em;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:3;overflow:hidden">${esc(title)}</h3>
        <strong style="font-size:1.05rem;line-height:1.25">${esc(money(row))}</strong>
        <div style="display:flex;gap:7px;flex-wrap:wrap;color:#667085;font-size:.78rem">
          <span>${sellerCount} seller${sellerCount === 1 ? "" : "s"}</span>
          <span>•</span>
          <span>${variantCount} variant${variantCount === 1 ? "" : "s"}</span>
        </div>
        <p style="margin:1px 0 2px;color:#667085;font-size:.76rem;line-height:1.4">${esc(explanation)}</p>
        <a class="tp-btn tp-btn-primary" href="${esc(exactUrl(row))}" style="display:inline-flex;align-items:center;justify-content:center;width:max-content;max-width:100%;min-height:42px;padding:0 14px;border-radius:13px;text-decoration:none;font-weight:850">View product</a>
      </div>
    </article>`;
  }

  function updateSellerFilter(rows) {
    const sel = $("[data-filter-merchant]");
    if (!sel) return;

    const current = clean(sel.value);
    const sellers = [...new Set(
      rows.flatMap(r => Array.isArray(r.sellers) ? r.sellers : [])
        .map(clean)
        .filter(Boolean)
    )].sort();

    sel.innerHTML = '<option value="">All sellers</option>' +
      sellers.map(s => `<option value="${esc(s)}">${esc(s)}</option>`).join("");

    if (sellers.includes(current)) sel.value = current;
  }

  function filtered(rows) {
    const seller = clean($("[data-filter-merchant]")?.value || "");
    const price = clean($("[data-filter-price]")?.value || "");
    const sort = clean($("[data-filter-sort]")?.value || "smart");
    let out = rows.slice();

    if (seller) {
      out = out.filter(r => Array.isArray(r.sellers) && r.sellers.includes(seller));
    }

    if (price) {
      out = out.filter(r => {
        const p = Number(r.price);
        if (!(p > 0)) return false;
        if (price === "0-10") return p < 10;
        if (price === "10-25") return p >= 10 && p < 25;
        if (price === "25-50") return p >= 25 && p < 50;
        if (price === "50-100") return p >= 50 && p < 100;
        if (price === "100+") return p >= 100;
        return true;
      });
    }

    if (sort === "price-low") out.sort((a,b) => (Number(a.price)||1e15) - (Number(b.price)||1e15));
    if (sort === "price-high") out.sort((a,b) => (Number(b.price)||-1) - (Number(a.price)||-1));
    if (sort === "smart") {
      out.sort((a,b) =>
        (b.__score||0) - (a.__score||0) ||
        Number(b.sellerCount||0) - Number(a.sellerCount||0) ||
        Number(b.variantCount||0) - Number(a.variantCount||0)
      );
    }

    return out;
  }

  function displayQuery(query, type) {
    if (isPartialBroad(query, type)) return CANONICAL_QUERY[type] || clean(query);
    return clean(query);
  }

  async function render(query, {replaceHistory=false} = {}) {
    if (!active() || rendering) return;

    const type = inferType(query);
    if (!type) return;

    rendering = true;
    try {
      const shownQuery = displayQuery(query, type);
      const data = await loadType(type);

      let rows = data.products
        .filter(row => roleAllowed(row, type))
        .map(row => ({...row, __score: score(row, shownQuery, type)}));

      const q = lower(shownQuery);
      const isBroad =
        q === CANONICAL_QUERY[type] ||
        q === type.replaceAll("_", " ") ||
        isPartialBroad(query, type) ||
        ["phone","phones","smartphone","smartphones","headphones","perfume","perfumes","laptop","laptops","tools","lighting","cookware","smartwatch","power bank","dog food","air conditioner","3d filament"].includes(q);

      const scored = rows.filter(r => isBroad || r.__score > 0);
      if (scored.length || !isBroad) rows = scored;

      updateSellerFilter(rows);
      rows = filtered(rows);

      const grid = $("[data-tp-product-grid]");
      const title = $("[data-tp-results-title]");
      const status = $("[data-tp-finder-status]");
      const count = $("[data-tp-results-count]");
      const tabs = $("[data-tp-result-tabs]");
      const more = $("[data-tp-load-more]");
      if (!grid) return;

      if (replaceHistory) {
        const u = new URL(location.href);
        u.searchParams.set("engine", "v2064");
        u.searchParams.set("q", shownQuery);
        u.searchParams.set("ui", "2075");
        u.searchParams.delete("tpid");
        history.replaceState(null, "", u.pathname + "?" + u.searchParams.toString());
      }

      grid.dataset.v206621Rescue = "1";
      grid.dataset.v2075Clean = "1";
      grid.innerHTML = rows.slice(0, 60).map(row => card(row, type)).join("") ||
        '<div class="tp-empty"><h3>No clean product choices found.</h3><p>Try another product model or category.</p></div>';

      if (title) title.textContent = `Choose a product to compare for “${shownQuery}”`;
      if (status) status.textContent = "Clean master products only. Accessories and unrelated listings are kept out of this view.";
      if (count) count.textContent = `${rows.length} master products`;
      if (tabs) tabs.innerHTML = "";
      if (more) more.hidden = true;

      const input = $("[data-tp-finder-input]");
      if (input) input.value = shownQuery;

      document.body.style.paddingBottom = "calc(108px + env(safe-area-inset-bottom, 0px))";

      window.__TP_V206621_LAST_RENDER__ = {
        version: VERSION,
        type,
        query: shownQuery,
        count: rows.length,
        cleanRoleGate: true
      };
    } catch (error) {
      console.error("[TrendPilot V20.7.5 browse]", error);
    } finally {
      rendering = false;
    }
  }

  function currentQuery() {
    return params().get("q") || clean($("[data-tp-finder-input]")?.value || "");
  }

  function boot() {
    if (!active()) return;

    const form = $("[data-tp-finder-form]");
    if (form) {
      document.addEventListener("submit", e => {
        if (!active() || e.target !== form) return;
        const q = clean($("[data-tp-finder-input]")?.value || "");
        const type = inferType(q);
        if (!type) return;

        e.preventDefault();
        e.stopImmediatePropagation();
        render(q, {replaceHistory:true});
      }, true);
    }

    document.addEventListener("change", e => {
      if (!active()) return;
      if (e.target.matches("[data-filter-merchant],[data-filter-price],[data-filter-sort]")) {
        render(currentQuery());
      }
    }, true);

    render(currentQuery());

    const grid = $("[data-tp-product-grid]");
    if (grid) {
      observer = new MutationObserver(() => {
        if (!active() || rendering) return;

        const text = lower(grid.textContent);
        const lost = grid.dataset.v2075Clean !== "1";
        const failed =
          text.includes("comparison package could not be loaded") ||
          text.includes("products could not be displayed");

        if ((lost || failed) && inferType(currentQuery())) {
          setTimeout(() => render(currentQuery()), 20);
        }
      });

      observer.observe(grid, {childList:true, subtree:true, characterData:true});
    }

    setTimeout(() => {
      if (active() && inferType(currentQuery())) render(currentQuery());
    }, 900);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, {once:true});
  } else {
    boot();
  }
})();