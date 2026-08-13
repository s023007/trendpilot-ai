(() => {
  "use strict";

  const VERSION = "20.7.6";
  const GRID = "[data-tp-product-grid]";
  const cache = new Map();
  let queued = false;

  const clean = v => String(v ?? "").replace(/\s+/g, " ").trim();
  const esc = v => clean(v).replace(/[&<>'"]/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;","'":"&#039;",'"':"&quot;"
  }[c]));

  function suffix(tpid) {
    const m = clean(tpid).match(/^TP[A-Z]{2,8}-([A-Z0-9]{8,})$/i);
    return m ? m[1].toLowerCase() : "";
  }

  async function metaFor(tpid) {
    const s = suffix(tpid);
    if (!s) return null;
    const bucket = s.slice(0,2);
    if (!cache.has(bucket)) {
      cache.set(bucket, fetch(`/data/shopper-v20-6-8-4/products/${bucket}.json?v=${VERSION}`, {
        cache:"no-store", headers:{accept:"application/json"}
      }).then(r => r.ok ? r.json() : null).catch(() => null));
    }
    const data = await cache.get(bucket);
    return data?.[s] || null;
  }

  const dynamicTikTok = g =>
    /tiktok/i.test(clean(g?.seller)) &&
    (g?.availability === "check-live" || g?.availability_dynamic === true);

  const groupPrice = g => {
    const xs = [g?.minPrice, g?.primary?.price].map(Number).filter(v => v > 0);
    return xs.length ? Math.min(...xs) : 0;
  };

  function titleNode(card) {
    return card.querySelector("h3,[data-product-title],.product-title");
  }

  function imageNode(card) {
    return card.querySelector("img");
  }

  function priceNode(card) {
    return [...card.querySelectorAll("strong,b")].find(el =>
      /(?:from|price|US\$|\$|current price)/i.test(clean(el.textContent))
    );
  }

  function actionNode(card) {
    return card.querySelector("a.tp-btn,a[href*='tpid='],a[href*='/product/']");
  }

  function metaRow(card) {
    return [...card.querySelectorAll("div,span")].find(el => {
      const t = clean(el.textContent);
      return /\b\d+\s+sellers?\b/i.test(t) && /\b\d+\s+variants?\b/i.test(t);
    });
  }

  function setPrice(el, value, currency="USD") {
    if (!el) return;
    const n = Number(value);
    if (!(n > 0)) {
      el.textContent = "Check current price";
      return;
    }
    const cur = clean(currency).toUpperCase() || "USD";
    const amount = n.toLocaleString(undefined, {maximumFractionDigits:2});
    el.textContent = `From ${cur === "USD" ? "US$" : cur + " "}${amount}`;
  }

  function removeDuplicateExplanations(card) {
    const nodes = [...card.querySelectorAll("p")];
    const seen = new Set();
    for (const p of nodes) {
      const key = clean(p.textContent).toLowerCase();
      if (!key || !/(phone choice|laptop choice|fragrance choice|compare the product)/.test(key)) continue;
      if (seen.has(key) || (seen.size && /(phone choice|laptop choice|fragrance choice)/.test(key))) {
        p.remove();
      } else {
        seen.add(key);
      }
    }
  }

  function ensureTruthNote(card, text) {
    let note = card.querySelector("[data-v2076-truth-note]");
    if (!note) {
      note = document.createElement("p");
      note.dataset.v2076TruthNote = "1";
      note.style.cssText = "margin:0;color:#8a5b00;font-size:.7rem;line-height:1.35";
      const action = actionNode(card);
      if (action) action.before(note); else card.appendChild(note);
    }
    note.textContent = text;
  }

  async function repairCard(card) {
    if (!(card instanceof HTMLElement)) return;
    const rawTpid = card.getAttribute("data-v206621-card") || card.getAttribute("data-tpid") || "";
    if (!rawTpid) return;

    const meta = await metaFor(rawTpid);
    if (!meta) return;

    const groups = Array.isArray(meta.sellerGroups) ? meta.sellerGroups : [];
    const liveOnly = groups.filter(dynamicTikTok);
    const confirmed = groups.filter(g => g?.availability !== "unavailable" && !dynamicTikTok(g));

    if (groups.length && !confirmed.length && liveOnly.length) {
      card.hidden = true;
      card.dataset.v2076DynamicOnly = "1";
      return;
    }

    card.hidden = false;
    card.removeAttribute("data-v2076-dynamic-only");

    const title = titleNode(card);
    if (title && clean(meta.title)) title.textContent = clean(meta.title);

    const brand = clean(meta.brand);
    if (brand) {
      const brandNode = [...card.querySelectorAll("div")].find(el =>
        el.children.length === 0 && clean(el.textContent).toLowerCase() === brand.toLowerCase()
      );
      if (brandNode) brandNode.textContent = brand;
    }

    const img = imageNode(card);
    if (img && /^https?:\/\//i.test(clean(meta.image))) {
      img.src = clean(meta.image);
      img.alt = clean(meta.title || brand || "Product");
    }

    const prices = confirmed.map(groupPrice).filter(v => v > 0);
    if (prices.length) setPrice(priceNode(card), Math.min(...prices), "USD");

    const sellers = [...new Set(confirmed.map(g => clean(g?.seller)).filter(Boolean))];
    const row = metaRow(card);
    if (row && sellers.length) {
      const variants = Number((clean(row.textContent).match(/(\d+)\s+variants?/i) || [])[1] || 0);
      row.innerHTML = `<span>${sellers.length} seller${sellers.length===1?"":"s"}</span><span>•</span><span>${variants} variant${variants===1?"":"s"}</span>`;
    }

    const action = actionNode(card);
    if (action && clean(meta.route).startsWith("/product/")) {
      action.href = clean(meta.route);
      action.textContent = "View product";
      action.removeAttribute("data-tp-direct-tpid");
    }

    removeDuplicateExplanations(card);

    if (liveOnly.length) {
      ensureTruthNote(card, "TikTok live-only price is not used until availability is verified.");
    } else {
      card.querySelector("[data-v2076-truth-note]")?.remove();
    }

    card.dataset.v2076Truth = "1";
  }

  async function run() {
    const grid = document.querySelector(GRID);
    if (!grid) return;
    const cards = [...grid.children].filter(el =>
      el instanceof HTMLElement && !el.classList.contains("tp-empty")
    );
    await Promise.all(cards.slice(0,80).map(repairCard));
  }

  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      run().catch(err => console.warn("[TrendPilot V20.7.6 truth]", err));
    });
  }

  function start() {
    const grid = document.querySelector(GRID);
    if (!grid) return;
    schedule();
    new MutationObserver(schedule).observe(grid, {childList:true, subtree:true});
    [250,700,1400,2600].forEach(ms => setTimeout(schedule, ms));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, {once:true});
  } else {
    start();
  }
})();