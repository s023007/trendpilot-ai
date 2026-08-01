// TrendPilot AI v2.3.0 — compact filters and verified store browsing
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

  const SOURCE_META = {
    aliexpress: { tagline: "High-volume marketplace picks across everyday product categories.", colours: ["#ff6a65", "#ffb34d"] },
    alibaba: { tagline: "Supplier and product-detail opportunities with strict destination checks.", colours: ["#ff7a18", "#ffb347"] },
    joom: { tagline: "Marketplace products selected from Joom only after exact trend matching.", colours: ["#ff4465", "#705cff"] },
    geekbuying: { tagline: "Consumer electronics, smart home and maker products with precise product links.", colours: ["#ff4b3e", "#4c7cff"] },
    filamentpro: { tagline: "3D-printing filament and maker supplies from the verified EU catalogue.", colours: ["#20b26b", "#3c74ff"] },
    elevenlabs: { tagline: "Direct AI audio and voice products with a verified programme destination.", colours: ["#101828", "#22c55e"] }
  };

  function advertiserName(offer) {
    const raw = cleanName(offer?.advertiser || offer?.network || "Verified source");
    return raw.toLowerCase() === "true" ? "Geekbuying" : raw;
  }

  function sourceSlug(value) {
    return cleanName(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  function sourceMeta(name) {
    const key = sourceSlug(name).replace(/-/g, "");
    return SOURCE_META[key] || {
      tagline: "Verified products from this source that passed trend matching and destination checks.",
      colours: ["#6757f6", "#15bfae"]
    };
  }

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
    advertiser: advertiserName(offer),
    trendSlug: trend.slug,
    trendTitle: trend.title,
    trendCategory: trend.category
  })))).sort((a, b) => {
    return (Number(b.matchScore) || 0) - (Number(a.matchScore) || 0)
      || (Number(b.offerQuality) || 0) - (Number(a.offerQuality) || 0);
  });

  function buildSourceGroups(offers) {
    const groups = new Map();
    offers.forEach((offer) => {
      const name = advertiserName(offer);
      const slug = sourceSlug(name);
      if (!slug) return;
      if (!groups.has(slug)) groups.set(slug, { name, slug, offers: [], categories: new Set() });
      const group = groups.get(slug);
      group.offers.push(offer);
      const category = cleanName(offer.trendCategory || offer.category || "Other");
      if (category) group.categories.add(category);
    });
    return [...groups.values()].map((group) => ({
      ...group,
      categories: [...group.categories].sort(),
      offers: group.offers.sort((a, b) => (Number(b.matchScore) || 0) - (Number(a.matchScore) || 0) || (Number(b.offerQuality) || 0) - (Number(a.offerQuality) || 0))
    })).sort((a, b) => (Number(b.offers[0]?.matchScore) || 0) - (Number(a.offers[0]?.matchScore) || 0) || a.name.localeCompare(b.name));
  }

  const sourceGroups = buildSourceGroups(allOffers);
  const sourceShowcaseOffers = sourceGroups.map((group) => group.offers[0]).filter(Boolean);
  const bestDealOffers = allOffers.filter((offer) => {
    const price = Number(offer.price);
    const oldPrice = Number(offer.oldPrice);
    return Number(offer.discount) > 0 || (Number.isFinite(price) && price > 0 && Number.isFinite(oldPrice) && oldPrice > price);
  }).sort((a, b) => (Number(b.discount) || 0) - (Number(a.discount) || 0) || (Number(b.matchScore) || 0) - (Number(a.matchScore) || 0));

  function formatPrice(offer) {
    const rawPrice = offer.price;
    if (rawPrice === null || rawPrice === undefined || String(rawPrice).trim() === "") {
      return offer.direct ? "View plans" : "Check current price";
    }
    const price = Number(rawPrice);
    if (!Number.isFinite(price) || price <= 0) {
      return offer.direct ? "View plans" : "Check current price";
    }
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
    const advertiser = advertiserName(offer);
    const network = cleanName(offer.network);
    return network && network.toLowerCase() !== advertiser.toLowerCase() ? `${advertiser} • ${network}` : advertiser || "Verified product";
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

  function storeCard(group) {
    const meta = sourceMeta(group.name);
    const initials = escapeHtml(group.name.slice(0, 2).toUpperCase());
    const categoryChips = group.categories.slice(0, 3).map((category) => `<span>${escapeHtml(category)}</span>`).join("");
    const products = group.offers.slice(0, 3).map((offer) => `<li><span>✓</span><strong>${escapeHtml(offer.name)}</strong></li>`).join("");
    return `<article class="store-card reveal" style="--store-a:${escapeHtml(meta.colours[0])};--store-b:${escapeHtml(meta.colours[1])}">
      <div class="store-card-head"><div class="store-avatar">${initials}</div><div><span class="mini-label">Verified source</span><h3>${escapeHtml(group.name)}</h3></div><strong class="store-count">${group.offers.length}</strong></div>
      <p>${escapeHtml(meta.tagline)}</p>
      <div class="store-category-chips">${categoryChips || "<span>Published products</span>"}</div>
      <ul class="store-mini-products">${products}</ul>
      <a class="button button-outline store-card-action" href="store.html?store=${encodeURIComponent(group.slug)}">Explore ${escapeHtml(group.name)} →</a>
    </article>`;
  }

  function setupFilterDrawer({ toggle, drawer, backdrop, closeButton }) {
    if (!toggle || !drawer) return { close: () => {} };
    const close = () => {
      drawer.classList.remove("open");
      backdrop?.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
      drawer.setAttribute("aria-hidden", "true");
      document.body.classList.remove("drawer-open");
    };
    const open = () => {
      if (!window.matchMedia("(max-width: 760px)").matches) return;
      drawer.classList.add("open");
      backdrop?.classList.add("open");
      toggle.setAttribute("aria-expanded", "true");
      drawer.setAttribute("aria-hidden", "false");
      document.body.classList.add("drawer-open");
    };
    toggle.addEventListener("click", () => drawer.classList.contains("open") ? close() : open());
    closeButton?.addEventListener("click", close);
    backdrop?.addEventListener("click", close);
    document.addEventListener("keydown", (event) => { if (event.key === "Escape") close(); });
    window.addEventListener("resize", () => { if (!window.matchMedia("(max-width: 760px)").matches) close(); });
    return { close };
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
    window.addEventListener("scroll", () => {
      document.querySelector(".site-header")?.classList.toggle("scrolled", window.scrollY > 12);
      if (mainNav?.classList.contains("open")) close();
    }, { passive: true });
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

    const sourceGrid = document.getElementById("sourceOfferGrid");
    if (sourceGrid) {
      sourceGrid.innerHTML = sourceShowcaseOffers.length
        ? sourceShowcaseOffers.map((offer, index) => offerCard(offer, index + 1)).join("")
        : `<div class="safe-empty-card"><strong>No source has a published product yet</strong><span>A source appears here only after one exact product passes matching and link validation.</span></div>`;
    }

    const storeDirectory = document.getElementById("storeDirectoryGrid");
    if (storeDirectory) storeDirectory.innerHTML = sourceGroups.slice(0, 6).map(storeCard).join("");

    const dealSection = document.getElementById("bestDealsSection");
    const dealsGrid = document.getElementById("bestDealsGrid");
    if (dealSection && dealsGrid && bestDealOffers.length) {
      dealSection.classList.remove("hidden");
      dealsGrid.innerHTML = bestDealOffers.slice(0, 8).map((offer, index) => offerCard(offer, index + 1)).join("");
    }
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

    const drawer = setupFilterDrawer({
      toggle: document.getElementById("trendFilterToggle"),
      drawer: document.getElementById("trendFilterDrawer"),
      backdrop: document.getElementById("trendFilterBackdrop"),
      closeButton: document.getElementById("trendFilterClose")
    });

    let activeFilter = "All";
    const activeLabel = document.getElementById("trendActiveFilter");
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
      if (activeLabel) activeLabel.textContent = activeFilter;
      filters.querySelectorAll("button").forEach((entry) => entry.classList.toggle("active", entry === button));
      applyFilter();
      drawer.close();
    });
    search?.addEventListener("input", applyFilter);
  }

  function renderStoresDirectory() {
    const grid = document.getElementById("storeDirectoryPageGrid");
    if (!grid) return;
    grid.innerHTML = sourceGroups.map(storeCard).join("");
    document.getElementById("storeDirectoryEmpty")?.classList.toggle("hidden", sourceGroups.length > 0);
    const count = document.getElementById("verifiedStoreCount");
    if (count) count.textContent = String(sourceGroups.length);
  }

  function renderStorePage() {
    if (!document.getElementById("storePage")) return;
    const slug = sourceSlug(new URLSearchParams(location.search).get("store") || "");
    const group = sourceGroups.find((entry) => entry.slug === slug);
    if (!group) {
      location.replace("stores.html");
      return;
    }

    const meta = sourceMeta(group.name);
    document.title = `${group.name} Verified Products — TrendPilot AI`;
    const metaDescription = document.getElementById("metaDescription");
    if (metaDescription) metaDescription.content = `${group.offers.length} currently published verified products from ${group.name}.`;
    const avatar = document.getElementById("storeAvatar");
    if (avatar) {
      avatar.textContent = group.name.slice(0, 2).toUpperCase();
      avatar.style.setProperty("--store-a", meta.colours[0]);
      avatar.style.setProperty("--store-b", meta.colours[1]);
    }
    document.getElementById("storeName").textContent = group.name;
    document.getElementById("storeDescription").textContent = meta.tagline;
    document.getElementById("storePublishedCount").textContent = String(group.offers.length);
    document.getElementById("storeCategoryCount").textContent = String(group.categories.length);
    document.getElementById("storeTopName").textContent = group.name;
    document.getElementById("storeTopGrid").innerHTML = group.offers.slice(0, 3).map((offer, index) => offerCard(offer, index + 1)).join("");

    const filters = document.getElementById("storeFilters");
    const categories = ["All", ...group.categories];
    filters.innerHTML = categories.map((category, index) => `<button class="filter-button-v2${index === 0 ? " active" : ""}" type="button" data-filter="${escapeHtml(category)}">${escapeHtml(category)}</button>`).join("");
    const drawer = setupFilterDrawer({
      toggle: document.getElementById("storeFilterToggle"),
      drawer: document.getElementById("storeFilterDrawer"),
      backdrop: document.getElementById("storeFilterBackdrop"),
      closeButton: document.getElementById("storeFilterClose")
    });

    const grid = document.getElementById("storeProductGrid");
    const empty = document.getElementById("storeEmpty");
    const loadMore = document.getElementById("storeLoadMore");
    const resultCount = document.getElementById("storeResultCount");
    const search = document.getElementById("storeSearch");
    const sort = document.getElementById("storeSort");
    const activeLabel = document.getElementById("storeActiveFilter");
    let activeCategory = "All";
    let visibleLimit = 12;

    const filteredOffers = () => {
      const query = String(search.value || "").toLowerCase().trim();
      const mode = sort.value;
      let offers = group.offers.filter((offer) => {
        const category = cleanName(offer.trendCategory || offer.category || "Other");
        const searchText = [offer.name, category, offer.trendTitle, offer.advertiser].join(" ").toLowerCase();
        if (activeCategory !== "All" && category !== activeCategory) return false;
        if (query && !searchText.includes(query)) return false;
        const price = Number(offer.price);
        const oldPrice = Number(offer.oldPrice);
        if (mode === "under-25" && !(Number.isFinite(price) && price > 0 && price <= 25)) return false;
        if (mode === "deals" && !(Number(offer.discount) > 0 || (Number.isFinite(oldPrice) && Number.isFinite(price) && oldPrice > price && price > 0))) return false;
        return true;
      });
      if (mode === "best-value") offers = offers.sort((a, b) => (Number(b.discount) || 0) - (Number(a.discount) || 0) || (Number(b.matchScore) || 0) - (Number(a.matchScore) || 0));
      if (mode === "all") offers = offers.sort((a, b) => cleanName(a.name).localeCompare(cleanName(b.name)));
      return offers;
    };

    const renderProducts = (makeVisible = false) => {
      const offers = filteredOffers();
      const visible = offers.slice(0, visibleLimit);
      grid.innerHTML = visible.map((offer, index) => offerCard(offer, index + 1)).join("");
      resultCount.textContent = `${offers.length} verified product${offers.length === 1 ? "" : "s"}`;
      empty.classList.toggle("hidden", offers.length > 0);
      loadMore.classList.toggle("hidden", visibleLimit >= offers.length);
      bindImageFallbacks(grid);
      if (makeVisible) grid.querySelectorAll(".reveal").forEach((item) => item.classList.add("visible"));
    };

    filters.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-filter]");
      if (!button) return;
      activeCategory = button.dataset.filter;
      activeLabel.textContent = activeCategory;
      visibleLimit = 12;
      filters.querySelectorAll("button").forEach((entry) => entry.classList.toggle("active", entry === button));
      renderProducts(true);
      drawer.close();
    });
    search.addEventListener("input", () => { visibleLimit = 12; renderProducts(true); });
    sort.addEventListener("change", () => { visibleLimit = 12; renderProducts(true); });
    loadMore.addEventListener("click", () => { visibleLimit += 12; renderProducts(true); });
    renderProducts();
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
    renderStoresDirectory();
    renderStorePage();
    renderTrendDetail();
    renderLegacyPages();
    bindImageFallbacks();
    initialiseReveal();
    const year = document.getElementById("currentYear");
    if (year) year.textContent = String(new Date().getFullYear());
  });
})();
