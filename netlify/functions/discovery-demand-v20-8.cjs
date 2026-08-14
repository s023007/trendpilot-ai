const crypto = require('crypto');
exports.handler = async (event) => {
  const headers = { 'content-type':'application/json', 'access-control-allow-origin':'*', 'access-control-allow-methods':'POST,OPTIONS', 'access-control-allow-headers':'content-type' };
  if (event.httpMethod === 'OPTIONS') return { statusCode:204, headers, body:'' };
  if (event.httpMethod !== 'POST') return { statusCode:405, headers, body:JSON.stringify({ok:false}) };
  try {
    const body = JSON.parse(event.body || '{}');
    const q = String(body.q || '').replace(/\s+/g,' ').trim().slice(0,180);
    if (q.length < 2) return { statusCode:400, headers, body:JSON.stringify({ok:false}) };
    const { getStore } = await import('@netlify/blobs');
    const store = getStore('trendpilot-discovery-demand-v20-8');
    const key = crypto.createHash('sha1').update(q.toLowerCase()).digest('hex').slice(0,20);
    const old = await store.get(key, { type:'json', consistency:'strong' }).catch(() => null);
    const now = new Date().toISOString();
    const row = { query:q, count:Number(old?.count || 0)+1, firstSeen:old?.firstSeen || now, lastSeen:now, lastSource:String(body.source || '').slice(0,300), lastPath:String(body.path || '').slice(0,300) };
    await store.setJSON(key, row);
    return { statusCode:200, headers, body:JSON.stringify({ok:true,count:row.count}) };
  } catch (e) {
    return { statusCode:200, headers, body:JSON.stringify({ok:false}) };
  }
};