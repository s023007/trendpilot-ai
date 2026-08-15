(() => {
  "use strict";
  const V="20.9.0",UI="21.5.1",d=document,$=s=>d.querySelector(s),C=v=>String(v??"").replace(/\s+/g," ").trim(),E=v=>C(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const p=new URLSearchParams(location.search),id=C(p.get("id")).toLowerCase(),q=C(p.get("q"));
  const money=r=>`${r.cu==="USD"?"US$":C(r.cu||"USD")+" "}${Number(r.p).toLocaleString(undefined,{maximumFractionDigits:2})}`;
  const rarity=s=>{s=Number(s||0);if(s>=90)return`Exceptional find`;if(s>=80)return`Very rare`;if(s>=65)return`Hard to find`;if(s>=58)return`Specialist find`;return""};
  const safeExternal=u=>{try{const x=new URL(C(u),location.origin);return /^https?:$/.test(x.protocol)?x.href:""}catch{return""}};

  function fail(){
    $("[data-tp85-loading]")?.setAttribute("hidden","");
    $("[data-tp85-detail]")?.setAttribute("hidden","");
    $("[data-tp85-error]")?.removeAttribute("hidden");
  }

  function shopperTitle(raw){
    let s=C(raw);
    s=s.replace(/^(?:\[[^\]]{1,48}\]\s*)+/,'');
    s=s.replace(/^(?:(?:international|global)\s+version\s+|original\s+){1,3}/i,'');
    s=s.replace(/^(?:hot\s+sale|best\s+seller|new\s+arrival|free\s+shipping)\s*[-:|]?\s*/i,'');
    s=s.replace(/\s*[-|]\s*(?:wholesale|factory price|free shipping)\s*$/i,'');
    if(s.length>112){const cut=s.slice(0,112);s=(cut.replace(/\s+\S*$/,'')||cut).trim()+"…";}
    return s||C(raw)||"Product";
  }

  function sellerSearchLabel(r,title){
    const seller=C(r.se||"seller");
    const core=title.replace(/…$/,'').split(/\s+/).slice(0,7).join(' ');
    return r.x?`View product on ${seller} ↗`:`Open ${seller} and search for ${core} ↗`;
  }

  function summary(r,title){
    const seller=C(r.se||"the seller");
    const bits=[];
    if(r.x) bits.push(`${title} has a direct product link from ${seller}.`);
    else bits.push(`${title} appears in ${seller}'s catalogue, but the available link may open a seller search or marketplace page rather than this exact listing.`);
    if(r.p) bits.push(r.x?`The price shown is tied to this listing.`:`The price shown came from the seller catalogue and may have changed.`);
    bits.push(`Check the product name or model, current price, stock, delivery and final checkout total before buying.`);
    return bits.join(' ');
  }

  function highlights(title){
    const s=C(title),out=[];
    const screen=s.match(/\b(\d(?:\.\d{1,2})?)\s*(?:inch|inches|\")\b/i);if(screen)out.push(`${screen[1]}″ display`);
    if(/\bGPS\b/i.test(s))out.push('GPS');
    if(/\bwaterproof\b|\bwater resistant\b|\bIP(?:6[7-9]|[67]8)\b/i.test(s))out.push('Water resistant');
    const storage=s.match(/\b(\d{2,4})\s*(GB|TB)\b/i);if(storage)out.push(`${storage[1]} ${storage[2].toUpperCase()}`);
    const ram=s.match(/\b(\d{1,3})\s*GB\s*(?:RAM|memory)\b/i);if(ram)out.push(`${ram[1]} GB RAM`);
    if(/\bbluetooth\b/i.test(s))out.push('Bluetooth');
    if(/\b5G\b/i.test(s))out.push('5G');
    return [...new Set(out)].slice(0,5);
  }

  function publicIds(values,internalId){
    return (values||[]).map(C).filter(Boolean).filter(v=>{
      if(v.toLowerCase()===C(internalId).toLowerCase())return false;
      if(/^[a-f0-9]{12,40}$/i.test(v))return false;
      if(/^tp(?:id|vid|oid)[-_:]/i.test(v))return false;
      if(/^\d{8,14}$/.test(v))return true;
      return v.length>=4&&v.length<=40&&/[a-z]/i.test(v)&&/\d/.test(v);
    }).slice(0,3);
  }

  function compareItems(){try{const x=JSON.parse(localStorage.getItem("tp-v209-compare")||"[]");return Array.isArray(x)?x:[]}catch{return[]}}
  function setCompare(items){try{localStorage.setItem("tp-v209-compare",JSON.stringify(items.slice(0,3)))}catch{};d.querySelectorAll('[data-compare-count]').forEach(el=>{el.textContent=String(items.length);el.toggleAttribute('hidden',!items.length)})}
  function bindCompare(r){
    const btn=$("[data-tp85-compare]");if(!btn)return;
    const render=()=>{const items=compareItems();btn.textContent=items.some(x=>(typeof x==="string"?x:x.id)===r.id)?"View comparison":"Add to compare";setCompare(items)};
    render();
    btn.addEventListener("click",()=>{
      const items=compareItems();
      if(items.some(x=>(typeof x==="string"?x:x.id)===r.id)){location.href="/compare/";return}
      const first=items[0],ff=typeof first==="object"?C(first.fa):"";
      if(ff&&C(r.fa)&&ff!==C(r.fa)){btn.textContent="Choose a similar product to compare";setTimeout(render,1600);return}
      if(items.length>=3){btn.textContent="Comparison is full";setTimeout(render,1600);return}
      items.push({id:r.id,fa:C(r.fa),t:C(r.t),ty:C(r.ty)});setCompare(items);render();
    });
  }

  async function boot(){
    if(!/^[a-f0-9]{14}$/.test(id)){fail();return}
    try{
      const res=await fetch(`/data/v20-9/products/${id.slice(0,2)}.json?v=${V}`,{cache:"force-cache"});
      if(!res.ok){fail();return}
      const bucket=await res.json(),r=bucket?.[id];if(!r){fail();return}
      const rawTitle=C(r.t||"Product"),title=shopperTitle(rawTitle);
      const back=$("[data-tp85-back]");if(back)back.href=q?`/find/?q=${encodeURIComponent(q)}&universal=1&engine=v2064`:"/find/";
      d.title=`${title.replace(/…$/,'')} — TrendPilot AI`;
      const img=$("[data-tp85-image]");if(r.im){img.src=r.im;img.alt=title}else img?.closest(".tp85-media")?.setAttribute("hidden","");
      $("[data-tp85-type]").textContent=C(r.tyl||"Product");
      $("[data-tp85-seller]").textContent=C(r.se||"");
      $("[data-tp85-title]").textContent=title;
      const original=$("[data-tp85-original-title]");if(original&&title!==rawTitle){original.textContent=`Seller title: ${rawTitle}`;original.removeAttribute('hidden')}

      const price=$("[data-tp85-price]"),proof=$("[data-tp85-proof]");
      if(r.p){price.textContent=money(r);proof.textContent=r.x?"Price for this listing":"Price from seller";proof.classList.add(r.x?"exact":"feed")}
      else{price.textContent="Check current price";proof.textContent="Check with seller";proof.classList.add("check")}

      const badges=$("[data-tp85-badges]"),rare=rarity(r.r);badges.innerHTML=rare?`<span>${E(rare)}</span>`:'';
      $("[data-tp85-summary]").textContent=summary(r,title.replace(/…$/,''));

      const hs=highlights(rawTitle),hw=$("[data-tp85-highlights-wrap]");
      if(hs.length&&hw){$("[data-tp85-highlights]").innerHTML=hs.map(x=>`<span>${E(x)}</span>`).join('');hw.removeAttribute('hidden')}

      $("[data-tp85-fact-seller]").textContent=C(r.se||"Check seller");
      $("[data-tp85-fact-type]").textContent=C(r.tyl||"Product");
      $("[data-tp85-fact-condition]").textContent=C(r.co||"Check seller");

      const ids=publicIds(r.ids,id);if(ids.length){$("[data-tp85-identifiers]").innerHTML=ids.map(x=>`<code>${E(x)}</code>`).join("");$("[data-tp85-identifiers-wrap]").removeAttribute("hidden")}

      const ext=safeExternal(r.u),seller=$("[data-tp85-seller-link]");
      if(ext){seller.href=ext;seller.textContent=sellerSearchLabel(r,title.replace(/…$/,''))}else seller.setAttribute("hidden","");
      const sim=$("[data-tp85-similar]");sim.href=`/find/?q=${encodeURIComponent(q||title||"")}&universal=1&engine=v2064`;
      $("[data-tp85-exit-note]").textContent=r.x?`This button opens the seller's product page. Confirm price, stock and delivery before payment.`:`This button opens the seller or marketplace. Use the product name above to find the matching listing, then confirm price, stock and delivery.`;
      bindCompare(r);
      $("[data-tp85-loading]").setAttribute("hidden","");$("[data-tp85-detail]").removeAttribute("hidden");
      d.documentElement.dataset.tpItemUi=UI;
    }catch{fail()}
  }
  if(d.readyState==="loading")d.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
})();