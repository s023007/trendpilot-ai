(() => {
  "use strict";
  const d = document;
  const cfg = window.TP_TICKETS_CONFIG || { providers: {}, events: {} };
  const $ = (s, r = d) => r.querySelector(s);
  const $$ = (s, r = d) => Array.from(r.querySelectorAll(s));
  const clean = (v) => String(v ?? "").replace(/\s+/g, " ").trim();

  function providerConfig(id) {
    return cfg.providers && cfg.providers[id] ? cfg.providers[id] : null;
  }

  function isHttpUrl(value) {
    try {
      const url = new URL(clean(value));
      return url.protocol === "https:" || url.protocol === "http:";
    } catch (_) {
      return false;
    }
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
      const key = "tp_ticket_events_v1";
      const old = JSON.parse(localStorage.getItem(key) || "[]");
      old.push(event);
      localStorage.setItem(key, JSON.stringify(old.slice(-100)));
    } catch (_) {}
  }

  function prepareOutboundLinks() {
    $$('[data-ticket-outbound]').forEach((link) => {
      const provider = clean(link.dataset.provider);
      const destination = clean(link.dataset.destination || link.getAttribute("href"));
      const subid = clean(link.dataset.subid || `tp_${provider}_ticket_link`);
      const tracked = buildTrackedUrl(provider, destination, subid);
      const ready = tracked && tracked !== destination;
      link.href = tracked || destination || "#";
      link.target = "_blank";
      link.rel = ready ? "sponsored nofollow noopener" : "noopener";
      link.dataset.trackingReady = ready ? "true" : "false";
      link.addEventListener("click", () => {
        pushEvent("ticket_provider_click", {
          provider,
          subid,
          destination,
          tracking_ready: ready,
          page_path: location.pathname
        });
      });
    });
  }

  function setupTicketSearch() {
    const form = $('[data-ticket-search]');
    const cards = $$('[data-ticket-card]');
    const empty = $('[data-ticket-empty]');
    if (!form || !cards.length) return;
    const input = $('input[type="search"]', form);
    const filter = () => {
      const q = clean(input && input.value).toLowerCase();
      let visible = 0;
      cards.forEach((card) => {
        const haystack = clean(card.dataset.searchText || card.textContent).toLowerCase();
        const show = !q || haystack.includes(q);
        card.hidden = !show;
        if (show) visible += 1;
      });
      if (empty) empty.hidden = visible !== 0;
      pushEvent("ticket_search", { query: q, result_count: visible, page_path: location.pathname });
    };
    form.addEventListener("submit", (e) => { e.preventDefault(); filter(); });
    if (input) input.addEventListener("input", () => {
      if (!clean(input.value)) {
        cards.forEach((card) => { card.hidden = false; });
        if (empty) empty.hidden = true;
      }
    });
  }

  const seatAdvice = {
    budget: {
      title: "Upper tier",
      text: "Usually the first area to check for a lower headline price and a wide view. Confirm distance, access and any restricted-view note."
    },
    balanced: {
      title: "Long side or middle tier",
      text: "A useful starting point for following the whole playing area. Compare centre, corner and row height before paying more for a broad category label."
    },
    close: {
      title: "Lower tier",
      text: "Prioritise a row with a clear sightline rather than distance alone. Very low seats can feel close while making the far end harder to read."
    },
    atmosphere: {
      title: "Behind goal or designated supporter area",
      text: "These areas can offer strong energy, but verify home/away restrictions, standing expectations and the view toward the far end."
    },
    comfort: {
      title: "Hospitality or premium seating",
      text: "Check exactly what the package includes—seat, lounge access, food, parking and entry rules—because hospitality labels vary by venue."
    }
  };

  function setupSeatHelper() {
    const form = $('[data-seat-helper]');
    const result = $('[data-seat-result]');
    if (!form || !result) return;
    const render = (value) => {
      const advice = seatAdvice[value] || seatAdvice.budget;
      const title = $('h3', result);
      const text = $('p', result);
      if (title) title.textContent = advice.title;
      if (text) text.textContent = advice.text;
      pushEvent("ticket_seat_helper", { priority: value, recommendation: advice.title });
    };
    form.addEventListener("change", (e) => {
      if (e.target && e.target.name === "priority") render(e.target.value);
    });
  }

  function addActiveNavigationState() {
    if (!location.pathname.startsWith("/tickets")) return;
    $$('a[href="/tickets/"]').forEach((link) => link.classList.add("is-active"));
  }

  function setYear() {
    $$('[data-year]').forEach((el) => { el.textContent = String(new Date().getFullYear()); });
  }

  function exposeTicketLinkBuilder() {
    window.TrendPilotTickets = Object.freeze({
      buildDeepLink: buildTrackedUrl,
      config: cfg
    });
  }

  function init() {
    prepareOutboundLinks();
    setupTicketSearch();
    setupSeatHelper();
    addActiveNavigationState();
    setYear();
    exposeTicketLinkBuilder();
    pushEvent("ticket_page_view", { page_path: location.pathname, provider_count: Object.keys(cfg.providers || {}).length });
  }

  if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
