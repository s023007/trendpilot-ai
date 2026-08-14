(() => {
  "use strict";
  const DATA_VERSION="20.8.4",d=document,$=s=>d.querySelector(s),C=v=>String(v??"").replace(/\s+/g," ").trim(),E=v=>C(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const p=new URLSearchParams(location.search),id=C(p.get("id")).toLowerCase(),q=C(p.get("q"));
  const roleLabel=v=>C(v||"main").replaceAll("_"," ").replace(/\b\w/g,m=>m.toUpperCase());
  const money=r=>`${r.cu==="USD"?"US$":C(r.cu||"USD")+" "}${Number(r.p).toLocaleString(undefined,{maximumFractionDigits:2})}`;
  const rarity=s=>{s=Number(s||0);if(s>=90)return`Exceptional find · ${s}`;if(s>=80)return`Very rare · ${s}`;if(s>=65)return`Hard to find · ${s}`;if(s>=58)return`Specialist find · ${s}`;return""};
  const safeExternal=u=>{try{const x=new URL(C(u),location.origin);return /^https?:$/.test(x.protocol)?x.href:""}catch{return""}};
  function fail(){$("[data-tp85-loading]")?.setAttribute("hidden","");$("[data-tp85-detail]")?.setAttribute("hidden","");$("[data-tp85-context]")?.setAttribute("hidden","");$("[data-tp85-error]")?.removeAttribute("hidden")}
  function summary(r){
    const bits=[];
    bits.push(`TrendPilot classifies this as ${C(r.tyl||"a product").toLowerCase()}${r.ro&&r.ro!=="main"?` and specifically as a ${C(r.ro).replaceAll("_"," ")}`:""}.`);
    if(r.x)bits.push(`A direct product destination is available for ${C(r.se||"the seller")}.`);else bits.push(`The available seller route is broader than a confirmed exact-product destination.`);
    if(r.p)bits.push(r.x?`The displayed price is tied to that exact-product evidence.`:`The displayed price came from seller catalogue data and should be reconfirmed on the seller.`);
    bits.push(`Confirm stock, condition, delivery and the final checkout total before payment.`);
    return bits.join(" ");
  }
  async function boot(){
    if(!/^[a-f0-9]{14}$/.test(id)){fail();return}
    try{
      const res=await fetch(`/data/v20-8/products/${id[0]}.json?v=${DATA_VERSION}`,{cache:"force-cache"});
      if(!res.ok){fail();return}
      const bucket=await res.json(),r=bucket?.[id];if(!r){fail();return}
      const back=$("[data-tp85-back]");if(back)back.href=q?`/find/?q=${encodeURIComponent(q)}&universal=1&engine=v2064`:"/find/";
      d.title=`${C(r.t||"Product")} — TrendPilot AI`;
      const img=$("[data-tp85-image]");if(r.im){img.src=r.im;img.alt=C(r.t)}else img?.closest(".tp85-media")?.setAttribute("hidden","");
      $("[data-tp85-type]").textContent=C(r.tyl||"Product");$("[data-tp85-seller]").textContent=C(r.se||"");$("[data-tp85-title]").textContent=C(r.t||"Product");
      const price=$("[data-tp85-price]"),proof=$("[data-tp85-proof]");
      if(r.p){price.textContent=money(r);proof.textContent=r.x?"✓ Exact-product price":"Seller-feed price";proof.classList.add(r.x?"exact":"feed")}else{price.textContent="Check current price";proof.textContent="Confirm with seller";proof.classList.add("check")}
      const badges=$("[data-tp85-badges]"),rare=rarity(r.r),parts=[];if(rare)parts.push(rare);for(const s of (r.sg||[]).slice(0,4))parts.push(C(s).replaceAll("-"," "));badges.innerHTML=parts.map(x=>`<span>${E(x)}</span>`).join("");
      $("[data-tp85-summary]").textContent=summary(r);$("[data-tp85-fact-seller]").textContent=C(r.se||"Check seller");$("[data-tp85-fact-type]").textContent=C(r.tyl||"Product");$("[data-tp85-fact-role]").textContent=roleLabel(r.ro);$("[data-tp85-fact-condition]").textContent=C(r.co||"Check seller");
      const ids=(r.ids||[]).map(C).filter(Boolean);if(ids.length){$("[data-tp85-identifiers]").innerHTML=ids.slice(0,8).map(x=>`<code>${E(x)}</code>`).join("");$("[data-tp85-identifiers-wrap]").removeAttribute("hidden")}
      const ext=safeExternal(r.u),seller=$("[data-tp85-seller-link]");if(ext){seller.href=ext;seller.textContent=r.x?`Open exact product on ${C(r.se||"seller")} ↗`:`Search ${C(r.se||"seller")} ↗`}else seller.setAttribute("hidden","");
      const sim=$("[data-tp85-similar]");sim.href=`/find/?q=${encodeURIComponent(q||r.t||"")}&universal=1&engine=v2064`;
      $("[data-tp85-exit-note]").textContent=r.x?`The blue seller button is the only action here that leaves TrendPilot and opens the confirmed product destination.`:`The blue seller button leaves TrendPilot for a broader seller route; it is not presented as an exact-product destination.`;
      $("[data-tp85-loading]").setAttribute("hidden","");$("[data-tp85-detail]").removeAttribute("hidden");$("[data-tp85-context]").removeAttribute("hidden");
    }catch{fail()}
  }
  if(d.readyState==="loading")d.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
})();