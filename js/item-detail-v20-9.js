(() => {
  "use strict";
  const V="20.9.0",UI="21.8.0",d=document,$=s=>d.querySelector(s),C=v=>String(v??"").replace(/\s+/g," ").trim(),E=v=>C(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const p=new URLSearchParams(location.search),id=C(p.get("id")).toLowerCase(),q=C(p.get("q"));
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
    s=s.replace(/^(?:hot\s+sale|hot\s+selling|best\s+seller|new\s+arrival|weekly\s+deals|free\s+shipping|wholesale)\s*[-:|]?\s*/i,'');
    s=s.replace(/\s*[-|]\s*(?:wholesale|factory price|free shipping)\s*$/i,'');
    if(s.length>112){const cut=s.slice(0,112);s=(cut.replace(/\s+\S*$/,'')||cut).trim()+"…";}
    return s||C(raw)||"Product";
  }

  function searchPhrase(r,rawTitle){
    let s=shopperTitle(rawTitle).replace(/…$/,'');
    s=s.replace(/\b(?:wholesale|wholesales|factory\s+(?:price|supply)|best\s+quality|high\s+quality|cheap|cheapest|promotion\s+gifts?|in\s+stock|free\s+shipping|new\s+arrivals?)\b/ig,' ');
    s=C(s.replace(/[|【】\[\]]+/g,' '));
    const words=s.split(/\s+/).filter(Boolean);
    const unit=/^\d+(?:\.\d+)?(?:gb|tb|mb|mah|w|kw|v|a|hz|khz|mhz|inch|inches|mm|cm|mp|p)$/i;
    const modelAt=words.findIndex(w=>/[a-z]/i.test(w)&&/\d/.test(w)&&w.length<=20&&!unit.test(w));
    const brand=C(r.b);
    if(modelAt>=0){
      let start=Math.max(0,modelAt-2),end=Math.min(words.length,modelAt+3);
      if(brand){const bi=words.findIndex(w=>w.toLowerCase()===brand.toLowerCase());if(bi>=0&&bi<=modelAt)start=bi;}
      const modelPhrase=C(words.slice(start,end).join(' '));
      if(modelPhrase.length>=4)return modelPhrase;
    }
    const first=C(words.slice(0,10).join(' '));
    return first||shopperTitle(rawTitle).replace(/…$/,'')||"product";
  }

  function sellerSearchUrl(seller,phrase){
    const s=C(seller).toLowerCase(),x=encodeURIComponent(C(phrase));
    if(!x)return"";
    if(s.includes("alibaba")&&!s.includes("aliexpress"))return`https://www.alibaba.com/trade/search?SearchText=${x}`;
    if(s.includes("aliexpress"))return`https://www.aliexpress.com/wholesale?SearchText=${x}`;
    if(s.includes("tiktok"))return`https://www.tiktok.com/search?q=${x}`;
    if(s.includes("amazon"))return`https://www.amazon.com/s?k=${x}`;
    if(s.includes("ebay"))return`https://www.ebay.com/sch/i.html?_nkw=${x}`;
    if(s.includes("walmart"))return`https://www.walmart.com/search?q=${x}`;
    if(s.includes("etsy"))return`https://www.etsy.com/search?q=${x}`;
    return`https://www.google.com/search?q=${encodeURIComponent(`${seller} ${phrase}`)}`;
  }

  function decodedUrl(u){
    let s=C(u);for(let i=0;i<3;i++){try{const n=decodeURIComponent(s);if(n===s)break;s=n}catch{break}}return s;
  }

  function handoff(r,rawTitle){
    const seller=C(r.se||"seller"),sl=seller.toLowerCase(),tracked=safeExternal(r.u),phrase=searchPhrase(r,rawTitle),search=sellerSearchUrl(seller,phrase),decoded=decodedUrl(tracked);
    if(r.x&&tracked)return{kind:"direct",primary:tracked,label:`View product on ${seller} ↗`,secondary:"",secondaryLabel:"",phrase,note:`This opens the seller's product page. Confirm the current price, stock and delivery before payment.`};
    if(sl.includes("tiktok")&&tracked&&/tiktok\.com\/view\/product\//i.test(decoded))return{kind:"candidate",primary:tracked,label:`Check this item on TikTok ↗`,secondary:search,secondaryLabel:`Search TikTok for “${phrase}” ↗`,phrase,note:`TikTok Shop listings can become unavailable or change. Try the item link first; if it is unavailable, use the search option and match the product name or model.`};
    if(sl.includes("alibaba"))return{kind:"search",primary:search||tracked,label:`Search Alibaba for “${phrase}” ↗`,secondary:tracked&&tracked!==(search||"")?tracked:"",secondaryLabel:"Open Alibaba seller offer ↗",phrase,note:`Alibaba seller links can sometimes open a broader marketplace page. The search button is the safer way to locate the matching product; confirm the name or model before ordering.`};
    if(search)return{kind:"search",primary:search,label:`Search ${seller} for “${phrase}” ↗`,secondary:tracked&&tracked!==search?tracked:"",secondaryLabel:tracked?`Open seller link ↗`:"",phrase,note:`A direct product page was not confirmed. Search for the product name or model, then confirm price, stock and delivery before buying.`};
    if(tracked)return{kind:"candidate",primary:tracked,label:`Check on ${seller} ↗`,secondary:"",secondaryLabel:"",phrase,note:`A direct product page was not confirmed. Match the product name or model on the seller before buying.`};
    return{kind:"none",primary:"",label:"",secondary:"",secondaryLabel:"",phrase,note:`No reliable seller destination is available for this item right now.`};
  }

  function priceState(r){
    const value=Number(r.p)||0,seller=C(r.se).toLowerCase();
    const suspicious=(seller.includes("lenovo")&&value>0&&value<=5);
    if(!value||suspicious)return{label:"Check current price",proof:"Check with seller",kind:"check",usable:false};
    return{label:`${r.cu==="USD"?"US$":C(r.cu||"USD")+" "}${value.toLocaleString(undefined,{maximumFractionDigits:2})}`,proof:r.x?"Price for this listing":"Price from seller",kind:r.x?"exact":"feed",usable:true};
  }

  function summary(r,title,pi,h){
    const seller=C(r.se||"the seller"),bits=[];
    if(h.kind==="direct")bits.push(`${title} has a direct product link from ${seller}.`);
    else if(h.kind==="candidate")bits.push(`${title} has a seller listing link, but its current availability has not been confirmed.`);
    else if(h.kind==="search")bits.push(`${title} can be searched by name or model on ${seller}; a direct product page was not confirmed.`);
    else bits.push(`${title} is in TrendPilot, but a reliable seller destination is not available right now.`);
    if(pi.usable)bits.push(r.x?`The displayed price is tied to the listed product record.`:`The displayed price was supplied by the seller and may have changed.`);
    bits.push(`Confirm the product name or model, current price, stock, delivery and final checkout total before buying.`);
    return bits.join(' ');
  }

  function highlights(title){
    const s=C(title),out=[];
    const screen=s.match(/\b(\d(?:\.\d{1,2})?)\s*(?:inch|inches|\")\b/i);if(screen)out.push(`${screen[1]}″ display`);
    if(/\bGPS\b/i.test(s))out.push('GPS');
    if(/\bwaterproof\b|\bwater resistant\b|\bIP(?:6[7-9]|[67]8)\b/i.test(s))out.push('Water resistant');
    const ram=s.match(/\b(\d{1,3})\s*GB\s*(?:RAM|memory)\b/i);if(ram)out.push(`${ram[1]} GB RAM`);
    const storage=s.match(/\b(\d{2,4})\s*(GB|TB)\s*(?:ROM|SSD|storage)?\b/i);if(storage&&!out.includes(`${storage[1]} GB RAM`))out.push(`${storage[1]} ${storage[2].toUpperCase()}`);
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

  function setExternalLink(el,href,label,sponsored){
    if(!el)return;if(!href){el.setAttribute("hidden","");return}
    el.href=href;el.textContent=label;el.rel=sponsored?"sponsored nofollow noopener":"nofollow noopener";el.removeAttribute("hidden");
  }

  async function boot(){
    if(!/^[a-f0-9]{14}$/.test(id)){fail();return}
    try{
      const res=await fetch(`/data/v20-9/products/${id.slice(0,2)}.json?v=${V}`,{cache:"force-cache"});
      if(!res.ok){fail();return}
      const bucket=await res.json(),r=bucket?.[id];if(!r){fail();return}
      const rawTitle=C(r.t||"Product"),title=shopperTitle(rawTitle),pi=priceState(r),h=handoff(r,rawTitle);
      const back=$("[data-tp85-back]");if(back)back.href=q?`/find/?q=${encodeURIComponent(q)}&universal=1&engine=v2064`:"/find/";
      d.title=`${title.replace(/…$/,'')} — TrendPilot AI`;
      const img=$("[data-tp85-image]");if(r.im){img.src=r.im;img.alt=title}else img?.closest(".tp85-media")?.setAttribute("hidden","");
      $("[data-tp85-type]").textContent=C(r.tyl||"Product");
      $("[data-tp85-seller]").textContent=C(r.se||"");
      $("[data-tp85-title]").textContent=title;
      const original=$("[data-tp85-original-title]");if(original&&title!==rawTitle){original.textContent=`Seller title: ${rawTitle}`;original.removeAttribute('hidden')}

      const price=$("[data-tp85-price]"),proof=$("[data-tp85-proof]");price.textContent=pi.label;proof.textContent=pi.proof;proof.classList.add(pi.kind);
      const badges=$("[data-tp85-badges]"),rare=rarity(r.r);badges.innerHTML=rare?`<span>${E(rare)}</span>`:'';
      $("[data-tp85-summary]").textContent=summary(r,title.replace(/…$/,''),pi,h);

      const hs=highlights(rawTitle),hw=$("[data-tp85-highlights-wrap]");
      if(hs.length&&hw){$("[data-tp85-highlights]").innerHTML=hs.map(x=>`<span>${E(x)}</span>`).join('');hw.removeAttribute('hidden')}

      $("[data-tp85-fact-seller]").textContent=C(r.se||"Check seller");
      $("[data-tp85-fact-type]").textContent=C(r.tyl||"Product");
      $("[data-tp85-fact-condition]").textContent=C(r.co||"Check seller");

      const ids=publicIds(r.ids,id);if(ids.length){$("[data-tp85-identifiers]").innerHTML=ids.map(x=>`<code>${E(x)}</code>`).join("");$("[data-tp85-identifiers-wrap]").removeAttribute("hidden")}

      setExternalLink($("[data-tp85-seller-link]"),h.primary,h.label,h.kind==="direct"||h.kind==="candidate");
      setExternalLink($("[data-tp85-seller-fallback]"),h.secondary,h.secondaryLabel,Boolean(h.secondary&&safeExternal(r.u)===h.secondary));
      const sim=$("[data-tp85-similar]");sim.href=`/find/?q=${encodeURIComponent(q||h.phrase||title||"")}&universal=1&engine=v2064`;
      $("[data-tp85-exit-note]").textContent=h.note;
      bindCompare(r);
      $("[data-tp85-loading]").setAttribute("hidden","");$("[data-tp85-detail]").removeAttribute("hidden");
      d.documentElement.dataset.tpItemUi=UI;
    }catch{fail()}
  }
  if(d.readyState==="loading")d.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
})();