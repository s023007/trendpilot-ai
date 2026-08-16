(() => {
  "use strict";
  const V="21.17.0",d=document,$=s=>d.querySelector(s),C=v=>String(v??"").replace(/\s+/g," ").trim(),E=v=>C(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const key="tp-v209-compare";
  const PF=/\b(?:accessor(?:y|ies)|case|cases|cover|covers|shell|bumper|pouch|sleeve|screen protector|tempered glass|protective glass|protective film|film protector|sim(?: card)? tray|sim holder|sim slot|replacement battery|battery for|phone battery|battery case|replacement|repair|spare part|charging port|wireless charger|phone charger|wall charger|car charger|charging station|charging cable|charging cord|usb cable|usb cord|data cable|data cord|cable|cord|connector|flex cable|digitizer|lcd replacement|display assembly|screen assembly|motherboard|back glass|housing|phone holder|phone stand|phone mount|car mount|bracket|tripod|selfie stick|strap|lanyard|wallet|game controller|gamepad|joystick|trigger|game handle|cooler|cooling fan|mini fan|fan\b|power bank|earbuds?|earphones?|headphones?|headsets?|smart ?watch|tablet|ipad|ssd enclosure|m\.?2 enclosure|adapter|dongle|dock|telescope|telephoto|monocular|binocular|microscope|camera lens|lens kit|ring light|stylus|keyboard|carplay|holder stand|packing box|phone box|empty box|sticker|skin|cleaning kit|repair tool|opening tool|suction cup|adhesive|glue|solar panel)\b/i;
  const FIT=/\b(?:for|fits?|compatible with|replacement for|used for|suitable for)\s+(?:(?:apple|samsung|google|xiaomi|redmi|oneplus|poco|oppo|vivo|realme|motorola|moto|honor|huawei|nokia|sony|zte)\s+)?(?:iphone|galaxy|pixel|android(?:\s+mobile)?\s+phone|mobile phone|cell phone|smartphone)\b/i;
  const PM=/\b(?:iphone\s*(?:[5-9x]|1[0-9])(?:\s*(?:pro|max|plus|mini|e|s|se))?|samsung\s+galaxy\s+[a-zmfsz]\s*\d+|galaxy\s+(?:s|a|m|f|z)\s*\d+|google\s+pixel\s+\d+|pixel\s+\d+|oneplus\s+\d+[a-z]?(?:\s+pro)?|xiaomi\s+(?:mi\s+)?\d+[a-z]?(?:\s+pro)?|redmi\s+(?:note\s+)?[a-z0-9]+|poco\s+[a-z]\d+|oppo\s+[a-z0-9]+|vivo\s+[a-z0-9]+|realme\s+[a-z0-9]+|motorola\s+(?:moto\s+)?[a-z0-9]+|moto\s+[a-z0-9]+|honor\s+[a-z0-9]+|huawei\s+(?:mate|p|nova)\s*\d+|nokia\s+[a-z0-9.]+|sony\s+xperia\s+[a-z0-9]+|nothing\s+phone\s*\(?\d+\)?|asus\s+(?:rog\s+phone|zenfone)\s*\d+|zte\s+[a-z0-9]+|nubia\s+[a-z0-9]+|infinix\s+[a-z0-9]+|tecno\s+[a-z0-9]+)\b/i;
  const PG=/\b(?:smart ?phone|mobile phone|cell phone|feature phone|android phone|android mobile phone|unlocked phone|gsm phone|5g phone|4g phone)\b/i;
  const PS=/\b(?:\d(?:\.\d+)?\s*(?:inch|inches|")|dual sim|single sim|gsm|cdma|5g|4g|lte|android\s*\d*|snapdragon|dimensity|helio|octa[- ]?core|quad[- ]?core|\d+\s*gb\s*ram|\d+\s*gb\s*(?:rom|storage)|\d{3,5}\s*mah|\d+\s*mp|camera|face unlock|fingerprint|keypad|touchscreen|full screen)\b/ig;
  const money=(r,v=usablePrice(r))=>`${r.cu==="USD"?"US$":C(r.cu||"USD")+" "}${Number(v).toLocaleString(undefined,{maximumFractionDigits:2})}`;
  const sellerAllowed=r=>window.__TP_ALLOW_TIKTOK_US__===true||!/^TikTok\s*Shop\s*US$/i.test(C(r?.se));
  const waitForGeo=async()=>{try{const p=window.__TP_GEO_READY__;if(p&&typeof p.then==="function")await p}catch{}};
  function usablePrice(r){const value=Number(r?.p)||0;if(!value)return 0;const seller=C(r?.se).toLowerCase(),role=C(r?.ro||"main").toLowerCase(),text=C([r?.fa,r?.ty,r?.tyl,r?.t].join(" ")).toLowerCase();if(seller.includes("lenovo")&&role!=="accessory"&&role!=="replacement_part"&&value<=5&&/\b(?:laptop|tablet|chromebook|notebook|computer)\b/i.test(text))return 0;return value}
  function phoneTitleOK(title){const t=C(title);if(!t||PF.test(t)||FIT.test(t))return false;if(PM.test(t))return true;if(PG.test(t)){PS.lastIndex=0;return(t.match(PS)||[]).length>=1}return false}
  const semanticOK=r=>{const family=C(r?.fa||r?.ty).toLowerCase(),role=C(r?.ro||"main").toLowerCase();if(family==="phone"&&["main","used"].includes(role))return phoneTitleOK(r?.t);return true};
  function read(){try{const x=JSON.parse(localStorage.getItem(key)||"[]");return Array.isArray(x)?x.slice(0,3):[]}catch{return[]}}
  function write(items){try{localStorage.setItem(key,JSON.stringify(items.slice(0,3)))}catch{};d.querySelectorAll('[data-compare-count]').forEach(el=>{el.textContent=String(items.length);el.toggleAttribute('hidden',!items.length)})}
  async function record(id){if(!/^[a-f0-9]{14}$/.test(id))return null;try{const r=await fetch(`/data/v20-9/products/${id.slice(0,2)}.json?v=20.9.0`,{cache:"force-cache"});if(!r.ok)return null;return(await r.json())?.[id]||null}catch{return null}}
  const priceProof=r=>!usablePrice(r)?"Check with seller":r.x?"Price for this listing":"Price from seller";
  function shortTitle(raw){let s=C(raw).replace(/^(?:\[[^\]]{1,48}\]\s*)+/,'').replace(/^(?:(?:international|global)\s+version\s+|original\s+){1,3}/i,'');if(s.length>96){const x=s.slice(0,96);s=(x.replace(/\s+\S*$/,'')||x).trim()+"…"}return s||C(raw)||"Product"}
  function publicId(r){return (r.ids||[]).map(C).find(v=>v&&v.toLowerCase()!==C(r.id).toLowerCase()&&!/^[a-f0-9]{12,40}$/i.test(v)&&(/^\d{8,14}$/.test(v)||(v.length<=40&&/[a-z]/i.test(v)&&/\d/.test(v))))||""}
  function productCard(r){
    const detail=`/item/?id=${encodeURIComponent(r.id)}`;
    const title=shortTitle(r.t),sellerName=C(r.se||"seller"),seller=r.u?`<a class="tp90-primary" href="${E(r.u)}" target="_blank" rel="sponsored nofollow noopener">${r.x?`View product on ${E(sellerName)}`:`Search ${E(sellerName)} for this product`} ↗</a>`:`<a class="tp90-primary" href="${E(detail)}">View details</a>`;
    const code=publicId(r);
    return `<article class="tp90-product" data-seller="${E(sellerName)}"><a class="tp90-media" href="${E(detail)}">${r.im?`<img src="${E(r.im)}" alt="${E(title)}" width="500" height="500" loading="lazy">`:"<span>No image</span>"}</a><div class="tp90-copy"><div class="tp90-type"><span>${E(r.tyl||r.ty)}</span><span>${E(sellerName)}</span></div><h2><a href="${E(detail)}">${E(title)}</a></h2><p class="tp90-price">${usablePrice(r)?E(money(r)):"Check current price"}</p><span class="tp90-proof">${E(priceProof(r))}</span><div class="tp90-facts"><div class="tp90-fact"><b>Seller</b><span>${E(sellerName)}</span></div><div class="tp90-fact"><b>Category</b><span>${E(r.tyl||r.ty||"Product")}</span></div><div class="tp90-fact"><b>Condition</b><span>${E(r.co||"Check seller")}</span></div>${code?`<div class="tp90-fact"><b>Product code</b><span>${E(code)}</span></div>`:''}</div><div class="tp90-actions">${seller}<button class="tp90-secondary" type="button" data-v209-remove="${E(r.id)}">Remove</button></div></div></article>`
  }
  function remove(id){const items=read().filter(x=>(typeof x==="string"?x:x.id)!==id);write(items);boot()}
  async function boot(){
    await waitForGeo();
    const host=$("[data-v209-compare-root]");if(!host)return;
    const saved=read();write(saved);
    if(!saved.length){host.innerHTML='<section class="tp90-empty"><h2>Your comparison is empty.</h2><p>Add similar products from search or a product page.</p><a href="/find/">Find products</a></section>';$("[data-v209-compare-count]").textContent="0 products";return}
    host.innerHTML='<section class="tp90-empty"><h2>Loading comparison…</h2></section>';
    const loaded=(await Promise.all(saved.map(x=>record(typeof x==="string"?x:x.id)))).filter(Boolean),geoRejected=loaded.filter(r=>!sellerAllowed(r)),allowed=loaded.filter(sellerAllowed),rejected=allowed.filter(r=>!semanticOK(r)),records=allowed.filter(semanticOK);
    if(geoRejected.length||rejected.length){const keep=new Set(records.map(r=>r.id));write(saved.filter(x=>keep.has(typeof x==="string"?x:x.id)))}
    if(!records.length){write([]);host.innerHTML='<section class="tp90-empty"><h2>No comparable products remain for your region.</h2><p>TikTok Shop US products are available in TrendPilot only to visitors in the United States. Choose another seller or product.</p><a href="/find/">Find products</a></section>';$("[data-v209-compare-count]").textContent="0 products";return}
    const baseFamily=C(records[0].fa||records[0].ty),compatible=records.filter(r=>C(r.fa||r.ty)===baseFamily),incompatible=records.filter(r=>C(r.fa||r.ty)!==baseFamily);
    let warning="";
    if(geoRejected.length)warning+='<section class="tp90-warning"><h2>A regional item was removed.</h2><p>TikTok Shop US products are shown only to visitors in the United States.</p></section>';
    if(rejected.length)warning+='<section class="tp90-warning"><h2>One item was removed.</h2><p>It did not match the main products in this comparison.</p></section>';
    if(incompatible.length)warning+='<section class="tp90-warning"><h2>Some saved products do not belong in this comparison.</h2><p>Remove them and choose more similar products.</p></section>';
    host.innerHTML=warning+`<div class="tp90-grid">${compatible.map(productCard).join("")}</div><section class="tp90-note">Compare the available details here, then confirm the latest price, stock, delivery and exact product with the seller before buying.</section>`;
    $("[data-v209-compare-count]").textContent=`${compatible.length} product${compatible.length===1?"":"s"}`;
    host.querySelectorAll('[data-v209-remove]').forEach(b=>b.addEventListener('click',()=>remove(b.dataset.v209Remove)));
  }
  $("[data-v209-clear]")?.addEventListener("click",()=>{write([]);boot()});
  if(d.readyState==="loading")d.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
})();
