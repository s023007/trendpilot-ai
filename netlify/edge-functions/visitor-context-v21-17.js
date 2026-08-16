export default async function handler(_request, context) {
  const raw = String(context && context.geo && context.geo.country && context.geo.country.code || '').trim().toUpperCase();
  const country = /^[A-Z]{2}$/.test(raw) ? raw : 'ZZ';
  return new Response(JSON.stringify({country}), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'private, no-store, max-age=0',
      'x-trendpilot-visitor-context': '21.17.0'
    }
  });
}

export const config = { path: '/visitor-context.json' };
