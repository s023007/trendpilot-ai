(() => {
  "use strict";
  const d=document,$=(s,r=d)=>r.querySelector(s),$$=(s,r=d)=>[...r.querySelectorAll(s)];
  const clean=v=>String(v??"").replace(/\s+/g," ").trim(),low=v=>clean(v).toLowerCase();
  const esc=v=>clean(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  let rows=[],query="",type="all",shown=18;

  async function load(){
    const [a,b]=await Promise.allSettled([
      fetch(`/data/ticket-discovery-v14-1.json?v=21.11.0`,{cache:"force-cache"}).then(r=>r.ok?r.json():{}),
      fetch(`/data/ticket-inventory.json?v=21.11.0`,{cache:"force-cache"}).then(r=>r.ok?r.json():{})
    ]);
    const routes=a.status==="fulfilled"?(a.value.routes||[]):[];
    const live=b.status==="fulfilled"?(b.value.listings||[]):[];
    rows=[...live.map(x=>({...x,_live:true})),...routes.map(x=>({...x,_live:false}))];
  }

  const title=x=>clean(x.eventTitle||x.title);
  const typeName=x=>({sports:"Sports",concerts:"Concert",theatre:"Theatre",travel:"Travel & attraction"}[low(x.type)]||"Tickets");
  function money(x){const n=Number(x?.price);if(!Number.isFinite(n)||n<=0)return"";try{return new Intl.NumberFormat(undefined,{style:"currency",currency:x.currency||"USD"}).format(n)}catch{return`${x.currency||""} ${n.toFixed(2)}`.trim()}}
  function usableVenue(x){const v=clean(x.venue);if(!v||/\.com$/i.test(v)||low(v)===low(x.provider))return"";return v}
  function matches(x,q){if(!q)return true;const terms=low(q).split(/\s+/).filter(Boolean);const blob=low(`${title(x)} ${x.provider||""} ${x.city||""} ${usableVenue(x)} ${(x.aliases||[]).join(" ")} ${x.destination||""}`);return terms.every(t=>blob.includes(t))}
  const typeMatch=x=>type==="all"||low(x.type)===type;
  function dedupe(list){const seen=new Set();return list.filter(x=>{const k=low(`${title(x)}|${x.provider}`);if(!k||seen.has(k))return false;seen.add(k);return true})}
  function facts(x){const data=[["Date",clean(x.date)],["Venue",usableVenue(x)],["City",clean(x.city)],["Price",money(x)]].filter(([,v])=>v);return data.length?`<div class="tp-ticket-v141-facts">${data.map(([k,v])=>`<div><small>${esc(k)}</small><b>${esc(v)}</b></div>`).join("")}</div>`:""}
  function card(x){const provider=clean(x.provider)||"Ticket seller",hasDetail=Boolean(x._live||clean(x.date)||usableVenue(x)||money(x));return `<article class="tp-ticket-v141-card"><div class="tp-ticket-v141-card-head"><span>${esc(typeName(x))}</span><strong>${esc(provider)}</strong></div><h3>${esc(title(x))}</h3>${facts(x)}<div class="tp-ticket-v141-actions">${hasDetail?`<a href="/ticket/?id=${encodeURIComponent(x.id)}">View details</a>`:""}<a class="primary" href="${esc(x.url)}" target="_blank" rel="nofollow sponsored noopener">Check tickets at ${esc(provider)} ↗</a></div></article>`}

  function render(){
    const host=$("[data-ticket-v141-results]");if(!host)return;
    const list=dedupe(rows.filter(x=>typeMatch(x)&&matches(x,query)));
    const summary=$("[data-ticket-v141-summary]");
    if(summary)summary.textContent=query?(list.length?`${list.length} ticket option${list.length===1?"":"s"} for “${query}”.`:`No ticket pages match “${query}” yet.`):`${list.length} ticket pages from supported sellers.`;
    host.innerHTML=list.length?`<section class="tp-ticket-v141-result-group"><div class="tp-ticket-v141-grid">${list.slice(0,shown).map(card).join("")}</div></section>`:'<div class="tp-ticket-v141-empty"><b>No matching tickets found.</b><span>Try the artist, team, event, city or venue.</span></div>';
    const more=$("[data-ticket-v141-more]");if(more){more.hidden=list.length<=shown;more.textContent="Show more"}
  }

  async function init(){
    await load();
    const input=$("[data-ticket-v141-query]"),form=$("[data-ticket-v141-form]"),select=$("[data-ticket-v141-type]"),params=new URLSearchParams(location.search);
    query=clean(params.get("q"));type=params.get("type")||"all";if(input)input.value=query;if(select)select.value=type;
    form?.addEventListener("submit",e=>{e.preventDefault();query=clean(input?.value);type=select?.value||"all";shown=18;const u=new URL(location.href);if(query)u.searchParams.set("q",query);else u.searchParams.delete("q");if(type!=="all")u.searchParams.set("type",type);else u.searchParams.delete("type");history.replaceState(null,"",u);render()});
    select?.addEventListener("change",()=>{type=select.value||"all";shown=18;render()});
    $$("[data-ticket-v141-chip]").forEach(b=>b.addEventListener("click",()=>{type=b.dataset.ticketV141Chip||"all";if(select)select.value=type;shown=18;render()}));
    $("[data-ticket-v141-more]")?.addEventListener("click",()=>{shown+=18;render()});
    render();
  }
  d.readyState==="loading"?d.addEventListener("DOMContentLoaded",init,{once:true}):init();
})();