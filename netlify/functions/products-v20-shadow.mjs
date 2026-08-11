import { runShadowSearch } from './products-v20-shadow-lib.mjs';
const VERSION='20.2.1';
let manifestCache={at:0,value:null};
const typeCache=new Map();
const TTL=10*60*1000;
function json(body,status=200){return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'public, max-age=0, s-maxage=60, stale-while-revalidate=300','x-content-type-options':'nosniff'}})}
async function fetchJson(url,timeoutMs=10000){const c=new AbortController();const t=setTimeout(()=>c.abort(),timeoutMs);try{const r=await fetch(url,{headers:{accept:'application/json'},signal:c.signal});if(!r.ok)throw new Error(`HTTP ${r.status} ${url}`);return await r.json()}finally{clearTimeout(t)}}
export default async function handler(request){
  try{
    const u=new URL(request.url); const origin=u.origin;
    const now=Date.now();
    if(!manifestCache.value || now-manifestCache.at>TTL){manifestCache={at:now,value:await fetchJson(`${origin}/data/search-v20/manifest.json?v=${VERSION}`)}}
    const manifest=manifestCache.value;
    if(manifest?.version!==VERSION) return json({ready:false,version:manifest?.version||'',expected:VERSION,status:'projection-not-deployed'},503);
    if(u.searchParams.get('meta')==='1') return json({ready:true,version:VERSION,manifest});
    const query=u.searchParams.get('q')||'';
    if(!query.trim()) return json({ready:true,version:VERSION,message:'Use ?q=phone or another validated query. Add &seller=SellerName to scope results.'});
    const loadType=async(type)=>{
      const hit=typeCache.get(type); if(hit && now-hit.at<TTL) return hit.value;
      const value=await fetchJson(`${origin}/data/search-v20/types/${encodeURIComponent(type)}.json?v=${VERSION}`,15000);
      typeCache.set(type,{at:now,value}); return value;
    };
    const result=await runShadowSearch({query,seller:u.searchParams.get('seller')||'',limit:u.searchParams.get('limit')||12,includeRelated:u.searchParams.get('related')!=='0'},manifest,loadType);
    return json(result);
  }catch(error){return json({ready:false,version:VERSION,error:String(error?.message||error).slice(0,1000)},500)}
}
export const config={path:'/api/products-v20-shadow',method:'GET'};

