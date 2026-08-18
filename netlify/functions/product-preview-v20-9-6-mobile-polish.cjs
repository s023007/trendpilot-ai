const previous = require("./product-preview-v20-9-6.cjs");

let reviewData = { entries: [] };
try { reviewData = require("../../data/review-evidence-v21.json"); } catch {}

const CONFIDENCE_VERSION = "21.3.0";
const clean = v => String(v ?? "").replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim();
const esc = v => String(v ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const norm = v => clean(v).toLowerCase().replace(/[®™]/g,"").replace(/[^a-z0-9]+/g," ").replace(/\s+/g," ").trim();

function productTitle(body){
  return clean((String(body).match(/<main>[\s\S]*?<h1>([\s\S]*?)<\/h1>/i)||[])[1]||"");
}

function reviewEntryFor(body){
  const title = norm(productTitle(body));
  if(!title) return null;
  for(const entry of (Array.isArray(reviewData?.entries) ? reviewData.entries : [])){
    const aliases = [entry.model,...(entry.aliases||[])].filter(Boolean).map(norm);
    if(aliases.some(a=>a && title.includes(a))) return entry;
  }
  return null;
}

function ratingText(source){
  const rating=Number(source?.rating), scale=Number(source?.scale);
  if(!Number.isFinite(rating)||!Number.isFinite(scale)) return "";
  return `${rating%1?rating.toFixed(1):rating}/${scale}`;
}

function confidenceFacts(body){
  const text=clean(body);
  const cards=(String(body).match(/<article class="seller-card"/gi)||[]).length || (String(body).match(/class="seller-card"/gi)||[]).length;
  const exact=/(verified exact price|exact product · price at seller|active exact listing|direct product link|exact seller listing)/i.test(text);
  const price=/(verified exact price|exact-product price|price for this listing|displayed price is tied to the listed product)/i.test(text);
  const generic=/(marketplace search|broader marketplace|exact seller listing not confirmed)/i.test(text);
  let score=35;
  if(exact) score+=30;
  if(price) score+=20;
  if(cards>=2) score+=10;
  if(/about-copy/i.test(String(body))) score+=5;
  if(generic && !exact) score=Math.min(score,48);
  score=Math.max(0,Math.min(90,score));
  return {score,level:score>=75?"High":score>=55?"Moderate":"Limited",cards,exact,price,generic};
}

function sourceMeta(s){
  const bits=[];
  const r=ratingText(s); if(r) bits.push(r);
  if(Number(s?.review_count)>0) bits.push(`${Number(s.review_count)} reviews`);
  if(s?.type==="professional_review") bits.push("professional test");
  if(s?.relationship==="same_listing") bits.push("same listing");
  else if(s?.relationship==="same_model_variant_differs") bits.push("same model · different configuration");
  else if(s?.relationship==="same_model") bits.push("same model");
  return bits.join(" · ");
}

function confidencePanel(body){
  if(/class="[^"]*tp-pc-panel/i.test(String(body))) return "";
  const f=confidenceFacts(body);
  const entry=reviewEntryFor(body);
  const sources=Array.isArray(entry?.sources)?entry.sources:[];
  const sameListing=sources.find(s=>s.relationship==="same_listing" && Number(s.review_count)>0);
  const reviewConfidence=entry?.review_confidence||"Pending";
  const reviewHeadline=sameListing
    ? `${ratingText(sameListing)} from ${sameListing.review_count} ${sameListing.name} reviews`
    : entry ? `${sources.length} exact-model evidence source${sources.length===1?"":"s"}` : "Exact-model review research pending";
  const strengths=(entry?.strengths||[]).slice(0,3);
  const cautions=(entry?.cautions||[]).slice(0,3);
  const sourceHtml=sources.length?`<details class="tp-pc-sources"><summary>See ${sources.length} review source${sources.length===1?"":"s"}</summary>${sources.map(s=>`<a class="tp-pc-source" href="${esc(s.url||"#")}" target="_blank" rel="nofollow noopener"><span><strong>${esc(s.name||"Source")}</strong><small>${esc(sourceMeta(s)||s.note||"Review evidence")}</small></span><b>View ↗</b></a>`).join("")}</details>`:"";
  return `<section class="tp-pc-panel" data-version="${CONFIDENCE_VERSION}">
    <div class="tp-pc-top"><div><div class="tp-pc-kicker">BUYING CONFIDENCE</div><h2>${esc(f.level)} confidence</h2><p class="tp-pc-sub">How confident TrendPilot is that the product identity, seller destination and displayed listing information match the item shown.</p></div><div class="tp-pc-score"><strong>${f.score}</strong><span>/100</span></div></div>
    <div class="tp-pc-checks">
      <div class="tp-pc-check"><b class="${f.exact?"tp-pc-ok":"tp-pc-wait"}">${f.exact?"✓":"!"} Product route</b><small>${f.exact?"Exact product destination evidence found":"Confirm the exact item on the seller page"}</small></div>
      <div class="tp-pc-check"><b class="${f.price?"tp-pc-ok":"tp-pc-wait"}">${f.price?"✓":"!"} Price evidence</b><small>${f.price?"Displayed price is tied to this listing":"Recheck the final seller price before payment"}</small></div>
      <div class="tp-pc-check"><b class="${entry?"tp-pc-ok":"tp-pc-wait"}">${entry?"✓":"…"} Review evidence</b><small>${entry?`${esc(reviewConfidence)} confidence · ${sources.length} source${sources.length===1?"":"s"}`:"Exact-model evidence not yet verified"}</small></div>
    </div>
    <div class="tp-pc-review"><div class="tp-pc-review-head"><div><span>REVIEW CONFIDENCE</span><strong>${esc(reviewConfidence)}</strong></div><p>${esc(reviewHeadline)}</p></div><p class="tp-pc-summary">${esc(entry?.buyer_summary||"TrendPilot will not claim customer satisfaction until reviews are tied to this exact model.")}</p>${entry?`<div class="tp-pc-cols"><div><h3>What buyers/tests like</h3>${strengths.map(x=>`<p>✓ ${esc(x)}</p>`).join("")}</div><div><h3>Watch-outs</h3>${cautions.map(x=>`<p>• ${esc(x)}</p>`).join("")}</div></div>`:""}${sourceHtml}<p class="tp-pc-policy"><strong>Review policy:</strong> TrendPilot does not merge ratings from different products. Same-model evidence from a different configuration is labelled separately.</p></div>
  </section>`;
}

function injectConfidence(body){
  const panel=confidencePanel(body);
  if(!panel) return body;
  const about=/<section class="panel about">[\s\S]*?<\/section>/i;
  if(about.test(body)) return body.replace(about,m=>`${m}${panel}`);
  const hero=/<section class="hero">[\s\S]*?<\/section>/i;
  if(hero.test(body)) return body.replace(hero,m=>`${m}${panel}`);
  return body.replace(/<\/main>/i,`${panel}</main>`);
}

function polish(body){
  if(!body || !/<html/i.test(body)) return body;
  if(!/trendpilot-calm-dark-v21\.css/i.test(body)) body=body.replace(/<\/head>/i,'<link rel="stylesheet" href="/css/trendpilot-calm-dark-v21.css?v=21.0.0"></head>');
  if(!/trendpilot-graphite-navy-v21-1\.css/i.test(body)) body=body.replace(/<\/head>/i,'<link rel="stylesheet" href="/css/trendpilot-graphite-navy-v21-1.css?v=21.1.0"></head>');
  if(!/visitor-context-v21-17\.js/i.test(body)) body=body.replace(/<\/head>/i,'<script src="/js/visitor-context-v21-17.js?v=21.17.0"></script><script defer src="/js/tiktok-us-geo-v21-17.js?v=21.17.0"></script></head>');
  body=body.replace(/<meta name="theme-color" content="[^"]*">/i,'<meta name="theme-color" content="#121721">');

  const css = `
/* V20.9.6 mobile polish: presentation only; product/search/seller truth is unchanged. */
#seller-offers{padding:16px 14px!important;margin-top:14px!important}
#seller-offers>.eyebrow{font-size:12px!important;margin-bottom:3px!important}
#seller-offers>h2{font-size:24px!important;line-height:1.08!important;margin:3px 0 12px!important}
#seller-offers .seller-card{padding:11px 12px!important;border-radius:16px!important}
#seller-offers .seller-card h3{font-size:18px!important;line-height:1.15!important;margin-bottom:2px!important}
#seller-offers .seller-card .seller-top p{font-size:13px!important;line-height:1.3!important}
#seller-offers .seller-card .cta{margin-top:8px!important;padding:9px 12px!important}
#seller-offers .route-note{font-size:11px!important;line-height:1.35!important;margin-top:6px!important}
#seller-offers .catalogue-records{margin-top:8px!important;padding-top:7px!important}
.technical-disclosure{margin-top:10px!important}
.technical-disclosure .identity-inside{margin:8px 2px 0!important;padding-top:8px!important;border-top:1px solid #e8edeb!important}
.bottom{transition:transform .18s ease,opacity .18s ease!important;will-change:transform}
.bottom.tp-nav-hidden{transform:translateY(calc(100% + 14px))!important;opacity:0!important;pointer-events:none!important}
.tp-pc-panel{margin:12px 0 16px;padding:17px;border:1px solid #dfe6ef;border-radius:20px;background:#fff;color:#172033;box-shadow:0 8px 26px rgba(20,31,50,.05)}
.tp-pc-top{display:flex;align-items:flex-start;justify-content:space-between;gap:14px}.tp-pc-kicker{font-size:10px;font-weight:900;letter-spacing:.09em;color:#667085}.tp-pc-top h2{margin:3px 0 4px;font-size:23px;line-height:1.08}.tp-pc-sub{margin:0;color:#667085;font-size:12px;line-height:1.45}.tp-pc-score{min-width:70px;padding:9px 10px;border-radius:15px;text-align:center;background:#eaf7f1;color:#08765a}.tp-pc-score strong{font-size:25px}.tp-pc-score span{font-size:11px;font-weight:800}
.tp-pc-checks{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:12px}.tp-pc-check{padding:10px;border-radius:13px;background:#f7f9fc}.tp-pc-check b{display:block;font-size:12px}.tp-pc-check small{display:block;margin-top:3px;font-size:10.5px;line-height:1.35;color:#667085}.tp-pc-ok{color:#08765a}.tp-pc-wait{color:#9a6700}
.tp-pc-review{margin-top:13px;padding-top:13px;border-top:1px solid #e6eaf0}.tp-pc-review-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.tp-pc-review-head span{font-size:10px;font-weight:900;letter-spacing:.08em;color:#667085}.tp-pc-review-head strong{display:block;margin-top:2px;font-size:19px;color:#3157e8}.tp-pc-review-head p{margin:0;max-width:58%;text-align:right;font-size:12px;font-weight:800}.tp-pc-summary{margin:9px 0 0;color:#475467;font-size:12.5px;line-height:1.5}.tp-pc-cols{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:9px}.tp-pc-cols>div{padding:10px;border-radius:13px;background:#f8fafc}.tp-pc-cols h3{margin:0 0 5px;font-size:11.5px}.tp-pc-cols p{margin:4px 0;font-size:11px;line-height:1.4;color:#475467}.tp-pc-sources{margin-top:9px}.tp-pc-sources summary{cursor:pointer;font-size:11.5px;font-weight:900;color:#3157e8}.tp-pc-source{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-top:6px;padding:8px 9px;border:1px solid #e5e9f0;border-radius:11px;color:#172033;text-decoration:none}.tp-pc-source strong{display:block;font-size:11.5px}.tp-pc-source small{display:block;margin-top:2px;font-size:10px;color:#667085}.tp-pc-source b{font-size:10.5px;color:#3157e8;white-space:nowrap}.tp-pc-policy{margin:9px 0 0;font-size:10px;line-height:1.4;color:#667085}
@media(max-width:650px){
  main{padding-bottom:72px!important}
  .hero h1{font-size:clamp(21px,5.35vw,24px)!important;line-height:1.06!important}
  #seller-offers{padding:14px 12px!important}
  #seller-offers>h2{font-size:22px!important;margin-bottom:9px!important}
  #seller-offers .seller-card{padding:10px 11px!important}
  .bottom{left:22px!important;right:22px!important;bottom:4px!important;padding:2px 4px!important;border-radius:16px!important}
  .bottom a{min-height:34px!important;font-size:9.5px!important;padding:0 4px!important}
  .tp-pc-panel{padding:14px}.tp-pc-top h2{font-size:20px}.tp-pc-score{min-width:62px}.tp-pc-score strong{font-size:22px}.tp-pc-checks{grid-template-columns:1fr}.tp-pc-review-head{display:block}.tp-pc-review-head p{max-width:none;text-align:left;margin-top:5px}.tp-pc-cols{grid-template-columns:1fr}
}
`;

  const styleEnd = body.lastIndexOf("</style>");
  if(styleEnd >= 0) body = body.slice(0,styleEnd) + css + body.slice(styleEnd);

  const script = `<script>(()=>{const run=()=>{
    const clean=v=>String(v??'').replace(/\\s+/g,' ').trim();
    const seller=document.querySelector('#seller-offers');
    if(seller){
      const h=seller.querySelector('h2');
      if(h&&/^Seller option$/i.test(clean(h.textContent))) h.textContent='Where to buy';
    }
    const tech=document.querySelector('.technical-disclosure');
    const content=tech?.querySelector('.technical-disclosure-content');
    if(content){
      const identity=[...document.querySelectorAll('details')].find(d=>/Technical identity details/i.test(clean(d.querySelector('summary')?.textContent)));
      if(identity&&!identity.closest('.technical-disclosure')){
        identity.classList.add('identity-inside');
        content.appendChild(identity);
      }
    }
    const nav=document.querySelector('.bottom');
    if(nav){
      let last=window.scrollY;
      let ticking=false;
      const update=()=>{
        const y=window.scrollY;
        const nearBottom=(window.innerHeight+y)>=(document.documentElement.scrollHeight-90);
        if(y<90||nearBottom||y<last-8) nav.classList.remove('tp-nav-hidden');
        else if(y>last+8) nav.classList.add('tp-nav-hidden');
        last=y;
        ticking=false;
      };
      window.addEventListener('scroll',()=>{if(!ticking){ticking=true;requestAnimationFrame(update)}},{passive:true});
    }
  };if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();})();</script>`;

  let out = injectConfidence(body.replace(/<\/body>/i,`${script}</body>`));
  if(!/seller-handoff-v21-15\.js/i.test(out)) out=out.replace(/<\/body>/i,'<script defer src="/js/seller-handoff-v21-15.js?v=21.15.0"></script></body>');
  if(!/post-intelligence-v21\.js/i.test(out)) out=out.replace(/<\/body>/i,'<script defer src="/js/post-intelligence-v21.js?v=21.1.1"></script></body>');
  return out;
}

exports.handler=async function(event,context){
  const res=await previous.handler(event,context);
  const type=String(res?.headers?.["content-type"]||res?.headers?.["Content-Type"]||"");
  if(res?.statusCode===200 && /text\/html/i.test(type)){
    res.body=polish(res.body);
    res.headers={...(res.headers||{}),"cache-control":"no-store, max-age=0","pragma":"no-cache","expires":"0","x-trendpilot-mobile-polish":"20.9.6","x-trendpilot-internal-first":"21.15.0","x-trendpilot-tiktok-geo":"21.17.0","x-trendpilot-browser-compat":"21.17.0","x-trendpilot-post-intelligence":"21.1.1","x-trendpilot-product-confidence":CONFIDENCE_VERSION};
  }
  return res;
};
