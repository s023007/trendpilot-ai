
(() => {
  "use strict";
  const d=document;
  const $=(s,r=d)=>r.querySelector(s);
  const $$=(s,r=d)=>Array.from(r.querySelectorAll(s));
  const clean=v=>String(v??"").replace(/\s+/g," ").trim();
  const lower=v=>clean(v).toLowerCase();
  const esc=v=>clean(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const http=v=>/^https?:\/\//i.test(clean(v))?clean(v):"";
  const words=v=>lower(v).replace(/[^a-z0-9 ]+/g," ").split(/\s+/).filter(x=>x.length>1);
  const ticomboCfg=window.TP_TICKETS_CONFIG||{providers:{},destinations:{},searchAliases:[]};
  let directory=null;

  const providerInfo={
    ticombo:{name:"Ticombo",section:"events",coverage:"Sports, concerts and theatre",bestFor:"Broad event discovery",type:"Ticket marketplace"},
    "7753674":{name:"Sports Events 365",section:"sports",coverage:"Football and live sports",bestFor:"Sports-specific routes",type:"Sports ticket provider"},
    "2288710":{name:"TicketNetwork",section:"events",coverage:"Concerts, theatre and sports",bestFor:"Broad live-event marketplace",type:"Event ticket marketplace"},
    "4368684":{name:"Trip.com (Global)",section:"travel",coverage:"Flights, hotels, trains and attractions",bestFor:"Travel and attraction bookings",type:"Travel booking platform"}
  };

  function scoreText(text,tokens){const hay=lower(text);return tokens.reduce((n,t)=>n+(hay.includes(t)?3:0),0);}
  function sectionRows(section){return Array.isArray(directory?.sections?.[section])?directory.sections[section]:[];}
  function ticomboRoutes(query,type){
    const tokens=words(query);let rows=[];
    Object.entries(ticomboCfg.destinations||{}).forEach(([id,row])=>{const score=scoreText(`${row.label} ${row.description} ${id}`,tokens)+(type&&type!=="all"&&id.includes(type)?4:0);rows.push({name:row.label,url:row.url,score});});
    rows.sort((a,b)=>b.score-a.score);return rows.filter((r,i)=>r.score>0||i<2).slice(0,4);
  }
  function cjRoutes(partner,query){
    const tokens=words(query);const rows=(partner.offers||[]).map(row=>({...row,score:scoreText(`${row.name} ${row.description} ${row.promotionType}`,tokens)}));
    rows.sort((a,b)=>b.score-a.score);return rows.filter((r,i)=>r.score>0||i<3).slice(0,4);
  }
  function providerMatches(type){
    if(type==="sports")return ["ticombo","7753674","2288710"];
    if(type==="concerts"||type==="theatre")return ["ticombo","2288710"];
    if(type==="travel")return ["4368684"];
    return ["ticombo","7753674","2288710","4368684"];
  }
  function getProvider(id,query,type){
    if(id==="ticombo"){
      const routes=ticomboRoutes(query,type);return {...providerInfo.ticombo,id,routes,primary:routes[0]?.url||ticomboCfg.providers?.ticombo?.homepage||"https://www.ticombo.com/en",affiliate:false};
    }
    const info=providerInfo[id];const partner=[...sectionRows("sports"),...sectionRows("events"),...sectionRows("travel")].find(row=>String(row.advertiserId||row.id)===id);
    if(!partner)return null;const routes=cjRoutes(partner,query);return {...info,id,routes,primary:routes[0]?.url||partner.primaryOffer?.url||"",affiliate:true};
  }
  function card(row){
    const links=row.routes.map(route=>`<a href="${esc(route.url)}" target="_blank" rel="${row.affiliate?'nofollow sponsored noopener':'noopener'}">${esc(route.name||"Open route")} ↗</a>`).join("");
    return `<article class="tp-ticket-provider-card"><header><h3>${esc(row.name)}</h3><span>${esc(row.type)}</span></header><p>${esc(row.bestFor)}</p><div class="tp-ticket-provider-meta"><div><small>Coverage</small><b>${esc(row.coverage)}</b></div><div><small>Price evidence</small><b>Live on provider</b></div></div><div class="tp-ticket-route-list">${links||'<span>No matching route returned.</span>'}</div>${row.primary?`<a class="tp-ticket-provider-primary" href="${esc(row.primary)}" target="_blank" rel="${row.affiliate?'nofollow sponsored noopener':'noopener'}">Check live availability ↗</a>`:""}</article>`;
  }
  function matrix(rows){return `<div class="tp-ticket-matrix"><table><thead><tr><th>Provider</th><th>Best for</th><th>Coverage</th><th>Price data here</th><th>Tracking</th></tr></thead><tbody>${rows.map(row=>`<tr><td><b>${esc(row.name)}</b></td><td>${esc(row.bestFor)}</td><td>${esc(row.coverage)}</td><td>Live price opens on provider</td><td>${row.affiliate?'Affiliate link':'Direct link'}</td></tr>`).join("")}</tbody></table></div>`;}
  function render(){
    const form=$('[data-ticket-compare-form]');const input=$('input[name="ticketQuery"]',form);const select=$('select[name="ticketType"]',form);const type=clean(select?.value||"all");const query=clean(input?.value||"");
    $$('[data-ticket-type]').forEach(btn=>btn.classList.toggle('is-active',btn.dataset.ticketType===type));
    const rows=providerMatches(type).map(id=>getProvider(id,query,type)).filter(Boolean);
    const host=$('[data-ticket-provider-results]');if(host)host.innerHTML=rows.map(card).join("");
    const summary=$('[data-ticket-match-summary]');if(summary)summary.textContent=`Comparing ${rows.length} provider${rows.length===1?'':'s'}${query?` for “${query}”`:''}. Prices and fees stay live on each provider.`;
    const matrixHost=$('[data-ticket-provider-matrix]');if(matrixHost)matrixHost.innerHTML=matrix(rows);
    const count=$('[data-ticket-provider-count]');if(count)count.textContent=String(rows.length);
  }
  async function init(){
    try{const r=await fetch(`/data/cj-category-directory.json?v=13.8.24-${Date.now()}`,{cache:"no-store"});if(!r.ok)throw new Error(String(r.status));directory=await r.json();}catch(error){console.warn("Ticket provider directory unavailable",error);directory={sections:{}};}
    const form=$('[data-ticket-compare-form]');form?.addEventListener('submit',event=>{event.preventDefault();render();});
    $$('[data-ticket-type]').forEach(btn=>btn.addEventListener('click',()=>{const select=$('select[name="ticketType"]',form);if(select)select.value=btn.dataset.ticketType||"all";render();}));
    $('select[name="ticketType"]',form)?.addEventListener('change',render);render();
  }
  if(d.readyState==="loading")d.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();
