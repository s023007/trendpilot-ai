(() => {
  "use strict";
  const d=document,clean=v=>String(v??"").replace(/\s+/g," ").trim(),low=v=>clean(v).toLowerCase();
  let allowed=[];
  const aliases={"aliexpress":["aliexpress","ali express"],"alibaba":["alibaba","alibaba.com"],"geekbuying":["geekbuying"],"lenovo":["lenovo","lenovo many geos"],"diecast":["diecast","diecast.com"],"fragranceshop.com":["fragranceshop.com","fragrance shop","the fragrance shop"],"karaca eu":["karaca eu","karaca europe","karaca"],"mfi medical":["mfi medical","mfimedical","mfi"],"pandahall":["pandahall","panda hall"],"temu":["temu","temu.com","shop temu"]};
  function canon(v){const l=low(v);for(const name of allowed){const n=low(name);if((aliases[n]||[n]).some(a=>l===a||l.includes(a)))return name;}return"";}
  function fix(){const s=d.querySelector("[data-filter-merchant]");if(!(s instanceof HTMLSelectElement)||!allowed.length)return;const prev=canon(s.options[s.selectedIndex]?.textContent||s.value),values=new Map();[...s.options].forEach(o=>{const c=canon(o.textContent||o.value);if(c&&!values.has(c))values.set(c,o.value);});s.innerHTML="";s.add(new Option("All sellers",""));allowed.forEach(name=>s.add(new Option(name,values.get(name)||name)));if(prev){const o=[...s.options].find(x=>canon(x.textContent)===prev);if(o)s.value=o.value;}s.dataset.tpSellerPolicy="15.0.0";}
  async function init(){try{const r=await fetch(`/data/approved-product-sellers-v15.json?v=15.0.0-${Date.now()}`,{cache:"no-store"});const j=r.ok?await r.json():{};allowed=Array.isArray(j.approvedProductSellers)?j.approvedProductSellers:[];}catch{}if(!allowed.length)allowed=["AliExpress","Alibaba","Geekbuying","Lenovo","Diecast","FragranceShop.com","Karaca EU","MFI Medical","PandaHall","Temu"];fix();new MutationObserver(()=>requestAnimationFrame(fix)).observe(d.documentElement,{childList:true,subtree:true});setTimeout(fix,300);setTimeout(fix,900);}
  if(d.readyState==="loading")d.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();
