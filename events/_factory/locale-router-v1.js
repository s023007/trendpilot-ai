(() => {
  'use strict';
  const allowed = Array.isArray(window.__TP_EVENT_LOCALES__) ? window.__TP_EVENT_LOCALES__ : ['ar','en-gb'];
  if (!allowed.length) return;
  const params = new URLSearchParams(location.search);
  if (params.get('tp_locale') === 'stay') return;

  const countryToLocale = country => {
    const c = String(country || '').toUpperCase();
    if (['OM','AE','SA','QA','KW','BH'].includes(c)) return 'ar';
    if (['GB','IE'].includes(c)) return 'en-gb';
    if (['DE','AT','CH'].includes(c)) return 'de-de';
    if (['FR','BE','LU','MC'].includes(c)) return 'fr-fr';
    if (['ES','AD'].includes(c)) return 'es-es';
    return '';
  };
  const browserLocale = () => {
    const langs = [...(navigator.languages || []), navigator.language || ''].map(x => String(x).toLowerCase());
    for (const l of langs) {
      if (l.startsWith('ar')) return 'ar';
      if (l.startsWith('de')) return 'de-de';
      if (l.startsWith('fr')) return 'fr-fr';
      if (l.startsWith('es')) return 'es-es';
      if (l.startsWith('en')) return 'en-gb';
    }
    return 'en-gb';
  };
  const go = desired => {
    let locale = allowed.includes(desired) ? desired : '';
    if (!locale) locale = allowed.includes(browserLocale()) ? browserLocale() : (allowed.includes('en-gb') ? 'en-gb' : allowed[0]);
    if (!locale) return;
    const base = location.pathname.endsWith('/') ? location.pathname : location.pathname + '/';
    const target = `${base}${locale}/${location.search}${location.hash}`;
    const key = `tp:event-locale:${base}`;
    try {
      if (sessionStorage.getItem(key) === locale) return;
      sessionStorage.setItem(key, locale);
    } catch (_) {}
    location.replace(target);
  };

  let settled = false;
  const finish = country => {
    if (settled) return;
    settled = true;
    go(countryToLocale(country));
  };
  const timer = setTimeout(() => finish(''), 900);
  fetch('/visitor-context.json?v=event-locale-1', {cache:'no-store', credentials:'same-origin'})
    .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
    .then(data => { clearTimeout(timer); finish(data && data.country); })
    .catch(() => { clearTimeout(timer); finish(''); });
})();
