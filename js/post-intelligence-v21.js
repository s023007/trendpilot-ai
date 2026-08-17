(()=>{
'use strict';
const VERSION='21.1.0';
const ATTR_KEY='tp_attribution_v1';
const SESSION_KEY='tp_session_v1';
const DAY_MS=86400000;
const ATTR_TTL=30*DAY_MS;
let reviewEvidenceState=null;

const clean=(v,max=220)=>String(v??'').replace(/\s+/g,' ').trim().slice(0,max);
const safeJsonParse=v=>{try{return JSON.parse(v)}catch{return null}};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
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
function normalizeModel(v){
  return clean(v,260).toLowerCase().replace(/[®™]/g,'').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
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
  claritySet('tp_review_confidence',reviewEvidenceState?.review_confidence||'');
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
    review_confidence:reviewEvidenceState?.review_confidence||'',
    review_sources:Array.isArray(reviewEvidenceState?.sources)?reviewEvidenceState.sources.length:0,
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
  const level=score>=75?'High':score>=55?'Moderate':'Limited';
  const routeType=verified?'verified_exact_price':exact?'exact_product_route':'marketplace_search';
  return {score,level,routeType,cards:cards.length,verified,exact,generic};
}

async function loadReviewEvidence(){
  if(!/^\/product\//i.test(location.pathname))return null;
  try{
    const res=await fetch('/data/review-evidence-v21.json?v=21.1.0',{cache:'no-cache',credentials:'same-origin'});
    if(!res.ok)return null;
    const data=await res.json();
    const title=normalizeModel(productTitle());
    const entries=Array.isArray(data?.entries)?data.entries:[];
    for(const entry of entries){
      const aliases=[entry?.model,...(entry?.aliases||[])].filter(Boolean).map(normalizeModel);
      if(aliases.some(a=>a&&title.includes(a)))return entry;
    }
  }catch{}
  return null;
}
function ratingText(s){
  if(!Number.isFinite(Number(s?.rating))||!Number.isFinite(Number(s?.scale)))return '';
  return `${Number(s.rating).toFixed(Number(s.rating)%1?1:0)}/${Number(s.scale)}`;
}
function reviewSourceLine(s){
  const rating=ratingText(s);
  const count=Number(s?.review_count||0);
  const bits=[];
  if(rating)bits.push(rating);
  if(count)bits.push(`${count} review${count===1?'':'s'}`);
  if(s?.type==='professional_review')bits.push('professional hands-on test');
  if(s?.relationship==='same_model_variant_differs')bits.push('same model · variant differs');
  else if(s?.relationship==='same_listing')bits.push('same listing');
  else if(s?.relationship==='same_model')bits.push('same model');
  return bits.join(' · ');
}
function sourcesHtml(entry){
  const src=Array.isArray(entry?.sources)?entry.sources:[];
  if(!src.length)return '';
  return `<details class="tp-review-sources"><summary>See ${src.length} review source${src.length===1?'':'s'}</summary><div class="tp-review-source-list">${src.map(s=>`<a class="tp-review-source" href="${esc(s.url||'#')}" target="_blank" rel="nofollow noopener" data-review-source="${esc(s.name||'Source')}"><span><strong>${esc(s.name||'Source')}</strong><small>${esc(reviewSourceLine(s)||s.note||'Exact-model evidence')}</small></span><b>View ↗</b></a>`).join('')}</div></details>`;
}
function injectTrustPanel(entry){
  if(!/^\/product\//i.test(location.pathname)||document.querySelector('.tp-trust-panel'))return;
  const f=trustFacts();
  if(!f)return;
  const reviewConfidence=entry?.review_confidence||'Pending';
  const sources=Array.isArray(entry?.sources)?entry.sources:[];
  const retailerSources=sources.filter(s=>/retailer_customer_reviews/i.test(s.type||''));
  const exactListingReviews=retailerSources.find(s=>s.relationship==='same_listing'&&Number(s.review_count)>0);
  const reviewHeadline=exactListingReviews
    ? `${ratingText(exactListingReviews)} from ${exactListingReviews.review_count} ${exactListingReviews.name} reviews`
    : entry?`${sources.length} exact-model evidence source${sources.length===1?'':'s'}`:'Exact-model verification pending';
  const strengths=Array.isArray(entry?.strengths)?entry.strengths.slice(0,3):[];
  const cautions=Array.isArray(entry?.cautions)?entry.cautions.slice(0,3):[];
  const panel=document.createElement('section');
  panel.className='panel tp-trust-panel';
  panel.dataset.tpTrustScore=String(f.score);
  panel.dataset.tpTrustLevel=f.level;
  panel.dataset.tpReviewConfidence=reviewConfidence;
  panel.innerHTML=`
    <div class="tp-confidence-top">
      <div><div class="eyebrow">BUYING CONFIDENCE</div><h2>${esc(f.level)} confidence</h2><p class="tp-confidence-note">Can we trust the product identity, seller route and displayed price?</p></div>
      <div class="tp-trust-score"><strong>${f.score}</strong><span>/100</span></div>
    </div>
    <div class="tp-checks">
      <div class="${f.exact||f.verified?'ok':'wait'}"><span>${f.exact||f.verified?'✓':'!'}</span><b>Product route</b><small>${f.exact||f.verified?'Exact product destination found':'Marketplace route only'}</small></div>
      <div class="${f.verified?'ok':'wait'}"><span>${f.verified?'✓':'!'}</span><b>Price evidence</b><small>${f.verified?'Price tied to an exact listing':'Confirm current price at seller'}</small></div>
      <div class="${entry?'ok':'wait'}"><span>${entry?'✓':'…'}</span><b>Review evidence</b><small>${entry?`${reviewConfidence} confidence · ${sources.length} source${sources.length===1?'':'s'}`:'Exact-model research pending'}</small></div>
    </div>
    <div class="tp-review-block">
      <div class="tp-review-head"><div><span>REVIEW CONFIDENCE</span><strong>${esc(reviewConfidence)}</strong></div><p>${esc(reviewHeadline)}</p></div>
      ${entry?`<p class="tp-buyer-summary">${esc(entry.buyer_summary||'')}</p>`:`<p class="tp-buyer-summary">TrendPilot will not show a customer-review claim until it is tied to this exact model.</p>`}
      ${strengths.length?`<div class="tp-evidence-columns"><div><h3>What buyers/tests like</h3>${strengths.map(x=>`<p>✓ ${esc(x)}</p>`).join('')}</div><div><h3>Watch-outs</h3>${cautions.map(x=>`<p>• ${esc(x)}</p>`).join('')}</div></div>`:''}
      ${sourcesHtml(entry)}
      <p class="tp-review-policy"><strong>TrendPilot review policy:</strong> ratings are never merged across different products. Same-model evidence with a different configuration is labelled separately.</p>
    </div>`;

  const about=document.querySelector('.about');
  const decision=document.querySelector('.decision');
  const hero=document.querySelector('.hero');
  if(about?.parentNode)about.insertAdjacentElement('afterend',panel);
  else if(decision?.parentNode)decision.parentNode.insertBefore(panel,decision);
  else if(hero?.parentNode)hero.insertAdjacentElement('afterend',panel);
  else document.querySelector('main')?.prepend(panel);

  const style=document.createElement('style');
  style.textContent=`
  .tp-trust-panel{margin:12px 0 16px!important;padding:18px!important;border:1px solid #dfe6ef!important;border-radius:20px!important;background:#fff!important}
  .tp-confidence-top{display:flex;align-items:flex-start;justify-content:space-between;gap:14px}.tp-confidence-top h2{margin:3px 0 4px;font-size:24px;line-height:1.08}.tp-confidence-note{margin:0;color:#667085;font-size:12px;line-height:1.4}.tp-trust-score{min-width:74px;text-align:center;border-radius:16px;padding:9px 10px;background:#eaf7f1;color:#08765a}.tp-trust-score strong{font-size:27px;line-height:1}.tp-trust-score span{font-size:11px;font-weight:800}
  .tp-checks{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:13px}.tp-checks>div{position:relative;padding:11px 10px 10px 38px;border-radius:14px;background:#f7f9fc;min-height:76px}.tp-checks>div>span{position:absolute;left:11px;top:11px;width:20px;height:20px;border-radius:999px;display:grid;place-items:center;font-weight:900;font-size:12px}.tp-checks .ok>span{background:#dcfce7;color:#08765a}.tp-checks .wait>span{background:#fff4d6;color:#9a6700}.tp-checks b{display:block;font-size:13px;color:#172033}.tp-checks small{display:block;margin-top:3px;font-size:11px;line-height:1.35;color:#667085}
  .tp-review-block{margin-top:13px;padding-top:13px;border-top:1px solid #e6eaf0}.tp-review-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.tp-review-head span{display:block;color:#667085;font-size:10px;font-weight:900;letter-spacing:.07em}.tp-review-head strong{display:block;margin-top:2px;font-size:20px;color:#3157e8}.tp-review-head p{margin:0;text-align:right;font-size:13px;font-weight:800;color:#172033;max-width:55%}.tp-buyer-summary{margin:10px 0 0;color:#475467;font-size:13px;line-height:1.5}.tp-evidence-columns{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:10px}.tp-evidence-columns>div{padding:11px;border-radius:14px;background:#f8fafc}.tp-evidence-columns h3{margin:0 0 5px;font-size:12px;color:#172033}.tp-evidence-columns p{margin:4px 0;color:#475467;font-size:11.5px;line-height:1.4}.tp-review-sources{margin-top:10px}.tp-review-sources>summary{font-size:12px;color:#3157e8;font-weight:900;cursor:pointer}.tp-review-source-list{display:grid;gap:6px;margin-top:8px}.tp-review-source{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:9px 10px;border:1px solid #e5e9f0;border-radius:12px;text-decoration:none;color:#172033;background:#fff}.tp-review-source span{min-width:0}.tp-review-source strong{display:block;font-size:12px}.tp-review-source small{display:block;margin-top:2px;color:#667085;font-size:10.5px;line-height:1.3}.tp-review-source b{font-size:11px;color:#3157e8;white-space:nowrap}.tp-review-policy{margin:9px 0 0;font-size:10.5px;line-height:1.4;color:#667085}
  @media(max-width:650px){.tp-trust-panel{padding:14px!important}.tp-confidence-top h2{font-size:21px}.tp-trust-score{min-width:64px}.tp-trust-score strong{font-size:23px}.tp-checks{grid-template-columns:1fr}.tp-checks>div{min-height:60px}.tp-review-head{display:block}.tp-review-head p{max-width:none;text-align:left;margin-top:5px}.tp-evidence-columns{grid-template-columns:1fr}.hero h1{font-size:clamp(23px,6vw,28px)!important;line-height:1.06!important}}
  `;
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
  const reviewLink=e.target.closest?.('a.tp-review-source');
  if(reviewLink){
    send('review_source_click',{review_source:clean(reviewLink.dataset.reviewSource||'',100)});
    clarityEvent('review_source_click');
    return;
  }
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

async function start(){
  if(/^\/product\//i.test(location.pathname))reviewEvidenceState=await loadReviewEvidence();
  injectTrustPanel(reviewEvidenceState);
  applyClarity();
  const f=trustFacts();
  send('page_view',f?{trust_level:f.level,trust_score:f.score,route_type:f.routeType}:{});
  if(/^\/product\//i.test(location.pathname)){
    send('product_view',f?{trust_level:f.level,trust_score:f.score,route_type:f.routeType}:{});
    clarityEvent('product_view');
  }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{start().catch(()=>{})},{once:true});else start().catch(()=>{});

window.TrendPilotPostIntelligence={version:VERSION,attribution,sessionId:sid,track:send};
})();
