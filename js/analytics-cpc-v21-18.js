(() => {
  'use strict';

  if (window.__TP_ANALYTICS_CPC_V21_18__) return;
  window.__TP_ANALYTICS_CPC_V21_18__ = true;

  const MEASUREMENT_ID = 'G-EKSFY3JE4D';
  const CPC_SELLER_RE = /\b(?:aliexpress|alibaba|geekbuying)\b/i;
  const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, 180);

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function(){ window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', MEASUREMENT_ID, { send_page_view: true });

  if (!document.querySelector(`script[src*="googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}"]`)) {
    const tag = document.createElement('script');
    tag.async = true;
    tag.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(MEASUREMENT_ID)}`;
    document.head.appendChild(tag);
  }

  const send = (name, params = {}) => {
    try {
      window.gtag('event', name, {
        page_path: location.pathname + location.search,
        visitor_country: clean(window.__TP_VISITOR_COUNTRY__ || document.documentElement.dataset.tpCountry || 'ZZ'),
        ...params
      });
    } catch (_) {}
  };

  const currentQuery = () => {
    const qs = new URLSearchParams(location.search);
    return clean(qs.get('q') || qs.get('query') || qs.get('search') || '');
  };

  const currentScope = () => {
    const qs = new URLSearchParams(location.search);
    return clean(qs.get('scope') || '');
  };

  const sellerFromNode = node => {
    const explicit = clean(node?.dataset?.seller || node?.closest?.('[data-seller]')?.dataset?.seller || '');
    if (explicit) return explicit;
    const handoffSeller = clean(document.querySelector('[data-seller]')?.textContent || '');
    if (handoffSeller && !/loading|unavailable/i.test(handoffSeller)) return handoffSeller;
    const card = node?.closest?.('[data-product-id],[data-offer-id],[data-seller],.tp214-deal,.tp214-coupon,.product-card,.deal-card,.offer-card,.tp-card');
    const text = clean(card?.querySelector?.('[data-seller-name],.seller,.merchant,.tp214-meta strong,.tp214-coupon-top strong')?.textContent || '');
    return text;
  };

  const pageEvent = () => {
    const path = location.pathname;
    const query = currentQuery();
    if (/^\/product\//i.test(path)) send('product_view', { search_term: query });
    else if (/^\/deal\//i.test(path)) send('deal_view', { search_term: query });
    else if (/^\/coupon\//i.test(path)) send('coupon_view', { search_term: query });
    else if (/^\/handoff\//i.test(path)) {
      const seller = sellerFromNode(document.querySelector('[data-continue]'));
      send('seller_handoff_view', { seller });
    }

    if (/^\/find\//i.test(path) && query) {
      send('search_intent', { search_term: query, search_scope: currentScope() });
    }
  };

  document.addEventListener('click', event => {
    const a = event.target?.closest?.('a[href]');
    if (!a) return;

    let url;
    try { url = new URL(a.getAttribute('href') || '', location.href); } catch { return; }

    const seller = sellerFromNode(a);
    if (url.origin === location.origin && /^\/handoff\//i.test(url.pathname)) {
      send('seller_intent', {
        seller,
        search_term: currentQuery(),
        source_path: location.pathname
      });
      return;
    }

    if (/^\/handoff\//i.test(location.pathname) && /^https?:$/.test(url.protocol) && url.origin !== location.origin) {
      const finalSeller = seller || clean(document.querySelector('[data-seller]')?.textContent || url.hostname);
      const params = {
        seller: finalSeller,
        destination_host: clean(url.hostname),
        source_path: clean(document.referrer ? (() => { try { return new URL(document.referrer).pathname; } catch { return ''; } })() : ''),
        cpc_candidate: CPC_SELLER_RE.test(finalSeller) ? 'yes' : 'no'
      };
      send('seller_click', params);
      if (CPC_SELLER_RE.test(finalSeller)) {
        send('cpc_candidate_click', { ...params, cpc_status: 'candidate_not_confirmed' });
      }
    }
  }, true);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(pageEvent, 0), { once: true });
  } else {
    setTimeout(pageEvent, 0);
  }
})();
