(() => {
  "use strict";

  const d = document;
  const TECHNICAL = [
    ".tp-verified-only",
    "[data-v209-budget-status]",
    ".tp80-price-proof"
  ].join(",");

  function installHardHide() {
    if (d.getElementById("tp-shopper-technical-hide")) return;
    const style = d.createElement("style");
    style.id = "tp-shopper-technical-hide";
    style.textContent = `${TECHNICAL}{display:none!important;visibility:hidden!important}`;
    d.head.appendChild(style);
  }

  function removeTechnicalPriceUI(root = d) {
    root.querySelectorAll?.(TECHNICAL).forEach(el => el.remove());
    const exact = root.querySelector?.("[data-v209-exact]");
    if (exact) {
      exact.checked = false;
      exact.closest("label")?.remove();
    }
    const budgetTitle = root.querySelector?.("[data-budget-tools] .tp-budget-title strong");
    if (budgetTitle) budgetTitle.textContent = "Price range";
  }

  function bindCollapsedFilters() {
    const fields = d.getElementById("tp-filter-fields");
    const toggle = d.querySelector("[data-tp-filter-toggle]");
    if (!fields || !toggle) return;

    fields.hidden = true;
    toggle.setAttribute("aria-expanded", "false");
    toggle.textContent = "Filters";

    if (toggle.dataset.tpShopperFilterBound === "1") return;
    toggle.dataset.tpShopperFilterBound = "1";

    toggle.addEventListener("click", event => {
      event.preventDefault();
      const open = toggle.getAttribute("aria-expanded") === "true";
      const next = !open;
      fields.hidden = !next;
      toggle.setAttribute("aria-expanded", String(next));
      toggle.textContent = next ? "Hide filters" : "Filters";
      if (next) removeTechnicalPriceUI(fields);
    });
  }

  function refresh() {
    installHardHide();
    bindCollapsedFilters();
    removeTechnicalPriceUI(d);
  }

  if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", refresh, { once: true });
  else refresh();

  const main = d.querySelector("main");
  if (main) {
    const observer = new MutationObserver(records => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node.nodeType === 1) removeTechnicalPriceUI(node);
        }
      }
      removeTechnicalPriceUI(main);
    });
    observer.observe(main, { childList: true, subtree: true });
  }
})();