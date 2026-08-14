(()=>{'use strict';
const clean=v=>String(v??'').trim();
const suffix=id=>{const m=clean(id).match(/^TP[A-Z]{2,8}-([A-Z0-9]{8,})$/i);return m?m[1].toLowerCase():''};
function idFrom(el){const card=el.closest('[data-v206621-card],[data-tpid],article');const direct=clean(card?.getAttribute('data-v206621-card')||card?.getAttribute('data-tpid'));if(direct)return direct;try{return clean(new URL(el.href,location.href).searchParams.get('tpid'))}catch{return''}}
function directUrl(id){const s=suffix(id);return s?`/product/item--${s}/`:''}
document.addEventListener('click',e=>{const a=e.target.closest('a[href*="tpid="],button[data-tpid-open]');if(!a)return;const url=directUrl(idFrom(a)||clean(a.dataset?.tpidOpen));if(!url)return;e.preventDefault();e.stopImmediatePropagation();location.assign(url)},true);
function repair(){document.querySelectorAll('a[href*="tpid="]').forEach(a=>{const url=directUrl(idFrom(a));if(url)a.href=url})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',repair,{once:true});else repair();
})();