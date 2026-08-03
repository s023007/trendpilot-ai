(() => {
  "use strict";
  const status = window.TRENDPILOT_PROGRAM_STATUS || {programs:[]};
  const matches = window.TRENDPILOT_MATCHED_PRODUCTS || {};
  const links = window.TRENDPILOT_LINKS || {};
  const activeAdvertisers = new Set(status.programs.filter(p => p.status === "active" && p.public !== false).map(p => String(p.advertiser || p.name).toLowerCase()));
  const clean = value => String(value || "").replace(/\s+/g," ").trim();
  const escapeHtml = value => String(value ?? "").replace(/[&<>'"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#039;",'"':"&quot;"}[char]));
  const validUrl = value => /^https?:\/\//i.test(String(value || ""));
  const advertiser = offer => {
    const value = clean(offer?.advertiser || offer?.network || "Verified source");
    return value.toLowerCase() === "true" ? "Geekbuying" : value;
  };
  const active = offer => activeAdvertisers.has(advertiser(offer).toLowerCase());
  const dedupe = offers => {
    const seen = new Set();
    return offers.filter(offer => {
      const key = String(offer.canonicalKey || offer.productUrl || offer.url || offer.id || offer.name).toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key); return true;
    });
  };
  const allOffers = dedupe(Object.values(matches).flat().filter(offer => offer && active(offer) && clean(offer.name) && validUrl(offer.url)));
  const price = offer => {
    const value = Number(offer.price);
    if (!Number.isFinite(value) || value <= 0) return "Check current price";
    return `${clean(offer.currency) || "USD"} ${value.toFixed(2)}`;
  };
  const card = (offer, index) => `<article class="editorial-product-card">
    <a class="editorial-product-media" href="${escapeHtml(offer.url)}" target="_blank" rel="sponsored nofollow noopener" aria-label="Open ${escapeHtml(offer.name)}">
      ${validUrl(offer.image) ? `<img src="${escapeHtml(offer.image)}" alt="${escapeHtml(offer.name)}" loading="lazy" referrerpolicy="no-referrer">` : `<span>${escapeHtml(advertiser(offer).slice(0,2).toUpperCase())}</span>`}
      <b>#${index + 1}</b>
    </a>
    <div class="editorial-product-body">
      <div class="editorial-product-source"><span>${escapeHtml(advertiser(offer))}</span><em>Exact product link</em></div>
      <h3>${escapeHtml(offer.name)}</h3>
      <div class="editorial-product-meta"><strong>${escapeHtml(price(offer))}</strong><span>Match ${Math.round(Number(offer.matchScore) || 0)}/100</span></div>
      <a class="button button-small button-primary" href="${escapeHtml(offer.url)}" target="_blank" rel="sponsored nofollow noopener">Check product details ↗</a>
    </div>
  </article>`;
  function renderProducts(el) {
    const trend = clean(el.dataset.trend);
    const source = clean(el.dataset.advertiser).toLowerCase();
    const limit = Math.max(1, Math.min(12, Number(el.dataset.limit) || 6));
    let offers = trend ? (matches[trend] || []) : allOffers;
    offers = dedupe(offers.filter(offer => offer && active(offer) && validUrl(offer.url) && (!source || advertiser(offer).toLowerCase() === source)));
    offers.sort((a,b) => (Number(b.matchScore)||0)-(Number(a.matchScore)||0) || (Number(b.offerQuality)||0)-(Number(a.offerQuality)||0));
    el.innerHTML = offers.length ? offers.slice(0,limit).map(card).join("") : `<div class="editorial-empty"><strong>No publishable offer is available right now.</strong><span>The page remains useful as a buying guide; live products appear only after exact-link validation.</span></div>`;
  }
  function renderProgrammeCounts() {
    const activePrograms=status.programs.filter(p=>p.status==="active" && p.public!==false);
    document.querySelectorAll("[data-active-program-count]").forEach(el=>el.textContent=String(activePrograms.length));
    document.querySelectorAll("[data-active-program-list]").forEach(el=>{
      el.innerHTML=activePrograms.map(p=>`<span>${escapeHtml(p.advertiser || p.name)}</span>`).join("");
    });
  }
  function bindSoftwareLinks(){
    document.querySelectorAll("[data-affiliate-key]").forEach(a=>{
      const row=links[a.dataset.affiliateKey]; if(!row) return;
      a.href=row.affiliateUrl||row.productUrl; a.target="_blank"; a.rel="sponsored nofollow noopener";
    });
  }
  document.addEventListener("DOMContentLoaded",()=>{
    document.querySelectorAll("[data-editorial-products]").forEach(renderProducts);
    renderProgrammeCounts(); bindSoftwareLinks();
  });
})();
