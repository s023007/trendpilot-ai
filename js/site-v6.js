(() => {
  "use strict";
  const cfg = window.TRENDPILOT_SITE_CONFIG || {};
  const clean = v => String(v ?? "").replace(/\s+/g, " ").trim();
  const lower = v => clean(v).toLowerCase();
  const escapeHtml = v => String(v ?? "").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#039;",'"':"&quot;"}[c]));
  const validUrl = v => /^https?:\/\//i.test(String(v || ""));
  const splitTerms = v => clean(v).split("|").map(lower).filter(Boolean);

  function initMenu(){
    const button=document.querySelector("[data-menu-button]");
    const nav=document.querySelector("[data-primary-nav]");
    if(!button||!nav)return;
    const close=()=>{nav.classList.remove("open");document.body.classList.remove("menu-open");button.setAttribute("aria-expanded","false")};
    const open=()=>{nav.classList.add("open");document.body.classList.add("menu-open");button.setAttribute("aria-expanded","true")};
    button.addEventListener("click",()=>nav.classList.contains("open")?close():open());
    nav.addEventListener("click",e=>{if(e.target.closest("[data-menu-close]")||e.target.closest("a"))close()});
    document.addEventListener("keydown",e=>{if(e.key==="Escape")close()});
  }
  function initAnalytics(){
    if(!/^G-[A-Z0-9]+$/i.test(clean(cfg.ga4Id)))return;
    window.dataLayer=window.dataLayer||[];
    window.gtag=window.gtag||function(){dataLayer.push(arguments)};
    const s=document.createElement("script");s.async=true;s.src=`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(cfg.ga4Id)}`;document.head.appendChild(s);
    gtag("js",new Date());gtag("config",cfg.ga4Id,{anonymize_ip:true});
  }
  function advertiserName(offer){const value=clean(offer?.advertiser||offer?.network||"Verified store");return lower(value)==="true"?"Geekbuying":value;}
  function programmeMap(){const rows=window.TRENDPILOT_PROGRAM_STATUS?.programs||[];const map=new Map();rows.filter(p=>p.status==="active"&&p.public!==false).forEach(p=>map.set(lower(p.advertiser||p.name),p));return map;}
  function allOffers(){const matches=window.TRENDPILOT_MATCHED_PRODUCTS||{};const pmap=programmeMap();const raw=Object.values(matches).flat().filter(Boolean);const seen=new Set();return raw.filter(o=>{const adv=lower(advertiserName(o));const key=lower(o.canonicalKey||o.productUrl||o.url||o.id||o.name);if(!key||seen.has(key)||!pmap.has(adv)||!clean(o.name)||!validUrl(o.url))return false;seen.add(key);return true;});}
  function passes(offer, el){
    const hay=lower([offer.name,offer.description,offer.category,offer.brand].filter(Boolean).join(" "));
    const source=lower(el.dataset.advertiser);
    const any=splitTerms(el.dataset.requiredAny);
    const all=splitTerms(el.dataset.requiredAll);
    const excluded=splitTerms(el.dataset.exclude);
    const min=Number(el.dataset.minScore||75);
    if(source && lower(advertiserName(offer))!==source)return false;
    if(any.length && !any.some(t=>hay.includes(t)))return false;
    if(all.length && !all.every(t=>hay.includes(t)))return false;
    if(excluded.some(t=>hay.includes(t)))return false;
    if((Number(offer.matchScore)||0)<min)return false;
    return true;
  }
  function price(offer){const n=Number(offer.price);if(!Number.isFinite(n)||n<=0)return "Check current price";return `${clean(offer.currency)||"USD"} ${n.toFixed(2)}`;}
  function modelsFor(adv){const p=programmeMap().get(lower(adv));return Array.isArray(p?.models)?p.models.join("+"):"Affiliate";}
  function card(offer,placement){
    const adv=advertiserName(offer),name=clean(offer.name);
    const img=validUrl(offer.image)?`<img src="${escapeHtml(offer.image)}" alt="${escapeHtml(name)}" loading="lazy" decoding="async" referrerpolicy="no-referrer">`:`<span class="offer-fallback">${escapeHtml(adv.slice(0,2).toUpperCase())}</span>`;
    return `<article class="offer-card"><a class="offer-media" href="${escapeHtml(offer.url)}" target="_blank" rel="sponsored nofollow noopener" data-affiliate-outbound data-advertiser="${escapeHtml(adv)}" data-product-name="${escapeHtml(name)}" data-placement="${escapeHtml(placement)}" data-revenue-model="${escapeHtml(modelsFor(adv))}" aria-label="View ${escapeHtml(name)}">${img}</a><div class="offer-body"><div class="offer-source"><span>${escapeHtml(adv)}</span><em>Exact product</em></div><h3>${escapeHtml(name)}</h3><div class="offer-meta"><strong>${escapeHtml(price(offer))}</strong><span>Terms may change</span></div><a class="button button-small button-brand" href="${escapeHtml(offer.url)}" target="_blank" rel="sponsored nofollow noopener" data-affiliate-outbound data-advertiser="${escapeHtml(adv)}" data-product-name="${escapeHtml(name)}" data-placement="${escapeHtml(placement)}" data-revenue-model="${escapeHtml(modelsFor(adv))}">View product ↗</a></div></article>`;
  }
  function renderOffers(){
    const offers=allOffers();
    document.querySelectorAll("[data-product-grid]").forEach(el=>{
      const limit=Math.max(1,Math.min(8,Number(el.dataset.limit)||4));
      const placement=clean(el.dataset.placement||"article-offers");
      const selected=offers.filter(o=>passes(o,el)).sort((a,b)=>(Number(b.matchScore)||0)-(Number(a.matchScore)||0)||(Number(b.offerQuality)||0)-(Number(a.offerQuality)||0)).slice(0,limit);
      el.innerHTML=selected.length?selected.map(o=>card(o,placement)).join(""):`<div class="offer-empty"><strong>No strong live match is available right now.</strong><span>We would rather show no product than send you to an unrelated listing.</span></div>`;
    });
  }
  function bindAffiliateKeys(){
    const links=window.TRENDPILOT_LINKS||{};
    document.querySelectorAll("[data-affiliate-key]").forEach(a=>{const row=links[a.dataset.affiliateKey];if(!row)return;const affiliate=clean(row.affiliateUrl);a.href=affiliate||row.productUrl;a.target="_blank";a.rel="sponsored nofollow noopener";a.dataset.linkState=affiliate?"affiliate":"official-fallback";});
    document.querySelectorAll("[data-pricing-key]").forEach(a=>{const row=links[a.dataset.pricingKey];if(!row)return;const affiliate=clean(row.affiliateUrl);a.href=affiliate||row.pricingUrl||row.productUrl;a.target="_blank";a.rel="sponsored nofollow noopener";a.dataset.linkState=affiliate?"affiliate":"official-fallback";});
  }
  function trackClick(anchor){
    const data={event:"affiliate_outbound_click",page_path:location.pathname,advertiser:clean(anchor.dataset.advertiser||"Unknown"),product_name:clean(anchor.dataset.productName||anchor.textContent),placement:clean(anchor.dataset.placement||"unspecified"),revenue_model:clean(anchor.dataset.revenueModel||"Affiliate"),link_state:clean(anchor.dataset.linkState||"affiliate"),destination_host:(()=>{try{return new URL(anchor.href).hostname}catch{return ""}})()};
    window.dataLayer=window.dataLayer||[];window.dataLayer.push(data);
    if(typeof window.gtag==="function")window.gtag("event","affiliate_outbound_click",data);
    if(validUrl(cfg.clickEndpoint)&&navigator.sendBeacon){try{navigator.sendBeacon(cfg.clickEndpoint,new Blob([JSON.stringify(data)],{type:"application/json"}))}catch{}}
  }
  function initTracking(){document.addEventListener("click",e=>{const a=e.target.closest("a[data-affiliate-outbound],a[rel~='sponsored']");if(a)trackClick(a);},{capture:true});}
  function fixImages(){document.addEventListener("error",e=>{const img=e.target;if(!(img instanceof HTMLImageElement))return;img.hidden=true;const p=img.parentElement;if(p&&!p.querySelector(".offer-fallback")){const s=document.createElement("span");s.className="offer-fallback";s.textContent="TP";p.appendChild(s);}},{capture:true});}
  document.addEventListener("DOMContentLoaded",()=>{initMenu();initAnalytics();bindAffiliateKeys();renderOffers();initTracking();fixImages();document.querySelectorAll("[data-year]").forEach(el=>el.textContent=String(new Date().getFullYear()));});
})();
