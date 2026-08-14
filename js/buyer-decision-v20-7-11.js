(() => {
  "use strict";
  const V="20.7.11",d=document,$=(s,r=d)=>r.querySelector(s),$$=(s,r=d)=>[...r.querySelectorAll(s)];
  const clean=v=>String(v??"").replace(/\s+/g," ").trim();
  const num=v=>{const n=Number(v);return Number.isFinite(n)?n:0};
  const query=clean(new URLSearchParams(location.search).get("q")).toLowerCase();
  const type=(()=>{if(/(?:phone|iphone|galaxy|pixel|xiaomi|redmi|oneplus|poco)/.test(query))return"phone";if(/(?:laptop|thinkpad|ideapad|chromebook|macbook|notebook)/.test(query))return"laptop";if(/(?:perfume|fragrance|cologne|parfum)/.test(query))return"perfume";if(/(?:headphone|earbud|headset|audio)/.test(query))return"headphones";if(/(?:power ?bank|portable charger)/.test(query))return"power_bank";return"default"})();
  const cfg={
    phone:{max:1500,step:25,presets:[[0,150,"Under $150"],[150,300,"$150–300"],[300,600,"$300–600"],[600,1500,"$600+"]]},
    laptop:{max:3000,step:50,presets:[[0,500,"Under $500"],[500,1000,"$500–1,000"],[1000,1500,"$1,000–1,500"],[1500,3000,"$1,500+"]]},
    perfume:{max:500,step:10,presets:[[0,50,"Under $50"],[50,100,"$50–100"],[100,200,"$100–200"],[200,500,"$200+"]]},
    headphones:{max:600,step:10,presets:[[0,50,"Under $50"],[50,150,"$50–150"],[150,300,"$150–300"],[300,600,"$300+"]]},
    power_bank:{max:250,step:5,presets:[[0,25,"Under $25"],[25,50,"$25–50"],[50,100,"$50–100"],[100,250,"$100+"]]},
    default:{max:1000,step:10,presets:[[0,50,"Under $50"],[50,150,"$50–150"],[150,300,"$150–300"],[300,1000,"$300+"]]}
  }[type];
  let min=0,max=0,verifiedOnly=false,applying=false;

  function priceOf(card){const t=clean($(".tp78-price",card)?.textContent),m=t.match(/(?:US\$|\$)\s*([0-9][0-9,]*(?:\.\d+)?)/i);return m?num(m[1].replace(/,/g,"")):0}
  function sellerCount(card){const m=clean($(".tp78-meta",card)?.textContent).match(/(\d+)\s+sellers?/i);return m?num(m[1]):1}
  function variantCount(card){const m=clean($(".tp78-meta",card)?.textContent).match(/(\d+)\s+variants?/i);return m?num(m[1]):1}
  function ensureUI(){
    const host=$("[data-budget-tools]");if(!host||host.dataset.ready==="1")return;host.dataset.ready="1";
    host.innerHTML=`<div class="tp-budget-title"><strong>Your budget</strong><button type="button" data-budget-clear>Clear</button></div>
      <div class="tp-budget-numbers"><label>Min $<input data-budget-min type="number" min="0" max="${cfg.max}" step="${cfg.step}" placeholder="0"></label><span>to</span><label>Max $<input data-budget-max type="number" min="0" max="${cfg.max}" step="${cfg.step}" placeholder="${cfg.max}"></label></div>
      <div class="tp-budget-sliders"><input data-budget-range-min type="range" min="0" max="${cfg.max}" step="${cfg.step}" value="0" aria-label="Minimum price"><input data-budget-range-max type="range" min="0" max="${cfg.max}" step="${cfg.step}" value="${cfg.max}" aria-label="Maximum price"></div>
      <div class="tp-budget-presets">${cfg.presets.map(([a,b,l])=>`<button type="button" data-budget-preset="${a}-${b}">${l}</button>`).join("")}</div>
      <label class="tp-verified-only"><input data-verified-only type="checkbox"><span><strong>Verified prices only</strong><small>Hide products without an exact current price.</small></span></label>
      <div class="tp-budget-status" data-budget-status>Products without a verified price stay visible until you set a budget or choose verified prices only.</div>`;
  }
  function sync(source){
    const nmin=$("[data-budget-min]"),nmax=$("[data-budget-max]"),rmin=$("[data-budget-range-min]"),rmax=$("[data-budget-range-max]");if(!nmin||!nmax||!rmin||!rmax)return;
    if(source==="rmin"||source==="rmax"){let a=num(rmin.value),b=num(rmax.value);if(a>b){if(source==="rmin")b=a;else a=b}rmin.value=a;rmax.value=b;nmin.value=a||"";nmax.value=b===cfg.max?"":b;min=a;max=b===cfg.max?0:b}
    else{let a=Math.max(0,num(nmin.value)),b=Math.max(0,num(nmax.value));if(b&&a>b)b=a;a=Math.min(a,cfg.max);b=b?Math.min(b,cfg.max):cfg.max;rmin.value=a;rmax.value=b;min=a;max=b===cfg.max?0:b}
    $$("[data-budget-preset]").forEach(x=>x.classList.remove("active"));apply();
  }
  function decorate(card){const p=priceOf(card),pe=$(".tp78-price",card);if(!pe)return;let badge=$(".tp-price-confidence",card);if(!badge){badge=d.createElement("span");badge.className="tp-price-confidence";pe.insertAdjacentElement("afterend",badge)}if(p>0){badge.className="tp-price-confidence verified";badge.textContent="✓ Verified price"}else{badge.className="tp-price-confidence check";badge.textContent="Price checked at seller"}}
  function bestValue(cards){
    const vals=cards.map(priceOf).filter(Boolean),lo=vals.length?Math.min(...vals):0,hi=vals.length?Math.max(...vals):0,value=p=>p&&hi>lo?1-(p-lo)/(hi-lo):p?0.6:0;
    return cards.sort((a,b)=>{const pa=priceOf(a),pb=priceOf(b),qa=(pa?60:0)+value(pa)*25+Math.min(sellerCount(a),3)*5+Math.min(variantCount(a),4)*2,qb=(pb?60:0)+value(pb)*25+Math.min(sellerCount(b),3)*5+Math.min(variantCount(b),4)*2;return qb-qa});
  }
  function apply(){
    if(applying)return;applying=true;const grid=$("[data-v2078-product-grid]");if(!grid){applying=false;return}
    const cards=$$(".tp78-card",grid);let shown=0,verified=0,unknown=0;
    cards.forEach((c,i)=>{if(!c.dataset.buyerOrder)c.dataset.buyerOrder=String(i+1);decorate(c);const p=priceOf(c);p?verified++:unknown++;const budget=min>0||max>0,okBudget=!budget||(p>0&&p>=min&&(!max||p<=max)),okVerified=!verifiedOnly||p>0;c.hidden=!(okBudget&&okVerified);if(!c.hidden)shown++});
    const sort=$("[data-filter-sort]")?.value||"smart",visible=cards.filter(c=>!c.hidden);
    if(sort==="best-value")bestValue(visible).forEach(c=>grid.appendChild(c));else cards.slice().sort((a,b)=>num(a.dataset.buyerOrder)-num(b.dataset.buyerOrder)).forEach(c=>grid.appendChild(c));
    const s=$("[data-budget-status]");if(s)s.textContent=[`${shown} shown`,`${verified} with verified price`,unknown?`${unknown} check-at-seller`:""].filter(Boolean).join(" · ");
    const count=$("[data-v2078-results-count]");if(count&&cards.length)count.textContent=`${shown} matching`;applying=false;
  }
  function events(){
    d.addEventListener("input",e=>{if(e.target.matches("[data-budget-range-min]"))sync("rmin");else if(e.target.matches("[data-budget-range-max]"))sync("rmax");else if(e.target.matches("[data-budget-min],[data-budget-max]"))sync("numbers")});
    d.addEventListener("change",e=>{if(e.target.matches("[data-verified-only]")){verifiedOnly=e.target.checked;apply()}else if(e.target.matches("[data-filter-sort]"))setTimeout(apply,30)});
    d.addEventListener("click",e=>{const p=e.target.closest("[data-budget-preset]");if(p){const [a,b]=p.dataset.budgetPreset.split("-").map(num);min=a;max=b>=cfg.max?0:b;$("[data-budget-min]").value=a||"";$("[data-budget-max]").value=max||"";$("[data-budget-range-min]").value=a;$("[data-budget-range-max]").value=b;$$("[data-budget-preset]").forEach(x=>x.classList.toggle("active",x===p));apply();return}if(e.target.closest("[data-budget-clear]")){min=max=0;verifiedOnly=false;$("[data-budget-min]").value="";$("[data-budget-max]").value="";$("[data-budget-range-min]").value=0;$("[data-budget-range-max]").value=cfg.max;$("[data-verified-only]").checked=false;$$("[data-budget-preset]").forEach(x=>x.classList.remove("active"));apply()}});
  }
  function boot(){ensureUI();events();const grid=$("[data-v2078-product-grid]");if(grid){let timer=0;new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(apply,70)}).observe(grid,{childList:true});setTimeout(apply,160);setTimeout(apply,700)}}
  d.readyState==="loading"?d.addEventListener("DOMContentLoaded",boot,{once:true}):boot();
  window.__TP_V20711_BUYER_DECISION__={version:V};
})();
