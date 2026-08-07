(() => {
  "use strict";
  const d=document,CPC=new Set(["aliexpress","alibaba","geekbuying"]),low=v=>String(v??"").trim().toLowerCase();
  function tag(){d.querySelectorAll("[data-tp-outbound]").forEach(a=>{const m=low(a.dataset.merchant||"");if(!CPC.has(m)||a.dataset.tpCpcBound)return;a.dataset.tpCpcBound="1";a.dataset.tpMonetization="cpc-eligible";a.addEventListener("click",()=>{try{const k="tp_v15_cpc_clicks",rows=JSON.parse(localStorage.getItem(k)||"[]");rows.push({merchant:m,query:new URLSearchParams(location.search).get("q")||"",at:Date.now()});localStorage.setItem(k,JSON.stringify(rows.slice(-250)));}catch{}},{once:true});});}
  new MutationObserver(tag).observe(d.documentElement,{childList:true,subtree:true});if(d.readyState==="loading")d.addEventListener("DOMContentLoaded",tag,{once:true});else tag();
})();
