(() => {
  "use strict";
  const d=document,$=(s,r=d)=>r.querySelector(s),clean=v=>String(v??"").replace(/\s+/g," ").trim();
  const esc=v=>clean(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const money=x=>{const n=Number(x.price);if(!Number.isFinite(n)||n<=0)return"";try{return new Intl.NumberFormat(undefined,{style:"currency",currency:x.currency||"USD"}).format(n)}catch{return`${x.currency||""} ${n.toFixed(2)}`.trim()}};
  const facts=rows=>{rows=rows.filter(x=>clean(x[1]));return rows.length?`<div class="tp-ticket-v141-facts">${rows.map(([k,v])=>`<div><small>${esc(k)}</small><b>${esc(v)}</b></div>`).join("")}</div>`:""};
  async function init(){
    const host=$("[data-ticket-detail]"),id=new URLSearchParams(location.search).get("id")||"",res=await Promise.allSettled([
      fetch(`/data/ticket-discovery-v14-1.json?v=14.1-${Date.now()}`,{cache:"no-store"}).then(r=>r.ok?r.json():{}),
      fetch(`/data/ticket-inventory.json?v=14.1-${Date.now()}`,{cache:"no-store"}).then(r=>r.ok?r.json():{})
    ]);
    const options=res[0].status==="fulfilled"?(res[0].value.routes||[]):[],tickets=res[1].status==="fulfilled"?(res[1].value.listings||[]):[];
    let x=tickets.find(v=>v.id===id),hasTicketDetails=Boolean(x);if(!x)x=options.find(v=>v.id===id);
    if(!x){host.innerHTML='<div class="tp-ticket-v141-empty"><b>Ticket information is unavailable.</b><a href="/tickets/">Back to ticket search</a></div>';return;}
    const title=clean(x.eventTitle||x.title);d.title=`${title} — TrendPilot AI`;
    host.innerHTML=`<a class="tp-ticket-v141-back" href="/tickets/">← Back to ticket search</a><article class="tp-ticket-v141-detail"><span class="tp-kicker">${esc(x.provider||"Ticket seller")}</span><h1>${esc(title)}</h1><p class="tp-ticket-v141-detail-lead">${hasTicketDetails?"These are the ticket details currently available to TrendPilot. Confirm everything with the seller before payment.":"This option may not include every ticket detail yet. Open the seller to check the exact event, seats, fees and final price."}</p>${facts([["Price",money(x)],["Date",x.date],["Venue",x.venue],["City",x.city],["Section",x.section],["Row",x.row],["Quantity",x.quantity!=null?String(x.quantity):""]])}<section class="tp-ticket-v141-checklist"><h2>Check before you book</h2><div><span>1</span><p>Confirm the exact event, artist or team, venue and local date and time.</p></div><div><span>2</span><p>Check the section, row, number of tickets and whether seats are together.</p></div><div><span>3</span><p>Review the final price, fees, currency, delivery method, refund rules and event-change terms.</p></div></section>${!hasTicketDetails?'<div class="tp-ticket-v141-nearest">Some details are not available here yet, so they are left blank. Please confirm them on the seller’s site.</div>':""}<div class="tp-ticket-v141-actions"><a href="/tickets/">See other options</a><a class="primary" href="${esc(x.url)}" target="_blank" rel="nofollow sponsored noopener">Check with seller ↗</a></div></article>`;
  }
  if(d.readyState==="loading")d.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();
