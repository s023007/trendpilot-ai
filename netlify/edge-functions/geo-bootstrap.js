export default async function handler(_request, context) {
  const raw = String(context?.geo?.country?.code || '').trim().toUpperCase();
  const country = /^[A-Z]{2}$/.test(raw) ? raw : 'ZZ';
  const allowTikTokUS = country === 'US';
  const js = [
    `window.__TP_VISITOR_COUNTRY__=${JSON.stringify(country)};`,
    `window.__TP_ALLOW_TIKTOK_US__=${allowTikTokUS ? 'true' : 'false'};`,
    `document.documentElement.dataset.tpCountry=${JSON.stringify(country)};`,
    `document.documentElement.dataset.tpTikTokUs=${JSON.stringify(allowTikTokUS ? 'allowed' : 'hidden')};`
  ].join('');
  return new Response(js, {
    headers: {
      'content-type': 'application/javascript; charset=utf-8',
      'cache-control': 'private, no-store, max-age=0',
      'x-trendpilot-geo-policy': 'tiktok-shop-us-v21.16'
    }
  });
}

export const config = { path: '/geo-bootstrap.js' };
