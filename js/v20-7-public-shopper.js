(() => {
  "use strict";

  const VERSION = "20.7.4";
  const PAGE = document.body?.dataset?.tpPage || "";
  const params = new URLSearchParams(location.search);
  const isLegacyFile = /\/find\/legacy\.html$/i.test(location.pathname);
  const clean = (v) => String(v ?? "").replace(/\s+/g, " ").trim();
  const lower = (v) => clean(v).toLowerCase();

  // Public V20 cutover. The synchronous <head> bootstrap owns the default engine.
  if (PAGE === "finder" && !isLegacyFile) {
    if ((params.get("engine") || "").toLowerCase() === "legacy") {
      const target = "/find/legacy.html" + (location.search || "?engine=legacy");
      location.replace(target);
      return;
    }
  }

  document.body.classList.add("v207-public");
  document.body.dataset.v20Public = "true";
  document.body.dataset.v20PublicRevision = VERSION;

  const currentPath = location.pathname.replace(/\/+$/, "") || "/";
  document.querySelectorAll(".tp-bottom-nav a").forEach((a) => {
    const p = new URL(a.href, location.href).pathname.replace(/\/+$/, "") || "/";
    if (p === currentPath || (currentPath.startsWith("/find") && p === "/find")) {
      a.classList.add("active");
      a.setAttribute("aria-current", "page");
    }
  });

  if (PAGE !== "finder") return;

  const FINDER_FORM = "[data-tp-finder-form]";
  const FINDER_INPUT = "[data-tp-finder-input]";
  const FINDER_SCOPE = "[data-tp-finder-scope]";
  const PRODUCT_GRID = "[data-tp-product-grid]";

  function finderUrl(query, scope = "") {
    const q = clean(query);
    const p = new URLSearchParams();
    p.set("q", q);
    if (clean(scope)) p.set("scope", clean(scope));
    p.set("engine", "v2064");
    p.set("ui", "2074");
    return `/find/?${p.toString()}`;
  }

  function freshSearch(query, scope = "") {
    const q = clean(query);
    if (!q) return;
    // Full navigation is intentional: it resets stale in-page TPID/browse state.
    location.assign(finderUrl(q, scope));
  }

  // Register this capture listener immediately. The older V20.6 browse rescue adds
  // its own submit listener later during DOMContentLoaded, so this gate wins first.
  document.addEventListener("submit", (event) => {
    const form = event.target?.closest?.(FINDER_FORM);
    if (!form || isLegacyFile) return;

    const input = form.querySelector(FINDER_INPUT);
    const scope = form.querySelector(FINDER_SCOPE)?.value || "";
    const q = clean(input?.value || scope);
    if (!q) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    freshSearch(q, scope);
  }, true);

  // Quick-search chips must also start a new query instead of reusing the previous
  // Phone result state.
  document.addEventListener("click", (event) => {
    const trigger = event.target?.closest?.("[data-search-suggestion]");
    if (!trigger || isLegacyFile) return;

    const q = clean(trigger.dataset.searchSuggestion);
    if (!q) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    freshSearch(q, trigger.dataset.searchScope || "");
  }, true);

  const style = document.createElement("style");
  style.id = "tp-v2074-result-style";
  style.textContent = `
    body.v207-public [data-v206621-card],
    body.v207-public [data-v2074-card="1"] {
      border: 1px solid #e3e8f2 !important;
      border-radius: 20px !important;
      box-shadow: 0 10px 28px rgba(16,24,40,.06) !important;
      background: #fff !important;
      overflow: hidden !important;
    }
    body.v207-public [data-v206621-card] {
      grid-template-columns: 112px minmax(0,1fr) !important;
      min-height: 0 !important;
    }
    body.v207-public [data-v206621-card] > div:first-child {
      min-height: 138px !important;
      padding: 10px !important;
      background: #f7f9fc !important;
    }
    body.v207-public [data-v206621-card] > div:nth-child(2) {
      padding: 13px !important;
      gap: 7px !important;
      justify-content: flex-start !important;
    }
    body.v207-public [data-v206621-card] h3 {
      margin: 0 !important;
      font-size: clamp(.98rem, 4.3vw, 1.14rem) !important;
      line-height: 1.3 !important;
      letter-spacing: -.015em !important;
      display: -webkit-box !important;
      -webkit-box-orient: vertical !important;
      -webkit-line-clamp: 3 !important;
      overflow: hidden !important;
    }
    body.v207-public [data-v206621-card] strong {
      font-size: 1.04rem !important;
      line-height: 1.2 !important;
    }
    body.v207-public [data-v206621-card] .tp-btn {
      width: 100% !important;
      max-width: none !important;
      min-height: 44px !important;
      border-radius: 13px !important;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      font-weight: 850 !important;
      text-decoration: none !important;
    }
    body.v207-public [data-v206621-card][hidden],
    body.v207-public [data-v2074-role-rejected="1"] {
      display: none !important;
    }
    .tp-v2074-explain {
      margin: 2px 0 0 !important;
      color: #667085 !important;
      font-size: .75rem !important;
      line-height: 1.42 !important;
    }
    @media (min-width: 720px) {
      body.v207-public [data-v206621-card] {
        grid-template-columns: 170px minmax(0,1fr) !important;
      }
      body.v207-public [data-v206621-card] > div:first-child {
        min-height: 190px !important;
        padding: 14px !important;
      }
      body.v207-public [data-v206621-card] > div:nth-child(2) {
        padding: 18px !important;
      }
    }
  `;
  if (!document.getElementById(style.id)) document.head.appendChild(style);

  const q = lower(new URLSearchParams(location.search).get("q"));
  const grid = document.querySelector(PRODUCT_GRID);
  const sellerSelect = document.querySelector("[data-filter-merchant]");
  const tabs = document.querySelector("[data-tp-result-tabs]");
  const resultsTitle = document.querySelector("[data-tp-results-title]");

  const sellerKey = "tp-v207-seller:" + q;
  let sellerApplying = false;

  function applyStoredSeller() {
    if (!sellerSelect || sellerApplying) return;
    const stored = sessionStorage.getItem(sellerKey);
    if (!stored || sellerSelect.value === stored) return;
    const exists = [...sellerSelect.options].some((o) => o.value === stored);
    if (!exists) return;

    sellerApplying = true;
    sellerSelect.value = stored;
    sellerSelect.dispatchEvent(new Event("change", { bubbles: true }));
    queueMicrotask(() => { sellerApplying = false; });
  }

  if (sellerSelect) {
    sellerSelect.addEventListener("change", () => {
      if (sellerApplying) return;
      if (sellerSelect.value) sessionStorage.setItem(sellerKey, sellerSelect.value);
      else sessionStorage.removeItem(sellerKey);
    });

    new MutationObserver(applyStoredSeller).observe(sellerSelect, {
      childList: true,
      subtree: true
    });
    setTimeout(applyStoredSeller, 250);
    setTimeout(applyStoredSeller, 900);
  }

  const PHONE_QUERIES = new Set([
    "phone", "phones", "smartphone", "smartphones", "mobile phone", "mobile phones"
  ]);

  function phoneNonMain(text) {
    const t = lower(text);
    if (!t) return false;

    const direct = [
      "phone case", "protective case", "phone cover", "screen protector",
      "tempered glass", "sim tray", "sim card tray", "ssd enclosure",
      "m.2 enclosure", "game controller", "gamepad", "joystick",
      "game handle", "phone holder", "phone mount", "phone stand",
      "phone strap", "lanyard", "back glass", "digitizer", "flex cable",
      "charging port", "wallet case", "phone accessory"
    ];
    if (direct.some((phrase) => t.includes(phrase))) return true;

    if (/\breplacement\s+(?:battery|screen|display|camera|housing|part)\b/i.test(t)) {
      return true;
    }

    // Replacement/fitment battery listings such as:
    // "battery lithium ion polymer bateria for iphone 5".
    if (/\b(?:battery|bateria)\b.{0,90}\b(?:for|compatible\s+with)\b.{0,50}\b(?:iphone|samsung|galaxy|pixel|xiaomi|redmi|oneplus|oppo|vivo|realme|motorola|huawei|honor|nokia|sony|zte|poco)\b/i.test(t)) {
      return true;
    }

    if (/\b(?:charger|charging\s+cable|usb\s+cable|data\s+cable)\s+(?:for|compatible\s+with)\b/i.test(t)) {
      return true;
    }

    return false;
  }

  const roleRules = {
    laptop: /\b(?:laptop\s+(?:case|sleeve|bag|stand|dock|charger|adapter)|docking\s+station|replacement\s+(?:battery|keyboard|screen|hinge)|keyboard\s+cover|screen\s+protector)\b/i,
    laptops: /\b(?:laptop\s+(?:case|sleeve|bag|stand|dock|charger|adapter)|docking\s+station|replacement\s+(?:battery|keyboard|screen|hinge)|keyboard\s+cover|screen\s+protector)\b/i,
    smartwatch: /\b(?:watch\s+(?:band|strap|charger|case|cover|protector|dock|stand)|replacement\s+(?:band|strap|screen))\b/i,
    smartwatches: /\b(?:watch\s+(?:band|strap|charger|case|cover|protector|dock|stand)|replacement\s+(?:band|strap|screen))\b/i,
    headphones: /\b(?:headphone\s+case|earbuds?\s+case|replacement\s+(?:earpads?|ear\s*pads?|cable)|headphone\s+stand|headset\s+stand)\b/i
  };

  function isExactLikeView() {
    if (grid?.dataset?.v206621Rescue === "1") return true;
    const selected = tabs?.querySelector('[aria-selected="true"], .active, [data-active="true"]');
    const text = lower(selected?.textContent || resultsTitle?.textContent);
    return text.includes("exact") || text.includes("choose a product to compare");
  }

  function explanationFor(query) {
    if (PHONE_QUERIES.has(query)) {
      return "Phone choice — compare the model, storage, condition and seller offer before buying.";
    }
    if (["laptop", "laptops"].includes(query)) {
      return "Laptop choice — compare processor, RAM, storage, display and seller offer.";
    }
    if (["perfume", "perfumes", "fragrance", "fragrances"].includes(query)) {
      return "Fragrance choice — confirm size, concentration and seller details before buying.";
    }
    if (["headphone", "headphones", "earbuds"].includes(query)) {
      return "Audio choice — compare model, connectivity, condition and seller offer.";
    }
    return "Compare the product details, current price, stock and delivery with the seller.";
  }

  function rejectCard(card) {
    if (!isExactLikeView()) return false;
    const text = clean(card.textContent);
    if (PHONE_QUERIES.has(q)) return phoneNonMain(text);
    const rule = roleRules[q];
    return Boolean(rule && rule.test(text));
  }

  function decorateAndGuard() {
    if (!grid) return;

    const cards = [...grid.children].filter((el) =>
      el instanceof HTMLElement && !el.classList.contains("tp-empty")
    );

    for (const card of cards) {
      card.dataset.v2074Card = "1";
      const rejected = rejectCard(card);
      card.hidden = rejected;
      card.toggleAttribute("data-v2074-role-rejected", rejected);

      if (!rejected && card.matches("[data-v206621-card]")) {
        const content = card.querySelector(":scope > div:nth-child(2)") || card;
        if (!content.querySelector(".tp-v2074-explain")) {
          const p = document.createElement("p");
          p.className = "tp-v2074-explain";
          p.textContent = explanationFor(q);
          const action = content.querySelector("a.tp-btn, button.tp-btn");
          if (action) content.insertBefore(p, action);
          else content.appendChild(p);
        }
      }
    }
  }

  function start() {
    if (!grid) return;

    let pending = false;
    const schedule = () => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => {
        pending = false;
        decorateAndGuard();
      });
    };

    schedule();

    // Grid-scoped only: no whole-document observer loop.
    new MutationObserver(schedule).observe(grid, {
      childList: true,
      subtree: true,
      characterData: true
    });

    tabs?.addEventListener("click", () => {
      setTimeout(schedule, 40);
      setTimeout(schedule, 220);
    });

    [250, 700, 1400, 2600].forEach((ms) => setTimeout(schedule, ms));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }

  window.__TP_V2074__ = { version: VERSION, finderUrl, freshSearch };
})();
