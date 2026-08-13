import { loadProductData } from './trendpilot-product-data.mjs';

const BLOCKED = /^(?:Temu|Joom|FilamentPRO(?: EU CPS)?)$/i;
const clean = v => String(v ?? '').trim();
const validHttp = v => { try { const u = new URL(clean(v)); return /^https?:$/.test(u.protocol); } catch { return false; } };

export const handler = async event => {
  try {
    const q = event?.queryStringParameters || {};
    const id = clean(q.offer);
    if (!id) return {statusCode:400,headers:{'cache-control':'no-store'},body:'Missing offer'};
    const {offers} = loadProductData();
    const offer = offers.find(o => clean(o.tpoid) === id);
    if (!offer || BLOCKED.test(clean(offer.seller)) || !validHttp(offer.url)) {
      return {statusCode:404,headers:{'cache-control':'no-store'},body:'Offer unavailable'};
    }

    const src = clean(q.src).slice(0,60).replace(/[^a-z0-9_.-]/gi,'_') || 'unknown';
    console.log(JSON.stringify({
      event:'seller_outbound',
      tpid:offer.tpid,
      tpvid:offer.tpvid || '',
      tpoid:offer.tpoid,
      seller:offer.seller,
      src,
      cpcCapable:Boolean(offer.cpcCapable),
      cpcConfirmed:Boolean(offer.cpcConfirmed)
    }));

    // Critical monetization rule: redirect to the exact committed affiliate/tracking URL.
    // Do not append, strip, rebuild or normalize the seller destination query string.
    return {
      statusCode:302,
      headers:{
        location:offer.url,
        'cache-control':'no-store, max-age=0',
        'x-robots-tag':'noindex, nofollow'
      },
      body:''
    };
  } catch (err) {
    console.error('trendpilot-outbound',err);
    return {statusCode:503,headers:{'cache-control':'no-store'},body:'Seller link is temporarily unavailable.'};
  }
};
