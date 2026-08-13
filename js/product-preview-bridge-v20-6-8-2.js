(()=>{'use strict';
  const qs=new URLSearchParams(location.search);
  const engine=(qs.get('engine')||'').toLowerCase();
  if(!['v2064','v2067'].includes(engine))return;
  const norm=v=>String(v||'').trim();
  let ROUTES=null,LABELS=null;
  async function routes(){if(ROUTES)return ROUTES;const r=await fetch('/data/product-preview-v20-6/route-map.json?v=20.6.8.2',{cache:'no-store'});if(!r.ok)throw new Error(`route-map HTTP ${r.status}`);ROUTES=await r.json();return ROUTES}
  async function labels(){if(LABELS)return LABELS;try{const r=await fetch('/data/product-preview-v20-6/variant-labels-v20-6-8-2.json?v=20.6.8.2',{cache:'no-store'});if(r.ok)LABELS=await r.json()}catch{}return LABELS||{byTpid:{}}}
  function previewUrl(hit){return `/product/${encodeURIComponent(hit.route)}/`}
  async function fixText(){
    document.querySelectorAll('[data-tpid-open]').forEach(btn=>{const id=norm(btn.dataset.tpidOpen);if(!id)return;btn.textContent='View product';btn.setAttribute('aria-label','Open product preview')});
    const currentTpid=norm(new URLSearchParams(location.search).get('tpid'));
    const vm=currentTpid?(await labels()).byTpid?.[currentTpid]||{}:{};
    document.querySelectorAll('.tp67-variant-chips button,[data-variant]').forEach(btn=>{
      const vid=norm(btn.dataset.variant);
      let t=(btn.textContent||'').replace(/\b1 sellers\b/gi,'1 seller').trim();
      const count=(t.match(/(\d+)\s+sellers?\b/i)||[])[1];
      if(vid&&vid!=='ALL'&&vm[vid])t=`${vm[vid]}${count?` · ${count} seller${count==='1'?'':'s'}`:''}`;
      else{t=t.replace(/^Variant\s+\d+\s*·/i,'Seller configuration ·');t=t.replace(/^(\d{1,2}(?:\.\d+)?)\s+Inches\s*·/i,'Screen $1 in ·')}
      btn.textContent=t;
    });
  }
  async function directExactRedirect(){
    if(qs.get('compare')==='1')return;
    const id=norm(new URLSearchParams(location.search).get('tpid'));
    if(!id)return;
    const m=await routes();const hit=m.byTpid?.[id];
    if(hit&&hit.route&&document.querySelector('.tp67-compare-head'))location.replace(previewUrl(hit));
  }
  document.addEventListener('click',async e=>{
    const btn=e.target.closest('[data-tpid-open]');
    if(!btn)return;
    const id=norm(btn.dataset.tpidOpen);if(!id)return;
    // Capture before the old comparison listener so Product Preview is truly the first shopper step.
    e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
    try{const m=await routes();const hit=m.byTpid?.[id];if(hit?.route)location.href=previewUrl(hit)}catch(err){console.warn('TrendPilot Product Preview route unavailable',err)}
  },true);
  let timer=0;
  const scan=()=>{fixText().catch(()=>{});directExactRedirect().catch(()=>{})};
  const obs=new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(scan,80)});obs.observe(document.documentElement,{childList:true,subtree:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',scan,{once:true});else scan();
})();
