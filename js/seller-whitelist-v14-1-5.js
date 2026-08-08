(() => {
  "use strict";
  const d=document;
  const clean=v=>String(v??"").replace(/\s+/g," ").trim();
  const low=v=>clean(v).toLowerCase();
  const aliases={
  "aliexpress":["aliexpress","ali express","aliexpress ww"],
  "alibaba":["alibaba","alibaba.com","alibaba ww"],
  "geekbuying":["geekbuying","geekbuying ww"],
  "lenovo":["lenovo","lenovo many geos"],
  "diecast":["diecast","diecast.com"],
  "fragranceshop.com":["fragranceshop.com","fragrance shop","the fragrance shop"],
  "karaca eu":["karaca eu","karaca europe","karaca"],
  "mfi medical":["mfi medical","mfimedical","mfi"],
  "pandahall":["pandahall","panda hall"],
  "temu":["temu","temu.com","shop temu"],
  "filamentpro eu cps":["filamentpro eu cps","filamentpro"],
  "govee many geos":["govee many geos","govee"],
  "harfington many geos":["harfington many geos","harfington"],
  "sunsky-online ww":["sunsky-online ww","sunsky","sunsky online"]
};
  let allowed=[];
  let applying=false;

  function isSeller(s){
    if(!(s instanceof HTMLSelectElement)) return false;
    const key=low(`${s.id} ${s.name} ${s.getAttribute("aria-label")||""}`);
    const labels=[...s.options].map(o=>low(o.textContent));
    return /seller|merchant|store/.test(key)||labels.includes("all sellers");
  }

  function canon(v){
    const l=low(v);
    for(const name of allowed){
      const n=low(name);
      if((aliases[n]||[n]).some(a=>l===low(a))) return name;
    }
    return "";
  }

  function desiredSignature(){
    return ["All sellers",...allowed].join("|");
  }

  function currentSignature(s){
    return [...s.options].map(o=>clean(o.textContent)).join("|");
  }

  function fix(s){
    if(!isSeller(s)||!allowed.length) return;
    if(currentSignature(s)===desiredSignature()) return;

    const selected=canon(s.options[s.selectedIndex]?.textContent||s.value);
    const oldValues=new Map();
    for(const o of [...s.options]){
      const c=canon(o.textContent||o.value);
      if(c&&!oldValues.has(c)) oldValues.set(c,o.value);
    }

    applying=true;
    try{
      s.innerHTML="";
      s.add(new Option("All sellers",""));
      for(const name of allowed) s.add(new Option(name,oldValues.get(name)||name));
      if(selected){
        const opt=[...s.options].find(o=>canon(o.textContent)===selected);
        if(opt) s.value=opt.value;
      }
      s.dataset.tpApprovedSellers="15.2.0";
    } finally {
      applying=false;
    }
  }

  function apply(){
    if(applying) return;
    d.querySelectorAll("select").forEach(fix);
  }

  async function init(){
    try{
      const r=await fetch(`/data/approved-product-sellers-v14-1-5.json?v=15.2.0`,{cache:"force-cache"});
      const j=r.ok?await r.json():{};
      allowed=Array.isArray(j.approvedProductSellers)?j.approvedProductSellers:[];
    }catch{
      allowed=["AliExpress","Alibaba","Geekbuying","Lenovo","Diecast","FragranceShop.com","Karaca EU","MFI Medical","PandaHall","Temu"];
    }
    apply();
    new MutationObserver(mutations=>{
      if(applying) return;
      let relevant=false;
      for(const m of mutations){
        if(m.addedNodes && m.addedNodes.length){ relevant=true; break; }
      }
      if(relevant) requestAnimationFrame(apply);
    }).observe(d.body||d.documentElement,{childList:true,subtree:true});

    setTimeout(apply,500);
    setTimeout(apply,1500);
  }

  if(d.readyState==="loading") d.addEventListener("DOMContentLoaded",init,{once:true});
  else init();
})();
