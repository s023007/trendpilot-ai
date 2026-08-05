(() => {
  "use strict";
  const d = document;
  const cfg = window.TP_TICKETS_CONFIG || { providers: {}, destinations: {}, searchAliases: [] };
  const $ = (selector, root = d) => root.querySelector(selector);
  const $$ = (selector, root = d) => Array.from(root.querySelectorAll(selector));
  const clean = (value) => String(value ?? "").replace(/\s+/g, " ").trim();

  function isHttpUrl(value) {
    try {
      const url = new URL(clean(value));
      return url.protocol === "https:" || url.protocol === "http:";
    } catch (_) {
      return false;
    }
  }

  function providerConfig(id) {
    return cfg.providers && cfg.providers[id] ? cfg.providers[id] : null;
  }

  function destinationConfig(id) {
    return cfg.destinations && cfg.destinations[id] ? cfg.destinations[id] : null;
  }

  function buildTrackedUrl(providerId, destination, subid) {
    const provider = providerConfig(providerId);
    const target = clean(destination);
    if (!provider || !isHttpUrl(target)) return target || "#";
    const sample = clean(provider.sampleDeepLink);
    if (!isHttpUrl(sample)) return target;
    try {
      const tracked = new URL(sample);
      tracked.searchParams.set("subid", clean(subid).slice(0, 120) || `tp_${providerId}_tickets`);
      tracked.searchParams.set("ulp", target);
      return tracked.toString();
    } catch (_) {
      return target;
    }
  }

  function pushEvent(name, detail = {}) {
    const event = {
      event: name,
      event_category: "tickets",
      timestamp: new Date().toISOString(),
      ...detail
    };
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(event);
    try {
      const key = "tp_ticket_events_v2";
      const existing = JSON.parse(localStorage.getItem(key) || "[]");
      existing.push(event);
      localStorage.setItem(key, JSON.stringify(existing.slice(-120)));
    } catch (_) {}
  }

  function configureOutboundLink(link, destination, subid) {
    const provider = clean(link.dataset.provider || "ticombo");
    const target = clean(destination || link.dataset.destination || link.getAttribute("href"));
    const tag = clean(subid || link.dataset.subid || `tp_${provider}_ticket_link`);
    const tracked = buildTrackedUrl(provider, target, tag);
    const ready = Boolean(tracked && tracked !== target);
    link.href = tracked || target || "#";
    link.target = "_blank";
    link.rel = ready ? "sponsored nofollow noopener" : "noopener";
    link.dataset.trackingReady = ready ? "true" : "false";
    link.dataset.destination = target;
    link.dataset.subid = tag;
    if (link.dataset.boundClick !== "true") {
      link.dataset.boundClick = "true";
      link.addEventListener("click", () => {
        pushEvent("ticket_provider_click", {
          provider,
          subid: link.dataset.subid,
          destination: link.dataset.destination,
          tracking_ready: link.dataset.trackingReady === "true",
          page_path: location.pathname
        });
      });
    }
  }

  function prepareOutboundLinks() {
    $$('[data-ticket-outbound]').forEach((link) => {
      configureOutboundLink(link, link.dataset.destination, link.dataset.subid);
    });
    $$('[data-ticket-destination]').forEach((link) => {
      const id = clean(link.dataset.ticketDestination);
      const destination = destinationConfig(id);
      if (!destination) return;
      configureOutboundLink(link, destination.url, link.dataset.subid || `tp_ticombo_${id}_${clean(link.dataset.placement || "card")}`);
    });
  }

  function normalizeQuery(value) {
    return clean(value).toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9\s-]/g, " ").replace(/\s+/g, " ").trim();
  }

  function findSearchDestination(query) {
    const q = normalizeQuery(query);
    if (!q) return null;
    for (const row of cfg.searchAliases || []) {
      if ((row.terms || []).some((term) => q.includes(normalizeQuery(term)))) {
        return { row, destination: destinationConfig(row.destination), query: q };
      }
    }
    return { row: { destination: "all" }, destination: destinationConfig("all"), query: q, fallback: true };
  }

  function setupFinder() {
    const form = $('[data-ticket-finder]');
    const panel = $('[data-ticket-finder-result]');
    if (!form || !panel) return;
    const input = $('input[type="search"]', form);
    const title = $('[data-finder-title]', panel);
    const text = $('[data-finder-text]', panel);
    const badge = $('[data-finder-badge]', panel);
    const internal = $('[data-finder-internal]', panel);
    const outbound = $('[data-finder-outbound]', panel);

    function render() {
      const match = findSearchDestination(input ? input.value : "");
      if (!match || !match.destination) {
        panel.hidden = true;
        return;
      }
      panel.hidden = false;
      if (badge) badge.textContent = match.fallback ? "Broad search" : "Best starting page";
      if (title) title.textContent = match.destination.label;
      if (text) {
        text.textContent = match.fallback
          ? `We do not yet have an exact TrendPilot page for “${clean(input.value)}”. Start with all live events, then confirm the exact event before checkout.`
          : match.destination.description;
      }
      if (internal) {
        if (match.row.internal) {
          internal.hidden = false;
          internal.href = match.row.internal;
        } else {
          internal.hidden = true;
        }
      }
      if (outbound) {
        outbound.textContent = match.fallback ? "Search all live events ↗" : `Browse ${match.destination.label} ↗`;
        configureOutboundLink(outbound, match.destination.url, `tp_ticombo_search_${match.row.destination}_${match.fallback ? "fallback" : "matched"}`);
      }
      pushEvent("ticket_finder_result", {
        query: match.query,
        destination: match.row.destination,
        fallback: Boolean(match.fallback),
        page_path: location.pathname
      });
      panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      render();
    });
    if (input) {
      input.addEventListener("input", () => {
        if (!clean(input.value)) panel.hidden = true;
      });
    }
  }

  function setupSuggestions() {
    const form = $('[data-ticket-finder]');
    if (!form) return;
    const input = $('input[type="search"]', form);
    $$('[data-ticket-suggestion]').forEach((button) => {
      button.addEventListener("click", () => {
        if (input) input.value = clean(button.dataset.ticketSuggestion);
        if (typeof form.requestSubmit === "function") form.requestSubmit();
        else form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      });
    });
  }

  const assistantAdvice = {
    football: {
      budget: { zone: "Upper tier or corner", why: "Usually the first place to compare when the total budget matters most.", check: "Distance, stairs and restricted-view notes.", destination: "football" },
      balanced: { zone: "Long side, middle rows", why: "A practical starting point for following the whole match.", check: "Centre versus corner position and row height.", destination: "football" },
      close: { zone: "Lower tier", why: "Closer detail and stronger sense of the action.", check: "Very low rows can reduce the view of the far end.", destination: "football" },
      atmosphere: { zone: "Behind goal or supporter area", why: "Often a stronger crowd experience.", check: "Home/away restrictions and standing expectations.", destination: "football" },
      comfort: { zone: "Premium or hospitality", why: "Best starting point when access and amenities matter more than price.", check: "Exactly what food, lounge and entry benefits are included.", destination: "football" }
    },
    formula1: {
      budget: { zone: "General admission", why: "Often the first category to compare for a lower entry price.", check: "Standing areas, screen access and permitted viewing zones.", destination: "formula1" },
      balanced: { zone: "Standard grandstand", why: "A useful balance of assigned seating and circuit visibility.", check: "Which corners, braking zones or straights are visible.", destination: "formula1" },
      close: { zone: "Corner or braking-zone grandstand", why: "A better chance to see overtaking and car detail.", check: "Fence height, row position and included days.", destination: "formula1" },
      atmosphere: { zone: "Popular fan grandstand", why: "Crowd energy and nearby entertainment can matter as much as the view.", check: "Transport, entry gate and session schedule.", destination: "formula1" },
      comfort: { zone: "VIP or hospitality", why: "Suitable when food, shelter and premium access are priorities.", check: "Package inclusions and whether paddock access is actually included.", destination: "formula1" }
    },
    music: {
      budget: { zone: "Upper level or rear seating", why: "Often the lowest-price seated starting point.", check: "Distance, screen visibility and possible side/rear-stage wording.", destination: "music" },
      balanced: { zone: "Lower bowl, centred", why: "A useful mix of sound, stage view and comfort.", check: "Exact angle and whether the seat is side-stage.", destination: "music" },
      close: { zone: "Floor or front sections", why: "Best for proximity and performer detail.", check: "Standing rules, height differences and early-entry conditions.", destination: "music" },
      atmosphere: { zone: "Floor standing", why: "Often the most energetic experience.", check: "Age restrictions, queueing and personal comfort.", destination: "music" },
      comfort: { zone: "Premium seated or hospitality", why: "A calmer option with easier access and assigned seating.", check: "Lounge, food and parking inclusions.", destination: "music" }
    },
    theatre: {
      budget: { zone: "Upper circle", why: "Usually the first seated area to compare for lower prices.", check: "Legroom, stairs and restricted-view wording.", destination: "theatre" },
      balanced: { zone: "Front or middle circle", why: "Often gives a complete stage picture without stalls pricing.", check: "Overhang and side-angle notes.", destination: "theatre" },
      close: { zone: "Stalls", why: "Closer facial detail and immediacy.", check: "Very front rows can require looking upward.", destination: "theatre" },
      atmosphere: { zone: "Central stalls", why: "A strong sense of being inside the performance.", check: "Aisle position and audience participation warnings.", destination: "theatre" },
      comfort: { zone: "Premium central seating", why: "Best starting point for easy access and reliable sightlines.", check: "Seat width, access and interval facilities.", destination: "theatre" }
    }
  };

  function setupBookingAssistant() {
    const form = $('[data-booking-assistant]');
    const result = $('[data-booking-result]');
    if (!form || !result) return;
    const type = $('[name="eventType"]', form);
    const priority = $('[name="priority"]', form);
    const zone = $('[data-assistant-zone]', result);
    const why = $('[data-assistant-why]', result);
    const check = $('[data-assistant-check]', result);
    const button = $('[data-assistant-outbound]', result);

    function render() {
      const eventType = clean(type && type.value) || "football";
      const goal = clean(priority && priority.value) || "balanced";
      const advice = (assistantAdvice[eventType] || assistantAdvice.football)[goal] || assistantAdvice.football.balanced;
      if (zone) zone.textContent = advice.zone;
      if (why) why.textContent = advice.why;
      if (check) check.textContent = advice.check;
      const destination = destinationConfig(advice.destination);
      if (button && destination) {
        button.textContent = `Browse live ${destination.label.toLowerCase()} ↗`;
        configureOutboundLink(button, destination.url, `tp_ticombo_assistant_${eventType}_${goal}`);
      }
      result.hidden = false;
      pushEvent("ticket_assistant_update", { event_type: eventType, priority: goal, recommendation: advice.zone });
    }

    form.addEventListener("change", render);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      render();
      result.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
    render();
  }

  const seatAdvice = {
    budget: { title: "Upper tier or corner", tendency: "Usually lower", text: "Start here when price matters most. Confirm distance, access and restricted-view notes before paying." },
    balanced: { title: "Long side, middle rows", tendency: "Usually medium", text: "A useful balance for seeing both ends and understanding the shape of play." },
    close: { title: "Lower tier", tendency: "Usually higher", text: "Closer to players and detail, but very low rows can make the far end harder to read." },
    atmosphere: { title: "Behind goal / supporter area", tendency: "Varies", text: "Often energetic. Confirm home/away rules, standing expectations and the far-end view." },
    comfort: { title: "Premium / hospitality", tendency: "Usually highest", text: "Prioritises access and amenities. Verify every included service before comparing the total cost." }
  };

  function setupSeatChooser() {
    const chooser = $('[data-seat-chooser]');
    const result = $('[data-seat-choice-result]');
    if (!chooser || !result) return;
    const title = $('[data-seat-title]', result);
    const tendency = $('[data-seat-tendency]', result);
    const text = $('[data-seat-text]', result);
    $$('[data-seat-choice]', chooser).forEach((button) => {
      button.addEventListener("click", () => {
        const key = clean(button.dataset.seatChoice);
        const advice = seatAdvice[key] || seatAdvice.balanced;
        $$('[data-seat-choice]', chooser).forEach((item) => item.classList.toggle("is-selected", item === button));
        if (title) title.textContent = advice.title;
        if (tendency) tendency.textContent = advice.tendency;
        if (text) text.textContent = advice.text;
        pushEvent("ticket_seat_choice", { choice: key, recommendation: advice.title, page_path: location.pathname });
      });
    });
  }

  function setupStickyTicketAction() {
    const sticky = $('[data-ticket-sticky]');
    const heroAction = $('[data-ticket-hero-action]');
    if (!sticky || !heroAction || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(([entry]) => {
      sticky.classList.toggle("is-visible", !entry.isIntersecting);
    }, { threshold: 0.15 });
    observer.observe(heroAction);
  }

  function setYear() {
    $$('[data-year]').forEach((node) => { node.textContent = String(new Date().getFullYear()); });
  }

  function addActiveNavigationState() {
    if (!location.pathname.startsWith("/tickets")) return;
    $$('a[href="/tickets/"]').forEach((link) => link.classList.add("is-active"));
  }

  function exposeApi() {
    window.TrendPilotTickets = Object.freeze({ buildDeepLink: buildTrackedUrl, config: cfg });
  }

  function init() {
    prepareOutboundLinks();
    setupFinder();
    setupSuggestions();
    setupBookingAssistant();
    setupSeatChooser();
    setupStickyTicketAction();
    setYear();
    addActiveNavigationState();
    exposeApi();
    pushEvent("ticket_page_view", { page_path: location.pathname, provider_count: Object.keys(cfg.providers || {}).length });
  }

  if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
