(() => {
  "use strict";

  const VERSION = "20.6.6.3";
  const params = new URLSearchParams(location.search);
  if ((params.get("engine") || "").toLowerCase() !== "v2064") return;

  const MAP_URL = `/data/search-v20-6/presentation-v20-6-6-3.json?v=${encodeURIComponent(VERSION)}`;
  const TPID_RE = /\bTP[A-Z]{2,8}-[A-Z0-9]{8,}\b/i;
  let byTpid = new Map();
  let ready = false;

  const clean = v => String(v ?? "").replace(/\s+/g, " ").trim();
  const lower = v => clean(v).toLowerCase();

  function findTpid(root) {
    const text = clean(root?.textContent || "");
    const m = text.match(TPID_RE);
    return m ? m[0].toUpperCase() : "";
  }

  function humanName(row) {
    const n = clean(row?.name);
    return n && !TPID_RE.test(n) ? n : "";
  }

  function routeFor(row) {
    const p = new URLSearchParams();
    p.set("engine", "v2064");
    p.set("tpid", row.tpid);
    p.set("q", humanName(row) || row.tpid);
    p.set("tpdirect", "1");
    return `/find/?${p.toString()}`;
  }

  function nearestCard(node) {
    return node?.closest?.(
      "article, [data-tpid], [data-product-id], .tp-product-card, .tp-v2064-card, .tp-lite-card, .tp-product-grid > div"
    ) || null;
  }

  function replaceVisibleTpidLabels(root) {
    if (!root || !ready) return;
    const all = [root, ...root.querySelectorAll?.("*") || []];
    for (const el of all) {
      if (!el || el.children?.length) continue;
      const txt = clean(el.textContent);
      if (!TPID_RE.test(txt)) continue;
      const m = txt.match(TPID_RE);
      const tpid = m?.[0]?.toUpperCase();
      const row = byTpid.get(tpid);
      const name = humanName(row);
      if (!row || !name) continue;
      if (lower(txt) === lower(tpid)) {
        el.textContent = name;
        el.dataset.tpCanonicalLabel = "1";
      }
    }
  }

  function repairTechnicalMeta(root) {
    if (!root) return;
    root.querySelectorAll?.("p,span,div,strong,small").forEach(el => {
      const txt = clean(el.textContent);
      if (/^TPID\s+TP[A-Z]/i.test(txt) && /TPVID\s+TPV-/i.test(txt)) {
        el.classList.add("tp-v20663-technical-id");
      }
    });
  }

  function repairButtons(root) {
    if (!root || !ready) return;
    root.querySelectorAll?.("a,button").forEach(btn => {
      const label = lower(btn.textContent);
      if (!(label.includes("compare sellers") || label.includes("seller offer") || label === "compare")) return;
      const card = nearestCard(btn);
      const tpid = findTpid(card || btn.parentElement);
      const row = byTpid.get(tpid);
      if (!row) return;

      const count = Number(row.sellerCount || 0);
      btn.textContent = count > 1 ? `Compare ${count} sellers` : "View seller offer";
      btn.dataset.tpDirectTpid = tpid;

      if (btn.tagName === "A") {
        btn.setAttribute("href", routeFor(row));
      }
    });
  }

  function repairBroadCards(root=document) {
    if (!ready) return;
    replaceVisibleTpidLabels(root);
    repairButtons(root);
    repairTechnicalMeta(root);
  }

  function directTpidRecovery() {
    if (!ready) return false;
    const p = new URLSearchParams(location.search);
    const rawQ = clean(p.get("q") || "");
    const rawTpid = clean(p.get("tpid") || "");
    const qId = rawQ.match(TPID_RE)?.[0]?.toUpperCase() || "";
    const tpid = (rawTpid.match(TPID_RE)?.[0] || qId || "").toUpperCase();
    if (!tpid) return false;

    const row = byTpid.get(tpid);
    const name = humanName(row);
    if (!row || !name) return false;

    // The existing V20.6 exact resolver is query-name based.
    // Never feed it the TPID string itself. Preserve TPID separately.
    if (!rawQ || lower(rawQ) === lower(tpid)) {
      p.set("engine", "v2064");
      p.set("tpid", tpid);
      p.set("q", name);
      p.set("tpdirect", "1");
      location.replace(`/find/?${p.toString()}`);
      return true;
    }
    return false;
  }

  document.addEventListener("click", e => {
    const btn = e.target.closest?.("[data-tp-direct-tpid], a, button");
    if (!btn) return;
    const label = lower(btn.textContent);
    if (!(btn.dataset.tpDirectTpid || label.includes("compare sellers") || label.includes("seller offer"))) return;

    const tpid = (btn.dataset.tpDirectTpid || findTpid(nearestCard(btn) || btn.parentElement)).toUpperCase();
    const row = byTpid.get(tpid);
    if (!row) return;

    e.preventDefault();
    e.stopImmediatePropagation();
    location.href = routeFor(row);
  }, true);

  async function boot() {
    try {
      const res = await fetch(MAP_URL, {cache: "no-store"});
      if (!res.ok) throw new Error(`presentation map HTTP ${res.status}`);
      const payload = await res.json();
      for (const row of (payload.products || [])) {
        if (row?.tpid) byTpid.set(String(row.tpid).toUpperCase(), row);
      }
      ready = byTpid.size > 10000;
      if (!ready) throw new Error(`presentation map too small: ${byTpid.size}`);

      if (directTpidRecovery()) return;

      repairBroadCards(document);

      const observer = new MutationObserver(records => {
        for (const rec of records) {
          for (const n of rec.addedNodes) {
            if (n.nodeType === 1) repairBroadCards(n);
          }
        }
      });
      observer.observe(document.documentElement, {subtree:true, childList:true});

      // Late renderers in the existing V20.6 runtime can replace cards after fetch.
      [250, 700, 1400, 2500, 4500].forEach(ms => setTimeout(() => repairBroadCards(document), ms));
    } catch (err) {
      console.error("[TrendPilot V20.6.6.3]", err);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, {once:true});
  } else {
    boot();
  }
})();
