(() => {
  'use strict';

  if (window.__TP_ANALYTICS_CPC_V21_18__) return;
  window.__TP_ANALYTICS_CPC_V21_18__ = true;

  const MEASUREMENT_ID = 'G-EKSFY3JE4D';
  const CLARITY_ID = 'y3bc7e7s9g';
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

  window.clarity = window.clarity || function(){
    (window.clarity.q = window.clarity.q || []).push(arguments);
  };
  if (!document.querySelector(`script[src*="clarity.ms/tag/${CLARITY_ID}"]`)) {
    const clarityTag = document.createElement('script');
    clarityTag.async = true;
    clarityTag.src = `https://www.clarity.ms/tag/${CLARITY_ID}?ref=bwt`;
    document.head.appendChild(clarityTag);
  }

  const claritySet = (key, value) => {
    const safe = clean(value);
    if (!safe) return;
    try { window.clarity('set', clean(key), safe); } catch (_) {}
  };

  const clarityEvent = name => {
    try { window.clarity('event', clean(name)); } catch (_) {}
  };

  const send = (name, params = {}) => {
    try {
      window.gtag('event', name, {
        page_path: location.pathname + location.search,
        visitor_country: clean(window.__TP_VISITOR_COUNTRY__ || document.documentElement.dataset.tpCountry || 'ZZ'),
        ...params
      });
    } catch (_) {}
    clarityEvent(name);
  };

  const currentQuery = () => {
    const qs = new URLSearchParams(location.search);
    return clean(qs.get('q') || qs.get('query') || qs.get('search') || '');
  };

  const currentScope = () => {
    const qs = new URLSearchParams(location.search);
    return clean(qs.get('scope') || '');
  };

  const pageType = () => {
    const path = location.pathname;
    if (path === '/') return 'home';
    if (/^\/find\//i.test(path)) return 'search';
    if (/^\/product\//i.test(path)) return 'product';
    if (/^\/deal\//i.test(path)) return 'deal';
    if (/^\/coupon\//i.test(path)) return 'coupon';
    if (/^\/handoff\//i.test(path)) return 'handoff';
    if (/^\/compare\//i.test(path)) return 'compare';
    if (/^\/deals\//i.test(path)) return 'deals';
    return clean(document.body?.dataset?.tpPage || 'other');
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

  const syncClarityContext = () => {
    claritySet('tp_page_type', pageType());
    claritySet('tp_country', window.__TP_VISITOR_COUNTRY__ || document.documentElement.dataset.tpCountry || 'ZZ');
  };

  const pageEvent = () => {
    syncClarityContext();
    const path = location.pathname;
    const query = currentQuery();
    if (/^\/product\//i.test(path)) send('product_view', { search_term: query });
    else if (/^\/deal\//i.test(path)) send('deal_view', { search_term: query });
    else if (/^\/coupon\//i.test(path)) send('coupon_view', { search_term: query });
    else if (/^\/handoff\//i.test(path)) {
      const seller = sellerFromNode(document.querySelector('[data-continue]'));
      claritySet('tp_seller', seller);
      send('seller_handoff_view', { seller });
    }

    if (/^\/find\//i.test(path) && query) {
      send('search_intent', { search_term: query, search_scope: currentScope() });
    }
  };

  document.addEventListener('trendpilot:geo-ready', syncClarityContext);

  document.addEventListener('click', event => {
    const a = event.target?.closest?.('a[href]');
    if (!a) return;

    let url;
    try { url = new URL(a.getAttribute('href') || '', location.href); } catch { return; }

    const seller = sellerFromNode(a);
    if (url.origin === location.origin && /^\/handoff\//i.test(url.pathname)) {
      claritySet('tp_seller', seller);
      send('seller_intent', {
        seller,
        search_term: currentQuery(),
        source_path: location.pathname
      });
      return;
    }

    if (/^\/handoff\//i.test(location.pathname) && /^https?:$/.test(url.protocol) && url.origin !== location.origin) {
      const finalSeller = seller || clean(document.querySelector('[data-seller]')?.textContent || url.hostname);
      const isCpcCandidate = CPC_SELLER_RE.test(finalSeller);
      claritySet('tp_seller', finalSeller);
      claritySet('tp_cpc_candidate', isCpcCandidate ? 'yes' : 'no');
      const params = {
        seller: finalSeller,
        destination_host: clean(url.hostname),
        source_path: clean(document.referrer ? (() => { try { return new URL(document.referrer).pathname; } catch { return ''; } })() : ''),
        cpc_candidate: isCpcCandidate ? 'yes' : 'no'
      };
      send('seller_click', params);
      if (isCpcCandidate) {
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
