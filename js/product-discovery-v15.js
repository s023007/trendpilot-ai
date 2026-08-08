(() => {
  "use strict";
  const d=document,clean=v=>String(v??"").replace(/\s+/g," ").trim(),low=v=>clean(v).toLowerCase();
  const esc=v=>clean(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  let cache=null,panel=null,input=null,gesture=null,seq=0;
  const rankKind={"product-type":0,"product":1,"seller":2};
  async function data(){return cache||(cache=fetch(`/data/product-discovery-v15.json?v=15.2.0`,{cache:"force-cache"}).then(r=>r.ok?r.json():{}).catch(()=>({})));}
  function ensure(el){let p=el.closest(".tp-search-input")?.querySelector(":scope > .tp-v15-suggest");if(!p){p=d.createElement("div");p.className="tp-v15-suggest";p.hidden=true;p.innerHTML='<div class="tp-v15-list" role="listbox"></div>';el.closest(".tp-search-input")?.appendChild(p);}return p;}
  function close(){seq++;if(panel)panel.hidden=true;panel=null;input=null;gesture=null;d.documentElement.classList.remove("tp-v15-search-open");}
  function score(r,q){const v=low(r.value);let s=Number(r.score||0);if(v===q)s+=500;if(v.startsWith(q))s+=300;else if(v.split(/\s+/).some(x=>x.startsWith(q)))s+=140;else if(v.includes(q))s+=60;s-=(rankKind[r.kind]??4)*35;return s;}
  async function rows(el){const q=low(el.value);if(!q)return[];const x=await data();let pool=[];if(q.length===1)pool=x.byLetter?.[q]||[];else pool=[...(x.byLetter?.[q[0]]||[]),...Object.values(x.byLetter||{}).flat()];const seen=new Set();return pool.filter(r=>{const v=low(r.value),parts=q.split(/\s+/).filter(Boolean);return v.startsWith(q)||parts.every(p=>v.includes(p));}).sort((a,b)=>score(b,q)-score(a,q)||String(a.value).length-String(b.value).length).filter(r=>{const k=low(r.value);if(seen.has(k))return false;seen.add(k);return true;}).slice(0,8);}
  function icon(r){return r.image&&/^https?:\/\//i.test(r.image)?`<span class="tp-v15-thumb"><img src="${esc(r.image)}" alt="" loading="lazy"></span>`:'<span class="tp-v15-search-icon">⌕</span>';}
  async function render(el){const n=++seq,q=clean(el.value);if(!q){close();return;}const listRows=await rows(el);if(n!==seq)return;input=el;panel=ensure(el);panel._rows=listRows;panel.querySelector(".tp-v15-list").innerHTML=listRows.map((r,i)=>`<button type="button" class="tp-v15-row" data-i="${i}">${icon(r)}<span class="tp-v15-copy"><b>${esc(r.value)}</b><small>${r.kind==="product-type"?"Popular search":r.kind==="seller"?"Seller":esc(r.seller||"Product")}</small></span></button>`).join("");panel.hidden=!listRows.length;d.documentElement.classList.toggle("tp-v15-search-open",!!listRows.length);}
  function choose(r){if(!input||!r)return;input.value=r.value;input.dispatchEvent(new Event("input",{bubbles:true}));const f=input.form;close();f?.requestSubmit?.();}
  d.addEventListener("input",e=>{if(e.target.matches("[data-tp-finder-input]"))render(e.target);});
  d.addEventListener("focusin",e=>{if(e.target.matches("[data-tp-finder-input]")&&clean(e.target.value))render(e.target);});
  d.addEventListener("pointerdown",e=>{const row=e.target.closest(".tp-v15-row");if(row&&panel&&input){gesture={row,id:e.pointerId,x:e.clientX,y:e.clientY,moved:false};return;}if(panel&&!e.target.closest(".tp-v15-suggest")&&e.target!==input)close();},{passive:true});
  d.addEventListener("pointermove",e=>{if(!gesture||gesture.id!==e.pointerId)return;if(Math.hypot(e.clientX-gesture.x,e.clientY-gesture.y)>8)gesture.moved=true;},{passive:true});
  d.addEventListener("pointerup",e=>{if(!gesture||gesture.id!==e.pointerId)return;const g=gesture;gesture=null;if(g.moved)return;const row=e.target.closest(".tp-v15-row");if(!row||row!==g.row||!panel)return;choose((panel._rows||[])[Number(row.dataset.i)]);});
  d.addEventListener("pointercancel",()=>gesture=null);
  d.addEventListener("keydown",e=>{if(e.key==="Escape")close();});
})();
