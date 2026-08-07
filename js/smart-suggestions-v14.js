(() => {
  "use strict";
  const d=document,$=(s,r=d)=>r.querySelector(s);
  const clean=v=>String(v??"").replace(/\s+/g," ").trim();
  const low=v=>clean(v).toLowerCase();
  const esc=v=>clean(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  let productIndex=null,ticketIndex=null,activeInput=null,panel=null,openSeq=0;

  async function json(url,fallback){
    try{const r=await fetch(`${url}?v=14.1-${Date.now()}`,{cache:"no-store"});return r.ok?await r.json():fallback;}
    catch{return fallback;}
  }
  async function products(){return productIndex||(productIndex=json("/data/search-suggestions-v14-1.json",{}));}
  async function tickets(){return ticketIndex||(ticketIndex=json("/data/ticket-discovery-v14-1.json",{}));}
  function context(){return location.pathname.startsWith("/tickets")?"ticket":"product";}
  function host(input){
    const h=input.closest(".tp-search-input,.tp-ticket-v141-search,.tp-wholesale-search,form,label")||input.parentElement;
    if(h)h.classList.add("tp-amazon-search-host");
    return h;
  }
  function ensure(input){
    const h=host(input);let p=h?.querySelector(":scope > .tp-amazon-suggest");
    if(!p){p=d.createElement("div");p.className="tp-amazon-suggest";p.hidden=true;p.innerHTML='<div class="tp-amazon-list" role="listbox"></div>';h?.appendChild(p);}
    return p;
  }
  function icon(row){return row.image?`<span class="tp-amazon-thumb"><img src="${esc(row.image)}" alt="" loading="lazy"></span>`:'<span class="tp-amazon-search-icon" aria-hidden="true">⌕</span>';}
  function rank(rows,q){
    const l=low(q),parts=l.split(/\s+/).filter(Boolean);
    return rows.filter(x=>{const v=low(x.value);return v.startsWith(l)||parts.every(p=>v.includes(p));})
      .sort((a,b)=>{const av=low(a.value),bv=low(b.value),ap=av.startsWith(l)?0:1,bp=bv.startsWith(l)?0:1;return ap-bp+(b.score||0)-(a.score||0)+a.value.length-b.value.length;});
  }
  async function getRows(input){
    const q=low(input.value);if(!q)return[];
    if(context()==="ticket"){
      const data=await tickets(),entities=Array.isArray(data.entities)?data.entities:[];
      return entities.filter(x=>low(x.value).startsWith(q)||low(x.value).includes(q))
        .sort((a,b)=>{const ap=low(a.value).startsWith(q)?0:1,bp=low(b.value).startsWith(q)?0:1;return ap-bp+a.value.length-b.value.length;})
        .slice(0,7)
        .map(x=>({value:x.value,meta:x.routeTitle||x.provider||"Tickets",routeId:x.routeId||"",image:""}));
    }
    const data=await products();let pool=[];
    if(q.length===1&&data.byLetter)pool=data.byLetter[q[0]]||[];
    else pool=Array.isArray(data.top)?data.top:[];
    if(q.length>1&&data.byLetter)pool=[...(data.byLetter[q[0]]||[]),...pool];
    const seen=new Set(),rows=[];
    for(const x of rank(pool,q)){const k=low(x.value);if(!k||seen.has(k))continue;seen.add(k);rows.push(x);if(rows.length>=7)break;}
    return rows;
  }
  function close(){openSeq++;if(panel)panel.hidden=true;panel=null;activeInput=null;}
  function submit(input,value,row){
    input.value=value;input.dispatchEvent(new Event("input",{bubbles:true}));close();
    if(context()==="ticket"){
      const url=new URL(location.href);url.searchParams.set("q",value);if(row?.routeId)url.searchParams.set("route",row.routeId);history.replaceState(null,"",url);
      input.dispatchEvent(new CustomEvent("tp:ticket-query",{bubbles:true,detail:{value,routeId:row?.routeId||""}}));input.form?.requestSubmit?.();return;
    }
    if(input.form){input.form.requestSubmit?.();return;}
    location.href=`/find/?q=${encodeURIComponent(value)}`;
  }
  async function render(input){
    const seq=++openSeq,q=clean(input.value);if(!q){close();return;}
    const rows=await getRows(input);if(seq!==openSeq)return;
    activeInput=input;panel=ensure(input);const list=$(".tp-amazon-list",panel);
    list.innerHTML=rows.map((row,i)=>`<button type="button" class="tp-amazon-row" role="option" data-i="${i}" data-value="${esc(row.value)}">${icon(row)}<span class="tp-amazon-copy"><b>${esc(row.value)}</b>${row.meta?`<small>${esc(row.meta)}</small>`:""}</span></button>`).join("");
    panel._rows=rows;panel.hidden=rows.length===0;
  }
  const selector='input[type="search"],input[name="q"],input[data-search],.tp-search-input input,.tp-ticket-v141-search input,.tp-wholesale-search input';
  d.addEventListener("input",e=>{if(e.target.matches(selector))render(e.target);});
  d.addEventListener("focusin",e=>{if(e.target.matches(selector)&&clean(e.target.value))render(e.target);});
  let tpGesture=null;
  d.addEventListener("pointerdown",e=>{
    const row=e.target.closest(".tp-amazon-row");
    if(row&&activeInput&&panel){tpGesture={row,id:e.pointerId,x:e.clientX,y:e.clientY,moved:false};return;}
    if(panel&&!e.target.closest(".tp-amazon-suggest")&&e.target!==activeInput)close();
  });
  d.addEventListener("pointermove",e=>{if(!tpGesture||tpGesture.id!==e.pointerId)return;if(Math.hypot(e.clientX-tpGesture.x,e.clientY-tpGesture.y)>7)tpGesture.moved=true;});
  d.addEventListener("pointerup",e=>{if(!tpGesture||tpGesture.id!==e.pointerId)return;const g=tpGesture;tpGesture=null;if(g.moved)return;const row=e.target.closest(".tp-amazon-row");if(!row||row!==g.row||!activeInput||!panel)return;const data=panel._rows||[],item=data[Number(row.dataset.i)]||{value:row.dataset.value};submit(activeInput,item.value,item);});
  d.addEventListener("pointercancel",()=>{tpGesture=null;});
  d.addEventListener("keydown",e=>{if(e.key==="Escape"&&panel)close();});
})();
