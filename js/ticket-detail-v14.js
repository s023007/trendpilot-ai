(() => {
  "use strict";
  const d=document,$=(s,r=d)=>r.querySelector(s),clean=v=>String(v??"").replace(/\s+/g," ").trim();
  const esc=v=>clean(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const money=x=>{const n=Number(x.price);if(!Number.isFinite(n)||n<=0)return"";try{return new Intl.NumberFormat(undefined,{style:"currency",currency:x.currency||"USD"}).format(n)}catch{return`${x.currency||""} ${n.toFixed(2)}`.trim()}};
  const usableVenue=x=>{const v=clean(x.venue);return !v||/\.com$/i.test(v)||v.toLowerCase()===clean(x.provider).toLowerCase()?"":v};
  const facts=rows=>{rows=rows.filter(x=>clean(x[1]));return rows.length?`<div class="tp-ticket-v141-facts">${rows.map(([k,v])=>`<div><small>${esc(k)}</small><b>${esc(v)}</b></div>`).join("")}</div>`:""};
  async function init(){
    const host=$("[data-ticket-detail]"),id=new URLSearchParams(location.search).get("id")||"",res=await Promise.allSettled([
      fetch(`/data/ticket-discovery-v14-1.json?v=21.11.0`,{cache:"force-cache"}).then(r=>r.ok?r.json():{}),
      fetch(`/data/ticket-inventory.json?v=21.11.0`,{cache:"force-cache"}).then(r=>r.ok?r.json():{})
    ]);
    const routes=res[0].status==="fulfilled"?(res[0].value.routes||[]):[],tickets=res[1].status==="fulfilled"?(res[1].value.listings||[]):[];
    const x=tickets.find(v=>v.id===id)||routes.find(v=>v.id===id);
    if(!x){host.innerHTML='<div class="tp-ticket-v141-empty"><b>Ticket information is unavailable.</b><a href="/tickets/">Back to ticket search</a></div>';return;}
    const title=clean(x.eventTitle||x.title),provider=clean(x.provider)||"Ticket seller",detailFacts=facts([["Date",x.date],["Venue",usableVenue(x)],["City",x.city],["Section",x.section],["Row",x.row],["Price",money(x)]]);d.title=`${title} — TrendPilot AI`;
    host.innerHTML=`<a class="tp-ticket-v141-back" href="/tickets/">← Back to tickets</a><article class="tp-ticket-v141-detail"><span class="tp-kicker">${esc(provider)}</span><h1>${esc(title)}</h1>${detailFacts||'<p class="tp-ticket-v141-detail-lead">Live dates, seats and prices are shown by the ticket seller.</p>'}<div class="tp-ticket-v141-actions"><a href="/tickets/">See other events</a><a class="primary" href="${esc(x.url)}" target="_blank" rel="nofollow sponsored noopener">Check tickets at ${esc(provider)} ↗</a></div></article>`;
  }
  d.readyState==="loading"?d.addEventListener("DOMContentLoaded",init,{once:true}):init();
})();