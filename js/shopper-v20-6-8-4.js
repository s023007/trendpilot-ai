(()=>{
  'use strict';
  const VERSION='20.6.8.4';
  const META_URL=`/data/shopper-v20-6-8-4/meta.json?v=${VERSION}`;
  const PHONE_URL=`/data/shopper-v20-6-8-4/phone-suffixes.json?v=${VERSION}`;
  const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
  const lower=v=>clean(v).toLowerCase();
  const esc=v=>clean(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const HARD_FALSE=/\b(?:phone\s+case|mobile\s+case|protective\s+case|cover\s+for|screen\s+protector|tempered\s+glass|charging\s+station|phone\s+charging\s+station|charging\s+locker|charging\s+port|port\s+clean(?:er|ing)|dust\s+removal|cleaning\s+(?:kit|tool)|repair\s+(?:kit|tool)|replacement\s+(?:battery|screen|part)|battery\s+(?:for|replacement)|battery\s+case|power\s+bank|charger\b|charging\s+cable|usb\s+cable|data\s+cable|phone\s+holder|phone\s+stand|phone\s+mount|car\s+mount|tripod|selfie\s+stick|game\s*controller|gamepad|joystick|trigger\s+for\s+pubg|phone\s+cooler|cooling\s+fan|smartwatch|smart\s+watch|watch\s+band|earbuds?|earphones?|headphones?|headsets?|speaker|microphone|tablet|ipad|projector|digitizer|touch\s+screen\s+replacement|lcd\s+screen\s+replacement|flex\s+cable|motherboard|housing|back\s+cover|camera\s+lens|phone\s+strap|lanyard|wallet\s+case|phone\s+accessor(?:y|ies)|coin[- ]?operated|vending\s+machine|lockers?|charging\s+cabinet)\b/i;
  const PHONE_MODEL=/\b(?:iphone\s*(?:[5-9x]|1[0-9])(?:\s*(?:pro|max|plus|mini))?|samsung\s+galaxy\s+[a-zmfsz]\s*\d+|galaxy\s+s\d+|google\s+pixel\s+\d+|oneplus\s+\d+[a-z]?(?:\s+pro)?|xiaomi\s+\d+[a-z]?(?:\s+pro)?|redmi\s+(?:note\s+)?[a-z0-9]+|poco\s+[a-z]\d+|oppo\s+[a-z0-9]+|vivo\s+[a-z0-9]+|realme\s+[a-z0-9]+|motorola\s+(?:moto\s+)?[a-z0-9]+|moto\s+g\d+|honor\s+[a-z0-9]+|huawei\s+(?:mate|p|nova)\s*\d+|nokia\s+[a-z0-9.]+|sony\s+xperia\s+[a-z0-9]+|nothing\s+phone\s*\(?\d+\)?|asus\s+(?:rog\s+phone|zenfone)\s*\d+|zte\s+[a-z0-9]+|nubia\s+[a-z0-9]+|infinix\s+[a-z0-9]+|tecno\s+[a-z0-9]+)\b/i;
  const GENERIC_PHONE=/\b(?:smart\s*phone|smartphone|mobile\s+phone|cell\s+phone|android\s+phone|unlocked\s+phone|5g\s+phone)\b/i;
  const PHONE_HW=/\b(?:android\s*\d*|dual\s+sim|single\s+sim|5g|4g|lte|gsm|snapdragon|dimensity|helio|octa[- ]?core|\d+\s*gb\s+ram|\d+\s*gb\s+(?:rom|storage)|\d{3,5}\s*mah)\b/ig;
  const isPhoneText=t=>{
    t=clean(t); if(!t||HARD_FALSE.test(t)) return false;
    if(PHONE_MODEL.test(t)||/\bsmartphones?\b/i.test(t)) return true;
    if(GENERIC_PHONE.test(t)) return (t.match(PHONE_HW)||[]).length>=1;
    return false;
  };
  const suffixFromHref=href=>{const m=clean(href).match(/--([a-f0-9]{10,})(?:\/|\?|#|$)/i);return m?m[1].toLowerCase():'';};
  const currentSuffix=()=>suffixFromHref(location.pathname)||(()=>{const m=document.body?.innerText?.match(/\bTP[A-Z]{2,5}-([A-F0-9]{10,})\b/i);return m?m[1].toLowerCase():'';})();
  let metaP, phoneP, productP;
  const meta=()=>metaP||(metaP=fetch(META_URL,{cache:'no-store'}).then(r=>r.ok?r.json():null).catch(()=>null));
  const phoneSet=()=>phoneP||(phoneP=fetch(PHONE_URL,{cache:'no-store'}).then(r=>r.ok?r.json():null).then(x=>new Set(x?.suffixes||[])).catch(()=>new Set()));
  const product=async()=>{
    if(productP) return productP;
    productP=(async()=>{
      for(let i=0;i<8;i++){
        const s=currentSuffix();
        if(s){
          const u=`/data/shopper-v20-6-8-4/products/${s.slice(0,2)}.json?v=${VERSION}`;
          try{const r=await fetch(u,{cache:'no-store'});if(r.ok){const j=await r.json();return j?.[s]||null;}}catch{}
          return null;
        }
        await sleep(120);
      }
      return null;
    })();
    return productP;
  };
  const broadPhone=()=>/^(?:phone|phones|smartphone|smartphones|mobile phone|mobile phones|cell phone|cell phones)$/i.test(clean(new URLSearchParams(location.search).get('q')));
  const nearestCard=node=>node?.closest?.('article,li,[class*="product-card"],[class*="result-card"],[class*="alternative"],[class*="card"]')||node?.parentElement?.parentElement||node?.parentElement;
  const hideNode=n=>{if(n&&!n.dataset.tp684Hidden){n.dataset.tp684Hidden='1';n.style.setProperty('display','none','important');}};

  async function filterPhoneFinder(){
    if(!broadPhone()) return;
    const allowed=await phoneSet();
    const links=[...document.querySelectorAll('a[href*="/product/"]')];
    for(const a of links){
      const card=nearestCard(a); if(!card) continue;
      const s=suffixFromHref(a.getAttribute('href'));
      const ok=s?allowed.has(s):isPhoneText(card.innerText);
      if(!ok) hideNode(card);
    }
    const m=await meta();
    if(m?.strictPhoneProducts){
      for(const el of document.querySelectorAll('body *')){
        if(el.children.length) continue;
        if(/\b\d[\d,]*\s+master products\b/i.test(clean(el.textContent))) el.textContent=`${Number(m.strictPhoneProducts).toLocaleString()} verified phone products`;
      }
    }
  }

  async function filterRelatedPhones(){
    const headings=[...document.querySelectorAll('h1,h2,h3')].filter(h=>/other phone choices|related.*phone/i.test(clean(h.textContent)));
    if(!headings.length) return;
    const allowed=await phoneSet();
    for(const h of headings){
      const section=h.closest('section,article,[class*="section"],[class*="card"]')||h.parentElement;
      if(!section) continue;
      for(const a of section.querySelectorAll('a[href*="/product/"]')){
        const card=nearestCard(a); if(!card) continue;
        const s=suffixFromHref(a.getAttribute('href'));
        const ok=s?allowed.has(s):isPhoneText(card.innerText);
        if(!ok) hideNode(card);
      }
    }
  }

  function factMarkup(p){
    const labels={screen:'Screen',storage:'Storage',ram:'RAM',battery:'Battery'};
    return Object.entries(p?.facts||{}).filter(([,v])=>clean(v)).slice(0,6).map(([k,v])=>`<span><b>${esc(labels[k]||k)}</b>${esc(v)}</span>`).join('');
  }
  async function injectExplainer(){
    const p=await product(); if(!p||document.querySelector('[data-tp-shopper-explainer="684"]')) return;
    const main=document.querySelector('main')||document.body;
    const config=[...main.querySelectorAll('h1,h2,h3')].find(h=>/available configurations|configurations|variants/i.test(clean(h.textContent)));
    const seller=[...main.querySelectorAll('h1,h2,h3')].find(h=>/seller offers|seller offer|compare seller/i.test(clean(h.textContent)));
    const anchor=(config?.closest('section,article,[class*="card"]')||seller?.closest('section,article,[class*="card"]')||main.firstElementChild);
    const sec=document.createElement('section');
    sec.className='tp-shopper-explainer-v20684';sec.dataset.tpShopperExplainer='684';
    sec.innerHTML=`<span class="tp684-kicker">ABOUT THIS PRODUCT</span><h2>What this product is</h2><p class="tp684-summary">${esc(p.summary)}</p><div class="tp684-facts">${factMarkup(p)}</div><p class="tp684-note"><strong>Before you buy:</strong> ${esc(p.buyerNote)}</p>`;
    if(anchor?.parentNode) anchor.parentNode.insertBefore(sec,anchor); else main.prepend(sec);
  }

  const normalizedSeller=s=>lower(s).replace(/[^a-z0-9]+/g,'');
  function addRouteNote(card,text,cls=''){
    if(!card||card.querySelector('[data-tp684-route-note]'))return;
    const p=document.createElement('p');p.dataset.tp684RouteNote='1';p.className=`tp684-route-note ${cls}`;p.textContent=text;card.appendChild(p);
  }
  async function repairSellerRoutes(){
    const p=await product(); if(!p?.sellerGroups?.length) return;
    const anchors=[...document.querySelectorAll('a[href]')].filter(a=>/visit|seller|offer|alibaba|tiktok|shop/i.test(clean(a.textContent)));
    for(const g of p.sellerGroups){
      const key=normalizedSeller(g.seller);
      const candidates=anchors.filter(a=>{
        const card=nearestCard(a);return normalizedSeller(card?.innerText||'').includes(key);
      });
      for(const a of candidates){
        const card=nearestCard(a); const primary=g.primary;
        if(g.availability==='unavailable'){
          a.removeAttribute('href');a.removeAttribute('target');a.setAttribute('aria-disabled','true');a.classList.add('tp684-unavailable');a.textContent=`No longer available on ${g.seller}`;
          a.addEventListener('click',e=>e.preventDefault());
          addRouteNote(card,'This listing is marked unavailable in the current source data. Choose another seller or configuration.','is-caution');
          continue;
        }
        if(!primary?.url) continue;
        a.href=primary.url; a.rel='sponsored nofollow noopener'; a.target='_blank';
        if(primary.kind==='exact-tracked'||primary.kind==='exact-direct'){
          if(/alibaba/i.test(g.seller)&&g.supplier) a.textContent='View exact supplier listing ↗';
          else if(/tiktok/i.test(g.seller)) a.textContent='Check availability on TikTok ↗';
          else a.textContent='Visit exact product ↗';
          if(/tiktok/i.test(g.seller)) addRouteNote(card,'TikTok stock can change quickly; availability is confirmed only on TikTok.','is-caution');
        }else{
          a.textContent=`Browse ${g.seller} ↗`;
          addRouteNote(card,'This partner link opens a broader marketplace/seller page, not the exact item shown here.','is-caution');
        }
      }
    }
    // Remove technical monetisation wording from the normal shopper surface.
    for(const el of document.querySelectorAll('p,small,span')){
      const t=clean(el.textContent);
      if(/Affiliate\/CPC-capable route|committed affiliate\/tracking destination|exact TPOID/i.test(t)){
        el.textContent='Open the seller to confirm current price, stock and delivery.';
      }
    }
  }

  async function repairBrandLabel(){
    const p=await product(); if(!p) return;
    const main=document.querySelector('main')||document.body;
    const h1=[...main.querySelectorAll('h1')].find(x=>clean(x.textContent).length>3);
    if(!h1) return;
    const area=h1.parentElement||main;
    const before=[...area.querySelectorAll('span,b,strong,p,a')].filter(el=>{
      if(el===h1||h1.contains(el))return false;
      const t=clean(el.textContent);
      return t && t.length<40 && !/back to results|product preview|seller|offer|configuration|variant/i.test(t);
    });
    for(const el of before){
      const t=clean(el.textContent);
      if(p.brand){
        if(/^(?:poco|apple|samsung|xiaomi|oneplus|google|motorola|oppo|vivo|realme|honor|huawei|nokia|sony|zte|nubia|infinix|tecno)$/i.test(t) && lower(t)!==lower(p.brand)) hideNode(el);
      }else if(/^(?:poco|apple|samsung|xiaomi|oneplus|google|motorola|oppo|vivo|realme|honor|huawei|nokia|sony|zte|nubia|infinix|tecno)$/i.test(t) && !lower(p.title).includes(lower(t))) hideNode(el);
    }
  }

  async function markNonPhoneProduct(){
    const p=await product(); if(!p||p.shopperType==='phone')return;
    const back=[...document.querySelectorAll('a')].find(a=>/back to results/i.test(clean(a.textContent)));
    if(back&&/phone/i.test(document.referrer||'')){
      const note=document.createElement('div');note.className='tp684-type-warning';note.textContent='This item is not a phone. TrendPilot has removed it from broad phone results.';back.insertAdjacentElement('afterend',note);
    }
  }

  async function run(){
    await Promise.allSettled([filterPhoneFinder(),filterRelatedPhones(),injectExplainer(),repairSellerRoutes(),repairBrandLabel(),markNonPhoneProduct()]);
  }
  let timer;
  const schedule=()=>{clearTimeout(timer);timer=setTimeout(run,80);};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
  const mo=new MutationObserver(schedule);mo.observe(document.documentElement,{subtree:true,childList:true});
  setTimeout(()=>mo.disconnect(),20000);
})();
