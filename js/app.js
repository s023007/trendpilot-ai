document.addEventListener("DOMContentLoaded", () => {
  const tools = window.TRENDPILOT_TOOLS || [];
  const staticTrends = window.TRENDPILOT_TRENDS || [];
  const discoveredTrends = window.TRENDPILOT_DISCOVERED_TRENDS || [];
  const trendMap = new Map();
  [...staticTrends, ...discoveredTrends].forEach((trend) => {
    if (trend?.slug) trendMap.set(trend.slug, trend);
  });
  const trends = [...trendMap.values()].sort((a, b) => (b.score || 0) - (a.score || 0));
  const networks = window.TRENDPILOT_NETWORKS || [];
  const affiliateLinks = window.TRENDPILOT_LINKS || {};
  const feedMatches = window.TRENDPILOT_MATCHED_PRODUCTS || {};
  const feedMeta = window.TRENDPILOT_MATCHED_PRODUCTS_META || {};

  const menuButton = document.getElementById("menuButton");
  const mainNav = document.getElementById("mainNav");
  const closeMenu = () => {
    mainNav?.classList.remove("open");
    menuButton?.setAttribute("aria-expanded", "false");
  };
  menuButton?.addEventListener("click", (event) => {
    event.stopPropagation();
    const open = mainNav?.classList.toggle("open");
    menuButton.setAttribute("aria-expanded", String(Boolean(open)));
  });
  mainNav?.addEventListener("click", (event) => {
    if (event.target.matches("a")) closeMenu();
  });
  document.addEventListener("click", (event) => {
    if (mainNav?.classList.contains("open") && !mainNav.contains(event.target) && !menuButton?.contains(event.target)) closeMenu();
  });
  window.addEventListener("scroll", () => document.querySelector(".site-header")?.classList.toggle("scrolled", window.scrollY > 16));
  document.querySelectorAll(".reveal").forEach((el) => el.classList.add("visible"));

  document.querySelectorAll("[data-affiliate-key]").forEach((link) => {
    const record = affiliateLinks[link.dataset.affiliateKey];
    if (!record) return;
    link.href = record.affiliateUrl || record.productUrl;
    link.target = "_blank";
    link.rel = "sponsored nofollow noopener";
  });

  const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#039;",'"':"&quot;"}[char]));
  const trendSearchText = (t) => [t.title, t.category, t.summary, ...(t.keywords || []), ...(t.angles || [])].join(" ").toLowerCase();
  const competitionLabel = (value) => value < 50 ? "Low" : value < 70 ? "Medium" : "High";

  function trendCard(t) {
    const monetised = (t.products || []).some((slug) => affiliateLinks[slug]?.affiliateUrl) || (feedMatches[t.slug] || []).length > 0;
    return `<article class="trend-card reveal visible" data-category="${escapeHtml(t.category)}" data-search="${escapeHtml(trendSearchText(t))}">
      <div class="trend-card-top"><span class="trend-symbol">${escapeHtml(t.icon)}</span><span class="trend-stage ${escapeHtml(t.statusClass)}">${escapeHtml(t.stage)}</span><span class="trend-score">${t.score}</span></div>
      <span class="mini-label">${escapeHtml(t.category)}</span><h3>${escapeHtml(t.title)}</h3><p>${escapeHtml(t.summary)}</p>
      <div class="trend-metrics"><div><span>Momentum</span><strong>${t.momentum}</strong></div><div><span>Competition</span><strong>${competitionLabel(t.competition)}</strong></div><div><span>Buyer intent</span><strong>${t.buyerIntent}</strong></div></div>
      <div class="trend-card-footer"><span class="monetisation-dot ${monetised ? "active" : "planned"}">${monetised ? "Active affiliate match" : "Network match planned"}</span><a href="trend.html?trend=${encodeURIComponent(t.slug)}">Open opportunity →</a></div>
    </article>`;
  }

  const trendGrid = document.getElementById("trendGrid");
  if (trendGrid) trendGrid.innerHTML = trends.map(trendCard).join("");
  const trendSearch = document.getElementById("trendSearch");
  let trendFilter = "All";
  const filterTrends = () => {
    const query = (trendSearch?.value || "").toLowerCase().trim();
    let shown = 0;
    document.querySelectorAll("#trendGrid .trend-card").forEach((card) => {
      const visible = (trendFilter === "All" || card.dataset.category === trendFilter) && (card.dataset.search || "").includes(query);
      card.classList.toggle("hidden", !visible);
      if (visible) shown += 1;
    });
    document.getElementById("trendEmpty")?.classList.toggle("hidden", shown > 0);
  };
  document.querySelectorAll("#trendFilters .filter-button").forEach((button) => button.addEventListener("click", () => {
    trendFilter = button.dataset.filter;
    document.querySelectorAll("#trendFilters .filter-button").forEach((item) => item.classList.toggle("active", item === button));
    filterTrends();
  }));
  trendSearch?.addEventListener("input", filterTrends);

  if (document.getElementById("trendPage")) {
    const slug = new URLSearchParams(location.search).get("trend");
    const trend = trends.find((item) => item.slug === slug) || trends[0];
    if (trend) {
      document.title = `${trend.title} Trend Opportunity — TrendPilot AI`;
      document.getElementById("metaDescription").content = trend.summary;
      document.getElementById("trendIcon").textContent = trend.icon;
      document.getElementById("trendCategory").textContent = trend.category;
      document.getElementById("trendTitle").textContent = trend.title;
      document.getElementById("trendSummary").textContent = trend.summary;
      document.getElementById("whyNow").textContent = trend.whyNow;
      document.getElementById("monetisationNote").textContent = trend.monetisationNote;
      const source = document.getElementById("sourceLink");
      const sourceUrl = String(trend.sourceUrl || "");
      const sourceIsPublic = /^https?:\/\//i.test(sourceUrl) && !sourceUrl.startsWith(location.origin);
      if (sourceIsPublic) {
        source.hidden = false;
        source.textContent = "Why this is trending";
        source.href = sourceUrl;
        source.target = "_blank";
        source.rel = "noopener";
      } else {
        source.hidden = true;
        source.removeAttribute("href");
      }
      document.getElementById("trendSummaryPanel").innerHTML = `<span class="status-chip">${escapeHtml(trend.stage)}</span><div><span>Opportunity score</span><strong>${trend.score}/100</strong></div><div><span>Confidence</span><strong>${escapeHtml(trend.confidence)}</strong></div><div><span>Competition</span><strong>${competitionLabel(trend.competition)}</strong></div><div><span>Observed</span><strong>${escapeHtml(trend.observedAt)}</strong></div>`;
      const scoreRows = [
        ["Momentum", trend.momentum], ["Buyer intent", trend.buyerIntent], ["Low competition advantage", 100 - trend.competition], ["Affiliate coverage", trend.affiliateCoverage], ["Content depth", trend.contentDepth]
      ];
      document.getElementById("scoreBreakdown").innerHTML = scoreRows.map(([label, value]) => `<div class="score-row"><span>${label}</span><div class="bar"><i style="--value:${value}%"></i></div><strong>${value}</strong></div>`).join("");
      document.getElementById("trendKeywords").innerHTML = (trend.keywords || []).map((item) => `<span>${escapeHtml(item)}</span>`).join("");
      document.getElementById("trendAngles").innerHTML = (trend.angles || []).map((item) => `<article><span>Content angle</span><strong>${escapeHtml(item)}</strong></article>`).join("");
      document.getElementById("networkMatches").innerHTML = (trend.networkOpportunities || []).map((item) => `<span>${escapeHtml(item)}</span>`).join("");
      const directMatches = (trend.products || []).map((productSlug) => tools.find((tool) => tool.slug === productSlug)).filter(Boolean);
      const automatedMatches = feedMatches[trend.slug] || [];
      const productArea = document.getElementById("matchedProducts");
      const directHtml = directMatches.map((tool) => {
        const link = affiliateLinks[tool.slug] || {};
        const active = Boolean(link.affiliateUrl);
        return `<article class="matched-product"><div class="tool-logo" style="--tool-a:${tool.colours[0]};--tool-b:${tool.colours[1]}">${escapeHtml(tool.initials)}</div><div><strong>${escapeHtml(tool.name)}</strong><span>${escapeHtml(tool.tagline)}</span><small>${active ? "Personal affiliate link active" : "Official programme available"}</small></div><a class="button button-small ${active ? "button-primary" : "button-outline"}" href="${escapeHtml(link.affiliateUrl || tool.productUrl)}" target="_blank" rel="sponsored nofollow noopener">${active ? "Visit with affiliate link" : "Visit product"}</a></article>`;
      }).join("");
      const automatedHtml = automatedMatches.map((product) => {
        const numericPrice = Number(product.price);
        const hasPrice = product.price != null && Number.isFinite(numericPrice) && numericPrice >= 0;
        const currency = escapeHtml(product.currency || "USD");
        const price = hasPrice
          ? `<span class="catalogue-price"><span class="price-prefix">From</span> ${currency} ${numericPrice.toFixed(2)}</span><span class="catalogue-estimate">Catalogue estimate</span>`
          : `<span class="catalogue-estimate">Check store for current price</span>`;
        const network = product.network ? ` • ${escapeHtml(product.network)}` : "";
        const advertiser = product.advertiser ? escapeHtml(product.advertiser) : escapeHtml(product.category || "Affiliate product");
        const image = product.image ? `<img class="matched-product-image" src="${escapeHtml(product.image)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : `<div class="matched-product-image placeholder">◈</div>`;
        return `<article class="matched-product feed-product">${image}<div><strong>${escapeHtml(product.name)}</strong><span>${advertiser}${network}</span><small class="product-price-row">${price}<span class="match-indicator">Match ${Math.round(product.matchScore || 0)}</span></small></div><a class="button button-small button-primary" href="${escapeHtml(product.url)}" target="_blank" rel="sponsored nofollow noopener">View current offer</a></article>`;
      }).join("");
      if (directHtml || automatedHtml) {
        let refreshedAt = "";
        if (automatedMatches.length && feedMeta.generatedAt) {
          const refreshedDate = new Date(feedMeta.generatedAt);
          if (!Number.isNaN(refreshedDate.getTime())) {
            refreshedAt = refreshedDate.toLocaleString("en-GB", {
              day: "2-digit",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit"
            });
          }
        }
        const generated = automatedMatches.length
          ? `<div class="pricing-disclaimer"><strong>Catalogue price notice</strong><span>Prices are feed estimates and may differ at checkout. Shipping, taxes, coupons, selected options and availability can change.</span>${refreshedAt ? `<small>Offer catalogue last refreshed ${escapeHtml(refreshedAt)}.</small>` : ""}</div>`
          : "";
        productArea.innerHTML = directHtml + automatedHtml + generated;
        const primary = document.getElementById("primaryMatch");
        primary.hidden = false;
        if (directMatches.length) {
          const first = directMatches[0];
          const record = affiliateLinks[first.slug] || {};
          primary.textContent = `View ${first.name}`;
          primary.href = record.affiliateUrl || first.productUrl;
        } else {
          primary.textContent = "View best matched offer";
          primary.href = automatedMatches[0].url;
        }
        primary.target = "_blank";
        primary.rel = "sponsored nofollow noopener";
      } else {
        productArea.innerHTML = `<div class="no-match"><strong>No verified product offer is available right now.</strong><p>This trend remains visible for research, but TrendPilot will not send visitors to a general store, search page or unrelated product. A product button will appear automatically after a precise offer passes validation.</p></div>`;
        const primary = document.getElementById("primaryMatch");
        primary.hidden = true;
        primary.textContent = "";
        primary.removeAttribute("href");
        primary.removeAttribute("target");
        primary.removeAttribute("rel");
        document.getElementById("monetisationNote").textContent = "Research-only trend: no precise, verified product offer is currently published.";
      }
    }
  }

  const connectorGrid = document.getElementById("connectorGrid");
  if (connectorGrid) connectorGrid.innerHTML = networks.map((network) => `<article class="connector-card"><div class="connector-head"><div><span class="mini-label">${escapeHtml(network.type)}</span><h3>${escapeHtml(network.name)}</h3></div><span class="connector-status ${escapeHtml(network.statusClass)}">${escapeHtml(network.status)}</span></div><p>${escapeHtml(network.note)}</p><div class="connector-facts"><div><span>Coverage</span><strong>${escapeHtml(network.coverage)}</strong></div><div><span>Automation</span><strong>${escapeHtml(network.automation)}</strong></div><div><span>Credential rule</span><strong>${escapeHtml(network.secretNeeded)}</strong></div></div><a class="button button-small button-outline" href="${escapeHtml(network.url)}" target="_blank" rel="noopener">Open official site</a></article>`).join("");

  // Existing v0.2 tool catalogue and pages remain operational.
  const cardsHtml = (items) => items.map((tool) => `<article class="tool-card reveal visible" style="--tool-a:${tool.colours[0]};--tool-b:${tool.colours[1]}" data-category="${tool.category}" data-search="${escapeHtml((tool.name + " " + tool.tagline + " " + tool.bestFor).toLowerCase())}"><div class="tool-top"><div class="tool-logo">${tool.initials}</div><div class="tool-name"><strong>${tool.name}</strong><small>${tool.category}</small></div><span class="tool-badge">${tool.badge}</span></div><p class="tool-description">${tool.tagline}</p><div class="programme-preview"><div><span>Commission</span><strong>${tool.commission}</strong></div><div><span>Cookie</span><strong>${tool.cookie}</strong></div></div><div class="tool-score-row"><span>TrendPilot opportunity score</span><strong class="tool-score">${tool.score}</strong></div><div class="tool-footer"><span>Verified ${tool.verified}</span><a class="tool-action" href="tool.html?tool=${tool.slug}">View details →</a></div></article>`).join("");
  const toolsGrid = document.getElementById("toolsGrid");
  if (toolsGrid) toolsGrid.innerHTML = cardsHtml(tools);
  const toolSearch = document.getElementById("toolSearch");
  let toolFilter = "All";
  const filterTools = () => {
    const query = (toolSearch?.value || "").toLowerCase().trim(); let shown = 0;
    document.querySelectorAll("#toolsGrid .tool-card").forEach((card) => {
      const visible = (toolFilter === "All" || card.dataset.category === toolFilter) && (card.dataset.search || "").includes(query);
      card.classList.toggle("hidden", !visible); if (visible) shown += 1;
    });
    document.getElementById("emptyState")?.classList.toggle("hidden", shown > 0);
  };
  document.querySelectorAll("#filterButtons .filter-button").forEach((button) => button.addEventListener("click", () => {
    toolFilter = button.dataset.filter;
    document.querySelectorAll("#filterButtons .filter-button").forEach((item) => item.classList.toggle("active", item === button));
    filterTools();
  }));
  toolSearch?.addEventListener("input", filterTools);

  const programmeGrid = document.getElementById("programmeGrid");
  if (programmeGrid) programmeGrid.innerHTML = tools.map((tool) => `<article class="programme-card" data-category="${tool.category}" data-search="${escapeHtml((tool.name + " " + tool.commission + " " + tool.network + " " + tool.bestFor).toLowerCase())}"><div class="programme-card-head"><div class="tool-logo" style="--tool-a:${tool.colours[0]};--tool-b:${tool.colours[1]}">${tool.initials}</div><div><h3>${tool.name}</h3><p>${tool.category} • ${tool.network}</p></div><span class="tool-badge">${tool.badge}</span></div><div class="programme-facts"><div><span>Commission</span><strong>${tool.commission}</strong></div><div><span>Duration</span><strong>${tool.duration}</strong></div><div><span>Cookie</span><strong>${tool.cookie}</strong></div></div><p>${tool.programmeNote}</p><div class="programme-actions"><a class="button button-small button-outline" href="tool.html?tool=${tool.slug}">Read analysis</a><a class="button button-small button-primary" href="${tool.applicationUrl}" target="_blank" rel="noopener">Apply officially</a></div></article>`).join("");

  let programmeFilter = "All"; const programmeSearch = document.getElementById("programmeSearch");
  const filterPrograms = () => { const query = (programmeSearch?.value || "").toLowerCase().trim(); document.querySelectorAll("#programmeGrid .programme-card").forEach((card) => card.classList.toggle("hidden", !((programmeFilter === "All" || card.dataset.category === programmeFilter) && (card.dataset.search || "").includes(query)))); };
  document.querySelectorAll("#programmeFilters .filter-button").forEach((button) => button.addEventListener("click", () => { programmeFilter = button.dataset.filter; document.querySelectorAll("#programmeFilters .filter-button").forEach((item) => item.classList.toggle("active", item === button)); filterPrograms(); }));
  programmeSearch?.addEventListener("input", filterPrograms);

  if (document.getElementById("toolPage")) {
    const slug = new URLSearchParams(location.search).get("tool");
    const tool = tools.find((item) => item.slug === slug) || tools[0];
    if (tool) {
      document.title = `${tool.name} Affiliate Programme — TrendPilot AI`;
      document.getElementById("metaDescription").content = tool.description;
      const logo = document.getElementById("toolLogo"); logo.textContent = tool.initials; logo.style.setProperty("--tool-a", tool.colours[0]); logo.style.setProperty("--tool-b", tool.colours[1]);
      document.getElementById("toolCategory").textContent = tool.category; document.getElementById("toolName").textContent = tool.name; document.getElementById("toolDescription").textContent = tool.description; document.getElementById("bestFor").textContent = tool.bestFor; document.getElementById("programmeNote").textContent = tool.programmeNote;
      document.getElementById("summary").innerHTML = `<span class="status-chip">Verified ${tool.verified}</span><div><span>Commission</span><strong>${tool.commission}</strong></div><div><span>Duration</span><strong>${tool.duration}</strong></div><div><span>Cookie window</span><strong>${tool.cookie}</strong></div><div><span>Tracking platform</span><strong>${tool.network}</strong></div>`;
      document.getElementById("pros").innerHTML = tool.pros.map((item) => `<li>${item}</li>`).join(""); document.getElementById("angles").innerHTML = tool.angles.map((item) => `<article><span>Content angle</span><strong>${item}</strong></article>`).join("");
      const record = affiliateLinks[tool.slug] || {}; const visit = document.getElementById("visitTool"); visit.textContent = `Visit ${tool.name}`; visit.href = record.affiliateUrl || tool.productUrl; visit.target = "_blank"; visit.rel = "sponsored nofollow noopener";
      const apply = document.getElementById("applyProgramme"); apply.href = tool.applicationUrl; apply.target = "_blank"; apply.rel = "noopener"; document.getElementById("sourceLink").href = tool.sourceUrl;
    }
  }
});
