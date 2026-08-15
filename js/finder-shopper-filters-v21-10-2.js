(() => {
  "use strict";

  const d = document;
  const SELECTORS_TO_HIDE = [
    ".tp-verified-only",
    "[data-v209-budget-status]",
    ".tp80-price-proof"
  ].join(",");

  function hideTechnicalPriceCopy(root = d) {
    root.querySelectorAll?.(SELECTORS_TO_HIDE).forEach(el => {
      el.hidden = true;
      el.setAttribute("aria-hidden", "true");
    });

    const exact = root.querySelector?.("[data-v209-exact]");
    if (exact) exact.checked = false;

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
      if (next) hideTechnicalPriceCopy(fields);
    });
  }

  function refresh() {
    bindCollapsedFilters();
    hideTechnicalPriceCopy(d);
  }

  if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", refresh, { once: true });
  else refresh();

  const main = d.querySelector("main");
  if (main) {
    const observer = new MutationObserver(() => hideTechnicalPriceCopy(main));
    observer.observe(main, { childList: true, subtree: true });
  }
})();
