(()=>{
'use strict';
const VERSION='21.2.0';
const clean=(v,max=260)=>String(v??'').replace(/\s+/g,' ').trim().slice(0,max);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=v=>clean(v).toLowerCase().replace(/[®™]/g,'').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
if(!/^\/product\//i.test(location.pathname))return;

function facts(){
  const cards=[...document.querySelectorAll('#seller-offers .seller-card,.seller-card')];
  if(!cards.length)return null;
  const confidence=cards.map(c=>clean(c.querySelector('.confidence')?.textContent||c.textContent,180));
  const exact=confidence.filter(v=>/(verified exact price|exact product|exact seller listing|exact listing)/i.test(v)&&!/not confirmed/i.test(v)).length;
  const verified=confidence.filter(v=>/(verified exact price|price tied|exact-product price|price for this listing)/i.test(v)).length;
  const generic=confidence.filter(v=>/(marketplace search|broader marketplace|not confirmed)/i.test(v)).length;
  let score=30;
  if(exact)score+=30;
  if(verified)score+=20;
  if(cards.length>=2)score+=10;
  if(document.querySelector('.about-copy'))score+=5;
  if(document.querySelector('.hero-media img'))score+=5;
  if(generic===cards.length)score=Math.min(score,48);
  score=Math.max(0,Math.min(90,score));
  return {score,level:score>=75?'High':score>=55?'Moderate':'Limited',cards:cards.length,exact,verified,generic};
}

async function reviewEvidence(){
  try{
    const r=await fetch('/data/review-evidence-v21.json?v=21.2.0',{cache:'no-store'});
    if(!r.ok)return null;
    const j=await r.json();
    const title=norm(document.querySelector('main h1,h1')?.textContent||'');
    for(const e of (Array.isArray(j?.entries)?j.entries:[])){
      const aliases=[e.model,...(e.aliases||[])].filter(Boolean).map(norm);
      if(aliases.some(a=>a&&title.includes(a)))return e;
    }
  }catch{}
  return null;
}

function ratingText(s){
  const rating=Number(s?.rating),scale=Number(s?.scale);
  if(!Number.isFinite(rating)||!Number.isFinite(scale))return '';
  return `${rating%1?rating.toFixed(1):rating}/${scale}`;
}

function sourceLine(s){
  const bits=[];
  const r=ratingText(s);
  if(r)bits.push(r);
  if(Number(s?.review_count)>0)bits.push(`${Number(s.review_count)} reviews`);
  if(s?.type==='professional_review')bits.push('professional test');
  if(s?.relationship==='same_listing')bits.push('same listing');
  else if(s?.relationship==='same_model_variant_differs')bits.push('same model · different configuration');
  else if(s?.relationship==='same_model')bits.push('same model');
  return bits.join(' · ');
}

function styles(){
  if(document.getElementById('tp-product-confidence-v21-2-style'))return;
  const s=document.createElement('style');
  s.id='tp-product-confidence-v21-2-style';
  s.textContent=`
  .tp-pc-panel{margin:12px 0 16px;padding:17px;border:1px solid #dfe6ef;border-radius:20px;background:#fff;color:#172033;box-shadow:0 8px 26px rgba(20,31,50,.05)}
  .tp-pc-top{display:flex;align-items:flex-start;justify-content:space-between;gap:14px}.tp-pc-kicker{font-size:10px;font-weight:900;letter-spacing:.09em;color:#667085}.tp-pc-top h2{margin:3px 0 4px;font-size:23px;line-height:1.08}.tp-pc-sub{margin:0;color:#667085;font-size:12px;line-height:1.45}.tp-pc-score{min-width:70px;padding:9px 10px;border-radius:15px;text-align:center;background:#eaf7f1;color:#08765a}.tp-pc-score strong{font-size:25px}.tp-pc-score span{font-size:11px;font-weight:800}
  .tp-pc-checks{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:12px}.tp-pc-check{padding:10px;border-radius:13px;background:#f7f9fc}.tp-pc-check b{display:block;font-size:12px}.tp-pc-check small{display:block;margin-top:3px;font-size:10.5px;line-height:1.35;color:#667085}.tp-pc-ok{color:#08765a}.tp-pc-wait{color:#9a6700}
  .tp-pc-review{margin-top:13px;padding-top:13px;border-top:1px solid #e6eaf0}.tp-pc-review-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.tp-pc-review-head span{font-size:10px;font-weight:900;letter-spacing:.08em;color:#667085}.tp-pc-review-head strong{display:block;margin-top:2px;font-size:19px;color:#3157e8}.tp-pc-review-head p{margin:0;max-width:58%;text-align:right;font-size:12px;font-weight:800}.tp-pc-summary{margin:9px 0 0;color:#475467;font-size:12.5px;line-height:1.5}.tp-pc-cols{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:9px}.tp-pc-cols>div{padding:10px;border-radius:13px;background:#f8fafc}.tp-pc-cols h3{margin:0 0 5px;font-size:11.5px}.tp-pc-cols p{margin:4px 0;font-size:11px;line-height:1.4;color:#475467}.tp-pc-sources{margin-top:9px}.tp-pc-sources summary{cursor:pointer;font-size:11.5px;font-weight:900;color:#3157e8}.tp-pc-source{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-top:6px;padding:8px 9px;border:1px solid #e5e9f0;border-radius:11px;color:#172033;text-decoration:none}.tp-pc-source strong{display:block;font-size:11.5px}.tp-pc-source small{display:block;margin-top:2px;font-size:10px;color:#667085}.tp-pc-source b{font-size:10.5px;color:#3157e8;white-space:nowrap}.tp-pc-policy{margin:9px 0 0;font-size:10px;line-height:1.4;color:#667085}
  @media(max-width:650px){.tp-pc-panel{padding:14px}.tp-pc-top h2{font-size:20px}.tp-pc-score{min-width:62px}.tp-pc-score strong{font-size:22px}.tp-pc-checks{grid-template-columns:1fr}.tp-pc-review-head{display:block}.tp-pc-review-head p{max-width:none;text-align:left;margin-top:5px}.tp-pc-cols{grid-template-columns:1fr}}
  `;
  document.head.appendChild(s);
}

function sourcesHtml(entry){
  const src=Array.isArray(entry?.sources)?entry.sources:[];
  if(!src.length)return '';
  return `<details class="tp-pc-sources"><summary>See ${src.length} review source${src.length===1?'':'s'}</summary>${src.map(s=>`<a class="tp-pc-source" href="${esc(s.url||'#')}" target="_blank" rel="nofollow noopener"><span><strong>${esc(s.name||'Source')}</strong><small>${esc(sourceLine(s)||s.note||'Review evidence')}</small></span><b>View ↗</b></a>`).join('')}</details>`;
}

async function render(){
  if(document.querySelector('.tp-pc-panel,.tp-trust-panel'))return true;
  const f=facts();
  const about=document.querySelector('.about');
  const hero=document.querySelector('.hero');
  if(!f||(!about&&!hero))return false;
  const entry=await reviewEvidence();
  const rc=entry?.review_confidence||'Pending';
  const src=Array.isArray(entry?.sources)?entry.sources:[];
  const exactReviews=src.find(s=>s.relationship==='same_listing'&&Number(s.review_count)>0);
  const headline=exactReviews?`${ratingText(exactReviews)} from ${exactReviews.review_count} ${exactReviews.name} reviews`:entry?`${src.length} exact-model evidence source${src.length===1?'':'s'}`:'Exact-model review research pending';
  styles();
  const panel=document.createElement('section');
  panel.className='tp-pc-panel';
  panel.dataset.version=VERSION;
  panel.innerHTML=`<div class="tp-pc-top"><div><div class="tp-pc-kicker">BUYING CONFIDENCE</div><h2>${esc(f.level)} confidence</h2><p class="tp-pc-sub">How confident TrendPilot is that the product identity, seller destination and displayed listing information are tied to the item shown.</p></div><div class="tp-pc-score"><strong>${f.score}</strong><span>/100</span></div></div>
  <div class="tp-pc-checks"><div class="tp-pc-check"><b class="${f.exact?'tp-pc-ok':'tp-pc-wait'}">${f.exact?'✓':'!'} Product route</b><small>${f.exact?'Exact product destination evidence found':'Confirm the exact item on the seller page'}</small></div><div class="tp-pc-check"><b class="${f.verified?'tp-pc-ok':'tp-pc-wait'}">${f.verified?'✓':'!'} Price evidence</b><small>${f.verified?'Price evidence is tied to an exact listing':'Recheck the final seller price before payment'}</small></div><div class="tp-pc-check"><b class="${entry?'tp-pc-ok':'tp-pc-wait'}">${entry?'✓':'…'} Review evidence</b><small>${entry?`${esc(rc)} confidence · ${src.length} source${src.length===1?'':'s'}`:'Exact-model evidence not yet verified'}</small></div></div>
  <div class="tp-pc-review"><div class="tp-pc-review-head"><div><span>REVIEW CONFIDENCE</span><strong>${esc(rc)}</strong></div><p>${esc(headline)}</p></div><p class="tp-pc-summary">${esc(entry?.buyer_summary||'TrendPilot will not claim customer satisfaction until the reviews are tied to this exact model.')}</p>${entry?`<div class="tp-pc-cols"><div><h3>What buyers/tests like</h3>${(entry.strengths||[]).slice(0,3).map(x=>`<p>✓ ${esc(x)}</p>`).join('')}</div><div><h3>Watch-outs</h3>${(entry.cautions||[]).slice(0,3).map(x=>`<p>• ${esc(x)}</p>`).join('')}</div></div>`:''}${sourcesHtml(entry)}<p class="tp-pc-policy"><strong>Review policy:</strong> TrendPilot does not merge ratings from different products. Same-model evidence from a different configuration is labelled separately.</p></div>`;
  if(about?.parentNode)about.insertAdjacentElement('afterend',panel);
  else if(hero?.parentNode)hero.insertAdjacentElement('afterend',panel);
  else document.querySelector('main')?.prepend(panel);
  document.documentElement.dataset.tpProductConfidence=VERSION;
  return true;
}

let stopped=false;
let timer=0;
const tryRender=()=>{clearTimeout(timer);timer=setTimeout(async()=>{if(stopped)return;const ok=await render();if(ok){stopped=true;observer.disconnect();}},60)};
const observer=new MutationObserver(tryRender);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',tryRender,{once:true});else tryRender();
observer.observe(document.documentElement,{subtree:true,childList:true});
setTimeout(()=>{if(!stopped)tryRender();setTimeout(()=>observer.disconnect(),1200)},10000);
})();
