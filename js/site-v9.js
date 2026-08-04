(() => {
  "use strict";

  const doc = document;
  const $ = (selector, root = doc) => root.querySelector(selector);
  const $$ = (selector, root = doc) => Array.from(root.querySelectorAll(selector));
  const clean = (value) => String(value || "").replace(/\s+/g, " ").trim();
  const lower = (value) => clean(value).toLowerCase();
  const nextFrame = (fn) => requestAnimationFrame(() => requestAnimationFrame(fn));

  const GUIDE_TEMPLATES = {
    footwear: {
      title: "A faster way to choose the right shoes",
      intro: "Start with how you will use them, then compare fit, material and the return route—not only the headline price.",
      checks: [
        ["Use", "Choose walking, running, work, casual or formal shoes before comparing style."],
        ["Fit", "Check the seller's size chart, foot length and recent comments about narrow or wide sizing."],
        ["Build", "Compare upper material, sole grip, cushioning and weight for your actual use."],
        ["Returns", "Confirm the delivered price and whether the size can be returned from your country."],
      ],
      next: "Select two or three shoes made for the same purpose and compare their size information side by side.",
    },
    running: {
      title: "Choose running shoes by terrain and support",
      intro: "A good-looking shoe is not automatically right for your route, distance or foot support needs.",
      checks: [
        ["Terrain", "Separate road, treadmill, trail and everyday walking models."],
        ["Support", "Compare cushioning, heel drop and stability information rather than colour alone."],
        ["Sizing", "Use foot length in centimetres when different stores use different regional sizes."],
        ["Proof", "Prefer listings with useful sole photos, weight details and recent buyer feedback."],
      ],
      next: "Compare products from the same running category so the price difference has a useful meaning.",
    },
    "pet-feeder": {
      title: "Choose a pet feeder that matches the daily routine",
      intro: "The useful comparison is capacity, portion control, cleaning and backup power—not simply the number of buttons.",
      checks: [
        ["Food type", "Confirm that the opening and mechanism suit dry food, wet food or water."],
        ["Capacity", "Match the container size to the pet, portion size and number of days away."],
        ["Reliability", "Check power source, battery backup, jam protection and schedule memory."],
        ["Cleaning", "Prefer removable food-contact parts and a clear replacement or return route."],
      ],
      next: "Compare only automatic feeders with automatic feeders, or bowls with bowls, to avoid a misleading result.",
    },
    carplay: {
      title: "Check compatibility before comparing CarPlay adapters",
      intro: "The car must already support reliable wired CarPlay. After that, compare connector, reconnect speed, firmware support and returns.",
      checks: [
        ["Wired support", "Test wired CarPlay first; an adapter cannot add CarPlay to an unsupported head unit."],
        ["Connector", "Match USB-A or USB-C and check whether an included converter changes fit or power."],
        ["Daily use", "Look for evidence about cold starts, calls, audio delay and switching phones."],
        ["Support", "Prefer a documented update method and a practical return route."],
      ],
      next: "Select adapters—not full head units or screens—when building the comparison.",
    },
    software: {
      title: "Compare software with one real task",
      intro: "Feature lists can look similar. The quickest decision comes from testing the same short project on your own device.",
      checks: [
        ["Device", "Confirm operating system, memory, storage and graphics requirements."],
        ["Core task", "Test the feature you need most instead of browsing every tool."],
        ["Limits", "Check export quality, watermark, credit limits, add-ons and subscription renewal."],
        ["Workflow", "Compare speed, ease of learning and the quality of the final result."],
      ],
      next: "Use the same source file and export settings in each trial for a fair comparison.",
    },
    electronics: {
      title: "Match the exact model before comparing the price",
      intro: "For electronics, compatibility, ports, power and warranty can matter more than a small price difference.",
      checks: [
        ["Model", "Confirm the exact device, generation, connector and regional version."],
        ["Included items", "Check cables, power supply, adapters, storage and accessories in the chosen variant."],
        ["Evidence", "Prefer clear specifications, useful product photos and recent buyer feedback."],
        ["After-sale", "Compare delivery, warranty and the realistic cost of returning the item."],
      ],
      next: "Select products that solve the same problem and use the same connection standard.",
    },
    generic: {
      title: "Turn the search into a useful comparison",
      intro: "First define the result you need. Then compare only products that solve that same problem.",
      checks: [
        ["Purpose", "Write the main use in one sentence and remove products made for a different job."],
        ["Must-haves", "Choose two or three specifications that would make the product unsuitable if missing."],
        ["Total cost", "Check the selected variant, delivery, tax, accessories and return cost."],
        ["Seller evidence", "Prefer complete specifications, clear photos and a practical support route."],
      ],
      next: "Select two or three close alternatives. A smaller, cleaner comparison is easier to trust.",
    },
  };

  function currentFinderQuery() {
    const input = $("[data-finder-input]");
    const params = new URLSearchParams(location.search);
    return clean((input && input.value) || params.get("q") || "");
  }

  function detectGuideType(query, root) {
    const q = lower(query);
    const cardText = lower(root ? root.textContent : "");
    if (/wireless\s*carplay|carplay\s*(adapter|dongle|converter)/.test(q)) return "carplay";
    if (/running\s*(shoe|shoes|sneaker|sneakers)|trail\s*(shoe|shoes)/.test(q)) return "running";
    if (/shoe|shoes|sneaker|sneakers|trainer|trainers|footwear|boot|boots|sandal|sandals|slipper|slippers|loafer|loafers/.test(q)) return "footwear";
    if (/pet\s*(feeder|feeding)|dog\s*(feeder|feeding)|cat\s*(feeder|feeding)|automatic\s*(feeder|feeding)|food\s*dispenser/.test(q)) return "pet-feeder";
    if (/filmora|capcut|video\s*editor|photo\s*editor|pdf\s*editor|software|app\b/.test(q)) return "software";
    if (/phone|tablet|laptop|computer|camera|projector|printer|earbud|headphone|charger|adapter|monitor|router|smartwatch/.test(q)) return "electronics";
    if (/sneaker|footwear/.test(cardText)) return "footwear";
    if (/pet feeder|automatic feeder|food dispenser/.test(cardText)) return "pet-feeder";
    return "generic";
  }

  function relevanceRule(query) {
    const q = lower(query);
    if (/pet\s*(feeder|feeding)|dog\s*(feeder|feeding)|cat\s*(feeder|feeding)|automatic\s*(feeder|feeding)|food\s*dispenser/.test(q)) {
      return {
        include: /(automatic\s*)?(pet|dog|cat)?\s*(food\s*)?(feeder|feeding\s*(bowl|station|machine)|food\s*dispenser|timed\s*feeder|portion\s*feeder|smart\s*feeder|pet\s*bowl)/i,
        exclude: /(spoon|jar opener|can opener|can lid|scoop|grooming|toy|leash|collar|poop|waste bag)/i,
      };
    }
    if (/wireless\s*carplay|carplay\s*(adapter|dongle|converter)/.test(q)) {
      return {
        include: /carplay/i,
        includeSecond: /(adapter|dongle|wireless|converter)/i,
        exclude: /(head unit|car radio|navigation screen|android radio|dash camera|rear camera)/i,
      };
    }
    if (/shoe|shoes|sneaker|sneakers|trainer|trainers|footwear|boot|boots|sandal|sandals|slipper|slippers|loafer|loafers/.test(q)) {
      return {
        include: /(shoe|shoes|sneaker|sneakers|trainer|trainers|footwear|boot|boots|sandal|sandals|slipper|slippers|loafer|loafers|heel|heels)/i,
      };
    }
    return null;
  }

  function filterIrrelevantCards(results, query) {
    const rule = relevanceRule(query);
    const cards = $$(".finder-products-group .offer-card", results);
    if (!rule || !cards.length) return cards.length;

    let visible = 0;
    cards.forEach((card) => {
      const text = clean(card.textContent);
      const included = rule.include ? rule.include.test(text) : true;
      const includedSecond = rule.includeSecond ? rule.includeSecond.test(text) : true;
      const excluded = rule.exclude ? rule.exclude.test(text) : false;
      const keep = included && includedSecond && !excluded;
      card.hidden = !keep;
      card.dataset.v9Filtered = keep ? "false" : "true";
      if (keep) visible += 1;
      const title = $("h3", card);
      if (title && !title.title) title.title = clean(title.textContent);
    });
    return visible;
  }

  function quickGuideMarkup(query, data) {
    const checks = data.checks.map((item, index) => `
      <article class="v9-guide-item">
        <span class="v9-guide-number" aria-hidden="true">${index + 1}</span>
        <div><strong>${item[0]}</strong><p>${item[1]}</p></div>
      </article>`).join("");

    return `
      <section class="v9-quick-guide" data-v9-quick-guide data-v9-query="${query.replace(/"/g, "&quot;")}">
        <p class="v9-guide-eyebrow">Quick buying guide</p>
        <h2>${data.title}</h2>
        <p class="v9-guide-intro">${data.intro}</p>
        <div class="v9-guide-grid">${checks}</div>
        <p class="v9-guide-next"><strong>Best next step:</strong> ${data.next}</p>
      </section>`;
  }

  function enhanceFinderResults() {
    if (!location.pathname.includes("/find")) return;
    const results = $("[data-finder-results]");
    const status = $("[data-finder-status]");
    if (!results || !status) return;

    const query = currentFinderQuery();
    if (!query) return;

    const productGroup = $(".finder-products-group", results);
    if (!productGroup) return;

    const visibleProducts = filterIrrelevantCards(results, query);
    const guideType = detectGuideType(query, productGroup);
    const data = GUIDE_TEMPLATES[guideType] || GUIDE_TEMPLATES.generic;
    const existing = $("[data-v9-quick-guide]", results);
    if (!existing || existing.dataset.v9Query !== query) {
      if (existing) existing.remove();
      productGroup.insertAdjacentHTML("beforebegin", quickGuideMarkup(query, data));
    }

    const staticGuides = $$(".finder-guide-card", results).length;
    const line = $("span", status) || status;
    const guidePhrase = staticGuides
      ? `1 quick guide, ${staticGuides} detailed ${staticGuides === 1 ? "guide" : "guides"}`
      : "1 quick buying guide";
    line.textContent = `${guidePhrase} and ${visibleProducts} relevant product ${visibleProducts === 1 ? "option" : "options"} found.`;

    if (!visibleProducts) {
      let notice = $("[data-v9-no-clean-match]", results);
      if (!notice) {
        notice = doc.createElement("div");
        notice.dataset.v9NoCleanMatch = "true";
        notice.className = "finder-empty-card";
        notice.innerHTML = `<h2>No close product match yet</h2><p>Try a more specific product name, model or use. Unrelated listings have been left out.</p>`;
        productGroup.insertAdjacentElement("afterend", notice);
      }
      productGroup.hidden = true;
    } else {
      productGroup.hidden = false;
      const notice = $("[data-v9-no-clean-match]", results);
      if (notice) notice.remove();
    }
  }

  let finderScheduled = false;
  function scheduleFinderEnhancement() {
    if (finderScheduled) return;
    finderScheduled = true;
    nextFrame(() => {
      finderScheduled = false;
      enhanceFinderResults();
      renderRecentSearches();
    });
  }

  function enhanceCompareDrawer() {
    const drawer = $("[data-compare-drawer]");
    if (!drawer) return;
    const head = $(".compare-drawer-head", drawer);
    const clearButton = $("[data-compare-clear]", drawer);
    if (!head || !clearButton) return;

    let actions = $(".v9-drawer-actions", head);
    if (!actions) {
      actions = doc.createElement("div");
      actions.className = "v9-drawer-actions";
      const toggle = doc.createElement("button");
      toggle.type = "button";
      toggle.className = "v9-drawer-toggle";
      toggle.dataset.v9DrawerToggle = "true";
      toggle.textContent = "Hide";
      toggle.setAttribute("aria-expanded", "true");
      actions.append(toggle, clearButton);
      head.append(actions);

      toggle.addEventListener("click", () => {
        const minimized = drawer.classList.toggle("is-minimized");
        toggle.textContent = minimized ? "Show" : "Hide";
        toggle.setAttribute("aria-expanded", String(!minimized));
        syncDrawerBodyState(drawer);
      });
    }

    syncDrawerBodyState(drawer);
  }

  function syncDrawerBodyState(drawer = $("[data-compare-drawer]")) {
    if (!drawer) return;
    const open = drawer.classList.contains("open");
    const minimized = drawer.classList.contains("is-minimized");
    doc.body.classList.toggle("has-open-compare", open);
    doc.body.classList.toggle("has-minimized-compare", open && minimized);
    if (!open && minimized) {
      drawer.classList.remove("is-minimized");
      const toggle = $("[data-v9-drawer-toggle]", drawer);
      if (toggle) {
        toggle.textContent = "Hide";
        toggle.setAttribute("aria-expanded", "true");
      }
    }
  }

  function wrapLongSection(heading) {
    if (!heading || heading.dataset.v9Folded === "true") return;
    const title = clean(heading.textContent);
    const details = doc.createElement("details");
    details.className = "v9-deep-guide";
    details.dataset.v9FoldedSection = "true";
    const summary = doc.createElement("summary");
    summary.textContent = title;
    const body = doc.createElement("div");
    body.className = "v9-deep-guide-body";

    heading.parentNode.insertBefore(details, heading);
    details.append(summary, body);
    heading.dataset.v9Folded = "true";
    heading.classList.add("v9-folded-heading");
    body.appendChild(heading);

    let node = details.nextSibling;
    while (node) {
      const next = node.nextSibling;
      if (node.nodeType === 1) {
        if (node.matches("h2, .inline-finder, .offer-section, [data-current-options]")) break;
      }
      body.appendChild(node);
      node = next;
    }
  }

  function foldLongEditorialSections() {
    const article = $(".article-content");
    if (!article) return;
    const patterns = [
      /five checks before ordering/i,
      /what to test during the return window/i,
      /sources checked/i,
      /detailed testing checklist/i,
    ];
    $$("h2", article).forEach((heading) => {
      if (patterns.some((pattern) => pattern.test(clean(heading.textContent)))) wrapLongSection(heading);
    });
  }

  const RECENT_KEY = "trendpilot_recent_searches_v9";
  function getRecentSearches() {
    try {
      const value = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
      return Array.isArray(value) ? value.filter(Boolean).slice(0, 5) : [];
    } catch (_) {
      return [];
    }
  }

  function saveRecentSearch(value) {
    const query = clean(value);
    if (!query) return;
    const unique = [query, ...getRecentSearches().filter((item) => lower(item) !== lower(query))].slice(0, 5);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(unique)); } catch (_) {}
  }

  function renderRecentSearches() {
    if (!location.pathname.includes("/find")) return;
    const form = $("[data-finder-form]");
    if (!form) return;
    let box = $("[data-v9-recent-searches]", form.parentElement || doc);
    const recents = getRecentSearches();
    if (!recents.length) {
      if (box) box.remove();
      return;
    }
    if (!box) {
      box = doc.createElement("div");
      box.className = "v9-recent-searches";
      box.dataset.v9RecentSearches = "true";
      form.insertAdjacentElement("afterend", box);
    }
    box.innerHTML = `<strong>Recent:</strong>${recents.map((item) => `<button type="button" class="v9-recent-chip" data-v9-recent-query="${item.replace(/"/g, "&quot;")}">${item}</button>`).join("")}`;
    $$('[data-v9-recent-query]', box).forEach((button) => {
      button.addEventListener("click", () => {
        const input = $("[data-finder-input]");
        if (!input) return;
        input.value = button.dataset.v9RecentQuery || "";
        input.focus();
        const searchForm = input.form || $("[data-finder-form]");
        if (searchForm) searchForm.requestSubmit();
      });
    });
  }

  function bindFinderHistory() {
    const form = $("[data-finder-form]");
    if (!form || form.dataset.v9HistoryBound === "true") return;
    form.dataset.v9HistoryBound = "true";
    form.addEventListener("submit", () => {
      const input = $("[data-finder-input]", form) || $("[data-finder-input]");
      if (input) saveRecentSearch(input.value);
    }, true);
  }

  function boot() {
    enhanceCompareDrawer();
    foldLongEditorialSections();
    bindFinderHistory();
    scheduleFinderEnhancement();
    renderRecentSearches();

    const drawer = $("[data-compare-drawer]");
    if (drawer) {
      new MutationObserver(() => {
        enhanceCompareDrawer();
        syncDrawerBodyState(drawer);
      }).observe(drawer, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
    }

    const results = $("[data-finder-results]");
    if (results) {
      new MutationObserver(scheduleFinderEnhancement).observe(results, { childList: true, subtree: true });
    }

    addEventListener("popstate", scheduleFinderEnhancement);
    addEventListener("resize", () => syncDrawerBodyState(), { passive: true });
  }

  if (doc.readyState === "loading") {
    doc.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
