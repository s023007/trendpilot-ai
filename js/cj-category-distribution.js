(() => {
  "use strict";
  const clean = value => String(value ?? "").replace(/\s+/g, " ").trim();
  const esc = value => clean(value).replace(/[&<>"']/g, char => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[char]));
  const http = value => /^https?:\/\//i.test(clean(value)) ? clean(value) : "";

  function offerLinks(partner) {
    return (partner.offers || []).slice(0, 4).map(offer => {
      const url = http(offer.url);
      return url ? `<a href="${esc(url)}" target="_blank" rel="nofollow sponsored noopener">${esc(offer.name || "Current offer")} ↗</a>` : "";
    }).join("");
  }

  function card(partner, section) {
    const primary = partner.primaryOffer && http(partner.primaryOffer.url);
    const hasProducts = Boolean(partner.hasProductFeed && partner.productCount > 0);
    let mainUrl = primary;
    let mainLabel = "Open provider";
    if (section === "products" && hasProducts && partner.searchUrl) {
      mainUrl = partner.searchUrl;
      mainLabel = `Compare ${partner.productCount} product${partner.productCount === 1 ? "" : "s"}`;
    } else if (section === "software") {
      mainLabel = "View software plans";
    } else if (section === "sports") {
      mainLabel = "Browse sports tickets";
    } else if (section === "events") {
      mainLabel = "Browse event tickets";
    } else if (section === "travel") {
      mainLabel = "Browse travel bookings";
    } else if (section === "products") {
      mainLabel = "Browse this seller";
    }

    const secondary = section === "products" && hasProducts && primary
      ? `<a class="tp-cj-action" href="${esc(primary)}" target="_blank" rel="nofollow sponsored noopener">Seller offers ↗</a>`
      : "";
    const status = section === "products"
      ? (hasProducts
          ? `${partner.productCount} product-level record${partner.productCount === 1 ? "" : "s"} ready for comparison.`
          : `Connected seller with ${partner.offerCount || 0} current link${partner.offerCount === 1 ? "" : "s"}; awaiting individual product records.`)
      : `${partner.offerCount || 0} current partner link${partner.offerCount === 1 ? "" : "s"} available.`;

    return `<article class="tp-cj-card">
      <div class="tp-cj-card-top"><span class="tp-cj-icon">${esc(partner.icon || "CJ")}</span><div><small>${esc(partner.department)}</small><h3>${esc(partner.name)}</h3></div></div>
      <p>${esc(partner.description)}</p>
      <div class="tp-cj-tags"><span>${esc(partner.specialty)}</span><span>CJ partner</span></div>
      <div class="tp-cj-status">${esc(status)}</div>
      <div class="tp-cj-actions">
        ${mainUrl ? `<a class="tp-cj-action tp-cj-action-primary" href="${esc(mainUrl)}"${/^https?:/i.test(mainUrl) ? ' target="_blank" rel="nofollow sponsored noopener"' : ""}>${esc(mainLabel)} ↗</a>` : ""}
        ${secondary}
      </div>
      ${section !== "products" ? `<div class="tp-cj-offers">${offerLinks(partner)}</div>` : ""}
    </article>`;
  }

  async function render() {
    const hosts = [...document.querySelectorAll("[data-cj-directory]")];
    if (!hosts.length) return;
    try {
      const response = await fetch(`/data/cj-category-directory.json?v=13.8.30-${Date.now()}`, {cache:"no-store"});
      if (!response.ok) throw new Error(`CJ directory ${response.status}`);
      const data = await response.json();
      hosts.forEach(host => {
        const section = clean(host.dataset.cjDirectory);
        const rows = Array.isArray(data.sections && data.sections[section]) ? data.sections[section] : [];
        host.innerHTML = rows.length
          ? rows.map(partner => card(partner, section)).join("")
          : `<div class="tp-cj-empty">No connected CJ partners are available in this section at the moment.</div>`;
      });
      document.querySelectorAll("[data-cj-disclosure]").forEach(node => {
        node.textContent = data.disclosure || "";
      });
    } catch (error) {
      console.warn("TrendPilot CJ category directory unavailable", error);
      hosts.forEach(host => {
        host.innerHTML = `<div class="tp-cj-empty">The connected-partner directory could not be loaded. Please try again shortly.</div>`;
      });
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", render, {once:true});
  else render();
})();
