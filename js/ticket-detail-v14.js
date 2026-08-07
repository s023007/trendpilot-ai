(() => {
  "use strict";
  const d=document,$=(s,r=d)=>r.querySelector(s),clean=v=>String(v??"").replace(/\s+/g," ").trim();
  const esc=v=>clean(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const money=x=>{const n=Number(x.price);if(!Number.isFinite(n))return"";try{return new Intl.NumberFormat(undefined,{style:"currency",currency:x.currency||"USD"}).format(n)}catch{return`${x.currency||""} ${n.toFixed(2)}`.trim()}};
  const facts=rows=>{rows=rows.filter(x=>clean(x[1]));return rows.length?`<div class="tp-ticket-v141-facts">${rows.map(([k,v])=>`<div><small>${esc(k)}</small><b>${esc(v)}</b></div>`).join("")}</div>`:""};
  async function init(){
    const host=$("[data-ticket-detail]"),id=new URLSearchParams(location.search).get("id")||"",res=await Promise.allSettled([
      fetch(`/data/ticket-discovery-v14-1.json?v=14.1-${Date.now()}`,{cache:"no-store"}).then(r=>r.ok?r.json():{}),
      fetch(`/data/ticket-inventory.json?v=14.1-${Date.now()}`,{cache:"no-store"}).then(r=>r.ok?r.json():{})
    ]);
    const routes=res[0].status==="fulfilled"?(res[0].value.routes||[]):[],inventory=res[1].status==="fulfilled"?(res[1].value.listings||[]):[];
    let x=inventory.find(v=>v.id===id),kind=x?"Inventory":"Provider route";if(!x)x=routes.find(v=>v.id===id);
    if(!x){host.innerHTML='<div class="tp-ticket-v141-empty"><b>Ticket information is unavailable.</b><a href="/tickets/">Back to ticket search</a></div>';return;}
    const title=clean(x.eventTitle||x.title),isInventory=kind==="Inventory";d.title=`${title} — TrendPilot AI`;
    host.innerHTML=`<a class="tp-ticket-v141-back" href="/tickets/">← Back to ticket search</a><article class="tp-ticket-v141-detail"><span class="tp-kicker">${esc(x.provider||"Ticket source")}</span><h1>${esc(title)}</h1><p class="tp-ticket-v141-detail-lead">${isInventory?"TrendPilot received inventory-level evidence for this listing.":"TrendPilot received a verified route from the connected provider, but not a complete seat inventory feed."}</p>${facts([["Data level",kind],["Price",money(x)],["Date",x.date],["Venue",x.venue],["City",x.city],["Section",x.section],["Row",x.row],["Quantity",x.quantity!=null?String(x.quantity):""]])}<section class="tp-ticket-v141-checklist"><h2>Check before checkout</h2><div><span>1</span><p>Confirm the exact fixture, artist, venue and local date/time.</p></div><div><span>2</span><p>Check whether seats are together, the section/row, restricted-view wording and ticket quantity.</p></div><div><span>3</span><p>Review fees, tax, delivery method, currency, refund policy and event-change terms.</p></div></section>${!isInventory?'<div class="tp-ticket-v141-nearest">Missing seat details are intentionally hidden. TrendPilot does not invent a section, row, fixture or price that the feed did not supply.</div>':""}<div class="tp-ticket-v141-actions"><a href="/tickets/">Compare other routes</a><a class="primary" href="${esc(x.url)}" target="_blank" rel="nofollow sponsored noopener">Check live provider ↗</a></div></article>`;
  }
  if(d.readyState==="loading")d.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();
