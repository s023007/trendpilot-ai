(() => {
  'use strict';
  const d=document,clean=v=>String(v??'').replace(/\s+/g,' ').trim(),low=v=>clean(v).toLowerCase();
  const BLOCKED=new Set(['temu','joom','filamentpro','filamentpro eu cps']);
  const FALLBACK=['Geekbuying','AliExpress','Alibaba','PandaHall','Karaca EU','FragranceShop.com','Govee Many GEOs','Harfington Many GEOs','Sunsky-online WW','Diecast','MFI Medical','Lenovo','TikTok Shop US'];
  let allowed=[];
  function canonical(v){const n=low(v);return allowed.find(x=>low(x)===n)||'';}
  function apply(){const s=d.querySelector('[data-filter-merchant]');if(!s||!allowed.length)return;const selected=canonical(s.value)||canonical(s.options[s.selectedIndex]?.textContent||'');const current=[...s.options].map(o=>clean(o.textContent));const desired=['All sellers',...allowed];if(current.join('|')!==desired.join('|')){s.innerHTML='';s.add(new Option('All sellers',''));for(const name of allowed)s.add(new Option(name,name));}if(selected&&allowed.includes(selected))s.value=selected;else if(selected)s.value='';s.dataset.tpApprovedSellers='20.3.3';}
  async function init(){try{const r=await fetch('/data/search-v20/manifest.json?v=20.3.3',{cache:'no-store'});const j=r.ok?await r.json():{};allowed=(j.publicSellers||[]).map(x=>typeof x==='string'?x:x?.name).map(clean).filter(x=>x&&!BLOCKED.has(low(x)));}catch{allowed=[];}if(allowed.length!==13)allowed=[...FALLBACK];apply();new MutationObserver(()=>requestAnimationFrame(apply)).observe(d.body||d.documentElement,{childList:true,subtree:true});setTimeout(apply,400);setTimeout(apply,1200);}
  if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
