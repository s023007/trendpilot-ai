(() => {
  "use strict";

  const VERSION = "20.7.6";
  const clean = v => String(v ?? "").replace(/\s+/g, " ").trim();
  const lower = v => clean(v).toLowerCase();
  const bucketCache = new Map();
  let finderQueued = false;

  function suffixFromTpid(tpid) {
    const m = clean(tpid).match(/^TP[A-Z]{2,8}-([A-Z0-9]{8,})$/i);
    return m ? m[1].toLowerCase() : "";
  }

  function suffixFromPath() {
    const m = location.pathname.match(/--([a-f0-9]{10,})(?:\/|$)/i);
    return m ? m[1].toLowerCase() : "";
  }

  async function metaFromSuffix(suffix) {
    const s = clean(suffix).toLowerCase();
    if (!s) return null;
    const bucket = s.slice(0,2);
    if (!bucketCache.has(bucket)) {
      bucketCache.set(bucket, fetch(`/data/shopper-v20-6-8-4/products/${bucket}.json?v=${VERSION}`, {
        cache:"no-store", headers:{accept:"application/json"}
      }).then(r => r.ok ? r.json() : null).catch(() => null));
    }
    const data = await bucketCache.get(bucket);
    return data?.[s] || null;
  }

  async function metaFromTpid(tpid) {
    return metaFromSuffix(suffixFromTpid(tpid));
  }

  const dynamicTikTok = g =>
    /tiktok/i.test(clean(g?.seller)) &&
    (g?.availability === "check-live" || g?.availability_dynamic === true);

  const groupPrice = g => {
    const xs = [g?.minPrice, g?.primary?.price].map(Number).filter(v => v > 0);
    return xs.length ? Math.min(...xs) : 0;
  };

  function decoded(href) {
    try { return decodeURIComponent(String(href || "")); }
    catch { return String(href || ""); }
  }

  function hasTikTokDestination(href) {
    try {
      const u = new URL(href, location.href);
      if (/(^|\.)tiktok\.com$/i.test(u.hostname)) return true;
    } catch {}
    return /tiktok\.com/i.test(decoded(href));
  }

  function nearestCard(node) {
    return node?.closest?.("article,.offer-card,.product-card,.result-card,[data-product-card],[data-product],section") || node?.parentElement;
  }

  function ensureNote(card, text) {
    if (!card) return;
    let note = card.querySelector?.("[data-v2076-live-note]");
    if (!note) {
      note = document.createElement("p");
      note.dataset.v2076LiveNote = "1";
      note.style.cssText = "margin:.45rem 0 0;color:#8a5b00;font-size:.76rem;line-height:1.4";
      card.appendChild(note);
    }
    note.textContent = text;
  }

  function disableTikTokAnchor(a) {
    if (!(a instanceof HTMLAnchorElement)) return;
    const card = nearestCard(a);
    a.removeAttribute("href");
    a.removeAttribute("target");
    a.setAttribute("aria-disabled", "true");
    a.dataset.v2076TikTokUnverified = "1";
    a.textContent = "TikTok availability not verified";
    a.style.cursor = "not-allowed";
    a.style.opacity = ".72";
    a.addEventListener("click", e => e.preventDefault());
    ensureNote(card, "TrendPilot does not treat this TikTok feed item as buyable until live availability is verified.");
  }

  async function recoverTpidRoute() {
    if (!location.pathname.startsWith("/find")) return false;
    const p = new URLSearchParams(location.search);
    const raw = clean(p.get("tpid") || p.get("q") || "");
    if (!/^TP[A-Z]{2,8}-[A-Z0-9]{8,}$/i.test(raw)) return false;
    const meta = await metaFromTpid(raw);
    if (meta?.route && clean(meta.route).startsWith("/product/")) {
      location.replace(meta.route);
      return true;
    }
    return false;
  }

  function searchUrl(value) {
    const p = new URLSearchParams();
    p.set("q", clean(value));
    p.set("engine", "v2064");
    p.set("ui", "2076");
    const scope = clean(document.querySelector("[data-tp-finder-scope]")?.value || "");
    if (scope) p.set("scope", scope);
    return `/find/?${p.toString()}`;
  }

  function installSuggestionFallback() {
    if (!location.pathname.startsWith("/find")) return;

    document.addEventListener("click", e => {
      const row = e.target.closest?.(".tp-amazon-row");
      if (!row) return;
      const value = clean(row.querySelector("b")?.textContent || row.textContent);
      if (!value) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      location.assign(searchUrl(value));
    }, true);

    document.addEventListener("click", e => {
      const fill = e.target.closest?.("[data-search-fill]");
      if (!fill) return;
      const value = clean(fill.dataset.searchFill);
      if (!value) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      location.assign(searchUrl(value));
    }, true);
  }

  function titleNode(card) {
    return card.querySelector("h3,[data-product-title],.product-title");
  }

  function priceNode(card) {
    return [...card.querySelectorAll("strong,b")].find(el =>
      /(?:from|price|US\$|\$|current price)/i.test(clean(el.textContent))
    );
  }

  function actionNode(card) {
    return card.querySelector("a.tp-btn,a[href*='tpid='],a[href*='/product/']");
  }

  function metadataRow(card) {
    return [...card.querySelectorAll("div,span")].find(el => {
      const t = clean(el.textContent);
      return /\b\d+\s+sellers?\b/i.test(t) && /\b\d+\s+variants?\b/i.test(t);
    });
  }

  function setPrice(el, value) {
    if (!el) return;
    const n = Number(value);
    el.textContent = n > 0
      ? `From US$${n.toLocaleString(undefined, {maximumFractionDigits:2})}`
      : "Check current price";
  }

  function removeDuplicateExplanations(card) {
    const matches = [...card.querySelectorAll("p")].filter(p =>
      /(phone choice|laptop choice|fragrance choice)/i.test(clean(p.textContent))
    );
    matches.slice(1).forEach(p => p.remove());
  }

  async function repairFinderCard(card) {
    if (!(card instanceof HTMLElement)) return;
    const tpid = clean(card.getAttribute("data-v206621-card") || card.getAttribute("data-tpid") || "");
    if (!tpid) return;

    const meta = await metaFromTpid(tpid);
    if (!meta) return;

    const groups = Array.isArray(meta.sellerGroups) ? meta.sellerGroups : [];
    const liveTikTok = groups.filter(dynamicTikTok);
    const confirmed = groups.filter(g => g?.availability !== "unavailable" && !dynamicTikTok(g));

    if (groups.length && !confirmed.length && liveTikTok.length) {
      card.hidden = true;
      card.dataset.v2076DynamicOnly = "1";
      return;
    }

    card.hidden = false;
    card.removeAttribute("data-v2076-dynamic-only");

    const title = titleNode(card);
    if (title && clean(meta.title)) title.textContent = clean(meta.title);

    const img = card.querySelector("img");
    if (img && /^https?:\/\//i.test(clean(meta.image))) {
      img.src = clean(meta.image);
      img.alt = clean(meta.title || meta.brand || "Product");
    }

    const prices = confirmed.map(groupPrice).filter(v => v > 0);
    if (prices.length) setPrice(priceNode(card), Math.min(...prices));

    const sellers = [...new Set(confirmed.map(g => clean(g?.seller)).filter(Boolean))];
    const metaLine = metadataRow(card);
    if (metaLine && sellers.length) {
      const variants = Number((clean(metaLine.textContent).match(/(\d+)\s+variants?/i) || [])[1] || 0);
      metaLine.innerHTML = `<span>${sellers.length} seller${sellers.length===1?"":"s"}</span><span>•</span><span>${variants} variant${variants===1?"":"s"}</span>`;
    }

    const action = actionNode(card);
    if (action && clean(meta.route).startsWith("/product/")) {
      action.href = clean(meta.route);
      action.textContent = "View product";
      action.removeAttribute("data-tp-direct-tpid");
    }

    removeDuplicateExplanations(card);

    if (liveTikTok.length) {
      ensureNote(card, "TikTok live-only price is excluded until availability is verified.");
    }

    card.dataset.v2076Truth = "1";
  }

  async function repairFinder() {
    if (!location.pathname.startsWith("/find")) return;
    const grid = document.querySelector("[data-tp-product-grid]");
    if (!grid) return;
    const cards = [...grid.children].filter(el =>
      el instanceof HTMLElement && !el.classList.contains("tp-empty")
    );
    await Promise.all(cards.slice(0,80).map(repairFinderCard));
  }

  function scheduleFinder() {
    if (finderQueued) return;
    finderQueued = true;
    requestAnimationFrame(() => {
      finderQueued = false;
      repairFinder().catch(err => console.warn("[TrendPilot V20.7.6 finder truth]", err));
    });
  }

  async function repairProductPage() {
    const s = suffixFromPath();
    if (!s) return;
    const meta = await metaFromSuffix(s);
    if (!meta) return;

    document.body.style.paddingBottom = "calc(116px + env(safe-area-inset-bottom,0px))";

    const headings = [...document.querySelectorAll("h1,h2")];
    for (const h of headings) {
      const t = clean(h.textContent);
      if (/^TP[A-Z]{2,8}-[A-Z0-9]{8,}$/i.test(t) || /^Comparison for “?TP[A-Z]/i.test(t)) {
        h.textContent = clean(meta.title || meta.brand || "Product");
      }
    }

    const input = document.querySelector("[data-tp-finder-input]");
    if (input && /^TP[A-Z]{2,8}-[A-Z0-9]{8,}$/i.test(clean(input.value))) {
      input.value = clean(meta.title || "");
    }

    const groups = Array.isArray(meta.sellerGroups) ? meta.sellerGroups : [];
    const liveTikTok = groups.filter(dynamicTikTok);

    if (liveTikTok.length) {
      for (const a of document.querySelectorAll("a[href]")) {
        if (hasTikTokDestination(a.getAttribute("href") || a.href)) disableTikTokAnchor(a);
      }

      for (const el of document.querySelectorAll("article,.offer-card,.product-card,[data-product-card]")) {
        if (!/tiktok/i.test(clean(el.textContent))) continue;
        for (const a of el.querySelectorAll("a[href]")) disableTikTokAnchor(a);
        ensureNote(el, "TikTok availability from this feed is dynamic and is not presented as a confirmed buyable offer.");
      }
    }
  }

  async function start() {
    if (await recoverTpidRoute()) return;

    installSuggestionFallback();

    if (location.pathname.startsWith("/find")) {
      scheduleFinder();
      const grid = document.querySelector("[data-tp-product-grid]");
      if (grid) {
        new MutationObserver(scheduleFinder).observe(grid, {childList:true, subtree:true});
        [250,700,1400,2600].forEach(ms => setTimeout(scheduleFinder, ms));
      }
    }

    repairProductPage().catch(err => console.warn("[TrendPilot V20.7.6 product truth]", err));

    const main = document.querySelector("main");
    if (main) {
      const mo = new MutationObserver(() => repairProductPage().catch(()=>{}));
      mo.observe(main, {childList:true, subtree:true});
      setTimeout(() => mo.disconnect(), 15000);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, {once:true});
  } else {
    start();
  }
})();