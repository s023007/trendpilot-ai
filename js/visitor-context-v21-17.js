(() => {
  'use strict';

  if (window.__TP_VISITOR_CONTEXT_V21_17__) return;
  window.__TP_VISITOR_CONTEXT_V21_17__ = true;

  window.__TP_VISITOR_COUNTRY__ = 'ZZ';
  window.__TP_ALLOW_TIKTOK_US__ = false;

  let resolveReady;
  const ready = new Promise(resolve => { resolveReady = resolve; });
  window.__TP_GEO_READY__ = ready;

  let settled = false;
  function finish(raw) {
    if (settled) return;
    settled = true;
    const value = String(raw || '').trim().toUpperCase();
    const country = /^[A-Z]{2}$/.test(value) ? value : 'ZZ';
    const allowTikTokUS = country === 'US';
    window.__TP_VISITOR_COUNTRY__ = country;
    window.__TP_ALLOW_TIKTOK_US__ = allowTikTokUS;
    document.documentElement.dataset.tpCountry = country;
    document.documentElement.dataset.tpTikTokUs = allowTikTokUS ? 'allowed' : 'hidden';
    try {
      document.dispatchEvent(new CustomEvent('trendpilot:geo-ready', {detail:{country, allowTikTokUS}}));
    } catch (_) {}
    resolveReady({country, allowTikTokUS});
  }

  const timer = setTimeout(() => finish('ZZ'), 1400);
  fetch('/visitor-context.json?v=21.17.0', {cache:'no-store', credentials:'same-origin'})
    .then(response => response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`)))
    .then(data => { clearTimeout(timer); finish(data && data.country); })
    .catch(() => { clearTimeout(timer); finish('ZZ'); });

  if (!document.querySelector('script[data-tp-analytics-cpc]')) {
    const analytics = document.createElement('script');
    analytics.defer = true;
    analytics.dataset.tpAnalyticsCpc = '21.19';
    analytics.src = '/js/analytics-cpc-v21-18.js?v=21.19.0';
    document.head.appendChild(analytics);
  }
})();
