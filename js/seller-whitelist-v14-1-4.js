(() => {
  "use strict";
  const d=document,clean=v=>String(v??"").replace(/\s+/g," ").trim(),low=v=>clean(v).toLowerCase();
  let allowed=[];
  const aliases={
    "aliexpress":["aliexpress","ali express"],"alibaba":["alibaba","alibaba.com"],"geekbuying":["geekbuying"],"lenovo":["lenovo","lenovo many geos"],
    "diecast":["diecast","diecast.com"],"fragranceshop.com":["fragranceshop.com","fragrance shop","the fragrance shop"],"karaca eu":["karaca eu","karaca europe","karaca"],
    "mfi medical":["mfi medical","mfimedical","mfi"],"pandahall":["pandahall","panda hall"],"temu":["temu","temu.com"]
  };
  function isSeller(s){if(!(s instanceof HTMLSelectElement))return false;const key=low(`${s.id} ${s.name} ${s.getAttribute("aria-label")||""}`);const labels=[...s.options].map(o=>low(o.textContent));return /seller|merchant|store/.test(key)||labels.includes("all sellers");}
  function canon(v){const l=low(v);for(const name of allowed){const n=low(name);if((aliases[n]||[n]).some(a=>l===a||l.includes(a)))return name;}return "";}
  function fix(s){if(!isSeller(s)||!allowed.length)return;const previous=canon(s.options[s.selectedIndex]?.textContent||s.value);const values=new Map();for(const o of [...s.options]){const c=canon(o.textContent||o.value);if(c&&!values.has(c))values.set(c,o.value);}s.innerHTML="";s.add(new Option("All sellers",""));for(const name of allowed)s.add(new Option(name,values.get(name)||name));if(previous){const o=[...s.options].find(x=>canon(x.textContent)===previous);if(o)s.value=o.value;}s.dataset.tpApprovedSellers="14.1.4";}
  function apply(){d.querySelectorAll("select").forEach(fix);}
  async function init(){try{const r=await fetch(`/data/approved-product-sellers-v14-1-4.json?v=${Date.now()}`,{cache:"no-store"});const j=r.ok?await r.json():{};allowed=Array.isArray(j.approvedProductSellers)?j.approvedProductSellers:[];}catch{allowed=['AliExpress','Alibaba','Geekbuying','Lenovo','Diecast','FragranceShop.com','Karaca EU','MFI Medical','PandaHall','Temu'];}apply();new MutationObserver(apply).observe(d.documentElement,{childList:true,subtree:true});setTimeout(apply,400);setTimeout(apply,1200);}
  if(d.readyState==="loading")d.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();
