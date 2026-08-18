(()=>{
'use strict';
const VERSION='1.0.0',ENDPOINT='/data/tp-track.php';
const d=document,C=v=>String(v??'').replace(/\s+/g,' ').trim().slice(0,220);
const qp=new URLSearchParams(location.search);
const ATTR_KEYS=['post_id','creative_id','utm_source','utm_medium','utm_campaign','utm_content'];
function sid(){let s='';try{s=sessionStorage.getItem('tp_sid_v1')||''}catch{}if(!s){s=`s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`;try{sessionStorage.setItem('tp_sid_v1',s)}catch{}}return s}
function attribution(){const now={};let has=false;for(const k of ATTR_KEYS){const v=C(qp.get(k));if(v){now[k]=v;has=true}}if(has){try{sessionStorage.setItem('tp_attr_v1',JSON.stringify(now))}catch{}return now}try{return JSON.parse(sessionStorage.getItem('tp_attr_v1')||'{}')||{}}catch{return{}}}
const attr=attribution(),session=sid(),productId=C(qp.get('id')).toLowerCase();
function refHost(){try{return document.referrer?new URL(document.referrer).hostname:''}catch{return''}}
function send(event,detail={}){const payload={v:VERSION,event:C(event),ts:new Date().toISOString(),session,product_id:productId,path:location.pathname+location.search,referrer_host:refHost(),vw:Math.max(0,Math.round(innerWidth||0)),...attr,detail};const body=JSON.stringify(payload);try{if(navigator.sendBeacon&&navigator.sendBeacon(ENDPOINT,new Blob([body],{type:'application/json'})))return}catch{}try{fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body,keepalive:true,credentials:'same-origin'}).catch(()=>{})}catch{}}
window.tpTrack=send;
let viewed=false,confidenceObserved=false;
function itemReady(){const el=d.querySelector('[data-tp85-detail]');if(!el||el.hasAttribute('hidden'))return false;if(!viewed){viewed=true;send('item_view',{seller:C(d.querySelector('[data-tp85-fact-seller]')?.textContent),title:C(d.querySelector('[data-tp85-title]')?.textContent)})}return true}
function observeConfidence(){if(confidenceObserved)return;const panel=d.querySelector('.tp-item-confidence');if(!panel)return;confidenceObserved=true;const io=new IntersectionObserver(es=>{for(const e of es){if(e.isIntersecting&&e.intersectionRatio>=.25){send('confidence_view',{score:C(panel.querySelector('.tp-ic-score strong')?.textContent),level:C(panel.querySelector('.tp-ic-top h2')?.textContent)});io.disconnect();break}}},{threshold:[.25]});io.observe(panel)}
let tries=0;const timer=setInterval(()=>{tries++;itemReady();observeConfidence();if((viewed&&confidenceObserved)||tries>80)clearInterval(timer)},180);
d.addEventListener('click',e=>{const a=e.target?.closest?.('a,button,summary');if(!a)return;const seller=C(d.querySelector('[data-tp85-fact-seller]')?.textContent);if(a.matches('[data-tp85-seller-link],[data-tp85-seller-fallback],.tp-conv-cta'))send('seller_outbound_click',{seller,cta:C(a.textContent),placement:a.classList.contains('tp-conv-cta')?'quick_verdict':'actions'});else if(a.matches('[data-tp85-compare]'))send('compare_click',{seller});else if(a.matches('[data-tp85-similar]'))send('similar_click',{seller});else if(a.matches('.tp-ic-sources summary'))send('review_sources_open',{seller})},true);
d.addEventListener('tp:quick-verdict-view',()=>send('quick_verdict_view',{seller:C(d.querySelector('[data-tp85-fact-seller]')?.textContent)}));
})();