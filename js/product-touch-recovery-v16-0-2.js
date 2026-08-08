(() => {
  "use strict";

  const d = document;
  const root = d.documentElement;
  const body = d.body;

  if (!body || body.dataset.tpPage !== "finder") return;

  const unlock = () => {
    for (const node of [root, body]) {
      node.style.removeProperty("overflow");
      node.style.removeProperty("overflow-y");
      node.style.removeProperty("height");
      node.style.removeProperty("max-height");
      node.style.removeProperty("position");
      node.style.removeProperty("top");
      node.style.removeProperty("width");
      node.style.removeProperty("touch-action");
    }

    const staleClasses = [
      "modal-open",
      "no-scroll",
      "scroll-lock",
      "menu-open",
      "tp-no-scroll",
      "tp-scroll-lock",
      "tp-modal-open"
    ];
    staleClasses.forEach(name => {
      root.classList.remove(name);
      body.classList.remove(name);
    });
  };

  const removeLegacyPanels = () => {
    d.querySelectorAll(".tp-amazon-suggest,.tp-smart-suggestions").forEach(node => {
      node.hidden = true;
      node.remove();
    });
  };

  const input = d.querySelector("[data-tp-finder-input]");

  const closeSuggestionPanel = () => {
    const panel = d.querySelector(".tp-v15-suggest");
    if (panel) panel.hidden = true;
    root.classList.remove("tp-v15-search-open");
    unlock();
  };

  unlock();
  removeLegacyPanels();

  if (input) {
    input.removeAttribute("readonly");
    input.removeAttribute("disabled");

    input.addEventListener("search", () => {
      if (!input.value) closeSuggestionPanel();
    }, { passive: true });

    input.addEventListener("keydown", event => {
      if (event.key === "Escape") closeSuggestionPanel();
    });
  }

  d.addEventListener("touchend", unlock, { passive: true });
  d.addEventListener("pointercancel", unlock, { passive: true });

  window.addEventListener("pageshow", () => {
    unlock();
    removeLegacyPanels();
  }, { passive: true });

  const observer = new MutationObserver(records => {
    let legacyInserted = false;
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (!(node instanceof Element)) continue;
        if (
          node.matches?.(".tp-amazon-suggest,.tp-smart-suggestions") ||
          node.querySelector?.(".tp-amazon-suggest,.tp-smart-suggestions")
        ) {
          legacyInserted = true;
        }
      }
    }
    if (legacyInserted) removeLegacyPanels();
  });
  observer.observe(body, { childList: true, subtree: true });

  const releaseHiddenFixedLayers = () => {
    d.querySelectorAll(
      ".tp-v15-suggest[hidden],.tpv16-suggest[hidden],.tpv16-modal[hidden],.tp-nav-backdrop"
    ).forEach(node => {
      if (node.hidden || node.getAttribute("aria-hidden") === "true") {
        node.style.pointerEvents = "none";
      }
    });
  };
  releaseHiddenFixedLayers();

  console.info("TrendPilot V16.0.2 touch recovery active");
})();
