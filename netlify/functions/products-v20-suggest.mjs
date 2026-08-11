const VERSION='20.3.3';
let cache={at:0,value:null};
const TTL=10*60*1000;
const clean=v=>String(v??'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
const norm=v=>clean(v).normalize('NFKC').toLowerCase().replace(/[’'`]/g,'').replace(/[^\p{L}\p{N}+#.-]+/gu,' ').replace(/\s+/g,' ').trim();
const blocked=new Set(['temu','joom','filamentpro','filamentpro eu cps']);
const ACCESSORY_RE=/\b(?:case|cases|cover|covers|charger|chargers|charging|cable|cables|screen protector|protector|protectors|mount|holder|stand|strap|adapter|dock|replacement|replacement part|battery replacement|accessor(?:y|ies))\b/i;
const DIRTY_MAIN_RE=/\b(?:case|cases|cover|covers|charger|chargers|charging cable|screen protector|protector|mount|holder|strap|replacement part|accessor(?:y|ies))\b/i;
function json(body,status=200){return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'public, max-age=0, s-maxage=60, stale-while-revalidate=300','x-content-type-options':'nosniff'}})}
async function fetchJson(url,timeoutMs=12000){const c=new AbortController();const t=setTimeout(()=>c.abort(),timeoutMs);try{const r=await fetch(url,{headers:{accept:'application/json'},signal:c.signal});if(!r.ok)throw new Error(`HTTP ${r.status}`);return await r.json()}finally{clearTimeout(t)}}
function words(q){return norm(q).split(/\s+/).filter(Boolean)}
function escapeRe(s){return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}
function matchScore(value,q,quality=0,kind='product',sellerCount=0){
  const v=norm(value),n=norm(q),parts=words(q);
  if(!v||!n||!parts.every(p=>v.includes(p))) return -1;
  let s=Number(quality||0);
  if(v===n)s+=7000;
  if(v.startsWith(n))s+=5000;
  else if(new RegExp(`(?:^|\\s)${escapeRe(n)}`).test(v))s+=3200;
  else s+=1800;
  if(kind==='intent')s+=4000;
  if(kind==='model')s+=4500+Math.min(1200,Number(sellerCount||0)*180);
  if(kind==='related')s+=900;
  s-=Math.min(600,v.length*2);
  return s;
}
function publicRow(row,kind){return {value:clean(row.value),meta:kind==='intent'?`${clean(row.type)} category`:kind==='model'?`${clean(row.type)} model${row.sellerCount?` • ${row.sellerCount} seller${row.sellerCount===1?'':'s'}`:''}`:kind==='related'?`${clean(row.seller)} • related item`:clean(row.seller)||clean(row.type)||'Product',image:clean(row.image),seller:clean(row.seller),type:clean(row.type),kind};}
function topRows(data,q,seller,limit){
  const n=norm(q),sellerNorm=norm(seller),accessoryIntent=ACCESSORY_RE.test(n);
  const pool=[];
  if(!accessoryIntent){
    for(const r of data.intents||[]){
      const score=matchScore(r.value,q,0,'intent',0);
      if(score>=0)pool.push({...publicRow(r,'intent'),_score:score});
    }
    for(const r of data.models||[]){
      if(sellerNorm && !(r.sellers||[]).some(x=>norm(x)===sellerNorm))continue;
      const score=matchScore(r.value,q,r.quality,'model',r.sellerCount);
      if(score>=0)pool.push({...publicRow(r,'model'),_score:score});
    }
    for(const r of data.main||[]){
      if(sellerNorm&&norm(r.seller)!==sellerNorm)continue;
      if(blocked.has(norm(r.seller)))continue;
      if(DIRTY_MAIN_RE.test(norm(r.value)))continue;
      const score=matchScore(r.value,q,r.quality,'product',1);
      if(score>=0)pool.push({...publicRow(r,'product'),_score:score});
    }
  }else{
    for(const r of data.related||[]){
      if(sellerNorm&&norm(r.seller)!==sellerNorm)continue;
      if(blocked.has(norm(r.seller)))continue;
      const score=matchScore(r.value,q,r.quality,'related',1);
      if(score>=0)pool.push({...publicRow(r,'related'),_score:score});
    }
  }
  pool.sort((a,b)=>b._score-a._score || a.value.length-b.value.length || a.value.localeCompare(b.value));
  const out=[],seen=new Set();
  for(const r of pool){
    const key=norm(r.value);
    if(!key||seen.has(key))continue;
    seen.add(key);
    const {_score,...safe}=r;out.push(safe);
    if(out.length>=limit)break;
  }
  return {accessoryIntent,rows:out};
}
export default async function handler(request){
  try{
    const u=new URL(request.url),origin=u.origin,q=clean(u.searchParams.get('q')||'').slice(0,120),seller=clean(u.searchParams.get('seller')||'').slice(0,140),limit=Math.max(1,Math.min(Number(u.searchParams.get('limit')||8),12));
    if(q.length<2)return json({ok:true,version:VERSION,query:q,rows:[]});
    const now=Date.now();
    if(!cache.value||now-cache.at>TTL){cache={at:now,value:await fetchJson(`${origin}/data/search-v20/autocomplete-v1.json?v=${VERSION}`)}}
    const data=cache.value;
    if(data?.version!==VERSION)return json({ok:false,version:VERSION,status:'autocomplete-index-not-deployed',indexVersion:data?.version||''},503);
    const result=topRows(data,q,seller,limit);
    return json({ok:true,version:VERSION,sourceVersion:data.sourceVersion,query:q,seller:seller||null,accessoryIntent:result.accessoryIntent,totalReturned:result.rows.length,rows:result.rows});
  }catch(error){return json({ok:false,version:VERSION,error:String(error?.message||error).slice(0,800)},500)}
}
export { topRows };
export const config={path:'/api/products-v20-suggest',method:'GET'};
