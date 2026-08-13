(() => {
  "use strict";
  const BLOCK = /\b(game\s*controller|gamepad|joystick|game\s*handle|gaming\s*trigger|phone\s*cooler|cooling\s*fan|phone\s*holder|phone\s*stand|car\s*mount|phone\s*case|screen\s*protector|tempered\s*glass|charging\s*cable|usb\s*cable|wireless\s*charger|charger|adapter|dongle|replacement\s*(?:lcd|screen|display|battery|part)|lcd\s*display|touch\s*screen|motherboard|flex\s*cable|earbuds?|earphones?|headphones?|headset|speaker|smartwatch|power\s*bank|tripod|ring\s*light|camera\s*lens|stylus|keyboard)\b/i;
  function isPhoneQuery(){
    const q=(new URL(location.href)).searchParams.get("q")||"";
    return /^\s*(phone|phones|smartphone|smartphones)\s*$/i.test(q);
  }
  function productCard(link){
    const selectors=["article","li","[data-product-card]",".product-card",".result-card",".finder-card",".tp-card",".master-product-card"];
    for (const s of selectors){ const c=link.closest(s); if (c) return c; }
    let el=link.parentElement;
    for (let i=0;el && i<5 && el!==document.body;i++,el=el.parentElement){
      const links=el.querySelectorAll('a[href*="/product/"]');
      if (links.length===1 && el.textContent.trim().length<1800) return el;
    }
    return null;
  }
  function prune(){
    if (!isPhoneQuery()) return;
    const links=[...document.querySelectorAll('a[href*="/product/"]')];
    for (const link of links){
      const card=productCard(link); if (!card || card.dataset.tpPhoneChecked==="1") continue;
      card.dataset.tpPhoneChecked="1";
      const txt=(card.textContent||"").replace(/\s+/g," ").trim();
      if (BLOCK.test(txt)) card.remove();
      else {
        const title=card.querySelector("h2,h3,h4,.title,[class*='title']");
        if (title){ title.style.display="-webkit-box"; title.style.webkitLineClamp="3"; title.style.webkitBoxOrient="vertical"; title.style.overflow="hidden"; }
      }
    }
  }
  const obs=new MutationObserver(()=>queueMicrotask(prune));
  obs.observe(document.documentElement,{subtree:true,childList:true});
  document.addEventListener("DOMContentLoaded",prune,{once:true});
  setTimeout(prune,250); setTimeout(prune,900); setTimeout(prune,2000);
})();