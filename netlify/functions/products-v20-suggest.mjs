const VERSION='20.3.3';
const BUILD='21.12.0';
let cache={at:0,value:null};
const TTL=10*60*1000;
const clean=v=>String(v??'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
const norm=v=>clean(v).normalize('NFKC').toLowerCase().replace(/[’'`]/g,'').replace(/[^\p{L}\p{N}+#.-]+/gu,' ').replace(/\s+/g,' ').trim();
const blocked=new Set(['temu','joom','filamentpro','filamentpro eu cps','filamentpro-eu-cps']);
const ACCESSORY_RE=/\b(?:case|cases|cover|covers|charger|chargers|charging|cable|cables|screen protector|protector|protectors|mount|holder|stand|strap|adapter|dock|replacement|replacement part|battery replacement|accessor(?:y|ies))\b/i;
const DIRTY_MAIN_RE=/\b(?:case|cases|cover|covers|charger|chargers|charging cable|screen protector|protector|mount|holder|strap|replacement part|accessor(?:y|ies))\b/i;
const SAFE_INTENTS=[
  ['phone','phone'],['smartphone','phone'],['tablet','tablet'],['laptop','laptop'],
  ['headphones','headphones'],['earbuds','headphones'],['speaker','speaker'],['smartwatch','smartwatch'],
  ['camera','camera'],['printer','printer'],['projector','projector'],['television','television'],
  ['perfume','perfume'],['fragrance','perfume'],['makeup','beauty'],['skincare','beauty'],
  ['power bank','power-bank'],['air conditioner','air-conditioning'],['air fryer','home-appliances'],
  ['cookware','kitchen'],['lighting','lighting'],['furniture','furniture'],['tools','tools'],['drill','tools'],
  ['3d printer','3d-printing'],['3d filament','3d-printing'],['dog food','pets'],['pet supplies','pets'],
  ['car accessories','automotive'],['shoes','apparel'],['sneakers','apparel'],['boots','apparel'],
  ['clothing','apparel'],['bags','bags'],['fitness equipment','sports'],['baby products','baby'],
  ['toys','toys'],['office supplies','office'],['medical equipment','medical']
].map(([value,type])=>({value,type}));
function json(body,status=200){return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'public, max-age=0, s-maxage=60, stale-while-revalidate=300','x-content-type-options':'nosniff'}})}
async function fetchJson(url,timeoutMs=12000){const c=new AbortController();const t=setTimeout(()=>c.abort(),timeoutMs);try{const r=await fetch(url,{headers:{accept:'application/json'},signal:c.signal});if(!r.ok)throw new Error(`HTTP ${r.status}`);return await r.json()}finally{clearTimeout(t)}}
function words(q){return norm(q).split(/\s+/).filter(Boolean)}
function escapeRe(s){return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}
function matchScore(value,q,quality=0,kind='product',sellerCount=0){
  const v=norm(value),n=norm(q),parts=words(q);
  if(!v||!n)return -1;
  if(n.length===1&&!v.startsWith(n))return -1;
  if(!parts.every(p=>v.includes(p)))return -1;
  let s=Math.min(1600,Number(quality||0));
  const wordStart=new RegExp(`(?:^|\\s)${escapeRe(n)}`).test(v);
  if(v===n)s+=9000;
  else if(v.startsWith(n))s+=6500;
  else if(wordStart)s+=4800;
  else s+=1800;
  if(kind==='model')s+=2800+Math.min(900,Number(sellerCount||0)*120);
  else if(kind==='intent')s+=900;
  else if(kind==='related')s+=400;
  s-=Math.min(700,v.length*2);
  return s;
}
function publicRow(row,kind){
  let meta='';
  if(kind==='intent')meta=clean(row.type)||'Category';
  else if(kind==='model')meta=[clean(row.type),row.sellerCount?`${row.sellerCount} seller${row.sellerCount===1?'':'s'}`:''].filter(Boolean).join(' • ');
  else meta=clean(row.seller)||clean(row.type)||'Product';
  return {value:clean(row.value),meta,image:clean(row.image),seller:clean(row.seller),type:clean(row.type),kind};
}
function topRows(data,q,seller,limit){
  const n=norm(q),sellerNorm=norm(seller),accessoryIntent=ACCESSORY_RE.test(n),pool=[];
  if(!accessoryIntent){
    const intents=[...SAFE_INTENTS,...(data.intents||[])];
    for(const r of intents){
      const score=matchScore(r.value,q,0,'intent',0);
      if(score>=0)pool.push({...publicRow(r,'intent'),_score:score});
    }
    for(const r of data.models||[]){
      if(sellerNorm&&!(r.sellers||[]).some(x=>norm(x)===sellerNorm))continue;
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
  pool.sort((a,b)=>b._score-a._score||a.value.length-b.value.length||a.value.localeCompare(b.value));
  const out=[],seen=new Set();
  for(const r of pool){
    const key=norm(r.value);if(!key||seen.has(key))continue;
    seen.add(key);const {_score,...safe}=r;out.push(safe);
    if(out.length>=limit)break;
  }
  return {accessoryIntent,rows:out};
}
export default async function handler(request){
  try{
    const u=new URL(request.url),origin=u.origin,q=clean(u.searchParams.get('q')||'').slice(0,120),seller=clean(u.searchParams.get('seller')||'').slice(0,140),limit=Math.max(1,Math.min(Number(u.searchParams.get('limit')||10),12));
    if(q.length<1)return json({ok:true,version:VERSION,build:BUILD,query:q,rows:[]});
    const now=Date.now();
    if(!cache.value||now-cache.at>TTL)cache={at:now,value:await fetchJson(`${origin}/data/search-v20/autocomplete-v1.json?v=${VERSION}`)};
    const data=cache.value;
    if(data?.version!==VERSION)return json({ok:false,version:VERSION,build:BUILD,status:'autocomplete-index-not-deployed',indexVersion:data?.version||''},503);
    const result=topRows(data,q,seller,limit);
    return json({ok:true,version:VERSION,build:BUILD,sourceVersion:data.sourceVersion,query:q,seller:seller||null,accessoryIntent:result.accessoryIntent,totalReturned:result.rows.length,rows:result.rows});
  }catch(error){return json({ok:false,version:VERSION,build:BUILD,error:String(error?.message||error).slice(0,800)},500)}
}
export {topRows};
export const config={path:'/api/products-v20-suggest',method:'GET'};
