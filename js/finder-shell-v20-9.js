(() => {
  "use strict";
  const d=document;
  function boot(){
    const panel=d.querySelector('[data-tp-filter-panel]');
    const button=d.querySelector('[data-tp-filter-toggle]');
    if(panel&&button){
      button.addEventListener('click',()=>{
        const open=!panel.classList.contains('filter-open');
        panel.classList.toggle('filter-open',open);
        button.setAttribute('aria-expanded',String(open));
      });
    }
  }
  d.readyState==='loading'?d.addEventListener('DOMContentLoaded',boot,{once:true}):boot();
})();
