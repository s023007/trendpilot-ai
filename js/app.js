// TrendPilot AI v2.0.0 — bright product-first public experience
(() => {
  "use strict";

  const tools = window.TRENDPILOT_TOOLS || [];
  const staticTrends = window.TRENDPILOT_TRENDS || [];
  const discoveredTrends = window.TRENDPILOT_DISCOVERED_TRENDS || [];
  const networks = window.TRENDPILOT_NETWORKS || [];
  const affiliateLinks = window.TRENDPILOT_LINKS || {};
  const feedMatches = window.TRENDPILOT_MATCHED_PRODUCTS || {};
  const feedMeta = window.TRENDPILOT_MATCHED_PRODUCTS_META || {};

  const trendMap = new Map();
  [...staticTrends, ...discoveredTrends].forEach((trend) => {
    if (trend && trend.slug) trendMap.set(trend.slug, trend);
  });
  const allTrends = [...trendMap.values()];

  const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;"
  }[char]));
  const validHttpUrl = (value) => /^https?:\/\//i.test(String(value || "").trim());
  const competitionLabel = (value) => Number(value) < 50 ? "Low" : Number(value) < 70 ? "Medium" : "High";
  const cleanName = (value) => String(value || "").replace(/\s+/g, " ").trim();

  function directOffersForTrend(trend) {
    return (trend.products || []).map((slug) => {
      const tool = tools.find((entry) => entry.slug === slug);
      if (!tool) return null;
      const record = affiliateLinks[slug] || {};
      const url = record.affiliateUrl || tool.productUrl;
      if (!validHttpUrl(url)) return null;
      return {
        id: `direct-${slug}`,
        name: tool.name,
        url,
        productUrl: tool.productUrl || url,
        image: tool.image || "",
        initials: tool.initials || tool.name.slice(0, 2).toUpperCase(),
        colours: tool.colours || ["#6d5dfc", "#20c9b5"],
        advertiser: tool.name,
        network: tool.network || "Direct",
        category: tool.category || trend.category,
        currency: "",
        price: null,
        oldPrice: null,
        matchScore: 100,
        offerQuality: 100,
        discount: 0,
        commissionRate: null,
        direct: true
      };
    }).filter(Boolean);
  }

  function feedOffersForTrend(trend) {
    return (feedMatches[trend.slug] || []).filter((product) => {
      return product && cleanName(product.name) && validHttpUrl(product.url);
    }).map((product) => ({ ...product, direct: false }));
  }

  function dedupeOffers(offers) {
    const seen = new Set();
    return offers.filter((offer) => {
      const key = String(offer.canonicalKey || offer.productUrl || offer.url || offer.id || offer.name).toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function rankedOffersForTrend(trend) {
    return dedupeOffers([...directOffersForTrend(trend), ...feedOffersForTrend(trend)]).sort((a, b) => {
      return (Number(b.matchScore) || 0) - (Number(a.matchScore) || 0)
        || (Number(b.offerQuality) || 0) - (Number(a.offerQuality) || 0)
        || (Number(b.discount) || 0) - (Number(a.discount) || 0)
        || (Number(b.commissionRate) || 0) - (Number(a.commissionRate) || 0);
    });
  }

  const publicTrends = allTrends.map((trend) => ({
    ...trend,
    verifiedOffers: rankedOffersForTrend(trend)
  })).filter((trend) => trend.verifiedOffers.length > 0).sort((a, b) => {
    const aBest = Number(a.verifiedOffers[0]?.matchScore) || 0;
    const bBest = Number(b.verifiedOffers[0]?.matchScore) || 0;
    return bBest - aBest || (Number(b.score) || 0) - (Number(a.score) || 0);
  });

  const allOffers = dedupeOffers(publicTrends.flatMap((trend) => trend.verifiedOffers.map((offer) => ({
    ...offer,
    trendSlug: trend.slug,
    trendTitle: trend.title,
    trendCategory: trend.category
  })))).sort((a, b) => {
    return (Number(b.matchScore) || 0) - (Number(a.matchScore) || 0)
      || (Number(b.offerQuality) || 0) - (Number(a.offerQuality) || 0);
  });

  function formatPrice(offer) {
    const price = Number(offer.price);
    if (!Number.isFinite(price) || price < 0) return "Check current price";
    return `${offer.currency || "USD"} ${price.toFixed(2)}`;
  }

  function mediaMarkup(offer, context = "card") {
    const initials = escapeHtml(offer.initials || cleanName(offer.name).slice(0, 2).toUpperCase() || "TP");
    const fallbackStyle = offer.colours
      ? ` style="--media-a:${escapeHtml(offer.colours[0])};--media-b:${escapeHtml(offer.colours[1])}"`
      : "";
    const img = validHttpUrl(offer.image)
      ? `<img src="${escapeHtml(offer.image)}" alt="${escapeHtml(offer.name)}" loading="lazy" referrerpolicy="no-referrer" data-product-image>`
      : "";
    return `<div class="offer-media offer-media-${escapeHtml(context)}"${fallbackStyle}>${img}<span class="offer-media-fallback">${initials}</span></div>`;
  }

  function bindImageFallbacks(root = document) {
    root.querySelectorAll("img[data-product-image]").forEach((image) => {
      const reveal = () => image.closest(".offer-media")?.classList.add("image-ready");
      if (image.complete && image.naturalWidth > 0) reveal();
      image.addEventListener("load", reveal, { once: true });
      image.addEventListener("error", () => image.remove(), { once: true });
    });
  }

  function sourceLabel(offer) {
    return [offer.advertiser, offer.network].filter(Boolean).join(" • ") || "Verified product";
  }

  function offerCard(offer, rank = 0) {
    const oldPrice = Number(offer.oldPrice);
    const price = Number(offer.price);
    const showOld = Number.isFinite(oldPrice) && Number.isFinite(price) && oldPrice > price;
    const discount = Number(offer.discount) > 0 ? `<span class="discount-chip">-${Math.round(Number(offer.discount))}%</span>` : "";
    return `<article class="offer-card reveal">
      <a class="offer-card-media-link" href="${escapeHtml(offer.url)}" target="_blank" rel="sponsored nofollow noopener" aria-label="Open ${escapeHtml(offer.name)}">
        ${mediaMarkup(offer, "product")}
        ${rank ? `<span class="offer-rank">#${rank}</span>` : ""}
        <span class="verified-corner">✓ Direct product</span>
      </a>
      <div class="offer-card-body">
        <div class="offer-source-row"><span>${escapeHtml(sourceLabel(offer))}</span>${discount}</div>
        <h3>${escapeHtml(offer.name)}</h3>
        <div class="offer-card-footer">
          <div class="price-block"><strong>${escapeHtml(formatPrice(offer))}</strong>${showOld ? `<del>${escapeHtml(offer.currency || "USD")} ${oldPrice.toFixed(2)}</del>` : ""}</div>
          <a class="round-action" href="${escapeHtml(offer.url)}" target="_blank" rel="sponsored nofollow noopener" aria-label="Open product">↗</a>
        </div>
        <div class="quality-line"><span>Match ${Math.round(Number(offer.matchScore) || 0)}</span><i style="--quality:${Math.max(0, Math.min(100, Number(offer.matchScore) || 0))}%"></i></div>
      </div>
    </article>`;
  }

  function trendCard(trend) {
    const offer = trend.verifiedOffers[0];
    const offerCount = trend.verifiedOffers.length;
    return `<article class="verified-trend-card reveal" data-category="${escapeHtml(trend.category || "Other")}" data-search="${escapeHtml([trend.title, trend.category, trend.summary, offer.name, offer.advertiser, ...(trend.keywords || [])].join(" ").toLowerCase())}">
      <a class="trend-card-media" href="trend.html?trend=${encodeURIComponent(trend.slug)}">
        ${mediaMarkup(offer, "trend")}
        <span class="trend-stage-v2">${escapeHtml(trend.stage || "Trending")}</span>
        <span class="trend-score-v2">${Math.round(Number(trend.score) || 0)}</span>
      </a>
      <div class="trend-card-body-v2">
        <span class="mini-label">${escapeHtml(trend.category || "Product")}</span>
        <h3><a href="trend.html?trend=${encodeURIComponent(trend.slug)}">${escapeHtml(trend.title)}</a></h3>
        <p>${escapeHtml(trend.summary || "A verified product trend with reachable offers.")}</p>
        <div class="best-product-line"><span>Best match</span><strong>${escapeHtml(offer.name)}</strong></div>
        <div class="trend-card-footer-v2"><span>✓ ${offerCount} verified offer${offerCount === 1 ? "" : "s"}</span><a href="trend.html?trend=${encodeURIComponent(trend.slug)}">Explore →</a></div>
      </div>
    </article>`;
  }

  function initialiseMenu() {
    const menuButton = document.getElementById("menuButton");
    const mainNav = document.getElementById("mainNav");
    const close = () => {
      mainNav?.classList.remove("open");
      menuButton?.setAttribute("aria-expanded", "false");
    };
    menuButton?.addEventListener("click", (event) => {
      event.stopPropagation();
      const open = mainNav?.classList.toggle("open");
      menuButton.setAttribute("aria-expanded", String(Boolean(open)));
    });
    mainNav?.addEventListener("click", (event) => {
      if (event.target.closest("a")) close();
    });
    document.addEventListener("click", (event) => {
      if (mainNav?.classList.contains("open") && !mainNav.contains(event.target) && !menuButton?.contains(event.target)) close();
    });
    window.addEventListener("scroll", () => document.querySelector(".site-header")?.classList.toggle("scrolled", window.scrollY > 12), { passive: true });
  }

  function initialiseReveal() {
    const items = document.querySelectorAll(".reveal");
    if (!("IntersectionObserver" in window)) {
      items.forEach((item) => item.classList.add("visible"));
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    items.forEach((item) => observer.observe(item));
  }

  function renderHome() {
    const gallery = document.getElementById("heroProductGallery");
    if (gallery) {
      gallery.innerHTML = allOffers.slice(0, 3).map((offer, index) => `<a class="gallery-card gallery-card-${index + 1}" href="${escapeHtml(offer.url)}" target="_blank" rel="sponsored nofollow noopener">
        ${mediaMarkup(offer, "gallery")}
        <div><span>${escapeHtml(offer.trendTitle || offer.category || "Trending product")}</span><strong>${escapeHtml(offer.name)}</strong><small>${escapeHtml(formatPrice(offer))} · ${escapeHtml(offer.advertiser || "Verified")}</small></div>
      </a>`).join("") || `<div class="safe-empty-card"><strong>Verified products are updating</strong><span>The public list will appear only after exact product links pass validation.</span></div>`;
    }

    const stats = document.getElementById("liveStats");
    if (stats) {
      const sources = new Set(allOffers.map((offer) => offer.advertiser || offer.network).filter(Boolean));
      stats.innerHTML = `<div><strong>${publicTrends.length}</strong><span>verified trends</span></div><div><strong>${allOffers.length}</strong><span>reachable offers</span></div><div><strong>${sources.size}</strong><span>connected advertisers</span></div><div><strong>0</strong><span>blank product buttons</span></div>`;
    }

    const homeGrid = document.getElementById("homeTrendGrid");
    if (homeGrid) homeGrid.innerHTML = publicTrends.slice(0, 6).map(trendCard).join("");

    const offersGrid = document.getElementById("topOffersGrid");
    if (offersGrid) offersGrid.innerHTML = allOffers.slice(0, 8).map((offer, index) => offerCard(offer, index + 1)).join("");
  }

  function renderTrendsPage() {
    const grid = document.getElementById("trendGrid");
    if (!grid) return;
    grid.innerHTML = publicTrends.map(trendCard).join("");
    const count = document.getElementById("verifiedTrendCount");
    if (count) count.textContent = String(publicTrends.length);

    const categories = ["All", ...new Set(publicTrends.map((trend) => trend.category || "Other"))];
    const filters = document.getElementById("trendFilters");
    if (filters) filters.innerHTML = categories.map((category, index) => `<button class="filter-button-v2${index === 0 ? " active" : ""}" type="button" data-filter="${escapeHtml(category)}">${escapeHtml(category)}</button>`).join("");

    let activeFilter = "All";
    const search = document.getElementById("trendSearch");
    const applyFilter = () => {
      const query = String(search?.value || "").toLowerCase().trim();
      let shown = 0;
      grid.querySelectorAll(".verified-trend-card").forEach((card) => {
        const visible = (activeFilter === "All" || card.dataset.category === activeFilter) && (card.dataset.search || "").includes(query);
        card.classList.toggle("hidden", !visible);
        if (visible) shown += 1;
      });
      document.getElementById("trendEmpty")?.classList.toggle("hidden", shown > 0);
    };
    filters?.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-filter]");
      if (!button) return;
      activeFilter = button.dataset.filter;
      filters.querySelectorAll("button").forEach((entry) => entry.classList.toggle("active", entry === button));
      applyFilter();
    });
    search?.addEventListener("input", applyFilter);
  }

  function renderTrendDetail() {
    if (!document.getElementById("trendPage")) return;
    const slug = new URLSearchParams(location.search).get("trend");
    const trend = publicTrends.find((entry) => entry.slug === slug);
    if (!trend) {
      location.replace("trends.html");
      return;
    }
    const offers = trend.verifiedOffers;
    const best = offers[0];
    document.title = `${trend.title} — Verified Products | TrendPilot AI`;
    const meta = document.getElementById("metaDescription");
    if (meta) meta.content = trend.summary || `Verified products for ${trend.title}.`;

    document.getElementById("trendCategory").textContent = trend.category || "Product trend";
    document.getElementById("trendTitle").textContent = trend.title;
    document.getElementById("trendSummary").textContent = trend.summary || "A verified product opportunity.";
    document.getElementById("whyNow").textContent = trend.whyNow || trend.summary || "Demand and product availability are being tracked.";
    document.getElementById("monetisationNote").textContent = `${offers.length} precise product offer${offers.length === 1 ? "" : "s"} currently published.`;

    const media = document.getElementById("trendHeroMedia");
    media.innerHTML = `${mediaMarkup(best, "hero")}<div class="hero-media-caption"><span>Best ranked offer</span><strong>${escapeHtml(best.name)}</strong><small>${escapeHtml(sourceLabel(best))}</small></div>`;

    document.getElementById("bestOfferSummary").innerHTML = `<div><span>Current best match</span><strong>${escapeHtml(best.name)}</strong></div><div><span>Catalogue price</span><strong>${escapeHtml(formatPrice(best))}</strong></div><div><span>Match score</span><strong>${Math.round(Number(best.matchScore) || 0)}/100</strong></div>`;

    const actions = document.getElementById("trendHeroActions");
    const publicSource = validHttpUrl(trend.sourceUrl) && !String(trend.sourceUrl).startsWith(location.origin);
    actions.innerHTML = `<a class="button button-primary" href="${escapeHtml(best.url)}" target="_blank" rel="sponsored nofollow noopener">Open best product ↗</a>${publicSource ? `<a class="button button-outline" href="${escapeHtml(trend.sourceUrl)}" target="_blank" rel="noopener">Why this is trending</a>` : ""}`;

    document.getElementById("trendOffers").innerHTML = offers.map((offer, index) => offerCard(offer, index + 1)).join("");
    document.getElementById("trendSummaryPanel").innerHTML = `<span class="verified-pill">✓ Product links published</span><div><span>Opportunity score</span><strong>${Math.round(Number(trend.score) || 0)}/100</strong></div><div><span>Verified offers</span><strong>${offers.length}</strong></div><div><span>Competition</span><strong>${competitionLabel(trend.competition)}</strong></div><div><span>Confidence</span><strong>${escapeHtml(trend.confidence || "Measured")}</strong></div>`;

    const scoreRows = [
      ["Momentum", trend.momentum],
      ["Buyer intent", trend.buyerIntent],
      ["Low competition advantage", 100 - Number(trend.competition || 0)],
      ["Affiliate coverage", trend.affiliateCoverage],
      ["Content depth", trend.contentDepth]
    ];
    document.getElementById("scoreBreakdown").innerHTML = scoreRows.map(([label, value]) => `<div class="score-row-v2"><span>${escapeHtml(label)}</span><div><i style="--value:${Math.max(0, Math.min(100, Number(value) || 0))}%"></i></div><strong>${Math.round(Number(value) || 0)}</strong></div>`).join("");
    document.getElementById("trendKeywords").innerHTML = (trend.keywords || []).map((item) => `<span>${escapeHtml(item)}</span>`).join("");
    document.getElementById("trendAngles").innerHTML = (trend.angles || []).map((item) => `<article><span>Content angle</span><strong>${escapeHtml(item)}</strong></article>`).join("");
  }

  // Keep the existing tool, programme and network pages operational.
  function renderLegacyPages() {
    document.querySelectorAll("[data-affiliate-key]").forEach((link) => {
      const record = affiliateLinks[link.dataset.affiliateKey];
      const url = record?.affiliateUrl || record?.productUrl;
      if (!validHttpUrl(url)) return;
      link.href = url;
      link.target = "_blank";
      link.rel = "sponsored nofollow noopener";
    });

    const connectorGrid = document.getElementById("connectorGrid");
    if (connectorGrid) connectorGrid.innerHTML = networks.map((network) => `<article class="connector-card"><div class="connector-head"><div><span class="mini-label">${escapeHtml(network.type)}</span><h3>${escapeHtml(network.name)}</h3></div><span class="connector-status ${escapeHtml(network.statusClass)}">${escapeHtml(network.status)}</span></div><p>${escapeHtml(network.note)}</p><div class="connector-facts"><div><span>Coverage</span><strong>${escapeHtml(network.coverage)}</strong></div><div><span>Automation</span><strong>${escapeHtml(network.automation)}</strong></div><div><span>Credential rule</span><strong>${escapeHtml(network.secretNeeded)}</strong></div></div>${validHttpUrl(network.url) ? `<a class="button button-small button-outline" href="${escapeHtml(network.url)}" target="_blank" rel="noopener">Open official site</a>` : ""}</article>`).join("");

    const cardsHtml = (items) => items.map((tool) => `<article class="tool-card reveal" style="--tool-a:${escapeHtml(tool.colours?.[0] || "#6d5dfc")};--tool-b:${escapeHtml(tool.colours?.[1] || "#20c9b5")}" data-category="${escapeHtml(tool.category)}" data-search="${escapeHtml((tool.name + " " + tool.tagline + " " + tool.bestFor).toLowerCase())}"><div class="tool-top"><div class="tool-logo">${escapeHtml(tool.initials)}</div><div class="tool-name"><strong>${escapeHtml(tool.name)}</strong><small>${escapeHtml(tool.category)}</small></div><span class="tool-badge">${escapeHtml(tool.badge)}</span></div><p class="tool-description">${escapeHtml(tool.tagline)}</p><div class="programme-preview"><div><span>Commission</span><strong>${escapeHtml(tool.commission)}</strong></div><div><span>Cookie</span><strong>${escapeHtml(tool.cookie)}</strong></div></div><div class="tool-score-row"><span>TrendPilot opportunity score</span><strong class="tool-score">${escapeHtml(tool.score)}</strong></div><div class="tool-footer"><span>Verified ${escapeHtml(tool.verified)}</span><a class="tool-action" href="tool.html?tool=${encodeURIComponent(tool.slug)}">View details →</a></div></article>`).join("");

    const toolsGrid = document.getElementById("toolsGrid");
    if (toolsGrid) toolsGrid.innerHTML = cardsHtml(tools);

    const programmeGrid = document.getElementById("programmeGrid");
    if (programmeGrid) programmeGrid.innerHTML = tools.map((tool) => `<article class="programme-card" data-category="${escapeHtml(tool.category)}" data-search="${escapeHtml((tool.name + " " + tool.commission + " " + tool.network + " " + tool.bestFor).toLowerCase())}"><div class="programme-card-head"><div class="tool-logo" style="--tool-a:${escapeHtml(tool.colours?.[0] || "#6d5dfc")};--tool-b:${escapeHtml(tool.colours?.[1] || "#20c9b5")}">${escapeHtml(tool.initials)}</div><div><h3>${escapeHtml(tool.name)}</h3><p>${escapeHtml(tool.category)} • ${escapeHtml(tool.network)}</p></div><span class="tool-badge">${escapeHtml(tool.badge)}</span></div><div class="programme-facts"><div><span>Commission</span><strong>${escapeHtml(tool.commission)}</strong></div><div><span>Duration</span><strong>${escapeHtml(tool.duration)}</strong></div><div><span>Cookie</span><strong>${escapeHtml(tool.cookie)}</strong></div></div><p>${escapeHtml(tool.programmeNote)}</p><div class="programme-actions"><a class="button button-small button-outline" href="tool.html?tool=${encodeURIComponent(tool.slug)}">Read analysis</a>${validHttpUrl(tool.applicationUrl) ? `<a class="button button-small button-primary" href="${escapeHtml(tool.applicationUrl)}" target="_blank" rel="noopener">Apply officially</a>` : ""}</div></article>`).join("");

    if (document.getElementById("toolPage")) {
      const slug = new URLSearchParams(location.search).get("tool");
      const tool = tools.find((item) => item.slug === slug) || tools[0];
      if (tool) {
        document.title = `${tool.name} Affiliate Programme — TrendPilot AI`;
        const meta = document.getElementById("metaDescription"); if (meta) meta.content = tool.description;
        const logo = document.getElementById("toolLogo"); if (logo) { logo.textContent = tool.initials; logo.style.setProperty("--tool-a", tool.colours[0]); logo.style.setProperty("--tool-b", tool.colours[1]); }
        const values = { toolCategory: tool.category, toolName: tool.name, toolDescription: tool.description, bestFor: tool.bestFor, programmeNote: tool.programmeNote };
        Object.entries(values).forEach(([id, value]) => { const el = document.getElementById(id); if (el) el.textContent = value; });
        const summary = document.getElementById("summary"); if (summary) summary.innerHTML = `<span class="status-chip">Verified ${escapeHtml(tool.verified)}</span><div><span>Commission</span><strong>${escapeHtml(tool.commission)}</strong></div><div><span>Duration</span><strong>${escapeHtml(tool.duration)}</strong></div><div><span>Cookie window</span><strong>${escapeHtml(tool.cookie)}</strong></div><div><span>Tracking platform</span><strong>${escapeHtml(tool.network)}</strong></div>`;
        const pros = document.getElementById("pros"); if (pros) pros.innerHTML = tool.pros.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
        const angles = document.getElementById("angles"); if (angles) angles.innerHTML = tool.angles.map((item) => `<article><span>Content angle</span><strong>${escapeHtml(item)}</strong></article>`).join("");
        const record = affiliateLinks[tool.slug] || {};
        const visitUrl = record.affiliateUrl || tool.productUrl;
        const visit = document.getElementById("visitTool"); if (visit && validHttpUrl(visitUrl)) { visit.textContent = `Visit ${tool.name}`; visit.href = visitUrl; visit.target = "_blank"; visit.rel = "sponsored nofollow noopener"; }
        const apply = document.getElementById("applyProgramme"); if (apply && validHttpUrl(tool.applicationUrl)) { apply.href = tool.applicationUrl; apply.target = "_blank"; apply.rel = "noopener"; }
        const source = document.getElementById("sourceLink"); if (source && validHttpUrl(tool.sourceUrl)) source.href = tool.sourceUrl;
      }
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    initialiseMenu();
    renderHome();
    renderTrendsPage();
    renderTrendDetail();
    renderLegacyPages();
    bindImageFallbacks();
    initialiseReveal();
    const year = document.getElementById("currentYear");
    if (year) year.textContent = String(new Date().getFullYear());
  });
})();
