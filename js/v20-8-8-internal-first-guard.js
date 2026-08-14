(() => {
  "use strict";

  const d = document;
  const GRID = "[data-v2078-product-grid]";
  const EXTERNAL = /^https?:\/\//i;
  const promoPrefix = /^(?:\s*\[(?:free\s*shipping|hot\s*sale|sale|deal|coupon|new\s*arrival|limited\s*time|clearance)\]\s*)+/i;

  const clean = value => String(value ?? "").replace(/\s+/g, " ").trim();
  const cleanTitle = value => clean(value).replace(promoPrefix, "").trim() || clean(value);
  const internalSearch = title => `/find/?q=${encodeURIComponent(cleanTitle(title))}&universal=1&engine=v2064&ui=2088`;

  function isExternal(anchor) {
    return Boolean(anchor && EXTERNAL.test(clean(anchor.getAttribute("href"))));
  }

  function plainTitle(card) {
    const h = card.querySelector("h3");
    if (!h) return "";
    const title = cleanTitle(h.textContent);
    const link = h.querySelector("a");
    if (link) {
      const span = d.createElement("span");
      span.textContent = title;
      span.className = "tp88-title-text";
      link.replaceWith(span);
    } else {
      h.textContent = title;
    }
    return title;
  }

  function keepMediaInternal(card) {
    const media = card.querySelector("a.tp78-media");
    if (!isExternal(media)) return;
    const box = d.createElement("div");
    box.className = media.className;
    box.innerHTML = media.innerHTML;
    box.setAttribute("aria-hidden", "false");
    media.replaceWith(box);
  }

  function keepActionsInternal(card, title) {
    card.querySelectorAll(".tp78-actions a").forEach(anchor => {
      if (!isExternal(anchor)) return;
      if (anchor.classList.contains("tp78-view")) {
        anchor.removeAttribute("target");
        anchor.removeAttribute("rel");
        anchor.href = internalSearch(title);
        anchor.innerHTML = 'View details <span aria-hidden="true">→</span>';
        anchor.classList.add("internal-detail");
      } else {
        anchor.remove();
      }
    });
  }

  function normalizeCard(card) {
    if (!(card instanceof Element) || !card.matches(".tp78-card")) return;
    const title = plainTitle(card) || "product";
    keepMediaInternal(card);
    keepActionsInternal(card, title);
  }

  function normalize(root) {
    if (!root) return;
    if (root.matches?.(".tp78-card")) normalizeCard(root);
    root.querySelectorAll?.(".tp78-card").forEach(normalizeCard);
  }

  function boot() {
    const grid = d.querySelector(GRID);
    if (!grid) return;

    normalize(grid);

    const observer = new MutationObserver(records => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node.nodeType === 1) normalize(node);
        }
      }
    });
    observer.observe(grid, { childList: true, subtree: true });

    grid.addEventListener("click", event => {
      const anchor = event.target.closest?.("a");
      if (!anchor || !isExternal(anchor)) return;
      event.preventDefault();
      event.stopPropagation();
      const card = anchor.closest(".tp78-card");
      const title = cleanTitle(card?.querySelector("h3")?.textContent || "");
      if (title) location.assign(internalSearch(title));
    }, true);
  }

  d.readyState === "loading" ? d.addEventListener("DOMContentLoaded", boot, { once: true }) : boot();
})();
