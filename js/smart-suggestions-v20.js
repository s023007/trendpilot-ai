(() => {
  'use strict';
  const d=document;
  const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
  const esc=v=>clean(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const selector='input[data-tp-finder-input]';
  let panel=null,input=null,seq=0,gesture=null,timer=null,controller=null;

  function host(el){
    const h=el.closest('.tp-search-input')||el.parentElement;
    h?.classList.add('tp-amazon-search-host');
    return h;
  }

  function ensure(el){
    const h=host(el);
    let p=h?.querySelector(':scope > .tp-v20-suggest[data-v20-suggest]');
    if(!p){
      p=d.createElement('div');
      p.className='tp-v20-suggest';
      p.dataset.v20Suggest='';
      p.hidden=true;
      p.innerHTML='<div class="tp-amazon-list" role="listbox"></div>';
      h?.appendChild(p);
    }
    return p;
  }

  function close(){
    seq++;
    if(controller)controller.abort();
    controller=null;
    if(panel)panel.hidden=true;
    panel=null;
    input=null;
    gesture=null;
  }

  function currentSeller(){return clean(d.querySelector('[data-filter-merchant]')?.value||'');}

  async function load(q){
    if(controller)controller.abort();
    controller=new AbortController();
    const p=new URLSearchParams({q,limit:'8'});
    const seller=currentSeller();
    if(seller)p.set('seller',seller);
    const r=await fetch(`/api/products-v20-suggest?${p}`,{
      cache:'no-store',signal:controller.signal,headers:{accept:'application/json'}
    });
    if(!r.ok)return[];
    const j=await r.json();
    return j?.ok&&Array.isArray(j.rows)?j.rows:[];
  }

  function icon(row){
    return row.image&&/^https?:\/\//i.test(row.image)
      ? `<span class="tp-amazon-thumb"><img src="${esc(row.image)}" alt="" loading="lazy"></span>`
      : '<span class="tp-amazon-search-icon" aria-hidden="true">⌕</span>';
  }

  async function render(el){
    const token=++seq,q=clean(el.value);
    if(q.length<2){close();return;}
    let rows=[];
    try{rows=await load(q);}catch(e){if(e?.name!=='AbortError')console.warn('TrendPilot V20 autocomplete unavailable',e);return;}
    if(token!==seq)return;
    input=el;
    panel=ensure(el);
    panel._rows=rows;
    const list=panel.querySelector('.tp-amazon-list');
    list.innerHTML=rows.map((row,i)=>`<button type="button" class="tp-amazon-row" role="option" data-i="${i}">${icon(row)}<span class="tp-amazon-copy"><b>${esc(row.value)}</b>${row.meta?`<small>${esc(row.meta)}</small>`:''}</span></button>`).join('');
    panel.hidden=!rows.length;
  }

  function schedule(el){clearTimeout(timer);timer=setTimeout(()=>render(el),170);}

  function searchUrl(value){
    const q=clean(value);
    const p=new URLSearchParams();
    p.set('q',q);
    p.set('engine','v2064');
    p.set('ui','2076');
    const scope=clean(d.querySelector('[data-tp-finder-scope]')?.value||'');
    if(scope)p.set('scope',scope);
    return `/find/?${p.toString()}`;
  }

  function choose(row){
    if(!input||!row)return;
    const value=clean(row.value);
    if(!value)return;
    input.value=value;
    close();
    // Do not depend on legacy form-submit listeners. A suggestion click owns a fresh V20 search.
    location.assign(searchUrl(value));
  }

  d.addEventListener('input',e=>{if(e.target.matches(selector))schedule(e.target);});
  d.addEventListener('focusin',e=>{if(e.target.matches(selector)&&clean(e.target.value).length>=2)schedule(e.target);});

  d.addEventListener('pointerdown',e=>{
    const row=e.target.closest('.tp-amazon-row');
    if(row&&panel&&input){gesture={row,id:e.pointerId,x:e.clientX,y:e.clientY,moved:false};return;}
    if(panel&&!e.target.closest('.tp-v20-suggest')&&e.target!==input)close();
  },{passive:true});

  d.addEventListener('pointermove',e=>{
    if(!gesture||gesture.id!==e.pointerId)return;
    if(Math.hypot(e.clientX-gesture.x,e.clientY-gesture.y)>8)gesture.moved=true;
  },{passive:true});

  d.addEventListener('pointerup',e=>{
    if(!gesture||gesture.id!==e.pointerId)return;
    const g=gesture;gesture=null;
    if(g.moved)return;
    const row=e.target.closest('.tp-amazon-row');
    if(!row||row!==g.row||!panel)return;
    choose((panel._rows||[])[Number(row.dataset.i)]);
  });

  // Android/WebView fallback: some devices suppress pointerup after the keyboard changes focus.
  d.addEventListener('click',e=>{
    const row=e.target.closest('.tp-amazon-row');
    if(!row||!panel||!input)return;
    e.preventDefault();
    e.stopImmediatePropagation();
    choose((panel._rows||[])[Number(row.dataset.i)]);
  },true);

  d.addEventListener('pointercancel',()=>gesture=null);
  d.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
})();