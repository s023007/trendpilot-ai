(() => {
  "use strict";
  const p=new URLSearchParams(location.search);
  const q=String(p.get("q")||"").trim().toLowerCase();
  const family=/^(?:power\s*banks?|powerbanks?)$/.test(q)?"power_bank":/^(?:lighting|lights?|lamps?|bulbs?)$/.test(q)?"lighting":/^(?:phones?|smartphones?|mobile phones?|cell phones?)$/.test(q)?"phone":/^(?:laptops?|notebooks?)$/.test(q)?"laptop":/^(?:perfumes?|fragrances?|colognes?)$/.test(q)?"perfume":"";
  if(!family)return;

  const bad={
    phone:/\b(?:case|cover|screen protector|tempered glass|protective film|replacement screen|replacement battery|motherboard|charging port|flex cable|phone holder|phone mount|repair tool|opening tool|power ?bank case|cooling fan)\b/i,
    laptop:/\b(?:motherboard|mainboard|replacement battery|battery for|charger for|adapter for|keyboard for|screen for|lcd for|hinge|palmrest|bottom case|top case|cooling fan|heatsink|dc jack|docking station|laptop sleeve|laptop bag|laptop stand)\b/i,
    perfume:/\b(?:vending machine|dispensing machine|empty perfume bottle|empty bottle|refillable perfume bottle|perfume atomizer|filling machine|packaging machine|bottle cap|display stand|storage rack|bottle holder)\b/i,
    power_bank:/\b(?:jump\s*starter|jumpstart|car\s+jump|vehicle\s+jump|battery\s+booster|booster\s+pack|battery adapter|adapter converter|power ?bank case|housing|shell|pcb|circuit board|battery holder)\b/i,
    lighting:/\b(?:scooter|e-?bike|bicycle|motorcycle|automotive|vehicle|headlight|tail\s*light|taillight|turn signal|indicator|helmet|laryngoscope|otoscope|ophthalmoscope|endoscope|medical lamp|surgical lamp)\b/i
  };

  const grid=document.querySelector('[data-v2078-product-grid]');
  if(!grid)return;
  let queued=false;
  const clean=()=>{
    queued=false;
    const re=bad[family];
    if(!re)return;
    let removed=0;
    for(const card of [...grid.querySelectorAll('.tp78-card')]){
      const title=String(card.querySelector('h3')?.textContent||'').replace(/\s+/g,' ').trim();
      if(title&&re.test(title)){card.remove();removed++;}
    }
    if(removed){
      const count=document.querySelector('[data-v2078-results-count]');
      const n=grid.querySelectorAll('.tp78-card').length;
      if(count&&n)count.textContent=`${n} shown`;
      if(!n)grid.innerHTML='<div class="tp78-empty"><h3>No clean matches found.</h3><p>Try a more specific product name or model.</p></div>';
    }
  };
  const schedule=()=>{if(queued)return;queued=true;queueMicrotask(clean)};
  new MutationObserver(schedule).observe(grid,{childList:true});
  schedule();
  window.__TP_RESTORED_SEMANTIC_GUARD__={version:'20.9.4',family};
})();
