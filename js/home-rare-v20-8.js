(() => {
  const host=document.querySelector('[data-v20-8-home-rare]');if(!host)return;
  const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  fetch('/data/v20-8/rare-index.json?v=20.8.0',{cache:'force-cache'}).then(r=>r.json()).then(rows=>{host.innerHTML=rows.slice(0,6).map(r=>`<a class="tp80-home-rare-card" href="${E(r.seoUrl||r.url)}"><img src="${E(r.image)}" alt="${E(r.title)}" width="320" height="320" loading="lazy"><span>Rare ${r.rareScore}</span><b>${E(r.title)}</b><small>${E(r.typeLabel)} · ${E(r.seller)}</small></a>`).join('')}).catch(()=>{host.innerHTML='<a href="/rare-used/">Explore Rare Finds</a>'});
})();