(()=>{
'use strict';
const VERSION='21.0.0';
const ATTR_KEY='tp_attribution_v1';
const SESSION_KEY='tp_session_v1';
const DAY_MS=86400000;
const ATTR_TTL=30*DAY_MS;

const clean=(v,max=220)=>String(v??'').replace(/\s+/g,' ').trim().slice(0,max);
const safeJsonParse=v=>{try{return JSON.parse(v)}catch{return null}};
const randomId=()=>{
  try{if(globalThis.crypto?.randomUUID)return crypto.randomUUID()}catch{}
  return 'tp-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,11);
};
const qs=new URLSearchParams(location.search);
const campaign={
  post_id:clean(qs.get('tp_post')||qs.get('post_id')||qs.get('utm_id'),120),
  angle_id:clean(qs.get('tp_angle')||qs.get('angle_id')||qs.get('utm_content'),100),
  utm_id:clean(qs.get('utm_id'),120),
  utm_source:clean(qs.get('utm_source'),80),
  utm_medium:clean(qs.get('utm_medium'),80),
  utm_campaign:clean(qs.get('utm_campaign'),120),
  utm_content:clean(qs.get('utm_content'),120),
  utm_term:clean(qs.get('utm_term'),120)
};
const hasCampaign=Object.values(campaign).some(Boolean);

function loadAttr(){
  const a=safeJsonParse(localStorage.getItem(ATTR_KEY)||'');
  if(!a||!a.saved_at||Date.now()-Number(a.saved_at)>ATTR_TTL)return null;
  return a;
}
function saveAttr(){
  const old=loadAttr();
  if(!hasCampaign)return old||{first:{},last:{}};
  const now=Date.now();
  const next={
    saved_at:now,
    first:old?.first&&Object.values(old.first).some(Boolean)?old.first:{...campaign,seen_at:now},
    last:{...campaign,seen_at:now}
  };
  try{localStorage.setItem(ATTR_KEY,JSON.stringify(next))}catch{}
  return next;
}
function sessionId(){
  try{
    let id=sessionStorage.getItem(SESSION_KEY);
    if(!id){id=randomId();sessionStorage.setItem(SESSION_KEY,id)}
    return id;
  }catch{return randomId()}
}
const attribution=saveAttr()||{first:{},last:{}};
const active=Object.values(attribution.last||{}).some(Boolean)?attribution.last:(attribution.first||{});
const sid=sessionId();

function referrerHost(){
  try{return document.referrer?new URL(document.referrer).hostname:''}catch{return ''}
}
function productRoute(){
  const m=location.pathname.match(/^\/product\/([^/]+)/i);
  return m?decodeURIComponent(m[1]):'';
}
function productTitle(){
  return clean(document.querySelector('main h1')?.textContent||document.querySelector('h1')?.textContent||'',220);
}
function claritySet(k,v){
  if(!v||typeof window.clarity!=='function')return;
  try{window.clarity('set',k,String(v).slice(0,255))}catch{}
}
function clarityEvent(name){
  if(typeof window.clarity!=='function')return;
  try{window.clarity('event',name)}catch{}
}
function applyClarity(){
  claritySet('tp_post',active.post_id);
  claritySet('tp_angle',active.angle_id);
  claritySet('utm_source',active.utm_source);
  claritySet('utm_campaign',active.utm_campaign);
  claritySet('tp_product',productRoute());
}
for(const delay of [0,800,2500])setTimeout(applyClarity,delay);

function basePayload(event,extra={}){
  return {
    event,
    session_id:sid,
    path:location.pathname,
    product_route:productRoute(),
    product_title:productTitle(),
    post_id:active.post_id||'',
    angle_id:active.angle_id||'',
    utm_id:active.utm_id||'',
    utm_source:active.utm_source||'',
    utm_medium:active.utm_medium||'',
    utm_campaign:active.utm_campaign||'',
    utm_content:active.utm_content||'',
    utm_term:active.utm_term||'',
    referrer_host:referrerHost(),
    viewport:`${window.innerWidth||0}x${window.innerHeight||0}`,
    ...extra
  };
}
function send(event,extra={}){
  const payload=JSON.stringify(basePayload(event,extra));
  try{
    if(navigator.sendBeacon){
      const ok=navigator.sendBeacon('/tp/track',new Blob([payload],{type:'application/json'}));
      if(ok)return;
    }
  }catch{}
  try{fetch('/tp/track',{method:'POST',headers:{'content-type':'application/json'},body:payload,keepalive:true,credentials:'same-origin'}).catch(()=>{})}catch{}
}

function trustFacts(){
  const cards=[...document.querySelectorAll('.seller-card')];
  if(!cards.length)return null;
  const confidence=cards.map(c=>clean(c.querySelector('.confidence')?.textContent||'',100));
  const verified=confidence.filter(v=>/verified exact price/i.test(v)).length;
  const exact=confidence.filter(v=>/exact product/i.test(v)&&!/not confirmed/i.test(v)).length;
  const generic=confidence.filter(v=>/marketplace search/i.test(v)).length;
  const hasAbout=!!document.querySelector('.about-copy');
  const hasSpecs=!!document.querySelector('.spec,.variant,.technical-panel');
  const hasImage=!!document.querySelector('.hero-media img');
  let score=15;
  if(verified)score+=35;else if(exact)score+=25;
  score+=cards.length>=2?15:5;
  if(exact>=2)score+=10;
  if(hasAbout)score+=10;
  if(hasSpecs)score+=5;
  if(hasImage)score+=5;
  if(generic===cards.length)score=Math.min(score,45);
  score=Math.max(0,Math.min(85,score));
  const level=score>=75?'High listing confidence':score>=55?'Moderate listing confidence':'Limited listing confidence';
  const routeType=verified?'verified_exact_price':exact?'exact_product_route':'marketplace_search';
  return {score,level,routeType,cards:cards.length,verified,exact,generic};
}
function injectTrustPanel(){
  if(!/^\/product\//i.test(location.pathname)||document.querySelector('.tp-trust-panel'))return;
  const f=trustFacts();
  if(!f)return;
  const panel=document.createElement('section');
  panel.className='panel tp-trust-panel';
  panel.dataset.tpTrustScore=String(f.score);
  panel.dataset.tpTrustLevel=f.level;
  panel.innerHTML=`<div class="eyebrow">TRUST & REVIEW EVIDENCE</div><div class="tp-trust-head"><div><h2>How strong is the buying evidence?</h2><p class="tp-trust-note">This score measures listing and route evidence, not customer satisfaction.</p></div><div class="tp-trust-score"><strong>${f.score}</strong><span>/100</span></div></div><div class="tp-trust-grid"><div><span>Listing confidence</span><strong>${f.level}</strong></div><div><span>Exact-route evidence</span><strong>${f.verified?`${f.verified} verified priced route${f.verified===1?'':'s'}`:f.exact?`${f.exact} exact product route${f.exact===1?'':'s'}`:'Not yet verified'}</strong></div><div><span>Independent reviews</span><strong>Exact-model verification pending</strong></div></div><p class="tp-review-warning"><strong>Review policy:</strong> TrendPilot will only show a customer-review claim when the evidence can be tied to this exact product or model. Similar products and accessories are not counted as proof.</p>`;
  const anchor=document.querySelector('#seller-offers')||document.querySelector('.technical-disclosure')||document.querySelector('.decision');
  if(anchor?.parentNode)anchor.parentNode.insertBefore(panel,anchor);
  else document.querySelector('main')?.appendChild(panel);
  const style=document.createElement('style');
  style.textContent=`.tp-trust-panel{margin:14px 0;padding:18px;border:1px solid #dfe6ef;border-radius:20px;background:#fff}.tp-trust-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px}.tp-trust-head h2{margin:3px 0 3px;font-size:22px;line-height:1.1}.tp-trust-note{margin:0;color:#667085;font-size:12px;line-height:1.4}.tp-trust-score{min-width:74px;text-align:center;border-radius:16px;padding:9px 10px;background:#eef4ff;color:#173a8a}.tp-trust-score strong{font-size:27px;line-height:1}.tp-trust-score span{font-size:11px;font-weight:800}.tp-trust-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:13px}.tp-trust-grid>div{padding:10px;border-radius:13px;background:#f7f9fc}.tp-trust-grid span{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#667085;font-weight:800}.tp-trust-grid strong{display:block;margin-top:4px;font-size:13px;line-height:1.3;color:#172033}.tp-review-warning{margin:11px 0 0;font-size:12px;line-height:1.45;color:#475467}@media(max-width:650px){.tp-trust-panel{padding:14px}.tp-trust-head h2{font-size:20px}.tp-trust-grid{grid-template-columns:1fr}.tp-trust-score{min-width:66px}.tp-trust-score strong{font-size:24px}}`;
  document.head.appendChild(style);
}

function sellerInfo(a){
  const card=a.closest('.seller-card');
  const seller=clean(card?.querySelector('h3')?.textContent||a.dataset.seller||'',100);
  const confidence=clean(card?.querySelector('.confidence')?.textContent||'',100);
  let host='';try{host=new URL(a.href,location.href).hostname}catch{}
  const routeType=/verified exact price/i.test(confidence)?'verified_exact_price':/exact product/i.test(confidence)?'exact_product_route':/marketplace search/i.test(confidence)?'marketplace_search':'';
  const f=trustFacts();
  return {seller,seller_host:host,route_type:routeType,trust_level:f?.level||'',trust_score:f?.score??null};
}

function onClick(e){
  const a=e.target.closest?.('a');
  const compare=e.target.closest?.('[data-compare],.compare-btn,.compare-button,button');
  if(a){
    let u;try{u=new URL(a.href,location.href)}catch{u=null}
    const rel=clean(a.getAttribute('rel')||'',80);
    const sponsored=/\bsponsored\b/i.test(rel);
    if(u&&u.origin===location.origin&&/^\/product\//i.test(u.pathname)){
      send('product_detail_click',{product_route:decodeURIComponent((u.pathname.match(/^\/product\/([^/]+)/i)||[])[1]||'')});
      clarityEvent('product_detail_click');
      return;
    }
    if(u&&u.origin!==location.origin&&(sponsored||a.matches('.cta,.suboffer'))){
      send('seller_click',sellerInfo(a));
      clarityEvent('seller_click');
      return;
    }
  }
  if(compare&&/compare/i.test(clean(compare.textContent,80))){
    send('compare_click');
    clarityEvent('compare_click');
  }
}

document.addEventListener('click',onClick,true);

function start(){
  injectTrustPanel();
  const f=trustFacts();
  send('page_view',f?{trust_level:f.level,trust_score:f.score,route_type:f.routeType}:{});
  if(/^\/product\//i.test(location.pathname)){
    send('product_view',f?{trust_level:f.level,trust_score:f.score,route_type:f.routeType}:{});
    clarityEvent('product_view');
  }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();

window.TrendPilotPostIntelligence={version:VERSION,attribution,sessionId:sid,track:send};
})();
