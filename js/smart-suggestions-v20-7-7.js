(() => {
  'use strict';
  const VERSION='21.4.0',d=document;
  const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
  const lower=v=>clean(v).toLowerCase();
  const esc=v=>clean(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const selector='input[data-tp-finder-input], .tp-search input[type="search"][name="q"]';
  const fallbackIntents=[
    ['phone','Phones'],['laptop','Laptops'],['headphones','Headphones & earbuds'],['perfume','Perfume'],
    ['power bank','Portable chargers'],['smartwatch','Smart watches'],['dog food','Pet food'],
    ['air conditioner','Air conditioners'],['3d filament','3D printing'],['tools','Tools']
  ];
  let panel=null,input=null,seq=0,gesture=null,timer=null,controller=null;
  const localRows=q=>{const n=lower(q);return n.length<1?[]:fallbackIntents.filter(([v])=>lower(v).startsWith(n)||lower(v).includes(n)).slice(0,5).map(([value,meta])=>({value,meta,kind:'intent'}));};
  function host(el){const h=el.closest('.tp-search-input')||el.parentElement;h?.classList.add('tp-amazon-search-host');return h;}
  function ensure(el){const h=host(el);let p=h?.querySelector(':scope > .tp-v20-suggest[data-v20-suggest]');if(!p){p=d.createElement('div');p.className='tp-v20-suggest';p.dataset.v20Suggest='';p.hidden=true;p.innerHTML='<div class="tp-amazon-list" role="listbox" aria-label="Search suggestions"></div>';h?.appendChild(p);}return p;}
  function close(){seq++;if(controller)controller.abort();controller=null;if(panel)panel.hidden=true;panel=null;input=null;gesture=null;}
  function currentSeller(){return clean(d.querySelector('[data-filter-merchant]')?.value||'');}
  async function remoteRows(q){
    if(!clean(q))return[];
    if(controller)controller.abort();
    controller=new AbortController();
    const p=new URLSearchParams({q,limit:'10'}),seller=currentSeller();
    if(seller)p.set('seller',seller);
    const r=await fetch(`/api/products-v20-suggest?${p}`,{cache:'no-store',signal:controller.signal,headers:{accept:'application/json'}});
    if(!r.ok)return[];
    const j=await r.json();
    return j?.ok&&Array.isArray(j.rows)?j.rows:[];
  }
  async function load(q){
    let remote=[];
    try{remote=await remoteRows(q);}catch(e){if(e?.name!=='AbortError')console.warn('[TrendPilot autocomplete]',e);}
    const local=localRows(q),out=[],seen=new Set();
    // Catalogue results are the source of truth. Familiar category shortcuts only fill unused slots.
    for(const row of [...remote,...local]){
      const key=lower(row?.value);
      if(!key||seen.has(key))continue;
      seen.add(key);out.push({...row,image:''});
      if(out.length>=10)break;
    }
    return out;
  }
  async function render(el){
    const token=++seq,q=clean(el.value);
    if(q.length<1){close();return;}
    const rows=await load(q);if(token!==seq)return;
    input=el;panel=ensure(el);panel._rows=rows;
    panel.querySelector('.tp-amazon-list').innerHTML=rows.map((row,i)=>`<button type="button" class="tp-amazon-row" role="option" data-i="${i}"><span class="tp-amazon-search-icon" aria-hidden="true">⌕</span><span class="tp-amazon-copy"><b>${esc(row.value)}</b>${row.meta?`<small>${esc(row.meta)}</small>`:''}</span><span class="tp-amazon-arrow" aria-hidden="true">›</span></button>`).join('');
    panel.hidden=!rows.length;
  }
  function schedule(el){clearTimeout(timer);timer=setTimeout(()=>render(el),150);}
  function searchUrl(value){const p=new URLSearchParams();p.set('q',clean(value));p.set('engine','v2064');p.set('ui','2077');const scope=clean(d.querySelector('[data-tp-finder-scope], [data-tp-search-scope]')?.value||'');if(scope)p.set('scope',scope);return `/find/?${p.toString()}`;}
  function choose(row){if(!input||!row)return;const value=clean(row.value);if(!value)return;input.value=value;close();location.assign(searchUrl(value));}
  d.addEventListener('input',e=>{if(e.target.matches(selector))schedule(e.target);});
  d.addEventListener('focusin',e=>{if(e.target.matches(selector)&&clean(e.target.value).length>=1)schedule(e.target);});
  d.addEventListener('pointerdown',e=>{const row=e.target.closest('.tp-amazon-row');if(row&&panel&&input){gesture={row,id:e.pointerId,x:e.clientX,y:e.clientY,moved:false};return;}if(panel&&!e.target.closest('.tp-v20-suggest')&&e.target!==input)close();},{passive:true});
  d.addEventListener('pointermove',e=>{if(!gesture||gesture.id!==e.pointerId)return;if(Math.hypot(e.clientX-gesture.x, e.clientY-gesture.y)>8)gesture.moved=true;},{passive:true});
  d.addEventListener('pointerup',e=>{if(!gesture||gesture.id!==e.pointerId)return;const g=gesture;gesture=null;if(g.moved)return;const row=e.target.closest('.tp-amazon-row');if(!row||row!==g.row||!panel)return;choose((panel._rows||[])[Number(row.dataset.i)]);});
  d.addEventListener('click',e=>{const row=e.target.closest('.tp-amazon-row');if(!row||!panel||!input)return;e.preventDefault();e.stopImmediatePropagation();choose((panel._rows||[])[Number(row.dataset.i)]);},true);
  d.addEventListener('keydown',e=>{if(e.key==='Escape'){close();return;}if(e.key==='Enter'&&panel&&!panel.hidden&&input===e.target){const first=(panel._rows||[])[0];if(first){e.preventDefault();choose(first);}}});
  d.addEventListener('pointercancel',()=>gesture=null);
  window.__TP_V2077_SUGGEST__={version:VERSION,searchUrl};
})();
