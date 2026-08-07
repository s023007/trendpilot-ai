(() => {
  "use strict";
  const d=document;
  const clean=v=>String(v??"").replace(/\s+/g," ").trim();
  const low=v=>clean(v).toLowerCase();
  const esc=v=>clean(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const FALLBACK=[
    "backpack","baby stroller","beauty products","bluetooth speaker",
    "camera","car accessories","charger","computer accessories","cookware",
    "dress","earbuds","fitness equipment","fragrance","gaming accessories",
    "headphones","home decor","jewelry","keyboard","kitchen appliances",
    "laptop","makeup","medical equipment","monitor","office supplies",
    "perfume","pet supplies","phone","phone cases","power banks",
    "printer","projector","school supplies","shoes","smart watch",
    "smartphone","sports equipment","tablet","tools","toys","t-shirts",
    "vacuum","wireless carplay adapter"
  ];

  let indexPromise=null;
  let activeInput=null;
  let panel=null;
  let seq=0;

  async function index(){
    if(indexPromise) return indexPromise;
    indexPromise=fetch(`/data/search-suggestions-v14-1.json?v=14.1.5-${Date.now()}`,{cache:"no-store"})
      .then(r=>r.ok?r.json():{})
      .catch(()=>({}));
    return indexPromise;
  }

  function host(input){
    const h=input.closest(".tp-search-input,.tp-wholesale-search,form,label")||input.parentElement;
    h?.classList.add("tp-amazon-search-host");
    return h;
  }

  function ensure(input){
    const h=host(input);
    let p=h?.querySelector(":scope > .tp-amazon-suggest");
    if(!p){
      p=d.createElement("div");
      p.className="tp-amazon-suggest";
      p.hidden=true;
      p.innerHTML='<div class="tp-amazon-list" role="listbox"></div>';
      h?.appendChild(p);
    }
    return p;
  }

  function fallbackRows(q){
    const l=low(q);
    return FALLBACK.filter(v=>low(v).startsWith(l)||low(v).includes(l))
      .slice(0,8)
      .map(v=>({value:v,meta:"Popular search",image:"",score:20}));
  }

  function rank(rows,q){
    const l=low(q);
    const parts=l.split(/\s+/).filter(Boolean);
    return rows
      .filter(x=>{
        const v=low(x.value);
        return v.startsWith(l)||parts.every(p=>v.includes(p));
      })
      .sort((a,b)=>{
        const av=low(a.value),bv=low(b.value);
        const ap=av.startsWith(l)?0:1,bp=bv.startsWith(l)?0:1;
        return ap-bp+(Number(b.score||0)-Number(a.score||0))+a.value.length-b.value.length;
      });
  }

  async function rows(input){
    const q=low(input.value);
    if(!q) return [];
    const data=await index();
    let pool=[];
    if(data.byLetter){
      pool=[...(data.byLetter[q[0]]||[])];
    }
    if(Array.isArray(data.top)) pool.push(...data.top);

    const seen=new Set();
    const out=[];
    for(const x of rank(pool,q)){
      const k=low(x.value);
      if(!k||seen.has(k)) continue;
      seen.add(k);
      out.push(x);
      if(out.length>=8) break;
    }
    for(const x of fallbackRows(q)){
      const k=low(x.value);
      if(!seen.has(k)){
        seen.add(k);
        out.push(x);
        if(out.length>=8) break;
      }
    }
    return out;
  }

  function icon(row){
    return row.image
      ? `<span class="tp-amazon-thumb"><img src="${esc(row.image)}" alt="" loading="lazy"></span>`
      : '<span class="tp-amazon-search-icon" aria-hidden="true">⌕</span>';
  }

  function close(){
    seq++;
    if(panel) panel.hidden=true;
    panel=null;
    activeInput=null;
  }

  function submit(input,value){
    input.value=value;
    input.dispatchEvent(new Event("input",{bubbles:true}));
    close();
    if(input.form?.requestSubmit) input.form.requestSubmit();
    else location.href=`/find/?q=${encodeURIComponent(value)}`;
  }

  async function render(input){
    const token=++seq;
    const q=clean(input.value);
    if(!q){close();return;}
    const data=await rows(input);
    if(token!==seq) return;

    activeInput=input;
    panel=ensure(input);
    const list=panel.querySelector(".tp-amazon-list");
    list.innerHTML=data.map((row,i)=>`
      <button type="button" class="tp-amazon-row" role="option" data-i="${i}">
        ${icon(row)}
        <span class="tp-amazon-copy">
          <b>${esc(row.value)}</b>
          ${row.meta?`<small>${esc(row.meta)}</small>`:""}
        </span>
      </button>`).join("");
    panel._rows=data;
    panel.hidden=data.length===0;
  }

  const selector='input[data-tp-finder-input],.tp-search-input input[type="search"]';

  d.addEventListener("input",e=>{
    if(e.target.matches(selector)) render(e.target);
  });

  d.addEventListener("focusin",e=>{
    if(e.target.matches(selector)&&clean(e.target.value)) render(e.target);
  });

  let gesture=null;
  d.addEventListener("pointerdown",e=>{
    const row=e.target.closest(".tp-amazon-row");
    if(row&&activeInput&&panel){
      gesture={row,id:e.pointerId,x:e.clientX,y:e.clientY,moved:false};
      return;
    }
    if(panel&&!e.target.closest(".tp-amazon-suggest")&&e.target!==activeInput) close();
  },{passive:true});

  d.addEventListener("pointermove",e=>{
    if(!gesture||gesture.id!==e.pointerId) return;
    if(Math.hypot(e.clientX-gesture.x,e.clientY-gesture.y)>8) gesture.moved=true;
  },{passive:true});

  d.addEventListener("pointerup",e=>{
    if(!gesture||gesture.id!==e.pointerId) return;
    const g=gesture; gesture=null;
    if(g.moved) return;
    const row=e.target.closest(".tp-amazon-row");
    if(!row||row!==g.row||!activeInput||!panel) return;
    const item=(panel._rows||[])[Number(row.dataset.i)];
    if(item) submit(activeInput,item.value);
  });

  d.addEventListener("pointercancel",()=>{gesture=null;});
  d.addEventListener("keydown",e=>{if(e.key==="Escape") close();});
})();
