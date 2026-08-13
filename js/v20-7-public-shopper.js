(() => {
  "use strict";

  const PAGE = document.body?.dataset?.tpPage || "";
  const params = new URLSearchParams(location.search);
  const isLegacyFile = /\/find\/legacy\.html$/i.test(location.pathname);

  // Public V20 cutover. Keep an explicit emergency rollback route.
  if (PAGE === "finder" && !isLegacyFile) {
    if ((params.get("engine") || "").toLowerCase() === "legacy") {
      const target = "/find/legacy.html" + (location.search || "?engine=legacy");
      location.replace(target);
      return;
    }
    if (!params.has("engine")) {
      params.set("engine", "v2064");
      history.replaceState(null, "", location.pathname + "?" + params.toString() + location.hash);
    }
  }

  document.body.classList.add("v207-public");
  document.body.dataset.v20Public = "true";

  const currentPath = location.pathname.replace(/\/+$/, "") || "/";
  document.querySelectorAll(".tp-bottom-nav a").forEach((a) => {
    const p = new URL(a.href, location.href).pathname.replace(/\/+$/, "") || "/";
    if (p === currentPath || (currentPath.startsWith("/find") && p === "/find")) {
      a.classList.add("active");
      a.setAttribute("aria-current", "page");
    }
  });

  if (PAGE !== "finder") return;

  const q = (new URLSearchParams(location.search).get("q") || "").trim().toLowerCase();
  const grid = document.querySelector("[data-tp-product-grid]");
  const sellerSelect = document.querySelector("[data-filter-merchant]");
  const tabs = document.querySelector("[data-tp-result-tabs]");
  const resultsTitle = document.querySelector("[data-tp-results-title]");
  const count = document.querySelector("[data-tp-results-count]");

  const sellerKey = "tp-v207-seller:" + q;
  let sellerApplying = false;

  function applyStoredSeller() {
    if (!sellerSelect || sellerApplying) return;
    const stored = sessionStorage.getItem(sellerKey);
    if (!stored || sellerSelect.value === stored) return;
    const exists = [...sellerSelect.options].some(o => o.value === stored);
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

    const sellerObserver = new MutationObserver(applyStoredSeller);
    sellerObserver.observe(sellerSelect, { childList: true, subtree: true });
    setTimeout(applyStoredSeller, 250);
    setTimeout(applyStoredSeller, 900);
  }

  const strictRules = {
    phone: /\b(case|cover|strap|lanyard|holder|mount|sim\s*tray|tray|enclosure|ssd|protector|protective|tempered|replacement|cable|charger|adapter|battery|lens|housing|back\s*glass|digitizer|flex\s*cable|motherboard|repair\s*part|stand|ring|pouch|wallet|skin)\b/i,
    phones: /\b(case|cover|strap|lanyard|holder|mount|sim\s*tray|tray|enclosure|ssd|protector|protective|tempered|replacement|cable|charger|adapter|battery|lens|housing|back\s*glass|digitizer|flex\s*cable|motherboard|repair\s*part|stand|ring|pouch|wallet|skin)\b/i,
    smartphone: /\b(case|cover|strap|lanyard|holder|mount|sim\s*tray|tray|enclosure|ssd|protector|protective|tempered|replacement|cable|charger|adapter|battery|lens|housing|back\s*glass|digitizer|flex\s*cable|motherboard|repair\s*part|stand|ring|pouch|wallet|skin)\b/i,
    smartphones: /\b(case|cover|strap|lanyard|holder|mount|sim\s*tray|tray|enclosure|ssd|protector|protective|tempered|replacement|cable|charger|adapter|battery|lens|housing|back\s*glass|digitizer|flex\s*cable|motherboard|repair\s*part|stand|ring|pouch|wallet|skin)\b/i,
    laptop: /\b(case|sleeve|bag|stand|dock|docking|charger|adapter|replacement|battery|keyboard\s*cover|screen\s*protector|hinge|cable|skin)\b/i,
    laptops: /\b(case|sleeve|bag|stand|dock|docking|charger|adapter|replacement|battery|keyboard\s*cover|screen\s*protector|hinge|cable|skin)\b/i,
    smartwatch: /\b(band|strap|charger|case|cover|protector|replacement|dock|stand)\b/i,
    smartwatches: /\b(band|strap|charger|case|cover|protector|replacement|dock|stand)\b/i,
    headphones: /\b(case|earpad|ear\s*pad|replacement|cable|stand|hanger|adapter)\b/i
  };

  function isExactView() {
    const selected = tabs?.querySelector(
      '[aria-selected="true"], .active, [data-active="true"]'
    );
    const text = (selected?.textContent || resultsTitle?.textContent || "").toLowerCase();
    return text.includes("exact");
  }

  function cardTitle(card) {
    const el = card.querySelector(
      "[data-product-title], .product-title, h3, h2"
    );
    return (el?.textContent || "").replace(/\s+/g, " ").trim();
  }

  function hasUsefulExplanation(card) {
    return Boolean(card.querySelector(
      ".v207-explain, [data-product-explanation], .product-explanation, .tp-product-explanation"
    ));
  }

  function explanationFor(query) {
    if (["phone","phones","smartphone","smartphones"].includes(query)) {
      return "Smartphone listing — confirm storage, network/region, condition and included accessories before purchase.";
    }
    if (["laptop","laptops"].includes(query)) {
      return "Laptop listing — confirm processor, RAM, storage, display, keyboard layout and warranty before purchase.";
    }
    if (["smartwatch","smartwatches","watch","watches"].includes(query)) {
      return "Watch listing — confirm model, size, connectivity, compatibility and included accessories before purchase.";
    }
    if (["headphone","headphones","earbuds"].includes(query)) {
      return "Audio product listing — confirm model, connectivity, battery details and included accessories before purchase.";
    }
    if (q) {
      return "Product listing — confirm current specifications, stock, delivery and final price with the seller.";
    }
    return "";
  }

  function directCards() {
    if (!grid) return [];
    return [...grid.children].filter((el) =>
      el instanceof HTMLElement && !el.classList.contains("tp-empty")
    );
  }

  function decorateAndGuard() {
    if (!grid) return;
    const exact = isExactView();
    const rule = strictRules[q];
    let hiddenByRole = 0;
    let visible = 0;

    directCards().forEach((card) => {
      card.dataset.v207Card = "1";
      const title = cardTitle(card);

      const reject = Boolean(exact && rule && title && rule.test(title));
      if (reject) {
        card.hidden = true;
        card.dataset.v207RoleRejected = "1";
        hiddenByRole += 1;
        return;
      }

      if (card.dataset.v207RoleRejected === "1") {
        card.hidden = false;
        delete card.dataset.v207RoleRejected;
      }

      visible += 1;

      if (!hasUsefulExplanation(card)) {
        const text = explanationFor(q);
        if (text) {
          const p = document.createElement("p");
          p.className = "v207-explain";
          p.textContent = text;
          card.appendChild(p);
        }
      }
    });

    if (exact && rule && hiddenByRole > 0 && count) {
      count.textContent = `${visible} clean results shown`;
      count.title = `${hiddenByRole} accessory/part result(s) removed from the exact ${q} view`;
    }
  }

  if (grid) {
    const gridObserver = new MutationObserver(() => {
      requestAnimationFrame(decorateAndGuard);
    });
    gridObserver.observe(grid, { childList: true });
  }

  if (tabs) {
    tabs.addEventListener("click", () => {
      setTimeout(decorateAndGuard, 40);
      setTimeout(decorateAndGuard, 220);
    });
  }

  setTimeout(decorateAndGuard, 120);
  setTimeout(decorateAndGuard, 500);
  setTimeout(decorateAndGuard, 1200);
})();
