(() => {
  "use strict";
  const d=document,$=(s,r=d)=>r.querySelector(s),$$=(s,r=d)=>[...r.querySelectorAll(s)];
  const clean=v=>String(v??"").replace(/\s+/g," ").trim(),low=v=>clean(v).toLowerCase();
  const esc=v=>clean(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  let discovery={routes:[],entities:[]},inventory=[],query="",type="all",shown=18;
  async function load(){
    const [a,b]=await Promise.allSettled([
      fetch(`/data/ticket-discovery-v14-1.json?v=14.1-${Date.now()}`,{cache:"no-store"}).then(r=>r.ok?r.json():{}),
      fetch(`/data/ticket-inventory.json?v=14.1-${Date.now()}`,{cache:"no-store"}).then(r=>r.ok?r.json():{})
    ]);
    discovery=a.status==="fulfilled"?a.value:{routes:[],entities:[]};inventory=b.status==="fulfilled"?(b.value.listings||[]):[];
  }
  function money(x){const raw=x?.price;if(raw===null||raw===undefined||raw==="")return"";const n=Number(raw);if(!Number.isFinite(n)||n<=0)return"";try{return new Intl.NumberFormat(undefined,{style:"currency",currency:x.currency||"USD"}).format(n)}catch{return`${x.currency||""} ${n.toFixed(2)}`.trim()}}
  const canonical=x=>clean(x.eventTitle||x.title);
  function matches(x,q){if(!q)return true;const words=low(q).split(/\s+/).filter(Boolean),blob=low(`${canonical(x)} ${x.provider||""} ${x.description||""} ${(x.aliases||[]).join(" ")}`);return words.every(w=>blob.includes(w));}
  const typeMatch=x=>type==="all"||low(x.type)===type;
  function expandedRouteIds(q){const ids=new Set(),l=low(q);if(!l)return ids;for(const e of discovery.entities||[]){const v=low(e.value);if(v===l||v.startsWith(l)||l.startsWith(v))ids.add(e.routeId);}return ids;}
  function dedupe(rows){const map=new Map();for(const r of rows){const key=low(`${canonical(r)}|${r.provider}`),old=map.get(key);if(!old){map.set(key,r);continue;}const score=x=>(clean(x.date)?4:0)+(clean(x.venue)?4:0)+(Number(x.price)>0?5:0)+(clean(x.description).length>80?2:0)+(clean(x.destination)?1:0);if(score(r)>score(old))map.set(key,r);}return[...map.values()];}
  function facts(rows){rows=rows.filter(x=>clean(x[1]));return rows.length?`<div class="tp-ticket-v141-facts">${rows.map(([k,v])=>`<div><small>${esc(k)}</small><b>${esc(v)}</b></div>`).join("")}</div>`:"";}
  function routeLevel(x){const t=low(`${canonical(x)} ${x.destination||""}`);if(/competition|league|serie a|la liga|formula|grand prix/.test(t))return"Competition";if(/performer|artist|band|concert/.test(t))return"Artist / performer";if(low(x.type)==="travel")return"Travel route";return"Event route";}
  function inventoryCard(x){return`<article class="tp-ticket-v141-card is-inventory"><div class="tp-ticket-v141-card-head"><span>Live ticket inventory</span><strong>${esc(x.provider||"Provider")}</strong></div><h3>${esc(canonical(x))}</h3>${facts([["Date",x.date],["Venue",x.venue],["Section",x.section],["Row",x.row],["Quantity",x.quantity!=null?String(x.quantity):""],["Price",money(x)]])}<div class="tp-ticket-v141-actions"><button type="button" data-ticket-quick="${esc(x.id)}" data-kind="inventory">Quick view</button><a class="primary" href="/ticket/?id=${encodeURIComponent(x.id)}">Ticket details</a></div></article>`;}
  function routeCard(x,note=""){return`<article class="tp-ticket-v141-card"><div class="tp-ticket-v141-card-head"><span>${esc(routeLevel(x))}</span><strong>${esc(x.provider||"Provider")}</strong></div><h3>${esc(canonical(x))}</h3><p>${esc(x.description||"Open the connected provider to check current event dates, availability, seats and total price.")}</p>${note?`<div class="tp-ticket-v141-nearest">${esc(note)}</div>`:""}${facts([[money(x)?"Live price":"Price",money(x)||"Check live price"],["Venue",x.venue],["Date",x.date]])}<div class="tp-ticket-v141-actions"><button type="button" data-ticket-quick="${esc(x.id)}" data-kind="route">Quick view</button><a class="primary" href="/ticket/?id=${encodeURIComponent(x.id)}">Review before provider</a></div></article>`;}
  function render(){
    const q=clean(query),host=$("[data-ticket-v141-results]");if(!host)return;
    const exact=inventory.filter(x=>typeMatch(x)&&matches(x,q)),expanded=expandedRouteIds(q),routes=dedupe((discovery.routes||[]).filter(typeMatch));
    const direct=routes.filter(x=>matches(x,q)),nearest=q&&direct.length===0&&expanded.size?routes.filter(x=>expanded.has(x.id)):[];
    const total=exact.length+direct.length+nearest.length,summary=$("[data-ticket-v141-summary]");
    if(summary){
      if(!q)summary.textContent=`Explore ${routes.length} verified connected ticket and booking routes.`;
      else if(exact.length)summary.textContent=`${exact.length} ticket listing${exact.length===1?"":"s"} with inventory evidence, plus ${direct.length} connected routes.`;
      else if(direct.length)summary.textContent=`${direct.length} connected route${direct.length===1?"":"s"} match “${q}”. Live seat price and availability stay on the provider unless supplied by feed.`;
      else if(nearest.length)summary.textContent=`No exact fixture inventory is supplied for “${q}” yet. Showing the strongest verified competition route without inventing an opponent, date, seat or price.`;
      else summary.textContent=`No verified connected route currently matches “${q}”. Try a league, team, artist, sport or destination.`;
    }
    let html="";
    if(exact.length)html+=`<section class="tp-ticket-v141-result-group"><div class="tp-ticket-v141-section-title"><span>Exact inventory</span><h2>Tickets with supplied seat or price evidence</h2></div><div class="tp-ticket-v141-grid">${exact.slice(0,shown).map(inventoryCard).join("")}</div></section>`;
    if(direct.length)html+=`<section class="tp-ticket-v141-result-group"><div class="tp-ticket-v141-section-title"><span>Connected routes</span><h2>${q?`Best routes for “${esc(q)}”`:"Current event, competition and booking routes"}</h2></div><div class="tp-ticket-v141-grid">${direct.slice(0,shown).map(x=>routeCard(x)).join("")}</div></section>`;
    if(nearest.length)html+=`<section class="tp-ticket-v141-result-group"><div class="tp-ticket-v141-section-title"><span>Team search fallback</span><h2>Verified competition routes for this team</h2></div><div class="tp-ticket-v141-grid">${nearest.slice(0,6).map(x=>routeCard(x,`This route covers the competition associated with ${q}. Choose the exact fixture on the provider; TrendPilot will show seat-level data here when a connected feed supplies it.`)).join("")}</div></section>`;
    if(!total)html='<div class="tp-ticket-v141-empty"><b>No connected result yet.</b><span>Try Premier League, Arsenal, Champions League, Formula 1, Muse, flights, hotels or another event name.</span></div>';
    host.innerHTML=html;const more=$("[data-ticket-v141-more]");if(more)more.hidden=total<=shown;
  }
  function quick(x,isInventory){
    let modal=$("[data-ticket-v141-modal]");if(!modal){modal=d.createElement("div");modal.className="tp-ticket-v141-modal";modal.hidden=true;modal.dataset.ticketV141Modal="";modal.innerHTML='<button class="tp-ticket-v141-backdrop" type="button" data-ticket-v141-close aria-label="Close"></button><section class="tp-ticket-v141-dialog"><button class="tp-ticket-v141-close" type="button" data-ticket-v141-close>×</button><div data-ticket-v141-body></div></section>';d.body.appendChild(modal);}
    const body=$("[data-ticket-v141-body]",modal);body.innerHTML=`<span class="tp-kicker">${esc(x.provider||"Ticket source")}</span><h2>${esc(canonical(x))}</h2>${facts([["Data level",isInventory?"Seat / ticket inventory":routeLevel(x)],["Price",money(x)],["Date",x.date],["Venue",x.venue],["Section",x.section],["Row",x.row],["Quantity",x.quantity!=null?String(x.quantity):""]])}<div class="tp-ticket-v141-info"><b>What TrendPilot knows</b><p>${isInventory?"This listing contains direct inventory evidence from the connected data source.":"This is a verified provider route. Exact fixture, seat, fees and final price must be confirmed live when the feed does not supply them."}</p></div><div class="tp-ticket-v141-actions"><a href="/ticket/?id=${encodeURIComponent(x.id)}">Full information</a><a class="primary" href="${esc(x.url)}" target="_blank" rel="nofollow sponsored noopener">Check live provider ↗</a></div>`;modal.hidden=false;
  }
  async function init(){
    await load();const input=$("[data-ticket-v141-query]"),form=$("[data-ticket-v141-form]"),select=$("[data-ticket-v141-type]"),params=new URLSearchParams(location.search);
    query=params.get("q")||"";if(input)input.value=query;type=params.get("type")||"all";if(select)select.value=type;
    form?.addEventListener("submit",e=>{e.preventDefault();query=clean(input?.value);type=select?.value||"all";shown=18;const u=new URL(location.href);if(query)u.searchParams.set("q",query);else u.searchParams.delete("q");if(type!=="all")u.searchParams.set("type",type);else u.searchParams.delete("type");history.replaceState(null,"",u);render();});
    select?.addEventListener("change",()=>{type=select.value||"all";shown=18;render();});
    $$("[data-ticket-v141-chip]").forEach(b=>b.addEventListener("click",()=>{type=b.dataset.ticketV141Chip||"all";if(select)select.value=type;shown=18;render();}));
    d.addEventListener("tp:ticket-query",e=>{query=clean(e.detail?.value||input?.value);shown=18;render();});
    d.addEventListener("click",e=>{const qv=e.target.closest("[data-ticket-quick]");if(qv){const isInv=qv.dataset.kind==="inventory",pool=isInv?inventory:(discovery.routes||[]),row=pool.find(x=>x.id===qv.dataset.ticketQuick);if(row)quick(row,isInv);return;}if(e.target.closest("[data-ticket-v141-close]")){const m=$("[data-ticket-v141-modal]");if(m)m.hidden=true;}});
    $("[data-ticket-v141-more]")?.addEventListener("click",()=>{shown+=18;render();});render();
  }
  if(d.readyState==="loading")d.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();
