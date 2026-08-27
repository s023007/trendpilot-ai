(() => {
  'use strict';

  const d = document;
  const ORIGIN = location.origin;
  const clean = v => String(v ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const low = v => clean(v).toLowerCase();
  const HOST_RE = /(?:^|\.)(?:rzekl\.com|admitad\.com|admitad\.click|aliexpress\.com|alibaba\.com|tiktok\.com|tiktokshop\.com|geekbuying\.com|govee\.com|sunsky-online\.com|lenovo\.com|diecastmodelswholesale\.com|fragranceshop\.com|karaca\.com|mfimedical\.com|pandahall\.com|trip\.com|ticketnetwork\.com|sportsevents365\.com|anrdoezrs\.net|apmebf\.com|awltovhc\.com|commission-junction\.com|dpbolvw\.net|emjcd\.com|ftjcfx\.com|jdoqocy\.com|kqzyfj\.com|lduhtrp\.net|qksrv\.net|tkqlhce\.com|awin1\.com)$/i;
  const CTA_RE = /\b(?:check\s*(?:price|deal|offer|tickets?)|shop\s*(?:now|deal)?|buy\s*now|visit\s*(?:seller|store|shop)|go\s*to\s*(?:seller|store|shop)|open\s*(?:seller|store|shop)|use\s*(?:coupon|code)|continue\s*to\s*seller|seller\s*site|view\s*at)\b/i;
  const CARD_SELECTOR = '.tp214-deal,.tp214-coupon,.tp78-card,.tp80-rare-card,.tp-ticket-v141-card,.product-card,.deal-card,.offer-card,.tp-card,[data-product-id],[data-offer-id],[data-seller]';
  const INTERNAL_DETAIL_RE = /^\/(?:deal|coupon|ticket|product|rare-used|rare-find)\//i;

  function rawUrl(a) {
    try {
      const raw = a?.dataset?.tpOriginalSellerUrl || a?.getAttribute?.('href') || '';
      if (!raw || /^(?:#|javascript:|mailto:|tel:)/i.test(raw)) return null;
      return new URL(raw, location.href);
    } catch { return null; }
  }

  function cardFor(a) {
    return a?.closest?.(CARD_SELECTOR) || a?.closest?.('article') || a?.parentElement || null;
  }

  function exactProductSibling(a) {
    if (!/^check\s+deal\b/i.test(clean(a?.textContent))) return null;
    const card = cardFor(a);
    if (!card) return null;
    const links = [...card.querySelectorAll('a[href]')];
    const product = links.find(link => link !== a && /^view\s+product\b/i.test(clean(link.textContent)));
    if (!product) return null;
    const u = rawUrl(product);
    if (u && /^https?:$/.test(u.protocol) && u.origin !== ORIGIN) return u;
    return null;
  }

  function destinationFor(a) {
    return exactProductSibling(a) || rawUrl(a);
  }

  function isExternalSeller(a) {
    const u = destinationFor(a);
    if (!u || !/^https?:$/.test(u.protocol) || u.origin === ORIGIN) return false;
    const rel = low(a.getAttribute('rel'));
    const text = clean(a.textContent || a.getAttribute('aria-label') || a.title);
    return rel.includes('sponsored') || HOST_RE.test(u.hostname) || CTA_RE.test(text) || Boolean(cardFor(a));
  }

  function internalDetailFor(a) {
    const card = cardFor(a);
    if (!card) return '';
    for (const link of [...card.querySelectorAll('a[href]')]) {
      if (link === a) continue;
      try {
        const u = new URL(link.getAttribute('href') || '', location.href);
        if (u.origin === ORIGIN && INTERNAL_DETAIL_RE.test(u.pathname)) return u.pathname + u.search + u.hash;
      } catch {}
    }
    return '';
  }

  function rewriteAnchor(a) {
    if (!a || a.dataset?.tpHandoffReady === '1' || !isExternalSeller(a)) return;
    const external = destinationFor(a);
    if (!external) return;

    const internal = internalDetailFor(a);
    a.dataset.tpOriginalSellerUrl = external.href;

    if (internal) {
      a.setAttribute('href', internal);
      a.removeAttribute('target');
      a.removeAttribute('rel');
      if (/check\s*(?:price|deal|offer)/i.test(clean(a.textContent))) a.textContent = 'View details →';
      a.dataset.tpInternalFirst = '1';
    } else {
      // The cPanel/LiteSpeed host does not currently publish /handoff/ reliably.
      // Avoid the broken internal route and use the verified seller destination directly.
      a.setAttribute('href', external.href);
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'nofollow sponsored noopener');
      if (exactProductSibling(a)) {
        a.dataset.tpDealRescued = '1';
        a.title = 'Exact product destination used because the separate deal route may be unavailable.';
      }
    }
    a.dataset.tpHandoffReady = '1';
  }

  function scan(root = d) {
    if (root?.matches?.('a[href]')) rewriteAnchor(root);
    root?.querySelectorAll?.('a[href]').forEach(rewriteAnchor);
  }

  d.addEventListener('click', e => {
    const a = e.target?.closest?.('a[href]');
    if (!a || !isExternalSeller(a)) return;
    const internal = internalDetailFor(a);
    const external = destinationFor(a);
    if (!external) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (internal) location.href = internal;
    else window.open(external.href, '_blank', 'noopener');
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