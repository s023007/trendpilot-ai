(() => {
  'use strict';

  const d = document;
  const ORIGIN = location.origin;
  const HANDOFF_PATH = '/handoff/';
  if (location.pathname === HANDOFF_PATH || location.pathname.startsWith('/handoff/')) return;

  const clean = v => String(v ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const low = v => clean(v).toLowerCase();
  const HOST_RE = /(?:^|\.)(?:rzekl\.com|admitad\.com|admitad\.click|aliexpress\.com|alibaba\.com|tiktok\.com|tiktokshop\.com|geekbuying\.com|govee\.com|sunsky-online\.com|lenovo\.com|diecastmodelswholesale\.com|fragranceshop\.com|karaca\.com|mfimedical\.com|pandahall\.com|trip\.com|ticketnetwork\.com|sportsevents365\.com|anrdoezrs\.net|apmebf\.com|awltovhc\.com|commission-junction\.com|dpbolvw\.net|emjcd\.com|ftjcfx\.com|jdoqocy\.com|kqzyfj\.com|lduhtrp\.net|qksrv\.net|tkqlhce\.com|awin1\.com)$/i;
  const CTA_RE = /\b(?:check\s*(?:price|deal|offer|tickets?)|shop\s*(?:now|deal)?|buy\s*now|visit\s*(?:seller|store|shop)|go\s*to\s*(?:seller|store|shop)|open\s*(?:seller|store|shop)|use\s*(?:coupon|code)|continue\s*to\s*seller|seller\s*site|view\s*at)\b/i;
  const CARD_SELECTOR = '.tp214-deal,.tp214-coupon,.tp78-card,.tp80-rare-card,.tp-ticket-v141-card,.product-card,.deal-card,.offer-card,.tp-card,[data-product-id],[data-offer-id],[data-seller]';
  const INTERNAL_DETAIL_RE = /^\/(?:deal|coupon|ticket|product|rare-used|rare-find)\//i;

  function urlOf(a) {
    try {
      const raw = a?.getAttribute?.('href') || '';
      if (!raw || /^(?:#|javascript:|mailto:|tel:)/i.test(raw)) return null;
      return new URL(raw, location.href);
    } catch { return null; }
  }

  function cardFor(a) {
    return a?.closest?.(CARD_SELECTOR) || a?.closest?.('article') || a?.parentElement || null;
  }

  // A deal badge is useful only when it can actually reach the product. Some feed
  // "Smart links" can expire or resolve to a dead route. If a card also contains
  // a proven View product link, use that exact destination as the safe fallback.
  function exactProductSibling(a) {
    if (!/^check\s+deal\b/i.test(clean(a?.textContent))) return null;
    const card = cardFor(a);
    if (!card) return null;
    const links = [...card.querySelectorAll('a[href]')];
    const product = links.find(link => link !== a && /^view\s+product\b/i.test(clean(link.textContent)));
    if (!product) return null;
    const raw = product.dataset?.tpOriginalSellerUrl || product.getAttribute('href') || '';
    try {
      const u = new URL(raw, location.href);
      if (/^https?:$/.test(u.protocol) && u.origin !== ORIGIN) return u;
    } catch {}
    return null;
  }

  function normalizedUrlOf(a) {
    return exactProductSibling(a) || urlOf(a);
  }

  function isExternalSeller(a) {
    const u = normalizedUrlOf(a);
    if (!u || !/^https?:$/.test(u.protocol) || u.origin === ORIGIN) return false;
    const rel = low(a.getAttribute('rel'));
    const text = clean(a.textContent || a.getAttribute('aria-label') || a.title);
    const inCommerceCard = Boolean(cardFor(a));
    return rel.includes('sponsored') || HOST_RE.test(u.hostname) || CTA_RE.test(text) || inCommerceCard;
  }

  function internalDetailFor(a) {
    const card = cardFor(a);
    if (!card) return '';
    const links = [...card.querySelectorAll('a[href]')];
    for (const link of links) {
      if (link === a) continue;
      const href = link.getAttribute('href') || '';
      try {
        const u = new URL(href, location.href);
        if (u.origin === ORIGIN && INTERNAL_DETAIL_RE.test(u.pathname)) return u.pathname + u.search + u.hash;
      } catch {}
    }
    return '';
  }

  function sellerLabel(a, u) {
    const explicit = clean(a.dataset?.seller || a.closest?.('[data-seller]')?.dataset?.seller || '');
    if (explicit) return explicit;
    const card = cardFor(a);
    if (card) {
      const candidate = card.querySelector('[data-seller-name],.seller,.merchant,.tp214-meta strong,.tp214-coupon-top strong,.tp-ticket-v141-card-head strong');
      const text = clean(candidate?.textContent);
      if (text && text.length < 70) return text;
    }
    const host = (u?.hostname || '').replace(/^www\./i, '');
    const known = [
      ['aliexpress','AliExpress'],['alibaba','Alibaba'],['tiktok','TikTok Shop'],['geekbuying','Geekbuying'],['govee','Govee'],
      ['lenovo','Lenovo'],['pandahall','PandaHall'],['karaca','Karaca'],['mfimedical','MFI Medical'],['fragrance','FragranceShop'],
      ['ticketnetwork','TicketNetwork'],['sportsevents365','Sports Events 365'],['trip.com','Trip.com']
    ];
    const hit = known.find(([key]) => host.toLowerCase().includes(key));
    return hit ? hit[1] : host || 'Seller';
  }

  function makeHandoff(a, u) {
    const key = `tp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`;
    const payload = {
      url: u.href,
      seller: sellerLabel(a, u),
      sourcePath: location.pathname + location.search,
      sourceTitle: clean(document.title),
      createdAt: Date.now()
    };
    try { localStorage.setItem(`tp_handoff_${key}`, JSON.stringify(payload)); } catch {}
    try { sessionStorage.setItem(`tp_handoff_${key}`, JSON.stringify(payload)); } catch {}
    return `${HANDOFF_PATH}?k=${encodeURIComponent(key)}`;
  }

  function rewriteAnchor(a) {
    if (!a || a.dataset?.tpHandoffReady === '1' || !isExternalSeller(a)) return;
    const external = normalizedUrlOf(a);
    if (!external) return;

    const rescuedDeal = exactProductSibling(a);
    if (rescuedDeal) {
      a.dataset.tpDealRescued = '1';
      a.title = 'Exact product destination used because the separate deal route may be unavailable.';
    }

    // Listing cards should always open their TrendPilot description/details page first.
    const internal = internalDetailFor(a);
    if (internal) {
      a.dataset.tpOriginalSellerUrl = external.href;
      a.setAttribute('href', internal);
      a.removeAttribute('target');
      a.removeAttribute('rel');
      if (/check\s*(?:price|deal|offer)/i.test(clean(a.textContent))) a.textContent = 'View details →';
      a.dataset.tpHandoffReady = '1';
      a.dataset.tpInternalFirst = '1';
      return;
    }

    // Detail pages and seller-only routes get a neutral TrendPilot handoff page before leaving the site.
    a.dataset.tpOriginalSellerUrl = external.href;
    a.setAttribute('href', makeHandoff(a, external));
    a.removeAttribute('target');
    a.setAttribute('rel', 'nofollow');
    a.dataset.tpHandoffReady = '1';
  }

  function scan(root = d) {
    if (root?.matches?.('a[href]')) rewriteAnchor(root);
    root?.querySelectorAll?.('a[href]').forEach(rewriteAnchor);
  }

  // Capture late-generated seller links. Check deal is normalized to the proven
  // View product destination before any handoff is created, preventing dead smart links.
  d.addEventListener('click', e => {
    const a = e.target?.closest?.('a[href]');
    if (!a || !isExternalSeller(a)) return;
    const internal = internalDetailFor(a);
    const u = normalizedUrlOf(a);
    if (!u) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    location.href = internal || makeHandoff(a, u);
  }, true);

  const start = () => {
    scan(d);
    const observer = new MutationObserver(records => {
      for (const rec of records) {
        if (rec.type === 'attributes' && rec.target?.matches?.('a[href]')) {
          delete rec.target.dataset.tpHandoffReady;
          scan(rec.target);
        }
        rec.addedNodes?.forEach(node => { if (node.nodeType === 1) scan(node); });
      }
    });
    observer.observe(d.documentElement, {subtree:true, childList:true, attributes:true, attributeFilter:['href']});
  };

  d.readyState === 'loading' ? d.addEventListener('DOMContentLoaded', start, {once:true}) : start();
})();