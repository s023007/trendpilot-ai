(() => {
  "use strict";
  const KEY="tp-v209-compare";
  function items(){try{const x=JSON.parse(localStorage.getItem(KEY)||"[]");return Array.isArray(x)?x.slice(0,3):[]}catch{return[]}}
  function draw(){const n=items().length;document.querySelectorAll('[data-compare-count]').forEach(el=>{el.textContent=String(n);el.toggleAttribute('hidden',!n)})}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",draw,{once:true});else draw();
  addEventListener("storage",e=>{if(e.key===KEY)draw()});
})();
