(() => {
  'use strict';
  const VERSION='21.13.6';
  const p=new URLSearchParams(location.search);
  const q=String(p.get('q')||'').trim().toLowerCase();
  const foot=/^(?:shoe|shoes|sneaker|sneakers|boot|boots|sandal|sandals|slipper|slippers|footwear|loafer|loafers|heel|heels)$/i.test(q);
  const broad=/^(?:popular products?|popular|products?|best sellers?|bestsellers?|trending products?|trending)$/i.test(q);
  if(!foot&&!broad)return;

  const original=window.fetch.bind(window);
  const dataPath=foot?'/data/v20-9/footwear-seller-samples.json':'/data/v20-9/seller-browse-samples.json';
  let packed=null;
  let byPrefix=null;

  const jsonResponse=value=>new Response(JSON.stringify(value),{
    status:200,
    headers:{'content-type':'application/json; charset=utf-8','cache-control':'public, max-age=60'}
  });

  const load=async()=>{
    if(packed)return packed;
    const r=await original(`${dataPath}?v=${VERSION}`,{cache:'reload'});
    if(!r.ok)throw new Error(`Packed search data ${r.status}`);
    packed=await r.json();
    byPrefix={};
    for(const [id,row] of Object.entries(packed.records||{})){
      const pre=String(id).slice(0,2);
      (byPrefix[pre]??={})[id]=row;
    }
    return packed;
  };
  const ready=load().catch(()=>null);

  window.fetch=async(input,init)=>{
    const url=typeof input==='string'?input:(input&&input.url)||String(input||'');
    try{
      if(url.includes(dataPath)){
        const data=await ready;
        if(data)return jsonResponse(data);
      }
      const m=url.match(/\/data\/v20-9\/products\/([a-z0-9_]{2})\.json(?:\?|$)/i);
      if(m){
        const data=await ready;
        if(data){
          const bucket=byPrefix?.[m[1]]||{};
          if(Object.keys(bucket).length)return jsonResponse(bucket);
        }
      }
    }catch{}
    return original(input,init);
  };

  window.__TP_PACKED_SEARCH_CACHE__={version:VERSION,mode:foot?'footwear':'broad',dataPath};
})();
